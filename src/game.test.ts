import { describe, expect, it } from 'vitest';
import { clock, diff, health, winner } from './game';
import { parseResult, type Snapshot } from './tse';
import turno1 from './fixtures/turno1-final.json';
import turno2 from './fixtures/turno2-zerado.json';

function snap(pctSections: number, votesA: number, votesB: number, remaining: number): Snapshot {
  const vv = votesA + votesB;
  const pct = (v: number) => (vv ? (100 * v) / vv : 0);
  return {
    key: String(Math.random()),
    date: '',
    time: '',
    pctSections,
    electorate: 1000,
    remainingVoters: remaining,
    validVotes: vv,
    final: false,
    candidates: [
      { number: '13', name: 'A', sq: '1', seq: 1, votes: votesA, pct: pct(votesA), elected: false, status: '' },
      { number: '22', name: 'B', sq: '2', seq: 2, votes: votesB, pct: pct(votesB), elected: false, status: '' },
    ],
  };
}

describe('parseResult', () => {
  it('lê o resultado final do 1º turno (dois mais votados)', () => {
    const s = parseResult(turno1);
    expect(s.pctSections).toBe(100);
    expect(s.remainingVoters).toBe(0);
    expect(s.final).toBe(true);
    const [a, b] = s.candidates;
    expect(a.name).toBe('LULA'); // 13 sempre à esquerda, mesmo atrás
    expect(a.pct).toBeCloseTo(45.16, 2);
    expect(b.name).toBe('FLAVIO BOLSONARO');
    expect(b.pct).toBeCloseTo(47.03, 2);
    // ninguém passou de 50% no 1º turno
    expect(winner(s)).toBeNull();
  });

  it('lê o arquivo zerado do 2º turno', () => {
    const s = parseResult(turno2);
    expect(s.pctSections).toBe(0);
    expect(s.validVotes).toBe(0);
    expect(s.candidates.map((c) => c.name)).toEqual(['LULA', 'FLAVIO BOLSONARO']);
    expect(health(s, 0)).toBe(100);
    expect(clock(s.pctSections)).toBe(99);
  });

  it('não troca os lados quando o TSE reordena o seq numa virada', () => {
    const raw = structuredClone(turno2) as typeof turno2;
    const cands = raw.carg[0].agr.flatMap((g) => g.par.flatMap((p) => p.cand));
    for (const c of cands) (c as { seq: unknown }).seq = String(c.n) === '22' ? '1' : '2';
    expect(parseResult(raw).candidates.map((c) => c.number)).toEqual(['13', '22']);
  });
});

describe('clock', () => {
  it('vai de 99 a 0 conforme a apuração', () => {
    expect(clock(0)).toBe(99);
    expect(clock(50)).toBe(50);
    expect(clock(100)).toBe(0);
    expect(clock(120)).toBe(0);
  });
});

describe('diff', () => {
  it('primeiros votos são first blood do líder', () => {
    const a = diff(snap(0, 0, 0, 1000), snap(1, 4, 6, 990));
    expect(a).toMatchObject({ attacker: 1, firstBlood: true });
  });

  it('quem ganha participação ataca, golpe escala com o delta', () => {
    const prev = snap(10, 5000, 5000, 900);
    expect(diff(prev, snap(11, 5005, 5000, 890))).toMatchObject({ attacker: 0, move: 'jab', reversal: false });
    expect(diff(prev, snap(11, 5000, 5040, 890))).toMatchObject({ attacker: 1, move: 'punch' });
    expect(diff(prev, snap(11, 5070, 5000, 890))).toMatchObject({ attacker: 0, move: 'kick' });
    expect(diff(prev, snap(11, 5200, 5000, 890))).toMatchObject({ attacker: 0, move: 'special' });
  });

  it('virada vira especial', () => {
    const a = diff(snap(50, 5010, 5000, 500), snap(51, 5010, 5020, 490));
    expect(a).toMatchObject({ attacker: 1, move: 'special', reversal: true });
  });

  it('nada mudou, nada acontece', () => {
    const s = snap(10, 5, 5, 900);
    expect(diff(s, { ...s, key: 'x' })).toBeNull();
  });
});

describe('winner', () => {
  it('só vence quando não há como virar', () => {
    expect(winner(snap(90, 520, 480, 100))).toBeNull(); // 1040 < 1100
    expect(winner(snap(95, 560, 400, 40))).toBe(0); // 1120 > 1000
  });

  it('empate sem eleitores restantes não tem vencedor', () => {
    expect(winner(snap(100, 500, 500, 0))).toBeNull();
  });

  it('última seção decide por 1 voto', () => {
    expect(winner(snap(100, 500, 501, 0))).toBe(1);
  });

  it('respeita a marcação de eleito do TSE', () => {
    const s = snap(99, 500, 490, 50);
    s.candidates[1].elected = true;
    expect(winner(s)).toBe(1);
  });
});
