import React,{useState} from "react";
import { useNavigate } from "react-router-dom";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { registerUser } from "../services/api";

function Register(){

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [confirmPassword,setConfirmPassword] = useState("");
const [message,setMessage] = useState("");

const navigate = useNavigate();

useAutoDismissMessage(message, setMessage);

const handleRegister = async (e) => {

  e.preventDefault();

  if(password !== confirmPassword){
    setMessage("Passwords do not match");
    return;
  }

  try {

    await registerUser({ email, password });

    setMessage("Account created successfully");

    setTimeout(()=>{
      navigate("/");
    },1200);

  } catch (err) {

    setMessage(err.response?.data?.message || "Registration failed");

  }

};

return(

<div className="glass-card">

<h2>Register</h2>

{message && (
  <div className="toast">
    {message}
  </div>
)}

<form onSubmit={handleRegister}>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
required
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
required
/>

<input
type="password"
placeholder="Confirm Password"
value={confirmPassword}
onChange={(e)=>setConfirmPassword(e.target.value)}
required
/>

<button type="submit">
Register
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

export default Register;
