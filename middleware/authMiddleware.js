const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from the token
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ error: "Token is not valid" });
    }

    // Add user to request object
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token is not valid" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired" });
    }

    res.status(500).json({ error: "Server error" });
  }
};

module.exports = authMiddleware;
