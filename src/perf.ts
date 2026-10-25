// Qualidade dos efeitos: 1 = completa; 0.5 = celular fraco (metade das partículas, sem neblina/granulado).

const nav = navigator as Navigator & { deviceMemory?: number };
export let quality =
  (nav.deviceMemory ?? 8) <= 2 ||
  (navigator.hardwareConcurrency ?? 8) <= 2 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0.5
    : 1;

export const scaled = (n: number) => Math.max(1, Math.round(n * quality));

function lower() {
  quality = 0.5;
  document.documentElement.classList.add('low-fx');
}
if (quality < 1) lower();

/** Mede o FPS por 3s com a página visível; abaixo de 40 quadros/s, reduz os efeitos. */
export function measureFps() {
  if (quality < 1 || document.visibilityState !== 'visible') return;
  let frames = 0;
  const start = performance.now();
  const tick = (now: number) => {
    frames++;
    if (now - start < 3000) return void requestAnimationFrame(tick);
    if (document.visibilityState === 'visible' && (frames * 1000) / (now - start) < 40) lower();
  };
  requestAnimationFrame(tick);
}
