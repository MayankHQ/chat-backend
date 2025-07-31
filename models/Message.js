const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
  },
  { timestamps: true }
);

// Index for faster queries
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
