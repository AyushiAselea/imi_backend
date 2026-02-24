const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
    createPayment,
    paymentSuccess,
    paymentFailure,
} = require("../controllers/paymentController");

// @route   POST /api/payment/create
// @desc    Initiate PayU payment (requires auth)
router.post("/create", protect, createPayment);

// @route   POST /api/payment/success
// @desc    PayU success callback (public — called by PayU server)
router.post("/success", paymentSuccess);

// @route   POST /api/payment/failure
// @desc    PayU failure callback (public — called by PayU server)
router.post("/failure", paymentFailure);

module.exports = router;
