/**
 * Expense & Budget Visualizer — app.js
 *
 * All application logic lives here.
 * Architecture: unidirectional data flow
 *   User Action → Event Handler → State Mutation → Re-render
 *
 * Modules:
 *   StorageModule      — localStorage read/write
 *   ValidatorModule    — pure-function input validation
 *   TransactionManager — in-memory state + CRUD coordination
 *   Renderers          — DOM projection functions
 *   FormController     — form submit/reset/error lifecycle
 */

// ---------------------------------------------------------------------------
// Global constants
// ---------------------------------------------------------------------------

/** @type {const} */
const CATEGORIES = ['Food', 'Transport', 'Fun'];

// ---------------------------------------------------------------------------
// Module-level state flags
// ---------------------------------------------------------------------------

/** True when localStorage is inaccessible (e.g. private browsing mode). */
let storageUnavailable = false;

/** True when the data retrieved from localStorage could not be deserialized. */
let storageCorrupt = false;

// ---------------------------------------------------------------------------
// StorageModule — Task 2.1
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
// ---------------------------------------------------------------------------

/** Fixed key used for all localStorage reads and writes. Never changes between sessions. */
const STORAGE_KEY = 'ebv_transactions';

const StorageModule = {
  /**
   * Reads and deserializes the transaction array from localStorage.
   *
   * - Returns [] and sets storageUnavailable = true if localStorage access throws
   *   (e.g. SecurityError in private-browsing mode).
   * - Returns [] and sets storageCorrupt = true if the stored value cannot be
   *   parsed as JSON or is not an array; also removes the corrupted key.
   * - Returns [] (without setting any flag) when the key simply does not exist yet.
   *
   * @returns {Transaction[]}
   */
  load() {
    let raw;

    // Step 1: read from localStorage — may throw SecurityError
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageUnavailable = true;
      return [];
    }

    // Key does not exist yet — clean empty state, no error
    if (raw === null) {
      return [];
    }

    // Step 2: parse JSON — may throw SyntaxError; also validate it is an array
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

  /**
   * Serializes the transaction array and writes it to localStorage.
   *
   * Exceptions (e.g. QuotaExceededError, SecurityError) are intentionally NOT
   * caught here — they propagate to the caller so it can implement rollback.
   *
   * @param {Transaction[]} transactions
   */
  save(transactions) {
    const serialized = JSON.stringify(transactions);
    localStorage.setItem(STORAGE_KEY, serialized);
  },
};

// ---------------------------------------------------------------------------
// ValidatorModule — Task 3.1
// Requirements: 1.4, 1.5
// ---------------------------------------------------------------------------

const ValidatorModule = {
  /**
   * Validates the item name field.
   *
   * - Must not be empty (after trimming).
   * - Must be ≤ 100 characters.
   *
   * @param {string} name
   * @returns {{ valid: boolean, error?: string }}
   */
  validateName(name) {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Item name is required.' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Item name must be 100 characters or fewer.' };
    }
    return { valid: true };
  },

  /**
   * Validates the amount field.
   *
   * - Raw value must parse to a finite number.
   * - Parsed value must be in the range [0.01, 999,999,999.99] inclusive.
   *
   * @param {string} raw  The raw string from the input field.
   * @returns {{ valid: boolean, error?: string }}
   */
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

  /**
   * Validates the category field.
   *
   * - Must be strictly one of the values in the CATEGORIES constant.
   *
   * @param {string} category
   * @returns {{ valid: boolean, error?: string }}
   */
  validateCategory(category) {
    if (!CATEGORIES.includes(category)) {
      return { valid: false, error: 'Please select a valid category (Food, Transport, or Fun).' };
    }
    return { valid: true };
  },

  /**
   * Aggregates all three field validators.
   *
   * @param {string} name
   * @param {string} amount  Raw string from the amount input.
   * @param {string} category
   * @returns {{ valid: boolean, errors: Record<string, string> }}
   */
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

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** @type {Transaction[]} Single source of truth for all transactions. */
let transactions = [];

/** @type {import('chart.js').Chart|null} Chart.js instance, created once on load. */
let chart = null;

// ---------------------------------------------------------------------------
// TransactionManager — Task 4.1 (load, getAll, getTotal, getByCategory)
// Requirements: 4.1, 4.3, 5.1, 6.3
// ---------------------------------------------------------------------------

const TransactionManager = {
  /**
   * Initialises the in-memory transactions array from localStorage.
   * Must be called once during app bootstrap before any renders.
   *
   * @returns {void}
   */
  load() {
    transactions = StorageModule.load();
  },

  /**
   * Returns a shallow copy of the in-memory transactions array.
   * Callers receive a snapshot; mutations to the returned array do not
   * affect the internal state.
   *
   * @returns {Transaction[]}
   */
  getAll() {
    return [...transactions];
  },

  /**
   * Returns the arithmetic sum of all transaction amounts.
   * Returns exactly 0 (not NaN or undefined) when the array is empty.
   *
   * @returns {number}
   */
  getTotal() {
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  },

  /**
   * Returns an object mapping each category to its summed amount.
   * Categories whose total is zero (i.e. no transactions) are omitted.
   *
   * @returns {Record<string, number>}
   *
   * @example
   * // transactions = [{ category: 'Food', amount: 10 }, { category: 'Food', amount: 5 }]
   * TransactionManager.getByCategory(); // → { Food: 15 }
   */
  getByCategory() {
    /** @type {Record<string, number>} */
    const totals = {};

    for (const t of transactions) {
      if (totals[t.category] === undefined) {
        totals[t.category] = 0;
      }
      totals[t.category] += t.amount;
    }

    // Omit any category whose summed total is exactly zero
    for (const cat of Object.keys(totals)) {
      if (totals[cat] === 0) {
        delete totals[cat];
      }
    }

    return totals;
  },

  /**
   * Creates a new Transaction, appends it to the in-memory array, persists it
   * to localStorage, and returns the created object.
   *
   * Callers are responsible for validating inputs before calling this method
   * (see ValidatorModule.validateForm).
   *
   * @param {string} name      - Item name (1–100 chars, already validated)
   * @param {number} amount    - Positive float (0.01–999,999,999.99, already validated)
   * @param {string} category  - One of 'Food' | 'Transport' | 'Fun', already validated
   * @returns {Transaction}    The newly created Transaction object.
   */
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

  /**
   * Deletes the transaction with the given id from both the in-memory array
   * and localStorage, with automatic rollback on storage failure.
   *
   * Contract:
   * 1. Snapshot the current array as a backup.
   * 2. Filter out the target id from the in-memory array.
   * 3. Attempt to persist the updated array via StorageModule.save().
   * 4. On exception: restore transactions to the backup, re-render all views,
   *    and display an error message to the user.
   * 5. On success: re-render all views.
   *
   * @param {string} id  UUID of the transaction to delete.
   * @returns {void}
   */
  delete(id) {
    // Step 1: snapshot before mutation so we can roll back on failure
    const backup = [...transactions];

    // Step 2: remove the target transaction from the in-memory array
    transactions = transactions.filter(t => t.id !== id);

    // Step 3: persist the updated array
    try {
      StorageModule.save(transactions);
    } catch (e) {
      // Step 4 (rollback path): restore in-memory state, re-render, show error
      transactions = backup;
      renderAll();
      showBanner('Failed to save. The transaction has been restored.', 'error');
      return;
    }

    // Step 5 (success path): reflect changes in the UI
    renderAll();
  },
};

// ---------------------------------------------------------------------------
// Renderers — Task 6
// Requirements: 4.1, 4.2, 4.5
// ---------------------------------------------------------------------------

/**
 * Formats a numeric total as a currency string with a `$` prefix and exactly
 * two decimal places (e.g. 0 → "$0.00", 1234.5 → "$1234.50").
 *
 * Kept as a named helper so property tests can import/call it directly.
 *
 * @param {number} total
 * @returns {string}
 */
function formatBalance(total) {
  return '$' + total.toFixed(2);
}

/**
 * Renders the current total balance into the #balance-display element.
 *
 * - Reads the total from TransactionManager.getTotal().
 * - Formats it as "$X.XX" (two decimal places, $ prefix).
 * - Displays "$0.00" when no transactions exist (getTotal() returns 0).
 *
 * Task 6.1 — Requirements: 4.1, 4.2, 4.5
 */
function renderBalance() {
  const el = document.getElementById('balance-display');
  if (!el) return;
  el.textContent = formatBalance(TransactionManager.getTotal());
}

// ---------------------------------------------------------------------------
// renderTransactionList — Task 6.3
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2
// ---------------------------------------------------------------------------

/**
 * Renders the transaction list into the #transaction-list element.
 *
 * - Reads all transactions via TransactionManager.getAll() and iterates in
 *   reverse order so the most-recently-added transaction appears first.
 * - Displays a "No transactions yet" placeholder when the list is empty.
 * - Each row contains: name (with ellipsis truncation), amount formatted to
 *   two decimal places, category badge, and a confirm()-gated delete button.
 * - The delete button carries a data-id attribute for the transaction's UUID.
 *
 * Task 6.3 — Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2
 */
function renderTransactionList() {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  const all = TransactionManager.getAll(); // snapshot copy

  // Empty state
  if (all.length === 0) {
    list.innerHTML = '<li class="transaction-list__empty">No transactions yet</li>';
    return;
  }

  // Clear existing content before appending fresh rows
  list.innerHTML = '';

  // Iterate in reverse so index [all.length - 1] (most recent) renders first
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];

    // Row container
    const item = document.createElement('li');
    item.className = 'transaction-item';

    // Name cell — ellipsis truncation handled by .transaction-item__name CSS
    const nameCell = document.createElement('span');
    nameCell.className = 'transaction-item__name transaction-name';
    nameCell.textContent = t.name;
    nameCell.title = t.name; // shows full name on hover when truncated

    // Amount cell — two decimal places, no currency prefix in cell itself
    const amountCell = document.createElement('span');
    amountCell.className = 'transaction-item__amount';
    amountCell.textContent = t.amount.toFixed(2);

    // Category badge
    const categoryCell = document.createElement('span');
    categoryCell.className = 'transaction-item__category';
    categoryCell.textContent = t.category;

    // Delete button with data-id attribute for the transaction's UUID
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'transaction-item__delete';
    deleteBtn.dataset.id = t.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${t.name}`);

    deleteBtn.addEventListener('click', () => {
      const confirmed = confirm(`Delete "${t.name}"?`);
      if (!confirmed) return;
      // TransactionManager.delete() calls renderAll() internally on success
      TransactionManager.delete(t.id);
    });

    item.appendChild(nameCell);
    item.appendChild(amountCell);
    item.appendChild(categoryCell);
    item.appendChild(deleteBtn);

    list.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// renderChart — Task 6.6
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
// ---------------------------------------------------------------------------

/**
 * Renders (or updates) the spending-by-category pie chart using Chart.js.
 *
 * Behaviour:
 * - If `window.Chart` is undefined, replaces the chart container with a
 *   static error message and returns early (graceful degradation).
 * - When no transactions exist, hides the canvas and shows the
 *   #chart-empty-message placeholder; clears any existing chart data.
 * - On first call (chart === null), creates a new Chart instance and assigns
 *   it to the module-level `chart` variable.
 * - On subsequent calls, mutates chart.data in-place and calls chart.update()
 *   to avoid destroying and recreating the canvas element.
 * - Labels are formatted as "CategoryName XX.X%" where the percentage is
 *   (categoryTotal / grandTotal * 100) rounded to one decimal place.
 *
 * Task 6.6 — Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
function renderChart() {
  const canvas = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty-message');

  // Guard: Chart.js unavailable (CDN failed to load)
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
    // Empty state: hide canvas, show placeholder
    if (canvas) canvas.style.display = 'none';
    if (emptyMsg) emptyMsg.style.display = '';

    // Clear existing chart data so stale segments don't linger
    if (chart !== null) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    }
    return;
  }

  // Present state: show canvas, hide placeholder
  if (canvas) canvas.style.display = '';
  if (emptyMsg) emptyMsg.style.display = 'none';

  // Compute grand total for percentage labels
  const grandTotal = categories.reduce((sum, cat) => sum + byCategory[cat], 0);

  const labels = categories.map(cat => {
    const pct = ((byCategory[cat] / grandTotal) * 100).toFixed(1);
    return `${cat} ${pct}%`;
  });

  const data = categories.map(cat => byCategory[cat]);

  // Colour palette — one colour per supported category in order
  const CATEGORY_COLORS = {
    Food: '#4f86c6',
    Transport: '#f4a261',
    Fun: '#57cc99',
  };
  const backgroundColors = categories.map(cat => CATEGORY_COLORS[cat] || '#aaa');

  if (chart === null) {
    // First call — create Chart instance
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
                // Show raw amount in tooltip for clarity
                const value = context.parsed;
                return ` $${value.toFixed(2)}`;
              },
            },
          },
        },
      },
    });
  } else {
    // Subsequent call — mutate data in-place and update
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = backgroundColors;
    chart.update();
  }
}

// ---------------------------------------------------------------------------
// renderAll — convenience helper (wired up in Task 6 / Task 8)
// Calls each renderer once they are implemented.
// ---------------------------------------------------------------------------

/**
 * Re-renders all three views after any state mutation.
 */
function renderAll() {
  if (typeof renderTransactionList === 'function') renderTransactionList();
  if (typeof renderBalance === 'function') renderBalance();
  if (typeof renderChart === 'function') renderChart();
}

// ---------------------------------------------------------------------------
// showBanner — error/warning banner helper (wired up in Task 8)
// ---------------------------------------------------------------------------

/**
 * Displays a dismissible banner message at the top of the page.
 *
 * @param {string} message  The text to display in the banner.
 * @param {'error'|'warning'|'info'} [type='error']  Semantic type affecting banner styling.
 */
function showBanner(message, type = 'error') {
  // Remove any existing banner of the same type first.
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

  // Insert at the top of <body> so it's always visible regardless of scroll position.
  document.body.insertAdjacentElement('afterbegin', banner);
}

// ---------------------------------------------------------------------------
// FormController — Task 7.1
// Requirements: 1.1, 1.2, 1.3, 1.5, 1.6
// ---------------------------------------------------------------------------

/**
 * Manages the Add Transaction form lifecycle: submit, validation error display,
 * error clearing, and post-success reset.
 */
const FormController = {
  /**
   * Attaches the submit event listener to #transaction-form.
   * Must be called once during app bootstrap after the DOM is ready.
   *
   * On submit:
   * - Prevents the native browser submit (page reload).
   * - Reads raw field values from the form.
   * - Calls ValidatorModule.validateForm(); on failure, delegates to showErrors().
   * - On success: calls TransactionManager.add(), then all three renderers,
   *   then FormController.reset().
   *
   * @returns {void}
   */
  init() {
    const form = document.getElementById('transaction-form');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      // Read raw field values
      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('item-amount');
      const categoryInput = document.getElementById('item-category');

      const name     = nameInput     ? nameInput.value     : '';
      const amount   = amountInput   ? amountInput.value   : '';
      const category = categoryInput ? categoryInput.value : '';

      // Validate all fields
      const { valid, errors } = ValidatorModule.validateForm(name, amount, category);

      if (!valid) {
        // Requirement 1.5: show errors, retain field values, do NOT add transaction
        FormController.showErrors(errors);
        return;
      }

      // Clear any lingering error messages before a successful add
      FormController.clearErrors();

      // Requirement 1.3: add the transaction and persist to Storage
      TransactionManager.add(name, Number(amount), category);

      // Re-render all three views to reflect the new transaction
      renderAll();

      // Requirement 1.6: reset the form fields to their empty/placeholder state
      FormController.reset();
    });
  },

  /**
   * Displays inline error messages for each invalid field.
   * Existing field values are NOT modified — only the adjacent error spans
   * are updated.
   *
   * Recognised keys in the errors object: "name", "amount", "category".
   * Each key maps to the corresponding `<span class="form-error">` element and
   * the input/select it describes (which also receives the `is-invalid` class
   * for visual highlighting via CSS).
   *
   * @param {Record<string, string>} errors  Map of field name → error message string.
   * @returns {void}
   */
  showErrors(errors) {
    // Field → [input element id, error span id]
    const fieldMap = {
      name:     ['item-name',     'item-name-error'],
      amount:   ['item-amount',   'item-amount-error'],
      category: ['item-category', 'item-category-error'],
    };

    for (const [field, [inputId, errorId]] of Object.entries(fieldMap)) {
      const input = document.getElementById(inputId);
      const errorSpan = document.getElementById(errorId);

      if (errors[field]) {
        // Mark input as invalid and display the error message
        if (input)     input.classList.add('is-invalid');
        if (errorSpan) errorSpan.textContent = errors[field];
      } else {
        // No error for this field — clear any previous error state
        if (input)     input.classList.remove('is-invalid');
        if (errorSpan) errorSpan.textContent = '';
      }
    }
  },

  /**
   * Removes all inline error messages and invalid-state CSS classes from the
   * form fields.  Called implicitly on a successful submission and can be
   * called explicitly whenever a full error reset is needed.
   *
   * @returns {void}
   */
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

  /**
   * Resets the form to its initial empty/placeholder state.
   *
   * - Name field → empty string "".
   * - Amount field → empty string "".
   * - Category dropdown → its unselected placeholder (value "").
   *
   * Field values are set directly rather than calling form.reset() so that
   * any future additions to the form (e.g. hidden fields) are not inadvertently
   * cleared.
   *
   * @returns {void}
   */
  reset() {
    const nameInput     = document.getElementById('item-name');
    const amountInput   = document.getElementById('item-amount');
    const categoryInput = document.getElementById('item-category');

    if (nameInput)     nameInput.value     = '';
    if (amountInput)   amountInput.value   = '';
    if (categoryInput) categoryInput.value = '';
  },
};

// ---------------------------------------------------------------------------
// App Bootstrap (implemented in Task 8)
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // ---------------------------------------------------------------------------
  // Bootstrap sequence — Task 8.1
  // Requirements: 2.3, 6.3, 6.4, 6.5
  // ---------------------------------------------------------------------------

  // Step 1: Detect localStorage availability.
  // A lightweight write+delete probe is the most reliable way to detect
  // SecurityError in private-browsing contexts without reading real data.
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

  // Step 2: Load persisted transactions into the in-memory array.
  // StorageModule.load() (called internally) sets storageCorrupt = true if it
  // encounters a JSON parse error or a non-array value in localStorage.
  TransactionManager.load();

  if (storageCorrupt) {
    showBanner(
      'Saved data was corrupted and could not be loaded. Starting fresh.',
      'error'
    );
  }

  // Step 3: Paint the initial UI from the loaded (or empty) transactions array.
  renderAll();

  // Step 4: Attach the form submit listener so the user can add transactions.
  FormController.init();
});
