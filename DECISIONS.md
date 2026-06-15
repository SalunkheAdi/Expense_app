# DECISIONS.md - Decision Log

This file documents the major technical and product design decisions made while building the Shared Expenses App, listing the options considered and the rationale behind the selected solutions.

---

## 1. Backend Stack: Native Node.js HTTP Server vs. Express.js
* **Context**: The user requested not to use Express.js because they are unfamiliar with it.
* **Options Considered**:
  1. *Express.js*: Standard backend framework for Node.js. Out of the box routing and body-parsing.
  2. *Next.js API Routes*: Combines frontend and backend, but introduces framework complexity.
  3. *Native Node.js `http` Module* (Chosen): Set up a raw server, parse requests manually, write custom CORS headers, and run a raw router.
* **Decision Rationale**: Using native Node.js ensures the user understands every line of code without hiding details behind external middleware APIs. This is a massive advantage for the live code walkthrough with the evaluators, as the code is completely transparent and easy to explain.

---

## 2. CSV Parser: Custom Tokenizer vs. Third-Party Library (`csv-parser`)
* **Context**: Parsing messy CSV strings containing commas inside quoted strings (e.g. `"Aisha;Rohan;Priya;Meera"` and `"1,200"`).
* **Options Considered**:
  1. *npm libraries (`csv-parser`, `fast-csv`)*: Reliable, but adds external dependency.
  2. *Custom Character Tokenizer* (Chosen): A simple character-by-character scan that toggles an `inQuotes` boolean to skip commas inside double quotes.
* **Decision Rationale**: The custom tokenizer is only 15 lines of code, highly readable, has zero dependencies, and can be walked through easily during the interview.

---

## 3. Database: SQLite vs. PostgreSQL
* **Context**: Choosing a relational database that satisfies the "Use relational DBs only" condition.
* **Options Considered**:
  1. *SQLite*: Zero-config local database file, highly portable.
  2. *PostgreSQL* (Chosen): High-fidelity production relational database.
* **Decision Rationale**: PostgreSQL is a robust, enterprise-grade relational database. Since the user already has active PostgreSQL 17/18 services running on port 5432, we can connect to it natively, which aligns with production web application development. The credentials are kept configurable via a `.env` file.

---

## 4. Duplicate and Conflict Merging Policy (Meera's Request)
* **Context**: Duplicate rows like Marina Bites (Rows 5 & 6) and conflicts like Thalassa Dinner (Rows 24 & 25).
* **Options Considered**:
  1. *Silent Auto-Merging*: Importer guesses the best row and imports silently.
  2. *Interactive Import Dashboard* (Chosen): The CSV is uploaded, parsed, and surfaced in a staging report UI. The user can review the proposed resolutions, toggle checkboxes, modify fields, and click "Finalize" to write to the DB.
* **Decision Rationale**: Fully satisfies Meera's request to "approve anything the app deletes or changes". It gives the user complete agency over how messy data is cleaned.

---

## 5. Non-Group Guest Splitting Policy (Kabir's Share)
* **Context**: Dev's friend Kabir joined parasailing (Row 23) but is not a group member.
* **Options Considered**:
  1. *Refuse Row*: Crash or reject the import.
  2. *Split 4-ways*: Ignore Kabir and split only among flatmates (unfair to flatmates).
  3. *Split 5-ways, Host Absorbs Guest Share* (Chosen): Dev absorbs Kabir's share.
* **Decision Rationale**: Split the bill equally 5 ways, but Dev is charged both his share and Kabir's share. This ensures that the other flatmates (Aisha, Rohan, Priya) only pay their exact 1/5th share, while Dev pays for his guest.

---

## 6. Currency Exchange Rate Policy (Priya's Request)
* **Context**: Split transactions made in USD (Rows 20, 21, 23, 26).
* **Options Considered**:
  1. *Historical API Lookup*: Fetch exchange rates for March 2026.
  2. *Fixed Exchange Rate* (Chosen): Convert USD to INR using a fixed conversion rate of ₹83.00.
* **Decision Rationale**: March/April 2026 exchange rates hover around ₹83.00. A fixed rate ensures the balance calculations are deterministic, reproducible, and easy to verify by hand (which will be tested during the candidate's live evaluation). The original currency details are preserved in the database and notes for auditing.

---

## 7. Rohan's Balance Breakdown (Rohan's Request)
* **Context**: Rohan wants a clear explanation of how his balance is computed without "magic numbers".
* **Options Considered**:
  1. *Show transaction list*: List all expenses where Rohan is the payer or participant.
  2. *Mathematical Ledger* (Chosen): Provide an itemized breakdown. Clicking on Rohan's balance card shows:
     - Sum of expenses Rohan paid.
     - Sum of Rohan's split shares.
     - Sum of settlements Rohan sent.
     - Sum of settlements Rohan received.
     - Shows the final formula: `Paid - Shares + Sent - Received = Net Balance`.
* **Decision Rationale**: This is mathematically absolute and leaves no room for confusion. Rohan can see every single rupee accounted for.
