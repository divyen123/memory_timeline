const { loadEnv } = require("./config");
loadEnv();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit: expressRateLimit } = require("express-rate-limit");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const memoryRoutes = require("./routes/memoryRoutes");
const User = require("./models/User");
const Memory = require("./models/Memory");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const RESET_CODE_EXPIRY_MINUTES = Number(process.env.RESET_CODE_EXPIRY_MINUTES || 10);
const isProduction = process.env.NODE_ENV === "production";
const resetCodes = new Map();
const loginAttempts = new Map();
const resetAttempts = new Map();

const getAllowedOrigins = () => (
  (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin)=>origin.trim())
    .filter(Boolean)
);

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const SETTINGS_PROFILE_KEYS = new Set(["mobile", "desktop"]);
const SETTINGS_KEYS = new Set([
  "reminderLeadDays",
  "defaultTheme",
  "cardSize",
  "topButtonsPosition",
  "topButtonsSize",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "containerGlass",
  "containerGlassAlpha",
  "buttonBackgroundColor",
  "buttonGlass",
  "buttonGlassAlpha",
  "heartsSpeed",
  "lightGradientStart",
  "lightGradientMiddle",
  "lightGradientEnd",
  "darkGradientStart",
  "darkGradientMiddle",
  "darkGradientEnd",
  "hoverEnabled",
  "hoverScale",
  "soundEnabled",
  "createSound",
  "updateSound",
  "reminderSound"
]);

const sanitizeSettings = (settings = {}) => (
  Object.fromEntries(
    Object.entries(settings)
      .filter(([key])=>SETTINGS_KEYS.has(key))
  )
);

const validateProductionConfig = () => {
  if(!JWT_SECRET){
    throw new Error("JWT_SECRET is required");
  }

  if(isProduction && JWT_SECRET.length < 32){
    console.warn("JWT_SECRET is shorter than 32 characters. Rotate it to a longer secret when active sessions can be refreshed.");
  }

  if(isProduction){
    const requiredKeys = ["MONGODB_URI", "ALLOWED_ORIGINS"];

    if(process.env.CLOUD_STORAGE_PROVIDER === "s3"){
      requiredKeys.push("AWS_REGION", "AWS_S3_BUCKET");
    }

    const missingKeys = requiredKeys.filter((key)=>!process.env[key]);

    if(missingKeys.length){
      throw new Error(`Missing required production environment variables: ${missingKeys.join(", ")}`);
    }
  }
};

const isStrongPassword = (password) => (
  typeof password === "string" &&
  password.length >= 8 &&
  /[A-Za-z]/.test(password) &&
  /\d/.test(password)
);

const rateLimit = (store, key, limit, windowMs) => {
  const now = Date.now();
  const entry = store.get(key) || {count:0, firstAttempt:now};

  if(now - entry.firstAttempt > windowMs){
    store.set(key, {count:1, firstAttempt:now});
    return true;
  }

  entry.count += 1;
  store.set(key, entry);

  return entry.count <= limit;
};

validateProductionConfig();

/* MIDDLEWARE */
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.disable("x-powered-by");

app.use(helmet({
  crossOriginResourcePolicy:{policy:"cross-origin"}
}));

app.use(cors({
  origin(origin, callback){
    const allowedOrigins = getAllowedOrigins();

    if(!origin || allowedOrigins.includes(origin)){
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  methods:["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:["Content-Type", "Authorization"],
  credentials:false,
  maxAge:600
}));

app.use(expressRateLimit({
  windowMs:15 * 60 * 1000,
  limit:Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders:"draft-8",
  legacyHeaders:false,
  message:{message:"Too many requests. Try again later."}
}));

app.use(express.json({limit:"1mb"}));

/* SERVE UPLOADED IMAGES */
app.use("/uploads", express.static("uploads", {
  maxAge:"30d",
  immutable:true
}));

/* AUTH ROUTES */

/* REGISTER */
app.post("/api/register", async(req,res)=>{

  try{

    const {email,password} = req.body;
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail || !password){
      return res.status(400).json({message:"Email and password are required"});
    }

    if(!isStrongPassword(password)){
      return res.status(400).json({message:"Password must be at least 8 characters and include a number"});
    }

    const existingUser = await User.findOne({email:normalizedEmail});

    if(existingUser){
      return res.status(400).json({message:"Email already registered"});
    }

    const hashedPassword = await bcrypt.hash(password,10);

    const user = new User({
      email:normalizedEmail,
      password:hashedPassword,
      onboardingCompleted:false
    });

    await user.save();

    res.json({message:"User registered successfully"});

  }catch(err){

    res.status(500).json({error:"Registration failed"});

  }

});

/* REQUEST PASSWORD RESET CODE */

app.post("/api/request-reset-code", async(req,res)=>{

  try{

    const {email} = req.body;
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail){
      return res.status(400).json({message:"Email is required"});
    }

    if(!rateLimit(resetAttempts, normalizedEmail, 3, 15 * 60 * 1000)){
      return res.status(429).json({message:"Too many reset attempts. Try again later."});
    }

    const user = await User.findOne({email:normalizedEmail});

    if(!user){
      return res.status(400).json({message:"User not found"});
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000;

    resetCodes.set(normalizedEmail, {code, expiresAt});

    if(!isProduction){
      console.log(`Password reset code for ${normalizedEmail}: ${code}`);
    }

    res.json({
      message:"Verification code generated",
      devCode: process.env.NODE_ENV === "production" ? undefined : code
    });

  }catch(err){

    res.status(500).json({error:"Reset code request failed"});

  }

});

/* RESET PASSWORD */

app.post("/api/reset-password", async(req,res)=>{

  try{

    const {email,code,password} = req.body;
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail || !code || !password){
      return res.status(400).json({message:"Email, code, and new password are required"});
    }

    if(!isStrongPassword(password)){
      return res.status(400).json({message:"Password must be at least 8 characters and include a number"});
    }

    const savedCode = resetCodes.get(normalizedEmail);

    if(!savedCode || savedCode.code !== code || savedCode.expiresAt < Date.now()){
      return res.status(400).json({message:"Invalid or expired verification code"});
    }

    const user = await User.findOne({email:normalizedEmail});

    if(!user){
      return res.status(400).json({message:"User not found"});
    }

    user.password = await bcrypt.hash(password,10);

    await user.save();

    resetCodes.delete(normalizedEmail);

    res.json({message:"Password reset successfully"});

  }catch(err){

    res.status(500).json({error:"Password reset failed"});

  }

});

/* LOGIN */

app.post("/api/login", async(req,res)=>{

  try{

    const {email,password} = req.body;
    const normalizedEmail = normalizeEmail(email);
    const loginKey = normalizedEmail || req.ip;

    const existingAttempt = loginAttempts.get(loginKey);
    const attemptWindowMs = 15 * 60 * 1000;

    if(
      existingAttempt &&
      existingAttempt.count >= 5 &&
      Date.now() - existingAttempt.firstAttempt <= attemptWindowMs
    ){
      return res.status(429).json({message:"Too many login attempts. Try again later."});
    }

    const user = await User.findOne({email:normalizedEmail});

    if(!user){
      rateLimit(loginAttempts, loginKey, 5, attemptWindowMs);
      return res.status(400).json({message:"User not found"});
    }

    const valid = await bcrypt.compare(password,user.password);

    if(!valid){
      rateLimit(loginAttempts, loginKey, 5, attemptWindowMs);
      return res.status(400).json({message:"Invalid password"});
    }

    loginAttempts.delete(loginKey);

    const token = jwt.sign(
      {userId:user._id},
      JWT_SECRET,
      {expiresIn:"7d"}
    );

    res.json({
      token,
      onboardingRequired:user.onboardingCompleted === false
    });

  }catch(err){

    res.status(500).json({error:"Login failed"});

  }

});

app.patch("/api/onboarding/complete", authMiddleware, async(req,res)=>{

  try{

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {$set:{onboardingCompleted:true}},
      {new:true}
    ).select("_id onboardingCompleted");

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    res.json({
      message:"Onboarding completed",
      onboardingCompleted:true
    });

  }catch(err){

    res.status(500).json({error:"Unable to complete onboarding"});

  }

});

/* PROFILE */

app.get("/api/profile", authMiddleware, async(req,res)=>{

  try{

    const user = await User.findById(req.user.userId).select("-password");
    const activeMemoryFilter = {
      userId:req.user.userId,
      deletedAt:null
    };
    const memoryCount = await Memory.countDocuments(activeMemoryFilter);
    const favoriteCount = await Memory.countDocuments({
      ...activeMemoryFilter,
      favorite:true
    });

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    res.json({
      name:user.name || "",
      age:user.age ?? "",
      email:user.email,
      memoryCount,
      favoriteCount
    });

  }catch(err){

    res.status(500).json({error:"Profile failed"});

  }

});

app.put("/api/profile", authMiddleware, async(req,res)=>{

  try{

    const {name,age,email} = req.body;

    if(!email){
      return res.status(400).json({message:"Email is required"});
    }

    const parsedAge = age === "" || age === null || age === undefined
      ? null
      : Number(age);

    if(parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 0)){
      return res.status(400).json({message:"Age must be a positive whole number"});
    }

    const existingUser = await User.findOne({
      email,
      _id:{$ne:req.user.userId}
    });

    if(existingUser){
      return res.status(400).json({message:"Email already registered"});
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name:name?.trim() || "",
        age:parsedAge,
        email
      },
      {new:true}
    ).select("-password");

    res.json({
      name:user.name || "",
      age:user.age ?? "",
      email:user.email
    });

  }catch(err){

    res.status(500).json({error:"Profile update failed"});

  }

});

app.put("/api/profile/password", authMiddleware, async(req,res)=>{

  try{

    const {currentPassword,newPassword} = req.body;

    if(!currentPassword || !newPassword){
      return res.status(400).json({message:"Current and new password are required"});
    }

    if(!isStrongPassword(newPassword)){
      return res.status(400).json({message:"Password must be at least 8 characters and include a number"});
    }

    const user = await User.findById(req.user.userId);

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    const valid = await bcrypt.compare(currentPassword,user.password);

    if(!valid){
      return res.status(400).json({message:"Current password is incorrect"});
    }

    user.password = await bcrypt.hash(newPassword,10);
    await user.save();

    res.json({message:"Password updated"});

  }catch(err){

    res.status(500).json({error:"Password update failed"});

  }

});

app.get("/api/profile/settings/:profile", authMiddleware, async(req,res)=>{

  try{

    const {profile} = req.params;

    if(!SETTINGS_PROFILE_KEYS.has(profile)){
      return res.status(400).json({message:"Invalid settings profile"});
    }

    const user = await User.findById(req.user.userId).select("settingsProfiles");

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    res.json({
      profile,
      settings:user.settingsProfiles?.[profile] || {}
    });

  }catch(err){

    res.status(500).json({error:"Settings load failed"});

  }

});

app.put("/api/profile/settings/:profile", authMiddleware, async(req,res)=>{

  try{

    const {profile} = req.params;

    if(!SETTINGS_PROFILE_KEYS.has(profile)){
      return res.status(400).json({message:"Invalid settings profile"});
    }

    const settings = sanitizeSettings(req.body?.settings);
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {$set:{[`settingsProfiles.${profile}`]:settings}},
      {new:true, runValidators:true}
    ).select("settingsProfiles");

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    res.json({
      profile,
      settings:user.settingsProfiles?.[profile] || settings
    });

  }catch(err){

    res.status(500).json({error:"Settings update failed"});

  }

});

/* MEMORY ROUTES */
app.use("/api", memoryRoutes);

app.use((err, req, res, next) => {
  if(err.message === "Not allowed by CORS"){
    return res.status(403).json({message:"Origin is not allowed"});
  }

  return res.status(500).json({
    message:isProduction ? "Server error" : err.message
  });
});

/* MONGODB */
mongoose.connect(process.env.MONGODB_URI)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

/* SERVER */

app.listen(PORT,()=>{
console.log(`Server running on port ${PORT}`);
});
