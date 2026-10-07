// Piezas de interfaz compartidas: íconos, filas de movimientos, barras de progreso, hoja inferior y avisos.
import { addMonthsYM, monthOf } from './calc.js';
import { ACCOUNT_TYPES } from './store.js';
import { esc, money, monthLabel, tint } from './format.js';

const PATHS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  budget: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5V13.5z"/><path d="M14 3.2a8.5 8.5 0 0 1 6.8 6.8H14z"/>',
  more: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11"/><path d="M3.5 7.5H17"/><path d="M17 13l3.5 3.5L17 20"/><path d="M20.5 16.5H7"/>',
  wallet: '<path d="M4 7.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11v2.5"/><circle cx="16" cy="14.5" r="1.2" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  repeat: '<path d="M17 3l3.5 3.5L17 10"/><path d="M3.5 12v-1.5a4 4 0 0 1 4-4h13"/><path d="M7 21l-3.5-3.5L7 14"/><path d="M20.5 12v1.5a4 4 0 0 1-4 4h-13"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5"/>',
  download: '<path d="M12 3.5v11M7.5 10 12 14.5 16.5 10"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || ''}</svg>`;
}

export function bubble(emoji, color, cls = '') {
  return `<span class="bubble ${cls}" style="background:${tint(color)}">${esc(emoji || '•')}</span>`;
}

export function monthSwitch(ym, today) {
  const current = monthOf(today);
  const next = addMonthsYM(ym, 1);
  return `<div class="month-switch">
    <button class="icon-btn" data-action="month" data-delta="-1" aria-label="Mes anterior">${icon('left')}</button>
    <span class="month-name">${esc(monthLabel(ym))}</span>
    <button class="icon-btn" data-action="month" data-delta="1" aria-label="Mes siguiente" ${next > addMonthsYM(current, 12) ? 'disabled' : ''}>${icon('right')}</button>
    ${ym !== current ? '<button class="pill-btn" data-action="month-today">Este mes</button>' : ''}
  </div>`;
}

export function pageHead(title, { eyebrow = '', action = '', back = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<button class="back-btn" data-action="back">${icon('left')}<span>${esc(back)}</span></button>` : ''}
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <div class="title-row"><h1>${esc(title)}</h1>${action}</div>
  </header>`;
}

export const addButton = (action, label) =>
  `<button class="round-btn" data-action="${action}" aria-label="${esc(label)}">${icon('plus')}</button>`;

export function progress(pct, state = 'ok', pace = null) {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  const tick = pace == null ? '' : `<span class="pace" style="left:${(Math.min(1, pace) * 100).toFixed(1)}%" title="Hoy"></span>`;
  return `<div class="progress ${state}"><span style="width:${w.toFixed(1)}%"></span>${tick}</div>`;
}

export function accountEmoji(account) {
  return ACCOUNT_TYPES[account?.type]?.emoji || '🏦';
}

export function txRow(t, { cat, acc, today }) {
  const future = t.date > today ? ' · Programado' : '';
  if (t.type === 'transfer') {
    const from = acc.get(t.accountId)?.name || 'Cuenta borrada';
    const to = acc.get(t.toAccountId)?.name || 'Cuenta borrada';
    return `<button class="row tx" data-action="edit-tx" data-id="${esc(t.id)}">
      <span class="bubble neutral">${icon('swap')}</span>
      <span class="row-main"><span class="row-title">${esc(t.note || 'Transferencia')}</span>
      <span class="row-sub">${esc(from)} → ${esc(to)}${future}</span></span>
      <span class="amount muted">${money(t.amount)}</span>
    </button>`;
  }
  const c = cat.get(t.categoryId);
  const title = t.note || c?.name || (t.type === 'income' ? 'Ingreso' : 'Gasto');
  const sub = [t.note ? c?.name || 'Sin categoría' : null, acc.get(t.accountId)?.name].filter(Boolean).join(' · ');
  return `<button class="row tx" data-action="edit-tx" data-id="${esc(t.id)}">
    ${bubble(c?.emoji || (t.type === 'income' ? '💰' : '📦'), c?.color || '#7D8597')}
    <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}${future}</span></span>
    <span class="amount ${t.type === 'income' ? 'pos' : ''}">${money(t.amount, { signed: t.type === 'income' })}</span>
  </button>`;
}

export function emptyState(title, text, button = '') {
  return `<div class="empty"><p class="empty-title">${esc(title)}</p><p>${esc(text)}</p>${button}</div>`;
}

// ---------- Hoja inferior ----------

const sheetRoot = () => document.getElementById('sheet-root');

export function openSheet(html) {
  const root = sheetRoot();
  root.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  document.body.classList.add('sheet-open');
  void root.offsetWidth;
  root.classList.add('open');
  return root.querySelector('.sheet');
}

export function closeSheet() {
  const root = sheetRoot();
  if (root.hidden) return;
  root.classList.remove('open');
  document.body.classList.remove('sheet-open');
  setTimeout(() => {
    if (!root.classList.contains('open')) {
      root.hidden = true;
      root.innerHTML = '';
    }
  }, 260);
}

export const sheetIsOpen = () => !sheetRoot().hidden && sheetRoot().classList.contains('open');

// ---------- Avisos ----------

let toastTimer;
export function toast(message, { undo = null, error = false } = {}) {
  const el = document.getElementById('toast');
  el.className = `toast${error ? ' error' : ''}`;
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button data-action="undo">Deshacer</button>' : ''}`;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 5000 : 2600);
}

export function hideToast() {
  const el = document.getElementById('toast');
  el.classList.remove('show');
  setTimeout(() => {
    if (!el.classList.contains('show')) el.hidden = true;
  }, 250);
}

// Botones destructivos: el primer toque pide confirmación y el segundo ejecuta.
export function armConfirm(el) {
  if (el.classList.contains('armed')) return true;
  const original = el.innerHTML;
  el.classList.add('armed');
  el.textContent = el.dataset.confirm;
  setTimeout(() => {
    if (el.isConnected) {
      el.classList.remove('armed');
      el.innerHTML = original;
    }
  }, 4000);
  return false;
}
