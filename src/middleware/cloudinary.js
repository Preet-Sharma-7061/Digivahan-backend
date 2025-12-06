const cloudinary = require("cloudinary").v2;
const multer = require('multer')
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer + Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "uploads", // Cloudinary folder name
    resource_type: "image", // use "image" for profile pics
    allowed_formats: ["jpg", "jpeg", "png"]
  },
});

// Upload middleware (single image)
const upload = multer({ storage });

// Memory storage – keeps file in buffer
const multerstorage = multer.memoryStorage();
const profilePicParser = multer({
  multerstorage,
}).single("profile_pic");


// Delete image from cloudinary
const deleteCloudinaryImage = async (public_id) => {
  if (!public_id) return;

  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
};

module.exports = {upload, deleteCloudinaryImage, profilePicParser};
