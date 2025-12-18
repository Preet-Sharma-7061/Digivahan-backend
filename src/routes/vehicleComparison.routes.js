const express = require("express");
const router = express.Router();

const {
  handleValidationErrors,
  commonValidations,
} = require("../middleware/validation.js");

const { API_ROUTES } = require("../../constants/apiRoutes.js");
const {
  CompareVehicle,
} = require("../controllers/vehicleComparisonController.js");

router.post(
  API_ROUTES.VEHICLE_COMPARISON_UPDATE.COMPARE,
  [
    handleValidationErrors,
  ],
  CompareVehicle
);

module.exports = router;
