const params = new URLSearchParams(window.location.search);
const unidadeId = params.get("id");
let unidadeAtual = null;

function mostrarAlerta(mensagem, tipo = "error") {
  const box = qs("#form-alert");
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = `alert alert--${tipo}`;
  div.textContent = mensagem;
  box.appendChild(div);
}

function limparAlerta() {
  qs("#form-alert").innerHTML = "";
}

async function carregarCheckboxesModalidades(idsSelecionados = []) {
  const wrap = qs("#modalidades-checkboxes");
  wrap.innerHTML = "";
  const modalidades = await api.get("/modalidades");

  for (const modalidade of modalidades) {
    const label = document.createElement("label");
    label.className = "checkbox-pill";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = modalidade.id;
    input.checked = idsSelecionados.includes(modalidade.id);

    label.append(input, document.createTextNode(` ${modalidade.icone || ""} ${modalidade.nome}`.trim()));
    wrap.appendChild(label);
  }
}

function getModalidadeIdsSelecionados() {
  return qsa("#modalidades-checkboxes input:checked").map((el) => el.value);
}

function preencherFormulario(unidade) {
  qs("#nome").value = unidade.nome || "";
  qs("#descricao").value = unidade.descricao || "";
  qs("#horarioFuncionamento").value = unidade.horarioFuncionamento || "";
  qs("#ativo").checked = unidade.ativo !== false;
  qs("#endereco").value = unidade.endereco || "";
  qs("#numero").value = unidade.numero || "";
  qs("#complemento").value = unidade.complemento || "";
  qs("#bairro").value = unidade.bairro || "";
  qs("#cidade").value = unidade.cidade || "";
  qs("#estado").value = unidade.estado || "";
  qs("#cep").value = unidade.cep || "";
  qs("#telefone").value = unidade.telefone || "";
  qs("#whatsapp").value = unidade.whatsapp || "";
  qs("#email").value = unidade.email || "";
  qs("#site").value = unidade.site || "";
}

function coletarDadosFormulario() {
  return {
    nome: qs("#nome").value.trim(),
    descricao: qs("#descricao").value.trim(),
    horarioFuncionamento: qs("#horarioFuncionamento").value.trim(),
    ativo: qs("#ativo").checked,
    endereco: qs("#endereco").value.trim(),
    numero: qs("#numero").value.trim(),
    complemento: qs("#complemento").value.trim(),
    bairro: qs("#bairro").value.trim(),
    cidade: qs("#cidade").value.trim(),
    estado: qs("#estado").value.trim().toUpperCase(),
    cep: qs("#cep").value.trim(),
    telefone: qs("#telefone").value.trim(),
    whatsapp: qs("#whatsapp").value.trim(),
    email: qs("#email").value.trim(),
    site: qs("#site").value.trim(),
    modalidadeIds: getModalidadeIdsSelecionados(),
  };
}

function renderFotos(fotos = []) {
  const lista = qs("#foto-list");
  lista.innerHTML = "";
  for (const foto of fotos) {
    const item = document.createElement("div");
    item.className = "foto-item";

    const img = document.createElement("img");
    img.src = foto.url;
    img.alt = "Foto da unidade";

    const removerBtn = document.createElement("button");
    removerBtn.type = "button";
    removerBtn.textContent = "×";
    removerBtn.title = "Remover foto";
    removerBtn.addEventListener("click", () => removerFoto(foto.id));

    item.append(img, removerBtn);
    lista.appendChild(item);
  }
}

async function removerFoto(fotoId) {
  if (!confirm("Remover esta foto?")) return;
  try {
    await api.delete(`/unidades/${unidadeAtual.id}/fotos/${fotoId}`);
    unidadeAtual.fotos = unidadeAtual.fotos.filter((f) => f.id !== fotoId);
    renderFotos(unidadeAtual.fotos);
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível remover a foto.");
  }
}

qs("#adicionar-foto-btn").addEventListener("click", async () => {
  const input = qs("#nova-foto-url");
  const url = input.value.trim();
  if (!url) return;

  try {
    const foto = await api.post(`/unidades/${unidadeAtual.id}/fotos`, { url });
    unidadeAtual.fotos = [...(unidadeAtual.fotos || []), foto];
    renderFotos(unidadeAtual.fotos);
    input.value = "";
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível adicionar a foto.");
  }
});

async function configurarSecaoFotos() {
  if (!unidadeAtual) return;
  qs("#fotos-card").hidden = false;
  renderFotos(unidadeAtual.fotos || []);

  try {
    const status = await api.get("/uploads/status");
    qs("#fotos-cloudinary-status").textContent = status.cloudinaryEnabled
      ? "Cole o link da imagem (upload direto via Cloudinary em breve)."
      : "Upload de imagens ainda não configurado — cole o link (URL) de uma imagem já publicada.";
  } catch {
    qs("#fotos-cloudinary-status").textContent = "Cole o link (URL) de uma imagem já publicada.";
  }
}

qs("#unidade-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  limparAlerta();

  const dados = coletarDadosFormulario();

  if (!dados.modalidadeIds.length) {
    mostrarAlerta("Selecione ao menos uma modalidade.");
    return;
  }

  const submitBtn = qs("#submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvando...";

  try {
    if (unidadeAtual) {
      unidadeAtual = await api.put(`/unidades/${unidadeAtual.id}`, dados);
      mostrarAlerta("Unidade atualizada com sucesso.", "success");
      configurarSecaoFotos();
    } else {
      unidadeAtual = await api.post("/unidades", dados);
      mostrarAlerta("Unidade criada com sucesso. Agora você já pode adicionar fotos.", "success");
      window.history.replaceState({}, "", `unidade-form.html?id=${unidadeAtual.id}`);
      qs("#form-title").textContent = "Editar unidade";
      qs("#page-title").textContent = "Editar unidade — Esporte Total";
      configurarSecaoFotos();
    }
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível salvar a unidade.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Salvar unidade";
  }
});

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;

  if (unidadeId) {
    qs("#form-title").textContent = "Editar unidade";
    qs("#page-title").textContent = "Editar unidade — Esporte Total";
    try {
      unidadeAtual = await api.get(`/unidades/admin/${unidadeId}`);
      preencherFormulario(unidadeAtual);
      await carregarCheckboxesModalidades(
        (unidadeAtual.modalidades || []).map((rel) => rel.modalidadeId)
      );
      configurarSecaoFotos();
    } catch (error) {
      mostrarAlerta("Unidade não encontrada.");
    }
  } else {
    await carregarCheckboxesModalidades();
  }
}

init();
