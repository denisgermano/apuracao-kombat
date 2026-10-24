// Regras puras da luta: relógio, vida, golpes e vitória.
import type { Snapshot } from './tse';

export type Move = 'jab' | 'punch' | 'kick' | 'special';

export interface Attack {
  attacker: 0 | 1;
  move: Move;
  delta: number; // variação em pontos percentuais do atacante
  reversal: boolean; // virada na liderança
  firstBlood: boolean; // primeiros votos da noite
}

/** Relógio estilo MK: 99 no início da apuração, 0 com 100% das seções totalizadas. */
export function clock(pctSections: number): number {
  const p = Math.min(100, Math.max(0, pctSections));
  return Math.round(99 * (1 - p / 100));
}

/** Vida = % dos votos válidos. Sem votos ainda, os dois começam com a barra cheia. */
export function health(s: Snapshot, i: 0 | 1): number {
  if (s.validVotes <= 0) return 100;
  return s.candidates[i].pct;
}

const leaderOf = (s: Snapshot): 0 | 1 | null => {
  const [a, b] = s.candidates;
  if (a.votes === b.votes) return null;
  return a.votes > b.votes ? 0 : 1;
};

/** Converte a diferença entre duas publicações em um golpe (ou null se nada mudou). */
export function diff(prev: Snapshot, next: Snapshot): Attack | null {
  const leader = leaderOf(next);
  if (next.validVotes <= 0) return null;

  if (prev.validVotes <= 0) {
    return { attacker: leader ?? 0, move: 'kick', delta: 0, reversal: false, firstBlood: true };
  }

  const delta0 = next.candidates[0].pct - prev.candidates[0].pct;
  const progressed =
    next.pctSections !== prev.pctSections || next.validVotes !== prev.validVotes;
  if (!progressed && delta0 === 0) return null;

  const prevLeader = leaderOf(prev);
  const reversal = prevLeader !== null && leader !== null && prevLeader !== leader;

  let attacker: 0 | 1;
  if (delta0 > 0) attacker = 0;
  else if (delta0 < 0) attacker = 1;
  else attacker = leader ?? 0;

  const d = Math.abs(delta0);
  let move: Move;
  if (reversal || d >= 0.5) move = 'special';
  else if (d >= 0.3) move = 'kick';
  else if (d >= 0.1) move = 'punch';
  else move = 'jab';

  return { attacker, move, delta: d, reversal, firstBlood: false };
}

/**
 * Vencedor matemático: o líder já tem mais da metade dos votos válidos possíveis,
 * mesmo que todo eleitor ainda não apurado votasse no adversário
 * (2·votos > válidos + eleitores restantes). Ou o TSE já o marcou como eleito.
 */
export function winner(s: Snapshot): 0 | 1 | null {
  const i = s.candidates.findIndex((c) => c.elected);
  if (i === 0 || i === 1) return i;
  if (s.validVotes <= 0) return null;
  const lead = leaderOf(s);
  if (lead === null) return null;
  return 2 * s.candidates[lead].votes > s.validVotes + s.remainingVoters ? lead : null;
}
