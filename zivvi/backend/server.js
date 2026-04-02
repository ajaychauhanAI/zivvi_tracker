const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

// 🔥 NEW (for real-time)
const http = require('http');
const { Server } = require('socket.io');

// 🔥 server wrap
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

const path = require('path');

// 🔥 FIX: frontend serve karo
app.use(express.static(path.join(__dirname, '../')));

// 🔥 inject socket globally
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ================= ROUTES =================
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard'); // 🔥 NEW

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes); // 🔥 NEW

require('./services/weeklyEmailSystem');

// ================= CHATBOT ROUTE =================
const chatbotRoute = require("./routes/chatbot");
app.use("/api/chatbot", chatbotRoute);

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
    res.send("🚀 Server is running...");
});

// ================= SOCKET =================
io.on("connection", (socket) => {
    console.log("⚡ User connected");

    socket.on("disconnect", () => {
        console.log("❌ User disconnected");
    });
});

// ================= SERVER START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`🔥 Server running on port ${PORT}`);
});


