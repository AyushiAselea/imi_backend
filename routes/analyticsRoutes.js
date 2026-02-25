const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const {
    trackEvent,
    trackBatch,
    getDashboard,
    getRealtime,
} = require("../controllers/analyticsController");

// Public routes (called from frontend tracking)
router.post("/track", trackEvent);
router.post("/track/batch", trackBatch);

// Admin-only routes
router.get("/dashboard", protect, admin, getDashboard);
router.get("/realtime", protect, admin, getRealtime);

module.exports = router;
