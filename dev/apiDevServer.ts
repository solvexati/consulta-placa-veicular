import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';

/**
 * Plugin de desenvolvimento: faz o `npm run dev` servir as rotas de `api/*.ts`
 * do mesmo jeito que a Vercel faz em produção (handlers `GET`/`POST` com
 * Request/Response padrão Web). Assim não é preciso rodar `vercel dev`.
 */
export function apiDevServer(): Plugin {
  return {
    name: 'consulta-placa:api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        const name = url.pathname.slice('/api/'.length).replace(/\/$/, '');
        const file = resolve(server.config.root, 'api', `${name}.ts`);
        if (!/^[a-z0-9-]+$/i.test(name) || !existsSync(file)) {
          return sendJson(res, 404, { error: { code: 'not_found', message: `Rota /api/${name} não existe.` } });
        }

        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response> | Response) | undefined;
          if (!handler) {
            return sendJson(res, 405, { error: { code: 'method_not_allowed', message: `Método ${req.method} não suportado.` } });
          }
          const response = await handler(await toWebRequest(req, url));
          await writeWebResponse(res, response);
        } catch (err) {
          logError(server, err);
          sendJson(res, 500, { error: { code: 'internal_error', message: 'Erro interno no servidor de desenvolvimento.' } });
        }
      });
    },
  };
}

async function toWebRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  if (!headers.has('x-forwarded-for') && req.socket.remoteAddress) {
    headers.set('x-forwarded-for', req.socket.remoteAddress);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let body: Buffer | undefined;
  if (hasBody) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined });
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function logError(server: ViteDevServer, err: unknown): void {
  if (err instanceof Error) server.ssrFixStacktrace(err);
  server.config.logger.error(`[api] ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
}
