const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// @desc    Get all users (excluding current user)
// @route   GET /api/user
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const loggedInUserId = req.user.userId;

    // Get all users except the logged-in user
    const users = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

// @desc    Get user by ID
// @route   GET /api/user/:id
// @access  Private
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get user error:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    res.status(500).json({ error: "Server error fetching user" });
  }
});

// @desc    Search users by username or full name
// @route   GET /api/user/search/:query
// @access  Private
router.get("/search/:query", authMiddleware, async (req, res) => {
  try {
    const { query } = req.params;
    const loggedInUserId = req.user.userId;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Search users by username, full name, or email
    const users = await User.find({
      _id: { $ne: loggedInUserId },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { fullName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    })
      .select("-password")
      .limit(10);

    res.status(200).json(users);
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Server error searching users" });
  }
});

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fullName, email, profilePic } = req.body;

    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (profilePic) user.profilePic = profilePic;

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(userId).select("-password");
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Update profile error:", error);

    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }

    res.status(500).json({ error: "Server error updating profile" });
  }
});

// @desc    Delete user account
// @route   DELETE /api/user/account
// @access  Private
router.delete("/account", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find and delete the user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // TODO: Also delete all messages and conversations associated with this user

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Server error deleting account" });
  }
});

// @desc    Get user statistics
// @route   GET /api/user/stats
// @access  Private
router.get("/stats/overview", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's message count
    const Message = require("../models/Message");
    const Conversation = require("../models/Conversation");

    const messageCount = await Message.countDocuments({
      senderId: userId,
    });

    const conversationCount = await Conversation.countDocuments({
      participants: userId,
    });

    res.status(200).json({
      messagesSent: messageCount,
      activeConversations: conversationCount,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Server error fetching statistics" });
  }
});

module.exports = router;
