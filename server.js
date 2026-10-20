const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer untuk Upload Gambar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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

// Inisialisasi Tabel
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      kelas TEXT,
      role TEXT DEFAULT 'siswa',
      role_request TEXT DEFAULT 'none'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      author_name TEXT NOT NULL,
      author_kelas TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabel Likes
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `);

  // Tabel Laporan (Reports)
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      reporter_id INTEGER NOT NULL,
      reporter_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  db.get("SELECT * FROM users WHERE role = 'admin'", [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync("admin123", 10);
      db.run("INSERT INTO users (name, username, password, kelas, role, role_request) VALUES (?, ?, ?, ?, ?, ?)",
        ["Administrator Mading", "admin", hash, "Admin", "admin", "none"]
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
  const { name, username, password, kelas } = req.body;
  
  if (!name || !username || !password || !kelas) {
    return res.status(400).json({ success: false, message: "Semua kolom pendaftaran wajib diisi!" });
  }

  const hash = bcrypt.hashSync(password, 10);

  db.run("INSERT INTO users (name, username, password, kelas, role, role_request) VALUES (?, ?, ?, ?, 'siswa', 'none')", 
    [name, username, hash, kelas], 
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
      kelas: user.kelas,
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

// Get Semua Postingan (dengan Hitungan Like & Status User Already Liked)
app.get('/api/posts', (req, res) => {
  const currentUserId = req.session.user ? req.session.user.id : 0;
  const query = `
    SELECT p.*, 
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
    FROM posts p 
    ORDER BY p.id DESC
  `;

  db.all(query, [currentUserId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil postingan." });
    res.json({ success: true, posts: rows });
  });
});

// Toggle Like / Unlike Postingan
app.post('/api/posts/:id/like', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Silakan login terlebih dahulu untuk menyukai postingan!" });
  }

  const postId = req.params.id;
  const userId = req.session.user.id;

  db.get("SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, userId], (err, row) => {
    if (row) {
      // Jika sudah di-like, lakukan UNLIKE (hapus dari database)
      db.run("DELETE FROM likes WHERE post_id = ? AND user_id = ?", [postId, userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: "Gagal memproses unlike." });
        res.json({ success: true, liked: false, message: "Batal menyukai postingan." });
      });
    } else {
      // Jika belum di-like, tambahkan ke database
      db.run("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: "Gagal memproses like." });
        res.json({ success: true, liked: true, message: "Menyukai postingan!" });
      });
    }
  });
});

// Buat Postingan Baru
app.post('/api/posts', upload.single('image'), (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Silakan login terlebih dahulu!" });
  }

  const { title, category, content } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const authorName = req.session.user.name;
  const authorKelas = req.session.user.kelas || 'Umum';
  const userId = req.session.user.id;

  if (!title || !category || !content) {
    return res.status(400).json({ success: false, message: "Semua kolom wajib diisi!" });
  }

  db.run("INSERT INTO posts (title, category, content, image, author_name, author_kelas, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, category, content, image, authorName, authorKelas, userId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: "Gagal menyimpan postingan." });
      res.json({ success: true, message: "Postingan berhasil diterbitkan!" });
    }
  );
});

app.put('/api/posts/:id', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Belum login!" });

  const postId = req.params.id;
  const { title, category, content } = req.body;

  db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
    if (!post) return res.status(404).json({ success: false, message: "Postingan tidak ditemukan." });

    if (post.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki hak mengedit postingan ini!" });
    }

    let image = post.image;
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
      if (post.image && fs.existsSync(path.join(__dirname, 'public', post.image))) {
        fs.unlinkSync(path.join(__dirname, 'public', post.image));
      }
    }

    db.run("UPDATE posts SET title = ?, category = ?, content = ?, image = ? WHERE id = ?",
      [title, category, content, image, postId],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: "Gagal memperbarui postingan." });
        res.json({ success: true, message: "Postingan berhasil diperbarui!" });
      }
    );
  });
});

app.delete('/api/posts/:id', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Belum login!" });

  const postId = req.params.id;

  db.get("SELECT * FROM posts WHERE id = ?", [postId], (err, post) => {
    if (!post) return res.status(404).json({ success: false, message: "Postingan tidak ditemukan." });

    if (post.user_id !== req.session.user.id && req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki hak menghapus postingan ini!" });
    }

    if (post.image && fs.existsSync(path.join(__dirname, 'public', post.image))) {
      fs.unlinkSync(path.join(__dirname, 'public', post.image));
    }

    db.run("DELETE FROM posts WHERE id = ?", [postId], function(err) {
      if (err) return res.status(500).json({ success: false, message: "Gagal menghapus postingan." });
      db.run("DELETE FROM reports WHERE post_id = ?", [postId]);
      db.run("DELETE FROM likes WHERE post_id = ?", [postId]);
      res.json({ success: true, message: "Postingan berhasil dihapus!" });
    });
  });
});

// --- API REPORTING ---

app.post('/api/reports', (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: "Silakan login terlebih dahulu untuk melaporkan!" });

  const { post_id, reason, details } = req.body;
  const reporter_id = req.session.user.id;
  const reporter_name = req.session.user.name;

  if (!post_id || !reason) {
    return res.status(400).json({ success: false, message: "Pilih alasan pelaporan!" });
  }

  db.get("SELECT id FROM reports WHERE post_id = ? AND reporter_id = ?", [post_id, reporter_id], (err, row) => {
    if (row) {
      return res.status(400).json({ success: false, message: "Anda sudah pernah melaporkan postingan ini!" });
    }

    db.run("INSERT INTO reports (post_id, reporter_id, reporter_name, reason, details) VALUES (?, ?, ?, ?, ?)",
      [post_id, reporter_id, reporter_name, reason, details || ''],
      function(err) {
        if (err) return res.status(500).json({ success: false, message: "Gagal mengirimkan laporan." });
        res.json({ success: true, message: "Laporan berhasil dikirimkan ke Admin untuk ditinjau." });
      }
    );
  });
});

// --- API ADMIN ---

app.get('/api/admin/requests', requireAdmin, (req, res) => {
  db.all("SELECT id, name, username, kelas, role, role_request FROM users WHERE role_request = 'requested_guru'", [], (err, rows) => {
    res.json({ success: true, requests: rows });
  });
});

app.get('/api/admin/reports', requireAdmin, (req, res) => {
  const query = `
    SELECT r.id as report_id, r.reason, r.details, r.reporter_name, r.created_at as reported_at,
           p.id as post_id, p.title, p.content, p.image, p.author_name, p.author_kelas
    FROM reports r
    JOIN posts p ON r.post_id = p.id
    WHERE r.status = 'pending'
    ORDER BY r.id DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: "Gagal mengambil daftar laporan." });
    res.json({ success: true, reports: rows });
  });
});

app.post('/api/admin/reports/resolve', requireAdmin, (req, res) => {
  const { report_id, action } = req.body;

  db.get("SELECT post_id FROM reports WHERE id = ?", [report_id], (err, report) => {
    if (!report) return res.status(404).json({ success: false, message: "Laporan tidak ditemukan." });

    if (action === 'delete_post') {
      const postId = report.post_id;
      db.get("SELECT image FROM posts WHERE id = ?", [postId], (err, post) => {
        if (post && post.image && fs.existsSync(path.join(__dirname, 'public', post.image))) {
          fs.unlinkSync(path.join(__dirname, 'public', post.image));
        }
        db.run("DELETE FROM posts WHERE id = ?", [postId], () => {
          db.run("DELETE FROM reports WHERE post_id = ?", [postId]);
          db.run("DELETE FROM likes WHERE post_id = ?", [postId]);
          res.json({ success: true, message: "Postingan bermasalah berhasil dihapus dan laporan ditutup!" });
        });
      });
    } else {
      db.run("UPDATE reports SET status = 'dismissed' WHERE id = ?", [report_id], (err) => {
        res.json({ success: true, message: "Laporan diabaikan/ditutup." });
      });
    }
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
