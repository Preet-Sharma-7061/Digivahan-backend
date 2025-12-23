const Feedback = require("../models/reviewSchema");
const User = require("../models/User"); // to verify user exists

const addUserReview = async (req, res) => {
  try {
    const {
      user_id,
      order_id,
      product_type,
      rating,
      product_image,
      review_title,
      review_text,
    } = req.body;

    // ===== 1️⃣ Validate User Exists =====
    const userExists = await User.findById(user_id);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ===== 2️⃣ Check Review Exists (user_id + order_id) =====
    const existingReview = await Feedback.findOne({
      user_id,
      order_id,
    });

    // ===== 3️⃣ If exists → UPDATE only required fields =====
    if (existingReview) {
      existingReview.product_type = product_type;
      existingReview.rating = rating;
      existingReview.product_image = product_image;
      existingReview.review_title = review_title;
      existingReview.review_text = review_text;

      await existingReview.save();

      return res.status(200).json({
        success: true,
        message: "Review updated successfully",
        data: existingReview,
      });
    }

    // ===== 4️⃣ If not exists → CREATE new review =====
    const newReview = await Feedback.create({
      user_id,
      order_id,
      product_type,
      rating,
      product_image,
      review_title,
      review_text,
    });

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: newReview,
    });
  } catch (error) {
    console.error("addUserReview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const FetchUserFeedBack = async (req, res) => {
  try {
    let { product_type, limit, page } = req.body;

    // Default pagination values
    limit = parseInt(limit) || 10; // items per page
    page = parseInt(page) || 1; // current page
    const skip = (page - 1) * limit;

    // ===== Build Query =====
    let query = {};

    if (product_type) {
      query.product_type = product_type;
    }

    // ===== Fetch Data with Pagination =====
    const feedbackList = await Feedback.find(query)
      .populate("user_id", "name email") // optional: show user info
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

    // ===== Count Total for Pagination =====
    const totalRecords = await Feedback.countDocuments(query);
    const totalPages = Math.ceil(totalRecords / limit);

    return res.status(200).json({
      success: true,
      message: "Feedback fetched successfully",
      current_page: page,
      total_pages: totalPages,
      total_records: totalRecords,
      limit: limit,
      data: feedbackList,
    });
  } catch (error) {
    console.error("FetchUserFeedBack Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = { addUserReview, FetchUserFeedBack };
