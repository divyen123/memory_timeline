import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MemoryCard from "../components/MemoryCard";
import PageTransition from "../components/PageTransition";
import { getHiddenMemories, getMemoryImageUrl, permanentlyDeleteHiddenMemory, unhideMemory } from "../services/api";
import { loadSettings } from "../settings";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import SmartImage from "../components/SmartImage";

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

function HiddenImages() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewMode, setViewMode] = useState("timeline");
  const [passwordInput, setPasswordInput] = useState("");
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
      navigate("/timeline");
    }catch(error){
      setMessage(error.response?.data?.message || "Unable to unhide image");
    }
  };

  const handlePermanentDelete = async (memory) => {
    try{
      await permanentlyDeleteHiddenMemory(memory._id);
      setMemories(current => current.filter((item)=>item._id !== memory._id));
      setMessage("Hidden image permanently deleted");
    }catch(error){
      setMessage(error.response?.data?.message || "Unable to delete hidden image");
    }
  };

  const renderSmallMemoryCard = (memory, className = "calendar-memory") => {
    const images = memory.thumbnails?.length ? memory.thumbnails : (memory.images?.length ? memory.images : (memory.image ? [memory.image] : []));
    const kind = memory.thumbnails?.length ? "thumbnails" : "images";

    return (
      <button type="button" className={className} key={memory._id}>
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

  return (
    <PageTransition>
      <main className="hidden-images-page">
        {message && <p className="message">{message}</p>}
        <div className="hidden-images-heading">
          <h1>Hided images</h1>
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
          <div className="timeline">
            {memories.map((memory, index)=>(
              <MemoryCard
                key={memory._id}
                memory={memory}
                index={index}
                hiddenMode
                onDelete={handlePermanentDelete}
                onUnhide={handleUnhide}
              />
            ))}
          </div>
        )}
      </main>
    </PageTransition>
  );
}

export default HiddenImages;
