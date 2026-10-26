// Lógica pura do proxy: validação de caminho, CORS e chaves de cache. Sem dependência do runtime.

export const UPSTREAM = 'https://resultados.tse.jus.br';
export const FRESH_S = 15; // cache de borda "fresco"
export const STALE_S = 6 * 3600; // última cópia boa, servida se o TSE falhar
export const BROWSER_MAX_AGE = 10;
export const TIMEOUT_MS = 8000;
export const USER_AGENT = 'urnakombat-proxy (+https://urnakombat.com.br)';
export const MAX_BACKOFF_S = 300; // teto do Retry-After respeitado

// só o JSON de resultado (br, UF ou município) das duas eleições; nada de fotos/config/open proxy
const PATH_RE = /^\/oficial\/ele2026\/(6257|6258)\/dados\/([a-z]{2})\/\2(\d{5})?-c0001-e00(6257|6258)-u\.json$/;

/** URL do TSE correspondente ao caminho, ou null se não for permitido. */
export function upstreamUrl(pathname: string): string | null {
  const m = PATH_RE.exec(pathname);
  if (!m || m[1] !== m[4]) return null; // eleição do diretório tem que bater com a do arquivo
  return UPSTREAM + pathname;
}

/** Chave do cache "fresco": a própria URL do TSE, sem query. */
export const cacheKey = (url: string) => {
  const u = new URL(url);
  return u.origin + u.pathname;
};

/** Chave da cópia de reserva (stale), separada da fresca. */
export const staleKey = (url: string) => cacheKey(url) + '?stale';

/** Marca de falha recente do TSE: enquanto existir, não buscamos de novo. */
export const failKey = (url: string) => cacheKey(url) + '?fail';

/** Por quanto tempo não voltar ao TSE após uma falha: Retry-After (segundos ou data) no 429, senão FRESH_S. */
export function backoffSeconds(status: number, retryAfter: string | null, now = Date.now()): number {
  if (status !== 429 || !retryAfter) return FRESH_S;
  let s = Number(retryAfter);
  if (!Number.isFinite(s)) s = (Date.parse(retryAfter) - now) / 1000;
  if (!Number.isFinite(s)) return FRESH_S;
  return Math.min(MAX_BACKOFF_S, Math.max(FRESH_S, Math.ceil(s)));
}

const ORIGIN_RE = /^(https:\/\/urnakombat\.com\.br|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;

export const allowedOrigin = (origin: string | null): origin is string => !!origin && ORIGIN_RE.test(origin);

/** Cabeçalhos CORS: ecoa só origens conhecidas; as demais recebem os dados sem ACAO. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Expose-Headers': 'X-Proxy-Cache, X-Proxy-Age, X-Proxy-Error, Retry-After',
  };
  if (allowedOrigin(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

/** Corpo só vale se for JSON (o CDN às vezes devolve página HTML de erro com 200). */
export function isJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Idade em segundos desde o fetch (cabeçalho interno X-Fetched-At, em ms). */
export function ageSeconds(fetchedAt: string | null, now = Date.now()): number {
  const t = Number(fetchedAt);
  return Number.isFinite(t) && t > 0 ? Math.max(0, Math.floor((now - t) / 1000)) : 0;
}
