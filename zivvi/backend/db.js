const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false // 🔥 REQUIRED for Render
    }
});

// ================= CONNECTION TEST =================
pool.connect()
    .then(() => console.log("✅ PostgreSQL Connected Successfully"))
    .catch(err => console.error("❌ DB Connection Error:", err.message));

// ================= AUTO TABLE CREATE =================
(async () => {
    try {
        // 🔐 USERS
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(100) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                reset_token TEXT,
                token_version INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 💰 BUDGET (🔥 FIXED)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS budget (
                id SERIAL PRIMARY KEY,
                user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC NOT NULL CHECK (amount > 0),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
         // 🔥 FIX FOR OLD DATABASE
         await pool.query(`
            ALTER TABLE budget 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
         `);

        // 🔥 IMPORTANT: Ensure UNIQUE constraint (in case table already exists)
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conname = 'unique_user_budget'
                ) THEN
                    ALTER TABLE budget
                    ADD CONSTRAINT unique_user_budget UNIQUE(user_id);
                END IF;
            END
            $$;
        `);

        // 📊 EXPENSES
        await pool.query(`
            CREATE TABLE IF NOT EXISTS expenses (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                name TEXT,
                category TEXT,
                amount NUMERIC NOT NULL CHECK (amount > 0),
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_method VARCHAR(50),
                bank_name VARCHAR(100)
            );
        `);

        // ⚡ INDEXES (performance boost)
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_expenses_user 
            ON expenses(user_id);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_budget_user 
            ON budget(user_id);
        `);

        console.log("🔥 All tables ready (Production Mode)");
    } catch (err) {
        console.error("❌ Table creation error:", err);
    }
})();

module.exports = pool;
