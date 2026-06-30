import React, { useEffect, useRef, useState } from "react";
import { getAuthToken } from "../auth";
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
  const y = ((box.y + box.height / 2) / image.naturalHeight) * 100;

  return `${Math.min(92, Math.max(8, x)).toFixed(1)}% ${Math.min(92, Math.max(8, y)).toFixed(1)}%`;
}

function SmartImage({ src, alt, className = "", style, loading = "lazy", decoding = "async", detectFaces = true, onLoad, onBlobReady, onPositionReady, ...props }) {
  const [objectPosition, setObjectPosition] = useState(facePositionCache.get(src) || "50% 35%");
  const [authenticatedImage, setAuthenticatedImage] = useState({src:"", url:""});
  const onBlobReadyRef = useRef(onBlobReady);

  useEffect(()=>{
    onBlobReadyRef.current = onBlobReady;
  }, [onBlobReady]);

  useEffect(()=>{
    let active = true;
    let objectUrl = "";

    if(!requiresAuthenticatedImageFetch(src)){
      return () => {};
    }

    const token = getAuthToken();

    fetch(src, {
      credentials:"include",
      headers:token ? {Authorization:`Bearer ${token}`} : undefined
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
          onBlobReadyRef.current?.(blob);
          setAuthenticatedImage({src, url:objectUrl});
        }else{
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(()=>{
        if(active){
          setAuthenticatedImage({src, url:""});
        }
      });

    return () => {
      active = false;

      if(objectUrl){
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  const resolvedSrc = requiresAuthenticatedImageFetch(src)
    ? (authenticatedImage.src === src ? authenticatedImage.url : "")
    : src;

  const handleLoad = async (event) => {
    const image = event.currentTarget;
    const fallbackPosition = getFallbackPosition(image);

    onLoad?.(event);

    if(facePositionCache.has(src)){
      const cachedPosition = facePositionCache.get(src);
      setObjectPosition(cachedPosition);
      onPositionReady?.(cachedPosition);
      return;
    }

    setObjectPosition(fallbackPosition);

    try{
      if(!detectFaces || !("FaceDetector" in window)){
        facePositionCache.set(src, fallbackPosition);
        onPositionReady?.(fallbackPosition);
        return;
      }

      const detector = new window.FaceDetector({
        fastMode:true,
        maxDetectedFaces:6
      });
      const faces = await detector.detect(image);

      if(!faces.length){
        facePositionCache.set(src, fallbackPosition);
        onPositionReady?.(fallbackPosition);
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
      onPositionReady?.(detectedPosition);
    }catch{
      facePositionCache.set(src, fallbackPosition);
      setObjectPosition(fallbackPosition);
      onPositionReady?.(fallbackPosition);
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
