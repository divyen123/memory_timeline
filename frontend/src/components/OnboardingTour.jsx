import React, { useEffect, useState } from "react";

const TOUR_STEPS = [
  {
    emoji:"✨",
    eyebrow:"Welcome",
    title:"Your memories, beautifully organized",
    description:"Memory Timeline keeps important moments in one private, visual collection. Here is a quick tour before you begin.",
    accent:"#ff5f8f",
    demo:"welcome"
  },
  {
    emoji:"➕",
    eyebrow:"Create",
    title:"Add a new memory",
    description:"Add a title, story, category, date and up to 10 images. Your memory is prepared with optimized images for a smooth timeline.",
    accent:"#8b5cf6",
    demo:"add"
  },
  {
    emoji:"🔔",
    eyebrow:"Remember",
    title:"Never miss a special date",
    description:"Set reminder dates for meaningful moments. The reminder panel keeps upcoming memories together and easy to review.",
    accent:"#f59e0b",
    demo:"reminder"
  },
  {
    emoji:"📅",
    eyebrow:"Explore",
    title:"Browse memories by calendar",
    description:"Switch to Calendar View to find memories by month and date. Each compact preview opens the complete memory.",
    accent:"#22c55e",
    demo:"calendar"
  },
  {
    emoji:"🗃️",
    eyebrow:"Keep a copy",
    title:"Export your collection",
    description:"Export all memories, selected memories, or a filtered collection whenever you want a personal backup.",
    accent:"#38bdf8",
    demo:"export"
  },
  {
    emoji:"🖼️",
    eyebrow:"Your timeline",
    title:"Every card tells a story",
    description:"Memory cards show the image, category, date, title and favorite status at a glance. Open a card for its full story and gallery.",
    accent:"#ec4899",
    demo:"card"
  }
];

function FeaturePreview({type}){
  if(type === "card"){
    return (
      <div className="onboarding-memory-card">
        <span className="onboarding-favorite">★</span>
        <div className="onboarding-card-image">🌆</div>
        <div className="onboarding-card-meta">
          <span>Personal</span>
          <span>10 Jan</span>
        </div>
        <strong>A moment to keep</strong>
      </div>
    );
  }

  if(type === "calendar"){
    return (
      <div className="onboarding-calendar">
        <strong>January</strong>
        <div>
          {[6,7,8,9,10,11,12].map((day)=>(
            <span className={day === 10 ? "active" : ""} key={day}>{day}</span>
          ))}
        </div>
      </div>
    );
  }

  if(type === "export"){
    return (
      <div className="onboarding-export-list">
        <span>Export all <b>→</b></span>
        <span>Export selected <b>→</b></span>
        <span>Export by filter <b>→</b></span>
      </div>
    );
  }

  if(type === "reminder"){
    return (
      <div className="onboarding-reminder-list">
        <span><b>Birthday memory</b><small>Tomorrow</small></span>
        <span><b>Trip anniversary</b><small>In 3 days</small></span>
      </div>
    );
  }

  if(type === "add"){
    return (
      <div className="onboarding-add-form">
        <span>Memory title</span>
        <span>Choose images</span>
        <button type="button" tabIndex={-1}>Add memory</button>
      </div>
    );
  }

  return (
    <div className="onboarding-welcome-preview" aria-hidden="true">
      <span>💗</span>
      <i />
      <span>💫</span>
    </div>
  );
}

function OnboardingTour({onComplete}){
  const [stepIndex,setStepIndex] = useState(0);
  const [direction,setDirection] = useState("forward");
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  useEffect(()=>{
    const handleKeyDown = (event) => {
      if(event.key === "ArrowRight" && !isLastStep){
        setDirection("forward");
        setStepIndex((current)=>current + 1);
      }

      if(event.key === "ArrowLeft" && stepIndex > 0){
        setDirection("backward");
        setStepIndex((current)=>current - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return ()=>window.removeEventListener("keydown", handleKeyDown);
  },[isLastStep, stepIndex]);

  const goNext = () => {
    setDirection("forward");
    setStepIndex((current)=>Math.min(current + 1, TOUR_STEPS.length - 1));
  };

  const goBack = () => {
    setDirection("backward");
    setStepIndex((current)=>Math.max(current - 1, 0));
  };

  const finishTour = async () => {
    if(saving){
      return;
    }

    setSaving(true);
    setError("");

    try{
      await onComplete();
    }catch(err){
      setError(err.response?.data?.message || "Could not save your tour progress. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{"--onboarding-accent":step.accent}}
    >
      <div className="onboarding-glow onboarding-glow-one" />
      <div className="onboarding-glow onboarding-glow-two" />

      <section className="onboarding-shell">
        <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((item,index)=>(
            <span
              key={item.title}
              className={index <= stepIndex ? "complete" : ""}
            />
          ))}
        </div>

        <div className={`onboarding-stage ${direction}`} key={step.title}>
          <div className="onboarding-visual">
            <span className="onboarding-orbit orbit-one">{step.emoji}</span>
            <span className="onboarding-orbit orbit-two">✦</span>
            <div className="onboarding-icon" aria-hidden="true">{step.emoji}</div>
            <FeaturePreview type={step.demo} />
          </div>

          <div className="onboarding-copy">
            <span className="onboarding-step-count">{String(stepIndex + 1).padStart(2,"0")} / {String(TOUR_STEPS.length).padStart(2,"0")}</span>
            <p className="onboarding-eyebrow">{step.eyebrow}</p>
            <h1 id="onboarding-title">{step.title}</h1>
            <p className="onboarding-description">{step.description}</p>

            {error && <p className="onboarding-error" role="alert">{error}</p>}

            <div className="onboarding-actions">
              <button
                type="button"
                className="onboarding-back"
                onClick={goBack}
                disabled={stepIndex === 0 || saving}
              >
                Back
              </button>
              <button
                type="button"
                className="onboarding-next"
                onClick={isLastStep ? finishTour : goNext}
                disabled={saving}
              >
                {saving ? "Saving..." : isLastStep ? "Done" : "Next"}
                {!saving && <span aria-hidden="true">{isLastStep ? "✓" : "→"}</span>}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default OnboardingTour;
