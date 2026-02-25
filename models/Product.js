const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
        },
        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Price cannot be negative"],
        },
        image: {
            type: String,
            default: "",
        },
        images: {
            type: [String],
            default: [],
        },
        stock: {
            type: Number,
            required: [true, "Stock quantity is required"],
            min: [0, "Stock cannot be negative"],
            default: 0,
        },
        category: {
            type: String,
            default: "",
            trim: true,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
    },
    {
        timestamps: true, // adds createdAt and updatedAt
    }
);

module.exports = mongoose.model("Product", productSchema);
