const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    page: {
      type: String,
      required: true,
    },
    referrer: {
      type: String,
      default: "",
    },
    entryPage: {
      type: String,
      default: "",
    },
    exitPage: {
      type: String,
      default: "",
    },
    deviceType: {
      type: String,
      enum: ["desktop", "tablet", "mobile", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      default: "",
    },
    os: {
      type: String,
      default: "",
    },
    screenResolution: {
      type: String,
      default: "",
    },
    timeSpent: {
      type: Number, // milliseconds spent on page
      default: 0,
    },
    sessionDuration: {
      type: Number, // total session duration in ms
      default: 0,
    },
    isBounce: {
      type: Boolean,
      default: false,
    },
    eventType: {
      type: String,
      enum: ["pageview", "session_end", "click", "scroll", "custom"],
      default: "pageview",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
analyticsSchema.index({ createdAt: -1 });
analyticsSchema.index({ page: 1, createdAt: -1 });
analyticsSchema.index({ sessionId: 1, createdAt: 1 });
analyticsSchema.index({ eventType: 1 });

module.exports = mongoose.model("Analytics", analyticsSchema);
