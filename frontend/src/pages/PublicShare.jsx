import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicMemoryImageUrl, getPublicShare } from "../services/api";

function PublicShare() {
  const { token } = useParams();
  const [share,setShare] = useState(null);
  const [error,setError] = useState("");

  useEffect(()=>{
    let active = true;

    getPublicShare(token)
      .then((res)=>{
        if(active){
          setShare(res.data);
        }
      })
      .catch(()=>{
        if(active){
          setError("This shared memory is unavailable or the link has expired.");
        }
      });

    return ()=>{
      active = false;
    };
  },[token]);

  if(error){
    return (
      <div className="public-share-page">
        <div className="public-share-state">
          <span className="public-share-mark">MT</span>
          <h1>Memory unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if(!share){
    return (
      <div className="public-share-page">
        <div className="public-share-state">
          <span className="public-share-mark">MT</span>
          <h1>Opening shared memories</h1>
          <p>Preparing this moment for you...</p>
        </div>
      </div>
    );
  }

  const memories = share.type === "memory" ? [share.memory] : share.memories;
  const isAlbum = share.type === "category";

  return (
    <main className={`public-share-page ${isAlbum ? "public-share-album" : "public-share-single"}`}>
      <header className="public-share-header">
        <div className="public-share-brand">
          <span className="public-share-mark">MT</span>
          <span>Memory Timeline</span>
        </div>
        <p>{isAlbum ? "A collection of moments shared with you" : "A special moment shared with you"}</p>
        <h1>{isAlbum ? `${share.category} Memories` : "Shared Memory"}</h1>
      </header>

      <div className="public-share-grid">
        {memories.map((memory)=> {
          const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);

          return (
            <article className="public-memory-card" key={memory._id}>
              <div className="public-memory-copy">
                <div className="public-memory-meta">
                  <span>{memory.category || "Memory"}</span>
                  <time dateTime={memory.date}>
                    {new Date(memory.date).toLocaleDateString("en-GB", {
                      day:"2-digit",
                      month:"long",
                      year:"numeric"
                    })}
                  </time>
                </div>
                <h2>{memory.title}</h2>
                <div
                  className="public-memory-description"
                  dangerouslySetInnerHTML={{__html: memory.description}}
                />
              </div>

              {images.length > 0 && (
                <div className={`public-memory-gallery ${images.length > 1 ? "multiple" : ""}`}>
                  {images.map((image,index)=>(
                    <img
                      key={`${memory._id}-${index}`}
                      src={getPublicMemoryImageUrl(token, memory, index)}
                      alt={`${memory.title}${images.length > 1 ? ` ${index + 1}` : ""}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <footer className="public-share-footer">
        Shared privately through Memory Timeline
      </footer>
    </main>
  );
}

export default PublicShare;
