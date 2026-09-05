async function carregarModalidades() {
  const grid = qs("#modalidades-grid");
  const select = qs("#hero-modalidade");

  try {
    const modalidades = await api.get("/modalidades");

    if (!modalidades.length) {
      grid.innerHTML = '<p class="state-message">Nenhuma modalidade cadastrada ainda.</p>';
      return;
    }

    grid.innerHTML = "";
    for (const modalidade of modalidades) {
      const card = document.createElement("a");
      card.className = "modalidade-card";
      card.href = `unidades.html?modalidade=${encodeURIComponent(modalidade.slug)}`;

      const icon = document.createElement("div");
      icon.className = "modalidade-card__icon";
      icon.textContent = modalidade.icone || "🏅";

      const nome = document.createElement("div");
      nome.className = "modalidade-card__nome";
      nome.textContent = modalidade.nome;

      card.append(icon, nome);
      grid.appendChild(card);

      const option = document.createElement("option");
      option.value = modalidade.slug;
      option.textContent = modalidade.nome;
      select.appendChild(option);
    }
  } catch (error) {
    grid.innerHTML = '<p class="state-message">Não foi possível carregar as modalidades agora.</p>';
    console.error(error);
  }
}

async function carregarUnidadesDestaque() {
  const grid = qs("#unidades-destaque");

  try {
    const resultado = await api.get("/unidades?pageSize=6");

    if (!resultado.unidades.length) {
      grid.innerHTML = '<p class="state-message">Nenhuma unidade cadastrada ainda.</p>';
      return;
    }

    grid.innerHTML = "";
    for (const unidade of resultado.unidades) {
      grid.appendChild(criarCardUnidade(unidade));
    }
  } catch (error) {
    grid.innerHTML = '<p class="state-message">Não foi possível carregar as unidades agora.</p>';
    console.error(error);
  }
}

qs("#hero-search-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const busca = qs("#hero-busca").value.trim();
  const modalidade = qs("#hero-modalidade").value;
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (modalidade) params.set("modalidade", modalidade);
  window.location.href = `unidades.html${params.toString() ? `?${params}` : ""}`;
});

qs("#ano-atual").textContent = new Date().getFullYear();

carregarModalidades();
carregarUnidadesDestaque();
