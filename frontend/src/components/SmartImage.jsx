import React, { useEffect, useState } from "react";
import { requiresAuthenticatedImageFetch } from "../services/api";

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

function SmartImage({ src, alt, className = "", style, loading = "lazy", decoding = "async", detectFaces = true, onLoad, ...props }) {
  const [objectPosition, setObjectPosition] = useState(facePositionCache.get(src) || "50% 35%");
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(()=>{
    let active = true;
    let objectUrl = "";

    if(!requiresAuthenticatedImageFetch(src)){
      setResolvedSrc(src);
      return () => {};
    }

    setResolvedSrc("");

    fetch(src, {
      credentials:"include"
    })
      .then((response)=>{
        if(!response.ok){
          throw new Error("Image failed");
        }

        return response.blob();
      })
      .then((blob)=>{
        objectUrl = URL.createObjectURL(blob);

        if(active){
          setResolvedSrc(objectUrl);
        }else{
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(()=>{
        if(active){
          setResolvedSrc("");
        }
      });

    return () => {
      active = false;

      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  const handleLoad = async (event) => {
    const image = event.currentTarget;
    const fallbackPosition = getFallbackPosition(image);

    onLoad?.(event);

    if(facePositionCache.has(src)){
      setObjectPosition(facePositionCache.get(src));
      return;
    }

    setObjectPosition(fallbackPosition);

    try{
      if(!detectFaces || !("FaceDetector" in window)){
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
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
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
