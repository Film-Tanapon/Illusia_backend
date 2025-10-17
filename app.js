import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { Database } from "@sqlitecloud/drivers";
import 'dotenv/config';

const app = express();
app.use(express.static("public"));
const port = process.env.PORT || 3000;
const connectionString = process.env.SQLITECLOUD_CONNECTION_STRING;

// ✅ เชื่อมต่อ SQLite Cloud
const db = new Database(connectionString);

app.use(bodyParser.json());
app.use(cors());

// ✅ สร้างตาราง
async function init() {
    await db.sql(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT
    )`);

    await db.sql(`CREATE TABLE IF NOT EXISTS saves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        save_name TEXT,
        current_scene TEXT,
        variables TEXT,
        save_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
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
    await db.sql(
        "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
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
    const result = await db.sql(
        "SELECT * FROM users WHERE username=? AND password=?",
        [username, password]
    );

    if (result.length === 0) {
        res.json({ success: false, message: "Invalid username or password" });
    } else {
        res.json({ success: true, user: result[0] });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Get all users
app.get("/users", async (req, res) => {
  try {
    const result = await db.sql("SELECT * FROM users");
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Update user
app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { username, password, email } = req.body;
  try {
    await db.sql(
      "UPDATE users SET username=?, password=?, email=? WHERE id=?",
      [username, password, email, id]
    );
    res.json({ success: true, message: "User updated" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ Delete user
app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.sql(
      "DELETE FROM users WHERE id=?",
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
    await db.sql(
        "INSERT INTO saves (user_id, save_name, current_scene, variables) VALUES (?, ?, ?, ?)",
        [user_id, save_name, current_scene, JSON.stringify(variables)]
    );
    res.json({ success: true, message: "Save created" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ โหลดเซฟทั้งหมดของผู้ใช้
app.get("/saves/:user_id", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await db.sql(
      "SELECT * FROM saves WHERE user_id = ? ORDER BY save_time DESC",
      [user_id],
    );
    res.json(result.map(r => ({ ...r, variables: JSON.parse(r.variables || "{}") })));
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ✅ ลบเซฟ
app.delete("/saves/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.sql(
      "DELETE FROM saves WHERE id=?",
      [id]
    );
    res.json({ success: true, message: "Save deleted" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ---------------------------------------------
