export const MEMORY_SHARED_TRANSITION = {
  duration:0.68,
  ease:[0.22, 1, 0.36, 1]
};

export const MEMORY_REDUCED_TRANSITION = {
  duration:0.15,
  ease:"easeOut"
};

export const memorySharedLayoutTransition = {
  layout:MEMORY_SHARED_TRANSITION
};

export const timelineItemPresenceVariants = {
  visible:{
    opacity:1,
    scale:1,
    transition:{duration:0.22, ease:MEMORY_SHARED_TRANSITION.ease}
  },
  dimmed:{
    opacity:0,
    scale:0.96,
    transition:{duration:0.2, ease:MEMORY_SHARED_TRANSITION.ease}
  }
};

export const previewOverlayVariants = {
  hidden:{
    opacity:0,
    transition:MEMORY_REDUCED_TRANSITION
  },
  visible:{
    opacity:1,
    transition:{duration:0.28, ease:MEMORY_SHARED_TRANSITION.ease}
  },
  exit:{
    opacity:0,
    transition:{duration:0.2, ease:MEMORY_SHARED_TRANSITION.ease}
  }
};

export const previewDialogVariants = {
  hidden:{
    opacity:0,
    scale:0.98
  },
  visible:{
    opacity:1,
    scale:1,
    transition:{
      duration:0.46,
      ease:MEMORY_SHARED_TRANSITION.ease,
      when:"beforeChildren",
      staggerChildren:0.055,
      delayChildren:0.38
    }
  },
  exit:{
    opacity:0,
    scale:0.985,
    transition:{duration:0.2, ease:MEMORY_SHARED_TRANSITION.ease}
  }
};

export const previewContentChildVariants = {
  hidden:{
    opacity:0,
    y:14
  },
  visible:{
    opacity:1,
    y:0,
    transition:{duration:0.24, ease:MEMORY_SHARED_TRANSITION.ease}
  }
};
