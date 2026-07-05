import React,{Suspense,useCallback,useEffect,useRef,useState} from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { completeOnboarding, getSession, loginUser, refreshSession, registerUser, updateProfile } from "../services/api";
import OnboardingTour from "../components/OnboardingTour";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { setAuthenticatedUser } from "../auth";
import LoginCard from "../components/LoginCard";
import RegisterCard from "../components/RegisterCard";
import { loadBackgroundPreference } from "../settings";

const LoginIntroMotion = React.lazy(()=>import("../components/LoginIntroMotion"));
const LOGIN_DESCRIPTION = "Keep every special moment beautifully organized in one place.";
const ACCOUNT_DELETE_MESSAGE_KEY = "memory-account-delete-message";

const normalizeHexColor = (color = "") => {
  const value = String(color).replace("#", "").trim();

  if(/^[0-9a-f]{3}$/i.test(value)){
    return value.split("").map((character)=>character + character).join("");
  }

  return /^[0-9a-f]{6}$/i.test(value) ? value : "";
};

const getHexLuminance = (color) => {
  const normalized = normalizeHexColor(color);

  if(!normalized){
    return 0.4;
  }

  const channels = [0, 2, 4].map((start) => {
    const value = parseInt(normalized.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
};

const getBackgroundStyle = (preference) => {
  if(preference.type === "image" && preference.path){
    return {
      backgroundImage:`linear-gradient(135deg, rgba(8,8,24,0.24), rgba(8,8,24,0.34)), url(${preference.path})`
    };
  }

  if(preference.type === "color" && preference.value){
    return {
      background:preference.value
    };
  }

  return {
    background:`linear-gradient(135deg, ${preference.start || "#f857a6"}, ${preference.middle || "#c850c0"}, ${preference.end || "#4158d0"})`
  };
};

const getBackgroundLuminance = (preference) => {
  if(preference.type === "color"){
    return getHexLuminance(preference.value);
  }

  const colors = [preference.start, preference.middle, preference.end].filter(Boolean);

  if(!colors.length){
    return 0.4;
  }

  return colors.reduce((total, color)=>total + getHexLuminance(color), 0) / colors.length;
};

const FIRST_PROFILE_PHOTO_MAX_SOURCE_SIZE = 8 * 1024 * 1024;
const FIRST_PROFILE_PHOTO_SIZE = 360;
const FIRST_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const loadFirstProfileImage = (file) => new Promise((resolve, reject) => {
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

const compressFirstProfilePhoto = async(file) => {
  if(!FIRST_PROFILE_PHOTO_TYPES.has(file.type)){
    throw new Error("Choose a JPG, PNG, or WebP image");
  }

  if(file.size > FIRST_PROFILE_PHOTO_MAX_SOURCE_SIZE){
    throw new Error("Profile photo must be under 8 MB");
  }

  const image = await loadFirstProfileImage(file);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const cropSize = Math.min(imageWidth, imageHeight);
  const sourceX = (imageWidth - cropSize) / 2;
  const sourceY = (imageHeight - cropSize) / 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = FIRST_PROFILE_PHOTO_SIZE;
  canvas.height = FIRST_PROFILE_PHOTO_SIZE;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, FIRST_PROFILE_PHOTO_SIZE, FIRST_PROFILE_PHOTO_SIZE);
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, FIRST_PROFILE_PHOTO_SIZE, FIRST_PROFILE_PHOTO_SIZE);

  return canvas.toDataURL("image/jpeg", 0.84);
};
function Login(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [message,setMessage] = useState("");
const [authMode,setAuthMode] = useState("login");
const [registerEmail,setRegisterEmail] = useState("");
const [registerPassword,setRegisterPassword] = useState("");
const [registerConfirmPassword,setRegisterConfirmPassword] = useState("");
const [registerErrors,setRegisterErrors] = useState({});
const [registerMessage,setRegisterMessage] = useState("");
const [registerStatus,setRegisterStatus] = useState("idle");
const [showIntro,setShowIntro] = useState(false);
const [introPurpose,setIntroPurpose] = useState("entry");
const [showOnboarding,setShowOnboarding] = useState(false);
const [loginStatus,setLoginStatus] = useState("idle");
const [typedDescription,setTypedDescription] = useState("");
const [showDescriptionCursor,setShowDescriptionCursor] = useState(true);
const [sessionStatus,setSessionStatus] = useState("checking");
const [showFirstProfileSetup,setShowFirstProfileSetup] = useState(false);
const [showFirstWelcome,setShowFirstWelcome] = useState(false);
const [setupName,setSetupName] = useState("");
const [setupAge,setSetupAge] = useState("");
const [setupProfilePhoto,setSetupProfilePhoto] = useState("");
const [setupMessage,setSetupMessage] = useState("");
const [setupStatus,setSetupStatus] = useState("idle");
const [welcomeText,setWelcomeText] = useState("");
const [welcomeComplete,setWelcomeComplete] = useState(false);
const [welcomeStatus,setWelcomeStatus] = useState("idle");
const [showFirstSettingsTip,setShowFirstSettingsTip] = useState(false);
const [settingsTipStatus,setSettingsTipStatus] = useState("idle");
const backgroundPreference = useRef(loadBackgroundPreference()).current;
const backgroundStyle = getBackgroundStyle(backgroundPreference);
const isLightBackground = getBackgroundLuminance(backgroundPreference) > 0.54;
const isPureWhiteBackground = backgroundPreference.type === "color"
  ? normalizeHexColor(backgroundPreference.value) === "ffffff"
  : backgroundPreference.type !== "image" && [backgroundPreference.start, backgroundPreference.middle, backgroundPreference.end]
    .filter(Boolean)
    .every((color)=>normalizeHexColor(color) === "ffffff");
const introCompletedRef = useRef(false);
const onboardingRequiredRef = useRef(false);
const loginStartedRef = useRef(false);
const refreshAbortRef = useRef(null);
const firstProfileNameRef = useRef("");
const setupPhotoInputRef = useRef(null);

const navigate = useNavigate();

useAutoDismissMessage(message, setMessage);
useAutoDismissMessage(registerMessage, setRegisterMessage);

useEffect(() => {
  const accountDeleteMessage = sessionStorage.getItem(ACCOUNT_DELETE_MESSAGE_KEY);

  if(accountDeleteMessage){
    sessionStorage.removeItem(ACCOUNT_DELETE_MESSAGE_KEY);
    setAuthMode("login");
    setMessage(accountDeleteMessage);
  }
}, []);

useEffect(() => {
  let index = 0;
  let cursorBlinkCount = 0;
  let cursorTimer;

  setTypedDescription("");
  setShowDescriptionCursor(true);

  const typingTimer = window.setInterval(() => {
    index += 1;
    setTypedDescription(LOGIN_DESCRIPTION.slice(0, index));

    if(index >= LOGIN_DESCRIPTION.length){
      window.clearInterval(typingTimer);
      cursorTimer = window.setInterval(() => {
        cursorBlinkCount += 1;

        if(cursorBlinkCount >= 6){
          setShowDescriptionCursor(false);
          window.clearInterval(cursorTimer);
        }
      }, 360);
    }
  }, 60);

  return () => {
    window.clearInterval(typingTimer);
    window.clearInterval(cursorTimer);
  };
}, []);

useEffect(() => {
  let active = true;
  const controller = new AbortController();

  refreshAbortRef.current = controller;

  const restoreExistingSession = async() => {
    try{
      const {data} = await getSession({signal:controller.signal});

      if(!active || loginStartedRef.current){
        return;
      }

      setAuthenticatedUser(data.userId, data.token);
      navigate("/timeline", {replace:true});
    }catch{
      try{
        const {data} = await refreshSession({signal:controller.signal});

        if(!active || loginStartedRef.current){
          return;
        }

        setAuthenticatedUser(data.userId, data.token);
        navigate("/timeline", {replace:true});
      }catch{
        if(active && !loginStartedRef.current){
          setSessionStatus("guest");
        }
      }
    }
  };

  restoreExistingSession();

  return () => {
    active = false;
    controller.abort();

    if(refreshAbortRef.current === controller){
      refreshAbortRef.current = null;
    }
  };
}, [navigate]);

const finishIntro = useCallback(() => {
  if(introCompletedRef.current){
    return;
  }

  introCompletedRef.current = true;
  setShowIntro(false);

  if(introPurpose === "entry"){
    return;
  }

  if(onboardingRequiredRef.current){
    setLoginStatus("idle");
    setShowOnboarding(true);
    return;
  }

  navigate("/timeline", {replace:true});
}, [introPurpose, navigate]);

const handleLogin = async () => {
  if(loginStatus === "loading"){
    return;
  }

  setMessage("");
  setLoginStatus("loading");
  loginStartedRef.current = true;
  refreshAbortRef.current?.abort();

  try {

    const res = await loginUser({ email, password });

    setAuthenticatedUser(res.data.userId, res.data.token);

    onboardingRequiredRef.current = Boolean(res.data.onboardingRequired);
    introCompletedRef.current = false;
    setLoginStatus("success");

    setTimeout(() => {
      setIntroPurpose("login");
      setShowIntro(true);
    }, 420);

  } catch (err) {

    setMessage(err.response?.data?.message || "Login failed");
    setLoginStatus("idle");

  }

};

const validateRegisterForm = () => {
  const nextErrors = {};
  const trimmedEmail = registerEmail.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if(!trimmedEmail){
    nextErrors.email = "Email is required.";
  }
  else if(!emailPattern.test(trimmedEmail)){
    nextErrors.email = "Enter a valid email address.";
  }

  if(!registerPassword){
    nextErrors.password = "Password is required.";
  }
  else if(registerPassword.length < 8){
    nextErrors.password = "Password must be at least 8 characters.";
  }

  if(!registerConfirmPassword){
    nextErrors.confirmPassword = "Confirm your password.";
  }
  else if(registerConfirmPassword !== registerPassword){
    nextErrors.confirmPassword = "Passwords do not match.";
  }

  setRegisterErrors(nextErrors);
  return Object.keys(nextErrors).length === 0;
};

const handleRegisterSubmit = async () => {
  if(registerStatus === "loading"){
    return;
  }

  setRegisterMessage("");

  if(!validateRegisterForm()){
    return;
  }

  setRegisterStatus("loading");

  try{
    const trimmedEmail = registerEmail.trim();

    await registerUser({email:trimmedEmail, password:registerPassword});

    setEmail(trimmedEmail);
    setPassword("");
    setRegisterPassword("");
    setRegisterConfirmPassword("");
    setRegisterErrors({});
    setRegisterStatus("idle");
    setAuthMode("login");
    setMessage("Account created successfully. Please log in.");
  }
  catch(err){
    setRegisterMessage(err.response?.data?.message || "Registration failed");
    setRegisterStatus("idle");
  }
};

const showRegisterForm = () => {
  setMessage("");
  setRegisterMessage("");
  setRegisterErrors({});
  setRegisterEmail(email);
  setAuthMode("register");
};

const showLoginForm = () => {
  setRegisterMessage("");
  setRegisterErrors({});
  setAuthMode("login");
};

const handleFirstProfilePhotoSelect = async(event) => {
  const file = event.target.files?.[0];

  if(!file){
    return;
  }

  setSetupMessage("");

  try{
    const nextProfilePhoto = await compressFirstProfilePhoto(file);
    setSetupProfilePhoto(nextProfilePhoto);
  }
  catch(err){
    setSetupMessage(err.message || "Could not prepare that photo");
  }
  finally{
    event.target.value = "";
  }
};

const handleFirstProfileSubmit = async(event) => {
  event.preventDefault();

  if(setupStatus === "loading"){
    return;
  }

  const trimmedName = setupName.trim();
  const parsedAge = Number(setupAge);

  if(!trimmedName){
    setSetupMessage("Enter your name to continue.");
    return;
  }

  if(!setupAge || !Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120){
    setSetupMessage("Enter a valid age to continue.");
    return;
  }

  setSetupMessage("");
  setSetupStatus("loading");

  try{
    const res = await updateProfile({
      name:trimmedName,
      age:parsedAge,
      email:email.trim(),
      profilePhoto:setupProfilePhoto
    });

    firstProfileNameRef.current = res.data?.name || trimmedName;
    setSetupStatus("idle");
    setShowFirstProfileSetup(false);
    setShowFirstWelcome(true);
  }
  catch(err){
    setSetupMessage(err.response?.data?.message || "Profile setup failed");
    setSetupStatus("idle");
  }
};

const handleFirstWelcomeDone = async() => {
  if(welcomeStatus === "loading" || !welcomeComplete){
    return;
  }

  setShowFirstWelcome(false);
  setShowFirstSettingsTip(true);
};

const handleFirstSettingsTipDone = async() => {
  if(settingsTipStatus === "loading"){
    return;
  }

  setSettingsTipStatus("loading");

  try{
    await completeOnboarding();
    onboardingRequiredRef.current = false;
    setShowFirstSettingsTip(false);
    navigate("/timeline", {replace:true});
  }
  catch(err){
    setSetupMessage(err.response?.data?.message || "Could not finish intro. Please try again.");
    setSettingsTipStatus("idle");
  }
};

const handleOnboardingComplete = () => {
  setShowOnboarding(false);
  setSetupName("");
  setSetupAge("");
  setSetupProfilePhoto("");
  setSetupMessage("");
  setSetupStatus("idle");
  setShowFirstSettingsTip(false);
  setSettingsTipStatus("idle");
  setShowFirstProfileSetup(true);
};

useEffect(() => {
  if(!showFirstWelcome){
    return;
  }

  const profileName = firstProfileNameRef.current || setupName.trim() || "there";
  const fullText = `Hii ${profileName}, your Memory Timeline is ready. Add special moments, attach photos, set reminders, mark favorites, hide private memories with your PIN, and share beautiful memories whenever you want.`;
  let index = 0;

  setWelcomeText("");
  setWelcomeComplete(false);
  setWelcomeStatus("idle");

  const timer = window.setInterval(() => {
    index += 1;
    setWelcomeText(fullText.slice(0, index));

    if(index >= fullText.length){
      setWelcomeComplete(true);
      window.clearInterval(timer);
    }
  }, 32);

  return () => window.clearInterval(timer);
}, [setupName, showFirstWelcome]);
useEffect(() => {
  if(!showIntro){
    return;
  }

  // Remotion's onEnded callback controls normal navigation. This is only a
  // recovery path in case playback is interrupted by a browser-level issue.
  const timer = setTimeout(() => {
    finishIntro();
  }, 6500);

  return () => clearTimeout(timer);
}, [finishIntro, showIntro]);

if(sessionStatus === "checking"){
  return <div className="route-loading" aria-live="polite">Loading...</div>;
}

return(

<div
  className={`login-page split-login-page ${isLightBackground ? "login-contrast-light" : "login-contrast-dark"} ${isPureWhiteBackground ? "login-pure-white" : ""}`}
  style={backgroundStyle}
>

{showIntro && (
  <Suspense fallback={<div className="login-intro-overlay" />}>
    <LoginIntroMotion onComplete={finishIntro} />
  </Suspense>
)}

{showOnboarding && (
  <OnboardingTour onComplete={handleOnboardingComplete} />
)}

{showFirstProfileSetup && (
  <div className="first-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="first-profile-title">
    <form className="first-profile-card" onSubmit={handleFirstProfileSubmit}>
      <p className="first-profile-kicker">One last touch</p>
      <h2 id="first-profile-title">Set up your profile</h2>
      <p className="first-profile-copy">This helps your timeline feel personal from the first moment.</p>

      <div className="first-profile-avatar-picker">
        <button
          type="button"
          className="first-profile-avatar"
          onClick={()=>setupPhotoInputRef.current?.click()}
          aria-label="Upload profile photo"
        >
          {setupProfilePhoto ? <img src={setupProfilePhoto} alt="Profile preview" /> : <span>{setupName.trim().charAt(0).toUpperCase() || "D"}</span>}
        </button>
        <button type="button" className="first-profile-photo-button" onClick={()=>setupPhotoInputRef.current?.click()}>
          {setupProfilePhoto ? "Change photo" : "Upload photo"}
        </button>
        {setupProfilePhoto && (
          <button type="button" className="first-profile-remove" onClick={()=>setSetupProfilePhoto("")}>Remove</button>
        )}
        <input
          ref={setupPhotoInputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFirstProfilePhotoSelect}
        />
      </div>

      <div className="first-profile-grid">
        <label className="first-profile-field">
          <span>Name</span>
          <input value={setupName} onChange={(event)=>setSetupName(event.target.value)} placeholder="Your name" autoComplete="name" />
        </label>
        <label className="first-profile-field">
          <span>Age</span>
          <input value={setupAge} onChange={(event)=>setSetupAge(event.target.value)} placeholder="Your age" inputMode="numeric" />
        </label>
      </div>

      {setupMessage && <p className="first-profile-message" role="alert">{setupMessage}</p>}

      <button className="first-profile-primary" type="submit" disabled={setupStatus === "loading"}>
        {setupStatus === "loading" ? "Saving..." : "Done"}
      </button>
    </form>
  </div>
)}

{showFirstWelcome && (
  <div className="first-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="first-welcome-title">
    <div className="first-profile-card first-welcome-card">
      <p className="first-profile-kicker">Welcome in</p>
      <h2 id="first-welcome-title">Your space is ready</h2>
      <p className="first-welcome-text">
        {welcomeText}
        {!welcomeComplete && <span className="first-welcome-cursor" aria-hidden="true">|</span>}
      </p>
      {setupMessage && <p className="first-profile-message" role="alert">{setupMessage}</p>}
      <button className="first-profile-primary" type="button" onClick={handleFirstWelcomeDone} disabled={welcomeStatus === "loading" || !welcomeComplete}>
        Done
      </button>
    </div>
  </div>
)}

{showFirstSettingsTip && (
  <div className="first-profile-overlay" role="dialog" aria-modal="true" aria-labelledby="first-settings-tip-title">
    <div className="first-profile-card first-settings-tip-card">
      <p className="first-profile-kicker">Memory view</p>
      <h2 id="first-settings-tip-title">Make it yours</h2>
      <p className="first-settings-tip-text">You can customize your own memory view here.</p>
      {setupMessage && <p className="first-profile-message" role="alert">{setupMessage}</p>}
      <button className="first-profile-primary" type="button" onClick={handleFirstSettingsTipDone} disabled={settingsTipStatus === "loading"}>
        {settingsTipStatus === "loading" ? "Opening..." : "Open timeline"}
      </button>
    </div>
  </div>
)}

<section className="login-brand-panel" aria-label="Memory Timeline introduction">
  <img className="login-logo" src="/memory-timeline-icon.svg" alt="Memory Timeline" />
  <div className="login-brand">
    <h1 className="main-title">Memory Timeline</h1>
    <p className="login-brand-typing">
      <span>{typedDescription}</span>
      {showDescriptionCursor && <i aria-hidden="true">|</i>}
    </p>
  </div>
</section>

<section className="login-form-panel" aria-label="Login">
  {(!showIntro || introPurpose !== "entry") && (
    <AnimatePresence mode="wait" initial={false}>
      {authMode === "login" ? (
        <LoginCard
          key="login"
          email={email}
          password={password}
          message={message}
          status={loginStatus}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={handleLogin}
          onRegister={showRegisterForm}
          onForgotPassword={()=>navigate("/forgot-password")}
        />
      ) : (
        <RegisterCard
          key="register"
          email={registerEmail}
          password={registerPassword}
          confirmPassword={registerConfirmPassword}
          errors={registerErrors}
          message={registerMessage}
          status={registerStatus}
          onEmailChange={setRegisterEmail}
          onPasswordChange={setRegisterPassword}
          onConfirmPasswordChange={setRegisterConfirmPassword}
          onSubmit={handleRegisterSubmit}
          onBackToLogin={showLoginForm}
        />
      )}
    </AnimatePresence>
  )}
</section>

</div>

);

}

export default Login;
