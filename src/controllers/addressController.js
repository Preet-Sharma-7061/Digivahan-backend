const User = require("../models/User");

const UserAddAddress = async (req, res) => {
  try {
    const {
      user_id,
      name,
      contact_no,
      house_no_building,
      road_or_area,
      street_name,
      pincode,
      city,
      state,
      landmark,
      default_status,
    } = req.body;

    // 2️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const newAddress = {
      name,
      contact_no,
      house_no_building,
      road_or_area,
      street_name,
      pincode,
      city,
      state,
      landmark,
      default: default_status,
    };

    // If new address is default
    if (user.address_book.length > 0) {
      // Set all old addresses default = false
      user.address_book = user.address_book.map((addr) => ({
        ...addr,
        default_status: false,
      }));

      // First update existing address book
      await User.updateOne(
        { _id: user_id },
        { $set: { address_book: user.address_book } }
      );
    }

    // Now push the new address
    await User.updateOne(
      { _id: user_id },
      { $push: { address_book: newAddress } }
    );

    return res.status(201).json({
      status: true,
      message: "Address added successfully",
      data: newAddress,
    });
  } catch (error) {
    console.error("UserAddAddress Error:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const UpdateUserAddress = async (req, res) => {
  try {
    const {
      user_id,
      address_id,
      name,
      contact_no,
      house_no_building,
      street_name,
      road_or_area,
      pincode,
      city,
      state,
      landmark,
    } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Find address
    const address = user.address_book.id(address_id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // 3️⃣ Make all addresses default = false
    user.address_book.forEach((addr) => {
      addr.default_status = false;
    });

    // 4️⃣ Update address fields
    if (name) address.name = name;
    if (contact_no) address.contact_no = contact_no;
    if (house_no_building) address.house_no_building = house_no_building;
    if (street_name) address.street_name = street_name;
    if (road_or_area) address.road_or_area = road_or_area;
    if (pincode) address.pincode = pincode;
    if (city) address.city = city;
    if (state) address.state = state;
    if (landmark) address.landmark = landmark;

    // 5️⃣ Set current address as default
    address.default_status = true;

    // 🟢 6️⃣ Recalculate profile completion %
    user.basic_details.profile_completion_percent =
      calculateProfileCompletion(user);

    // 7️⃣ Save once
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Address updated successfully",
      profile_completion_percent: user.basic_details.profile_completion_percent,
      address_book: user.address_book,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const DeleteUserAddress = async (req, res) => {
  try {
    const { user_id, address_id } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 2️⃣ Find address
    const address = user.address_book.id(address_id);
    if (!address) {
      return res.status(404).json({
        status: false,
        message: "Address not found",
      });
    }

    const isDeletingDefault = address.default_status === true;

    // 3️⃣ Remove the address
    user.address_book.pull({ _id: address_id });

    // 4️⃣ If deleted address was default → set FIRST address as default
    if (isDeletingDefault && user.address_book.length > 0) {
      // ✅ ensure only one default
      user.address_book.forEach((addr) => {
        addr.default_status = false;
      });

      // ✅ first address becomes default
      user.address_book[0].default_status = true;
    }

    // 5️⃣ Save user
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Address deleted successfully",
      address_book: user.address_book,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Profile fields define

const PROFILE_FIELDS = {
  basic_details: [
    "profile_pic",
    "first_name",
    "last_name",
    "phone_number",
    "email",
    "occupation",
  ],
  public_details: ["public_pic", "nick_name", "address", "age", "gender"],
};

const TOTAL_FIELDS =
  PROFILE_FIELDS.basic_details.length + PROFILE_FIELDS.public_details.length;

const PER_FIELD_PERCENT = Math.floor(100 / TOTAL_FIELDS);

// Calculator profile percentage function
const calculateProfileCompletion = (user) => {
  let completed = 0;

  PROFILE_FIELDS.basic_details.forEach((field) => {
    const val = user.basic_details?.[field];
    if (val !== undefined && val !== null && val !== "" && val !== 0) {
      completed++;
    }
  });

  PROFILE_FIELDS.public_details.forEach((field) => {
    const val = user.public_details?.[field];
    if (val !== undefined && val !== null && val !== "" && val !== 0) {
      completed++;
    }
  });

  return Math.min(completed * PER_FIELD_PERCENT, 100);
};

module.exports = { UserAddAddress, UpdateUserAddress, DeleteUserAddress };
