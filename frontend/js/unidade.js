function criarInfoItem(icone, texto) {
  const item = document.createElement("div");
  item.className = "info-list__item";

  const iconEl = document.createElement("span");
  iconEl.className = "info-list__icon";
  iconEl.textContent = icone;

  const textEl = document.createElement("span");
  textEl.textContent = texto;

  item.append(iconEl, textEl);
  return item;
}

function renderUnidade(unidade) {
  const conteudo = qs("#conteudo");
  conteudo.innerHTML = "";

  qs("#page-title").textContent = `${unidade.nome} — Esporte Total`;

  const header = document.createElement("div");
  header.className = "detalhe-header";

  const nome = document.createElement("h1");
  nome.textContent = unidade.nome;

  const local = document.createElement("p");
  local.className = "unidade-card__local";
  local.textContent = formatEnderecoCompleto(unidade);

  const badges = document.createElement("div");
  badges.className = "badge-list";
  for (const rel of unidade.modalidades || []) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = rel.modalidade.nome;
    badges.appendChild(badge);
  }

  header.append(nome, local, badges);
  conteudo.appendChild(header);

  if (unidade.fotos && unidade.fotos.length) {
    const galeria = document.createElement("div");
    galeria.className = "detalhe-galeria";
    for (const foto of unidade.fotos) {
      const img = document.createElement("img");
      img.src = foto.url;
      img.alt = unidade.nome;
      img.loading = "lazy";
      galeria.appendChild(img);
    }
    conteudo.appendChild(galeria);
  }

  const grid = document.createElement("div");
  grid.className = "detalhe-grid";

  const principal = document.createElement("div");
  principal.className = "info-card";
  const descricaoTitulo = document.createElement("h2");
  descricaoTitulo.textContent = "Sobre";
  const descricaoTexto = document.createElement("p");
  descricaoTexto.textContent = unidade.descricao || "Nenhuma descrição cadastrada para esta unidade.";
  principal.append(descricaoTitulo, descricaoTexto);

  if (unidade.horarioFuncionamento) {
    const horarioTitulo = document.createElement("h2");
    horarioTitulo.textContent = "Horário de funcionamento";
    const horarioTexto = document.createElement("p");
    horarioTexto.textContent = unidade.horarioFuncionamento;
    principal.append(horarioTitulo, horarioTexto);
  }

  if (unidade.latitude && unidade.longitude) {
    const mapaTitulo = document.createElement("h2");
    mapaTitulo.textContent = "Localização";
    const mapaWrap = document.createElement("div");
    mapaWrap.style.borderRadius = "12px";
    mapaWrap.style.overflow = "hidden";
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "300";
    iframe.style.border = "0";
    iframe.loading = "lazy";
    const delta = 0.01;
    const bbox = [
      unidade.longitude - delta,
      unidade.latitude - delta,
      unidade.longitude + delta,
      unidade.latitude + delta,
    ].join(",");
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${unidade.latitude},${unidade.longitude}&layer=mapnik`;
    mapaWrap.appendChild(iframe);
    principal.append(mapaTitulo, mapaWrap);
  }

  const lateral = document.createElement("div");
  lateral.style.display = "flex";
  lateral.style.flexDirection = "column";
  lateral.style.gap = "16px";

  const reservaCard = document.createElement("div");
  reservaCard.className = "info-card";
  const reservaTitulo = document.createElement("h2");
  reservaTitulo.textContent = "Agende seu horário";
  reservaCard.appendChild(reservaTitulo);

  for (const rel of unidade.modalidades || []) {
    const linha = document.createElement("div");
    linha.style.display = "flex";
    linha.style.justifyContent = "space-between";
    linha.style.alignItems = "center";
    linha.style.padding = "10px 0";
    linha.style.borderBottom = "1px solid var(--color-border)";

    const info = document.createElement("div");
    const nomeModalidade = document.createElement("div");
    nomeModalidade.style.fontWeight = "700";
    nomeModalidade.textContent = `${rel.modalidade.icone || ""} ${rel.modalidade.nome}`.trim();
    info.appendChild(nomeModalidade);

    if (rel.precoHora) {
      const preco = document.createElement("div");
      preco.className = "unidade-card__local";
      preco.textContent = `A partir de ${rel.precoHora.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}/hora`;
      info.appendChild(preco);
    }

    const btn = document.createElement("a");
    btn.className = "btn btn--primary btn--sm";
    btn.textContent = "Ver disponibilidade";
    btn.href = `disponibilidade.html?slug=${encodeURIComponent(unidade.slug)}&modalidadeId=${encodeURIComponent(
      rel.modalidadeId
    )}`;

    linha.append(info, btn);
    reservaCard.appendChild(linha);
  }

  const contatoCard = document.createElement("div");
  contatoCard.className = "info-card";
  const contatoTitulo = document.createElement("h2");
  contatoTitulo.textContent = "Contato";
  const infoList = document.createElement("div");
  infoList.className = "info-list";
  infoList.appendChild(criarInfoItem("📍", formatEnderecoCompleto(unidade)));
  if (unidade.telefone) infoList.appendChild(criarInfoItem("📞", unidade.telefone));
  if (unidade.email) infoList.appendChild(criarInfoItem("✉️", unidade.email));
  if (unidade.site) infoList.appendChild(criarInfoItem("🌐", unidade.site));

  contatoCard.append(contatoTitulo, infoList);

  if (unidade.whatsapp) {
    const whatsappBtn = document.createElement("a");
    whatsappBtn.className = "btn btn--primary btn--block";
    whatsappBtn.style.marginTop = "16px";
    whatsappBtn.target = "_blank";
    whatsappBtn.rel = "noopener noreferrer";
    whatsappBtn.href = whatsappLink(
      unidade.whatsapp,
      `Olá! Vi a unidade ${unidade.nome} no Esporte Total e gostaria de mais informações.`
    );
    whatsappBtn.textContent = "Falar no WhatsApp";
    contatoCard.appendChild(whatsappBtn);
  }

  lateral.append(reservaCard, contatoCard);

  grid.append(principal, lateral);
  conteudo.appendChild(grid);
}

async function init() {
  qs("#ano-atual").textContent = new Date().getFullYear();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const conteudo = qs("#conteudo");

  if (!slug) {
    conteudo.innerHTML = '<p class="state-message">Unidade não especificada.</p>';
    return;
  }

  try {
    const unidade = await api.get(`/unidades/${encodeURIComponent(slug)}`);
    renderUnidade(unidade);
  } catch (error) {
    conteudo.innerHTML = '<p class="state-message">Unidade não encontrada.</p>';
    console.error(error);
  }
}

init();
