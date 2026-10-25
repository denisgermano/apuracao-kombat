// Traduções da interface. Os bordões do Mortal Kombat (FIGHT!, FINISH HIM!, FATALITY,
// WINS, HIT…) ficam em inglês em todos os idiomas, como no jogo original.

export type Lang = 'pt' | 'en' | 'es';
export const LANGS: Lang[] = ['pt', 'en', 'es'];

const pt = {
  votes: '{n} votos',
  awaitingVotes: 'aguardando votos',
  sections: '{p}% das seções',
  connecting: '● conectando ao TSE…',
  live: '● AO VIVO · consultado {t}',
  lost: '● SINAL PERDIDO ({m}) · nova tentativa em {s}s',
  simStatus: '● SIMULAÇÃO (dados fictícios)',
  simMark: 'SIMULAÇÃO · DADOS FICTÍCIOS',
  waiting: 'AGUARDANDO APURAÇÃO · 17h',
  reversal: 'VIRADA!',
  gain: '+{d} p.p.',
  soundOn: '🔊 SOM ON',
  soundOff: '🔇 SOM OFF',
  styleToReal: '📸 REALISTA',
  styleToCartoon: '🎨 CARTOON',
  styleTitle: 'Trocar estilo visual',
  langLabel: 'Idioma',
  disclaimer: 'Dados oficiais do TSE · animação ilustrativa · sem vínculo com candidatos',
  credit: 'dados TSE · apartidário',
  pixButtonTitle: 'Apoie o projeto via Pix (não é doação de campanha)',
  winCta: '☕ CURTIU? APOIE O PROJETO VIA PIX',
  pixHeading: 'APOIE O PROJETO',
  pixLead: 'Pague um café pro site. Qualquer valor ajuda a manter a arena de pé.',
  pixDisclaimer: 'Doação ao site, <strong>não</strong> a candidatos ou partidos.<br />Projeto independente e apartidário.',
  pixHint: 'Abra o app do banco, escolha Pix › Ler QR Code<br />ou use o Pix Copia e Cola:',
  pixCopy: 'COPIAR CÓDIGO PIX',
  pixCopied: 'COPIADO! ✓',
  pixCopyFail: 'NÃO DEU — COPIE A CHAVE ABAIXO',
  pixKey: 'Chave aleatória:',
  close: 'Fechar',
  ogSubtitle: '2º TURNO · 25/10 · AO VIVO DO TSE',
  livepixButton: '💬 RECADO',
  livepixTitle: 'Mande um recado que aparece na arena (via LivePix, moderado)',
  shareButton: '📤 COMPARTILHAR',
  shareTitle: 'Chame os amigos para assistir a luta',
  shareResult: '📤 COMPARTILHAR RESULTADO',
  shareHeading: 'CHAME A TORCIDA',
  shareCopy: 'COPIAR LINK',
  shareCopied: 'COPIADO! ✓',
  shareMore: 'MAIS…',
  shareIdle: 'Lula x Flávio Bolsonaro: a apuração do 2º turno ao vivo como luta de fliperama 🥊',
  shareLive: '{a} {pa}% x {pb}% {b} com {p}% das seções apuradas 🥊 Assista a apuração como luta de fliperama:',
  shareWin: '{w} WINS! 🏆 {a} {pa}% x {pb}% {b}. Veja o fatality da apuração:',
  pixAmountLabel: 'Valor do Pix',
  pixAnyAmount: 'OUTRO',
};

export type Key = keyof typeof pt;

const en: Record<Key, string> = {
  votes: '{n} votes',
  awaitingVotes: 'awaiting votes',
  sections: '{p}% of precincts',
  connecting: '● connecting to TSE…',
  live: '● LIVE · checked {t}',
  lost: '● SIGNAL LOST ({m}) · retrying in {s}s',
  simStatus: '● SIMULATION (fictional data)',
  simMark: 'SIMULATION · FICTIONAL DATA',
  waiting: 'COUNT STARTS 5PM BRASILIA TIME',
  reversal: 'REVERSAL!',
  gain: '+{d} pts',
  soundOn: '🔊 SOUND ON',
  soundOff: '🔇 SOUND OFF',
  styleToReal: '📸 REALISTIC',
  styleToCartoon: '🎨 CARTOON',
  styleTitle: 'Switch visual style',
  langLabel: 'Language',
  disclaimer: "Official data from Brazil's Electoral Court (TSE) · illustrative animation · not affiliated with any candidate",
  credit: 'TSE data · nonpartisan',
  pixButtonTitle: 'Support the project via Pix (not a campaign donation)',
  winCta: '☕ ENJOYED IT? SUPPORT THE PROJECT VIA PIX',
  pixHeading: 'SUPPORT THE PROJECT',
  pixLead: "Buy the site a coffee via Pix, Brazil's instant payment. Any amount helps keep the arena standing.",
  pixDisclaimer: 'Donation to the site, <strong>not</strong> to candidates or parties.<br />Independent, nonpartisan project.',
  pixHint: 'Open your Brazilian bank app, choose Pix › Scan QR Code<br />or use Pix Copy &amp; Paste:',
  pixCopy: 'COPY PIX CODE',
  pixCopied: 'COPIED! ✓',
  pixCopyFail: "COULDN'T COPY — USE THE KEY BELOW",
  pixKey: 'Random key:',
  close: 'Close',
  ogSubtitle: 'RUNOFF · OCT 25 · LIVE FROM TSE',
  livepixButton: '💬 MESSAGE',
  livepixTitle: 'Send a message that shows up in the arena (via LivePix, moderated)',
  shareButton: '📤 SHARE',
  shareTitle: 'Invite friends to watch the fight',
  shareResult: '📤 SHARE THE RESULT',
  shareHeading: 'CALL THE CROWD',
  shareCopy: 'COPY LINK',
  shareCopied: 'COPIED! ✓',
  shareMore: 'MORE…',
  shareIdle: "Lula vs Flávio Bolsonaro: Brazil's runoff count live as an arcade fight 🥊",
  shareLive: '{a} {pa}% vs {pb}% {b} with {p}% of precincts counted 🥊 Watch the count as an arcade fight:',
  shareWin: '{w} WINS! 🏆 {a} {pa}% vs {pb}% {b}. Watch the vote-count fatality:',
  pixAmountLabel: 'Pix amount',
  pixAnyAmount: 'OTHER',
};

const es: Record<Key, string> = {
  votes: '{n} votos',
  awaitingVotes: 'esperando votos',
  sections: '{p}% de las mesas',
  connecting: '● conectando con el TSE…',
  live: '● EN VIVO · consultado {t}',
  lost: '● SEÑAL PERDIDA ({m}) · reintento en {s}s',
  simStatus: '● SIMULACIÓN (datos ficticios)',
  simMark: 'SIMULACIÓN · DATOS FICTICIOS',
  waiting: 'ESCRUTINIO DESDE LAS 17H DE BRASILIA',
  reversal: '¡REMONTADA!',
  gain: '+{d} p.p.',
  soundOn: '🔊 SONIDO ON',
  soundOff: '🔇 SONIDO OFF',
  styleToReal: '📸 REALISTA',
  styleToCartoon: '🎨 CARTOON',
  styleTitle: 'Cambiar estilo visual',
  langLabel: 'Idioma',
  disclaimer: 'Datos oficiales del TSE de Brasil · animación ilustrativa · sin vínculo con candidatos',
  credit: 'datos TSE · apartidista',
  pixButtonTitle: 'Apoya el proyecto vía Pix (no es una donación de campaña)',
  winCta: '☕ ¿TE GUSTÓ? APOYA EL PROYECTO VÍA PIX',
  pixHeading: 'APOYA EL PROYECTO',
  pixLead: 'Invita un café al sitio vía Pix, el pago instantáneo de Brasil. Cualquier monto ayuda a mantener la arena.',
  pixDisclaimer: 'Donación al sitio, <strong>no</strong> a candidatos ni partidos.<br />Proyecto independiente y apartidista.',
  pixHint: 'Abre la app de tu banco brasileño, elige Pix › Leer código QR<br />o usa Pix Copia y Pega:',
  pixCopy: 'COPIAR CÓDIGO PIX',
  pixCopied: '¡COPIADO! ✓',
  pixCopyFail: 'NO SE PUDO — COPIA LA CLAVE ABAJO',
  pixKey: 'Clave aleatoria:',
  close: 'Cerrar',
  ogSubtitle: 'SEGUNDA VUELTA · 25/10 · EN VIVO DEL TSE',
  livepixButton: '💬 MENSAJE',
  livepixTitle: 'Envía un mensaje que aparece en la arena (vía LivePix, moderado)',
  shareButton: '📤 COMPARTIR',
  shareTitle: 'Invita a tus amigos a ver la pelea',
  shareResult: '📤 COMPARTIR RESULTADO',
  shareHeading: 'LLAMA A LA HINCHADA',
  shareCopy: 'COPIAR ENLACE',
  shareCopied: '¡COPIADO! ✓',
  shareMore: 'MÁS…',
  shareIdle: 'Lula vs Flávio Bolsonaro: el escrutinio de la segunda vuelta en vivo como pelea de arcade 🥊',
  shareLive: '{a} {pa}% vs {pb}% {b} con {p}% de las mesas escrutadas 🥊 Mira el escrutinio como pelea de arcade:',
  shareWin: '¡{w} WINS! 🏆 {a} {pa}% vs {pb}% {b}. Mira el fatality del escrutinio:',
  pixAmountLabel: 'Monto del Pix',
  pixAnyAmount: 'OTRO',
};

export const DICTS: Record<Lang, Record<Key, string>> = { pt, en, es };
const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };

const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** ?lang= > escolha salva > idiomas do navegador > inglês. */
export function detectLang(param: string | null, saved: string | null, browser: readonly string[]): Lang {
  if (isLang(param)) return param;
  if (isLang(saved)) return saved;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

let current: Lang = 'pt';

export const getLang = () => current;
export const locale = () => LOCALES[current];

export function setLang(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = LOCALES[lang];
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return DICTS[current][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** Aplica as traduções aos elementos marcados com data-i18n (texto), data-i18n-html, data-i18n-title e data-i18n-aria. */
export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle as Key)));
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria as Key)));
}
