const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");

const {
  getMemories,
  getMemory,
  downloadMemoryImage,
  addMemory,
  deleteMemory,
  updateMemory,
  toggleFavorite,
  createMemoryShare,
  createCategoryShare,
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

const upload = multer({
  storage,
  limits:{
    fileSize:Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
    files:MAX_MEMORY_IMAGES
  },
  fileFilter(req, file, cb){
    if(allowedImageTypes.has(file.mimetype)){
      cb(null, true);
      return;
    }

    cb(new Error("Only JPG, PNG, and WebP images are allowed"));
  }
});

const memoryImagesUpload = (req, res, next) => {
  upload.array("images", MAX_MEMORY_IMAGES)(req, res, (error) => {
    if(!error){
      next();
      return;
    }

    (req.files || []).forEach((file) => {
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
router.get("/memories/:id/images/:index/download", authMiddleware, downloadMemoryImage);
router.get("/memories/:id", authMiddleware, getMemory);
router.post("/memories", authMiddleware, memoryImagesUpload, addMemory);
router.put("/memories/:id", authMiddleware, memoryImagesUpload, updateMemory);
router.patch("/memories/:id/favorite", authMiddleware, toggleFavorite);
router.post("/memories/:id/share", authMiddleware, createMemoryShare);
router.post("/share/category", authMiddleware, createCategoryShare);
router.get("/public/share/:token", getPublicShare);
router.delete("/memories/:id", authMiddleware, deleteMemory);

module.exports = router;
