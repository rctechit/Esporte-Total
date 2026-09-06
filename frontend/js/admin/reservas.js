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
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

async function carregarReservas() {
  const tbody = qs("#reservas-tbody");
  tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

  const status = qs("#filtro-status").value;
  const params = status ? `?status=${encodeURIComponent(status)}` : "";

  try {
    const reservas = await api.get(`/reservas${params}`);

    if (!reservas.length) {
      tbody.innerHTML = '<tr><td colspan="9">Nenhuma reserva encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = "";
    for (const reserva of reservas) {
      const tr = document.createElement("tr");

      const tdUnidade = document.createElement("td");
      tdUnidade.textContent = reserva.unidade.nome;

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
      badge.className = `badge ${reserva.status === "cancelada" ? "badge--inativo" : ""}`;
      badge.textContent = STATUS_LABEL[reserva.status] || reserva.status;
      tdStatus.appendChild(badge);

      const tdAcoes = document.createElement("td");
      tdAcoes.className = "table-actions";

      if (reserva.status !== "confirmada") {
        const confirmarBtn = document.createElement("button");
        confirmarBtn.className = "btn btn--primary btn--sm";
        confirmarBtn.textContent = "Confirmar";
        confirmarBtn.addEventListener("click", () => atualizarStatus(reserva.id, "confirmada"));
        tdAcoes.appendChild(confirmarBtn);
      }

      if (reserva.status !== "cancelada") {
        const cancelarBtn = document.createElement("button");
        cancelarBtn.className = "btn btn--danger btn--sm";
        cancelarBtn.textContent = "Cancelar";
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
        `Olá ${reserva.nomeSolicitante}! Sobre sua solicitação de reserva em ${reserva.unidade.nome} (${formatarData(reserva.data)}, ${reserva.horarios.join(", ")}) — vamos combinar o pagamento?`
      );
      tdAcoes.appendChild(whatsappBtn);

      tr.append(tdUnidade, tdModalidade, tdData, tdHorarios, tdCliente, tdTelefone, tdValor, tdStatus, tdAcoes);
      tbody.appendChild(tr);
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="9">Não foi possível carregar as reservas.</td></tr>';
    console.error(error);
  }
}

async function atualizarStatus(id, status) {
  try {
    await api.put(`/reservas/${id}`, { status });
    mostrarAlerta(`Reserva marcada como ${STATUS_LABEL[status].toLowerCase()}.`, "success");
    carregarReservas();
  } catch (error) {
    mostrarAlerta(error.message || "Não foi possível atualizar a reserva.");
  }
}

qs("#filtro-status").addEventListener("change", carregarReservas);

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;
  carregarReservas();
}

init();
