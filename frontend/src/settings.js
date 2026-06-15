export const SETTINGS_STORAGE_KEY = "memory-app-settings";
export const SETTINGS_UPDATED_EVENT = "memory-app-settings-updated";
export const SETTINGS_PREVIEW_EVENT = "memory-app-settings-preview";

export const defaultSettings = {
  reminderLeadDays:2,
  defaultTheme:"light",
  cardSize:"medium",
  cardBorderRadius:16,
  topButtonsPosition:"right",
  topButtonsSize:50,
  fontSize:"normal",
  fontWeight:"normal",
  fontStyle:"normal",
  containerGlass:true,
  containerGlassAlpha:0.12,
  buttonBackgroundColor:"#ff4b7d",
  buttonGlass:false,
  buttonGlassAlpha:0.18,
  heartsSpeed:"normal",
  lightGradientStart:"#ff7ac6",
  lightGradientMiddle:"#c45cff",
  lightGradientEnd:"#7a8cff",
  darkGradientStart:"#0f172a",
  darkGradientMiddle:"#1e1b4b",
  darkGradientEnd:"#020617",
  hoverEnabled:true,
  hoverScale:1.05,
  soundEnabled:true,
  createSound:"sparkle",
  updateSound:"chime",
  reminderSound:"bell"
};

const numberOrDefault = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getStoredUserId = () => localStorage.getItem("memory-app-user-id") || "guest";

export const getDeviceProfile = () => {
  if(typeof navigator === "undefined"){
    return "desktop";
  }

  const mobileAgent = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
  const compactTouchDevice = typeof window !== "undefined" &&
    navigator.maxTouchPoints > 1 &&
    window.matchMedia("(max-width: 820px)").matches;
  return mobileAgent || compactTouchDevice ? "mobile" : "desktop";
};

export const getSettingsStorageKey = (profile = getDeviceProfile()) => (
  `${SETTINGS_STORAGE_KEY}:${getStoredUserId()}:${profile}`
);

export const normalizeSettings = (settings = {}) => ({
  ...defaultSettings,
  ...settings,
  reminderLeadDays:Number(settings.reminderLeadDays) || defaultSettings.reminderLeadDays,
  cardBorderRadius:Math.min(
    36,
    Math.max(0, numberOrDefault(settings.cardBorderRadius, defaultSettings.cardBorderRadius))
  ),
  topButtonsSize:numberOrDefault(settings.topButtonsSize, defaultSettings.topButtonsSize),
  containerGlassAlpha:numberOrDefault(settings.containerGlassAlpha, defaultSettings.containerGlassAlpha),
  buttonGlassAlpha:numberOrDefault(settings.buttonGlassAlpha, defaultSettings.buttonGlassAlpha),
  hoverScale:numberOrDefault(settings.hoverScale, defaultSettings.hoverScale)
});

export const loadSettings = (profile = getDeviceProfile()) => {
  try{
    const scopedSettings = localStorage.getItem(getSettingsStorageKey(profile));
    const legacySettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(JSON.parse(scopedSettings || legacySettings || "{}"));
  }catch{
    return {...defaultSettings};
  }
};

export const previewSettings = (settings) => {
  const nextSettings = normalizeSettings(settings);

  window.dispatchEvent(new CustomEvent(SETTINGS_PREVIEW_EVENT, {detail:nextSettings}));

  return nextSettings;
};

export const saveSettings = (settings, profile = getDeviceProfile()) => {
  const nextSettings = normalizeSettings(settings);

  localStorage.setItem(getSettingsStorageKey(profile), JSON.stringify(nextSettings));

  if(getStoredUserId() !== "guest"){
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, {detail:nextSettings}));

  return nextSettings;
};
