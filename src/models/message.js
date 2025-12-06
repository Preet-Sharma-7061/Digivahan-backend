const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    receiverId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachments: [
      {
        type: String,
        trim: true,
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for better query performance
messageSchema.index({ chatId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1, receiverId: 1 });
// messageSchema.index({ status: 1 });
messageSchema.index({ timestamp: -1 });

// Pre-save middleware
messageSchema.pre("save", function (next) {
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  next();
});

// Static method to get messages for a chat
messageSchema.statics.getChatMessages = async function (chatId, options = {}) {
  try {
    const { limit = 50, offset = 0 } = options;

    const messages = await this.find({ chatId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const totalCount = await this.countDocuments({ chatId });

    return {
      messages,
      totalCount,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: offset + limit < totalCount,
      hasPrevPage: offset > 0,
    };
  } catch (error) {
    throw error;
  }
};

// Static method to get unread message count
messageSchema.statics.getUnreadCount = async function (userId, chatId = null) {
  try {
    const query = {
      receiverId: userId,
      status: { $in: ["sent", "delivered"] },
    };

    if (chatId) {
      query.chatId = chatId;
    }

    const count = await this.countDocuments(query);
    return count;
  } catch (error) {
    throw error;
  }
};

// Static method to mark messages as delivered
messageSchema.statics.markAsDelivered = async function (
  receiverId,
  chatId = null
) {
  try {
    const query = {
      receiverId,
      status: "sent",
    };

    if (chatId) {
      query.chatId = chatId;
    }

    await this.updateMany(query, {
      $set: { status: "delivered" },
    });
  } catch (error) {
    throw error;
  }
};

// Static method to mark messages as seen
messageSchema.statics.markAsSeen = async function (receiverId, chatId) {
  try {
    await this.updateMany(
      {
        chatId,
        receiverId,
        status: { $in: ["sent", "delivered"] },
      },
      {
        $set: { status: "seen" },
      }
    );
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model("Message", messageSchema);
