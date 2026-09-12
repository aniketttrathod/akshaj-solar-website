const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    propertyType: { type: String }, // Residential / Commercial / Housing Society
    electricityBill: { type: String }, // Monthly electricity bill range
    message: { type: String },
    page: { type: String }, // which page the form was submitted from
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enquiry", enquirySchema);
