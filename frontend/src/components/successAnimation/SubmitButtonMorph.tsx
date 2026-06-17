type SubmitButtonState = "idle" | "loading" | "success" | "error";

type SubmitButtonMorphProps = {
  label:string;
  state:SubmitButtonState;
  disabled?:boolean;
};

function SubmitButtonMorph({label, state, disabled = false}:SubmitButtonMorphProps) {
  return (
    <button
      type="submit"
      className={`submit-morph-btn ${state}`}
      disabled={disabled}
      aria-busy={state === "loading"}
    >
      {state === "loading" && <span className="submit-spinner" aria-hidden="true" />}

      {state === "success" && (
        <span className="submit-check" aria-hidden="true">
          <svg viewBox="0 0 36 36" role="presentation">
            <path className="submit-check-path" d="M9 19.5l6.2 6.1L27.5 10.5" />
          </svg>
        </span>
      )}

      {state === "error" && (
        <span className="submit-error-mark" aria-hidden="true">
          !
        </span>
      )}

      {state === "idle" && (
        <span className="submit-morph-label">
          {label}
        </span>
      )}

      <span className="sr-only">
        {state === "loading" ? "Saving memory" : state === "success" ? "Memory saved" : state === "error" ? "Memory save failed" : label}
      </span>
    </button>
  );
}

export default SubmitButtonMorph;
