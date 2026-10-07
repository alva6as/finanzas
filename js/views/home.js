// Pantalla de inicio: saldo total, resumen del mes, presupuesto, gastos por categoría, tendencia y próximos pagos.
import {
  budgetState, budgetStatus, daysLeftInMonth, monthOf, monthProgress, monthSummary,
  netWorth, sortTransactions, trend, upcomingRecurring,
} from '../calc.js';
import { donut, trendBars } from '../charts.js';
import { esc, money, moneyHTML, monthLabel, percent, relativeDays, shortDate } from '../format.js';
import { bubble, icon, monthSwitch, pageHead, progress, txRow } from '../ui.js';

export function renderHome(ctx) {
  const { data, ui, today } = ctx;
  const ym = ui.ym;
  const summary = monthSummary(data, ym);
  const worth = netWorth(data, ctx.balances);

  return `
    ${pageHead('Resumen', { eyebrow: data.settings.name ? `Hola, ${data.settings.name}` : '' })}
    ${monthSwitch(ym, today)}
    ${banners(ctx)}
    <section class="card hero">
      <div class="hero-top">
        <span class="label">Saldo total hoy</span>
        <button class="link" data-action="go" data-tab="more" data-sub="accounts">${data.accounts.length} ${data.accounts.length === 1 ? 'cuenta' : 'cuentas'} ${icon('right', 'sm')}</button>
      </div>
      <div class="hero-amount${worth.total < 0 ? ' crit' : ''}">${moneyHTML(worth.total)}</div>
      <p class="hero-month">${esc(monthLabel(ym, { year: false }))}</p>
      <div class="hero-stats">
        <div><span class="label">Ingresos</span><strong class="pos">${money(summary.income, { whole: true })}</strong></div>
        <div><span class="label">Gastos</span><strong>${money(summary.expense, { whole: true })}</strong></div>
        <div><span class="label">Ahorraste</span><strong class="${summary.net < 0 ? 'crit' : ''}">${summary.savingsRate == null ? '—' : percent(summary.savingsRate)}</strong></div>
      </div>
    </section>
    ${budgetCard(ctx, summary)}
    ${categoryCard(ctx, summary)}
    <section class="card">
      <div class="card-head"><h2>Últimos 6 meses</h2>
        <span class="legend"><i class="dot in"></i>Ingresos <i class="dot ex"></i>Gastos</span></div>
      ${trendBars(trend(data, ym, 6), { selected: ym })}
    </section>
    ${upcomingCard(ctx)}
    ${recentCard(ctx)}
  `;
}

function banners(ctx) {
  const { data, standalone, isIOS } = ctx;
  const out = [];
  if (data.meta.sample) {
    out.push(`<div class="banner">
      <span>Estás viendo <strong>datos de ejemplo</strong>. Cuando quieras empezar con tus números, bórralos en Ajustes.</span>
      <button class="pill-btn" data-action="go" data-tab="more" data-sub="settings">Ajustes</button></div>`);
  }
  if (isIOS && !standalone) {
    out.push(`<div class="banner">
      <span>Para instalarla: toca ${icon('share', 'inline')} <strong>Compartir</strong> en Safari y luego <strong>Agregar a inicio</strong>.</span></div>`);
  }
  const lastBackup = data.meta.lastBackup || data.meta.created;
  if (!data.meta.sample && data.transactions.length >= 10 && Date.now() - lastBackup > 30 * 86400000) {
    out.push(`<div class="banner warn">
      <span>Tus datos viven solo en este dispositivo. Haz un respaldo por si cambias o pierdes el teléfono.</span>
      <button class="pill-btn" data-action="export-json">Respaldar</button></div>`);
  }
  return out.join('');
}

function budgetCard(ctx, summary) {
  const { data, ui, today } = ctx;
  const bs = budgetStatus(data, ui.ym, summary);
  if (!bs.totalBudget) {
    return `<section class="card cta">
      <h2>Arma tu presupuesto</h2>
      <p>Define cuánto quieres gastar en cada categoría y te diremos cuánto te queda por día.</p>
      <button class="btn primary" data-action="go" data-tab="budget">Crear presupuesto</button>
    </section>`;
  }
  const pct = bs.totalSpent / bs.totalBudget;
  const isCurrent = ui.ym === monthOf(today);
  let line;
  if (bs.remaining < 0) {
    line = `Te pasaste por <strong class="crit">${money(-bs.remaining)}</strong>`;
  } else if (isCurrent) {
    const days = daysLeftInMonth(today);
    line = `Te quedan <strong>${money(bs.remaining)}</strong> · <strong>${money(Math.floor(bs.remaining / days))}</strong> al día por ${days} ${days === 1 ? 'día' : 'días'}`;
  } else if (ui.ym > monthOf(today)) {
    line = `Tienes <strong>${money(bs.totalBudget)}</strong> presupuestados`;
  } else {
    line = `Gastaste ${money(bs.totalSpent)} de ${money(bs.totalBudget)}`;
  }
  const pace = isCurrent ? monthProgress(today) : null;
  const hint = isCurrent && pct > pace + 0.1 && pct <= 1 ? '<p class="note warn">Vas gastando más rápido de lo que avanza el mes.</p>' : '';
  return `<section class="card tappable" data-action="go" data-tab="budget">
    <div class="card-head"><h2>Presupuesto</h2><span class="figure ${budgetState(pct)}">${percent(pct)}</span></div>
    ${progress(pct, budgetState(pct), pace)}
    <p class="budget-line">${line}</p>
    ${hint}
  </section>`;
}

function categoryCard(ctx, summary) {
  const { cat } = ctx;
  if (!summary.expense) {
    return `<section class="card"><div class="card-head"><h2>Gastos por categoría</h2></div>
      <p class="muted">Aún no hay gastos este mes.</p></section>`;
  }
  const top = summary.categories.slice(0, 5);
  const rest = summary.categories.slice(5).reduce((s, c) => s + c.amount, 0);
  const segs = top.map((c) => ({
    id: c.categoryId,
    value: c.amount,
    color: cat.get(c.categoryId)?.color || '#7D8597',
    name: cat.get(c.categoryId)?.name || 'Sin categoría',
    emoji: cat.get(c.categoryId)?.emoji || '📦',
  }));
  if (rest > 0) segs.push({ id: null, value: rest, color: '#9AA3A0', name: 'Otras', emoji: '⋯' });

  const legend = segs
    .map(
      (s) => `<button class="legend-row" ${s.id ? `data-action="filter-cat" data-id="${esc(s.id)}"` : 'data-action="go" data-tab="tx"'}>
        <i class="swatch" style="background:${esc(s.color)}"></i>
        <span class="legend-name">${esc(s.emoji)} ${esc(s.name)}</span>
        <span class="legend-val">${money(s.value, { whole: true })}</span>
        <span class="legend-pct">${percent(s.value / summary.expense)}</span>
      </button>`,
    )
    .join('');

  return `<section class="card">
    <div class="card-head"><h2>Gastos por categoría</h2></div>
    <div class="donut-wrap">
      <div class="donut-box">${donut(segs, { label: 'Gastos por categoría' })}
        <div class="donut-center"><span class="label">Total</span><strong>${money(summary.expense, { whole: true })}</strong></div>
      </div>
      <div class="legend-list">${legend}</div>
    </div>
  </section>`;
}

function upcomingCard(ctx) {
  const { data, today, cat } = ctx;
  const items = upcomingRecurring(data.recurring, today, 30);
  if (!items.length) return '';
  const totalOut = items.filter((i) => i.recurring.type === 'expense').reduce((s, i) => s + i.recurring.amount, 0);
  const rows = items
    .slice(0, 5)
    .map(({ recurring: r, date }) => {
      const c = cat.get(r.categoryId);
      const b = r.type === 'transfer' ? `<span class="bubble neutral">${icon('swap')}</span>` : bubble(c?.emoji || '🔁', c?.color || '#7D8597');
      return `<div class="row">${b}
        <span class="row-main"><span class="row-title">${esc(r.name)}</span>
        <span class="row-sub">${esc(shortDate(date, today))} · ${relativeDays(date, today)}</span></span>
        <span class="amount ${r.type === 'income' ? 'pos' : r.type === 'transfer' ? 'muted' : ''}">${money(r.amount, { signed: r.type === 'income' })}</span></div>`;
    })
    .join('');
  return `<section class="card">
    <div class="card-head"><h2>Próximos 30 días</h2>
      <button class="link" data-action="go" data-tab="more" data-sub="recurring">Ver todos</button></div>
    <div class="list flush">${rows}</div>
    <p class="note">Pagos fijos por salir: <strong>${money(totalOut)}</strong></p>
  </section>`;
}

function recentCard(ctx) {
  const { data, ui } = ctx;
  const txs = sortTransactions(data.transactions.filter((t) => monthOf(t.date) === ui.ym)).slice(0, 5);
  if (!txs.length) {
    return `<section class="card cta">
      <h2>Registra tu primer movimiento</h2>
      <p>Toca el botón <strong>+</strong> de abajo para anotar un gasto, un ingreso o una transferencia.</p>
      <button class="btn primary" data-action="new-tx">Agregar movimiento</button>
    </section>`;
  }
  return `<section class="card">
    <div class="card-head"><h2>Movimientos recientes</h2>
      <button class="link" data-action="go" data-tab="tx">Ver todos</button></div>
    <div class="list flush">${txs.map((t) => txRow(t, ctx)).join('')}</div>
  </section>`;
}
