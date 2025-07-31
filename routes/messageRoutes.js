const express = require("express");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// @desc    Get messages with a specific user
// @route   GET /api/message/:id
// @access  Private
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user.userId;

    // Find conversation between the two users
    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, userToChatId] },
    }).populate({
      path: "messages",
      populate: {
        path: "senderId receiverId",
        select: "username fullName profilePic",
      },
    });

    if (!conversation) {
      return res.status(200).json([]);
    }

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId: conversation._id,
        senderId: userToChatId,
        receiverId: senderId,
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json(conversation.messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Server error fetching messages" });
  }
});

// @desc    Send a message
// @route   POST /api/message/send/:id
// @access  Private
router.post("/send/:id", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user.userId;

    // Check if message content exists
    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
    }

    // Create new message
    const newMessage = new Message({
      senderId,
      receiverId,
      message: message.trim(),
      conversationId: conversation._id,
    });

    await newMessage.save();

    // Update conversation with the new message
    conversation.messages.push(newMessage._id);
    conversation.lastMessage = newMessage._id;
    conversation.lastMessageTime = new Date();
    await conversation.save();

    // Populate sender and receiver information
    await newMessage.populate([
      { path: "senderId", select: "username fullName profilePic" },
      { path: "receiverId", select: "username fullName profilePic" },
    ]);

    // Socket.io real-time messaging
    const { getReceiverSocketId, io } = require("../server");
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Server error sending message" });
  }
});

// @desc    Get all conversations for a user
// @route   GET /api/message
// @access  Private
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate({
        path: "participants",
        select: "username fullName profilePic",
      })
      .populate({
        path: "lastMessage",
        select: "message createdAt senderId isRead",
      })
      .sort({ lastMessageTime: -1 });

    // Filter out current user from participants and format response
    const formattedConversations = conversations.map((conversation) => {
      const otherParticipant = conversation.participants.find(
        (participant) => participant._id.toString() !== userId
      );

      return {
        _id: conversation._id,
        participant: otherParticipant,
        lastMessage: conversation.lastMessage,
        lastMessageTime: conversation.lastMessageTime,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };
    });

    res.status(200).json(formattedConversations);
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Server error fetching conversations" });
  }
});

// @desc    Delete a message
// @route   DELETE /api/message/:messageId
// @access  Private
router.delete("/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Find the message
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this message" });
    }

    // Delete the message
    await Message.findByIdAndDelete(messageId);

    // Remove message from conversation
    await Conversation.findByIdAndUpdate(message.conversationId, {
      $pull: { messages: messageId },
    });

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: "Server error deleting message" });
  }
});

// @desc    Mark messages as read
// @route   PUT /api/message/read/:conversationId
// @access  Private
router.put("/read/:conversationId", authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    // Mark all messages in the conversation as read for the current user
    await Message.updateMany(
      {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      { isRead: true }
    );

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ error: "Server error marking messages as read" });
  }
});

module.exports = router;
