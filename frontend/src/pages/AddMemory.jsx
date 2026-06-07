import React, { useState, useEffect, useRef } from "react";
import { addMemory, updateMemory } from "../services/api";
import { useNavigate, useLocation } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import { playAppSound } from "../sound";

function AddMemory() {

  const navigate = useNavigate();
  const location = useLocation();

  const editingMemory = location.state || null;
  const isEditing = Boolean(editingMemory);
  const editorRef = useRef(null);
  const selectionRef = useRef(null);

  const [title, setTitle] = useState(editingMemory?.title || "");
  const [description, setDescription] = useState(editingMemory?.description || "");
  const [date, setDate] = useState(editingMemory?.date?.split("T")[0] || "");
  const [category, setCategory] = useState(editingMemory?.category || "Personal");
  const [reminderDate, setReminderDate] = useState(editingMemory?.reminderDate?.split("T")[0] || "");
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const categories = ["Personal","Family","Friends","Travel","School","Work","Other"];

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
        setImages([]);

      }

    }
    catch(err){

      console.error(err);
      setMessage(err.response?.data?.message || "Operation failed");

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
          type="file"
          accept="image/*"
          multiple
          onChange={(e)=>setImages(Array.from(e.target.files))}
          required={!isEditing}
        />

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
