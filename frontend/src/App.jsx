import React,{ useState,useEffect,useRef } from "react";
import { Routes,Route,useNavigate,useLocation } from "react-router-dom";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import AddMemory from "./pages/AddMemory";
import MemoryTimeline from "./pages/MemoryTimeline";
import MemoryDetails from "./pages/MemoryDetails";
import Profile from "./pages/Profile";
import Trash from "./pages/Trash";
import PublicShare from "./pages/PublicShare";
import About from "./pages/About";
import ProtectedRoute from "./components/ProtectedRoute";
import ReminderWidget from "./components/ReminderWidget";
import { getAppearanceSettings, logoutUser, updateAppearanceSettings } from "./services/api";
import {
  AUTH_UPDATED_EVENT,
  clearAuthenticatedUser,
  getAuthenticatedUserId
} from "./auth";
import {
  getDeviceProfile,
  getSettingsStorageKey,
  loadSettings,
  saveSettings,
  SETTINGS_PREVIEW_EVENT,
  SETTINGS_UPDATED_EVENT
} from "./settings";

import "./App.css";

const FONT_SIZE_MAP = {
  small:"14px",
  normal:"16px",
  large:"18px",
  extra:"20px"
};

const FONT_FAMILY_MAP = {
  normal:"'Segoe UI', Arial, sans-serif",
  modern:"Arial, Helvetica, sans-serif",
  rounded:"'Trebuchet MS', 'Segoe UI', sans-serif",
  classic:"Georgia, 'Times New Roman', serif",
  mono:"Consolas, 'Courier New', monospace",
  handwritten:"'Comic Sans MS', 'Segoe Print', cursive",
  italic:"'Segoe UI', Arial, sans-serif"
};

function App(){

  const [deviceProfile,setDeviceProfile] = useState(()=>getDeviceProfile());
  const [settings,setSettings] = useState(()=>loadSettings(deviceProfile));
  const [showLogoutConfirm,setShowLogoutConfirm] = useState(false);
  const [loggingOut,setLoggingOut] = useState(false);
  const [authenticatedUserId,setAuthenticatedUserId] = useState(()=>getAuthenticatedUserId());
  const logoutCancelRef = useRef(null);
  const darkMode = settings.defaultTheme === "dark";

  const navigate = useNavigate();
  const location = useLocation();
  const showLogout = authenticatedUserId &&
    (
      ["/add","/timeline","/profile"].includes(location.pathname) ||
      location.pathname === "/about" ||
      location.pathname === "/trash" ||
      location.pathname.startsWith("/memory/")
    );
  const authPages = ["/", "/forgot-password"];
  const isAuthPage = authPages.includes(location.pathname);
  const isPublicSharePage = location.pathname.startsWith("/share/");
  const showTopButtons = !isAuthPage && !isPublicSharePage;
  const showSharedReminder = !isAuthPage && !isPublicSharePage && !["/timeline", "/about"].includes(location.pathname);

  useEffect(()=>{

    if(darkMode){
      document.body.classList.add("dark");
      document.body.classList.remove("light");
    }
    else{
      document.body.classList.add("light");
      document.body.classList.remove("dark");
    }

    document.body.classList.remove("card-size-small", "card-size-medium", "card-size-large");
    document.body.classList.add(`card-size-${settings.cardSize || "medium"}`);
    document.body.classList.toggle("glass-containers-off", !settings.containerGlass);
    document.body.classList.toggle("button-glass-on", Boolean(settings.buttonGlass));
    document.body.classList.toggle("memory-hover-off", !settings.hoverEnabled);
    document.body.classList.toggle("top-actions-left", settings.topButtonsPosition === "left");
    document.body.classList.remove("top-icons-box", "top-icons-circle", "top-icons-soft", "top-icons-minimal");
    document.body.classList.add(`top-icons-${settings.topButtonsIconStyle || "circle"}`);
    document.body.classList.remove("toolbar-icons-box", "toolbar-icons-circle", "toolbar-icons-separate", "toolbar-icons-pill", "toolbar-icons-soft", "toolbar-icons-minimal");
    document.body.classList.add(`toolbar-icons-${settings.toolbarIconStyle || "box"}`);
    document.body.classList.remove("hearts-slow", "hearts-normal", "hearts-fast", "hearts-fixed");
    document.body.classList.add(`hearts-${settings.heartsSpeed || "normal"}`);

    document.documentElement.style.setProperty("--app-font-size", FONT_SIZE_MAP[settings.fontSize] || FONT_SIZE_MAP.normal);
    document.documentElement.style.setProperty("--app-font-delta", {
      small:"-2px",
      normal:"0px",
      large:"2px",
      extra:"4px"
    }[settings.fontSize] || "0px");
    document.documentElement.style.setProperty("--app-font-weight", settings.fontWeight || "normal");
    document.documentElement.style.setProperty("--app-font-family", FONT_FAMILY_MAP[settings.fontStyle] || FONT_FAMILY_MAP.normal);
    document.documentElement.style.setProperty("--app-font-style", settings.fontStyle === "italic" ? "italic" : "normal");
    document.documentElement.style.setProperty("--top-action-size", `${settings.topButtonsSize || 50}px`);
    const toolbarIconSize = settings.toolbarIconSize || 24;
    const toolbarButtonSize = Math.min(76, Math.max(38, Math.round(toolbarIconSize * 2.25)));
    const toolbarStretch = settings.toolbarButtonStretch ?? 1;
    const toolbarControlGap = Math.min(18, Math.max(8, Math.round(12 * toolbarStretch)));
    const toolbarWideControlGap = Math.min(22, Math.max(9, Math.round(14 * toolbarStretch)));
    document.documentElement.style.setProperty("--toolbar-icon-font-size", `${toolbarIconSize}px`);
    document.documentElement.style.setProperty("--toolbar-button-size", `${toolbarButtonSize}px`);
    document.documentElement.style.setProperty("--toolbar-button-stretch", toolbarStretch);
    document.documentElement.style.setProperty("--toolbar-control-gap", `${toolbarControlGap}px`);
    document.documentElement.style.setProperty("--toolbar-wide-control-gap", `${toolbarWideControlGap}px`);
    document.documentElement.style.setProperty("--memory-card-radius", `${settings.cardBorderRadius ?? 16}px`);
    document.documentElement.style.setProperty("--button-bg-color", settings.buttonBackgroundColor || "#ff4b7d");
    document.documentElement.style.setProperty("--container-glass-alpha", settings.containerGlassAlpha ?? 0.12);
    document.documentElement.style.setProperty("--button-glass-alpha", settings.buttonGlassAlpha ?? 0.18);
    document.documentElement.style.setProperty("--memory-hover-scale", settings.hoverScale ?? 1.05);
    document.documentElement.style.setProperty("--light-gradient-start", settings.lightGradientStart || "#ff7ac6");
    document.documentElement.style.setProperty("--light-gradient-middle", settings.lightGradientMiddle || "#c45cff");
    document.documentElement.style.setProperty("--light-gradient-end", settings.lightGradientEnd || "#7a8cff");
    document.documentElement.style.setProperty("--dark-gradient-start", settings.darkGradientStart || "#0f172a");
    document.documentElement.style.setProperty("--dark-gradient-middle", settings.darkGradientMiddle || "#1e1b4b");
    document.documentElement.style.setProperty("--dark-gradient-end", settings.darkGradientEnd || "#020617");

  },[darkMode, settings]);

  useEffect(()=>{
    const handleAuthUpdated = (event) => {
      setAuthenticatedUserId(event.detail?.userId || getAuthenticatedUserId());
    };

    window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);

    return () => {
      window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated);
    };
  },[]);

  useEffect(()=>{
    const handleSettingsUpdated = (event) => {
      setSettings(event.detail || loadSettings());
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
    window.addEventListener("storage", handleSettingsUpdated);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
      window.removeEventListener("storage", handleSettingsUpdated);
    };
  },[]);

  useEffect(()=>{
    const handleViewportChange = () => {
      const nextProfile = getDeviceProfile();

      if(nextProfile !== deviceProfile){
        setDeviceProfile(nextProfile);
        setSettings(loadSettings(nextProfile));
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  },[deviceProfile]);

  useEffect(()=>{
    const localSettings = loadSettings(deviceProfile);
    const hasLocalSettings = Boolean(localStorage.getItem(getSettingsStorageKey(deviceProfile)));

    if(!authenticatedUserId){
      return;
    }

    let active = true;

    getAppearanceSettings(deviceProfile)
      .then(async({data})=>{
        if(!active){
          return;
        }

        const remoteSettings = data.settings || {};

        if(Object.keys(remoteSettings).length === 0 || (isAuthPage && hasLocalSettings)){
          await updateAppearanceSettings(deviceProfile, localSettings);
          if(active){
            setSettings(saveSettings(localSettings, deviceProfile));
          }
          return;
        }

        setSettings(saveSettings({
          ...localSettings,
          ...remoteSettings
        }, deviceProfile));
      })
      .catch(()=>{});

    return ()=>{
      active = false;
    };
  },[deviceProfile, location.pathname, authenticatedUserId, isAuthPage]);

  const toggleTheme = async() => {
    const nextSettings = saveSettings({
      ...settings,
      defaultTheme:darkMode ? "light" : "dark"
    }, deviceProfile);

    setSettings(nextSettings);

    if(authenticatedUserId){
      try{
        await updateAppearanceSettings(deviceProfile, nextSettings);
      }catch{
        // Keep the immediate local preference; authenticated navigation retries synchronization.
      }
    }
  };

  /* LOGOUT FUNCTION */

  const requestLogout = () => {
    if(loggingOut){
      return;
    }

    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    if(loggingOut){
      return;
    }

    setShowLogoutConfirm(false);
  };

  const handleLogout = () => {
    if(loggingOut){
      return;
    }

    setShowLogoutConfirm(false);
    setLoggingOut(true);

    window.setTimeout(async() => {
      try{
        await logoutUser();
      }catch{
        // Local state is still cleared if the network is interrupted.
      }

      clearAuthenticatedUser();
      setSettings(loadSettings(deviceProfile));
      setLoggingOut(false);
      navigate("/");
    }, 900);

  };

  useEffect(()=>{
    if(!showLogoutConfirm){
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    logoutCancelRef.current?.focus();

    const handleKeyDown = (event) => {
      if(event.key === "Escape"){
        setShowLogoutConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return ()=>{
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  },[showLogoutConfirm]);

  return(

    <div className={`container ${isPublicSharePage ? "public-route-container" : ""}`}>

      {!isPublicSharePage && deviceProfile !== "mobile" && <div className="hearts">
        <span>❤️</span>
        <span>💖</span>
        <span>💕</span>
        <span>💗</span>
        <span>💞</span>
        <span>💓</span>
        <span>💘</span>
        <span>💝</span>
      </div>}

      {/* BUTTON GROUP */}

  {showTopButtons && (
  <div className="top-buttons">

  <button
    className="toggle-btn"
    onClick={toggleTheme}
    title={darkMode ? "Use light theme" : "Use dark theme"}
    aria-label={darkMode ? "Use light theme" : "Use dark theme"}
  >
    {darkMode ? "☀️" : "🌙"}
  </button>

  {showLogout && (
    <button
      className="logout-btn"
      onClick={requestLogout}
      title="Log out"
      aria-label="Log out"
    >
      🔓
    </button>
  )}

</div>
  )}
      {showSharedReminder && <ReminderWidget />}
      {showLogoutConfirm && !loggingOut && (
        <div
          className="logout-confirm-overlay"
          role="presentation"
          onMouseDown={(event)=>{
            if(event.target === event.currentTarget){
              cancelLogout();
            }
          }}
        >
          <section
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
          >
            <div className="logout-confirm-icon" aria-hidden="true">🔓</div>
            <div className="logout-confirm-copy">
              <p>Session</p>
              <h2 id="logout-confirm-title">Log out of Memory Timeline?</h2>
              <span id="logout-confirm-description">
                You will return to the login page. Your memories and settings will remain safely stored.
              </span>
            </div>
            <div className="logout-confirm-actions">
              <button
                ref={logoutCancelRef}
                type="button"
                className="logout-cancel-btn"
                onClick={cancelLogout}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-confirm-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      )}
      {loggingOut && (
        <div className="logout-overlay" role="status" aria-live="polite">
          <div className="logout-card">
            <span className="logout-spinner" />
            <strong>Logging out...</strong>
          </div>
        </div>
      )}
      <Routes>

        <Route path="/" element={<Login />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/share/:token" element={<PublicShare />} />

        <Route path="/add" element={
          <ProtectedRoute>
            <AddMemory />
          </ProtectedRoute>
        } />

        <Route path="/timeline" element={
          <ProtectedRoute>
            <MemoryTimeline />
          </ProtectedRoute>
        } />

        <Route path="/about" element={
          <ProtectedRoute>
            <About />
          </ProtectedRoute>
        } />

        <Route path="/memory/:id" element={
          <ProtectedRoute>
            <MemoryDetails />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        <Route path="/trash" element={
          <ProtectedRoute>
            <Trash />
          </ProtectedRoute>
        } />

      </Routes>

    </div>
  );
}

export default App;
