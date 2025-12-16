const express = require("express");
const router = express.Router();

const {
  updateAndroidVersion,
  updateIOSVersion,
  updatePrivacyPolicy,
  updateTermsCondition,
  getAndroidVersion,
  getIOSVersion,
  getPrivacyPolicy,
  getTermsCondition
} = require("../controllers/appInfo.controller");

// GET ANDROID VERSION
router.get("/api/v1/app-info/android", getAndroidVersion);

// GET IOS VERSION
router.get("/api/v1/app-info/ios", getIOSVersion);

// GET PRIVACY POLICY
router.get("/api/v1/app-info/privacy-policy", getPrivacyPolicy);

// GET TERMS & CONDITIONS
router.get("/api/v1/app-info/terms-condition", getTermsCondition);

// ANDROID VERSION UPDATE
router.post("/api/v1/app-info/android", updateAndroidVersion);

// IOS VERSION UPDATE
router.post("/api/v1/app-info/ios", updateIOSVersion);

// PRIVACY POLICY UPDATE
router.post("/api/v1/app-info/privacy-policy", updatePrivacyPolicy);

// TERMS & CONDITIONS UPDATE
router.post("/api/v1/app-info/terms-condition", updateTermsCondition);

// GET FULL APP INFO (Android, iOS, Policies everything)
router.get("/api/v1/app-info", async (req, res) => {
    try {
      const AppInfo = require("../models/appInfo.model");
      const doc = await AppInfo.findOne().lean().exec();
  
      if (!doc) {
        return res.status(404).json({
          success: false,
          message: "No app info found"
        });
      }
  
      return res.json({ success: true, data: doc });
    } catch (error) {
      console.error("getAllAppInfo error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });
  

module.exports = router;
