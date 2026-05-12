const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Import models to register schemas
const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/imi_dev";
    await mongoose.connect(uri);
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Fetch all orders and convert to CSV
const exportOrdersToCSV = async () => {
  try {
    // Fetch all orders with populated user and product details
    const orders = await Order.find({})
      .populate("user", "name email phone")
      .populate("products.product", "name price")
      .lean()
      .sort({ createdAt: -1 });

    if (orders.length === 0) {
      console.log("⚠ No orders found in database");
      process.exit(0);
    }

    console.log(`✓ Found ${orders.length} orders`);

    // Prepare CSV headers
    const headers = [
      "Order ID",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Product Name",
      "Product Price",
      "Quantity",
      "Variant",
      "Total Amount",
      "Advance Amount",
      "Remaining Amount",
      "Payment Method",
      "Payment Status",
      "Order Status",
      "Delivery Payment Pending",
      "Payment ID",
      "Shipping Address - Full Name",
      "Shipping Address - Phone",
      "Shipping Address - Address Line 1",
      "Shipping Address - Address Line 2",
      "Shipping Address - City",
      "Shipping Address - State",
      "Shipping Address - Postal Code",
      "Shipping Address - Country",
      "Guest Name",
      "Guest Email",
      "Guest Phone",
      "Created At",
      "Updated At",
    ];

    // Prepare CSV rows
    const rows = [];

    for (const order of orders) {
      // If order has multiple products, create one row per product
      if (order.products.length > 0) {
        for (const item of order.products) {
          const productName = item.product?.name || item.productName || "N/A";
          const productPrice = item.product?.price || item.price || "N/A";

          rows.push([
            order._id.toString(),
            order.user?.name || "",
            order.user?.email || "",
            order.user?.phone || "",
            productName,
            productPrice,
            item.quantity,
            item.variant || "",
            order.totalAmount,
            order.advanceAmount || 0,
            order.remainingAmount || 0,
            order.paymentMethod || "ONLINE",
            order.paymentStatus || "Pending",
            order.status || "Pending",
            order.deliveryPaymentPending ? "Yes" : "No",
            order.paymentId || "",
            order.shippingAddress?.fullName || "",
            order.shippingAddress?.phone || "",
            order.shippingAddress?.addressLine1 || "",
            order.shippingAddress?.addressLine2 || "",
            order.shippingAddress?.city || "",
            order.shippingAddress?.state || "",
            order.shippingAddress?.postalCode || "",
            order.shippingAddress?.country || "",
            order.guestInfo?.name || "",
            order.guestInfo?.email || "",
            order.guestInfo?.phone || "",
            order.createdAt?.toISOString() || "",
            order.updatedAt?.toISOString() || "",
          ]);
        }
      } else {
        // Order with no products (edge case)
        rows.push([
          order._id.toString(),
          order.user?.name || "",
          order.user?.email || "",
          order.user?.phone || "",
          "N/A",
          "N/A",
          "N/A",
          "",
          order.totalAmount,
          order.advanceAmount || 0,
          order.remainingAmount || 0,
          order.paymentMethod || "ONLINE",
          order.paymentStatus || "Pending",
          order.status || "Pending",
          order.deliveryPaymentPending ? "Yes" : "No",
          order.paymentId || "",
          order.shippingAddress?.fullName || "",
          order.shippingAddress?.phone || "",
          order.shippingAddress?.addressLine1 || "",
          order.shippingAddress?.addressLine2 || "",
          order.shippingAddress?.city || "",
          order.shippingAddress?.state || "",
          order.shippingAddress?.postalCode || "",
          order.shippingAddress?.country || "",
          order.guestInfo?.name || "",
          order.guestInfo?.email || "",
          order.guestInfo?.phone || "",
          order.createdAt?.toISOString() || "",
          order.updatedAt?.toISOString() || "",
        ]);
      }
    }

    // Escape CSV values (handle quotes and commas)
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvContent =
      headers.map(escapeCsvValue).join(",") +
      "\n" +
      rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");

    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "exports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `orders_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, csvContent, "utf-8");

    console.log(`✓ CSV file created: ${filepath}`);
    console.log(`✓ Total orders exported: ${orders.length}`);
  } catch (error) {
    console.error("✗ Error exporting orders:", error.message);
    process.exit(1);
  }
};

// Run the export
const main = async () => {
  await connectDB();
  await exportOrdersToCSV();
  await mongoose.connection.close();
  console.log("✓ Connection closed");
  process.exit(0);
};

main();
