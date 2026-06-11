import React,{Suspense,useCallback,useEffect,useRef,useState} from "react";
import { useNavigate } from "react-router-dom";
import { completeOnboarding, loginUser } from "../services/api";
import OnboardingTour from "../components/OnboardingTour";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { setAuthenticatedUser } from "../auth";

const LoginIntroMotion = React.lazy(()=>import("../components/LoginIntroMotion"));

function Login(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [message,setMessage] = useState("");
const [showIntro,setShowIntro] = useState(false);
const [showOnboarding,setShowOnboarding] = useState(false);
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

  if(onboardingRequiredRef.current){
    setShowOnboarding(true);
    return;
  }

  navigate("/timeline", {replace:true});
}, [navigate]);

const handleLogin = async () => {

  try {

    const res = await loginUser({ email, password });

    setAuthenticatedUser(res.data.userId);

    onboardingRequiredRef.current = Boolean(res.data.onboardingRequired);
    introCompletedRef.current = false;
    setShowIntro(true);

  } catch (err) {

    setMessage(err.response?.data?.message || "Login failed");

  }

};

const handleOnboardingComplete = async () => {
  await completeOnboarding();
  onboardingRequiredRef.current = false;
  setShowOnboarding(false);
  navigate("/timeline", {replace:true});
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

<div className="glass-card login-card">

<h2>Login</h2>

{message && (
  <div className="toast">
    {message}
  </div>
)}

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>

<div className="login-actions">
  <button onClick={handleLogin}>
  Login
  </button>

  <button
  className="timeline-btn"
  onClick={()=>navigate("/register")}
  >
  Register
  </button>
</div>

<button
className="timeline-btn"
onClick={()=>navigate("/forgot-password")}
>
Forgot Password
</button>

</div>

<div className="login-brand">
  <h1 className="main-title">Memory Timeline</h1>
  <p>Keep every special moment beautifully organized in one place.</p>
</div>

</div>

);

}

export default Login;
