import React from "react";

function PinIcon({ filled = false, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={`pin-icon ${filled ? "is-filled" : ""} ${className}`.trim()}
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path
        className="pin-icon-head"
        d="M8.2 3.5h7.6l-1.35 5.25 2.55 2.6v1.15H7v-1.15l2.55-2.6L8.2 3.5Z"
      />
      <path d="M12 12.5v8" />
    </svg>
  );
}

export default PinIcon;
