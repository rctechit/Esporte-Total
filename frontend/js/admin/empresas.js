function mostrarAlerta(mensagem, tipo = "error") {
  const box = qs("#empresas-alert");
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = `alert alert--${tipo}`;
  div.textContent = mensagem;
  box.appendChild(div);
}

async function carregarEmpresas() {
  const tbody = qs("#empresas-tbody");
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

  try {
    const empresas = await api.get("/empresas");

    if (!empresas.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma empresa cadastrada ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    for (const empresa of empresas) {
      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = empresa.nome;

      const tdContato = document.createElement("td");
      tdContato.textContent = [empresa.email, empresa.telefone].filter(Boolean).join(" · ") || "—";

      const tdUnidades = document.createElement("td");
      tdUnidades.textContent = empresa._count.unidades;

      const tdUsuarios = document.createElement("td");
      tdUsuarios.textContent = empresa._count.usuarios;

      const tdStatus = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${empresa.ativa ? "" : "badge--inativo"}`;
      badge.textContent = empresa.ativa ? "Ativa" : "Inativa";
      tdStatus.appendChild(badge);

      tr.append(tdNome, tdContato, tdUnidades, tdUsuarios, tdStatus);
      tbody.appendChild(tr);
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5">Não foi possível carregar as empresas.</td></tr>';
    console.error(error);
  }
}

qs("#nova-empresa-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const dados = {
    nome: qs("#empresa-nome").value.trim(),
    email: qs("#empresa-email").value.trim(),
    telefone: qs("#empresa-telefone").value.trim(),
    adminNome: qs("#admin-nome-input").value.trim(),
    adminEmail: qs("#admin-email-input").value.trim(),
    adminPassword: qs("#admin-password-input").value,
  };

  try {
    await api.post("/empresas", dados);
    mostrarAlerta(`Empresa "${dados.nome}" criada. Login: ${dados.adminEmail}`, "success");
    event.target.reset();
    carregarEmpresas();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível criar a empresa.");
  }
});

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;

  if (admin.role !== "super_admin") {
    window.location.href = "dashboard.html";
    return;
  }

  carregarEmpresas();
}

init();
