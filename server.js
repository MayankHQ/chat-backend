const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const userRoutes = require("./routes/userRoutes");

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/chatapp", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Store online users
const userSocketMap = {}; // {userId: socketId}

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} connected with socket ${socket.id}`);
  }

  // Emit the list of online users to all clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Listen for typing events
  socket.on("typing", (data) => {
    const receiverSocketId = userSocketMap[data.receiverId];
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("typing", {
        senderId: data.senderId,
        isTyping: data.isTyping,
      });
    }
  });

  // Listen for message read events
  socket.on("messageRead", (data) => {
    const senderSocketId = userSocketMap[data.senderId];
    if (senderSocketId) {
      socket.to(senderSocketId).emit("messageRead", {
        messageId: data.messageId,
        readBy: data.readBy,
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove user from online users
    for (const [userId, socketId] of Object.entries(userSocketMap)) {
      if (socketId === socket.id) {
        delete userSocketMap[userId];
        break;
      }
    }

    // Emit updated online users list
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

// Helper function to get receiver socket ID
const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/user", userRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ message: "Server is running", timestamp: new Date() });
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../frontend/dist/index.html"));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for use in other files
module.exports = { app, server, io, getReceiverSocketId };
