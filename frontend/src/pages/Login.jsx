import React,{Suspense,useCallback,useEffect,useRef,useState} from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

const LoginIntroMotion = React.lazy(()=>import("../components/LoginIntroMotion"));

function Login(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [message,setMessage] = useState("");
const [showIntro,setShowIntro] = useState(false);
const introCompletedRef = useRef(false);

const navigate = useNavigate();

const finishIntro = useCallback(() => {
  if(introCompletedRef.current){
    return;
  }

  introCompletedRef.current = true;
  navigate("/timeline");
}, [navigate]);

const handleLogin = async () => {

  try {

    const res = await loginUser({ email, password });

    localStorage.setItem("token", res.data.token);   // IMPORTANT

    introCompletedRef.current = false;
    setShowIntro(true);

  } catch (err) {

    setMessage(err.response?.data?.message || "Login failed");

  }

};

useEffect(() => {
  if(!showIntro){
    return;
  }

  const timer = setTimeout(() => {
    finishIntro();
  }, 3800);

  return () => clearTimeout(timer);
}, [finishIntro, showIntro]);

return(

<div className="login-page">

{showIntro && (
  <Suspense fallback={<div className="login-intro-overlay" />}>
    <LoginIntroMotion onComplete={finishIntro} />
  </Suspense>
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
