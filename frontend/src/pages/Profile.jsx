import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAllMemories,
  deleteAccount,
  getAppearanceSettings,
  getProfile,
  getMemories,
  updateAppearanceSettings,
  updatePassword,
  updateProfile
} from "../services/api";
import { clearAuthenticatedUser } from "../auth";
import PageTransition from "../components/PageTransition";
import { ANIMATED_BACKGROUND_OPTIONS } from "../components/AnimatedBackground";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import {
  defaultSettings,
  getDeviceProfile,
  loadSettings,
  previewSettings,
  saveSettings
} from "../settings";
import { playAppSound } from "../sound";

import { createHidePinValue, hasStoredHidePin, isFourDigitHidePin } from "../pinPrivacy";

const LIGHT_BACKGROUND_PRESETS = [
  {label:"White background", color:"#ffffff"},
  {label:"Grey background", color:"#b8b8b8"},
  {label:"Dark grey background", color:"#5f6368"}
];

const PROFILE_MEMORY_CATEGORIES = ["Personal","Family","Friends","Travel","School","Work","Other"];
const PROFILE_CATEGORY_COLORS = [
  "var(--profile-chart-color-1)",
  "var(--profile-chart-color-2)",
  "var(--profile-chart-color-3)",
  "var(--profile-chart-color-4)",
  "var(--profile-chart-color-5)",
  "var(--profile-chart-color-6)",
  "var(--profile-chart-color-7)"
];
const PROFILE_PHOTO_MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const PROFILE_PHOTO_SIZE = 360;
const PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function PencilIcon(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4.6L19.8 8.8a2.1 2.1 0 0 0 0-3L18.2 4.2a2.1 2.1 0 0 0-3 0L4 15.4V20Zm3-3v-1.4l8.9-8.9 1.4 1.4L8.4 17H7Z" />
    </svg>
  );
}

function TrashIcon(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 21c-.6 0-1.1-.2-1.5-.6S5 19.5 5 19V8H4V6h5V4h6v2h5v2h-1v11c0 .6-.2 1.1-.6 1.5S17.5 21 17 21H7Zm2-4h2V10H9v7Zm4 0h2V10h-2v7Z" />
    </svg>
  );
}

const loadImageFromFile = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Unable to read profile photo"));
  };
  image.src = objectUrl;
});

const compressProfilePhoto = async(file) => {
  if(!PROFILE_PHOTO_TYPES.has(file.type)){
    throw new Error("Choose a JPG, PNG, or WebP image");
  }

  if(file.size > PROFILE_PHOTO_MAX_SOURCE_SIZE){
    throw new Error("Profile photo must be under 8 MB");
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const size = Math.min(imageWidth, imageHeight);
  const sourceX = (imageWidth - size) / 2;
  const sourceY = (imageHeight - size) / 2;
  const context = canvas.getContext("2d");

  canvas.width = PROFILE_PHOTO_SIZE;
  canvas.height = PROFILE_PHOTO_SIZE;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE);
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE);

  return canvas.toDataURL("image/jpeg", 0.84);
};

const getCategoryChartGradient = (items) => {
  if(!items.length){
    return "conic-gradient(var(--profile-chart-empty-color) 0% 100%)";
  }

  let start = 0;
  const stops = items.map((item, index) => {
    const end = index === items.length - 1 ? 100 : start + item.percentage;
    const color = item.color || PROFILE_CATEGORY_COLORS[index % PROFILE_CATEGORY_COLORS.length];
    const stop = `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return stop;
  });

  return `conic-gradient(${stops.join(", ")})`;
};
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

const isValidHidePin = hasStoredHidePin;
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
  const [profilePhoto,setProfilePhoto] = useState("");
  const [isAvatarBusy,setIsAvatarBusy] = useState(false);
  const [memoryCount,setMemoryCount] = useState(0);
  const [favoriteCount,setFavoriteCount] = useState(0);
  const [categoryBreakdown,setCategoryBreakdown] = useState([]);
  const [activeCategory,setActiveCategory] = useState("");
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [message,setMessage] = useState("");
  const [confirmAction,setConfirmAction] = useState(null);
  const [accountDeletePassword,setAccountDeletePassword] = useState("");
  const [isDangerBusy,setIsDangerBusy] = useState(false);
  const [showAccountInfo,setShowAccountInfo] = useState(false);
  const [hidePinDraft,setHidePinDraft] = useState("");
  const [confirmHidePinDraft,setConfirmHidePinDraft] = useState("");
  const [pendingHidePin,setPendingHidePin] = useState(null);
  const [hidePinAppPassword,setHidePinAppPassword] = useState("");
  const [isHidePinConfirming,setIsHidePinConfirming] = useState(false);
  const [hidePinPasswordAttempts,setHidePinPasswordAttempts] = useState({count:0, lockedUntil:0});
  const [showSettingsResetConfirm,setShowSettingsResetConfirm] = useState(false);
  const [isSettingsResetting,setIsSettingsResetting] = useState(false);
  const deviceProfile = getDeviceProfile();
  const isMobileProfile = deviceProfile === "mobile";
  const [appSettings,setAppSettings] = useState(
    ()=>collapseDesktopBackgroundColors(loadSettings(deviceProfile), deviceProfile)
  );
  const isStaticBackgroundTheme = (appSettings.animationBackgroundTheme || "static") === "static";
  const isDefaultThemeLocked = !isStaticBackgroundTheme;
  const backupFileRef = useRef(null);
  const profilePhotoInputRef = useRef(null);

  useAutoDismissMessage(message, setMessage);

  useEffect(()=>{
    const fetchProfile = async () => {
      const res = await getProfile();
      setName(res.data.name || "");
      setAge(res.data.age ?? "");
      setEmail(res.data.email);
      setProfilePhoto(res.data.profilePhoto || "");
      setMemoryCount(res.data.memoryCount);
      setFavoriteCount(res.data.favoriteCount);
    };

    const fetchCategoryBreakdown = async () => {
      try{
        const counts = PROFILE_MEMORY_CATEGORIES.reduce((result, category) => ({
          ...result,
          [category]:0
        }), {});
        let nextPage = 1;
        let hasMoreMemories = true;

        while(hasMoreMemories){
          const res = await getMemories({
            page:nextPage,
            limit:30,
            sort:"newest",
            category:"All"
          });
          const memories = Array.isArray(res.data.memories) ? res.data.memories : [];

          memories.forEach((memory) => {
            const category = PROFILE_MEMORY_CATEGORIES.includes(memory.category) ? memory.category : "Other";
            counts[category] = (counts[category] || 0) + 1;
          });

          hasMoreMemories = Boolean(res.data.hasMore);
          nextPage += 1;
        }

        const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
        setCategoryBreakdown(PROFILE_MEMORY_CATEGORIES
          .map((category, index) => ({
            category,
            count:counts[category] || 0,
            color:PROFILE_CATEGORY_COLORS[index % PROFILE_CATEGORY_COLORS.length],
            percentage:total ? ((counts[category] || 0) / total) * 100 : 0
          }))
          .filter((item)=>item.count > 0));
      }catch{
        setCategoryBreakdown([]);
      }
    };

    fetchProfile();
    if(isMobileProfile){
      setCategoryBreakdown([]);
    }else{
      fetchCategoryBreakdown();
    }

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
  },[deviceProfile,isMobileProfile]);

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

  const saveProfilePhoto = async (nextProfilePhoto, successMessage) => {
    setIsAvatarBusy(true);

    try{
      const res = await updateProfile({
        name:name.trim(),
        age,
        email,
        profilePhoto:nextProfilePhoto
      });
      setName(Object.hasOwn(res.data, "name") ? res.data.name : name.trim());
      setAge(Object.hasOwn(res.data, "age") ? res.data.age ?? "" : age);
      setEmail(res.data.email || email);
      setProfilePhoto(res.data.profilePhoto || "");
      setMessage(successMessage);
    }catch(err){
      setMessage(err.response?.data?.message || "Profile photo update failed");
    }finally{
      setIsAvatarBusy(false);
    }
  };

  const handleProfilePhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if(!file){
      return;
    }

    try{
      setMessage("Preparing profile photo...");
      const nextProfilePhoto = await compressProfilePhoto(file);
      await saveProfilePhoto(nextProfilePhoto, "Profile photo updated");
    }catch(err){
      setMessage(err.message || "Profile photo update failed");
    }
  };

  const handleProfilePhotoAction = () => {
    if(isAvatarBusy){
      return;
    }

    if(profilePhoto){
      saveProfilePhoto("", "Profile photo removed");
      return;
    }

    profilePhotoInputRef.current?.click();
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
    const confirmedPin = confirmHidePinDraft;

    if(Date.now() < hidePinPasswordAttempts.lockedUntil){
      setMessage(`Too many password attempts. Try again in ${getLockMinutes(hidePinPasswordAttempts.lockedUntil)} minutes.`);
      return;
    }

    if(!isFourDigitHidePin(nextPin)){
      setMessage("Use a 4-digit hiding PIN");
      return;
    }

    if(nextPin !== confirmedPin){
      setMessage("Hiding PIN and confirm PIN do not match");
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
      const protectedHidePin = await createHidePinValue(pendingHidePin);
      await persistHideSettings(
        {
          ...appSettings,
          hidePasswordEnabled:true,
          hidePasswordValue:protectedHidePin,
          hidePasswordType:"pin"
        },
        hasSavedHidePin ? "Hiding PIN updated" : "Hiding PIN saved",
        hasSavedHidePin
          ? "Hiding PIN updated on this device, but cloud sync failed"
          : "Hiding PIN saved on this device, but cloud sync failed",
        hidePinAppPassword
      );

      setHidePinDraft("");
      setConfirmHidePinDraft("");
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
        const {data} = await deleteAccount(accountDeletePassword);
        sessionStorage.setItem("memory-account-delete-message", data.message || "Account deleted successfully");
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

  const closeSettingsResetConfirm = () => {
    if(!isSettingsResetting){
      setShowSettingsResetConfirm(false);
    }
  };

  const handleSettingsReset = async() => {
    if(isSettingsResetting){
      return;
    }

    setIsSettingsResetting(true);
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
    setIsSettingsResetting(false);
    setShowSettingsResetConfirm(false);
  };

  const updateSetting = (key, value) => {
    setAppSettings(currentSettings => {
      const updates = {[key]:value};

      if(key === "animationBackgroundTheme" && value !== "static"){
        updates.defaultTheme = "dark";
      }

      const previewedSettings = previewSettings({
        ...currentSettings,
        ...updates
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

  const handleBackgroundNotificationsChange = (enabled) => {
    updateSetting("backgroundNotificationsEnabled", enabled);
    setMessage(enabled
      ? "Reminder emails will be sent to your registered email address."
      : "Reminder emails are disabled.");
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
  const handleCategoryPieMove = (event) => {
    if(!categoryBreakdown.length){
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const position = (((Math.atan2(y, x) * 180) / Math.PI + 450) % 360) / 360 * 100;
    let cumulative = 0;

    const hoveredCategory = categoryBreakdown.find((item, index) => {
      cumulative += item.percentage;
      return position <= cumulative || index === categoryBreakdown.length - 1;
    });

    setActiveCategory(hoveredCategory?.category || "");
  };
  const categoryChartTotal = categoryBreakdown.reduce((sum, item) => sum + item.count, 0);
  const categoryChartGradient = getCategoryChartGradient(categoryBreakdown);

  return (
    <PageTransition>
      <div className="profile-page">
        {message && <div className="toast">{message}</div>}

        <section className="profile-summary-card">
          <div className="profile-summary-main">
            <div className={`profile-avatar-shell ${profilePhoto ? "has-photo" : ""}`}>
              <input
                ref={profilePhotoInputRef}
                className="profile-avatar-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfilePhotoSelect}
              />
              <div className="profile-avatar" aria-label="Profile photo">
                {profilePhoto ? (
                  <img className="profile-avatar-photo" src={profilePhoto} alt={`${name || "User"} profile`} />
                ) : (
                  <span>{(name || email || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <button
                type="button"
                className={`profile-avatar-action ${profilePhoto ? "delete" : "edit"}`}
                onClick={handleProfilePhotoAction}
                disabled={isAvatarBusy}
                aria-label={profilePhoto ? "Remove profile photo" : "Upload profile photo"}
                title={profilePhoto ? "Remove profile photo" : "Upload profile photo"}
              >
                {profilePhoto ? <TrashIcon /> : <PencilIcon />}
              </button>
            </div>

            <div className="profile-summary-content">
              <div className="profile-title-block">
                <p className="profile-eyebrow">Your profile</p>
                <h1>{name || "Name not set"}</h1>
              </div>

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
          </div>

          {!isMobileProfile && (
            <aside className="profile-category-chart" aria-label="Memories by category">
              <div className="profile-category-heading">
                <span>Memories by category</span>
                <strong>{categoryChartTotal}</strong>
              </div>

              <div
                key={`${categoryChartTotal}-${categoryBreakdown.length}`}
                className="profile-category-pie"
                style={{"--category-chart-gradient":categoryChartGradient}}
                onMouseMove={handleCategoryPieMove}
                onMouseLeave={()=>setActiveCategory("")}
              >
                <span>{categoryBreakdown.length || 0}</span>
                <small>{categoryBreakdown.length === 1 ? "category" : "categories"}</small>
              </div>

              <div className="profile-category-legend">
                {categoryBreakdown.length ? categoryBreakdown.map((item)=>(
                  <span
                    key={item.category}
                    className={activeCategory === item.category ? "active" : ""}
                    style={{"--chart-color":item.color}}
                  >
                    <i aria-hidden="true" />
                    <strong>{item.category}</strong>
                    <em>{item.count}</em>
                  </span>
                )) : (
                  <span className="profile-category-empty">No memories yet</span>
                )}
              </div>
            </aside>
          )}
        </section>

        <div className="profile-grid">
          <div className="profile-card settings-card">
            <h2>Settings</h2>
            <p className="settings-device-note">
              Editing the <strong>{deviceProfile}</strong> profile. Reminder starts and Email reminders sync across mobile and desktop; appearance settings stay device-specific.
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

              <label className={`settings-field default-theme-field ${isDefaultThemeLocked ? "locked" : ""}`}>
                <span>Default theme</span>
                <div className="segmented-setting" aria-disabled={isDefaultThemeLocked}>
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "light" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "light")}
                    disabled={isDefaultThemeLocked}
                    title={isDefaultThemeLocked ? "Animated backgrounds always use dark theme" : "Use light theme"}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={appSettings.defaultTheme === "dark" ? "active" : ""}
                    onClick={()=>updateSetting("defaultTheme", "dark")}
                    disabled={isDefaultThemeLocked}
                    title={isDefaultThemeLocked ? "Animated backgrounds always use dark theme" : "Use dark theme"}
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
                  min="0"
                  max="1"
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

              <label className="settings-field">
                <span>Tile card shape</span>
                <select
                  value={appSettings.tileCardShape}
                  onChange={(e)=>updateSetting("tileCardShape", e.target.value)}
                >
                  <option value="square">Square</option>
                  <option value="circle">Circle</option>
                </select>
              </label>
              <div className="settings-section-title">Background Colors</div>

              <label className="settings-field animated-theme-field">
                <span>Animating theme</span>
                <select
                  value={appSettings.animationBackgroundTheme || "static"}
                  onChange={(e)=>updateSetting("animationBackgroundTheme", e.target.value)}
                >
                  {ANIMATED_BACKGROUND_OPTIONS.map((option)=>(
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <fieldset className="background-color-fieldset" disabled={!isStaticBackgroundTheme}>
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
              </fieldset>

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

              <div className="settings-notification-row">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={appSettings.soundEnabled}
                    onChange={(e)=>updateSetting("soundEnabled", e.target.checked)}
                  />
                  <span>Reminder sounds</span>
                </label>

                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={appSettings.backgroundNotificationsEnabled !== false}
                    onChange={(e)=>void handleBackgroundNotificationsChange(e.target.checked)}
                  />
                  <span>
                    Email reminders
                    <small>Sends due reminder messages to your registered email address.</small>
                  </span>
                </label>
              </div>

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
                <button type="button" className="settings-reset-btn" onClick={()=>setShowSettingsResetConfirm(true)}>
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
                  <label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Confirm PIN"
                      value={confirmHidePinDraft}
                      maxLength={4}
                      disabled={Date.now() < hidePinPasswordAttempts.lockedUntil}
                      onChange={(e)=>{
                        const nextValue = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setConfirmHidePinDraft(nextValue);
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

        {showSettingsResetConfirm && (
          <div className="confirm-overlay settings-reset-confirm-overlay" onClick={closeSettingsResetConfirm}>
            <div
              className="confirm-dialog settings-reset-confirm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-reset-confirm-title"
              aria-describedby="settings-reset-confirm-description"
              onClick={(event)=>event.stopPropagation()}
            >
              <h3 id="settings-reset-confirm-title">Reset settings?</h3>
              <p id="settings-reset-confirm-description">
                This will restore your {deviceProfile === "mobile" ? "mobile" : "desktop"} settings to the default values.
              </p>
              <div className="confirm-actions settings-reset-confirm-actions">
                <button type="button" className="cancel-delete-btn" onClick={closeSettingsResetConfirm} disabled={isSettingsResetting}>
                  Cancel
                </button>
                <button type="button" className="settings-reset-confirm-btn" onClick={handleSettingsReset} disabled={isSettingsResetting}>
                  {isSettingsResetting ? "Resetting..." : "Reset settings"}
                </button>
              </div>
            </div>
          </div>
        )}

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
