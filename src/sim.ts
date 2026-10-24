// Apuração sintética para testar a luta antes do horário real (?sim=1).
import type { Candidate, Snapshot } from './tse';

const ELECTORATE = 158_745_502;
const FINAL_VALID = 120_000_000;

const base = (number: string, name: string, sq: string, seq: number): Candidate => ({
  number, name, sq, seq, votes: 0, pct: 0, elected: false, status: '',
});

export function startSim(onSnapshot: (s: Snapshot) => void, stepMs = 3000) {
  let p = 0;
  let n = 0;
  // Quem lidera cedo e sofre a virada perto dos 70% é sorteado a cada simulação.
  const flip = Math.random() < 0.5;
  const emit = () => {
    const early = 54 - 6 * (p / 100) ** 1.3 + (Math.random() - 0.5) * 0.4;
    const shareRight = p === 0 ? 0 : flip ? 100 - early : early;
    const vv = Math.round((FINAL_VALID * p) / 100);
    const right = Math.round((vv * shareRight) / 100);
    const left = vv - right;
    const pct = (v: number) => (vv ? (100 * v) / vv : 0);
    const a = { ...base('13', 'LULA', '280002542548', 1), votes: left, pct: pct(left) };
    const b = { ...base('22', 'FLAVIO BOLSONARO', '280002551544', 2), votes: right, pct: pct(right) };
    if (p >= 100) {
      const w = left > right ? a : b;
      w.elected = true;
      w.status = 'Eleito';
    }
    const now = new Date();
    onSnapshot({
      key: String(n++),
      date: now.toLocaleDateString('pt-BR'),
      time: now.toLocaleTimeString('pt-BR'),
      pctSections: p,
      electorate: ELECTORATE,
      remainingVoters: Math.round((ELECTORATE * (100 - p)) / 100),
      validVotes: vv,
      final: p >= 100,
      candidates: [a, b],
    });
    if (p >= 100) return;
    // passos maiores no começo, pequenos no fim — como a apuração real
    p = Math.min(100, +(p + (p < 30 ? 4 + Math.random() * 6 : 1 + Math.random() * 4)).toFixed(2));
    setTimeout(emit, stepMs);
  };
  setTimeout(emit, 1500);
}
