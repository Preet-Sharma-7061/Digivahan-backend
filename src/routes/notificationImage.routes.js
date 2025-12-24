const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/cloudinary");

const {
  uploadNotificationImage,
  deleteNotificationImage,
} = require("../controllers/notificationImage.controller");

// Upload image
router.post(
  "/api/v1/notification/image",
  upload.single("image"),
  uploadNotificationImage
);

// DELETE image
router.post("/api/v1/notification/delete-image",
     deleteNotificationImage);

module.exports = router;