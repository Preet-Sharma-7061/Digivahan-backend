const mongoose = require("mongoose");
const axios = require("axios");
const User = require("../models/User");
const Order = require("../models/OrderSchema");


// ------------------------------
// Generate Order Controller
// ------------------------------
const GenerateOrderByUser = async (req, res) => {
  try {
    const user = await User.findById(req.body.user_id);

    if (!user)
      return res.status(404).json({
        status: false,
        message: "User not found",
      });

    const order = await Order.create({
      user_id: user._id,

      order_id: req.body.order_id,

      sub_total: req.body.sub_total,

      order_value: req.body.order_value,

      declared_value: req.body.declared_value,

      shipping: {
        first_name: req.body.shipping_customer_name,
        last_name: req.body.shipping_last_name,
        phone: req.body.shipping_phone,
        email: req.body.shipping_email,
        address1: req.body.shipping_address,
        address2: req.body.shipping_address_2,
        city: req.body.shipping_city,
        state: req.body.shipping_state,
        country: req.body.shipping_country,
        pincode: req.body.shipping_pincode,
      },

      billing: {
        first_name: req.body.billing_customer_name,
        last_name: req.body.billing_last_name,
        phone: req.body.billing_phone,
        address1: req.body.billing_address,
        address2: req.body.billing_address_2,
        city: req.body.billing_city,
        state: req.body.billing_state,
        country: req.body.billing_country,
        pincode: req.body.billing_pincode,
      },

      parcel: {
        length: req.body.length,
        breadth: req.body.breadth,
        height: req.body.height,
        weight: req.body.weight,
      },

      order_items: [
        {
          vehicle_id: req.body.vehicle_id,
          order_type: req.body.order_type,
          name: req.body.name,
          sku: req.body.sku,
          units: req.body.units,
          selling_price: req.body.selling_price,
        },
      ],

      ship_rocket: {
        channel_order_id: req.body.order_id,
        courier_company_id: req.body.courier_company_id,
        courier_name: req.body.courier_name,
      },
    });

    await User.findByIdAndUpdate(user._id, {
      $push: { my_orders: order._id },
    });

    res.status(201).json({
      status: true,
      message: "Order created",
      data: order,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// Order confirm By admin
const ConfirmOrderByAdmin = async (req, res) => {
  // const session = await mongoose.startSession();

  try {
    // session.startTransaction();

    const { order_id } = req.body;

    if (!order_id)
      return res.status(400).json({
        status: false,
        message: "order_id required",
      });

    // STEP 1: Fetch Order
    // const order = await Order.findById(order_id).session(session);
    const order = await Order.findById(order_id);

    if (!order) {
      // await session.abortTransaction();
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    // STEP 2: Prevent duplicate processing
    if (order.ship_rocket?.shipment_id) {
      // await session.abortTransaction();

      return res.status(400).json({
        status: false,
        message: "Shiprocket already created for this order",
      });
    }

    if (order.order_status !== "NEW") {
      // await session.abortTransaction();

      return res.status(400).json({
        status: false,
        message: `Order already ${order.order_status}`,
      });
    }

    /* ------------------------------------------------
       STEP 3: BUILD SHIPROCKET PAYLOAD
    ------------------------------------------------ */

    const orderItemsPayload = order.order_items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.units,
      selling_price: item.selling_price,
      selling_price_currency: item.selling_price_currency,
      weight: item.weight,
    }));

    // Optional delivery charges item
    orderItemsPayload.push({
      name: "Delivery Charges",
      sku: "SHIP-001",
      units: 1,
      selling_price: order.sub_total,
      selling_price_currency: "INR",
    });

    const shiprocketPayload = {
      order_id: order.order_id,

      order_date: order.order_date,

      sub_total: order.sub_total,

      order_value: order.order_value,

      payment_method: order.payment_method,

      is_prepared: order.is_prepared,

      shipping_is_billing: order.shipping_is_billing,

      is_return: order.is_return,

      declared_value: order.declared_value,

      // SHIPPING
      shipping_customer_name: order.shipping.first_name,

      shipping_last_name: order.shipping.last_name,

      shipping_phone: order.shipping.phone,

      shipping_address: order.shipping.address1,

      shipping_address_2: order.shipping.address2,

      shipping_city: order.shipping.city,

      shipping_state: order.shipping.state,

      shipping_country: order.shipping.country,

      shipping_pincode: order.shipping.pincode,

      shipping_email: order.shipping.email,

      // BILLING
      billing_customer_name: order.billing.first_name,

      billing_last_name: order.billing.last_name,

      billing_phone: order.billing.phone,

      billing_address: order.billing.address1,

      billing_address_2: order.billing.address2,

      billing_city: order.billing.city,

      billing_state: order.billing.state,

      billing_country: order.billing.country,

      billing_pincode: order.billing.pincode,

      // PARCEL
      length: order.parcel.length,

      breadth: order.parcel.breadth,

      height: order.parcel.height,

      weight: order.parcel.weight,

      // ITEMS
      order_items: orderItemsPayload,
    };

    /* ------------------------------------------------
       STEP 4: CREATE ORDER IN SHIPROCKET
    ------------------------------------------------ */

    const shiprocketResponse = await createShiprocketOrder(shiprocketPayload);

    if (!shiprocketResponse?.shipment_id) {
      throw new Error("Shiprocket order creation failed");
    }

    /* ------------------------------------------------
       STEP 5: GENERATE AWB
    ------------------------------------------------ */

    const awbPayload = {
      shipment_id: shiprocketResponse.shipment_id,
      courier_company_id: order.ship_rocket.courier_company_id,
    };

    const awbResponse = await GenerateAWBShipment(awbPayload);

    if (!awbResponse?.response?.data?.awb_code) {
      throw new Error("AWB generation failed");
    }

    /* ------------------------------------------------
       STEP 6: GENERATE PICKUP
    ------------------------------------------------ */

    const pickupResponse = await GeneratePickUp([
      shiprocketResponse.shipment_id,
    ]);

    /* ------------------------------------------------
       STEP 7: SAVE ALL DATA
    ------------------------------------------------ */

    order.ship_rocket = {
      ...order.ship_rocket,

      order_id: shiprocketResponse.order_id,

      shipment_id: shiprocketResponse.shipment_id,

      status_code: shiprocketResponse.status_code,

      onboarding_completed_now: shiprocketResponse.onboarding_completed_now,

      awb_code: awbResponse.response.data.awb_code,

      new_channel: shiprocketResponse.new_channel,

      status: "PENDING",
    };

    order.awb_data = awbResponse;

    order.pickup_data = pickupResponse;

    order.order_status = "PENDING";

    order.is_prepared = true;

    await order.save();
    // await order.save({ session });

    /* ------------------------------------------------
       STEP 8: UPDATE USER REFERENCE ONLY (NO DUPLICATE)
    ------------------------------------------------ */

    await User.updateOne(
      { _id: order.user_id },
      {
        $addToSet: { my_orders: order._id },
      },
      // { session },
    );

    // await session.commitTransaction();

    return res.status(200).json({
      status: true,
      message: "Order confirmed, AWB generated, Pickup scheduled",
      data: order,
      pickupResponse: pickupResponse,
    });
  } catch (error) {
    // await session.abortTransaction();

    console.error("ConfirmOrder Error:", error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  } finally {
    // session.endSession();
    console.log("Order Confirmed!");
  }
};

// ------------------------------
// Shiprocket Order API Function
// ------------------------------
const createShiprocketOrder = async (payload) => {
  try {
    const response = await axios.post(
      `https://apiv2.shiprocket.in/v1/external/orders/create/adhoc`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.log("Shiprocket API Error:", error?.response?.data);
    return null;
  }
};

// ------------------------------
// AWB Shipment API Function
// ------------------------------

const GenerateAWBShipment = async (payload) => {
  try {
    const url = "https://apiv2.shiprocket.in/v1/external/courier/assign/awb";

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
      },
    });

    // 👉 PURE SHIPROCKET RESPONSE RETURN
    return response.data;
  } catch (error) {
    console.error(
      "GenerateAWBShipment Error:",
      error?.response?.data || error.message,
    );

    throw {
      message: "Failed to generate AWB",
      error: error?.response?.data || error.message,
    };
  }
};

// ------------------------------
// Generate Pickup API Function
// ------------------------------

const GeneratePickUp = async (payload) => {
  try {
    const url =
      "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup";

    const response = await axios.post(
      url,
      {
        shipment_id: payload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
        },
      },
    );

    // 🔥 FULL RESPONSE AS-IT-IS
    return response.data;
  } catch (error) {
    console.error(
      "GeneratePickUp Error:",
      error?.response?.data || error.message,
    );

    throw {
      message: "Failed to generate pickup",
      error: error?.response?.data || error.message,
    };
  }
};

// ------------------------------
// Generate Manifest API Function
// ------------------------------

const GenerateOrderManifest = async (req, res) => {
  try {
    const { order_id } = req.params;

    // 1️⃣ Validate input
    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required",
      });
    }

    // 2️⃣ Find order
    const order = await Order.findById(order_id);

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    // 3️⃣ NEW VALIDATION: Prevent manifest for canceled orders
    if (order.order_status === "CANCELED") {
      return res.status(400).json({
        status: false,
        message: "Manifest cannot be generated for canceled order",
      });
    }

    // 4️⃣ Check shipment_id exists
    const shipment_id = order.ship_rocket?.shipment_id;

    if (!shipment_id) {
      return res.status(400).json({
        status: false,
        message: "Shipment ID not found. Generate AWB first.",
      });
    }

    // 5️⃣ Prevent duplicate manifest generation
    if (order.ship_rocket?.manifest_url) {
      return res.status(200).json({
        status: true,
        message: "Manifest already generated",
        data: {
          order_id: order._id,
          shipment_id,
          manifest_url: order.ship_rocket.manifest_url,
        },
      });
    }

    // 6️⃣ Call Shiprocket Manifest API
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/manifests/generate",
      {
        shipment_id: [shipment_id],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const manifestUrl = response?.data?.manifest_url;

    if (!manifestUrl) {
      return res.status(500).json({
        status: false,
        message: "Manifest generation failed",
        shiprocket_response: response.data,
      });
    }

    // 7️⃣ Save manifest in DB
    order.ship_rocket.manifest_url = manifestUrl;
    order.ship_rocket.manifest_generated_at = new Date();

    await order.save();

    // 8️⃣ Success response
    return res.status(200).json({
      status: true,
      message: "Manifest generated successfully",
      data: {
        order_id: order._id,
        shipment_id,
        manifest_url: manifestUrl,
      },
    });
  } catch (error) {
    console.error(
      "GenerateOrderManifest Error:",
      error?.response?.data || error.message,
    );

    return res.status(500).json({
      status: false,
      message: "Failed to generate manifest",
      error: error?.response?.data || error.message,
    });
  }
};

// ------------------------------
// Generate Lable API Function
// ------------------------------

const GenerateLable = async (req, res) => {
  try {
    const { order_id } = req.params;

    // 1️⃣ Validate input
    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required",
      });
    }

    // 2️⃣ Find order
    const order = await Order.findById(order_id);

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }


    // 3️⃣ Check shipment_id exists
    const shipment_id = order.ship_rocket?.shipment_id;

    if (!shipment_id) {
      return res.status(400).json({
        status: false,
        message: "Shipment ID not found. Generate AWB first.",
      });
    }

    // 4️⃣ Prevent duplicate label generation
    if (order.ship_rocket?.label_url) {
      return res.status(200).json({
        status: true,
        message: "Label already generated",
        data: {
          order_id: order._id,
          shipment_id,
          label_url: order.ship_rocket.label_url,
        },
      });
    }

    // 5️⃣ Call Shiprocket Label API
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/courier/generate/label",
      {
        shipment_id: [shipment_id],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // 6️⃣ Correct response extraction
    const labelUrl =
      response?.data?.label_url ||
      response?.data?.response?.label_url;

    if (!labelUrl) {
      return res.status(500).json({
        status: false,
        message: "Label generation failed",
        shiprocket_response: response.data,
      });
    }

    // 7️⃣ Save label URL in DB
    order.ship_rocket.label_url = labelUrl;
    order.ship_rocket.label_generated_at = new Date();

    await order.save();

    // 8️⃣ Return success
    return res.status(200).json({
      status: true,
      message: "Label generated successfully",
      data: {
        order_id: order._id,
        shipment_id,
        label_url: labelUrl,
      },
    });

  } catch (error) {
    console.error(
      "GenerateLabel Error:",
      error?.response?.data || error.message
    );

    return res.status(500).json({
      status: false,
      message: "Failed to generate label",
      error: error?.response?.data || error.message,
    });
  }
};


// ------------------------------
// Get All Order From user My-order node
// ------------------------------

const getUserAllOrder = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // Verify user exists
    const userExists = await User.exists({ _id: user_id });

    if (!userExists) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Fetch orders directly from Order schema
    const orders = await Order.find({ user_id })
      .sort({ createdAt: -1 }) // latest first
      .lean(); // faster performance

    return res.status(200).json({
      status: true,
      message: "User orders fetched successfully",
      total: orders.length,
      orders,
    });
  } catch (error) {
    console.error("getUserAllOrder Error:", error);

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

// ------------------------------
// Find Single Order Details
// --
const findSingleOrderData = async (req, res) => {
  try {
    const { user_id, order_id } = req.body;

    // Validate input
    if (!user_id || !order_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and order_id are required",
      });
    }

    // Find order directly from Order schema
    const order = await Order.findOne({
      _id: order_id,
      user_id: user_id,
    }).lean();

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Order details fetched successfully",
      order,
    });
  } catch (error) {
    console.error("findSingleOrderData Error:", error);

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error.message,
    });
  }
};

// ------------------------------
// Filter Courier Service Company on the basis of Price & Date
// --
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

    let estimated1 = courier_companies.sort(
      (a, b) => a.total_price - b.total_price,
    );
    let estimated2 = courier_companies.sort(
      (a, b) =>
        Number(a.estimated_delivery_days) - Number(b.estimated_delivery_days),
    );

    if (compareOn === "price") {
      courier_companies.sort((a, b) => a.total_price - b.total_price);
    } else if (compareOn === "days") {
      courier_companies.sort(
        (a, b) =>
          Number(a.estimated_delivery_days) - Number(b.estimated_delivery_days),
      );
    }

    return res.status(200).json({
      status: true,
      message: "Serviceability Fetched Successfully",
      is_fast_delivery:
        estimated1[0].estimated_delivery_days ===
        estimated2[0].estimated_delivery_days
          ? false
          : true,
      data: {
        courier_company_id: courier_companies[0].courier_company_id,
        courier_name: courier_companies[0].courier_name,
        estimated_delivery_days: courier_companies[0].estimated_delivery_days,
        freight_charge: courier_companies[0].freight_charge,
        suppress_date: courier_companies[0].suppress_date,
      },
    });
  } catch (error) {
    console.error(
      "❌ Shiprocket Error:",
      error?.response?.data || error.message,
    );

    return res.status(500).json({
      status: false,
      message: "Something went wrong",
      error: error?.response?.data || error.message,
    });
  }
};

// ------------------------------
// Get Order Details By Admin
// --
const findOrderByAdminThrowOrderId = async (req, res) => {
  try {
    const { order_id } = req.body;

    // Validate input
    if (!order_id || typeof order_id !== "string") {
      return res.status(400).json({
        status: false,
        message: "Valid order_id is required",
      });
    }

    // Fetch order using indexed field
    const order = await Order.findOne(
      { order_id },
      {}, // projection (optional)
      { lean: true }, // improves performance
    );

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
    console.error("findOrderByOrderId Error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ------------------------------
// Get All Order by userId Order node
// --

const findOrderByAdminThrowUserId = async (req, res) => {
  try {
    const { user_id, page = 1, limit = 20 } = req.body;

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required",
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user_id",
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(user_id);

    // Pagination calculation
    const skip = (page - 1) * limit;

    // Fetch orders
    const orders = await Order.find({ user_id: userObjectId }, null, {
      sort: { createdAt: -1 }, // latest first
      skip,
      limit,
      lean: true,
    });

    // Get total count
    const totalOrders = await Order.countDocuments({
      user_id: userObjectId,
    });

    return res.status(200).json({
      status: true,
      message: "Orders fetched successfully",

      pagination: {
        total: totalOrders,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(totalOrders / limit),
      },

      data: orders,
    });
  } catch (error) {
    console.error("findOrderByAdminThrowUserId Error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ------------------------------
// Get All New Order list to Admin
// --
const GetAllNewOrderListToAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.body;

    // pagination calculation
    const skip = (page - 1) * limit;

    // fetch NEW orders
    const orders = await Order.find({ order_status: "NEW" }, null, {
      sort: { createdAt: -1 }, // latest first
      skip: skip,
      limit: Number(limit),
      lean: true, // improves performance
    }).populate({
      path: "user_id",
      select: "name email phone", // optional user info
    });

    // total count
    const total = await Order.countDocuments({
      order_status: "NEW",
    });

    return res.status(200).json({
      status: true,
      message: "New orders fetched successfully",

      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / limit),
      },

      data: orders,
    });
  } catch (error) {
    console.error("GetAllNewOrderListToAdmin Error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch new orders",
      error: error.message,
    });
  }
};

// ------------------------------
// This apis only hit by user
const OrderCancelByUser = async (req, res) => {
  try {
    const { order_id, user_id } = req.body;

    // Validate input
    if (!order_id || !user_id) {
      return res.status(400).json({
        status: false,
        message: "order_id and user_id are required",
      });
    }

    // Find order with user validation
    const order = await Order.findOne({
      _id: order_id,
      user_id: user_id,
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found",
      });
    }

    // Prevent cancel if already prepared
    if (order.is_prepared === true) {
      return res.status(400).json({
        status: false,
        message: "Order already prepared, cannot cancel",
      });
    }

    // Prevent cancel if shipment already created
    if (order.ship_rocket?.shipment_id || order.ship_rocket?.awb_code) {
      return res.status(400).json({
        status: false,
        message: "Shipment already created, cannot cancel this order",
      });
    }

    // Prevent cancel if already canceled
    if (order.order_status === "CANCELED") {
      return res.status(400).json({
        status: false,
        message: "Order already canceled",
      });
    }

    // Cancel order
    order.order_status = "CANCELED";
    order.canceled_at = new Date();

    await order.save();

    return res.status(200).json({
      status: true,
      message: "Order canceled successfully",
      data: order,
    });
  } catch (error) {
    console.error("OrderCancelByUser Error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// ------------------------------
// Order Cancel By Admin
// --
const OrderCancelByAdmin = async (req, res) => {
  try {
    const { user_id, order_id } = req.body;

    // Validate input
    if (!user_id || !order_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and order_id are required",
      });
    }

    // 1️⃣ Find order with user validation (SECURE + FAST)
    const order = await Order.findOne({
      _id: order_id,
      user_id: user_id,
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    // 2️⃣ Check Shiprocket order exists
    const shiprocketOrderId = order.ship_rocket?.order_id;

    if (!shiprocketOrderId) {
      return res.status(400).json({
        status: false,
        message: "Shiprocket order id not found",
      });
    }

    // 3️⃣ Prevent duplicate cancel
    if (order.order_status === "CANCELED") {
      return res.status(400).json({
        status: false,
        message: "Order already canceled",
      });
    }

    // 4️⃣ Call Shiprocket Cancel API
    const cancelResponse = await cancelShiprocketOrder(shiprocketOrderId);

    if (!cancelResponse) {
      return res.status(400).json({
        status: false,
        message: "Shiprocket cancellation failed",
      });
    }

    // 5️⃣ Update Order schema
    order.order_status = "CANCELED";

    order.ship_rocket.status = "CANCELED";

    order.ship_rocket.awb_code = "";

    order.canceled_at = new Date();

    await order.save();

    return res.status(200).json({
      status: true,
      message: "Order canceled successfully",

      data: {
        order_id: order._id,
        shiprocket_order_id: shiprocketOrderId,
        shiprocket_response: cancelResponse,
      },
    });
  } catch (error) {
    console.error(
      "OrderCancelByAdmin Error:",
      error?.response?.data || error.message,
    );

    return res.status(500).json({
      status: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

// Ship Rocket cancel order apis
const cancelShiprocketOrder = async (orderId) => {
  try {
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/orders/cancel",
      {
        ids: [orderId],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error(
      "Shiprocket cancel order error:",
      error?.response?.data || error.message,
    );
    throw error;
  }
};

// Track Order Status
const TrackOrderwithOrderId = async (req, res) => {
  try {
    const { user_id, order_id } = req.body;

    // 1️⃣ Validate input
    if (!user_id || !order_id) {
      return res.status(400).json({
        status: false,
        message: "user_id and order_id are required",
      });
    }

    // 2️⃣ Find order securely
    const order = await Order.findOne({
      _id: order_id,
      user_id: user_id,
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found for this user",
      });
    }

    // 3️⃣ Get Shiprocket order id automatically
    const shiprocketOrderId = order.ship_rocket?.order_id;

    if (!shiprocketOrderId) {
      return res.status(400).json({
        status: false,
        message: "Shiprocket order id not found for tracking",
      });
    }

    // 4️⃣ Call Shiprocket tracking API
    const trackingData = await trackShiprocketOrder(shiprocketOrderId);

    if (!trackingData) {
      return res.status(400).json({
        status: false,
        message: "Tracking API failed",
      });
    }

    // 5️⃣ Extract tracking info safely
    const shipment = trackingData?.data?.shipments?.[0] || {};

    const shipmentStatus =
      shipment?.current_status || trackingData?.data?.status || "UNKNOWN";

    const awbCode = shipment?.awb || order.ship_rocket?.awb_code || "";

    const courierName =
      shipment?.courier || order.ship_rocket?.courier_name || "";

    // 6️⃣ Update Order schema
    order.order_status = shipmentStatus;

    order.ship_rocket.status = shipmentStatus;

    order.ship_rocket.awb_code = awbCode;

    order.ship_rocket.courier_name = courierName;

    order.ship_rocket.tracking_data = trackingData;

    order.last_tracked_at = new Date();

    await order.save();

    // 7️⃣ Response
    return res.status(200).json({
      status: true,
      message: "Order tracked successfully",

      data: {
        order_id: order._id,
        shiprocket_order_id: shiprocketOrderId,
        shipment_status: shipmentStatus,
        awb_code: awbCode,
        courier_name: courierName,
        tracking: trackingData,
      },
    });
  } catch (error) {
    console.error("TrackOrder Error:", error?.response?.data || error.message);

    return res.status(500).json({
      status: false,
      message: "Failed to track order",
      error: error.message,
    });
  }
};

// Shiprocket Order Track Function
const trackShiprocketOrder = async (shiprocketOrderId) => {
  const url = `https://apiv2.shiprocket.in/v1/external/orders/show/${shiprocketOrderId}`;

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.SHIP_ROCKET_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
};

module.exports = {
  GenerateOrderByUser,
  ConfirmOrderByAdmin,
  GenerateOrderManifest,
  GenerateLable,
  getUserAllOrder,
  findSingleOrderData,
  checkCouierService,
  GetAllNewOrderListToAdmin,
  findOrderByAdminThrowOrderId,
  findOrderByAdminThrowUserId,
  OrderCancelByAdmin,
  OrderCancelByUser,
  TrackOrderwithOrderId,
};
