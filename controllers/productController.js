const Product = require("../models/Product");

/**
 * @desc    Get active products only (for frontend)
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const products = await Product.find({ status: "active" })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Product.countDocuments({ status: "active" });

        res.json({
            products,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error("Get products error:", error.message);
        res.status(500).json({ message: "Server error fetching products" });
    }
};

/**
 * @desc    Get all products (admin - includes inactive)
 * @route   GET /api/products/all
 * @access  Private/Admin
 */
const getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const products = await Product.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Product.countDocuments();

        res.json({
            products,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        });
    } catch (error) {
        console.error("Get all products error:", error.message);
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
        const { name, description, price, image, images, stock, category, status } = req.body;

        if (!name || !description || price === undefined) {
            return res.status(400).json({ message: "Name, description, and price are required" });
        }

        const product = await Product.create({
            name,
            description,
            price,
            image,
            images: images || [],
            stock,
            category,
            status,
        });

        res.status(201).json(product);
    } catch (error) {
        console.error("Create product error:", error.message);
        res.status(500).json({ message: "Server error creating product" });
    }
};

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const fields = ["name", "description", "price", "image", "images", "stock", "category", "status"];
        fields.forEach((f) => {
            if (req.body[f] !== undefined) product[f] = req.body[f];
        });

        const updated = await product.save();
        res.json(updated);
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Update product error:", error.message);
        res.status(500).json({ message: "Server error updating product" });
    }
};

/**
 * @desc    Toggle product status (activate/deactivate)
 * @route   PATCH /api/products/:id/status
 * @access  Private/Admin
 */
const toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const { status } = req.body;
        if (!status || !["active", "inactive"].includes(status)) {
            return res.status(400).json({ message: "Status must be 'active' or 'inactive'" });
        }

        product.status = status;
        const updated = await product.save();
        res.json(updated);
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Toggle product status error:", error.message);
        res.status(500).json({ message: "Server error toggling product status" });
    }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        await product.deleteOne();
        res.json({ message: "Product deleted" });
    } catch (error) {
        if (error.kind === "ObjectId") {
            return res.status(404).json({ message: "Product not found" });
        }
        console.error("Delete product error:", error.message);
        res.status(500).json({ message: "Server error deleting product" });
    }
};

module.exports = {
    getProducts,
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct,
};
