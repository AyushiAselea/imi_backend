const mongoose = require("mongoose");

const orderEnquirySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    product: {
      type: String,
      required: true,
    },
    glasses: {
      type: String,
      enum: ["Mark 1", "Mark 2"],
      default: "Mark 1",
    },
    variant: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    paymentMethod: {
      type: String,
      enum: ["Online", "COD", "PARTIAL"],
      default: "Online",
    },
    heardAbout: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Interested", "Not Interested", "Closed"],
      default: "New",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OrderEnquiry", orderEnquirySchema);
