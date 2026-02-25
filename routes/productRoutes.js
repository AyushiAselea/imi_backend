const express = require("express");
const router = express.Router();
const {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
} = require("../controllers/productController");
const { protect, admin } = require("../middleware/authMiddleware");

// Public routes
router.get("/", getProducts);                          // Active products only (frontend)
router.get("/all", protect, admin, getAllProducts);     // All products (admin)
router.get("/:id", getProductById);

// Admin-only routes
router.post("/", protect, admin, createProduct);
router.put("/:id", protect, admin, updateProduct);
router.patch("/:id/status", protect, admin, toggleProductStatus);
router.delete("/:id", protect, admin, deleteProduct);

module.exports = router;
