require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const Enquiry = require("./models/Enquiry");
const WorkPhoto = require("./models/WorkPhoto");
const Review = require("./models/Review");
const sendEmail = require("./utils/sendEmail");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per photo
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Connect MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// Submit enquiry / contact form
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, address, propertyType, electricityBill, message, page } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const enquiry = new Enquiry({ name, email, phone, address, propertyType, electricityBill, message, page });
    await enquiry.save();
    console.log("📥 New enquiry saved:", enquiry._id);

    // fire-and-forget email
    sendEmail(enquiry);

    res.json({ success: true, message: "Enquiry submitted successfully" });
  } catch (err) {
    console.error("❌ Error saving enquiry:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Simple in-memory rate limiter for admin login (per IP)
const loginAttempts = new Map(); // ip -> { count, firstAttemptTime }
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Admin login — checks password against ADMIN_PASSWORD in .env
app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && now - record.firstAttemptTime < WINDOW_MS && record.count >= MAX_ATTEMPTS) {
    const minutesLeft = Math.ceil((WINDOW_MS - (now - record.firstAttemptTime)) / 60000);
    return res.status(429).json({
      success: false,
      error: `Too many attempts. Try again in ${minutesLeft} minute(s).`,
    });
  }

  const { password } = req.body;
  if (password && password === process.env.ADMIN_PASSWORD) {
    loginAttempts.delete(ip); // reset on success
    return res.json({ success: true, token: process.env.ADMIN_PASSWORD });
  }

  // record failed attempt
  if (!record || now - record.firstAttemptTime >= WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttemptTime: now });
  } else {
    record.count += 1;
  }

  res.status(401).json({ success: false, error: "Incorrect password" });
});

// Middleware to protect admin data routes
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token && token === process.env.ADMIN_PASSWORD) {
    return next();
  }
  res.status(401).json({ success: false, error: "Unauthorized" });
}

// Get all enquiries (admin)
app.get("/api/enquiries", requireAdmin, async (req, res) => {
  try {
    const enquiries = await Enquiry.find().sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Delete one enquiry (admin)
app.delete("/api/enquiries/:id", requireAdmin, async (req, res) => {
  try {
    await Enquiry.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Delete all enquiries (admin)
app.delete("/api/enquiries", requireAdmin, async (req, res) => {
  try {
    await Enquiry.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ===== Work Photos (Our Work gallery) =====

// Get all work photos (public - shown on work.html)
app.get("/api/work-photos", async (req, res) => {
  try {
    const photos = await WorkPhoto.find().sort({ createdAt: -1 });
    res.json(photos);
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Upload a new work photo (admin)
app.post("/api/admin/work-photos", requireAdmin, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No photo uploaded" });
    }
    const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const photo = new WorkPhoto({ caption: req.body.caption || "", imageData });
    await photo.save();
    res.json({ success: true, photo: { _id: photo._id, caption: photo.caption } });
  } catch (err) {
    console.error("❌ Error uploading work photo:", err.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Delete a work photo (admin)
app.delete("/api/admin/work-photos/:id", requireAdmin, async (req, res) => {
  try {
    await WorkPhoto.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ===== Reviews =====

// Submit a new review (public - goes in as pending)
app.post("/api/reviews", async (req, res) => {
  try {
    const { name, rating, reviewText } = req.body;
    if (!name || !rating || !reviewText) {
      return res.status(400).json({ success: false, error: "Name, rating and review text are required" });
    }
    const review = new Review({ name, rating, reviewText, approved: false });
    await review.save();
    res.json({ success: true, message: "Thank you! Your review will appear after approval." });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get approved reviews only (public - shown on website)
app.get("/api/reviews", async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true }).sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Get all reviews including pending (admin)
app.get("/api/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Approve a review (admin)
app.patch("/api/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Delete/reject a review (admin)
app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
