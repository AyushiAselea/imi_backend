const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const cartRoutes = require("./routes/cartRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// Initialize Express app
const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/settings", settingsRoutes);

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ message: "IMI Backend API is running 🚀" });
});

// ─── 404 HANDLER ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).json({
        message: "Internal Server Error",
        ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
});

// ─── START SERVER ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📡 API available at http://localhost:${PORT}/api`);
        });
    } catch (err) {
        console.error("\nFailed to start server because MongoDB connection failed.");
        console.error("Possible fixes:");
        console.error("- Verify `MONGO_URI` is set correctly in the .env file at the project root.");
        console.error("- If using MongoDB Atlas, add your current IP (or 0.0.0.0/0 for testing) to Network Access (IP whitelist): https://www.mongodb.com/docs/atlas/security-whitelist/");
        console.error("- Ensure the database user and password are valid and that the user has appropriate DB privileges.");
        console.error("After fixing, restart the server (nodemon will restart automatically when files change).");
        process.exit(1);
    }
}

startServer();
