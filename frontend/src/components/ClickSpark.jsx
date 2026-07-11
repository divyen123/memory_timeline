import { useCallback, useEffect, useRef } from "react";
import "./ClickSpark.css";

const ClickSpark = ({
  sparkColor = "#fff",
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = "ease-out",
  extraScale = 1,
  children
}) => {
  const canvasRef = useRef(null);
  const sparksRef = useRef([]);
  const startTimeRef = useRef(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reduceMotionRef.current = mediaQuery.matches;
      if(mediaQuery.matches){
        sparksRef.current = [];
      }
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas){
      return undefined;
    }

    let resizeTimeout;

    const resizeCanvas = () => {
      const width = window.innerWidth || document.documentElement.clientWidth || 1;
      const height = window.innerHeight || document.documentElement.clientHeight || 1;
      const pixelRatio = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(width * pixelRatio));
      const nextHeight = Math.max(1, Math.round(height * pixelRatio));

      if(canvas.width !== nextWidth || canvas.height !== nextHeight){
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(resizeCanvas, 100);
    };

    resizeCanvas();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  const easeFunc = useCallback(
    (time) => {
      switch(easing){
        case "linear":
          return time;
        case "ease-in":
          return time * time;
        case "ease-in-out":
          return time < 0.5 ? 2 * time * time : -1 + (4 - 2 * time) * time;
        default:
          return time * (2 - time);
      }
    },
    [easing]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas){
      return undefined;
    }

    const context = canvas.getContext("2d");
    let animationId;

    const draw = (timestamp) => {
      if(!startTimeRef.current){
        startTimeRef.current = timestamp;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);

      if(!reduceMotionRef.current){
        const pixelRatio = window.devicePixelRatio || 1;

        sparksRef.current = sparksRef.current.filter((spark) => {
          const elapsed = timestamp - spark.startTime;
          if(elapsed >= duration){
            return false;
          }

          const progress = elapsed / duration;
          const eased = easeFunc(progress);
          const distance = eased * sparkRadius * extraScale * pixelRatio;
          const lineLength = sparkSize * (1 - eased) * pixelRatio;
          const x1 = spark.x + distance * Math.cos(spark.angle);
          const y1 = spark.y + distance * Math.sin(spark.angle);
          const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
          const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

          context.strokeStyle = sparkColor;
          context.lineWidth = 2 * pixelRatio;
          context.lineCap = "round";
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();

          return true;
        });
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [sparkColor, sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  const handleClick = (event) => {
    const canvas = canvasRef.current;
    if(!canvas || reduceMotionRef.current){
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const x = event.clientX * pixelRatio;
    const y = event.clientY * pixelRatio;
    const now = performance.now();

    const newSparks = Array.from({ length:sparkCount }, (_, index) => ({
      x,
      y,
      angle:(2 * Math.PI * index) / sparkCount,
      startTime:now
    }));

    sparksRef.current.push(...newSparks);
  };

  return (
    <div className="click-spark" onClick={handleClick}>
      <canvas ref={canvasRef} className="click-spark-canvas" aria-hidden="true" />
      {children}
    </div>
  );
};

export default ClickSpark;
