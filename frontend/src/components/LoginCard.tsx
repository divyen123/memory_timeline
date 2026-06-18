import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { memoryTheme } from "../animationTheme";

const ambientParticles = [
  {glyph: "\u2665", x: "12%", y: "72%", duration: 8.5, delay: 0.2, rotate: -8},
  {glyph: "\u2726", x: "22%", y: "22%", duration: 10, delay: 1.4, rotate: 14},
  {glyph: "\u2665", x: "76%", y: "28%", duration: 9.5, delay: 0.8, rotate: 11},
  {glyph: "\u2665", x: "89%", y: "76%", duration: 11, delay: 2.2, rotate: -12},
  {glyph: "\u2726", x: "66%", y: "83%", duration: 9, delay: 1.9, rotate: 18}
];

type LoginStatus = "idle" | "loading" | "success";

type LoginCardProps = {
  email: string;
  password: string;
  message: string;
  status: LoginStatus;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onRegister: () => void;
  onForgotPassword: () => void;
};

function LoginCard({
  email,
  password,
  message,
  status,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onRegister,
  onForgotPassword
}: LoginCardProps){
  const prefersReducedMotion = useReducedMotion();
  const [focusedField, setFocusedField] = useState("");
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -18,
      scale: prefersReducedMotion ? 1 : 1.12,
      filter: prefersReducedMotion ? "none" : "blur(8px)"
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: prefersReducedMotion ? 0.18 : 0.62,
        ease: memoryTheme.motion.easeOut,
        when: "beforeChildren",
        staggerChildren: prefersReducedMotion ? 0 : 0.07
      }
    },
    exit: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : -8,
      scale: prefersReducedMotion ? 1 : 0.96,
      transition: {duration: 0.24, ease: memoryTheme.motion.easeSoft}
    }
  };
  const childVariants = {
    hidden: {opacity: 0, y: prefersReducedMotion ? 0 : 12},
    show: {
      opacity: 1,
      y: 0,
      transition: {duration: prefersReducedMotion ? 0.16 : 0.36, ease: memoryTheme.motion.easeOut}
    }
  };
  const buttonMotion = prefersReducedMotion
    ? {}
    : {
      whileHover: {scale: 1.03, filter: "brightness(1.08)"},
      whileTap: {scale: 0.97},
      transition: memoryTheme.motion.press
    };

  const submitLabel = status === "loading"
    ? <span className="login-spinner" aria-label="Logging in" />
    : status === "success"
      ? <motion.span className="login-button-heart" initial={{scale: 0.7}} animate={{scale: [0.7, 1.22, 1]}} transition={{duration: 0.38}}>{"\u2665"}</motion.span>
      : "Login";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(status !== "loading"){
      onSubmit();
    }
  };

  return (
    <motion.div className="login-live-layer" initial="hidden" animate="show" exit="exit">
      {!prefersReducedMotion && ambientParticles.map((particle)=>(
        <motion.span
          key={`${particle.x}-${particle.delay}`}
          className="login-particle"
          style={{left: particle.x, top: particle.y}}
          animate={{
            y: [0, -28, 0],
            rotate: [particle.rotate, particle.rotate * -1, particle.rotate],
            opacity: [0.25, 0.62, 0.25]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          aria-hidden="true"
        >
          {particle.glyph}
        </motion.span>
      ))}
      <motion.section
        className="glass-card login-card animated-login-card"
        variants={cardVariants}
        aria-label="Login form"
      >
        <motion.h2 variants={childVariants}>Login</motion.h2>
        {message && (
          <motion.div className="toast login-toast" variants={childVariants}>
            {message}
          </motion.div>
        )}
        <motion.form className="login-motion-form" onSubmit={handleSubmit}>
          <motion.label
            className={`animated-field ${focusedField === "email" ? "focused" : ""} ${email ? "filled" : ""}`}
            variants={childVariants}
          >
            <span>Email</span>
            <span className="login-field-shell">
              <input
                className="login-motion-input"
                type="email"
                placeholder="Email"
                value={email}
                onFocus={()=>setFocusedField("email")}
                onBlur={()=>setFocusedField("")}
                onChange={(event)=>onEmailChange(event.target.value)}
                autoComplete="email"
              />
            </span>
          </motion.label>
          <motion.label
            className={`animated-field ${focusedField === "password" ? "focused" : ""} ${password ? "filled" : ""}`}
            variants={childVariants}
          >
            <span>Password</span>
            <span className="login-field-shell">
              <input
                className="login-motion-input"
                type="password"
                placeholder="Password"
                value={password}
                onFocus={()=>setFocusedField("password")}
                onBlur={()=>setFocusedField("")}
                onChange={(event)=>onPasswordChange(event.target.value)}
                autoComplete="current-password"
              />
            </span>
          </motion.label>
          <motion.div className="login-actions" variants={childVariants}>
            <motion.button
              className={`login-submit-btn ${status}`}
              type="submit"
              disabled={status === "loading"}
              {...buttonMotion}
            >
              {submitLabel}
            </motion.button>
            <motion.button className="timeline-btn login-register-btn" type="button" onClick={onRegister} {...buttonMotion}>
              Register
            </motion.button>
          </motion.div>
          <motion.button
            className="timeline-btn login-forgot-btn"
            type="button"
            onClick={onForgotPassword}
            variants={childVariants}
            {...buttonMotion}
          >
            Forgot Password
          </motion.button>
        </motion.form>
      </motion.section>
    </motion.div>
  );
}

export default LoginCard;
