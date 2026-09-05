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
  lateral.className = "info-card";
  const contatoTitulo = document.createElement("h2");
  contatoTitulo.textContent = "Contato";
  const infoList = document.createElement("div");
  infoList.className = "info-list";
  infoList.appendChild(criarInfoItem("📍", formatEnderecoCompleto(unidade)));
  if (unidade.telefone) infoList.appendChild(criarInfoItem("📞", unidade.telefone));
  if (unidade.email) infoList.appendChild(criarInfoItem("✉️", unidade.email));
  if (unidade.site) infoList.appendChild(criarInfoItem("🌐", unidade.site));

  lateral.append(contatoTitulo, infoList);

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
    lateral.appendChild(whatsappBtn);
  }

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
