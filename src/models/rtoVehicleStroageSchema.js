const mongoose = require("mongoose");

/**
 * RTO Vehicles Storage Model
 * Stores cached RTO vehicle data to avoid repeated API calls
 */
const rtoVehiclesStorageSchema = new mongoose.Schema(
  {
    vehicle_number: {
      type: String,
      unique: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    rto_data: {
      type: mongoose.Schema.Types.Mixed,
    },
    fetched_at: {
      type: Date || String,
      default: Date.now,
    },
    last_used_at: {
      type: Date,
      default: Date.now,
    },
    usage_count: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index for faster queries
// rtoVehiclesStorageSchema.index({ vehicle_number: 1 });
rtoVehiclesStorageSchema.index({ fetched_at: 1 });

/**
 * Static method to find vehicle by vehicle number
 */
rtoVehiclesStorageSchema.statics.findByVehicleNumber = function (
  vehicleNumber
) {
  return this.findOne({
    vehicle_number: vehicleNumber.toUpperCase().trim(),
  });
};

/**
 * Static method to save or update vehicle data
 */
rtoVehiclesStorageSchema.statics.saveVehicleData = async function (
  vehicleNumber,
  rtoData
) {
  const vehicleNumberUpper = vehicleNumber.toUpperCase().trim();

  const existingVehicle = await this.findOne({
    vehicle_number: vehicleNumberUpper,
  });

  if (existingVehicle) {
    // Update existing record
    existingVehicle.rto_data = rtoData;
    existingVehicle.fetched_at = new Date();
    existingVehicle.last_used_at = new Date();
    existingVehicle.usage_count += 1;
    return await existingVehicle.save();
  } else {
    // Create new record
    return await this.create({
      vehicle_number: vehicleNumberUpper,
      rto_data: rtoData,
      fetched_at: new Date(),
      last_used_at: new Date(),
      usage_count: 1,
    });
  }
};

/**
 * Instance method to update last used timestamp
 */
rtoVehiclesStorageSchema.methods.updateLastUsed = function () {
  this.last_used_at = new Date();
  this.usage_count += 1;
  return this.save();
};

module.exports = mongoose.model("RTOVehiclesStorage", rtoVehiclesStorageSchema);
