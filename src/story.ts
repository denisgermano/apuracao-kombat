// Imagem vertical (1080×1920) do placar para Stories/WhatsApp, desenhada num canvas.

import { COLORS, drawTrend, type Point } from './chart';
import type { Snapshot } from './tse';

const W = 1080;
const H = 1920;
const FONT = '"Press Start 2P", monospace';

export interface StoryText {
  headline: string; // "LULA WINS" ou "63,20% DAS SEÇÕES APURADAS"
  votes: [string, string]; // "51.234.567 votos"
  pct: [string, string]; // "51,20%"
  footer: string;
  trend: Point[];
  sim: string; // tarja da simulação (vazio no ao vivo): a imagem não pode passar por resultado real
}

/** Carrega a foto do TSE com CORS (sem isso o canvas fica "sujo" e não exporta). */
function loadPhoto(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // query extra: evita reaproveitar a cópia do <img> da arena, baixada sem CORS
    img.src = `${src}${src.includes('?') ? '&' : '?'}cors=1`;
  });
}

/** Diminui a fonte até o texto caber na largura. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number) {
  do ctx.font = `${size}px ${FONT}`;
  while (ctx.measureText(text).width > max && --size > 10);
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, stroke = 8) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export async function storyImage(s: Snapshot, winner: 0 | 1 | null, photos: [string, string], txt: StoryText): Promise<Blob> {
  await document.fonts.load(`40px ${FONT}`).catch(() => {});
  const imgs = await Promise.all(photos.map(loadPhoto));

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2a0f3a');
  bg.addColorStop(0.6, '#120a1c');
  bg.addColorStop(1, '#050308');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  fit(ctx, 'URNA KOMBAT', W - 120, 92);
  outlined(ctx, 'URNA KOMBAT', W / 2, 230, '#ffd23f', 12);
  ctx.font = `30px ${FONT}`;
  outlined(ctx, '2º TURNO · 2026', W / 2, 310, '#fff8e7', 6);

  // fotos lado a lado, vencedor com moldura dourada e perdedor em cinza
  const pw = 400, ph = 480, py = 400;
  const nameLines = Math.max(...s.candidates.map((c) => c.name.split(' ').length)); // % alinhados
  ([0, 1] as const).forEach((i) => {
    const x = i === 0 ? 100 : W - 100 - pw;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 12, py - 12, pw + 24, ph + 24);
    const img = imgs[i];
    if (img) {
      const scale = Math.max(pw / img.width, ph / img.height);
      const sw = pw / scale, sh = ph / scale;
      ctx.save();
      if (winner !== null && winner !== i) ctx.filter = 'grayscale(1) brightness(0.7)';
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.2, sw, sh, x, py, pw, ph);
      ctx.restore();
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = winner === i ? '#ffd23f' : COLORS[i];
    ctx.strokeRect(x - 5, py - 5, pw + 10, ph + 10);

    const cx = x + pw / 2;
    const words = s.candidates[i].name.split(' ');
    words.forEach((w, k) => {
      fit(ctx, w, pw, 34);
      outlined(ctx, w, cx, py + ph + 80 + k * 50, '#fff8e7', 6);
    });
    const base = py + ph + 80 + nameLines * 50 + 70;
    fit(ctx, txt.pct[i], pw, 72);
    outlined(ctx, txt.pct[i], cx, base, winner === i ? '#ffd23f' : '#fff8e7', 10);
    fit(ctx, txt.votes[i], pw, 22);
    outlined(ctx, txt.votes[i], cx, base + 55, '#c9c2d6', 5);
  });

  drawTrend(ctx, txt.trend, 100, 1235, W - 200, 130);

  // barra dividida pelos % dos válidos, com marca de 50%
  const bx = 100, bw = W - 200, by = 1420, bh = 56;
  const share = s.validVotes > 0 ? s.candidates[0].pct / (s.candidates[0].pct + s.candidates[1].pct) : 0.5;
  ctx.fillStyle = '#000';
  ctx.fillRect(bx - 8, by - 8, bw + 16, bh + 16);
  ctx.fillStyle = COLORS[0];
  ctx.fillRect(bx, by, bw * share, bh);
  ctx.fillStyle = COLORS[1];
  ctx.fillRect(bx + bw * share, by, bw * (1 - share), bh);
  ctx.fillStyle = '#fff';
  ctx.fillRect(W / 2 - 3, by - 14, 6, bh + 28);

  const lines = txt.headline.length > 18 && winner !== null ? txt.headline.replace(/ (?=WINS$)/, '\n').split('\n') : [txt.headline];
  lines.forEach((l, k) => {
    fit(ctx, l, W - 120, winner !== null ? 76 : 40);
    outlined(ctx, l, W / 2, 1620 + k * 100, winner !== null ? '#ffd23f' : '#fff8e7', 10);
  });

  ctx.font = `40px ${FONT}`;
  outlined(ctx, 'urnakombat.com.br', W / 2, 1810, '#ffd23f', 8);
  fit(ctx, txt.footer, W - 120, 20);
  outlined(ctx, txt.footer, W / 2, 1870, '#c9c2d6', 4);

  if (txt.sim) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.42);
    ctx.globalAlpha = 0.55;
    fit(ctx, txt.sim, H - 200, 64);
    for (const dy of [-560, 0, 560]) outlined(ctx, txt.sim, 0, dy, '#ff3b30', 10);
    ctx.restore();
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
