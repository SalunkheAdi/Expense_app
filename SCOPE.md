# SCOPE.md - Database Schema & Anomaly Log

This file contains the complete PostgreSQL database schema and a log of every deliberate data problem found in the exported CSV spreadsheet, detailing how each is programmatically detected and resolved.

---

## 1. Relational Database Schema

We use PostgreSQL as our relational database. The schema structure maps the relational entity bounds:

```sql
-- 1. Users Table
-- Stores user identity, display name, and login credentials.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,      -- lowercase handle (e.g. 'rohan')
  display_name VARCHAR(100) NOT NULL,   -- display casing (e.g. 'Rohan')
  pin VARCHAR(10) NOT NULL              -- 4-digit keypad PIN
);

-- 2. Groups Table
-- Organizes members into groups (e.g. "Flat 204" or "Trip to Goa").
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

-- 3. Group Memberships
-- Tracks user group inclusion over time. Used to restrict splits based on active dates.
CREATE TABLE group_memberships (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_date DATE NOT NULL,
  left_date DATE,                       -- NULL if currently active
  CONSTRAINT check_dates CHECK (left_date IS NULL OR joined_date <= left_date)
);

-- 4. Expenses Table
-- Stores transaction headers, amounts, currencies, and split metadata.
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 4) NOT NULL,       -- original amount (supports high decimals)
  currency VARCHAR(10) NOT NULL,        -- 'INR' or 'USD'
  exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0000, -- rate to convert to INR
  amount_inr NUMERIC(12, 2) NOT NULL,   -- calculated total in INR
  paid_by_id INT NOT NULL REFERENCES users(id),
  split_type VARCHAR(20) NOT NULL,      -- 'equal', 'unequal', 'percentage', 'share'
  date DATE NOT NULL,
  notes TEXT,
  is_approved INT DEFAULT 1,            -- 0 = pending review, 1 = approved, -1 = deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Expense Splits Table
-- Resolves the many-to-many relationship between expenses and users, storing split shares.
CREATE TABLE expense_splits (
  id SERIAL PRIMARY KEY,
  expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,       -- user split share in INR
  share_value NUMERIC(10, 4)            -- original weight/percentage, if applicable
);

-- 6. Settlements Table
-- Tracks payments made from one individual to another to pay back debts.
CREATE TABLE settlements (
  id SERIAL PRIMARY KEY,
  group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_id INT NOT NULL REFERENCES users(id),
  payee_id INT NOT NULL REFERENCES users(id),
  amount NUMERIC(12, 2) NOT NULL,       -- amount settled in INR
  date DATE NOT NULL,
  notes TEXT,
  is_approved INT DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. CSV Anomaly Log (15 Data Problems Found)

Below is the list of 15 data anomalies detected in `expenses_export.csv` and our handling policies:

### 1. Duplicate Row Casing (Marina Bites)
* **Affected Rows**: Row 5 & Row 6 (`Dinner at Marina Bites` vs `dinner - marina bites`)
* **Detection**: Matches date, payer, amount, and split group.
* **Handling Policy**: Discard the duplicate (Row 6) since it lacks notes. Retain Row 5.

### 2. Quoted Number with Commas
* **Affected Rows**: Row 7 (`"1,200"`)
* **Detection**: Regex or string checks looking for commas in numeric columns.
* **Handling Policy**: Clean the string (remove quotes and commas) and parse as float `1200`.

### 3. Excessive Decimal Precision
* **Affected Rows**: Row 10 (Cylinder refill: `899.995`)
* **Detection**: String splits on `.` showing > 2 decimal places.
* **Handling Policy**: Round to 2 decimal places: `900.00`.

### 4. Payer Name Lowercase
* **Affected Rows**: Row 9 (`priya`)
* **Detection**: Match name case-insensitively against core database users.
* **Handling Policy**: Standardize to standardized casing: `Priya`.

### 5. Payer Full Name with Initials
* **Affected Rows**: Row 11 (`Priya S`)
* **Detection**: Fuzzy match or substring lookup in database users.
* **Handling Policy**: Standardize to database key: `Priya`.

### 6. Payer Trailing Whitespace
* **Affected Rows**: Row 27 (`rohan `)
* **Detection**: Trimming string exposes trailing blank spaces.
* **Handling Policy**: Trim and capitalize to `Rohan`.

### 7. Missing Payer
* **Affected Rows**: Row 13 (House cleaning supplies: empty payer)
* **Detection**: Empty string in `paid_by` column.
* **Handling Policy**: Propose default payer (Aisha) and flag as an anomaly for approval/adjustment in the staging review.

### 8. Settlement Logged as Expense
* **Affected Rows**: Row 14 (`Rohan paid Aisha back`, amount `5000`)
* **Detection**: Empty `split_type` and description keywords like "paid back".
* **Handling Policy**: Reclassify as a Settlement transaction in the database (Rohan paid Aisha 5000 INR) instead of a split expense.

### 9. Percentage Splits Summing to > 100%
* **Affected Rows**: Row 15 & Row 32 (Pizza Friday & Weekend Brunch: sum 110%)
* **Detection**: Parse percentages and check sum.
* **Handling Policy**: Normalize percentages by scaling them proportionally to sum to 100% (e.g. divide each by `1.1`).

### 10. Inconsistent Date Formats (DD/MM/YYYY vs YYYY-MM-DD)
* **Affected Rows**: Row 16 (`01/03/2026`), Row 17 (`03/03/2026`)
* **Detection**: Parse with regex to determine format.
* **Handling Policy**: Convert to standard ISO date: `2026-03-01` and `2026-03-03`.

### 11. Incomplete Date (Missing Year)
* **Affected Rows**: Row 27 (`Mar 14`)
* **Detection**: Missing year.
* **Handling Policy**: Infer year from neighboring rows. Since it lies in March 2026, parse as `2026-03-14`.

### 12. Ambiguous Date
* **Affected Rows**: Row 34 (`04/05/2026`)
* **Detection**: Ambiguity between May 4 and April 5.
* **Handling Policy**: Infer from chronological order. Since it is positioned between March 28 and April 1 in the sheet, it is parsed as April 5, 2026 (`2026-04-05`), rather than May 4.

### 13. Missing Currency
* **Affected Rows**: Row 28 (Groceries: blank currency)
* **Detection**: Empty string in `currency` column.
* **Handling Policy**: Default to group currency: `INR`.

### 14. Non-Group Member in Split Group
* **Affected Rows**: Row 23 (Parasailing: includes `Dev's friend Kabir`)
* **Detection**: Name not present in group memberships list.
* **Handling Policy**: Split 5 ways, but Dev (Kabir's host) absorbs Kabir's share (Dev pays 2/5ths of the total bill).

### 15. Active Membership Violations (Out-of-period activity)
* **Affected Rows**: Row 36 (Groceries Apr 2: Meera charged after moving out)
* **Detection**: Group member is in split but is inactive on the expense date.
* **Handling Policy**: Exclude Meera from the split since she moved out March 31. Re-split equally among active members (Aisha, Rohan, Priya).
* *(Also: Sam moved in April 15. The March electricity bill correctly does not include Sam, so he is not charged. Sam is excluded from splits before April 15).*
