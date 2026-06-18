export const SETTINGS_STORAGE_KEY = "memory-app-settings";
export const SETTINGS_UPDATED_EVENT = "memory-app-settings-updated";
export const SETTINGS_PREVIEW_EVENT = "memory-app-settings-preview";
export const USER_BACKGROUND_PREFERENCE_KEY = "user_background_preference";

export const DEFAULT_BACKGROUND_PREFERENCE = {
  type:"gradient",
  start:"#f857a6",
  middle:"#c850c0",
  end:"#4158d0",
  direction:"diagonal"
};

export const defaultSettings = {
  reminderLeadDays:2,
  defaultTheme:"light",
  cardSize:"medium",
  cardBorderRadius:16,
  topButtonsPosition:"right",
  topButtonsIconStyle:"circle",
  topButtonsSize:50,
  toolbarIconStyle:"box",
  toolbarIconSize:24,
  toolbarButtonStretch:1,
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

const buildBackgroundPreference = (settings = defaultSettings) => {
  const normalized = normalizeSettings(settings);
  const isDark = normalized.defaultTheme === "dark";

  return {
    type:"gradient",
    start:isDark ? normalized.darkGradientStart : normalized.lightGradientStart,
    middle:isDark ? normalized.darkGradientMiddle : normalized.lightGradientMiddle,
    end:isDark ? normalized.darkGradientEnd : normalized.lightGradientEnd,
    direction:"diagonal"
  };
};

export const saveBackgroundPreference = (settings) => {
  const preference = buildBackgroundPreference(settings);

  localStorage.setItem(USER_BACKGROUND_PREFERENCE_KEY, JSON.stringify(preference));

  return preference;
};

export const loadBackgroundPreference = () => {
  try{
    const savedPreference = localStorage.getItem(USER_BACKGROUND_PREFERENCE_KEY);

    if(savedPreference){
      return {
        ...DEFAULT_BACKGROUND_PREFERENCE,
        ...JSON.parse(savedPreference)
      };
    }

    const scopedSettings = localStorage.getItem(getSettingsStorageKey(getDeviceProfile()));
    const legacySettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if(scopedSettings || legacySettings){
      return buildBackgroundPreference(JSON.parse(scopedSettings || legacySettings));
    }

    return {...DEFAULT_BACKGROUND_PREFERENCE};
  }catch{
    return {...DEFAULT_BACKGROUND_PREFERENCE};
  }
};

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
  toolbarIconSize:Math.min(
    34,
    Math.max(16, numberOrDefault(settings.toolbarIconSize, defaultSettings.toolbarIconSize))
  ),
  toolbarButtonStretch:Math.min(
    1.8,
    Math.max(0.75, numberOrDefault(settings.toolbarButtonStretch, defaultSettings.toolbarButtonStretch))
  ),
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

  saveBackgroundPreference(nextSettings);
  window.dispatchEvent(new CustomEvent(SETTINGS_PREVIEW_EVENT, {detail:nextSettings}));

  return nextSettings;
};

export const saveSettings = (settings, profile = getDeviceProfile()) => {
  const nextSettings = normalizeSettings(settings);

  localStorage.setItem(getSettingsStorageKey(profile), JSON.stringify(nextSettings));
  saveBackgroundPreference(nextSettings);

  if(getStoredUserId() !== "guest"){
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }

  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, {detail:nextSettings}));

  return nextSettings;
};
