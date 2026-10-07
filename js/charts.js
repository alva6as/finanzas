// Gráficas en SVG dibujadas a mano: dona de gastos por categoría y barras de ingresos contra gastos.
import { roundUpNice } from './calc.js';
import { esc, money, monthLabel } from './format.js';

export function donut(segments, { size = 148, stroke = 20, label = '' } = {}) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const gap = segments.length > 1 ? 2.5 : 0;
  let offset = 0;
  const arcs = total
    ? segments
        .map((s) => {
          const len = (s.value / total) * circ;
          const dash = Math.max(0.5, len - gap);
          const arc = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${esc(s.color)}" stroke-width="${stroke}"
            stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 ${c} ${c})"/>`;
          offset += len;
          return arc;
        })
        .join('')
    : '';
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" class="donut-track" stroke-width="${stroke}"/>${arcs}</svg>`;
}

// Barras agrupadas por mes. El mes seleccionado va a color completo; los demás, atenuados.
export function trendBars(rows, { selected } = {}) {
  const W = 320;
  const H = 150;
  const top = 22;
  const bottom = 24;
  const plotH = H - top - bottom;
  const max = roundUpNice(Math.max(100, ...rows.flatMap((r) => [r.income, r.expense])));
  const groupW = W / rows.length;
  const barW = Math.min(16, groupW * 0.28);
  const h = (v) => (v > 0 ? Math.max(2, (v / max) * plotH) : 0);
  const base = top + plotH;

  const bars = rows
    .map((r, i) => {
      const cx = groupW * (i + 0.5);
      const dim = r.ym === selected ? '' : ' dim';
      const hi = h(r.income);
      const he = h(r.expense);
      return `<g class="grp${dim}">
        <rect class="bar-in" x="${(cx - barW - 1.5).toFixed(1)}" y="${(base - hi).toFixed(1)}" width="${barW}" height="${hi.toFixed(1)}" rx="3"/>
        <rect class="bar-ex" x="${(cx + 1.5).toFixed(1)}" y="${(base - he).toFixed(1)}" width="${barW}" height="${he.toFixed(1)}" rx="3"/>
        <text class="axis${r.ym === selected ? ' sel' : ''}" x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(monthLabel(r.ym, { short: true }))}</text>
      </g>`;
    })
    .join('');

  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos de los últimos ${rows.length} meses">
    <line class="grid" x1="0" x2="${W}" y1="${top}" y2="${top}"/>
    <text class="axis" x="${W}" y="${top - 7}" text-anchor="end">${esc(money(max, { whole: true }))}</text>
    <line class="grid base" x1="0" x2="${W}" y1="${base}" y2="${base}"/>
    ${bars}
  </svg>`;
}
