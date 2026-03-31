# 🚀 ZIVVI – AI Powered Finance Dashboard

> A modern, intelligent expense tracking system with AI insights, analytics, and real-time financial monitoring.

---

## ✨ Overview

ZIVVI is a full-stack financial dashboard designed to help users:

* 📊 Track expenses in real-time
* 🧠 Get AI-based spending insights
* 📈 Analyze financial trends
* 🔐 Manage secure sessions & authentication
* 📩 Receive automated weekly email reports

---

## 🏗️ Project Structure

```
zivvi/
├── backend/              # Node.js + Express API
├── login/                # Authentication UI
├── zivvi_dashboard/      # Main dashboard UI
├── index.html            # Entry point
```

---

## ⚙️ Tech Stack

### 🔹 Frontend

* HTML5
* CSS3 (Glass UI + Responsive Design)
* JavaScript (Vanilla)
* Chart.js

### 🔹 Backend

* Node.js
* Express.js
* PostgreSQL
* JWT Authentication
* Nodemailer

### 🔹 Deployment

* Frontend → Vercel
* Backend → Render

---

## 🔐 Features

### 📊 Dashboard

* Real-time expense tracking
* Smart budget calculation
* Dynamic UI updates

### 📈 Analytics

* Spending trends visualization
* Category-wise breakdown
* Predictive insights

### 🧠 AI System

* Finance score calculation
* Smart recommendations
* Spending pattern analysis

### 🔐 Security

* JWT-based authentication
* Session validation
* Protected routes

### 📩 Email System

* Weekly reports
* Smart insights
* Secure "Login to View" dashboard access

---

## 🚀 Getting Started

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/zivvi.git
cd zivvi
```

---

### 2️⃣ Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:

```env
PORT=5000

DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=authdb

JWT_SECRET=your_secret_key

EMAIL_USER=your_email
EMAIL_PASS=your_email_password

FRONTEND_URL=https://your-app.vercel.app
```

Run server:

```bash
node server.js
```

---

### 3️⃣ Frontend Setup

Open directly:

```
zivvi/index.html
```

OR deploy using Vercel.

---

## 🌐 Deployment

### 🔹 Frontend (Vercel)

* Import GitHub repo
* Root directory: `zivvi`
* Deploy

### 🔹 Backend (Render)

* Root directory: `zivvi/backend`
* Start command:

```bash
node server.js
```

* Add environment variables

---

## 🔗 API Configuration

```js
const BASE_URL = "https://your-backend.onrender.com";
```

---

## 📩 Email System

* Sends weekly financial reports
* Includes:

  * Spending summary
  * AI insights
  * Secure dashboard access button

---

## 🧠 Future Enhancements

* 🔮 AI prediction engine
* 📱 Mobile app version
* 🔗 Bank integration
* 📊 Advanced analytics
* 🔐 OAuth / Google login

---

## 🛡️ Security Notes

* Never expose `.env` file
* Use HTTPS in production
* Store JWT securely
* Validate all inputs

---

## 🤝 Contributing

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Open a Pull Request

---

## 📄 License

MIT License © 2026

---

## 💡 Author

**Ajay**
BCA – Data Science & Artificial Intelligence

---

## ⭐ Support

If you like this project:

⭐ Star the repo
🚀 Share with others

---

## 🔥 Final Note

ZIVVI is not just an expense tracker —
it's your **AI-powered financial assistant**.
