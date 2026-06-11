import { useEffect } from "react";

const TOAST_DISMISS_MS = 3500;

export default function useAutoDismissMessage(message, setMessage, delay = TOAST_DISMISS_MS) {
  useEffect(() => {
    if(!message){
      return undefined;
    }

    const timer = setTimeout(() => {
      setMessage("");
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, message, setMessage]);
}
