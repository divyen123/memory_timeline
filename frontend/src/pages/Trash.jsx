import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import SmartImage from "../components/SmartImage";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import {
  emptyTrash,
  getMemoryImageUrl,
  getTrashMemories,
  permanentlyDeleteMemories,
  permanentlyDeleteMemory,
  restoreMemories,
  restoreMemory
} from "../services/api";

function Trash() {
  const navigate = useNavigate();
  const [memories, setMemories] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);

  const selectedCount = selectedIds.length;
  const allSelected = memories.length > 0 && selectedIds.length === memories.length;
  const hasTrashMemories = memories.length > 0;

  useAutoDismissMessage(message, setMessage);

  const loadTrash = async () => {
    setLoading(true);
    try{
      const {data} = await getTrashMemories();
      setMemories(data.memories || []);
      setSelectedIds((current)=>current.filter((id)=>(data.memories || []).some((memory)=>memory._id === id)));
    }catch(err){
      setMessage(err.response?.data?.message || "Unable to load trash");
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    loadTrash();
  }, []);

  const toggleSelection = (id) => {
    setSelectedIds((current)=> current.includes(id)
      ? current.filter((item)=>item !== id)
      : [...current, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : memories.map((memory)=>memory._id));
  };

  const askRecover = (ids, restoreAll = false) => {
    if(!ids.length){
      setMessage("Select memories to recover");
      return;
    }

    setPendingAction({
      type:"recover",
      ids,
      title:restoreAll
        ? "Restore all memories?"
        : (ids.length === 1 ? "Restore memory?" : `Restore ${ids.length} memories?`),
      body:"Restored memories will return to your main timeline with their original details.",
      confirmLabel:"Restore"
    });
  };

  const askDelete = (ids, deleteAll = false) => {
    if(!ids.length){
      setMessage("Select memories to permanently delete");
      return;
    }

    setPendingAction({
      type:"delete",
      ids,
      title:deleteAll
        ? "Empty bin now?"
        : (ids.length === 1 ? "Permanently delete memory?" : `Permanently delete ${ids.length} memories?`),
      body:"This deletes the memory from the database and stored images. This action cannot be undone.",
      confirmLabel:deleteAll ? "Empty bin now" : "Permanently delete"
    });
  };

  const runPendingAction = async () => {
    if(!pendingAction){
      return;
    }

    const {type, ids} = pendingAction;

    try{
      if(type === "recover"){
        if(ids.length === 1){
          await restoreMemory(ids[0]);
        }else{
          await restoreMemories(ids);
        }

        setMessage(ids.length === 1 ? "Memory restored" : "Memories restored");
      }else if(type === "delete"){
        if(ids.length === memories.length){
          await emptyTrash();
        }else if(ids.length === 1){
          await permanentlyDeleteMemory(ids[0]);
        }else{
          await permanentlyDeleteMemories(ids);
        }

        setMessage(ids.length === 1 ? "Memory permanently deleted" : "Memories permanently deleted");
      }

      setPendingAction(null);
      setSelectedIds([]);
      await loadTrash();
    }catch(err){
      setPendingAction(null);
      setMessage(err.response?.data?.message || "Action failed");
    }
  };

  return (
    <PageTransition>
      <main className={`trash-page ${hasTrashMemories ? "has-trash" : "trash-is-empty"} ${selectionMode ? "selection-mode" : ""}`}>
        {message && <div className="toast">{message}</div>}

        <section className="trash-hero" aria-label="Trash overview">
          <div className="trash-title-wrap">
            <h1>Trash</h1>
          </div>
        </section>

        {hasTrashMemories && (
          <section className="trash-actions-panel">
            <div className="trash-count">
              <strong>{memories.length}</strong>
              <span>{memories.length === 1 ? "memory in bin" : "memories in bin"}</span>
            </div>
            <div className="trash-actions">
              <button type="button" onClick={()=>askRecover(memories.map((memory)=>memory._id), true)}>
                Restore all
              </button>
              <button type="button" onClick={()=>askDelete(memories.map((memory)=>memory._id), true)}>
                Empty bin
              </button>
              <button
                type="button"
                className={selectionMode ? "active" : ""}
                onClick={()=>{
                  setSelectionMode(!selectionMode);
                  setSelectedIds([]);
                }}
              >
                {selectionMode ? "Done" : "Select"}
              </button>
            </div>
          </section>
        )}

        {selectionMode && memories.length > 0 && (
          <>
            <section className="trash-selection-bar">
              <label>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                Select all
              </label>
              <span>{selectedCount} selected</span>
            </section>
            <div className="trash-selection-dock" aria-label="Selected memory actions">
              <button type="button" className="danger" onClick={()=>askDelete(selectedIds)} disabled={!selectedCount}>
                Delete
              </button>
              <button type="button" onClick={()=>askRecover(selectedIds)} disabled={!selectedCount}>
                Restore
              </button>
            </div>
          </>
        )}

        {loading ? (
          <div className="empty-state">
            <h3>Loading trash</h3>
          </div>
        ) : memories.length === 0 ? (
          <div className="empty-state trash-empty">
            <h3>Trash is empty</h3>
            <p>Memories you move to bin will appear here for 30 days.</p>
            <button type="button" onClick={()=>navigate("/timeline")}>Back to memories</button>
          </div>
        ) : (
          <section className="trash-grid">
            {memories.map((memory)=> {
              const imageKind = memory.thumbnails?.length ? "thumbnails" : "images";
              const images = memory.thumbnails?.length
                ? memory.thumbnails
                : (memory.images?.length ? memory.images : (memory.image ? [memory.image] : []));
              return (
                <article className={`trash-card ${selectedIds.includes(memory._id) ? "selected" : ""}`} key={memory._id}>
                  {selectionMode && (
                    <label className="trash-check" aria-label={`Select ${memory.title}`}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(memory._id)}
                        onChange={()=>toggleSelection(memory._id)}
                      />
                    </label>
                  )}
                  <div className="trash-thumb">
                    {images[0] ? (
                      <SmartImage src={getMemoryImageUrl(memory, imageKind, 0)} alt={memory.title} detectFaces={false} />
                    ) : (
                      <strong>{memory.title?.slice(0,1) || "M"}</strong>
                    )}
                  </div>
                  <div className="trash-copy">
                    <h2>{memory.title}</h2>
                  </div>
                  <div className="trash-card-actions">
                    <button type="button" aria-label={`Recover ${memory.title}`} title="Recover" onClick={()=>askRecover([memory._id])}>
                      &#9851;
                    </button>
                    <button type="button" className="danger" aria-label={`Permanently delete ${memory.title}`} title="Permanently delete" onClick={()=>askDelete([memory._id])}>
                      &#128465;
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {pendingAction && (
          <div className="confirm-overlay">
            <div className="confirm-dialog trash-confirm-dialog">
              <h3>{pendingAction.title}</h3>
              <p>{pendingAction.body}</p>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="cancel-delete-btn"
                  onClick={()=>setPendingAction(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={pendingAction.type === "delete" ? "confirm-delete-btn" : "confirm-recover-btn"}
                  onClick={runPendingAction}
                >
                  {pendingAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PageTransition>
  );
}

export default Trash;
