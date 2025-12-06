const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    // required: true,
    trim: true,
  },
  contact_no: {
    type: String,
    // required: true,
    trim: true,
  },
  house_no_or_building: {
    type: String,
    // required: true,
    trim: true,
  },
  road_or_area: {
    type: String,
    // required: true,
    trim: true,
  },
  pincode: {
    type: String,
    // required: true,
    trim: true,
  },
  city: {
    type: String,
    // required: true,
    trim: true,
  },
  state: {
    type: String,
    // required: true,
    trim: true,
  },
  default_status: {
    type: Boolean,
    default: true,
  },
});

const emergencyContactSchema = new mongoose.Schema({
  first_name: {
    type: String,
    // required: true,
    trim: true,
  },
  last_name: {
    type: String,
    // required: true,
    trim: true,
  },
  profile_pic: {
    type: String,
    default: "",
  },
  public_id: {
    type: String,
    default: "",
  },
  relation: {
    type: String,
    // required: true,
    trim: true,
  },
  phone_number: {
    type: String,
    // required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
});

const vehicleDocumentSchema = new mongoose.Schema({
  insurance: {
    file_url: {
      type: String,
      default: "",
    },
  },
  pollution: {
    file_url: {
      type: String,
      default: "",
    },
  },
  registration: {
    file_url: {
      type: String,
      default: "",
    },
  },
  fitness: {
    file_url: {
      type: String,
      default: "",
    },
  },
  permit: {
    file_url: {
      type: String,
      default: "",
    },
  },
  other_documents: [
    {
      doc_name: {
        type: String,
        // required: true,
      },
      doc_number: {
        type: String,
        // required: true,
      },
      doc_url: {
        type: String,
        // required: true,
      },
    },
  ],
});

const vehicleInfoSchema = new mongoose.Schema({
  owner_name: {
    type: String,
    // required: true,
    trim: true,
  },
  vehicle_number: {
    type: String,
    // required: true,
    trim: true,
    // unique: true,
  },
  vehicle_name: {
    type: String,
    // required: true,
    trim: true,
  },
  registration_date: {
    type: Date,
    default: null,
    // required: true,
  },
  ownership_details: {
    type: String,
    // required: true,
    trim: true,
  },
  financer_name: {
    type: Object || String,
    trim: true,
  },
  registered_rto: {
    type: String,
    // required: true,
    trim: true,
  },
  makers_model: {
    type: String,
    // required: true,
    trim: true,
  },
  makers_name: {
    type: String,
    // required: true,
    trim: true,
  },
  vehicle_class: {
    type: String,
    // required: true,
    trim: true,
  },
  fuel_type: {
    type: String,
    // required: true,
    trim: true,
  },
  fuel_norms: {
    type: String,
    // required: true,
    trim: true,
  },
  engine: {
    type: String,
    // required: true,
    trim: true,
  },
  chassis_number: {
    type: String,
    // required: true,
    trim: true,
    // unique: true,
  },
  insurer_name: {
    type: String,
    // required: true,
    trim: true,
  },
  insurance_type: {
    type: String,
    // required: true,
    trim: true,
  },
  insurance_expiry: {
    type: Date,
    default: null,
    // required: true,
  },
  insurance_renewed_date: {
    type: Date,
    default: null,
    // required: true,
  },
  vehicle_age: {
    type: String,
    // required: true,
    trim: true,
  },
  fitness_upto: {
    type: Date,
    default: null,
    // required: true,
  },
  pollution_renew_date: {
    type: Date,
    default: null,
    // required: true,
  },
  pollution_expiry: {
    type: Date,
    default: null,
    // required: true,
  },
  color: {
    type: String,
    // required: true,
    trim: true,
  },
  unloaded_weight: {
    type: String,
    // required: true,
    trim: true,
  },
  rc_status: {
    type: String,
    // required: true,
    trim: true,
  },
  insurance_policy_number: {
    type: String,
    // required: true,
    trim: true,
  },
});

const vehicleSchema = new mongoose.Schema({
  vehicle_id: {
    type: String,
    // required: true,
    // unique: true,
  },
  vehicle_info: vehicleInfoSchema,
  vehicle_documents: vehicleDocumentSchema,
});

const garageSchema = new mongoose.Schema({
  security_code: {
    type: String,
    default: "",
  },
  vehicles: [vehicleSchema],
});

const notificationSchema = new mongoose.Schema({
  notification_id: {
    type: String,
    // required: true,
    // unique: true,
  },
  sender_id: {
    type: String,
    // required: true,
  },
  sender_pic_url: {
    type: String,
    default: "",
  },
  name: {
    type: String,
    // required: true,
    trim: true,
  },
  time: {
    type: Date || String,
    // required: true,
  },
  notification_type: {
    type: String,
    // required: true,
    trim: true,
  },
  notification_text: {
    type: String,
    // required: true,
    trim: true,
  },
  link: {
    type: String,
    default: "",
  },
  vehicle_or_item_id: {
    type: String,
    default: "",
  },
});

const userSchema = new mongoose.Schema({
  basic_details: {
    profile_pic_url: { type: String, default: "" },
    first_name: { type: String, trim: true },
    last_name: { type: String, trim: true },
    phone_number: { type: String, trim: true, unique: true },
    phone_number_verified: { type: Boolean, default: false },
    is_phone_number_primary: { type: Boolean, default: true },
    email: { type: String, trim: true, unique: true, lowercase: true },
    is_email_verified: { type: Boolean, default: false },
    is_email_primary: { type: Boolean, default: false },
    password: { type: String },
    occupation: { type: String, default: "" },
    profile_completion_percent: { type: Number, default: 0, min: 0, max: 100 },
  },
  public_details: {
    public_pic_url: { type: String, default: "" },
    nick_name: { type: String, default: "" },
    address: { type: String, default: "" },
    age: { type: Number, default: 0 },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
  },
  old_passwords: {
    previous_password1: { type: String, default: "" },
    previous_password2: { type: String, default: "" },
    previous_password3: { type: String, default: "" },
    previous_password4: { type: String, default: "" },
  },
  live_tracking: {
    is_tracking_on: { type: Boolean, default: false },
  },
  notifications: [notificationSchema],
  my_orders: [{ type: String }],
  address_book: [addressSchema],
  chat_box: [{ type: String }],
  emergency_contacts: [emergencyContactSchema],
  garage: garageSchema,
  is_active: { type: Boolean, default: true },
  is_logged_in: { type: Boolean, default: false },
  suspended_until: { type: Date, default: null },
  suspension_reason: { type: String, default: "" },
  account_status: {
    type: String,
    enum: ["ACTIVE", "PENDING_DELETION", "DELETED", "SUSPENDED"],
    default: "ACTIVE",
    index: true,
  },
  deletion_date: { type: Date, default: null, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("basic_details.password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.basic_details.password = await bcrypt.hash(
      this.basic_details.password,
      salt
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Update updated_at field before saving
userSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.basic_details.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    {
      userId: this._id,
      email: this.basic_details.email,
      phone: this.basic_details.phone_number,
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "7d" }
  );
};

// Check if user is suspended
userSchema.methods.isSuspended = function () {
  if (!this.suspended_until) {
    return false;
  }
  return new Date() < this.suspended_until;
};

// Get suspension status
userSchema.methods.getSuspensionStatus = function () {
  if (!this.suspended_until) {
    return {
      isSuspended: false,
      suspendedUntil: null,
      reason: null,
    };
  }

  const isSuspended = new Date() < this.suspended_until;
  return {
    isSuspended,
    suspendedUntil: this.suspended_until,
    reason: this.suspension_reason,
  };
};

// Check if user is pending deletion
userSchema.methods.isPendingDeletion = function () {
  return this.account_status === "PENDING_DELETION";
};

// Static method to find user by email or phone
userSchema.statics.findByEmailOrPhone = function (identifier) {
  return this.findOne({
    $or: [
      { "basic_details.email": identifier },
      { "basic_details.phone_number": identifier },
    ],
  });
};

// Static method to find users pending deletion
userSchema.statics.findPendingDeletions = function (date) {
  return this.find({
    account_status: "PENDING_DELETION",
    deletion_date: { $lte: date },
  });
};

module.exports = mongoose.model("User", userSchema);
