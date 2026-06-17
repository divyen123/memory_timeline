import React from "react";
import IntroStage from "./intro/IntroStage";

function LoginIntroMotion({onComplete}){
  return <IntroStage onComplete={onComplete} />;
}

export default LoginIntroMotion;
