import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createMemoryShare, deleteMemory, getImageUrl, getMemory, toggleFavorite } from "../services/api";
import PageTransition from "../components/PageTransition";
import SmartImage from "../components/SmartImage";
import { shareUrl } from "../share";

function MemoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [memory,setMemory] = useState(null);
  const [message,setMessage] = useState("");
  const [showDeleteConfirm,setShowDeleteConfirm] = useState(false);
  const [carouselIndex,setCarouselIndex] = useState(null);
  const backGuardRef = useRef(false);
  const carouselDragRef = useRef(null);

  useEffect(()=>{
    let active = true;

    getMemory(id).then((res)=>{
      if(active){
        setMemory(res.data);
      }
    });

    return ()=>{
      active = false;
    };
  },[id]);

  useEffect(()=>{
    if(backGuardRef.current){
      return;
    }

    backGuardRef.current = true;
    window.history.pushState({memoryDetailsBackGuard:true}, "", window.location.href);

    const handleBrowserBack = () => {
      navigate("/timeline", {replace:true});
    };

    window.addEventListener("popstate", handleBrowserBack);

    return () => {
      window.removeEventListener("popstate", handleBrowserBack);
    };
  },[navigate]);

  const handleFavorite = async () => {
    const res = await toggleFavorite(id);
    setMemory(res.data);
  };

  const handleShare = async () => {
    try{
      const res = await createMemoryShare(id);
      const url = `${window.location.origin}/share/${res.data.token}`;
      const result = await shareUrl({
        title:memory?.title || "Memory Timeline",
        text:`Sharing "${memory?.title || "this memory"}" from Memory Timeline`,
        url
      });

      if(result === "shared"){
        setMessage("Share opened");
      }
      else if(result === "copied"){
        setMessage("Native sharing is unavailable. Link copied instead");
      }
      else if(result === "manual"){
        setMessage("Copy the share link from the dialog");
      }
    }catch{
      setMessage("Sharing failed");
    }
  };

  const handleDeleteRequest = () => {
    setShowDeleteConfirm(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteConfirm(false);
  };

  const confirmDelete = async () => {
    try{
      await deleteMemory(id);
      navigate("/timeline");
    }catch(err){
      console.error(err);
      setShowDeleteConfirm(false);
      setMessage("Failed to delete memory");
    }
  };

  if(!memory){
    return (
      <PageTransition>
        <div className="empty-state">
          <h3>Loading Memory</h3>
        </div>
      </PageTransition>
    );
  }

  const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
  const formattedDate = new Date(memory.date).toLocaleDateString("en-GB", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
  const galleryImages = images.length > 1 ? images.slice(1) : images;

  const showPreviousImage = () => {
    setCarouselIndex((current)=> current === 0 ? images.length - 1 : current - 1);
  };

  const showNextImage = () => {
    setCarouselIndex((current)=> current === images.length - 1 ? 0 : current + 1);
  };

  const handleCarouselDragStart = (event) => {
    if(images.length < 2){
      return;
    }

    carouselDragRef.current = {
      x:event.clientX,
      y:event.clientY
    };
  };

  const handleCarouselDragEnd = (event) => {
    if(!carouselDragRef.current || images.length < 2){
      carouselDragRef.current = null;
      return;
    }

    const deltaX = event.clientX - carouselDragRef.current.x;
    const deltaY = event.clientY - carouselDragRef.current.y;
    carouselDragRef.current = null;

    if(Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2){
      return;
    }

    if(deltaX > 0){
      showPreviousImage();
    }
    else{
      showNextImage();
    }
  };

  const goBackToTimeline = () => {
    navigate("/timeline", {replace:true});
  };

  return (
    <>
    <PageTransition>
      <div className="details-page">
        {message && (
          <div className="toast">{message}</div>
        )}

        <div className="details-panel story-panel">
          <button
            type="button"
            className="details-back-btn"
            aria-label="Back to all memories"
            onClick={goBackToTimeline}
          >
            &#8592;
          </button>

          <div className="story-hero">
            {images[0] ? (
              <SmartImage src={getImageUrl(images[0])} alt={memory.title} />
            ) : (
              <div className="memory-photo-placeholder">{memory.title?.slice(0,1) || "M"}</div>
            )}

            <button
              className={`favorite-btn details-favorite ${memory.favorite ? "active" : ""}`}
              onClick={handleFavorite}
            >
              <span aria-hidden="true">{memory.favorite ? "\u2605" : "\u2606"}</span>
            </button>

            <div className="story-hero-content">
              <div className="details-meta-row">
                <span>{formattedDate}</span>
                <span>{memory.category || "Personal"}</span>
                {memory.reminderDate && (
                  <span>Reminder: {new Date(memory.reminderDate).toLocaleDateString("en-GB")}</span>
                )}
              </div>

              <h2>{memory.title}</h2>
            </div>
          </div>

          <div className="story-body">
            <div
              className={`details-description ${memory.description ? "" : "empty"}`}
              dangerouslySetInnerHTML={{
                __html:memory.description || "<p>No description added for this memory.</p>"
              }}
            />
          </div>

          {galleryImages.length > 0 && (
            <div className="details-gallery">
              {galleryImages.map((image,index)=>(
                <button
                  className="gallery-image-button"
                  key={image}
                  onClick={()=>setCarouselIndex(images.length > 1 ? index + 1 : index)}
                >
                  <SmartImage
                    src={getImageUrl(image)}
                    alt={memory.title}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="details-actions">
            <button onClick={()=>navigate("/add", {state:memory})}>
              Edit
            </button>
            <button onClick={handleDeleteRequest}>
              Delete
            </button>
            <button onClick={handleShare}>
              Share
            </button>
            <button className="timeline-btn" onClick={goBackToTimeline}>
              Back to Timeline
            </button>
          </div>
        </div>
      </div>
    </PageTransition>

    {carouselIndex !== null && (
      <div
        className="carousel-overlay"
        onPointerDown={handleCarouselDragStart}
        onPointerUp={handleCarouselDragEnd}
        onPointerCancel={()=>{ carouselDragRef.current = null; }}
      >
        <button className="carousel-close" onClick={()=>setCarouselIndex(null)}>
          Close
        </button>
        {images.length > 1 && (
          <button className="carousel-nav left" onClick={showPreviousImage}>
            &#8249;
          </button>
        )}
        <SmartImage
          src={getImageUrl(images[carouselIndex])}
          alt={memory.title}
          draggable={false}
        />
        {images.length > 1 && (
          <button className="carousel-nav right" onClick={showNextImage}>
            &#8250;
          </button>
        )}
      </div>
    )}

    {showDeleteConfirm && (
      <div className="confirm-overlay">
        <div className="confirm-dialog">
          <h3>Move to bin?</h3>
          <p>
            "{memory.title}" will stay in trash for 30 days before it is permanently deleted.
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              className="cancel-delete-btn"
              onClick={closeDeleteDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="confirm-delete-btn"
              onClick={confirmDelete}
            >
              Move to bin
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default MemoryDetails;
