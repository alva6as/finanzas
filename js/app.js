// Punto de entrada: estado de la interfaz, navegación entre pestañas, acciones y guardado.
import { accountBalances, addMonthsYM, dueRecurring, monthOf, nextOccurrence, todayISO } from './calc.js';
import { configureFormat, money, parseAmount } from './format.js';
import {
  backupJSON, clearData, createEmptyData, createSampleData, loadData, localeForCurrency, parseBackup,
  saveData, transactionsCSV, uid,
} from './store.js';
import {
  accountSheet, budgetSheet, categorySheet, contributeSheet, goalSheet, importSheet, onboardingSheet,
  recurringSheet, suggestBudgetSheet, txSheet,
} from './sheets.js';
import { armConfirm, closeSheet, hideToast, icon, openSheet, toast } from './ui.js';
import { renderHome } from './views/home.js';
import { renderTransactions, renderTxResults } from './views/transactions.js';
import { renderBudget } from './views/budget.js';
import { renderMore } from './views/more.js';

// La vista previa (fuera de la app instalada) define FINANZAS_PREVIEW antes de cargar este archivo.
const PREVIEW = Boolean(window.FINANZAS_PREVIEW);
const VIEWS = { home: renderHome, tx: renderTransactions, budget: renderBudget, more: renderMore };
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const ui = {
  tab: 'home',
  sub: null,
  ym: monthOf(todayISO()),
  query: '',
  txType: 'all',
  filterCat: null,
  filterAcc: null,
  limit: 150,
};

let data;
let lastToday = todayISO();
let formatKey = '';
let sheetLocked = false;
let undoSnapshot = null;
let pendingImport = null;

function context() {
  const today = todayISO();
  return {
    data,
    ui,
    today,
    cat: new Map(data.categories.map((c) => [c.id, c])),
    acc: new Map(data.accounts.map((a) => [a.id, a])),
    balances: accountBalances(data, today),
    isIOS,
    standalone: standalone || PREVIEW,
  };
}

// ---------- Dibujo ----------

function mountShell() {
  const tab = (id, ico, label) =>
    `<button data-action="tab" data-tab="${id}">${icon(ico)}<span>${label}</span></button>`;
  document.getElementById('app').innerHTML = `
    <div class="status-shield" aria-hidden="true"></div>
    <main id="view" class="view"></main>
    <nav class="tabbar" aria-label="Secciones">
      ${tab('home', 'home', 'Inicio')}
      ${tab('tx', 'list', 'Movimientos')}
      <button class="tab-add" data-action="new-tx" aria-label="Agregar movimiento"><span>${icon('plus')}</span></button>
      ${tab('budget', 'budget', 'Presupuesto')}
      ${tab('more', 'more', 'Más')}
    </nav>
    <div id="sheet-root" hidden></div>
    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>`;
}

function render() {
  const key = `${data.settings.locale}|${data.settings.currency}`;
  if (key !== formatKey) {
    configureFormat(data.settings.locale, data.settings.currency);
    formatKey = key;
  }
  document.getElementById('view').innerHTML = VIEWS[ui.tab](context());
  for (const b of document.querySelectorAll('.tabbar [data-tab]')) {
    const on = b.dataset.tab === ui.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
}

function rerenderResults() {
  const box = document.getElementById('tx-results');
  if (box) box.innerHTML = renderTxResults(context());
}

const toTop = () => window.scrollTo(0, 0);

function applyTheme() {
  const t = data.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else if (!PREVIEW) delete document.documentElement.dataset.theme;
}

// ---------- Guardado ----------

function persist() {
  if (!saveData(data)) toast('No se pudo guardar en este dispositivo. Libera espacio y haz un respaldo.', { error: true });
}

function commit(mutate, { message = '', undo = false } = {}) {
  const snapshot = undo ? JSON.stringify(data) : null;
  mutate(data);
  persist();
  render();
  if (message) {
    undoSnapshot = snapshot;
    toast(message, { undo: Boolean(snapshot) });
  }
}

function runRecurring() {
  const { created, recurring } = dueRecurring(data.recurring, todayISO(), uid);
  if (!created.length) return 0;
  data.recurring = recurring;
  data.transactions.push(...created);
  persist();
  toast(created.length === 1 ? `Se registró “${created[0].note}”` : `Se registraron ${created.length} pagos recurrentes`);
  return created.length;
}

// ---------- Hoja inferior ----------

function showSheet(html, { locked = false } = {}) {
  sheetLocked = locked;
  const sheet = openSheet(html);
  const form = sheet.querySelector('form');
  if (form && (form.dataset.form === 'tx' || form.dataset.form === 'recurring')) syncTypeFields(form);
  sheet.querySelectorAll('.amount-row input').forEach(fitAmount);
  // Enfocar dentro del mismo toque para que iOS abra el teclado.
  sheet.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
}

function hideSheet() {
  sheetLocked = false;
  closeSheet();
}

// El campo de monto crece con lo escrito para que el símbolo quede pegado a la cifra.
function fitAmount(input) {
  input.style.width = `${Math.max(1, input.value.length || input.placeholder.length) + 0.6}ch`;
}

function syncTypeFields(form) {
  const type = form.querySelector('[name=type]:checked')?.value;
  for (const el of form.querySelectorAll('[data-show]')) el.hidden = !el.dataset.show.split(' ').includes(type);
  const label = form.querySelector('[data-account-label]');
  if (label) label.textContent = type === 'transfer' ? 'Desde' : 'Cuenta';
}

function formError(form, message, field) {
  const p = form.querySelector('.form-error');
  if (p) {
    p.textContent = message;
    p.hidden = false;
  } else {
    toast(message, { error: true });
  }
  const input = field && form.querySelector(`[name="${field}"]`);
  if (input) {
    input.focus();
    input.closest('.amount-input, .field')?.classList.add('shake');
    setTimeout(() => input.closest('.shake')?.classList.remove('shake'), 400);
  }
}

const findIn = (list, id) => list.find((x) => x.id === id);
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------- Archivos ----------

async function shareFile(filename, mime, text) {
  if (PREVIEW) {
    toast('En la vista previa no se pueden guardar archivos. Funciona en la app instalada.', { error: true });
    return false;
  }
  const file = new File([text], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function handleImportFile(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    pendingImport = parseBackup(await file.text());
    showSheet(importSheet(context(), pendingImport));
  } catch (e) {
    toast(e.message || 'No se pudo leer el archivo.', { error: true });
  }
}

// ---------- Acciones (data-action) ----------

const actions = {
  tab(el) {
    const tab = el.dataset.tab;
    if (tab === ui.tab && !ui.sub) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    ui.tab = tab;
    ui.sub = null;
    render();
    toTop();
  },
  go(el) {
    hideSheet();
    ui.tab = el.dataset.tab;
    ui.sub = el.dataset.sub || null;
    render();
    toTop();
  },
  back() {
    ui.sub = null;
    render();
    toTop();
  },
  month(el) {
    ui.ym = addMonthsYM(ui.ym, Number(el.dataset.delta));
    ui.limit = 150;
    render();
  },
  'month-today'() {
    ui.ym = monthOf(todayISO());
    render();
  },
  'tx-type'(el) {
    ui.txType = el.dataset.type;
    render();
  },
  'clear-filter'(el) {
    ui[el.dataset.key] = null;
    render();
  },
  'filter-cat'(el) {
    Object.assign(ui, { tab: 'tx', sub: null, filterCat: el.dataset.id, filterAcc: null, txType: 'all', query: '' });
    render();
    toTop();
  },
  'filter-acc'(el) {
    hideSheet();
    Object.assign(ui, { tab: 'tx', sub: null, filterAcc: el.dataset.id, filterCat: null, txType: 'all', query: '' });
    render();
    toTop();
  },
  'more-tx'() {
    ui.limit += 150;
    rerenderResults();
  },

  'new-tx'() {
    if (!data.accounts.length) {
      toast('Primero agrega una cuenta.', { error: true });
      Object.assign(ui, { tab: 'more', sub: 'accounts' });
      render();
      return;
    }
    showSheet(txSheet(context()));
  },
  'edit-tx'(el) {
    const tx = findIn(data.transactions, el.dataset.id);
    if (tx) showSheet(txSheet(context(), tx));
  },
  'delete-tx'(el) {
    hideSheet();
    commit((d) => { d.transactions = d.transactions.filter((t) => t.id !== el.dataset.id); }, { message: 'Movimiento eliminado', undo: true });
  },

  'new-account'() {
    showSheet(accountSheet(context()));
  },
  'edit-account'(el) {
    const a = findIn(data.accounts, el.dataset.id);
    if (a) showSheet(accountSheet(context(), a));
  },
  'delete-account'(el) {
    const id = el.dataset.id;
    hideSheet();
    commit((d) => {
      d.accounts = d.accounts.filter((a) => a.id !== id);
      d.transactions = d.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id);
      d.recurring = d.recurring.filter((r) => r.accountId !== id && r.toAccountId !== id);
    }, { message: 'Cuenta eliminada', undo: true });
  },

  'new-category'() {
    showSheet(categorySheet(context()));
  },
  'edit-category'(el) {
    const c = findIn(data.categories, el.dataset.id);
    if (c) showSheet(categorySheet(context(), c));
  },
  'delete-category'(el) {
    const id = el.dataset.id;
    hideSheet();
    commit((d) => {
      d.categories = d.categories.filter((c) => c.id !== id);
      for (const t of d.transactions) if (t.categoryId === id) t.categoryId = null;
      for (const r of d.recurring) if (r.categoryId === id) r.categoryId = null;
      delete d.budgets[id];
    }, { message: 'Categoría eliminada', undo: true });
  },
  'pick-emoji'(el) {
    const input = el.closest('form')?.querySelector('[name=emoji]');
    if (input) input.value = el.dataset.emoji;
  },

  'edit-budget'(el) {
    const c = findIn(data.categories, el.dataset.id);
    if (c) showSheet(budgetSheet(context(), c));
  },
  'remove-budget'(el) {
    hideSheet();
    commit((d) => { delete d.budgets[el.dataset.id]; }, { message: 'Presupuesto quitado', undo: true });
  },
  'suggest-budget'() {
    showSheet(suggestBudgetSheet(context()));
  },
  'use-amount'(el) {
    const input = el.closest('form')?.querySelector('[name=amount]');
    if (!input) return;
    input.value = el.dataset.value;
    fitAmount(input);
  },

  'new-goal'() {
    showSheet(goalSheet(context()));
  },
  'edit-goal'(el) {
    const g = findIn(data.goals, el.dataset.id);
    if (g) showSheet(goalSheet(context(), g));
  },
  'delete-goal'(el) {
    hideSheet();
    commit((d) => { d.goals = d.goals.filter((g) => g.id !== el.dataset.id); }, { message: 'Meta eliminada', undo: true });
  },
  contribute(el) {
    const g = findIn(data.goals, el.dataset.id);
    if (g) showSheet(contributeSheet(context(), g));
  },

  'new-recurring'() {
    if (!data.accounts.length) return toast('Primero agrega una cuenta.', { error: true });
    showSheet(recurringSheet(context()));
  },
  'edit-recurring'(el) {
    const r = findIn(data.recurring, el.dataset.id);
    if (r) showSheet(recurringSheet(context(), r));
  },
  'delete-recurring'(el) {
    hideSheet();
    commit((d) => { d.recurring = d.recurring.filter((r) => r.id !== el.dataset.id); }, { message: 'Pago recurrente eliminado', undo: true });
  },

  theme(el) {
    commit((d) => { d.settings.theme = el.dataset.theme; });
    applyTheme();
  },
  async 'export-json'() {
    const ok = await shareFile(`finanzas-respaldo-${todayISO()}.json`, 'application/json', backupJSON(data));
    if (ok) commit((d) => { d.meta.lastBackup = Date.now(); }, { message: 'Respaldo listo' });
  },
  'export-csv'() {
    shareFile(`finanzas-movimientos-${todayISO()}.csv`, 'text/csv', transactionsCSV(data));
  },
  'import-json'() {
    document.getElementById('import-file')?.click();
  },
  'reset-data'() {
    const { currency, name } = data.settings;
    const wasSample = data.meta.sample;
    clearData();
    data = createEmptyData({ currency, name });
    data.meta.onboarded = true;
    persist();
    Object.assign(ui, { tab: 'more', sub: 'accounts', ym: monthOf(todayISO()), query: '', filterCat: null, filterAcc: null, txType: 'all' });
    render();
    toTop();
    toast(wasSample ? 'Listo. Empieza poniendo el saldo real de tus cuentas.' : 'Se borraron todos los datos.');
  },
  'load-sample'() {
    data = createSampleData({ currency: data.settings.currency, name: data.settings.name });
    persist();
    Object.assign(ui, { tab: 'home', sub: null });
    render();
    toTop();
  },
  'close-sheet'() {
    if (!sheetLocked) hideSheet();
  },
  undo() {
    if (!undoSnapshot) return;
    data = JSON.parse(undoSnapshot);
    undoSnapshot = null;
    persist();
    render();
    hideToast();
  },
};

// ---------- Formularios (data-form) ----------

const forms = {
  tx(form) {
    const f = new FormData(form);
    const type = f.get('type');
    const amount = parseAmount(f.get('amount'));
    if (!(amount > 0)) return formError(form, 'Escribe un monto mayor a cero.', 'amount');
    const accountId = f.get('accountId');
    const toAccountId = type === 'transfer' ? f.get('toAccountId') : null;
    if (type === 'transfer' && accountId === toAccountId) return formError(form, 'Elige dos cuentas distintas.', 'toAccountId');
    const date = String(f.get('date') || '');
    if (!isISODate(date)) return formError(form, 'Elige una fecha.', 'date');
    const categoryId = type === 'transfer' ? null : f.get(`cat_${type}`) || null;
    const note = String(f.get('note') || '').trim();
    const repeat = f.get('repeat');
    const id = form.dataset.id;
    hideSheet();
    commit((d) => {
      d.settings.lastAccountId = accountId;
      const fields = { type, amount, accountId, toAccountId, categoryId, date, note };
      if (id) {
        Object.assign(findIn(d.transactions, id), fields);
        return;
      }
      const tx = { id: uid(), created: Date.now(), ...fields };
      if (repeat) {
        const anchorDay = Number(date.slice(8));
        const name = note || d.categories.find((c) => c.id === categoryId)?.name || (type === 'transfer' ? 'Transferencia' : 'Pago');
        const r = { id: uid(), name, type, amount, accountId, toAccountId, categoryId, frequency: repeat, anchorDay, nextDate: nextOccurrence(date, repeat, anchorDay), active: true };
        d.recurring.push(r);
        tx.recurringId = r.id;
        if (!note) tx.note = name;
      }
      d.transactions.push(tx);
    }, { message: id ? 'Movimiento actualizado' : `${type === 'income' ? 'Ingreso' : type === 'transfer' ? 'Transferencia' : 'Gasto'} de ${money(amount)} guardado`, undo: !id });
    if (repeat && runRecurring()) render();
  },

  account(form) {
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim();
    if (!name) return formError(form, 'Ponle un nombre a la cuenta.', 'name');
    const type = f.get('type');
    const raw = String(f.get('balance') || '').trim();
    const entered = raw ? parseAmount(raw) : 0;
    if (Number.isNaN(entered)) return formError(form, 'Revisa el saldo.', 'balance');
    const desired = type === 'credit' ? -Math.abs(entered) : entered;
    const id = form.dataset.id;
    const current = id ? context().balances[id] || 0 : 0;
    hideSheet();
    commit((d) => {
      if (id) {
        const a = findIn(d.accounts, id);
        Object.assign(a, { name, type, initial: (a.initial || 0) + desired - current });
      } else {
        d.accounts.push({ id: uid(), name, type, initial: desired, created: Date.now() });
      }
    }, { message: id ? 'Cuenta actualizada' : 'Cuenta creada' });
  },

  category(form) {
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim();
    if (!name) return formError(form, 'Ponle un nombre a la categoría.', 'name');
    const fields = { name, emoji: String(f.get('emoji') || '').trim() || '📦', color: f.get('color') || '#7D8597' };
    const id = form.dataset.id;
    hideSheet();
    commit((d) => {
      if (id) Object.assign(findIn(d.categories, id), fields);
      else d.categories.push({ id: uid(), kind: f.get('kind') || 'expense', ...fields });
    }, { message: id ? 'Categoría actualizada' : 'Categoría creada' });
  },

  budget(form) {
    const raw = String(new FormData(form).get('amount') || '').trim();
    const amount = raw ? parseAmount(raw) : 0;
    if (Number.isNaN(amount) || amount < 0) return formError(form, 'Revisa el monto.', 'amount');
    const id = form.dataset.id;
    hideSheet();
    commit((d) => {
      if (amount > 0) d.budgets[id] = amount;
      else delete d.budgets[id];
    }, { message: amount > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado' });
  },

  suggest(form) {
    const picked = [...form.querySelectorAll('[name=cat]:checked')];
    hideSheet();
    commit((d) => {
      for (const el of picked) d.budgets[el.value] = Number(el.dataset.amount);
    }, { message: `Presupuesto aplicado a ${picked.length} categorías`, undo: true });
  },

  goal(form) {
    const f = new FormData(form);
    const name = String(f.get('name') || '').trim();
    if (!name) return formError(form, 'Ponle un nombre a la meta.', 'name');
    const target = parseAmount(f.get('target'));
    if (!(target > 0)) return formError(form, '¿Cuánto quieres juntar?', 'target');
    const savedRaw = String(f.get('saved') || '').trim();
    const saved = savedRaw ? parseAmount(savedRaw) : 0;
    if (Number.isNaN(saved) || saved < 0) return formError(form, 'Revisa lo que llevas ahorrado.', 'saved');
    const deadline = isISODate(String(f.get('deadline'))) ? f.get('deadline') : null;
    const fields = { name, target, deadline, emoji: String(f.get('emoji') || '').trim() || '🎯', color: f.get('color') || '#2A9D8F' };
    const id = form.dataset.id;
    hideSheet();
    commit((d) => {
      if (id) Object.assign(findIn(d.goals, id), fields);
      else d.goals.push({ id: uid(), saved, history: saved ? [{ date: todayISO(), amount: saved }] : [], created: Date.now(), ...fields });
    }, { message: id ? 'Meta actualizada' : 'Meta creada' });
  },

  contribute(form) {
    const f = new FormData(form);
    const amount = parseAmount(f.get('amount'));
    if (!(amount > 0)) return formError(form, 'Escribe un monto mayor a cero.', 'amount');
    const delta = f.get('direction') === 'out' ? -amount : amount;
    const id = form.dataset.id;
    hideSheet();
    commit((d) => {
      const g = findIn(d.goals, id);
      g.saved = Math.max(0, g.saved + delta);
      (g.history ||= []).push({ date: todayISO(), amount: delta });
    }, { message: delta > 0 ? `Aportaste ${money(amount)}` : `Retiraste ${money(amount)}`, undo: true });
  },

  recurring(form) {
    const f = new FormData(form);
    const type = f.get('type');
    const amount = parseAmount(f.get('amount'));
    if (!(amount > 0)) return formError(form, 'Escribe un monto mayor a cero.', 'amount');
    const categoryId = type === 'transfer' ? null : f.get(`cat_${type}`) || null;
    const name = String(f.get('name') || '').trim() || data.categories.find((c) => c.id === categoryId)?.name;
    if (!name) return formError(form, 'Ponle un nombre, por ejemplo “Netflix”.', 'name');
    const accountId = f.get('accountId');
    const toAccountId = type === 'transfer' ? f.get('toAccountId') : null;
    if (type === 'transfer' && accountId === toAccountId) return formError(form, 'Elige dos cuentas distintas.', 'toAccountId');
    const nextDate = String(f.get('nextDate') || '');
    if (!isISODate(nextDate)) return formError(form, 'Elige la fecha del próximo pago.', 'nextDate');
    const id = form.dataset.id;
    const fields = {
      name, type, amount, categoryId, accountId, toAccountId, nextDate,
      frequency: f.get('frequency'), anchorDay: Number(nextDate.slice(8)),
      active: id ? f.get('active') === 'on' : true,
    };
    hideSheet();
    commit((d) => {
      if (id) Object.assign(findIn(d.recurring, id), fields);
      else d.recurring.push({ id: uid(), ...fields });
    }, { message: id ? 'Pago recurrente actualizado' : 'Pago recurrente creado' });
    if (runRecurring()) render();
  },

  onboarding(form, submitter) {
    const f = new FormData(form);
    const currency = f.get('currency');
    const name = String(f.get('name') || '').trim();
    if (submitter?.value === 'sample') {
      data = createSampleData({ currency, name });
    } else {
      Object.assign(data.settings, { currency, name, locale: localeForCurrency(currency) });
      data.meta.onboarded = true;
    }
    persist();
    hideSheet();
    render();
    if (submitter?.value !== 'sample') toast('Listo. Toca + para registrar tu primer gasto.');
  },

  import() {
    if (!pendingImport) return;
    data = pendingImport;
    data.meta.onboarded = true;
    pendingImport = null;
    persist();
    applyTheme();
    hideSheet();
    Object.assign(ui, { tab: 'home', sub: null, ym: monthOf(todayISO()), filterCat: null, filterAcc: null, query: '' });
    runRecurring();
    render();
    toTop();
    toast('Respaldo restaurado');
  },
};

// ---------- Cambios en ajustes (data-change) ----------

const changes = {
  name(el) {
    commit((d) => { d.settings.name = el.value.trim(); });
  },
  currency(el) {
    commit((d) => {
      d.settings.currency = el.value;
      d.settings.locale = localeForCurrency(el.value);
    }, { message: 'Moneda actualizada' });
  },
};

// ---------- Eventos ----------

function bindEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    if (el.dataset.confirm && !armConfirm(el)) return;
    fn(el, e);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    forms[form.dataset.form]?.(form, e.submitter);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'import-file') return handleImportFile(el);
    if (el.dataset.change) return changes[el.dataset.change]?.(el);
    const form = el.closest('form[data-form]');
    if (!form) return;
    if (el.name === 'type' && (form.dataset.form === 'tx' || form.dataset.form === 'recurring')) syncTypeFields(form);
    if (el.name === 'type' && form.dataset.form === 'account') {
      form.querySelector('.amount-label').textContent = el.value === 'credit' ? 'Deuda actual' : 'Saldo actual';
    }
    form.querySelector('.form-error')?.setAttribute('hidden', '');
  });

  document.addEventListener('input', (e) => {
    if (e.target.matches('.amount-row input')) fitAmount(e.target);
    if (e.target.dataset.input === 'search') {
      ui.query = e.target.value;
      ui.limit = 150;
      rerenderResults();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheetLocked) hideSheet();
  });

  // Si la app quedó abierta de un día para otro, registra los pagos del día al volver.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const today = todayISO();
    if (today === lastToday) return;
    if (ui.ym === monthOf(lastToday)) ui.ym = monthOf(today);
    lastToday = today;
    runRecurring();
    render();
  });
}

function registerServiceWorker() {
  if (PREVIEW || !('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function boot() {
  if (PREVIEW) document.documentElement.classList.add('embedded');
  data = loadData();
  let firstRun = false;
  if (!data && PREVIEW) {
    data = createSampleData();
    persist();
  }
  if (!data) {
    data = createEmptyData();
    firstRun = true;
  }
  applyTheme();
  mountShell();
  bindEvents();
  render();
  if (firstRun || !data.meta.onboarded) showSheet(onboardingSheet(context()), { locked: true });
  else if (runRecurring()) render();
  registerServiceWorker();
  navigator.storage?.persist?.().catch(() => {});
}

boot();
