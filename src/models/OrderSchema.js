const mongoose = require("mongoose");
const { Schema } = mongoose;

/* ----------------------------------
   ORDER ITEM SCHEMA
-----------------------------------*/
const orderItemSchema = new Schema(
  {
    vehicle_id: {
      type: String,
      index: true,
    },

    order_type: {
      type: String,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    sku: {
      type: String,
      default: "QR-001",
      index: true,
    },

    units: {
      type: Number,
      required: true,
      min: 1,
    },

    selling_price: {
      type: Number,
      required: true,
      min: 0,
    },

    selling_price_currency: {
      type: String,
      default: "INR",
    },

    weight: {
      type: Number,
      default: 0.05,
      min: 0,
    },
  },
  { _id: false },
);

/* ----------------------------------
   SHIPROCKET SCHEMA
-----------------------------------*/
const shiprocketStatusSchema = new Schema(
  {
    order_id: {
      type: String,
      index: true,
    },

    channel_order_id: {
      type: String,
      index: true,
    },

    shipment_id: {
      type: Number,
      index: true,
    },

    status: {
      type: String,
      index: true,
    },

    status_code: {
      type: Number,
      default: 5,
      index: true,
    },

    awb_code: {
      type: String,
    },

    courier_company_id: {
      type: Number,
      index: true,
    },

    courier_name: {
      type: String,
      index: true,
    },

    new_channel: {
      type: Boolean,
      default: false,
    },

    packaging_box_error: {
      type: String,
    },

    manifest_url: {
      type: String,
      index: true,
    },

    manifest_generated_at: Date,

    label_url: {
      type: String,
      index: true,
    },

    label_generated_at: Date,
    tracking_data: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

/* ----------------------------------
   MAIN ORDER SCHEMA
-----------------------------------*/
const orderSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    order_date: {
      type: Date,
      default: Date.now,
      index: true,
    },

    sub_total: {
      type: Number,
      required: true,
      index: true,
    },

    order_value: {
      type: Number,
      required: true,
      index: true,
    },

    declared_value: {
      type: Number,
      required: true,
    },

    order_status: {
      type: String,
      enum: [
        "NEW",
        "PENDING",
        "CONFIRMED",
        "SHIPPED",
        "DELIVERED",
        "CANCELED",
        "RETURNED",
        "PICKUP SCHEDULED",
      ],
      default: "NEW",
      index: true,
    },

    payment_method: {
      type: String,
      enum: ["Prepaid", "COD"],
      default: "Prepaid",
      index: true,
    },

    is_prepared: {
      type: Boolean,
      default: false,
      index: true,
    },

    shipping_is_billing: {
      type: Boolean,
      default: true,
    },

    is_return: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* -----------------
       SHIPPING INFO
    ------------------*/

    shipping: {
      first_name: String,
      last_name: String,
      phone: {
        type: String,
        index: true,
      },
      email: {
        type: String,
        index: true,
      },
      address1: String,
      address2: String,
      city: {
        type: String,
        index: true,
      },
      state: {
        type: String,
        index: true,
      },
      country: String,
      pincode: {
        type: String,
        index: true,
      },
    },

    /* -----------------
       BILLING INFO
    ------------------*/

    billing: {
      first_name: String,
      last_name: String,
      phone: String,
      address1: String,
      address2: String,
      city: String,
      state: String,
      country: String,
      pincode: String,
    },

    /* -----------------
       PARCEL
    ------------------*/

    parcel: {
      length: Number,
      breadth: Number,
      height: Number,
      weight: Number,
    },

    /* -----------------
       ITEMS ARRAY
    ------------------*/

    order_items: {
      type: [orderItemSchema],
      required: true,
      index: true,
    },

    /* -----------------
       SHIPROCKET
    ------------------*/

    ship_rocket: shiprocketStatusSchema,
    last_tracked_at: {
      type: Date,
      index: true,
    },

    awb_data: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  },
);

/* ----------------------------------
   COMPOUND INDEXES (CRITICAL)
-----------------------------------*/

// fetch user's orders fast
orderSchema.index({ user_id: 1, createdAt: -1 });

// dashboard queries
orderSchema.index({ order_status: 1, createdAt: -1 });

// shiprocket tracking
orderSchema.index({ "ship_rocket.awb_code": 1 });

// search
orderSchema.index({ order_id: 1, user_id: 1 });

module.exports = mongoose.model("Order", orderSchema);
