/**
 * Create an admin user for the IMI Admin Panel.
 *
 * Usage:  node scripts/create_admin.js
 *
 * Default credentials (change after first login):
 *   Email:    admin@imi.com
 *   Password: Admin@1234
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const existing = await User.findOne({ email: "admin@imi.com" });
        if (existing) {
            if (existing.role !== "admin") {
                existing.role = "admin";
                await existing.save();
                console.log("User promoted to admin role.");
            } else {
                console.log("Admin user already exists.");
            }
            process.exit(0);
        }

        await User.create({
            name: "IMI Admin",
            email: "admin@imi.com",
            password: "Admin@1234",
            role: "admin",
        });

        console.log("✅ Admin user created:");
        console.log("   Email:    admin@imi.com");
        console.log("   Password: Admin@1234");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};

run();
