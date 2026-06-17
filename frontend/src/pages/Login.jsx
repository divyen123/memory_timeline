import React,{Suspense,useCallback,useEffect,useRef,useState} from "react";
import { useNavigate } from "react-router-dom";
import { completeOnboarding, loginUser } from "../services/api";
import OnboardingTour from "../components/OnboardingTour";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { setAuthenticatedUser } from "../auth";
import LoginCard from "../components/LoginCard";

const LoginIntroMotion = React.lazy(()=>import("../components/LoginIntroMotion"));

function Login(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [message,setMessage] = useState("");
const [showIntro,setShowIntro] = useState(true);
const [introPurpose,setIntroPurpose] = useState("entry");
const [showOnboarding,setShowOnboarding] = useState(false);
const [loginStatus,setLoginStatus] = useState("idle");
const introCompletedRef = useRef(false);
const onboardingRequiredRef = useRef(false);

const navigate = useNavigate();

useAutoDismissMessage(message, setMessage);

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

<div className="login-page">

{showIntro && (
  <Suspense fallback={<div className="login-intro-overlay" />}>
    <LoginIntroMotion onComplete={finishIntro} />
  </Suspense>
)}

{showOnboarding && (
  <OnboardingTour onComplete={handleOnboardingComplete} />
)}

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

<div className="login-brand">
  <h1 className="main-title">Memory Timeline</h1>
  <p>Keep every special moment beautifully organized in one place.</p>
</div>

</div>

);

}

export default Login;
