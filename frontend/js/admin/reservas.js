function mostrarAlerta(mensagem, tipo = "error") {
  const box = qs("#reservas-alert");
  box.innerHTML = "";
  const div = document.createElement("div");
  div.className = `alert alert--${tipo}`;
  div.textContent = mensagem;
  box.appendChild(div);
  setTimeout(() => box.replaceChildren(), 4000);
}

function formatarData(isoString) {
  const data = new Date(isoString);
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarValor(valor) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL = {
  pendente: "Aguardando aprovação",
  confirmada: "Locado",
  cancelada: "Cancelada",
};

const STATUS_BADGE_CLASS = {
  pendente: "badge--aguardando",
  confirmada: "badge--confirmada",
  cancelada: "badge--cancelada",
};

async function carregarReservas() {
  const tbody = qs("#reservas-tbody");
  tbody.innerHTML = '<tr><td colspan="10">Carregando...</td></tr>';

  const status = qs("#filtro-status").value;
  const params = status ? `?status=${encodeURIComponent(status)}` : "";

  try {
    const reservas = await api.get(`/reservas${params}`);

    if (!reservas.length) {
      tbody.innerHTML = '<tr><td colspan="10">Nenhuma reserva encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    for (const reserva of reservas) {
      const tr = document.createElement("tr");

      const tdUnidade = document.createElement("td");
      tdUnidade.textContent = reserva.unidade.nome;

      const tdQuadra = document.createElement("td");
      tdQuadra.textContent = reserva.quadra?.nome || "—";

      const tdModalidade = document.createElement("td");
      tdModalidade.textContent = reserva.modalidade.nome;

      const tdData = document.createElement("td");
      tdData.textContent = formatarData(reserva.data);

      const tdHorarios = document.createElement("td");
      tdHorarios.textContent = reserva.horarios.join(", ");

      const tdCliente = document.createElement("td");
      tdCliente.textContent = reserva.nomeSolicitante;

      const tdTelefone = document.createElement("td");
      tdTelefone.textContent = reserva.telefoneSolicitante;

      const tdValor = document.createElement("td");
      tdValor.textContent = formatarValor(reserva.valorTotal);

      const tdStatus = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `badge ${STATUS_BADGE_CLASS[reserva.status] || ""}`;
      badge.textContent = STATUS_LABEL[reserva.status] || reserva.status;
      tdStatus.appendChild(badge);

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "table-actions";

      if (reserva.status !== "confirmada") {
        const confirmarBtn = document.createElement("button");
        confirmarBtn.className = "btn btn--primary btn--sm";
        confirmarBtn.textContent = "Aprovar (Locar)";
        confirmarBtn.addEventListener("click", () => atualizarStatus(reserva.id, "confirmada"));
        tdAcoes.appendChild(confirmarBtn);
      }

      if (reserva.status !== "cancelada") {
        const cancelarBtn = document.createElement("button");
        cancelarBtn.className = "btn btn--danger btn--sm";
        cancelarBtn.textContent = "Recusar";
        cancelarBtn.addEventListener("click", () => atualizarStatus(reserva.id, "cancelada"));
        tdAcoes.appendChild(cancelarBtn);
      }

      const whatsappBtn = document.createElement("a");
      whatsappBtn.className = "btn btn--outline btn--sm";
      whatsappBtn.textContent = "WhatsApp";
      whatsappBtn.target = "_blank";
      whatsappBtn.rel = "noopener noreferrer";
      whatsappBtn.href = whatsappLink(
        reserva.telefoneSolicitante,
        `Olá ${reserva.nomeSolicitante}! Sobre sua reserva em ${reserva.unidade.nome} (${formatarData(reserva.data)}, ${reserva.horarios.join(", ")}) — tudo certo?`
      );
      tdAcoes.appendChild(whatsappBtn);

      tr.append(tdUnidade, tdQuadra, tdModalidade, tdData, tdHorarios, tdCliente, tdTelefone, tdValor, tdStatus, tdAcoes);
      tbody.appendChild(tr);
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="10">Não foi possível carregar as reservas.</td></tr>';
    console.error(error);
  }
}

async function atualizarStatus(id, status) {
  try {
    await api.put(`/reservas/${id}`, { status });
    mostrarAlerta(`Reserva marcada como "${STATUS_LABEL[status]}".`, "success");
    carregarReservas();
    carregarAgenda();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível atualizar a reserva.");
  }
}

qs("#filtro-status").addEventListener("change", carregarReservas);

// ---------- Agenda por unidade (3 estados) ----------

let unidadesCache = [];

async function carregarSeletorUnidades() {
  const select = qs("#agenda-unidade");
  try {
    const resultado = await api.get("/unidades/admin/todas?pageSize=50");
    unidadesCache = resultado.unidades;

    select.innerHTML = '<option value="">Selecione...</option>';
    for (const unidade of unidadesCache) {
      const option = document.createElement("option");
      option.value = unidade.id;
      option.textContent = unidade.nome;
      select.appendChild(option);
    }
  } catch (error) {
    console.error(error);
  }
}

function atualizarSeletorModalidades() {
  const unidadeId = qs("#agenda-unidade").value;
  const modalidadeSelect = qs("#agenda-modalidade");
  modalidadeSelect.innerHTML = "";

  const unidade = unidadesCache.find((u) => u.id === unidadeId);
  if (!unidade) return;

  for (const rel of unidade.modalidades || []) {
    const option = document.createElement("option");
    option.value = rel.modalidadeId;
    option.textContent = rel.modalidade.nome;
    modalidadeSelect.appendChild(option);
  }
}

async function carregarAgenda() {
  const unidadeId = qs("#agenda-unidade").value;
  const modalidadeId = qs("#agenda-modalidade").value;
  const data = qs("#agenda-data").value;
  const container = qs("#agenda-container");

  if (!unidadeId || !modalidadeId || !data) {
    container.innerHTML = '<p class="state-message">Selecione unidade, modalidade e dia para ver a agenda.</p>';
    return;
  }

  container.innerHTML = '<p class="state-message">Carregando agenda...</p>';

  try {
    const resultado = await api.get(`/unidades/${unidadeId}/agenda-admin?data=${data}&modalidadeId=${modalidadeId}`);

    if (!resultado.quadras.length) {
      container.innerHTML = '<p class="state-message">Nenhuma quadra desta unidade oferece essa modalidade.</p>';
      return;
    }

    container.innerHTML = "";
    for (const quadra of resultado.quadras) {
      const bloco = document.createElement("div");

      const titulo = document.createElement("h3");
      titulo.style.fontSize = "0.95rem";
      titulo.style.marginBottom = "8px";
      titulo.textContent = quadra.quadraNome;
      bloco.appendChild(titulo);

      const grid = document.createElement("div");
      grid.className = "agenda-grid";

      for (const item of quadra.horarios) {
        const slot = document.createElement("div");
        slot.className = `agenda-slot agenda-slot--${item.status}`;

        const hora = document.createElement("div");
        hora.className = "agenda-slot__hora";
        hora.textContent = item.horario;

        const statusTexto = document.createElement("div");
        statusTexto.className = "agenda-slot__status";
        statusTexto.textContent =
          item.status === "disponivel"
            ? "Disponível"
            : item.status === "aguardando_aprovacao"
            ? "Aguardando"
            : "Locado";

        slot.append(hora, statusTexto);

        if (item.nomeSolicitante) {
          slot.title = `${item.nomeSolicitante} — ${item.telefoneSolicitante}`;
        }

        grid.appendChild(slot);
      }

      bloco.appendChild(grid);
      container.appendChild(bloco);
    }
  } catch (error) {
    container.innerHTML = '<p class="state-message">Não foi possível carregar a agenda.</p>';
    console.error(error);
  }
}

qs("#agenda-unidade").addEventListener("change", () => {
  atualizarSeletorModalidades();
  carregarAgenda();
});
qs("#agenda-modalidade").addEventListener("change", carregarAgenda);
qs("#agenda-data").addEventListener("change", carregarAgenda);

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;

  qs("#agenda-data").value = new Date().toISOString().slice(0, 10);

  await carregarSeletorUnidades();
  carregarReservas();
}

init();
