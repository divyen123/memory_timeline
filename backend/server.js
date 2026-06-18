const { loadEnv } = require("./config");
loadEnv();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { rateLimit: expressRateLimit } = require("express-rate-limit");

const bcrypt = require("bcryptjs");

const memoryRoutes = require("./routes/memoryRoutes");
const User = require("./models/User");
const Memory = require("./models/Memory");
const Session = require("./models/Session");
const authMiddleware = require("./middleware/authMiddleware");
const {
  createSession,
  rotateSession,
  revokeCurrentSession,
  clearSessionCookies
} = require("./authSessions");
const { securityInfo, securityWarn, securityError } = require("./securityLogger");

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
  "cardBorderRadius",
  "topButtonsPosition",
  "topButtonsIconStyle",
  "topButtonsSize",
  "toolbarIconStyle",
  "toolbarIconSize",
  "toolbarButtonStretch",
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
    const requiredKeys = [
      "MONGODB_URI",
      "ALLOWED_ORIGINS",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET"
    ];

    if(process.env.CLOUD_STORAGE_PROVIDER !== "cloudinary"){
      throw new Error("CLOUD_STORAGE_PROVIDER must be set to cloudinary in production");
    }

    const missingKeys = requiredKeys.filter((key)=>!process.env[key]);

    if(missingKeys.length){
      throw new Error(`Missing required production environment variables: ${missingKeys.join(", ")}`);
    }
  }
};

const isStrongPassword = (password) => (
  typeof password === "string" &&
  password.length >= 10 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
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
  crossOriginResourcePolicy:{policy:"cross-origin"},
  contentSecurityPolicy:{
    directives:{
      defaultSrc:["'self'"],
      baseUri:["'self'"],
      fontSrc:["'self'", "https:", "data:"],
      formAction:["'self'"],
      frameAncestors:["'none'"],
      imgSrc:["'self'", "data:", "blob:", "https:"],
      objectSrc:["'none'"],
      scriptSrc:["'self'"],
      scriptSrcAttr:["'none'"],
      styleSrc:["'self'", "https:", "'unsafe-inline'"],
      connectSrc:["'self'", "https:"],
      upgradeInsecureRequests:[]
    }
  }
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
  credentials:true,
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
app.use(cookieParser());

app.use((req, res, next) => {
  if(!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)){
    return next();
  }

  const origin = req.get("origin");

  if(origin && !getAllowedOrigins().includes(origin)){
    securityWarn("origin_rejected", {ip:req.ip, method:req.method});
    return res.status(403).json({message:"Origin is not allowed"});
  }

  next();
});

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
      return res.status(400).json({message:"Password must be at least 10 characters and include uppercase, lowercase, and a number"});
    }

    const existingUser = await User.findOne({email:normalizedEmail});

    if(existingUser){
      return res.status(400).json({message:"Email already registered"});
    }

    const user = new User({
      email:normalizedEmail,
      password:await bcrypt.hash(password,10),
      onboardingCompleted:false
    });

    await user.save();
    securityInfo("registration_success", {userId:String(user._id), ip:req.ip});

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
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if(user){
      resetCodes.set(normalizedEmail, {
        codeHash:crypto.createHash("sha256").update(code).digest("hex"),
        expiresAt:Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000
      });
      securityInfo("password_reset_requested", {userId:String(user._id), ip:req.ip});
    }

    if(!isProduction && user){
      console.log(`Password reset code for ${normalizedEmail}: ${code}`);
    }

    res.json({
      message:"If that account exists, a verification code has been generated",
      devCode: process.env.NODE_ENV === "production" || !user ? undefined : code
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
      return res.status(400).json({message:"Password must be at least 10 characters and include uppercase, lowercase, and a number"});
    }

    const savedCode = resetCodes.get(normalizedEmail);
    const suppliedCodeHash = crypto.createHash("sha256").update(String(code)).digest("hex");

    if(!savedCode || savedCode.codeHash !== suppliedCodeHash || savedCode.expiresAt < Date.now()){
      return res.status(400).json({message:"Invalid or expired verification code"});
    }

    const user = await User.findOne({email:normalizedEmail});

    if(!user){
      return res.status(400).json({message:"Invalid or expired verification code"});
    }

    user.password = await bcrypt.hash(password,10);
    await user.save();
    await Session.deleteMany({userId:user._id});
    resetCodes.delete(normalizedEmail);
    securityInfo("password_reset", {userId:String(user._id), ip:req.ip});

    res.json({message:"Password reset successfully. Please log in again."});
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
    const valid = user ? await bcrypt.compare(password,user.password) : false;

    if(!user || !valid){
      rateLimit(loginAttempts, loginKey, 5, attemptWindowMs);
      securityWarn("login_failed", {ip:req.ip});
      return res.status(400).json({message:"Invalid email or password"});
    }

    loginAttempts.delete(loginKey);
    await createSession(req, res, user._id);
    securityInfo("login_success", {userId:String(user._id), ip:req.ip});

    res.json({
      authenticated:true,
      userId:String(user._id),
      onboardingRequired:user.onboardingCompleted === false
    });
  }catch(err){
    res.status(500).json({error:"Login failed"});
  }
});

app.post("/api/auth/refresh", async(req,res)=>{
  try{
    const session = await rotateSession(req, res);

    if(!session){
      clearSessionCookies(res);
      return res.status(401).json({message:"Session expired"});
    }

    res.json({authenticated:true, userId:String(session.userId)});
  }catch(err){
    securityError("session_refresh_error", {ip:req.ip});
    res.status(500).json({message:"Unable to refresh session"});
  }
});

app.get("/api/auth/session", authMiddleware, (req,res)=>{
  res.json({authenticated:true, userId:String(req.user.userId)});
});

app.post("/api/logout", async(req,res)=>{
  await revokeCurrentSession(req);
  clearSessionCookies(res);
  securityInfo("logout", {ip:req.ip});
  res.json({message:"Logged out"});
});

app.post("/api/logout-all", authMiddleware, async(req,res)=>{
  await Session.deleteMany({userId:req.user.userId});
  clearSessionCookies(res);
  securityInfo("logout_all", {userId:String(req.user.userId), ip:req.ip});
  res.json({message:"All sessions revoked"});
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
    const normalizedEmail = normalizeEmail(email);

    if(!normalizedEmail){
      return res.status(400).json({message:"Email is required"});
    }

    const parsedAge = age === "" || age === null || age === undefined
      ? null
      : Number(age);

    if(parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 0)){
      return res.status(400).json({message:"Age must be a positive whole number"});
    }

    const existingUser = await User.findOne({
      email:normalizedEmail,
      _id:mongoose.trusted({$ne:req.user.userId})
    });

    if(existingUser){
      return res.status(400).json({message:"Email already registered"});
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name:name?.trim() || "",
        age:parsedAge,
        email:normalizedEmail
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
      return res.status(400).json({message:"Password must be at least 10 characters and include uppercase, lowercase, and a number"});
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
    await Session.deleteMany({userId:user._id});
    clearSessionCookies(res);
    securityInfo("password_changed", {userId:String(user._id), ip:req.ip});

    res.json({message:"Password updated. Please log in again."});

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

app.get("/api/health", async(req,res)=>{
  const databaseReady = mongoose.connection.readyState === 1;

  res.status(databaseReady ? 200 : 503).json({
    status:databaseReady ? "ok" : "degraded",
    database:databaseReady ? "connected" : "unavailable",
    timestamp:new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  if(err.message === "Not allowed by CORS"){
    return res.status(403).json({message:"Origin is not allowed"});
  }

  securityError("request_error", {path:req.path, method:req.method});

  return res.status(500).json({
    message:isProduction ? "Server error" : err.message
  });
});

/* MONGODB */
mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize:Number(process.env.MONGODB_MAX_POOL_SIZE || 10),
  serverSelectionTimeoutMS:10000
})
.then(()=>securityInfo("database_connected"))
.catch(()=>securityError("database_connection_failed"));

mongoose.connection.on("disconnected", ()=>securityWarn("database_disconnected"));
mongoose.connection.on("error", ()=>securityError("database_error"));

/* SERVER */

app.listen(PORT,()=>{
console.log(`Server running on port ${PORT}`);
});
