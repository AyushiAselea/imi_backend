const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
    {
        variantName: {
            type: String,
            required: [true, "Variant name is required"],
            trim: true,
        },
        color: {
            type: String,
            default: "",
            trim: true,
        },
        colorHex: {
            type: String,
            default: "#000000",
            trim: true,
        },
        frameType: {
            type: String,
            default: "",
            trim: true,
        },
        price: {
            type: Number,
            required: [true, "Variant price is required"],
            min: [0, "Price cannot be negative"],
        },
        stock: {
            type: Number,
            default: 0,
            min: [0, "Stock cannot be negative"],
        },
        image: {
            type: String,
            default: "",
        },
    },
    { _id: true } // each variant gets its own _id
);

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
            required: [true, "Product base price is required"],
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
        variants: {
            type: [variantSchema],
            default: [],
        },
    },
    {
        timestamps: true, // adds createdAt and updatedAt
    }
);

module.exports = mongoose.model("Product", productSchema);
