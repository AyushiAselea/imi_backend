const express = require("express");
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");

// Public routes
router.get("/", getProducts);
router.get("/:id", getProductById);

// Admin-only route
router.post("/", protect, admin, createProduct);

module.exports = router;
