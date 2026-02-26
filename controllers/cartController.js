const Cart = require("../models/Cart");

/**
 * GET /api/cart — Get current user's cart
 */
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.json({ items: [], totalAmount: 0 });
    }
    res.json(cart);
  } catch (error) {
    console.error("getCart error:", error);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

/**
 * POST /api/cart/add — Add item to cart (or increment qty)
 */
const addToCart = async (req, res) => {
  try {
    const { productId, name, price, image, variant, quantity = 1 } = req.body;

    if (!productId || !name || price == null) {
      return res.status(400).json({ message: "productId, name, and price are required" });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Check if same product+variant exists
    const existingIndex = cart.items.findIndex(
      (item) => item.productId === productId && item.variant === (variant || "")
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, name, price, image, variant, quantity });
    }

    await cart.save();
    res.json(cart);
  } catch (error) {
    console.error("addToCart error:", error);
    res.status(500).json({ message: "Failed to add to cart" });
  }
};

/**
 * PUT /api/cart/update — Update item quantity
 */
const updateCartItem = async (req, res) => {
  try {
    const { productId, variant, quantity } = req.body;

    if (!productId || quantity == null) {
      return res.status(400).json({ message: "productId and quantity are required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.find(
      (i) => i.productId === productId && i.variant === (variant || "")
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (quantity <= 0) {
      // Remove item
      cart.items = cart.items.filter(
        (i) => !(i.productId === productId && i.variant === (variant || ""))
      );
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    res.json(cart);
  } catch (error) {
    console.error("updateCartItem error:", error);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

/**
 * DELETE /api/cart/remove — Remove item from cart
 */
const removeFromCart = async (req, res) => {
  try {
    const { productId, variant } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (i) => !(i.productId === productId && i.variant === (variant || ""))
    );

    await cart.save();
    res.json(cart);
  } catch (error) {
    console.error("removeFromCart error:", error);
    res.status(500).json({ message: "Failed to remove from cart" });
  }
};

/**
 * DELETE /api/cart/clear — Clear entire cart
 */
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ items: [], totalAmount: 0 });
  } catch (error) {
    console.error("clearCart error:", error);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};

/**
 * GET /api/cart/admin/all — Admin: get all user carts (for monitoring)
 */
const getAllCarts = async (req, res) => {
  try {
    const carts = await Cart.find({ "items.0": { $exists: true } })
      .populate("user", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    const result = carts.map((cart) => ({
      _id: cart._id,
      user: cart.user,
      items: cart.items,
      totalAmount: cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      updatedAt: cart.updatedAt,
    }));

    res.json({ carts: result, total: result.length });
  } catch (error) {
    console.error("getAllCarts error:", error);
    res.status(500).json({ message: "Failed to fetch carts" });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getAllCarts,
};
