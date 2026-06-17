import React from "react";
import { motion } from "framer-motion";

function HomeTransitionWipe({ active, reducedMotion }) {
  if (!active) {
    return null;
  }

  return (
    <motion.div
      className="mt-onboarding-wipe"
      initial={{
        opacity: 0,
        clipPath: reducedMotion ? "circle(150% at 50% 50%)" : "circle(0% at var(--wipe-x, 50%) var(--wipe-y, 55%))"
      }}
      animate={{ opacity: 1, clipPath: "circle(150% at var(--wipe-x, 50%) var(--wipe-y, 55%))" }}
      transition={{ duration: reducedMotion ? 0.18 : 0.68, ease: "easeInOut" }}
    />
  );
}

export default HomeTransitionWipe;
