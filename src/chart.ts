// Gráfico da noite: diferença (p.p.) entre os dois ao longo da apuração (% das seções).
// Acima da linha do zero fica a cor do lutador da esquerda; abaixo, a do da direita.

export type Point = { p: number; m: number }; // % das seções, pct esquerda − pct direita
export const COLORS = ['#e8322b', '#19a34a'] as const;

const range = (pts: Point[]) => Math.max(2, ...pts.map((q) => Math.abs(q.m))) * 1.1;

export function trendSvg(pts: Point[]): string {
  if (pts.length < 2) return '';
  const r = range(pts);
  const y = (m: number) => 20 - (m / r) * 20;
  const line = pts.map((q) => `${q.p.toFixed(2)},${y(q.m).toFixed(2)}`).join(' ');
  const area = `${pts[0].p},20 ${line} ${pts.at(-1)!.p},20`;
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
    <clipPath id="tr-top"><rect width="100" height="20"/></clipPath>
    <clipPath id="tr-bot"><rect y="20" width="100" height="20"/></clipPath>
    <polygon points="${area}" fill="${COLORS[0]}" clip-path="url(#tr-top)"/>
    <polygon points="${area}" fill="${COLORS[1]}" clip-path="url(#tr-bot)"/>
    <line x1="0" y1="20" x2="100" y2="20" stroke="#fff6" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>
    <polyline points="${line}" fill="none" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/** Mesmo gráfico no canvas da imagem de Stories. */
export function drawTrend(ctx: CanvasRenderingContext2D, pts: Point[], x: number, top: number, w: number, h: number) {
  if (pts.length < 2) return;
  const r = range(pts);
  const mid = top + h / 2;
  const X = (p: number) => x + (p / 100) * w;
  const Y = (m: number) => mid - (m / r) * (h / 2);
  ctx.fillStyle = '#0008';
  ctx.fillRect(x - 8, top - 8, w + 16, h + 16);
  ([0, 1] as const).forEach((side) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, side === 0 ? top : mid, w, h / 2);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(X(pts[0].p), mid);
    pts.forEach((q) => ctx.lineTo(X(q.p), Y(q.m)));
    ctx.lineTo(X(pts.at(-1)!.p), mid);
    ctx.fillStyle = COLORS[side];
    ctx.fill();
    ctx.restore();
  });
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#fff6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, mid);
  ctx.lineTo(x + w, mid);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(X(q.p), Y(q.m)) : ctx.moveTo(X(q.p), Y(q.m))));
  ctx.stroke();
}
