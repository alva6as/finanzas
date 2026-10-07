// Presupuesto mensual por categoría, con ritmo de gasto y lo que queda por día.
import {
  averageExpenseByCategory, budgetState, budgetStatus, daysLeftInMonth, monthOf, monthProgress, monthSummary,
} from '../calc.js';
import { esc, money, monthLabel, percent } from '../format.js';
import { bubble, monthSwitch, pageHead, progress } from '../ui.js';

export function renderBudget(ctx) {
  const { data, ui, today } = ctx;
  const summary = monthSummary(data, ui.ym);
  const bs = budgetStatus(data, ui.ym, summary);
  const isCurrent = ui.ym === monthOf(today);
  const pace = isCurrent ? monthProgress(today) : null;
  const hasHistory = Object.keys(averageExpenseByCategory(data, ui.ym)).length > 0 || summary.expense > 0;

  let head;
  if (!bs.totalBudget) {
    head = `<section class="card cta">
      <h2>Aún no tienes presupuesto</h2>
      <p>Asigna un monto mensual a cada categoría. Toca una categoría de la lista para empezar${hasHistory ? ' o deja que lo calculemos con lo que sueles gastar' : ''}.</p>
      ${hasHistory ? '<button class="btn primary" data-action="suggest-budget">Sugerir presupuesto</button>' : ''}
    </section>`;
  } else {
    const pct = bs.totalSpent / bs.totalBudget;
    const over = bs.remaining < 0;
    const days = isCurrent ? daysLeftInMonth(today) : 0;
    head = `<section class="card hero budget-hero">
      <span class="label">${over ? 'Te pasaste por' : isCurrent ? 'Te quedan' : 'Sobró'}</span>
      <div class="hero-amount ${over ? 'crit' : ''}">${money(Math.abs(bs.remaining))}</div>
      ${progress(pct, budgetState(pct), pace)}
      <div class="split">
        <span>Gastado <strong>${money(bs.totalSpent)}</strong></span>
        <span>de <strong>${money(bs.totalBudget)}</strong></span>
      </div>
      ${isCurrent && !over ? `<p class="note">Puedes gastar <strong>${money(Math.floor(bs.remaining / days))}</strong> al día durante ${days} ${days === 1 ? 'día' : 'días'}.</p>` : ''}
      ${incomeNote(summary.income, bs.totalBudget, ui.ym)}
    </section>`;
  }

  const rows = bs.rows.map((r) => budgetRow(r, pace)).join('');
  const unbudgeted = bs.unbudgeted
    .map(
      (r) => `<button class="row" data-action="edit-budget" data-id="${esc(r.category.id)}">
        ${bubble(r.category.emoji, r.category.color)}
        <span class="row-main"><span class="row-title">${esc(r.category.name)}</span>
        <span class="row-sub">Gastado ${money(r.spent)} sin presupuesto</span></span>
        <span class="pill-btn">Asignar</span></button>`,
    )
    .join('');
  const idle = bs.idle
    .map((r) => `<button class="chip-btn" data-action="edit-budget" data-id="${esc(r.category.id)}">${esc(r.category.emoji)} ${esc(r.category.name)}</button>`)
    .join('');

  return `
    ${pageHead('Presupuesto')}
    ${monthSwitch(ui.ym, today)}
    ${head}
    ${rows ? `<h2 class="section-title">Por categoría</h2><div class="list">${rows}</div>` : ''}
    ${unbudgeted ? `<h2 class="section-title">Sin presupuesto · ${money(bs.unbudgetedSpent)}</h2><div class="list">${unbudgeted}</div>` : ''}
    ${idle ? `<h2 class="section-title">Otras categorías</h2><div class="chip-wrap">${idle}</div>` : ''}
    ${bs.totalBudget && hasHistory ? '<button class="btn ghost block" data-action="suggest-budget">Recalcular con mi promedio</button>' : ''}
    <p class="footnote">El presupuesto se repite cada mes. Los cambios aplican a todos los meses.</p>
  `;
}

function incomeNote(income, budget, ym) {
  if (!income) return '';
  const month = monthLabel(ym, { year: false }).toLocaleLowerCase();
  const diff = income - budget;
  if (diff >= 0) {
    return `<p class="note">De tus ingresos de ${esc(month)} (${money(income)}) quedan <strong class="pos">${money(diff)}</strong> sin asignar: ideal para ahorro o metas.</p>`;
  }
  return `<p class="note warn">Tu presupuesto supera tus ingresos de ${esc(month)} por <strong>${money(-diff)}</strong>.</p>`;
}

function budgetRow(r, pace) {
  const state = budgetState(r.pct);
  const right = r.remaining >= 0 ? `Quedan ${money(r.remaining, { whole: true })}` : `Excedido ${money(-r.remaining, { whole: true })}`;
  return `<button class="row budget-row" data-action="edit-budget" data-id="${esc(r.category.id)}">
    ${bubble(r.category.emoji, r.category.color)}
    <span class="row-main">
      <span class="row-line"><span class="row-title">${esc(r.category.name)}</span><span class="left ${state}">${right}</span></span>
      ${progress(r.pct, state, pace)}
      <span class="row-sub">${money(r.spent, { whole: true })} de ${money(r.budget, { whole: true })} · ${percent(r.pct)}</span>
    </span>
  </button>`;
}
