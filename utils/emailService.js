const nodemailer = require("nodemailer");

/* ─── Transporter (created once, reused) ──────────────────── */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ─── Verify connection on startup (non-blocking) ─────────── */
transporter.verify().then(() => {
  console.log("📧 SMTP server ready");
}).catch((err) => {
  console.error("📧 SMTP connection error:", err.message);
});

/* ─── Helper: send email ──────────────────────────────────── */
const sendMail = async ({ to, subject, html, text }) => {
  const info = await transporter.sendMail({
    from: `"IMI Smart Glasses" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: text || "",
    html,
  });
  console.log("📧 Email sent:", info.messageId, "→", to);
  return info;
};

/* ─── Cart email: item added ─────────────────────────────── */
const sendCartEmail = async (userEmail, userName, item) => {
  const price = Number(item.price).toLocaleString("en-IN");
  const subtotal = (item.price * item.quantity).toLocaleString("en-IN");
  const variant = item.variant ? ` (${item.variant})` : "";

  const shopUrl = process.env.FRONTEND_URL || "https://imiai.in";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">IMI Smart Glasses</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Your smart companion, always in sight</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;font-size:15px;color:#52525b;">Hi <strong style="color:#18181b;">${userName || "there"}</strong> 👋</p>
          <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
            Great choice! You just added <strong style="color:#18181b;">${item.name}${variant}</strong> to your cart. Here's a quick summary:
          </p>

          <!-- Product card -->
          <table role="presentation" width="100%" style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            <tr>
              ${item.image ? `<td width="100" style="padding:16px;vertical-align:top;">
                <img src="${item.image}" alt="${item.name}" width="80" height="80" style="border-radius:10px;object-fit:cover;display:block;background:#e4e4e7;" />
              </td>` : ""}
              <td style="padding:16px;vertical-align:top;">
                <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#18181b;">${item.name}${variant}</p>
                <p style="margin:0 0 4px;font-size:13px;color:#71717a;">Qty: ${item.quantity}</p>
                <p style="margin:0 0 2px;font-size:13px;color:#71717a;">Unit Price: ₹${price}</p>
                <p style="margin:8px 0 0;font-size:17px;font-weight:700;color:#0d9488;">₹${subtotal}</p>
              </td>
            </tr>
          </table>

          <!-- CTA button -->
          <table role="presentation" width="100%" style="margin-top:28px;">
            <tr><td align="center">
              <a href="${shopUrl}/cart" style="display:inline-block;padding:14px 40px;background:#0d9488;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:50px;letter-spacing:0.3px;">
                Complete Your Purchase →
              </a>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa;text-align:center;line-height:1.5;">
            Your cart is saved and waiting. Items sell out fast — don't miss out!
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#a1a1aa;">IMI AI Smart Glasses by Aselea Networks</p>
          <p style="margin:0;font-size:11px;color:#a1a1aa;">
            <a href="${shopUrl}" style="color:#0d9488;text-decoration:none;">Visit Store</a> &nbsp;•&nbsp;
            <a href="mailto:${process.env.SMTP_USER}" style="color:#0d9488;text-decoration:none;">Contact Us</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const text = `Hi ${userName || "there"}, you added ${item.name}${variant} (Qty: ${item.quantity}) to your cart. Subtotal: ₹${subtotal}. Complete your purchase at ${shopUrl}/cart`;

  return sendMail({
    to: userEmail,
    subject: `🛒 ${item.name} is in your cart — complete your purchase!`,
    html,
    text,
  });
};

/* ─── Order confirmation email ───────────────────────────── */
const sendOrderConfirmationEmail = async (userEmail, userName, order) => {
  const shopUrl = process.env.FRONTEND_URL || "https://imiai.in";
  const total = Number(order.totalAmount).toLocaleString("en-IN");
  const method = order.paymentMethod || "ONLINE";
  const orderId = order._id;

  const productsHtml = (order.products || []).map((p) => {
    const name = p.product?.name || p.productName || "Product";
    const price = p.product?.price || p.price || 0;
    const qty = p.quantity || 1;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#18181b;">${name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#52525b;text-align:center;">${qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:13px;color:#18181b;text-align:right;font-weight:600;">₹${(price * qty).toLocaleString("en-IN")}</td>
    </tr>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Order Confirmed! ✅</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Thanks for shopping with IMI</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#52525b;">Hi <strong style="color:#18181b;">${userName || "there"}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
            Your order has been placed successfully. Here are the details:
          </p>
          <table role="presentation" width="100%" style="border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;border-collapse:collapse;">
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#71717a;text-transform:uppercase;">Product</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#71717a;text-transform:uppercase;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#71717a;text-transform:uppercase;">Amount</th>
            </tr>
            ${productsHtml}
            <tr style="background:#f0fdfa;">
              <td colspan="2" style="padding:10px 12px;font-size:14px;font-weight:700;color:#18181b;">Total</td>
              <td style="padding:10px 12px;text-align:right;font-size:16px;font-weight:700;color:#0d9488;">₹${total}</td>
            </tr>
          </table>
          <table role="presentation" width="100%" style="margin-top:16px;">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#71717a;">Order ID</td>
              <td style="padding:8px 0;font-size:13px;color:#18181b;text-align:right;font-weight:600;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#71717a;">Payment</td>
              <td style="padding:8px 0;font-size:13px;color:#18181b;text-align:right;font-weight:600;">${method === "COD" ? "Cash on Delivery" : method === "PARTIAL" ? "50% Advance" : "Paid Online"}</td>
            </tr>
          </table>
          <table role="presentation" width="100%" style="margin-top:28px;"><tr><td align="center">
            <a href="${shopUrl}/profile" style="display:inline-block;padding:14px 40px;background:#0d9488;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:50px;">
              Track Your Order →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #e4e4e7;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a1a1aa;">IMI AI Smart Glasses by Aselea Networks</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  return sendMail({
    to: userEmail,
    subject: `✅ Order Confirmed — ${method === "COD" ? "Pay on Delivery" : "Payment Received"} | IMI Smart Glasses`,
    html,
    text: `Hi ${userName || "there"}, your order (${orderId}) for ₹${total} has been confirmed. Payment: ${method}. Track at ${shopUrl}/profile`,
  });
};

module.exports = { sendMail, sendCartEmail, sendOrderConfirmationEmail };
