const express = require('express');
const router = express.Router();

const pool = require('../db');
const auth = require('../middleware/authMiddleware');

// ================= GET DASHBOARD =================
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const [expensesRes, budgetRes, userRes] = await Promise.all([
            pool.query(
                `SELECT id, name, category, amount,
                 payment_method, bank_name,
                 TO_CHAR(date, 'YYYY-MM-DD') as date
                 FROM expenses
                 WHERE user_id=$1
                 ORDER BY date DESC`,
                [userId]
            ),
            pool.query("SELECT amount FROM budget WHERE user_id=$1", [userId]),
            pool.query("SELECT name, email FROM users WHERE id=$1", [userId])
        ]);

        if (!userRes.rows.length) {
            return res.status(404).json({ message: "User not found" });
        }
                
        const rawData = (expensesRes.rows || []).map(e => ({
            id: e.id,
            name: e.name,
            category: e.category,
            amount: Number(e.amount) || 0,
            payment_method: e.payment_method,
            bank_name: e.bank_name || "",
            date: e.date
        }));

        res.json({
            success: true,
            data: {
                rawData,
                budget: Number(budgetRes.rows[0]?.amount) || 0,
                profile: {
                    name: userRes.rows[0]?.name || "User",
                    email: userRes.rows[0]?.email || "",
                    tier: "Pro",
                    status: "ACTIVE",
                    plan: "FREE",
                    instance: "v2.1.0"
                }
            }
        });

    } catch (err) {
        console.error("Dashboard error:", err.stack);
        res.status(500).json({
            success: false,
            message: "Dashboard error"
        });
    }
});

// ================= ADD EXPENSE =================
router.post('/expense', auth, async (req, res) => {
    try {
        const { name, category, amount, paymentMethod, bankName, date } = req.body;
        const amt = Number(amount);

        if (!name || !category || !amt || amt <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid input"
            });
        }

        const result = await pool.query(
            `INSERT INTO expenses(user_id, name, category, amount, payment_method, bank_name, date) 
             VALUES($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user.id,
                name,
                category,
                amt,
                paymentMethod || "Unknown",
                bankName || "Unknown",
                date || new Date().toLocaleDateString("en-CA")
            ]
        );

        if (req.io) req.io.to(req.user.id).emit("update");

        res.json({
            success: true,
            message: "Expense added",
            data: result.rows[0]
        });

    } catch (err) {
        console.error("Add expense error:", err.stack);
        res.status(500).json({
            success: false,
            message: "Error adding expense"
        });
    }
});

// ================= UPDATE BUDGET =================
router.post('/budget', auth, async (req, res) => {
    try {
        // 🔐 AUTH CHECK
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized user"
            });
        }

        // 💰 VALIDATION (STRONG)
        const amt = Number(req.body.amount);

        if (isNaN(amt) || amt <= 0 || amt > 100000000) {
            return res.status(400).json({
                success: false,
                message: "Invalid budget amount"
            });
        }

        // 🔥 MAIN QUERY (SAFE)
        const result = await pool.query(
            `INSERT INTO budget(user_id, amount)
             VALUES($1, $2)
             ON CONFLICT (user_id)
             DO UPDATE SET 
                amount = EXCLUDED.amount,
                updated_at = CURRENT_TIMESTAMP
             RETURNING amount`,
            [req.user.id, amt]
        );

        // ⚡ SOCKET UPDATE (SAFE)
        if (req.io) {
            req.io.to(String(req.user.id)).emit("update");
        }

        // ✅ RESPONSE
        return res.json({
            success: true,
            message: "Budget updated successfully",
            data: {
                amount: result.rows[0].amount
            }
        });

    } catch (err) {
        // 🔥 REAL ERROR LOG (VERY IMPORTANT)
        console.error("🔥 Budget API ERROR:", err);

        return res.status(500).json({
            success: false,
            message: err.message,   // 👈 अब real error दिखेगा
            error: "INTERNAL_SERVER_ERROR"
        });
    }
});

// ================= DELETE EXPENSE =================
router.delete('/expense/:id', auth, async (req, res) => {
    try {
        const expenseId = Number(req.params.id);
        const userId = req.user.id;

        if (!expenseId) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const result = await pool.query(
            'DELETE FROM expenses WHERE id=$1 AND user_id=$2',
            [expenseId, userId]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        if (req.io) req.io.to(userId).emit("update");

        res.json({
            success: true,
            message: "Expense deleted successfully"
        });

    } catch (err) {
        console.error("Delete error:", err.stack);
        res.status(500).json({
            success: false,
            message: "Error deleting expense"
        });
    }
});

// ================= UPDATE EXPENSE =================
router.put('/expense/:id', auth, async (req, res) => {
    try {
        const expenseId = Number(req.params.id);
        const userId = req.user.id;

        if (!expenseId) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense ID"
            });
        }

        const { name, category, amount, paymentMethod, bankName, date } = req.body;
        const amt = Number(amount);

        if (!name || !category || !amt || amt <= 0 || !date) {
            return res.status(400).json({
                success: false,
                message: "Invalid input"
            });
        }

        const result = await pool.query(
            `UPDATE expenses 
             SET name=$1, category=$2, amount=$3, payment_method=$4, bank_name=$5, date=$6
             WHERE id=$7 AND user_id=$8`,
            [
                name,
                category,
                amt,
                paymentMethod || "Unknown",
                bankName || "Unknown",
                date || new Date().toLocaleDateString("en-CA"),
                expenseId,
                userId
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        if (req.io) req.io.to(userId).emit("update");

        res.json({
            success: true,
            message: "Expense updated successfully"
        });

    } catch (err) {
        console.error("Update error:", err.stack);
        res.status(500).json({
            success: false,
            message: "Error updating expense"
        });
    }
});

// ================= RESET =================
router.delete('/reset', auth, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user.id;

        await client.query("BEGIN");

        await client.query("DELETE FROM expenses WHERE user_id=$1", [userId]);
        await client.query("DELETE FROM budget WHERE user_id=$1", [userId]);

        await client.query("COMMIT");

        if (req.io) req.io.to(userId).emit("update");

        res.json({
            success: true,
            message: "All data cleared"
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Reset error:", err.stack);

        res.status(500).json({
            success: false,
            message: "Reset error"
        });

    } finally {
        client.release();
    }
});



// ================= NOTIFICATION SETTINGS =================
router.post('/settings/notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, budget, summary } = req.body;

        await pool.query(
            `INSERT INTO user_settings(user_id, email_alert, budget_alert, summary_alert)
             VALUES($1, $2, $3, $4)
             ON CONFLICT(user_id)
             DO UPDATE SET 
                email_alert = EXCLUDED.email_alert,
                budget_alert = EXCLUDED.budget_alert,
                summary_alert = EXCLUDED.summary_alert`,
            [userId, email || false, budget || false, summary || false]
        );

        res.json({
            success: true,
            message: "Notification settings updated"
        });

    } catch (err) {
        console.error("Notification settings error:", err);
        res.status(500).json({ success: false });
    }
});


// ================= AI SETTINGS =================
router.post('/settings/ai', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { enabled } = req.body;

        await pool.query(
            `INSERT INTO user_settings(user_id, ai_enabled)
             VALUES($1, $2)
             ON CONFLICT(user_id)
             DO UPDATE SET ai_enabled = EXCLUDED.ai_enabled`,
            [userId, enabled || false]
        );

        res.json({
            success: true,
            message: "AI settings updated"
        });

    } catch (err) {
        console.error("AI settings error:", err);
        res.status(500).json({ success: false });
    }
});


// ================= CHANGE PASSWORD =================
const bcrypt = require('bcryptjs');

router.post('/settings/change-password', auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { oldPass, newPass } = req.body || {};

        // ==============================
        // 🔐 BASIC VALIDATION
        // ==============================
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        if (!oldPass || !newPass) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (typeof newPass !== "string" || newPass.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // ==============================
        // 👤 FETCH USER
        // ==============================
        const result = await pool.query(
            "SELECT password FROM users WHERE id = $1 LIMIT 1",
            [userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const currentHash = result.rows[0].password;

        // ==============================
        // 🔍 VERIFY OLD PASSWORD
        // ==============================
        const isMatch = await bcrypt.compare(oldPass, currentHash);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Incorrect current password"
            });
        }

        // ==============================
        // 🚫 PREVENT SAME PASSWORD
        // ==============================
        const isSame = await bcrypt.compare(newPass, currentHash);
        if (isSame) {
            return res.status(400).json({
                success: false,
                message: "New password must be different"
            });
        }

        // ==============================
        // 🔐 HASH NEW PASSWORD
        // ==============================
        const hashedPassword = await bcrypt.hash(newPass, 10);

        // ==============================
        // 💾 UPDATE PASSWORD
        // ==============================
        await pool.query(
            "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
            [hashedPassword, userId]
        );

        // ==============================
        // ✅ SUCCESS RESPONSE
        // ==============================
        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });

    } catch (err) {
        console.error("Change password error:", err);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// ================= LOGOUT ALL DEVICES =================
router.post('/settings/logout-all', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // optional: token versioning (recommended)
        await pool.query(
            `UPDATE users SET token_version = COALESCE(token_version,0) + 1 WHERE id=$1`,
            [userId]
        );

        res.json({
            success: true,
            message: "Logged out from all devices"
        });

    } catch (err) {
        console.error("Logout error:", err);
        res.status(500).json({ success: false });
    }
});

const { getWeeklyReport } = require('../services/weeklyEmailSystem');
const PDFDocument = require('pdfkit');

// ================= PDF DOWNLOAD =================
router.get('/report/download', auth, async (req, res) => {
    try {
        const userId = req.user.id; // ✅ now valid

        const report = await getWeeklyReport(userId);

        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');

        doc.pipe(res);

        // HEADER
        doc.fontSize(18).text("📊 Weekly Expense Report", { align: "center" });

        doc.moveDown();

        // SUMMARY
        doc.fontSize(12).text(`Total Spend: ₹${report.total}`);
        doc.text(`Budget: ₹${report.budget}`);
        doc.text(`Remaining: ₹${report.remaining}`);

        doc.moveDown();
        doc.text("Category Breakdown:");

        // CATEGORY DATA
        report.categories.forEach(c => {
            doc.text(`• ${c.category}: ₹${c.total}`);
        });

        doc.end();

    } catch (err) {
        console.error("PDF error:", err);

        res.status(500).json({
            success: false,
            error: err.message // ✅ debug friendly
        });
    }
});

router.delete('/reset-secure', auth, async (req, res) => {
    const client = await pool.connect();

    try {
        const userId = req.user?.id;
        const { password } = req.body || {};

        // ==============================
        // 🔐 VALIDATION
        // ==============================
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        if (!password || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Password required"
            });
        }

        // ==============================
        // 👤 FETCH USER PASSWORD
        // ==============================
        const userRes = await pool.query(
            "SELECT password FROM users WHERE id=$1 LIMIT 1",
            [userId]
        );

        if (!userRes.rows.length) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const hashedPassword = userRes.rows[0].password;

        // ==============================
        // 🔍 VERIFY PASSWORD
        // ==============================
        const isMatch = await bcrypt.compare(password, hashedPassword);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            });
        }

        // ==============================
        // 🔥 TRANSACTION START
        // ==============================
        await client.query("BEGIN");

        await client.query(
            "DELETE FROM expenses WHERE user_id=$1",
            [userId]
        );

        await client.query(
            "DELETE FROM budget WHERE user_id=$1",
            [userId]
        );

        // ==============================
        // ✅ COMMIT
        // ==============================
        await client.query("COMMIT");

        // ==============================
        // 🔄 REALTIME UPDATE (if socket exists)
        // ==============================
        if (req.io) {
            req.io.to(userId).emit("update");
        }

        // ==============================
        // 📤 RESPONSE
        // ==============================
        res.json({
            success: true,
            message: "All data cleared securely"
        });

    } catch (err) {

        // ==============================
        // ❌ ROLLBACK ON ERROR
        // ==============================
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            console.error("Rollback error:", rollbackErr);
        }

        console.error("Secure reset error:", err);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });

    } finally {
        client.release();
    }
});

module.exports = router;
