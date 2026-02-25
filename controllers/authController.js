const crypto = require("crypto");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists with this email" });
        }

        // Create new user
        const user = await User.create({ name, email, password });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (error) {
        console.error("Register error:", error.message);
        res.status(500).json({ message: "Server error during registration" });
    }
};

/**
 * @desc    Login user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate token
        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ message: "Server error during login" });
    }
};

/**
 * @desc    Logout user (client-side token removal)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logoutUser = async (req, res) => {
    // JWT is stateless — logout is handled client-side by removing the token.
    // This endpoint confirms successful logout.
    res.json({ message: "Logged out successfully" });
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (error) {
        console.error("GetMe error:", error.message);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Sync social auth user (Supabase/Firebase) with backend & get JWT
 * @route   POST /api/auth/sync
 * @access  Public
 */
const syncSocialUser = async (req, res) => {
    try {
        const { email, name, provider } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        let user = await User.findOne({ email });

        if (!user) {
            // Create user with a random secure password (social auth users don't use it)
            const randomPassword = crypto.randomBytes(32).toString("hex");
            user = await User.create({
                name: name || email.split("@")[0],
                email,
                password: randomPassword,
            });
        }

        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (error) {
        console.error("Social sync error:", error.message);
        res.status(500).json({ message: "Server error during social auth sync" });
    }
};

module.exports = { registerUser, loginUser, logoutUser, getMe, syncSocialUser };
