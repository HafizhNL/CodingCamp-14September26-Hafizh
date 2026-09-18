# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side SPA using plain HTML, CSS, and Vanilla JavaScript. The app is structured as three files (`index.html`, `css/style.css`, `js/app.js`) with no build step. Modules are built incrementally — Storage → Validator → TransactionManager → Renderers → FormController → Bootstrap — then wired together into the unidirectional data-flow pipeline. Property-based tests use fast-check via CDN in a separate test HTML runner.

---

## Tasks

- [x] 1. Scaffold project structure and static HTML shell
  - Create `index.html` with the full semantic markup: balance display (`#balance-display`), chart container (`<canvas id="spending-chart">`) with `#chart-empty-message`, transaction list (`#transaction-list`), and the input form with name/amount/category fields
  - Add the Chart.js CDN `<script>` tag and the fast-check CDN `<script>` tag (for the test runner only — not loaded in the main app)
  - Link `css/style.css` and `js/app.js` via `<link>` and `<script defer>` respectively; no inline `<style>` blocks or `style` attributes anywhere
  - Create `css/style.css` with placeholder rules and `js/app.js` with a single `DOMContentLoaded` stub
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 2. Implement StorageModule
  - [x] 2.1 Implement `StorageModule.load()` and `StorageModule.save()`
    - Define `STORAGE_KEY = 'ebv_transactions'`
    - `load()`: wrap `localStorage.getItem` + `JSON.parse` in try/catch; return `[]` and set `storageUnavailable = true` on any error; call `localStorage.removeItem(STORAGE_KEY)` on parse failure and set a `storageCorrupt` flag
    - `save(transactions)`: call `JSON.stringify` + `localStorage.setItem`; propagate exceptions to caller
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 2.2 Write property test for StorageModule — Property 10: Transaction serialization round-trip
    - **Property 10: Transaction serialization round-trip**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**
    - Use `fc.array(transactionArbitrary)` to generate arrays; assert `JSON.parse(JSON.stringify(arr))` is deeply equal to originals
    - Tag comment: `// Feature: expense-budget-visualizer, Property 10: Transaction serialization round-trip`

- [x] 3. Implement ValidatorModule
  - [x] 3.1 Implement `validateName`, `validateAmount`, `validateCategory`, and `validateForm`
    - Name: non-empty and ≤ 100 characters
    - Amount: parseable as a number in [0.01, 999,999,999.99]
    - Category: strictly one of `"Food"`, `"Transport"`, `"Fun"` (use `CATEGORIES` constant)
    - `validateForm` aggregates all three validators and returns `{ valid, errors: Record<field, string> }`
    - _Requirements: 1.4, 1.5_

  - [ ]* 3.2 Write property test for ValidatorModule — Property 2: Validator correctly classifies all inputs
    - **Property 2: Validator correctly classifies all inputs**
    - **Validates: Requirements 1.4, 1.5**
    - Use `fc.string({minLength:1, maxLength:100})`, `fc.float({min:0.01, max:999999999.99})`, `fc.constantFrom('Food','Transport','Fun')` for valid triples; assert `valid: true`
    - Use out-of-bound arbitraries (empty string, negative amounts, unknown category) for invalid triples; assert `valid: false` with at least one error
    - Tag comment: `// Feature: expense-budget-visualizer, Property 2: Validator correctly classifies all inputs`

- [x] 4. Implement TransactionManager
  - [x] 4.1 Implement `TransactionManager.load()`, `getAll()`, `getTotal()`, and `getByCategory()`
    - `load()`: call `StorageModule.load()` and assign result to in-memory `transactions` array
    - `getAll()`: return `[...transactions]`
    - `getTotal()`: return arithmetic sum of all `amount` fields; return `0` for empty array
    - `getByCategory()`: return `Record<Category, number>` of summed amounts per category (omit zero-sum categories)
    - _Requirements: 4.1, 4.3, 5.1, 6.3_

  - [ ]* 4.2 Write property test for TransactionManager — Property 6: Balance equals sum of all amounts
    - **Property 6: Balance equals the sum of all transaction amounts**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5**
    - Use `fc.array(fc.float({min:0.01, max:999999999.99}))` for amount arrays; assert `getTotal()` equals the arithmetic sum
    - Tag comment: `// Feature: expense-budget-visualizer, Property 6: Balance equals the sum of all transaction amounts`

  - [ ]* 4.3 Write property test for TransactionManager — Property 8: Chart data reflects non-zero categories
    - **Property 8: Chart data reflects exactly the categories with non-zero spend**
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**
    - Generate arrays of transactions across the three categories; assert `getByCategory()` contains only categories with total > 0
    - Tag comment: `// Feature: expense-budget-visualizer, Property 8: Chart data reflects exactly the categories with non-zero spend`

  - [x] 4.4 Implement `TransactionManager.add()`
    - Generate a UUID v4 `id` and `Date.now()` timestamp
    - Push the new Transaction object onto the in-memory array
    - Call `StorageModule.save(transactions)`
    - Return the new Transaction object
    - _Requirements: 1.3, 6.1_

  - [ ]* 4.5 Write property test for TransactionManager — Property 1: Valid transactions are always added
    - **Property 1: Valid transactions are always added**
    - **Validates: Requirements 1.3, 2.4**
    - Use valid name/amount/category arbitraries; assert count increases by exactly 1 and new transaction appears in `getAll()`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 1: Valid transactions are always added`

  - [x] 4.6 Implement `TransactionManager.delete()` with rollback
    - Snapshot `backup = [...transactions]` before removal
    - Filter out the target `id` from in-memory array
    - Call `StorageModule.save()`; on exception: restore `transactions = backup`, re-render, display error — "Failed to save. The transaction has been restored."
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.7 Write property test for TransactionManager — Property 5: Deletion removes only the target transaction
    - **Property 5: Deletion removes the exact target transaction**
    - **Validates: Requirements 3.2, 3.4, 3.5**
    - Generate a non-empty array of transactions and a random target id from that array; after `delete(id)` assert no remaining transaction has that `id` and all others remain unchanged
    - Tag comment: `// Feature: expense-budget-visualizer, Property 5: Deletion removes the exact target transaction`

- [x] 5. Checkpoint — core data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Renderers
  - [x] 6.1 Implement `renderBalance()`
    - Read total from `TransactionManager.getTotal()`
    - Format as `$X.XX` (two decimal places, `$` prefix)
    - Write formatted string to `#balance-display` textContent
    - Display `"$0.00"` when no transactions exist
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ]* 6.2 Write property test for balance formatter — Property 7: Balance display formatting
    - **Property 7: Balance display formatting**
    - **Validates: Requirements 4.2, 4.5**
    - Use `fc.float({min:0, max:999999999.99})`; assert output starts with `$` and ends with exactly two decimal places
    - Tag comment: `// Feature: expense-budget-visualizer, Property 7: Balance display formatting`

  - [x] 6.3 Implement `renderTransactionList()`
    - Iterate `TransactionManager.getAll()` in reverse (highest index first = most-recent first)
    - For each transaction, create a row element showing `name`, `amount` formatted to two decimal places, `category`, and a delete button with a `data-id` attribute set to the transaction's `id`
    - When the list is empty, display a placeholder "No transactions yet"
    - Attach a `confirm()`-gated click handler on each delete button that calls `TransactionManager.delete(id)` then re-renders all three renderers
    - Apply CSS `text-overflow: ellipsis` truncation to the name cell
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_

  - [ ]* 6.4 Write property test for renderTransactionList — Property 3: Transaction row render is complete
    - **Property 3: Transaction row render is complete**
    - **Validates: Requirements 2.1, 2.5**
    - Use a full `fc.record` transaction arbitrary; render the row HTML and assert it contains `name`, amount with two decimal places, `category`, and a delete affordance with the correct `id`
    - Tag comment: `// Feature: expense-budget-visualizer, Property 3: Transaction row render is complete`

  - [ ]* 6.5 Write property test for renderTransactionList — Property 4: Transactions render in reverse-chronological order
    - **Property 4: Transactions always render in reverse-chronological order**
    - **Validates: Requirements 2.6**
    - Use `fc.uniqueArray` on timestamps; assert rendered row order matches descending timestamp order
    - Tag comment: `// Feature: expense-budget-visualizer, Property 4: Transactions always render in reverse-chronological order`

  - [x] 6.6 Implement `renderChart()`
    - On first call, create a `Chart` instance on `<canvas id="spending-chart">` (pie type); assign to the module-level `chart` variable
    - On subsequent calls, mutate `chart.data.labels`, `chart.data.datasets[0].data` from `TransactionManager.getByCategory()` and call `chart.update()`
    - Each label must include the category name and its percentage: `(categoryTotal / grandTotal × 100)` rounded to one decimal place
    - When no transactions exist: hide the canvas, show `#chart-empty-message`; reverse when transactions are present
    - If `window.Chart` is undefined: replace chart container with a static error message "Chart unavailable — unable to load charting library."
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 6.7 Write property test for renderChart — Property 9: Chart label percentages are numerically correct
    - **Property 9: Chart label percentages are numerically correct**
    - **Validates: Requirements 5.2**
    - Generate a non-empty distribution of category totals; assert each computed percentage equals `(cat / total) × 100` rounded to one decimal place and that the sum of all percentages equals 100.0 (±0.1)
    - Tag comment: `// Feature: expense-budget-visualizer, Property 9: Chart label percentages are numerically correct`

- [x] 7. Implement FormController
  - [x] 7.1 Implement `FormController.init()`, `showErrors()`, `clearErrors()`, and `reset()`
    - `init()`: attach a `submit` event listener to the form; on submit call `ValidatorModule.validateForm()`; on failure call `showErrors()`; on success call `TransactionManager.add()`, all three renderers, then `reset()`
    - `showErrors(errors)`: display inline error messages adjacent to each invalid field; retain all current field values
    - `clearErrors()`: remove all inline error messages
    - `reset()`: clear name and amount fields to `""`, reset category dropdown to its unselected placeholder
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [x] 8. Implement App Bootstrap and error banners
  - [~] 8.1 Implement the `DOMContentLoaded` bootstrap sequence
    - Step 1: Test `localStorage` availability with a test `setItem`/`removeItem` inside try/catch; if it throws, set `storageUnavailable = true` and render a persistent warning banner: "Warning: Local Storage is unavailable. Your data will not be saved between sessions."
    - Step 2: Call `TransactionManager.load()`; if `storageCorrupt` flag is set, display a dismissible error banner: "Saved data was corrupted and could not be loaded. Starting fresh."
    - Step 3: Call `renderTransactionList()`, `renderBalance()`, and `renderChart()`
    - Step 4: Call `FormController.init()`
    - _Requirements: 2.3, 6.3, 6.4, 6.5_

- [x] 9. Apply full CSS styling
  - Style the layout so `#balance-display` appears above both the transaction list and chart
  - Make `#transaction-list` scrollable (overflow-y) when items exceed the allocated height
  - Apply `text-overflow: ellipsis; overflow: hidden; white-space: nowrap` to name cells
  - Implement responsive layout from 320px to 1920px with no horizontal scrollbar
  - Style the form, error messages, banners, and empty-state messages
  - No inline `<style>` blocks or `style` attributes — all rules in `css/style.css`
  - _Requirements: 2.2, 2.7, 4.1, 7.1, 8.4_

- [x] 10. Final checkpoint — wire everything together
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the full add→delete cycle: form submit → TransactionManager.add() → renderAll() → localStorage update reflected
  - Verify app bootstrap with pre-populated localStorage: list, balance, and chart all restore correctly
  - Verify storage unavailability banner and corrupt-data banner both render on bootstrap

- [~] 11. Implement enhancement features
  - [-] 11.1 Implement dark/light mode toggle
    - Add a toggle button (e.g. `<button id="theme-toggle">`) to `index.html`
    - In `js/app.js`: read persisted preference from `localStorage.getItem('ebv_theme')` on bootstrap; apply by setting `document.body.setAttribute('data-theme', 'dark')` or removing the attribute for light mode; write the chosen value back via `localStorage.setItem('ebv_theme', value)` on each toggle
    - In `css/style.css`: define all colour values as CSS custom properties on `:root` (light defaults); override the same properties inside `[data-theme="dark"]` for the dark palette; no inline styles or JS-injected style rules
    - _Requirements: 9_

  - [-] 11.2 Implement monthly summary view
    - Add a `<section id="monthly-summary">` container to `index.html` below the transaction list
    - In `js/app.js`: implement `renderMonthlySummary()` — derive groups from `TransactionManager.getAll()` by extracting the `YYYY-MM` prefix of each transaction's `timestamp` (formatted as a JS `Date`), sum `amount` per group, sort groups in reverse-chronological order, and render one row per month showing the month label and total formatted as `$X.XX`
    - Call `renderMonthlySummary()` alongside the other renderers wherever `renderAll()` is invoked (add, delete, bootstrap)
    - In `css/style.css`: add styles for `#monthly-summary` rows consistent with the existing layout
    - _Requirements: 10_

  - [-] 11.3 Implement transaction sorting
    - Add a `<select id="sort-control">` element near the `#transaction-list` header in `index.html` with options: `timestamp-desc` (default, label "Newest first"), `amount-asc`, `amount-desc`, `category-asc`, `category-desc`
    - In `js/app.js`: on bootstrap read `localStorage.getItem('ebv_sort')` and set the select's value accordingly (fall back to `timestamp-desc`); attach a `change` listener that writes the chosen value to `localStorage.setItem('ebv_sort', value)` then calls `renderTransactionList()`
    - Modify `renderTransactionList()` to read the current sort key and sort `TransactionManager.getAll()` before rendering; tie-breaking is always reverse-chronological (`timestamp` descending)
    - In `css/style.css`: style the `#sort-control` select to match the existing form aesthetic
    - _Requirements: 11_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints (tasks 5 and 10) ensure incremental validation before moving on
- Property tests use fast-check; minimum 100 iterations per test
- Property test files should be written as a standalone HTML test runner (e.g. `tests/test-runner.html`) that loads fast-check via CDN — they are NOT part of the production app bundle
- Unit tests cover boundary values (amount = 0.00, 0.01, 999999999.99), empty states, rollback path (mocked storage), and Chart.js load failure
- The `chart` instance is created once and mutated via `chart.data` + `chart.update()` — never destroyed and recreated

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6"] },
    { "id": 6, "tasks": ["4.7", "6.1", "6.3", "6.6"] },
    { "id": 7, "tasks": ["6.2", "6.4", "6.5", "6.7", "7.1"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["9"] },
    { "id": 10, "tasks": ["11.1", "11.2", "11.3"] }
  ]
}
```
