const express = require("express");
const router = express.Router();
const {
    createOrder,
    getMyOrders,
    getAllOrders,
} = require("../controllers/orderController");
const { protect, admin } = require("../middleware/authMiddleware");

// Protected routes (logged-in users)
router.post("/", protect, createOrder);
router.get("/my", protect, getMyOrders);

// Admin-only route
router.get("/", protect, admin, getAllOrders);

module.exports = router;
