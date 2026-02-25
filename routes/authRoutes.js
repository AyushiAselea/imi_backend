const express = require("express");
const router = express.Router();
const {
    registerUser,
    loginUser,
    logoutUser,
    getMe,
    syncSocialUser,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/sync", syncSocialUser);

// Protected routes
router.post("/logout", protect, logoutUser);
router.get("/me", protect, getMe);

module.exports = router;
