const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const authMiddleware = require("../middleware/authMiddleware");
const { securityWarn } = require("../securityLogger");

const {
  getMemories,
  getMemory,
  getTrashMemories,
  downloadMemoryImage,
  viewMemoryImage,
  viewPublicShareImage,
  addMemory,
  deleteMemory,
  clearAllMemories,
  deleteAccount,
  restoreMemory,
  restoreMemories,
  permanentlyDeleteMemory,
  permanentlyDeleteMemories,
  emptyTrash,
  updateMemory,
  toggleFavorite,
  createMemoryShare,
  createCategoryShare,
  revokeMemoryShare,
  revokeCategoryShare,
  getPublicShare
} = require("../controllers/memoryController");

const uploadDir = path.resolve("uploads");
const MAX_MEMORY_IMAGES = 10;
fs.mkdirSync(uploadDir, {recursive:true});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname
      .replace(/[^a-z0-9.\-_]+/gi, "-")
      .replace(/^-+|-+$/g, "");

    cb(null, Date.now() + "-" + safeName);
  }
});

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage,
  limits:{
    fileSize:Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
    files:MAX_MEMORY_IMAGES * 2
  },
  fileFilter(req, file, cb){
    const extension = path.extname(file.originalname || "").toLowerCase();

    if(allowedImageTypes.has(file.mimetype) && allowedExtensions.has(extension)){
      cb(null, true);
      return;
    }

    cb(new Error("Only JPG, PNG, and WebP images are allowed"));
  }
});

const cleanupFiles = async (files) => {
  await Promise.all(
    files
      .filter((file)=>file?.path)
      .map((file)=>fsp.unlink(file.path).catch(()=>{}))
  );
};

const processUploadedImage = async (file, kind) => {
  const maxWidth = kind === "thumbnail"
    ? Number(process.env.THUMBNAIL_MAX_WIDTH || 400)
    : Number(process.env.IMAGE_MAX_WIDTH || 1200);
  const outputPath = `${file.path}.webp`;

  try{
    const image = sharp(file.path, {
      failOn:"error",
      limitInputPixels:Number(process.env.MAX_UPLOAD_PIXELS || 28000000)
    });
    const metadata = await image.metadata();

    if(!["jpeg", "png", "webp"].includes(metadata.format)){
      throw new Error("Only JPG, PNG, and WebP images are allowed");
    }

    await image
      .rotate()
      .resize({
        width:maxWidth,
        withoutEnlargement:true,
        fit:"inside"
      })
      .webp({quality:kind === "thumbnail" ? 72 : 82, effort:4})
      .toFile(outputPath);

    await fsp.unlink(file.path).catch(()=>{});

    file.path = outputPath;
    file.filename = `${path.parse(file.filename).name}.webp`;
    file.originalname = `${path.parse(file.originalname || file.filename).name}.webp`;
    file.mimetype = "image/webp";
    file.size = (await fsp.stat(outputPath)).size;
  }catch(error){
    await fsp.unlink(file.path).catch(()=>{});
    await fsp.unlink(outputPath).catch(()=>{});
    throw error;
  }
};

const validateAndProcessImages = async (req, res, next) => {
  const imageFiles = req.files?.images || [];
  const thumbnailFiles = req.files?.thumbnails || [];
  const allFiles = [...imageFiles, ...thumbnailFiles];

  try{
    if(imageFiles.length > MAX_MEMORY_IMAGES || thumbnailFiles.length > MAX_MEMORY_IMAGES){
      throw new Error(`Maximum is ${MAX_MEMORY_IMAGES} images`);
    }

    if(thumbnailFiles.length && thumbnailFiles.length !== imageFiles.length){
      throw new Error("Each image must have a matching thumbnail");
    }

    await Promise.all([
      ...imageFiles.map((file)=>processUploadedImage(file, "image")),
      ...thumbnailFiles.map((file)=>processUploadedImage(file, "thumbnail"))
    ]);

    next();
  }catch(error){
    await cleanupFiles(allFiles);
    securityWarn("upload_rejected", {ip:req.ip, reason:error.message});
    res.status(400).json({message:error.message || "Upload failed"});
  }
};

const memoryImagesUpload = (req, res, next) => {
  upload.fields([
    {name:"images", maxCount:MAX_MEMORY_IMAGES},
    {name:"thumbnails", maxCount:MAX_MEMORY_IMAGES}
  ])(req, res, (error) => {
    if(!error){
      validateAndProcessImages(req, res, next);
      return;
    }

    const uploadedFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();

    uploadedFiles.forEach((file) => {
      if(file?.path){
        fs.rmSync(file.path, {force:true});
      }
    });

    if(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"){
      return res.status(413).json({message:`Each image must be ${process.env.MAX_UPLOAD_MB || 8}MB or smaller`});
    }

    if(
      error instanceof multer.MulterError &&
      (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE")
    ){
      return res.status(400).json({message:`Maximum is ${MAX_MEMORY_IMAGES} images`});
    }

    return res.status(400).json({message:error.message || "Upload failed"});
  });
};

router.get("/memories", authMiddleware, getMemories);
router.get("/memories/trash", authMiddleware, getTrashMemories);
router.post("/memories/trash/restore", authMiddleware, restoreMemories);
router.post("/memories/trash/permanent-delete", authMiddleware, permanentlyDeleteMemories);
router.delete("/memories/trash/empty", authMiddleware, emptyTrash);
router.get("/memories/:id/images/:kind/:index/view", authMiddleware, viewMemoryImage);
router.get("/memories/:id/images/:index/download", authMiddleware, downloadMemoryImage);
router.get("/memories/:id", authMiddleware, getMemory);
router.post("/memories", authMiddleware, memoryImagesUpload, addMemory);
router.delete("/memories", authMiddleware, clearAllMemories);
router.put("/memories/:id", authMiddleware, memoryImagesUpload, updateMemory);
router.patch("/memories/:id/favorite", authMiddleware, toggleFavorite);
router.patch("/memories/:id/restore", authMiddleware, restoreMemory);
router.delete("/memories/:id/permanent", authMiddleware, permanentlyDeleteMemory);
router.post("/memories/:id/share", authMiddleware, createMemoryShare);
router.delete("/memories/:id/share", authMiddleware, revokeMemoryShare);
router.post("/share/category", authMiddleware, createCategoryShare);
router.delete("/share/category", authMiddleware, revokeCategoryShare);
router.get("/public/share/:token/images/:memoryId/:index/view", viewPublicShareImage);
router.get("/public/share/:token", getPublicShare);
router.delete("/profile", authMiddleware, deleteAccount);
router.delete("/memories/:id", authMiddleware, deleteMemory);

module.exports = router;
