/**
 * Seed script — IMI Glasses Mark 1 & Mark 2 with full variant data + images
 *
 * Images are served by the backend at:
 *   https://imi-backend-s85v.onrender.com/variants/mark1/<filename>
 *   https://imi-backend-s85v.onrender.com/variants/mark2/<filename>
 *
 * Usage:  node scripts/seed_variants.js
 */

const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("../config/db");
const Product   = require("../models/Product");

const BASE = "https://imi-backend-s85v.onrender.com/variants";
const M1   = `${BASE}/mark1`;
const M2   = `${BASE}/mark2`;

const sampleProducts = [
    /* ══════════════════════════════════════
       IMI GLASSES MARK 1
       2 frames × 2 lenses = 4 variants
    ══════════════════════════════════════ */
    {
        name: "IMI Glasses Mark 1",
        description:
            "IMI Smart Glasses Mark 1 — AI-powered open-ear audio, UV protection, and ultra-light frame design.",
        price: 2499,
        image: `${M1}/mark1_black_black_v1.png`,
        stock: 100,
        category: "Smart Glasses",
        status: "active",
        variants: [
            {
                variantName: "Black Frame — Black Lens",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Black",
                price: 2499,
                stock: 25,
                image: `${M1}/mark1_black_black_v1.png`,
            },
            {
                variantName: "Black Frame — Transparent Lens",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Black",
                price: 2499,
                stock: 25,
                image: `${M1}/mark1_black_white.png`,
            },
            {
                variantName: "White Frame — Black Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White",
                price: 2499,
                stock: 25,
                image: `${M1}/mark1_white_black_v1.png`,
            },
            {
                variantName: "White Frame — Transparent Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White",
                price: 2499,
                stock: 25,
                image: `${M1}/mark1_white_white_v1.png`,
            },
        ],
    },

    /* ══════════════════════════════════════
       IMI GLASSES MARK 2
       3 frames × 2 lenses = 6 variants
    ══════════════════════════════════════ */
    {
        name: "IMI Glasses Mark 2",
        description:
            "IMI Smart Glasses Mark 2 — Next-gen AI glasses with improved spatial audio, lighter frame, and premium multi-color options.",
        price: 11999,
        image: `${M2}/mark2_black_black_v1.png`,
        stock: 80,
        category: "Smart Glasses",
        status: "active",
        variants: [
            {
                variantName: "Black Frame — Black Lens",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Black",
                price: 11999,
                stock: 15,
                image: `${M2}/mark2_black_black_v1.png`,
            },
            {
                variantName: "Black Frame — Transparent Lens",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Black",
                price: 11999,
                stock: 15,
                image: `${M2}/mark2_black_white_v1.png`,
            },
            {
                variantName: "White Frame — Black Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White",
                price: 11999,
                stock: 15,
                image: `${M2}/mark2_white_black_v1.png`,
            },
            {
                variantName: "White Frame — Transparent Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White",
                price: 11999,
                stock: 15,
                image: `${M2}/mark2_white_white_v1.png`,
            },
            {
                variantName: "Blue Frame — Black Lens",
                color: "Blue",
                colorHex: "#1e3a5f",
                frameType: "Blue",
                price: 11999,
                stock: 10,
                image: `${M2}/mark2_blue_black_v1.png`,
            },
            {
                variantName: "Blue Frame — Transparent Lens",
                color: "Blue",
                colorHex: "#1e3a5f",
                frameType: "Blue",
                price: 11999,
                stock: 10,
                image: `${M2}/mark2_blue_white.png`,
            },
        ],
    },
];

/* ─── Run ─── */
const seed = async () => {
    try {
        await connectDB();

        console.log("🗑  Removing existing Mark 1 / Mark 2 products…");
        await Product.deleteMany({
            name: { $in: ["IMI Glasses Mark 1", "IMI Glasses Mark 2"] },
        });

        console.log("🌱 Inserting products with variants…");
        const created = await Product.insertMany(sampleProducts);

        created.forEach((p) => {
            console.log(`   ✅ ${p.name}  —  ${p.variants.length} variants`);
            p.variants.forEach((v) => {
                console.log(`       • ${v.variantName} (${v.color} / ${v.frameType})`);
            });
        });

        console.log("\n🎉 Seed complete! Products are ready in MongoDB.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Seed failed:", err.message);
        process.exit(1);
    }
};

seed();
