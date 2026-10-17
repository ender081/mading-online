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

// Database SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error("Gagal koneksi DB:", err);
  else console.log("Database SQLite terhubung.");
});

// Inisialisasi Tabel Users & Posts
db.serialize(() => {
  // Tabel Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'siswa',
      role_request TEXT DEFAULT 'none'
    )
  `);

  // Tabel Posts
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      author_name TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Akun Admin Default
  db.get("SELECT * FROM users WHERE role = 'admin'", [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync("admin123", 10);
      db.run("INSERT INTO users (name, username, password, role, role_request) VALUES (?, ?, ?, ?, ?)",
        ["Administrator Mading", "admin", hash, "admin", "none"]
      );
    }
  });
});

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: "Akses ditolak! Khusus Admin." });
  }
}

// --- API AUTHENTICATION ---

app.get('/api/user/session', (req, res) => {
  if (req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: true, user: null });
  }
});

app.post('/api/register', (req, res) => {
  const { name, username, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run("INSERT INTO users (name, username, password, role, role_request) VALUES (?, ?, ?, 'siswa', 'none')", 
    [name, username, hash], 
    function(err) {
      if (err) return res.status(400).json({ success: false, message: "Username sudah terdaftar!" });
      res.json({ success: true, message: "Pendaftaran berhasil, silakan masuk." });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: "Username atau password salah!" });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      role_request: user.role_request
    };

    res.json({ success: true, user: req.session.user });
  });
});

app.post('/api/user/request-guru', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Belum login!" });

  const userId = req.session.user.id;
  db.run("UPDATE users SET role_request = 'requested_guru' WHERE id = ?", [userId], function(err) {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengajukan permintaan." });
    req.session.user.role_request = 'requested_guru';
    res.json({ success: true, message: "Permintaan role Guru berhasil dikirim ke Admin!" });
  });
});

// --- API POSTINGAN MADING ---

// Get Semua Postingan
app.get('/api/posts', (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil postingan." });
    res.json({ success: true, posts: rows });
  });
});

// Buat Postingan Baru (Hanya untuk pengguna yang sudah login)
app.post('/api/posts', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Silakan login terlebih dahulu!" });
  }

  const { title, category, content } = req.body;
  const authorName = req.session.user.name;
  const userId = req.session.user.id;

  if (!title || !category || !content) {
    return res.status(400).json({ success: false, message: "Semua kolom wajib diisi!" });
  }

  db.run("INSERT INTO posts (title, category, content, author_name, user_id) VALUES (?, ?, ?, ?, ?)",
    [title, category, content, authorName, userId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: "Gagal menyimpan postingan." });
      res.json({ success: true, message: "Postingan berhasil diterbitkan!" });
    }
  );
});

// --- API ADMIN ---

app.get('/api/admin/requests', requireAdmin, (req, res) => {
  db.all("SELECT id, name, username, role, role_request FROM users WHERE role_request = 'requested_guru'", [], (err, rows) => {
    res.json({ success: true, requests: rows });
  });
});

app.post('/api/admin/approve-guru', requireAdmin, (req, res) => {
  const { userId, action } = req.body;

  if (action === 'approve') {
    db.run("UPDATE users SET role = 'guru', role_request = 'none' WHERE id = ?", [userId], function(err) {
      if (err) return res.status(500).json({ success: false, message: "Gagal update role." });
      res.json({ success: true, message: "Pengguna berhasil diubah menjadi Guru/Ustadz!" });
    });
  } else {
    db.run("UPDATE users SET role_request = 'none' WHERE id = ?", [userId], function(err) {
      res.json({ success: true, message: "Permintaan role Guru ditolak." });
    });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logout berhasil." });
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
