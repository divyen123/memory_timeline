import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthenticatedUserId, setAuthenticatedUser } from "../auth";
import { getSession, refreshSession } from "../services/api";

const SESSION_REQUEST_TIMEOUT_MS = 2500;

const withSessionTimeout = (request) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, SESSION_REQUEST_TIMEOUT_MS);

  return request({signal:controller.signal})
    .finally(() => window.clearTimeout(timeoutId));
};
function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status,setStatus] = useState(()=>getAuthenticatedUserId() ? "authenticated" : "checking");

  useEffect(()=>{
    let active = true;
    const hasLocalUser = Boolean(getAuthenticatedUserId());

    const verifySession = async() => {
      try{
        const res = await withSessionTimeout(getSession);
        if(active){
          setAuthenticatedUser(res.data.userId, res.data.token);
          setStatus("authenticated");
        }
      }catch{
        try{
          const res = await withSessionTimeout(refreshSession);
          if(active){
            setAuthenticatedUser(res.data.userId, res.data.token);
            setStatus("authenticated");
          }
        }catch{
          if(active && !hasLocalUser){
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
