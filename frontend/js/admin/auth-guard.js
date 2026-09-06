let currentAdmin = null;

async function requireAdmin() {
  try {
    currentAdmin = await api.get("/auth/me");
    aplicarVisibilidadePorPapel();
    return currentAdmin;
  } catch (error) {
    window.location.href = "login.html";
    return null;
  }
}

async function logoutAdmin() {
  try {
    await api.post("/auth/logout");
  } finally {
    window.location.href = "login.html";
  }
}

function aplicarVisibilidadePorPapel() {
  const isSuperAdmin = currentAdmin?.role === "super_admin";
  qsa("[data-super-admin-only]").forEach((el) => {
    el.hidden = !isSuperAdmin;
  });
}

function setupAdminTopbar() {
  const logoutBtn = qs("[data-logout]");
  logoutBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    logoutAdmin();
  });
}

document.addEventListener("DOMContentLoaded", setupAdminTopbar);
