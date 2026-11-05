# Consulta Placa Veicular (PWA)

React 19 + TypeScript + Tailwind CSS v4 + Vite + vite-plugin-pwa.

## Comandos

```bash
npm install        # instala dependências
npm run dev        # desenvolvimento em http://localhost:5173 (Service Worker ativo em dev)
npm run build      # build de produção em dist/ (gera sw.js e manifest.webmanifest)
npm run preview    # serve o build em http://localhost:4173
npm run icons      # regenera os PNGs do PWA a partir de public/icon.svg
```

## Placas de teste

| Placa     | Veículo                 | Cenário                                  |
|-----------|-------------------------|------------------------------------------|
| `BRA2E19` | Toyota Corolla Cross 24 | 100% regular                             |
| `KRP8214` | Honda Civic 2020        | Leilão Sodré Santoro + pequena monta     |
| `ONX3A88` | Chevrolet Onix Plus 24  | Alienação fiduciária + IPVA pendente     |
| `HYU7F90` | Hyundai HB20 2023       | Roubo recuperado e regularizado          |

Qualquer outra placa válida gera dados determinísticos (mesma placa = mesmo resultado).

Pagamento é **simulado** (PIX com BR Code válido e cartão com validação Luhn — use "preencher automaticamente").
Histórico e laudos desbloqueados ficam no `localStorage` do dispositivo.

## Testar a instalação no celular

O PWA exige HTTPS fora do `localhost`. Para testar no celular, publique o `dist/`
(Vercel, Netlify, etc.) ou use um túnel HTTPS para o `npm run preview`.
