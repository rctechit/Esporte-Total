function mostrarErro(mensagem) {
  const alertBox = qs("#login-alert");
  alertBox.innerHTML = "";
  const div = document.createElement("div");
  div.className = "alert alert--error";
  div.textContent = mensagem;
  alertBox.appendChild(div);
}

async function verificarSessaoExistente() {
  try {
    await api.get("/auth/me");
    window.location.href = "dashboard.html";
  } catch {
    // não autenticado, permanece na página de login
  }
}

qs("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = qs("#email").value.trim();
  const password = qs("#password").value;
  const submitBtn = event.target.querySelector("button[type=submit]");

  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando...";

  try {
    await api.post("/auth/login", { email, password });
    window.location.href = "dashboard.html";
  } catch (error) {
    mostrarErro(error.message || "Não foi possível entrar.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  }
});

verificarSessaoExistente();
