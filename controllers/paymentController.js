const crypto = require("crypto");
const https = require("https");
const querystring = require("querystring");
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
 *          Also handles COD and partial payment flows.
 * @route   POST /api/payment/create
 * @access  Private
 */
const createPayment = async (req, res) => {
    try {
        const {
            productId,
            quantity = 1,
            productName,
            price: inlinePrice,
            paymentMethod = "ONLINE",     // "ONLINE" | "COD" | "PARTIAL"
            shippingAddress,
        } = req.body;

        // ── Validate shipping address ────────────────────────
        if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone ||
            !shippingAddress.addressLine1 || !shippingAddress.city ||
            !shippingAddress.state || !shippingAddress.postalCode) {
            return res.status(400).json({ message: "Complete shipping address is required" });
        }

        // ── Resolve product info ─────────────────────────────
        let productDbId = null;
        let productinfo;
        let totalAmount;

        if (productId) {
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }
            if (product.stock < quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
                });
            }
            productDbId = product._id;
            productinfo = product.name;
            totalAmount = parseFloat((product.price * quantity).toFixed(2));
        } else if (productName && inlinePrice) {
            productinfo = productName;
            totalAmount = parseFloat((parseFloat(inlinePrice) * quantity).toFixed(2));
        } else {
            return res.status(400).json({ message: "Either productId or productName + price is required" });
        }

        // ── Calculate amounts based on paymentMethod ─────────
        let advanceAmount = 0;
        let remainingAmount = 0;
        let chargeAmount = totalAmount; // amount to charge via PayU
        let paymentStatus = "Pending";
        let deliveryPaymentPending = false;

        if (paymentMethod === "COD") {
            chargeAmount = 0; // no online payment
            remainingAmount = totalAmount;
            paymentStatus = "Pending";
            deliveryPaymentPending = true;
        } else if (paymentMethod === "PARTIAL") {
            advanceAmount = parseFloat((totalAmount * 0.5).toFixed(2));
            remainingAmount = parseFloat((totalAmount - advanceAmount).toFixed(2));
            chargeAmount = advanceAmount;
            deliveryPaymentPending = true;
        } else {
            // ONLINE — full payment
            advanceAmount = totalAmount;
            remainingAmount = 0;
            deliveryPaymentPending = false;
        }

        const orderProducts = productDbId
            ? [{ product: productDbId, quantity }]
            : [{ productName: productinfo, quantity, price: totalAmount / quantity }];

        // ── COD: create order immediately (no PayU) ──────────
        if (paymentMethod === "COD") {
            const order = await Order.create({
                user: req.user._id,
                products: orderProducts,
                totalAmount,
                advanceAmount: 0,
                remainingAmount: totalAmount,
                paymentMethod: "COD",
                paymentStatus: "Pending",
                deliveryPaymentPending: true,
                shippingAddress,
                status: "Processing",
            });

            // Reduce stock
            if (productDbId) {
                const product = await Product.findById(productDbId);
                if (product) {
                    product.stock -= quantity;
                    await product.save();
                }
            }

            const populated = await Order.findById(order._id)
                .populate("user", "name email")
                .populate("products.product", "name price image");

            return res.status(201).json({
                success: true,
                message: "COD order placed successfully",
                paymentMethod: "COD",
                order: populated,
            });
        }

        // ── ONLINE or PARTIAL: initiate PayU payment ─────────
        const txnid = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const firstname = req.user.name;
        const email = req.user.email;
        const phone = req.user.phone || shippingAddress.phone || "";

        const key = process.env.PAYU_MERCHANT_KEY;
        const salt = process.env.PAYU_MERCHANT_SALT;
        const payuBaseUrl = (process.env.PAYU_BASE_URL || "https://secure.payu.in").replace(/\/+$/, "");

        if (!key || !salt) {
            return res.status(500).json({ message: "PayU credentials not configured" });
        }

        const amount = chargeAmount.toFixed(2);
        const hash = generateHash({ key, txnid, amount, productinfo, firstname, email, salt });

        const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
        const surl = `${baseUrl}/api/payment/success`;
        const furl = `${baseUrl}/api/payment/failure`;

        // Create pending order
        const order = await Order.create({
            user: req.user._id,
            products: orderProducts,
            totalAmount,
            advanceAmount: paymentMethod === "PARTIAL" ? advanceAmount : totalAmount,
            remainingAmount,
            paymentMethod,
            paymentId: txnid,
            paymentStatus: "Pending",
            deliveryPaymentPending,
            shippingAddress,
            status: "Pending",
        });

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
            paymentMethod,
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

        // Set payment status based on payment method
        if (order.paymentMethod === "PARTIAL") {
            order.paymentStatus = "Partial";
        } else {
            order.paymentStatus = "Success";
        }
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
        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");
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
        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");
        res.redirect(`${frontendUrl}/payment/failure?txnid=${txnid}`);
    } catch (error) {
        console.error("Payment failure handler error:", error.message);
        res.status(500).json({ message: "Server error processing payment failure" });
    }
};

/**
 * @desc    Verify a PayU transaction using PayU's Verify Payment API
 * @route   POST /api/payment/verify
 * @access  Private
 */
const verifyPayment = async (req, res) => {
    try {
        const { txnid } = req.body;
        if (!txnid) {
            return res.status(400).json({ message: "txnid is required" });
        }

        const key  = process.env.PAYU_MERCHANT_KEY;
        const salt = process.env.PAYU_MERCHANT_SALT;

        // PayU verify hash: sha512(key|verify_payment|txnid|salt)
        const commandString = `${key}|verify_payment|${txnid}|${salt}`;
        const verifyHash = crypto.createHash("sha512").update(commandString).digest("hex");

        const postData = querystring.stringify({
            key,
            command: "verify_payment",
            var1: txnid,
            hash: verifyHash,
        });

        const options = {
            hostname: "info.payu.in",
            path: "/merchant/postservice?form=2",
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const payuResponse = await new Promise((resolve, reject) => {
            const request = https.request(options, (response) => {
                let data = "";
                response.on("data", (chunk) => { data += chunk; });
                response.on("end", () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve(data); }
                });
            });
            request.on("error", reject);
            request.write(postData);
            request.end();
        });

        // Update local order with verified status
        const order = await Order.findOne({ paymentId: txnid });
        if (order && payuResponse?.transaction_details?.[txnid]) {
            const txnStatus = payuResponse.transaction_details[txnid].status;
            if (txnStatus === "success") {
                order.paymentStatus = "Success";
                order.status = "Processing";
            } else if (txnStatus === "failure" || txnStatus === "failed") {
                order.paymentStatus = "Failed";
                order.status = "Cancelled";
            }
            await order.save();
        }

        res.status(200).json({ success: true, payuResponse, order });
    } catch (error) {
        console.error("Verify payment error:", error.message);
        res.status(500).json({ message: "Server error verifying payment" });
    }
};

module.exports = { createPayment, paymentSuccess, paymentFailure, verifyPayment };
