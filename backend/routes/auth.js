const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");

const JWT_SECRET = process.env.JWT_SECRET || "aura_health_secret_2024";

// Ensure default admin users exist on startup
db.serialize(() => {
  const hash = bcrypt.hashSync("admin123", 10);

  // admin@caretrace.ai
  db.get("SELECT id FROM users WHERE email = 'admin@caretrace.ai'", [], (err, row) => {
    if (!err && !row) {
      db.run(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Dr. Sharma", "admin@caretrace.ai", hash, "admin"],
        () => console.log("✅ Default admin created — admin@caretrace.ai / admin123")
      );
    }
  });

  // admin@aurahealth.in for backward compatibility
  db.get("SELECT id FROM users WHERE email = 'admin@aurahealth.in'", [], (err, row) => {
    if (!err && !row) {
      db.run(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        ["Admin", "admin@aurahealth.in", hash, "admin"],
        () => console.log("✅ Default admin created — admin@aurahealth.in / admin123")
      );
    }
  });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const cleanEmail = email.toLowerCase().trim();

  db.get("SELECT * FROM users WHERE email = ?", [cleanEmail], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  });
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }

  const hash = await bcrypt.hash(password, 10);
  db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name.trim(), email.toLowerCase().trim(), hash, role || "staff"],
    function (err) {
      if (err) return res.status(400).json({ error: "Email already exists" });
      res.status(201).json({ id: this.lastID, name, email, role: role || "staff" });
    }
  );
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    db.get("SELECT id, name, email, role FROM users WHERE id = ?", [decoded.id], (err, user) => {
      if (err || !user) return res.status(401).json({ error: "User not found" });
      res.json(user);
    });
  } catch {
    res.status(401).json({ error: "Token expired or invalid" });
  }
});

module.exports = router;