# AI_USAGE.md - AI Collaboration Log

This file documents the AI tools used, key prompt techniques, and three concrete instances where the AI generated incorrect code, describing how we identified and corrected the bugs.

---

## 1. AI Tools & Prompt Methods
* **AI Tool**: Antigravity IDE (powered by Google Gemini 3.5 Flash)
* **Role**: Pair Programmer and Code Reviewer.
* **Key Prompts**:
  * *"Is there any file named expenses_export.csv on the system?"* (Used to discover the correct path to the raw data file).
  * *"If we use native Node.js only for the backend and PostgreSQL for the database..."* (Instructed the agent to pivot from SQLite and Express to native modules to ensure maximum transparency).
  * *"Run verification script to calculate flatmate balances..."* (Tested the math and CSV parsing correctness).

---

## 2. Concrete Errors Corrected

### Case 1: Currency Normalization `if-else` Chain Bug
* **What the AI did**: In the currency normalization block of `server/importer.js`, the AI generated an `if-else` block where missing currency (defaulting to INR) was checked first:
  ```javascript
  if (!proposed.original_currency) {
    rowErrors.push('Missing currency: defaulted to INR.');
    actionsTaken.push('Assigned default currency "INR"...');
  } else if (proposed.currency === 'USD') {
    proposed.amount_inr = Math.round(proposed.amount * 83.0);
  } else {
    proposed.amount_inr = proposed.amount;
  }
  ```
* **Why it was wrong**: If a row had a missing currency (like Row 28), it entered the first `if` block but never executed the `else` block containing `proposed.amount_inr = proposed.amount`. Consequently, `proposed.amount_inr` was left `undefined` and caused `NaN` values in balance sums.
* **How we caught it**: We ran the offline validator `server/test-importer.js` and saw `NaN` balances starting from Row 28.
* **What we changed**: We separated the missing currency check from the exchange rate assignment, ensuring `proposed.amount_inr` is always assigned:
  ```javascript
  if (!proposed.original_currency) {
    rowErrors.push('Missing currency: defaulted to INR.');
  }
  if (proposed.currency === 'USD') {
    proposed.amount_inr = Math.round(proposed.amount * 83.0 * 100) / 100;
  } else {
    proposed.amount_inr = proposed.amount;
  }
  ```

### Case 2: Double-Credit Payer Balances in Verification Script
* **What the AI did**: During the insertion of trace logs in `server/test-importer.js` to debug the `NaN` issue, the AI accidentally copied the payer credit addition statement twice:
  ```javascript
  balances[prop.paid_by] += prop.amount_inr; // Line 45
  ...
  balances[prop.paid_by] += prop.amount_inr; // Line 64 (added during debug edit)
  ```
* **Why it was wrong**: This credited the payer twice for every expense they paid, throwing the net balances off.
* **How we caught it**: After fixing the `NaN` issue, the test script printed a sum of balances of `308749` instead of exactly `0`.
* **What we changed**: Inspected the code in `server/test-importer.js`, found the duplicate line 64, and deleted it. The sum of balances immediately returned to `0` exactly.

### Case 3: Database Connection Crash on First Run
* **What the AI did**: Initially, the PostgreSQL client code in `server/db.js` tried to connect directly to the database connection pool using:
  ```javascript
  const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/shared_expenses' });
  ```
* **Why it was wrong**: If the database `shared_expenses` did not exist yet on the user's PostgreSQL server, the pool connection would crash immediately, preventing the server from starting.
* **How we caught it**: Code review prior to starting the server, realizing that the PostgreSQL database would not exist on the user's local instance out-of-the-box.
* **What we changed**: Added an auto-provisioning step. The code first connects to the default `postgres` database, runs `SELECT 1 FROM pg_database WHERE datname = 'shared_expenses'`, executes `CREATE DATABASE "shared_expenses"` if it is missing, and then starts the pool.
