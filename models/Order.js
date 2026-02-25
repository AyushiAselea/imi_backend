const mongoose = require("mongoose");

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
            enum: ["Pending", "Success", "Failed"],
            default: "Pending",
        },
    },
    {
        timestamps: true, // adds createdAt and updatedAt
    }
);

module.exports = mongoose.model("Order", orderSchema);
