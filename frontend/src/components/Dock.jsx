import { Children, isValidElement, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from "framer-motion";
import "./Dock.css";

const DEFAULT_SPRING = {
  mass: 0.16,
  stiffness: 180,
  damping: 14
};

function DockItem({
  children,
  mouseX,
  baseItemSize,
  magnification,
  distance,
  spring
}) {
  const itemRef = useRef(null);
  const mouseDistance = useTransform(mouseX, (pointerX) => {
    const bounds = itemRef.current?.getBoundingClientRect();

    if (!bounds || !Number.isFinite(pointerX)) {
      return distance + 1;
    }

    return pointerX - bounds.left - bounds.width / 2;
  });
  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);

  return (
    <motion.div
      ref={itemRef}
      className="dock-item"
      style={{ width: size, height: size }}
    >
      {children}
    </motion.div>
  );
}

export default function Dock({
  children,
  className = "",
  ariaLabel = "Actions",
  baseItemSize = 48,
  magnification = 68,
  distance = 170,
  spring = DEFAULT_SPRING
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const prefersReducedMotion = useReducedMotion();
  const itemMagnification = prefersReducedMotion ? baseItemSize : magnification;

  return (
    <div
      className={`dock ${className}`.trim()}
      role="toolbar"
      aria-label={ariaLabel}
      onPointerMove={(event) => {
        if (!prefersReducedMotion && event.pointerType === "mouse") {
          mouseX.set(event.clientX);
        }
      }}
      onPointerLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {Children.toArray(children).map((child, index) => (
        isValidElement(child) ? (
          <DockItem
            key={child.key ?? index}
            mouseX={mouseX}
            baseItemSize={baseItemSize}
            magnification={itemMagnification}
            distance={distance}
            spring={spring}
          >
            {child}
          </DockItem>
        ) : child
      ))}
    </div>
  );
}
