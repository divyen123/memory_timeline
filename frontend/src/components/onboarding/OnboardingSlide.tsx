import React from "react";
import { motion } from "framer-motion";
import {
  childVariants,
  iconTileVariants,
  previewContainerVariants,
  previewItemVariants
} from "./transitions";

function Preview({ type }) {
  if (type === "create") {
    return (
      <motion.div className="mt-preview mt-preview-form" variants={previewContainerVariants}>
        <motion.span variants={previewItemVariants}>Memory title</motion.span>
        <motion.span variants={previewItemVariants}>Choose images</motion.span>
        <motion.button type="button" tabIndex={-1} variants={previewItemVariants}>Add memory</motion.button>
      </motion.div>
    );
  }

  if (type === "remember") {
    return (
      <motion.div className="mt-preview mt-preview-list" variants={previewContainerVariants}>
        <motion.strong variants={previewItemVariants}>!</motion.strong>
        <motion.span variants={previewItemVariants}><b>Birthday memory</b><small>Tomorrow</small></motion.span>
        <motion.span variants={previewItemVariants}><b>Trip anniversary</b><small>In 3 days</small></motion.span>
      </motion.div>
    );
  }

  if (type === "explore") {
    return (
      <motion.div className="mt-preview mt-preview-calendar" variants={previewContainerVariants}>
        <motion.strong variants={previewItemVariants}>January</motion.strong>
        <motion.div variants={previewContainerVariants}>
          {[6, 7, 8, 9, 10, 11, 12].map((day) => (
            <motion.span className={day === 10 ? "active" : ""} key={day} variants={previewItemVariants}>{day}</motion.span>
          ))}
        </motion.div>
      </motion.div>
    );
  }

  if (type === "copy") {
    return (
      <motion.div className="mt-preview mt-preview-list" variants={previewContainerVariants}>
        <motion.strong variants={previewItemVariants}>ZIP</motion.strong>
        {["Export all", "Export selected", "Export by filter"].map((row) => (
          <motion.span key={row} variants={previewItemVariants}><b>{row}</b><small>{">"}</small></motion.span>
        ))}
      </motion.div>
    );
  }

  if (type === "timeline") {
    return (
      <motion.div className="mt-preview mt-preview-memory" variants={previewContainerVariants}>
        <motion.div className="mt-preview-photo" variants={previewItemVariants}>IMG</motion.div>
        <motion.i variants={previewItemVariants}>*</motion.i>
        <motion.div variants={previewItemVariants}>
          <span>Personal</span>
          <span>10 Jan</span>
        </motion.div>
        <motion.strong variants={previewItemVariants}>A moment to keep</motion.strong>
      </motion.div>
    );
  }

  return (
    <motion.div className="mt-preview mt-preview-stack" variants={previewContainerVariants}>
      <motion.span className="pink" variants={previewItemVariants}>MEMORY</motion.span>
      <motion.span className="violet" variants={previewItemVariants}>TRIP</motion.span>
      <motion.span className="green" variants={previewItemVariants}>LOVE</motion.span>
      <motion.i variants={previewItemVariants}>*</motion.i>
    </motion.div>
  );
}

function OnboardingSlide({
  step,
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  isLast,
  saving,
  error,
  reducedMotion,
  nextButtonRef
}) {
  return (
    <div className="mt-onboarding-slide" style={{ "--step-accent": step.accent }}>
      <motion.div className="mt-onboarding-visual" variants={childVariants}>
        <motion.div className="mt-visual-backdrop" variants={childVariants} />
        <motion.div className="mt-icon-tile" variants={iconTileVariants}>{step.icon}</motion.div>
        <motion.div
          className="mt-icon-tile mt-icon-tile-small"
          variants={childVariants}
          animate={reducedMotion ? undefined : { y: [0, -4, 0], rotate: [-8, -3, -8] }}
          transition={reducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {step.icon}
        </motion.div>
        <Preview type={step.preview} />
      </motion.div>

      <motion.div className="mt-onboarding-copy" variants={childVariants}>
        <motion.div className="mt-step-pill" variants={childVariants} key={stepIndex}>
          {String(stepIndex + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
        </motion.div>
        <motion.p className="mt-onboarding-label" variants={childVariants}>{step.label}</motion.p>
        <h1 id="mt-onboarding-title">
          {step.heading.map((line) => (
            <motion.span key={line} variants={childVariants}>{line}</motion.span>
          ))}
        </h1>
        <motion.p className="mt-onboarding-description" variants={childVariants}>{step.description}</motion.p>
        {error && <motion.p className="mt-onboarding-error" variants={childVariants} role="alert">{error}</motion.p>}
        <motion.div className="mt-onboarding-actions" variants={childVariants}>
          <button type="button" className="mt-onboarding-back" onClick={onBack} disabled={stepIndex === 0 || saving}>Back</button>
          <button
            ref={nextButtonRef}
            type="button"
            className="mt-onboarding-next"
            onClick={onNext}
            disabled={saving}
          >
            {saving ? "Saving..." : isLast ? "Done" : "Next"}
            {!saving && <span aria-hidden="true">{isLast ? "OK" : ">"}</span>}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default OnboardingSlide;
