import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const app = express();
app.use(express.static("public"));
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
  });

app.use(bodyParser.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));

// ✅ สร้างตาราง
async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS saves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        save_name TEXT,
        current_scene TEXT,
        variables TEXT,
        save_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    console.log("Tables ready!");
    app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
}

init();

// ------------------- USERS -------------------

// ✅ Register
app.post("/users", async (req, res) => {
  const { username, password, email } = req.body;
  try {
    // REVERTED to .sql()
    await pool.query(
        "INSERT INTO users (username, password, email) VALUES ($1, $2, $3)",
        [username, password, email]
    );
    res.json({ success: true, message: "User created" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
        "SELECT id, username, password, email FROM users WHERE username=$1",
        [username]
    );

    if (result.rows.length === 0) {
        return res.json({ success: false, message: "Invalid username or password" });
    } 
    
    const user = result.rows[0];

    if (user.password.trim() === password.trim()) { 
        delete user.password; 
        return res.json({ success: true, user: user });
    } else {
        return res.json({ success: false, message: "Invalid username or password" });
    }
  } catch (err) {
    console.error("Login Error:", err);
    return res.json({ success: false, error: err.message });
  }
});

// ✅ Get all users
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Update user
app.put("/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ success: false, error: "Missing username, password, or email field." });
    }
    try {
        await pool.query(
            "UPDATE users SET username=$1, password=$2, email=$3 WHERE id=$4",
            [username.trim(), password.trim(), email.trim(), id]
        );
        res.json({ success: true, message: `User ID ${id} updated.` });
    } catch (err) {
        console.error("Update Error:", err);
        res.json({ success: false, error: err.message });
    }
});

// ✅ Delete user
app.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(
      "DELETE FROM users WHERE id=$1",
      [id]
    );
    res.json({ success: true, message: "User deleted" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ------------------- SAVES -------------------

// ✅ บันทึกเซฟ
app.post("/saves", async (req, res) => {
  const { user_id, save_name, current_scene, variables } = req.body;
  try {
    await pool.query(
        "INSERT INTO saves (user_id, save_name, current_scene, variables) VALUES ($1, $2, $3, $4)",
        [user_id, save_name, current_scene, JSON.stringify(variables)]
    );
    res.json({ success: true, message: "Save created" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ โหลดเซฟทั้งหมดของผู้ใช้
app.get("/saves/:user_id", async (req, res) => {
  const user_id = parseInt(req.params.user_id);
  try {
    const result = await pool.query(
      "SELECT * FROM saves WHERE user_id = $1 ORDER BY save_time DESC",
      [user_id],
    );
    res.json(result.rows.map(r => ({ ...r, variables: JSON.parse(r.variables || "{}") })));
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ ลบเซฟ
app.delete("/saves/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(
      "DELETE FROM saves WHERE id=$1",
      [id]
    );
    res.json({ success: true, message: "Save deleted" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});