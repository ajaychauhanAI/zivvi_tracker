const cron = require('node-cron');
const nodemailer = require('nodemailer');
const pool = require('../db');

// ==============================
// 📊 GET WEEKLY REPORT
// ==============================
async function getWeeklyReport(userId) {
    const categoriesRes = await pool.query(`
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE user_id=$1 
        AND date >= NOW() - INTERVAL '7 days'
        GROUP BY category
    `, [userId]);

    const totalRes = await pool.query(`
        SELECT SUM(amount) as total
        FROM expenses
        WHERE user_id=$1 
        AND date >= NOW() - INTERVAL '7 days'
    `, [userId]);

    const budgetRes = await pool.query(
        "SELECT amount FROM budget WHERE user_id=$1",
        [userId]
    );

    const total = Number(totalRes.rows[0]?.total || 0);
    const budget = Number(budgetRes.rows[0]?.amount || 0);

    return {
        categories: categoriesRes.rows,
        total,
        budget,
        remaining: Math.max(0, budget - total)
    };
}

// ==============================
// ✉️ ADVANCED EMAIL TEMPLATE
// ==============================
function generateEmailHTML(userName, report) {
    // 🔐 SAFE DATA
    report = report || {};
    const categories = Array.isArray(report.categories) ? report.categories : [];

    const total = Number(report.total || 0);
    const budget = Number(report.budget || 0);
    const remaining = Number(report.remaining || 0);

    const percent = budget > 0
        ? ((total / budget) * 100).toFixed(1)
        : 0;

    let status = "Healthy";
    let color = "#16a34a";

    if (percent > 80) {
        status = "Critical Overspending";
        color = "#dc2626";
    } else if (percent > 60) {
        status = "Warning Zone";
        color = "#f59e0b";
    }

    const categoriesHTML = categories.length
        ? categories.map(c => `
            <tr>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:14px;">
                    ${c.category || "Unknown"}
                </td>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-weight:600;">
                    ₹${Number(c.total || 0).toLocaleString()}
                </td>
            </tr>
        `).join('')
        : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#888;">No data available</td></tr>`;

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>

<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:20px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">

    <tr>
        <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;padding:20px;text-align:center;">
            <h2 style="margin:0;font-size:20px;">📊 Weekly Expense Report</h2>
            <p style="margin:5px 0 0;font-size:12px;opacity:0.8;">
                Powered by ZIVVI AI
            </p>
        </td>
    </tr>

    <tr>
        <td style="padding:25px;">

            <p style="font-size:14px;">Hello <b>${userName || "User"}</b>,</p>
            <p style="font-size:14px;color:#4b5563;">
                Here’s your financial summary for this week:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9fafb;border-radius:10px;margin:15px 0;">
                <tr><td style="padding:15px;">
                    <p style="margin:5px 0;"><b>Total Spend:</b> ₹${total.toLocaleString()}</p>
                    <p style="margin:5px 0;"><b>Budget:</b> ₹${budget.toLocaleString()}</p>
                    <p style="margin:5px 0;"><b>Remaining:</b> ₹${remaining.toLocaleString()}</p>

                    <p style="margin-top:8px;">
                        <b>Status:</b> 
                        <span style="color:${color};font-weight:bold;">
                            ${status}
                        </span>
                    </p>
                </td></tr>
            </table>

            <h3 style="font-size:16px;margin-bottom:8px;">📊 Category Breakdown</h3>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;">
                <tr style="background:#eef2ff;">
                    <th align="left" style="padding:12px;font-size:13px;">Category</th>
                    <th align="left" style="padding:12px;font-size:13px;">Amount</th>
                </tr>
                ${categoriesHTML}
            </table>

            <div style="text-align:center;margin:25px 0;">
                <a href="http://localhost:3000/login/login.html" target="_blank" 
                   style="background:#6366f1;color:#ffffff;padding:12px 20px;
                          text-decoration:none;border-radius:8px;
                          font-size:14px;font-weight:bold;display:inline-block;">
                    📊 Login to View
                </a>
            </div>

            <div style="background:#ecfeff;padding:12px;border-radius:8px;font-size:13px;">
                💡 <b>AI Insight:</b> You used <b>${percent}%</b> of your budget this week.
                ${
                    percent > 80
                        ? " Immediate action recommended to control spending."
                        : percent > 60
                        ? " Consider reducing discretionary expenses."
                        : " Excellent financial discipline maintained!"
                }
            </div>

            <p style="margin-top:20px;font-size:12px;color:#6b7280;">
                Stay consistent with your financial goals 🚀
            </p>

            <p style="font-size:13px;">
                Regards,<br/>
                <b>ZIVVI AI Finance System</b>
            </p>

        </td>
    </tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

const PDFDocument = require('pdfkit');

function generatePDFBuffer(report) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument();
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // 🔹 CONTENT
            doc.fontSize(18).text("Weekly Expense Report", { align: "center" });

            doc.moveDown();
            doc.text(`Total Spend: ₹${report.total}`);
            doc.text(`Budget: ₹${report.budget}`);
            doc.text(`Remaining: ₹${report.remaining}`);

            doc.moveDown();
            doc.text("Category Breakdown:");

            report.categories.forEach(c => {
                doc.text(`${c.category}: ₹${c.total}`);
            });

            doc.end();

        } catch (err) {
            reject(err);
        }
    });
}

// ==============================
// 📧 EMAIL CONFIG
// ==============================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ==============================
// 🚀 SEND EMAIL
// ==============================
async function sendWeeklyEmail(user) {
    try {
        if (!user || !user.id || !user.email) return;

        const report = await getWeeklyReport(user.id);

        if (!report) return;

        const html = generateEmailHTML(user.name || "User", report);

        // 🔥 PDF GENERATE
        const pdfBuffer = await generatePDFBuffer(report);

        await transporter.sendMail({
            from: `"ZIVVI AI" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "📊 Your Weekly Expense Report",
            html,

            // ✅ YAHAN ADD KARO
            attachments: [
                {
                    filename: "weekly-report.pdf",
                    content: pdfBuffer
                }
            ]
        });

        console.log(`✅ Email sent to ${user.email}`);

    } catch (err) {
        console.error("❌ Email error:", err);
    }
}

// ==============================
// ⏰ CRON JOB
// ==============================
cron.schedule('0 9 * * 6', async () => {
    console.log("📨 Running Weekly Email Job...");

    try {
        const users = await pool.query("SELECT id, name, email FROM users");

        for (let user of users.rows) {
            await sendWeeklyEmail(user);
        }

    } catch (err) {
        console.error("Cron error:", err);
    }
});

// ✅ EXPORT FIX
module.exports = {
    getWeeklyReport,
    sendWeeklyEmail   // 🔥 add this
};