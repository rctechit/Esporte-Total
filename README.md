# Esporte Total

Hub esportivo para cadastro e busca de unidades (quadras, clubes, escolas) organizadas por
modalidade — Futebol, Tênis, Beach Tênis e Paraquedismo.

## Arquitetura

```
backend/    API REST em Fastify + TypeScript + Prisma + PostgreSQL (Neon)
frontend/   Site estático em HTML + CSS + JavaScript puro (sem framework)
```

O admin cadastra as unidades pelo painel (`/admin`); o site público lista e filtra as
unidades por modalidade, cidade e busca livre.

### Backend

- **Fastify 5** + **TypeScript** — servidor HTTP.
- **Prisma + PostgreSQL (Neon)** — ORM e banco de dados.
- **Zod** — validação de entrada em todas as rotas.
- **argon2** — hash de senha do admin.
- **JWT em cookie httpOnly** — sessão do admin (sem localStorage, protege contra XSS).
- **@fastify/helmet**, **@fastify/cors**, **@fastify/rate-limit** — segurança básica de API.
- **Nominatim (OpenStreetMap)** — geocodificação de endereço (com throttle e cache em banco,
  respeitando a política de uso de 1 req/s).
- **Cloudinary** — opcional, para fotos das unidades (se não configurado, o admin cadastra
  fotos por URL manualmente).

### Frontend

- HTML/CSS/JS puro, mobile-first, um único arquivo de estilos (`frontend/css/style.css`).
- Sem build step — pode ser hospedado em qualquer static host (Vercel, Netlify, etc).
- Todo o conteúdo dinâmico é montado via `textContent`/`createElement` (não `innerHTML` com
  dados externos), para evitar XSS.

## Rodando localmente

### 1. Backend

```bash
cd backend
cp .env.example .env   # edite com sua DATABASE_URL do Neon e demais variáveis
npm install
npx prisma migrate dev   # cria as tabelas
npm run seed              # cria as 4 modalidades e o usuário admin
npm run dev                # inicia em http://localhost:3333
```

Gere um `JWT_SECRET` forte com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Frontend

O frontend é estático — basta servir a pasta `frontend/`:

```bash
cd frontend
python3 -m http.server 5173
# ou: npx serve .
```

Acesse `http://localhost:5173/index.html`. O arquivo `frontend/js/config.js` já aponta para
`http://localhost:3333/api` quando rodando em `localhost`.

Login padrão do admin (definido no `.env` do backend): o e-mail/senha configurados em
`ADMIN_EMAIL` / `ADMIN_PASSWORD` antes de rodar `npm run seed`.

## Deploy em produção

1. **Banco de dados**: crie um projeto no [Neon](https://neon.tech) e copie a
   `DATABASE_URL` (com `sslmode=require`) para o `.env` de produção.
2. **Backend (Railway)**: publique a pasta `backend/` como serviço Node. Configure as
   variáveis de ambiente (baseadas no `.env.example`), rode `npx prisma migrate deploy` no
   deploy e `npm run seed` uma única vez para criar o admin.
3. **Frontend (Vercel/Netlify)**: publique a pasta `frontend/` como site estático.
4. Edite `frontend/js/config.js` com a URL pública do backend no Railway.
5. Configure `CORS_ORIGIN` no backend com o domínio final do frontend (produção usa cookies
   `SameSite=None; Secure`, exigindo HTTPS em ambos os lados).

## Notas de segurança

- Senhas de admin são armazenadas com hash `argon2id` — nunca em texto plano.
- A sessão do admin é um JWT em cookie `httpOnly` + `secure` (produção) — não fica acessível
  via JavaScript, reduzindo o risco de roubo de sessão por XSS.
- Rate limit mais restritivo no login (5 tentativas/minuto) para dificultar força bruta.
- Todas as rotas de escrita (`POST`/`PUT`/`DELETE`) exigem autenticação; leitura pública só
  expõe unidades marcadas como `ativo`.
- Prisma usa consultas parametrizadas — protegido contra SQL injection por padrão.
- Troque `ADMIN_PASSWORD` e `JWT_SECRET` do `.env.example` antes de qualquer deploy real.

## Integrações pendentes (mencionadas no planejamento inicial, fora do escopo deste MVP)

- **Mercado Pago (Pix)** — para cobrança de mensalidade ou destaque de unidades.
- **WhatsApp** — hoje o site já gera links `wa.me` a partir do número cadastrado; uma API
  (oficial ou não-oficial) pode ser adicionada depois para automações de mensagens.
- **Cloudinary com upload direto pelo painel** — a API já expõe `/api/uploads/sign` para
  upload assinado; falta o widget de upload no formulário (hoje o admin cola a URL da foto).
