const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { fullName, username, email, password, confirmPassword, gender } =
      req.body;

    // Validation
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords don't match" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Generate profile picture based on gender
    const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${username}`;
    const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${username}`;

    // Create new user
    const user = new User({
      fullName,
      username,
      email,
      password,
      gender,
      profilePic: gender === "male" ? boyProfilePic : girlProfilePic,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    res.json(user);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Server error fetching profile" });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { fullName, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { fullName, email },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Server error updating profile" });
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post("/logout", authMiddleware, (req, res) => {
  // With JWT, logout is handled on the frontend by removing the token
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
