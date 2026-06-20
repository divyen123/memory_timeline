import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";

const aboutCards = [
  {
    title:"Personal Timeline",
    summary:"Save memories with images, dates, titles, and descriptions.",
    details:"Memory Timeline organizes moments in a visual timeline so important memories are easy to revisit and review."
  },
  {
    title:"Memory Management",
    summary:"Add, edit, favorite, search, filter, export, and delete memories.",
    details:"The app gives users direct control over their memory collection, including full-view previews, favorites, trash handling, and export tools."
  },
  {
    title:"Custom Experience",
    summary:"Adjust the interface to match your preferred style.",
    details:"Themes, background colors, card sizes, icon styles, glass effects, fonts, buttons, and animation speed can be customized from settings."
  },
  {
    title:"Reminders",
    summary:"Use reminder settings for important dates and moments.",
    details:"Reminder options help users keep track of special days while keeping the timeline focused and organized."
  },
  {
    title:"Privacy Minded",
    summary:"The app is designed around account-based access.",
    details:"Memories are accessed through a login flow, password fields are masked, and user preferences are stored for a personalized experience."
  },
  {
    title:"Safety Note",
    summary:"Use care with sensitive uploads.",
    details:"Memory Timeline is designed with privacy in mind, but users should avoid uploading highly sensitive personal documents unless they are comfortable storing them in the connected deployment and database environment."
  }
];

const heroDescription = "A simple, personal memory organizer for preserving special moments in a clear visual timeline.";

function About(){
  const navigate = useNavigate();
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [typedDescription, setTypedDescription] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const selectedCard = selectedCardIndex !== null ? aboutCards[selectedCardIndex] : null;

  useEffect(()=>{
    let index = 0;
    setTypedDescription("");
    setShowCursor(true);

    const typingTimer = window.setInterval(()=>{
      index += 1;
      setTypedDescription(heroDescription.slice(0, index));

      if(index >= heroDescription.length){
        window.clearInterval(typingTimer);
        window.setTimeout(()=>setShowCursor(false), 1800);
      }
    }, 42);

    return ()=>{
      window.clearInterval(typingTimer);
    };
  },[]);

  useEffect(()=>{
    if(selectedCardIndex === null) return undefined;

    const handleKeyDown = (event)=>{
      if(event.key === "Escape") setSelectedCardIndex(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return ()=>window.removeEventListener("keydown", handleKeyDown);
  },[selectedCardIndex]);

  return (
    <PageTransition>
      <main className="about-page" aria-labelledby="about-title">
        <motion.section
          className="about-hero"
          initial={{ opacity:0, y:24, scale:0.985 }}
          animate={{ opacity:1, y:0, scale:1 }}
          transition={{ duration:0.42, ease:"easeOut" }}
        >
          <p className="about-eyebrow">About</p>
          <h1 id="about-title">Memory Timeline</h1>
          <p className="about-typing-copy" aria-label={heroDescription}>
            {typedDescription}
            {showCursor && <span className="about-typing-cursor" aria-hidden="true">|</span>}
          </p>
        </motion.section>

        <section className="about-card-grid" aria-label="Memory Timeline features and safety">
          {aboutCards.map((card, index)=>(
            <motion.button
              key={card.title}
              type="button"
              className="about-info-card"
              aria-haspopup="dialog"
              aria-expanded={selectedCardIndex === index}
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              transition={{
                delay:0.06 + index * 0.045,
                opacity:{ duration:0.3, ease:"easeOut" }
              }}
              onClick={()=>setSelectedCardIndex(index)}
              whileTap={{ scale:0.98 }}
            >
              <span className="about-card-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{card.title}</strong>
              <span>{card.summary}</span>
            </motion.button>
          ))}
        </section>

        <motion.section
          className="about-disclaimer"
          aria-label="Privacy disclaimer"
          initial={{ opacity:0, y:18 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.34, duration:0.32, ease:"easeOut" }}
        >
          <strong><span aria-hidden="true">⚠️</span> Disclaimer</strong>
          <p>
            Memory Timeline is designed with privacy in mind, but users should avoid uploading highly sensitive personal documents unless they are comfortable storing them in the connected deployment and database environment.
          </p>
        </motion.section>

        <motion.button
          type="button"
          className="about-back-btn"
          onClick={()=>navigate("/timeline")}
          initial={{ opacity:0, y:14 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.42, duration:0.28, ease:"easeOut" }}
        >
          Back to timeline
        </motion.button>

        <AnimatePresence>
          {selectedCard && (
            <motion.div
              className="about-modal-overlay"
              role="presentation"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              transition={{ duration:0.2, ease:"easeOut" }}
              onClick={()=>setSelectedCardIndex(null)}
            >
              <motion.section
                className="about-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-modal-title"
                initial={{ opacity:0, y:24, scale:0.94 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:18, scale:0.96 }}
                transition={{ type:"spring", stiffness:260, damping:24 }}
                onClick={(event)=>event.stopPropagation()}
              >
                <span className="about-modal-index">
                  {String(selectedCardIndex + 1).padStart(2, "0")}
                </span>
                <h2 id="about-modal-title">{selectedCard.title}</h2>
                <p className="about-modal-summary">{selectedCard.summary}</p>
                <p className="about-modal-details">{selectedCard.details}</p>
                <button
                  type="button"
                  className="about-modal-close"
                  onClick={()=>setSelectedCardIndex(null)}
                >
                  Close
                </button>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
}

export default About;
