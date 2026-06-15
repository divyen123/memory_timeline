import React, { useEffect, useState } from "react";
import { Player } from "@remotion/player";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

function MemoryTimelineIntro({mobile = false}){
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const markScale = spring({
    frame:frame + 8,
    fps,
    config:{
      damping:12,
      stiffness:90
    }
  });
  const titleOpacity = interpolate(frame, [0, 10], [0.82, 1], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const titleY = interpolate(frame, [0, 22], [8, 0], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const lineProgress = interpolate(frame, [34, 78], [0, 100], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const exitOpacity = interpolate(frame, [108, 120], [1, 0], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const dotFrames = [40, 52, 65, 78];
  const logoRotation = interpolate(frame, [0, 108], [0, 1440], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const logoLift = Math.sin((frame / fps) * Math.PI * 2) * 5;
  const logoY = interpolate(frame, [0, 28], [-44, 0], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });
  const ambientScale = interpolate(frame, [0, 108], [0.88, 1.08], {
    extrapolateLeft:"clamp",
    extrapolateRight:"clamp"
  });

  return (
    <AbsoluteFill
      className={mobile ? "remotion-intro-frame mobile" : "remotion-intro-frame desktop"}
      style={{
        opacity:exitOpacity,
        background:mobile
          ? "radial-gradient(circle at 50% 43%,rgba(255,75,125,0.2),transparent 28%), radial-gradient(circle at 18% 15%,rgba(108,99,255,0.16),transparent 30%), linear-gradient(160deg,#070719 0%,#111033 48%,#17154a 100%)"
          : "radial-gradient(circle at 50% 42%,rgba(255,75,125,0.22),transparent 31%), linear-gradient(135deg,#0a081c,#191848)",
        color:"white",
        alignItems:"center",
        justifyContent:"center",
        overflow:"hidden",
        fontFamily:"Segoe UI, sans-serif"
      }}
    >
      <div className="remotion-intro-sheen" />
      {mobile && (
        <>
          <div className="remotion-intro-ambient top" style={{transform:`scale(${ambientScale})`}} />
          <div className="remotion-intro-ambient bottom" style={{transform:`scale(${ambientScale})`}} />
          <p className="remotion-intro-kicker">Your moments, beautifully kept</p>
        </>
      )}
      <div className="remotion-intro-content">
        <div
          className="remotion-intro-logo-wrap"
          style={{
            transform:`translateY(${logoY + logoLift}px) scale(${markScale}) rotate(${logoRotation}deg)`,
            transformOrigin:"center center",
            willChange:"transform",
            opacity:interpolate(frame, [0, 8], [0.88, 1], {
              extrapolateLeft:"clamp",
              extrapolateRight:"clamp"
            })
          }}
        >
          <div className="remotion-intro-logo">
            <span className="remotion-intro-heart">♥</span>
            <span className="remotion-intro-timeline" />
            <span className="remotion-intro-dot one" />
            <span className="remotion-intro-dot two" />
          </div>
        </div>
        <h1
          className="remotion-intro-title"
          style={{
            opacity:titleOpacity,
            transform:`translateY(${titleY}px)`
          }}
        >
          Memory Timeline
        </h1>
        <p
          className="remotion-intro-subtitle"
          style={{
            opacity:interpolate(frame, [22, 36], [0, 1], {
              extrapolateLeft:"clamp",
              extrapolateRight:"clamp"
            }),
            transform:`translateY(${interpolate(frame, [22, 36], [16, 0], {
              extrapolateLeft:"clamp",
              extrapolateRight:"clamp"
            })}px)`
          }}
        >
          Opening your collection of moments...
        </p>
        <div className="remotion-intro-line">
          <div style={{width:`${lineProgress}%`}} />
          {dotFrames.map((startFrame, index)=>(
            <i
              key={startFrame}
              style={{
                left:`${index * 33.333}%`,
                transform:`translate(-50%,-50%) scale(${interpolate(frame, [startFrame, startFrame + 8], [0, 1], {
                  extrapolateLeft:"clamp",
                  extrapolateRight:"clamp"
                })})`
              }}
            />
          ))}
        </div>
      </div>
      {mobile && <span className="remotion-intro-footer">MEMORIES • STORIES • MOMENTS</span>}
    </AbsoluteFill>
  );
}

function LoginIntroMotion({onComplete}){
  const [mobile,setMobile] = useState(()=>window.matchMedia("(max-width: 760px)").matches);
  const [viewportSize,setViewportSize] = useState(()=>({
    width:window.innerWidth,
    height:window.innerHeight
  }));

  useEffect(()=>{
    const query = window.matchMedia("(max-width: 760px)");
    const handleChange = (event)=>setMobile(event.matches);

    query.addEventListener("change", handleChange);
    return ()=>query.removeEventListener("change", handleChange);
  },[]);

  useEffect(()=>{
    const updateViewportSize = () => {
      setViewportSize({
        width:window.innerWidth,
        height:window.innerHeight
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);

    return ()=>{
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  },[]);

  const compositionWidth = Math.max(mobile ? 320 : 960, Math.round(viewportSize.width));
  const compositionHeight = Math.max(mobile ? 620 : 540, Math.round(viewportSize.height));

  return (
    <div className={`login-intro-overlay ${mobile ? "mobile" : "desktop"}`} role="status" aria-live="polite">
      <Player
        component={MemoryTimelineIntro}
        inputProps={{mobile}}
        durationInFrames={120}
        fps={30}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        autoPlay
        controls={false}
        onEnded={onComplete}
        style={{
          width:"100%",
          height:"100%"
        }}
      />
    </div>
  );
}

export default LoginIntroMotion;
