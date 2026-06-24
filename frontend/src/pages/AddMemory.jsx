import React, { useState, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { addMemory, getMemoryImageUrl, updateMemory } from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { playAppSound } from "../sound";
import SubmitButtonMorph from "../components/successAnimation/SubmitButtonMorph";
import SuccessCardAnimation from "../components/successAnimation/SuccessCardAnimation";
import "../components/successAnimation/success-animations.css";

const MAX_MEMORY_IMAGES = 10;
const MAX_IMAGE_MB = 8;
const RESERVED_MEMORY_TITLE = "app/hide-image/";
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

const isAcceptedImage = (file) => {
  const fileName = file.name.toLowerCase();
  const hasAllowedExtension = ACCEPTED_IMAGE_EXTENSIONS.some((extension)=>fileName.endsWith(extension));
  const hasAllowedMime = !file.type || ACCEPTED_IMAGE_TYPES.has(file.type);

  return hasAllowedExtension && hasAllowedMime;
};

const isReservedMemoryTitle = (value = "") => (
  value.trim().toLowerCase() === RESERVED_MEMORY_TITLE
);

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
  const previewObjectUrlRef = useRef("");
  const prefersReducedMotion = useReducedMotion();

  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [date, setDate] = useState(editingMemory?.date?.split("T")[0] || "");
  const [category, setCategory] = useState(editingMemory?.category || "Personal");
  const [reminderDate, setReminderDate] = useState(editingMemory?.reminderDate?.split("T")[0] || "");
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("idle");
  const [successMode, setSuccessMode] = useState(isEditing ? "update" : "create");
  const [successPreview, setSuccessPreview] = useState({title:"", imageUrl:""});
  const [successAnnouncement, setSuccessAnnouncement] = useState("");
  const categories = ["Personal","Family","Friends","Travel","School","Work","Other"];
  const existingImages = isEditing
    ? (editingMemory?.images?.length ? editingMemory.images : (editingMemory?.image ? [editingMemory.image] : []))
    : [];
  const hasReplacementImages = images.length > 0;
  const showImagePanel = hasReplacementImages || existingImages.length > 0;

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

  const syncFileInput = (files) => {
    if(!fileInputRef.current){
      return;
    }

    const transfer = new DataTransfer();
    files.forEach((file)=>transfer.items.add(file));
    fileInputRef.current.files = transfer.files;
  };

  const handleImagesChange = (event) => {
    const selectedImages = Array.from(event.target.files || []);
    const nextImages = [...images, ...selectedImages];
    const validationMessage = validateImages(nextImages);

    if(validationMessage){
      setMessage(validationMessage);
      syncFileInput(images);
      return;
    }

    setImages(nextImages);
    syncFileInput(nextImages);
  };

  const removeImage = (indexToRemove) => {
    const nextImages = images.filter((_, index)=>index !== indexToRemove);
    setImages(nextImages);
    syncFileInput(nextImages);
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

  useEffect(()=>()=> {
    if(previewObjectUrlRef.current){
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
  },[]);

  useAutoDismissMessage(message, setMessage);

  const saveEditorSelection = () => {
    const selection = window.getSelection();

    if(selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)){
      selectionRef.current = selection.getRangeAt(0);
    }
  };

  const createSuccessPreview = () => {
    if(previewObjectUrlRef.current){
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = "";
    }

    let imageUrl = "";

    if(images[0]){
      imageUrl = URL.createObjectURL(images[0]);
      previewObjectUrlRef.current = imageUrl;
    }else if(isEditing){
      imageUrl = getMemoryImageUrl(editingMemory, "images", 0);
    }

    return {
      title:title.trim() || "Untitled memory",
      imageUrl
    };
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

    if(isSubmitting || submitStage !== "idle"){
      return;
    }

    const validationMessage = validateImages(images);

    if(isReservedMemoryTitle(title)){
      setMessage("title invalid. choose another title.");
      setSubmitStage("error");
      setTimeout(()=>setSubmitStage("idle"), 650);
      return;
    }

    if(validationMessage){
      setMessage(validationMessage);
      setSubmitStage("error");
      setTimeout(()=>setSubmitStage("idle"), 650);
      return;
    }

    setIsSubmitting(true);
    setSubmitStage("loading");
    setSuccessMode(isEditing ? "update" : "create");
    setSuccessPreview(createSuccessPreview());
    setSuccessAnnouncement("");
    setMessage(images.length ? "Optimizing images..." : "");

    try{

      const formData = new FormData();

      formData.append("title",title);
      formData.append("description",description);
      formData.append("date",date);
      formData.append("category",category);
      formData.append("reminderDate",reminderDate);

      const optimizedImages = await optimizeImages(images);
      const fullImages = optimizedImages.map(({full})=>full);
      const thumbnailImages = optimizedImages.map(({thumbnail})=>thumbnail);
      const optimizedValidationMessage = validateImages(fullImages);

      if(optimizedValidationMessage){
        setMessage(optimizedValidationMessage);
        setSubmitStage("error");
        setTimeout(()=>setSubmitStage("idle"), 650);
        setIsSubmitting(false);
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
        const successText = "Memory updated!";
        const updatedMemory = {
          ...editingMemory,
          ...res.data,
          image:res.data.image || editingMemory.image || "",
          images:res.data.images?.length ? res.data.images : (editingMemory.images || []),
          thumbnails:res.data.thumbnails?.length ? res.data.thumbnails : (editingMemory.thumbnails || [])
        };

        playAppSound("update");
        setMessage(successText);
        setSuccessAnnouncement(successText);
        setSubmitStage("success");

        setTimeout(()=>{
          navigate("/timeline", {
            state: editingMemory.returnToPreview ? {previewMemory:updatedMemory} : null
          });
        }, prefersReducedMotion ? 450 : 1300);

        return;

      } else {

        const res = await addMemory(formData);
        const successText = "Memory added!";

        playAppSound("create");
        setMessage(successText);
        setSuccessAnnouncement(successText);
        setSubmitStage("success");

        setTimeout(()=>{
          navigate("/timeline", {
            state:res.data?._id ? {highlightMemoryId:res.data._id} : null
          });
        }, prefersReducedMotion ? 450 : 1500);

        return;

      }

    }
    catch(err){

      console.error(err);
      setMessage(getUploadErrorMessage(err));
      setSubmitStage("error");
      setTimeout(()=>setSubmitStage("idle"), 700);
      setIsSubmitting(false);

    }

  };

  return (
<PageTransition>

  <div className="add-memory-page">

    <div className={`glass-card ${submitStage === "success" ? "success-active" : ""} ${submitStage === "error" ? "submit-error" : ""}`}>

      {message && (
        <div className="toast">
          {message}
        </div>
      )}

      <h2>{isEditing ? "Edit Memory" : "Add Memory"}</h2>

      <form onSubmit={handleSubmit}>

        <div className="add-memory-form-body">

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
            required={!isEditing && images.length === 0}
          />

          <div className="upload-helper">
            <span>Upload up to {MAX_MEMORY_IMAGES} images. JPG, PNG, and WebP are optimized into fast thumbnails and full-view images.</span>
            {images.length > 0 && (
              <button type="button" onClick={clearImages}>
                Clear
              </button>
            )}
          </div>

          {showImagePanel && (
            <div className="selected-files-panel">
              <div className="selected-files-header">
                <strong>
                  {hasReplacementImages
                    ? `${images.length} ${images.length === 1 ? "image" : "images"} selected`
                    : `${existingImages.length} current ${existingImages.length === 1 ? "image" : "images"}`}
                </strong>
                <div className="selected-files-limit">
                  <small>Maximum {MAX_MEMORY_IMAGES}</small>
                  {(hasReplacementImages ? images.length : existingImages.length) < MAX_MEMORY_IMAGES && (
                    <button
                      type="button"
                      className="selected-files-add-btn"
                      aria-label={hasReplacementImages ? "Add more images" : "Choose replacement images"}
                      title={hasReplacementImages ? "Add more images" : "Choose replacement images"}
                      onClick={()=>fileInputRef.current?.click()}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
              <div className="selected-files-list">
                {hasReplacementImages ? (
                  images.map((image,index)=>(
                    <div className="selected-file-row" key={`${image.name}-${image.size}-${index}`}>
                      <span>{image.name}</span>
                      <button
                        type="button"
                        className="selected-file-remove-btn"
                        aria-label={`Remove ${image.name}`}
                        title="Remove image"
                        onClick={()=>removeImage(index)}
                      >
                        &times;
                      </button>
                    </div>
                  ))
                ) : (
                  existingImages.map((_,index)=>(
                    <div className="selected-file-row existing-file-row" key={`existing-${index}`}>
                      <img
                        src={getMemoryImageUrl(editingMemory, editingMemory?.thumbnails?.[index] ? "thumbnails" : "images", index)}
                        alt={`Current memory image ${index + 1}`}
                      />
                      <span>Current image {index + 1}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        <SubmitButtonMorph
          label={isEditing ? "Update Memory" : "Add Memory"}
          state={submitStage}
          disabled={isSubmitting || submitStage !== "idle"}
        />

        <button
          type="button"
          className="timeline-btn"
          onClick={()=>navigate("/timeline")}
        >
          Back to Memory Timeline
        </button>

      </form>

      <SuccessCardAnimation
        mode={successMode}
        title={successPreview.title}
        imageUrl={successPreview.imageUrl}
        visible={submitStage === "success"}
      />

      <span className="sr-only" aria-live="polite">
        {successAnnouncement}
      </span>

    </div>

    <h1 className="add-memory-brand-title">
      Memory Timeline
    </h1>

  </div>

</PageTransition>
  );
}

export default AddMemory;
