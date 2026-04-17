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
    ══════════════════════════════════════ */
    {
        name: "IMI Glasses Mark 1",
        description:
            "IMI Smart Glasses Mark 1 — AI-powered open-ear audio, UV protection, and ultra-light frame design.",
        price: 4999,
        image: `${M1}/mark1_black_black_v1.png`,
        stock: 100,
        category: "Smart Glasses",
        status: "active",
        variants: [
            // ── Black frame variants ──
            {
                variantName: "Matte Black",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Matte Black",
                price: 4999,
                stock: 20,
                image: `${M1}/mark1_black_black_v1.png`,
            },
            {
                variantName: "Glossy Black",
                color: "Black",
                colorHex: "#0d0d0d",
                frameType: "Glossy Black",
                price: 4999,
                stock: 15,
                image: `${M1}/mark1_black_black_v2.png`,
            },
            {
                variantName: "Black + White Lens",
                color: "Black",
                colorHex: "#222222",
                frameType: "Black Frame / White Lens",
                price: 5199,
                stock: 12,
                image: `${M1}/mark1_black_white.png`,
            },
            // ── White frame variants ──
            {
                variantName: "White + Black Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White Frame / Black Lens",
                price: 5299,
                stock: 15,
                image: `${M1}/mark1_white_black_v1.png`,
            },
            {
                variantName: "White + Dark Lens v2",
                color: "White",
                colorHex: "#e8e8e8",
                frameType: "White Frame / Dark Lens",
                price: 5299,
                stock: 10,
                image: `${M1}/mark1_white_black_v2.png`,
            },
            {
                variantName: "White + Dark Lens v3",
                color: "White",
                colorHex: "#f5f5f5",
                frameType: "White Frame / Tinted Lens",
                price: 5299,
                stock: 8,
                image: `${M1}/mark1_white_black_v3.png`,
            },
            {
                variantName: "Pearl White",
                color: "White",
                colorHex: "#ffffff",
                frameType: "White Frame / White Lens",
                price: 5499,
                stock: 10,
                image: `${M1}/mark1_white_white_v1.png`,
            },
            {
                variantName: "Pearl White v2",
                color: "White",
                colorHex: "#fafafa",
                frameType: "White Frame / Clear Lens",
                price: 5499,
                stock: 8,
                image: `${M1}/mark1_white_white_v2.png`,
            },
            {
                variantName: "All White",
                color: "White",
                colorHex: "#f8f8f8",
                frameType: "Full White",
                price: 5599,
                stock: 6,
                image: `${M1}/mark1_white_all.jpeg`,
            },
            {
                variantName: "Stealth Back",
                color: "Black",
                colorHex: "#111111",
                frameType: "Black Rear / Black Lens",
                price: 4799,
                stock: 10,
                image: `${M1}/mark1_back_black.png`,
            },
        ],
    },

    /* ══════════════════════════════════════
       IMI GLASSES MARK 2
    ══════════════════════════════════════ */
    {
        name: "IMI Glasses Mark 2",
        description:
            "IMI Smart Glasses Mark 2 — Next-gen AI glasses with improved spatial audio, lighter frame, and premium multi-color options.",
        price: 6999,
        image: `${M2}/mark2_black_black_v1.png`,
        stock: 80,
        category: "Smart Glasses",
        status: "active",
        variants: [
            // ── Black frame variants ──
            {
                variantName: "Matte Black",
                color: "Black",
                colorHex: "#1a1a1a",
                frameType: "Matte Black",
                price: 6999,
                stock: 15,
                image: `${M2}/mark2_black_black_v1.png`,
            },
            {
                variantName: "Glossy Black",
                color: "Black",
                colorHex: "#0d0d0d",
                frameType: "Glossy Black",
                price: 6999,
                stock: 10,
                image: `${M2}/mark2_black_black_v2.png`,
            },
            {
                variantName: "Black Premium",
                color: "Black",
                colorHex: "#080808",
                frameType: "Black Premium Finish",
                price: 7199,
                stock: 8,
                image: `${M2}/mark2_black_black_v3.png`,
            },
            {
                variantName: "Black + White Lens",
                color: "Black",
                colorHex: "#2a2a2a",
                frameType: "Black Frame / White Lens",
                price: 7099,
                stock: 10,
                image: `${M2}/mark2_black_white_v1.png`,
            },
            {
                variantName: "Black + Light Lens",
                color: "Black",
                colorHex: "#333333",
                frameType: "Black Frame / Light Lens",
                price: 7099,
                stock: 8,
                image: `${M2}/mark2_black_white_v2.png`,
            },
            {
                variantName: "Black + Clear Lens",
                color: "Black",
                colorHex: "#3a3a3a",
                frameType: "Black Frame / Clear Lens",
                price: 7099,
                stock: 6,
                image: `${M2}/mark2_black_white_v3.png`,
            },
            // ── Blue frame variants ──
            {
                variantName: "Ocean Blue + Black",
                color: "Blue",
                colorHex: "#1e3a5f",
                frameType: "Blue Frame / Black Lens",
                price: 7299,
                stock: 10,
                image: `${M2}/mark2_blue_black_v1.png`,
            },
            {
                variantName: "Ocean Blue v2",
                color: "Blue",
                colorHex: "#2a4f75",
                frameType: "Blue Frame / Dark Lens",
                price: 7299,
                stock: 8,
                image: `${M2}/mark2_blue_black_v2.png`,
            },
            {
                variantName: "Ocean Blue + White Lens",
                color: "Blue",
                colorHex: "#3060a0",
                frameType: "Blue Frame / White Lens",
                price: 7399,
                stock: 7,
                image: `${M2}/mark2_blue_white.png`,
            },
            // ── White frame variants ──
            {
                variantName: "Pearl White + Black Lens",
                color: "White",
                colorHex: "#f0f0f0",
                frameType: "White Frame / Black Lens",
                price: 7499,
                stock: 10,
                image: `${M2}/mark2_white_black_v1.png`,
            },
            {
                variantName: "Pearl White v2",
                color: "White",
                colorHex: "#f5f5f5",
                frameType: "White Frame / Dark Lens",
                price: 7499,
                stock: 8,
                image: `${M2}/mark2_white_black_v2.png`,
            },
            {
                variantName: "Full White v1",
                color: "White",
                colorHex: "#ffffff",
                frameType: "White Frame / White Lens",
                price: 7699,
                stock: 6,
                image: `${M2}/mark2_white_white_v1.png`,
            },
            {
                variantName: "Full White v2",
                color: "White",
                colorHex: "#fafafa",
                frameType: "White Frame / Clear Lens",
                price: 7699,
                stock: 5,
                image: `${M2}/mark2_white_white_v2.png`,
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
