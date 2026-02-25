const AbandonedCart = require("../models/AbandonedCart");

/**
 * @desc    Update or create cart (called from frontend when user adds items)
 * @route   POST /api/cart/update
 * @access  Public
 */
const updateCart = async (req, res) => {
    try {
        const { sessionId, userId, email, products, totalAmount } = req.body;

        if (!sessionId) {
            return res.status(400).json({ message: "sessionId is required" });
        }

        let cart = await AbandonedCart.findOne({ sessionId });

        if (cart) {
            cart.products = products || cart.products;
            cart.totalAmount = totalAmount || cart.totalAmount;
            cart.userId = userId || cart.userId;
            cart.email = email || cart.email;
            cart.lastUpdated = new Date();
            cart.isAbandoned = true;
            cart.isRecovered = false;
            await cart.save();
        } else {
            cart = await AbandonedCart.create({
                sessionId,
                userId: userId || null,
                email: email || "",
                products: products || [],
                totalAmount: totalAmount || 0,
                isAbandoned: true,
                lastUpdated: new Date(),
            });
        }

        res.json({ success: true, cartId: cart._id });
    } catch (error) {
        console.error("Update cart error:", error.message);
        res.status(500).json({ message: "Server error updating cart" });
    }
};

/**
 * @desc    Mark cart as recovered (called after successful checkout)
 * @route   POST /api/cart/recover
 * @access  Public
 */
const recoverCart = async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ message: "sessionId is required" });
        }

        const cart = await AbandonedCart.findOne({ sessionId });
        if (cart) {
            cart.isAbandoned = false;
            cart.isRecovered = true;
            await cart.save();
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Recover cart error:", error.message);
        res.status(500).json({ message: "Server error recovering cart" });
    }
};

/**
 * @desc    Get all abandoned carts (admin)
 * @route   GET /api/admin/abandoned-carts
 * @access  Private/Admin
 */
const getAbandonedCarts = async (req, res) => {
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
        console.error("Get abandoned carts error:", error.message);
        res.status(500).json({ message: "Server error fetching abandoned carts" });
    }
};

/**
 * @desc    Get abandoned cart stats (admin)
 * @route   GET /api/admin/abandoned-carts/stats
 * @access  Private/Admin
 */
const getAbandonedCartStats = async (req, res) => {
    try {
        const [totalAbandoned, totalRecovered, totalValueAgg] = await Promise.all([
            AbandonedCart.countDocuments({ isAbandoned: true }),
            AbandonedCart.countDocuments({ isRecovered: true }),
            AbandonedCart.aggregate([
                { $match: { isAbandoned: true } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]),
        ]);

        const totalValue = totalValueAgg.length > 0 ? totalValueAgg[0].total : 0;

        res.json({
            totalAbandoned,
            totalRecovered,
            totalAbandonedValue: totalValue,
            recoveryRate:
                totalAbandoned + totalRecovered > 0
                    ? ((totalRecovered / (totalAbandoned + totalRecovered)) * 100).toFixed(1)
                    : 0,
        });
    } catch (error) {
        console.error("Abandoned cart stats error:", error.message);
        res.status(500).json({ message: "Server error fetching abandoned cart stats" });
    }
};

module.exports = { updateCart, recoverCart, getAbandonedCarts, getAbandonedCartStats };
