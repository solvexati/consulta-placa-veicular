# Consulta Placa Veicular (PWA + API)

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Vite + vite-plugin-pwa
- **Backend:** Vercel Functions (`api/`) + Supabase (opcional)

## Estrutura

```
api/            Rotas HTTP (cada arquivo vira uma Vercel Function)
  health.ts       GET  /api/health
  vehicle.ts      GET  /api/vehicle?plate=        dados básicos + FIPE (grátis)
  unlock.ts       POST /api/unlock                libera o laudo (pagamento SIMULADO)
  report.ts       GET  /api/report?plate=         laudo completo (exige token)
server/         Regras de negócio do backend
  vehicleService.ts   cache → provedor → resposta
  providers/          fontes de dados (mock hoje; API paga depois)
  store/              persistência: Supabase ou memória
  accessToken.ts      token assinado (HMAC) de acesso ao laudo
  http.ts, rateLimit.ts, env.ts, crypto.ts
shared/         Tipos e utilitários usados pelo app E pelo backend
  apiContract.ts      formato das requisições/respostas da API
src/            App PWA (React)
  services/vehicleApi.ts   cliente HTTP do backend
supabase/migrations/       SQL das tabelas
dev/apiDevServer.ts        faz o `npm run dev` servir /api localmente
```

## Comandos

```bash
npm install        # instala dependências
npm run dev        # app + API em http://localhost:5173
npm run typecheck  # checa tipos do app e do servidor
npm run build      # build de produção
npm run preview    # serve o build em http://localhost:4173 (sem /api)
npm run icons      # regenera os PNGs do PWA a partir de public/icon.svg
npm run provider:check  # valida o adaptador da API (formato da resposta)
```

Variáveis de ambiente: veja `.env.example`. Em desenvolvimento nada é obrigatório.

## API

| Rota | Método | Auth | Descrição |
|---|---|---|---|
| `/api/health` | GET | — | Status, provedor e armazenamento ativos |
| `/api/vehicle?plate=ABC1D23` | GET | — | Dados cadastrais + FIPE |
| `/api/unlock` | POST | — | `{ plate, method: "pix" \| "cartao" }` → `{ receipt, accessToken }` |
| `/api/report?plate=ABC1D23` | GET | `Bearer <accessToken>` | Laudo completo |

Erros sempre no formato `{ "error": { "code": "...", "message": "..." } }`.
Limite: 20 requisições/minuto por IP em cada rota (`RATE_LIMIT_PER_MINUTE`).

### Como funciona o acesso ao laudo
1. `POST /api/unlock` gera um **token assinado** (HMAC-SHA256 com `ACCESS_TOKEN_SECRET`) contendo a placa.
2. O app guarda o token e envia em `Authorization: Bearer` ao pedir `/api/report`.
3. O backend valida a assinatura e a placa. Com Supabase, confere também o registro em `unlocks`
   (permite revogar em caso de estorno). O token não serve para outra placa.

## Supabase (opcional, recomendado em produção)

Sem Supabase o backend usa memória: funciona, mas **não guarda cache nem registro de desbloqueios**
entre execuções (cada rota da Vercel é uma função separada).

1. Crie um projeto no Supabase e rode os arquivos de `supabase/migrations/` em ordem.
2. Defina `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Vercel e `.env.local`).
3. `GET /api/health` deve responder `"store": "supabase"`.

Tabelas: `vehicle_cache` (cache do provedor), `unlocks` (laudos liberados, só o hash do token),
`lookup_logs` (consultas com IP anonimizado e provedor), `fetch_locks` (trava por placa).
View `api_usage_daily` (economia do cache). RLS ativo e sem policies públicas.

## Plugando (ou trocando) a API paga

Toda API entra por **um único arquivo** (adaptador). O resto do sistema não muda.

1. Copie `server/providers/template.ts` para `server/providers/<nome>.ts`.
2. Escolha o modo:
   - `split`: a API tem consulta básica e completa separadas (`getBasic` + `getReport`);
   - `full`: uma chamada devolve tudo (`getFull`). O backend guarda básico + laudo juntos,
     então o laudo depois sai do cache sem nova cobrança.
3. Use `providerRequest` (`server/providers/httpClient.ts`): timeout, novas tentativas e logs sem a chave.
4. Converta a resposta para `VehicleBasic` / `AdvancedReport` (`shared/vehicle.ts`).
5. Registre em `server/providers/index.ts` e defina `VEHICLE_PROVIDER=<nome>`,
   `VEHICLE_PROVIDER_API_URL` e `VEHICLE_PROVIDER_API_KEY`.
6. Valide: `npm run provider:check -- ABC1D23` (cada placa testada é uma consulta cobrada).

Proteções automáticas para qualquer API:
- **Cache no servidor** compartilhado por todos os usuários (Supabase).
- **Trava por placa**: requisições simultâneas da mesma placa geram uma única chamada à API.
- **Validação de formato**: resposta fora do padrão não é guardada nem enviada ao app.

## Relatório de uso da API

No SQL Editor do Supabase:
```sql
select * from api_usage_daily;  -- chamadas à API x respostas do cache, por dia
```

## Placas de teste (provedor mock)

| Placa     | Veículo                 | Cenário                                  |
|-----------|-------------------------|------------------------------------------|
| `BRA2E19` | Toyota Corolla Cross 24 | 100% regular                             |
| `KRP8214` | Honda Civic 2020        | Leilão Sodré Santoro + pequena monta     |
| `ONX3A88` | Chevrolet Onix Plus 24  | Alienação fiduciária + IPVA pendente     |
| `HYU7F90` | Hyundai HB20 2023       | Roubo recuperado e regularizado          |

Qualquer outra placa válida gera dados determinísticos (mesma placa = mesmo resultado).
Pagamento é **simulado** (`SIMULATED_PAYMENTS=true`) até a integração do gateway.

## Deploy (Vercel)

```bash
vercel env add ACCESS_TOKEN_SECRET   # obrigatório para desbloquear laudos
vercel deploy                        # preview
vercel deploy --prod                 # produção
```
