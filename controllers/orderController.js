const Order = require("../models/Order");
const Product = require("../models/Product");

/**
 * @desc    Create a new order (purchase products)
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res) => {
    try {
        const { products } = req.body;

        if (!products || products.length === 0) {
            return res.status(400).json({ message: "No products in order" });
        }

        // Calculate total amount and validate products
        let totalAmount = 0;
        const orderProducts = [];

        for (const item of products) {
            const product = await Product.findById(item.product);

            if (!product) {
                return res.status(404).json({
                    message: `Product not found: ${item.product}`,
                });
            }

            if (product.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
                });
            }

            totalAmount += product.price * item.quantity;
            orderProducts.push({
                product: product._id,
                quantity: item.quantity,
            });

            // Reduce stock
            product.stock -= item.quantity;
            await product.save();
        }

        // Create order
        const order = await Order.create({
            user: req.user._id,
            products: orderProducts,
            totalAmount,
        });

        // Populate product details in response
        const populatedOrder = await Order.findById(order._id)
            .populate("user", "name email")
            .populate("products.product", "name price image");

        res.status(201).json(populatedOrder);
    } catch (error) {
        console.error("Create order error:", error.message);
        res.status(500).json({ message: "Server error creating order" });
    }
};

/**
 * @desc    Get logged-in user's orders
 * @route   GET /api/orders/my
 * @access  Private
 */
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .populate("products.product", "name price image")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error("Get my orders error:", error.message);
        res.status(500).json({ message: "Server error fetching orders" });
    }
};

/**
 * @desc    Get all orders (admin only)
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate("user", "name email")
            .populate("products.product", "name price image")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error("Get all orders error:", error.message);
        res.status(500).json({ message: "Server error fetching orders" });
    }
};

module.exports = { createOrder, getMyOrders, getAllOrders };
