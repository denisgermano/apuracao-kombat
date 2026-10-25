// Histórico da apuração gravado no navegador de quem acompanhou (o TSE só publica o
// arquivo mais recente), usado no gráfico da noite e no "rever a luta".

import type { Snapshot } from './tse';

const key = (ele: string) => `hist-${ele}`;

export function loadHistory(ele: string): Snapshot[] {
  try {
    const h = JSON.parse(localStorage.getItem(key(ele)) ?? '[]');
    return Array.isArray(h) ? h.filter((s) => s?.candidates?.length === 2) : [];
  } catch {
    return [];
  }
}

export function saveHistory(ele: string, h: Snapshot[]) {
  try {
    localStorage.setItem(key(ele), JSON.stringify(h));
  } catch {
    // sem storage ou cheio: o histórico vale só para esta visita
  }
}

const leader = (s: Snapshot) => (s.candidates[0].votes >= s.candidates[1].votes ? 0 : 1);

/** Até `max` quadros, sempre mantendo o primeiro, o último e todas as viradas. */
export function sample(h: Snapshot[], max = 40): Snapshot[] {
  if (h.length <= max) return h;
  const keep = new Set([0, h.length - 1]);
  for (let i = 1; i < h.length; i++) if (leader(h[i]) !== leader(h[i - 1])) keep.add(i);
  const step = (h.length - 1) / (max - 1);
  for (let i = 0; keep.size < max && i < max; i++) keep.add(Math.round(i * step));
  return [...keep].sort((a, b) => a - b).map((i) => h[i]);
}

/**
 * Replay ilustrativo para quem chegou depois: parte do resultado final do TSE e reconstrói
 * uma apuração em que o vencedor lidera do começo ao fim (não inventa virada que não houve).
 */
export function synthReplay(final: Snapshot, steps = 30): Snapshot[] {
  const [a, b] = final.candidates;
  const baseA = (100 * a.pct) / (a.pct + b.pct || 1); // só os dois somam 100% (no 1º turno há outros)
  const w = leader(final);
  const frames: Snapshot[] = [];
  for (let k = 1; k < steps; k++) {
    const p = +(100 * (1 - (1 - k / steps) ** 1.6)).toFixed(2); // passos maiores no começo
    const left = 1 - p / 100;
    const shareA = baseA + (w === 0 ? 1 : -1) * 1.8 * left ** 1.5;
    const vv = Math.round((final.validVotes * p) / 100);
    const va = Math.round((vv * shareA) / 100);
    frames.push({
      ...final,
      key: `synth-${k}`,
      final: false,
      pctSections: p,
      validVotes: vv,
      remainingVoters: Math.round(final.electorate * left),
      candidates: [
        { ...final.candidates[0], votes: va, pct: shareA, elected: false, status: '' },
        { ...final.candidates[1], votes: vv - va, pct: 100 - shareA, elected: false, status: '' },
      ],
    });
  }
  return [...frames, final];
}

export function startReplay(frames: Snapshot[], onSnapshot: (s: Snapshot) => void, stepMs = 1400) {
  let i = 0;
  const next = () => {
    onSnapshot({ ...frames[i], key: `replay-${i}` });
    if (++i < frames.length) setTimeout(next, stepMs);
  };
  setTimeout(next, 1200);
}
