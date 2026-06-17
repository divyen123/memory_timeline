export const ONBOARDING_STEPS = [
  {
    icon: "<3",
    accent: "#FF2D6E",
    label: "Welcome",
    heading: ["Your memories,", "beautifully organized"],
    description: "Memory Timeline keeps every special moment in one private, visual place before you begin.",
    preview: "welcome"
  },
  {
    icon: "+",
    accent: "#8B5CF6",
    label: "Create",
    heading: ["Create a memory", "in seconds"],
    description: "Add a title, story, date, category, and images with a clean little flow that keeps everything tidy.",
    preview: "create"
  },
  {
    icon: "!",
    accent: "#F5A623",
    label: "Remember",
    heading: ["Never miss", "special days"],
    description: "Set reminders for birthdays, trips, anniversaries, and the dates you want to keep close.",
    preview: "remember"
  },
  {
    icon: "CAL",
    accent: "#22C55E",
    label: "Explore",
    heading: ["Explore by", "calendar"],
    description: "Jump through months and rediscover memories by date, with compact previews that stay easy to scan.",
    preview: "explore"
  },
  {
    icon: "ZIP",
    accent: "#38BDF8",
    label: "Keep a copy",
    heading: ["Export your", "collection"],
    description: "Keep personal backups by exporting all memories, selected memories, or filtered sets whenever you need.",
    preview: "copy"
  },
  {
    icon: "IMG",
    accent: "#EC4899",
    label: "Your timeline",
    heading: ["Your timeline", "is ready"],
    description: "Cards become your living archive: images, dates, favorites, and stories arranged beautifully.",
    preview: "timeline"
  }
];

export const slideVariants = {
  enter: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 34 : -34
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.42,
      ease: [0.2, 0.8, 0.2, 1],
      when: "beforeChildren",
      staggerChildren: 0.07
    }
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -34 : 34,
    transition: { duration: 0.24, ease: "easeInOut" }
  })
};

export const reducedSlideVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } }
};

export const childVariants = {
  enter: { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0, transition: { duration: 0.36, ease: "easeOut" } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } }
};

export const iconTileVariants = {
  enter: { opacity: 0, scale: 0.72, rotate: -8 },
  center: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  exit: { opacity: 0, scale: 0.9, rotate: 4, transition: { duration: 0.18 } }
};

export const previewContainerVariants = {
  enter: { opacity: 0, y: 20 },
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: "easeOut", staggerChildren: 0.08, delayChildren: 0.08 }
  },
  exit: { opacity: 0, y: 10, transition: { duration: 0.16 } }
};

export const previewItemVariants = {
  enter: { opacity: 0, y: 12, scale: 0.96 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.14 } }
};
