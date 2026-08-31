const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { sendOrderConfirmationEmail, sendAdminOrderNotification } = require("../utils/emailService");

/**
 * Zaakpay checksum — HMAC-SHA256 over alphabetically-sorted non-empty fields.
 *
 * Per official Zaakpay docs:
 *   1. Take all posted fields (excluding "checksum" itself).
 *   2. Sort keys alphabetically (A-Z).
 *   3. Exclude any field whose value is empty/null/undefined.
 *   4. Build string: "key1=val1&key2=val2&..." (trailing "&" after each pair).
 *   5. HMAC-SHA256(generatedKey, string).digest("hex").
 */
const buildZaakpayChecksum = (secretKey, fields) => {
    const str = Object.keys(fields)
        .sort()
        .filter((k) => fields[k] !== "" && fields[k] != null)
        .map((k) => `${k}=${fields[k]}&`)
        .join("");
    return crypto.createHmac("sha256", secretKey).update(str).digest("hex");
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
        // Zaakpay requires the return URL to be on the same domain as the
        // registered Website URL, so it points at the public site (which
        // proxies /api/payment/* through to this backend) rather than at the
        // backend host directly. Falls back to BACKEND_URL if unset.
        const returnUrlBase = (process.env.PAYMENT_RETURN_URL_BASE || baseUrl).replace(/\/+$/, "");
        const returnUrl = `${returnUrlBase}/api/payment/callback`;

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
            amount:              amountInPaise,
            buyerAddress:        shippingAddress.addressLine1,
            buyerCity:           shippingAddress.city,
            buyerCountry:        shippingAddress.country || "India",
            buyerEmail:          email,
            buyerFirstName,
            buyerLastName,
            buyerPhoneNumber:    phone || "",
            buyerPincode:        shippingAddress.postalCode,
            buyerState:          shippingAddress.state,
            currency:            "INR",
            merchantIdentifier,
            mode:                "0",
            orderId:             txnid,
            productDescription:  productinfo,
            returnUrl,
        };

        const checksum = buildZaakpayChecksum(secretKey, zaakpayFields);
        console.log(`[Zaakpay] txnid=${txnid} checksum=${checksum}`);

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
 * Ask Zaakpay directly whether a transaction succeeded, via the Check Transaction
 * Status API. This is a server-to-server call to Zaakpay, so its answer is
 * trustworthy independent of anything the browser posted back to us.
 *
 * Returns true/false when Zaakpay gives a definitive answer, or null if the
 * status could not be determined (network error, unparseable response).
 */
const confirmTransactionWithZaakpay = async (orderId) => {
    try {
        const merchantIdentifier = process.env.ZAAKPAY_MERCHANT_IDENTIFIER;
        const secretKey          = process.env.ZAAKPAY_SECRET_KEY;
        const zaakpayBaseUrl     = (process.env.ZAAKPAY_BASE_URL || "https://zaakstaging.zaakpay.com").replace(/\/+$/, "");

        const statusFields = { merchantIdentifier, orderId };
        const checksum = buildZaakpayChecksum(secretKey, statusFields);

        const response = await fetch(`${zaakpayBaseUrl}/api/checkTxnStatus`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ...statusFields, checksum }).toString(),
        });
        const body = await response.json().catch(() => null);

        if (!body) {
            console.error("[Zaakpay verify] unparseable status response for", orderId);
            return null;
        }

        console.log("[Zaakpay verify] status response for", orderId, ":", JSON.stringify(body));

        // Zaakpay nests the txn under different keys depending on the account;
        // check the top level and the common containers.
        const record = body.orderDetail || body.txnDetail ||
                       (Array.isArray(body.orders) ? body.orders[0] : null) || body;
        const code = record.responseCode ?? body.responseCode;

        if (code == null) return null;
        return String(code).trim() === "100";
    } catch (err) {
        console.error("[Zaakpay verify] status check failed for", orderId, ":", err.message);
        return null;
    }
};

/**
 * @desc    Handle Zaakpay V13 return callback (success/failure both land here)
 * @route   POST /api/payment/callback
 * @access  Public (called by Zaakpay)
 */
const paymentCallback = async (req, res) => {
    try {
        // Log the raw callback so the exact field shape Zaakpay posts is visible.
        console.log("[Zaakpay callback] raw body:", JSON.stringify(req.body));

        // Zaakpay V13 posts the result as a JSON string in a "data" field rather
        // than as flat form fields. Older/alternate integrations post flat fields,
        // so support both.
        let payload = req.body;
        if (typeof req.body.data === "string") {
            try {
                payload = JSON.parse(req.body.data);
                console.log("[Zaakpay callback] parsed data:", JSON.stringify(payload));
            } catch (parseErr) {
                console.error("[Zaakpay callback] could not parse data field:", parseErr.message);
            }
        }

        const responseCode     = payload.responseCode;
        const orderId          = payload.orderId;
        const receivedChecksum = payload.checksum ?? req.body.checksum;
        const zaakpayTxnId     = payload.txnId ?? payload.zaakpayTxnId;

        const secretKey    = process.env.ZAAKPAY_SECRET_KEY;
        const frontendUrl  = (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");

        // Verify checksum. Zaakpay signs the RESPONSE differently from the request:
        // when the result arrives as a "data" field, the HMAC is computed over that
        // exact JSON string as-sent — not over re-sorted key=value pairs. Re-sorting
        // the parsed object produces a different string and always mismatches.
        // Try the response form first, then fall back to the request-style form for
        // flat (non-"data") callbacks.
        const candidates = [];
        if (typeof req.body.data === "string") {
            candidates.push(["data-string", crypto.createHmac("sha256", secretKey).update(req.body.data).digest("hex")]);
        }
        const fieldsForChecksum = { ...payload };
        delete fieldsForChecksum.checksum;
        candidates.push(["sorted-fields", buildZaakpayChecksum(secretKey, fieldsForChecksum)]);

        const matched = receivedChecksum
            ? candidates.find(([, value]) => value === receivedChecksum)
            : null;

        let verifiedBy = matched ? matched[0] : null;

        if (!verifiedBy) {
            // We could not reproduce Zaakpay's response signature. Rather than
            // failing a payment that may well have succeeded, ask Zaakpay directly
            // over a server-to-server call — an answer from their API is at least
            // as trustworthy as a checksum on a browser-posted form.
            console.warn(
                "Zaakpay checksum verification failed for orderId:", orderId,
                "| received:", receivedChecksum,
                "| tried:", JSON.stringify(Object.fromEntries(candidates)),
                "| responseCode:", responseCode,
                "— falling back to Check Transaction Status API"
            );

            if (!orderId) {
                return res.redirect(`${frontendUrl}/payment/failure?reason=checksum`);
            }

            const confirmed = await confirmTransactionWithZaakpay(orderId);

            if (confirmed === true) {
                verifiedBy = "status-api";
            } else if (confirmed === false) {
                console.warn("[Zaakpay] status API reports failure for", orderId);
                const failedOrder = await Order.findOne({ paymentId: orderId });
                if (failedOrder) {
                    failedOrder.paymentStatus = "Failed";
                    failedOrder.status = "Cancelled";
                    await failedOrder.save();
                }
                return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}`);
            } else {
                // Indeterminate: do NOT mark the order failed — money may have been
                // taken. Leave it Pending for manual reconciliation.
                console.error("[Zaakpay] could not determine status for", orderId, "— left Pending");
                return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}&reason=unverified`);
            }
        }
        console.log(`[Zaakpay callback] payment verified via ${verifiedBy} for orderId=${orderId}`);

        // Find the order (our txnid == Zaakpay's orderId)
        const order = await Order.findOne({ paymentId: orderId });
        if (!order) {
            console.error("Order not found for txnid:", orderId);
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId || ""}`);
        }

        // responseCode "100" == success per Zaakpay docs. Zaakpay may send it as a
        // string or number, and some responses zero-pad it, so normalise first.
        const isSuccess = String(responseCode).trim() === "100";

        if (!isSuccess) {
            order.paymentStatus = "Failed";
            order.status = "Cancelled";
            await order.save();
            console.warn(
                "Payment failed for txnid:", orderId,
                "| responseCode:", responseCode,
                "| description:", payload.responseDescription
            );
            return res.redirect(`${frontendUrl}/payment/failure?txnid=${orderId}`);
        }

        // Idempotency: Zaakpay may deliver the callback more than once, and the
        // status-API fallback can re-run on a retry. Only apply the side effects
        // (stock decrement, emails) the first time this order is marked paid.
        if (order.paymentStatus === "Success" || order.paymentStatus === "Partial") {
            console.log("[Zaakpay callback] order already settled, skipping side effects:", orderId);
            return res.redirect(`${frontendUrl}/payment/success?txnid=${orderId}&mihpayid=${zaakpayTxnId || ""}`);
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
