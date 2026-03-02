require("dotenv").config();
const nodemailer = require("nodemailer");

const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

t.sendMail({
  from: `"IMI Smart Glasses" <${process.env.SMTP_USER}>`,
  to: process.env.SMTP_USER,
  subject: "IMI Email Test - Cart Notification",
  html: `<h1>Test email from IMI backend</h1><p>SMTP is working correctly. This is how cart emails will look.</p>`,
}).then((info) => {
  console.log("SENT OK:", info.messageId);
  console.log("Response:", info.response);
}).catch((e) => {
  console.error("SEND FAILED:", e.message);
  console.error("Code:", e.code, "ResponseCode:", e.responseCode);
});
