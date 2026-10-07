// Pestaña "Más": cuentas, metas de ahorro, pagos recurrentes, categorías y ajustes.
import { FREQUENCIES, goalPlan, monthlyEquivalent, netWorth } from '../calc.js';
import { esc, money, monthLabel, percent, shortDate } from '../format.js';
import { ACCOUNT_TYPES, CURRENCIES } from '../store.js';
import { accountEmoji, addButton, bubble, emptyState, icon, pageHead, progress } from '../ui.js';

export function renderMore(ctx) {
  const screens = { accounts, goals, recurring, categories, settings };
  return (screens[ctx.ui.sub] || root)(ctx);
}

function navRow(sub, ico, title, value = '') {
  return `<button class="row nav" data-action="go" data-tab="more" data-sub="${sub}">
    <span class="bubble neutral">${icon(ico)}</span>
    <span class="row-main"><span class="row-title">${esc(title)}</span></span>
    <span class="row-value">${esc(value)}</span>${icon('right', 'chev')}
  </button>`;
}

function root(ctx) {
  const { data } = ctx;
  const worth = netWorth(data, ctx.balances);
  const fixed = data.recurring.filter((r) => r.active && r.type === 'expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  return `
    ${pageHead('Más')}
    <div class="list">
      ${navRow('accounts', 'wallet', 'Cuentas', money(worth.total))}
      ${navRow('goals', 'target', 'Metas de ahorro', data.goals.length ? `${data.goals.length}` : '')}
      ${navRow('recurring', 'repeat', 'Pagos recurrentes', fixed ? `${money(fixed, { whole: true })}/mes` : '')}
      ${navRow('categories', 'tag', 'Categorías', `${data.categories.length}`)}
    </div>
    <div class="list">
      ${navRow('settings', 'sliders', 'Ajustes y respaldo')}
    </div>
    <p class="footnote">${icon('shield', 'inline')} Tus datos se guardan solo en este dispositivo. No hay cuentas, anuncios ni servidores.</p>
  `;
}

function accounts(ctx) {
  const { data, balances } = ctx;
  const worth = netWorth(data, balances);
  const groups = Object.entries(ACCOUNT_TYPES)
    .map(([type, meta]) => {
      const list = data.accounts.filter((a) => a.type === type);
      if (!list.length) return '';
      const rows = list
        .map((a) => {
          const b = balances[a.id] || 0;
          const debt = type === 'credit' && b < 0;
          return `<button class="row" data-action="edit-account" data-id="${esc(a.id)}">
            ${bubble(accountEmoji(a), '#7D8597')}
            <span class="row-main"><span class="row-title">${esc(a.name)}</span>
            <span class="row-sub">${debt ? 'Debes' : esc(meta.label)}</span></span>
            <span class="amount ${b < 0 ? 'crit' : ''}">${money(debt ? -b : b)}</span></button>`;
        })
        .join('');
      return `<h2 class="section-title">${esc(meta.label)}</h2><div class="list">${rows}</div>`;
    })
    .join('');
  return `
    ${pageHead('Cuentas', { back: 'Más', action: addButton('new-account', 'Nueva cuenta') })}
    <section class="card hero">
      <span class="label">Patrimonio neto</span>
      <div class="hero-amount${worth.total < 0 ? ' crit' : ''}">${money(worth.total)}</div>
      <div class="split"><span>Tienes <strong>${money(worth.assets)}</strong></span><span>Debes <strong>${money(worth.debts)}</strong></span></div>
    </section>
    ${groups || emptyState('Sin cuentas', 'Agrega tu efectivo, tu cuenta de banco o tu tarjeta.', '<button class="btn primary" data-action="new-account">Agregar cuenta</button>')}
    <p class="footnote">Para pagar tu tarjeta de crédito registra una <strong>transferencia</strong> del banco a la tarjeta: así no se cuenta dos veces como gasto.</p>
  `;
}

function goals(ctx) {
  const { data, today } = ctx;
  const cards = data.goals
    .map((g) => {
      const plan = goalPlan(g, today);
      let note = '';
      if (plan.left === 0) note = '<p class="note pos">¡Meta cumplida!</p>';
      else if (plan.overdue) note = `<p class="note warn">La fecha ya pasó. Faltan ${money(plan.left)}.</p>`;
      else if (plan.perMonth) note = `<p class="note">Ahorra <strong>${money(plan.perMonth)}</strong> al mes para llegar en ${esc(monthLabel(g.deadline.slice(0, 7)).toLocaleLowerCase())}.</p>`;
      else note = `<p class="note">Faltan ${money(plan.left)}.</p>`;
      return `<section class="card goal">
        <button class="goal-head" data-action="edit-goal" data-id="${esc(g.id)}">
          ${bubble(g.emoji, g.color, 'lg')}
          <span class="row-main"><span class="row-title">${esc(g.name)}</span>
          <span class="row-sub">${money(g.saved)} de ${money(g.target)}</span></span>
          <span class="figure">${percent(plan.pct)}</span>
        </button>
        ${progress(plan.pct, plan.left === 0 ? 'done' : 'goal')}
        ${note}
        <button class="btn ghost" data-action="contribute" data-id="${esc(g.id)}">Aportar o retirar</button>
      </section>`;
    })
    .join('');
  return `
    ${pageHead('Metas de ahorro', { back: 'Más', action: addButton('new-goal', 'Nueva meta') })}
    ${cards || emptyState('Sin metas todavía', 'Un fondo de emergencia, un viaje, el enganche de un coche… Ponle número y fecha y te decimos cuánto apartar al mes.', '<button class="btn primary" data-action="new-goal">Crear meta</button>')}
  `;
}

function recurring(ctx) {
  const { data, today, cat } = ctx;
  const sorted = [...data.recurring].sort((a, b) => Number(b.active) - Number(a.active) || a.nextDate.localeCompare(b.nextDate));
  const sum = (type) => data.recurring.filter((r) => r.active && r.type === type).reduce((s, r) => s + monthlyEquivalent(r), 0);
  const rows = sorted
    .map((r) => {
      const c = cat.get(r.categoryId);
      const b = r.type === 'transfer' ? `<span class="bubble neutral">${icon('swap')}</span>` : bubble(c?.emoji || '🔁', c?.color || '#7D8597');
      return `<button class="row${r.active ? '' : ' paused'}" data-action="edit-recurring" data-id="${esc(r.id)}">${b}
        <span class="row-main"><span class="row-title">${esc(r.name)}</span>
        <span class="row-sub">${esc(FREQUENCIES[r.frequency])} · ${r.active ? `próximo ${esc(shortDate(r.nextDate, today))}` : 'Pausado'}</span></span>
        <span class="amount ${r.type === 'income' ? 'pos' : r.type === 'transfer' ? 'muted' : ''}">${money(r.amount, { signed: r.type === 'income' })}</span></button>`;
    })
    .join('');
  return `
    ${pageHead('Pagos recurrentes', { back: 'Más', action: addButton('new-recurring', 'Nuevo pago recurrente') })}
    <section class="card hero">
      <span class="label">Gastos fijos al mes</span>
      <div class="hero-amount">${money(sum('expense'))}</div>
      <div class="split"><span>Ingresos fijos <strong class="pos">${money(sum('income'))}</strong></span></div>
    </section>
    ${rows ? `<div class="list">${rows}</div>` : emptyState('Sin pagos recurrentes', 'Agrega tu renta, tus suscripciones o tu sueldo. Se registran solos el día que tocan.', '<button class="btn primary" data-action="new-recurring">Agregar pago</button>')}
    <p class="footnote">Cada vez que abres la app se registran los pagos que ya vencieron. Puedes editarlos o borrarlos desde Movimientos.</p>
  `;
}

function categories(ctx) {
  const { data } = ctx;
  const counts = {};
  for (const t of data.transactions) if (t.categoryId) counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
  const list = (kind) =>
    data.categories
      .filter((c) => c.kind === kind)
      .map(
        (c) => `<button class="row" data-action="edit-category" data-id="${esc(c.id)}">
          ${bubble(c.emoji, c.color)}
          <span class="row-main"><span class="row-title">${esc(c.name)}</span></span>
          <span class="row-value">${counts[c.id] || ''}</span>${icon('right', 'chev')}</button>`,
      )
      .join('');
  return `
    ${pageHead('Categorías', { back: 'Más', action: addButton('new-category', 'Nueva categoría') })}
    <h2 class="section-title">Gastos</h2><div class="list">${list('expense')}</div>
    <h2 class="section-title">Ingresos</h2><div class="list">${list('income')}</div>
  `;
}

function settings(ctx) {
  const { data } = ctx;
  const s = data.settings;
  const last = data.meta.lastBackup && !data.meta.sample
    ? `Último respaldo: ${new Date(data.meta.lastBackup).toLocaleDateString(s.locale, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Aún no has hecho un respaldo.';
  return `
    ${pageHead('Ajustes', { back: 'Más' })}
    <h2 class="section-title">Perfil</h2>
    <div class="list form-list">
      <label class="field"><span>Tu nombre</span>
        <input id="set-name" data-change="name" value="${esc(s.name)}" placeholder="Opcional" maxlength="30" autocomplete="given-name"></label>
      <label class="field"><span>Moneda</span>
        <select id="set-currency" data-change="currency">
          ${CURRENCIES.map(([code, name]) => `<option value="${code}" ${code === s.currency ? 'selected' : ''}>${esc(name)} (${code})</option>`).join('')}
        </select></label>
    </div>
    <h2 class="section-title">Apariencia</h2>
    <div class="seg" role="group" aria-label="Tema">
      ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) => `<button class="${s.theme === k ? 'on' : ''}" data-action="theme" data-theme="${k}" aria-pressed="${s.theme === k}">${l}</button>`).join('')}
    </div>
    <h2 class="section-title">Respaldo</h2>
    <div class="list">
      <button class="row" data-action="export-json"><span class="bubble neutral">${icon('share')}</span>
        <span class="row-main"><span class="row-title">Guardar respaldo</span><span class="row-sub">${esc(last)}</span></span></button>
      <button class="row" data-action="import-json"><span class="bubble neutral">${icon('download')}</span>
        <span class="row-main"><span class="row-title">Restaurar un respaldo</span><span class="row-sub">Reemplaza los datos actuales</span></span></button>
      <button class="row" data-action="export-csv"><span class="bubble neutral">${icon('table')}</span>
        <span class="row-main"><span class="row-title">Exportar a Excel (CSV)</span><span class="row-sub">${data.transactions.length} movimientos</span></span></button>
    </div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
    <p class="footnote">Guarda el respaldo en Archivos o iCloud Drive. Si cambias de teléfono, ábrelo aquí con “Restaurar”.</p>
    <h2 class="section-title">Datos</h2>
    <div class="list">
      ${data.meta.sample
        ? '<button class="row danger" data-action="reset-data" data-confirm="Toca otra vez para borrar el ejemplo">Borrar datos de ejemplo y empezar</button>'
        : `${data.transactions.length ? '' : '<button class="row" data-action="load-sample">Cargar datos de ejemplo</button>'}
           <button class="row danger" data-action="reset-data" data-confirm="Toca otra vez para borrar todo">Borrar todos mis datos</button>`}
    </div>
    <p class="footnote">Finanzas · versión 1.0</p>
  `;
}
