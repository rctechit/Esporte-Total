// Aponta para a API do backend (Fastify). Em produção, troque a URL abaixo
// pelo domínio publicado no Railway (ex: https://esporte-total-api.up.railway.app/api).
const API_BASE_URL = (() => {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) {
    return "http://localhost:3333/api";
  }
  return "https://esporte-total-production.up.railway.app/api";
})();
