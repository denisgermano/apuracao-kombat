import './styles.css';
import { sfx, isMuted, isLocked, setMuted, onAudioState } from './audio';
import { Fighter, type Style } from './fighter';
import { Fx } from './fx';
import { applyStatic, detectLang, getLang, locale, setLang, t, type Key, type Lang } from './i18n';
import { trendSvg, type Point } from './chart';
import { loadHistory, sample, saveHistory, startReplay, synthReplay } from './history';
import { measureFps } from './perf';
import { StatesSource, type StateRow } from './states';
import { clock, diff, health, winner, type Attack } from './game';
import { Gore } from './gore';
import qrcode from 'qrcode-generator';
import { LIVEPIX_USER, LIVEPIX_WIDGET_URL } from './config';
import { storyImage } from './story';
import { CATCHPHRASES, Toasty } from './toasty';
import { PIX_KEY, pixPayload } from './pix';
import { startSim } from './sim';
import { ELEICAO_2T, fetchOnce, photoUrl, TseSource, type Snapshot, type Status } from './tse';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const params = new URLSearchParams(location.search);
const simMode = params.has('sim');
// ?replay=1: revê a apuração (histórico gravado neste navegador ou reconstrução ilustrativa)
const replayMode = !simMode && params.has('replay');
const liveMode = !simMode && !replayMode;
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
// No overlay o som começa desligado; &sound=1 liga (o OBS não bloqueia autoplay).
const overlay = params.has('overlay');
document.documentElement.classList.toggle('overlay', overlay);
const stage = $('#stage');
const fx = new Fx(arena, $('#announcer'));
const gore = new Gore(arena);
// "Bloody mode" só no estilo realista; o cartoon continua leve.
const bloody = () => style === 'real';

const fmtInt = (n: number) => n.toLocaleString(locale());
const fmtPct = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 987.654 por extenso; de 1 milhão para cima, "1,23 mi". */
const fmtBig = (n: number, digits = 2) =>
  n < 1e6 ? fmtInt(n) : n.toLocaleString(locale(), { notation: 'compact', maximumFractionDigits: digits });
/** Vibra junto com os golpes (Android; o iPhone não expõe vibração na web). Som desligado = sem vibrar. */
const buzz = (pattern: number | number[]) => {
  if (!overlay && !isMuted()) navigator.vibrate?.(pattern);
};

let fighters: [Fighter, Fighter] | null = null;
let prev: Snapshot | null = null;
let finished = false;
let winnerIdx: 0 | 1 | null = null;
let lastStatus: Status | null = null;
let markKey: Key | null = simMode ? 'simMark' : null; // tarja de dados fictícios/ilustrativos
let waitingBanner = false; // único banner fixo traduzível (o de vitória é sempre "WINS")
const queue: Snapshot[] = [];
let busy = false;

// ---------- HUD ----------

function renderHud(s: Snapshot) {
  const [a, b] = s.candidates;
  const leader = a.votes === b.votes ? -1 : a.votes > b.votes ? 0 : 1;
  ([0, 1] as const).forEach((i) => {
    const c = s.candidates[i];
    const hp = health(s, i);
    $(`#name-${i}`).textContent = c.name;
    $(`#bar-${i} .fill`).style.width = `${hp}%`;
    $(`#bar-${i} .trail`).style.width = `${hp}%`;
    $(`#bar-${i}`).classList.toggle('over50', s.validVotes > 0 && c.pct > 50);
    $(`#stats-${i}`).innerHTML =
      s.validVotes > 0
        ? `<b>${fmtPct(c.pct)}%</b> ${t('votes', { n: fmtInt(c.votes) })}` +
          (leader === i ? `<span class="lead">${t('lead', { n: fmtBig(Math.abs(a.votes - b.votes)) })}</span>` : '')
        : `<b>—</b> ${t('awaitingVotes')}`;
  });
  $('#trend').innerHTML = trendSvg(trend);
  $('#remaining').textContent =
    s.validVotes > 0 && s.remainingVoters > 0 ? t('remaining', { r: fmtBig(s.remainingVoters, 1) }) : '';
  // placar no título: dá para acompanhar com a aba em segundo plano
  if (s.validVotes > 0 && !params.has('og')) {
    const first = (n: string) => n.split(' ')[0];
    document.title =
      (winnerIdx !== null ? `🏆 ${first(s.candidates[winnerIdx].name)} WINS · ` : '') +
      `${first(a.name)} ${fmtPct(a.pct)}% x ${fmtPct(b.pct)}% ${first(b.name)} · ${fmtPct(s.pctSections)}%`;
  }
  const secs = clock(s.pctSections);
  $('#clock').textContent = String(secs).padStart(2, '0');
  $('#clock').classList.toggle('low', secs <= 10);
  $('#apuradas').textContent = t('sections', { p: fmtPct(s.pctSections) });
  $('#updated').textContent = s.time ? `TSE ${s.date} ${s.time}` : '';
}

// Hora em que chegou dado novo do TSE (não a última consulta): mostra quando a apuração "empaca".
let lastNewData = Date.now();
const STALE_MS = 5 * 60_000;
const staleMinutes = () => {
  const counting = prev && prev.validVotes > 0 && !prev.final && prev.pctSections < 100;
  const ms = Date.now() - lastNewData;
  return counting && ms >= STALE_MS ? Math.floor(ms / 60_000) : 0;
};

function setStatus(st: Status) {
  lastStatus = st;
  const el = $('#status-text');
  const stale = staleMinutes();
  if (st.kind === 'ok' && stale) {
    el.textContent = t('stale', { m: stale });
    el.className = 'sim';
  } else if (st.kind === 'ok') {
    el.textContent = t('live', { t: st.at.toLocaleTimeString(locale()) });
    el.className = 'live';
  } else {
    el.textContent = t('lost', { m: st.message, s: Math.round(st.retryIn / 1000) });
    el.className = 'error';
  }
}

/** Placar em uma frase: leitor de tela, notificações. */
function scoreLine(s: Snapshot) {
  const [a, b] = s.candidates;
  return t('srScore', { a: a.name, b: b.name, pa: fmtPct(a.pct), pb: fmtPct(b.pct), p: fmtPct(s.pctSections) });
}

function announceSr(s: Snapshot) {
  if (s.validVotes <= 0) return;
  $('#sr').textContent = (winnerIdx !== null ? `${s.candidates[winnerIdx].name} WINS. ` : '') + scoreLine(s);
}

// ---------- Gráfico da noite e histórico ----------

let trend: Point[] = [];
/** Acrescenta ao fim da série; mesma % de seções substitui o ponto (o TSE às vezes republica). */
function appendByPct<T>(list: T[], item: T, pct: (x: T) => number) {
  const last = list.at(-1);
  if (last && pct(item) < pct(last)) return false;
  if (last && pct(item) === pct(last)) list[list.length - 1] = item;
  else list.push(item);
  return true;
}
const pushTrend = (s: Snapshot) =>
  s.validVotes > 0 && appendByPct(trend, { p: s.pctSections, m: s.candidates[0].pct - s.candidates[1].pct }, (q) => q.p);

const history = liveMode ? loadHistory(ele) : [];
history.forEach(pushTrend);
function record(s: Snapshot) {
  if (!liveMode || s.validVotes <= 0 || !appendByPct(history, s, (x) => x.pctSections)) return;
  if (history.length > 400) history.splice(0, history.length, ...sample(history, 300));
  saveHistory(ele, history);
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
    buzz([120, 60, 120, 60, 240]);
    notify(t('reversal'), scoreLine(next));
    sfx.say('Combo breaker');
    void fx.announce(t('reversal'), 1500, 'gold');
    nudgeShare();
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
  if (strength >= 2) buzz(strength >= 3 ? [70, 40, 140] : 50);
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
  if (strength >= 2 && Date.now() - lastToasty > 60_000 && Math.random() < 1 / 6) {
    lastToasty = Date.now();
    setTimeout(() => easterEgg(A), 450);
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
  notify(`${s.candidates[w].name} WINS`, scoreLine(s));
  winnerIdx = w; // antes do renderHud: o título da aba já mostra o vencedor
  renderHud(s);
  L.setState('dizzy');
  nudgeShare();
  sfx.say('Finish him!');
  await fx.announce('FINISH HIM!', 2200, 'red');

  sfx.whoosh();
  sfx.special();
  const anim = W.play('special', 1200);
  await wait(400);
  await fx.projectile(W.handPoint(arena), L.headPoint(arena), W.look.emblem || '★', true);
  sfx.explosion();
  buzz([200, 80, 400]);
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
  announceSr(s);
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

// Fim da votação e início da apuração: 17h de Brasília (20h UTC) de 25/10/2026.
const COUNT_START = Date.UTC(2026, 9, 25, 20, 0, 0);

/** Antes das 17h, contagem regressiva estilo arcade; depois, aguarda os primeiros votos. */
function renderWaiting() {
  const ms = COUNT_START - Date.now();
  if (ms <= 0) return fx.banner(t('waitingFirst'), 'small');
  const sec = Math.ceil(ms / 1000);
  const hms = [Math.floor(sec / 3600), Math.floor(sec / 60) % 60, sec % 60].map((n) => String(n).padStart(2, '0'));
  fx.banner(t('countdown', { t: hms.join(':') }), 'small');
}

async function handle(s: Snapshot) {
  pushTrend(s);
  if (s.validVotes > 0) startTicker();
  if (!fighters) {
    createFighters(s);
    renderHud(s);
    prev = s;
    const w = winner(s);
    if (s.validVotes <= 0) {
      waitingBanner = true;
      renderWaiting();
      setInterval(() => waitingBanner && renderWaiting(), 1000);
    } else {
      sfx.say('Round two. Fight!');
      await fx.announce('ROUND 2', 1200);
      await fx.announce('FIGHT!', 1000, 'red');
    }
    if (w !== null) await playFinish(w, s);
    else announceSr(s);
    return;
  }
  if (finished) {
    renderHud(s);
    prev = s; // o texto de compartilhar usa o placar mais recente
    announceSr(s);
    return;
  }

  const ev = diff(prev!, s);
  if (ev) {
    if (prev!.validVotes <= 0) {
      notify('FIGHT!', `${t('notifyStart')} ${scoreLine(s)}`);
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
  else announceSr(s);
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
  lastNewData = Date.now();
  record(s);
  queue.push(s);
  void pump();
}

// ---------- Controles ----------

const muteBtn = $<HTMLButtonElement>('#mute');
const renderMute = () => {
  const locked = isLocked();
  const label = isMuted() ? t('soundOff') : locked ? t('soundTap') : t('soundOn');
  muteBtn.querySelector('.ico')!.textContent = isMuted() || locked ? '🔇' : '🔊';
  muteBtn.title = label;
  muteBtn.setAttribute('aria-label', label);
  muteBtn.setAttribute('aria-pressed', String(!isMuted() && !locked));
  muteBtn.classList.toggle('locked', locked);
};
muteBtn.addEventListener('click', () => {
  setMuted(isLocked() ? false : !isMuted()); // bloqueado: o toque só destrava, não desliga
  renderMute();
});
onAudioState(renderMute);
renderMute();

// Seletor de estilo com dois botões fixos (🎨/📸): o rodapé não muda de largura ao trocar.
const styleButtons = [...document.querySelectorAll<HTMLButtonElement>('#style button')];
const renderStyleBtn = () =>
  styleButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.style === style)));
styleButtons.forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.style === style) return;
  style = b.dataset.style as Style;
  storage.set('style', style);
  arena.classList.toggle('realistic', style === 'real');
  fighters?.forEach((f) => f.setStyle(style));
  updateReach();
  renderStyleBtn();
}));
renderStyleBtn();

// Troca de idioma ao vivo, sem recarregar (a luta continua de onde está).
const langButtons = [...document.querySelectorAll<HTMLButtonElement>('#lang button')];
function renderLangDependent() {
  applyStatic();
  renderMute();
  renderStyleBtn();
  renderSimMark();
  renderNotify();
  if (prev) renderHud(prev);
  if (lastRows.length) renderTicker(lastRows);
  if (lastStatus) setStatus(lastStatus);
  else if (simMode) $('#status-text').textContent = t('simStatus');
  else if (replayMode) $('#status-text').textContent = t('replayStatus');
  if (waitingBanner) renderWaiting();
  if (overlay) renderCredit();
}
function renderLangButtons() {
  langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
}
renderLangButtons();
langButtons.forEach((b) =>
  b.addEventListener('click', () => {
    const lang = b.dataset.lang as Lang;
    if (lang === getLang()) return;
    setLang(lang);
    storage.set('lang', lang);
    renderLangButtons();
    renderLangDependent();
  }),
);

// ---------- Pix ----------

const pixDialog = $<HTMLDialogElement>('#pix-dialog');
const amountButtons = [...document.querySelectorAll<HTMLButtonElement>('#pix-amounts button')];
let pixCode = '';

/** Valor sugerido já vem no QR (o app abre preenchido); "outro" gera o QR sem valor. */
function selectAmount(amount: number) {
  pixCode = pixPayload(PIX_KEY, 'URNA KOMBAT', 'BRASILIA', amount || undefined);
  const qr = qrcode(0, 'M');
  qr.addData(pixCode);
  qr.make();
  $('#pix-qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  amountButtons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.amount) === amount)));
}
amountButtons.forEach((b) => b.addEventListener('click', () => selectAmount(Number(b.dataset.amount))));

function openPix() {
  if (!pixCode) {
    selectAmount(10);
    $('#pix-key').textContent = PIX_KEY;
  }
  pixDialog.showModal();
}

$('#pix').addEventListener('click', openPix);
$('#win-pix').addEventListener('click', openPix);
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

// ---------- Easter egg "Toasty!" ----------

const toasty = new Toasty(arena);
let lastToasty = 0;

/** Só depois que a apuração começou (17h, urnas fechadas): nada de bordão durante a votação. */
function easterEgg(f: Fighter) {
  const phrase = CATCHPHRASES[f.cand.number];
  if (!phrase || !prev || prev.validVotes <= 0 || params.has('og')) return;
  const photo = f.el.querySelector<HTMLImageElement>('.head img')!.src;
  if (toasty.show(f.side, photo, phrase)) sfx.shout(phrase);
}

// atalho secreto: digitar 13 ou 22
let typed = '';
document.addEventListener('keydown', (e) => {
  if (!/^\d$/.test(e.key) || document.querySelector('dialog[open]')) return;
  typed = (typed + e.key).slice(-2);
  const f = fighters?.find((x) => x.cand.number === typed);
  if (f) {
    typed = '';
    easterEgg(f);
  }
});

// no celular: 5 toques rápidos no lutador
stage.addEventListener('click', (e) => {
  const f = fighters?.find((x) => x.el.contains(e.target as Node));
  if (!f) return;
  const now = Date.now();
  const taps = (f.el.dataset.taps ?? '').split(',').map(Number).filter((t) => now - t < 2000);
  taps.push(now);
  f.el.dataset.taps = taps.length >= 5 ? '' : taps.join(',');
  if (taps.length >= 5) easterEgg(f);
});

// ---------- Compartilhar ----------

const shareDialog = $<HTMLDialogElement>('#share-dialog');
const shareBtn = $<HTMLButtonElement>('#share');
const shareUrl = 'https://urnakombat.com.br/';

/** Texto com o placar do momento (sem querystring de sim/overlay no link). */
function shareText() {
  const s = prev;
  if (!s || s.validVotes <= 0) return t('shareIdle');
  const [a, b] = s.candidates;
  const fmt = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vars = { a: a.name, b: b.name, pa: fmt(a.pct), pb: fmt(b.pct), p: fmt(s.pctSections) };
  if (winnerIdx !== null) return t('shareWin', { ...vars, w: s.candidates[winnerIdx].name });
  return t('shareLive', vars);
}

function openShare() {
  const text = shareText();
  $('#share-preview').textContent = `${text} ${shareUrl}`;
  $<HTMLAnchorElement>('#share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`;
  $<HTMLAnchorElement>('#share-x').href =
    `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  $('#share-native').hidden = !navigator.share;
  shareImageBtn.hidden = !prev || prev.validVotes <= 0 || !fighters;
  story = shareImageBtn.hidden ? null : makeStory(); // já começa a gerar: o share do iPhone exige o toque recente
  shareDialog.showModal();
}

const shareImageBtn = $<HTMLButtonElement>('#share-image');
let story: Promise<File> | null = null;

function makeStory(): Promise<File> {
  const s = prev!;
  const photos = fighters!.map((f) => f.el.querySelector<HTMLImageElement>('.head img')!.src) as [string, string];
  return storyImage(s, winnerIdx, photos, {
    headline: winnerIdx !== null ? `${s.candidates[winnerIdx].name} WINS` : t('storyLive', { p: fmtPct(s.pctSections) }),
    pct: [`${fmtPct(s.candidates[0].pct)}%`, `${fmtPct(s.candidates[1].pct)}%`],
    votes: [t('votes', { n: fmtInt(s.candidates[0].votes) }), t('votes', { n: fmtInt(s.candidates[1].votes) })],
    footer: t('storyFooter'),
    trend,
    sim: markKey ? t(markKey) : '',
  }).then((blob) => new File([blob], 'urna-kombat.png', { type: 'image/png' }));
}

shareImageBtn.addEventListener('click', async () => {
  shareImageBtn.textContent = t('shareImageBusy');
  try {
    const file = await (story ?? makeStory());
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${shareText()} ${shareUrl}` }).catch(() => {});
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    }
  } catch (err) {
    console.error(err);
  }
  shareImageBtn.textContent = t('shareImage');
});

/** Destaca o botão nos momentos de pico (virada, FINISH HIM). */
function nudgeShare() {
  if (overlay) return;
  shareBtn.classList.remove('nudge');
  void shareBtn.offsetWidth;
  shareBtn.classList.add('nudge');
  setTimeout(() => shareBtn.classList.remove('nudge'), 10_000);
}

shareBtn.hidden = overlay;
shareBtn.addEventListener('click', openShare);
$('#win-share').addEventListener('click', openShare);
$('#share-close').addEventListener('click', () => shareDialog.close());
shareDialog.addEventListener('click', (e) => {
  if (e.target === shareDialog) shareDialog.close();
});
const shareCopy = $<HTMLButtonElement>('#share-copy');
shareCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(`${shareText()} ${shareUrl}`);
    shareCopy.textContent = t('shareCopied');
  } catch {
    shareCopy.textContent = shareUrl;
  }
  setTimeout(() => (shareCopy.textContent = t('shareCopy')), 2500);
});
$('#share-native').addEventListener('click', () => {
  navigator.share({ title: 'Urna Kombat', text: shareText(), url: shareUrl }).catch(() => {});
});

// ---------- Tela acesa e aviso de apuração parada ----------

// Quem deixa o celular apoiado assistindo não quer a tela apagando. O navegador solta o
// bloqueio quando a aba some, então pede de novo ao voltar.
async function keepAwake() {
  if (overlay || params.has('og') || document.visibilityState !== 'visible') return;
  try {
    await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<unknown> } }).wakeLock?.request('screen');
  } catch {
    // sem suporte, bateria fraca ou aba sem foco
  }
}
void keepAwake();
if (!params.has('og')) setTimeout(measureFps, 4000);
document.addEventListener('visibilitychange', () => void keepAwake());
setInterval(() => lastStatus && setStatus(lastStatus), 30_000);

// ---------- Avisos com o site em segundo plano (virada, início, resultado) ----------

// Android exige service worker para notificação; no iPhone só existe em app instalado.
const notifyBtn = $<HTMLButtonElement>('#notify');
const canNotify = 'Notification' in window && !/Android/.test(navigator.userAgent) && !overlay && !replayMode && !params.has('og');
let notifyOn = canNotify && Notification.permission === 'granted' && storage.get('notify') === '1';
function renderNotify() {
  notifyBtn.hidden = !canNotify || Notification.permission === 'denied';
  notifyBtn.setAttribute('aria-pressed', String(notifyOn));
}
notifyBtn.addEventListener('click', async () => {
  notifyOn = !notifyOn && (Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted');
  storage.set('notify', notifyOn ? '1' : '0');
  renderNotify();
});
renderNotify();

function notify(title: string, body: string) {
  if (!notifyOn || !document.hidden) return; // com a aba na frente, a própria luta já avisa
  try {
    new Notification((simMode ? '[SIM] ' : '') + title, { body, icon: `${location.origin}/og.png`, tag: 'urna-kombat' });
  } catch {
    // navegador recusou
  }
}

// ---------- Letreiro com o placar por estado ----------

let ticker: StatesSource | null = null;
let lastRows: StateRow[] = [];
function startTicker() {
  if (ticker || !liveMode || overlay || params.has('og')) return;
  ticker = new StatesSource(ele, renderTicker);
  ticker.start();
}
function renderTicker(rows: StateRow[]) {
  lastRows = rows;
  const el = $('#ticker');
  el.hidden = !rows.length;
  const item = ({ uf, s }: StateRow) => {
    const w = s.candidates[0].votes >= s.candidates[1].votes ? 0 : 1;
    const c = s.candidates[w];
    const label = uf === 'zz' ? t('abroad') : uf.toUpperCase();
    return `<span class="uf"><b>${label}</b> <i class="c${w}">${c.name.split(' ')[0]} ${fmtPct(c.pct)}%</i> <small>${fmtPct(s.pctSections)}%</small></span>`;
  };
  const html = rows.map(item).join('');
  const track = el.querySelector<HTMLElement>('.track')!;
  track.innerHTML = html + html; // conteúdo dobrado: a animação de -50% recomeça sem salto
  track.style.animationDuration = `${rows.length * 4}s`;
}

// ---------- Rever a luta ----------

const replayBtn = $<HTMLButtonElement>('#win-replay');
replayBtn.hidden = simMode;
replayBtn.addEventListener('click', () => location.assign('./?replay=1'));

async function runReplay() {
  $('#back-live').hidden = false;
  $('#status-text').textContent = t('replayStatus');
  $('#status-text').className = 'sim';
  const latest = await fetchOnce(ele).catch(() => null);
  const recorded = loadHistory(ele).filter((s) => s.validVotes > 0);
  let frames: Snapshot[];
  if (recorded.length >= 5 && recorded[0].pctSections < 50) {
    frames = sample(recorded);
    if (latest && latest.pctSections > frames.at(-1)!.pctSections) frames.push(latest);
  } else if (latest && latest.validVotes > 0) {
    markKey = 'replayMark'; // reconstrução: não pode passar pela apuração real
    $('#sim-mark span').dataset.i18n = 'replayMark';
    $('#sim-mark span').textContent = t('replayMark');
    $('#sim-mark').hidden = false;
    renderSimMark();
    frames = synthReplay(latest);
  } else {
    return location.replace('./'); // nada para rever ainda
  }
  startReplay(frames, onSnapshot);
}

// ---------- LivePix: recados pagos, moderados pelo próprio LivePix ----------

if (LIVEPIX_USER) {
  const link = $<HTMLAnchorElement>('#livepix');
  link.href = `https://livepix.gg/${encodeURIComponent(LIVEPIX_USER)}`;
  link.hidden = overlay; // no OBS o streamer usa os próprios alertas
}
if (LIVEPIX_WIDGET_URL && !overlay && !params.has('og')) {
  const alerts = $<HTMLIFrameElement>('#livepix-alerts');
  alerts.src = LIVEPIX_WIDGET_URL;
  alerts.hidden = false;
}

// ---------- Overlay ----------

// ---------- Tarja da simulação (texto traduzido, então gerada aqui e não no CSS) ----------

function renderSimMark() {
  if (!markKey) return;
  const text = t(markKey).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='460' height='220'><text x='230' y='120' text-anchor='middle' transform='rotate(-24 230 110)' font-family='monospace' font-weight='bold' font-size='22' fill='#ff3b30' fill-opacity='0.32'>${text}</text></svg>`;
  $('#sim-mark').style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function renderCredit() {
  const credit = $<HTMLAnchorElement>('#credit');
  credit.href = location.origin + location.pathname;
  credit.textContent = `${(location.host + location.pathname).replace(/\/$/, '')} · ${t('credit')}`;
}

if (overlay) renderCredit();
// Fora do overlay o som já vem ligado; tenta destravar agora (o Chrome deixa para quem já
// visitou o site) e, se o navegador bloquear, destrava no primeiro toque.
setMuted(overlay && params.get('sound') !== '1');
renderMute();

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
  $('#announcer').innerHTML = `URNA<br>KOMBAT<small>${t('ogSubtitle')}</small>`;
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
} else if (replayMode) {
  void runReplay();
} else {
  new TseSource(ele, onSnapshot, setStatus).start();
}
