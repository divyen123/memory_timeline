import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getImageUrl } from "../services/api";
import SmartImage from "./SmartImage";

function MemoryCard({
  memory,
  index,
  onDelete,
  onFavorite,
  onPreview,
  selectionMode = false,
  selected = false,
  onSelect
}) {

  const formattedDate = new Date(memory.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const displayImages = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);

  useEffect(() => {

    const observer = new IntersectionObserver(
      ([entry]) => {
        if(entry.isIntersecting){
          setIsVisible(true);
        }
      },
      { threshold:0.2 }
    );

    if(cardRef.current){
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();

  }, []);

  const handleDetails = () => {
    if(selectionMode){
      onSelect?.(memory._id);
      return;
    }

    if(onPreview){
      onPreview(memory);
      return;
    }

    navigate(`/memory/${memory._id}`);
  };

  const handleEdit = () => {
    navigate("/add", { state: memory });
  };

  const handleDelete = () => {
    onDelete(memory);
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    onFavorite(memory._id);
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    action();
  };

  return (

    <div
      ref={cardRef}
      className={`timeline-item hidden ${isVisible ? "show" : ""} ${index % 2 === 0 ? "left" : "right"} ${selectionMode ? "selection-mode" : ""} ${selected ? "selected-memory" : ""}`}
      onClick={handleDetails}
    >

      <div className={`timeline-card ${displayImages[0] ? "" : "no-photo"}`}>
        {selectionMode && (
          <button
            type="button"
            className={`memory-select-check ${selected ? "selected" : ""}`}
            aria-label={selected ? `Deselect ${memory.title}` : `Select ${memory.title}`}
            aria-pressed={selected}
            onClick={(event)=>{
              event.stopPropagation();
              onSelect?.(memory._id);
            }}
          >
            {selected ? "\u2713" : ""}
          </button>
        )}

        <div className={`memory-photo-wrap collage-${Math.min(displayImages.length || 1, 4)}`}>
          {displayImages[0] ? (
            displayImages.slice(0,4).map((image, imageIndex)=>(
              <SmartImage
                key={`${image}-${imageIndex}`}
                src={getImageUrl(image)}
                alt={memory.title || "memory"}
              />
            ))
          ) : (
            <div className="memory-photo-placeholder">
              {memory.title?.slice(0,1) || "M"}
            </div>
          )}

          <button
            type="button"
            className={`favorite-btn ${memory.favorite ? "active" : ""}`}
            onClick={handleFavorite}
          >
            {memory.favorite ? "\u2605" : "\u2606"}
          </button>

          <div className="memory-card-overlay">
            <div className="memory-card-kicker">
              <span>{memory.category || "Personal"}</span>
              <small>{formattedDate}</small>
            </div>

            <h3>{memory.title}</h3>

            <div className="memory-actions">
              <button title="Edit" aria-label="Edit" onClick={(e)=>handleActionClick(e, handleEdit)}>
                ✏️
              </button>

              <button title="Delete" aria-label="Delete" onClick={(e)=>handleActionClick(e, handleDelete)}>
                🗑️
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default MemoryCard;
