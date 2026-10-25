// Placar por estado (arquivos por UF do TSE), para o letreiro embaixo da arena.

import { parseResult, resultUrl, type Snapshot } from './tse';

const UFS = 'sp mg rj ba pr rs pe ce pa sc go ma am es pb mt rn pi al df ms se ro to ac ap rr zz'.split(' ');
const POLL_MS = 3 * 60_000; // 28 arquivos (~9 KB cada); no-cache revalida e quase sempre vira 304

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
    if (document.visibilityState === 'visible') {
      const queue = [...UFS];
      const worker = async () => {
        for (let uf; (uf = queue.shift()); ) {
          try {
            const res = await fetch(resultUrl(this.ele, uf), { cache: 'no-cache' });
            if (res.ok) this.rows.set(uf, parseResult(await res.json()));
          } catch {
            // um estado fora do ar não derruba o letreiro
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      this.onUpdate(UFS.filter((uf) => this.rows.get(uf)?.validVotes).map((uf) => ({ uf, s: this.rows.get(uf)! })));
    }
    setTimeout(() => void this.tick(), POLL_MS);
  }
}
