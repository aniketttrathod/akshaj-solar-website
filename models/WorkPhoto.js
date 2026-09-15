const mongoose = require("mongoose");

const workPhotoSchema = new mongoose.Schema(
  {
    caption: { type: String, default: "" },
    imageData: { type: String, required: true }, // base64 data URI
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkPhoto", workPhotoSchema);
