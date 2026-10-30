// Página de análise do 1º x 2º turno: lê dados.json (gerado por analise/exportar_web.py) e desenha tudo em SVG.
import './analise.css';
import { LANGS, detectLang, type Lang } from '../i18n';
import { type AKey, aLang, applyAStatic, at, inUf, setALang } from './i18n';

type T1 = { Lula: number; Flávio: number; Outros: number; BN: number; Abst: number; Eleit: number };
type T2 = { Lula: number; Flávio: number; BN: number; Abst: number; Eleit: number };
type Sec = { secoes: number; votos: number; v17: number; s17: number; v1730: number; s1730: number; v18: number; s18: number; v19: number; s19: number };
type PorTurno<T> = { t1: T; t2: T };
type Area = {
  t1: T1;
  t2: T2;
  hora: PorTurno<Record<string, number>>;
  tarde: PorTurno<Record<string, number>>;
  secoes: PorTurno<Sec>;
};
type Cand = 'Lula' | 'Flávio';
type Dados = {
  br: Area;
  uf: Record<string, Area>;
  mun: [string, string, ...number[]][];
  decomposicao: Record<string, Record<Cand, Record<string, number>>>;
  fluxos: Record<string, Record<string, number>>;
};

type Digito = { p: number };
type Auditoria = {
  logs: Record<string, number>;
  bu: Record<string, number> & { soma_sa: Record<string, number> };
  oficial: Record<'13' | '22', number>;
  assinaturas: Record<string, number>;
  municipios: Record<string, number>;
  secoes: { n: number; zeros: { lula: number; flavio: number }; fora_da_zona: number; comparecimento_100: number; klimek: number; ultimo_digito: { lula: Digito; flavio: Digito } };
  sinalizadas: [string, string, string, number, number, number, number, number, number, number | null, number | null, number | null, number | null, number | null][];
  sinalizadas_resumo: Record<'zero' | 'zona' | 'comp', { mediana_dif_pp: number; max_dif_pp: number }>;
  biometria?: {
    votos: number; bio: number; falha: number; sem: number; apos_17h: number; apos_17h_sem_bio: number;
    hora: Record<string, [number, number]>; inclinacao_municipio: number;
  };
};

const UF_PT: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
};
const ufNome = (k: string) => (k === 'Exterior' ? at('abroad') : k === 'DF' && aLang() === 'en' ? 'Federal District' : UF_PT[k] ?? k);
const ufCurto = (k: string) => (k === 'Exterior' ? at('abroadShort') : k);
const BR = 'BR';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;
const SVG = 'http://www.w3.org/2000/svg';

// ---------- formatação (locale do idioma escolhido) ----------
const LOC: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const loc = () => LOC[aLang()];
const num = (n: number, o: Intl.NumberFormatOptions = {}) => n.toLocaleString(loc(), { useGrouping: true, ...o });
const fmt = (n: number) => num(Math.round(n));
const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '');
const signed = (n: number) => sign(n) + fmt(Math.abs(n));
const dec = (x: number, d: number) => num(x, { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x: number, d = 1) => dec(x * 100, d) + '%';
const spct = (x: number, d = 1) => sign(x) + pct(Math.abs(x), d);
const pp = (x: number, d = 1) => `${sign(x)}${dec(Math.abs(x) * 100, d)} ${at('unitPP')}`;
const mi = (n: number, d = 2) => `${dec(n / 1e6, d)} ${at('unitM')}`;
const curto = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${num(n / 1e6, { maximumFractionDigits: 1 })} ${at('unitM')}`;
  if (a >= 1e3) return `${num(n / 1e3, { maximumFractionDigits: 0 })} ${at('unitK')}`;
  return fmt(n);
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cls = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const hh = (min: number) => {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return aLang() === 'pt' ? `${h}h${m}` : `${h}:${m}`;
};
const plural = (n: number, um: AKey, varios: AKey) => at(n === 1 ? um : varios);

// ---------- derivados ----------
const comp = (t: { Eleit: number; Abst: number }) => t.Eleit - t.Abst;
const val1 = (t: T1) => t.Lula + t.Flávio + t.Outros;
const val2 = (t: T2) => t.Lula + t.Flávio;
const varPct = (a: number, b: number) => (a ? (b - a) / a : NaN);

// ---------- tooltip ----------
const tip = $('#tip');
function showTip(html: string, e: PointerEvent | MouseEvent) {
  tip.innerHTML = html;
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14;
  let y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}
const hideTip = () => (tip.hidden = true);
const tipRow = (sw: string, k: string, v: string) => `<div class="r"><span><i class="sw ${sw}"></i>${k}</span><span>${v}</span></div>`;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent?.appendChild(n);
  return n;
}
function text(s: string, attrs: Record<string, string | number>, parent: Element) {
  const t = el('text', attrs, parent);
  t.textContent = s;
  return t;
}

/** Retângulo com cantos arredondados só na ponta do dado (a base fica reta, no eixo). */
function barPath(x0: number, x1: number, y: number, h: number, horiz: boolean) {
  const r = Math.min(4, Math.abs(x1 - x0) / 2, h / 2);
  if (horiz) {
    const s = x1 >= x0 ? 1 : -1;
    return `M${x0},${y}H${x1 - s * r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - s * r},${y + h}H${x0}Z`;
  }
  // vertical: x0/x1 são y da base e do topo; y/h são x e largura
  return `M${y},${x0}V${x1 + r}Q${y},${x1} ${y + r},${x1}H${y + h - r}Q${y + h},${x1} ${y + h},${x1 + r}V${x0}Z`;
}

function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0)!;
  const out: number[] = [];
  const end = Math.ceil(hi / step - 1e-9) * step;
  for (let v = Math.floor(lo / step + 1e-9) * step; v <= end + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// ---------- gráfico de barras horizontais (UFs, transferências) ----------
type Serie = { cls: string; nome: string };
type HRow = { key: string; label: string; vals: (number | [number, number])[]; tip: string; sel?: boolean };

function hbars(host: HTMLElement, rows: HRow[], series: Serie[], tick: (v: number) => string,
  opts: { ref?: { v: number; label: string }; onClick?: (k: string) => void; labelW?: number; lo?: number } = {}) {
  host.textContent = '';
  const W = Math.max(300, host.clientWidth);
  const labelW = opts.labelW ?? 64;
  const padR = 16;
  const barH = 8;
  const gap = 2;
  const rowH = series.length * barH + (series.length - 1) * gap + 10;
  const top = 22;
  const H = top + rows.length * rowH + 4;
  const all = rows.flatMap((r) => r.vals.flatMap((v) => (Array.isArray(v) ? v : [v])));
  let lo = Math.min(opts.lo ?? 0, ...all);
  let hi = Math.max(0, ...all, opts.ref?.v ?? 0);
  if (hi === lo) hi = lo + 1;
  const ticks = niceTicks(lo, hi);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * (W - labelW - padR);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
  const g = el('g', { class: 'grid' }, svg);
  const ax = el('g', { class: 'axis' }, svg);
  for (const t of ticks) {
    el('line', { x1: x(t), x2: x(t), y1: top - 4, y2: H }, g);
    text(tick(t), { x: x(t), y: 12, 'text-anchor': 'middle' }, ax);
  }
  if (opts.ref) {
    el('line', { x1: x(opts.ref.v), x2: x(opts.ref.v), y1: top - 4, y2: H, class: 'mark17' }, svg);
  }
  rows.forEach((r, i) => {
    const y0 = top + i * rowH;
    const row = el('g', { class: 'row' + (r.sel ? ' sel' : '') }, svg);
    el('rect', { class: 'hit', x: 0, y: y0, width: W, height: rowH, rx: 4 }, row);
    text(r.label, { class: 'lbl', x: labelW - 8, y: y0 + rowH / 2 + 4, 'text-anchor': 'end' }, row);
    r.vals.forEach((v, j) => {
      const y = y0 + 5 + j * (barH + gap);
      const c = series[j].cls;
      if (Array.isArray(v)) {
        const [a, b] = v;
        el('path', { d: barPath(x(0), x(a), y, barH, true), class: c }, row);
        if (b > a) el('rect', { x: x(a), y: y + 1, width: x(b) - x(a), height: barH - 2, rx: 2, class: c, opacity: 0.35 }, row);
      } else if (v) {
        el('path', { d: barPath(x(0), x(v), y, barH, true), class: c }, row);
      }
    });
    row.addEventListener('pointermove', (e) => showTip(r.tip, e));
    row.addEventListener('pointerleave', hideTip);
    if (opts.onClick) row.addEventListener('click', () => opts.onClick!(r.key));
  });
  el('line', { x1: x(0), x2: x(0), y1: top - 4, y2: H, class: 'base' }, svg);
}

// ---------- gráfico de colunas agrupadas (horário) ----------
function vbars(host: HTMLElement, cats: { key: number; label: string; tick: boolean }[], series: Serie[],
  val: (s: number, k: number) => number, tipFor: (k: number) => string, tick: (v: number) => string,
  opts: { log?: boolean; marks?: { at: number; label: string }[] } = {}) {
  host.textContent = '';
  const W = Math.max(300, host.clientWidth);
  const H = Math.round(Math.min(280, Math.max(200, W * 0.32)));
  const padL = 52;
  const padB = 22;
  const top = 18;
  const all = cats.flatMap((c) => series.map((_, s) => val(s, c.key)));
  const max = Math.max(...all, 1e-9);
  let ticks: number[];
  let y: (v: number) => number;
  const h = H - padB - top;
  if (opts.log) {
    const hiExp = Math.ceil(Math.log10(max));
    ticks = Array.from({ length: hiExp + 1 }, (_, i) => 10 ** i);
    y = (v) => H - padB - (v <= 0 ? 0 : (Math.log10(Math.max(1, v)) / hiExp) * h);
  } else {
    ticks = niceTicks(0, max, 4);
    const top2 = ticks[ticks.length - 1];
    y = (v) => H - padB - (v / top2) * h;
  }
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
  const g = el('g', { class: 'grid' }, svg);
  const ax = el('g', { class: 'axis' }, svg);
  for (const t of ticks) {
    el('line', { x1: padL, x2: W, y1: y(t), y2: y(t) }, g);
    text(tick(t), { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end' }, ax);
  }
  const band = (W - padL) / cats.length;
  const bw = Math.max(2, Math.min(14, (band - 4) / series.length - 2));
  cats.forEach((c, i) => {
    const x0 = padL + i * band;
    const grp = el('g', { class: 'row' }, svg);
    el('rect', { class: 'hit', x: x0, y: top, width: band, height: h, rx: 3 }, grp);
    const inner = series.length * bw + (series.length - 1) * 2;
    series.forEach((s, j) => {
      const v = val(j, c.key);
      if (v <= 0) return;
      const bx = x0 + (band - inner) / 2 + j * (bw + 2);
      const yv = Math.min(y(v), H - padB - 1);
      el('path', { d: barPath(H - padB, yv, bx, bw, false), class: s.cls }, grp);
    });
    if (c.tick && (band >= 26 || i % 2 === 0)) text(c.label, { x: x0 + band / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, grp);
    grp.addEventListener('pointermove', (e) => showTip(tipFor(c.key), e));
    grp.addEventListener('pointerleave', hideTip);
  });
  for (const m of opts.marks ?? []) {
    const i = cats.findIndex((c) => c.key === m.at);
    if (i < 0) continue;
    const mx = padL + i * band;
    el('line', { x1: mx, x2: mx, y1: top - 6, y2: H - padB, class: 'mark17' }, svg);
    text(m.label, { x: mx + 4, y: top - 8, class: 'mark17t' }, svg);
  }
  el('line', { x1: padL, x2: W, y1: H - padB, y2: H - padB, class: 'base' }, svg);
}

// ---------- estado ----------
let D: Dados;
let uf = new URLSearchParams(location.search).get('uf') ?? BR;
let metrica: 'pct' | 'abs' | 'pv' = 'pct';
let logScale = true;
const area = () => (uf === BR ? D.br : D.uf[uf]);
const nomeArea = () => (uf === BR ? at('brazil') : ufNome(uf));
const naArea = () => {
  if (uf === BR) return at('inBrazil');
  if (uf === 'Exterior') return at('inAbroad');
  return inUf(uf, ufNome(uf));
};

function setUf(k: string) {
  uf = k === uf && k !== BR ? BR : k;
  ($('#uf') as HTMLSelectElement).value = uf;
  const q = new URLSearchParams(location.search);
  if (uf === BR) q.delete('uf');
  else q.set('uf', uf);
  history.replaceState(null, '', `${location.pathname}${q.size ? '?' + q : ''}${location.hash}`);
  munLimite = 50;
  flagLimite = 30;
  render();
}

// ---------- seções ----------
function tiles() {
  const a = area();
  const { t1, t2 } = a;
  const c = (k: Cand, sw: string) => {
    const d = t2[k] - t1[k];
    return `<div class="tile"><div class="k"><i class="sw ${sw}"></i>${at('tileCand', { c: k === 'Lula' ? 'Lula (13)' : 'Flávio (22)' })}</div>
      <div class="v">${fmt(t2[k])}</div>
      <div class="d"><span class="${cls(d)}">${signed(d)} (${spct(varPct(t1[k], t2[k]))})</span> ${at('vsT1')}<br>${pct(t1[k] / val1(t1))} → <strong>${pct(t2[k] / val2(t2))}</strong> ${at('ofValid')}</div></div>`;
  };
  const c1 = comp(t1) / t1.Eleit;
  const c2 = comp(t2) / t2.Eleit;
  const s = a.secoes;
  $('#tiles').innerHTML = c('Lula', 'lula') + c('Flávio', 'flavio') +
    `<div class="tile"><div class="k">${at('turnout')}</div><div class="v">${pct(c2)}</div>
      <div class="d">${at('t1')}: ${pct(c1)} · <span class="${cls(c2 - c1)}">${pp(c2 - c1)}</span><br>${at('voters', { n: signed(comp(t2) - comp(t1)) })}</div></div>` +
    `<div class="tile"><div class="k">${at('after18Tile')}</div><div class="v">${fmt(s.t2.v18)}</div>
      <div class="d">${at('t1')}: ${fmt(s.t1.v18)}<br>${at('after17Line', { a: fmt(s.t2.v17), b: fmt(s.t1.v17) })}</div></div>`;
}

const legendaTurnos = (extra = '') =>
  `<span><i class="sw t1"></i>${at('legendT1')}</span><span><i class="sw t2"></i>${at('legendT2')}</span>${extra}`;

function variacao() {
  const ufs = Object.keys(D.uf);
  const legend = $('#var-legend');
  const host = $('#var-chart');
  const tipUf = (k: string) => {
    const { t1, t2 } = D.uf[k];
    const linha = (c: Cand, sw: string) =>
      tipRow(sw, c, `${fmt(t1[c])} → ${fmt(t2[c])} (${spct(varPct(t1[c], t2[c]))})`);
    return `<b>${esc(ufNome(k))}</b>${linha('Lula', 'lula')}${linha('Flávio', 'flavio')}` +
      tipRow('', at('tipValid'), `${pct(t1.Lula / val1(t1))} → ${pct(t2.Lula / val2(t2))}`) +
      tipRow('', at('turnout'), `${pct(comp(t1) / t1.Eleit)} → ${pct(comp(t2) / t2.Eleit)}`);
  };
  let rows: HRow[];
  if (metrica === 'pv') {
    legend.innerHTML = legendaTurnos(`<span>${at('line50')}</span>`);
    rows = ufs.map((k) => {
      const { t1, t2 } = D.uf[k];
      return { key: k, label: ufCurto(k), vals: [t1.Lula / val1(t1), t2.Lula / val2(t2)], tip: tipUf(k), sel: k === uf };
    }).sort((a, b) => (b.vals[1] as number) - (a.vals[1] as number));
    hbars(host, rows, [{ cls: 't1', nome: at('t1') }, { cls: 't2', nome: at('t2') }], (v) => pct(v, 0),
      { ref: { v: 0.5, label: '50%' }, onClick: setUf });
    return;
  }
  legend.innerHTML = '<span><i class="sw lula"></i>Lula</span><span><i class="sw flavio"></i>Flávio</span>';
  const f = metrica === 'pct'
    ? (a: number, b: number) => varPct(a, b)
    : (a: number, b: number) => b - a;
  rows = ufs.map((k) => {
    const { t1, t2 } = D.uf[k];
    return { key: k, label: ufCurto(k), vals: [f(t1.Lula, t2.Lula), f(t1.Flávio, t2.Flávio)], tip: tipUf(k), sel: k === uf };
  }).sort((a, b) => (b.vals[0] as number) - (a.vals[0] as number));
  hbars(host, rows, [{ cls: 'lula', nome: 'Lula' }, { cls: 'flavio', nome: 'Flávio' }],
    metrica === 'pct' ? (v) => pct(v, 0) : curto, { onClick: setUf, labelW: aLang() === 'en' ? 72 : 64 });
}

function horario() {
  const a = area();
  const s = a.secoes;
  const margem = Math.abs(a.t2.Lula - a.t2.Flávio);
  $('#ext-sub').textContent = at('extSub', { n: fmt(s.t2.secoes), area: naArea(), v: fmt(s.t2.votos) });
  $('#ext-headline').innerHTML = s.t2.v18 === 0
    ? at('extNone', { area: esc(nomeArea()), t1: fmt(s.t1.v18) })
    : at('extSome', {
      area: esc(nomeArea()), n: fmt(s.t2.v18), votes: plural(s.t2.v18, 'vote1', 'voteN'), p: pct(s.t2.v18 / s.t2.votos, 3),
      s: fmt(s.t2.s18), sections: plural(s.t2.s18, 'section1', 'sectionN'), t1: fmt(s.t1.v18), m: fmt(margem),
    });
  $('#hora-legend').innerHTML = legendaTurnos();
  const series = [{ cls: 't1', nome: at('t1') }, { cls: 't2', nome: at('t2') }];
  const turnos = ['t1', 't2'] as const;
  const nomeT = (i: number) => at(i ? 't2' : 't1');
  const tot = turnos.map((t) => Object.values(a.hora[t]).reduce((x, y) => x + y, 0) || 1);
  const horas = Array.from({ length: 13 }, (_, i) => i + 7).filter((h) => turnos.some((t) => (a.hora[t][h] ?? 0) > 0) || (h >= 8 && h <= 19));
  vbars($('#hora-chart'), horas.map((h) => ({ key: h, label: at('hourAxis', { h }), tick: true })), series,
    (si, h) => (a.hora[turnos[si]][h] ?? 0) / tot[si],
    (h) => `<b>${at('hourTip', { h })}</b>` + turnos.map((t, i) => tipRow(t, nomeT(i),
      `${fmt(a.hora[t][h] ?? 0)} (${pct((a.hora[t][h] ?? 0) / tot[i])})`)).join(''),
    (v) => pct(v, 0));

  const bins = Array.from({ length: 24 }, (_, i) => 960 + i * 10);
  vbars($('#tarde-chart'), bins.map((m) => ({ key: m, label: at('hourAxis', { h: m / 60 }), tick: m % 60 === 0 })), series,
    (si, m) => a.tarde[turnos[si]][m] ?? 0,
    (m) => `<b>${at('binTip', { a: hh(m), b: hh(m + 9) })}</b>` + turnos.map((t, i) => tipRow(t, nomeT(i), fmt(a.tarde[t][m] ?? 0))).join(''),
    (v) => curto(v), { log: logScale, marks: [{ at: 1020, label: hh(1020) }, { at: 1080, label: hh(1080) }] });

  const cortes = [['v17', 's17', 1020], ['v1730', 's1730', 1050], ['v18', 's18', 1080], ['v19', 's19', 1140]] as const;
  const cab = `<th>${at('t1')}</th><th>${at('ofRound')}</th><th>${at('sections')}</th>`;
  $('#ext-table').innerHTML = `<thead><tr><th>${at('votesFrom')}</th>${cab}${cab.replace(at('t1'), at('t2'))}</tr></thead><tbody>` +
    cortes.map(([v, sc, m]) => `<tr><td>${hh(m)}</td><td>${fmt(s.t1[v])}</td><td>${pct(s.t1[v] / s.t1.votos, 3)}</td><td>${fmt(s.t1[sc])}</td>` +
      `<td><strong>${fmt(s.t2[v])}</strong></td><td>${pct(s.t2[v] / s.t2.votos, 3)}</td><td>${fmt(s.t2[sc])}</td></tr>`).join('') +
    `<tr><td>${at('totalRecorded')}</td><td>${fmt(s.t1.votos)}</td><td></td><td>${fmt(s.t1.secoes)}</td><td>${fmt(s.t2.votos)}</td><td></td><td>${fmt(s.t2.secoes)}</td></tr></tbody>`;
}

const ORIGENS: [string, AKey | null][] = [
  ['Abstenção', 'oAbst'], ['Branco/Nulo', 'oBN'], ['Cury', null], ['Renan', null],
  ['Caiado', null], ['Zema', null], ['Outros', 'oOthers'], ['rival', 'oRival'],
];

function transferencia() {
  const brasil = uf === BR;
  const fl = D.fluxos[uf];
  $('#tr-sub').textContent = brasil ? at('trSubBR') : fl ? at('trSubUF', { area: nomeArea() }) : '';
  $('#tr-legend').innerHTML = '<span><i class="sw lula"></i>Lula</span><span><i class="sw flavio"></i>Flávio</span>' +
    (brasil ? `<span>${at('trRange')}</span>` : '');
  const host = $('#tr-chart');
  if (!brasil && !fl) {
    host.innerHTML = `<p class="note">${at('trNone')}</p>`;
    $('#tr-summary').textContent = '';
    return;
  }
  const specs = Object.values(D.decomposicao);
  const faixa = (c: Cand, o: string): [number, number] => {
    const k = o === 'rival' ? 'do rival' : o;
    const v = specs.map((s) => s[c][k]);
    return [Math.min(...v), Math.max(...v)];
  };
  const ponto = (c: Cand, o: string) => {
    if (o === 'rival') return fl[c === 'Lula' ? 'Flávio→Lula' : 'Lula→Flávio'] ?? 0;
    return fl[`${o}→${c}`] ?? 0;
  };
  const fx = (v: number | [number, number]) =>
    Array.isArray(v) ? (v[0] === v[1] ? mi(v[0]) : at('range', { a: mi(v[0]), b: mi(v[1]) })) : fmt(v);
  const rows: HRow[] = ORIGENS.map(([o, chave]) => {
    const label = chave ? at(chave) : o;
    const vals = brasil ? [faixa('Lula', o), faixa('Flávio', o)] : [ponto('Lula', o), ponto('Flávio', o)];
    return {
      key: o, label, vals,
      tip: `<b>${label}</b>${tipRow('lula', at('toLula'), fx(vals[0]))}${tipRow('flavio', at('toFlavio'), fx(vals[1]))}`,
    };
  });
  hbars(host, rows, [{ cls: 'lula', nome: 'Lula' }, { cls: 'flavio', nome: 'Flávio' }],
    brasil ? (v) => num(v / 1e6) : curto, { labelW: 140 });
  if (brasil) {
    const saldos = specs.map((s) => s.Lula['do rival'] - s.Flávio['do rival']);
    const [l1, l2] = faixa('Lula', 'rival');
    const [f1, f2] = faixa('Flávio', 'rival');
    $('#tr-summary').innerHTML = at('trSumBR', {
      l1: mi(l1, 1), l2: mi(l2, 1), f1: mi(f1, 1), f2: mi(f2, 1),
      s1: mi(Math.min(...saldos), 1), s2: mi(Math.max(...saldos), 1),
    });
  } else {
    const s = fl.saldo_troca_Lula ?? 0;
    $('#tr-summary').innerHTML = at('trSumUF', { n: signed(s), c: s >= 0 ? 'Lula' : 'Flávio', area: esc(naArea()) });
  }
}

// ---------- auditoria ----------
let AUD: Auditoria | null = null;
let flagTipo: 'zero' | 'comp' | 'zona' = 'zero';
let flagLimite = 30;

function auditoria() {
  if (!AUD) return;
  const A = AUD;
  const l = A.logs;
  const b = A.bu;
  const s = A.assinaturas;
  const m = A.municipios;
  const sc = A.secoes;
  const r = A.sinalizadas_resumo.zona;
  const p3 = (x: number) => dec(x, 2);
  const linhas: [string, AKey, string][] = [
    ['ok', 'cSum', at('rSum', { l: fmt(A.oficial['13']), f: fmt(A.oficial['22']), n: fmt(b.sa) })],
    ['ok', 'cRdv', at('rRdv', { a: fmt(b.rdv_igual), b: fmt(b.com_rdv) })],
    ['ok', 'cSig', at('rSig', { a: fmt(s.conteudo_ok), b: fmt(s.secoes) })],
    ['ok', 'cSoft', at('rSoft', { a: fmt(l.versao_oficial), b: fmt(l.com_log) })],
    ['ok', 'cLog', at('rLog', { a: fmt(b.log_igual), b: fmt(b.log_menor), c: fmt(b.log_menor_contingencia) })],
    ['ok', 'cWin', at('rWin')],
    ['ok', 'cRhy', at('rRhy', { g: fmt(l.gap_min_s) })],
    ['ok', 'cDup', at('rDup', { n: fmt(l.ja_votou) })],
    ['ok', 'cDig', at('rDig', { a: p3(sc.ultimo_digito.lula.p), b: p3(sc.ultimo_digito.flavio.p) })],
    ['ok', 'cKli', at('rKli', { k: fmt(sc.klimek), n: fmt(sc.n), c: fmt(sc.comparecimento_100) })],
    ['info', 'cZero', at('rZero', { f: fmt(sc.zeros.flavio), l: fmt(sc.zeros.lula) })],
    ['info', 'cOut', at('rOut', { n: fmt(sc.fora_da_zona), m: `${dec(r.mediana_dif_pp, 1)} ${at('unitPP')}`, x: `${dec(r.max_dif_pp, 1)} ${at('unitPP')}` })],
    ['info', 'cDrop', at('rDrop', { n: fmt(m.quedas_comparecimento) })],
  ];
  const bi = A.biometria;
  if (bi) {
    const dia = Object.entries(bi.hora).filter(([h]) => +h < 17).map(([, [v, n]]) => n / v);
    linhas.push(['info', 'cBio', at('rBio', {
      p: pct((bi.falha + bi.sem) / bi.votos), n: fmt(bi.falha + bi.sem), f: fmt(bi.falha), s: fmt(bi.sem),
      min: pct(Math.min(...dia)), max: pct(Math.max(...dia)), a: fmt(bi.apos_17h), b: fmt(bi.apos_17h_sem_bio),
    })]);
  }
  $('#aud-headline').innerHTML = at('audHead');
  $('#aud-table').innerHTML = `<tbody>${linhas.map(([st, k, v]) =>
    `<tr><td class="st ${st}" aria-hidden="true">${st === 'ok' ? '✓' : '!'}</td><td>${at(k)}</td><td>${v}</td></tr>`).join('')}</tbody>`;
  if (bi) {
    $('#bio').hidden = false;
    $('#bio-table').innerHTML = `<thead><tr><th scope="col">${at('colHour')}</th><th scope="col">${at('colVotesH')}</th>` +
      `<th scope="col">${at('colNoBio')}</th></tr></thead><tbody>` +
      Object.entries(bi.hora).map(([h, [v, n]]) =>
        `<tr><td>${+h >= 18 ? '18:00+' : `${h}:00–${+h + 1}:00`}</td><td>${fmt(v)}</td><td>${pct(n / v)}<span class="sub2">${fmt(n)}</span></td></tr>`).join('') +
      '</tbody>';
    $('#bio-note').textContent = at('bioNote', { s: `${dec(bi.inclinacao_municipio * 10, 1)} ${at('unitPP')}` });
  }
  sinalizadas();
}

function sinalizadas() {
  if (!AUD) return;
  const rows = AUD.sinalizadas
    .filter((x) => x[0] === flagTipo && (uf === BR || x[1] === uf))
    .sort((a, b) => b[6] + b[7] - (a[6] + a[7]));
  $('#flag-sub').textContent = at('flagSub', {
    n: fmt(rows.length), sections: plural(rows.length, 'section1', 'sectionN'), area: uf === BR ? '' : ' ' + naArea(),
  });
  const par = (lu: number, fl: number) =>
    `${fmt(lu)} × ${fmt(fl)}<span class="sub2">${lu + fl ? pct(lu / (lu + fl), 0) + ' Lula' : '–'}</span>`;
  const t = $('#flag-table');
  if (!rows.length) {
    t.innerHTML = `<tbody><tr><td class="note">${at('flagNone')}</td></tr></tbody>`;
  } else {
    t.innerHTML = `<thead><tr><th scope="col">${at('colMun')}</th><th scope="col">${at('colSec')}</th><th scope="col">${at('colT2')}</th>` +
      `<th scope="col">${at('colT1')}</th><th scope="col">${at('colComp')}</th></tr></thead><tbody>` +
      rows.slice(0, flagLimite).map((x) => {
        const [, u, nome, z, sec, aptos, l2, f2, bn2, l1, f1, , c1, a1] = x;
        const c2 = aptos ? (l2 + f2 + bn2) / aptos : NaN;
        const cc1 = c1 != null && a1 ? c1 / a1 : NaN;
        return `<tr><td>${esc(nomeMun(nome.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (c) => c.toUpperCase())))} <span class="note">${ufCurto(u)}</span></td>` +
          `<td>${z} / ${sec}</td><td>${par(l2, f2)}</td><td>${l1 == null ? '–' : par(l1, f1 ?? 0)}</td>` +
          `<td>${isNaN(c2) ? '–' : pct(c2, 0)}<span class="sub2">${at('t1Short')}: ${isNaN(cc1) ? '–' : pct(cc1, 0)}</span></td></tr>`;
      }).join('') + '</tbody>';
  }
  const more = $('#flag-more') as HTMLButtonElement;
  more.hidden = rows.length <= flagLimite;
  more.textContent = at('more', { a: fmt(Math.min(100, rows.length - flagLimite)), b: fmt(rows.length - flagLimite) });
}

// ---------- municípios ----------
type Mun = { uf: string; nome: string; L1: number; L2: number; F1: number; F2: number; O1: number; BN1: number; BN2: number; A1: number; A2: number; Eleit: number; ap1: number; ap2: number; log2: number; busca: string };
let MUNS: Mun[] = [];
let munLimite = 50;
let munSort = { col: 1, asc: false };
const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e', "d'"]);
const nomeMun = (s: string) => s.split(' ').map((w, i) => (i && MINUSC.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ');
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const COLS: { th: () => string; v: (m: Mun) => number | string; td: (m: Mun) => string }[] = [
  { th: () => at('colMun'), v: (m) => m.busca, td: (m) => `${esc(m.nome)}${uf === BR ? ` <span class="note">${ufCurto(m.uf)}</span>` : ''}` },
  { th: () => at('colElect'), v: (m) => m.Eleit, td: (m) => fmt(m.Eleit) },
  { th: () => at('colLula2'), v: (m) => m.L2, td: (m) => fmt(m.L2) },
  { th: () => 'Δ Lula', v: (m) => varPct(m.L1, m.L2) || 0, td: (m) => `<span class="${cls(m.L2 - m.L1)}">${m.L1 ? spct(varPct(m.L1, m.L2)) : '–'}</span>` },
  { th: () => at('colFlavio2'), v: (m) => m.F2, td: (m) => fmt(m.F2) },
  { th: () => 'Δ Flávio', v: (m) => varPct(m.F1, m.F2) || 0, td: (m) => `<span class="${cls(m.F2 - m.F1)}">${m.F1 ? spct(varPct(m.F1, m.F2)) : '–'}</span>` },
  { th: () => at('colValid'), v: (m) => m.L2 / (m.L2 + m.F2 || 1), td: (m) => `${pct(m.L1 / (m.L1 + m.F1 + m.O1 || 1))} → ${pct(m.L2 / (m.L2 + m.F2 || 1))}` },
  { th: () => at('colTurnout'), v: (m) => (m.Eleit - m.A2) / (m.Eleit || 1), td: (m) => {
    const c1 = (m.Eleit - m.A1) / (m.Eleit || 1);
    const c2 = (m.Eleit - m.A2) / (m.Eleit || 1);
    return `${pct(c2)} <span class="${cls(c2 - c1)}">(${pp(c2 - c1)})</span>`;
  } },
  { th: () => at('colAfter17'), v: (m) => m.ap2, td: (m) => fmt(m.ap2) },
];

function municipios() {
  const q = norm(($('#mun-search') as HTMLInputElement).value.trim());
  let rows = MUNS.filter((m) => (uf === BR || m.uf === uf) && (!q || m.busca.includes(q)));
  const col = COLS[munSort.col];
  rows = rows.sort((a, b) => {
    const x = col.v(a);
    const y = col.v(b);
    const r = typeof x === 'string' ? x.localeCompare(y as string, 'pt-BR') : (x as number) - (y as number);
    return munSort.asc ? r : -r;
  });
  $('#mun-sub').textContent = at('munSub', {
    n: fmt(rows.length), muns: plural(rows.length, 'mun1', 'munN'), area: uf === BR ? '' : ' ' + naArea(),
  });
  const t = $('#mun-table');
  t.innerHTML = `<thead><tr>${COLS.map((c, i) => `<th scope="col" data-i="${i}"${i === munSort.col ? ` aria-sort="${munSort.asc ? 'ascending' : 'descending'}"` : ''}>${c.th()}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.slice(0, munLimite).map((m) => `<tr>${COLS.map((c) => `<td>${c.td(m)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  const more = $('#mun-more') as HTMLButtonElement;
  more.hidden = rows.length <= munLimite;
  more.textContent = at('more', { a: fmt(Math.min(100, rows.length - munLimite)), b: fmt(rows.length - munLimite) });
}

function opcoesUf() {
  const sel = $('#uf') as HTMLSelectElement;
  sel.innerHTML = `<option value="${BR}">${esc(at('brazil'))}</option>` +
    Object.keys(D.uf).sort((a, b) => ufNome(a).localeCompare(ufNome(b), loc()))
      .map((k) => `<option value="${k}">${esc(ufNome(k))}</option>`).join('');
  sel.value = uf;
}

function render() {
  tiles();
  variacao();
  horario();
  transferencia();
  municipios();
  auditoria();
}

// ---------- idioma ----------
const store = {
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

function aplicarIdioma(l: Lang) {
  setALang(l);
  document.documentElement.lang = LOC[l];
  applyAStatic();
  for (const b of document.querySelectorAll<HTMLButtonElement>('#lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === l));
}

aplicarIdioma(detectLang(new URLSearchParams(location.search).get('lang'), store.get('lang'), navigator.languages ?? [navigator.language]));
$('#lang').addEventListener('click', (e) => {
  const l = (e.target as HTMLElement).closest('button')?.dataset.lang as Lang | undefined;
  if (!l || !LANGS.includes(l) || l === aLang()) return;
  store.set('lang', l);
  const q = new URLSearchParams(location.search);
  if (q.has('lang')) {
    q.delete('lang');
    history.replaceState(null, '', `${location.pathname}${q.size ? '?' + q : ''}${location.hash}`);
  }
  aplicarIdioma(l);
  if (D) {
    opcoesUf();
    render();
  }
});

async function main() {
  const res = await fetch('./dados.json');
  D = await res.json();
  // a auditoria é opcional: se não carregar, o resto da página funciona
  fetch('./auditoria.json').then((r) => (r.ok ? r.json() : null)).then((a: Auditoria | null) => {
    AUD = a;
    auditoria();
  }).catch(() => undefined);
  MUNS = D.mun.map((r) => {
    const [u, nome, L1, L2, F1, F2, O1, BN1, BN2, A1, A2, Eleit, ap1, ap2, log2] = r as [string, string, ...number[]];
    return { uf: u, nome: nomeMun(nome), L1, L2, F1, F2, O1, BN1, BN2, A1, A2, Eleit, ap1, ap2, log2, busca: norm(nome) };
  });
  if (uf !== BR && !D.uf[uf]) uf = BR;
  opcoesUf();
  const sel = $('#uf') as HTMLSelectElement;
  sel.addEventListener('change', () => setUf(sel.value));
  $('#var-metric').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    metrica = b.dataset.v as typeof metrica;
    for (const x of $('#var-metric').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    variacao();
  });
  ($('#log-scale') as HTMLInputElement).addEventListener('change', (e) => {
    logScale = (e.target as HTMLInputElement).checked;
    horario();
  });
  $('#mun-search').addEventListener('input', () => {
    munLimite = 50;
    municipios();
  });
  $('#mun-table').addEventListener('click', (e) => {
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;
    const i = Number(th.dataset.i);
    munSort = munSort.col === i ? { col: i, asc: !munSort.asc } : { col: i, asc: i === 0 };
    municipios();
  });
  $('#flag-type').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    flagTipo = b.dataset.v as typeof flagTipo;
    flagLimite = 30;
    for (const x of $('#flag-type').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    sinalizadas();
  });
  $('#flag-more').addEventListener('click', () => {
    flagLimite += 100;
    sinalizadas();
  });
  $('#mun-more').addEventListener('click', () => {
    munLimite += 100;
    municipios();
  });
  render();
  $('#app').setAttribute('aria-busy', 'false');
  let w = $('#app').clientWidth;
  let timer = 0;
  new ResizeObserver(() => {
    if ($('#app').clientWidth === w) return;
    w = $('#app').clientWidth;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      variacao();
      horario();
      transferencia();
    }, 120);
  }).observe($('#app'));
  addEventListener('scroll', hideTip, { passive: true });
}

main().catch((e) => {
  $('#app').innerHTML = `<p class="loading">${esc(at('loadError', { e: String(e) }))}</p>`;
});
