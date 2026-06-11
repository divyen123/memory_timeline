const jwt = require("jsonwebtoken");
const { ACCESS_COOKIE } = require("../authSessions");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const legacyToken = header?.startsWith("Bearer ") ? header.slice(7) : header;
  const token = req.cookies?.[ACCESS_COOKIE] || legacyToken;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if(req.user.type && req.user.type !== "access"){
      throw new Error("Invalid token type");
    }
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = authMiddleware;
