document.addEventListener("DOMContentLoaded", () => {
  loadGuruRequests();
});

async function loadGuruRequests() {
  try {
    const res = await fetch("/api/admin/requests");
    const data = await res.json();

    if (!data.success) {
      alert("Akses ditolak! Halaman ini hanya untuk Admin.");
      window.location.href = "/";
      return;
    }

    const tbody = document.getElementById("request-list");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (data.requests.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: #64748b; padding: 1.5rem;">
            Tidak ada pengajuan role Guru saat ini.
          </td>
        </tr>`;
      return;
    }

    data.requests.forEach((req) => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${escapeHtml(req.name)}</strong></td>
          <td>${escapeHtml(req.username)}</td>
          <td>
            <button class="btn-approve" onclick="handleApprove(${req.id}, 'approve')">Setujui</button>
            <button class="btn-reject" onclick="handleApprove(${req.id}, 'reject')">Tolak</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Gagal mengambil data pengajuan:", err);
  }
}

async function handleApprove(userId, action) {
  const confirmText = action === 'approve' 
    ? "Setujui pengguna ini menjadi Guru/Ustadz?" 
    : "Tolak pengajuan role Guru ini?";

  if (!confirm(confirmText)) return;

  try {
    const res = await fetch("/api/admin/approve-guru", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action })
    });

    const data = await res.json();
    alert(data.message);
    
    loadGuruRequests();
  } catch (err) {
    alert("Terjadi kesalahan saat memproses permintaan.");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
