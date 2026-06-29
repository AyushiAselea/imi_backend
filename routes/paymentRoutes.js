const express = require("express");
const router = express.Router();
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const {
    createPayment,
    paymentCallback,
    verifyPayment,
} = require("../controllers/paymentController");

// @route   POST /api/payment/create
// @desc    Initiate payment — works for both logged-in users and guests
router.post("/create", optionalProtect, createPayment);

// @route   POST /api/payment/callback
// @desc    Zaakpay return callback — handles both success and failure (public — called by Zaakpay)
router.post("/callback", paymentCallback);

// @route   POST /api/payment/verify
// @desc    Verify a Zaakpay transaction status via Zaakpay Check Txn Status API (requires auth)
router.post("/verify", protect, verifyPayment);

module.exports = router;
