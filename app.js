require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");

// Database and utils
const connectDB = require("./db_config/index.js");
const startDeletionCron = require("./src/utils/cronJobs.js");

// Constants
const { API_ROUTES } = require("./constants/index.js");

// Routes
const authRoutes = require("./src/routes/auth.routes.js");
const profileDeletation = require("./src/routes/profileDeletation.routes.js");
const profileUpdateRoutes = require("./src/routes/profileUpdate.routes.js");
const emergencyContactRoutes = require("./src/routes/emergencyContact.routes.js");
const addUserAddressRoutes = require("./src/routes/userAddress.routes.js");
const garageRoutes = require("./src/routes/garage.routes.js");
const uploadVehicleDoc = require("./src/routes/uploadvehicleDoc.routes.js");
const userReviewroutes = require("./src/routes/addReview.routes.js");
const userOrderRoutes = require("./src/routes/order.routes.js");
const roomRoutes = require("./src/routes/rooom.routes.js");

// Socket.IO handler
const { setupSocketIO } = require("./src/socket/socketHandler.js");

const app = express();

// -------------------- MIDDLEWARES --------------------
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Optional request logger
// const { requestLogger } = require("./src/middleware/logger.js");
// app.use(requestLogger);

// -------------------- ROUTES --------------------
app.use(API_ROUTES.AUTH.BASE, authRoutes);
app.use(API_ROUTES.USER.BASE, profileDeletation);
app.use(API_ROUTES.UPDATE_USER.BASE, profileUpdateRoutes);
app.use(API_ROUTES.EMERGENCY_CONTACT.BASE, emergencyContactRoutes);
app.use(API_ROUTES.ADDRESSBOOK.BASE, addUserAddressRoutes);
app.use(API_ROUTES.GARAGE.BASE, garageRoutes);
app.use(API_ROUTES.UPLOAD.BASE, uploadVehicleDoc);
app.use(API_ROUTES.REVIEW.BASE, userReviewroutes);
app.use(API_ROUTES.ORDER.BASE, userOrderRoutes);
app.use(API_ROUTES.CHAT.BASE, roomRoutes);

// -------------------- HEALTH CHECK --------------------
// Serve HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// -------------------- SERVER SETUP --------------------
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.IO
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*", // Update with frontend URL in production
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Setup Socket.IO handlers
setupSocketIO(io);

// -------------------- DATABASE CONNECTION --------------------
(async () => {
  try {
    await connectDB();       // Connect to MongoDB
    startDeletionCron();     // Start cron jobs
    console.log("Database connected and cron jobs started ✅");
  } catch (error) {
    console.error("Startup error:", error);
  }
})();

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
