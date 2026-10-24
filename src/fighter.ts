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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Fighter {
  readonly el: HTMLElement;
  private head: HTMLElement;
  readonly look: Look;

  constructor(
    parent: HTMLElement,
    readonly side: 0 | 1,
    readonly cand: Candidate,
    photo: string,
  ) {
    this.look = LOOKS[cand.number] ?? FALLBACK[side];
    this.el = document.createElement('div');
    this.el.className = `fighter ${side === 0 ? 'left' : 'right'}`;
    this.el.innerHTML = `
      <div class="shadow"></div>
      <div class="flip"><div class="rig">
        ${bodySvg(this.look)}
        <div class="head"><img alt="${cand.name}" src="${photo}" style="object-position:${this.look.focus}"></div>
      </div></div>`;
    this.head = this.el.querySelector('.head')!;
    parent.appendChild(this.el);
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
