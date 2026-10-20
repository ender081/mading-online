let currentUser = null;
let allPosts = [];

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  loadPosts();
  setupEventListeners();
});

async function checkSession() {
  try {
    const response = await fetch("/api/user/session");
    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        currentUser = data.user;
        updateUIForLoggedInUser();
      } else {
        updateUIForGuest();
      }
    } else {
      updateUIForGuest();
    }
  } catch (err) {
    updateUIForGuest();
  }
}

function setupEventListeners() {
  document.getElementById("btn-show-login")?.addEventListener("click", () => showModal("modal-login"));
  document.getElementById("btn-show-register")?.addEventListener("click", () => showModal("modal-register"));
  document.getElementById("btn-create-post")?.addEventListener("click", () => showModal("modal-create-post"));
  
  document.getElementById("link-to-register")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideModal("modal-login");
    showModal("modal-register");
  });
  document.getElementById("link-to-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideModal("modal-register");
    showModal("modal-login");
  });

  document.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal-overlay");
      if (modal) modal.classList.add("hidden");
    });
  });

  document.getElementById("reg-tingkat")?.addEventListener("change", handleTingkatChange);

  document.getElementById("form-login")?.addEventListener("submit", handleLogin);
  document.getElementById("form-register")?.addEventListener("submit", handleRegister);
  document.getElementById("form-create-post")?.addEventListener("submit", handleCreatePost);
  document.getElementById("form-edit-post")?.addEventListener("submit", handleEditPost);
  document.getElementById("form-report-post")?.addEventListener("submit", handleSendReport);
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
}

function handleTingkatChange(e) {
  const tingkat = parseInt(e.target.value);
  const groupJurusan = document.getElementById("group-jurusan");
  const groupSubkelas = document.getElementById("group-subkelas");

  if (!tingkat) {
    groupJurusan?.classList.add("hidden");
    groupSubkelas?.classList.add("hidden");
    return;
  }

  groupSubkelas?.classList.remove("hidden");

  if (tingkat === 11 || tingkat === 12) {
    groupJurusan?.classList.remove("hidden");
  } else {
    groupJurusan?.classList.add("hidden");
  }
}

async function loadPosts() {
  const grid = document.getElementById("mading-grid");
  if (!grid) return;

  try {
    const res = await fetch("/api/posts");
    const data = await res.json();

    if (data.success) {
      allPosts = data.posts;
      renderPosts();
    } else {
      grid.innerHTML = `<p style="color: #64748b; grid-column: 1/-1; text-align: center;">Belum ada postingan mading.</p>`;
    }
  } catch (err) {
    console.error("Gagal memuat postingan:", err);
  }
}

function renderPosts() {
  const grid = document.getElementById("mading-grid");
  if (!grid) return;

  if (allPosts.length === 0) {
    grid.innerHTML = `<p style="color: #64748b; grid-column: 1/-1; text-align: center;">Belum ada postingan mading.</p>`;
    return;
  }

  grid.innerHTML = "";
  allPosts.forEach(post => {
    const canModify = currentUser && (currentUser.id === post.user_id || currentUser.role === 'admin');
    
    let actionButtons = "";
    if (canModify) {
      actionButtons = `
        <button onclick="openEditModal(${post.id})" class="btn btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Edit</button>
        <button onclick="deletePost(${post.id})" class="btn" style="background-color: #ef4444; color: white; padding: 0.2rem 0.5rem; font-size: 0.75rem; border:none; border-radius:4px; cursor:pointer;">Hapus</button>
      `;
    }

    let reportButton = "";
    if (currentUser && currentUser.id !== post.user_id) {
      reportButton = `<button onclick="openReportModal(${post.id})" class="btn" style="background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 0.2rem 0.5rem; font-size: 0.75rem;">Laporkan</button>`;
    }

    // Tombol Like
    const isLiked = post.is_liked > 0;
    const likeBtnStyle = isLiked 
      ? 'background-color: #2563eb; color: white; border: 1px solid #2563eb;' 
      : 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';

    const likeButton = `<button onclick="toggleLike(${post.id})" class="btn" style="padding: 0.2rem 0.6rem; font-size: 0.75rem; ${likeBtnStyle}">❤️ ${post.like_count || 0} Suka</button>`;

    let imageTag = "";
    if (post.image) {
      imageTag = `<img src="${post.image}" alt="Foto Mading" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 6px; margin-bottom: 0.75rem;">`;
    }

    grid.innerHTML += `
      <div class="post-card">
        <div>
          <div class="post-header">
            <span class="post-category">${escapeHtml(post.category)}</span>
          </div>
          <h3 class="post-title">${escapeHtml(post.title)}</h3>${imageTag}
          <p class="post-content">${escapeHtml(post.content)}</p>
        </div>
        <div>
          <div class="post-footer">
            <span>Oleh: ${escapeHtml(post.author_name)} (${escapeHtml(post.author_kelas)})</span>
            <span>${new Date(post.created_at).toLocaleDateString('id-ID')}</span>
          </div>
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
            <div>${likeButton}</div>
            <div style="display: flex; gap: 0.5rem;">
              ${reportButton}${actionButtons}
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

// --- LOGIKA TOGGLE LIKE ---
async function toggleLike(postId) {
  if (!currentUser) {
    alert("Silakan login terlebih dahulu untuk menyukai postingan!");
    showModal("modal-login");
    return;
  }

  try {
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      loadPosts(); // Reload mading untuk update hitungan & status
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert("Gagal memproses like.");
  }
}

// --- LOGIKA PELAPORAN POSTINGAN ---
function openReportModal(postId) {
  if (!currentUser) {
    alert("Silakan login terlebih dahulu untuk melaporkan postingan!");
    showModal("modal-login");
    return;
  }
  document.getElementById("report-post-id").value = postId;
  showModal("modal-report-post");
}

async function handleSendReport(e) {
  e.preventDefault();
  const post_id = document.getElementById("report-post-id").value;
  const reason = document.getElementById("report-reason").value;
  const details = document.getElementById("report-details").value;

  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id, reason, details })
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) {
      document.getElementById("form-report-post").reset();
      hideModal("modal-report-post");
    }
  } catch (err) {
    alert("Gagal mengirimkan laporan.");
  }
}

async function handleCreatePost(e) {
  e.preventDefault();
  const title = document.getElementById("post-title").value;
  const category = document.getElementById("post-category").value;
  const content = document.getElementById("post-content").value;
  const imageFile = document.getElementById("post-image").files[0];

  const formData = new FormData();
  formData.append("title", title);
  formData.append("category", category);
  formData.append("content", content);
  if (imageFile) formData.append("image", imageFile);

  try {
    const res = await fetch("/api/posts", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      alert("Postingan berhasil diterbitkan!");
      document.getElementById("form-create-post").reset();
      hideModal("modal-create-post");
      loadPosts();
    } else {
      alert(data.message || "Gagal membuat postingan.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

function openEditModal(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  document.getElementById("edit-post-id").value = post.id;
  document.getElementById("edit-post-title").value = post.title;
  document.getElementById("edit-post-category").value = post.category;
  document.getElementById("edit-post-content").value = post.content;
  
  showModal("modal-edit-post");
}

async function handleEditPost(e) {
  e.preventDefault();
  const postId = document.getElementById("edit-post-id").value;
  const title = document.getElementById("edit-post-title").value;
  const category = document.getElementById("edit-post-category").value;
  const content = document.getElementById("edit-post-content").value;
  const imageFile = document.getElementById("edit-post-image").files[0];

  const formData = new FormData();
  formData.append("title", title);
  formData.append("category", category);
  formData.append("content", content);
  if (imageFile) formData.append("image", imageFile);

  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "PUT",
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      document.getElementById("form-edit-post").reset();
      hideModal("modal-edit-post");
      loadPosts();
    } else {
      alert(data.message || "Gagal mengedit postingan.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

async function deletePost(postId) {
  if (!confirm("Apakah Anda yakin ingin menghapus postingan ini?")) return;

  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: "DELETE"
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadPosts();
    } else {
      alert(data.message || "Gagal menghapus postingan.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name").value;
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;
  
  const tingkat = parseInt(document.getElementById("reg-tingkat").value);
  const subkelas = document.getElementById("reg-subkelas").value;
  const jurusan = document.getElementById("reg-jurusan").value;

  if (!tingkat) {
    alert("Silakan pilih tingkat kelas Anda!");
    return;
  }

  let kelasString = "";
  if (tingkat >= 11) {
    kelasString = `Kelas ${tingkat} ${jurusan}${subkelas}`;
  } else {
    kelasString = `Kelas ${tingkat}${subkelas}`;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password, kelas: kelasString })
    });

    const data = await res.json();
    if (data.success) {
      alert(data.message);
      hideModal("modal-register");
      showModal("modal-login");
    } else {
      alert(data.message || "Registrasi gagal.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      hideModal("modal-login");
      updateUIForLoggedInUser();
      loadPosts();
      alert("Login berhasil!");
    } else {
      alert(data.message || "Login gagal.");
    }
  } catch (err) {
    alert("Terjadi kesalahan jaringan.");
  }
}

async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  updateUIForGuest();
  loadPosts();
  alert("Anda telah logout.");
}

async function handleRequestGuru() {
  if (!confirm("Ajukan permintaan status Guru/Ustadz ke Admin?")) return;

  try {
    const res = await fetch("/api/user/request-guru", { method: "POST" });
    const data = await res.json();
    alert(data.message);
    if (data.success) {
      currentUser.role_request = 'requested_guru';
      renderRoleRequestStatus();
    }
  } catch (err) {
    alert("Gagal mengirim permintaan.");
  }
}

function updateUIForLoggedInUser() {
  document.getElementById("guest-nav")?.classList.add("hidden");
  document.getElementById("user-nav")?.classList.remove("hidden");
  document.getElementById("btn-create-post")?.classList.remove("hidden");

  document.getElementById("user-name-display").textContent = `${currentUser.name} (${currentUser.kelas})`;
  
  const roleBadge = document.getElementById("user-role-badge");
  if (roleBadge) {
    roleBadge.textContent = currentUser.role.toUpperCase();
    roleBadge.className = `badge badge-${currentUser.role}`;
  }

  if (currentUser.role === "admin") {
    document.getElementById("btn-admin-panel")?.classList.remove("hidden");
  } else {
    document.getElementById("btn-admin-panel")?.classList.add("hidden");
  }

  renderRoleRequestStatus();
}

function updateUIForGuest() {
  document.getElementById("guest-nav")?.classList.remove("hidden");
  document.getElementById("user-nav")?.classList.add("hidden");
  document.getElementById("btn-create-post")?.classList.add("hidden");
  document.getElementById("status-box-container")?.classList.add("hidden");
}

function renderRoleRequestStatus() {
  const container = document.getElementById("status-box-container");
  if (!container) return;

  if (currentUser.role === "siswa") {
    container.classList.remove("hidden");
    if (currentUser.role_request === "requested_guru") {
      container.innerHTML = `
        <div classv
