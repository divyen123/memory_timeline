import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import IntroForeground from "./IntroForeground";
import "./intro.css";

type IntroStageProps = {
  onComplete: () => void;
};

function IntroStage({onComplete}: IntroStageProps){
  const reducedMotion = Boolean(useReducedMotion());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completeRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(reducedMotion);
  const [finishing, setFinishing] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  const finish = useCallback(() => {
    if(completeRef.current){
      return;
    }

    completeRef.current = true;
    setFinishing(true);
    window.setTimeout(onComplete, reducedMotion ? 180 : 520);
  }, [onComplete, reducedMotion]);

  useEffect(() => {
    const skipTimer = window.setTimeout(() => setShowSkip(true), 1500);
    return () => window.clearTimeout(skipTimer);
  }, []);

  useEffect(() => {
    if(reducedMotion){
      const timer = window.setTimeout(finish, 1500);
      return () => window.clearTimeout(timer);
    }

    fallbackTimerRef.current = window.setTimeout(finish, 12000);

    return () => {
      if(fallbackTimerRef.current){
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [finish, reducedMotion]);

  const markReady = () => {
    setReady(true);
    const video = videoRef.current;
    if(video && video.paused){
      video.play().catch(() => {
        window.setTimeout(finish, 2200);
      });
    }
  };

  const handleVideoError = () => {
    setReady(true);
    window.setTimeout(finish, 2200);
  };

  return (
    <motion.div
      className="login-intro-overlay mt-intro-stage"
      role="status"
      aria-live="polite"
      initial={{opacity: 1}}
      animate={{opacity: finishing ? 0 : 1}}
      transition={{duration: reducedMotion ? 0.18 : 0.5, ease: "easeOut"}}
    >
      <div className="mt-intro-poster" aria-hidden="true" />

      {!reducedMotion && (
        <video
          ref={videoRef}
          className="mt-intro-video"
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/memory-timeline-icon.svg"
          onCanPlay={markReady}
          onLoadedData={markReady}
          onPlay={() => setReady(true)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onEnded={finish}
          onError={handleVideoError}
        >
          <source src="/videos/Vlog_Intro.webm" type="video/webm" />
          <source src="/videos/Vlog_Intro.mp4" type="video/mp4" />
          <source src="/videos/Vlog%20Intro.mp4" type="video/mp4" />
        </video>
      )}

      <div className="mt-intro-scrim" aria-hidden="true" />
      <div className="mt-intro-tint" aria-hidden="true" />
      <div className="mt-intro-grain" aria-hidden="true" />

      <IntroForeground
        currentTime={currentTime}
        ready={ready}
        reducedMotion={reducedMotion}
      />

      <AnimatePresence>
        {showSkip && !finishing && (
          <motion.button
            type="button"
            className="mt-intro-skip"
            onClick={finish}
            aria-label="Skip intro"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 0.72, y: 0}}
            exit={{opacity: 0, y: 8}}
            whileHover={{opacity: 1, scale: 1.03}}
            whileTap={{scale: 0.97}}
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default IntroStage;
