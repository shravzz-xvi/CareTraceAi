require("dotenv").config();
const express        = require("express");
const cors           = require("cors");
const authRoutes     = require("./routes/auth");
const patientRoutes  = require("./routes/patients");
const statsRoutes    = require("./routes/stats");
const authMiddleware = require("./middleware/authMiddleware");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// Public
app.use("/api/auth", authRoutes);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

// Protected
app.use("/api/patients", authMiddleware, patientRoutes);
app.use("/api/stats",    authMiddleware, statsRoutes);

// SMS routes
try {
  const smsRoutes = require("./routes/sms");
  app.use("/api/sms", authMiddleware, smsRoutes);
  console.log("📱  SMS routes enabled");
} catch (e) { console.log("⚠️  SMS routes not found"); }

// Email routes
try {
  const emailRoutes = require("./routes/email");
  app.use("/api/email", authMiddleware, emailRoutes);
  console.log("📧  Email routes enabled");
} catch (e) { console.log("⚠️  Email routes not found"); }

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "Server error" }); });

// Cron
try { require("./cron"); }
catch (e) { console.log("⚠️  Cron not loaded:", e.message); }

app.listen(PORT, () => {
  console.log(`\n🚀  Aura Health → http://localhost:${PORT}`);
  console.log(`✅  Ready\n`);
});