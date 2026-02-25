const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");
const {
    getDashboardStats,
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getOrders,
    updateOrder,
    getUsers,
    getSettings,
    updateSettings,
    getUsersWhoPurchased,
    getUsersNotPurchased,
    getUsersWithFailedPayments,
    getAbandonedCartUsers,
    getTrackingSettings,
} = require("../controllers/adminController");
const {
    getAbandonedCarts,
    getAbandonedCartStats,
} = require("../controllers/abandonedCartController");
const {
    getDashboard: getAnalyticsDashboard,
    getRealtime: getAnalyticsRealtime,
} = require("../controllers/analyticsController");

// All admin routes require authentication + admin role
router.use(protect, admin);

// Dashboard
router.get("/stats", getDashboardStats);

// Products CRUD
router.get("/products", getProducts);
router.post("/products", createProduct);
router.put("/products/:id", updateProduct);
router.delete("/products/:id", deleteProduct);

// Orders
router.get("/orders", getOrders);
router.put("/orders/:id", updateOrder);

// Users (read-only)
router.get("/users", getUsers);
router.get("/users/purchased", getUsersWhoPurchased);
router.get("/users/not-purchased", getUsersNotPurchased);
router.get("/users/failed-payments", getUsersWithFailedPayments);
router.get("/users/abandoned-carts", getAbandonedCartUsers);

// Abandoned Carts
router.get("/abandoned-carts", getAbandonedCarts);
router.get("/abandoned-carts/stats", getAbandonedCartStats);

// Analytics
router.get("/analytics/dashboard", getAnalyticsDashboard);
router.get("/analytics/realtime", getAnalyticsRealtime);

// Settings
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

module.exports = router;
