import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { memoryTheme } from "../animationTheme";

type RegisterStatus = "idle" | "loading";

type RegisterCardProps = {
  email: string;
  password: string;
  confirmPassword: string;
  errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };
  message: string;
  status: RegisterStatus;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onBackToLogin: () => void;
};

function RegisterCard({
  email,
  password,
  confirmPassword,
  errors,
  message,
  status,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBackToLogin
}: RegisterCardProps){
  const prefersReducedMotion = useReducedMotion();
  const [focusedField, setFocusedField] = useState("");
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 10,
      filter: prefersReducedMotion ? "none" : "blur(6px)"
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: prefersReducedMotion ? 0.16 : 0.3,
        ease: memoryTheme.motion.easeOut,
        when: "beforeChildren",
        staggerChildren: prefersReducedMotion ? 0 : 0.05
      }
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -10,
      filter: prefersReducedMotion ? "none" : "blur(6px)",
      transition: {duration: 0.22, ease: memoryTheme.motion.easeSoft}
    }
  };
  const childVariants = {
    hidden: {opacity: 0, y: prefersReducedMotion ? 0 : 10},
    show: {
      opacity: 1,
      y: 0,
      transition: {duration: prefersReducedMotion ? 0.14 : 0.28, ease: memoryTheme.motion.easeOut}
    }
  };
  const buttonMotion = prefersReducedMotion
    ? {}
    : {
      whileHover: {scale: 1.03, filter: "brightness(1.08)"},
      whileTap: {scale: 0.97},
      transition: memoryTheme.motion.press
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(status !== "loading"){
      onSubmit();
    }
  };

  return (
    <motion.div className="login-live-layer" initial="hidden" animate="show" exit="exit">
      <motion.section
        className="glass-card login-card animated-login-card"
        variants={cardVariants}
        aria-label="Register form"
      >
        <motion.h2 variants={childVariants}>Register</motion.h2>
        {message && (
          <motion.div className="toast login-toast" variants={childVariants}>
            {message}
          </motion.div>
        )}
        <motion.form className="login-motion-form" onSubmit={handleSubmit}>
          <motion.label
            className={`animated-field ${focusedField === "register-email" ? "focused" : ""} ${email ? "filled" : ""}`}
            variants={childVariants}
          >
            <span className="login-field-shell">
              <span className="login-floating-label">Email</span>
              <input
                className="login-motion-input"
                type="email"
                placeholder=" "
                aria-label="Email"
                value={email}
                onFocus={()=>setFocusedField("register-email")}
                onBlur={()=>setFocusedField("")}
                onChange={(event)=>onEmailChange(event.target.value)}
                autoComplete="email"
              />
            </span>
            {errors.email && <small className="login-field-error">{errors.email}</small>}
          </motion.label>

          <motion.label
            className={`animated-field ${focusedField === "register-password" ? "focused" : ""} ${password ? "filled" : ""}`}
            variants={childVariants}
          >
            <span className="login-field-shell">
              <span className="login-floating-label">Password</span>
              <input
                className="login-motion-input"
                type="password"
                placeholder=" "
                aria-label="Password"
                value={password}
                onFocus={()=>setFocusedField("register-password")}
                onBlur={()=>setFocusedField("")}
                onChange={(event)=>onPasswordChange(event.target.value)}
                autoComplete="new-password"
              />
            </span>
            {errors.password && <small className="login-field-error">{errors.password}</small>}
          </motion.label>

          <motion.label
            className={`animated-field ${focusedField === "register-confirm" ? "focused" : ""} ${confirmPassword ? "filled" : ""}`}
            variants={childVariants}
          >
            <span className="login-field-shell">
              <span className="login-floating-label">Confirm Password</span>
              <input
                className="login-motion-input"
                type="password"
                placeholder=" "
                aria-label="Confirm Password"
                value={confirmPassword}
                onFocus={()=>setFocusedField("register-confirm")}
                onBlur={()=>setFocusedField("")}
                onChange={(event)=>onConfirmPasswordChange(event.target.value)}
                autoComplete="new-password"
              />
            </span>
            {errors.confirmPassword && <small className="login-field-error">{errors.confirmPassword}</small>}
          </motion.label>

          <motion.button
            className="login-submit-btn register-submit-btn"
            type="submit"
            disabled={status === "loading"}
            variants={childVariants}
            {...buttonMotion}
          >
            {status === "loading" ? <span className="login-spinner" aria-label="Registering" /> : "Register"}
          </motion.button>

          <motion.button
            className="timeline-btn login-forgot-btn"
            type="button"
            onClick={onBackToLogin}
            variants={childVariants}
            {...buttonMotion}
          >
            Back to Login
          </motion.button>
        </motion.form>
      </motion.section>
    </motion.div>
  );
}

export default RegisterCard;
