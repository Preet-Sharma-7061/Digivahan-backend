const User = require("../models/User");

const UserAddAddress = async (req, res) => {
  try {
    const {
      user_id,
      name,
      contact_no,
      house_no_building,
      road_or_area,
      pincode,
      city,
      state,
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
      pincode,
      city,
      state,
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
      road_or_area,
      pincode,
      city,
      state,
    } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ Find address inside address_book array
    const address = user.address_book.id(address_id);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // 3️⃣ If user wants this updated address to be default
    if (user.address_book.length > 0) {
      // Set all old addresses default = false
      user.address_book = user.address_book.map((addr) =>
        addr._id !== address_id ? { ...addr, default_status: false } : addr
      );

      await user.updateOne(
        { _id: user_id },
        { $set: { address_book: user.address_book } }
      );
    }

    // 4️⃣ Update only provided fields
    if (name) address.name = name;
    if (contact_no) address.contact_no = contact_no;
    if (house_no_building) address.house_no_or_building = house_no_building;
    if (road_or_area) address.road_or_area = road_or_area;
    if (pincode) address.pincode = pincode;
    if (city) address.city = city;
    if (state) address.state = state;
    address.default_status = true;

    // 5️⃣ Save user changes
    await user.save();

    return res.status(200).json({
      message: "Address updated successfully",
      address_book: user.address_book,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const DeleteUserAddress = async (req, res) => {
  try {
    const { user_id, address_id } = req.body;

    // 2️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // 3️⃣ Check if the address exists
    const address = user.address_book.id(address_id);
    if (!address) {
      return res.status(404).json({
        status: false,
        message: "Address not found",
      });
    }

    // 4️⃣ Remove the address using Mongoose subdocument pull()
    user.address_book.pull({ _id: address_id });

    // 5️⃣ Save updated user
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

module.exports = { UserAddAddress, UpdateUserAddress, DeleteUserAddress };
