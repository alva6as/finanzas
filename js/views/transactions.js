// Lista de movimientos: búsqueda, filtros por tipo, categoría y cuenta, agrupados por día.
import { monthOf, sortTransactions } from '../calc.js';
import { dayLabel, esc, money } from '../format.js';
import { emptyState, icon, monthSwitch, pageHead, txRow } from '../ui.js';

const TYPES = [
  ['all', 'Todo'],
  ['expense', 'Gastos'],
  ['income', 'Ingresos'],
  ['transfer', 'Transf.'],
];

export function renderTransactions(ctx) {
  const { ui, today, cat, acc } = ctx;
  const chips = [];
  if (ui.filterCat) {
    const c = cat.get(ui.filterCat);
    chips.push(`<button class="filter-chip" data-action="clear-filter" data-key="filterCat">${esc(c ? `${c.emoji} ${c.name}` : 'Sin categoría')} ${icon('x', 'sm')}</button>`);
  }
  if (ui.filterAcc) {
    chips.push(`<button class="filter-chip" data-action="clear-filter" data-key="filterAcc">${esc(acc.get(ui.filterAcc)?.name || 'Cuenta')} ${icon('x', 'sm')}</button>`);
  }
  return `
    ${pageHead('Movimientos')}
    ${monthSwitch(ui.ym, today)}
    <label class="search">${icon('search')}
      <input id="tx-search" type="search" placeholder="Buscar en todos los meses" value="${esc(ui.query)}"
        data-input="search" autocomplete="off" autocorrect="off" enterkeyhint="search">
    </label>
    <div class="seg compact" role="group" aria-label="Tipo de movimiento">
      ${TYPES.map(([k, l]) => `<button class="${ui.txType === k ? 'on' : ''}" data-action="tx-type" data-type="${k}" aria-pressed="${ui.txType === k}">${l}</button>`).join('')}
    </div>
    ${chips.length ? `<div class="chip-row">${chips.join('')}</div>` : ''}
    <div id="tx-results">${renderTxResults(ctx)}</div>
  `;
}

export function filterTransactions(ctx) {
  const { data, ui, cat, acc } = ctx;
  const q = ui.query.trim().toLocaleLowerCase();
  return sortTransactions(
    data.transactions.filter((t) => {
      if (!q && monthOf(t.date) !== ui.ym) return false;
      if (ui.txType !== 'all' && t.type !== ui.txType) return false;
      if (ui.filterCat && t.categoryId !== ui.filterCat) return false;
      if (ui.filterAcc && t.accountId !== ui.filterAcc && t.toAccountId !== ui.filterAcc) return false;
      if (!q) return true;
      const hay = [
        t.note,
        cat.get(t.categoryId)?.name,
        acc.get(t.accountId)?.name,
        acc.get(t.toAccountId)?.name,
        (t.amount / 100).toFixed(2),
        money(t.amount),
      ]
        .join(' ')
        .toLocaleLowerCase();
      return hay.includes(q);
    }),
  );
}

export function renderTxResults(ctx) {
  const { ui, today } = ctx;
  const list = filterTransactions(ctx);
  if (!list.length) {
    return ui.query
      ? emptyState('Sin resultados', `No encontramos movimientos con “${ui.query}”.`)
      : emptyState(
          'No hay movimientos',
          'Este mes todavía no tiene movimientos con estos filtros.',
          '<button class="btn primary" data-action="new-tx">Agregar movimiento</button>',
        );
  }
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  const shown = list.slice(0, ui.limit);
  const groups = new Map();
  for (const t of shown) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  const days = [...groups]
    .map(([date, txs]) => {
      const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
      return `<section class="day">
        <h3 class="day-head"><span>${esc(dayLabel(date, today))}</span><span>${net ? money(net, { signed: true }) : ''}</span></h3>
        <div class="list">${txs.map((t) => txRow(t, ctx)).join('')}</div>
      </section>`;
    })
    .join('');
  return `
    <div class="totals">
      <span>${list.length} ${list.length === 1 ? 'movimiento' : 'movimientos'}${ui.query ? ' en todos los meses' : ''}</span>
      <span><b class="pos">${money(income, { signed: true })}</b> · <b>${money(-expense, { signed: true })}</b></span>
    </div>
    ${days}
    ${list.length > shown.length ? `<button class="btn ghost block" data-action="more-tx">Mostrar más (${list.length - shown.length})</button>` : ''}
  `;
}
