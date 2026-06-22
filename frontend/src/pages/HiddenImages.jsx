import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import MemoryCard from "../components/MemoryCard";
import PageTransition from "../components/PageTransition";
import { getHiddenMemories, getMemoryImageUrl, permanentlyDeleteHiddenMemory, unhideMemory } from "../services/api";
import { loadSettings } from "../settings";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import SmartImage from "../components/SmartImage";
import {
  memorySharedLayoutTransition,
  previewContentChildVariants,
  previewDialogVariants,
  previewOverlayVariants
} from "../components/memoryTransition/transitions";

const VIEW_MODES = ["timeline", "calendar", "compact"];
const VIEW_MODE_LABELS = {
  timeline:"Timeline View",
  calendar:"Calendar View",
  compact:"Small Container Cards"
};
const VIEW_MODE_ICONS = {
  timeline:"⏰",
  calendar:"📅",
  compact:"▦"
};

const monthLabel = (value) => new Date(value).toLocaleDateString("en-GB", {
  month:"long",
  year:"numeric"
});

const getMemoryImages = (memory) => (
  memory?.images?.length ? memory.images : (memory?.image ? [memory.image] : [])
);

function HiddenImages() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("timeline");
  const [passwordInput, setPasswordInput] = useState("");
  const [previewMemory, setPreviewMemory] = useState(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [memoryToDelete, setMemoryToDelete] = useState(null);
  const previewReturnFocusRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const settings = loadSettings();
  const passwordRequired = Boolean(settings.hidePasswordEnabled && settings.hidePasswordValue);
  const [unlocked, setUnlocked] = useState(!passwordRequired);
  const nextViewMode = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];

  useAutoDismissMessage(message, setMessage);

  useEffect(() => {
    if(!unlocked){
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    getHiddenMemories()
      .then(({data})=>{
        if(active){
          setMemories(data.memories || []);
        }
      })
      .catch((error)=>setMessage(error.response?.data?.message || "Unable to load hidden images"))
      .finally(()=>active && setLoading(false));

    return () => {
      active = false;
    };
  }, [unlocked]);

  const memoriesByMonth = useMemo(() => memories.reduce((groups, memory) => {
    const key = monthLabel(memory.date);
    return {
      ...groups,
      [key]:[...(groups[key] || []), memory]
    };
  }, {}), [memories]);

  const handleUnlock = (event) => {
    event.preventDefault();

    if(passwordInput === settings.hidePasswordValue){
      setUnlocked(true);
      setMessage("Hidden images unlocked");
      return;
    }

    setMessage("Password does not match");
  };

  const handleUnhide = async (memory) => {
    try{
      await unhideMemory(memory._id);
      setMessage("Image unhidden");
      setPreviewMemory(null);
      navigate("/timeline");
    }catch(error){
      setMessage(error.response?.data?.message || "Unable to unhide image");
    }
  };

  const requestPermanentDelete = (memory) => {
    setMemoryToDelete(memory);
  };

  const cancelPermanentDelete = () => {
    setMemoryToDelete(null);
  };

  const confirmPermanentDelete = async () => {
    if(!memoryToDelete){
      return;
    }

    try{
      await permanentlyDeleteHiddenMemory(memoryToDelete._id);
      setMemories(current => current.filter((item)=>item._id !== memoryToDelete._id));
      if(previewMemory?._id === memoryToDelete._id){
        setPreviewMemory(null);
      }
      setMemoryToDelete(null);
      setMessage("Hidden image permanently deleted");
    }catch(error){
      setMemoryToDelete(null);
      setMessage(error.response?.data?.message || "Unable to delete hidden image");
    }
  };

  const openPreviewMemory = (memory, sourceNode = null) => {
    previewReturnFocusRef.current = sourceNode || document.activeElement;
    setPreviewMemory(memory);
    setPreviewImageIndex(0);
  };

  const closePreview = () => {
    setPreviewMemory(null);

    window.setTimeout(() => {
      previewReturnFocusRef.current?.focus?.();
    }, prefersReducedMotion ? 120 : 520);
  };

  const showPreviousPreviewImage = (event) => {
    event?.stopPropagation?.();
    setPreviewImageIndex(current => {
      const images = getMemoryImages(previewMemory);
      return images.length ? (current - 1 + images.length) % images.length : 0;
    });
  };

  const showNextPreviewImage = (event) => {
    event?.stopPropagation?.();
    setPreviewImageIndex(current => {
      const images = getMemoryImages(previewMemory);
      return images.length ? (current + 1) % images.length : 0;
    });
  };

  const renderSmallMemoryCard = (memory, className = "calendar-memory") => {
    const images = memory.thumbnails?.length ? memory.thumbnails : (memory.images?.length ? memory.images : (memory.image ? [memory.image] : []));
    const kind = memory.thumbnails?.length ? "thumbnails" : "images";

    return (
      <button type="button" className={className} key={memory._id} onClick={(event)=>openPreviewMemory(memory, event.currentTarget)}>
        <span className={`calendar-memory-thumbnail ${images[0] ? "" : "empty"}`}>
          {images[0] ? (
            <SmartImage src={getMemoryImageUrl(memory, kind, 0)} alt={memory.title} detectFaces={false} />
          ) : (
            memory.title?.slice(0, 1) || "M"
          )}
        </span>
        <span className="calendar-memory-copy">
          <strong>{memory.title}</strong>
          <span className="calendar-memory-meta">
            {new Date(memory.date).toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})}
          </span>
        </span>
      </button>
    );
  };

  const previewImages = previewMemory ? getMemoryImages(previewMemory) : [];
  const hasMultiplePreviewImages = previewImages.length > 1;
  const currentPreviewImage = previewImages[previewImageIndex] || previewImages[0];

  return (
    <PageTransition>
      <main className="hidden-images-page">
        {message && <p className="message">{message}</p>}
        <h1 className="hidden-images-title">Hided images</h1>
        <div className="hidden-images-heading">
          {unlocked && (
            <button
              type="button"
              className="timeline-action-btn"
              title={`Switch to ${VIEW_MODE_LABELS[nextViewMode]}`}
              aria-label={`Switch to ${VIEW_MODE_LABELS[nextViewMode]}`}
              onClick={()=>setViewMode(nextViewMode)}
            >
              {VIEW_MODE_ICONS[nextViewMode]}
            </button>
          )}
        </div>

        {!unlocked ? (
          <form className="hidden-unlock-panel" onSubmit={handleUnlock}>
            <h2>Unlock hidden images</h2>
            <input
              type={settings.hidePasswordType === "pin" ? "password" : "text"}
              placeholder="Enter hiding password"
              value={passwordInput}
              onChange={(event)=>setPasswordInput(event.target.value)}
            />
            <button type="submit">Open hidden images</button>
          </form>
        ) : loading ? (
          <div className="empty-state"><h3>Loading hidden images</h3></div>
        ) : memories.length === 0 ? (
          <div className="empty-state"><h3>No hided images</h3><p>Images you hide will appear here.</p></div>
        ) : viewMode === "calendar" ? (
          <div className="calendar-view">
            {Object.entries(memoriesByMonth).map(([month, items])=>(
              <div className="calendar-month" key={month}>
                <div className="calendar-month-heading">
                  <div>
                    <span className="calendar-month-kicker">Hidden collection</span>
                    <h3>{month}</h3>
                  </div>
                  <span className="calendar-month-count">{items.length} {items.length === 1 ? "image" : "images"}</span>
                </div>
                <div className="calendar-grid">
                  {items.map((memory)=>renderSmallMemoryCard(memory, "calendar-memory small-container-memory calendar-image-memory"))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "compact" ? (
          <div className="small-cards-view">
            {memories.map((memory)=>renderSmallMemoryCard(memory, "calendar-memory small-container-memory"))}
          </div>
        ) : (
          <div className="timeline hidden-images-timeline">
            {memories.map((memory, index)=>(
              <MemoryCard
                key={memory._id}
                memory={memory}
                index={index}
                hiddenMode
                onDelete={requestPermanentDelete}
                onUnhide={handleUnhide}
                onPreview={openPreviewMemory}
                isTransitionDimmed={Boolean(previewMemory) && previewMemory._id !== memory._id}
                isTransitionSource={previewMemory?._id === memory._id}
              />
            ))}
          </div>
        )}

        <AnimatePresence>
          {previewMemory && (
            <motion.div
              key={previewMemory._id}
              className="preview-overlay hidden-preview-overlay"
              variants={previewOverlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={closePreview}
            >
              <motion.div
                className="preview-dialog hidden-preview-dialog"
                layout={!prefersReducedMotion}
                variants={previewDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(event)=>event.stopPropagation()}
              >
                <button
                  type="button"
                  className="preview-back-btn"
                  aria-label="Back to hidden images"
                  onClick={closePreview}
                >
                  &#8592;
                </button>

                <motion.div
                  className={`preview-media ${hasMultiplePreviewImages ? "multiple-images" : "single-image"}`}
                  layoutId={prefersReducedMotion ? undefined : `memory-image-${previewMemory._id}`}
                  transition={memorySharedLayoutTransition}
                >
                  {currentPreviewImage && (
                    <SmartImage
                      key={`${currentPreviewImage}-hidden-preview-${previewImageIndex}`}
                      className="preview-carousel-image"
                      src={getMemoryImageUrl(previewMemory, "images", previewImageIndex)}
                      alt={previewMemory.title}
                      draggable={false}
                    />
                  )}

                  {hasMultiplePreviewImages && (
                    <>
                      <button
                        type="button"
                        className="preview-image-nav left"
                        aria-label="Previous image"
                        onClick={showPreviousPreviewImage}
                      >
                        &#8249;
                      </button>
                      <button
                        type="button"
                        className="preview-image-nav right"
                        aria-label="Next image"
                        onClick={showNextPreviewImage}
                      >
                        &#8250;
                      </button>
                      <span className="preview-image-count">
                        {previewImageIndex + 1} / {previewImages.length}
                      </span>
                    </>
                  )}
                </motion.div>

                <motion.div className="preview-content">
                  <motion.h3
                    layoutId={prefersReducedMotion ? undefined : `memory-title-${previewMemory._id}`}
                    transition={memorySharedLayoutTransition}
                  >
                    {previewMemory.title}
                  </motion.h3>
                  <motion.div
                    className={`preview-description ${previewMemory.description ? "" : "empty"}`}
                    variants={previewContentChildVariants}
                    dangerouslySetInnerHTML={{
                      __html:previewMemory.description || "<p>No description added for this hidden image.</p>"
                    }}
                  />
                  <motion.div
                    className="preview-actions hidden-preview-actions"
                    variants={previewContentChildVariants}
                  >
                    <button
                      type="button"
                      className="preview-unhide-btn"
                      title="Unhide"
                      aria-label="Unhide"
                      onClick={()=>handleUnhide(previewMemory)}
                    >
                      <span className="hidden-preview-emoji" aria-hidden="true">&#8617;&#65039;</span>
                    </button>
                    <button
                      type="button"
                      className="preview-delete-btn"
                      title="Delete permanently"
                      aria-label="Delete permanently"
                      onClick={()=>requestPermanentDelete(previewMemory)}
                    >
                      <span className="hidden-preview-emoji" aria-hidden="true">&#128465;&#65039;</span>
                    </button>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {memoryToDelete && (
          <div className="confirm-overlay hidden-delete-confirm-overlay">
            <div className="confirm-dialog hidden-delete-confirm-dialog">
              <h3>Delete permanently?</h3>
              <p>
                "{memoryToDelete.title}" will be deleted forever. This cannot be recovered from trash.
              </p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="cancel-delete-btn"
                  onClick={cancelPermanentDelete}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-delete-btn"
                  onClick={confirmPermanentDelete}
                >
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageTransition>
  );
}

export default HiddenImages;
