const Message = require("../models/message");
const Chat = require("../models/Chat");

/**
 * Socket.io Connection Handler
 */
const setupSocketIO = (io) => {
  // Authentication middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;

    if (!userId) {
      return next(new Error("Authentication error"));
    }

    socket.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    /**
     * Join Chat Room
     */
    socket.on("joinRoom", async ({ chatId }) => {
      try {
        socket.join(chatId);
        console.log(`User ${socket.userId} joined chat ${chatId}`);

        // Mark messages as delivered when joining
        await Message.markAsDelivered(socket.userId, chatId);
      } catch (error) {
        console.error("Join room error:", error);
      }
    });

    /**
     * Leave Chat Room
     */
    socket.on("leaveRoom", ({ chatId }) => {
      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat ${chatId}`);
    });

    /**
     * Send Message
     */
    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, senderId, receiverId, message, attachments } = data;

        // Validate required fields
        if (!chatId || !senderId || !receiverId || !message) {
          socket.emit("error", { message: "Invalid message data" });
          return;
        }

        // Create message in database
        const newMessage = new Message({
          chatId,
          senderId,
          receiverId,
          message: message.trim(),
          attachments: attachments || [],
          status: "sent",
          timestamp: new Date(),
        });

        await newMessage.save();

        // Update chat last message
        await Chat.findByIdAndUpdate(
          chatId,
          {
            lastMessage: {
              text: message,
              timestamp: new Date(),
            },
            updated_at: new Date(),
          },
          { new: true }
        );

        // Emit to receiver
        io.to(chatId).emit("receiveMessage", newMessage);

        // Also emit to sender for confirmation
        socket.emit("messageSent", {
          messageId: newMessage._id,
          status: "sent",
        });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    /**
     * Mark Message as Delivered
     */
    socket.on("messageDelivered", async ({ chatId, messageId }) => {
      try {
        if (messageId) {
          await Message.findByIdAndUpdate(messageId, {
            $set: { status: "delivered" },
          });
          io.to(chatId).emit("statusUpdated", {
            messageId,
            status: "delivered",
          });
        }
      } catch (error) {
        console.error("Mark delivered error:", error);
      }
    });

    /**
     * Mark Message as Seen
     */
    socket.on("messageSeen", async ({ chatId }) => {
      try {
        await Message.markAsSeen(socket.userId, chatId);
        io.to(chatId).emit("messagesSeen", { userId: socket.userId, chatId });
      } catch (error) {
        console.error("Mark seen error:", error);
      }
    });

    /**
     * Typing Indicator
     */
    socket.on("typing", ({ chatId, isTyping }) => {
      socket.to(chatId).emit("userTyping", { userId: socket.userId, isTyping });
    });

    /**
     * User Online Status
     */
    socket.on("userOnline", () => {
      io.emit("userStatusUpdate", { userId: socket.userId, status: "online" });
    });

    /**
     * User Offline Status
     */
    socket.on("userOffline", () => {
      io.emit("userStatusUpdate", { userId: socket.userId, status: "offline" });
    });

    /**
     * Disconnect Handler
     */
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
      io.emit("userStatusUpdate", { userId: socket.userId, status: "offline" });
    });
  });

  return io;
};

module.exports = { setupSocketIO };
