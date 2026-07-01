import React, { useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { memoryTheme } from "../animationTheme";
import MemoryTimelineIntro from "../remotion/Intro";

function useReducedMotionPreference(){
  const [reducedMotion, setReducedMotion] = useState(() => (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => setReducedMotion(event.matches);

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

function LoginIntroMotion({onComplete}){
  const reducedMotion = useReducedMotionPreference();
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);

    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  }, []);

  const durationInFrames = reducedMotion
    ? memoryTheme.remotion.reducedMotionFrames
    : memoryTheme.remotion.durationInFrames;
  const isMobileIntro = viewportSize.width <= 760;
  const compositionWidth = Math.max(isMobileIntro ? 360 : 960, Math.round(viewportSize.width));
  const compositionHeight = Math.max(isMobileIntro ? 640 : 540, Math.round(viewportSize.height));

  return (
    <div className={`login-intro-overlay cinematic ${isMobileIntro ? "mobile" : "desktop"}`} role="status" aria-live="polite">
      <Player
        component={MemoryTimelineIntro}
        inputProps={{reducedMotion}}
        durationInFrames={durationInFrames}
        fps={memoryTheme.remotion.fps}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        autoPlay
        controls={false}
        onEnded={onComplete}
        style={{
          width: "100%",
          height: "100%"
        }}
      />
    </div>
  );
}

export default LoginIntroMotion;
