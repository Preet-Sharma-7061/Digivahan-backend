const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const { deleteCloudinaryImage } = require("../middleware/cloudinary");

const AddEmergencyContact = async (req, res) => {
  try {
    const { user_id, first_name, last_name, relation, phone_number, email } =
      req.body;

    const user = await User.findById(user_id);

    if (!user) return res.status(404).json({ message: "User not found" });

    // Validation handled by schema
    const newContact = {
      first_name,
      last_name,
      relation,
      phone_number,
      email,
      profile_pic: req.file?.path || "",
      public_id: req.file?.filename || "",
    };

    user.emergency_contacts.push(newContact);
    await user.save();

    res.status(200).json({
      status: true,
      message: "Emergency contact added successfully",
      emergency_contacts: user.emergency_contacts,
    });
  } catch (error) {
    console.log(error);
    status: true,
    res.status(500).json({ message: "Internal server error" });
  }
};

const UpdateUserEmergencyContact = async (req, res) => {
  try {
    const {
      user_id,
      contact_id,
      first_name,
      last_name,
      relation,
      phone_number,
      email,
    } = req.body;

    // 1️⃣ Validate required fields
    if (!user_id || !contact_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and contact_id are required.",
      });
    }

    // 2️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 3️⃣ Find emergency contact
    const contact = user.emergency_contacts.find((c) =>
      c._id.equals(contact_id)
    );

    if (!contact) {
      return res.status(404).json({
        status: false,
        message: "Emergency contact not found",
      });
    }

    const profilePicFile = req.file;

    // 4️⃣ If new profile_pic is uploaded → delete old versions + upload new one
    if (profilePicFile && contact.public_id) {
      // 🔥 A) DELETE ALL PREVIOUS VERSIONS OF THIS public_id
      await cloudinary.api.delete_resources_by_prefix(contact.public_id);

      // 🔥 B) Upload NEW IMAGE with SAME public_id
      const buffer = profilePicFile.buffer;

      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              public_id: contact.public_id,
              overwrite: true,
              invalidate: true,
              folder: "uploads",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(buffer);
      });

      // 🔥 C) Update DB
      contact.profile_pic = uploadResult.secure_url;
    }

    // 5️⃣ Update editable fields
    if (first_name) contact.first_name = first_name;
    if (last_name) contact.last_name = last_name;
    if (relation) contact.relation = relation;
    if (phone_number) contact.phone_number = phone_number;
    if (email) contact.email = email;

    // 6️⃣ Save user document
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Emergency contact updated successfully",
      data: contact,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const DeleteUserEmergencyContact = async (req, res) => {
  try {
    const { user_id, contact_id } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Find contact inside emergency_contact array
    const contact = user.emergency_contacts.id(contact_id);
    if (!contact) {
      return res.status(404).json({ message: "Emergency contact not found" });
    }

    // 3️⃣ Delete profile image from Cloudinary if exists
    if (contact.public_id) {
      try {
        await deleteCloudinaryImage(contact.public_id);
      } catch (err) {
        console.log("Cloudinary delete failed:", err);
      }
    }

    // 4️⃣ Remove contact from array
    user.emergency_contacts = user.emergency_contacts.filter(
      (item) => item._id.toString() !== contact_id
    );

    // 5️⃣ Save updated user
    await user.save();

    return res.status(200).json({
      message: "Emergency contact deleted successfully",
      emergency_contact: user.emergency_contacts,
    });

  } catch (error) {
    console.error("DeleteUserEmergencyContact Error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  AddEmergencyContact,
  UpdateUserEmergencyContact,
  DeleteUserEmergencyContact,
};
