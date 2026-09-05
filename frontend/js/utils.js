function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function onlyDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function whatsappLink(numero, mensagem = "") {
  const digits = onlyDigits(numero);
  const numeroComPais = digits.startsWith("55") ? digits : `55${digits}`;
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${numeroComPais}${texto}`;
}

function formatEnderecoCompleto(unidade) {
  const partes = [
    unidade.endereco,
    unidade.numero,
    unidade.bairro,
    `${unidade.cidade} - ${unidade.estado}`,
  ].filter(Boolean);
  return partes.join(", ");
}

function criarCardUnidade(unidade) {
  const card = document.createElement("article");
  card.className = "unidade-card";

  const foto = document.createElement("div");
  foto.className = "unidade-card__foto";
  if (unidade.fotos && unidade.fotos.length) {
    foto.style.backgroundImage = `url(${JSON.stringify(unidade.fotos[0].url)})`;
    foto.textContent = "";
  } else {
    foto.textContent = "🏟️";
  }

  const body = document.createElement("div");
  body.className = "unidade-card__body";

  const nome = document.createElement("h3");
  nome.className = "unidade-card__nome";
  nome.textContent = unidade.nome;

  const local = document.createElement("p");
  local.className = "unidade-card__local";
  local.textContent = `${unidade.cidade} - ${unidade.estado}`;

  const badges = document.createElement("div");
  badges.className = "badge-list";
  for (const rel of unidade.modalidades || []) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = rel.modalidade.nome;
    badges.appendChild(badge);
  }
  if (unidade.ativo === false) {
    const badge = document.createElement("span");
    badge.className = "badge badge--inativo";
    badge.textContent = "Inativa";
    badges.appendChild(badge);
  }

  const cta = document.createElement("div");
  cta.className = "unidade-card__cta";
  const link = document.createElement("a");
  link.className = "btn btn--primary btn--block";
  link.href = `unidade.html?slug=${encodeURIComponent(unidade.slug)}`;
  link.textContent = "Ver detalhes";
  cta.appendChild(link);

  body.append(nome, local, badges, cta);
  card.append(foto, body);
  return card;
}

function setupMobileNav() {
  const toggle = qs("[data-nav-toggle]");
  const menu = qs("[data-nav-menu]");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.addEventListener("DOMContentLoaded", setupMobileNav);
