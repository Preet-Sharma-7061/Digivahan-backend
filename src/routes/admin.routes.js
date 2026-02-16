const express = require("express");
const router = express.Router();
const {
  handleValidationErrors,
  commonValidations,
} = require("../middleware/validation.js");

const { API_ROUTES } = require("../../constants/apiRoutes.js");

const {
  SignInAdmin,
  verifyAdminOTP,
} = require("../controllers/adminAuthController.js");

router.post(
  API_ROUTES.AUTH.ADMIN.SIGN_IN_ADMIN,
  [commonValidations.phone("phone"), handleValidationErrors],
  SignInAdmin,
);

router.post(
  API_ROUTES.AUTH.ADMIN.VERIFY_ADMIN,
  [handleValidationErrors],
  verifyAdminOTP,
);

module.exports = router;
