const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/cloudinary.js");

const {
  handleValidationErrors,
  commonValidations,
} = require("../middleware/validation.js");

const { authenticateToken } = require("../middleware/auth.js");

const {
  UpdateUserDetails,
  getUserDetails,
} = require("../controllers/profileUpdateController.js");

const { API_ROUTES } = require("../../constants/apiRoutes.js");

router.put(
  API_ROUTES.UPDATE_USER.UPDATE,
  authenticateToken,
  upload.single("profile_pic"),
  [
    commonValidations.userId("user_id"), // ⬅️ ONLY validating user_id
    handleValidationErrors,
  ],
  UpdateUserDetails
);

router.get(
  API_ROUTES.UPDATE_USER.GET_USER_DETAILS,
  authenticateToken,
  [commonValidations.userId("user_id")],
  getUserDetails
);

module.exports = router;
