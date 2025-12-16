const AppInfo = require("../models/appInfo.model");

// Ensure single appInfo document
async function getMainDoc() {
  let doc = await AppInfo.findOne();
  if (!doc) {
    doc = await AppInfo.create({});
  }
  return doc;
}

// UPDATE ANDROID VERSION
exports.updateAndroidVersion = async (req, res) => {
  try {
    const { version, notes } = req.body;

    const doc = await getMainDoc();

    doc.app_version.android = {
      version,
      notes,
      createdAt: doc.app_version.android?.createdAt || new Date(),
      updatedAt: new Date()
    };

    await doc.save();

    return res.json({ success: true, data: doc.app_version.android });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET ANDROID VERSION
exports.getAndroidVersion = async (req, res) => {
    try {
      const doc = await getMainDoc();
      if (!doc || !doc.app_version?.android) {
        return res.status(404).json({ success: false, message: "No Android version found" });
      }
  
      return res.json({ success: true, data: doc.app_version.android });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };

// UPDATE IOS VERSION
exports.updateIOSVersion = async (req, res) => {
  try {
    const { version, notes } = req.body;

    const doc = await getMainDoc();

    doc.app_version.ios = {
      version,
      notes,
      createdAt: doc.app_version.ios?.createdAt || new Date(),
      updatedAt: new Date()
    };

    await doc.save();

    return res.json({ success: true, data: doc.app_version.ios });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

  // GET IOS VERSION
  exports.getIOSVersion = async (req, res) => {
    try {
      const doc = await getMainDoc();
      if (!doc || !doc.app_version?.ios) {
        return res.status(404).json({ success: false, message: "No iOS version found" });
      }
  
      return res.json({ success: true, data: doc.app_version.ios });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };

// UPDATE PRIVACY POLICY
exports.updatePrivacyPolicy = async (req, res) => {
  try {
    const { policy } = req.body;
    const doc = await getMainDoc();

    doc.policy.privacy_policy = {
      policy,
      updatedAt: new Date()
    };

    await doc.save();

    return res.json({ success: true, data: doc.policy.privacy_policy });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
};
  // GET PRIVACY POLICY
  exports.getPrivacyPolicy = async (req, res) => {
    try {
      const doc = await getMainDoc();
      if (!doc || !doc.policy?.privacy_policy) {
        return res.status(404).json({ success: false, message: "No Privacy Policy found" });
      }
  
      return res.json({ success: true, data: doc.policy.privacy_policy });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };

// UPDATE TERMS & CONDITIONS
exports.updateTermsCondition = async (req, res) => {
  try {
    const { terms_condition } = req.body;

    const doc = await getMainDoc();

    doc.policy.terms_condition = {
      terms_condition,
      updatedAt: new Date()
    };

    await doc.save();

    return res.json({ success: true, data: doc.policy.terms_condition });
  } catch (e) {
    return res.status(500).json({ success: false });
  }
};
  
  // GET TERMS & CONDITIONS
  exports.getTermsCondition = async (req, res) => {
    try {
      const doc = await getMainDoc();
      if (!doc || !doc.policy?.terms_condition) {
        return res.status(404).json({ success: false, message: "No Terms & Condition found" });
      }
  
      return res.json({ success: true, data: doc.policy.terms_condition });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };