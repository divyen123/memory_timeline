import React from "react";
import { motion } from "framer-motion";
import { ONBOARDING_STEPS } from "./transitions";

function ProgressStepper({ activeIndex, onJump, reducedMotion }) {
  return (
    <div className="mt-onboarding-progress" aria-label={`Step ${activeIndex + 1} of ${ONBOARDING_STEPS.length}`}>
      {ONBOARDING_STEPS.map((step, index) => (
        <button
          key={step.label}
          type="button"
          className={`mt-onboarding-segment ${index < activeIndex ? "is-complete" : ""} ${index === activeIndex ? "is-active" : ""}`}
          onClick={() => onJump(index)}
          aria-label={`Go to ${step.label}`}
          disabled={index > activeIndex}
        >
          <motion.span
            initial={false}
            animate={{
              scaleX: index <= activeIndex ? 1 : 0,
              boxShadow: index === activeIndex && !reducedMotion
                ? [`0 0 0 rgba(255,255,255,0)`, `0 0 18px ${step.accent}`, `0 0 0 rgba(255,255,255,0)`]
                : "0 0 0 rgba(255,255,255,0)"
            }}
            transition={{ duration: reducedMotion ? 0.01 : 0.3, ease: "easeOut" }}
            style={{
              background: `linear-gradient(90deg, ${step.accent}, #ffffff)`,
              transformOrigin: "left"
            }}
          />
        </button>
      ))}
    </div>
  );
}

export default ProgressStepper;
