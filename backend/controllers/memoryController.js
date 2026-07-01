const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Memory = require("../models/Memory");
const ShareLink = require("../models/ShareLink");
const Session = require("../models/Session");
const User = require("../models/User");
const { clearSessionCookies } = require("../authSessions");
const { securityInfo, securityWarn } = require("../securityLogger");

const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const UPLOADS_ROOT = path.resolve("uploads");
const PUBLIC_SHARE_EXPIRY_DAYS = Number(process.env.PUBLIC_SHARE_EXPIRY_DAYS || 7);
const ENCRYPTED_MEDIA_PREFIX = "enc:v1:";
const ENCRYPTED_MEDIA_MAGIC = Buffer.from("MTENC1");
const RESERVED_MEMORY_TITLE = "app/hide-image/";

const isReservedMemoryTitle = (title = "") => (
  String(title).trim().toLowerCase() === RESERVED_MEMORY_TITLE
);

const rejectReservedMemoryTitle = (req, res) => {
  if(!isReservedMemoryTitle(req.body?.title)){
    return false;
  }

  res.status(400).json({
    message:"title invalid. choose another title."
  });
  return true;
};

const getMediaEncryptionKey = () => crypto
  .createHash("sha256")
  .update(
    process.env.MEDIA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.CLOUDINARY_API_SECRET ||
    "memory-timeline-development-media-key"
  )
  .digest();

const encodeContentType = (contentType = "application/octet-stream") => (
  Buffer.from(contentType).toString("base64url")
);

const decodeContentType = (encoded = "") => {
  try{
    return Buffer.from(encoded, "base64url").toString("utf8") || "application/octet-stream";
  }catch{
    return "application/octet-stream";
  }
};

const getExtensionForContentType = (contentType = "") => {
  const normalizedType = contentType.toLowerCase();

  if(normalizedType.includes("webp")){
    return "webp";
  }

  if(normalizedType.includes("png")){
    return "png";
  }

  if(normalizedType.includes("jpeg") || normalizedType.includes("jpg")){
    return "jpg";
  }

  return "jpg";
};

const encryptMediaBytes = (bytes) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMediaEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([ENCRYPTED_MEDIA_MAGIC, iv, tag, encrypted]);
};

const decryptMediaBytes = (bytes) => {
  if(!Buffer.isBuffer(bytes) || bytes.length < ENCRYPTED_MEDIA_MAGIC.length + 28){
    throw new Error("Encrypted media is invalid");
  }

  const magic = bytes.subarray(0, ENCRYPTED_MEDIA_MAGIC.length);

  if(!magic.equals(ENCRYPTED_MEDIA_MAGIC)){
    throw new Error("Encrypted media is invalid");
  }

  const ivStart = ENCRYPTED_MEDIA_MAGIC.length;
  const iv = bytes.subarray(ivStart, ivStart + 12);
  const tag = bytes.subarray(ivStart + 12, ivStart + 28);
  const encrypted = bytes.subarray(ivStart + 28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMediaEncryptionKey(), iv);

  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

const isEncryptedMedia = (image = "") => String(image).startsWith(ENCRYPTED_MEDIA_PREFIX);

const parseEncryptedMedia = (image = "") => {
  if(!isEncryptedMedia(image)){
    return null;
  }

  const [, , encodedContentType, ...urlParts] = String(image).split(":");
  const url = urlParts.join(":");

  if(!url){
    return null;
  }

  return {
    contentType:decodeContentType(encodedContentType),
    url
  };
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
      .update(`timestamp=${timestamp}&type=authenticated${process.env.CLOUDINARY_API_SECRET}`)
      .digest("hex");
    const originalBytes = await fs.readFile(file.path);
    const shouldEncryptCloudinaryMedia = process.env.CLOUDINARY_ENCRYPT_MEDIA !== "false";
    const bytes = shouldEncryptCloudinaryMedia
      ? encryptMediaBytes(originalBytes)
      : originalBytes;
    const formData = new FormData();
    const blob = new Blob([bytes], {type:shouldEncryptCloudinaryMedia ? "application/octet-stream" : file.mimetype});
    const resourceType = shouldEncryptCloudinaryMedia ? "raw" : "image";
    const uploadName = shouldEncryptCloudinaryMedia ? `${file.originalname}.enc` : file.originalname;

    formData.append("file", blob, uploadName);
    formData.append("api_key", process.env.CLOUDINARY_API_KEY);
    formData.append("timestamp", timestamp);
    formData.append("type", "authenticated");
    formData.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      {
        method:"POST",
        body:formData
      }
    );

    if(!response.ok){
      const errorText = await response.text().catch(()=>"");
      securityWarn("cloudinary_upload_failed", {
        status:response.status,
        statusText:response.statusText,
        error:errorText.slice(0, 300)
      });
      throw new Error("Cloudinary upload failed");
    }

    const data = await response.json();
    await fs.unlink(file.path).catch(()=>{});
    return shouldEncryptCloudinaryMedia
      ? `${ENCRYPTED_MEDIA_PREFIX}${encodeContentType(file.mimetype)}:${data.secure_url}`
      : data.secure_url;
  }catch(error){
    await fs.unlink(file.path).catch(()=>{});
    throw error;
  }
};

const uploadImage = async (file) => {
  return uploadToCloudinary(file);
};

const getUploadedImages = async (req) => {
  if(Array.isArray(req.files)){
    return Promise.all(req.files.map(uploadImage));
  }

  if(req.files?.images?.length){
    return Promise.all(req.files.images.map(uploadImage));
  }

  if(req.file){
    return [await uploadImage(req.file)];
  }

  return [];
};

const getUploadedThumbnails = async (req) => {
  if(req.files?.thumbnails?.length){
    return Promise.all(req.files.thumbnails.map(uploadImage));
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

const getCloudinaryUrl = (image) => (
  parseEncryptedMedia(image)?.url || image
);

const getCloudinaryResource = (image) => {
  const cloudinaryUrl = getCloudinaryUrl(image);

  if(!cloudinaryUrl || !isCloudinaryConfigured()){
    return null;
  }

  try{
    const url = new URL(cloudinaryUrl);
    const baseMarker = `/${process.env.CLOUDINARY_CLOUD_NAME}/`;
    const baseIndex = url.pathname.indexOf(baseMarker);

    if(baseIndex === -1){
      return null;
    }

    const resourcePathWithType = url.pathname.slice(baseIndex + baseMarker.length);
    const [resourceType, deliveryType, ...resourceParts] = resourcePathWithType.split("/");

    if(!["image", "raw"].includes(resourceType) || deliveryType !== "authenticated" || !resourceParts.length){
      return null;
    }

    const resourcePath = resourceParts.join("/");
    const withoutSignature = resourcePath.replace(/^s--[^/]+--\//, "");
    const withoutVersion = withoutSignature.replace(/^v\d+\//, "");
    const publicId = resourceType === "image"
      ? withoutVersion.replace(/\.[^.]+$/, "")
      : withoutVersion;

    return {
      origin:url.origin,
      marker:`/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/authenticated/`,
      publicId,
      resourcePath,
      resourceType
    };
  }catch{
    return null;
  }
};

const signCloudinaryImageUrl = (image, transformation = "") => {
  const resource = getCloudinaryResource(image);

  if(!resource){
    return getCloudinaryUrl(image);
  }

  const {origin, marker, resourcePath, resourceType} = resource;

  if(resourcePath.startsWith("s--")){
    return getCloudinaryUrl(image);
  }

  const transformedResourcePath = transformation && resourceType === "image"
    ? `${transformation}/${resourcePath}`
    : resourcePath;
  const signature = createDeliverySignature(transformedResourcePath);
  return `${origin}${marker}s--${signature}--/${transformedResourcePath}`;
};

const isLocalImage = (image = "") => (
  image &&
  !isEncryptedMedia(image) &&
  !image.startsWith("http://") &&
  !image.startsWith("https://")
);

const getLocalUploadPath = (image) => {
  if(!isLocalImage(image)){
    return null;
  }

  const resolvedPath = path.resolve(UPLOADS_ROOT, path.basename(image));

  if(!resolvedPath.startsWith(`${UPLOADS_ROOT}${path.sep}`)){
    return null;
  }

  return resolvedPath;
};

const deleteLocalImage = async (image) => {
  const localPath = getLocalUploadPath(image);

  if(!localPath){
    return;
  }

  await fs.unlink(localPath).catch(()=>{});
};

const deleteCloudinaryImage = async (image) => {
  const resource = getCloudinaryResource(image);
  const publicId = resource?.publicId;

  if(!publicId){
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}&type=authenticated${process.env.CLOUDINARY_API_SECRET}`)
    .digest("hex");
  const formData = new FormData();

  formData.append("public_id", publicId);
  formData.append("type", "authenticated");
  formData.append("api_key", process.env.CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resource.resourceType}/destroy`, {
    method:"POST",
    body:formData
  });
};

const deleteStoredImages = async (memory) => {
  const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
  const thumbnails = memory.thumbnails || [];
  const uniqueImages = [...new Set([...images, ...thumbnails])];

  await Promise.all(uniqueImages.map(async (image) => {
    try{
      await deleteCloudinaryImage(image);
      await deleteLocalImage(image);
    }catch(error){
      console.error(`Failed to delete stored image: ${image}`, error.message);
    }
  }));
};

const withSignedImages = async (memory) => {
  const data = memory.toObject ? memory.toObject() : memory;
  const images = data.images?.length ? data.images : (data.image ? [data.image] : []);
  const thumbnails = data.thumbnails?.length ? data.thumbnails : [];

  return {
    ...data,
    image:images[0] || data.image || "",
    images,
    thumbnails
  };
};

const getMemoryImageList = (memory, kind = "images") => {
  if(kind === "thumbnails"){
    return memory.thumbnails || [];
  }

  return memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
};

const streamStoredImage = async (image, res, options = {}) => {
  if(!image){
    return res.status(404).json({message:"Image not found"});
  }

  const encryptedMedia = parseEncryptedMedia(image);
  const cloudinaryUrl = getCloudinaryUrl(image);

  if(cloudinaryUrl.startsWith("http://") || cloudinaryUrl.startsWith("https://")){
    const imageUrl = signCloudinaryImageUrl(image);
    const response = await fetch(imageUrl);

    if(!response.ok){
      return res.status(502).json({message:"Image fetch failed"});
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const cacheControl = options.public
      ? "public, max-age=300"
      : "private, max-age=300";
    const storedBytes = Buffer.from(await response.arrayBuffer());
    const bytes = encryptedMedia ? decryptMediaBytes(storedBytes) : storedBytes;

    res.setHeader("Content-Type", encryptedMedia?.contentType || contentType);
    res.setHeader("Cache-Control", cacheControl);
    return res.send(bytes);
  }

  const localPath = getLocalUploadPath(image);

  if(!localPath){
    return res.status(404).json({message:"Image not found"});
  }

  res.setHeader("Cache-Control", options.public ? "public, max-age=300" : "private, max-age=300");
  return res.sendFile(localPath, (error) => {
    if(error && !res.headersSent){
      res.status(error.statusCode || 404).json({message:"Image not found"});
    }
  });
};

const sanitizeDescription = (html = "") => {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
};

const buildMemoryPayload = (req, images, thumbnails = []) => ({
  title:req.body.title,
  description:sanitizeDescription(req.body.description),
  date:req.body.date,
  category:req.body.category || "Personal",
  reminderDate:req.body.reminderDate || undefined,
  ...(images.length ? {
    image:images[0],
    images,
    thumbnails
  } : {})
});

const parseRetainedMediaList = (value) => {
  if(value === undefined){
    return null;
  }

  try{
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((item)=>typeof item === "string" && item)
      : [];
  }catch{
    return [];
  }
};

const createToken = () => crypto.randomBytes(32).toString("base64url");
const createShareExpiry = () => new Date(Date.now() + PUBLIC_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
const trusted = (filter) => mongoose.trusted(filter);

const activeMemoryQuery = (extra = {}) => ({
  ...extra,
  deletedAt:null,
  hiddenAt:null
});

const trashMemoryQuery = (extra = {}) => ({
  ...extra,
  deletedAt:trusted({$exists:true, $ne:null})
});

const hiddenMemoryQuery = (extra = {}) => ({
  ...extra,
  deletedAt:null,
  hiddenAt:trusted({$exists:true, $ne:null})
});

const purgeExpiredTrash = async () => {
  const expiredMemories = await Memory.find({
    deletedAt:trusted({$exists:true, $ne:null}),
    trashExpiresAt:trusted({$lte:new Date()})
  });

  if(!expiredMemories.length){
    return 0;
  }

  await Promise.all(expiredMemories.map(deleteStoredImages));
  await Memory.deleteMany({_id:trusted({$in:expiredMemories.map((memory)=>memory._id)})});
  return expiredMemories.length;
};

let trashPurgeIntervalStarted = false;

const startTrashPurgeInterval = () => {
  if(trashPurgeIntervalStarted){
    return;
  }

  trashPurgeIntervalStarted = true;
  setInterval(() => {
    purgeExpiredTrash().catch((error)=>{
      console.error("Expired trash purge failed", error.message);
    });
  }, 6 * 60 * 60 * 1000).unref?.();
};

startTrashPurgeInterval();

// Add Memory
exports.addMemory = async (req, res) => {
  try {
    if(rejectReservedMemoryTitle(req, res)){
      return;
    }

    const images = await getUploadedImages(req);
    const thumbnails = await getUploadedThumbnails(req);

    const newMemory = new Memory({
      userId:req.user.userId,
      ...buildMemoryPayload(req, images, thumbnails),
      image:images[0] || "",
      images,
      thumbnails
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
    await purgeExpiredTrash();

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 30);
    const sortOrder = req.query.sort === "oldest" ? 1 : -1;
    const query = activeMemoryQuery({userId:req.user.userId});

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
        .limit(limit)
        .lean(),
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
      userId:req.user.userId,
      deletedAt:null
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
      userId:req.user.userId,
      deletedAt:null
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
    const encryptedMedia = parseEncryptedMedia(image);
    const extension = encryptedMedia
      ? getExtensionForContentType(encryptedMedia.contentType)
      : (path.extname(image).replace(".", "") || "jpg");
    const fileName = `${safeTitle}-${imageIndex + 1}.${extension}`;

    if(!image.startsWith("http") && !isEncryptedMedia(image)){
      const localPath = getLocalUploadPath(image);

      if(!localPath){
        return res.status(404).json({message:"Image not found"});
      }

      return res.download(localPath, fileName);
    }

    const imageUrl = signCloudinaryImageUrl(image);
    const response = await fetch(imageUrl);

    if(!response.ok){
      return res.status(502).json({message:"Image download failed"});
    }

    const contentType = encryptedMedia?.contentType || response.headers.get("content-type") || "application/octet-stream";
    const storedBytes = Buffer.from(await response.arrayBuffer());
    const bytes = encryptedMedia ? decryptMediaBytes(storedBytes) : storedBytes;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(bytes);
  }catch(error){
    res.status(500).json({message:error.message || "Image download failed"});
  }
};

exports.viewMemoryImage = async (req,res)=>{
  try{
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    const images = getMemoryImageList(memory, req.params.kind);
    const imageIndex = Number(req.params.index || 0);

    if(!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= images.length){
      return res.status(404).json({message:"Image not found"});
    }

    return streamStoredImage(images[imageIndex], res);
  }catch(error){
    res.status(500).json({message:error.message || "Image failed"});
  }
};

exports.viewPublicShareImage = async (req,res)=>{
  try{
    const {token, memoryId} = req.params;
    let memory = await Memory.findOne({
      _id:memoryId,
      publicToken:token,
      publicShareRevokedAt:null,
      publicShareExpiresAt:trusted({$gt:new Date()}),
      deletedAt:null
    });

    if(!memory){
      const share = await ShareLink.findOne({
        token,
        revokedAt:null,
        expiresAt:trusted({$gt:new Date()})
      });

      if(!share){
        securityWarn("public_share_image_rejected", {tokenPrefix:String(token).slice(0, 8)});
        return res.status(404).json({message:"Share not found"});
      }

      memory = await Memory.findOne({
        _id:memoryId,
        userId:share.userId,
        category:share.category,
        deletedAt:null
      });
    }

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    const images = getMemoryImageList(memory, "images");
    const imageIndex = Number(req.params.index || 0);

    if(!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= images.length){
      return res.status(404).json({message:"Image not found"});
    }

    return streamStoredImage(images[imageIndex], res, {public:true});
  }catch(error){
    res.status(500).json({message:error.message || "Image failed"});
  }
};

// Delete Memory
exports.deleteMemory = async (req,res)=>{

  try{

    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId,
      deletedAt:null
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    memory.deletedAt = new Date();
    memory.trashExpiresAt = new Date(Date.now() + TRASH_RETENTION_MS);
    await memory.save();

    res.json({
      message:"Memory moved to bin",
      memory:await withSignedImages(memory)
    });

  }
  catch(err){
    res.status(500).json(err);
  }

};

exports.hideMemory = async (req,res)=>{
  try{
    const memory = await Memory.findOne(activeMemoryQuery({
      _id:req.params.id,
      userId:req.user.userId
    }));

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    memory.hiddenAt = new Date();
    await memory.save();

    res.json({
      message:"Memory hidden",
      memory:await withSignedImages(memory)
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to hide memory"});
  }
};

exports.getHiddenMemories = async (req,res)=>{
  try{
    const memories = await Memory.find(hiddenMemoryQuery({
      userId:req.user.userId
    })).sort({hiddenAt:-1});

    res.json({
      memories:await Promise.all(memories.map(withSignedImages))
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to load hidden memories"});
  }
};

exports.unhideMemory = async (req,res)=>{
  try{
    const memory = await Memory.findOne(hiddenMemoryQuery({
      _id:req.params.id,
      userId:req.user.userId
    }));

    if(!memory){
      return res.status(404).json({message:"Hidden memory not found"});
    }

    memory.hiddenAt = null;
    await memory.save();

    res.json({
      message:"Memory unhidden",
      memory:await withSignedImages(memory)
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to unhide memory"});
  }
};

exports.permanentlyDeleteHiddenMemory = async (req,res)=>{
  try{
    const deleted = await Memory.findOneAndDelete(hiddenMemoryQuery({
      _id:req.params.id,
      userId:req.user.userId
    }));

    if(!deleted){
      return res.status(404).json({message:"Hidden memory not found"});
    }

    await deleteStoredImages(deleted);

    res.json({message:"Hidden memory permanently deleted"});
  }catch(err){
    res.status(500).json({message:err.message || "Unable to permanently delete hidden memory"});
  }
};

exports.clearAllMemories = async (req,res)=>{
  try{
    const now = new Date();
    const trashExpiresAt = new Date(now.getTime() + TRASH_RETENTION_MS);
    const result = await Memory.updateMany(
      {
        userId:req.user.userId,
        deletedAt:null
      },
      {
        $set:{
          deletedAt:now,
          trashExpiresAt
        }
      }
    );
    const moved = result.modifiedCount || 0;

    securityWarn("all_memories_moved_to_trash", {
      userId:String(req.user.userId),
      moved
    });

    res.json({
      message:moved > 0 ? "All memories moved to trash" : "No memories found",
      moved
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to clear memories"});
  }
};

exports.deleteAccount = async (req,res)=>{
  try{
    const password = String(req.body?.password || "");

    if(!password){
      return res.status(400).json({message:"Enter your application password"});
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);
    const validPassword = user ? await bcrypt.compare(password, user.password) : false;

    if(!validPassword){
      securityWarn("account_delete_password_failed", {userId:String(userId)});
      return res.status(401).json({message:"Application password is incorrect"});
    }

    const memories = await Memory.find({userId});

    await Promise.all(memories.map(deleteStoredImages));
    await Promise.all([
      Memory.deleteMany({userId}),
      ShareLink.deleteMany({userId}),
      Session.deleteMany({userId}),
      User.findByIdAndDelete(userId)
    ]);

    clearSessionCookies(res);
    securityWarn("account_deleted", {userId:String(userId)});
    res.json({message:"Account deleted"});
  }catch(err){
    res.status(500).json({message:err.message || "Unable to delete account"});
  }
};

// Update Memory
exports.updateMemory = async (req,res)=>{

  try{
    if(rejectReservedMemoryTitle(req, res)){
      return;
    }

    const images = await getUploadedImages(req);
    const thumbnails = await getUploadedThumbnails(req);
    const updateData = buildMemoryPayload(req, images, thumbnails);
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId,
      deletedAt:null
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    const previousStoredImages = images.length ? {
      image:memory.image,
      images:memory.images || [],
      thumbnails:memory.thumbnails || []
    } : null;
    let removedStoredImages = null;

    if(!images.length && Object.prototype.hasOwnProperty.call(req.body, "retainedImages")){
      const retainedImages = parseRetainedMediaList(req.body.retainedImages) || [];
      const retainedThumbnails = parseRetainedMediaList(req.body.retainedThumbnails) || [];
      const currentImages = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
      const currentThumbnails = memory.thumbnails || [];
      const retainedImageSet = new Set(retainedImages);
      const retainedThumbnailSet = new Set(retainedThumbnails);

      updateData.image = retainedImages[0] || "";
      updateData.images = retainedImages;
      updateData.thumbnails = retainedThumbnails.slice(0, retainedImages.length);
      removedStoredImages = {
        images:currentImages.filter((image)=>!retainedImageSet.has(image)),
        thumbnails:currentThumbnails.filter((image)=>!retainedThumbnailSet.has(image))
      };
    }

    Object.assign(memory, updateData);
    const updated = await memory.save();

    if(previousStoredImages){
      await deleteStoredImages(previousStoredImages);
    }

    if(removedStoredImages){
      await deleteStoredImages(removedStoredImages);
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
      userId:req.user.userId,
      deletedAt:null
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
      userId:req.user.userId,
      deletedAt:null
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    memory.publicToken = createToken();
    memory.publicShareExpiresAt = createShareExpiry();
    memory.publicShareRevokedAt = null;
    await memory.save();
    securityInfo("memory_share_created", {userId:String(req.user.userId), memoryId:String(memory._id)});

    res.json({
      token:memory.publicToken,
      expiresAt:memory.publicShareExpiresAt,
      warning:`Anyone with this link can view this memory until ${memory.publicShareExpiresAt.toISOString()}.`
    });
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

    await ShareLink.updateMany(
      {userId:req.user.userId, type:"category", category, revokedAt:null},
      {$set:{revokedAt:new Date()}}
    );

    const share = await ShareLink.create({
      userId:req.user.userId,
      type:"category",
      category,
      token:createToken(),
      expiresAt:createShareExpiry()
    });
    securityInfo("category_share_created", {userId:String(req.user.userId), category});

    res.json({
      token:share.token,
      expiresAt:share.expiresAt,
      warning:`Anyone with this link can view this category until ${share.expiresAt.toISOString()}.`
    });
  }catch(err){
    res.status(500).json(err);
  }
};

exports.revokeMemoryShare = async (req,res)=>{
  try{
    const memory = await Memory.findOne({
      _id:req.params.id,
      userId:req.user.userId
    });

    if(!memory){
      return res.status(404).json({message:"Memory not found"});
    }

    memory.publicShareRevokedAt = new Date();
    await memory.save();
    securityInfo("memory_share_revoked", {userId:String(req.user.userId), memoryId:String(memory._id)});

    res.json({message:"Share revoked"});
  }catch(err){
    res.status(500).json({message:"Unable to revoke share"});
  }
};

exports.revokeCategoryShare = async (req,res)=>{
  try{
    const {category} = req.body;

    if(!category){
      return res.status(400).json({message:"Category is required"});
    }

    await ShareLink.updateMany(
      {userId:req.user.userId, type:"category", category, revokedAt:null},
      {$set:{revokedAt:new Date()}}
    );
    securityInfo("category_share_revoked", {userId:String(req.user.userId), category});

    res.json({message:"Share revoked"});
  }catch(err){
    res.status(500).json({message:"Unable to revoke share"});
  }
};

exports.getPublicShare = async (req,res)=>{
  try{
    const memory = await Memory.findOne({
      publicToken:req.params.token,
      publicShareRevokedAt:null,
      publicShareExpiresAt:trusted({$gt:new Date()}),
      deletedAt:null
    });

    if(memory){
      return res.json({
        type:"memory",
        memory:await withSignedImages(memory)
      });
    }

    const share = await ShareLink.findOne({
      token:req.params.token,
      revokedAt:null,
      expiresAt:trusted({$gt:new Date()})
    });

    if(!share){
      return res.status(404).json({message:"Share not found"});
    }

    const memories = await Memory.find({
      userId:share.userId,
      category:share.category,
      deletedAt:null
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

exports.getTrashMemories = async (req,res)=>{
  try{
    await purgeExpiredTrash();

    const memories = await Memory.find(trashMemoryQuery({
      userId:req.user.userId
    })).sort({deletedAt:-1});

    res.json({
      memories:await Promise.all(memories.map(withSignedImages)),
      retentionDays:TRASH_RETENTION_DAYS
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to load trash"});
  }
};

exports.restoreMemory = async (req,res)=>{
  try{
    const memory = await Memory.findOne(trashMemoryQuery({
      _id:req.params.id,
      userId:req.user.userId
    }));

    if(!memory){
      return res.status(404).json({message:"Memory not found in trash"});
    }

    memory.deletedAt = null;
    memory.trashExpiresAt = null;
    await memory.save();

    res.json({
      message:"Memory recovered",
      memory:await withSignedImages(memory)
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to recover memory"});
  }
};

exports.restoreMemories = async (req,res)=>{
  try{
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

    if(!ids.length){
      return res.status(400).json({message:"Select memories to recover"});
    }

    const result = await Memory.updateMany(
      trashMemoryQuery({
        _id:trusted({$in:ids}),
        userId:req.user.userId
      }),
      {$set:{deletedAt:null, trashExpiresAt:null}}
    );

    res.json({
      message:"Memories recovered",
      restored:result.modifiedCount || 0
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to recover memories"});
  }
};

exports.permanentlyDeleteMemory = async (req,res)=>{
  try{
    const deleted = await Memory.findOneAndDelete(trashMemoryQuery({
      _id:req.params.id,
      userId:req.user.userId
    }));

    if(!deleted){
      return res.status(404).json({message:"Memory not found in trash"});
    }

    await deleteStoredImages(deleted);

    res.json({message:"Memory permanently deleted"});
  }catch(err){
    res.status(500).json({message:err.message || "Unable to permanently delete memory"});
  }
};

exports.permanentlyDeleteMemories = async (req,res)=>{
  try{
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

    if(!ids.length){
      return res.status(400).json({message:"Select memories to permanently delete"});
    }

    const memories = await Memory.find(trashMemoryQuery({
      _id:trusted({$in:ids}),
      userId:req.user.userId
    }));

    await Promise.all(memories.map(deleteStoredImages));
    await Memory.deleteMany({_id:trusted({$in:memories.map((memory)=>memory._id)})});

    res.json({
      message:"Memories permanently deleted",
      deleted:memories.length
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to permanently delete memories"});
  }
};

exports.emptyTrash = async (req,res)=>{
  try{
    const memories = await Memory.find(trashMemoryQuery({
      userId:req.user.userId
    }));

    await Promise.all(memories.map(deleteStoredImages));
    await Memory.deleteMany({_id:trusted({$in:memories.map((memory)=>memory._id)})});

    res.json({
      message:"Bin emptied",
      deleted:memories.length
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to empty bin"});
  }
};