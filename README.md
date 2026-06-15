# SplitFlat - Shared Expenses Web Application

A premium, glassmorphic React frontend and native Node.js (Express-free) backend application designed for flatmates (Aisha, Rohan, Priya, Meera, Sam, and Dev) to track shared expenses, resolve historical errors, and settle debts cleanly.

## Key Features
1. **Login Module**: Simple PIN keypad selector login for all six group members.
2. **Simplified Debts (Aisha's View)**: A greedy matching algorithm that reduces the complexity of balances into a minimal set of transactions ("Who pays whom, how much").
3. **Itemized Transaction Ledgers (Rohan's View)**: No "magic numbers". Clicking any user card provides a detailed mathematical proof of their balance showing exactly which payments and shares sum to their total.
4. **Active Period Membership Checking (Sam's & Meera's Requests)**: Expense creation automatically validates active dates. Inactive members (e.g., Meera after March 31, or Sam before April 15) are excluded from splits on that date.
5. **Multi-Currency Splits (Priya's Request)**: Supports adding expenses in USD and converts them to INR at a fixed historical rate of ₹83.00, retaining original transaction metadata.
6. **Interactive CSV Importer (Meera's Request)**: Uploads the messy `expenses_export.csv`, parses it with a custom parser, surfaces 15 distinct data anomalies, and presents a resolution dashboard for review before saving.

---

## Technical Stack
- **Frontend**: React + Vite (running on `http://localhost:5173`)
- **Backend**: Native Node.js HTTP Server (`http` module, running on `http://localhost:3001`)
- **Database**: PostgreSQL (relational database, port `5432`)
- **Styling**: Vanilla CSS (sleek dark mode, neon glowing accents, glassmorphic cards)

---

## Folder Structure
```
Spreetail/
├── .env                  # Environment configurations (credentials)
├── package.json          # Main dependencies (pg, dotenv, lucide-react)
├── index.html            # Vite HTML entrypoint
├── src/                  # React Client Code
│   ├── App.jsx           # Main React Dashboard and Importer view
│   ├── index.css         # Foundational CSS styling
│   └── main.jsx          # React bootstrap mount
├── server/               # Native Node.js Backend Code
│   ├── db.js             # PostgreSQL connection and migrations
│   ├── importer.js       # CSV parsing and anomaly detection engine
│   ├── index.js          # Raw HTTP Server entrypoint
│   └── test-importer.js  # Offline test run & report generator
└── import_report.md      # Generated import log report
```

---

## Getting Started

### 1. PostgreSQL Database Configuration
Make sure your local PostgreSQL service is running on port `5432`.
1. Open the `.env` file in the project root directory:
   ```env
   PORT=3001
   DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/shared_expenses
   ```
2. Replace `YOUR_POSTGRES_PASSWORD` with your local PostgreSQL user password.
3. The backend server will automatically connect to your server on startup, create the `shared_expenses` database if it doesn't exist, execute migrations, and seed the default flatmate profiles.

### 2. Start the Backend Server
Run the following commands in your terminal:
```bash
# Install dependencies (if not done)
npm install

# Start the Node.js server
node server/index.js
```
The console will output:
`✓ Native Node.js Server is running on port http://localhost:3001`

### 3. Start the Frontend Dev Server
In a new terminal window, run:
```bash
# Start Vite React client
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## AI Collaboration Log
This project was built using **Antigravity** (collaborating with the Gemini 3.5 Flash model) as the primary development companion.
For details on prompts, code generation, corrected errors, and choices, please refer to the files:
- `SCOPE.md` (detailed database schema & anomalies log)
- `DECISIONS.md` (significant product & engineering decision log)
- `AI_USAGE.md` (concrete errors committed by AI and how they were caught)
