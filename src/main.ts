import './styles.css';
import { sfx, isMuted, setMuted } from './audio';
import { Fighter, type Style } from './fighter';
import { Fx } from './fx';
import { applyStatic, detectLang, locale, setLang, t, type Lang } from './i18n';
import { clock, diff, health, winner, type Attack } from './game';
import { Gore } from './gore';
import qrcode from 'qrcode-generator';
import { PIX_KEY, pixPayload } from './pix';
import { startSim } from './sim';
import { ELEICAO_2T, photoUrl, TseSource, type Snapshot, type Status } from './tse';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const params = new URLSearchParams(location.search);
const simMode = params.has('sim');
const ele = params.get('ele') ?? ELEICAO_2T;

const arena = $('#arena');

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // sem storage: vale só para esta visita
    }
  },
};

setLang(detectLang(params.get('lang'), storage.get('lang'), navigator.languages ?? [navigator.language]));
applyStatic();

// Estilo visual: cartoon (padrão) ou realista. ?style= tem prioridade e fica salvo.
const readStyle = (): Style => {
  const p = params.get('style');
  if (p === 'real' || p === 'cartoon') return p;
  return storage.get('style') === 'real' ? 'real' : 'cartoon';
};
let style = readStyle();
arena.classList.toggle('realistic', style === 'real');

// ?overlay=1: fundo transparente para usar como fonte de navegador no OBS.
// &sound=1 já começa com som (o OBS não bloqueia autoplay).
const overlay = params.has('overlay');
document.documentElement.classList.toggle('overlay', overlay);
const stage = $('#stage');
const fx = new Fx(arena, $('#announcer'));
const gore = new Gore(arena);
// "Bloody mode" só no estilo realista; o cartoon continua leve.
const bloody = () => style === 'real';

const fmtInt = (n: number) => n.toLocaleString(locale());
const fmtPct = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let fighters: [Fighter, Fighter] | null = null;
let prev: Snapshot | null = null;
let finished = false;
let lastStatus: Status | null = null;
let waitingBanner = false; // único banner fixo traduzível (o de vitória é sempre "WINS")
const queue: Snapshot[] = [];
let busy = false;

// ---------- HUD ----------

function renderHud(s: Snapshot) {
  ([0, 1] as const).forEach((i) => {
    const c = s.candidates[i];
    const hp = health(s, i);
    $(`#name-${i}`).textContent = c.name;
    $(`#bar-${i} .fill`).style.width = `${hp}%`;
    $(`#bar-${i} .trail`).style.width = `${hp}%`;
    $(`#bar-${i}`).classList.toggle('over50', s.validVotes > 0 && c.pct > 50);
    $(`#stats-${i}`).innerHTML =
      s.validVotes > 0
        ? `<b>${fmtPct(c.pct)}%</b> ${t('votes', { n: fmtInt(c.votes) })}`
        : `<b>—</b> ${t('awaitingVotes')}`;
  });
  const secs = clock(s.pctSections);
  $('#clock').textContent = String(secs).padStart(2, '0');
  $('#clock').classList.toggle('low', secs <= 10);
  $('#apuradas').textContent = t('sections', { p: fmtPct(s.pctSections) });
  $('#updated').textContent = s.time ? `TSE ${s.date} ${s.time}` : '';
}

function setStatus(st: Status) {
  lastStatus = st;
  const el = $('#status-text');
  if (st.kind === 'ok') {
    el.textContent = t('live', { t: st.at.toLocaleTimeString(locale()) });
    el.className = 'live';
  } else {
    el.textContent = t('lost', { m: st.message, s: Math.round(st.retryIn / 1000) });
    el.className = 'error';
  }
}

// ---------- Luta ----------

function updateReach() {
  if (!fighters) return;
  const [a, b] = fighters.map((f) => f.el.getBoundingClientRect());
  const scale = a.width / 200 || 1;
  // distância entre os dois, em px do lutador (antes do scale), menos o alcance do braço
  const gap = (b.left - a.right) / scale;
  fighters.forEach((f) => f.setReach(Math.max(0, gap + f.reachOffset)));
}

function createFighters(s: Snapshot) {
  const photoEle = simMode ? ELEICAO_2T : ele;
  fighters = [
    new Fighter(stage, 0, s.candidates[0], photoUrl(photoEle, s.candidates[0].sq), style),
    new Fighter(stage, 1, s.candidates[1], photoUrl(photoEle, s.candidates[1].sq), style),
  ];
  updateReach();
  window.addEventListener('resize', updateReach);
}

const STRENGTH = { jab: 0, punch: 1, kick: 2, special: 3 } as const;
const DURATION = { jab: 380, punch: 480, kick: 560, special: 900 } as const;

async function playAttack(ev: Attack, next: Snapshot) {
  const [A, D] = ev.attacker === 0 ? [fighters![0], fighters![1]] : [fighters![1], fighters![0]];
  const strength = STRENGTH[ev.move];
  const dur = DURATION[ev.move];

  if (ev.firstBlood) void fx.announce('FIRST BLOOD', 1300, 'red');
  if (ev.reversal) {
    sfx.say('Combo breaker');
    void fx.announce(t('reversal'), 1500, 'gold');
  }

  sfx.whoosh();
  const anim = A.play(ev.move, dur);
  if (ev.move === 'special') {
    sfx.special();
    await wait(dur * 0.35);
    await fx.projectile(A.handPoint(arena), D.headPoint(arena), A.look.emblem || '★', ev.reversal);
  } else {
    await wait(dur * 0.4);
  }

  // impacto
  void D.play(strength >= 2 ? 'hit-big' : 'hit', 420);
  fx.spark(D.headPoint(arena), strength);
  fx.shake(strength);
  sfx.hit(strength);
  if (strength >= 3) fx.flash();
  if (bloody()) {
    const away = D.side === 0 ? -1 : 1;
    gore.burst(D.chestPoint(arena), 6 + strength * 8, strength, away);
    sfx.splat(strength);
    if (strength >= 1) D.addWound(strength >= 3 ? 2 : 1);
    if (strength >= 3) gore.screen(1); // respingo na tela só nos especiais
  }
  renderHud(next);
  if (ev.delta >= 0.005) {
    const p = A.headPoint(arena);
    fx.popup({ x: p.x, y: p.y - 90 }, t('gain', { d: fmtPct(ev.delta) }), 'gain');
  }
  const hitWord = ['HIT', 'HIT!', 'BRUTAL!', 'OUTSTANDING!'][strength];
  const dp = D.headPoint(arena);
  fx.popup({ x: dp.x, y: dp.y - 40 }, hitWord, 'hit');

  await anim;
  await wait(250);
}

async function playFinish(w: 0 | 1, s: Snapshot) {
  finished = true;
  const W = fighters![w];
  const L = fighters![w === 0 ? 1 : 0];
  renderHud(s);
  L.setState('dizzy');
  sfx.say('Finish him!');
  await fx.announce('FINISH HIM!', 2200, 'red');

  sfx.whoosh();
  sfx.special();
  const anim = W.play('special', 1200);
  await wait(400);
  await fx.projectile(W.handPoint(arena), L.headPoint(arena), W.look.emblem || '★', true);
  sfx.explosion();
  fx.flash('#ff2a00');
  fx.shake(5);
  fx.spark(L.headPoint(arena), 5);
  fx.spark(L.headPoint(arena), 4);
  if (bloody()) await bloodyFatality(L);
  else L.setState('ko');
  await anim;

  sfx.say('Fatality');
  const fatality = fx.announce('FATALITY', 2600, `red fatality${bloody() ? ' gore' : ''}`);
  if (bloody()) {
    await wait(350);
    gore.dripText($('#announcer'));
  }
  await fatality;
  arena.classList.remove('lights-out');
  W.setState('win');
  sfx.say(`${W.cand.name.split(' ')[0]} wins`);
  fx.banner(`${W.cand.name} WINS`, 'gold');
  arena.classList.add('finished');
  if (!overlay) $('#win-cta').hidden = false;
}

/** Fatality do estilo realista: luzes apagam, jatos de sangue, poça sob o perdedor. */
async function bloodyFatality(L: Fighter) {
  arena.classList.add('lights-out');
  const away = L.side === 0 ? -1 : 1;
  L.addWound(4);
  gore.screen(4, 5200);
  for (let i = 0; i < 6; i++) {
    gore.burst(L.chestPoint(arena), 16, 4, i % 2 ? 0 : away);
    sfx.splat(3);
    fx.shake(3);
    await wait(170);
  }
  L.setState('ko');
  await wait(750); // espera o corpo cair para posicionar a poça
  const r = L.el.getBoundingClientRect();
  const o = arena.getBoundingClientRect();
  const scale = r.width / 200 || 1;
  const toward = L.side === 0 ? 1 : -1; // o corpo cai com os pés para o lado do adversário
  const feetX = r.left + r.width / 2 + toward * 150 * scale - o.left;
  const head = L.headPoint(arena);
  gore.pool({ x: (feetX + head.x) / 2, y: r.bottom - o.top - 22 * scale }, Math.abs(head.x - feetX) + 120 * scale);
  gore.burst(L.chestPoint(arena), 24, 5, 0);
  sfx.splat(4);
}

async function handle(s: Snapshot) {
  if (!fighters) {
    createFighters(s);
    renderHud(s);
    prev = s;
    const w = winner(s);
    if (s.validVotes <= 0) {
      fx.banner(t('waiting'), 'small');
      waitingBanner = true;
    } else {
      sfx.say('Round two. Fight!');
      await fx.announce('ROUND 2', 1200);
      await fx.announce('FIGHT!', 1000, 'red');
    }
    if (w !== null) await playFinish(w, s);
    return;
  }
  if (finished) {
    renderHud(s);
    return;
  }

  const ev = diff(prev!, s);
  if (ev) {
    if (prev!.validVotes <= 0) {
      fx.clearBanner();
      waitingBanner = false;
      sfx.say('Round two. Fight!');
      await fx.announce('ROUND 2', 1100);
      await fx.announce('FIGHT!', 900, 'red');
    }
    await playAttack(ev, s);
  } else {
    renderHud(s);
  }
  prev = s;

  const w = winner(s);
  if (w !== null) await playFinish(w, s);
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      // se acumulou (aba em segundo plano), toca só as últimas para não virar maratona
      if (queue.length > 3) queue.splice(0, queue.length - 3);
      await handle(queue.shift()!);
    }
  } catch (err) {
    console.error(err);
  } finally {
    busy = false;
  }
}

function onSnapshot(s: Snapshot) {
  queue.push(s);
  void pump();
}

// ---------- Controles ----------

const muteBtn = $<HTMLButtonElement>('#mute');
const renderMute = () => (muteBtn.textContent = isMuted() ? t('soundOff') : t('soundOn'));
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  renderMute();
});
renderMute();

const styleBtn = $<HTMLButtonElement>('#style');
const renderStyleBtn = () => (styleBtn.textContent = style === 'real' ? t('styleToCartoon') : t('styleToReal'));
styleBtn.addEventListener('click', () => {
  style = style === 'real' ? 'cartoon' : 'real';
  storage.set('style', style);
  arena.classList.toggle('realistic', style === 'real');
  fighters?.forEach((f) => f.setStyle(style));
  updateReach();
  renderStyleBtn();

// Troca de idioma ao vivo, sem recarregar (a luta continua de onde está).
const langSelect = $<HTMLSelectElement>('#lang');
function renderLangDependent() {
  applyStatic();
  renderMute();
  renderStyleBtn();
  renderSimMark();
  if (prev) renderHud(prev);
  if (lastStatus) setStatus(lastStatus);
  else if (simMode) $('#status-text').textContent = t('simStatus');
  if (waitingBanner) fx.banner(t('waiting'), 'small');
  if (overlay) renderCredit();
}
langSelect.value = document.documentElement.lang.split('-')[0];
langSelect.addEventListener('change', () => {
  const lang = langSelect.value as Lang;
  setLang(lang);
  storage.set('lang', lang);
  renderLangDependent();
});
});
renderStyleBtn();

// Troca de idioma ao vivo, sem recarregar (a luta continua de onde está).
const langSelect = $<HTMLSelectElement>('#lang');
function renderLangDependent() {
  applyStatic();
  renderMute();
  renderStyleBtn();
  renderSimMark();
  if (prev) renderHud(prev);
  if (lastStatus) setStatus(lastStatus);
  else if (simMode) $('#status-text').textContent = t('simStatus');
  if (waitingBanner) fx.banner(t('waiting'), 'small');
  if (overlay) renderCredit();
}
langSelect.value = document.documentElement.lang.split('-')[0];
langSelect.addEventListener('change', () => {
  const lang = langSelect.value as Lang;
  setLang(lang);
  storage.set('lang', lang);
  renderLangDependent();
});

// ---------- Pix ----------

const pixCode = pixPayload(PIX_KEY, 'APURACAO KOMBAT', 'BRASILIA');
const pixDialog = $<HTMLDialogElement>('#pix-dialog');
let qrRendered = false;

function openPix() {
  if (!qrRendered) {
    const qr = qrcode(0, 'M');
    qr.addData(pixCode);
    qr.make();
    $('#pix-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    $('#pix-key').textContent = PIX_KEY;
    qrRendered = true;
  }
  pixDialog.showModal();
}

$('#pix').addEventListener('click', openPix);
$('#win-cta').addEventListener('click', openPix);
$('#pix-close').addEventListener('click', () => pixDialog.close());
pixDialog.addEventListener('click', (e) => {
  if (e.target === pixDialog) pixDialog.close(); // clique fora do conteúdo
});

const copyBtn = $<HTMLButtonElement>('#pix-copy');
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(pixCode);
    copyBtn.textContent = t('pixCopied');
  } catch {
    copyBtn.textContent = t('pixCopyFail');
  }
  setTimeout(() => (copyBtn.textContent = t('pixCopy')), 2500);
});

// ---------- Overlay ----------

// ---------- Tarja da simulação (texto traduzido, então gerada aqui e não no CSS) ----------

function renderSimMark() {
  const text = t('simMark').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='460' height='220'><text x='230' y='120' text-anchor='middle' transform='rotate(-24 230 110)' font-family='monospace' font-weight='bold' font-size='22' fill='#ff3b30' fill-opacity='0.32'>${text}</text></svg>`;
  $('#sim-mark').style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function renderCredit() {
  const credit = $<HTMLAnchorElement>('#credit');
  credit.href = location.origin + location.pathname;
  credit.textContent = `${(location.host + location.pathname).replace(/\/$/, '')} · ${t('credit')}`;
}

if (overlay) {
  renderCredit();
  if (params.get('sound') === '1') {
    setMuted(false);
    renderMute();
  }
}

// ?og: cena estática usada para gerar public/og.png (npm run og)
function renderOgScene() {
  arena.classList.add('og');
  const cand = (number: string, name: string, sq: string, seq: number) => ({
    number, name, sq, seq, votes: 0, pct: 0, elected: false, status: '',
  });
  const s: Snapshot = {
    key: 'og', date: '', time: '', pctSections: 0, electorate: 0, remainingVoters: 0,
    validVotes: 0, final: false,
    candidates: [cand('13', 'LULA', '280002542548', 1), cand('22', 'FLAVIO BOLSONARO', '280002551544', 2)],
  };
  createFighters(s);
  renderHud(s);
  $('#stats-0').textContent = $('#stats-1').textContent = '';
  $('#announcer').innerHTML = `APURAÇÃO<br>KOMBAT<small>${t('ogSubtitle')}</small>`;
  $('#announcer').className = 'sticky';
}

if (params.has('og')) {
  renderOgScene();
} else if (simMode) {
  // Tarja impossível de recortar: um print da simulação não pode passar por resultado real.
  $('#sim-mark').hidden = false;
  renderSimMark();
  $('#status-text').textContent = t('simStatus');
  $('#status-text').className = 'sim';
  startSim(onSnapshot, Number(params.get('speed')) || 3000);
} else {
  new TseSource(ele, onSnapshot, setStatus).start();
}
