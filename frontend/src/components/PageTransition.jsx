import { useEffect, useState } from "react";

function PageTransition({ children }) {

  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(()=>setShow(true),10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`page ${show ? "page-show" : ""}`}>
      {children}
    </div>
  );
}

export default PageTransition;