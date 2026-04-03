const nodemailer = require('nodemailer');
require('dotenv').config();

// ✅ Check env
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("❌ EMAIL ENV VARIABLES MISSING");
}

// ✅ Transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ✅ Verify
transporter.verify((error) => {
    if (error) {
        console.log("❌ Email config error:", error.message);
    } else {
        console.log("✅ Email server ready");
    }
});

// ✅ FINAL FIXED FUNCTION
const sendEmail = async (to, subject, html, text) => {
    console.log("📨 Inside sendEmail");

    try {
        const info = await transporter.sendMail({
            from: `"ZIVVI Support" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text: text || "Welcome to ZIVVI", // 🔥 IMPORTANT FIX
            html
        });

        console.log("📧 Email sent:", info.response);

    } catch (err) {
        console.error("❌ MAILER ERROR:", err.message);
        throw err; // 🔥 IMPORTANT
    }
};

module.exports = sendEmail;
