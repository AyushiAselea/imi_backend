const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    createPayment,
    paymentSuccess,
    paymentFailure,
    verifyPayment,
} = require("../controllers/paymentController");

// @route   POST /api/payment/create
// @desc    Initiate PayU payment — returns form data for hosted checkout (requires auth)
router.post("/create", protect, createPayment);

// @route   POST /api/payment/success
// @desc    PayU success callback (public — called by PayU server after payment)
router.post("/success", paymentSuccess);

// @route   POST /api/payment/failure
// @desc    PayU failure callback (public — called by PayU server on failure)
router.post("/failure", paymentFailure);

// @route   POST /api/payment/verify
// @desc    Verify a PayU transaction status via PayU Verify API (requires auth)
router.post("/verify", protect, verifyPayment);

module.exports = router;
