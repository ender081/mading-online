document.addEventListener("DOMContentLoaded", () => {
  loadGuruRequests();
  loadReports();
});

async function loadReports() {
  try {
    const res = await fetch("/api/admin/reports");
    const data = await res.json();

    const tbody = document.getElementById("report-list");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (!data.success || data.reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 1rem;">Tidak ada laporan pelanggaran aktif.</td></tr>`;
      return;
    }

    data.reports.forEach((rep) => {
      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${escapeHtml(rep.title)}</strong><br>
            <small style="color: #64748b;">Oleh: ${escapeHtml(rep.author_name)} (${escapeHtml(rep.author_kelas)})</small>
          </td>
          <td>${escapeHtml(rep.reporter_name)}</td>
          <td>
            <strong style="color: #dc2626;">${escapeHtml(rep.reason)}</strong><br>
            <small>${escapeHtml(rep.details || '-')}</small>
          </td>
          <td>
            <button class="btn-delete" onclick="handleResolveReport(${rep.report_id}, 'delete_post')">Hapus Post</button>
            <button class="btn-dismiss" onclick="handleResolveReport(${rep.report_id}, 'dismiss')">Abaikan</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Gagal memuat laporan:", err);
  }
}

async function handleResolveReport(reportId, action) {
  const confirmText = action === 'delete_post' 
    ? "Hapus postingan bermasalah ini secara permanen?" 
    : "Abaikan dan tutup laporan ini?";

  if (!confirm(confirmText)) return;

  try {
    const res = await fetch("/api/admin/reports/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report_id: reportId, action })
    });

    const data = await res.json();
    alert(data.message);
    loadReports();
  } catch (err) {
    alert("Terjadi kesalahan.");
  }
}

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
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 1rem;">Tidak ada pengajuan role Guru saat ini.</td></tr>`;
      return;
    }

    data.requests.forEach((req) => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${escapeHtml(req.name)}</strong></td>
          <td>${escapeHtml(req.username)} (${escapeHtml(req.kelas || '-')})</td>
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
    alert("Terjadi kesalahan.");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
