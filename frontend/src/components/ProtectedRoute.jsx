import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthenticatedUserId, setAuthenticatedUser } from "../auth";
import { getSession, refreshSession } from "../services/api";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status,setStatus] = useState(()=>getAuthenticatedUserId() ? "checking" : "checking");

  useEffect(()=>{
    let active = true;

    const verifySession = async() => {
      try{
        const res = await getSession();
        if(active){
          setAuthenticatedUser(res.data.userId);
          setStatus("authenticated");
        }
      }catch{
        try{
          const res = await refreshSession();
          if(active){
            setAuthenticatedUser(res.data.userId);
            setStatus("authenticated");
          }
        }catch{
          if(active){
            setStatus("guest");
          }
        }
      }
    };

    verifySession();

    return () => {
      active = false;
    };
  }, []);

  if(status === "checking"){
    return <div className="route-loading" aria-live="polite">Loading...</div>;
  }

  if(status === "guest"){
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default ProtectedRoute;
