// Lutador: foto oficial do TSE como cabeça gigante sobre um corpo cartoon em SVG.
import type { Candidate } from './tse';

export type Pose = 'jab' | 'punch' | 'kick' | 'special' | 'hit' | 'hit-big';
export type State = 'dizzy' | 'ko' | 'win' | null;

interface Look {
  shirt: string;
  accent: string;
  glove: string;
  pants: string;
  emblem: string;
  focus: string; // object-position da foto
}

const LOOKS: Record<string, Look> = {
  '13': { shirt: '#d7191c', accent: '#fff', glove: '#8f0000', pants: '#1f2a44', emblem: '13', focus: '50% 35%' },
  '22': { shirt: '#009c3b', accent: '#ffdf00', glove: '#ffdf00', pants: '#14306b', emblem: '22', focus: '50% 18%' },
};
const FALLBACK: Look[] = [
  { shirt: '#c0392b', accent: '#fff', glove: '#7b241c', pants: '#222', emblem: '', focus: '50% 25%' },
  { shirt: '#2471a3', accent: '#fff', glove: '#1a5276', pants: '#222', emblem: '', focus: '50% 25%' },
];

export type Style = 'cartoon' | 'real';

interface Outfit {
  skin: string;
  jacket: string; // terno ou camisa (tronco e mangas)
  shirt: string; // camisa aparecendo no decote
  tie: string | null;
  pants: string;
  shoes: string;
  focus: string;
}

// Roupas iguais às das fotos oficiais, para a foto emendar no corpo.
const OUTFITS: Record<string, Outfit> = {
  '13': { skin: '#d49a7c', jacket: '#1f3160', shirt: '#eef2f7', tie: '#4f86c6', pants: '#1a2747', shoes: '#141414', focus: '50% 30%' },
  '22': { skin: '#dfa98a', jacket: '#b9cfe6', shirt: '#b9cfe6', tie: null, pants: '#2b2f3a', shoes: '#1c140f', focus: '50% 16%' },
};
const FALLBACK_OUTFIT: Outfit = { skin: '#d9a184', jacket: '#333', shirt: '#eee', tie: null, pants: '#222', shoes: '#111', focus: '50% 25%' };

const SKIN = '#e9b48f';
const INK = '#111';

function bodySvg(l: Look): string {
  // Desenhado olhando para a direita; o lado direito é espelhado via CSS.
  return `
<svg viewBox="0 0 200 300" class="body" aria-hidden="true">
  <g class="part leg back" style="transform-origin:90px 190px">
    <rect x="80" y="188" width="22" height="88" rx="10" fill="${l.pants}" stroke="${INK}" stroke-width="3"/>
    <path d="M78 270 h34 a8 8 0 0 1 0 16 h-34 z" fill="${INK}"/>
  </g>
  <g class="part arm back" style="transform-origin:84px 120px">
    <rect x="75" y="118" width="18" height="44" rx="9" fill="${l.shirt}" stroke="${INK}" stroke-width="3"/>
    <rect x="76" y="156" width="16" height="30" rx="8" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
    <circle cx="84" cy="194" r="16" fill="${l.glove}" stroke="${INK}" stroke-width="3"/>
  </g>
  <rect x="90" y="88" width="20" height="24" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
  <g class="part torso">
    <path d="M70 112 Q100 100 130 112 L125 198 L75 198 Z" fill="${l.shirt}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="74" y="186" width="52" height="12" fill="${l.accent}" stroke="${INK}" stroke-width="3"/>
    <text class="emblem" x="100" y="166" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="22"
      fill="${l.accent}" stroke="${INK}" stroke-width="1.5">${l.emblem}</text>
  </g>
  <g class="part leg front" style="transform-origin:110px 190px">
    <rect x="99" y="188" width="22" height="88" rx="10" fill="${l.pants}" stroke="${INK}" stroke-width="3"/>
    <path d="M97 270 h34 a8 8 0 0 1 0 16 h-34 z" fill="${INK}"/>
  </g>
  <g class="part arm front" style="transform-origin:117px 120px">
    <rect x="108" y="118" width="18" height="44" rx="9" fill="${l.shirt}" stroke="${INK}" stroke-width="3"/>
    <rect x="109" y="156" width="16" height="30" rx="8" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
    <circle cx="117" cy="194" r="17" fill="${l.glove}" stroke="${INK}" stroke-width="3"/>
  </g>
</svg>`;
}

// Manchas irregulares (bolha com contorno ondulado), determinísticas para não "pularem" entre renders.
function blob(cx: number, cy: number, r: number, seed: number): string {
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const k = 0.7 + 0.45 * Math.abs(Math.sin(seed * 12.9898 + i * 78.233));
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
  const mid = (i: number) => {
    const [x1, y1] = pts[i % pts.length];
    const [x2, y2] = pts[(i + 1) % pts.length];
    return `${((x1 + x2) / 2).toFixed(1)} ${((y1 + y2) / 2).toFixed(1)}`;
  };
  let d = `M${mid(0)}`;
  for (let i = 1; i <= pts.length; i++) {
    const [x, y] = pts[i % pts.length];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${mid(i)}`;
  }
  return `${d} Z`;
}

// Sangue acumulado na roupa: cada nível (data-wounds=1..4) revela mais manchas.
const WOUNDS = `
  <g class="wounds" fill="#6e0000">
    <g class="w1"><path d="${blob(114, 108, 9, 1)}"/><rect x="113" y="112" width="3" height="20" rx="1.5"/></g>
    <g class="w2"><path d="${blob(86, 134, 12, 2)}"/><rect x="84" y="140" width="3" height="16" rx="1.5"/></g>
    <g class="w3"><path d="${blob(108, 152, 14, 3)}"/><path d="${blob(126, 98, 7, 4)}"/><circle cx="96" cy="118" r="2.5"/></g>
    <g class="w4"><path d="${blob(94, 172, 16, 5)}"/><path d="${blob(118, 176, 10, 6)}"/><circle cx="128" cy="140" r="3"/><circle cx="74" cy="160" r="2.5"/><rect x="104" y="160" width="3" height="26" rx="1.5"/></g>
  </g>`;

function realSvg(o: Outfit, id: string): string {
  // Mesmo esqueleto de articulações do cartoon (ombro, quadril), com cotovelo e joelho.
  // Desenhado olhando para a direita; membros de trás levam sombra.
  const g = (name: string) => `url(#${id}-${name})`;
  const arm = (cls: string, x: number) => `
  <g class="part arm ${cls}" style="transform-origin:${x}px 90px">
    <rect x="${x - 10}" y="86" width="20" height="58" rx="10" fill="${g('cloth')}"/>
    <g class="forearm" style="transform-origin:${x}px 140px">
      <rect x="${x - 9}" y="136" width="18" height="52" rx="9" fill="${g('cloth')}"/>
      <rect x="${x - 8}" y="184" width="16" height="6" rx="2" fill="${o.shirt}"/>
      <rect x="${x - 11}" y="188" width="22" height="22" rx="8" fill="${g('skin')}"/>
      <path d="M${x - 7} 196 h14 M${x - 7} 202 h14" stroke="#0003" stroke-width="1.5"/>
    </g>
  </g>`;
  const leg = (cls: string, x: number) => `
  <g class="part leg ${cls}" style="transform-origin:${x}px 186px">
    <rect x="${x - 13}" y="182" width="26" height="70" rx="12" fill="${g('pants')}"/>
    <g class="shin" style="transform-origin:${x}px 248px">
      <rect x="${x - 11}" y="244" width="22" height="64" rx="10" fill="${g('pants')}"/>
      <path d="M${x - 13} 302 h28 q10 0 10 8 v6 h-38 z" fill="${o.shoes}"/>
    </g>
  </g>`;
  const front = o.tie
    ? `<path d="M90 78 L100 116 L110 78 Z" fill="${o.shirt}"/>
       <path d="M97 84 h6 l3 34 l-6 9 l-6 -9 z" fill="${o.tie}"/>
       <path d="M86 80 L100 124 L92 104 Z M114 80 L100 124 L108 104 Z" fill="#0004"/>
       <circle cx="100" cy="150" r="2" fill="#0006"/><circle cx="100" cy="166" r="2" fill="#0006"/>`
    : `<path d="M93 76 L100 92 L107 76 Z" fill="${g('skin')}"/>
       <path d="M100 92 V182" stroke="#0002" stroke-width="1.5"/>
       <circle cx="100" cy="110" r="1.6" fill="#0003"/><circle cx="100" cy="136" r="1.6" fill="#0003"/>
       <circle cx="100" cy="162" r="1.6" fill="#0003"/>`;
  return `
<svg viewBox="0 0 200 320" class="body real" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-cloth" x1="0" x2="1">
      <stop offset="0" stop-color="${o.jacket}" stop-opacity="1"/>
      <stop offset="0.55" stop-color="${o.jacket}"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="${id}-torso" x1="0" x2="1">
      <stop offset="0" stop-color="${o.jacket}"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${o.jacket}"/>
    </linearGradient>
    <linearGradient id="${id}-pants" x1="0" x2="1">
      <stop offset="0" stop-color="${o.pants}"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <radialGradient id="${id}-skin" cx="0.35" cy="0.3" r="0.9">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="0.4" stop-color="${o.skin}"/>
      <stop offset="1" stop-color="#7a4a35"/>
    </radialGradient>
  </defs>
  <g class="shade">${leg('back', 89)}${arm('back', 70)}</g>
  <rect x="91" y="56" width="18" height="30" rx="6" fill="${g('skin')}"/>
  <g class="part torso">
    <path d="M64 84 Q100 72 136 84 Q145 90 142 106 L133 150 L128 188 L72 188 L67 150 L58 106 Q55 90 64 84 Z" fill="${o.jacket}"/>
    <path d="M64 84 Q100 72 136 84 Q145 90 142 106 L133 150 L128 188 L72 188 L67 150 L58 106 Q55 90 64 84 Z" fill="${g('torso')}"/>
    ${front}
    ${WOUNDS}
    <rect x="72" y="180" width="56" height="9" rx="2" fill="#151515"/>
    <rect x="96" y="180" width="9" height="9" rx="1" fill="#9a8a5a"/>
  </g>
  ${leg('front', 111)}${arm('front', 130)}
</svg>`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Fighter {
  readonly el: HTMLElement;
  private head!: HTMLElement;
  readonly look: Look;
  private outfit: Outfit;
  private style: Style;

  constructor(
    parent: HTMLElement,
    readonly side: 0 | 1,
    readonly cand: Candidate,
    private photo: string,
    style: Style,
  ) {
    this.look = LOOKS[cand.number] ?? FALLBACK[side];
    this.outfit = OUTFITS[cand.number] ?? FALLBACK_OUTFIT;
    this.style = style;
    this.el = document.createElement('div');
    this.el.className = `fighter ${side === 0 ? 'left' : 'right'}`;
    this.render();
    parent.appendChild(this.el);
  }

  setStyle(style: Style) {
    this.style = style;
    this.render();
  }

  /** Quanto o golpe precisa avançar além do vão entre os dois (o braço realista é mais longo). */
  get reachOffset() {
    return this.style === 'real' ? 30 : 60;
  }

  private render() {
    const real = this.style === 'real';
    const focus = real ? this.outfit.focus : this.look.focus;
    this.el.innerHTML = `
      <div class="shadow"></div>
      <div class="flip"><div class="rig">
        ${real ? realSvg(this.outfit, `f${this.side}`) : bodySvg(this.look)}
        <div class="head"><img alt="${this.cand.name}" src="${this.photo}" style="object-position:${focus}"></div>
      </div></div>`;
    this.head = this.el.querySelector('.head')!;
  }

  /** Executa uma pose e resolve quando termina. */
  async play(pose: Pose, ms: number) {
    this.el.classList.remove(pose);
    void this.el.offsetWidth; // reinicia a animação se a mesma pose repetir
    this.el.style.setProperty('--dur', `${ms}ms`);
    this.el.classList.add(pose);
    await wait(ms);
    this.el.classList.remove(pose);
  }

  /** Mais uma camada de sangue na roupa (só aparece no estilo realista). */
  addWound(levels = 1) {
    const n = Math.min(4, Number(this.el.dataset.wounds ?? 0) + levels);
    this.el.dataset.wounds = String(n);
  }

  /** Centro do peito: de onde o sangue sai (longe da foto do rosto). */
  chestPoint(relativeTo: HTMLElement) {
    const r = this.el.querySelector('.body')!.getBoundingClientRect();
    const o = relativeTo.getBoundingClientRect();
    return { x: r.left + r.width / 2 - o.left, y: r.top + r.height * 0.4 - o.top };
  }

  setState(state: State) {
    this.el.classList.remove('dizzy', 'ko', 'win');
    if (state) this.el.classList.add(state);
  }

  /** Centro da cabeça, em coordenadas do elemento `relativeTo`. */
  headPoint(relativeTo: HTMLElement) {
    const r = this.head.getBoundingClientRect();
    const o = relativeTo.getBoundingClientRect();
    return { x: r.left + r.width / 2 - o.left, y: r.top + r.height / 2 - o.top };
  }

  /** Ponto do punho estendido (para lançar o projétil). */
  handPoint(relativeTo: HTMLElement) {
    const r = this.el.getBoundingClientRect();
    const o = relativeTo.getBoundingClientRect();
    const x = this.side === 0 ? r.right : r.left;
    return { x: x - o.left, y: r.top + r.height * 0.5 - o.top };
  }

  setReach(px: number) {
    this.el.style.setProperty('--reach', `${px}px`);
  }
}
