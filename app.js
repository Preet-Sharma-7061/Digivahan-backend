require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db_config/index.js");
const {
  API_ROUTES,
  FULL_ROUTES,
  INFO_MESSAGES,
} = require("./constants/index.js");
// const { requestLogger } = require("./src/middleware/logger.js");
const startDeletionCron = require('./src/utils/cronJobs.js')

// Import routes
// Hasan Code
const appInfoRoutes = require("./src/routes/appInfo.routes");
const fuelRoutes = require('./src/routes/fuel.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const deleteImageRoutes = require('./src/routes/deleteImage.routes');

// Hasan Code End Here
const authRoutes = require("./src/routes/auth.routes.js");
const profileDeletation = require("./src/routes/profileDeletation.routes.js");
const profileUpdateRoutes = require('./src/routes/profileUpdate.routes.js');
const emergencyContactRoutes = require('./src/routes/emergencyContact.routes.js')
const addUserAddressRoutes = require('./src/routes/userAddress.routes.js')

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logger middleware - logs all incoming requests with full endpoint
// app.use(requestLogger);

// Database connection middleware jdhfhf
app.use(async (req, res, next) => {
  try {
    // Only connect if not already connected
    if (require("mongoose").connection.readyState !== 1) {
      await connectDB();
      startDeletionCron()
    }
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    // In serverless, continue without database for graceful degradation
    next();
  }
});

// Hasan Code 
app.use(appInfoRoutes);
app.use(fuelRoutes);
app.use(uploadRoutes);
app.use(deleteImageRoutes);

// Hasan Code End Here
app.use(API_ROUTES.AUTH.BASE, authRoutes);
app.use(API_ROUTES.USER.BASE, profileDeletation);
app.use(API_ROUTES.UPDATE_USER.BASE, profileUpdateRoutes);
app.use(API_ROUTES.EMERGENCY_CONTACT.BASE, emergencyContactRoutes);
app.use(API_ROUTES.ADDRESSBOOK.BASE, addUserAddressRoutes);

// For Vercel serverless functions
if (process.env.VERCEL === "1") {
  module.exports = app;
} else {
  // For local development
  const PORT = process.env.PORT || 3000;
  const http = require("http");

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  const { Server } = require("socket.io");
  const io = new Server(server, {
    cors: {
      origin: "*", // Update this with your frontend URL in production
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  app.get("/", (req, res) => {
    res.status(200).send("Backend is running successfully 🚀");
  });

  // Setup Socket.IO handlers
  const { setupSocketIO } = require("./src/socket/socketHandler.js");
  setupSocketIO(io);

  // Start server
  server.listen(PORT, () => {
    console.log(`🚀 ${INFO_MESSAGES.SERVER_STARTED} ${PORT}`);
    console.log(
      `📊 ${INFO_MESSAGES.HEALTH_CHECK}: http://localhost:${PORT}${API_ROUTES.HEALTH}`
    );
    console.log(`💬 Socket.IO server running on http://localhost:${PORT}`);
  });

  // Export server for potential use in other modules
  module.exports = { app, server, io };
}
