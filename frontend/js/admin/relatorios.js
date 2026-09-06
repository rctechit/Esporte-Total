function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

if (typeof Chart !== "undefined") {
  Chart.defaults.color = "#8793a6";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.08)";
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
          backgroundColor: "#34e1ff",
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
          backgroundColor: "#f2b705",
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

function renderChartEvolucao(dados) {
  const temFaturamento = dados.some((d) => d.total > 0);
  if (!temFaturamento) {
    qs("#evolucao-vazio").hidden = false;
    return;
  }
  new Chart(qs("#chart-evolucao"), {
    type: "line",
    data: {
      labels: dados.map((d) => d.mes),
      datasets: [
        {
          label: "Faturamento (R$)",
          data: dados.map((d) => d.total),
          borderColor: "#34e1ff",
          backgroundColor: "rgba(52, 225, 255, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatarMoeda(ctx.parsed.y) } },
      },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatarMoeda(v) } } },
    },
  });
}

// Escala sequencial (mesma família ciano usada no resto do painel), do mais
// escuro (perto de zero) ao mais claro (horário mais concorrido).
const ESCALA_OCUPACAO = ["#101a24", "#0e3646", "#0f5a70", "#12879e", "#1fb6d8", "#6fe4fa"];

function corOcupacao(total, max) {
  if (max <= 0) return ESCALA_OCUPACAO[0];
  const idx = Math.min(ESCALA_OCUPACAO.length - 1, Math.floor((total / max) * ESCALA_OCUPACAO.length));
  return ESCALA_OCUPACAO[idx];
}

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]; // Seg...Dom, mais natural pra visão de negócio

function renderHeatmap(dados) {
  const max = Math.max(0, ...dados.map((d) => d.total));
  if (max === 0) {
    qs("#heatmap-vazio").hidden = false;
    return;
  }

  const porDia = new Map();
  for (const item of dados) {
    if (!porDia.has(item.diaSemana)) porDia.set(item.diaSemana, []);
    porDia.get(item.diaSemana).push(item);
  }

  const wrap = qs("#heatmap-horarios");
  const heatmap = document.createElement("div");
  heatmap.className = "heatmap";

  let horarios = [];
  for (const diaSemana of ORDEM_DIAS) {
    const itens = porDia.get(diaSemana) || [];
    if (itens.length) horarios = itens.map((i) => i.horario);

    const row = document.createElement("div");
    row.className = "heatmap-row";

    const label = document.createElement("span");
    label.className = "heatmap-row__label";
    label.textContent = itens[0]?.dia || "";
    row.appendChild(label);

    for (const item of itens) {
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.background = corOcupacao(item.total, max);
      cell.title = `${item.dia} · ${item.horario} — ${item.total} reserva${item.total === 1 ? "" : "s"}`;
      row.appendChild(cell);
    }

    heatmap.appendChild(row);
  }

  wrap.appendChild(heatmap);

  const hoursRow = document.createElement("div");
  hoursRow.className = "heatmap-hours";
  hoursRow.innerHTML = horarios.map((h) => `<span>${h}</span>`).join("");
  wrap.appendChild(hoursRow);

  const legenda = document.createElement("div");
  legenda.className = "heatmap-legenda";
  legenda.innerHTML =
    "<span>Vazio</span><div class=\"swatches\">" +
    ESCALA_OCUPACAO.map((cor) => `<div style="background:${cor}"></div>`).join("") +
    "</div><span>Concorrido</span>";
  wrap.appendChild(legenda);
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
          borderColor: "#34e1ff",
          backgroundColor: "rgba(52, 225, 255, 0.15)",
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

  // O mapa de horários é HTML/CSS puro (não depende do Chart.js), então
  // renderiza mesmo se a biblioteca de gráficos falhar ao carregar.
  try {
    renderHeatmap(resumo.ocupacaoPorHorario || []);
  } catch (error) {
    console.error(error);
  }

  // Os gráficos de barra/linha dependem do Chart.js (CDN externo) — se ele
  // falhar ao carregar, os números acima já renderizados não podem sumir
  // por causa disso.
  if (typeof Chart === "undefined") {
    qs(".chart-grid").insertAdjacentHTML(
      "beforebegin",
      '<p class="state-message">Não foi possível carregar a biblioteca de gráficos. Os números acima continuam válidos.</p>'
    );
    return;
  }

  try {
    renderChartEvolucao(resumo.evolucaoMensal || []);
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
