import React from "react";

import "./AnimatedBackground.css";

const BALLS = Array.from({length:34}, (_, index) => ({
  id:index,
  size:18 + (index % 7) * 8,
  left:(index * 29) % 100,
  delay:(index % 9) * -0.65,
  duration:8 + (index % 6) * 0.9,
  hue:(index * 37) % 360
}));

function LiquidAther(){
  return (
    <div className="animated-bg-effect liquid-ather-bg" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

function Ferrofluid(){
  return (
    <div className="animated-bg-effect ferrofluid-bg" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function Darkveil(){
  return (
    <div className="animated-bg-effect darkveil-bg" aria-hidden="true">
      <span />
    </div>
  );
}

function Ballpit(){
  return (
    <div className="animated-bg-effect ballpit-bg" aria-hidden="true">
      {BALLS.map((ball)=>(
        <span
          key={ball.id}
          style={{
            "--ball-size":`${ball.size}px`,
            "--ball-left":`${ball.left}%`,
            "--ball-delay":`${ball.delay}s`,
            "--ball-duration":`${ball.duration}s`,
            "--ball-color":`hsl(${ball.hue} 88% 68%)`
          }}
        />
      ))}
    </div>
  );
}

export function SoftAuroraBackground(){
  return (
    <div className="animated-bg-effect soft-aurora-bg" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function AnimatedBackground({theme = "static", variant = "app"}){
  if(theme === "static"){
    return null;
  }

  const content = {
    liquidAther:<LiquidAther />,
    ferrofluid:<Ferrofluid />,
    darkveil:<Darkveil />,
    ballpit:<Ballpit />,
    softAurora:<SoftAuroraBackground />
  }[theme];

  if(!content){
    return null;
  }

  return <div className={`animated-background-shell ${variant}`}>{content}</div>;
}
