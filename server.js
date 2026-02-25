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
// Explicitly allow the frontend/admin origins (Vercel) + localhost for dev
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:5174",  // admin dev server
  "https://imi-ai-smartwear.vercel.app",
  // Also allow whatever FRONTEND_URL is set to in Render env
  ...(process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL.replace(/\/+$/, "").replace(/^http:\/\//, "https://")]
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, PayU callbacks)
      if (!origin) return callback(null, true);
      // Allow all Vercel preview/production deployments (covers imi_admin on Vercel too)
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
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
const HOST = "0.0.0.0"; // Required for Render / cloud deployments

async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, HOST, () => {
            console.log(`🚀 Server running on ${HOST}:${PORT}`);
            console.log(`📡 API available at http://${HOST}:${PORT}/api`);
        });
    } catch (err) {
        console.error("\nFailed to start server because MongoDB connection failed.");
        console.error("Possible fixes:");
        console.error("- Set MONGO_URI in Render Dashboard → Environment Variables.");
        console.error("- In MongoDB Atlas → Network Access → add 0.0.0.0/0 to allow all IPs.");
        console.error("- Ensure the database user and password are valid.");
        process.exit(1);
    }
}

startServer();
