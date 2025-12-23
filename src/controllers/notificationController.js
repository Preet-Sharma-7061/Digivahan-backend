const User = require("../models/User");
const axios = require("axios");

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

    // 3️⃣ Normalize incident proof
    const incidentProofArray = Array.isArray(incident_proof)
      ? incident_proof
      : incident_proof
      ? [incident_proof]
      : [];

    // 4️⃣ Save notification in DB (ONLY schema fields)
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
      incident_proof: incidentProofArray,
      inapp_notification,
    });

    await receiver.save();

    const savedNotification = receiver.notifications.at(-1);

    const ANDROID_CHANNEL_MAP = {
      no_parking: "0b251d79-aa58-4410-ac8b-a810849ce1c6",
    };

    const DEFAULT_ANDROID_CHANNEL = "54dcadaf-229d-4f03-8574-e9b1f4060279";

    const androidChannelId = ANDROID_CHANNEL_MAP[issue_type] || DEFAULT_ANDROID_CHANNEL;

    // 🔥 5️⃣ SEND ONESIGNAL (SINGLE USER)
    if (receiver._id) {
      await sendOneSignalNotification({
        externalUserId: receiver._id.toString(), // ✅ USER schema se
        title: notification_title,
        message,
        data: {
          sender_id,
          notification_type,
          order_id: order_id || "",
          vehicle_id: vehicle_id || "",
          chat_room_id: chat_room_id || "",
          issue_type: issue_type || "",
          latitude: latitude || "",
          longitude: longitude || "",
        },
        androidChannelId,
      });
    }

    return res.status(201).json({
      status: true,
      message: "Notification sent successfully",
      data: savedNotification,
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

const sendOneSignalNotification = async ({
  externalUserId,
  title,
  message,
  data = {},
  androidChannelId,
}) => {
  try {
    const payload = {
      app_id: process.env.ONESIGNAL_APP_ID,

      // Target specific device
      include_external_user_ids: [externalUserId],

      headings: { en: title },
      contents: { en: message },

      // ✅ THIS IS THE KEY FIX
      android_channel_id: androidChannelId,

      // App-side logic data (unchanged)
      data,
    };

    const response = await axios.post(
      "https://onesignal.com/api/v1/notifications",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("OneSignal Error:", error.response?.data || error.message);
    throw error;
  }
};

const getAllNotification = async (req, res) => {
  try {
    const { user_id } = req.params;
    let { current_page } = req.query;

    // 🧠 default page = 1
    current_page = parseInt(current_page) || 1;

    const PAGE_SIZE = 20;
    const skip = (current_page - 1) * PAGE_SIZE;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // 👤 only notifications fetch karo
    const user = await User.findById(user_id).select("notifications");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const notifications = user.notifications || [];

    // 🔔 unseen notifications count
    const unseenCount = notifications.filter(
      (n) => n.default_status === false
    ).length;

    // ⏰ latest notifications on top
    const sortedNotifications = notifications.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // 📄 pagination logic
    const totalNotifications = sortedNotifications.length;
    const totalPages = Math.ceil(totalNotifications / PAGE_SIZE);

    // ✅ ONLY current page ka data
    const pageData = sortedNotifications.slice(skip, skip + PAGE_SIZE);

    return res.status(200).json({
      status: true,
      message: "Notifications fetched successfully",
      unseen_count: unseenCount,
      pagination: {
        current_page,
        page_size: PAGE_SIZE,
        total_pages: totalPages,
        total_notifications: totalNotifications,
      },
      data: pageData,
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

const seenNotificationByUser = async (req, res) => {
  try {
    const { user_id, notification_id } = req.body;

    // 🔍 validation
    if (!notification_id) {
      return res.status(400).json({
        status: false,
        message: "notification_id are required",
      });
    }

    // 👤 find user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 🔔 find notification inside user's notifications array
    const notification = user.notifications.id(notification_id);

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: "Notification not found",
      });
    }

    // ✅ mark as seen
    notification.default_status = true;

    // 💾 save user document
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Notification marked as seen",
    });
  } catch (error) {
    console.error("Seen notification error:", error);
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
  seenNotificationByUser,
};
