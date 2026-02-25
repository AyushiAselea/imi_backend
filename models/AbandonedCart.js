const mongoose = require("mongoose");

const abandonedCartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    products: [
      {
        productId: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        image: {
          type: String,
          default: "",
        },
      },
    ],
    totalAmount: {
      type: Number,
      default: 0,
    },
    isAbandoned: {
      type: Boolean,
      default: true,
    },
    isRecovered: {
      type: Boolean,
      default: false,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Mark cart as abandoned if not checked out within 30 minutes
abandonedCartSchema.index({ lastUpdated: 1 });
abandonedCartSchema.index({ isAbandoned: 1 });
abandonedCartSchema.index({ userId: 1 });

module.exports = mongoose.model("AbandonedCart", abandonedCartSchema);
