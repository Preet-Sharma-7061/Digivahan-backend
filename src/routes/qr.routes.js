const express = require("express");
const router = express.Router();

const {
  handleValidationErrors,
  commonValidations,
} = require("../middleware/validation.js");

const { API_ROUTES } = require("../../constants/apiRoutes.js");

const {
  createQrScanner,
  getQrDetails,
  AssignedQrtoUser,
} = require("../controllers/QrController.js");

router.post(
  API_ROUTES.QR.GENERATE_QR,
  [commonValidations.unitno("unit"), handleValidationErrors],
  createQrScanner
);

router.get(API_ROUTES.QR.QR_DETAILS, [handleValidationErrors], getQrDetails);

router.post(
  API_ROUTES.QR.QR_ASSIGNMENT,
  [handleValidationErrors],
  AssignedQrtoUser
);

module.exports = router;
