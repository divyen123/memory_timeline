import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { loadSettings } from "./settings";
import { syncInstalledAppThemeColor } from "./installedAppTheme";

syncInstalledAppThemeColor(loadSettings());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if("serviceWorker" in navigator && window.isSecureContext){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/memory-timeline-sw.js", {scope:"/"})
      .catch((error)=>console.warn("Push service worker registration failed", error));
  });
}