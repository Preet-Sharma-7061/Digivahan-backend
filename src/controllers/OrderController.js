const mongoose = require("mongoose");
const axios = require("axios");
const User = require("../models/User");
const Order = require("../models/OrderSchema");

// ------------------------------
// Shiprocket Order API Function
// ------------------------------
const createShiprocketOrder = async (payload) => {
  try {
    const response = await axios.post(process.env.SHIP_ROCKET_URL, payload, {
      headers: {
        Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    console.log("Shiprocket API Error:", error?.response?.data);
    return null;
  }
};

// ------------------------------
// Format Order Date (YYYY-MM-DD HH:mm)
// ------------------------------
const formatOrderDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// ------------------------------
// Generate Order Controller
// ------------------------------
const GenerateOrder = async (req, res) => {
  try {
    const {
      user_id,
      channel_order_id,
      sub_total,
      order_value,
      declared_value,
      is_prepaid = 1,
      shipping_is_billing = 1,
      is_return = 0,

      // Shipping
      shipping_customer_name,
      shipping_last_name,
      shipping_phone,
      shipping_address,
      shipping_address_2,
      shipping_city,
      shipping_state,
      shipping_country,
      shipping_pincode,
      shipping_email,

      // Billing
      billing_customer_name,
      billing_last_name,
      billing_phone,
      billing_address,
      billing_address_2 = "",
      billing_city,
      billing_state,
      billing_country,
      billing_pincode,

      // Order Item
      vehicle_id,
      name,
      sku = "QR-001",
      units,
      selling_price,
      selling_price_currency = "INR",
      discount = "",
      tax = "",
      weight = 0.05,

      // Parcel dimensions
      length = 20,
      breadth = 15,
      height = 10,
    } = req.body;

    const body = req.body;
    console.log(body);

    // -----------------------------
    // Find User
    // -----------------------------
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "Invalid User ID",
      });
    }

    const currentOrderDate = formatOrderDate();

    // -----------------------------
    // Prepare orderData for Shiprocket
    // -----------------------------
    const orderDataForShiprocket = {
      order_id: channel_order_id,
      order_date: currentOrderDate,

      sub_total,
      order_value,
      payment_method: "Prepaid",
      is_prepaid,
      shipping_is_billing,
      is_return,
      declared_value,

      // Shipping
      shipping_customer_name,
      shipping_last_name,
      shipping_phone,
      shipping_address,
      shipping_address_2,
      shipping_city,
      shipping_state,
      shipping_country,
      shipping_pincode,
      shipping_email,

      // Billing
      billing_customer_name,
      billing_last_name,
      billing_phone,
      billing_address,
      billing_address_2,
      billing_city,
      billing_state,
      billing_country,
      billing_pincode,

      // Parcel dimensions
      length,
      breadth,
      height,
      weight,

      // Order items
      order_items: [
        {
          vehicle_id, // Required by your DB
          name,
          sku,
          units,
          selling_price: Number(selling_price), // Ensure number type
          selling_price_currency,
          discount,
          tax,
          weight,
        },
      ],
    };

    // -----------------------------
    // Call Shiprocket API
    // -----------------------------
    const shiprocketResponse = await createShiprocketOrder(
      orderDataForShiprocket
    );

    if (!shiprocketResponse) {
      return res.status(500).json({
        status: false,
        message: "Shiprocket API error",
      });
    }

    console.log(shiprocketResponse);

    // ------------------------------
    // Save order in MongoDB
    // ------------------------------
    const newOrder = await Order.create({
      user_id, // 👈 add this
      ...orderDataForShiprocket,
      ship_rocket: shiprocketResponse,
    });

    const myorder = {
      ...orderDataForShiprocket,
      ship_rocket: shiprocketResponse,
    };

    await User.findByIdAndUpdate(
      user_id,
      {
        $push: {
          my_orders: {
            order_id: newOrder._id,
            order_data: myorder,
          },
        },
      },
      { new: true }
    );

    return res.status(201).json({
      status: true,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    console.log("Order Creation Error:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const getUserAllOrder = async (req, res) => {
  try {
    const { user_id } = req.body;

    // Validate
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // Find user and get only my_orders field
    const user = await User.findById(user_id).select("my_orders");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // If no orders found
    if (!user.my_orders || user.my_orders.length === 0) {
      return res.status(200).json({
        status: true,
        message: "No orders found for this user",
        orders: [],
      });
    }

    // Return all orders
    return res.status(200).json({
      status: true,
      message: "User orders fetched successfully",
      orders: user.my_orders,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const findSingleOrderData = async (req, res) => {
  try {
    const { user_id, order_id } = req.body;

    // Find user
    const user = await User.findById(user_id).select("my_orders");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Find order inside user.my_orders array
    const specificOrder = user.my_orders.find(
      (order) => order.order_id?.toString() === order_id.toString()
    );

    if (!specificOrder) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    // Success response
    return res.status(200).json({
      status: true,
      message: "Order details fetched successfully",
      order: specificOrder,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const checkCouierService = async (req, res) => {
  try {
    const { delivery_postcode, compareOn } = req.body;

    // Payload
    const payload = {
      pickup_postcode: 110059,
      delivery_postcode,
      cod: 0,
      weight: "0.05",
      mode: "Surface",
      declared_value: 100,
      length: 20,
      breadth: 8,
      height: 4,
      is_return: 0,
      qc_check: 0,
      only_local: 0,
      product_category: "non-document",
      couriers_type: 0,
      address_type: 1,
      is_oda_check: 1,
      payment_mode: "Prepaid",
    };

    const queryString = new URLSearchParams(payload).toString();

    const API_URL = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?${queryString}`;

    console.log("📦 Checking Serviceability => ", API_URL);

    const response = await axios.get(API_URL, {
      headers: {
        Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
      },
    });

    // console.log("🚚 Shiprocket Response:", response.data);

    let courier_companies =
      response.data.data.available_courier_companies || [];

    courier_companies = courier_companies.map((courier) => {
      const freight = Number(courier.freight_charge) || 0;
      const other = Number(courier.other_charges) || 0;

      return {
        ...courier,
        total_price: freight + other,
      };
    });

    if (compareOn === "price") {
      courier_companies.sort((a, b) => a.total_price - b.total_price);
    } else if (compareOn === "days") {
      courier_companies.sort(
        (a, b) =>
          Number(a.estimated_delivery_days) - Number(b.estimated_delivery_days)
      );
    }

    return res.status(200).json({
      status: true,
      message: "Serviceability Fetched Successfully",
      data: courier_companies,
    });
  } catch (error) {
    console.error(
      "❌ Shiprocket Error:",
      error?.response?.data || error.message
    );

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error?.response?.data || error.message,
    });
  }
};

const findOrderByOrderId = async (req, res) => {
  try {
    const { order_id } = req.body;

    // Validate input
    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required",
      });
    }

    // Find order in DB
    const order = await Order.findOne({ order_id });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Order fetched successfully",
      data: order,
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error.message);

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

const findOrderByUserId = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    let query = {};

    // Try converting to ObjectId
    if (mongoose.Types.ObjectId.isValid(user_id)) {
      query.user_id = new mongoose.Types.ObjectId(user_id);
    } else {
      // If not valid ObjectId → search by raw string
      query.user_id = user_id;
    }

    const orders = await Order.find(query);

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No orders found for this user",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    console.error("❌ Error finding orders:", error);

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

module.exports = {
  GenerateOrder,
  getUserAllOrder,
  findSingleOrderData,
  checkCouierService,
  findOrderByOrderId,
  findOrderByUserId,
};
