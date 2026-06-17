export const memoryTheme = {
  appName: "Memory Timeline",
  tagline: "Keep every special moment beautifully organized in one place.",
  colors: {
    coral: "#FF2D6E",
    coralSoft: "#FF4B7D",
    violet: "#6C63FF",
    lavender: "#A78BFA",
    lavenderDeep: "#8B6FE8",
    indigo: "#2638D8",
    deep: "#070719",
    white: "#FFFFFF"
  },
  gradients: {
    icon: "linear-gradient(135deg,#FF4B7D 0%,#8A5CFF 48%,#0E37D8 100%)",
    page: "linear-gradient(135deg,#A78BFA 0%,#9B78F6 42%,#8B6FE8 100%)",
    intro: "linear-gradient(135deg,#050516 0%,#15103A 52%,#24135C 100%)",
    coralButton: "linear-gradient(135deg,#FF2D6E 0%,#FF6B85 100%)",
    indigoButton: "linear-gradient(135deg,#6C63FF 0%,#4F46E5 100%)",
    focus: "linear-gradient(135deg,rgba(255,45,110,0.62),rgba(108,99,255,0.62))"
  },
  motion: {
    easeOut: [0.16, 1, 0.3, 1],
    easeSoft: [0.22, 1, 0.36, 1],
    spring: {type: "spring", stiffness: 260, damping: 24, mass: 0.85},
    press: {type: "spring", stiffness: 420, damping: 22}
  },
  remotion: {
    fps: 30,
    durationInFrames: 120,
    reducedMotionFrames: 36
  }
};
