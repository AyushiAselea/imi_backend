const mongoose = require("mongoose");

const connectDB = async () => {
  const primary = process.env.MONGO_URI;
  const isProduction = process.env.NODE_ENV === "production";

  if (!primary) {
    if (isProduction) {
      console.error("❌ MONGO_URI environment variable is not set. Set it in Render Dashboard → Environment.");
      throw new Error("MONGO_URI is required in production");
    }
    console.warn("⚠️  No MONGO_URI configured; attempting fallback/local MongoDB.");
  }

  if (primary) {
    try {
      const conn = await mongoose.connect(primary);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB Connection Error: ${error.message}`);
      if (isProduction) {
        console.error("In MongoDB Atlas → Network Access → add 0.0.0.0/0 to allow Render's IPs.");
        throw error;
      }
      console.error("- Primary connection failed. Will attempt fallback/local MongoDB.");
    }
  }

  // Local fallback (dev only)
  const fallback = process.env.MONGO_URI_FALLBACK || "mongodb://127.0.0.1:27017/imi_dev";
  try {
    const conn2 = await mongoose.connect(fallback);
    console.log(`✅ MongoDB Connected (fallback): ${conn2.connection.host}`);
    return;
  } catch (err2) {
    console.error(`❌ MongoDB Connection Error (fallback): ${err2.message}`);
    throw err2;
  }
};

module.exports = connectDB;
