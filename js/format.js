// Formato de dinero, números y fechas en español, y lectura de montos escritos por el usuario.
import { diffDays, parseISO } from './calc.js';

let state;

export function configureFormat(locale, currency) {
  const make = (opts) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, ...opts });
    } catch {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', ...opts });
    }
  };
  const fmt = make({});
  let decimal = '.';
  try {
    decimal = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value || '.';
  } catch {
    /* locale inválido: se queda el punto */
  }
  state = {
    locale,
    currency,
    fmt,
    fmtSigned: make({ signDisplay: 'exceptZero' }),
    fmtWhole: make({ maximumFractionDigits: 0, minimumFractionDigits: 0 }),
    decimal,
    symbol: fmt.formatToParts(0).find((p) => p.type === 'currency')?.value || '$',
  };
}

configureFormat('es-MX', 'MXN');

export const decimalSeparator = () => state.decimal;
export const currencySymbol = () => state.symbol;

export function money(cents, { signed = false, whole = false } = {}) {
  const f = signed ? state.fmtSigned : whole ? state.fmtWhole : state.fmt;
  return f.format((cents || 0) / 100);
}

// Igual que money() pero con los centavos y el símbolo en <span> para darles otro tamaño.
export function moneyHTML(cents, { signed = false } = {}) {
  const f = signed ? state.fmtSigned : state.fmt;
  return f
    .formatToParts((cents || 0) / 100)
    .map((p) => {
      const v = esc(p.value);
      if (p.type === 'decimal' || p.type === 'fraction') return `<span class="frac">${v}</span>`;
      if (p.type === 'currency') return `<span class="cur">${v}</span>`;
      return v;
    })
    .join('');
}

// Valor para precargar un campo de monto: "250" o "250,50" según el separador decimal.
export function amountInputValue(cents) {
  if (!cents) return '';
  const v = Math.abs(cents) / 100;
  return (Number.isInteger(v) ? String(v) : v.toFixed(2)).replace('.', state.decimal);
}

// Convierte lo que escribe el usuario en centavos. Acepta "1,234.50", "1.234,50", "1234,5", "$ 99".
// Si solo hay un tipo de separador se decide con el separador decimal del idioma.
export function parseAmount(input, decimalSep = state.decimal) {
  if (input == null) return NaN;
  let s = String(input).trim().replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decIdx = -1;
  if (lastDot >= 0 && lastComma >= 0) {
    decIdx = Math.max(lastDot, lastComma);
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const idx = Math.max(lastDot, lastComma);
    const count = s.split(sep).length - 1;
    const after = s.length - idx - 1;
    if (count === 1 && (sep === decimalSep || (after > 0 && after <= 2))) decIdx = idx;
  }
  const intPart = (decIdx >= 0 ? s.slice(0, decIdx) : s).replace(/[.,]/g, '');
  const fracPart = decIdx >= 0 ? s.slice(decIdx + 1).replace(/[.,]/g, '') : '';
  if (!intPart && !fracPart) return NaN;
  const cents = Math.round(Number(`${intPart || '0'}.${fracPart || '0'}`) * 100);
  if (!Number.isFinite(cents)) return NaN;
  return negative ? -cents : cents;
}

export const percent = (x) =>
  new Intl.NumberFormat(state.locale, { style: 'percent', maximumFractionDigits: 0 }).format(x);

export const capitalize = (s) => (s ? s[0].toLocaleUpperCase(state.locale) + s.slice(1) : s);

const dateFmt = (opts) => new Intl.DateTimeFormat(state.locale, opts);

// "Hoy", "Ayer", "Mañana" o "Lunes, 5 de octubre".
export function dayLabel(iso, today) {
  const diff = diffDays(today, iso);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  if (diff === 1) return 'Mañana';
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  if (iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
  return capitalize(dateFmt(opts).format(parseISO(iso)));
}

// "7 oct" (o "7 oct 2025" si es de otro año).
export function shortDate(iso, today) {
  const opts = { day: 'numeric', month: 'short' };
  if (today && iso.slice(0, 4) !== today.slice(0, 4)) opts.year = 'numeric';
  return dateFmt(opts).format(parseISO(iso)).replace('.', '');
}

export function relativeDays(iso, today) {
  const diff = diffDays(today, iso);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  return diff > 0 ? `en ${diff} días` : `hace ${-diff} días`;
}

// "Octubre 2026" o, corto, "oct".
export function monthLabel(ym, { short = false, year = true } = {}) {
  const d = parseISO(`${ym}-01`);
  if (short) return dateFmt({ month: 'short' }).format(d).replace('.', '');
  const month = capitalize(dateFmt({ month: 'long' }).format(d));
  return year ? `${month} ${d.getFullYear()}` : month;
}

export function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Fondo translúcido a partir del color de una categoría.
export function tint(hex, alpha = 0.18) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(128,128,128,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
