const nodemailer = require("nodemailer");

async function sendEmail(enquiry) {
  const { GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_EMAIL) {
    console.log("⚠️  Email not configured, skipping email notification.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"SunRise Solar Website" <${GMAIL_USER}>`,
      to: NOTIFY_EMAIL,
      subject: `New Solar Enquiry from ${enquiry.name}`,
      html: `
        <h2>New Enquiry Received</h2>
        <p><b>Name:</b> ${enquiry.name}</p>
        <p><b>Email:</b> ${enquiry.email}</p>
        <p><b>Phone:</b> ${enquiry.phone || "-"}</p>
        <p><b>Address:</b> ${enquiry.address || "-"}</p>
        <p><b>Property Type:</b> ${enquiry.propertyType || "-"}</p>
        <p><b>Monthly Electricity Bill:</b> ${enquiry.electricityBill || "-"}</p>
        <p><b>Message:</b> ${enquiry.message || "-"}</p>
        <p><b>Page:</b> ${enquiry.page || "-"}</p>
      `,
    });

    console.log("📧 Email sent successfully.");
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
}

module.exports = sendEmail;
