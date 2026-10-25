// Easter egg no estilo do "Toasty!" do Mortal Kombat 2: o rosto de quem bateu surge no canto
// da tela, solta um bordão e some. Bordões que os próprios candidatos usam, no mesmo tom para
// os dois — nada de ataque, gesto de campanha ou voz imitando a pessoa real.

export const CATCHPHRASES: Record<string, string> = {
  '13': 'COMPANHEIRO!',
  '22': 'TÁ OK?',
};

const SHOW_MS = 1600;

export class Toasty {
  private busy = false;

  constructor(private arena: HTMLElement) {}

  /** Mostra o rosto no canto do lado do lutador (0 = esquerda, 1 = direita). Retorna false se já houver um na tela. */
  show(side: 0 | 1, photo: string, phrase: string): boolean {
    if (this.busy) return false;
    this.busy = true;
    const el = document.createElement('div');
    el.className = `toasty ${side === 0 ? 'left' : 'right'}`;
    el.innerHTML = `<img alt="" src="${photo}"><span></span>`;
    el.querySelector('span')!.textContent = phrase;
    el.style.setProperty('--dur', `${SHOW_MS}ms`);
    this.arena.appendChild(el);
    setTimeout(() => {
      el.remove();
      this.busy = false;
    }, SHOW_MS);
    return true;
  }
}
