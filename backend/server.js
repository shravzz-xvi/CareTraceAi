require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const patientRoutes = require("./routes/patients");
const checkinRoutes = require("./routes/checkins");
const alertRoutes = require("./routes/alerts");
const statsRoutes = require("./routes/stats");
const smsRoutes = require("./routes/sms");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/sms", smsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "CareTraceAI",
    version: "2.0.0",
    hindsight_configured: Boolean(process.env.HINDSIGHT_API_KEY)
  });
});

// Initialize background cron scheduler
try {
  require("./cron");
} catch (e) {
  console.warn("⚠️ Cron scheduler initialization skipped:", e.message);
}

// 404 handler for unhandled routes
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.status(404).send("Not found");
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CareTraceAI Backend running on http://localhost:${PORT}`);
  console.log(`🧠 Hindsight URL: ${process.env.HINDSIGHT_URL || "http://localhost:8888"}`);
  console.log(`🩺 Longitudinal Recovery Monitoring Active`);
  console.log(`======================================================\n`);
});