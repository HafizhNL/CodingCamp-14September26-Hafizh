// Konstanta aplikasi

const CATEGORIES = ['Food', 'Transport', 'Fun'];

// Status penyimpanan data
let storageUnavailable = false;

let storageCorrupt = false;

// Penyimpanan localStorage

const STORAGE_KEY = 'ebv_transactions';

const THEME_STORAGE_KEY = 'ebv_theme';

const SORT_KEY = 'ebv_sort';

const SORT_OPTIONS = [
  'timestamp-desc',
  'amount-asc',
  'amount-desc',
  'category-asc',
  'category-desc',
];

const StorageModule = {
  load() {
    let raw;

    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageUnavailable = true;
      return [];
    }

    if (raw === null) {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      storageCorrupt = true;
      return [];
    }

    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      storageCorrupt = true;
      return [];
    }

    return parsed;
  },

  save(transactions) {
    const serialized = JSON.stringify(transactions);
    localStorage.setItem(STORAGE_KEY, serialized);
  },
};

// Validasi input form

const ValidatorModule = {
  validateName(name) {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Item name is required.' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Item name must be 100 characters or fewer.' };
    }
    return { valid: true };
  },

  validateAmount(raw) {
    if (raw === '' || raw === null || raw === undefined) {
      return { valid: false, error: 'Amount is required.' };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return { valid: false, error: 'Amount must be a valid number.' };
    }
    if (parsed < 0.01) {
      return { valid: false, error: 'Amount must be at least 0.01.' };
    }
    if (parsed > 999999999.99) {
      return { valid: false, error: 'Amount must not exceed 999,999,999.99.' };
    }
    return { valid: true };
  },

  validateCategory(category) {
    if (!CATEGORIES.includes(category)) {
      return { valid: false, error: 'Please select a valid category (Food, Transport, or Fun).' };
    }
    return { valid: true };
  },

  validateForm(name, amount, category) {
    const errors = {};

    const nameResult = this.validateName(name);
    if (!nameResult.valid) {
      errors.name = nameResult.error;
    }

    const amountResult = this.validateAmount(amount);
    if (!amountResult.valid) {
      errors.amount = amountResult.error;
    }

    const categoryResult = this.validateCategory(category);
    if (!categoryResult.valid) {
      errors.category = categoryResult.error;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

// State aplikasi

let transactions = [];

let chart = null;

// Pengelola transaksi

const TransactionManager = {
  load() {
    transactions = StorageModule.load();
  },

  getAll() {
    return [...transactions];
  },

  getTotal() {
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  },

  getByCategory() {
    const totals = {};

    for (const t of transactions) {
      if (totals[t.category] === undefined) {
        totals[t.category] = 0;
      }
      totals[t.category] += t.amount;
    }

    for (const cat of Object.keys(totals)) {
      if (totals[cat] === 0) {
        delete totals[cat];
      }
    }

    return totals;
  },

  add(name, amount, category) {
    /** @type {Transaction} */
    const transaction = {
      id: crypto.randomUUID(),
      name,
      amount,
      category,
      timestamp: Date.now(),
    };

    transactions.push(transaction);
    StorageModule.save(transactions);

    return transaction;
  },

  delete(id) {
    const backup = [...transactions];

    transactions = transactions.filter(t => t.id !== id);

    try {
      StorageModule.save(transactions);
    } catch (e) {
      transactions = backup;
      renderAll();
      showBanner('Failed to save. The transaction has been restored.', 'error');
      return;
    }

    renderAll();
  },
};

// Renderer tampilan

function formatBalance(total) {
  return '$' + total.toFixed(2);
}

function renderBalance() {
  const el = document.getElementById('balance-display');
  if (!el) return;
  el.textContent = formatBalance(TransactionManager.getTotal());
}

// Daftar transaksi

function getActiveSortOption() {
  const select = document.getElementById('sort-control');
  const value = select ? select.value : '';
  return SORT_OPTIONS.includes(value) ? value : 'timestamp-desc';
}

function sortTransactions(txns, sortBy) {
  const copy = [...txns];

  copy.sort((a, b) => {
    let primary = 0;

    switch (sortBy) {
      case 'amount-asc':
        primary = a.amount - b.amount;
        break;
      case 'amount-desc':
        primary = b.amount - a.amount;
        break;
      case 'category-asc':
        primary = a.category.localeCompare(b.category);
        break;
      case 'category-desc':
        primary = b.category.localeCompare(a.category);
        break;
      case 'timestamp-desc':
      default:
        primary = b.timestamp - a.timestamp;
        break;
    }

    if (primary !== 0) return primary;
    return b.timestamp - a.timestamp;
  });

  return copy;
}

function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  const all = sortTransactions(TransactionManager.getAll(), getActiveSortOption());

  if (all.length === 0) {
    list.innerHTML = '<li class="transaction-list__empty">No transactions yet</li>';
    return;
  }

  list.innerHTML = '';

  for (let i = 0; i < all.length; i++) {
    const t = all[i];

    const item = document.createElement('li');
    item.className = 'transaction-item';

    const nameCell = document.createElement('span');
    nameCell.className = 'transaction-item__name transaction-name';
    nameCell.textContent = t.name;
    nameCell.title = t.name; // shows full name on hover when truncated

    const amountCell = document.createElement('span');
    amountCell.className = 'transaction-item__amount';
    amountCell.textContent = t.amount.toFixed(2);

    const categoryCell = document.createElement('span');
    categoryCell.className = 'transaction-item__category';
    categoryCell.textContent = t.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'transaction-item__delete';
    deleteBtn.dataset.id = t.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${t.name}`);

    deleteBtn.addEventListener('click', () => {
      const confirmed = confirm(`Delete "${t.name}"?`);
      if (!confirmed) return;
      TransactionManager.delete(t.id);
    });

    item.appendChild(nameCell);
    item.appendChild(amountCell);
    item.appendChild(categoryCell);
    item.appendChild(deleteBtn);

    list.appendChild(item);
  }
}

// Chart pengeluaran

function renderChart() {
  const canvas = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty-message');

  if (typeof window.Chart === 'undefined') {
    const container = canvas ? canvas.parentElement : document.querySelector('.chart-container');
    if (container) {
      container.innerHTML = '<p class="chart-error-message">Chart unavailable — unable to load charting library.</p>';
    }
    return;
  }

  const byCategory = TransactionManager.getByCategory();
  const categories = Object.keys(byCategory);
  const hasData = categories.length > 0;

  if (!hasData) {
    if (canvas) canvas.style.display = 'none';
    if (emptyMsg) emptyMsg.style.display = '';

    if (chart !== null) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    }
    return;
  }

  if (canvas) canvas.style.display = '';
  if (emptyMsg) emptyMsg.style.display = 'none';

  const grandTotal = categories.reduce((sum, cat) => sum + byCategory[cat], 0);

  const labels = categories.map(cat => {
    const pct = ((byCategory[cat] / grandTotal) * 100).toFixed(1);
    return `${cat} ${pct}%`;
  });

  const data = categories.map(cat => byCategory[cat]);

  const CATEGORY_COLORS = {
    Food: '#4f86c6',
    Transport: '#f4a261',
    Fun: '#57cc99',
  };
  const backgroundColors = categories.map(cat => CATEGORY_COLORS[cat] || '#aaa');

  if (chart === null) {
    chart = new Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: backgroundColors,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed;
                return ` $${value.toFixed(2)}`;
              },
            },
          },
        },
      },
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.update();
  }
}

// Ringkasan bulanan

function renderMonthlySummary() {
  const section = document.getElementById('monthly-summary');
  if (!section) return;

  let list = section.querySelector('.monthly-summary__list');
  if (!list) {
    list = document.createElement('ul');
    list.className = 'monthly-summary__list';
    list.setAttribute('aria-label', 'Monthly spending summary');
    section.appendChild(list);
  }

  const all = TransactionManager.getAll();

  if (all.length === 0) {
    list.innerHTML = '<li class="monthly-summary__empty">No monthly data available</li>';
    return;
  }

  const monthTotals = {};

  for (const t of all) {
    const date  = new Date(t.timestamp);
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key   = `${year}-${month}`;

    if (monthTotals[key] === undefined) {
      monthTotals[key] = 0;
    }
    monthTotals[key] += t.amount;
  }

  const sortedKeys = Object.keys(monthTotals).sort((a, b) => b.localeCompare(a));

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  list.innerHTML = '';

  for (const key of sortedKeys) {
    const [year, monthIdx] = key.split('-');
    const monthName = MONTH_NAMES[parseInt(monthIdx, 10) - 1];
    const label = `${monthName} ${year}`;
    const total = monthTotals[key];

    const item = document.createElement('li');
    item.className = 'monthly-summary__item';

    const labelEl = document.createElement('span');
    labelEl.className = 'monthly-summary__label';
    labelEl.textContent = label;

    const totalEl = document.createElement('span');
    totalEl.className = 'monthly-summary__total';
    totalEl.textContent = formatBalance(total);

    item.appendChild(labelEl);
    item.appendChild(totalEl);
    list.appendChild(item);
  }
}

// Render semua tampilan
function renderAll() {
  if (typeof renderTransactionList === 'function') renderTransactionList();
  if (typeof renderBalance === 'function') renderBalance();
  if (typeof renderChart === 'function') renderChart();
  if (typeof renderMonthlySummary === 'function') renderMonthlySummary();
}

// Banner notifikasi

function showBanner(message, type = 'error') {
  const existingId = `banner-${type}`;
  const existing = document.getElementById(existingId);
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = existingId;
  banner.className = `banner banner--${type}`;
  banner.setAttribute('role', 'alert');

  const text = document.createElement('span');
  text.textContent = message;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'banner__dismiss';
  dismiss.textContent = '✕';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(dismiss);

  document.body.insertAdjacentElement('afterbegin', banner);
}

// Kontrol mode terang/gelap

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
  }

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    if (theme === 'dark') {
      btn.textContent = '☀️ Light';
      btn.setAttribute('aria-label', 'Switch to light mode');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.textContent = '🌙 Dark';
      btn.setAttribute('aria-label', 'Switch to dark mode');
      btn.setAttribute('aria-pressed', 'false');
    }
  }
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (e) {
  }
  const theme = stored === 'dark' ? 'dark' : 'light';
  applyTheme(theme);
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';

    applyTheme(next);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (e) {
    }
  });
}

// Form transaksi

const FormController = {
  init() {
    const form = document.getElementById('transaction-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('item-amount');
      const categoryInput = document.getElementById('item-category');

      const name     = nameInput     ? nameInput.value     : '';
      const amount   = amountInput   ? amountInput.value   : '';
      const category = categoryInput ? categoryInput.value : '';

      const { valid, errors } = ValidatorModule.validateForm(name, amount, category);

      if (!valid) {
        FormController.showErrors(errors);
        return;
      }

      FormController.clearErrors();

      TransactionManager.add(name, Number(amount), category);

      renderAll();

      FormController.reset();
    });
  },

  showErrors(errors) {
    const fieldMap = {
      name:     ['item-name',     'item-name-error'],
      amount:   ['item-amount',   'item-amount-error'],
      category: ['item-category', 'item-category-error'],
    };

    for (const [field, [inputId, errorId]] of Object.entries(fieldMap)) {
      const input = document.getElementById(inputId);
      const errorSpan = document.getElementById(errorId);

      if (errors[field]) {
        if (input)     input.classList.add('is-invalid');
        if (errorSpan) errorSpan.textContent = errors[field];
      } else {
        if (input)     input.classList.remove('is-invalid');
        if (errorSpan) errorSpan.textContent = '';
      }
    }
  },

  clearErrors() {
    const fieldMap = {
      name:     ['item-name',     'item-name-error'],
      amount:   ['item-amount',   'item-amount-error'],
      category: ['item-category', 'item-category-error'],
    };

    for (const [, [inputId, errorId]] of Object.entries(fieldMap)) {
      const input = document.getElementById(inputId);
      const errorSpan = document.getElementById(errorId);

      if (input)     input.classList.remove('is-invalid');
      if (errorSpan) errorSpan.textContent = '';
    }
  },

  reset() {
    const nameInput     = document.getElementById('item-name');
    const amountInput   = document.getElementById('item-amount');
    const categoryInput = document.getElementById('item-category');

    if (nameInput)     nameInput.value     = '';
    if (amountInput)   amountInput.value   = '';
    if (categoryInput) categoryInput.value = '';
  },
};

// Bootstrap aplikasi

document.addEventListener('DOMContentLoaded', () => {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
  } catch (e) {
    storageUnavailable = true;
    showBanner(
      'Warning: Local Storage is unavailable. Your data will not be saved between sessions.',
      'warning'
    );
  }

  TransactionManager.load();

  if (storageCorrupt) {
    showBanner(
      'Saved data was corrupted and could not be loaded. Starting fresh.',
      'error'
    );
  }

  initTheme();
  initThemeToggle();

  renderAll();

  FormController.init();

  // Kontrol pengurutan transaksi
  const sortSelect = document.getElementById('sort-control');
  if (sortSelect) {
    let savedSort = 'timestamp-desc';
    try {
      const stored = localStorage.getItem(SORT_KEY);
      if (stored && SORT_OPTIONS.includes(stored)) {
        savedSort = stored;
      }
    } catch (_) {
    }
    sortSelect.value = savedSort;

    sortSelect.addEventListener('change', () => {
      const chosen = sortSelect.value;
      try {
        localStorage.setItem(SORT_KEY, chosen);
      } catch (_) {
      }
      renderTransactionList();
    });
  }
});
