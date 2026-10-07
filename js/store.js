// Datos de la app: estructura inicial, guardado en el dispositivo, respaldo y datos de ejemplo.
import { addMonthsYM, daysInMonth, monthOf, nextOccurrence, pad, todayISO } from './calc.js';

const KEY = 'finanzas.data.v1';
export const SCHEMA_VERSION = 1;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const ACCOUNT_TYPES = {
  cash: { label: 'Efectivo', emoji: '💵' },
  bank: { label: 'Débito / banco', emoji: '🏦' },
  credit: { label: 'Tarjeta de crédito', emoji: '💳' },
  savings: { label: 'Ahorro', emoji: '🐷' },
  investment: { label: 'Inversión', emoji: '📈' },
};

export const COLORS = [
  '#E4572E', '#F29E4C', '#E9C46A', '#6A994E', '#2A9D8F', '#3A86FF',
  '#5E60CE', '#9B5DE5', '#F15BB5', '#B5838D', '#8D6E63', '#7D8597',
];

export const EMOJI_SUGGESTIONS = [
  '🛒', '🍽️', '☕', '🏠', '💡', '📱', '🚗', '⛽', '🚌', '🩺', '💊', '🎬', '📺', '🎮', '🛍️', '👕',
  '📚', '✈️', '🎁', '🐾', '👶', '💇', '🏋️', '🍺', '🔧', '💼', '🧾', '📈', '💰', '↩️', '🛟', '📦',
];

// Moneda → idioma para formatear números (separadores, símbolo).
export const CURRENCIES = [
  ['MXN', 'Peso mexicano', 'es-MX'],
  ['USD', 'Dólar estadounidense', 'es-US'],
  ['EUR', 'Euro', 'es-ES'],
  ['COP', 'Peso colombiano', 'es-CO'],
  ['ARS', 'Peso argentino', 'es-AR'],
  ['CLP', 'Peso chileno', 'es-CL'],
  ['PEN', 'Sol peruano', 'es-PE'],
  ['UYU', 'Peso uruguayo', 'es-UY'],
  ['BOB', 'Boliviano', 'es-BO'],
  ['PYG', 'Guaraní', 'es-PY'],
  ['GTQ', 'Quetzal', 'es-GT'],
  ['HNL', 'Lempira', 'es-HN'],
  ['NIO', 'Córdoba', 'es-NI'],
  ['CRC', 'Colón costarricense', 'es-CR'],
  ['DOP', 'Peso dominicano', 'es-DO'],
  ['VES', 'Bolívar', 'es-VE'],
  ['CAD', 'Dólar canadiense', 'es-US'],
  ['GBP', 'Libra esterlina', 'es-US'],
  ['BRL', 'Real brasileño', 'es-US'],
];

const REGION_CURRENCY = {
  MX: 'MXN', US: 'USD', ES: 'EUR', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN', UY: 'UYU', BO: 'BOB',
  PY: 'PYG', GT: 'GTQ', HN: 'HNL', NI: 'NIO', CR: 'CRC', DO: 'DOP', VE: 'VES', EC: 'USD', SV: 'USD',
  PA: 'USD', PR: 'USD', CA: 'CAD', GB: 'GBP', BR: 'BRL',
};

export const localeForCurrency = (code) => CURRENCIES.find((c) => c[0] === code)?.[2] || 'es-US';

export function guessCurrency(languages = globalThis.navigator?.languages || []) {
  for (const lang of languages) {
    const region = lang.split('-')[1]?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return 'MXN';
}

const DEFAULT_CATEGORIES = [
  ['groceries', 'expense', 'Súper y despensa', '🛒'],
  ['dining', 'expense', 'Restaurantes y café', '🍽️'],
  ['housing', 'expense', 'Vivienda', '🏠'],
  ['utilities', 'expense', 'Servicios', '💡'],
  ['transport', 'expense', 'Transporte', '🚗'],
  ['health', 'expense', 'Salud', '🩺'],
  ['subscriptions', 'expense', 'Suscripciones', '📺'],
  ['entertainment', 'expense', 'Entretenimiento', '🎬'],
  ['shopping', 'expense', 'Compras', '🛍️'],
  ['education', 'expense', 'Educación', '📚'],
  ['travel', 'expense', 'Viajes', '✈️'],
  ['gifts', 'expense', 'Regalos', '🎁'],
  ['pets', 'expense', 'Mascotas', '🐾'],
  ['personal', 'expense', 'Cuidado personal', '💇'],
  ['fees', 'expense', 'Comisiones e intereses', '🧾'],
  ['other', 'expense', 'Otros gastos', '📦'],
  ['salary', 'income', 'Salario', '💼'],
  ['business', 'income', 'Negocio y freelance', '🧾'],
  ['investments', 'income', 'Inversiones e intereses', '📈'],
  ['refunds', 'income', 'Reembolsos', '↩️'],
  ['gifts_in', 'income', 'Regalos recibidos', '🎁'],
  ['other_in', 'income', 'Otros ingresos', '💰'],
];

function defaultCategories() {
  let e = 0;
  let i = 4;
  return DEFAULT_CATEGORIES.map(([key, kind, name, emoji]) => ({
    id: `c_${key}`,
    kind,
    name,
    emoji,
    color: COLORS[(kind === 'expense' ? e++ : i++) % COLORS.length],
  }));
}

export function createEmptyData({ currency = guessCurrency(), name = '' } = {}) {
  const now = Date.now();
  return {
    version: SCHEMA_VERSION,
    settings: { currency, locale: localeForCurrency(currency), name, theme: 'auto', lastAccountId: null },
    accounts: [
      { id: 'a_cash', name: 'Efectivo', type: 'cash', initial: 0, created: now },
      { id: 'a_bank', name: 'Cuenta principal', type: 'bank', initial: 0, created: now + 1 },
    ],
    categories: defaultCategories(),
    transactions: [],
    budgets: {},
    goals: [],
    recurring: [],
    meta: { created: now, lastBackup: null, onboarded: false, sample: false },
  };
}

// Completa campos que falten (respaldos viejos o editados a mano).
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no tiene datos de Finanzas.');
  for (const k of ['accounts', 'categories', 'transactions']) {
    if (!Array.isArray(raw[k])) throw new Error('El archivo no tiene datos de Finanzas.');
  }
  const base = createEmptyData({ currency: raw.settings?.currency || 'MXN' });
  const toInt = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  const data = {
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(raw.settings || {}) },
    accounts: raw.accounts.filter((a) => a && a.id).map((a) => ({ type: 'bank', ...a, initial: toInt(a.initial) })),
    categories: raw.categories.filter((c) => c && c.id),
    transactions: raw.transactions
      .filter((t) => t && t.id && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && ['income', 'expense', 'transfer'].includes(t.type))
      .map((t) => ({ ...t, amount: Math.abs(toInt(t.amount)) })),
    budgets: raw.budgets && typeof raw.budgets === 'object' ? raw.budgets : {},
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    recurring: Array.isArray(raw.recurring) ? raw.recurring : [],
    meta: { ...base.meta, ...(raw.meta || {}) },
  };
  data.settings.locale = localeForCurrency(data.settings.currency);
  return data;
}

export function loadData() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada que borrar */
  }
}

export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un respaldo válido (JSON).');
  }
  return migrate(raw);
}

export function backupJSON(data) {
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
}

const TYPE_LABEL = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };

export function transactionsCSV(data) {
  const cat = Object.fromEntries(data.categories.map((c) => [c.id, c.name]));
  const acc = Object.fromEntries(data.accounts.map((a) => [a.id, a.name]));
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Fecha', 'Tipo', 'Monto', 'Categoría', 'Cuenta', 'Cuenta destino', 'Nota']];
  const sorted = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    const signed = t.type === 'expense' ? -t.amount : t.amount;
    rows.push([
      t.date,
      TYPE_LABEL[t.type],
      (signed / 100).toFixed(2),
      cat[t.categoryId] || '',
      acc[t.accountId] || '',
      acc[t.toAccountId] || '',
      t.note || '',
    ]);
  }
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}

// ---------- Datos de ejemplo ----------

// Escala aproximada respecto al peso mexicano para que los montos de ejemplo se vean creíbles.
const SAMPLE_FACTOR = {
  MXN: 1, USD: 0.055, EUR: 0.05, COP: 220, ARS: 55, CLP: 52, PEN: 0.2, UYU: 2.2, BOB: 0.38,
  PYG: 420, GTQ: 0.43, HNL: 1.4, NIO: 2, CRC: 28, DOP: 3.3, VES: 2, CAD: 0.075, GBP: 0.043, BRL: 0.3,
};

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSampleData({ currency = guessCurrency(), name = '', today = todayISO() } = {}) {
  const data = createEmptyData({ currency, name });
  const f = SAMPLE_FACTOR[currency] ?? 0.055;
  const rnd = seeded(7);
  // Montos fijos con 2 cifras significativas; montos variables con centavos cuando la moneda los usa.
  const fixed = (mxn) => {
    const v = mxn * f;
    const step = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / step) * step * 100;
  };
  const variable = (min, max) => {
    const v = (min + rnd() * (max - min)) * f;
    return f < 0.5 ? Math.round(v * 10) * 10 : Math.round(v) * 100;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  data.accounts = [
    { id: 'a_bank', name: 'Cuenta de nómina', type: 'bank', initial: fixed(14000), created: 1 },
    { id: 'a_card', name: 'Tarjeta de crédito', type: 'credit', initial: -fixed(4200), created: 2 },
    { id: 'a_cash', name: 'Efectivo', type: 'cash', initial: fixed(1200), created: 3 },
    { id: 'a_save', name: 'Ahorro', type: 'savings', initial: fixed(22000), created: 4 },
  ];

  const recurring = [
    { name: 'Quincena', type: 'income', amount: fixed(16000), categoryId: 'c_salary', accountId: 'a_bank', day: 15 },
    { name: 'Quincena', type: 'income', amount: fixed(16000), categoryId: 'c_salary', accountId: 'a_bank', day: 30 },
    { name: 'Renta', type: 'expense', amount: fixed(9500), categoryId: 'c_housing', accountId: 'a_bank', day: 1 },
    { name: 'Internet y teléfono', type: 'expense', amount: fixed(650), categoryId: 'c_utilities', accountId: 'a_bank', day: 12 },
    { name: 'Gimnasio', type: 'expense', amount: fixed(690), categoryId: 'c_personal', accountId: 'a_card', day: 3 },
    { name: 'Netflix', type: 'expense', amount: fixed(249), categoryId: 'c_subscriptions', accountId: 'a_card', day: 5 },
    { name: 'Spotify', type: 'expense', amount: fixed(129), categoryId: 'c_subscriptions', accountId: 'a_card', day: 18 },
    { name: 'Ahorro automático', type: 'transfer', amount: fixed(2500), accountId: 'a_bank', toAccountId: 'a_save', day: 16 },
  ];

  const txs = [];
  const cardSpent = {};
  let n = 0;
  const add = (date, t) => {
    if (date > today) return;
    txs.push({ id: `s_${n}`, created: n++, note: '', categoryId: null, toAccountId: null, ...t, date });
    if (t.type === 'expense' && t.accountId === 'a_card') cardSpent[monthOf(date)] = (cardSpent[monthOf(date)] || 0) + t.amount;
  };
  const thisMonth = monthOf(today);

  for (let offset = -3; offset <= 0; offset++) {
    const ym = addMonthsYM(thisMonth, offset);
    const [y, m] = ym.split('-').map(Number);
    const dim = daysInMonth(y, m);
    const day = (d) => `${ym}-${pad(Math.min(d, dim))}`;

    recurring.forEach((r, i) => {
      add(day(r.day), {
        type: r.type, amount: r.amount, accountId: r.accountId, toAccountId: r.toAccountId || null,
        categoryId: r.categoryId || null, note: r.name, recurringId: `r_${i}`,
      });
    });
    add(day(8), { type: 'expense', amount: variable(380, 720), categoryId: 'c_utilities', accountId: 'a_bank', note: 'Luz' });
    // Se paga completo lo que se gastó con la tarjeta el mes anterior.
    const prev = addMonthsYM(ym, -1);
    const payment = cardSpent[prev] ?? -data.accounts[1].initial;
    if (payment > 0) add(day(6), { type: 'transfer', amount: payment, accountId: 'a_bank', toAccountId: 'a_card', note: 'Pago de tarjeta' });
    add(day(10), { type: 'transfer', amount: fixed(1500), accountId: 'a_bank', toAccountId: 'a_cash', note: 'Retiro en cajero' });

    for (let d = 2; d <= dim; d += 4 + Math.floor(rnd() * 3)) {
      add(day(d), { type: 'expense', amount: variable(550, 1450), categoryId: 'c_groceries', accountId: pick(['a_card', 'a_bank']), note: pick(['Supermercado', 'Despensa', 'Mercado']) });
    }
    for (let k = 0; k < 9; k++) {
      add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: variable(70, 620), categoryId: 'c_dining', accountId: pick(['a_card', 'a_cash', 'a_card']), note: pick(['Café', 'Tacos', 'Comida con amigos', 'Pizza', 'Sushi', 'Desayuno']) });
    }
    for (let k = 0; k < 8; k++) {
      const gas = rnd() < 0.3;
      add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: gas ? variable(650, 900) : variable(60, 190), categoryId: 'c_transport', accountId: gas ? 'a_card' : 'a_bank', note: gas ? 'Gasolina' : 'Uber' });
    }
    for (let k = 0; k < 2; k++) {
      add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: variable(220, 640), categoryId: 'c_entertainment', accountId: 'a_card', note: pick(['Cine', 'Concierto', 'Boliche', 'Videojuego']) });
      add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: variable(350, 1600), categoryId: 'c_shopping', accountId: 'a_card', note: pick(['Ropa', 'Tenis', 'Artículos para casa', 'Amazon']) });
    }
    if (rnd() < 0.7) add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: variable(180, 900), categoryId: 'c_health', accountId: 'a_card', note: pick(['Farmacia', 'Consulta médica', 'Dentista']) });
    if (rnd() < 0.5) add(day(1 + Math.floor(rnd() * dim)), { type: 'expense', amount: variable(250, 700), categoryId: 'c_pets', accountId: 'a_card', note: 'Croquetas' });
    if (offset === -2 || offset === 0) add(day(26), { type: 'income', amount: fixed(3800), categoryId: 'c_business', accountId: 'a_bank', note: 'Proyecto freelance' });
  }
  data.transactions = txs;

  data.recurring = recurring.map((r, i) => {
    let next = `${thisMonth}-${pad(Math.min(r.day, daysInMonth(...thisMonth.split('-').map(Number))))}`;
    while (next <= today) next = nextOccurrence(next, 'monthly', r.day);
    return {
      id: `r_${i}`, name: r.name, type: r.type, amount: r.amount, accountId: r.accountId,
      toAccountId: r.toAccountId || null, categoryId: r.categoryId || null,
      frequency: 'monthly', anchorDay: r.day, nextDate: next, active: true,
    };
  });

  data.budgets = {
    c_groceries: fixed(5000), c_dining: fixed(2500), c_housing: fixed(9500), c_utilities: fixed(1300),
    c_transport: fixed(1800), c_subscriptions: fixed(450), c_entertainment: fixed(1000), c_shopping: fixed(2000),
    c_health: fixed(800), c_personal: fixed(700),
  };

  const [ty, tm] = thisMonth.split('-').map(Number);
  data.goals = [
    { id: 'g_1', name: 'Fondo de emergencia', emoji: '🛟', color: COLORS[4], target: fixed(60000), saved: fixed(23500), deadline: null, history: [], created: 1 },
    { id: 'g_2', name: 'Vacaciones en la playa', emoji: '✈️', color: COLORS[5], target: fixed(18000), saved: fixed(6800), deadline: `${addMonthsYM(`${ty}-${pad(tm)}`, 6)}-01`, history: [], created: 2 },
  ];

  data.meta.onboarded = true;
  data.meta.sample = true;
  data.meta.lastBackup = Date.now();
  return data;
}
