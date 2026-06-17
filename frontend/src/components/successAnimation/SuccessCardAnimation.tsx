import { useMemo } from "react";
import type { CSSProperties } from "react";
import { createSuccessParticles, type SuccessMode, type SuccessParticle } from "./particles";

type SuccessCardAnimationProps = {
  mode:SuccessMode;
  title:string;
  imageUrl:string;
  visible:boolean;
};

const particleStyle = (particle:SuccessParticle) => ({
  "--x":`${particle.x}px`,
  "--y":`${particle.y}px`,
  "--r":`${particle.rotation}deg`,
  "--delay":`${particle.delay}s`,
  "--particle-color":particle.color
} as CSSProperties);

function SuccessCardAnimation({mode, title, imageUrl, visible}:SuccessCardAnimationProps) {
  const particles = useMemo(
    ()=>createSuccessParticles(title || "memory", mode),
    [mode, title]
  );

  if(!visible){
    return null;
  }

  return (
    <div className={`success-card-animation ${mode}`} aria-hidden="true">
      <div className="success-card-preview">
        <div className="success-card-glow" />
        <div className="success-card-image">
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <div className="success-card-placeholder" />
          )}
        </div>
        <div className="success-card-copy">
          <span>{title || "Untitled memory"}</span>
        </div>

        <div className="success-particles">
          {particles.sparkles.map((particle)=>(
            <span
              key={particle.id}
              className="success-sparkle"
              style={particleStyle(particle)}
            />
          ))}
          {particles.confetti.map((particle)=>(
            <span
              key={particle.id}
              className="success-confetti"
              style={particleStyle(particle)}
            />
          ))}
        </div>
      </div>

      <div className="success-card-label">
        {mode === "create" ? "Memory added!" : "Memory updated!"}
      </div>
    </div>
  );
}

export default SuccessCardAnimation;
