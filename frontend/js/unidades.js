const PAGE_SIZE = 9;
let paginaAtual = 1;

function lerFiltrosDaUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    busca: params.get("busca") || "",
    modalidade: params.get("modalidade") || "",
    cidade: params.get("cidade") || "",
    page: Number(params.get("page")) || 1,
  };
}

function atualizarUrl(filtros) {
  const params = new URLSearchParams();
  if (filtros.busca) params.set("busca", filtros.busca);
  if (filtros.modalidade) params.set("modalidade", filtros.modalidade);
  if (filtros.cidade) params.set("cidade", filtros.cidade);
  if (filtros.page > 1) params.set("page", String(filtros.page));
  const query = params.toString();
  window.history.replaceState({}, "", query ? `?${query}` : window.location.pathname);
}

async function carregarModalidadesFiltro(modalidadeSelecionada) {
  const select = qs("#filtro-modalidade");
  try {
    const modalidades = await api.get("/modalidades");
    for (const modalidade of modalidades) {
      const option = document.createElement("option");
      option.value = modalidade.slug;
      option.textContent = modalidade.nome;
      if (modalidade.slug === modalidadeSelecionada) {
        option.selected = true;
      }
      select.appendChild(option);
    }
  } catch (error) {
    console.error(error);
  }
}

function renderPaginacao(total, page, pageSize) {
  const wrap = qs("#paginacao");
  wrap.innerHTML = "";
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  if (totalPaginas <= 1) return;

  const anterior = document.createElement("button");
  anterior.className = "btn btn--outline btn--sm";
  anterior.textContent = "‹";
  anterior.disabled = page <= 1;
  anterior.addEventListener("click", () => irParaPagina(page - 1));
  wrap.appendChild(anterior);

  for (let i = 1; i <= totalPaginas; i += 1) {
    const btn = document.createElement("button");
    btn.className = `btn btn--sm ${i === page ? "btn--primary" : "btn--outline"}`;
    btn.textContent = String(i);
    btn.addEventListener("click", () => irParaPagina(i));
    wrap.appendChild(btn);
  }

  const proxima = document.createElement("button");
  proxima.className = "btn btn--outline btn--sm";
  proxima.textContent = "›";
  proxima.disabled = page >= totalPaginas;
  proxima.addEventListener("click", () => irParaPagina(page + 1));
  wrap.appendChild(proxima);
}

function irParaPagina(page) {
  paginaAtual = page;
  buscarUnidades();
}

async function buscarUnidades() {
  const lista = qs("#unidades-lista");
  lista.innerHTML = '<p class="state-message">Carregando unidades...</p>';

  const filtros = {
    busca: qs("#filtro-busca").value.trim(),
    modalidade: qs("#filtro-modalidade").value,
    cidade: qs("#filtro-cidade").value.trim(),
    page: paginaAtual,
  };

  atualizarUrl(filtros);

  const params = new URLSearchParams();
  if (filtros.busca) params.set("busca", filtros.busca);
  if (filtros.modalidade) params.set("modalidade", filtros.modalidade);
  if (filtros.cidade) params.set("cidade", filtros.cidade);
  params.set("page", String(filtros.page));
  params.set("pageSize", String(PAGE_SIZE));

  try {
    const resultado = await api.get(`/unidades?${params.toString()}`);

    if (!resultado.unidades.length) {
      lista.innerHTML = '<p class="state-message">Nenhuma unidade encontrada com esses filtros.</p>';
      qs("#paginacao").innerHTML = "";
      return;
    }

    lista.innerHTML = "";
    for (const unidade of resultado.unidades) {
      lista.appendChild(criarCardUnidade(unidade));
    }

    renderPaginacao(resultado.total, resultado.page, resultado.pageSize);
  } catch (error) {
    lista.innerHTML = '<p class="state-message">Não foi possível carregar as unidades agora.</p>';
    console.error(error);
  }
}

async function init() {
  const filtrosIniciais = lerFiltrosDaUrl();
  qs("#filtro-busca").value = filtrosIniciais.busca;
  qs("#filtro-cidade").value = filtrosIniciais.cidade;
  paginaAtual = filtrosIniciais.page;

  await carregarModalidadesFiltro(filtrosIniciais.modalidade);

  qs("#filtros-form").addEventListener("submit", (event) => {
    event.preventDefault();
    paginaAtual = 1;
    buscarUnidades();
  });

  qs("#ano-atual").textContent = new Date().getFullYear();

  buscarUnidades();
}

init();
