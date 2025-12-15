const User = require("../models/User");
const { deleteCloudinaryImage } = require("../middleware/cloudinary");

const UploadvehicleDoc = async (req, res) => {
  try {
    const { user_id, vehicle_id, doc_name, doc_type, doc_number } = req.body;

    // File uploaded from Cloudinary
    const pdfUrl = req.file?.path;
    const publicId = req.file?.filename;

    if (!pdfUrl || !publicId) {
      return res.status(400).json({
        success: false,
        message: "Document upload failed. No file received.",
      });
    }

    // 1. Find user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Find vehicle inside user's garage
    const vehicle = user.garage.vehicles.find(
      (v) => v.vehicle_id === vehicle_id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found in user's garage",
      });
    }

    // 3. Push new document inside vehicle_doc array
    vehicle.vehicle_doc.push({
      doc_name,
      doc_type,
      doc_number,
      doc_url: pdfUrl,
      public_id: publicId,
    });

    // 4. Save user
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle document uploaded successfully",
      doc_url: pdfUrl,
    });
  } catch (error) {
    console.log("UploadvehicleDoc Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteVehicleDoc = async (req, res) => {
  try {
    const { user_id, vehicle_id, doc_type } = req.body;


    // 1. Find user by ID
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // 2. Find vehicle in user's garage
    const vehicle = user.garage.vehicles.find(
      (v) => v.vehicle_id === vehicle_id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found in user's garage"
      });
    }

    // 3. Find document inside vehicle_doc by doc_type
    const docIndex = vehicle.vehicle_doc.findIndex(
      (doc) => doc.doc_type === doc_type
    );


    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Document not found for this vehicle"
      });
    }

    const document = vehicle.vehicle_doc[docIndex];

    console.log(document);
    

    // 4. Delete from Cloudinary
    if (document.public_id) {
      await deleteCloudinaryImage(document.public_id);
    }

    // 5. Remove document from array
    vehicle.vehicle_doc.splice(docIndex, 1);

    // 6. Save user
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Vehicle document deleted successfully"
    });

  } catch (error) {
    console.error("deleteVehicleDoc Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { UploadvehicleDoc, deleteVehicleDoc };
