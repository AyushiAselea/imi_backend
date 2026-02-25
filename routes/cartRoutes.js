const express = require("express");
const router = express.Router();
const {
    updateCart,
    recoverCart,
} = require("../controllers/abandonedCartController");

// Public routes (called from frontend)
router.post("/update", updateCart);
router.post("/recover", recoverCart);

module.exports = router;
