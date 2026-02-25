const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Settings = require("../models/Settings");
const AbandonedCart = require("../models/AbandonedCart");

// ─── DASHBOARD ───────────────────────────────────────────────

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res) => {
    try {
        const [totalProducts, activeProducts, totalOrders, totalUsers, revenueAgg, abandonedCarts, failedOrders] =
            await Promise.all([
                Product.countDocuments(),
                Product.countDocuments({ status: "active" }),
                Order.countDocuments(),
                User.countDocuments(),
                Order.aggregate([
                    { $match: { paymentStatus: { $in: ["Success", "Partial"] } } },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
                ]),
                AbandonedCart.countDocuments({ isAbandoned: true, isRecovered: false }),
                Order.countDocuments({ paymentStatus: "Failed" }),
            ]);

        const revenue =
            revenueAgg.length > 0 ? revenueAgg[0].total : 0;

        res.json({ totalProducts, activeProducts, totalOrders, totalUsers, revenue, abandonedCarts, failedOrders });
    } catch (error) {
        console.error("Dashboard stats error:", error.message);
        res.status(500).json({ message: "Server error fetching stats" });
    }
};

// ─── PRODUCTS ────────────────────────────────────────────────

/**
 * @desc    Get all products (admin)
 * @route   GET /api/admin/products
 */
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error("Admin get products error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Create a product
 * @route   POST /api/admin/products
 */
const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, stock, category, status } = req.body;
        const product = await Product.create({
            name,
            description,
            price,
            image,
            stock,
            category,
            status,
        });
        res.status(201).json(product);
    } catch (error) {
        console.error("Admin create product error:", error.message);
        res.status(500).json({ message: "Server error creating product" });
    }
};

/**
 * @desc    Update a product
 * @route   PUT /api/admin/products/:id
 */
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const fields = ["name", "description", "price", "image", "stock", "category", "status"];
        fields.forEach((f) => {
            if (req.body[f] !== undefined) product[f] = req.body[f];
        });

        const updated = await product.save();
        res.json(updated);
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Admin update product error:", error.message);
        res.status(500).json({ message: "Server error updating product" });
    }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        await product.deleteOne();
        res.json({ message: "Product deleted" });
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Admin delete product error:", error.message);
        res.status(500).json({ message: "Server error deleting product" });
    }
};

// ─── ORDERS ──────────────────────────────────────────────────

/**
 * @desc    Get all orders (admin)
 * @route   GET /api/admin/orders
 */
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate("user", "name email")
            .populate("products.product", "name price image")
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error("Admin get orders error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Update order status
 * @route   PUT /api/admin/orders/:id
 */
const updateOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (req.body.status) order.status = req.body.status;
        if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;

        const updated = await order.save();
        const populated = await Order.findById(updated._id)
            .populate("user", "name email")
            .populate("products.product", "name price image");

        res.json(populated);
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Order not found" });
        }
        console.error("Admin update order error:", error.message);
        res.status(500).json({ message: "Server error updating order" });
    }
};

// ─── USERS (read-only list) ─────────────────────────────────

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 */
const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select("-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error("Admin get users error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

// ─── SETTINGS ────────────────────────────────────────────────

/**
 * @desc    Get site settings (single document)
 * @route   GET /api/admin/settings
 */
const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json(settings);
    } catch (error) {
        console.error("Admin get settings error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Update site settings
 * @route   PUT /api/admin/settings
 */
const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        const fields = ["siteName", "contactEmail", "contactPhone", "address", "logo", "socialLinks", "tracking"];
        fields.forEach((f) => {
            if (req.body[f] !== undefined) settings[f] = req.body[f];
        });

        const updated = await settings.save();
        res.json(updated);
    } catch (error) {
        console.error("Admin update settings error:", error.message);
        res.status(500).json({ message: "Server error updating settings" });
    }
};

// ─── USER MANAGEMENT ─────────────────────────────────────────

/**
 * @desc    Get registered users who have purchased
 * @route   GET /api/admin/users/purchased
 */
const getUsersWhoPurchased = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Get unique user IDs from successful orders
        const purchasedUserIds = await Order.distinct("user", {
            paymentStatus: "Success",
        });

        const users = await User.find({ _id: { $in: purchasedUserIds } })
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = purchasedUserIds.length;

        res.json({ users, page, totalPages: Math.ceil(total / limit), total });
    } catch (error) {
        console.error("Get purchased users error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Get registered users who did NOT purchase
 * @route   GET /api/admin/users/not-purchased
 */
const getUsersNotPurchased = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Get user IDs that DO have successful orders
        const purchasedUserIds = await Order.distinct("user", {
            paymentStatus: "Success",
        });

        const users = await User.find({
            _id: { $nin: purchasedUserIds },
            role: "user",
        })
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await User.countDocuments({
            _id: { $nin: purchasedUserIds },
            role: "user",
        });

        res.json({ users, page, totalPages: Math.ceil(total / limit), total });
    } catch (error) {
        console.error("Get non-purchased users error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Get users with failed payments
 * @route   GET /api/admin/users/failed-payments
 */
const getUsersWithFailedPayments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const failedOrders = await Order.find({ paymentStatus: "Failed" })
            .populate("user", "name email")
            .populate("products.product", "name price image")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Order.countDocuments({ paymentStatus: "Failed" });

        res.json({
            orders: failedOrders,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error("Get failed payment users error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Get abandoned cart users
 * @route   GET /api/admin/users/abandoned-carts
 */
const getAbandonedCartUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const carts = await AbandonedCart.find({ isAbandoned: true })
            .populate("userId", "name email")
            .sort({ lastUpdated: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await AbandonedCart.countDocuments({ isAbandoned: true });

        res.json({
            carts,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error("Get abandoned cart users error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

// ─── TRACKING SETTINGS ──────────────────────────────────────

/**
 * @desc    Get tracking/pixel settings (public, for frontend to load scripts)
 * @route   GET /api/settings/tracking
 */
const getTrackingSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }
        res.json(settings.tracking || {});
    } catch (error) {
        console.error("Get tracking settings error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
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
};
