// Worker: busca o JSON do TSE no máximo uma vez a cada FRESH_S por POP e serve cópia em cache para todos.
import {
  BROWSER_MAX_AGE, FRESH_S, STALE_S, TIMEOUT_MS, USER_AGENT,
  ageSeconds, backoffSeconds, cacheKey, corsHeaders, failKey, isJson, staleKey, upstreamUrl,
} from './logic';

type Failure = { ok: false; status: number; retryAfter: string | null };
type Upstream = { ok: true; body: string; fetchedAt: number } | Failure;

// junta requisições simultâneas do mesmo isolate num único fetch ao TSE
const inflight = new Map<string, Promise<Upstream>>();

function reply(req: Request, body: string | null, status: number, extra: Record<string, string>): Response {
  const headers = new Headers({ ...corsHeaders(req.headers.get('Origin')), ...extra });
  return new Response(req.method === 'HEAD' ? null : body, { status, headers });
}

const ok = (req: Request, body: string, cache: string, age: number) =>
  reply(req, body, 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${BROWSER_MAX_AGE}`,
    'X-Proxy-Cache': cache,
    'X-Proxy-Age': String(age),
  });

// X-Proxy-Error: "route" = recusado pelo proxy; "upstream" = resposta do TSE (o cliente não deve repetir direto)
const error = (req: Request, status: number, msg: string, kind: 'route' | 'upstream', extra: Record<string, string> = {}) =>
  reply(req, JSON.stringify({ error: msg, status }), status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Proxy-Error': kind,
    ...extra,
  });

/** Entrada de cache com o corpo e a hora do fetch; o TTL vem do max-age. */
const entry = (body: string, fetchedAt: number, ttl: number) =>
  new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttl}`,
      'X-Fetched-At': String(fetchedAt),
    },
  });

/** Grava a falha por backoffSeconds: até lá ninguém neste POP volta ao TSE (serve stale ou o erro). */
async function failed(url: string, f: Failure): Promise<Failure> {
  const ttl = backoffSeconds(f.status, f.retryAfter);
  await caches.default
    .put(failKey(url), new Response(JSON.stringify(f), { headers: { 'Cache-Control': `public, max-age=${ttl}` } }))
    .catch(() => {});
  return f;
}

async function recentFailure(url: string): Promise<Failure | null> {
  const hit = await caches.default.match(failKey(url));
  if (!hit) return null;
  try {
    const f = JSON.parse(await hit.text());
    return { ok: false, status: Number(f.status) || 502, retryAfter: f.retryAfter ?? null };
  } catch {
    return null;
  }
}

async function fetchUpstream(url: string): Promise<Upstream> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return failed(url, { ok: false, status: 502, retryAfter: null }); // rede ou timeout
  }
  const retryAfter = res.headers.get('Retry-After');
  if (!res.ok) return failed(url, { ok: false, status: res.status, retryAfter });
  const body = await res.text().catch(() => '');
  if (!isJson(body)) return failed(url, { ok: false, status: 502, retryAfter: null }); // HTML de erro com 200
  const fetchedAt = Date.now();
  const cache = caches.default;
  await Promise.all([
    cache.put(cacheKey(url), entry(body, fetchedAt, FRESH_S)),
    cache.put(staleKey(url), entry(body, fetchedAt, STALE_S)),
  ]).catch(() => {});
  return { ok: true, body, fetchedAt };
}

/**
 * O fetch vai em waitUntil (cliente que desconecta não cancela a busca dos outros) e cada um espera
 * no máximo TIMEOUT_MS + 1 s: uma promessa presa sai do Map em vez de travar o isolate.
 */
async function coalesced(url: string, ctx: ExecutionContext): Promise<Upstream> {
  let p = inflight.get(url);
  if (!p) {
    const mine: Promise<Upstream> = fetchUpstream(url)
      .catch((): Upstream => ({ ok: false, status: 502, retryAfter: null }))
      .finally(() => {
        if (inflight.get(url) === mine) inflight.delete(url);
      });
    p = mine;
    inflight.set(url, p);
    ctx.waitUntil(p);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Upstream>((resolve) => {
    timer = setTimeout(() => {
      if (inflight.get(url) === p) inflight.delete(url);
      resolve({ ok: false, status: 502, retryAfter: null });
    }, TIMEOUT_MS + 1000);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(req: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return reply(req, null, 204, {
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') ?? '',
        'Access-Control-Max-Age': '86400',
      });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return error(req, 405, 'method not allowed', 'route', { Allow: 'GET, HEAD, OPTIONS' });
    }
    const url = upstreamUrl(new URL(req.url).pathname);
    if (!url) return error(req, 404, 'not found', 'route');

    const cache = caches.default;
    const hit = await cache.match(cacheKey(url));
    if (hit) return ok(req, await hit.text(), 'HIT', ageSeconds(hit.headers.get('X-Fetched-At')));

    // falha recente: não volta ao TSE (que pode estar nos limitando); vai direto à cópia velha
    const up = (await recentFailure(url)) ?? (await coalesced(url, ctx));
    if (up.ok) return ok(req, up.body, 'MISS', ageSeconds(String(up.fetchedAt)));

    const stale = await cache.match(staleKey(url));
    if (stale) return ok(req, await stale.text(), 'STALE', ageSeconds(stale.headers.get('X-Fetched-At')));

    const extra: Record<string, string> = {};
    if (up.status === 429 && up.retryAfter) extra['Retry-After'] = up.retryAfter;
    return error(req, up.status, up.status === 502 ? 'upstream unavailable' : 'upstream error', 'upstream', extra);
  },
};
