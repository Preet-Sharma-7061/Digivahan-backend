const User = require("../models/User");
const PrimaryOTP = require("../models/PrimaryOTPSchema");
const UserDeletion = require("../models/UserDeletion");
const QRAssignment = require("../models/QRAssignment");
const RevokedToken = require("../models/revokedTokenSchema");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../utils/redis.js");

const {
  generateOTP,
  generateTempUserId,
  generateVerificationId,
  sendOTP,
} = require("../utils/otpUtils");

const { ERROR_MESSAGES, SUCCESS_MESSAGES } = require("../../constants");

/**
 * Register Init - Step 1: Check user existence or collect user details and send OTP
 * POST /api/auth/register/init
 */

const registerInit = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, otp_channel } =
      req.body;

    // 1. Check permanent user
    const existingUser = await User.findOne({
      $or: [
        { "basic_details.email": email },
        { "basic_details.phone_number": phone },
      ],
    });

    if (existingUser) {
      if (existingUser.basic_details.email === email) {
        return res.status(400).json({
          status: false,
          error_type: "email",
          message: ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED,
        });
      } else {
        return res.status(400).json({
          status: false,
          error_type: "phone",
          message: ERROR_MESSAGES.PHONE_ALREADY_REGISTERED,
        });
      }
    }

    const contact = otp_channel === "PHONE" ? phone : email;

    // 👉 Daily OTP limit check
    const allowed = await canSendOtpToday(contact);
    if (!allowed) {
      return res.status(429).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_LIMIT_REACHED,
      });
    }

    // 2. Generate OTP & Temp ID
    const otpCode = generateOTP(6);
    const userRegisterId = generateTempUserId();

    // 3. OTP Redis me (10 min)
    await redis.set(`otp:${userRegisterId}`, otpCode, "EX", 600);

    // 4. Temp User Redis me (10 min)
    const userData = {
      user_register_id: userRegisterId,
      first_name,
      last_name,
      email,
      phone,
      password,
      otp_channel,
    };

    await redis.set(
      `tempUser:${userRegisterId}`,
      JSON.stringify(userData),
      "EX",
      600
    );

    // 5. Send OTP
    const otpSent = await sendOTP(contact, otpCode, otp_channel, "signup");

    if (!otpSent) {
      await redis.del(`otp:${userRegisterId}`);
      await redis.del(`tempUser:${userRegisterId}`);
      return res.status(500).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_SEND_FAILED,
      });
    }

    res.status(200).json({
      status: true,
      message: `OTP sent via ${otp_channel.toLowerCase()}.`,
      valid_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      otp_verify_endpoint: "auth/register/verify-otp",
      user_register_id: userRegisterId,
    });
  } catch (error) {
    console.error("Register init error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify User - Step 2: Verify User account already register or not
 * POST /api/auth/check/init
 */

const checkRegisteredUser = async (req, res) => {
  try {
    const { phone, email, hit_type } = req.body;

    // Check if user already exists in permanent users table
    const existingUser = await User.findOne({
      $or: [
        { "basic_details.email": email },
        { "basic_details.phone_number": phone },
      ],
    });

    if (hit_type === "check") {
      if (existingUser) {
        // Check which field already exists
        if (existingUser.basic_details.email === email) {
          return res.status(400).json({
            status: false,
            error_type: "email",
            message: ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED,
          });
        } else if (existingUser.basic_details.phone_number === phone) {
          return res.status(400).json({
            status: false,
            error_type: "phone",
            message: ERROR_MESSAGES.PHONE_ALREADY_REGISTERED,
          });
        }
      }
    } else {
      res.status(400).json({
        status: false,
        message: "Invalid hit_type value",
      });
    }
    return res.status(200).json({
      status: true,
      message: ERROR_MESSAGES.USER_DOES_NOT_EXIST,
    });
  } catch (error) {
    console.error("Register init error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify OTP - Step 3: Verify OTP and create user account
 * POST /api/auth/register/verify-otp
 */
const verifyOtp = async (req, res) => {
  try {
    const { user_register_id, otp } = req.body;

    // 1. Redis se OTP nikalo
    const savedOtp = await redis.get(`otp:${user_register_id}`);
    if (!savedOtp || savedOtp !== otp) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.INVALID_OTP_CODE,
      });
    }

    // 2. Redis se Temp User nikalo
    const tempUser = await redis.get(`tempUser:${user_register_id}`);
    if (!tempUser) {
      return res.status(400).json({
        status: false,
        error_type: "userId",
        message: ERROR_MESSAGES.INVALID_USER_REGISTER_ID,
      });
    }

    const data = JSON.parse(tempUser);

    // 3. Mongo me save
    const newUser = new User({
      basic_details: {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone,
        password: data.password,
        phone_number_verified: data.otp_channel === "PHONE",
        is_phone_number_primary: data.otp_channel === "PHONE",
        profile_completion_percent: 20,
      },
      public_details: { nick_name: "", address: "", age: 0, gender: "" },
      old_passwords: {},
      is_tracking_on: true,
      garage: { vehicles: [] },
      is_active: true,
    });

    await newUser.save();

    const token = newUser.generateAuthToken();

    // 4. Redis clean
    await redis.del(`otp:${user_register_id}`);
    await redis.del(`tempUser:${user_register_id}`);

    res.status(200).json({
      status: true,
      message: "OTP verified. Account created successfully.",
      token,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * User SignIn - Step 4: User SignIn when account is created
 * POST /api/auth/register/resend-otp
 */

const signIn = async (req, res) => {
  try {
    const { login_type, login_value, password } = req.body;

    // Validate login_type
    if (!["email", "phone"].includes(login_type)) {
      return res.status(400).json({
        status: false,
        error_type: "Invalid parameter",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [
        { "basic_details.email": login_value },
        { "basic_details.phone_number": login_value },
      ],
    });

    if (!user) {
      // Check which field was used for login to provide specific error
      if (login_type === "email") {
        return res.status(401).json({
          status: false,
          error_type: "email",
          message: ERROR_MESSAGES.EMAIL_NOT_REGISTERED,
        });
      } else {
        return res.status(401).json({
          status: false,
          error_type: "phone",
          message: ERROR_MESSAGES.PHONE_NOT_REGISTERED,
        });
      }
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    // Check if user is suspended
    if (user.isSuspended()) {
      const suspensionStatus = user.getSuspensionStatus();
      return res.status(403).json({
        status: false,
        error_type: "suspended",
        message: ERROR_MESSAGES.USER_SUSPENDED,
        data: {
          suspended_until: suspensionStatus.suspendedUntil,
          reason: suspensionStatus.reason,
        },
      });
    }

    // Check if user is pending deletion and cancel it
    // Check if user is pending deletion and cancel it
    if (user.isPendingDeletion()) {
      try {
        // 1️⃣ Cancel deletion in user document
        user.account_status = "ACTIVE";
        user.deletion_date = null;
        await user.save();

        // 2️⃣ Remove pending deletion record from UserDeletion collection
        await UserDeletion.deleteMany({ user_id: user._id, status: "PENDING" });

        // 3️⃣ Reactivate QR codes assigned to the user
        await QRAssignment.updateMany(
          { user_id: user._id.toString() },
          { status: "active" }
        );

        console.log(`User deletion cancelled for: ${user._id}`);
      } catch (error) {
        console.error("Error cancelling user deletion:", error);
        // Continue with login even if cancellation fails
      }
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: false,
        error_type: "password",
        message: ERROR_MESSAGES.INVALID_PASSWORD,
      });
    }

    // Check if account is verified based on login type
    if (login_type === "email" && !user.basic_details.is_email_verified) {
      return res.status(401).json({
        status: false,
        error_type: "email_verify",
        message: ERROR_MESSAGES.EMAIL_VERIFY_REQUIRED,
      });
    }

    if (login_type === "phone" && !user.basic_details.phone_number_verified) {
      return res.status(401).json({
        status: false,
        error_type: "phone_verify",
        message: ERROR_MESSAGES.PHONE_VERIFY_REQUIRED,
      });
    }

    // Update login status
    user.is_logged_in = true;
    await user.save();

    // Generate JWT token
    const token = user.generateAuthToken();

    // Prepare comprehensive user response as per specification
    const userResponse = {
      basic_details: {
        profile_pic: user.basic_details.profile_pic || "",
        first_name: user.basic_details.first_name || "",
        last_name: user.basic_details.last_name || "",
        phone_number: user.basic_details.phone_number || "",
        phone_number_verified:
          user.basic_details.phone_number_verified || false,
        is_phone_number_primary:
          user.basic_details.is_phone_number_primary || false,
        email: user.basic_details.email || "",
        is_email_verified: user.basic_details.is_email_verified || false,
        is_email_primary: user.basic_details.is_email_primary || false,
        password: "", // Never send password
        occupation: user.basic_details.occupation || "",
        profile_completion_percent:
          user.basic_details.profile_completion_percent || 0,
      },
      public_details: {
        nick_name: user.public_details?.nick_name || "",
        address: user.public_details?.address || "",
        age: user.public_details?.age || 0,
        gender: user.public_details?.gender || "",
        public_pic: user.public_details?.public_pic,
      },
      is_tracking_on: user.is_tracking_on || false,
      is_notification_sound_on: user.is_notification_sound_on || true,
      token: token,
    };

    res.status(200).json({
      status: true,
      message: "Login successful",
      user: userResponse,
    });
  } catch (error) {
    console.error("Sign in error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Resend OTP - Resend OTP when otp is expired
 * POST /api/auth/register/resend-otp
 */

const resendOtp = async (req, res) => {
  try {
    const { user_register_id } = req.body;

    // 1. Redis se temp user nikalo
    const tempUserStr = await redis.get(`tempUser:${user_register_id}`);
    if (!tempUserStr) {
      return res.status(400).json({
        status: false,
        error_type: "userId",
        message: ERROR_MESSAGES.INVALID_USER_REGISTER_ID,
      });
    }

    const tempUser = JSON.parse(tempUserStr);
    const contact =
      tempUser.otp_channel === "PHONE" ? tempUser.phone : tempUser.email;

    // 👉 Daily OTP limit check
    const allowed = await canSendOtpToday(contact);
    if (!allowed) {
      return res.status(429).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_LIMIT_REACHED,
      });
    }

    // 2. New OTP banao
    const newOtpCode = generateOTP(6);

    // 3. Redis me OTP update karo (10 min)
    await redis.set(`otp:${user_register_id}`, newOtpCode, "EX", 600);

    // 4. SMS bhejo
    const otpSent = await sendOTP(
      contact,
      newOtpCode,
      tempUser.otp_channel,
      "signup"
    );

    if (!otpSent) {
      return res.status(500).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_SEND_FAILED,
      });
    }

    res.status(200).json({
      status: true,
      message: `OTP resent via ${tempUser.otp_channel.toLowerCase()}.`,
      valid_until: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      otp_verify_endpoint: "auth/register/verify-otp",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Change Password - Update user password
 * POST /api/auth/register/change-password
 */

const ChangeUserpassword = async (req, res) => {
  try {
    const { user_id, old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({
        status: false,
        error_type: "validation",
        message: "All fields are required",
      });
    }

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // 2️⃣ Check account active
    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    // 3️⃣ Old password must match CURRENT password
    const isOldPasswordCorrect = await user.comparePassword(old_password);
    if (!isOldPasswordCorrect) {
      return res.status(400).json({
        status: false,
        error_type: "old_password",
        message: "Your old password doesn't match",
      });
    }

    // 4️⃣ Old password and new password should NOT be same
    if (old_password === new_password) {
      return res.status(400).json({
        status: false,
        error_type: "new_password",
        message: "Your old password is match with new password",
      });
    }

    // 5️⃣ New password should not be same as CURRENT password
    const isSameAsCurrent = await user.comparePassword(new_password);
    if (isSameAsCurrent) {
      return res.status(400).json({
        status: false,
        error_type: "new_password",
        message: "Your new password is your current password",
      });
    }

    // 6️⃣ New password should not match PREVIOUS passwords
    const oldPasswords = [
      user.old_passwords.previous_password1,
      user.old_passwords.previous_password2,
      user.old_passwords.previous_password3,
    ];

    for (const oldPass of oldPasswords) {
      if (oldPass && (await bcrypt.compare(new_password, oldPass))) {
        return res.status(400).json({
          status: false,
          error_type: "new_password",
          message: "Your new password matches your previous password",
        });
      }
    }

    // 7️⃣ Shift password history
    user.old_passwords.previous_password3 =
      user.old_passwords.previous_password2;

    user.old_passwords.previous_password2 =
      user.old_passwords.previous_password1;

    user.old_passwords.previous_password1 = user.basic_details.password;

    // 8️⃣ Update password
    user.basic_details.password = new_password;
    user.is_logged_in = true;

    await user.save();

    return res.status(200).json({
      status: true,
      message: "Your password successfully updated",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

// Check new password with our database password are already avaliable or not
const ValidateNewPassword = async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // 4️⃣ New password should not be same as current
    const isSamePassword = await user.comparePassword(new_password);
    if (isSamePassword) {
      return res.status(400).json({
        status: false,
        error_type: "password",
        message: ERROR_MESSAGES.PASSWORD_USED_PREVIOUSLY,
      });
    }

    // 5️⃣ Check against previous passwords
    const oldPasswords = [
      user.old_passwords.previous_password1,
      user.old_passwords.previous_password2,
      user.old_passwords.previous_password3,
    ];

    for (const oldPass of oldPasswords) {
      if (oldPass && (await bcrypt.compare(new_password, oldPass))) {
        return res.status(400).json({
          status: false,
          error_type: "password",
          message: ERROR_MESSAGES.PASSWORD_USED_PREVIOUSLY,
        });
      }
    }

    // 6️⃣ Shift old passwords
    user.old_passwords.previous_password3 =
      user.old_passwords.previous_password2;

    user.old_passwords.previous_password2 =
      user.old_passwords.previous_password1;

    user.old_passwords.previous_password1 = user.basic_details.password; // current hashed password

    // 7️⃣ Update password
    user.basic_details.password = new_password;
    user.is_logged_in = true;

    await user.save();

    return res.status(200).json({
      status: true,
      message: SUCCESS_MESSAGES.PASSWORD_CHANGED_SUCCESSFULLY,
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * OTP Based Login - Send OTP for login
 * POST /api/auth/otp-based-login
 */

const otpBasedLogin = async (req, res) => {
  try {
    const { login_via, value } = req.body;

    if (!["email", "phone"].includes(login_via)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": value },
        { "basic_details.phone_number": value },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: login_via,
        message:
          login_via === "email"
            ? ERROR_MESSAGES.EMAIL_NOT_REGISTERED_OTP
            : ERROR_MESSAGES.PHONE_NOT_REGISTERED_OTP,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    if (user.isSuspended()) {
      const suspensionStatus = user.getSuspensionStatus();
      return res.status(403).json({
        status: false,
        error_type: "suspended",
        message: ERROR_MESSAGES.USER_SUSPENDED,
        data: suspensionStatus,
      });
    }

    const otpCode = generateOTP(6);
    const otpChannel = login_via.toUpperCase();

    // Redis key based on contact
    const redisKey = `loginOtp:${value}`;

    // Save OTP in Redis (10 min)
    await redis.set(redisKey, otpCode, "EX", 600);

    const otpSent = await sendOTP(value, otpCode, otpChannel, "login");

    if (!otpSent) {
      await redis.del(redisKey);
      return res.status(500).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_SEND_FAILED,
      });
    }

    res.status(200).json({
      status: true,
      message: "OTP sent successfully",
      otp_valid_till: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verify_otp_url: "auth/verify-login-otp",
    });
  } catch (error) {
    console.error("OTP based login error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify Login OTP - Verify OTP for login
 * POST /api/auth/verify-login-otp
 */
const verifyLoginOtp = async (req, res) => {
  try {
    const { login_via, value, otp } = req.body;

    if (!["email", "phone"].includes(login_via)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": value },
        { "basic_details.phone_number": value },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    if (user.isSuspended()) {
      const suspensionStatus = user.getSuspensionStatus();
      return res.status(403).json({
        status: false,
        error_type: "suspended",
        message: ERROR_MESSAGES.USER_SUSPENDED,
        data: suspensionStatus,
      });
    }

    const redisKey = `loginOtp:${value}`;
    const savedOtp = await redis.get(redisKey);

    if (!savedOtp) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_EXPIRED_VERIFY,
      });
    }

    if (savedOtp !== otp) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_INVALID,
      });
    }

    // OTP correct — login success
    if (login_via === "email") {
      user.basic_details.is_email_verified = true;
    } else {
      user.basic_details.phone_number_verified = true;
    }

    user.is_logged_in = true;
    await user.save();

    const token = user.generateAuthToken();

    // Delete OTP from Redis
    await redis.del(redisKey);

    const userResponse = {
      basic_details: {
        profile_pic: user.basic_details.profile_pic || "",
        first_name: user.basic_details.first_name || "",
        last_name: user.basic_details.last_name || "",
        phone_number: user.basic_details.phone_number || "",
        phone_number_verified:
          user.basic_details.phone_number_verified || false,
        is_phone_number_primary:
          user.basic_details.is_phone_number_primary || false,
        email: user.basic_details.email || "",
        is_email_verified: user.basic_details.is_email_verified || false,
        is_email_primary: user.basic_details.is_email_primary || false,
        password: "",
        occupation: user.basic_details.occupation || "",
        profile_completion_percent:
          user.basic_details.profile_completion_percent || 0,
      },
      public_details: {
        nick_name: user.public_details?.nick_name || "",
        address: user.public_details?.address || "",
        age: user.public_details?.age || 0,
        gender: user.public_details?.gender || "",
        public_pic: user.public_details?.public_pic || "",
      },
      is_tracking_on: user.is_tracking_on || false,
      is_notification_sound_on: user.is_notification_sound_on || true,
      token,
    };

    res.status(200).json({
      status: true,
      message: ERROR_MESSAGES.OTP_VERIFIED_SUCCESS,
      user: userResponse,
    });
  } catch (error) {
    console.error("Verify login OTP error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Request Reset Password - Send OTP for password reset
 * POST /api/auth/request-reset-password
 */
const requestResetPassword = async (req, res) => {
  try {
    const { forget_with, otp_channel } = req.body;

    if (!["EMAIL", "PHONE"].includes(otp_channel)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": forget_with },
        { "basic_details.phone_number": forget_with },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: otp_channel === "EMAIL" ? "email" : "phone",
        message:
          otp_channel === "EMAIL"
            ? ERROR_MESSAGES.EMAIL_NOT_REGISTERED_RESET
            : ERROR_MESSAGES.PHONE_NOT_REGISTERED_RESET,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    if (otp_channel === "EMAIL" && !user.basic_details.is_email_verified) {
      return res.status(400).json({
        status: false,
        error_type: "email",
        message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED_RESET,
      });
    }

    if (otp_channel === "PHONE" && !user.basic_details.phone_number_verified) {
      return res.status(400).json({
        status: false,
        error_type: "phone",
        message: ERROR_MESSAGES.PHONE_NOT_VERIFIED_RESET,
      });
    }

    const otpCode = generateOTP(6);
    const redisKey = `resetOtp:${forget_with}`;

    // Save OTP in Redis (10 min)
    await redis.set(redisKey, otpCode, "EX", 600);

    const otpSent = await sendOTP(forget_with, otpCode, otp_channel, "reset");

    if (!otpSent) {
      await redis.del(redisKey);
      return res.status(500).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_SEND_FAILED,
      });
    }

    res.status(200).json({
      status: true,
      message: "OTP sent successfully",
      otp_valid_till: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      verify_otp_url: "/auth/verify-reset-otp-change-password",
    });
  } catch (error) {
    console.error("Request reset password error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify Reset OTP and Change Password - Verify OTP and set new password
 * POST /api/auth/verify-reset-otp
 */
const verifyResetOtp = async (req, res) => {
  try {
    const { forget_with, otp_channel, otp, new_password } = req.body;

    if (!["EMAIL", "PHONE"].includes(otp_channel)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": forget_with },
        { "basic_details.phone_number": forget_with },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    const redisKey = `resetOtp:${forget_with}`;
    const savedOtp = await redis.get(redisKey);

    if (!savedOtp) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_EXPIRED_VERIFY,
      });
    }

    if (savedOtp !== otp) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_INVALID,
      });
    }

    const isSamePassword = await user.comparePassword(new_password);
    if (isSamePassword) {
      return res.status(400).json({
        status: false,
        error_type: "password",
        message: ERROR_MESSAGES.SAME_PASSWORD,
      });
    }

    const oldPasswords = [
      user.old_passwords.previous_password1,
      user.old_passwords.previous_password2,
      user.old_passwords.previous_password3,
    ];

    for (const oldPassword of oldPasswords) {
      if (oldPassword && (await bcrypt.compare(new_password, oldPassword))) {
        return res.status(400).json({
          status: false,
          error_type: "password",
          message: ERROR_MESSAGES.PASSWORD_USED_PREVIOUSLY,
        });
      }
    }

    user.old_passwords.previous_password3 =
      user.old_passwords.previous_password2;
    user.old_passwords.previous_password2 =
      user.old_passwords.previous_password1;
    user.old_passwords.previous_password1 = user.basic_details.password;

    user.basic_details.password = new_password;
    user.is_logged_in = true;
    await user.save();

    const token = user.generateAuthToken();

    // Delete OTP from Redis
    await redis.del(redisKey);

    const userResponse = {
      basic_details: {
        profile_pic: user.basic_details.profile_pic || "",
        first_name: user.basic_details.first_name || "",
        last_name: user.basic_details.last_name || "",
        phone_number: user.basic_details.phone_number || "",
        phone_number_verified:
          user.basic_details.phone_number_verified || false,
        is_phone_number_primary:
          user.basic_details.is_phone_number_primary || false,
        email: user.basic_details.email || "",
        is_email_verified: user.basic_details.is_email_verified || false,
        is_email_primary: user.basic_details.is_email_primary || false,
        password: "",
        occupation: user.basic_details.occupation || "",
        profile_completion_percent:
          user.basic_details.profile_completion_percent || 0,
      },
      public_details: {
        nick_name: user.public_details?.nick_name || "",
        address: user.public_details?.address || "",
        age: user.public_details?.age || 0,
        gender: user.public_details?.gender || "",
      },
      is_tracking_on: user.is_tracking_on || false,
      is_notification_sound_on: user.is_notification_sound_on || true,
      token,
    };

    res.status(200).json({
      status: true,
      message: ERROR_MESSAGES.PASSWORD_RESET_SUCCESS,
      login: true,
      user: userResponse,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify User Request - Send OTP for user verification
 * POST /api/auth/user/verify/request
 */
const verifyRequest = async (req, res) => {
  try {
    const { otp_channel, verify_to } = req.body;

    if (!["EMAIL", "PHONE"].includes(otp_channel)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": verify_to },
        { "basic_details.phone_number": verify_to },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.ACCOUNT_DEACTIVATED,
      });
    }

    if (otp_channel === "EMAIL" && user.basic_details.is_email_verified) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: "Email is already verified",
      });
    }

    if (otp_channel === "PHONE" && user.basic_details.phone_number_verified) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: "Phone number is already verified",
      });
    }

    const otpCode = generateOTP(6);
    const verificationId = generateVerificationId();

    const redisKey = `verifyOtp:${verificationId}`;

    const redisData = {
      verify_to,
      otp_channel,
      otp: otpCode,
    };

    // Save in Redis for 10 min
    await redis.set(redisKey, JSON.stringify(redisData), "EX", 600);

    const otpSent = await sendOTP(verify_to, otpCode, otp_channel, "verify");

    if (!otpSent) {
      await redis.del(redisKey);
      return res.status(500).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.OTP_SEND_FAILED,
      });
    }

    res.status(200).json({
      status: "true",
      message: "OTP sent successfully",
      verify_to,
      otp_verification_endpoint: `api/user/verify/confirm/${verificationId}`,
      verification_id: verificationId,
    });
  } catch (error) {
    console.error("Verify request error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Verify OTP - Verify OTP for user verification
 * POST /api/auth/user/verify/confirm/:verificationId
 */
const verifyConfirm = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { verify_to, otp_channel, otp } = req.body;

    if (!["EMAIL", "PHONE"].includes(otp_channel)) {
      return res.status(400).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.INVALID_PARAMETER,
      });
    }

    const redisKey = `verifyOtp:${verificationId}`;
    const redisValue = await redis.get(redisKey);

    if (!redisValue) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_EXPIRED_VERIFY,
      });
    }

    const savedData = JSON.parse(redisValue);

    if (
      savedData.otp !== otp ||
      savedData.verify_to !== verify_to ||
      savedData.otp_channel !== otp_channel
    ) {
      return res.status(400).json({
        status: false,
        error_type: "OTP",
        message: ERROR_MESSAGES.OTP_INVALID,
      });
    }

    const user = await User.findOne({
      $or: [
        { "basic_details.email": verify_to },
        { "basic_details.phone_number": verify_to },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        error_type: "other",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (otp_channel === "EMAIL") {
      user.basic_details.is_email_verified = true;
    } else {
      user.basic_details.phone_number_verified = true;
    }

    await user.save();

    // Delete OTP from Redis
    await redis.del(redisKey);

    const verifiedMedium = otp_channel.toLowerCase();
    const timestamp = new Date().toISOString();

    const successMessage =
      verifiedMedium === "email"
        ? ERROR_MESSAGES.EMAIL_VERIFIED_SUCCESS
        : ERROR_MESSAGES.PHONE_VERIFIED_SUCCESS;

    res.status(200).json({
      status: "true",
      message: successMessage,
      verified_medium: verifiedMedium,
      timestamp,
    });
  } catch (error) {
    console.error("Verify confirm error:", error);
    res.status(500).json({
      status: false,
      error_type: "other",
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

// raised the Request to set Primary Contact No. throw the OTP validation
const RequestPrimaryContact = async (req, res) => {
  try {
    const { user_id, set_primary } = req.body;

    // 1️⃣ Find user
    const user = await User.findById(user_id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const basic = user.basic_details;

    // 2️⃣ Identify current primary contact
    let primaryValue = "";
    let sendType = ""; // email OR phone

    if (basic.is_email_primary === true && basic.is_email_verified === true) {
      primaryValue = basic.email;
      sendType = "EMAIL";
    } else if (
      basic.is_phone_number_primary === true &&
      basic.phone_number_verified === true
    ) {
      primaryValue = basic.phone_number;
      sendType = "PHONE";
    } else {
      return res.status(400).json({
        status: "error",
        message: "No primary contact found for this user",
      });
    }

    // 3️⃣ Generate OTP
    const otp = generateOTP(6);

    // 4️⃣ Save OTP in database
    await PrimaryOTP.create({
      user_registered_id: user._id,
      otp: otp,
      set_primary,
      otp_expires_at: new Date(Date.now() + 10 * 60 * 1000),
    });

    // 5️⃣ Send OTP on primary contact
    if (sendType === "EMAIL") {
      await sendOTP(primaryValue, otp, sendType, "primary");
    } else {
      await sendOTP(primaryValue, otp, sendType);
    }

    return res.status(200).json({
      status: "success",
      message: `OTP sent successfully to your primary ${sendType}`,
      primary_contact: primaryValue,
      user_register_id: user._id,
    });
  } catch (error) {
    console.error("RequestPrimaryContact Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Something went wrong",
      error: error.message,
    });
  }
};

// Verify OTP for set the recent primary Contact No.
const VerifyOTPforsetPrimaryContact = async (req, res) => {
  try {
    const { user_id, otp } = req.body;

    if (!user_id || !otp) {
      return res.status(400).json({ message: "user_id and otp are required" });
    }

    // 1️⃣ Find OTP entry using user_registered_id (ObjectId)
    const otpRecord = await PrimaryOTP.findOne({
      user_registered_id: user_id,
    });

    if (!otpRecord) {
      return res.status(404).json({ message: "OTP record not found" });
    }

    // 2️⃣ Check OTP expiry
    if (otpRecord.otp_expires_at < new Date()) {
      return res.status(410).json({ message: "OTP expired" });
    }

    // 3️⃣ Verify OTP
    if (otpRecord.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    // 4️⃣ Find user
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 5️⃣ UPDATE PRIMARY CONTACT
    if (otpRecord.set_primary === "phone") {
      user.basic_details.is_phone_number_primary = true;
      user.basic_details.is_email_primary = false;
      user.basic_details.phone_number_verified = true;
    } else if (otpRecord.set_primary === "email") {
      user.basic_details.is_email_primary = true;
      user.basic_details.is_phone_number_primary = false;
      user.basic_details.is_email_verified = true;
    }

    await user.save();

    // 6️⃣ Delete OTP record (prevent reuse)
    await PrimaryOTP.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      message: `Primary ${otpRecord.set_primary} updated successfully`,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
};

// Logout User
const LogOutUser = async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Access token required",
      });
    }

    // 1️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2️⃣ Convert exp (seconds) → Date
    const expiryDate = new Date(decoded.exp * 1000);

    // 3️⃣ Save revoked token
    await RevokedToken.create({
      token: token,
      date: expiryDate,
    });

    return res.status(200).json({
      status: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(401).json({
      status: false,
      message: "Invalid or expired token",
      error: error.message,
    });
  }
};

/**
 * Suspend User - Suspend a user for a specific time period
 * POST /api/auth/suspend-user
 */

const suspendUser = async (req, res) => {
  try {
    const { user_id, suspend_until, reason } = req.body;

    // Find user by email or phone number
    const user = await User.findOne({
      $or: [
        { "basic_details.email": user_id },
        { "basic_details.phone_number": user_id },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check if user is already suspended
    if (user.isSuspended()) {
      return res.status(400).json({
        status: false,
        message: SUCCESS_MESSAGES.USER_ALREADY_SUSPENDED,
        data: {
          user_id: user._id,
          suspended_till: user.suspended_until,
          reason: user.suspension_reason,
        },
      });
    }

    // Update user suspension details
    user.suspended_until = new Date(suspend_until);
    user.suspension_reason = reason;
    user.is_logged_in = false; // Log out the user immediately
    await user.save();

    res.status(200).json({
      status: true,
      message: SUCCESS_MESSAGES.USER_SUSPENDED_SUCCESSFULLY,
      data: {
        user_id: user._id,
        suspended_till: user.suspended_until,
        reason: user.suspension_reason,
      },
    });
  } catch (error) {
    console.error("Suspend user error:", error);
    res.status(500).json({
      status: false,
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    });
  }
};

/**
 * Remove User Suspension - Remove suspension from a user
 * POST /api/auth/remove-suspension
 */
const removeUserSuspension = async (req, res) => {
  try {
    const { user_id } = req.body;

    // Find user by email or phone number
    const user = await User.findOne({
      $or: [
        { "basic_details.email": user_id },
        { "basic_details.phone_number": user_id },
      ],
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND_OR_NOT_SUSPENDED,
      });
    }

    // Check if user is actually suspended
    if (!user.suspended_until) {
      return res.status(400).json({
        status: false,
        message: ERROR_MESSAGES.USER_NOT_FOUND_OR_NOT_SUSPENDED,
      });
    }

    // Remove suspension
    user.suspended_until = null;
    user.suspension_reason = "";
    await user.save();

    res.status(200).json({
      status: true,
      message: SUCCESS_MESSAGES.USER_ACTIVATED_SUCCESSFULLY,
    });
  } catch (error) {
    console.error("Remove user suspension error:", error);
    res.status(500).json({
      status: false,
      message: ERROR_MESSAGES.SERVER_ISSUE,
    });
  }
};

const MAX_DAILY_OTP = 3;

const canSendOtpToday = async (contact) => {
  const key = `otpLimit:${contact}`;
  const count = await redis.incr(key);

  if (count === 1) {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const secondsTillMidnight = Math.floor((midnight - now) / 1000);
    await redis.expire(key, secondsTillMidnight);
  }

  return count <= MAX_DAILY_OTP;
};

module.exports = {
  registerInit,
  checkRegisteredUser,
  verifyOtp,
  resendOtp,
  signIn,
  otpBasedLogin,
  verifyLoginOtp,
  requestResetPassword,
  verifyResetOtp,
  verifyRequest,
  verifyConfirm,
  RequestPrimaryContact,
  VerifyOTPforsetPrimaryContact,
  ChangeUserpassword,
  ValidateNewPassword,
  LogOutUser,
  suspendUser,
  removeUserSuspension,
};
