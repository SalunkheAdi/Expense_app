import http from 'http';
import { URL } from 'url';
import db from './db.js';
import { analyzeExpensesCSV, parseCSVText } from './importer.js';

// ── Server config from env vars ────────────────────────────────────────────────
const PORT             = process.env.PORT || 3001;
const GROUP_NAME       = process.env.DEFAULT_GROUP_NAME  || 'Flat 204';
const GROUP_DESC       = process.env.DEFAULT_GROUP_DESC  || 'Flatmates shared expenses group';
const HISTORY_START    = process.env.EXPENSE_HISTORY_START_DATE || '2026-02-01';
const MEERA_LEFT_DATE  = process.env.MEERA_LEFT_DATE     || '2026-03-31';
const SAM_JOIN_DATE    = process.env.SAM_JOIN_DATE       || '2026-04-15';

// Helper to collect request body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', err => {
      reject(err);
    });
  });
}

// Helper to send JSON responses
function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Main Request Handler
const requestHandler = async (req, res) => {
  // Set CORS headers for preflight request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathName = parsedUrl.pathname;

  try {
    // -------------------------------------------------------------
    // Route: GET /api/users
    // -------------------------------------------------------------
    if (pathName === '/api/users' && req.method === 'GET') {
      const usersRes = await db.query('SELECT id, name, display_name FROM users ORDER BY display_name');
      return sendJSON(res, usersRes.rows);
    }

    // -------------------------------------------------------------
    // Route: POST /api/login
    // -------------------------------------------------------------
    if (pathName === '/api/login' && req.method === 'POST') {
      const bodyText = await getRequestBody(req);
      const { name, pin } = JSON.parse(bodyText);

      if (!name || !pin) {
        return sendJSON(res, { error: 'Please provide both user selection and PIN' }, 400);
      }

      const userRes = await db.query('SELECT * FROM users WHERE name = $1', [name.toLowerCase().trim()]);
      if (userRes.rowCount === 0) {
        return sendJSON(res, { error: 'User not found' }, 404);
      }

      const user = userRes.rows[0];
      if (user.pin !== pin) {
        return sendJSON(res, { error: 'Incorrect PIN' }, 401);
      }

      return sendJSON(res, { 
        id: user.id, 
        name: user.name, 
        display_name: user.display_name 
      });
    }

    // -------------------------------------------------------------
    // Route: GET /api/groups
    // -------------------------------------------------------------
    if (pathName === '/api/groups' && req.method === 'GET') {
      const groupsRes = await db.query('SELECT * FROM groups');
      return sendJSON(res, groupsRes.rows);
    }

    // -------------------------------------------------------------
    // Route: POST /api/groups
    // -------------------------------------------------------------
    if (pathName === '/api/groups' && req.method === 'POST') {
      const bodyText = await getRequestBody(req);
      const { name, description } = JSON.parse(bodyText);

      if (!name) {
        return sendJSON(res, { error: 'Group name is required' }, 400);
      }

      const insertRes = await db.query(
        'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *',
        [name, description || '']
      );
      return sendJSON(res, insertRes.rows[0]);
    }

    // -------------------------------------------------------------
    // Route: GET /api/expenses
    // -------------------------------------------------------------
    if (pathName === '/api/expenses' && req.method === 'GET') {
      const group_id = parsedUrl.searchParams.get('group_id');
      if (!group_id) {
        return sendJSON(res, { error: 'group_id parameter is required' }, 400);
      }

      const queryStr = `
        SELECT e.*, u.display_name as paid_by_name 
        FROM expenses e 
        JOIN users u ON e.paid_by_id = u.id 
        WHERE e.group_id = $1 AND e.is_approved = 1
        ORDER BY e.date DESC, e.id DESC
      `;
      const expensesRes = await db.query(queryStr, [group_id]);
      
      const result = [];
      for (const exp of expensesRes.rows) {
        const splitsRes = await db.query(
          'SELECT es.*, u.display_name FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = $1',
          [exp.id]
        );
        result.push({
          ...exp,
          splits: splitsRes.rows
        });
      }
      return sendJSON(res, result);
    }

    // -------------------------------------------------------------
    // Route: POST /api/expenses
    // -------------------------------------------------------------
    if (pathName === '/api/expenses' && req.method === 'POST') {
      const bodyText = await getRequestBody(req);
      const payload = JSON.parse(bodyText);
      const { 
        group_id, description, amount, currency, exchange_rate, 
        paid_by_id, split_type, date, notes, split_details 
      } = payload;

      if (!group_id || !description || !amount || !paid_by_id || !split_type || !date) {
        return sendJSON(res, { error: 'Missing required expense fields' }, 400);
      }

      const rate = parseFloat(exchange_rate) || 1.0;
      const amt = parseFloat(amount);
      const amtInr = currency === 'USD' ? Math.round(amt * rate * 100) / 100 : amt;

      const client = await db.getClient();
      try {
        await client.query('BEGIN');

        // Insert Expense
        const expInsert = await client.query(
          `INSERT INTO expenses 
           (group_id, description, amount, currency, exchange_rate, amount_inr, paid_by_id, split_type, date, notes, is_approved) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1) RETURNING *`,
          [group_id, description, amt, currency || 'INR', rate, amtInr, paid_by_id, split_type, date, notes || '']
        );
        const expense = expInsert.rows[0];

        // Insert Splits
        for (const name in split_details) {
          const userRes = await client.query('SELECT id FROM users WHERE name = $1', [name.toLowerCase()]);
          if (userRes.rowCount > 0) {
            const userId = userRes.rows[0].id;
            const splitAmount = split_details[name];
            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount, share_value) VALUES ($1, $2, $3, $4)`,
              [expense.id, userId, splitAmount, null]
            );
          }
        }

        await client.query('COMMIT');
        return sendJSON(res, expense);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error inserting manual expense:', err.message);
        return sendJSON(res, { error: 'Failed to create expense: ' + err.message }, 500);
      } finally {
        client.release();
      }
    }

    // -------------------------------------------------------------
    // Route: GET /api/settlements
    // -------------------------------------------------------------
    if (pathName === '/api/settlements' && req.method === 'GET') {
      const group_id = parsedUrl.searchParams.get('group_id');
      if (!group_id) {
        return sendJSON(res, { error: 'group_id parameter is required' }, 400);
      }

      const settlementsRes = await db.query(
        `SELECT s.*, u1.display_name as payer_name, u2.display_name as payee_name 
         FROM settlements s 
         JOIN users u1 ON s.payer_id = u1.id 
         JOIN users u2 ON s.payee_id = u2.id 
         WHERE s.group_id = $1 AND s.is_approved = 1
         ORDER BY s.date DESC, s.id DESC`,
        [group_id]
      );
      return sendJSON(res, settlementsRes.rows);
    }

    // -------------------------------------------------------------
    // Route: POST /api/settlements
    // -------------------------------------------------------------
    if (pathName === '/api/settlements' && req.method === 'POST') {
      const bodyText = await getRequestBody(req);
      const { group_id, payer_id, payee_id, amount, date, notes } = JSON.parse(bodyText);

      if (!group_id || !payer_id || !payee_id || !amount || !date) {
        return sendJSON(res, { error: 'Missing required settlement fields' }, 400);
      }

      const insertRes = await db.query(
        `INSERT INTO settlements (group_id, payer_id, payee_id, amount, date, notes, is_approved) 
         VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *`,
        [group_id, payer_id, payee_id, parseFloat(amount), date, notes || '']
      );
      return sendJSON(res, insertRes.rows[0]);
    }

    // -------------------------------------------------------------
    // Route: POST /api/import/preview
    // -------------------------------------------------------------
    if (pathName === '/api/import/preview' && req.method === 'POST') {
      const csvContent = await getRequestBody(req);
      if (!csvContent) {
        return sendJSON(res, { error: 'CSV content is empty' }, 400);
      }

      const csvRows = parseCSVText(csvContent);
      const analysisReport = analyzeExpensesCSV(csvRows);
      return sendJSON(res, analysisReport);
    }

    // -------------------------------------------------------------
    // Route: POST /api/import/finalize
    // -------------------------------------------------------------
    if (pathName === '/api/import/finalize' && req.method === 'POST') {
      const bodyText = await getRequestBody(req);
      const { rows } = JSON.parse(bodyText);
      
      if (!rows || !Array.isArray(rows)) {
        return sendJSON(res, { error: 'Finalized rows list is required' }, 400);
      }

      const client = await db.getClient();
      try {
        await client.query('BEGIN');

        // 1. Ensure the configured group exists (group name set via DEFAULT_GROUP_NAME env var)
        let group_id;
        const groupRes = await client.query('SELECT id FROM groups WHERE name = $1', [GROUP_NAME]);
        if (groupRes.rowCount === 0) {
          const newGroup = await client.query(
            'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id',
            [GROUP_NAME, GROUP_DESC]
          );
          group_id = newGroup.rows[0].id;
        } else {
          group_id = groupRes.rows[0].id;
        }

        // 2. Set up group memberships from env vars (no hardcoded dates)
        // HISTORY_START = EXPENSE_HISTORY_START_DATE env var (default 2026-02-01)
        // MEERA_LEFT_DATE = when Meera moved out
        // SAM_JOIN_DATE   = when Sam moved in
        const memberships = [
          { name: 'aisha', joined: HISTORY_START,   left: null },
          { name: 'rohan', joined: HISTORY_START,   left: null },
          { name: 'priya', joined: HISTORY_START,   left: null },
          { name: 'meera', joined: HISTORY_START,   left: MEERA_LEFT_DATE },
          { name: 'sam',   joined: SAM_JOIN_DATE,   left: null },
          { name: 'dev',   joined: HISTORY_START,   left: null }
        ];

        for (const m of memberships) {
          const userRes = await client.query('SELECT id FROM users WHERE name = $1', [m.name]);
          if (userRes.rowCount > 0) {
            const userId = userRes.rows[0].id;
            
            // Check if membership already exists
            const memExists = await client.query(
              'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
              [group_id, userId]
            );
            if (memExists.rowCount === 0) {
              await client.query(
                `INSERT INTO group_memberships (group_id, user_id, joined_date, left_date) VALUES ($1, $2, $3, $4)`,
                [group_id, userId, m.joined, m.left]
              );
            }
          }
        }

        // 3. Process and insert approved rows
        const importSummary = { expenses: 0, settlements: 0, skipped: 0 };
        
        for (const row of rows) {
          if (!row.approved || row.proposed.discard) {
            importSummary.skipped++;
            continue;
          }

          const prop = row.proposed;

          // Get Payer user ID
          const payerRes = await client.query('SELECT id FROM users WHERE name = $1', [prop.paid_by.toLowerCase()]);
          if (payerRes.rowCount === 0) {
            throw new Error(`Payer user not found for name: ${prop.paid_by}`);
          }
          const payerId = payerRes.rows[0].id;

          if (prop.is_settlement) {
            // Get Payee user ID
            const payeeRes = await client.query('SELECT id FROM users WHERE name = $1', [prop.payee.toLowerCase()]);
            if (payeeRes.rowCount === 0) {
              throw new Error(`Payee user not found for name: ${prop.payee}`);
            }
            const payeeId = payeeRes.rows[0].id;

            // Insert Settlement
            await client.query(
              `INSERT INTO settlements (group_id, payer_id, payee_id, amount, date, notes, is_approved) 
               VALUES ($1, $2, $3, $4, $5, $6, 1)`,
              [group_id, payerId, payeeId, prop.amount_inr, prop.date, prop.original_description]
            );
            importSummary.settlements++;
          } else {
            // Insert Expense
            const expRes = await client.query(
              `INSERT INTO expenses 
               (group_id, description, amount, currency, exchange_rate, amount_inr, paid_by_id, split_type, date, notes, is_approved) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1) RETURNING id`,
              [
                group_id, 
                prop.original_description, 
                prop.amount, 
                prop.currency, 
                prop.exchange_rate, 
                prop.amount_inr, 
                payerId, 
                prop.split_type, 
                prop.date, 
                rawRowNotes(row.original)
              ]
            );
            const expenseId = expRes.rows[0].id;

            // Insert Splits
            for (const memberName in prop.split_details) {
              const memRes = await client.query('SELECT id FROM users WHERE name = $1', [memberName.toLowerCase()]);
              if (memRes.rowCount > 0) {
                const memId = memRes.rows[0].id;
                const splitAmt = prop.split_details[memberName];
                await client.query(
                  `INSERT INTO expense_splits (expense_id, user_id, amount, share_value) VALUES ($1, $2, $3, $4)`,
                  [expenseId, memId, splitAmt, null]
                );
              }
            }
            importSummary.expenses++;
          }
        }

        await client.query('COMMIT');
        return sendJSON(res, { success: true, group_id, summary: importSummary });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Import finalize failed:', err.message);
        return sendJSON(res, { error: 'Import failed: ' + err.message }, 500);
      } finally {
        client.release();
      }
    }

    // Helper helper to get raw row notes safely
    function rawRowNotes(original) {
      if (!original) return '';
      return original.notes || '';
    }

    // -------------------------------------------------------------
    // Route: GET /api/balances
    // -------------------------------------------------------------
    if (pathName === '/api/balances' && req.method === 'GET') {
      const group_id = parsedUrl.searchParams.get('group_id');
      if (!group_id) {
        return sendJSON(res, { error: 'group_id parameter is required' }, 400);
      }

      // Fetch all users
      const usersRes = await db.query('SELECT id, name, display_name FROM users');
      const users = usersRes.rows;

      // Initialize ledger structures
      const netBalances = {};
      const ledger = {};
      
      users.forEach(u => {
        netBalances[u.display_name] = 0;
        ledger[u.display_name] = {
          name: u.display_name,
          net_balance: 0,
          expenses_paid: [],  // list of expenses paid by this user
          expenses_split: [], // list of splits charged to this user
          settlements_paid: [],
          settlements_received: []
        };
      });

      // 1. Process all approved expenses
      const expensesQuery = `
        SELECT e.*, u.display_name as paid_by_name 
        FROM expenses e 
        JOIN users u ON e.paid_by_id = u.id 
        WHERE e.group_id = $1 AND e.is_approved = 1
      `;
      const expensesRes = await db.query(expensesQuery, [group_id]);

      for (const exp of expensesRes.rows) {
        const splitsRes = await db.query(
          'SELECT es.*, u.display_name as user_name FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = $1',
          [exp.id]
        );
        const splits = splitsRes.rows;
        
        // Add to paid ledger
        const payerName = exp.paid_by_name;
        if (ledger[payerName]) {
          ledger[payerName].expenses_paid.push({
            id: exp.id,
            description: exp.description,
            date: exp.date,
            total_amount: parseFloat(exp.amount_inr),
            currency: exp.currency,
            original_amount: parseFloat(exp.amount),
            share: splits.find(s => s.user_name === payerName)?.amount || 0
          });
          netBalances[payerName] += parseFloat(exp.amount_inr);
        }

        // Add to split ledger
        splits.forEach(split => {
          const splitUser = split.user_name;
          if (ledger[splitUser]) {
            ledger[splitUser].expenses_split.push({
              id: exp.id,
              description: exp.description,
              date: exp.date,
              paid_by: payerName,
              total_amount: parseFloat(exp.amount_inr),
              share: parseFloat(split.amount)
            });
            netBalances[splitUser] -= parseFloat(split.amount);
          }
        });
      }

      // 2. Process all approved settlements
      const settlementsRes = await db.query(
        `SELECT s.*, u1.display_name as payer_name, u2.display_name as payee_name 
         FROM settlements s
         JOIN users u1 ON s.payer_id = u1.id
         JOIN users u2 ON s.payee_id = u2.id
         WHERE s.group_id = $1 AND s.is_approved = 1`,
        [group_id]
      );

      settlementsRes.rows.forEach(settle => {
        const payerName = settle.payer_name;
        const payeeName = settle.payee_name;
        const amt = parseFloat(settle.amount);

        if (ledger[payerName]) {
          ledger[payerName].settlements_paid.push({
            id: settle.id,
            payee: payeeName,
            amount: amt,
            date: settle.date,
            notes: settle.notes
          });
          netBalances[payerName] += amt;
        }

        if (ledger[payeeName]) {
          ledger[payeeName].settlements_received.push({
            id: settle.id,
            payer: payerName,
            amount: amt,
            date: settle.date,
            notes: settle.notes
          });
          netBalances[payeeName] -= amt;
        }
      });

      // Update net balances in ledger
      for (const name in netBalances) {
        netBalances[name] = Math.round(netBalances[name] * 100) / 100;
        if (ledger[name]) {
          ledger[name].net_balance = netBalances[name];
        }
      }

      // 3. Simplify Debts
      const simplified_debts = simplifyDebts(netBalances);

      return sendJSON(res, {
        balances: netBalances,
        simplified_debts,
        ledger
      });
    }

    // Default route: Not Found
    return sendJSON(res, { error: 'Route not found' }, 404);

  } catch (error) {
    console.error('Error handling request:', error);
    return sendJSON(res, { error: 'Server error: ' + error.message }, 500);
  }
};

// Debt simplification greedy matching algorithm
function simplifyDebts(netBalances) {
  const debtors = [];
  const creditors = [];
  
  for (const name in netBalances) {
    const val = netBalances[name];
    if (val < -0.01) {
      debtors.push({ name, amount: -val });
    } else if (val > 0.01) {
      creditors.push({ name, amount: val });
    }
  }
  
  // Sort descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  
  const transactions = [];
  let d = 0;
  let c = 0;
  
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(debtor.amount, creditor.amount);
    
    transactions.push({
      from: debtor.name,
      to: creditor.name,
      amount: Math.round(amount * 100) / 100
    });
    
    debtor.amount -= amount;
    creditor.amount -= amount;
    
    if (debtor.amount < 0.01) d++;
    if (creditor.amount < 0.01) c++;
  }
  
  return transactions;
}

// Start Server after database is connected
const startServer = async () => {
  try {
    await db.initDb();
    const server = http.createServer(requestHandler);
    server.listen(PORT, () => {
      console.log(`✓ Native Node.js Server is running on port http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize database, shutting down server:', error.message);
    process.exit(1);
  }
};

startServer();
