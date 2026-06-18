import React,{Suspense,useCallback,useEffect,useRef,useState} from "react";
import { useNavigate } from "react-router-dom";
import { completeOnboarding, loginUser, refreshSession } from "../services/api";
import OnboardingTour from "../components/OnboardingTour";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { setAuthenticatedUser } from "../auth";
import LoginCard from "../components/LoginCard";
import { loadBackgroundPreference } from "../settings";

const LoginIntroMotion = React.lazy(()=>import("../components/LoginIntroMotion"));
const LOGIN_DESCRIPTION = "Keep every special moment beautifully organized in one place.";

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

function Login(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [message,setMessage] = useState("");
const [showIntro,setShowIntro] = useState(false);
const [introPurpose,setIntroPurpose] = useState("entry");
const [showOnboarding,setShowOnboarding] = useState(false);
const [loginStatus,setLoginStatus] = useState("idle");
const [typedDescription,setTypedDescription] = useState("");
const [showDescriptionCursor,setShowDescriptionCursor] = useState(true);
const backgroundPreference = useRef(loadBackgroundPreference()).current;
const backgroundStyle = getBackgroundStyle(backgroundPreference);
const isLightBackground = getBackgroundLuminance(backgroundPreference) > 0.54;
const introCompletedRef = useRef(false);
const onboardingRequiredRef = useRef(false);
const loginStartedRef = useRef(false);
const refreshAbortRef = useRef(null);

const navigate = useNavigate();

useAutoDismissMessage(message, setMessage);

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

  refreshSession({signal:controller.signal})
    .then(({data}) => {
      if(!active || loginStartedRef.current){
        return;
      }

      setAuthenticatedUser(data.userId);
      navigate("/timeline", {replace:true});
    })
    .catch(()=>{});

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

    setAuthenticatedUser(res.data.userId);

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

const handleOnboardingComplete = async () => {
  await completeOnboarding();
  onboardingRequiredRef.current = false;
  setShowOnboarding(false);
  localStorage.setItem("memory-settings-tip-pending", "true");
  navigate("/timeline", {replace:true, state:{showSettingsTip:true}});
};

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

return(

<div
  className={`login-page split-login-page ${isLightBackground ? "login-contrast-light" : "login-contrast-dark"}`}
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
    <LoginCard
      email={email}
      password={password}
      message={message}
      status={loginStatus}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleLogin}
      onRegister={()=>navigate("/register")}
      onForgotPassword={()=>navigate("/forgot-password")}
    />
  )}
</section>

</div>

);

}

export default Login;
