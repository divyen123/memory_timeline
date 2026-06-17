import { AnimatePresence, motion } from "framer-motion";
import { memoryTheme } from "../../animationTheme";

type IntroForegroundProps = {
  currentTime: number;
  ready: boolean;
  reducedMotion: boolean;
};

const START_TIME = 1.2;
const END_TIME = 8.4;

function clamp(value: number, min: number, max: number){
  return Math.min(max, Math.max(min, value));
}

function IntroForeground({currentTime, ready, reducedMotion}: IntroForegroundProps){
  const visible = reducedMotion || (ready && currentTime >= START_TIME && currentTime < END_TIME);
  const progress = reducedMotion
    ? 100
    : clamp(((currentTime - START_TIME) / (END_TIME - START_TIME)) * 100, 0, 100);

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          className="mt-intro-foreground-card"
          initial={reducedMotion ? {opacity: 0} : {opacity: 0, y: 16, scale: 0.96}}
          animate={reducedMotion ? {opacity: 1} : {opacity: 1, y: 0, scale: 1}}
          exit={reducedMotion ? {opacity: 0} : {opacity: 0, scale: 0.96}}
          transition={{duration: 0.5, ease: memoryTheme.motion.easeOut}}
          aria-label="Memory Timeline intro"
        >
          <motion.h1
            initial={reducedMotion ? false : {opacity: 0, y: 16}}
            animate={reducedMotion ? undefined : {opacity: 1, y: 0}}
            transition={{duration: 0.5, ease: memoryTheme.motion.easeOut}}
          >
            {memoryTheme.appName}
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : {opacity: 0, y: 12}}
            animate={reducedMotion ? undefined : {opacity: 1, y: 0}}
            transition={{delay: 0.15, duration: 0.45, ease: memoryTheme.motion.easeOut}}
          >
            {memoryTheme.tagline}
          </motion.p>
          <div className="mt-intro-progress" aria-hidden="true">
            <span style={{width: `${progress}%`}} />
          </div>
          <div className="mt-intro-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

export default IntroForeground;
