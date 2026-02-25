const mongoose = require("mongoose");

const connectDB = async () => {
  const primary = process.env.MONGO_URI;
  const fallback = process.env.MONGO_URI_FALLBACK || "mongodb://127.0.0.1:27017/imi_dev";

  // Try primary if available
  if (primary) {
    try {
      const conn = await mongoose.connect(primary);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB Connection Error (primary): ${error.message}`);
      console.error("- Primary connection failed. Will attempt fallback/local MongoDB.");
    }
  } else {
    console.warn("⚠️  No primary `MONGO_URI` configured; attempting fallback/local MongoDB.");
  }

  // Try fallback/local
  try {
    const conn2 = await mongoose.connect(fallback);
    console.log(`✅ MongoDB Connected (fallback): ${conn2.connection.host}`);
    return;
  } catch (err2) {
    console.error(`❌ MongoDB Connection Error (fallback): ${err2.message}`);
    console.error("- Check that your local MongoDB is running, or update `MONGO_URI`/`MONGO_URI_FALLBACK` in .env.");
    console.error("- If using MongoDB Atlas, add your IP to Network Access (IP whitelist): https://www.mongodb.com/docs/atlas/security-whitelist/");
    throw err2;
  }
};

module.exports = connectDB;
