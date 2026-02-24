const Product = require("../models/Product");

/**
 * @desc    Get all products
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error("Get products error:", error.message);
        res.status(500).json({ message: "Server error fetching products" });
    }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        // Handle invalid ObjectId format
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Get product error:", error.message);
        res.status(500).json({ message: "Server error fetching product" });
    }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, stock } = req.body;

        const product = await Product.create({
            name,
            description,
            price,
            image,
            stock,
        });

        res.status(201).json(product);
    } catch (error) {
        console.error("Create product error:", error.message);
        res.status(500).json({ message: "Server error creating product" });
    }
};

module.exports = { getProducts, getProductById, createProduct };
