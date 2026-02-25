const mongoose = require("mongoose");

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "India" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: false,   // optional — inline orders may not have a DB product
                    default: null,
                },
                productName: {
                    type: String,
                    default: null,     // used when no DB product exists
                },
                price: {
                    type: Number,
                    default: null,     // unit price for inline products
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: [1, "Quantity must be at least 1"],
                    default: 1,
                },
            },
        ],
        totalAmount: {
            type: Number,
            required: true,
            min: [0, "Total amount cannot be negative"],
        },
        advanceAmount: {
            type: Number,
            default: 0,
        },
        remainingAmount: {
            type: Number,
            default: 0,
        },
        paymentMethod: {
            type: String,
            enum: ["ONLINE", "COD", "PARTIAL"],
            default: "ONLINE",
        },
        deliveryPaymentPending: {
            type: Boolean,
            default: false,
        },
        shippingAddress: {
            type: shippingAddressSchema,
            default: null,
        },
        status: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
            default: "Pending",
        },
        paymentId: {
            type: String,
            default: null,
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Success", "Failed", "Partial"],
            default: "Pending",
        },
    },
    {
        timestamps: true, // adds createdAt and updatedAt
    }
);

module.exports = mongoose.model("Order", orderSchema);
