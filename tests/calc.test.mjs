import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountBalances, addMonthsYM, averageExpenseByCategory, budgetStatus, daysLeftInMonth, dueRecurring,
  goalPlan, monthSummary, monthlyEquivalent, netWorth, nextOccurrence, roundUpNice, trend, upcomingRecurring,
} from '../js/calc.js';
import { configureFormat, parseAmount } from '../js/format.js';
import { createSampleData, migrate, transactionsCSV } from '../js/store.js';

const tx = (over) => ({ id: Math.random().toString(36), created: 0, accountId: 'a', categoryId: null, toAccountId: null, note: '', ...over });

test('parseAmount entiende separadores de miles y decimales', () => {
  assert.equal(parseAmount('1,234.50', '.'), 123450);
  assert.equal(parseAmount('1.234,50', ','), 123450);
  assert.equal(parseAmount('1.234,50', '.'), 123450);
  assert.equal(parseAmount('12,5', '.'), 1250);
  assert.equal(parseAmount('1,234', '.'), 123400);
  assert.equal(parseAmount('1.234', ','), 123400);
  assert.equal(parseAmount('1.5', '.'), 150);
  assert.equal(parseAmount('1.234.567', '.'), 123456700);
  assert.equal(parseAmount('$ 99', '.'), 9900);
  assert.equal(parseAmount('0.29', '.'), 29);
  assert.ok(Number.isNaN(parseAmount('', '.')));
  assert.ok(Number.isNaN(parseAmount('abc', '.')));
});

test('addMonthsYM cruza años en ambos sentidos', () => {
  assert.equal(addMonthsYM('2026-12', 1), '2027-01');
  assert.equal(addMonthsYM('2026-01', -1), '2025-12');
  assert.equal(addMonthsYM('2026-10', -14), '2025-08');
});

test('nextOccurrence conserva el día original en meses cortos', () => {
  assert.equal(nextOccurrence('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(nextOccurrence('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(nextOccurrence('2024-02-29', 'yearly', 29), '2025-02-28');
  assert.equal(nextOccurrence('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(nextOccurrence('2026-10-30', 'weekly'), '2026-11-06');
  assert.equal(nextOccurrence('2026-10-30', 'biweekly'), '2026-11-13');
});

test('daysLeftInMonth cuenta el día de hoy', () => {
  assert.equal(daysLeftInMonth('2026-10-07'), 25);
  assert.equal(daysLeftInMonth('2026-02-28'), 1);
});

test('saldos: ingresos, gastos, transferencias y fechas futuras', () => {
  const data = {
    accounts: [{ id: 'a', initial: 100000 }, { id: 'card', initial: -5000 }],
    transactions: [
      tx({ type: 'income', amount: 50000, date: '2026-10-01' }),
      tx({ type: 'expense', amount: 20000, date: '2026-10-02' }),
      tx({ type: 'expense', amount: 3000, date: '2026-10-03', accountId: 'card' }),
      tx({ type: 'transfer', amount: 8000, date: '2026-10-04', toAccountId: 'card' }),
      tx({ type: 'expense', amount: 99999, date: '2026-12-01' }),
    ],
  };
  const bal = accountBalances(data, '2026-10-31');
  assert.deepEqual(bal, { a: 122000, card: 0 });
  assert.deepEqual(netWorth(data, bal), { total: 122000, assets: 122000, debts: 0 });
  assert.equal(accountBalances(data).a, 22001);
});

test('resumen del mes y presupuesto', () => {
  const data = {
    categories: [
      { id: 'food', kind: 'expense' },
      { id: 'fun', kind: 'expense' },
      { id: 'gift', kind: 'expense' },
      { id: 'pay', kind: 'income' },
    ],
    budgets: { food: 100000 },
    transactions: [
      tx({ type: 'income', amount: 300000, date: '2026-10-01', categoryId: 'pay' }),
      tx({ type: 'expense', amount: 60000, date: '2026-10-03', categoryId: 'food' }),
      tx({ type: 'expense', amount: 50000, date: '2026-10-05', categoryId: 'food' }),
      tx({ type: 'expense', amount: 20000, date: '2026-10-05', categoryId: 'fun' }),
      tx({ type: 'expense', amount: 70000, date: '2026-09-05', categoryId: 'food' }),
      tx({ type: 'transfer', amount: 1, date: '2026-10-05' }),
    ],
  };
  const s = monthSummary(data, '2026-10');
  assert.equal(s.income, 300000);
  assert.equal(s.expense, 130000);
  assert.equal(s.categories[0].categoryId, 'food');
  assert.ok(Math.abs(s.savingsRate - 170000 / 300000) < 1e-9);

  const b = budgetStatus(data, '2026-10', s);
  assert.equal(b.totalBudget, 100000);
  assert.equal(b.remaining, -10000);
  assert.deepEqual(b.unbudgeted.map((r) => r.category.id), ['fun']);
  assert.deepEqual(b.idle.map((r) => r.category.id), ['gift']);

  assert.deepEqual(averageExpenseByCategory(data, '2026-10'), { food: 70000 });
  assert.deepEqual(trend(data, '2026-10', 2).map((r) => r.expense), [70000, 130000]);
});

test('pagos recurrentes: genera los vencidos y avanza la fecha', () => {
  let n = 0;
  const recurring = [
    { id: 'r1', active: true, type: 'expense', amount: 1000, accountId: 'a', name: 'Netflix', frequency: 'monthly', anchorDay: 31, nextDate: '2026-08-31' },
    { id: 'r2', active: false, type: 'expense', amount: 1000, accountId: 'a', name: 'Pausado', frequency: 'weekly', nextDate: '2026-01-01' },
  ];
  const { created, recurring: next } = dueRecurring(recurring, '2026-10-07', () => `id${n++}`);
  assert.deepEqual(created.map((t) => t.date), ['2026-08-31', '2026-09-30']);
  assert.equal(next[0].nextDate, '2026-10-31');
  assert.equal(next[1], recurring[1]);
  assert.equal(created[0].recurringId, 'r1');

  const up = upcomingRecurring(next, '2026-10-07', 30);
  assert.deepEqual(up.map((u) => u.date), ['2026-10-31']);
  assert.equal(monthlyEquivalent({ amount: 1200, frequency: 'weekly' }), 5200);
});

test('metas y redondeo de presupuesto sugerido', () => {
  const plan = goalPlan({ target: 1200000, saved: 200000, deadline: '2027-04-01' }, '2026-10-07');
  assert.equal(plan.monthsLeft, 6);
  assert.equal(plan.perMonth, 166667);
  assert.equal(goalPlan({ target: 100, saved: 150, deadline: null }, '2026-10-07').left, 0);
  assert.equal(roundUpNice(438000), 440000);
  assert.equal(roundUpNice(1234000), 1300000);
  assert.equal(roundUpNice(0), 0);
});

test('datos de ejemplo: consistentes y sin pagos recurrentes pendientes', () => {
  const today = '2026-10-07';
  const data = createSampleData({ currency: 'MXN', today });
  assert.ok(data.transactions.length > 80);
  assert.ok(data.transactions.every((t) => t.date <= today && t.amount > 0));
  assert.ok(data.recurring.every((r) => r.nextDate > today));
  assert.equal(dueRecurring(data.recurring, today, () => 'x').created.length, 0);
  const ids = new Set(data.accounts.map((a) => a.id));
  assert.ok(data.transactions.every((t) => ids.has(t.accountId) && (!t.toAccountId || ids.has(t.toAccountId))));
  const cats = new Set(data.categories.map((c) => c.id));
  assert.ok(Object.keys(data.budgets).every((id) => cats.has(id)));
});

test('respaldo: migrate valida y completa campos', () => {
  assert.throws(() => migrate({ hola: 1 }));
  const data = migrate({
    settings: { currency: 'EUR' },
    accounts: [{ id: 'a', name: 'Banco', initial: '1500' }],
    categories: [],
    transactions: [
      { id: 't', type: 'expense', amount: -250, date: '2026-10-01', accountId: 'a' },
      { id: 'mal', type: 'expense', amount: 1, date: 'ayer', accountId: 'a' },
    ],
  });
  assert.equal(data.settings.locale, 'es-ES');
  assert.equal(data.accounts[0].initial, 1500);
  assert.equal(data.transactions.length, 1);
  assert.equal(data.transactions[0].amount, 250);
  assert.deepEqual(data.goals, []);
});

test('CSV: gastos en negativo y texto entre comillas', () => {
  configureFormat('es-MX', 'MXN');
  const csv = transactionsCSV({
    categories: [{ id: 'c', name: 'Comida' }],
    accounts: [{ id: 'a', name: 'Banco' }],
    transactions: [tx({ type: 'expense', amount: 12550, date: '2026-10-01', categoryId: 'c', note: 'Tacos "al pastor"' })],
  });
  const line = csv.split('\r\n')[1];
  assert.equal(line, '"2026-10-01","Gasto","-125.50","Comida","Banco","","Tacos ""al pastor"""');
});
