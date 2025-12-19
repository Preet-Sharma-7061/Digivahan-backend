const VehicleComparison = require("../models/VehicleComparison");
const TrendingCars = require("../models/TrendingCarsSchema");
const mongoose = require("mongoose");

const CompareVehicle = async (req, res) => {
  try {
    const { car1_id, car2_id } = req.body;

    // 🔴 validation
    if (!car1_id || !car2_id) {
      return res.status(400).json({
        success: false,
        message: "Both car1_id and car2_id are required",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(car1_id) ||
      !mongoose.Types.ObjectId.isValid(car2_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid car id",
      });
    }

    // 🔍 find both cars
    const car1 = await TrendingCars.findById(car1_id);
    const car2 = await TrendingCars.findById(car2_id);

    console.log(car1, car2);

    if (!car1 || !car2) {
      return res.status(404).json({
        success: false,
        message: "One or both cars not found",
      });
    }

    // 🧠 pick only required fields
    const car1Data = {
      car_1_id: car1_id,
      brand_name: car1.brand_name,
      model_name: car1.model_name,
      image_url: car1.car_details.image_url,
      price_display: car1.car_details.price_display,
    };

    const car2Data = {
      car_2_id: car2_id,
      brand_name: car2.brand_name,
      model_name: car2.model_name,
      image_url: car2.car_details.image_url,
      price_display: car2.car_details.price_display,
    };

    // 💾 save comparison
    const comparison = await VehicleComparison.create({
      car_1_data: car1Data,
      car_2_data: car2Data,
    });

    return res.status(201).json({
      success: true,
      message: "Vehicle comparison saved successfully",
      data: comparison,
    });
  } catch (error) {
    console.error("Compare vehicle error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { CompareVehicle };
