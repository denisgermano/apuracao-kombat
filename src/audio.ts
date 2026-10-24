// Efeitos sonoros sintetizados com WebAudio + locutor via speechSynthesis.

let ctx: AudioContext | null = null;
let muted = true;

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  if (!m) {
    ctx ??= new AudioContext();
    void ctx.resume();
  } else {
    speechSynthesis?.cancel();
  }
}

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
  explosion: () => {
    noise(1.2, 200, 0.9, 60);
    tone(90, 1, 0.8, 'square', 30);
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
