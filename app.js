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
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT
    )`);
  //scene_history TEXT NOT NULL
  await pool.query(`CREATE TABLE IF NOT EXISTS saves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        save_name TEXT,
        current_scene TEXT,
        scene_history TEXT,
        variables TEXT,
        save_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS story (
      id SERIAL PRIMARY KEY,
      scene_id TEXT UNIQUE NOT NULL,
      text TEXT,
      music TEXT,
      background TEXT,
      character TEXT,
      character_left TEXT,
      character_right TEXT,
      delay INTEGER,
      diarytext TEXT,
      choice1_text TEXT,
      choice1_next TEXT,
      choice2_text TEXT,
      choice2_next TEXT,
      choice_position_top1 TEXT,
      choice_position_left1 TEXT,
      choice_position_top2 TEXT,
      choice_position_left2 TEXT,
      next TEXT,
      back TEXT
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
    if (err.code === '23505') {
      if (err.constraint === 'users_username_key' || err.constraint === 'unique_username') {
        return res.json({ success: false, error: "Username already taken." });
      }
      if (err.constraint === 'users_email_key' || err.constraint === 'unique_email') {
        return res.json({ success: false, error: "Email already taken." });
      }
    }
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
  const { user_id, save_name, current_scene, scene_history, variables } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO saves (user_id, save_name, current_scene, scene_history, variables) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [user_id, save_name, current_scene, scene_history, JSON.stringify(variables)]
    );
    res.json({ success: true, message: "Save created", save: result.rows[0] });
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

// 🚀 เพิ่มใหม่: อัปเดตเซฟ (สำหรับ Auto Save)
app.put("/saves/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  // รับข้อมูลที่จะอัปเดต (scene_history, variables, current_scene)
  const { scene_history, variables, current_scene } = req.body;

  try {
    await pool.query(
      // อัปเดต 3 คอลัมน์นี้ + อัปเดตเวลา save_time
      `UPDATE saves 
             SET scene_history = $1, variables = $2, current_scene = $3, save_time = CURRENT_TIMESTAMP
             WHERE id = $4`,
      [scene_history, JSON.stringify(variables), current_scene, id]
    );
    res.json({ success: true, message: "Game auto-saved." });
  } catch (err) {
    console.error("Auto-save Error:", err);
    res.status(500).json({ success: false, error: err.message });
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

app.post("/story", async (req, res) => {
  const {
    scene_id, text, music, background, character, character_left, character_right,
    delay, diarytext, choice1_text, choice1_next, choice2_text, choice2_next,
    choice_position_top1, choice_position_left1, choice_position_top2, choice_position_left2,
    next, back
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO story (
        scene_id, text, music, background, character, character_left, character_right,
        delay, diarytext, choice1_text, choice1_next, choice2_text, choice2_next,
        choice_position_top1, choice_position_left1, choice_position_top2, choice_position_left2,
        next, back
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )`,
      [
        scene_id, text, music, background, character, character_left, character_right,
        delay, diarytext, choice1_text, choice1_next, choice2_text, choice2_next,
        choice_position_top1, choice_position_left1, choice_position_top2, choice_position_left2,
        next, back
      ]
    );

    res.json({ success: true, message: "Story scene created" });
  } catch (err) {
    console.error("Story insert error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/story", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM story ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/story/:scene_id", async (req, res) => {
  const { scene_id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM story WHERE scene_id = $1", [scene_id]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Scene not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/story/:scene_id", async (req, res) => {
  const { scene_id } = req.params;
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);

  const setClause = keys.map((key, i) => `${key}=$${i + 1}`).join(", ");
  const query = `UPDATE story SET ${setClause} WHERE scene_id=$${keys.length + 1}`;

  try {
    await pool.query(query, [...values, scene_id]);
    res.json({ success: true, message: `Scene ${scene_id} updated.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/story/:scene_id", async (req, res) => {
  const { scene_id } = req.params;
  try {
    await pool.query("DELETE FROM story WHERE scene_id=$1", [scene_id]);
    res.json({ success: true, message: `Scene ${scene_id} deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});