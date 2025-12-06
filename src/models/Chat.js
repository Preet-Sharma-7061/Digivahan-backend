const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: String,
        required: true,
        trim: true,
        index: true,
      },
    ],
    lastMessage: {
      text: { type: String, default: "", trim: true },
      timestamp: { type: Date, default: Date.now },
    },
    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for better query performance
// chatSchema.index({ participants: 1 });
chatSchema.index({ "lastMessage.timestamp": -1 });
chatSchema.index({ updated_at: -1 });

// Pre-save middleware to update updated_at
chatSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Static method to find or create chat between two users
chatSchema.statics.findOrCreateChat = async function (user1, user2) {
  try {
    // Look for existing chat
    let chat = await this.findOne({
      participants: { $all: [user1, user2] },
      $expr: { $eq: [{ $size: "$participants" }, 2] },
    });

    if (!chat) {
      // Create new chat
      chat = new this({
        participants: [user1, user2],
        lastMessage: {
          text: "",
          timestamp: new Date(),
        },
      });
      await chat.save();
    }

    return chat;
  } catch (error) {
    throw error;
  }
};

// Static method to get user chats
chatSchema.statics.getUserChats = async function (userId, options = {}) {
  try {
    const { limit = 50, skip = 0 } = options;

    const chats = await this.find({ participants: userId })
      .sort({ "lastMessage.timestamp": -1, updated_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const totalCount = await this.countDocuments({ participants: userId });

    return {
      chats,
      totalCount,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: skip + limit < totalCount,
      hasPrevPage: skip > 0,
    };
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model("Chat", chatSchema);
