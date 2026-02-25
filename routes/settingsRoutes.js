const express = require("express");
const router = express.Router();
const { getTrackingSettings } = require("../controllers/adminController");

// Public route — frontend fetches tracking IDs to dynamically load scripts
router.get("/tracking", getTrackingSettings);

module.exports = router;
