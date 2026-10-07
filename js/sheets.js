// Formularios que se abren en la hoja inferior: movimientos, cuentas, categorías, presupuestos, metas y pagos recurrentes.
import { FREQUENCIES, averageExpenseByCategory, monthSummary, roundUpNice } from './calc.js';
import { amountInputValue, currencySymbol, esc, money } from './format.js';
import { ACCOUNT_TYPES, COLORS, CURRENCIES, EMOJI_SUGGESTIONS } from './store.js';
import { accountEmoji, bubble, icon } from './ui.js';

function head(title, { save = true } = {}) {
  return `<div class="sheet-head">
    <button type="button" class="link" data-action="close-sheet">Cancelar</button>
    <h2>${esc(title)}</h2>
    ${save ? '<button type="submit" class="link strong">Guardar</button>' : '<span></span>'}
  </div>`;
}

function amountField(name, cents, { label = '', autofocus = false } = {}) {
  return `<label class="amount-input">
    ${label ? `<span class="amount-label">${esc(label)}</span>` : ''}
    <span class="amount-row"><span class="cur">${esc(currencySymbol())}</span>
    <input id="f-${name}" name="${name}" inputmode="decimal" placeholder="0" autocomplete="off" enterkeyhint="done"
      value="${esc(amountInputValue(cents))}" ${autofocus ? 'data-autofocus' : ''}></span>
  </label>`;
}

function seg(name, options, value) {
  return `<div class="seg" role="radiogroup">${options
    .map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${esc(l)}</span></label>`)
    .join('')}</div>`;
}

function accountOptions(data, selected, exclude = null) {
  return data.accounts
    .filter((a) => a.id !== exclude)
    .map((a) => `<option value="${esc(a.id)}" ${a.id === selected ? 'selected' : ''}>${esc(accountEmoji(a))} ${esc(a.name)}</option>`)
    .join('');
}

function categoryGrid(data, kind, selected) {
  const items = data.categories
    .filter((c) => c.kind === kind)
    .map(
      (c) => `<label class="cat-chip"><input type="radio" name="cat_${kind}" value="${esc(c.id)}" ${c.id === selected ? 'checked' : ''}>
        <span>${bubble(c.emoji, c.color)}<em>${esc(c.name)}</em></span></label>`,
    )
    .join('');
  return `<div class="cat-grid" data-show="${kind}" role="radiogroup" aria-label="Categoría">${items}</div>`;
}

function emojiPicker(value) {
  return `<label class="field"><span>Ícono</span>
      <input id="f-emoji" name="emoji" value="${esc(value)}" maxlength="8" class="emoji-input" autocomplete="off"></label>
    <div class="emoji-row">${EMOJI_SUGGESTIONS.map((e) => `<button type="button" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}</div>`;
}

function colorPicker(value) {
  return `<div class="swatches" role="radiogroup" aria-label="Color">${COLORS.map(
    (c) => `<label><input type="radio" name="color" value="${c}" ${c === value ? 'checked' : ''}><i style="background:${c}"></i></label>`,
  ).join('')}</div>`;
}

// ---------- Movimiento ----------

export function txSheet(ctx, tx = null) {
  const { data, today } = ctx;
  const type = tx?.type || 'expense';
  const accountId = tx?.accountId || (data.accounts.some((a) => a.id === data.settings.lastAccountId) ? data.settings.lastAccountId : data.accounts[0]?.id);
  const toAccountId = tx?.toAccountId || data.accounts.find((a) => a.id !== accountId)?.id;
  const rec = tx?.recurringId ? data.recurring.find((r) => r.id === tx.recurringId) : null;
  return `<form class="sheet-form" data-form="tx" data-id="${esc(tx?.id || '')}" novalidate>
    ${head(tx ? 'Editar movimiento' : 'Nuevo movimiento')}
    ${seg('type', [['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']], type)}
    ${amountField('amount', tx?.amount, { autofocus: !tx })}
    ${categoryGrid(data, 'expense', tx?.type === 'expense' ? tx.categoryId : null)}
    ${categoryGrid(data, 'income', tx?.type === 'income' ? tx.categoryId : null)}
    <div class="list form-list">
      <label class="field"><span data-account-label>${type === 'transfer' ? 'Desde' : 'Cuenta'}</span>
        <select id="f-account" name="accountId">${accountOptions(data, accountId)}</select></label>
      <label class="field" data-show="transfer"><span>Hacia</span>
        <select id="f-to" name="toAccountId">${accountOptions(data, toAccountId)}</select></label>
      <label class="field"><span>Fecha</span><input id="f-date" type="date" name="date" value="${esc(tx?.date || today)}" required></label>
      <label class="field"><span>Nota</span><input id="f-note" name="note" value="${esc(tx?.note || '')}" placeholder="Opcional" maxlength="80" autocomplete="off"></label>
      ${tx ? '' : `<label class="field"><span>Repetir</span><select id="f-repeat" name="repeat">
        <option value="">No se repite</option>
        ${Object.entries(FREQUENCIES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}
      </select></label>`}
    </div>
    ${rec ? `<p class="footnote">${icon('repeat', 'inline')} Generado por el pago recurrente “${esc(rec.name)}”. Los cambios aplican solo a este movimiento.</p>` : ''}
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
    ${tx ? `<button type="button" class="btn danger-ghost block" data-action="delete-tx" data-id="${esc(tx.id)}">Eliminar movimiento</button>` : ''}
  </form>`;
}

// ---------- Cuenta ----------

export function accountSheet(ctx, account = null) {
  const { data, balances } = ctx;
  const type = account?.type || 'bank';
  const balance = account ? balances[account.id] || 0 : 0;
  const used = account ? data.transactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id).length : 0;
  return `<form class="sheet-form" data-form="account" data-id="${esc(account?.id || '')}" novalidate>
    ${head(account ? 'Editar cuenta' : 'Nueva cuenta')}
    <div class="list form-list">
      <label class="field"><span>Nombre</span><input id="f-name" name="name" value="${esc(account?.name || '')}" placeholder="Ej. BBVA débito" maxlength="40" required ${account ? '' : 'data-autofocus'}></label>
      <label class="field"><span>Tipo</span><select id="f-type" name="type">
        ${Object.entries(ACCOUNT_TYPES).map(([k, m]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${m.emoji} ${esc(m.label)}</option>`).join('')}
      </select></label>
    </div>
    ${amountField('balance', type === 'credit' ? -balance : balance, { label: type === 'credit' ? 'Deuda actual' : 'Saldo actual' })}
    <p class="footnote">${account ? 'Si el saldo no coincide con tu banco, corrígelo aquí. No se crea ningún movimiento.' : 'Escribe cuánto tienes hoy en esta cuenta (o cuánto debes, si es tarjeta de crédito).'}</p>
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
    ${account ? `<button type="button" class="btn ghost block" data-action="filter-acc" data-id="${esc(account.id)}">Ver movimientos de esta cuenta</button>
      <button type="button" class="btn danger-ghost block" data-action="delete-account" data-id="${esc(account.id)}"
        data-confirm="${used ? `Se borrarán ${used} movimientos. Toca otra vez` : 'Toca otra vez para eliminar'}">Eliminar cuenta</button>` : ''}
  </form>`;
}

// ---------- Categoría ----------

export function categorySheet(ctx, category = null) {
  const used = category ? ctx.data.transactions.filter((t) => t.categoryId === category.id).length : 0;
  return `<form class="sheet-form" data-form="category" data-id="${esc(category?.id || '')}" novalidate>
    ${head(category ? 'Editar categoría' : 'Nueva categoría')}
    ${category ? '' : seg('kind', [['expense', 'Gasto'], ['income', 'Ingreso']], 'expense')}
    <div class="list form-list">
      <label class="field"><span>Nombre</span><input id="f-name" name="name" value="${esc(category?.name || '')}" placeholder="Ej. Gimnasio" maxlength="30" required ${category ? '' : 'data-autofocus'}></label>
      ${emojiPicker(category?.emoji || '📦')}
    </div>
    ${colorPicker(category?.color || COLORS[Math.floor(Math.random() * COLORS.length)])}
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
    ${category ? `<button type="button" class="btn danger-ghost block" data-action="delete-category" data-id="${esc(category.id)}"
      data-confirm="${used ? `${used} movimientos quedarán sin categoría. Toca otra vez` : 'Toca otra vez para eliminar'}">Eliminar categoría</button>` : ''}
  </form>`;
}

// ---------- Presupuesto ----------

export function budgetSheet(ctx, category) {
  const { data, ui } = ctx;
  const current = data.budgets[category.id] || 0;
  const avg = averageExpenseByCategory(data, ui.ym)[category.id] || 0;
  const spent = monthSummary(data, ui.ym).categories.find((c) => c.categoryId === category.id)?.amount || 0;
  const suggestion = roundUpNice(avg);
  return `<form class="sheet-form" data-form="budget" data-id="${esc(category.id)}" novalidate>
    ${head('Presupuesto')}
    <div class="sheet-title-row">${bubble(category.emoji, category.color, 'lg')}<strong>${esc(category.name)}</strong></div>
    ${amountField('amount', current, { label: 'Monto mensual', autofocus: true })}
    <div class="list form-list info-list">
      <div class="field"><span>Gastado este mes</span><strong>${money(spent)}</strong></div>
      ${avg ? `<div class="field"><span>Promedio 3 meses</span><strong>${money(avg)}</strong></div>` : ''}
    </div>
    ${avg ? `<button type="button" class="btn ghost block" data-action="use-amount" data-value="${esc(amountInputValue(suggestion))}">Usar ${money(suggestion, { whole: true })} al mes</button>` : ''}
    <button type="submit" class="btn primary block">Guardar</button>
    ${current ? `<button type="button" class="btn danger-ghost block" data-action="remove-budget" data-id="${esc(category.id)}">Quitar presupuesto</button>` : ''}
  </form>`;
}

export function suggestBudgetSheet(ctx) {
  const { data, ui } = ctx;
  let avg = averageExpenseByCategory(data, ui.ym);
  let basis = 'tu gasto promedio de los últimos 3 meses';
  if (!Object.keys(avg).length) {
    avg = Object.fromEntries(monthSummary(data, ui.ym).categories.filter((c) => c.categoryId).map((c) => [c.categoryId, c.amount]));
    basis = 'lo que llevas gastado este mes';
  }
  const rows = data.categories
    .filter((c) => c.kind === 'expense' && avg[c.id])
    .map((c) => ({ c, amount: roundUpNice(avg[c.id]) }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return `<form class="sheet-form" data-form="suggest" novalidate>
    ${head('Presupuesto sugerido', { save: false })}
    <p class="sheet-lead">Calculado con ${basis}, redondeado hacia arriba. Desmarca lo que no quieras incluir; después puedes ajustar cada monto.</p>
    <div class="list">${rows
      .map(
        (r) => `<label class="row check-row"><input type="checkbox" name="cat" value="${esc(r.c.id)}" data-amount="${r.amount}" checked>
          ${bubble(r.c.emoji, r.c.color)}<span class="row-main"><span class="row-title">${esc(r.c.name)}</span></span>
          <span class="amount">${money(r.amount, { whole: true })}</span></label>`,
      )
      .join('')}</div>
    <p class="totals"><span>Total mensual</span><strong>${money(total, { whole: true })}</strong></p>
    <button type="submit" class="btn primary block">Aplicar presupuesto</button>
  </form>`;
}

// ---------- Metas ----------

export function goalSheet(ctx, goal = null) {
  return `<form class="sheet-form" data-form="goal" data-id="${esc(goal?.id || '')}" novalidate>
    ${head(goal ? 'Editar meta' : 'Nueva meta')}
    <div class="list form-list">
      <label class="field"><span>Nombre</span><input id="f-name" name="name" value="${esc(goal?.name || '')}" placeholder="Ej. Fondo de emergencia" maxlength="40" required ${goal ? '' : 'data-autofocus'}></label>
      ${emojiPicker(goal?.emoji || '🎯')}
    </div>
    ${amountField('target', goal?.target, { label: '¿Cuánto quieres juntar?' })}
    ${goal ? '' : amountField('saved', 0, { label: '¿Cuánto llevas ahorrado?' })}
    <div class="list form-list">
      <label class="field"><span>Fecha límite</span><input id="f-deadline" type="date" name="deadline" value="${esc(goal?.deadline || '')}"></label>
    </div>
    ${colorPicker(goal?.color || COLORS[4])}
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
    ${goal ? `<button type="button" class="btn danger-ghost block" data-action="delete-goal" data-id="${esc(goal.id)}" data-confirm="Toca otra vez para eliminar">Eliminar meta</button>` : ''}
  </form>`;
}

export function contributeSheet(ctx, goal) {
  return `<form class="sheet-form" data-form="contribute" data-id="${esc(goal.id)}" novalidate>
    ${head(goal.name)}
    ${seg('direction', [['in', 'Aportar'], ['out', 'Retirar']], 'in')}
    ${amountField('amount', 0, { autofocus: true })}
    <p class="footnote">Llevas ${money(goal.saved)} de ${money(goal.target)}.</p>
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
  </form>`;
}

// ---------- Pagos recurrentes ----------

export function recurringSheet(ctx, r = null) {
  const { data, today } = ctx;
  const type = r?.type || 'expense';
  const accountId = r?.accountId || data.accounts[0]?.id;
  return `<form class="sheet-form" data-form="recurring" data-id="${esc(r?.id || '')}" novalidate>
    ${head(r ? 'Editar pago recurrente' : 'Nuevo pago recurrente')}
    ${seg('type', [['expense', 'Gasto'], ['income', 'Ingreso'], ['transfer', 'Transferencia']], type)}
    ${amountField('amount', r?.amount)}
    ${categoryGrid(data, 'expense', type === 'expense' ? r?.categoryId : null)}
    ${categoryGrid(data, 'income', type === 'income' ? r?.categoryId : null)}
    <div class="list form-list">
      <label class="field"><span>Nombre</span><input id="f-name" name="name" value="${esc(r?.name || '')}" placeholder="Ej. Netflix, renta, sueldo" maxlength="40" required></label>
      <label class="field"><span data-account-label>${type === 'transfer' ? 'Desde' : 'Cuenta'}</span><select id="f-account" name="accountId">${accountOptions(data, accountId)}</select></label>
      <label class="field" data-show="transfer"><span>Hacia</span><select id="f-to" name="toAccountId">${accountOptions(data, r?.toAccountId || data.accounts.find((a) => a.id !== accountId)?.id)}</select></label>
      <label class="field"><span>Frecuencia</span><select id="f-frequency" name="frequency">
        ${Object.entries(FREQUENCIES).map(([k, l]) => `<option value="${k}" ${k === (r?.frequency || 'monthly') ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select></label>
      <label class="field"><span>Próximo pago</span><input id="f-next" type="date" name="nextDate" value="${esc(r?.nextDate || today)}" required></label>
      ${r ? `<label class="field toggle"><span>Activo</span><input id="f-active" type="checkbox" name="active" ${r.active ? 'checked' : ''}></label>` : ''}
    </div>
    <p class="footnote">El día del pago se registra solo en Movimientos.</p>
    <p class="form-error" hidden></p>
    <button type="submit" class="btn primary block">Guardar</button>
    ${r ? `<button type="button" class="btn danger-ghost block" data-action="delete-recurring" data-id="${esc(r.id)}" data-confirm="Toca otra vez para eliminar">Eliminar pago recurrente</button>` : ''}
  </form>`;
}

// ---------- Bienvenida y respaldo ----------

export function onboardingSheet(ctx) {
  const { data } = ctx;
  return `<form class="sheet-form onboarding" data-form="onboarding" novalidate>
    <div class="welcome-mark" aria-hidden="true"><img src="icons/icon-192.png" alt="" width="64" height="64"></div>
    <h2 class="welcome-title">Bienvenido a Finanzas</h2>
    <p class="sheet-lead">Lleva tus cuentas, gastos, presupuesto y metas de ahorro. Todo se guarda en tu teléfono: sin registro, sin anuncios y sin suscripción.</p>
    <div class="list form-list">
      <label class="field"><span>Tu nombre</span><input id="f-name" name="name" placeholder="Opcional" maxlength="30" autocomplete="given-name"></label>
      <label class="field"><span>Moneda</span><select id="f-currency" name="currency">
        ${CURRENCIES.map(([code, name]) => `<option value="${code}" ${code === data.settings.currency ? 'selected' : ''}>${esc(name)} (${code})</option>`).join('')}
      </select></label>
    </div>
    <button type="submit" class="btn primary block" name="mode" value="empty">Empezar</button>
    <button type="submit" class="btn ghost block" name="mode" value="sample">Probar con datos de ejemplo</button>
  </form>`;
}

export function importSheet(ctx, incoming) {
  return `<form class="sheet-form" data-form="import" novalidate>
    ${head('Restaurar respaldo', { save: false })}
    <p class="sheet-lead">El respaldo tiene <strong>${incoming.transactions.length} movimientos</strong>, ${incoming.accounts.length} cuentas y ${incoming.goals.length} metas.</p>
    <p class="sheet-lead">Va a <strong>reemplazar</strong> lo que tienes ahora (${ctx.data.transactions.length} movimientos). Esto no se puede deshacer.</p>
    <button type="submit" class="btn primary block">Reemplazar mis datos</button>
  </form>`;
}
