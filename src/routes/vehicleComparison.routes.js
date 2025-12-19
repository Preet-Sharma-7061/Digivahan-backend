const express = require("express");
const router = express.Router();

const {
  handleValidationErrors,
  commonValidations,
} = require("../middleware/validation.js");

const { API_ROUTES } = require("../../constants/apiRoutes.js");

const {
  CompareVehicle,
  CompareVehicleUpdate,
} = require("../controllers/vehicleComparisonController.js");

router.post(
  API_ROUTES.VEHICLE_COMPARISON_UPDATE.COMPARE,
  [handleValidationErrors],
  CompareVehicle
);

router.post(
  API_ROUTES.VEHICLE_COMPARISON_UPDATE.UPDATE,
  [handleValidationErrors],
  CompareVehicleUpdate
);

module.exports = router;
