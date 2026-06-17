import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getMemoryImageUrl } from "../services/api";
import SmartImage from "./SmartImage";
import {
  memorySharedLayoutTransition,
  timelineItemPresenceVariants
} from "./memoryTransition/transitions";

function MemoryCard({
  memory,
  index,
  onDelete,
  onFavorite,
  onPreview,
  selectionMode = false,
  selected = false,
  onSelect,
  isTransitionDimmed = false,
  isTransitionSource = false
}) {

  const formattedDate = new Date(memory.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRequestedOriginal, setHasRequestedOriginal] = useState(false);
  const [readyOriginals, setReadyOriginals] = useState([]);
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const displayImages = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
  const hasSeparateThumbnails = Boolean(memory.thumbnails?.length);
  const cardImages = hasSeparateThumbnails ? memory.thumbnails : displayImages;
  const cardImageKind = hasSeparateThumbnails ? "thumbnails" : "images";

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
      onPreview(memory, cardRef.current);
      return;
    }

    navigate(`/memory/${memory._id}`);
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

  const requestOriginalImage = () => {
    if(hasSeparateThumbnails){
      setHasRequestedOriginal(true);
    }
  };

  const markOriginalReady = (imageIndex) => {
    setReadyOriginals(current => current.includes(imageIndex)
      ? current
      : [...current, imageIndex]);
  };

  return (

    <motion.div
      ref={cardRef}
      className={`timeline-item hidden ${isVisible ? "show" : ""} ${index % 2 === 0 ? "left" : "right"} ${selectionMode ? "selection-mode" : ""} ${selected ? "selected-memory" : ""} ${isTransitionSource ? "shared-transition-source" : ""}`}
      onClick={handleDetails}
      animate={isTransitionDimmed ? "dimmed" : "visible"}
      variants={timelineItemPresenceVariants}
      initial={false}
    >

      <motion.div
        className={`timeline-card ${displayImages[0] ? "" : "no-photo"}`}
        onMouseEnter={requestOriginalImage}
        onFocusCapture={requestOriginalImage}
        layout={!prefersReducedMotion}
      >
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

        <motion.div
          className={`memory-photo-wrap collage-${Math.min(displayImages.length || 1, 4)}`}
          layoutId={prefersReducedMotion ? undefined : `memory-image-${memory._id}`}
          transition={memorySharedLayoutTransition}
        >
          {cardImages[0] ? (
            cardImages.slice(0,4).map((image, imageIndex)=>(
              <div className="memory-image-cell" key={`${image}-${imageIndex}`}>
                <SmartImage
                  src={getMemoryImageUrl(memory, cardImageKind, imageIndex)}
                  alt={memory.title || "memory"}
                  className="memory-thumbnail-image"
                  detectFaces
                />

                {hasRequestedOriginal && hasSeparateThumbnails && displayImages[imageIndex] && (
                  <SmartImage
                    src={getMemoryImageUrl(memory, "images", imageIndex)}
                    alt=""
                    aria-hidden="true"
                    className={`memory-original-image ${readyOriginals.includes(imageIndex) ? "is-ready" : ""}`}
                    loading="eager"
                    detectFaces
                    onPositionReady={()=>markOriginalReady(imageIndex)}
                  />
                )}
              </div>
            ))
          ) : (
            <div className="memory-photo-placeholder">
              {memory.title?.slice(0,1) || "M"}
            </div>
          )}

          <div className="memory-actions">
            <button
              type="button"
              className={`favorite-btn ${memory.favorite ? "active" : ""}`}
              title={memory.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-label={memory.favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={Boolean(memory.favorite)}
              onClick={handleFavorite}
            >
              {memory.favorite ? "\u2605" : "\u2606"}
            </button>

            <button
              type="button"
              className="memory-delete-btn"
              title="Delete"
              aria-label="Delete"
              onClick={(e)=>handleActionClick(e, handleDelete)}
            >
              <span aria-hidden="true">🗑️</span>
            </button>
          </div>

          <small className="memory-date-badge">{formattedDate}</small>

          <div className="memory-card-overlay">
            <motion.h3
              layoutId={prefersReducedMotion ? undefined : `memory-title-${memory._id}`}
              transition={memorySharedLayoutTransition}
            >
              {memory.title}
            </motion.h3>
          </div>
        </motion.div>

      </motion.div>

    </motion.div>
  );
}

export default MemoryCard;
