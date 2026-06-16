import React, { useState, useEffect, useRef } from "react";
import { addMemory, updateMemory } from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { playAppSound } from "../sound";

const MAX_MEMORY_IMAGES = 10;
const MAX_IMAGE_MB = 8;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg",".jpeg",".png",".webp"];
const FULL_IMAGE_MAX_EDGE = 1200;
const FULL_IMAGE_QUALITY = 0.82;
const THUMBNAIL_MAX_EDGE = 220;
const THUMBNAIL_QUALITY = 0.58;

const formatFileSize = (bytes) => {
  if(bytes < 1024 * 1024){
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedImage = (file) => {
  const fileName = file.name.toLowerCase();
  const hasAllowedExtension = ACCEPTED_IMAGE_EXTENSIONS.some((extension)=>fileName.endsWith(extension));
  const hasAllowedMime = !file.type || ACCEPTED_IMAGE_TYPES.has(file.type);

  return hasAllowedExtension && hasAllowedMime;
};

const getUploadErrorMessage = (err) => {
  if(err.response?.data?.message){
    return err.response.data.message;
  }

  if(err.response?.status === 413){
    return `Each image must be ${MAX_IMAGE_MB}MB or smaller`;
  }

  return "Operation failed";
};

const loadImageForOptimization = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Image optimization failed"));
  };
  image.src = objectUrl;
});

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if(blob){
      resolve(blob);
      return;
    }

    reject(new Error("Image optimization failed"));
  }, type, quality);
});

const createOptimizedImageVariant = async (file, maxEdge, quality, suffix) => {
  try{
    const image = await loadImageForOptimization(file);
    const scale = Math.min(
      1,
      maxEdge / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
    );
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {alpha:false});

    if(!context){
      return file;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, "image/webp", quality);

    const optimizedName = file.name.replace(/\.[^.]+$/, "") || "memory-image";

    return new File([blob], `${optimizedName}-${suffix}.webp`, {
      type:"image/webp",
      lastModified:Date.now()
    });
  }catch{
    return file;
  }
};

const optimizeImageFile = async (file) => {
  const [full, thumbnail] = await Promise.all([
    createOptimizedImageVariant(file, FULL_IMAGE_MAX_EDGE, FULL_IMAGE_QUALITY, "full"),
    createOptimizedImageVariant(file, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY, "thumb")
  ]);

  return {full, thumbnail};
};

const optimizeImages = async (files) => Promise.all(files.map(optimizeImageFile));

function AddMemory() {

  const navigate = useNavigate();
  const location = useLocation();

  const editingMemory = location.state || null;
  const isEditing = Boolean(editingMemory);
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [date, setDate] = useState(editingMemory?.date?.split("T")[0] || "");
  const [category, setCategory] = useState(editingMemory?.category || "Personal");
  const [reminderDate, setReminderDate] = useState(editingMemory?.reminderDate?.split("T")[0] || "");
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categories = ["Personal","Family","Friends","Travel","School","Work","Other"];

  const validateImages = (files) => {
    if(files.length > MAX_MEMORY_IMAGES){
      return `Maximum is ${MAX_MEMORY_IMAGES} images`;
    }

    const invalidFile = files.find((file)=>!isAcceptedImage(file));
    if(invalidFile){
      return "Only JPG, PNG, and WebP images are allowed";
    }

    const oversizedFile = files.find((file)=>file.size > MAX_IMAGE_MB * 1024 * 1024);
    if(oversizedFile){
      return `Each image must be ${MAX_IMAGE_MB}MB or smaller`;
    }

    return "";
  };

  const handleImagesChange = (event) => {
    const selectedImages = Array.from(event.target.files || []);
    const validationMessage = validateImages(selectedImages);

    if(validationMessage){
      setImages([]);
      setMessage(validationMessage);
      event.target.value = "";
      return;
    }

    setImages(selectedImages);
  };

  const clearImages = () => {
    setImages([]);
    if(fileInputRef.current){
      fileInputRef.current.value = "";
    }
  };

  useEffect(()=>{
    if(editorRef.current && editorRef.current.innerHTML !== description){
      editorRef.current.innerHTML = description;
    }
  },[description]);

  useAutoDismissMessage(message, setMessage);

  const saveEditorSelection = () => {
    const selection = window.getSelection();

    if(selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)){
      selectionRef.current = selection.getRangeAt(0);
    }
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    setIsSubmitting(true);
    setMessage(images.length ? "Optimizing images..." : "");

    try{

      const formData = new FormData();

      formData.append("title",title);
      formData.append("description",description);
      formData.append("date",date);
      formData.append("category",category);
      formData.append("reminderDate",reminderDate);

      const validationMessage = validateImages(images);
      if(validationMessage){
        setMessage(validationMessage);
        return;
      }

      const optimizedImages = await optimizeImages(images);
      const fullImages = optimizedImages.map(({full})=>full);
      const thumbnailImages = optimizedImages.map(({thumbnail})=>thumbnail);
      const optimizedValidationMessage = validateImages(fullImages);

      if(optimizedValidationMessage){
        setMessage(optimizedValidationMessage);
        return;
      }

      fullImages.forEach((image)=>{
        formData.append("images",image);
      });

      thumbnailImages.forEach((image)=>{
        formData.append("thumbnails",image);
      });

      if(isEditing){

        const res = await updateMemory(editingMemory._id,formData);

        playAppSound("update");
        setMessage("Memory updated successfully");

        setTimeout(()=>{
          navigate("/timeline", {
            state: editingMemory.returnToPreview ? {previewMemory:res.data} : null
          });
        },1200);

      } else {

        await addMemory(formData);

        playAppSound("create");
        setMessage("Memory added successfully");

        setTitle("");
        setDescription("");
        setDate("");
        setCategory("Personal");
        setReminderDate("");
        clearImages();

      }

    }
    catch(err){

      console.error(err);
      setMessage(getUploadErrorMessage(err));

    }finally{
      setIsSubmitting(false);
    }

  };

  return (
<PageTransition>

  <div className="add-memory-page">

    <div className="glass-card">

      {message && (
        <div className="toast">
          {message}
        </div>
      )}

      <h2>{isEditing ? "Edit Memory" : "Add Memory"}</h2>

      <form onSubmit={handleSubmit}>

        <input
          type="text"
          placeholder="Memory Title"
          value={title}
          onChange={(e)=>setTitle(e.target.value)}
          required
        />

        <div
          ref={editorRef}
          className="rich-editor"
          contentEditable
          onInput={(e)=>{
            saveEditorSelection();
            setDescription(e.currentTarget.innerHTML);
          }}
          onKeyUp={saveEditorSelection}
          onMouseUp={saveEditorSelection}
          onBlur={saveEditorSelection}
          data-placeholder="Description"
        />

        <div className="date-input-row">
          <label>
            <span>Memory date</span>
            <input
              type="date"
              value={date}
              onChange={(e)=>setDate(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Reminder date</span>
            <input
              type="date"
              value={reminderDate}
              onChange={(e)=>setReminderDate(e.target.value)}
            />
          </label>
        </div>

        <label className="field-label">Category</label>
        <select
          value={category}
          onChange={(e)=>setCategory(e.target.value)}
          required
        >
          {categories.map((item)=>(
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        {isEditing && (
          <label className="file-label">Change Images (optional)</label>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImagesChange}
          required={!isEditing}
        />

        <div className="upload-helper">
          <span>Upload up to {MAX_MEMORY_IMAGES} images. JPG, PNG, and WebP are optimized into fast thumbnails and full-view images.</span>
          {images.length > 0 && (
            <button type="button" onClick={clearImages}>
              Clear
            </button>
          )}
        </div>

        {images.length > 0 && (
          <div className="selected-files-panel">
            <div className="selected-files-header">
              <strong>{images.length} {images.length === 1 ? "image" : "images"} selected</strong>
              <small>Maximum {MAX_MEMORY_IMAGES}</small>
            </div>
            <div className="selected-files-list">
              {images.map((image)=>(
                <span key={`${image.name}-${image.size}`}>
                  {image.name}
                  <small>{formatFileSize(image.size)}</small>
                </span>
              ))}
            </div>
          </div>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : (isEditing ? "Update Memory" : "Add Memory")}
        </button>

        <button
          type="button"
          className="timeline-btn"
          onClick={()=>navigate("/timeline")}
        >
          Back to Memory Timeline
        </button>

      </form>

    </div>

    <h1 className="add-memory-brand-title">
      Memory Timeline
    </h1>

  </div>

</PageTransition>
  );
}

export default AddMemory;
