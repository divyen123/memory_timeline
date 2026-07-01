import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAllMemories,
  deleteAccount,
  getAppearanceSettings,
  getProfile,
  updateAppearanceSettings,
  updatePassword,
  updateProfile
} from "../services/api";
import { clearAuthenticatedUser } from "../auth";
import PageTransition from "../components/PageTransition";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import {
  defaultSettings,
  getDeviceProfile,
  loadSettings,
  previewSettings,
  saveSettings
} from "../settings";
import { playAppSound } from "../sound";

const LIGHT_BACKGROUND_PRESETS = [
  {label:"White background", color:"#ffffff"},
  {label:"Grey background", color:"#b8b8b8"},
  {label:"Dark grey background", color:"#5f6368"}
];

const DARK_BACKGROUND_PRESETS = [
  {label:"Dark grey background", color:"#2f333a"},
  {label:"Extra dark grey background", color:"#181a20"},
  {label:"Black background", color:"#000000"}
];

const getColorHue = (hexColor) => {
  const normalized = String(hexColor || "").replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character)=>character + character).join("")
    : normalized;

  if(!/^[0-9a-f]{6}$/i.test(value)){
    return 0;
  }

  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;

  if(difference === 0){
    return 0;
  }

  let hue;

  if(maximum === red){
    hue = ((green - blue) / difference) % 6;
  }else if(maximum === green){
    hue = (blue - red) / difference + 2;
  }else{
    hue = (red - green) / difference + 4;
  }

  return Math.round((hue * 60 + 360) % 360);
};

const hueToHex = (hue, saturation, lightness) => {
  const normalizedHue = ((Number(hue) % 360) + 360) % 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const segment = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
  const offset = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if(segment < 1){
    red = chroma;
    green = secondary;
  }else if(segment < 2){
    red = secondary;
    green = chroma;
  }else if(segment < 3){
    green = chroma;
    blue = secondary;
  }else if(segment < 4){
    green = secondary;
    blue = chroma;
  }else if(segment < 5){
    red = secondary;
    blue = chroma;
  }else{
    red = chroma;
    blue = secondary;
  }

  return `#${[red, green, blue]
    .map((channel)=>Math.round((channel + offset) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
};

const collapseDesktopBackgroundColors = (settings, profile) => {
  if(profile !== "desktop"){
    return settings;
  }

  return {
    ...settings,
    lightGradientMiddle:settings.lightGradientStart,
    lightGradientEnd:settings.lightGradientStart,
    darkGradientMiddle:settings.darkGradientStart,
    darkGradientEnd:settings.darkGradientStart
  };
};

const isValidHidePin = (value) => /^\d{4}$/.test(value || "");
const APP_PASSWORD_ATTEMPT_LIMIT = 3;
const APP_PASSWORD_LOCK_MS = 10 * 60 * 1000;

const getLockMinutes = (lockedUntil) => Math.max(1, Math.ceil((lockedUntil - Date.now()) / 60000));

const mergeFetchedHideSettings = (remoteSettings, localSettings) => {
  const remotePin = isValidHidePin(remoteSettings.hidePasswordValue)
    ? remoteSettings.hidePasswordValue
    : "";
  const localPin = isValidHidePin(localSettings.hidePasswordValue)
    ? localSettings.hidePasswordValue
    : "";
  const hidePasswordValue = remotePin || localPin;

  return {
    ...remoteSettings,
    hidePasswordEnabled:Boolean(remoteSettings.hidePasswordEnabled || hidePasswordValue),
    hidePasswordValue,
    hidePasswordType:"pin"
  };
};

function Profile() {
  const navigate = useNavigate();
  const [name,setName] = useState("");
  const [age,setAge] = useState("");
  const [email,setEmail] = useState("");
  const [memoryCount,setMemoryCount] = useState(0);
  const [favoriteCount,setFavoriteCount] = useState(0);
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [message,setMessage] = useState("");
  const [confirmAction,setConfirmAction] = useState(null);
  const [accountDeletePassword,setAccountDeletePassword] = useState("");
  const [isDangerBusy,setIsDangerBusy] = useState(false);
  const [showAccountInfo,setShowAccountInfo] = useState(false);
  const [hidePinDraft,setHidePinDraft] = useState("");
  const [pendingHidePin,setPendingHidePin] = useState(null);
  const [hidePinAppPassword,setHidePinAppPassword] = useState("");
  const [isHidePinConfirming,setIsHidePinConfirming] = useState(false);
  const [hidePinPasswordAttempts,setHidePinPasswordAttempts] = useState({count:0, lockedUntil:0});
  const deviceProfile = getDeviceProfile();
  const isMobileProfile = deviceProfile === "mobile";
  const [appSettings,setAppSettings] = useState(
    ()=>collapseDesktopBackgroundColors(loadSettings(deviceProfile), deviceProfile)
  );
  const backupFileRef = useRef(null);

  useAutoDismissMessage(message, setMessage);

  useEffect(()=>{
    const fetchProfile = async () => {
      const res = await getProfile();
      setName(res.data.name || "");
      setAge(res.data.age ?? "");
      setEmail(res.data.email);
      setMemoryCount(res.data.memoryCount);
      setFavoriteCount(res.data.favoriteCount);
    };

    fetchProfile();

    getAppearanceSettings(deviceProfile)
      .then(({data})=>{
        const remoteSettings = data.settings || {};

        if(Object.keys(remoteSettings).length){
          const localSettings = collapseDesktopBackgroundColors(loadSettings(deviceProfile), deviceProfile);
          const profileSettings = mergeFetchedHideSettings(
            collapseDesktopBackgroundColors(remoteSettings, deviceProfile),
            localSettings
          );
          setAppSettings(saveSettings(profileSettings, deviceProfile));
        }
      })
      .catch(()=>{});
  },[deviceProfile]);

  useEffect(()=>{
    return () => {
      previewSettings(loadSettings(deviceProfile));
    };
  },[deviceProfile]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try{
      const submittedProfile = {
        name:name.trim(),
        age,
        email
      };
      const res = await updateProfile(submittedProfile);
      setName(Object.hasOwn(res.data, "name") ? res.data.name : submittedProfile.name);
      setAge(Object.hasOwn(res.data, "age") ? res.data.age ?? "" : submittedProfile.age);
      setEmail(res.data.email || submittedProfile.email);
      setMessage("Profile updated");
    }catch(err){
      setMessage(err.response?.data?.message || "Profile update failed");
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if(newPassword !== confirmPassword){
      setMessage("New password and confirm password do not match");
      return;
    }

    try{
      await updatePassword({currentPassword,newPassword});
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated");
    }catch(err){
      setMessage(err.response?.data?.message || "Password update failed");
    }
  };

  const hasSavedHidePin = Boolean(
    appSettings.hidePasswordEnabled && isValidHidePin(appSettings.hidePasswordValue)
  );

  const persistHideSettings = async (nextSettings, successMessage, failureMessage, currentPassword = "") => {
    const preparedSettings = collapseDesktopBackgroundColors({
      ...nextSettings,
      hidePasswordType:"pin"
    }, deviceProfile);
    const optimisticSettings = currentPassword
      ? preparedSettings
      : saveSettings(preparedSettings, deviceProfile);

    try{
      const {data} = await updateAppearanceSettings(deviceProfile, preparedSettings, currentPassword);
      const returnedSettings = data.settings || {};
      const mergedSettings = {
        ...preparedSettings,
        ...returnedSettings,
        hidePasswordEnabled:preparedSettings.hidePasswordEnabled,
        hidePasswordValue:preparedSettings.hidePasswordEnabled
          ? (isValidHidePin(returnedSettings.hidePasswordValue)
            ? returnedSettings.hidePasswordValue
            : preparedSettings.hidePasswordValue)
          : "",
        hidePasswordType:"pin"
      };

      setAppSettings(saveSettings(mergedSettings, deviceProfile));
      setMessage(successMessage);
      return true;
    }catch(error){
      if(currentPassword){
        throw error;
      }

      setAppSettings(optimisticSettings);
      setMessage(failureMessage);
      return false;
    }
  };

  const handleHidePasswordSave = async (e) => {
    e.preventDefault();

    const nextPin = hidePinDraft;

    if(Date.now() < hidePinPasswordAttempts.lockedUntil){
      setMessage(`Too many password attempts. Try again in ${getLockMinutes(hidePinPasswordAttempts.lockedUntil)} minutes.`);
      return;
    }

    if(!/^\d{4}$/.test(nextPin || "")){
      setMessage("Use a 4-digit hiding PIN");
      return;
    }

    setPendingHidePin(nextPin);
    setHidePinAppPassword("");
  };

  const closeHidePinPasswordConfirm = () => {
    if(isHidePinConfirming){
      return;
    }

    setPendingHidePin(null);
    setHidePinAppPassword("");
  };

  const handleHidePinPasswordConfirm = async (event) => {
    event.preventDefault();

    if(!pendingHidePin){
      return;
    }

    if(Date.now() < hidePinPasswordAttempts.lockedUntil){
      setMessage(`Too many password attempts. Try again in ${getLockMinutes(hidePinPasswordAttempts.lockedUntil)} minutes.`);
      return;
    }

    if(!hidePinAppPassword){
      setMessage("Enter your application password");
      return;
    }

    setIsHidePinConfirming(true);

    try{
      await persistHideSettings(
        {
          ...appSettings,
          hidePasswordEnabled:true,
          hidePasswordValue:pendingHidePin,
          hidePasswordType:"pin"
        },
        hasSavedHidePin ? "Hiding PIN updated" : "Hiding PIN saved",
        hasSavedHidePin
          ? "Hiding PIN updated on this device, but cloud sync failed"
          : "Hiding PIN saved on this device, but cloud sync failed",
        hidePinAppPassword
      );

      setHidePinDraft("");
      setPendingHidePin(null);
      setHidePinAppPassword("");
      setHidePinPasswordAttempts({count:0, lockedUntil:0});
    }catch(error){
      const nextCount = hidePinPasswordAttempts.count + 1;
      const shouldLock = error.response?.status === 429 || nextCount >= APP_PASSWORD_ATTEMPT_LIMIT;
      const lockedUntil = shouldLock ? Date.now() + APP_PASSWORD_LOCK_MS : 0;
      setHidePinPasswordAttempts({count:shouldLock ? 0 : nextCount, lockedUntil});
      setMessage(shouldLock
        ? "Too many password attempts. Try again in 10 minutes."
        : (error.response?.data?.message || "Application password is incorrect"));
    }finally{
      setIsHidePinConfirming(false);
    }
  };

  const closeDangerConfirm = () => {
    if(!isDangerBusy){
      setConfirmAction(null);
      setAccountDeletePassword("");
    }
  };

  const handleDangerConfirm = async () => {
    if(!confirmAction){
      return;
    }

    if(confirmAction === "delete-account"){
      setConfirmAction("delete-account-typed");
      setAccountDeletePassword("");
      return;
    }

    setIsDangerBusy(true);

    try{
      if(confirmAction === "clear-memories"){
        const {data} = await clearAllMemories();
        const moved = Number(data.moved) || 0;
        if(moved > 0){
          setMemoryCount(0);
          setFavoriteCount(0);
        }
        setMessage(
          data.message || (moved > 0 ? "All memories moved to trash" : "No memories found")
        );
      }

      if(confirmAction === "delete-account-typed"){
        await deleteAccount(accountDeletePassword);
        clearAuthenticatedUser();
        navigate("/", {replace:true});
        return;
      }
    }catch(err){
      setMessage(err.response?.data?.message || "Action failed");
    }finally{
      setIsDangerBusy(false);
      setConfirmAction(null);
      setAccountDeletePassword("");
    }
  };

  const handleSettingsUpdate = async(e) => {
    e.preventDefault();
    const savedSettings = saveSettings(
      collapseDesktopBackgroundColors(appSettings, deviceProfile),
      deviceProfile
    );

    try{
      const {data} = await updateAppearanceSettings(deviceProfile, savedSettings);
      setAppSettings(saveSettings({
        ...savedSettings,
        ...(data.settings || {})
      }, deviceProfile));
      setMessage(`${deviceProfile === "mobile" ? "Mobile" : "Desktop"} settings saved`);
    }catch{
      setAppSettings(savedSettings);
      setMessage("Settings saved on this device, but cloud sync failed");
    }
  };

  const handleSettingsReset = async() => {
    const resetSettings = saveSettings(
      collapseDesktopBackgroundColors(defaultSettings, deviceProfile),
      deviceProfile
    );

    try{
      await updateAppearanceSettings(deviceProfile, resetSettings);
      setMessage(`${deviceProfile === "mobile" ? "Mobile" : "Desktop"} settings reset`);
    }catch{
      setMessage("Settings reset locally, but cloud sync failed");
    }

    setAppSettings(resetSettings);
  };

  const updateSetting = (key, value) => {
    setAppSettings(currentSettings => {
      const previewedSettings = previewSettings({
        ...currentSettings,
        [key]:value
      });

      return previewedSettings;
    });
  };

  const updateSettings = (updates) => {
    setAppSettings(currentSettings => {
      const previewedSettings = previewSettings({
        ...currentSettings,
        ...updates
      });

      return previewedSettings;
    });
  };

  const updateBackgroundColor = (theme, color) => {
    const prefix = theme === "light" ? "lightGradient" : "darkGradient";

    updateSettings({
      [`${prefix}Start`]:color,
      [`${prefix}Middle`]:color,
      [`${prefix}End`]:color
    });
  };

  const isSelectedBackgroundColor = (currentColor, presetColor) => (
    String(currentColor || "").toLowerCase() === presetColor.toLowerCase()
  );

  const createSettingsBackup = () => {
    const reminderState = Object.keys(localStorage)
      .filter((key)=>key.startsWith("memory-reminder-"))
      .reduce((items, key) => ({
        ...items,
        [key]:localStorage.getItem(key)
      }), {});
    const backup = {
      version:1,
      exportedAt:new Date().toISOString(),
      deviceProfile,
      settings:appSettings,
      reminderState
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "memory-app-settings-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("Backup downloaded");
  };

  const restoreSettingsBackup = async (event) => {
    const file = event.target.files?.[0];

    if(!file){
      return;
    }

    try{
      const backup = JSON.parse(await file.text());
      const restoredSettings = saveSettings(
        collapseDesktopBackgroundColors(backup.settings || backup, deviceProfile),
        deviceProfile
      );
      await updateAppearanceSettings(deviceProfile, restoredSettings);

      Object.entries(backup.reminderState || {}).forEach(([key, value]) => {
        if(key.startsWith("memory-reminder-")){
          localStorage.setItem(key, value);
        }
      });

      setAppSettings(restoredSettings);
      setMessage("Backup restored");
    }catch{
      setMessage("Backup restore failed");
    }finally{
      event.target.value = "";
    }
  };

  const testSound = (type) => {
    playAppSound(type, appSettings);
  };

  return (
    <PageTransition>
      <div className="profile-page">
        {message && <div className="toast">{message}</div>}

        <section className="profile-summary-card">
          <div className="profile-avatar" aria-hidden="true">
            {(name || email || "U").charAt(0).toUpperCase()}
          </div>

          <div className="profile-summary-content">
            <p className="profile-eyebrow">Your profile</p>
            <h1>{name || "Name not set"}</h1>

            <div className="profile-info-list">
              <div className="profile-info-tile">
                <span>Name</span>
                <strong>{name || "Not set"}</strong>
              </div>
              <div className="profile-info-tile">
                <span>Age</span>
                <strong>{age !== "" ? `${age}` : "Not set"}</strong>
              </div>
              <div className="profile-info-tile">
                <span>Total memories</span>
                <strong>{memoryCount}</strong>
              </div>
              <div className="profile-info-tile">
                <span>Favorites</span>
                <strong>{favoriteCount}</strong>
              </div>
              <div className="profile-info-tile profile-info-email">
                <span>Email</span>
                <strong>{email || "Not set"}</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-grid">
          <div className="profile-card settings-card">
            <h2>Settings</h2>
            <p className="settings-device-note">
              Editing the <strong>{deviceProfile}</strong> profile. It syncs across your {deviceProfile} devices only.
            </p>
            <form onSubmit={handleSettingsUpdate}>
              <label className="settings-field">
                <span>Reminder starts</span>
                <select
                  value={appSettings.reminderLeadDays}
                  onChange={(e)=>updateSetting("reminderLeadDays", Number(e.target.value))}
                >
                  <option value="1">1 day before</option>
                  <option value="2">2 days before</option>
                  <option value="3">3 days before</option>
                  <option value="5">5 days before</option>
                  <option value="7">1 week before</option>
                </select>
              </label>

              <label className="settings-field">
                <span>Default theme</span>
                <div className="segmented-setting">
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "light" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "light")}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "dark" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "dark")}
                  >
                    Dark
                  </button>
                </div>
              </label>

              <div className="settings-row">
                <label className="settings-field">
                  <span>Memory card size</span>
                  <select
                    value={appSettings.cardSize}
                    onChange={(e)=>updateSetting("cardSize", e.target.value)}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Default memory view</span>
                  <select
                    value={appSettings.defaultMemoryView}
                    onChange={(e)=>updateSetting("defaultMemoryView", e.target.value)}
                  >
                    <option value="timeline">Timeline view</option>
                    <option value="calendar">Calendar view</option>
                    <option value="compact">Tile view</option>
                  </select>
                </label>

                <label className="settings-field settings-range-field">
                  <span>
                    Memory card border radius
                    <output>{appSettings.cardBorderRadius}px</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="36"
                    step="1"
                    value={appSettings.cardBorderRadius}
                    onChange={(e)=>updateSetting("cardBorderRadius", Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="settings-section-title">Appearance</div>

              <div className="settings-row">
                <label className="settings-field">
                  <span>Top buttons placement</span>
                  <select
                    value={appSettings.topButtonsPosition}
                    onChange={(e)=>updateSetting("topButtonsPosition", e.target.value)}
                  >
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Top buttons icon style</span>
                  <select
                    value={appSettings.topButtonsIconStyle || "circle"}
                    onChange={(e)=>updateSetting("topButtonsIconStyle", e.target.value)}
                  >
                    <option value="soft">Soft glass icons</option>
                    <option value="minimal">Minimal glow icons</option>
                    <option value="circle">Circle icons</option>
                    <option value="box">Fixed box icons</option>
                  </select>
                </label>

                {!isMobileProfile && (
                  <label className="settings-field">
                    <span>Top buttons size</span>
                    <input
                      type="range"
                      min="42"
                      max="78"
                      step="2"
                      value={appSettings.topButtonsSize}
                      onChange={(e)=>updateSetting("topButtonsSize", Number(e.target.value))}
                    />
                  </label>
                )}
              </div>

              <div className="settings-row">
                <label className="settings-field">
                  <span>Timeline icons style</span>
                  <select
                    value={appSettings.toolbarIconStyle || "box"}
                    onChange={(e)=>updateSetting("toolbarIconStyle", e.target.value)}
                  >
                    <option value="separate">Separate icons</option>
                    <option value="box">Fixed box icons</option>
                    <option value="circle">Circle icons</option>
                    <option value="pill">Rounded pill icons</option>
                    <option value="soft">Soft glass icons</option>
                    <option value="minimal">Minimal glow icons</option>
                  </select>
                </label>

                <label className="settings-field settings-range-field">
                  <span>
                    Timeline icon size
                    <output>{appSettings.toolbarIconSize}px</output>
                  </span>
                  <input
                    type="range"
                    min="16"
                    max="34"
                    step="1"
                    value={appSettings.toolbarIconSize}
                    onChange={(e)=>updateSetting("toolbarIconSize", Number(e.target.value))}
                  />
                </label>

                <label className="settings-field settings-range-field">
                  <span>
                    Timeline icon stretch
                    <output>{Number(appSettings.toolbarButtonStretch).toFixed(2)}x</output>
                  </span>
                  <input
                    type="range"
                    min="0.75"
                    max="1.8"
                    step="0.05"
                    value={appSettings.toolbarButtonStretch}
                    onChange={(e)=>updateSetting("toolbarButtonStretch", Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="settings-row">
                <label className="settings-field">
                  <span>Font size</span>
                  <select
                    value={appSettings.fontSize}
                    onChange={(e)=>updateSetting("fontSize", e.target.value)}
                  >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="extra">Extra large</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Font weight</span>
                  <select
                    value={appSettings.fontWeight}
                    onChange={(e)=>updateSetting("fontWeight", e.target.value)}
                  >
                    <option value="normal">Normal</option>
                    <option value="600">Semi bold</option>
                    <option value="700">Bold</option>
                    <option value="800">Extra bold</option>
                  </select>
                </label>

                <label className="settings-field">
                  <span>Font style</span>
                  <select
                    value={appSettings.fontStyle}
                    onChange={(e)=>updateSetting("fontStyle", e.target.value)}
                  >
                    <option value="normal">Default</option>
                    <option value="modern">Modern</option>
                    <option value="rounded">Rounded</option>
                    <option value="classic">Classic serif</option>
                    <option value="mono">Monospace</option>
                    <option value="handwritten">Handwritten</option>
                    <option value="italic">Italic</option>
                  </select>
                </label>
              </div>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.containerGlass}
                  onChange={(e)=>updateSetting("containerGlass", e.target.checked)}
                />
                <span>Container glass effect</span>
              </label>

              <label className="settings-field">
                <span>Container transparency</span>
                <input
                  type="range"
                  min="0.04"
                  max="0.45"
                  step="0.01"
                  value={appSettings.containerGlassAlpha}
                  onChange={(e)=>updateSetting("containerGlassAlpha", Number(e.target.value))}
                />
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.buttonGlass}
                  onChange={(e)=>updateSetting("buttonGlass", e.target.checked)}
                />
                <span>Button glass effect</span>
              </label>

              <label className="settings-color-field">
                <span>Button background color</span>
                <input
                  type="color"
                  value={appSettings.buttonBackgroundColor}
                  onChange={(e)=>updateSetting("buttonBackgroundColor", e.target.value)}
                />
              </label>

              <label className="settings-field">
                <span>Button transparency</span>
                <input
                  type="range"
                  min="0.08"
                  max="0.55"
                  step="0.01"
                  value={appSettings.buttonGlassAlpha}
                  onChange={(e)=>updateSetting("buttonGlassAlpha", Number(e.target.value))}
                />
              </label>

              {!isMobileProfile && (
                <label className="settings-field">
                  <span>Floating hearts speed</span>
                  <select
                    value={appSettings.heartsSpeed}
                    onChange={(e)=>updateSetting("heartsSpeed", e.target.value)}
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
              )}

              <div className="settings-section-title">Background Colors</div>

              {isMobileProfile ? (
                <div className="settings-color-grid mobile-theme-colors">
                  <label>
                    <span>Light theme</span>
                    <input
                      type="color"
                      value={appSettings.lightGradientStart}
                      onChange={(e)=>updateSettings({
                        lightGradientStart:e.target.value,
                        lightGradientMiddle:e.target.value,
                        lightGradientEnd:e.target.value
                      })}
                    />
                  </label>
                  <label>
                    <span>Dark theme</span>
                    <input
                      type="color"
                      value={appSettings.darkGradientStart}
                      onChange={(e)=>updateSettings({
                        darkGradientStart:e.target.value,
                        darkGradientMiddle:e.target.value,
                        darkGradientEnd:e.target.value
                      })}
                    />
                  </label>
                </div>
              ) : (
                <div className="desktop-theme-color-controls">
                  <label className="theme-color-control">
                    <span className="theme-color-heading">
                      <span>Light background</span>
                      <span className="theme-color-heading-actions">
                        <output>{appSettings.lightGradientStart.toUpperCase()}</output>
                        <span className="theme-palette-buttons" aria-label="Light background presets">
                          {LIGHT_BACKGROUND_PRESETS.map((preset)=>(
                            <button
                              key={preset.color}
                              type="button"
                              className={`theme-palette-button ${isSelectedBackgroundColor(appSettings.lightGradientStart, preset.color) ? "selected" : ""}`}
                              style={{"--palette-color":preset.color}}
                              aria-label={preset.label}
                              title={preset.label}
                              onClick={()=>updateBackgroundColor("light", preset.color)}
                            />
                          ))}
                        </span>
                      </span>
                    </span>
                    <span className="theme-color-slider">
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={getColorHue(appSettings.lightGradientStart)}
                        style={{ "--theme-color-thumb": appSettings.lightGradientStart }}
                        aria-label="Light background color"
                        onChange={(e)=>{
                          const color = hueToHex(e.target.value, 82, 68);
                          updateSettings({
                            lightGradientStart:color,
                            lightGradientMiddle:color,
                            lightGradientEnd:color
                          });
                        }}
                      />
                    </span>
                  </label>

                  <label className="theme-color-control">
                    <span className="theme-color-heading">
                      <span>Dark background</span>
                      <span className="theme-color-heading-actions">
                        <output>{appSettings.darkGradientStart.toUpperCase()}</output>
                        <span className="theme-palette-buttons" aria-label="Dark background presets">
                          {DARK_BACKGROUND_PRESETS.map((preset)=>(
                            <button
                              key={preset.color}
                              type="button"
                              className={`theme-palette-button ${isSelectedBackgroundColor(appSettings.darkGradientStart, preset.color) ? "selected" : ""}`}
                              style={{"--palette-color":preset.color}}
                              aria-label={preset.label}
                              title={preset.label}
                              onClick={()=>updateBackgroundColor("dark", preset.color)}
                            />
                          ))}
                        </span>
                      </span>
                    </span>
                    <span className="theme-color-slider theme-color-slider-dark">
                      <input
                        type="range"
                        min="0"
                        max="359"
                        value={getColorHue(appSettings.darkGradientStart)}
                        style={{ "--theme-color-thumb": appSettings.darkGradientStart }}
                        aria-label="Dark background color"
                        onChange={(e)=>{
                          const color = hueToHex(e.target.value, 48, 13);
                          updateSettings({
                            darkGradientStart:color,
                            darkGradientMiddle:color,
                            darkGradientEnd:color
                          });
                        }}
                      />
                    </span>
                  </label>
                </div>
              )}

              {!isMobileProfile && (
                <>
                  <div className="settings-section-title">Memory Hover</div>

                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={appSettings.hoverEnabled}
                      onChange={(e)=>updateSetting("hoverEnabled", e.target.checked)}
                    />
                    <span>Enable memory hover</span>
                  </label>

                  <label className="settings-field">
                    <span>Hover size</span>
                    <input
                      type="range"
                      min="1"
                      max="1.14"
                      step="0.01"
                      value={appSettings.hoverScale}
                      onChange={(e)=>updateSetting("hoverScale", Number(e.target.value))}
                    />
                  </label>
                </>
              )}

              <div className="settings-section-title">Backup & Sound</div>

              <div className="settings-actions">
                <button type="button" onClick={createSettingsBackup}>Backup Settings</button>
                <button type="button" onClick={()=>backupFileRef.current?.click()}>Restore Settings</button>
              </div>
              <input
                ref={backupFileRef}
                type="file"
                accept="application/json"
                className="settings-backup-input"
                onChange={restoreSettingsBackup}
              />

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={appSettings.soundEnabled}
                  onChange={(e)=>updateSetting("soundEnabled", e.target.checked)}
                />
                <span>Notification sounds</span>
              </label>

              <div className="settings-row settings-sound-row">
                <label className="settings-field">
                  <span>New memory</span>
                  <div className="settings-sound-control">
                    <select value={appSettings.createSound} onChange={(e)=>updateSetting("createSound", e.target.value)}>
                      <option value="sparkle">Sparkle</option>
                      <option value="chime">Chime</option>
                      <option value="bell">Bell</option>
                      <option value="pop">Pop</option>
                    </select>
                    <button type="button" onClick={()=>testSound("create")} aria-label="Test new memory sound">
                      &#9654;
                    </button>
                  </div>
                </label>
                <label className="settings-field">
                  <span>Update memory</span>
                  <div className="settings-sound-control">
                    <select value={appSettings.updateSound} onChange={(e)=>updateSetting("updateSound", e.target.value)}>
                      <option value="chime">Chime</option>
                      <option value="sparkle">Sparkle</option>
                      <option value="bell">Bell</option>
                      <option value="pop">Pop</option>
                    </select>
                    <button type="button" onClick={()=>testSound("update")} aria-label="Test update memory sound">
                      &#9654;
                    </button>
                  </div>
                </label>
                <label className="settings-field">
                  <span>Reminder popup</span>
                  <div className="settings-sound-control">
                    <select value={appSettings.reminderSound} onChange={(e)=>updateSetting("reminderSound", e.target.value)}>
                      <option value="bell">Bell</option>
                      <option value="chime">Chime</option>
                      <option value="sparkle">Sparkle</option>
                      <option value="pop">Pop</option>
                    </select>
                    <button type="button" onClick={()=>testSound("reminder")} aria-label="Test reminder popup sound">
                      &#9654;
                    </button>
                  </div>
                </label>
              </div>

              <div className="settings-save-actions">
                <button type="submit">Save Settings</button>
                <button type="button" className="settings-reset-btn" onClick={handleSettingsReset}>
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div className="profile-card">
            <h2>Profile</h2>

            {isMobileProfile && (
              <p className="profile-mobile-desktop-note">
                For the smoothest editing experience, use the desktop version when adjusting many settings or managing larger memory collections.
              </p>
            )}

            <form onSubmit={handleProfileUpdate}>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e)=>setName(e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Age"
                value={age}
                onChange={(e)=>setAge(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                required
              />
              <button type="submit">Update Profile</button>
            </form>

            <div className="profile-danger-zone">
              <button
                type="button"
                className="profile-danger-btn profile-danger-warning"
                onClick={()=>setConfirmAction("clear-memories")}
              >
                Clear all memories
              </button>

              <div className="profile-delete-account-row">
                <button
                  type="button"
                  className="profile-danger-btn profile-danger-delete"
                  onClick={()=>setConfirmAction("delete-account")}
                >
                  Delete account
                </button>
                <span className="profile-delete-info-wrap">
                  <button
                    type="button"
                    className="profile-delete-info-btn"
                    aria-label="Delete account warning"
                    aria-expanded={showAccountInfo}
                    onClick={()=>setShowAccountInfo((current)=>!current)}
                  >
                    i
                  </button>
                  <span className={`profile-delete-info-bubble ${showAccountInfo ? "show" : ""}`}>
                    Deletes your account, profile information, memories, images, and sessions permanently from the database.
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="profile-card password-card">
            <h2>Password</h2>
            <form className="password-update-form" onSubmit={handlePasswordUpdate}>
              <input
                type="password"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e)=>setCurrentPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e)=>setNewPassword(e.target.value)}
                required
              />
              <div className="password-confirm-row">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e)=>setConfirmPassword(e.target.value)}
                  required
                />
                <button type="submit">Change Password</button>
              </div>
            </form>

            <form className="hide-password-settings" onSubmit={handleHidePasswordSave}>
              <h3 className="hide-pin-form-title">Set PIN for hiding</h3>

              <div className="hide-pin-controls">
                <div className="hide-password-fields">
                  <label>
                    <span>{hasSavedHidePin ? "Update PIN" : "4-digit PIN"}</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={hasSavedHidePin ? "New PIN" : "Enter PIN"}
                      value={hidePinDraft}
                      maxLength={4}
                      disabled={Date.now() < hidePinPasswordAttempts.lockedUntil}
                      onChange={(e)=>{
                        const nextValue = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setHidePinDraft(nextValue);
                      }}
                    />
                  </label>
                </div>

                <button type="submit" disabled={Date.now() < hidePinPasswordAttempts.lockedUntil}>
                  {hasSavedHidePin ? "Update PIN" : "Save hiding PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <button className="profile-back-btn" onClick={()=>navigate("/timeline")}>
          Back to Timeline
        </button>


        {pendingHidePin && (
          <div className="confirm-overlay hide-pin-password-overlay" onClick={closeHidePinPasswordConfirm}>
            <form className="confirm-dialog hide-pin-password-dialog" onSubmit={handleHidePinPasswordConfirm} onClick={(event)=>event.stopPropagation()}>
              <h3>Confirm application password</h3>
              <p>Enter your application password to {hasSavedHidePin ? "update" : "save"} the Hidden Images PIN.</p>
              <input
                type="password"
                className="hide-pin-password-input"
                autoFocus
                autoComplete="current-password"
                placeholder="Application password"
                value={hidePinAppPassword}
                disabled={isHidePinConfirming}
                onChange={(event)=>setHidePinAppPassword(event.target.value)}
              />
              <div className="confirm-actions hide-pin-password-actions">
                <button type="button" className="confirm-cancel-btn" disabled={isHidePinConfirming} onClick={closeHidePinPasswordConfirm}>
                  Cancel
                </button>
                <button type="submit" disabled={isHidePinConfirming || !hidePinAppPassword}>
                  {isHidePinConfirming ? "Checking..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        )}
        {confirmAction && (
          <div className="confirm-overlay">
            <div className="confirm-dialog profile-danger-confirm">
              <h3>
                {confirmAction === "clear-memories"
                  ? "Move all memories to trash?"
                  : confirmAction === "delete-account"
                    ? "Delete account permanently?"
                    : "Enter password to confirm"}
              </h3>
              <p>
                {confirmAction === "clear-memories"
                  ? "All memories will move to trash. You can restore them before they are permanently deleted."
                  : confirmAction === "delete-account"
                    ? "This permanently deletes your account, memories, images, and profile information from the database."
                    : "Enter your application password to permanently delete your account and all information."}
              </p>
              {confirmAction === "delete-account-typed" && (
                <input
                  type="password"
                  className="profile-delete-confirm-input"
                  aria-label="Application password for account deletion"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Application password"
                  value={accountDeletePassword}
                  onChange={(event)=>setAccountDeletePassword(event.target.value)}
                />
              )}
              <div className="confirm-actions profile-danger-confirm-actions">
                <button type="button" className="cancel-delete-btn" onClick={closeDangerConfirm} disabled={isDangerBusy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="confirm-delete-btn"
                  onClick={handleDangerConfirm}
                  disabled={
                    isDangerBusy ||
                    (confirmAction === "delete-account-typed" &&
                      !accountDeletePassword)
                  }
                >
                  {isDangerBusy
                    ? "Working..."
                    : confirmAction === "clear-memories"
                      ? "Move to trash"
                      : confirmAction === "delete-account"
                        ? "Delete account"
                        : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default Profile;