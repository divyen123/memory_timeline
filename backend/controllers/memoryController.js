const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
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

const signCloudinaryImageUrl = (image, transformation = "") => {
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

    const transformedResourcePath = transformation
      ? `${transformation}/${resourcePath}`
      : resourcePath;
    const signature = createDeliverySignature(transformedResourcePath);
    return `${url.origin}${marker}s--${signature}--/${transformedResourcePath}`;
  }catch{
    return image;
  }
};

const isLocalImage = (image = "") => (
  image &&
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

const getCloudinaryPublicId = (image) => {
  if(!image || !isCloudinaryConfigured()){
    return null;
  }

  try{
    const url = new URL(image);
    const marker = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/`;
    const markerIndex = url.pathname.indexOf(marker);

    if(markerIndex === -1){
      return null;
    }

    const resourcePath = url.pathname.slice(markerIndex + marker.length);
    const withoutSignature = resourcePath.replace(/^s--[^/]+--\//, "");
    const withoutVersion = withoutSignature.replace(/^v\d+\//, "");

    return withoutVersion.replace(/\.[^.]+$/, "");
  }catch{
    return null;
  }
};

const deleteCloudinaryImage = async (image) => {
  const publicId = getCloudinaryPublicId(image);

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

  await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
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

const signImageUrl = async (image) => {
  return signCloudinaryImageUrl(image);
};

const withSignedImages = async (memory) => {
  const data = memory.toObject ? memory.toObject() : memory;
  const images = data.images?.length ? data.images : (data.image ? [data.image] : []);
  const signedImages = await Promise.all(images.map(signImageUrl));
  const thumbnails = data.thumbnails?.length ? data.thumbnails : [];
  const signedThumbnails = thumbnails.length
    ? await Promise.all(thumbnails.map(signImageUrl))
    : isCloudinaryConfigured()
      ? images.map((image) => signCloudinaryImageUrl(image, "c_fill,w_220,h_180,q_auto:eco,f_auto"))
      : signedImages;

  return {
    ...data,
    image:signedImages[0] || data.image || "",
    images:signedImages,
    thumbnails:signedThumbnails
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

  if(image.startsWith("http://") || image.startsWith("https://")){
    return res.redirect(signCloudinaryImageUrl(image));
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

const createToken = () => crypto.randomBytes(32).toString("base64url");
const createShareExpiry = () => new Date(Date.now() + PUBLIC_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
const trusted = (filter) => mongoose.trusted(filter);

const activeMemoryQuery = (extra = {}) => ({
  ...extra,
  deletedAt:null
});

const trashMemoryQuery = (extra = {}) => ({
  ...extra,
  deletedAt:trusted({$exists:true, $ne:null})
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
    const extension = path.extname(image).replace(".", "") || "jpg";
    const fileName = `${safeTitle}-${imageIndex + 1}.${extension}`;

    if(!image.startsWith("http")){
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

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());

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

    securityWarn("all_memories_moved_to_trash", {
      userId:String(req.user.userId),
      moved:result.modifiedCount || 0
    });

    res.json({
      message:"All memories moved to trash",
      moved:result.modifiedCount || 0
    });
  }catch(err){
    res.status(500).json({message:err.message || "Unable to clear memories"});
  }
};

exports.deleteAccount = async (req,res)=>{
  try{
    const userId = req.user.userId;
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

    const images = await getUploadedImages(req);
    const thumbnails = await getUploadedThumbnails(req);
    const updateData = buildMemoryPayload(req, images, thumbnails);

    const updated = await Memory.findOneAndUpdate(
      {
        _id:req.params.id,
        userId:req.user.userId,
        deletedAt:null
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
