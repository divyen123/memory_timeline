import React,{useState} from "react";
import { useNavigate } from "react-router-dom";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { requestResetCode, resetPassword } from "../services/api";

function ForgotPassword(){

const [email,setEmail] = useState("");
const [code,setCode] = useState("");
const [password,setPassword] = useState("");
const [confirmPassword,setConfirmPassword] = useState("");
const [message,setMessage] = useState("");
const [codeSent,setCodeSent] = useState(false);

const navigate = useNavigate();

useAutoDismissMessage(message, setMessage);

const handleRequestCode = async (e) => {

  e.preventDefault();

  try {

    const res = await requestResetCode({ email });

    setCodeSent(true);
    setMessage(res.data.devCode
      ? `Verification code: ${res.data.devCode}`
      : "Verification code sent");

  } catch (err) {

    setMessage(err.response?.data?.message || "Could not generate verification code");

  }

};

const handleResetPassword = async (e) => {

  e.preventDefault();

  if(password !== confirmPassword){
    setMessage("Passwords do not match");
    return;
  }

  try {

    await resetPassword({ email, code, password });

    setMessage("Password reset successfully");

    setTimeout(()=>{
      navigate("/");
    },1200);

  } catch (err) {

    setMessage(err.response?.data?.message || "Password reset failed");

  }

};

return(

<div className="glass-card">

<h2>Forgot Password</h2>

{message && (
  <div className="toast">
    {message}
  </div>
)}

<form onSubmit={codeSent ? handleResetPassword : handleRequestCode}>

<input
type="email"
placeholder="Registered Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
required
disabled={codeSent}
/>

{codeSent && (
  <>
    <input
    type="text"
    placeholder="Verification Code"
    value={code}
    onChange={(e)=>setCode(e.target.value)}
    required
    />

    <input
    type="password"
    placeholder="New Password"
    value={password}
    onChange={(e)=>setPassword(e.target.value)}
    required
    />

    <input
    type="password"
    placeholder="Confirm New Password"
    value={confirmPassword}
    onChange={(e)=>setConfirmPassword(e.target.value)}
    required
    />
  </>
)}

<button type="submit">
{codeSent ? "Reset Password" : "Get Verification Code"}
</button>

<button
type="button"
className="timeline-btn"
onClick={()=>navigate("/")}
>
Back to Login
</button>

</form>

</div>

);

}

export default ForgotPassword;
