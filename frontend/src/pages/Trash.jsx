import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import SmartImage from "../components/SmartImage";
import {
  emptyTrash,
  getImageUrl,
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

  const selectedTitle = useMemo(() => {
    if(selectedIds.length !== 1){
      return `${selectedIds.length} memories`;
    }

    return memories.find((memory)=>memory._id === selectedIds[0])?.title || "this memory";
  }, [memories, selectedIds]);

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

  const askRecover = (ids) => {
    if(!ids.length){
      setMessage("Select memories to recover");
      return;
    }

    setPendingAction({
      type:"recover",
      ids,
      title:ids.length === memories.length ? "Recover all memories?" : `Recover ${ids.length === 1 ? selectedTitle : `${ids.length} memories`}?`,
      body:"Recovered memories will return to your main timeline with their original details.",
      confirmLabel:"Recover"
    });
  };

  const askDelete = (ids) => {
    if(!ids.length){
      setMessage("Select memories to permanently delete");
      return;
    }

    setPendingAction({
      type:"delete",
      ids,
      title:ids.length === memories.length ? "Empty bin now?" : `Permanently delete ${ids.length === 1 ? selectedTitle : `${ids.length} memories`}?`,
      body:"This deletes the memory from the database and stored images. This action cannot be undone.",
      confirmLabel:ids.length === memories.length ? "Empty bin now" : "Permanently delete"
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

        setMessage(ids.length === 1 ? "Memory recovered" : "Memories recovered");
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
      <main className="trash-page">
        {message && <div className="toast">{message}</div>}

        <section className="trash-hero">
          <button
            type="button"
            className="trash-back-btn"
            onClick={()=>navigate("/timeline")}
          >
            &#8592; Back to timeline
          </button>
          <div>
            <p className="trash-kicker">Bin</p>
            <h1>Trash</h1>
            <span>Deleted memories stay here for 30 days. Recover them anytime before they are permanently removed.</span>
          </div>
        </section>

        <section className="trash-actions-panel">
          <div>
            <strong>{memories.length}</strong>
            <span>{memories.length === 1 ? "memory in bin" : "memories in bin"}</span>
          </div>
          <div className="trash-actions">
            <button type="button" onClick={()=>askRecover(memories.map((memory)=>memory._id))} disabled={!memories.length}>
              Recover all
            </button>
            <button type="button" onClick={()=>askDelete(memories.map((memory)=>memory._id))} disabled={!memories.length}>
              Empty bin now
            </button>
            <button
              type="button"
              className={selectionMode ? "active" : ""}
              onClick={()=>{
                setSelectionMode(!selectionMode);
                setSelectedIds([]);
              }}
              disabled={!memories.length}
            >
              {selectionMode ? "Done" : "Select"}
            </button>
          </div>
        </section>

        {selectionMode && memories.length > 0 && (
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
            <button type="button" onClick={()=>askRecover(selectedIds)} disabled={!selectedCount}>
              Recover selected
            </button>
            <button type="button" className="danger" onClick={()=>askDelete(selectedIds)} disabled={!selectedCount}>
              Delete selected
            </button>
          </section>
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
              const images = memory.thumbnails?.length
                ? memory.thumbnails
                : (memory.images?.length ? memory.images : (memory.image ? [memory.image] : []));
              const memoryDate = new Date(memory.date).toLocaleDateString("en-GB", {
                day:"2-digit",
                month:"short",
                year:"numeric"
              });
              const expiresAt = memory.trashExpiresAt
                ? new Date(memory.trashExpiresAt).toLocaleDateString("en-GB", {
                  day:"2-digit",
                  month:"short"
                })
                : "soon";

              return (
                <article className={`trash-card ${selectedIds.includes(memory._id) ? "selected" : ""}`} key={memory._id}>
                  {selectionMode && (
                    <label className="trash-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(memory._id)}
                        onChange={()=>toggleSelection(memory._id)}
                      />
                      <span>Select</span>
                    </label>
                  )}
                  <div className="trash-thumb">
                    {images[0] ? (
                      <SmartImage src={getImageUrl(images[0])} alt={memory.title} detectFaces={false} />
                    ) : (
                      <strong>{memory.title?.slice(0,1) || "M"}</strong>
                    )}
                  </div>
                  <div className="trash-copy">
                    <div className="trash-meta">
                      <span>{memory.category || "Personal"}</span>
                      <time>{memoryDate}</time>
                    </div>
                    <h2>{memory.title}</h2>
                    <p>Deletes permanently after {expiresAt}</p>
                  </div>
                  <div className="trash-card-actions">
                    <button type="button" onClick={()=>askRecover([memory._id])}>Recover</button>
                    <button type="button" className="danger" onClick={()=>askDelete([memory._id])}>Delete</button>
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
