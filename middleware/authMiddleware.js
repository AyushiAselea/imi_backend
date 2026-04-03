const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Protect routes — verifies JWT token and attaches user to req.
 */
const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Extract token from "Bearer <token>"
            token = req.headers.authorization.split(" ")[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user to request (exclude password)
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res.status(401).json({ message: "User not found" });
            }

            next();
        } catch (error) {
            console.error("Auth middleware error:", error.message);
            return res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

/**
 * Admin-only middleware — must be used after `protect`.
 */
const admin = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        return res.status(403).json({ message: "Access denied. Admin only." });
    }
};

/**
 * Optional auth — attaches req.user if a valid JWT is present, but does NOT block
 * unauthenticated requests. Use for guest-friendly endpoints.
 */
const optionalProtect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password") || null;
        } catch {
            req.user = null; // invalid token — treat as guest
        }
    } else {
        req.user = null;
    }
    next();
};

module.exports = { protect, admin, optionalProtect };
