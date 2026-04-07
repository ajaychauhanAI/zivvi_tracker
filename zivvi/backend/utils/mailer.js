const nodemailer = require('nodemailer');
require('dotenv').config();

// ✅ Check env variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("❌ EMAIL ENV VARIABLES MISSING");
}

// ✅ Create transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    family: 4, // 🔥 FORCE IPv4 (THIS FIXES YOUR ERROR)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// ✅ Verify connection (server start pe ek baar chalega)
transporter.verify((error, success) => {
    if (error) {
        console.log("❌ Email config error:", error.message);
        console.log("👉 Check EMAIL_USER & APP PASSWORD");
    } else {
        console.log("✅ Email server is ready to send messages");
    }
});

// ✅ Send email function (SAFE)
const sendEmail = async (to, subject, html) => {
    console.log("📨 Inside sendEmail function");

    try {
        const info = await transporter.sendMail({
            from: `"ZIVVI Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });

        console.log("📧 Email sent:", info.response);

    } catch (err) {   // ✅ FIXED
        console.log("⚠️ Email failed:", err.message);
        throw err;
    }
};

module.exports = sendEmail;
