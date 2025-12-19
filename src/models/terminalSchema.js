const mongoose = require("mongoose");

const feedBackSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order_id: {
      type: String,
      default: "",
    },

    product_type: {
      type: String,
      required: true,
      enum: ["app", "vehicle", "service", "other", "qr"], // modify as per your need
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    review_title: {
      type: String,
      required: true,
      maxlength: 100,
    },

    review_text: {
      type: String,
      required: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true, // auto createdAt + updatedAt
  }
);

feedBackSchema.index({ product_type: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedBackSchema);
