const express = require('express');
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require('cors');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// เชื่อมต่อ DB
const dbPath = path.resolve(__dirname, 'table.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err)=>{
    if (err) return console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// ✅ สร้างตาราง users
db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT
)`);

// ✅ สร้างตาราง saves
db.run(`CREATE TABLE IF NOT EXISTS saves(
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    save_name TEXT,
    current_scene TEXT,
    variables TEXT,
    save_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
)`);

console.log("Tables ready");

// ------------------- USERS -------------------

// ✅ Register
app.post('/users', (req, res) => {
    const { username, password, email } = req.body;
    const sql = 'INSERT INTO users(username, password, email) VALUES (?, ?, ?)';

    db.run(sql, [username, password, email], function(err){
        if (err) return res.json({ status: 300, success: false, error: err.message });
        res.json({
            status: 200,
            success: true,
            message: "User created",
            data: { id: this.lastID, username, email }
        });
    });
});

// ✅ Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';

    db.get(sql, [username, password], (err, row) => {
        if (err) return res.json({ success: false, message: "Database error" });

        if (row) {
            res.json({
                success: true,
                id: row.id,           // ✅ ส่ง user id กลับไป
                username: row.username,
                email: row.email
            });
        } else {
            res.json({ success: false, message: "Invalid username or password" });
        }
    });
});

// ✅ Get users
app.get('/users', (req,res)=>{
    db.all("SELECT id, username, password, email FROM users", [], (err, rows)=>{
        if(err) return res.status(500).json({error:err.message});
        res.json(rows);
    });
});

// ✅ Update user info
app.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, password, email } = req.body;

    const sql = `UPDATE users SET username = ?, password = ?, email = ? WHERE id = ?`;
    db.run(sql, [ username, password, email, id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        if (this.changes === 0) return res.json({ success: false, message: "User not found" });
        res.json({ success: true, message: "User updated successfully" });
    });
});

// ✅ Delete user
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, [id], function(err) {
        if (err) return res.json({ success: false, error: err.message });
        if (this.changes === 0) return res.json({ success: false, message: "User not found" });
        res.json({ success: true, message: "User deleted successfully" });
    });
});

// ------------------- SAVES -------------------

// ✅ บันทึกเซฟ
app.post('/saves', (req, res) => {
    const { user_id, save_name, current_scene, variables } = req.body;
    const sql = 'INSERT INTO saves(user_id, save_name, current_scene, variables) VALUES (?, ?, ?, ?)';
    db.run(sql, [user_id, save_name, current_scene, JSON.stringify(variables)], function(err){
        if (err) return res.json({ success: false, error: err.message });
        res.json({ success: true, message: "Save created", id: this.lastID });
    });
});

// ✅ โหลดเซฟทั้งหมดของผู้ใช้
app.get('/saves/:user_id', (req, res) => {
    const { user_id } = req.params;
    const sql = 'SELECT * FROM saves WHERE user_id = ? ORDER BY save_time DESC';
    db.all(sql, [user_id], (err, rows) => {
        if (err) return res.json({ success: false, error: err.message });
        res.json(rows.map(r => ({ ...r, variables: JSON.parse(r.variables || "{}") })));
    });
});

// ✅ อัปเดตเซฟ
app.put('/saves/:id', (req, res) => {
    const { id } = req.params;
    const { save_name, current_scene, variables } = req.body;
    const sql = 'UPDATE saves SET save_name=?, current_scene=?, variables=?, save_time=CURRENT_TIMESTAMP WHERE id=?';
    db.run(sql, [save_name, current_scene, JSON.stringify(variables), id], function(err){
        if (err) return res.json({ success: false, error: err.message });
        if (this.changes === 0) return res.json({ success: false, message: "Save not found" });
        res.json({ success: true, message: "Save updated" });
    });
});

// ✅ ลบเซฟ
app.delete('/saves/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM saves WHERE id = ?';
    db.run(sql, [id], function(err){
        if (err) return res.json({ success: false, error: err.message });
        if (this.changes === 0) return res.json({ success: false, message: "Save not found" });
        res.json({ success: true, message: "Save deleted" });
    });
});

// ---------------------------------------------

// ✅ ใช้ PORT จาก environment (สำคัญสำหรับ Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));