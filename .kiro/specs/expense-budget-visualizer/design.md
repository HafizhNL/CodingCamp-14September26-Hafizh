# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application (SPA) built with plain HTML, CSS, and Vanilla JavaScript. There is no build step, no server, and no framework — the app runs directly in a browser by opening `index.html`.

Core responsibilities:
- Collect expense transactions via a form (name, amount, category)
- Persist transactions in `localStorage` as a JSON array under a fixed key
- Display transactions in a scrollable, reverse-chronological list
- Render a live-updating pie chart (Chart.js via CDN) showing spending by category
- Show a running total balance formatted as currency

All UI state is derived from a single in-memory array of transactions that is kept in sync with `localStorage` on every mutation.

---

## Architecture

The application follows a **unidirectional data flow** pattern without a framework:

```
User Action
    │
    ▼
Event Handler (in app.js)
    │
    ▼
State Mutation  ──►  localStorage (Storage module)
    │
    ▼
Re-render
    ├──► renderTransactionList()
    ├──► renderBalance()
    └──► renderChart()
```

**Key architectural decisions:**

1. **Single source of truth** — an in-memory `transactions` array drives all rendered output. No component reads `localStorage` directly except during the initial load.
2. **Functional renderers** — each render function is a pure projection: given the current `transactions` array it produces the correct DOM state. This makes them safe to call after any mutation without side effects.
3. **No framework dependency** — DOM manipulation uses standard `document.createElement` / `innerHTML` patterns, keeping the bundle zero-dependency beyond Chart.js.
4. **Chart.js as an external CDN resource** — loaded via `<script>` in `index.html`; the chart instance is created once on load and updated via `chart.data` mutation + `chart.update()` to avoid destroying and recreating the canvas.

### File Structure

```
project-root/
├── index.html          ← single entry point; CDN script tag for Chart.js
├── css/
│   └── style.css       ← all styling; no inline styles anywhere
└── js/
    └── app.js          ← all application logic
```

---

## Components and Interfaces

### 1. Storage Module

Encapsulates all `localStorage` interactions behind a narrow interface.

```js
// Internal constant — never changes between sessions
const STORAGE_KEY = 'ebv_transactions';

StorageModule = {
  load()  → Transaction[]   // reads + deserializes; returns [] on error
  save(transactions: Transaction[]) → void  // serializes + writes; throws on failure
}
```

**Behaviors:**
- `load()` catches `localStorage` unavailability (SecurityError) and JSON parse errors; returns `[]` in both cases and sets a global `storageUnavailable` flag.
- `save()` propagates exceptions so callers can implement rollback (Requirement 3.3).

---

### 2. Validator Module

Pure functions; no DOM access.

```js
ValidatorModule = {
  validateName(name: string)     → { valid: boolean, error?: string }
  validateAmount(raw: string)    → { valid: boolean, error?: string }
  validateCategory(cat: string)  → { valid: boolean, error?: string }
  validateForm(name, amount, cat) → { valid: boolean, errors: Record<field, string> }
}
```

Rules (from Requirement 1.4):
- Name: non-empty, max 100 characters.
- Amount: parseable as a number, in range [0.01, 999,999,999.99].
- Category: one of `"Food"`, `"Transport"`, `"Fun"`.

---

### 3. Transaction Manager

Manages the in-memory `transactions` array and coordinates Storage writes.

```js
TransactionManager = {
  load()                          → void   // init from Storage
  add(name, amount, category)     → Transaction
  delete(id)                      → void   // with rollback on Storage failure
  getAll()                        → Transaction[]
  getByCategory()                 → Record<Category, number>  // summed amounts
  getTotal()                      → number
}
```

`delete(id)` implementation contract:
1. Remove from in-memory array.
2. Attempt `StorageModule.save()`.
3. On failure: restore transaction at its original index, re-render, display error (Requirement 3.3).

---

### 4. Renderers

Each renderer reads from `TransactionManager` and writes to the DOM.

| Renderer | DOM target | Triggered by |
|---|---|---|
| `renderTransactionList()` | `#transaction-list` | add, delete, load |
| `renderBalance()` | `#balance-display` | add, delete, load |
| `renderChart()` | `<canvas #spending-chart>` | add, delete, load |

`renderTransactionList()` builds row elements with a delete button per row. Rows are produced in reverse-chronological order (most-recently-added first) by iterating the array in reverse.

`renderChart()` maps `TransactionManager.getByCategory()` to Chart.js `data.datasets[0].data` and `data.labels`, then calls `chart.update()`. When no transactions exist it hides the canvas and shows a `#chart-empty-message` element instead.

---

### 5. Form Controller

Owns the `<form>` element and its submit/reset lifecycle.

```js
FormController = {
  init()     → void   // attaches submit listener
  showErrors(errors: Record<field, string>) → void
  clearErrors()                             → void
  reset()                                   → void  // name + amount → "", category → placeholder
}
```

On successful submit: calls `TransactionManager.add()`, then all renderers, then `FormController.reset()`.
On failed validation: calls `FormController.showErrors()` — inputs retain their values (Requirement 1.5).

---

### 6. App Bootstrap (`DOMContentLoaded`)

```
1. Detect localStorage availability → set flag, show warning if unavailable (Req 6.4)
2. TransactionManager.load()
3. renderTransactionList() + renderBalance() + renderChart()
4. FormController.init()
```

---

## Data Models

### Transaction

```js
/**
 * @typedef {Object} Transaction
 * @property {string}   id        - UUID v4, generated at creation time
 * @property {string}   name      - Item name, 1–100 chars
 * @property {number}   amount    - Positive float, 0.01–999,999,999.99
 * @property {Category} category  - "Food" | "Transport" | "Fun"
 * @property {number}   timestamp - Unix timestamp (Date.now()) at creation
 */
```

### Category Enum

```js
const CATEGORIES = /** @type {const} */ (['Food', 'Transport', 'Fun']);
// Category = 'Food' | 'Transport' | 'Fun'
```

### Storage Schema

The data stored under `STORAGE_KEY` is a JSON array of Transaction objects:

```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "timestamp": 1718000000000
  }
]
```

**Round-trip invariant (Requirement 6.6):** `JSON.parse(JSON.stringify(transactions))` must produce an array whose members are deeply equal to the originals.

### In-Memory State Shape

```js
let transactions = [];        // Transaction[] — single source of truth
let chart = null;             // Chart instance, created once on load
let storageUnavailable = false;
```


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transactions are always added

*For any* combination of a valid item name (1–100 non-whitespace-only characters), a valid amount (0.01–999,999,999.99), and a valid category (Food, Transport, or Fun), calling `TransactionManager.add()` must increase the transaction count by exactly one and the new transaction must appear in `TransactionManager.getAll()`.

**Validates: Requirements 1.3, 2.4**

---

### Property 2: Validator correctly classifies all inputs

*For any* input triple `(name, amount, category)`, the `Validator.validateForm()` function must return `valid: true` if and only if: `name` is non-empty and ≤ 100 characters, `amount` is a finite number in [0.01, 999,999,999.99], and `category` is one of the three valid values. All other inputs must return `valid: false` with at least one error message.

**Validates: Requirements 1.4, 1.5**

---

### Property 3: Transaction row render is complete

*For any* Transaction object, the HTML string produced by the row renderer must contain: the transaction's `name`, the `amount` formatted to exactly two decimal places, the `category`, and an element with a delete affordance (button or control with a data attribute referencing the transaction's `id`).

**Validates: Requirements 2.1, 2.5**

---

### Property 4: Transactions always render in reverse-chronological order

*For any* non-empty array of Transactions with distinct timestamps, the order of rendered rows in the Transaction_List must correspond to descending timestamp order (largest timestamp first).

**Validates: Requirements 2.6**

---

### Property 5: Deletion removes the exact target transaction

*For any* Transaction_List containing at least one transaction, deleting the transaction with a given `id` must result in a list where no transaction with that `id` exists, and all other transactions remain present and unchanged.

**Validates: Requirements 3.2, 3.4, 3.5**

---

### Property 6: Balance equals the sum of all transaction amounts

*For any* array of Transactions (including the empty array), `TransactionManager.getTotal()` must return a value exactly equal to the arithmetic sum of all `amount` fields, with $0 for an empty array.

**Validates: Requirements 4.1, 4.3, 4.4, 4.5**

---

### Property 7: Balance display formatting

*For any* non-negative numeric total, the balance formatter must produce a string that starts with `$` and is followed by the number rounded and represented with exactly two decimal places (e.g., 0 → `"$0.00"`, 1234.5 → `"$1234.50"`).

**Validates: Requirements 4.2, 4.5**

---

### Property 8: Chart data reflects exactly the categories with non-zero spend

*For any* array of Transactions, the chart data derived by `TransactionManager.getByCategory()` must contain an entry for each and only each category that has a total amount greater than zero. Categories with no transactions must not appear as chart segments.

**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

---

### Property 9: Chart label percentages are numerically correct

*For any* non-empty distribution of category totals, each category's percentage label must equal `(categoryTotal / grandTotal) × 100` rounded to one decimal place, and the sum of all label percentages must equal 100.0 (within floating-point rounding of ±0.1 due to individual rounding).

**Validates: Requirements 5.2**

---

### Property 10: Transaction serialization round-trip

*For any* array of valid Transaction objects, serializing to JSON via `JSON.stringify` and then deserializing via `JSON.parse` must produce an array whose members are deeply equal to the originals — same `id`, `name`, `amount`, `category`, and `timestamp` fields.

**Validates: Requirements 6.1, 6.2, 6.3, 6.6**

---

## Error Handling

### Storage Unavailability (Requirement 6.4)

Detected at app bootstrap by wrapping a test `localStorage.setItem` in a `try/catch`. If it throws (`SecurityError` in private-browsing contexts), the app:
1. Sets `storageUnavailable = true`.
2. Displays a persistent banner: *"Warning: Local Storage is unavailable. Your data will not be saved between sessions."*
3. Proceeds with an empty in-memory `transactions` array; all UI features remain functional for the session.

### Corrupt Storage Data (Requirement 6.5)

On `StorageModule.load()`, if `JSON.parse` throws or the result is not an array:
1. Clears the corrupted key from Storage (`localStorage.removeItem(STORAGE_KEY)`).
2. Returns `[]`.
3. Sets a flag that causes the app to display a dismissible error message: *"Saved data was corrupted and could not be loaded. Starting fresh."*

### Storage Write Failure on Delete (Requirement 3.3)

`TransactionManager.delete(id)` pattern:
```js
const backup = [...transactions];
transactions = transactions.filter(t => t.id !== id);
try {
  StorageModule.save(transactions);
} catch (e) {
  transactions = backup;       // restore in-memory state
  renderAll();                 // re-render to reflect restored state
  showError('Failed to save. The transaction has been restored.');
  return;
}
renderAll();
```

### Form Validation Errors (Requirement 1.5)

Inline error messages appear adjacent to each invalid field. All previously entered field values are retained (inputs are not cleared on failure). Errors are cleared when the user modifies the corresponding field or on the next successful submission.

### Chart.js Load Failure

If Chart.js fails to load from CDN (network error), the `<canvas>` element remains empty. The chart container is replaced with a static error message: *"Chart unavailable — unable to load charting library."* All other app features continue to function normally.

---

## Testing Strategy

### Overview

The testing approach combines **example-based unit tests** for specific behaviors and edge cases with **property-based tests** for universal invariants. The target language is Vanilla JavaScript; the recommended property-based testing library is **[fast-check](https://github.com/dubzzz/fast-check)** (MIT-licensed, zero external dependencies, works without a bundler via CDN in test environments).

### Unit Tests (Example-Based)

Focus areas:
- **StorageModule**: load returns `[]` for missing key, for corrupted JSON, and for unavailable storage; save writes the expected string; load after save returns the original data.
- **ValidatorModule**: specific boundary values (amount = 0.00, 0.01, 999999999.99, 1000000000; empty name; name = exactly 100 chars; invalid category string).
- **FormController**: form resets correctly after a successful add; error messages appear and retain field values after a failed validation attempt.
- **Deletion rollback**: with a mocked storage that throws on save, deletion is rolled back and the transaction is restored.
- **Empty states**: balance displays `"$0.00"` and chart shows empty-state message when `transactions = []`.
- **Chart.js load failure**: graceful degradation message shown when `window.Chart` is undefined.

### Property-Based Tests (fast-check)

Each test runs a minimum of **100 iterations** (fast-check default). Each test is tagged with a comment referencing the design property.

| Test | Arbitraries | Property |
|---|---|---|
| Valid add grows list | `fc.string({minLength:1,maxLength:100})`, `fc.float({min:0.01,max:999999999.99})`, `fc.constantFrom('Food','Transport','Fun')` | Property 1 |
| Validator accepts valid input | same arbitraries as above | Property 2 |
| Validator rejects invalid input | `fc.oneof(fc.constant(''), fc.string({maxLength:0}))` for name; out-of-range floats for amount | Property 2 |
| Row render completeness | `fc.record({id: fc.uuid(), name: fc.string({minLength:1,maxLength:100}), amount: fc.float({min:0.01,max:999999999.99}), category: fc.constantFrom('Food','Transport','Fun'), timestamp: fc.integer()})` | Property 3 |
| Reverse-chronological order | array of transactions with `fc.uniqueArray` on timestamps | Property 4 |
| Delete removes only target | array of transactions + one selected id | Property 5 |
| Balance equals sum | `fc.array(fc.float({min:0.01,max:999999999.99}))` | Property 6 |
| Balance format `$X.XX` | `fc.float({min:0, max:999999999.99})` | Property 7 |
| Chart data reflects non-zero categories | array of transactions across categories | Property 8 |
| Chart percentages sum to ~100 | array of transactions with at least one per category | Property 9 |
| JSON round-trip | `fc.array(transactionArbitrary)` | Property 10 |

**Tag format** (comment above each property test):
```js
// Feature: expense-budget-visualizer, Property 1: Valid transactions are always added
```

### Integration / Example Tests

- App bootstrap with pre-populated localStorage → verify list, balance, and chart all reflect stored data.
- Full add→delete cycle verifying localStorage contents at each step.
- Storage unavailability banner renders on bootstrap when localStorage throws.
- Corrupt data banner renders and app initializes empty.

### Not Tested by Automated Unit/Property Tests

The following requirements are verified by manual QA or browser-level tools:
- CSS layout (scrollable list, ellipsis truncation, responsive 320–1920px) — visual inspection
- Cross-browser compatibility (Chrome, Firefox, Edge, Safari) — manual smoke test
- Performance (<2s load, <100ms update) — browser DevTools profiling
- Chart.js CDN not bundled locally — repository inspection
- Single-file architecture (one CSS, one JS, no inline styles) — code review checklist
