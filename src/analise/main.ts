// Página de análise do 1º x 2º turno: lê dados.json (gerado por analise/exportar_web.py) e desenha tudo em SVG.
import './analise.css';

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

const UF_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins', Exterior: 'Exterior',
};
const BR = 'BR';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;
const SVG = 'http://www.w3.org/2000/svg';

// ---------- formatação ----------
const nf = new Intl.NumberFormat('pt-BR');
const fmt = (n: number) => nf.format(Math.round(n));
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const pct = (x: number, d = 1) => (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const spct = (x: number, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + pct(Math.abs(x), d);
const pp = (x: number, d = 1) => (x > 0 ? '+' : x < 0 ? '−' : '') + (Math.abs(x) * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' p.p.';
const mi = (n: number, d = 2) => (n / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' mi';
const curto = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (a >= 1e3) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
  return fmt(n);
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cls = (x: number) => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const hh = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;

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
const nomeArea = () => (uf === BR ? 'Brasil' : UF_NOMES[uf] ?? uf);
// preposição de cada UF: "no Rio de Janeiro", "na Bahia", "em São Paulo"
const NO = new Set(['AC', 'AM', 'AP', 'CE', 'DF', 'ES', 'MA', 'PA', 'PI', 'PR', 'RJ', 'RN', 'RS', 'TO']);
const NA = new Set(['BA', 'PB']);
const naArea = () => {
  if (uf === BR) return 'no Brasil';
  if (uf === 'Exterior') return 'no exterior';
  return `${NO.has(uf) ? 'no' : NA.has(uf) ? 'na' : 'em'} ${UF_NOMES[uf] ?? uf}`;
};

function setUf(k: string) {
  uf = k === uf && k !== BR ? BR : k;
  ($('#uf') as HTMLSelectElement).value = uf;
  const q = new URLSearchParams(location.search);
  if (uf === BR) q.delete('uf');
  else q.set('uf', uf);
  history.replaceState(null, '', `${location.pathname}${q.size ? '?' + q : ''}${location.hash}`);
  munLimite = 50;
  render();
}

// ---------- seções ----------
function tiles() {
  const a = area();
  const { t1, t2 } = a;
  const c = (k: Cand, sw: string) => {
    const d = t2[k] - t1[k];
    return `<div class="tile"><div class="k"><i class="sw ${sw}"></i>${k === 'Lula' ? 'Lula (13)' : 'Flávio (22)'} no 2º turno</div>
      <div class="v">${fmt(t2[k])}</div>
      <div class="d"><span class="${cls(d)}">${signed(d)} (${spct(varPct(t1[k], t2[k]))})</span> vs 1º turno<br>${pct(t1[k] / val1(t1))} → <strong>${pct(t2[k] / val2(t2))}</strong> dos válidos</div></div>`;
  };
  const c1 = comp(t1) / t1.Eleit;
  const c2 = comp(t2) / t2.Eleit;
  const s = a.secoes;
  $('#tiles').innerHTML = c('Lula', 'lula') + c('Flávio', 'flavio') +
    `<div class="tile"><div class="k">Comparecimento</div><div class="v">${pct(c2)}</div>
      <div class="d">1º turno: ${pct(c1)} · <span class="${cls(c2 - c1)}">${pp(c2 - c1)}</span><br>${signed(comp(t2) - comp(t1))} eleitores</div></div>` +
    `<div class="tile"><div class="k">Votos depois das 18h (2º turno)</div><div class="v">${fmt(s.t2.v18)}</div>
      <div class="d">1º turno: ${fmt(s.t1.v18)}<br>Depois das 17h: ${fmt(s.t2.v17)} (2º) vs ${fmt(s.t1.v17)} (1º)</div></div>`;
}

function variacao() {
  const ufs = Object.keys(D.uf);
  const legend = $('#var-legend');
  const host = $('#var-chart');
  const tipUf = (k: string) => {
    const { t1, t2 } = D.uf[k];
    const linha = (c: Cand, sw: string) =>
      tipRow(sw, c, `${fmt(t1[c])} → ${fmt(t2[c])} (${spct(varPct(t1[c], t2[c]))})`);
    return `<b>${esc(UF_NOMES[k] ?? k)}</b>${linha('Lula', 'lula')}${linha('Flávio', 'flavio')}` +
      tipRow('', 'Lula % válidos', `${pct(t1.Lula / val1(t1))} → ${pct(t2.Lula / val2(t2))}`) +
      tipRow('', 'Comparecimento', `${pct(comp(t1) / t1.Eleit)} → ${pct(comp(t2) / t2.Eleit)}`);
  };
  let rows: HRow[];
  if (metrica === 'pv') {
    legend.innerHTML = '<span><i class="sw t1"></i>1º turno</span><span><i class="sw t2"></i>2º turno</span><span>linha tracejada: 50%</span>';
    rows = ufs.map((k) => {
      const { t1, t2 } = D.uf[k];
      return { key: k, label: k === 'Exterior' ? 'Ext.' : k, vals: [t1.Lula / val1(t1), t2.Lula / val2(t2)], tip: tipUf(k), sel: k === uf };
    }).sort((a, b) => (b.vals[1] as number) - (a.vals[1] as number));
    hbars(host, rows, [{ cls: 't1', nome: '1º' }, { cls: 't2', nome: '2º' }], (v) => pct(v, 0),
      { ref: { v: 0.5, label: '50%' }, onClick: setUf });
    return;
  }
  legend.innerHTML = '<span><i class="sw lula"></i>Lula</span><span><i class="sw flavio"></i>Flávio</span>';
  const f = metrica === 'pct'
    ? (a: number, b: number) => varPct(a, b)
    : (a: number, b: number) => b - a;
  rows = ufs.map((k) => {
    const { t1, t2 } = D.uf[k];
    return { key: k, label: k === 'Exterior' ? 'Ext.' : k, vals: [f(t1.Lula, t2.Lula), f(t1.Flávio, t2.Flávio)], tip: tipUf(k), sel: k === uf };
  }).sort((a, b) => (b.vals[0] as number) - (a.vals[0] as number));
  hbars(host, rows, [{ cls: 'lula', nome: 'Lula' }, { cls: 'flavio', nome: 'Flávio' }],
    metrica === 'pct' ? (v) => pct(v, 0) : curto, { onClick: setUf });
}

function horario() {
  const a = area();
  const s = a.secoes;
  const margem = Math.abs(a.t2.Lula - a.t2.Flávio);
  $('#ext-sub').textContent = `Censo dos logs de ${fmt(s.t2.secoes)} urnas ${naArea()} no 2º turno, com ${fmt(s.t2.votos)} votos registrados.`;
  $('#ext-headline').innerHTML = s.t2.v18 === 0
    ? `${nomeArea()}: <strong>nenhum voto</strong> registrado depois das 18h no 2º turno (no 1º turno foram ${fmt(s.t1.v18)}).`
    : `${nomeArea()}: <strong>${fmt(s.t2.v18)} voto${s.t2.v18 > 1 ? 's' : ''}</strong> depois das 18h no 2º turno (${pct(s.t2.v18 / s.t2.votos, 3)}), em ${fmt(s.t2.s18)} seç${s.t2.s18 > 1 ? 'ões' : 'ão'}. No 1º turno foram ${fmt(s.t1.v18)}. A diferença entre os candidatos foi de ${fmt(margem)} votos.`;
  const legenda = '<span><i class="sw t1"></i>1º turno (4/10)</span><span><i class="sw t2"></i>2º turno (25/10)</span>';
  $('#hora-legend').innerHTML = legenda;
  const series = [{ cls: 't1', nome: '1º turno' }, { cls: 't2', nome: '2º turno' }];
  const turnos = ['t1', 't2'] as const;
  const tot = turnos.map((t) => Object.values(a.hora[t]).reduce((x, y) => x + y, 0) || 1);
  const horas = Array.from({ length: 13 }, (_, i) => i + 7).filter((h) => turnos.some((t) => (a.hora[t][h] ?? 0) > 0) || (h >= 8 && h <= 19));
  vbars($('#hora-chart'), horas.map((h) => ({ key: h, label: `${h}h`, tick: true })), series,
    (si, h) => (a.hora[turnos[si]][h] ?? 0) / tot[si],
    (h) => `<b>${h}h às ${h}h59</b>` + turnos.map((t, i) => tipRow(t, i ? '2º turno' : '1º turno',
      `${fmt(a.hora[t][h] ?? 0)} (${pct((a.hora[t][h] ?? 0) / tot[i])})`)).join(''),
    (v) => pct(v, 0));

  const bins = Array.from({ length: 24 }, (_, i) => 960 + i * 10);
  vbars($('#tarde-chart'), bins.map((m) => ({ key: m, label: `${m / 60}h`, tick: m % 60 === 0 })), series,
    (si, m) => a.tarde[turnos[si]][m] ?? 0,
    (m) => `<b>${hh(m)} às ${hh(m + 9)}</b>` + turnos.map((t, i) => tipRow(t, i ? '2º turno' : '1º turno', fmt(a.tarde[t][m] ?? 0))).join(''),
    (v) => curto(v), { log: logScale, marks: [{ at: 1020, label: '17h' }, { at: 1080, label: '18h' }] });

  const cortes = [['v17', 's17', '17h00'], ['v1730', 's1730', '17h30'], ['v18', 's18', '18h00'], ['v19', 's19', '19h00']] as const;
  $('#ext-table').innerHTML = `<thead><tr><th>Votos a partir de</th><th>1º turno</th><th>% do turno</th><th>Seções</th><th>2º turno</th><th>% do turno</th><th>Seções</th></tr></thead><tbody>` +
    cortes.map(([v, sc, l]) => `<tr><td>${l}</td><td>${fmt(s.t1[v])}</td><td>${pct(s.t1[v] / s.t1.votos, 3)}</td><td>${fmt(s.t1[sc])}</td>` +
      `<td><strong>${fmt(s.t2[v])}</strong></td><td>${pct(s.t2[v] / s.t2.votos, 3)}</td><td>${fmt(s.t2[sc])}</td></tr>`).join('') +
    `<tr><td>Total registrado</td><td>${fmt(s.t1.votos)}</td><td></td><td>${fmt(s.t1.secoes)}</td><td>${fmt(s.t2.votos)}</td><td></td><td>${fmt(s.t2.secoes)}</td></tr></tbody>`;
}

const ORIGENS: [string, string][] = [
  ['Abstenção', 'Não votou no 1º'], ['Branco/Nulo', 'Branco/nulo no 1º'], ['Cury', 'Cury'], ['Renan', 'Renan'],
  ['Caiado', 'Caiado'], ['Zema', 'Zema'], ['Outros', 'Outros candidatos'], ['rival', 'Eleitor do rival'],
];

function transferencia() {
  const brasil = uf === BR;
  const fl = D.fluxos[uf];
  $('#tr-sub').textContent = brasil
    ? 'Eleitores que cada candidato ganhou no 2º turno, por escolha no 1º turno (milhões). Estimativa.'
    : fl ? `Estimativa para ${nomeArea()} (versão UF × tercil). Mais incerta que a nacional.` : '';
  $('#tr-legend').innerHTML = '<span><i class="sw lula"></i>Lula</span><span><i class="sw flavio"></i>Flávio</span>' +
    (brasil ? '<span>trecho claro: faixa entre as três versões do modelo</span>' : '');
  const host = $('#tr-chart');
  if (!brasil && !fl) {
    host.innerHTML = '<p class="note">Sem estimativa para esta abrangência.</p>';
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
  const fx = (v: number | [number, number]) => (Array.isArray(v) ? (v[0] === v[1] ? mi(v[0]) : `${mi(v[0])} a ${mi(v[1])}`) : fmt(v));
  const rows: HRow[] = ORIGENS.map(([o, label]) => {
    const vals = brasil ? [faixa('Lula', o), faixa('Flávio', o)] : [ponto('Lula', o), ponto('Flávio', o)];
    return {
      key: o, label, vals,
      tip: `<b>${label}</b>${tipRow('lula', 'para Lula', fx(vals[0]))}${tipRow('flavio', 'para Flávio', fx(vals[1]))}`,
    };
  });
  hbars(host, rows, [{ cls: 'lula', nome: 'Lula' }, { cls: 'flavio', nome: 'Flávio' }],
    brasil ? (v) => (v / 1e6).toLocaleString('pt-BR') : curto, { labelW: 132 });
  if (brasil) {
    const saldos = specs.map((s) => s.Lula['do rival'] - s.Flávio['do rival']);
    const [l1, l2] = faixa('Lula', 'rival');
    const [f1, f2] = faixa('Flávio', 'rival');
    $('#tr-summary').innerHTML = `<strong>Troca direta:</strong> de ${mi(l1, 1)} a ${mi(l2, 1)} eleitores de Flávio no 1º turno votaram em Lula, e de ${mi(f1, 1)} a ${mi(f2, 1)} fizeram o caminho inverso. Saldo para Lula de <strong>${mi(Math.min(...saldos), 1)} a ${mi(Math.max(...saldos), 1)}</strong>. Sem modelo nenhum, só somando as quedas município a município: Lula perdeu votos em 89 municípios (mínimo de 16 mil eleitores), Flávio em 950 (mínimo de 134 mil).`;
  } else {
    const s = fl.saldo_troca_Lula ?? 0;
    $('#tr-summary').innerHTML = `<strong>Troca direta estimada:</strong> saldo de ${signed(s)} eleitores para ${s >= 0 ? 'Lula' : 'Flávio'} ${naArea()}.`;
  }
}

// ---------- municípios ----------
type Mun = { uf: string; nome: string; L1: number; L2: number; F1: number; F2: number; O1: number; BN1: number; BN2: number; A1: number; A2: number; Eleit: number; ap1: number; ap2: number; log2: number; busca: string };
let MUNS: Mun[] = [];
let munLimite = 50;
let munSort = { col: 1, asc: false };
const MINUSC = new Set(['de', 'da', 'do', 'dos', 'das', 'e', "d'"]);
const nomeMun = (s: string) => s.split(' ').map((w, i) => (i && MINUSC.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ');
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const COLS: { th: string; v: (m: Mun) => number | string; td: (m: Mun) => string }[] = [
  { th: 'Município', v: (m) => m.busca, td: (m) => `${esc(m.nome)}${uf === BR ? ` <span class="note">${m.uf === 'Exterior' ? 'Ext.' : m.uf}</span>` : ''}` },
  { th: 'Eleitorado', v: (m) => m.Eleit, td: (m) => fmt(m.Eleit) },
  { th: 'Lula 2º', v: (m) => m.L2, td: (m) => fmt(m.L2) },
  { th: 'Δ Lula', v: (m) => varPct(m.L1, m.L2) || 0, td: (m) => `<span class="${cls(m.L2 - m.L1)}">${m.L1 ? spct(varPct(m.L1, m.L2)) : '–'}</span>` },
  { th: 'Flávio 2º', v: (m) => m.F2, td: (m) => fmt(m.F2) },
  { th: 'Δ Flávio', v: (m) => varPct(m.F1, m.F2) || 0, td: (m) => `<span class="${cls(m.F2 - m.F1)}">${m.F1 ? spct(varPct(m.F1, m.F2)) : '–'}</span>` },
  { th: 'Lula % válidos', v: (m) => m.L2 / (m.L2 + m.F2 || 1), td: (m) => `${pct(m.L1 / (m.L1 + m.F1 + m.O1 || 1))} → ${pct(m.L2 / (m.L2 + m.F2 || 1))}` },
  { th: 'Comparec. 2º', v: (m) => (m.Eleit - m.A2) / (m.Eleit || 1), td: (m) => {
    const c1 = (m.Eleit - m.A1) / (m.Eleit || 1);
    const c2 = (m.Eleit - m.A2) / (m.Eleit || 1);
    return `${pct(c2)} <span class="${cls(c2 - c1)}">(${pp(c2 - c1)})</span>`;
  } },
  { th: 'Votos após 17h (2º)', v: (m) => m.ap2, td: (m) => fmt(m.ap2) },
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
  $('#mun-sub').textContent = `${fmt(rows.length)} município${rows.length === 1 ? '' : 's'}${uf === BR ? '' : ' ' + naArea()}. Clique no título de uma coluna para ordenar.`;
  const t = $('#mun-table');
  t.innerHTML = `<thead><tr>${COLS.map((c, i) => `<th scope="col" data-i="${i}"${i === munSort.col ? ` aria-sort="${munSort.asc ? 'ascending' : 'descending'}"` : ''}>${c.th}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.slice(0, munLimite).map((m) => `<tr>${COLS.map((c) => `<td>${c.td(m)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  const more = $('#mun-more') as HTMLButtonElement;
  more.hidden = rows.length <= munLimite;
  more.textContent = `Mostrar mais (${fmt(Math.min(100, rows.length - munLimite))} de ${fmt(rows.length - munLimite)} restantes)`;
}

function render() {
  tiles();
  variacao();
  horario();
  transferencia();
  municipios();
}

async function main() {
  const res = await fetch('./dados.json');
  D = await res.json();
  MUNS = D.mun.map((r) => {
    const [u, nome, L1, L2, F1, F2, O1, BN1, BN2, A1, A2, Eleit, ap1, ap2, log2] = r as [string, string, ...number[]];
    return { uf: u, nome: nomeMun(nome), L1, L2, F1, F2, O1, BN1, BN2, A1, A2, Eleit, ap1, ap2, log2, busca: norm(nome) };
  });
  const sel = $('#uf') as HTMLSelectElement;
  sel.innerHTML = `<option value="${BR}">Brasil</option>` +
    Object.keys(D.uf).sort((a, b) => (UF_NOMES[a] ?? a).localeCompare(UF_NOMES[b] ?? b, 'pt-BR'))
      .map((k) => `<option value="${k}">${esc(UF_NOMES[k] ?? k)}</option>`).join('');
  if (uf !== BR && !D.uf[uf]) uf = BR;
  sel.value = uf;
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
  $('#app').innerHTML = `<p class="loading">Não foi possível carregar os dados (${esc(String(e))}).</p>`;
});
