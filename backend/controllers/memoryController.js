const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const Memory = require("../models/Memory");
const ShareLink = require("../models/ShareLink");

const getS3Client = () => new S3Client({
  region:process.env.AWS_REGION,
  credentials:process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
      accessKeyId:process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY
    }
    : undefined
});

const isS3Configured = () => (
  process.env.CLOUD_STORAGE_PROVIDER === "s3" &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET
);

const uploadToS3 = async (file) => {
  if(process.env.CLOUD_STORAGE_PROVIDER !== "s3"){
    return file.filename;
  }

  if(!isS3Configured()){
    await fs.unlink(file.path).catch(()=>{});
    throw new Error("S3 storage is not configured");
  }

  try{
    const extension = path.extname(file.originalname);
    const key = `memories/${Date.now()}-${crypto.randomBytes(10).toString("hex")}${extension}`;
    const bytes = await fs.readFile(file.path);

    await getS3Client().send(new PutObjectCommand({
      Bucket:process.env.AWS_S3_BUCKET,
      Key:key,
      Body:bytes,
      ContentType:file.mimetype
    }));

    await fs.unlink(file.path).catch(()=>{});
    return `s3://${process.env.AWS_S3_BUCKET}/${key}`;
  }catch(error){
    await fs.unlink(file.path).catch(()=>{});
    throw error;
  }
};

const uploadToCloudinary = async (file) => {
  if(process.env.CLOUD_STORAGE_PROVIDER !== "cloudinary"){
    return file.filename;
  }

  if(
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ){
    await fs.unlink(file.path).catch(()=>{});
    throw new Error("Cloudinary credentials are missing");
  }

  try{
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`)
      .digest("hex");
    const bytes = await fs.readFile(file.path);
    const formData = new FormData();
    const blob = new Blob([bytes], {type:file.mimetype});

    formData.append("file", blob, file.originalname);
    formData.append("api_key", process.env.CLOUDINARY_API_KEY);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated`,
      {
        method:"POST",
        body:formData
      }
    );

    if(!response.ok){
      throw new Error("Cloudinary upload failed");
    }

    const data = await response.json();
    await fs.unlink(file.path).catch(()=>{});
    return data.secure_url;
  }catch(error){
    await fs.unlink(file.path).catch(()=>{});
    throw error;
  }
};

const uploadImage = async (file) => {
  if(process.env.CLOUD_STORAGE_PROVIDER === "s3"){
    return uploadToS3(file);
  }

  return uploadToCloudinary(file);
};

const getUploadedImages = async (req) => {
  if(req.files?.length){
    return Promise.all(req.files.map(uploadImage));
  }

  if(req.file){
    return [await uploadImage(req.file)];
  }

  return [];
};

const isCloudinaryConfigured = () => (
  process.env.CLOUD_STORAGE_PROVIDER === "cloudinary" &&
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_SECRET
);

const createDeliverySignature = (resourcePath) => {
  const digest = crypto
    .createHash("sha1")
    .update(`${resourcePath}${process.env.CLOUDINARY_API_SECRET}`)
    .digest("base64");

  return digest
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .slice(0, 8);
};

const signCloudinaryImageUrl = (image) => {
  if(!image || !isCloudinaryConfigured()){
    return image;
  }

  try{
    const url = new URL(image);
    const marker = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/`;
    const markerIndex = url.pathname.indexOf(marker);

    if(markerIndex === -1){
      return image;
    }

    const resourcePath = url.pathname.slice(markerIndex + marker.length);

    if(resourcePath.startsWith("s--")){
      return image;
    }

    const signature = createDeliverySignature(resourcePath);
    return `${url.origin}${marker}s--${signature}--/${resourcePath}`;
  }catch{
    return image;
  }
};

const signS3ImageUrl = async (image) => {
  if(!image?.startsWith("s3://") || !isS3Configured()){
    return image;
  }

  const s3Path = image.replace("s3://", "");
  const slashIndex = s3Path.indexOf("/");
  const bucket = s3Path.slice(0, slashIndex);
  const key = s3Path.slice(slashIndex + 1);

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket:bucket,
      Key:key
    }),
    {expiresIn:Number(process.env.AWS_SIGNED_URL_EXPIRY_SECONDS || 3600)}
  );
};

const parseS3Image = (image) => {
  if(!image?.startsWith("s3://")){
    return null;
  }

  const s3Path = image.replace("s3://", "");
  const slashIndex = s3Path.indexOf("/");

  if(slashIndex === -1){
    return null;
  }

  return {
    bucket:s3Path.slice(0, slashIndex),
    key:s3Path.slice(slashIndex + 1)
  };
};

const deleteS3Image = async (image) => {
  const parsed = parseS3Image(image);

  if(!parsed || !isS3Configured()){
    return;
  }

  await getS3Client().send(new DeleteObjectCommand({
    Bucket:parsed.bucket,
    Key:parsed.key
  }));
};

const deleteStoredImages = async (memory) => {
  const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
  const uniqueImages = [...new Set(images)];

  await Promise.all(uniqueImages.map(async (image) => {
    try{
      await deleteS3Image(image);
    }catch(error){
      console.error(`Failed to delete stored image: ${image}`, error.message);
    }
  }));
};

const signImageUrl = async (image) => {
  if(image?.startsWith("s3://")){
    return signS3ImageUrl(image);
  }

  return signCloudinaryImageUrl(image);
};

const withSignedImages = async (memory) => {
  const data = memory.toObject ? memory.toObject() : memory;
  const images = data.images?.length ? data.images : (data.image ? [data.image] : []);
  const signedImages = await Promise.all(images.map(signImageUrl));

  return {
    ...data,
    image:signedImages[0] || data.image || "",
    images:signedImages
  };
};

const sanitizeDescription = (html = "") => {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
};

const buildMemoryPayload = (req, images) => ({
  title:req.body.title,
  description:sanitizeDescription(req.body.description),
  date:req.body.date,
  category:req.body.category || "Personal",
  reminderDate:req.body.reminderDate || undefined,
  ...(images.length ? {
    image:images[0],
    images
  } : {})
});

const createToken = () => crypto.randomBytes(18).toString("hex");

// Add Memory
exports.addMemory = async (req, res) => {
  try {
    const images = await getUploadedImages(req);

    const newMemory = new Memory({
      userId:req.user.userId,
      ...buildMemoryPayload(req, images),
      image:images[0] || "",
      images
    });

    const savedMemory = await newMemory.save();
    res.status(201).json(await withSignedImages(savedMemory));

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Memories
exports.getMemories = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 30);
    const sortOrder = req.query.sort === "oldest" ? 1 : -1;
    const query = {userId:req.user.userId};

    if(req.query.category && req.query.category !== "All"){
      query.category = req.query.category;
    }

    if(req.query.favorite === "true"){
      query.favorite = true;
    }

    if(req.query.search){
      const regex = new RegExp(req.query.search, "i");
      query.$or = [
        {title:regex},
        {description:regex},
        {category:regex}
      ];
    }

    const [memories,total] = await Promise.all([
      Memory.find(query)
        .sort({ date: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit),
      Memory.countDocuments(query)
    ]);

    res.json({
      memories:await Promise.all(memories.map(withSignedImages)),
      page,
      limit,
      total,
      totalPages:Math.ceil(total / limit),
      hasMore:page * limit < total
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get One Memory
exports.getMemory = async (req, res) => {
  try {
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    res.json(await withSignedImages(memory));

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.downloadMemoryImage = async (req,res)=>{
  try{
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
    const imageIndex = Number(req.params.index || 0);
    const image = images[imageIndex];

    if(!image){
      return res.status(404).json({message:"Image not found"});
    }

    const safeTitle = memory.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "memory";
    const extension = path.extname(image).replace(".", "") || "jpg";
    const fileName = `${safeTitle}-${imageIndex + 1}.${extension}`;

    if(!image.startsWith("http") && !image.startsWith("s3://")){
      return res.download(path.resolve("uploads", image), fileName);
    }

    const imageUrl = image.startsWith("s3://")
      ? await signS3ImageUrl(image)
      : signCloudinaryImageUrl(image);
    const response = await fetch(imageUrl);

    if(!response.ok){
      return res.status(502).json({message:"Image download failed"});
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(bytes);
  }catch(error){
    res.status(500).json({message:error.message || "Image download failed"});
  }
};

// Delete Memory
exports.deleteMemory = async (req,res)=>{

  try{

    const deleted = await Memory.findOneAndDelete({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!deleted){
      return res.status(404).json({message:"Memory not found"});
    }

    await deleteStoredImages(deleted);

    res.json({message:"Memory deleted"});

  }
  catch(err){
    res.status(500).json(err);
  }

};

// Update Memory
exports.updateMemory = async (req,res)=>{

  try{

    const images = await getUploadedImages(req);
    const updateData = buildMemoryPayload(req, images);

    const updated = await Memory.findOneAndUpdate(
      {
        _id:req.params.id,
        userId:req.user.userId
      },
      updateData,
      {new:true}
    );

    if(!updated){
      return res.status(404).json({message:"Memory not found"});
    }

    res.json(await withSignedImages(updated));

  }
  catch(err){
    res.status(500).json(err);
  }

};

// Toggle Favorite
exports.toggleFavorite = async (req,res)=>{

  try{

    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    memory.favorite = !memory.favorite;
    await memory.save();

    res.json(await withSignedImages(memory));

  }
  catch(err){
    res.status(500).json(err);
  }

};

exports.createMemoryShare = async (req,res)=>{
  try{
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    if(!memory.publicToken){
      memory.publicToken = createToken();
      await memory.save();
    }

    res.json({token:memory.publicToken});
  }catch(err){
    res.status(500).json(err);
  }
};

exports.createCategoryShare = async (req,res)=>{
  try{
    const {category} = req.body;

    if(!category){
      return res.status(400).json({message:"Category is required"});
    }

    let share = await ShareLink.findOne({
      userId:req.user.userId,
      type:"category",
      category
    });

    if(!share){
      share = await ShareLink.create({
        userId:req.user.userId,
        type:"category",
        category,
        token:createToken()
      });
    }

    res.json({token:share.token});
  }catch(err){
    res.status(500).json(err);
  }
};

exports.getPublicShare = async (req,res)=>{
  try{
    const memory = await Memory.findOne({publicToken:req.params.token});

    if(memory){
      return res.json({
        type:"memory",
        memory:await withSignedImages(memory)
      });
    }

    const share = await ShareLink.findOne({token:req.params.token});

    if(!share){
      return res.status(404).json({message:"Share not found"});
    }

    const memories = await Memory.find({
      userId:share.userId,
      category:share.category
    }).sort({date:-1});

    res.json({
      type:"category",
      category:share.category,
      memories:await Promise.all(memories.map(withSignedImages))
    });
  }catch(err){
    res.status(500).json(err);
  }
};
