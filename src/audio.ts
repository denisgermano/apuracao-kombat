// Efeitos sonoros sintetizados com WebAudio + locutor via speechSynthesis.

let ctx: AudioContext | null = null;
let muted = false; // som ligado por padrão; o navegador só libera no primeiro toque/tecla
let keepAlive: HTMLAudioElement | null = null;

export const isMuted = () => muted;
/** Som ligado, mas o navegador ainda não liberou o áudio (falta o primeiro toque/tecla). */
export const isLocked = () => !muted && ctx?.state !== 'running';
let onStateChange: (() => void) | null = null;
export const onAudioState = (fn: () => void) => (onStateChange = fn);

/** WAV silencioso de 1s gerado em memória (sem arquivo externo). */
function silentWavUrl() {
  const rate = 8000;
  const buf = new ArrayBuffer(44 + rate);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + rate, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, rate, true);
  new Uint8Array(buf, 44).fill(128); // 8 bits: 128 = silêncio
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * Precisa rodar dentro do toque/clique do usuário. No iPhone:
 * - a chave do silencioso cala o Web Audio ("ambient"); `audioSession.type = 'playback'`
 *   (Safari 17+) e um <audio> silencioso em loop (versões anteriores) mudam a sessão
 *   para "playback", que ignora a chave;
 * - o AudioContext só destrava tocando algo no mesmo gesto;
 * - speechSynthesis só fala depois de uma primeira fala iniciada por gesto.
 */
function unlock() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    // API não suportada
  }

  keepAlive ??= Object.assign(new Audio(silentWavUrl()), { loop: true });
  keepAlive.setAttribute('playsinline', '');
  void keepAlive.play().catch(() => {});

  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx || ctx.state === 'closed') {
    ctx = new Ctor();
    ctx.onstatechange = () => onStateChange?.();
  }
  void ctx.resume().then(() => onStateChange?.(), () => {});
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);

  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (!m) {
    unlock();
  } else {
    keepAlive?.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}

// Destrava no primeiro gesto (autoplay bloqueado) e restaura quando o Safari suspende o
// áudio ao ir para segundo plano ou numa ligação (o iOS exige gesto para isso).
const revive = () => {
  if (muted || ctx?.state === 'running') return;
  unlock();
};
document.addEventListener('touchend', revive, { passive: true });
document.addEventListener('click', revive);
document.addEventListener('keydown', revive);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !muted) void ctx?.resume();
});

function noise(dur: number, freq: number, gain: number, sweepTo?: number) {
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  whoosh: () => noise(0.25, 600, 0.25, 2400),
  hit: (strength: number) => {
    noise(0.12 + 0.08 * strength, 900, 0.5 + 0.2 * strength);
    tone(140, 0.2 + 0.1 * strength, 0.6, 'sine', 50);
  },
  special: () => {
    tone(220, 0.6, 0.2, 'sawtooth', 880);
    noise(0.6, 300, 0.2, 3000);
  },
  splat: (strength: number) => {
    noise(0.18 + 0.06 * strength, 220, 0.6 + 0.1 * strength, 90);
    tone(70, 0.25, 0.5, 'sine', 40);
  },
  explosion: () => {
    noise(1.2, 200, 0.9, 60);
    tone(90, 1, 0.8, 'square', 30);
  },
  /** Grito agudo do easter egg (como o "Toasty!" do MK2): voz sintética, nunca imitando o candidato. */
  shout(text: string) {
    if (muted || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.pitch = 2;
    u.rate = 1.15;
    speechSynthesis.speak(u);
  },
  say(text: string) {
    if (muted || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.pitch = 0.2;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  },
};
