// Leitura da apuração oficial do TSE (arquivos JSON estáticos no CDN, CORS liberado).
// Os dados passam pelo proxy (Cloudflare Worker com cache de borda): o CDN do TSE devolve 429
// para IPs compartilhados (iCloud Private Relay). Fotos vão direto ao TSE.

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';
const PROXY = 'https://tse.urnakombat.com.br/oficial/ele2026';
const PROXY_MAX_FAILS = 3;
const DIRECT_MS = 10 * 60_000; // depois de 3 falhas seguidas do proxy, 10 min direto no TSE
export const ELEICAO_2T = '6258';
const POLL_MS = 30_000;

// 429 do CDN do TSE: todo mundo (placar e letreiro dos estados) espera até essa hora.
let blockedUntil = 0;
export const throttled = () => Date.now() < blockedUntil;
const jitter = (ms: number) => Math.round(ms * (0.8 + Math.random() * 0.4)); // espalha os visitantes no tempo

export class RateLimited extends Error {
  constructor(public wait: number) {
    super('429');
  }
}

/** Marca o bloqueio pedido pelo TSE (Retry-After em segundos) ou um mínimo de 60s. */
export function rateLimited(res: Response, attempt: number): RateLimited {
  const after = Number(res.headers.get('retry-after')) * 1000;
  const wait = jitter(Math.min(300_000, Math.max(after || 0, 60_000 * 2 ** Math.min(attempt, 2))));
  blockedUntil = Math.max(blockedUntil, Date.now() + wait);
  return new RateLimited(wait);
}

export interface Candidate {
  number: string;
  name: string;
  sq: string;
  seq: number;
  votes: number;
  pct: number; // % dos votos válidos
  elected: boolean;
  status: string;
}

export const byNumber = (a: Candidate, b: Candidate) => Number(a.number) - Number(b.number);

export interface Snapshot {
  key: string; // muda a cada nova publicação
  date: string;
  time: string;
  pctSections: number; // % de seções totalizadas
  electorate: number;
  remainingVoters: number; // eleitores em seções ainda não totalizadas
  validVotes: number;
  final: boolean;
  candidates: [Candidate, Candidate]; // ordenados pelo número (13 à esquerda, 22 à direita), fixos a noite toda
}

/** Base do proxy: VITE_TSE_PROXY sobrescreve; string vazia desliga (vai direto ao TSE). */
export function proxyBase(): string {
  const env = import.meta.env.VITE_TSE_PROXY;
  return (env ?? PROXY).replace(/\/+$/, '');
}

export const resultUrl = (ele: string, uf = 'br', base = proxyBase() || BASE) =>
  `${base}/${ele}/dados/${uf}/${uf}-c0001-e${ele.padStart(6, '0')}-u.json`;

let proxyFails = 0;
let directUntil = 0;

/** Zera o estado do proxy (testes). */
export function resetProxy() {
  proxyFails = 0;
  directUntil = 0;
}

/**
 * Busca um arquivo de resultado: proxy primeiro; se o próprio proxy cair (rede/CORS, 5xx dele, rota
 * recusada), repete direto no TSE. Respostas do TSE repassadas pelo proxy (X-Proxy-Error: upstream,
 * ex.: 404 de arquivo ainda não publicado, 502/503 sem cópia velha) e 429 voltam como estão: quem chama
 * faz o backoff, sem levar todo mundo de volta ao CDN do TSE.
 */
export async function fetchResult(ele: string, uf = 'br', signal?: AbortSignal): Promise<Response> {
  const base = proxyBase();
  if (base && Date.now() >= directUntil) {
    try {
      // cache padrão: a borda já revalida e o max-age=10 do proxy basta
      const res = await fetch(resultUrl(ele, uf, base), { signal });
      const kind = res.headers.get('X-Proxy-Error');
      if (kind === 'upstream' || (res.status < 500 && !(res.status === 404 && kind === 'route'))) {
        if (res.ok) proxyFails = 0;
        return res;
      }
    } catch (err) {
      if (signal?.aborted) {
        proxyFailed();
        throw err;
      }
    }
    proxyFailed();
  }
  // no-cache: revalida com o CDN (etag) em vez de usar cópia velha do navegador.
  return fetch(resultUrl(ele, uf, BASE), { cache: 'no-cache', signal });
}

function proxyFailed() {
  if (++proxyFails >= PROXY_MAX_FAILS) {
    proxyFails = 0;
    directUntil = Date.now() + DIRECT_MS;
  }
}

/** Uma leitura só (replay ilustrativo parte do resultado mais recente). */
export async function fetchOnce(ele: string): Promise<Snapshot> {
  const res = await fetchResult(ele);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseResult(await res.json());
}

export const photoUrl = (ele: string, sq: string) => `${BASE}/${ele}/fotos/br/${sq}.jpeg`;

// O TSE usa vírgula decimal ("47,027772356").
const num = (s: unknown) => {
  const n = parseFloat(String(s ?? '0').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function parseResult(raw: any): Snapshot {
  const cargo = raw.carg?.[0];
  const all: Candidate[] = [];
  for (const agr of cargo?.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        all.push({
          number: String(c.n),
          name: String(c.nmu ?? c.nm),
          sq: String(c.sqcand),
          seq: num(c.seq),
          votes: num(c.vap),
          pct: num(c.pvapn),
          elected: String(c.st ?? '').startsWith('Eleito'), // e='s' também marca quem foi ao 2º turno
          status: String(c.st ?? ''),
        });
      }
    }
  }
  if (all.length < 2) throw new Error('Arquivo do TSE sem dois candidatos');

  // No 1º turno há vários candidatos: a luta é entre os dois mais votados.
  const top = [...all].sort((a, b) => b.votes - a.votes || a.seq - b.seq).slice(0, 2);
  // seq é a posição no ranking do TSE (muda numa virada): o lado de cada um vem do número.
  top.sort(byNumber);

  return {
    key: `${raw.idg}-${raw.dg}-${raw.hg}`,
    date: String(raw.dg ?? ''),
    time: String(raw.hg ?? ''),
    pctSections: num(raw.s?.pstn),
    electorate: num(raw.e?.te),
    remainingVoters: num(raw.e?.esnt),
    validVotes: num(raw.v?.vv),
    final: raw.tf === 's',
    candidates: [top[0], top[1]],
  };
}

export type Status =
  | { kind: 'ok'; at: Date }
  | { kind: 'error'; message: string; retryIn: number }
  | { kind: 'busy'; retryIn: number };

export class TseSource {
  private lastKey = '';
  private failures = 0;

  constructor(
    private ele: string,
    private onSnapshot: (s: Snapshot) => void,
    private onStatus: (s: Status) => void,
  ) {}

  start() {
    void this.tick();
  }

  private async tick() {
    let delay = jitter(POLL_MS);
    if (throttled()) {
      setTimeout(() => void this.tick(), blockedUntil - Date.now());
      return;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetchResult(this.ele, 'br', ctrl.signal);
      clearTimeout(timer);
      if (res.status === 429) throw rateLimited(res, this.failures);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const snap = parseResult(await res.json());
      this.failures = 0;
      this.onStatus({ kind: 'ok', at: new Date() });
      if (snap.key !== this.lastKey) {
        this.lastKey = snap.key;
        this.onSnapshot(snap);
      }
    } catch (err) {
      this.failures++;
      if (err instanceof RateLimited) {
        delay = err.wait;
        this.onStatus({ kind: 'busy', retryIn: delay });
      } else {
        delay = jitter(Math.min(120_000, 10_000 * 2 ** (this.failures - 1)));
        this.onStatus({ kind: 'error', message: (err as Error).message, retryIn: delay });
      }
    }
    setTimeout(() => void this.tick(), delay);
  }
}
