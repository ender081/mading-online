const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'mading-sekolah-super-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Inisialisasi Database SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error("Gagal koneksi DB:", err);
  else console.log("Database SQLite terhubung.");
});

// Membuat Tabel User dan Postingan jika belum ada
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'siswa', -- 'siswa', 'guru', 'admin'
      role_request TEXT DEFAULT 'none' -- 'none', 'requested_guru', 'approved'
    )
  `);

  // Bikin Akun Admin Default otomatis jika belum ada
  db.get("SELECT * FROM users WHERE role = 'admin'", [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync("admin123", 10);
      db.run("INSERT INTO users (name, email, password, role, role_request) VALUES (?, ?, ?, ?, ?)",
        ["Administrator Mading", "admin@sekolah.sch.id", hash, "admin", "none"]
      );
      console.log("-> Akun Admin Default dibuat: admin@sekolah.sch.id / admin123");
    }
  });
});

// Middleware Cek Role Admin
function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: "Akses ditolak! Khusus Admin." });
  }
}

// --- API AUTHENTICATION ---

// 1. Registrasi Akun Siswa/Pengguna
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run("INSERT INTO users (name, email, password, role, role_request) VALUES (?, ?, ?, 'siswa', 'none')", 
    [name, email, hash], 
    function(err) {
      if (err) return res.status(400).json({ success: false, message: "Email sudah terdaftar!" });
      res.json({ success: true, message: "Registrasi berhasil, silakan login." });
    }
  );
});

// 2. Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: "Email atau password salah!" });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      role_request: user.role_request
    };

    res.json({ success: true, user: req.session.user });
  });
});

// 3. Request Role Guru (Diajukan oleh User/Siswa ke Admin)
app.post('/api/user/request-guru', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Belum login!" });

  const userId = req.session.user.id;
  db.run("UPDATE users SET role_request = 'requested_guru' WHERE id = ?", [userId], function(err) {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengajukan permintaan." });
    
    req.session.user.role_request = 'requested_guru';
    res.json({ success: true, message: "Permintaan role Guru berhasil dikirim ke Admin!" });
  });
});

// --- API KHUSUS ADMIN ---

// 4. Admin melihat daftar pengajuan role Guru
app.get('/api/admin/requests', requireAdmin, (req, res) => {
  db.all("SELECT id, name, email, role, role_request FROM users WHERE role_request = 'requested_guru'", [], (err, rows) => {
    res.json({ success: true, requests: rows });
  });
});

// 5. Admin Menyetujui (Approve) atau Menolak (Reject) Role Guru
app.post('/api/admin/approve-guru', requireAdmin, (req, res) => {
  const { userId, action } = req.body; // action: 'approve' atau 'reject'

  if (action === 'approve') {
    db.run("UPDATE users SET role = 'guru', role_request = 'none' WHERE id = ?", [userId], function(err) {
      if (err) return res.status(500).json({ success: false, message: "Gagal update role." });
      res.json({ success: true, message: "User berhasil diubah menjadi Guru!" });
    });
  } else {
    db.run("UPDATE users SET role_request = 'none' WHERE id = ?", [userId], function(err) {
      res.json({ success: true, message: "Permintaan role Guru ditolak." });
    });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logout berhasil." });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});