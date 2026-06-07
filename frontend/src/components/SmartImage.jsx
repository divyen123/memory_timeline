import React, { useState } from "react";

const facePositionCache = new Map();

function getFallbackPosition(image) {
  const { naturalWidth, naturalHeight } = image;

  if(!naturalWidth || !naturalHeight){
    return "50% 35%";
  }

  const ratio = naturalHeight / naturalWidth;

  if(ratio > 1.18){
    return "50% 0%";
  }

  if(ratio > 0.95){
    return "50% 12%";
  }

  return "50% 32%";
}

function getFacePosition(face, image) {
  const box = face.boundingBox;
  const x = ((box.x + box.width / 2) / image.naturalWidth) * 100;
  const y = ((box.y + box.height * 0.45) / image.naturalHeight) * 100;

  return `${Math.min(85, Math.max(15, x)).toFixed(1)}% ${Math.min(48, Math.max(0, y)).toFixed(1)}%`;
}

function SmartImage({ src, alt, className = "", style, ...props }) {
  const [objectPosition, setObjectPosition] = useState(facePositionCache.get(src) || "50% 35%");

  const handleLoad = async (event) => {
    const image = event.currentTarget;
    const fallbackPosition = getFallbackPosition(image);

    if(facePositionCache.has(src)){
      setObjectPosition(facePositionCache.get(src));
      return;
    }

    setObjectPosition(fallbackPosition);

    try{
      if(!("FaceDetector" in window)){
        facePositionCache.set(src, fallbackPosition);
        return;
      }

      const detector = new window.FaceDetector({
        fastMode:true,
        maxDetectedFaces:6
      });
      const faces = await detector.detect(image);

      if(!faces.length){
        facePositionCache.set(src, fallbackPosition);
        return;
      }

      const mainFace = faces.reduce((largest, face) => {
        const largestArea = largest.boundingBox.width * largest.boundingBox.height;
        const faceArea = face.boundingBox.width * face.boundingBox.height;
        return faceArea > largestArea ? face : largest;
      }, faces[0]);
      const detectedPosition = getFacePosition(mainFace, image);

      facePositionCache.set(src, detectedPosition);
      setObjectPosition(detectedPosition);
    }catch{
      facePositionCache.set(src, fallbackPosition);
      setObjectPosition(fallbackPosition);
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      className={`smart-image ${className}`.trim()}
      style={{
        ...style,
        objectPosition
      }}
      onLoad={handleLoad}
      {...props}
    />
  );
}

export default SmartImage;
