require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const Enquiry = require("./models/Enquiry");
const sendEmail = require("./utils/sendEmail");

const app = express();
const PORT = process.env.PORT || 3000;

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
    const { name, email, phone, address, propertyType, message, page } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    const enquiry = new Enquiry({ name, email, phone, address, propertyType, message, page });
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
