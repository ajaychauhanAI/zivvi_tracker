const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/mailer');

// 🔥 CONFIG (MANUAL SWITCH)
const FRONTEND_URL = "http://localhost:5000"; // Change to your frontend URL

// REGISTER
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // ✅ 1. Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // ✅ 2. Email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // ✅ 3. Password validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // ✅ 4. Check duplicate email
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email=$1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        // ✅ 5. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // ✅ 6. Insert user
        const newUser = await pool.query(
            'INSERT INTO users (name,email,password) VALUES ($1,$2,$3) RETURNING id,name,email',
            [name, email, hashedPassword]
        );

        // ✅ 7. Send email (NON-BLOCKING 🔥)
const html = `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
        <tr>
            <td align="center">
                
                <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
                    
                    <!-- HEADER -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#6a11cb,#ff4d79);padding:25px;text-align:center;color:white;">
                            <h2 style="margin:0;font-size:22px;">⚡ ZIVVI</h2>
                            <p style="margin:5px 0 0;font-size:13px;opacity:0.9;">Welcome to the future</p>
                        </td>
                    </tr>

                    <!-- BODY -->
                    <tr>
                        <td style="padding:30px;text-align:center;">
                            
                            <h3 style="margin-bottom:10px;color:#333;">🎉 Welcome, ${name}!</h3>

                            <p style="color:#555;font-size:14px;line-height:1.6;">
                                Your account has been successfully created.<br>
                                You're now ready to explore ZIVVI and enjoy a seamless experience.
                            </p>

                            <!-- BUTTON -->
                            <a href="${FRONTEND_URL}/login/login.html"
                               style="display:inline-block;margin-top:20px;padding:14px 28px;
                               background:linear-gradient(135deg,#ff4d79,#ff758c);
                               color:#ffffff;text-decoration:none;border-radius:8px;
                               font-weight:bold;font-size:14px;box-shadow:0 5px 15px rgba(255,77,121,0.4);">
                               🔐 Login to Your Account
                            </a>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding:20px;text-align:center;background:#fafafa;border-top:1px solid #eee;">
                            <p style="margin:0;font-size:12px;color:#999;">
                                If you didn’t create this account, you can safely ignore this email.
                            </p>

                            <p style="margin:10px 0 0;font-size:11px;color:#bbb;">
                                © ${new Date().getFullYear()} ZIVVI • All rights reserved
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</div>
`;
        
        console.log("📨 sendEmail function CALL ho raha hai");
        
        // 🔥 IMPORTANT: no await
        sendEmail(email, "🎉 Welcome to ZIVVI", html)
            .catch(err => console.log("⚠️ Email failed:", err.message));

        // ✅ 8. Success response (ALWAYS SUCCESS)
        return res.status(200).json({
            success: true,
            message: "🎉 Registered successfully",
            user: newUser.rows[0]
        });

    } catch (err) {
        console.error("❌ REGISTER ERROR:", err);

        if (err.code === '23505') {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
});

// LOGIN
// 🔐 In-memory brute force protection (basic)
const loginAttempts = {};

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {

        // ==============================
        // ⚠️ VALIDATION
        // ==============================
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const now = Date.now();

        // ==============================
        // 🔐 INIT TRACKER
        // ==============================
        if (!loginAttempts[email]) {
            loginAttempts[email] = {
                count: 0,
                lockUntil: 0
            };
        }

        const attempt = loginAttempts[email];

        // ==============================
        // 🔒 LOCK CHECK
        // ==============================
        if (attempt.lockUntil > now) {
            const seconds = Math.ceil((attempt.lockUntil - now) / 1000);

            return res.status(429).json({
                success: false,
                message: `Account locked. Try again in ${seconds}s`
            });
        }

        // ==============================
        // 👤 FIND USER
        // ==============================
        const user = await pool.query(
            'SELECT * FROM users WHERE email=$1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        // ==============================
        // 🔑 PASSWORD CHECK
        // ==============================
        const valid = await bcrypt.compare(password, user.rows[0].password);

        if (!valid) {
            attempt.count++;

            // 🔥 LOCK AFTER 5 ATTEMPTS
            if (attempt.count >= 5) {
                attempt.lockUntil = now + (30 * 1000); // 30 sec lock
                attempt.count = 0;

                return res.status(429).json({
                    success: false,
                    message: "Too many failed attempts. Account locked for 30 seconds"
                });
            }

            return res.status(400).json({
                success: false,
                message: `Invalid password (${attempt.count}/5)`
            });
        }

        // ==============================
        // ✅ SUCCESS RESET
        // ==============================
        attempt.count = 0;
        attempt.lockUntil = 0;

        // ==============================
        // 🔑 TOKEN GENERATE
        // ==============================
        const token = jwt.sign(
            { id: user.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        return res.json({
            success: true,
            token
        });

    } catch (err) {
        console.error("❌ LOGIN ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // ✅ 1. Check user
        const user = await pool.query(
            'SELECT * FROM users WHERE email=$1',
            [email]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        // ✅ 2. Generate token
        const token = jwt.sign(
            { id: user.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // ✅ 3. Save token
        await pool.query(
            'UPDATE users SET reset_token=$1 WHERE email=$2',
            [token, email]
        );

        // ✅ 4. Reset link
        const link = `${FRONTEND_URL}/login/reset.html?token=${token}`;

        // ✅ 5. PROFESSIONAL EMAIL TEMPLATE
const html = `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
        <tr>
            <td align="center">
                
                <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
                    
                    <!-- HEADER -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#ff4d79,#6a11cb);padding:25px;text-align:center;color:white;">
                            <h2 style="margin:0;font-size:22px;">🔐 ZIVVI Security</h2>
                            <p style="margin:5px 0 0;font-size:13px;opacity:0.9;">Password Reset Request</p>
                        </td>
                    </tr>

                    <!-- BODY -->
                    <tr>
                        <td style="padding:30px;text-align:center;">
                            
                            <h3 style="margin-bottom:10px;color:#333;">Reset Your Password</h3>

                            <p style="color:#555;font-size:14px;line-height:1.6;">
                                We received a request to reset your password.<br>
                                Click the button below to set a new password.
                            </p>

                            <!-- BUTTON -->
                            <a href="${link}"
                               style="display:inline-block;margin-top:20px;padding:14px 28px;
                               background:linear-gradient(135deg,#ff4d79,#ff758c);
                               color:#ffffff;text-decoration:none;border-radius:8px;
                               font-weight:bold;font-size:14px;box-shadow:0 5px 15px rgba(255,77,121,0.4);">
                               🔑 Reset Password
                            </a>

                            <!-- WARNING -->
                            <p style="margin-top:20px;font-size:13px;color:#e63946;font-weight:500;">
                                ⏳ This link will expire in 15 minutes
                            </p>

                            <!-- FALLBACK LINK -->
                            <p style="margin-top:10px;font-size:12px;color:#888;">
                                Or copy & paste this link:<br>
                                <a href="${link}" style="color:#6a11cb;">
                                    ${link}
                                </a>
                            </p>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding:20px;text-align:center;background:#fafafa;border-top:1px solid #eee;">
                            <p style="margin:0;font-size:12px;color:#999;">
                                If you didn’t request a password reset, please ignore this email.
                            </p>

                            <p style="margin:10px 0 0;font-size:11px;color:#bbb;">
                                © ${new Date().getFullYear()} ZIVVI • Secure Auth System
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</div>
`;

        // ✅ 6. Send email safely
        try {
            await sendEmail(email, "🔐 Reset Your Password", html);
        } catch (err) {
            console.log("⚠️ Email failed:", err.message);
        }

        // ✅ 7. Response
        return res.json({
            success: true,
            message: "📧 Reset link sent to your email"
        });

    } catch (err) {
        console.error("❌ FORGOT PASSWORD ERROR:", err);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // ✅ 1. Validation
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Token and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // ✅ 2. Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ 3. Check token exists in DB (extra security)
        const user = await pool.query(
            'SELECT id FROM users WHERE id=$1 AND reset_token=$2',
            [decoded.id, token]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        // ✅ 4. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // ✅ 5. Update password + remove token
        await pool.query(
            'UPDATE users SET password=$1, reset_token=NULL WHERE id=$2',
            [hashedPassword, decoded.id]
        );

        // ✅ 6. Success response
        return res.json({
            success: true,
            message: "✅ Password updated successfully"
        });

    } catch (err) {
        console.log("❌ RESET ERROR:", err.message);

        return res.status(400).json({
            success: false,
            message: "Token expired or invalid"
        });
    }
});

module.exports = router;