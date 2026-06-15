import fs from 'fs';
import path from 'path';
import { parseCSVText, analyzeExpensesCSV } from './importer.js';

const csvPath = 'C:\\Users\\Aditya\\Downloads\\expenses_export.csv';
const reportPath = path.resolve(process.cwd(), 'import_report.md');

function runTest() {
  console.log(`Reading CSV from: ${csvPath}`);
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found at path.');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvRows = parseCSVText(csvContent);
  const result = analyzeExpensesCSV(csvRows);

  console.log('--- CSV Processing Result ---');
  console.log(`Total rows processed: ${result.summary.total}`);
  console.log(`Clean rows: ${result.summary.clean}`);
  console.log(`Anomalies detected: ${result.summary.anomalies}`);

  // Calculate simulated balances
  const balances = {};
  const ledger = {};
  const members = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

  members.forEach(m => {
    balances[m] = 0;
    ledger[m] = { paid: 0, share: 0 };
  });

  result.rows.forEach(row => {
    if (row.proposed.discard) return;
    const prop = row.proposed;
    
    if (prop.is_settlement) {
      // Payer gets credit
      balances[prop.paid_by] += prop.amount_inr;
      // Payee gets debit
      balances[prop.payee] -= prop.amount_inr;
    } else {
      // Paid by gets credit
      if (balances[prop.paid_by] === undefined) {
        balances[prop.paid_by] = 0;
        ledger[prop.paid_by] = { paid: 0, share: 0 };
      }
      balances[prop.paid_by] += prop.amount_inr;
      ledger[prop.paid_by].paid += prop.amount_inr;

      // Participants get charged their share
      for (const name in prop.split_details) {
        if (balances[name] === undefined) {
          balances[name] = 0;
          ledger[name] = { paid: 0, share: 0 };
        }
        balances[name] -= prop.split_details[name];
        ledger[name].share += prop.split_details[name];
      }
    }

    console.log(`Row ${row.id + 1} (${prop.original_description.slice(0, 15)}): Aisha=${balances.Aisha}, Rohan=${balances.Rohan}, Priya=${balances.Priya}, Meera=${balances.Meera}, Sam=${balances.Sam}, Dev=${balances.Dev}`);
  });

  // Round balances
  for (const name in balances) {
    balances[name] = Math.round(balances[name] * 100) / 100;
  }

  console.log('\n--- Converted Balances (INR) ---');
  let sum = 0;
  for (const name in balances) {
    console.log(`${name}: ₹${balances[name].toLocaleString()}`);
    sum += balances[name];
  }
  console.log(`Sum of balances: ${Math.round(sum * 100) / 100} (should be exactly 0)`);

  // Simplify debts
  const transactions = simplifyDebts(balances);
  console.log('\n--- Simplified Debts (Aisha\'s View) ---');
  transactions.forEach(tx => {
    console.log(`${tx.from} owes ${tx.to} ₹${tx.amount.toLocaleString()}`);
  });

  // Generate Import Report Markdown
  let reportMd = `# CSV Import Report

Produced on: ${new Date().toLocaleString()}
Source: \`expenses_export.csv\`

## Import Summary
* **Total Rows Parsed**: ${result.summary.total}
* **Clean Rows**: ${result.summary.clean}
* **Anomalies Found**: ${result.summary.anomalies}

---

## Detailed Anomalies Log

This table lists every anomaly detected in the CSV file and the correction applied by the app importer.

| Row | Date | Description | Issue Detected | Proposed Correction / Action Taken |
|:---:|:---|:---|:---|:---|
`;

  result.rows.forEach(row => {
    const isAnomaly = row.status === 'anomaly';
    const issues = isAnomaly ? row.errors.join('<br>') : '*None (Clean row)*';
    const actions = row.actions_taken.join('<br>') || '*No action needed*';
    
    reportMd += `| ${row.id + 1} | ${row.original.date} | ${row.original.description} | ${issues} | ${actions} ${row.proposed.discard ? '**(Row Discarded)**' : ''} |\n`;
  });

  reportMd += `
---

## Post-Import Balances Summary

After applying all cleanups and corrections, the calculated net balances in INR for all members are:

| Flatmate | Net Balance (INR) | Status |
|:---|:---:|:---|
`;

  for (const name in balances) {
    const val = balances[name];
    const status = val > 0.01 ? 'Creditor (Owed money)' : val < -0.01 ? 'Debtor (Owes money)' : 'Settled';
    reportMd += `| **${name}** | ${val > 0 ? '+' : ''}₹${val.toLocaleString()} | ${status} |\n`;
  }

  reportMd += `
### Debt Settlement Plan (Who pays whom)
`;

  if (transactions.length === 0) {
    reportMd += `* **All group balances are settled!**\n`;
  } else {
    transactions.forEach(tx => {
      reportMd += `* **${tx.from}** pays **${tx.to}** &rarr; **₹${tx.amount.toLocaleString()}**\n`;
    });
  }

  fs.writeFileSync(reportPath, reportMd, 'utf-8');
  console.log(`\n✓ Import report generated at: ${reportPath}`);
}

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

runTest();
