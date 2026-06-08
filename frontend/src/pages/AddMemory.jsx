import React, { useState, useEffect, useRef } from "react";
import { addMemory, updateMemory } from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import { playAppSound } from "../sound";

const MAX_MEMORY_IMAGES = 10;
const MAX_IMAGE_MB = 8;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg",".jpeg",".png",".webp",".gif"];

const formatFileSize = (bytes) => {
  if(bytes < 1024 * 1024){
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedImage = (file) => {
  const fileName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_TYPES.has(file.type) ||
    ACCEPTED_IMAGE_EXTENSIONS.some((extension)=>fileName.endsWith(extension));
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
  const categories = ["Personal","Family","Friends","Travel","School","Work","Other"];

  const validateImages = (files) => {
    if(files.length > MAX_MEMORY_IMAGES){
      return `Maximum is ${MAX_MEMORY_IMAGES} images`;
    }

    const invalidFile = files.find((file)=>!isAcceptedImage(file));
    if(invalidFile){
      return "Only JPG, PNG, WebP, and GIF images are allowed";
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

  useEffect(()=>{

    if(message){

      const timer = setTimeout(()=>{
        setMessage("");
      },2000);

      return ()=>clearTimeout(timer);

    }

  },[message]);

  const saveEditorSelection = () => {
    const selection = window.getSelection();

    if(selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)){
      selectionRef.current = selection.getRangeAt(0);
    }
  };

  const handleSubmit = async (e) => {

    e.preventDefault();

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

      images.forEach((image)=>{
        formData.append("images",image);
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
          accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleImagesChange}
          required={!isEditing}
        />

        <div className="upload-helper">
          <span>Upload up to {MAX_MEMORY_IMAGES} images. JPG, PNG, WebP, and GIF are supported.</span>
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

        <button type="submit">
          {isEditing ? "Update Memory" : "Add Memory"}
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

    <h1 className="main-title">
      {isEditing ? "Update Memory" : "Memory Timeline"}
    </h1>

  </div>

</PageTransition>
  );
}

export default AddMemory;
