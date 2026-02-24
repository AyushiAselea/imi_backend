const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");

/**
 * Generate PayU hash using SHA-512.
 *
 * hashString = key|txnid|amount|productinfo|firstname|email|||||||||||salt
 */
const generateHash = (params) => {
    const { key, txnid, amount, productinfo, firstname, email, salt } = params;
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    return crypto.createHash("sha512").update(hashString).digest("hex");
};

/**
 * Verify PayU response hash (reverse hash).
 *
 * reverseHashString = salt|status|||||||||||email|firstname|productinfo|amount|txnid|key
 */
const verifyHash = (params) => {
    const { salt, status, email, firstname, productinfo, amount, txnid, key } = params;
    const reverseHashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    return crypto.createHash("sha512").update(reverseHashString).digest("hex");
};

/**
 * @desc    Create PayU payment — returns form fields for hosted checkout
 * @route   POST /api/payment/create
 * @access  Private
 */
const createPayment = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;

        if (!productId) {
            return res.status(400).json({ message: "productId is required" });
        }

        // Fetch product from database
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.stock < quantity) {
            return res.status(400).json({
                message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
            });
        }

        // Calculate total amount
        const amount = (product.price * quantity).toFixed(2);

        // Generate unique transaction ID
        const txnid = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // User details from authenticated request
        const firstname = req.user.name;
        const email = req.user.email;
        const phone = req.user.phone || "";
        const productinfo = product.name;

        // PayU credentials
        const key = process.env.PAYU_MERCHANT_KEY;
        const salt = process.env.PAYU_MERCHANT_SALT;
        const payuBaseUrl = process.env.PAYU_BASE_URL || "https://test.payu.in";

        if (!key || !salt) {
            return res.status(500).json({ message: "PayU credentials not configured" });
        }

        // Generate hash
        const hash = generateHash({ key, txnid, amount, productinfo, firstname, email, salt });

        // Success and failure callback URLs
        const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const surl = `${baseUrl}/api/payment/success`;
        const furl = `${baseUrl}/api/payment/failure`;

        // Create a pending order in database
        const order = await Order.create({
            user: req.user._id,
            products: [{ product: product._id, quantity }],
            totalAmount: parseFloat(amount),
            paymentId: txnid,
            paymentStatus: "Pending",
            status: "Pending",
        });

        // Return PayU form parameters
        const paymentData = {
            key,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            phone,
            surl,
            furl,
            hash,
            action: `${payuBaseUrl}/_payment`,
            orderId: order._id,
        };

        res.status(200).json({
            success: true,
            message: "Payment initiated",
            paymentData,
        });
    } catch (error) {
        console.error("Create payment error:", error.message);
        res.status(500).json({ message: "Server error creating payment" });
    }
};

/**
 * @desc    Handle PayU success callback
 * @route   POST /api/payment/success
 * @access  Public (called by PayU)
 */
const paymentSuccess = async (req, res) => {
    try {
        const {
            mihpayid,
            status,
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            hash: receivedHash,
        } = req.body;

        // Verify the response hash
        const salt = process.env.PAYU_MERCHANT_SALT;
        const key = process.env.PAYU_MERCHANT_KEY;

        const calculatedHash = verifyHash({
            salt,
            status,
            email,
            firstname,
            productinfo,
            amount,
            txnid,
            key,
        });

        if (calculatedHash !== receivedHash) {
            console.error("Payment hash verification failed for txnid:", txnid);
            return res.status(400).json({ message: "Payment verification failed — hash mismatch" });
        }

        // Find and update the order
        const order = await Order.findOne({ paymentId: txnid });
        if (!order) {
            console.error("Order not found for txnid:", txnid);
            return res.status(404).json({ message: "Order not found" });
        }

        order.paymentStatus = "Success";
        order.status = "Processing";
        await order.save();

        // Reduce product stock
        for (const item of order.products) {
            const product = await Product.findById(item.product);
            if (product) {
                product.stock -= item.quantity;
                await product.save();
            }
        }

        // Redirect to frontend success page
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/payment/success?txnid=${txnid}&mihpayid=${mihpayid}`);
    } catch (error) {
        console.error("Payment success handler error:", error.message);
        res.status(500).json({ message: "Server error processing payment success" });
    }
};

/**
 * @desc    Handle PayU failure callback
 * @route   POST /api/payment/failure
 * @access  Public (called by PayU)
 */
const paymentFailure = async (req, res) => {
    try {
        const { txnid, status } = req.body;

        // Find and update the order
        const order = await Order.findOne({ paymentId: txnid });
        if (order) {
            order.paymentStatus = "Failed";
            order.status = "Cancelled";
            await order.save();
        }

        console.warn("Payment failed for txnid:", txnid, "| Status:", status);

        // Redirect to frontend failure page
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        res.redirect(`${frontendUrl}/payment/failure?txnid=${txnid}`);
    } catch (error) {
        console.error("Payment failure handler error:", error.message);
        res.status(500).json({ message: "Server error processing payment failure" });
    }
};

module.exports = { createPayment, paymentSuccess, paymentFailure };
