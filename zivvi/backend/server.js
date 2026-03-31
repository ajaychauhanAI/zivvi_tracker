const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// 🔥 HTTP + SOCKET
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// 🔥 inject socket globally
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ================= ROUTES =================
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 🔥 SAFE LOAD EMAIL SYSTEM (MAIN FIX)
try {
    require('./services/weeklyEmailSystem');
    console.log("📩 Email system loaded");
} catch (err) {
    console.log("⚠️ Email system skipped:", err.message);
}

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
    res.send("🚀 Server is running...");
});

// ================= SOCKET =================
io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id);

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;

// 🔥 ERROR HANDLING (IMPORTANT FOR RENDER)
server.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
}).on("error", (err) => {
    console.error("❌ Server failed:", err.message);
});
