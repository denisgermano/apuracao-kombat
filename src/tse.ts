// Leitura da apuração oficial do TSE (arquivos JSON estáticos no CDN, CORS liberado).

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';
export const ELEICAO_2T = '6258';
const POLL_MS = 20_000;

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

export interface Snapshot {
  key: string; // muda a cada nova publicação
  date: string;
  time: string;
  pctSections: number; // % de seções totalizadas
  electorate: number;
  remainingVoters: number; // eleitores em seções ainda não totalizadas
  validVotes: number;
  final: boolean;
  candidates: [Candidate, Candidate]; // ordenados pela posição (seq) — esquerda, direita
}

export const resultUrl = (ele: string) =>
  `${BASE}/${ele}/dados/br/br-c0001-e${ele.padStart(6, '0')}-u.json`;

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
  top.sort((a, b) => a.seq - b.seq);

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
  | { kind: 'error'; message: string; retryIn: number };

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
    let delay = POLL_MS;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      // no-cache: revalida com o CDN (etag) em vez de usar cópia velha do navegador.
      const res = await fetch(resultUrl(this.ele), { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(timer);
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
      delay = Math.min(60_000, 5_000 * 2 ** (this.failures - 1));
      this.onStatus({ kind: 'error', message: (err as Error).message, retryIn: delay });
    }
    setTimeout(() => void this.tick(), delay);
  }
}
