export const SETTINGS_STORAGE_KEY = "memory-app-settings";
export const SETTINGS_UPDATED_EVENT = "memory-app-settings-updated";
export const SETTINGS_PREVIEW_EVENT = "memory-app-settings-preview";

export const defaultSettings = {
  reminderLeadDays:2,
  defaultTheme:"light",
  cardSize:"medium",
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

export const loadSettings = () => {
  try{
    const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");

    return {
      ...defaultSettings,
      ...savedSettings
    };
  }catch{
    return defaultSettings;
  }
};

export const normalizeSettings = (settings) => ({
    ...defaultSettings,
    ...settings,
    reminderLeadDays:Number(settings.reminderLeadDays) || defaultSettings.reminderLeadDays,
    topButtonsSize:numberOrDefault(settings.topButtonsSize, defaultSettings.topButtonsSize),
    containerGlassAlpha:numberOrDefault(settings.containerGlassAlpha, defaultSettings.containerGlassAlpha),
    buttonGlassAlpha:numberOrDefault(settings.buttonGlassAlpha, defaultSettings.buttonGlassAlpha),
    hoverScale:numberOrDefault(settings.hoverScale, defaultSettings.hoverScale)
});

export const previewSettings = (settings) => {
  const nextSettings = normalizeSettings(settings);

  window.dispatchEvent(new CustomEvent(SETTINGS_PREVIEW_EVENT, {detail:nextSettings}));

  return nextSettings;
};

export const saveSettings = (settings) => {
  const nextSettings = normalizeSettings(settings);

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, {detail:nextSettings}));

  return nextSettings;
};
