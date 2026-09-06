function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderStats(resumo) {
  const row = qs("#stats-row");
  row.innerHTML = "";

  const stats = [
    [formatarMoeda(resumo.faturamentoTotal), "Faturamento total (reservas locadas)"],
    [String(resumo.totalReservasNaoCanceladas), "Reservas ativas (aguardando + locadas)"],
    [String(resumo.totalUnidades), "Unidades cadastradas"],
  ];

  for (const [valor, label] of stats) {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const valorEl = document.createElement("div");
    valorEl.className = "stat-tile__valor";
    valorEl.textContent = valor;
    const labelEl = document.createElement("div");
    labelEl.className = "stat-tile__label";
    labelEl.textContent = label;
    tile.append(valorEl, labelEl);
    row.appendChild(tile);
  }
}

function renderChartFaturamento(dados) {
  if (!dados.length) {
    qs("#faturamento-vazio").hidden = false;
    return;
  }
  new Chart(qs("#chart-faturamento"), {
    type: "bar",
    data: {
      labels: dados.map((d) => d.nome),
      datasets: [
        {
          label: "Faturamento (R$)",
          data: dados.map((d) => d.total),
          backgroundColor: "#16a34a",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderChartSolicitadas(dados) {
  if (!dados.length) {
    qs("#solicitadas-vazio").hidden = false;
    return;
  }
  new Chart(qs("#chart-solicitadas"), {
    type: "bar",
    data: {
      labels: dados.map((d) => d.nome),
      datasets: [
        {
          label: "Reservas",
          data: dados.map((d) => d.totalReservas),
          backgroundColor: "#f97316",
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function renderChartTendencia(dados) {
  new Chart(qs("#chart-tendencia"), {
    type: "line",
    data: {
      labels: dados.map((d) => d.dia),
      datasets: [
        {
          label: "Reservas",
          data: dados.map((d) => d.total),
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

async function carregarRelatorios() {
  let resumo;
  try {
    resumo = await api.get("/relatorios/resumo");
  } catch (error) {
    qs("#stats-row").innerHTML = '<p class="state-message">Não foi possível carregar os relatórios.</p>';
    console.error(error);
    return;
  }

  renderStats(resumo);

  // Os gráficos dependem do Chart.js (CDN externo) — se ele falhar ao
  // carregar, os números acima já renderizados não podem sumir por causa
  // disso.
  if (typeof Chart === "undefined") {
    qs(".chart-grid").insertAdjacentHTML(
      "beforebegin",
      '<p class="state-message">Não foi possível carregar a biblioteca de gráficos. Os números acima continuam válidos.</p>'
    );
    return;
  }

  try {
    renderChartFaturamento(resumo.faturamentoPorUnidade);
    renderChartSolicitadas(resumo.unidadesMaisSolicitadas);
    renderChartTendencia(resumo.tendenciaPorDiaSemana);
  } catch (error) {
    console.error(error);
  }
}

async function init() {
  const admin = await requireAdmin();
  if (!admin) return;
  carregarRelatorios();
}

init();
