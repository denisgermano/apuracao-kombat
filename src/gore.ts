// "Bloody mode" do estilo realista: gotas com gravidade que mancham o chão, respingos na
// câmera, poça de sangue e letreiro escorrendo. O sangue fica no corpo, no chão e na tela —
// nunca sobre as fotos dos candidatos (pessoas reais).

type Point = { x: number; y: number };

const MAX_SPLATS = 90;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class Gore {
  private splats: HTMLElement[] = [];

  constructor(private arena: HTMLElement) {}

  private el(className: string, x: number, y: number) {
    const el = document.createElement('div');
    el.className = className;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.arena.appendChild(el);
    return el;
  }

  /** Faixa do chão (em coordenadas da arena) onde as gotas caem. */
  private floorBand() {
    const floor = this.arena.querySelector('.floor')!.getBoundingClientRect();
    const o = this.arena.getBoundingClientRect();
    return { top: floor.top - o.top, height: floor.height };
  }

  /** Jato de gotas em arco; cada uma deixa uma mancha onde cai. `dir`: 1 = direita, -1 = esquerda. */
  burst(p: Point, count: number, power: number, dir: 1 | -1 | 0 = 0) {
    const band = this.floorBand();
    for (let i = 0; i < count; i++) {
      const size = rand(4, 9 + power * 2);
      const drop = this.el('drop', p.x, p.y);
      drop.style.width = drop.style.height = `${size}px`;
      const vx = (dir === 0 ? rand(-1, 1) : dir * rand(0.2, 1.1)) * rand(80, 160 + power * 70);
      const up = rand(60, 140 + power * 60);
      const landY = band.top + rand(4, band.height * 0.55) - p.y;
      const dur = rand(650, 1000 + power * 120);
      // parábola: sobe `up` e cai até o chão
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 10; k++) {
        const s = k / 10;
        const y = -up * 4 * s * (1 - s) * (1 - s * 0.2) + landY * s * s;
        frames.push({ transform: `translate(${vx * s}px, ${y}px) scale(${1 - s * 0.25})` });
      }
      drop.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => {
        drop.remove();
        this.splat({ x: p.x + vx, y: p.y + landY }, size);
      };
    }
  }

  /** Mancha no chão, que some devagar depois de um tempo. */
  splat(p: Point, size: number) {
    const s = this.el('splat', p.x, p.y);
    const w = size * rand(2.2, 4.5);
    s.style.width = `${w}px`;
    s.style.height = `${w * rand(0.28, 0.42)}px`;
    s.style.setProperty('--rot', `${rand(-12, 12)}deg`);
    this.splats.push(s);
    if (this.splats.length > MAX_SPLATS) this.splats.shift()!.remove();
    setTimeout(() => {
      s.classList.add('fade');
      setTimeout(() => {
        s.remove();
        this.splats = this.splats.filter((x) => x !== s);
      }, 4000);
    }, 40_000);
  }

  /** Respingos "na lente da câmera", que escorrem e somem. */
  screen(intensity: number, ms = 2600) {
    const layer = this.el('screen-blood', 0, 0);
    const blobs = 2 + intensity * 3;
    for (let i = 0; i < blobs; i++) {
      const b = document.createElement('i');
      // concentrados nas bordas, para não tapar o placar nem o centro da luta
      const left = Math.random() < 0.5 ? rand(-4, 20) : rand(78, 98);
      b.style.left = `${intensity >= 3 ? rand(-4, 98) : left}%`;
      b.style.top = `${rand(14, 80)}%`;
      const r = rand(16, 34 + intensity * 9);
      b.style.width = b.style.height = `${r}px`;
      // gotículas ao redor da mancha principal
      const dots = Array.from({ length: 5 }, () => {
        const x = rand(12, 88), y = rand(12, 88), d = rand(1.5, 4);
        return `radial-gradient(circle at ${x}% ${y}%, #7a0000dd ${d}%, transparent ${d + 1}%)`;
      });
      b.style.setProperty('--dots', dots.join(','));
      b.style.setProperty('--drip', `${rand(30, 140)}px`);
      b.style.animationDelay = `${rand(0, 120)}ms`;
      layer.appendChild(b);
    }
    layer.style.setProperty('--life', `${ms}ms`);
    setTimeout(() => layer.remove(), ms + 200);
  }

  /** Poça que cresce sob o lutador caído e fica até o fim. */
  pool(center: Point, width: number) {
    const pool = this.el('pool', center.x, center.y);
    pool.style.width = `${width}px`;
    pool.style.height = `${width * 0.22}px`;
  }

  /** Gotas escorrendo da base do letreiro (FATALITY). */
  dripText(target: HTMLElement) {
    const r = target.getBoundingClientRect();
    const o = this.arena.getBoundingClientRect();
    const n = 9 + Math.floor(r.width / 90);
    for (let i = 0; i < n; i++) {
      const d = this.el('text-drip', r.left - o.left + rand(0.04, 0.96) * r.width, r.bottom - o.top - rand(18, 34));
      d.style.setProperty('--len', `${rand(30, 120)}px`);
      d.style.animationDelay = `${rand(0, 700)}ms`;
      setTimeout(() => d.remove(), 4200);
    }
  }
}
