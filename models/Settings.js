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
                customMessage: { type: String,  default: "Hi {{FirstName}},\n\nWe noticed you added **IMI Glasses** to your cart but didn't complete your order.\n\nNo worries — it happens 😊\nYour smart upgrade is still waiting for you.\n\nWith IMI Glasses, you can:\n• Just say \"Hey IMI\" for hands-free control\n• Capture life as you see it\n• Stay connected effortlessly\n• Experience AI-powered smart vision\n\nYour cart is reserved for a limited time.\n\n👉 Complete your purchase here: {{CheckoutLink}}\n\nIf you had any questions, just reply to this email — we're happy to help.\n\nSee Smarter. Live Smarter.\nTeam IMI" },
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
