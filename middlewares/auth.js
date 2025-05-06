const jwt = require("jsonwebtoken");
require("dotenv").config();

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // Extract token from "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userInfo = decoded; // Attach user info to the request
    next();
  } catch (err) {
    res.status(403).json({ success: false, message: "Invalid or expired token." });
  }
}

module.exports = { authenticate };