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
const enquiryRoutes = require("./routes/enquiryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const cartRoutes = require("./routes/cartRoutes");
const settingsRoutes = require("./routes/settingsRoutes");

// Initialize Express app
const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────
// Reflect the request origin rather than sending "*". navigator.sendBeacon
// (used by the analytics tracker) always sends credentials mode "include",
// and browsers reject a wildcard Access-Control-Allow-Origin in that case.
const corsOptions = {
  origin: (origin, callback) => callback(null, origin || true),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
// Explicitly handle preflight for all routes
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── STATIC FILES ────────────────────────────────────────────
// Serve product variant images from /variants/* (e.g. /variants/mark1/mark1_black_black_v1.png)
app.use("/variants", express.static("public/variants"));

// ─── ROUTES ──────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/settings", settingsRoutes);

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ message: "IMI Backend API is running 🚀" });
});

// ─── TEMPORARY DIAGNOSTIC ────────────────────────────────────
// Reports this server's outbound IP so we can give Zaakpay the address our
// payment requests originate from, and shows whether their endpoints are
// reachable from Render. REMOVE once Zaakpay has finished investigating.
app.get("/api/debug/ip", async (req, res) => {
    const probe = async (url, opts) => {
        const started = Date.now();
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(15000), ...opts });
            return { status: r.status, ms: Date.now() - started };
        } catch (err) {
            return { error: err.name === "TimeoutError" ? "timeout" : err.message, ms: Date.now() - started };
        }
    };

    const ipRes = await probe("https://api.ipify.org?format=json");
    let outboundIp = null;
    try {
        const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(15000) });
        outboundIp = (await r.json()).ip;
    } catch { /* reported via ipRes */ }

    res.json({
        outboundIp,
        ipLookup: ipRes,
        region: process.env.RENDER_REGION || "unknown",
        serviceId: process.env.RENDER_SERVICE_ID || "unknown",
        zaakpayBaseUrl: process.env.ZAAKPAY_BASE_URL || null,
        reachability: {
            zaakpayHomepage: await probe("https://zaakpay.com/"),
            zaakpayTransactV13: await probe("https://zaakpay.com/api/paymentTransact/V13", { method: "POST", body: "t=1", headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
            zaakpayStaging: await probe("https://zaakstaging.zaakpay.com/api/paymentTransact/V13", { method: "POST", body: "t=1", headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
        },
        checkedAt: new Date().toISOString(),
    });
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
