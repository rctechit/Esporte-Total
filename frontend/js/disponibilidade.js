const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");
const modalidadeId = params.get("modalidadeId");

let unidade = null;
let modalidadeInfo = null;
let diaSelecionado = null;
let horariosSelecionados = new Set();
let precoHoraAtual = null;

function proximosDias(quantidade = 14) {
  const dias = [];
  const hoje = new Date();
  for (let i = 0; i < quantidade; i += 1) {
    const dia = new Date(hoje);
    dia.setDate(hoje.getDate() + i);
    dias.push(dia);
  }
  return dias;
}

function formatarDataISO(date) {
  return date.toISOString().slice(0, 10);
}

function renderEstrutura() {
  const conteudo = qs("#conteudo");
  conteudo.innerHTML = "";

  const header = document.createElement("div");
  header.className = "detalhe-header";
  const titulo = document.createElement("h1");
  titulo.textContent = `Agendar em ${unidade.nome}`;
  const subtitulo = document.createElement("p");
  subtitulo.className = "unidade-card__local";
  subtitulo.textContent = `${modalidadeInfo.nome} · ${formatEnderecoCompleto(unidade)}`;
  header.append(titulo, subtitulo);

  const voltar = document.createElement("a");
  voltar.href = `unidade.html?slug=${encodeURIComponent(unidade.slug)}`;
  voltar.textContent = "← Voltar para a unidade";
  voltar.style.display = "inline-block";
  voltar.style.marginBottom = "16px";

  const diasStrip = document.createElement("div");
  diasStrip.className = "dias-strip";
  diasStrip.id = "dias-strip";

  for (const dia of proximosDias()) {
    const iso = formatarDataISO(dia);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dia-btn";
    btn.dataset.data = iso;

    const semana = document.createElement("span");
    semana.className = "dia-btn__semana";
    semana.textContent = dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

    const numero = document.createElement("span");
    numero.className = "dia-btn__numero";
    numero.textContent = dia.getDate();

    btn.append(semana, numero);
    btn.addEventListener("click", () => selecionarDia(iso));
    diasStrip.appendChild(btn);
  }

  const grid = document.createElement("div");
  grid.className = "detalhe-grid";

  const principal = document.createElement("div");
  principal.className = "info-card";
  const slotsTitulo = document.createElement("h2");
  slotsTitulo.textContent = "Horários disponíveis";
  const slotsGrid = document.createElement("div");
  slotsGrid.className = "slots-grid";
  slotsGrid.id = "slots-grid";
  principal.append(slotsTitulo, slotsGrid);

  const lateral = document.createElement("div");
  lateral.className = "info-card";
  lateral.id = "reserva-lateral";

  grid.append(principal, lateral);

  conteudo.append(voltar, header, diasStrip, grid);

  renderResumoInicial();
}

function renderResumoInicial() {
  const lateral = qs("#reserva-lateral");
  lateral.innerHTML = "";
  const titulo = document.createElement("h2");
  titulo.textContent = "Sua reserva";
  const texto = document.createElement("p");
  texto.className = "unidade-card__local";
  texto.textContent = "Selecione um ou mais horários na grade para continuar.";
  lateral.append(titulo, texto);
}

function renderResumoComForm() {
  const lateral = qs("#reserva-lateral");
  lateral.innerHTML = "";

  const titulo = document.createElement("h2");
  titulo.textContent = "Sua reserva";
  lateral.appendChild(titulo);

  const horariosOrdenados = Array.from(horariosSelecionados).sort();
  for (const horario of horariosOrdenados) {
    const linha = document.createElement("div");
    linha.className = "reserva-resumo-item";
    const label = document.createElement("span");
    label.textContent = `${horario} - ${String(Number.parseInt(horario, 10) + 1).padStart(2, "0")}:00`;
    const valor = document.createElement("span");
    valor.textContent = precoHoraAtual
      ? precoHoraAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "";
    linha.append(label, valor);
    lateral.appendChild(linha);
  }

  if (precoHoraAtual) {
    const total = precoHoraAtual * horariosOrdenados.length;
    const linhaTotal = document.createElement("div");
    linhaTotal.className = "reserva-resumo-item";
    linhaTotal.style.fontWeight = "700";
    linhaTotal.style.borderTop = "1px solid var(--color-border)";
    linhaTotal.style.marginTop = "8px";
    linhaTotal.style.paddingTop = "10px";
    const label = document.createElement("span");
    label.textContent = "Total (sinal de 30% combinado depois)";
    const valor = document.createElement("span");
    valor.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    linhaTotal.append(label, valor);
    lateral.appendChild(linhaTotal);
  }

  const form = document.createElement("form");
  form.className = "form-stack";
  form.style.marginTop = "16px";

  const campoNome = document.createElement("div");
  campoNome.className = "form-field";
  const labelNome = document.createElement("label");
  labelNome.textContent = "Seu nome";
  labelNome.htmlFor = "reserva-nome";
  const inputNome = document.createElement("input");
  inputNome.type = "text";
  inputNome.id = "reserva-nome";
  inputNome.required = true;
  inputNome.maxLength = 120;
  campoNome.append(labelNome, inputNome);

  const campoTelefone = document.createElement("div");
  campoTelefone.className = "form-field";
  const labelTelefone = document.createElement("label");
  labelTelefone.textContent = "Telefone / WhatsApp";
  labelTelefone.htmlFor = "reserva-telefone";
  const inputTelefone = document.createElement("input");
  inputTelefone.type = "text";
  inputTelefone.id = "reserva-telefone";
  inputTelefone.placeholder = "(11) 99999-0000";
  inputTelefone.required = true;
  campoTelefone.append(labelTelefone, inputTelefone);

  const submitBtn = document.createElement("button");
  submitBtn.type = "submit";
  submitBtn.className = "btn btn--primary btn--block";
  submitBtn.textContent = "Solicitar reserva";

  form.append(campoNome, campoTelefone, submitBtn);
  form.addEventListener("submit", enviarSolicitacao);

  lateral.appendChild(form);
}

function atualizarSelecaoVisual() {
  qsa(".slot-btn").forEach((btn) => {
    btn.classList.toggle("is-selected", horariosSelecionados.has(btn.dataset.horario));
  });

  if (horariosSelecionados.size > 0) {
    renderResumoComForm();
  } else {
    renderResumoInicial();
  }
}

function toggleHorario(horario) {
  if (horariosSelecionados.has(horario)) {
    horariosSelecionados.delete(horario);
  } else {
    horariosSelecionados.add(horario);
  }
  atualizarSelecaoVisual();
}

async function carregarDisponibilidade(data, { atualizarLateral = true } = {}) {
  const slotsGrid = qs("#slots-grid");
  slotsGrid.innerHTML = '<p class="state-message">Carregando horários...</p>';
  if (atualizarLateral) {
    horariosSelecionados = new Set();
  }

  try {
    const resultado = await api.get(
      `/unidades/${encodeURIComponent(slug)}/disponibilidade?data=${data}&modalidadeId=${encodeURIComponent(modalidadeId)}`
    );
    precoHoraAtual = resultado.precoHora;

    slotsGrid.innerHTML = "";
    if (!resultado.horarios.length) {
      slotsGrid.innerHTML = '<p class="state-message">Sem horários configurados para esta unidade.</p>';
      return;
    }

    for (const item of resultado.horarios) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `slot-btn ${item.disponivel ? "" : "is-indisponivel"}`;
      btn.textContent = item.horario;
      btn.dataset.horario = item.horario;
      btn.disabled = !item.disponivel;
      if (item.disponivel) {
        btn.addEventListener("click", () => toggleHorario(item.horario));
      }
      slotsGrid.appendChild(btn);
    }

    if (atualizarLateral) {
      atualizarSelecaoVisual();
    } else {
      qsa(".slot-btn").forEach((btn) => {
        btn.classList.toggle("is-selected", horariosSelecionados.has(btn.dataset.horario));
      });
    }
  } catch (error) {
    slotsGrid.innerHTML = '<p class="state-message">Não foi possível carregar os horários.</p>';
    console.error(error);
  }
}

function selecionarDia(iso) {
  diaSelecionado = iso;
  qsa(".dia-btn").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.data === iso);
  });
  carregarDisponibilidade(iso);
}

async function enviarSolicitacao(event) {
  event.preventDefault();

  const nome = qs("#reserva-nome").value.trim();
  const telefone = qs("#reserva-telefone").value.trim();
  const submitBtn = event.target.querySelector("button[type=submit]");

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try {
    await api.post(`/unidades/${unidade.id}/reservas`, {
      modalidadeId,
      data: diaSelecionado,
      horarios: Array.from(horariosSelecionados),
      nomeSolicitante: nome,
      telefoneSolicitante: telefone,
    });

    const lateral = qs("#reserva-lateral");
    lateral.innerHTML = "";
    const titulo = document.createElement("h2");
    titulo.textContent = "Solicitação enviada!";
    const texto = document.createElement("p");
    texto.textContent =
      "Recebemos seu pedido de reserva. Em breve entraremos em contato pelo telefone informado para combinar o pagamento e confirmar o horário.";
    lateral.append(titulo, texto);

    horariosSelecionados = new Set();
    carregarDisponibilidade(diaSelecionado, { atualizarLateral: false });
  } catch (error) {
    alert(error.message || "Não foi possível enviar sua solicitação. Tente novamente.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Solicitar reserva";
  }
}

async function init() {
  qs("#ano-atual") && (qs("#ano-atual").textContent = new Date().getFullYear());

  if (!slug || !modalidadeId) {
    qs("#conteudo").innerHTML = '<p class="state-message">Unidade ou modalidade não especificada.</p>';
    return;
  }

  try {
    unidade = await api.get(`/unidades/${encodeURIComponent(slug)}`);
    modalidadeInfo = (unidade.modalidades || [])
      .map((rel) => rel.modalidade)
      .find((m) => m.id === modalidadeId);

    if (!modalidadeInfo) {
      qs("#conteudo").innerHTML = '<p class="state-message">Esta unidade não oferece a modalidade informada.</p>';
      return;
    }

    qs("#page-title").textContent = `Agendar em ${unidade.nome} — Esporte Total`;
    renderEstrutura();

    const hojeISO = formatarDataISO(new Date());
    selecionarDia(hojeISO);
  } catch (error) {
    qs("#conteudo").innerHTML = '<p class="state-message">Unidade não encontrada.</p>';
    console.error(error);
  }
}

init();
