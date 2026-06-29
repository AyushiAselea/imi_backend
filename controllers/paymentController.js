const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { sendOrderConfirmationEmail, sendAdminOrderNotification } = require("../utils/emailService");

/**
 * Build the Zaakpay "orderDetail" param string and compute its HMAC-SHA256 checksum.
 * Zaakpay checksum = HMAC_SHA256(secretKey, "&"-joined "key=value" order params)
 * Field order matters and must match Zaakpay's documented sequence.
 */
const buildZaakpayChecksum = (secretKey, fields) => {
    const orderString = Object.entries(fields)
        .map(([k, v]) => `${k}=${v ?? ""}`)
        .join("&");
    const checksum = crypto.createHmac("sha256", secretKey).update(orderString).digest("hex");
    return { orderString, checksum };
};

/**
 * @desc    Create Zaakpay payment — returns form fields for hosted checkout
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
            variant = "",                 // e.g. "black / black" (frameColor / glassType)
        } = req.body;

        // ── Validate shipping address ────────────────────────
        if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone ||
            !shippingAddress.addressLine1 || !shippingAddress.city ||
            !shippingAddress.state || !shippingAddress.postalCode) {
            return res.status(400).json({ message: "Complete shipping address is required" });
        }

        // For guests, email is required in the shipping address
        const isGuest = !req.user;
        if (isGuest && !shippingAddress.email) {
            return res.status(400).json({ message: "Email address is required for checkout" });
        }

        // ── Resolve identity (logged-in or guest) ────────────
        const userId    = req.user ? req.user._id : null;
        const firstname = req.user ? req.user.name  : shippingAddress.fullName;
        const email     = req.user ? req.user.email : shippingAddress.email;
        const phone     = (req.user && req.user.phone) ? req.user.phone : shippingAddress.phone;
        const guestInfo = isGuest
            ? { name: shippingAddress.fullName, email: shippingAddress.email, phone: shippingAddress.phone }
            : null;

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
        let chargeAmount = totalAmount; // amount to charge via Zaakpay
        let deliveryPaymentPending = false;

        if (paymentMethod === "COD") {
            chargeAmount = 0; // no online payment
            remainingAmount = totalAmount;
            deliveryPaymentPending = true;
        } else if (paymentMethod === "PARTIAL") {
            advanceAmount = parseFloat((totalAmount * 0.5).toFixed(2));
            remainingAmount = parseFloat((totalAmount - advanceAmount).toFixed(2));
            chargeAmount = advanceAmount;
            deliveryPaymentPending = true;
        } else {
            // ONLINE — full payment with 5% discount
            totalAmount = parseFloat((totalAmount * 0.95).toFixed(2));
            advanceAmount = totalAmount;
            remainingAmount = 0;
            chargeAmount = totalAmount;
            deliveryPaymentPending = false;
        }

        const orderProducts = productDbId
            ? [{ product: productDbId, quantity, variant }]
            : [{ productName: productinfo, quantity, price: totalAmount / quantity, variant }];

        // ── COD: create order immediately (no Zaakpay) ───────
        if (paymentMethod === "COD") {
            const order = await Order.create({
                user: userId,
                guestInfo,
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

            // Send order confirmation email + admin notification (non-blocking)
            if (email) {
                sendOrderConfirmationEmail(email, firstname, populated)
                    .then(() => console.log(`📧 Order email sent to ${email}`))
                    .catch((err) => console.error("Order email failed:", err.message));
                sendAdminOrderNotification(firstname, email, populated)
                    .then(() => console.log(`📧 Admin notified: new order`))
                    .catch((err) => console.error("Admin order notification failed:", err.message));
            }

            return res.status(201).json({
                success: true,
                message: "COD order placed successfully",
                paymentMethod: "COD",
                order: populated,
            });
        }

        // ── ONLINE or PARTIAL: initiate Zaakpay payment ──────
        if (!email) {
            return res.status(400).json({ message: "Email address is required for online payment" });
        }

        const txnid = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const merchantIdentifier = process.env.ZAAKPAY_MERCHANT_IDENTIFIER;
        const secretKey = process.env.ZAAKPAY_SECRET_KEY;
        const zaakpayBaseUrl = (process.env.ZAAKPAY_BASE_URL || "https://zaakstaging.zaakpay.com").replace(/\/+$/, "");

        if (!merchantIdentifier || !secretKey) {
            return res.status(500).json({ message: "Zaakpay credentials not configured" });
        }

        const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
        const returnUrl = `${baseUrl}/api/payment/callback`;

        // Create pending order
        const order = await Order.create({
            user: userId,
            guestInfo,
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

        // Zaakpay amount is in paise (smallest currency unit)
        const amountInPaise = Math.round(chargeAmount * 100);

        const zaakpayFields = {
            merchantIdentifier,
            orderId: txnid,
            amount: amountInPaise,
            currency: "INR",
            email,
            mode: "0",          // 0 = all payment modes
            returnUrl,
            buyerFirstName: firstname,
            buyerEmail: email,
            buyerPhoneNumber: phone || "",
            buyerAddress: shippingAddress.addressLine1,
            buyerCity: shippingAddress.city,
            buyerState: shippingAddress.state,
            buyerCountry: shippingAddress.country || "India",
            buyerPincode: shippingAddress.postalCode,
            purpose: productinfo,
        };

        const { checksum } = buildZaakpayChecksum(secretKey, zaakpayFields);

        const paymentData = {
            ...zaakpayFields,
            checksum,
            action: `${zaakpayBaseUrl}/api/paymentTransact`,
            orderDbId: order._id,
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
 * @desc    Handle Zaakpay return callback (success/failure both land here)
 * @route   POST /api/payment/callback
 * @access  Public (called by Zaakpay)
 */
const paymentCallback = async (req, res) => {
    try {
        const {
            responseCode,
            orderId,
            checksum: receivedChecksum,
            txnId: zaakpayTxnId,
        } = req.body;

        const secretKey = process.env.ZAAKPAY_SECRET_KEY;

        // Verify checksum: recompute HMAC-SHA256 over all fields except checksum itself
        const fieldsForChecksum = { ...req.body };
        delete fieldsForChecksum.checksum;
        const { checksum: calculatedChecksum } = buildZaakpayChecksum(secretKey, fieldsForChecksum);

        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");

        if (!receivedChecksum || calculatedChecksum !== receivedChecksum) {
            console.error("Zaakpay checksum verification failed for orderId:", orderId);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}`);
        }

        // Find the order (Zaakpay's orderId == our txnid)
        const order = await Order.findOne({ paymentId: orderId });
        if (!order) {
            console.error("Order not found for txnid:", orderId);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}`);
        }

        // responseCode "100" == success per Zaakpay docs
        const isSuccess = responseCode === "100" || responseCode === 100;

        if (!isSuccess) {
            order.paymentStatus = "Failed";
            order.status = "Cancelled";
            await order.save();
            console.warn("Payment failed for txnid:", orderId, "| responseCode:", responseCode);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}`);
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

        // Send order confirmation email (non-blocking)
        try {
            const populated = await Order.findById(order._id)
                .populate("user", "name email")
                .populate("products.product", "name price image");
            if (populated.user && populated.user.email) {
                sendOrderConfirmationEmail(populated.user.email, populated.user.name, populated)
                    .then(() => console.log(`📧 Order email sent to ${populated.user.email}`))
                    .catch((err) => console.error("Order email failed:", err.message));
                sendAdminOrderNotification(populated.user.name, populated.user.email, populated)
                    .then(() => console.log(`📧 Admin notified: new order`))
                    .catch((err) => console.error("Admin order notification failed:", err.message));
            }
        } catch (emailErr) {
            console.error("Order email lookup failed:", emailErr.message);
        }

        res.redirect(`${frontendUrl}/payment/success?txnid=${orderId}&mihpayid=${zaakpayTxnId || ""}`);
    } catch (error) {
        console.error("Payment callback handler error:", error.message);
        const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");
        res.redirect(`${frontendUrl}/payment/failure`);
    }
};

/**
 * @desc    Verify a Zaakpay transaction using Zaakpay's Check Transaction Status API
 * @route   POST /api/payment/verify
 * @access  Private
 */
const verifyPayment = async (req, res) => {
    try {
        const { txnid } = req.body;
        if (!txnid) {
            return res.status(400).json({ message: "txnid is required" });
        }

        const merchantIdentifier = process.env.ZAAKPAY_MERCHANT_IDENTIFIER;
        const secretKey = process.env.ZAAKPAY_SECRET_KEY;
        const zaakpayBaseUrl = (process.env.ZAAKPAY_BASE_URL || "https://zaakstaging.zaakpay.com").replace(/\/+$/, "");

        const statusFields = { merchantIdentifier, orderId: txnid };
        const { checksum } = buildZaakpayChecksum(secretKey, statusFields);

        const response = await fetch(`${zaakpayBaseUrl}/api/checkTxnStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ...statusFields, checksum }).toString(),
        });
        const zaakpayResponse = await response.json().catch(() => ({}));

        // Update local order with verified status
        const order = await Order.findOne({ paymentId: txnid });
        if (order && zaakpayResponse?.responseCode != null) {
            const isSuccess = zaakpayResponse.responseCode === "100" || zaakpayResponse.responseCode === 100;
            if (isSuccess) {
                order.paymentStatus = "Success";
                order.status = "Processing";
            } else {
                order.paymentStatus = "Failed";
                order.status = "Cancelled";
            }
            await order.save();
        }

        res.status(200).json({ success: true, zaakpayResponse, order });
    } catch (error) {
        console.error("Verify payment error:", error.message);
        res.status(500).json({ message: "Server error verifying payment" });
    }
};

module.exports = { createPayment, paymentCallback, verifyPayment };
