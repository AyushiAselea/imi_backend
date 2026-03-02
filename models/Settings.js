const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
    {
        siteName: {
            type: String,
            default: "IMI AI Smartwear",
            trim: true,
        },
        contactEmail: {
            type: String,
            default: "",
            trim: true,
        },
        contactPhone: {
            type: String,
            default: "",
            trim: true,
        },
        address: {
            type: String,
            default: "",
        },
        logo: {
            type: String,
            default: "",
        },
        socialLinks: {
            instagram: { type: String, default: "" },
            twitter: { type: String, default: "" },
            facebook: { type: String, default: "" },
        },
        // Customisable email templates
        emailTemplates: {
            cartEmail: {
                isEnabled:     { type: Boolean, default: true },
                subject:       { type: String,  default: "🛒 {{productName}} is in your cart — complete your purchase!" },
                customMessage: { type: String,  default: "Great choice! You just added **{{productName}}** to your cart. Don't wait — items sell out fast!" },
            },
            orderEmail: {
                isEnabled:     { type: Boolean, default: true },
                subject:       { type: String,  default: "✅ Order Confirmed — {{paymentMethod}} | IMI Smart Glasses" },
                customMessage: { type: String,  default: "Your order has been placed successfully. We'll keep you updated at every step." },
            },
        },
        // Third-party tracking settings
        tracking: {
            facebookPixelId: { type: String, default: "" },
            googleAnalyticsId: { type: String, default: "" },
            metaInsightsId: { type: String, default: "" },
            customScripts: [
                {
                    name: { type: String, default: "" },
                    script: { type: String, default: "" },
                    placement: {
                        type: String,
                        enum: ["head", "body_start", "body_end"],
                        default: "head",
                    },
                    isActive: { type: Boolean, default: true },
                },
            ],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Settings", settingsSchema);
