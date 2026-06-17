import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import HomeTransitionWipe from "./HomeTransitionWipe";
import OnboardingSlide from "./OnboardingSlide";
import ProgressStepper from "./ProgressStepper";
import {
  ONBOARDING_STEPS,
  reducedSlideVariants,
  slideVariants
} from "./transitions";

function OnboardingFlow({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [error, setError] = useState("");
  const nextButtonRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;
  const activeVariants = reducedMotion ? reducedSlideVariants : slideVariants;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowRight" && !isLast && !saving) {
        setDirection(1);
        setStepIndex((current) => current + 1);
      }

      if (event.key === "ArrowLeft" && stepIndex > 0 && !saving) {
        setDirection(-1);
        setStepIndex((current) => current - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLast, saving, stepIndex]);

  const jumpTo = (index) => {
    if (index === stepIndex || index > stepIndex || saving) {
      return;
    }

    setDirection(index > stepIndex ? 1 : -1);
    setStepIndex(index);
  };

  const goBack = () => {
    if (stepIndex === 0 || saving) {
      return;
    }

    setDirection(-1);
    setStepIndex((current) => current - 1);
  };

  const finish = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    const rect = nextButtonRef.current?.getBoundingClientRect();
    if (rect) {
      document.documentElement.style.setProperty("--wipe-x", `${rect.left + rect.width / 2}px`);
      document.documentElement.style.setProperty("--wipe-y", `${rect.top + rect.height / 2}px`);
    }

    setWiping(true);

    window.setTimeout(async () => {
      try {
        await onComplete();
      } catch (err) {
        setWiping(false);
        setSaving(false);
        setError(err.response?.data?.message || "Could not save your tour progress. Please try again.");
      }
    }, reducedMotion ? 120 : 620);
  };

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }

    setDirection(1);
    setStepIndex((current) => current + 1);
  };

  return (
    <div
      className="mt-onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mt-onboarding-title"
      style={{ "--step-accent": step.accent }}
    >
      <section className="mt-onboarding-shell">
        <ProgressStepper activeIndex={stepIndex} onJump={jumpTo} reducedMotion={reducedMotion} />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step.label}
            custom={direction}
            variants={activeVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="mt-onboarding-stage"
          >
            <OnboardingSlide
              step={step}
              stepIndex={stepIndex}
              totalSteps={ONBOARDING_STEPS.length}
              onBack={goBack}
              onNext={goNext}
              isLast={isLast}
              saving={saving}
              error={error}
              reducedMotion={reducedMotion}
              nextButtonRef={nextButtonRef}
            />
          </motion.div>
        </AnimatePresence>
      </section>
      <HomeTransitionWipe active={wiping} reducedMotion={reducedMotion} />
    </div>
  );
}

export default OnboardingFlow;
