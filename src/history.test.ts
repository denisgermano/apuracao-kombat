import { describe, expect, it } from 'vitest';
import { sample, synthReplay } from './history';
import type { Snapshot } from './tse';

const snap = (p: number, a: number, b: number, key = String(p)): Snapshot => ({
  key, date: '', time: '', pctSections: p, electorate: 150e6, remainingVoters: 150e6 * (1 - p / 100),
  validVotes: a + b, final: p === 100,
  candidates: [
    { number: '13', name: 'A', sq: '1', seq: 1, votes: a, pct: (100 * a) / (a + b), elected: false, status: '' },
    { number: '22', name: 'B', sq: '2', seq: 2, votes: b, pct: (100 * b) / (a + b), elected: false, status: '' },
  ],
});

describe('synthReplay', () => {
  it('termina no resultado final e não inventa virada', () => {
    const final = snap(100, 60e6, 61e6);
    const frames = synthReplay(final);
    expect(frames.at(-1)).toBe(final);
    expect(frames.every((f) => f.candidates[1].votes > f.candidates[0].votes)).toBe(true);
    expect(frames.every((f, i) => i === 0 || f.pctSections > frames[i - 1].pctSections)).toBe(true);
  });

  it('mantém o líder quando os dois não somam 100% (1º turno)', () => {
    const final = snap(100, 56e6, 54e6);
    final.candidates[0].pct = 47.03;
    final.candidates[1].pct = 45.16;
    expect(synthReplay(final).every((f) => f.candidates[0].votes > f.candidates[1].votes)).toBe(true);
  });
});

describe('sample', () => {
  it('reduz mantendo primeiro, último e as viradas', () => {
    const h = Array.from({ length: 200 }, (_, i) => snap(i / 2, i === 137 ? 10 : 20, i === 137 ? 20 : 10));
    const out = sample(h, 20);
    expect(out.length).toBeLessThanOrEqual(22);
    expect(out[0]).toBe(h[0]);
    expect(out.at(-1)).toBe(h[199]);
    expect(out).toContain(h[137]);
    expect(out).toContain(h[138]);
  });
});
