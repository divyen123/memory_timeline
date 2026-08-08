const ANIMATED_THEME_COLORS = {
  liquidAther:"#080719",
  ferrofluid:"#03010a",
  darkveil:"#050510",
  ballpit:"#0a1024",
  softAurora:"#09081a"
};

const DEFAULT_LIGHT_COLOR = "#ff7ac6";
const DEFAULT_DARK_COLOR = "#0f172a";

const getHexChannels = (color) => {
  const value = String(color || "").trim().replace(/^#/, "");
  const normalized = /^[0-9a-f]{3}$/i.test(value)
    ? value.split("").map((character)=>character + character).join("")
    : value;

  if(!/^[0-9a-f]{6}$/i.test(normalized)){
    return null;
  }

  return [0, 2, 4].map((start)=>parseInt(normalized.slice(start, start + 2), 16));
};

const mixHexColors = (color, target, targetAmount = 0.12) => {
  const colorChannels = getHexChannels(color);
  const targetChannels = getHexChannels(target);

  if(!colorChannels || !targetChannels){
    return color;
  }

  return `#${colorChannels
    .map((channel, index)=>Math.round(channel * (1 - targetAmount) + targetChannels[index] * targetAmount)
      .toString(16)
      .padStart(2, "0"))
    .join("")}`;
};

export const isInstalledApp = () => {
  if(typeof window === "undefined" || typeof navigator === "undefined"){
    return false;
  }

  const matchesDisplayMode = (displayMode) => (
    typeof window.matchMedia === "function" &&
    window.matchMedia(`(display-mode: ${displayMode})`).matches
  );

  return matchesDisplayMode("window-controls-overlay") ||
    matchesDisplayMode("standalone") ||
    navigator.standalone === true;
};

export const getInstalledAppThemeColor = (settings = {}) => {
  const animationTheme = settings.animationBackgroundTheme || "static";

  if(animationTheme !== "static"){
    return ANIMATED_THEME_COLORS[animationTheme] || DEFAULT_DARK_COLOR;
  }

  const isDark = settings.defaultTheme === "dark";
  const selectedColor = isDark
    ? (settings.darkGradientStart || DEFAULT_DARK_COLOR)
    : (settings.lightGradientStart || DEFAULT_LIGHT_COLOR);

  return mixHexColors(selectedColor, isDark ? "#000000" : "#ffffff");
};

export const syncInstalledAppThemeColor = (settings) => {
  if(!isInstalledApp() || typeof document === "undefined"){
    return;
  }

  const themeColorMeta = document.querySelector("meta[data-installed-app-theme]") ||
    document.querySelector('meta[name="theme-color"]');

  if(themeColorMeta){
    themeColorMeta.setAttribute("content", getInstalledAppThemeColor(settings));
  }
};
