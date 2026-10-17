// --- STATE LOKAL APLIKASI ---
let currentUser = null;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  setupEventListeners();
});

// --- CEK SESI LOGIN DARI BACKEND ---
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

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  document.getElementById("btn-show-login")?.addEventListener("click", () => showModal("modal-login"));
  document.getElementById("btn-show-register")?.addEventListener("click", () => showModal("modal-register"));
  
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

  document.getElementById("form-login")?.addEventListener("submit", handleLogin);
  document.getElementById("form-register")?.addEventListener("submit", handleRegister);
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
}

// --- PEMROSESAN AUTHENTICATION ---

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
      alert("Login berhasil!");
    } else {
      alert(data.message || "Login gagal.");
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

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password })
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

async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  updateUIForGuest();
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

// --- UPDATE TAMPILAN INTERFACE (UI) ---

function updateUIForLoggedInUser() {
  document.getElementById("guest-nav")?.classList.add("hidden");
  document.getElementById("user-nav")?.classList.remove("hidden");

  document.getElementById("user-name-display").textContent = currentUser.name;
  
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
  document.getElementById("status-box-container")?.classList.add("hidden");
}

function renderRoleRequestStatus() {
  const container = document.getElementById("status-box-container");
  if (!container) return;

  if (currentUser.role === "siswa") {
    container.classList.remove("hidden");
    if (currentUser.role_request === "requested_guru") {
      container.innerHTML = `
        <div class="status-box">
          <span> Permintaan Anda menjadi <strong>Guru/Ustadz</strong> sedang menunggu persetujuan Admin.</span>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="status-box">
          <span>Anda terdaftar sebagai <strong>Santri/Siswa</strong>. Apakah Anda seorang Ustadz/Guru?</span>
          <button id="btn-request-guru-btn" class="btn btn-warning">Minta Akses Guru</button>
        </div>`;
      document.getElementById("btn-request-guru-btn")?.addEventListener("click", handleRequestGuru);
    }
  } else {
    container.classList.add("hidden");
  }
}

function showModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function hideModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}
