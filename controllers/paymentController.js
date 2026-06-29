const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { sendOrderConfirmationEmail, sendAdminOrderNotification } = require("../utils/emailService");

/**
 * Zaakpay V13 checksum — HMAC-SHA256 over the ordered pipe-separated param values.
 *
 * Official field order for /api/paymentTransact/V13 (from Zaakpay integration docs):
 *   merchantIdentifier | orderId | amount | currency | buyerEmailAddress |
 *   buyerFirstName | buyerLastName | buyerAddress | buyerCity | buyerState |
 *   buyerCountry | buyerPincode | buyerPhoneNumber | productDescription |
 *   returnUrl | mode
 *
 * All values are joined with "|" and HMAC-SHA256'd with the merchant's Generated Key.
 */
const CHECKSUM_FIELD_ORDER = [
    "merchantIdentifier",
    "orderId",
    "amount",
    "currency",
    "buyerEmailAddress",
    "buyerFirstName",
    "buyerLastName",
    "buyerAddress",
    "buyerCity",
    "buyerState",
    "buyerCountry",
    "buyerPincode",
    "buyerPhoneNumber",
    "productDescription",
    "returnUrl",
    "mode",
];

const buildZaakpayChecksum = (secretKey, fields) => {
    const valueString = CHECKSUM_FIELD_ORDER.map((k) => fields[k] ?? "").join("|");
    const checksum = crypto.createHmac("sha256", secretKey).update(valueString).digest("hex");
    return checksum;
};

/**
 * @desc    Create Zaakpay payment — returns form fields for hosted checkout (V13)
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
        const userId       = req.user ? req.user._id : null;
        const fullName     = req.user ? req.user.name  : shippingAddress.fullName;
        const email        = req.user ? req.user.email : shippingAddress.email;
        const phone        = (req.user && req.user.phone) ? req.user.phone : shippingAddress.phone;
        const guestInfo    = isGuest
            ? { name: shippingAddress.fullName, email: shippingAddress.email, phone: shippingAddress.phone }
            : null;

        // Split full name into first / last for Zaakpay's required fields
        const nameParts    = fullName.trim().split(/\s+/);
        const buyerFirstName = nameParts[0] || fullName;
        const buyerLastName  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : ".";

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
        let chargeAmount = totalAmount;
        let deliveryPaymentPending = false;

        if (paymentMethod === "COD") {
            chargeAmount = 0;
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

            if (email) {
                sendOrderConfirmationEmail(email, fullName, populated)
                    .then(() => console.log(`📧 Order email sent to ${email}`))
                    .catch((err) => console.error("Order email failed:", err.message));
                sendAdminOrderNotification(fullName, email, populated)
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

        // ── ONLINE or PARTIAL: initiate Zaakpay V13 payment ──
        if (!email) {
            return res.status(400).json({ message: "Email address is required for online payment" });
        }

        const txnid = `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        const merchantIdentifier = process.env.ZAAKPAY_MERCHANT_IDENTIFIER;
        const secretKey          = process.env.ZAAKPAY_SECRET_KEY;
        const zaakpayBaseUrl     = (process.env.ZAAKPAY_BASE_URL || "https://zaakstaging.zaakpay.com").replace(/\/+$/, "");

        if (!merchantIdentifier || !secretKey) {
            return res.status(500).json({ message: "Zaakpay credentials not configured" });
        }

        const baseUrl   = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
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

        // Zaakpay amount is in paise (integer, no decimals)
        const amountInPaise = String(Math.round(chargeAmount * 100));

        const zaakpayFields = {
            merchantIdentifier,
            orderId:             txnid,
            amount:              amountInPaise,
            currency:            "INR",
            buyerEmailAddress:   email,
            buyerFirstName,
            buyerLastName,
            buyerAddress:        shippingAddress.addressLine1,
            buyerCity:           shippingAddress.city,
            buyerState:          shippingAddress.state,
            buyerCountry:        shippingAddress.country || "India",
            buyerPincode:        shippingAddress.postalCode,
            buyerPhoneNumber:    phone || "",
            productDescription:  productinfo,
            returnUrl,
            mode:                "0",   // 0 = all payment modes
        };

        const checksum = buildZaakpayChecksum(secretKey, zaakpayFields);

        const paymentData = {
            ...zaakpayFields,
            checksum,
            action:   `${zaakpayBaseUrl}/api/paymentTransact/V13`,
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
 * @desc    Handle Zaakpay V13 return callback (success/failure both land here)
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

        const secretKey    = process.env.ZAAKPAY_SECRET_KEY;
        const frontendUrl  = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");

        // Verify checksum: rebuild from the same ordered fields, excluding "checksum" itself
        const fieldsForChecksum = { ...req.body };
        delete fieldsForChecksum.checksum;
        const calculatedChecksum = buildZaakpayChecksum(secretKey, fieldsForChecksum);

        if (!receivedChecksum || calculatedChecksum !== receivedChecksum) {
            console.error("Zaakpay checksum verification failed for orderId:", orderId);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId || ""}`);
        }

        // Find the order (our txnid == Zaakpay's orderId)
        const order = await Order.findOne({ paymentId: orderId });
        if (!order) {
            console.error("Order not found for txnid:", orderId);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId || ""}`);
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

        order.paymentStatus = order.paymentMethod === "PARTIAL" ? "Partial" : "Success";
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
            const recipientEmail = populated.user?.email || order.guestInfo?.email;
            const recipientName  = populated.user?.name  || order.guestInfo?.name;
            if (recipientEmail) {
                sendOrderConfirmationEmail(recipientEmail, recipientName, populated)
                    .then(() => console.log(`📧 Order email sent to ${recipientEmail}`))
                    .catch((err) => console.error("Order email failed:", err.message));
                sendAdminOrderNotification(recipientName, recipientEmail, populated)
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
        const secretKey          = process.env.ZAAKPAY_SECRET_KEY;
        const zaakpayBaseUrl     = (process.env.ZAAKPAY_BASE_URL || "https://zaakstaging.zaakpay.com").replace(/\/+$/, "");

        // checkTxnStatus uses only merchantIdentifier + orderId for its checksum
        const statusFields = { merchantIdentifier, orderId: txnid };
        const checksum = buildZaakpayChecksum(secretKey, statusFields);

        const response = await fetch(`${zaakpayBaseUrl}/api/checkTxnStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ...statusFields, checksum }).toString(),
        });
        const zaakpayResponse = await response.json().catch(() => ({}));

        const order = await Order.findOne({ paymentId: txnid });
        if (order && zaakpayResponse?.responseCode != null) {
            const isSuccess = zaakpayResponse.responseCode === "100" || zaakpayResponse.responseCode === 100;
            order.paymentStatus = isSuccess ? "Success" : "Failed";
            order.status        = isSuccess ? "Processing" : "Cancelled";
            await order.save();
        }

        res.status(200).json({ success: true, zaakpayResponse, order });
    } catch (error) {
        console.error("Verify payment error:", error.message);
        res.status(500).json({ message: "Server error verifying payment" });
    }
};

module.exports = { createPayment, paymentCallback, verifyPayment };
