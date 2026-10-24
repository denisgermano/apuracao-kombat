// Efeitos visuais: faíscas, tremor de tela, textos de impacto, projétil e locutor.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Fx {
  constructor(
    private arena: HTMLElement,
    private announcerEl: HTMLElement,
  ) {}

  private spawn(className: string, x: number, y: number, html = '') {
    const el = document.createElement('div');
    el.className = className;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = html;
    this.arena.appendChild(el);
    return el;
  }

  spark(p: { x: number; y: number }, strength: number) {
    const burst = this.spawn('spark', p.x, p.y);
    burst.style.setProperty('--size', `${70 + strength * 50}px`);
    const n = 6 + strength * 4;
    for (let i = 0; i < n; i++) {
      const bit = this.spawn('bit', p.x, p.y);
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * (60 + strength * 40);
      bit.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      bit.style.setProperty('--dy', `${Math.sin(ang) * dist - 30}px`);
      setTimeout(() => bit.remove(), 800);
    }
    setTimeout(() => burst.remove(), 500);
  }

  shake(strength: number) {
    this.arena.style.setProperty('--shake', `${4 + strength * 5}px`);
    this.arena.classList.remove('shake');
    void this.arena.offsetWidth;
    this.arena.classList.add('shake');
    setTimeout(() => this.arena.classList.remove('shake'), 400);
  }

  flash(color = '#fff') {
    const el = this.spawn('flash', 0, 0);
    el.style.background = color;
    setTimeout(() => el.remove(), 450);
  }

  popup(p: { x: number; y: number }, text: string, cls = '') {
    const el = this.spawn(`popup ${cls}`, p.x, p.y, text);
    setTimeout(() => el.remove(), 1400);
  }

  async projectile(from: { x: number; y: number }, to: { x: number; y: number }, label: string, big = false) {
    const el = this.spawn(`projectile${big ? ' big' : ''}`, from.x, from.y, `<span>${label}</span>`);
    el.style.setProperty('--tx', `${to.x - from.x}px`);
    el.style.setProperty('--ty', `${to.y - from.y}px`);
    await wait(big ? 650 : 450);
    el.remove();
  }

  async announce(text: string, ms = 1400, cls = '') {
    const a = this.announcerEl;
    a.className = '';
    a.textContent = text;
    void a.offsetWidth;
    a.style.animationDuration = `${ms}ms`;
    a.className = `show ${cls}`;
    await wait(ms);
    a.style.animationDuration = '';
    a.className = '';
  }

  /** Mensagem persistente (ex.: vencedor, aguardando apuração). */
  banner(text: string, cls = '') {
    const a = this.announcerEl;
    a.textContent = text;
    a.className = `sticky ${cls}`;
  }

  clearBanner() {
    if (this.announcerEl.classList.contains('sticky')) this.announcerEl.className = '';
  }
}
