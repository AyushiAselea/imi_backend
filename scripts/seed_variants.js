/**
 * Seed script: Creates sample "IMI Glasses Mark 1" and "IMI Glasses Mark 2"
 * products with multiple variants using images from imi-ai-smartwear assets.
 *
 * Usage:
 *   node scripts/seed_variants.js
 *
 * NOTE: Images are referenced as relative paths from the imi-ai-smartwear
 * public assets. In production, replace these with your CDN / Cloudinary URLs.
 */

const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");

// ── Image base path (adjust to match your deployed frontend or CDN) ──
// For local dev you can serve these via the imi-ai-smartwear dev server.
// Replace with actual hosted URLs when deploying.
const MARK1_IMG = "/src/assets/mark_1";
const MARK2_IMG = "/src/assets/mark2";

const sampleProducts = [
    {
        name: "IMI Glasses Mark 1",
        description:
            "IMI Smart Glasses Mark 1 – AI-powered, sleek design with open-ear speakers and UV protection.",
        price: 4999,
        image: `${MARK1_IMG}/mark1_black_balck1.png`,
        stock: 50,
        category: "Smart Glasses",
        status: "active",
        variants: [
            {
                variantName: "Matte Black",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Matte",
                price: 4999,
                stock: 15,
                image: `${MARK1_IMG}/mark1_black_balck1.png`,
            },
            {
                variantName: "Black + White Lens",
                color: "Black",
                colorHex: "#222222",
                frameType: "Glossy",
                price: 4999,
                stock: 10,
                image: `${MARK1_IMG}/mark1_black_white.png`,
            },
            {
                variantName: "White + Black Lens",
                color: "White",
                colorHex: "#f5f5f5",
                frameType: "Matte",
                price: 5299,
                stock: 12,
                image: `${MARK1_IMG}/mark1_white_black.png`,
            },
            {
                variantName: "White + White Lens",
                color: "White",
                colorHex: "#ffffff",
                frameType: "Glossy",
                price: 5299,
                stock: 8,
                image: `${MARK1_IMG}/mark1_white_white (1).png`,
            },
            {
                variantName: "Transparent White",
                color: "White",
                colorHex: "#e8e8e8",
                frameType: "Transparent",
                price: 5499,
                stock: 5,
                image: `${MARK1_IMG}/mark_1_white.jpeg`,
            },
        ],
    },
    {
        name: "IMI Glasses Mark 2",
        description:
            "IMI Smart Glasses Mark 2 – Next-gen AI glasses with improved audio, lighter frame, and premium finish.",
        price: 6999,
        image: `${MARK2_IMG}/mark2_black_black.png`,
        stock: 40,
        category: "Smart Glasses",
        status: "active",
        variants: [
            {
                variantName: "Matte Black",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Matte",
                price: 6999,
                stock: 10,
                image: `${MARK2_IMG}/mark2_black_black.png`,
            },
            {
                variantName: "Black + White Accent",
                color: "Black",
                colorHex: "#2d2d2d",
                frameType: "Glossy",
                price: 6999,
                stock: 8,
                image: `${MARK2_IMG}/mark2_black_white.png`,
            },
            {
                variantName: "Ocean Blue + Black",
                color: "Blue",
                colorHex: "#1e3a5f",
                frameType: "Matte",
                price: 7299,
                stock: 7,
                image: `${MARK2_IMG}/mark2_blue_black.png`,
            },
            {
                variantName: "Ocean Blue + White",
                color: "Blue",
                colorHex: "#2a5f8f",
                frameType: "Glossy",
                price: 7299,
                stock: 5,
                image: `${MARK2_IMG}/mark2_blue_white.png`,
            },
            {
                variantName: "Pearl White + Black",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "Matte",
                price: 7499,
                stock: 6,
                image: `${MARK2_IMG}/mark2_white_black.png`,
            },
            {
                variantName: "Pearl White",
                color: "White",
                colorHex: "#ffffff",
                frameType: "Glossy",
                price: 7499,
                stock: 4,
                image: `${MARK2_IMG}/mark2_white_white1.png`,
            },
        ],
    },
];

const seed = async () => {
    try {
        await connectDB();
        console.log("🗑  Removing existing Mark 1 / Mark 2 products…");

        await Product.deleteMany({
            name: { $in: ["IMI Glasses Mark 1", "IMI Glasses Mark 2"] },
        });

        console.log("🌱 Inserting sample products with variants…");
        const created = await Product.insertMany(sampleProducts);

        created.forEach((p) => {
            console.log(`   ✅ ${p.name}  →  ${p.variants.length} variants`);
        });

        console.log("\n🎉 Seed complete!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed failed:", err.message);
        process.exit(1);
    }
};

seed();
