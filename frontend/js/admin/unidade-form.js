const params = new URLSearchParams(window.location.search);
const unidadeId = params.get("id");
let unidadeAtual = null;
let cloudinaryEnabled = false;
let fotosPendentes = []; // fotos já enviadas ao Cloudinary aguardando a unidade ser criada

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

function renderFotos() {
  const lista = qs("#foto-list");
  lista.innerHTML = "";

  for (const foto of unidadeAtual?.fotos || []) {
    const item = document.createElement("div");
    item.className = "foto-item";

    const img = document.createElement("img");
    img.src = foto.url;
    img.alt = "Foto da unidade";

    const removerBtn = document.createElement("button");
    removerBtn.type = "button";
    removerBtn.textContent = "×";
    removerBtn.title = "Remover foto";
    removerBtn.addEventListener("click", () => removerFotoSalva(foto.id));

    item.append(img, removerBtn);
    lista.appendChild(item);
  }

  fotosPendentes.forEach((foto, index) => {
    const item = document.createElement("div");
    item.className = "foto-item";
    item.style.opacity = "0.85";

    const img = document.createElement("img");
    img.src = foto.url;
    img.alt = "Foto pendente (será salva junto com a unidade)";

    const removerBtn = document.createElement("button");
    removerBtn.type = "button";
    removerBtn.textContent = "×";
    removerBtn.title = "Remover foto pendente";
    removerBtn.addEventListener("click", () => {
      fotosPendentes.splice(index, 1);
      renderFotos();
    });

    item.append(img, removerBtn);
    lista.appendChild(item);
  });
}

async function removerFotoSalva(fotoId) {
  if (!confirm("Remover esta foto?")) return;
  try {
    await api.delete(`/unidades/${unidadeAtual.id}/fotos/${fotoId}`);
    unidadeAtual.fotos = unidadeAtual.fotos.filter((f) => f.id !== fotoId);
    renderFotos();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível remover a foto.");
  }
}

async function adicionarFoto(url, publicId) {
  if (unidadeAtual?.id) {
    const foto = await api.post(`/unidades/${unidadeAtual.id}/fotos`, { url, publicId });
    unidadeAtual.fotos = [...(unidadeAtual.fotos || []), foto];
  } else {
    fotosPendentes.push({ url, publicId });
  }
  renderFotos();
}

qs("#adicionar-foto-btn").addEventListener("click", async () => {
  const input = qs("#nova-foto-url");
  const url = input.value.trim();
  if (!url) return;

  try {
    await adicionarFoto(url, undefined);
    input.value = "";
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível adicionar a foto.");
  }
});

async function enviarArquivoParaCloudinary(file, assinatura) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", assinatura.apiKey);
  formData.append("timestamp", String(assinatura.timestamp));
  formData.append("signature", assinatura.signature);
  formData.append("folder", assinatura.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${assinatura.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Falha ao enviar imagem para o Cloudinary.");
  }

  return response.json();
}

qs("#foto-arquivo").addEventListener("change", async (event) => {
  const arquivos = Array.from(event.target.files || []);
  if (!arquivos.length) return;

  const statusEl = qs("#upload-status");

  for (const file of arquivos) {
    statusEl.textContent = `Enviando ${file.name}...`;
    try {
      const assinatura = await api.post("/uploads/sign");
      const resultado = await enviarArquivoParaCloudinary(file, assinatura);
      await adicionarFoto(resultado.secure_url, resultado.public_id);
    } catch (error) {
      mostrarAlerta(error.message || `Não foi possível enviar ${file.name}.`);
    }
  }

  statusEl.textContent = "";
  event.target.value = "";
});

async function configurarSecaoFotos() {
  renderFotos();

  try {
    const status = await api.get("/uploads/status");
    cloudinaryEnabled = status.cloudinaryEnabled;
  } catch {
    cloudinaryEnabled = false;
  }

  qs("#upload-arquivo-wrap").hidden = !cloudinaryEnabled;
  qs("#fotos-cloudinary-status").textContent = cloudinaryEnabled
    ? "Selecione uma ou mais imagens do seu computador, ou cole o link de uma imagem já publicada."
    : "Upload direto não configurado — cole o link (URL) de uma imagem já publicada.";
}

async function enviarFotosPendentes() {
  if (!fotosPendentes.length) return;

  const pendentes = [...fotosPendentes];
  fotosPendentes = [];

  for (const foto of pendentes) {
    try {
      const salva = await api.post(`/unidades/${unidadeAtual.id}/fotos`, foto);
      unidadeAtual.fotos = [...(unidadeAtual.fotos || []), salva];
    } catch (error) {
      mostrarAlerta(error.message || "Não foi possível salvar uma das fotos.");
    }
  }

  renderFotos();
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
    } else {
      unidadeAtual = await api.post("/unidades", dados);
      await enviarFotosPendentes();
      mostrarAlerta("Unidade criada com sucesso.", "success");
      window.history.replaceState({}, "", `unidade-form.html?id=${unidadeAtual.id}`);
      qs("#form-title").textContent = "Editar unidade";
      qs("#page-title").textContent = "Editar unidade — Esporte Total";
    }
    renderFotos();
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

  await configurarSecaoFotos();

  if (unidadeId) {
    qs("#form-title").textContent = "Editar unidade";
    qs("#page-title").textContent = "Editar unidade — Esporte Total";
    try {
      unidadeAtual = await api.get(`/unidades/admin/${unidadeId}`);
      preencherFormulario(unidadeAtual);
      await carregarCheckboxesModalidades(
        (unidadeAtual.modalidades || []).map((rel) => rel.modalidadeId)
      );
      renderFotos();
    } catch (error) {
      mostrarAlerta("Unidade não encontrada.");
    }
  } else {
    await carregarCheckboxesModalidades();
  }
}

init();
