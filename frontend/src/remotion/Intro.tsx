import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import { memoryTheme } from "../animationTheme";

const particles = [
  {type: "heart", left: 13, top: 72, delay: 6, size: 22, drift: 72},
  {type: "spark", left: 23, top: 31, delay: 13, size: 16, drift: 58},
  {type: "heart", left: 78, top: 69, delay: 18, size: 18, drift: 64},
  {type: "spark", left: 69, top: 25, delay: 26, size: 15, drift: 54},
  {type: "heart", left: 88, top: 39, delay: 34, size: 26, drift: 70},
  {type: "heart", left: 33, top: 84, delay: 42, size: 19, drift: 60}
];

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const
};

function value(frame: number, input: number[], output: number[]){
  return interpolate(frame, input, output, clamp);
}

function Particle({
  particle,
  frame,
  reducedMotion
}: {
  particle: typeof particles[number];
  frame: number;
  reducedMotion: boolean;
}){
  const lifeFrame = frame - particle.delay;
  const opacity = reducedMotion ? 0 : value(lifeFrame, [0, 14, 68, 88], [0, 0.72, 0.58, 0]);
  const translateY = reducedMotion ? 0 : value(lifeFrame, [0, 88], [0, -particle.drift]);
  const rotate = reducedMotion ? 0 : value(lifeFrame, [0, 88], [-10, 18]);
  const glyph = particle.type === "heart" ? "\u2665" : "\u2726";

  return (
    <span
      style={{
        position: "absolute",
        left: `${particle.left}%`,
        top: `${particle.top}%`,
        color: particle.type === "heart" ? memoryTheme.colors.coralSoft : "#FFD5E2",
        fontSize: particle.size,
        opacity,
        transform: `translate3d(0,${translateY}px,0) rotate(${rotate}deg)`,
        textShadow: "0 0 22px rgba(255,45,110,0.65)"
      }}
    >
      {glyph}
    </span>
  );
}

export default function MemoryTimelineIntro({reducedMotion = false}: {reducedMotion?: boolean}){
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const introOpacity = value(frame, [0, 12], [0, 1]);
  const gradientOpacity = reducedMotion ? value(frame, [0, 24], [0, 1]) : value(frame, [66, 94], [0, 1]);
  const iconScale = reducedMotion ? 0.86 : value(frame, [70, 104], [1, 0.56]);
  const iconY = reducedMotion ? -80 : value(frame, [70, 104], [0, -150]);
  const iconSpring = reducedMotion ? 1 : spring({
    frame: frame - 4,
    fps,
    config: {damping: 14, stiffness: 105, mass: 0.85}
  });
  const heartDraw = reducedMotion ? 1 : value(frame, [6, 24], [0, 1]);
  const heartFill = reducedMotion ? 1 : value(frame, [22, 34], [0, 1]);
  const glowScale = reducedMotion ? 1 : value(frame, [30, 42, 58], [0.92, 1.18, 1]);
  const lineProgress = reducedMotion ? 100 : value(frame, [28, 58], [0, 100]);
  const nodeOne = reducedMotion ? 1 : spring({frame: frame - 44, fps, config: {damping: 10, stiffness: 180}});
  const nodeTwo = reducedMotion ? 1 : spring({frame: frame - 56, fps, config: {damping: 10, stiffness: 180}});
  const copyOpacity = reducedMotion ? value(frame, [10, 24], [0, 1]) : value(frame, [88, 108], [0, 1]);
  const copyY = reducedMotion ? 0 : value(frame, [88, 108], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        opacity: introOpacity,
        background: memoryTheme.gradients.intro,
        overflow: "hidden",
        color: memoryTheme.colors.white,
        fontFamily: "Poppins, Nunito, Segoe UI, sans-serif"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: gradientOpacity,
          background:
            "radial-gradient(circle at 50% 38%,rgba(255,45,110,0.22),transparent 29%), " +
            memoryTheme.gradients.page,
          transform: `translateX(${reducedMotion ? 0 : value(frame, [66, 94], [-16, 0])}%) scale(${reducedMotion ? 1 : value(frame, [66, 94], [1.08, 1])})`
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          opacity: reducedMotion ? 0 : value(frame, [16, 72], [0.16, 0.34]),
          background: "linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.18) 43%,transparent 56%)",
          transform: `translateX(${value(frame, [0, 100], [-34, 32])}%)`
        }}
      />
      {particles.map((particle)=>(
        <Particle
          key={`${particle.type}-${particle.left}-${particle.delay}`}
          particle={particle}
          frame={frame}
          reducedMotion={reducedMotion}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${iconY}px) scale(${iconScale * iconSpring})`,
          transformOrigin: "center center"
        }}
      >
        <div
          style={{
            position: "relative",
            width: 150,
            height: 150,
            borderRadius: 38,
            background: memoryTheme.gradients.icon,
            boxShadow:
              `0 0 44px rgba(255,45,110,${0.22 + heartFill * 0.2}), ` +
              "0 34px 92px rgba(24,18,84,0.38), " +
              "0 0 0 1px rgba(255,255,255,0.25) inset",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <svg width="102" height="102" viewBox="0 0 102 102" aria-hidden="true">
            <defs>
              <linearGradient id="introLineGradient" x1="8" y1="0" x2="94" y2="0">
                <stop offset="0%" stopColor="#FF2D6E" />
                <stop offset="52%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#6C63FF" />
              </linearGradient>
            </defs>
            <path
              d="M51 29 C42 16 19 19 19 39 C19 57 39 67 51 82 C63 67 83 57 83 39 C83 19 60 16 51 29 Z"
              fill={`rgba(255,255,255,${heartFill})`}
              stroke="rgba(255,255,255,0.96)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={1 - heartDraw}
              style={{
                filter: `drop-shadow(0 0 ${14 * glowScale}px rgba(255,45,110,0.62))`,
                transform: `scale(${glowScale})`,
                transformOrigin: "51px 49px"
              }}
            />
            <rect x="12" y="72" width={`${78 * lineProgress / 100}`} height="6" rx="3" fill="url(#introLineGradient)" />
            {[24, 70].map((cx, index)=>(
              <circle
                key={cx}
                cx={cx}
                cy="75"
                r="8"
                fill="#FFFFFF"
                stroke={memoryTheme.colors.coral}
                strokeWidth="4"
                style={{
                  transform: `scale(${index === 0 ? nodeOne : nodeTwo})`,
                  transformOrigin: `${cx}px 75px`
                }}
              />
            ))}
          </svg>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: "58%",
          textAlign: "center",
          opacity: copyOpacity,
          transform: `translateY(${copyY}px)`
        }}
      >
        <h1 style={{margin: 0, fontSize: 56, lineHeight: 1, fontWeight: 800, letterSpacing: -1}}>
          {memoryTheme.appName}
        </h1>
        <p style={{margin: "18px auto 0", maxWidth: 620, fontSize: 19, color: "rgba(255,255,255,0.78)"}}>
          {memoryTheme.tagline}
        </p>
      </div>
    </AbsoluteFill>
  );
}
