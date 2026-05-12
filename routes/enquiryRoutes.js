const express = require("express");
const OrderEnquiry = require("../models/OrderEnquiry");

const router = express.Router();

// ─── CREATE NEW ENQUIRY ───
router.post("/", async (req, res) => {
  try {
    const { name, email, product, glasses, variant, quantity, paymentMethod, heardAbout, date } = req.body;

    // Validate required fields
    if (!name || !email || !product) {
      return res.status(400).json({
        message: "Missing required fields: name, email, product",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    const enquiry = new OrderEnquiry({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      product,
      glasses: glasses || "Mark 1",
      variant: variant || "",
      quantity: quantity || 1,
      paymentMethod: paymentMethod || "Online",
      heardAbout: heardAbout || "",
      date: date ? new Date(date) : new Date(),
      status: "New",
    });

    await enquiry.save();

    res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry,
    });
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({
      message: "Failed to create enquiry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ─── GET ALL ENQUIRIES (for admin) ───
router.get("/", async (req, res) => {
  try {
    const enquiries = await OrderEnquiry.find().sort({ createdAt: -1 });
    res.status(200).json(enquiries);
  } catch (error) {
    console.error("Error fetching enquiries:", error);
    res.status(500).json({
      message: "Failed to fetch enquiries",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ─── GET SINGLE ENQUIRY ───
router.get("/:id", async (req, res) => {
  try {
    const enquiry = await OrderEnquiry.findById(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }
    res.status(200).json(enquiry);
  } catch (error) {
    console.error("Error fetching enquiry:", error);
    res.status(500).json({
      message: "Failed to fetch enquiry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ─── UPDATE ENQUIRY ───
router.put("/:id", async (req, res) => {
  try {
    const { name, email, product, glasses, variant, quantity, paymentMethod, heardAbout, status, notes } = req.body;

    const enquiry = await OrderEnquiry.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.toLowerCase().trim() }),
        ...(product && { product }),
        ...(glasses && { glasses }),
        ...(variant !== undefined && { variant }),
        ...(quantity && { quantity }),
        ...(paymentMethod && { paymentMethod }),
        ...(heardAbout !== undefined && { heardAbout }),
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      { new: true, runValidators: true }
    );

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.status(200).json({
      message: "Enquiry updated successfully",
      enquiry,
    });
  } catch (error) {
    console.error("Error updating enquiry:", error);
    res.status(500).json({
      message: "Failed to update enquiry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ─── DELETE ENQUIRY ───
router.delete("/:id", async (req, res) => {
  try {
    const enquiry = await OrderEnquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    res.status(200).json({
      message: "Enquiry deleted successfully",
      enquiry,
    });
  } catch (error) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({
      message: "Failed to delete enquiry",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
