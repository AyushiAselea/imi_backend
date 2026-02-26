const express = require("express");
const router = express.Router();
const {
    updateCart,
    recoverCart,
} = require("../controllers/abandonedCartController");
const {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getAllCarts,
} = require("../controllers/cartController");
const { protect, admin } = require("../middleware/authMiddleware");

// ─── Abandoned Cart (public, session-based) ──────────────────
router.post("/abandoned/update", updateCart);
router.post("/abandoned/recover", recoverCart);

// Legacy aliases (keep backward compatibility)
router.post("/update", updateCart);
router.post("/recover", recoverCart);

// ─── User Cart (authenticated) ───────────────────────────────
router.get("/", protect, getCart);
router.post("/add", protect, addToCart);
router.put("/item", protect, updateCartItem);
router.delete("/remove", protect, removeFromCart);
router.delete("/clear", protect, clearCart);

// ─── Admin: Monitor all carts ────────────────────────────────
router.get("/admin/all", protect, admin, getAllCarts);

module.exports = router;
