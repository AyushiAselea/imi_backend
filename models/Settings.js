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
