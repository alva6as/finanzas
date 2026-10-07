// Cálculos puros sobre los datos: fechas, saldos, resúmenes, presupuestos y pagos recurrentes.
// No toca el DOM ni el almacenamiento, así se puede probar con `node --test`.
// Todos los montos están en centavos (enteros) para evitar errores de redondeo.

export const FREQUENCIES = {
  weekly: 'Cada semana',
  biweekly: 'Cada 2 semanas',
  monthly: 'Cada mes',
  yearly: 'Cada año',
};

const MONTHLY_FACTOR = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 };

export const pad = (n) => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export const todayISO = (now = new Date()) => toISO(now);
export const monthOf = (iso) => iso.slice(0, 7);
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();

export function addMonthsYM(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(from, to) {
  return Math.round((parseISO(to) - parseISO(from)) / 86400000);
}

// Días que faltan del mes contando hoy.
export function daysLeftInMonth(today) {
  const d = parseISO(today);
  return daysInMonth(d.getFullYear(), d.getMonth() + 1) - d.getDate() + 1;
}

// Fracción del mes ya transcurrida (para la marca de ritmo en el presupuesto).
export function monthProgress(today) {
  const d = parseISO(today);
  return d.getDate() / daysInMonth(d.getFullYear(), d.getMonth() + 1);
}

// Siguiente fecha de un pago recurrente. `anchorDay` conserva el día original
// (un pago del 31 cae el 30 en abril y vuelve al 31 en mayo).
export function nextOccurrence(iso, frequency, anchorDay) {
  if (frequency === 'weekly') return addDays(iso, 7);
  if (frequency === 'biweekly') return addDays(iso, 14);
  const d = parseISO(iso);
  const day = anchorDay || d.getDate();
  let y = d.getFullYear();
  let m = d.getMonth() + 1;
  if (frequency === 'yearly') y += 1;
  else if (++m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
}

export const monthlyEquivalent = (r) => Math.round(r.amount * (MONTHLY_FACTOR[r.frequency] ?? 1));

// Saldo de cada cuenta. Con `asOf` ignora movimientos con fecha futura.
export function accountBalances(data, asOf) {
  const bal = {};
  for (const a of data.accounts) bal[a.id] = a.initial || 0;
  for (const t of data.transactions) {
    if (asOf && t.date > asOf) continue;
    if (t.type === 'income') {
      if (t.accountId in bal) bal[t.accountId] += t.amount;
    } else if (t.type === 'expense') {
      if (t.accountId in bal) bal[t.accountId] -= t.amount;
    } else if (t.type === 'transfer') {
      if (t.accountId in bal) bal[t.accountId] -= t.amount;
      if (t.toAccountId in bal) bal[t.toAccountId] += t.amount;
    }
  }
  return bal;
}

export function netWorth(data, balances = accountBalances(data)) {
  let assets = 0;
  let debts = 0;
  for (const a of data.accounts) {
    const b = balances[a.id] || 0;
    if (b < 0) debts += -b;
    else assets += b;
  }
  return { total: assets - debts, assets, debts };
}

export function monthSummary(data, ym) {
  let income = 0;
  let expense = 0;
  const byCat = new Map();
  for (const t of data.transactions) {
    if (monthOf(t.date) !== ym) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') {
      expense += t.amount;
      const k = t.categoryId || '';
      byCat.set(k, (byCat.get(k) || 0) + t.amount);
    }
  }
  const categories = [...byCat]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
  const net = income - expense;
  return { income, expense, net, savingsRate: income > 0 ? net / income : null, categories };
}

// Ingresos y gastos de los últimos `months` meses terminando en `endYm`.
export function trend(data, endYm, months = 6) {
  const keys = [];
  for (let i = months - 1; i >= 0; i--) keys.push(addMonthsYM(endYm, -i));
  const map = Object.fromEntries(keys.map((ym) => [ym, { ym, income: 0, expense: 0 }]));
  for (const t of data.transactions) {
    const row = map[monthOf(t.date)];
    if (!row) continue;
    if (t.type === 'income') row.income += t.amount;
    else if (t.type === 'expense') row.expense += t.amount;
  }
  return keys.map((k) => map[k]);
}

export function budgetStatus(data, ym, summary = monthSummary(data, ym)) {
  const spentBy = Object.fromEntries(summary.categories.map((c) => [c.categoryId, c.amount]));
  const rows = [];
  const unbudgeted = [];
  const idle = [];
  for (const category of data.categories) {
    if (category.kind !== 'expense') continue;
    const budget = data.budgets[category.id] || 0;
    const spent = spentBy[category.id] || 0;
    const row = { category, budget, spent, remaining: budget - spent, pct: budget > 0 ? spent / budget : 0 };
    if (budget > 0) rows.push(row);
    else if (spent > 0) unbudgeted.push(row);
    else idle.push(row);
  }
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  return {
    rows,
    unbudgeted: unbudgeted.sort((a, b) => b.spent - a.spent),
    idle,
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    unbudgetedSpent: unbudgeted.reduce((s, r) => s + r.spent, 0),
  };
}

export const budgetState = (pct) => (pct > 1 ? 'crit' : pct >= 0.85 ? 'warn' : 'ok');

// Gasto mensual promedio por categoría en los meses anteriores a `ym` que tienen movimientos.
export function averageExpenseByCategory(data, ym, months = 3) {
  const keys = new Set();
  for (let i = 1; i <= months; i++) keys.add(addMonthsYM(ym, -i));
  const totals = {};
  const active = new Set();
  for (const t of data.transactions) {
    const k = monthOf(t.date);
    if (!keys.has(k)) continue;
    active.add(k);
    if (t.type === 'expense' && t.categoryId) totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
  }
  const n = Math.max(1, active.size);
  return Object.fromEntries(Object.entries(totals).map(([id, v]) => [id, Math.round(v / n)]));
}

// Redondea hacia arriba a dos cifras significativas: 4,380 → 4,400; 12,340 → 13,000.
export function roundUpNice(cents) {
  const units = cents / 100;
  if (units <= 0) return 0;
  const step = 10 ** Math.max(0, Math.floor(Math.log10(units)) - 1);
  return Math.ceil(units / step) * step * 100;
}

// Genera los movimientos de pagos recurrentes que ya vencieron (hasta `today` inclusive).
export function dueRecurring(recurring, today, makeId, now = Date.now()) {
  const created = [];
  const updated = recurring.map((r) => {
    if (!r.active) return r;
    let next = r.nextDate;
    let guard = 0;
    while (next <= today && guard < 120) {
      created.push({
        id: makeId(),
        type: r.type,
        amount: r.amount,
        accountId: r.accountId,
        toAccountId: r.toAccountId || null,
        categoryId: r.categoryId || null,
        date: next,
        note: r.name,
        recurringId: r.id,
        created: now + created.length,
      });
      next = nextOccurrence(next, r.frequency, r.anchorDay);
      guard++;
    }
    return next === r.nextDate ? r : { ...r, nextDate: next };
  });
  return { created, recurring: updated };
}

export function upcomingRecurring(recurring, today, days = 30) {
  const end = addDays(today, days);
  const out = [];
  for (const r of recurring) {
    if (!r.active) continue;
    let d = r.nextDate;
    let guard = 0;
    while (d <= end && guard < 10) {
      if (d >= today) out.push({ recurring: r, date: d });
      d = nextOccurrence(d, r.frequency, r.anchorDay);
      guard++;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function sortTransactions(txs) {
  return [...txs].sort((a, b) => b.date.localeCompare(a.date) || (b.created || 0) - (a.created || 0));
}

// Cuánto falta para una meta y cuánto ahorrar al mes para llegar a tiempo.
export function goalPlan(goal, today) {
  const left = Math.max(0, goal.target - goal.saved);
  const pct = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  if (!goal.deadline || left === 0) return { left, pct, perMonth: null, monthsLeft: null, overdue: false };
  const a = parseISO(today);
  const b = parseISO(goal.deadline);
  const monthsLeft = Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
  return { left, pct, monthsLeft, perMonth: Math.ceil(left / monthsLeft), overdue: goal.deadline < today };
}
