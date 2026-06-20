import React, { useState } from "react";
import { motion } from "framer-motion";
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

function About(){
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState(null);

  return (
    <PageTransition>
      <main className="about-page" aria-labelledby="about-title">
        <section className="about-hero">
          <p className="about-eyebrow">About</p>
          <h1 id="about-title">Memory Timeline</h1>
          <p>
            A simple, personal memory organizer for preserving special moments in a clear visual timeline.
          </p>
        </section>

        <section className="about-card-grid" aria-label="Memory Timeline features and safety">
          {aboutCards.map((card, index)=>(
            <motion.button
              key={card.title}
              type="button"
              className={`about-info-card ${activeCard === index ? "active" : ""}`}
              onClick={()=>setActiveCard(activeCard === index ? null : index)}
              onFocus={()=>setActiveCard(index)}
              onBlur={()=>setActiveCard(null)}
              whileHover={{ y:-6 }}
              whileTap={{ scale:0.98 }}
              transition={{ type:"spring", stiffness:260, damping:22 }}
            >
              <span className="about-card-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{card.title}</strong>
              <span>{card.summary}</span>
              <p>{card.details}</p>
            </motion.button>
          ))}
        </section>

        <section className="about-disclaimer" aria-label="Privacy disclaimer">
          <strong>Disclaimer</strong>
          <p>
            Memory Timeline is designed with privacy in mind, but users should avoid uploading highly sensitive personal documents unless they are comfortable storing them in the connected deployment and database environment.
          </p>
        </section>

        <button
          type="button"
          className="about-back-btn"
          onClick={()=>navigate("/timeline")}
        >
          Back to timeline
        </button>
      </main>
    </PageTransition>
  );
}

export default About;
