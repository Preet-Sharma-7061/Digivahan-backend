const User = require("../models/User");

const sendNotification = async (req, res) => {
  try {
    const {
      sender_id,
      receiver_id,
      notification_type,
      notification_title,
      link,
      vehicle_id,
      order_id,
      message,
      issue_type,
      chat_room_id,
      latitude,
      longitude,
      incident_proof,
      inapp_notification,
    } = req.body;

    // 1️⃣ Find sender
    const sender = await User.findById(sender_id).select(
      "basic_details.first_name basic_details.last_name basic_details.profile_pic"
    );

    if (!sender) {
      return res.status(404).json({
        status: false,
        message: "Sender not found",
      });
    }

    const senderName = `${sender.basic_details.first_name || ""} ${
      sender.basic_details.last_name || ""
    }`.trim();

    const senderPic = sender.basic_details.profile_pic || "";

    // 2️⃣ Find receiver
    const receiver = await User.findById(receiver_id);

    if (!receiver) {
      return res.status(404).json({
        status: false,
        message: "Receiver not found",
      });
    }

    // 3️⃣ Push notification into receiver.notifications
    receiver.notifications.push({
      sender_id,
      sender_pic: senderPic,
      name: senderName,
      notification_type,
      notification_title,
      link,
      vehicle_id,
      order_id,
      message,
      issue_type,
      chat_room_id,
      latitude,
      longitude,
      incident_proof,
      inapp_notification,
    });

    // 4️⃣ Save receiver
    await receiver.save();

    return res.status(201).json({
      status: true,
      message: "Notification sent successfully",
      data: receiver.notifications.at(-1), // last added notification
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getAllNotification = async (req, res) => {
  try {
    const { user_id } = req.params;

    // 🔍 basic validation
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // 👤 find user & only fetch notifications
    const user = await User.findById(user_id).select("notifications");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Notifications fetched successfully",
      data: user.notifications || [],
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const checkSecurityCode = async (req, res) => {
  try {
    const { user_id, vehicle_id } = req.body;

    // 1️⃣ Validate input
    if (!user_id || !vehicle_id) {
      return res.status(400).json({
        success: false,
        message: "user_id and vehicle_id are required",
      });
    }

    // 2️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 3️⃣ Find vehicle inside garage
    const vehicle = user.garage.vehicles.find(
      (v) => v.vehicle_id === vehicle_id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found for this user",
      });
    }

    // 4️⃣ Generate 6-digit random security code
    const securityCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 5️⃣ Save security code in vehicle_doc
    vehicle.vehicle_doc.security_code = securityCode;

    await user.save();

    // 6️⃣ Auto clear after 10 minutes
    setTimeout(async () => {
      try {
        const freshUser = await User.findById(user_id);
        if (!freshUser) return;

        const freshVehicle = freshUser.garage.vehicles.find(
          (v) => v.vehicle_id === vehicle_id
        );

        if (freshVehicle) {
          freshVehicle.vehicle_doc.security_code = "";
          await freshUser.save();
        }
      } catch (err) {
        console.error("Security code auto-clear error:", err);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return res.status(200).json({
      success: true,
      message: "Security code generated successfully",
      security_code: securityCode, // (SMS / frontend me bhejne ke liye)
      expires_in: "10 minutes",
      vehicle_doc_data: vehicle.vehicle_doc.documents,
    });
  } catch (error) {
    console.error("checkSecurityCode Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const verifySecurityCode = async (req, res) => {
  try {
    const { user_id, vehicle_id, security_code } = req.body;

    if (!user_id || !vehicle_id || !security_code) {
      return res.status(400).json({
        success: false,
        message: "user_id, vehicle_id and security_code are required",
      });
    }

    // 1️⃣ Find user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2️⃣ Find vehicle inside garage
    const vehicle = user.garage.vehicles.find(
      (v) => v.vehicle_id === vehicle_id
    );

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // 3️⃣ Check security code
    if (vehicle.vehicle_doc.security_code !== security_code) {
      return res.status(401).json({
        success: false,
        message: "Invalid security code",
      });
    }

    // 4️⃣ Success → return all documents
    return res.status(200).json({
      success: true,
      message: "Security code verified successfully",
      data: {
        documents: vehicle.vehicle_doc.documents,
      },
    });
  } catch (error) {
    console.error("verifySecurityCode Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


module.exports = {
  sendNotification,
  getAllNotification,
  checkSecurityCode,
  verifySecurityCode,
};
