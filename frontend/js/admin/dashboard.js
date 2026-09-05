const PAGE_SIZE = 10;
let paginaAtual = 1;

function mostrarAlerta(mensagem, tipo = "error") {
  const box = qs("#dashboard-alert");
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = `alert alert--${tipo}`;
  div.textContent = mensagem;
  box.appendChild(div);
  setTimeout(() => box.replaceChildren(), 4000);
}

async function carregarModalidades() {
  const lista = qs("#modalidades-lista");
  const select = qs("#filtro-modalidade");

  try {
    const modalidades = await api.get("/modalidades");

    lista.innerHTML = "";
    select.innerHTML = '<option value="">Todas</option>';

    for (const modalidade of modalidades) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.gap = "6px";

      const texto = document.createElement("span");
      texto.textContent = `${modalidade.icone || ""} ${modalidade.nome}`.trim();

      const excluir = document.createElement("button");
      excluir.textContent = "×";
      excluir.title = "Excluir modalidade";
      excluir.style.border = "none";
      excluir.style.background = "transparent";
      excluir.style.cursor = "pointer";
      excluir.style.fontWeight = "700";
      excluir.addEventListener("click", () => excluirModalidade(modalidade));

      badge.append(texto, excluir);
      lista.appendChild(badge);

      const option = document.createElement("option");
      option.value = modalidade.slug;
      option.textContent = modalidade.nome;
      select.appendChild(option);
    }
  } catch (error) {
    mostrarAlerta("Não foi possível carregar as modalidades.");
    console.error(error);
  }
}

async function excluirModalidade(modalidade) {
  if (!confirm(`Excluir a modalidade "${modalidade.nome}"? Isso também removerá o vínculo com unidades.`)) {
    return;
  }
  try {
    await api.delete(`/modalidades/${modalidade.id}`);
    mostrarAlerta("Modalidade excluída.", "success");
    carregarModalidades();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível excluir a modalidade.");
  }
}

qs("#nova-modalidade-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = qs("#nova-modalidade-nome");
  const nome = input.value.trim();
  if (!nome) return;

  try {
    await api.post("/modalidades", { nome });
    input.value = "";
    mostrarAlerta("Modalidade criada.", "success");
    carregarModalidades();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível criar a modalidade.");
  }
});

function renderPaginacao(total, page, pageSize) {
  const wrap = qs("#paginacao");
  wrap.innerHTML = "";
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (totalPaginas <= 1) return;

  for (let i = 1; i <= totalPaginas; i += 1) {
    const btn = document.createElement("button");
    btn.className = `btn btn--sm ${i === page ? "btn--primary" : "btn--outline"}`;
    btn.textContent = String(i);
    btn.addEventListener("click", () => {
      paginaAtual = i;
      carregarUnidades();
    });
    wrap.appendChild(btn);
  }
}

async function carregarUnidades() {
  const tbody = qs("#unidades-tbody");
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

  const params = new URLSearchParams();
  const busca = qs("#filtro-busca").value.trim();
  const modalidade = qs("#filtro-modalidade").value;
  if (busca) params.set("busca", busca);
  if (modalidade) params.set("modalidade", modalidade);
  params.set("page", String(paginaAtual));
  params.set("pageSize", String(PAGE_SIZE));

  try {
    const resultado = await api.get(`/unidades/admin/todas?${params.toString()}`);

    if (!resultado.unidades.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma unidade encontrada.</td></tr>';
      qs("#paginacao").innerHTML = "";
      return;
    }

    tbody.innerHTML = "";
    for (const unidade of resultado.unidades) {
      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = unidade.nome;

      const tdLocal = document.createElement("td");
      tdLocal.textContent = `${unidade.cidade}/${unidade.estado}`;

      const tdModalidades = document.createElement("td");
      tdModalidades.textContent = (unidade.modalidades || [])
        .map((rel) => rel.modalidade.nome)
        .join(", ");

      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `badge ${unidade.ativo ? "" : "badge--inativo"}`;
      statusBadge.textContent = unidade.ativo ? "Ativa" : "Inativa";
      tdStatus.appendChild(statusBadge);

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "table-actions";

      const editarLink = document.createElement("a");
      editarLink.className = "btn btn--outline btn--sm";
      editarLink.href = `unidade-form.html?id=${unidade.id}`;
      editarLink.textContent = "Editar";

      const excluirBtn = document.createElement("button");
      excluirBtn.className = "btn btn--danger btn--sm";
      excluirBtn.textContent = "Excluir";
      excluirBtn.addEventListener("click", () => excluirUnidade(unidade));

      tdAcoes.append(editarLink, excluirBtn);
      tr.append(tdNome, tdLocal, tdModalidades, tdStatus, tdAcoes);
      tbody.appendChild(tr);
    }

    renderPaginacao(resultado.total, resultado.page, resultado.pageSize);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5">Não foi possível carregar as unidades.</td></tr>';
    console.error(error);
  }
}

async function excluirUnidade(unidade) {
  if (!confirm(`Excluir a unidade "${unidade.nome}"? Essa ação não pode ser desfeita.`)) {
    return;
  }
  try {
    await api.delete(`/unidades/${unidade.id}`);
    mostrarAlerta("Unidade excluída.", "success");
    carregarUnidades();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível excluir a unidade.");
  }
}

qs("#filtros-form").addEventListener("submit", (event) => {
  event.preventDefault();
  paginaAtual = 1;
  carregarUnidades();
});

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;

  qs("#admin-nome").textContent = admin.nome;
  await carregarModalidades();
  await carregarUnidades();
}

init();
