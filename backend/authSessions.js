const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Session = require("./models/Session");

const ACCESS_COOKIE = "mt_access";
const REFRESH_COOKIE = "mt_refresh";
const ACCESS_MINUTES = Number(process.env.ACCESS_TOKEN_MINUTES || 15);
const REFRESH_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);
const isProduction = process.env.NODE_ENV === "production";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const cookieBase = {
  httpOnly:true,
  secure:isProduction,
  sameSite:isProduction ? "none" : "lax"
};

const setAccessCookie = (res, userId) => {
  const token = jwt.sign(
    {userId:String(userId), type:"access"},
    process.env.JWT_SECRET,
    {expiresIn:`${ACCESS_MINUTES}m`}
  );

  res.cookie(ACCESS_COOKIE, token, {
    ...cookieBase,
    maxAge:ACCESS_MINUTES * 60 * 1000,
    path:"/"
  });
};

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase,
    maxAge:REFRESH_DAYS * 24 * 60 * 60 * 1000,
    path:"/api"
  });
};

exports.createSession = async (req, res, userId) => {
  const refreshToken = crypto.randomBytes(48).toString("base64url");

  await Session.create({
    userId,
    refreshTokenHash:hashToken(refreshToken),
    expiresAt:new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
    ip:req.ip,
    userAgent:String(req.get("user-agent") || "").slice(0, 300)
  });

  setAccessCookie(res, userId);
  setRefreshCookie(res, refreshToken);
};

exports.rotateSession = async (req, res) => {
  const currentToken = req.cookies?.[REFRESH_COOKIE];

  if(!currentToken){
    return null;
  }

  const session = await Session.findOne({
    refreshTokenHash:hashToken(currentToken),
    expiresAt:{$gt:new Date()}
  });

  if(!session){
    return null;
  }

  const nextToken = crypto.randomBytes(48).toString("base64url");
  session.refreshTokenHash = hashToken(nextToken);
  session.lastUsedAt = new Date();
  session.ip = req.ip;
  session.userAgent = String(req.get("user-agent") || "").slice(0, 300);
  await session.save();

  setAccessCookie(res, session.userId);
  setRefreshCookie(res, nextToken);
  return session;
};

exports.revokeCurrentSession = async (req) => {
  const token = req.cookies?.[REFRESH_COOKIE];

  if(token){
    await Session.deleteOne({refreshTokenHash:hashToken(token)});
  }
};

exports.clearSessionCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, {...cookieBase, path:"/"});
  res.clearCookie(REFRESH_COOKIE, {...cookieBase, path:"/api"});
};

exports.ACCESS_COOKIE = ACCESS_COOKIE;
