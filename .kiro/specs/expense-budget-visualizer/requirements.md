# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, categorize spending, and visualize their budget distribution through an interactive pie chart. The application runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with data persisted via the browser's Local Storage API. It is designed to be simple, fast, and visually clear — requiring no setup, no server, and no external dependencies beyond a single optional charting library (Chart.js).

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry composed of an item name, a monetary amount, and a category.
- **Transaction_List**: The scrollable UI component that displays all recorded transactions.
- **Input_Form**: The HTML form component used to enter new transaction data.
- **Category**: One of three predefined spending classifications — Food, Transport, or Fun.
- **Balance_Display**: The UI element at the top of the page that shows the computed total of all transaction amounts.
- **Chart**: The pie chart component that visualizes spending distribution by Category.
- **Storage**: The browser's Local Storage API used to persist transaction data between sessions.
- **Validator**: The client-side logic that checks Input_Form fields before submission.
- **Theme**: The active color mode of the App, either "light" or "dark", that controls the visual appearance of all UI components.
- **Monthly_Summary**: The UI component that groups and displays the total spending per calendar month derived from the Transaction collection.
- **Sort_Control**: The UI control that allows the user to select a sort criterion and order for the Transaction_List.

---

## Requirements

### Requirement 1: Transaction Entry via Input Form

**User Story:** As a user, I want to enter an expense with a name, amount, and category so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for item name accepting up to 100 characters, a numeric field for amount, and a dropdown selector for Category.
2. THE Input_Form SHALL provide the following Category options: Food, Transport, and Fun.
3. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE App SHALL add the Transaction to the Transaction_List and persist it to Storage.
4. WHEN the user submits the Input_Form, THE Validator SHALL check that the item name field is not empty, the amount field contains a numeric value between 0.01 and 999,999,999.99 inclusive, and a Category is selected.
5. IF the Validator detects one or more empty or invalid fields, THEN THE Validator SHALL display an inline error message identifying which fields are invalid, SHALL retain the user's previously entered values in all fields, and SHALL NOT add the Transaction.
6. WHEN a Transaction is successfully added, THE Input_Form SHALL reset the item name and amount fields to empty and reset the Category dropdown to its unselected placeholder state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded expenses in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each Transaction showing the item name, amount (formatted as a number with two decimal places), and Category.
2. THE Transaction_List SHALL be scrollable when the number of Transactions exceeds the visible viewport area allocated to it.
3. WHEN the App loads, THE Transaction_List SHALL read from Storage and display all previously saved Transactions; IF Storage is empty or contains no Transactions, THEN THE Transaction_List SHALL display a placeholder message (e.g., "No transactions yet").
4. WHEN a new Transaction is added, THE Transaction_List SHALL update to include the new Transaction without requiring a page reload.
5. THE Transaction_List SHALL display each Transaction with a clearly labeled delete control that allows the user to remove that specific Transaction without requiring a page reload.
6. THE Transaction_List SHALL display Transactions in reverse-chronological order, with the most recently added Transaction appearing first.
7. THE Transaction_List SHALL display each item name truncated with an ellipsis if it exceeds the available display width, preserving layout integrity.

---

### Requirement 3: Transaction Deletion

**User Story:** As a user, I want to delete a transaction from the list so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. WHEN the user activates the delete control on a Transaction, THE App SHALL prompt the user for confirmation before removing the Transaction.
2. WHEN the user confirms deletion, THE App SHALL remove that Transaction from the Transaction_List without requiring a page reload.
3. WHEN the user confirms deletion, THE App SHALL remove the corresponding entry from Storage; IF the Storage write fails, THEN THE App SHALL display an error message and restore the Transaction to the Transaction_List.
4. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
5. WHEN a Transaction is deleted, THE Chart SHALL update to reflect the new spending distribution without requiring a page reload.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total spending displayed prominently so that I can quickly understand how much I have spent overall.

#### Acceptance Criteria

1. THE Balance_Display SHALL be positioned above the Transaction_List and Chart and SHALL show the sum of all Transaction amounts.
2. THE Balance_Display SHALL format the total as a number with two decimal places preceded by a currency symbol (e.g., "$0.00").
3. WHEN a Transaction is added, THE Balance_Display SHALL update automatically to reflect the new total without requiring a page reload.
4. WHEN a Transaction is deleted, THE Balance_Display SHALL update automatically to reflect the new total without requiring a page reload.
5. WHEN no Transactions exist, THE Balance_Display SHALL display "$0.00".

---

### Requirement 5: Spending Distribution Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going at a glance.

#### Acceptance Criteria

1. THE Chart SHALL render as a pie chart displaying one segment per Category that has at least one Transaction.
2. THE Chart SHALL label each segment with the corresponding Category name and its percentage of total spending rounded to one decimal place (e.g., "Food 42.3%").
3. WHEN a Transaction is added, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
4. WHEN a Transaction is deleted, THE Chart SHALL update automatically to reflect the new spending distribution without requiring a page reload.
5. WHEN no Transactions exist, THE Chart SHALL display a message stating that no data is available (e.g., "No data to display").
6. THE Chart SHALL use Chart.js loaded via a CDN `<script>` tag; the Chart.js bundle SHALL NOT be bundled locally in the repository.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my spending history when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is added, THE App SHALL serialize all current Transactions to a JSON array and write it to Storage under a fixed, constant key that remains the same across sessions.
2. WHEN a Transaction is deleted, THE App SHALL serialize the updated Transaction collection to a JSON array and write it to Storage under the same fixed key.
3. WHEN the App loads, THE App SHALL read and deserialize the JSON array from Storage and restore the Transaction_List, Balance_Display, and Chart to the state represented by the stored data.
4. IF Storage is unavailable (e.g., private browsing mode blocks access), THEN THE App SHALL initialize with an empty Transaction collection and SHALL display a persistent warning message to the user indicating that data will not be saved.
5. IF the data retrieved from Storage cannot be deserialized as a valid JSON array of Transactions, THEN THE App SHALL discard the corrupted data, initialize with an empty Transaction collection, and display an error message to the user.
6. THE App SHALL store Transaction data as a JSON-serialized array in Storage such that deserializing and re-serializing the same data produces an equivalent JSON string (round-trip property).

---

### Requirement 7: Single-File Architecture Constraints

**User Story:** As a developer, I want the project to follow a strict single-file-per-type structure so that the codebase remains clean, simple, and easy to maintain.

#### Acceptance Criteria

1. THE App SHALL use exactly one CSS file located in the `css/` directory for all styling; inline `<style>` blocks and `style` attributes SHALL NOT be used anywhere in the HTML file.
2. THE App SHALL use exactly one JavaScript file located in the `js/` directory for all application logic; inline `<script>` blocks in the HTML file SHALL be limited to CDN library imports only.
3. THE App SHALL be structured as a standalone HTML file that references the single CSS file and single JavaScript file.
4. THE App SHALL NOT require a build step, compilation, or local server to run in Chrome, Firefox, Edge, or Safari.

---

### Requirement 8: Browser Compatibility and Performance

**User Story:** As a user, I want the app to load quickly and work reliably in any modern browser so that I can use it without friction.

#### Acceptance Criteria

1. THE App SHALL function correctly on the current stable release of Chrome, Firefox, Edge, and Safari.
2. THE App SHALL render the initial view and restore persisted data within 2 seconds on a device with at least 4 GB RAM using a cached CDN resource.
3. WHEN a Transaction is added or deleted, THE App SHALL update the Balance_Display, Transaction_List, and Chart within 100 milliseconds of the user's confirmation action completing.
4. THE App SHALL maintain a responsive layout across screen widths from 320px to 1920px such that no horizontal scrollbar appears and all interactive controls remain operable at any width within that range.

---

### Requirement 9: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light color themes so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL display a toggle control that switches the Theme between "light" and "dark".
2. WHEN the user activates the toggle control, THE App SHALL apply the selected Theme to all visible UI components — including the Transaction_List, Input_Form, Balance_Display, Chart, and Monthly_Summary — without requiring a page reload.
3. WHEN the user activates the toggle control, THE App SHALL persist the selected Theme to Storage so that the preference is restored on subsequent sessions.
4. WHEN the App loads, THE App SHALL read the stored Theme preference from Storage and apply it before rendering any UI components; IF no stored preference exists, THEN THE App SHALL default to "light" Theme.
5. WHEN the Theme is "dark", THE App SHALL use a color palette with sufficient contrast such that all text elements meet a minimum contrast ratio of 4.5:1 against their background.
6. WHEN the Theme is "light", THE App SHALL use a color palette with sufficient contrast such that all text elements meet a minimum contrast ratio of 4.5:1 against their background.

---

### Requirement 10: Monthly Summary View

**User Story:** As a user, I want to see a summary of my spending grouped by month so that I can understand my spending trends over time.

#### Acceptance Criteria

1. THE App SHALL display a Monthly_Summary component that groups all Transactions by calendar month (year and month) and shows the total spending amount for each month.
2. THE Monthly_Summary SHALL display each month group with a label formatted as "Month YYYY" (e.g., "January 2025") and the corresponding total formatted as a number with two decimal places preceded by a currency symbol.
3. THE Monthly_Summary SHALL display month groups in reverse-chronological order, with the most recent month appearing first.
4. WHEN a Transaction is added, THE Monthly_Summary SHALL update automatically to reflect the new monthly totals without requiring a page reload.
5. WHEN a Transaction is deleted, THE Monthly_Summary SHALL update automatically to reflect the revised monthly totals without requiring a page reload.
6. WHEN no Transactions exist, THE Monthly_Summary SHALL display a placeholder message (e.g., "No monthly data available").
7. WHEN the App loads, THE Monthly_Summary SHALL derive its data from the Transactions restored from Storage and render the correct monthly totals without requiring a page reload.

---

### Requirement 11: Transaction Sorting

**User Story:** As a user, I want to sort my transactions by amount or category so that I can quickly find and review specific entries.

#### Acceptance Criteria

1. THE App SHALL display a Sort_Control that offers the following sort options: amount ascending, amount descending, category ascending (A–Z), and category descending (Z–A).
2. WHEN the user selects a sort option from the Sort_Control, THE Transaction_List SHALL re-render all Transactions in the order defined by the selected option without requiring a page reload.
3. WHEN two or more Transactions share the same sort key value (e.g., equal amounts or the same Category), THE Transaction_List SHALL resolve the tie by displaying those Transactions in reverse-chronological order (most recently added first).
4. WHEN a new Transaction is added, THE Transaction_List SHALL insert the new Transaction in the position consistent with the currently active sort option.
5. WHEN the App loads, THE Sort_Control SHALL default to the reverse-chronological order defined in Requirement 2.6; IF the user had previously selected a sort option, THE App SHALL restore that selection from Storage and apply it before rendering the Transaction_List.
6. THE Sort_Control SHALL persist the currently selected sort option to Storage so that the user's sort preference is maintained across sessions.
