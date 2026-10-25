// Placar por estado (arquivos por UF do TSE), para o letreiro embaixo da arena.

import { parseResult, rateLimited, resultUrl, throttled, type Snapshot } from './tse';

const UFS = 'sp mg rj ba pr rs pe ce pa sc go ma am es pb mt rn pi al df ms se ro to ac ap rr zz'.split(' ');
const POLL_MS = 5 * 60_000; // 28 arquivos (~9 KB cada); no-cache revalida e quase sempre vira 304

export type StateRow = { uf: string; s: Snapshot };

export class StatesSource {
  private rows = new Map<string, Snapshot>();

  constructor(
    private ele: string,
    private onUpdate: (rows: StateRow[]) => void,
  ) {}

  start() {
    void this.tick();
  }

  private async tick() {
    if (document.visibilityState === 'visible' && !throttled()) {
      const queue = [...UFS];
      const worker = async () => {
        for (let uf; (uf = queue.shift()) && !throttled(); ) {
          try {
            const res = await fetch(resultUrl(this.ele, uf), { cache: 'no-cache' });
            if (res.status === 429) rateLimited(res, 1); // o placar principal tem prioridade
            else if (res.ok) this.rows.set(uf, parseResult(await res.json()));
          } catch {
            // um estado fora do ar não derruba o letreiro
          }
        }
      };
      await Promise.all(Array.from({ length: 2 }, worker));
      this.onUpdate(UFS.filter((uf) => this.rows.get(uf)?.validVotes).map((uf) => ({ uf, s: this.rows.get(uf)! })));
    }
    setTimeout(() => void this.tick(), POLL_MS * (0.8 + Math.random() * 0.4));
  }
}
