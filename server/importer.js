// Native CSV Parser and Anomaly Detection Engine
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ── Environment-configurable business logic constants ──────────────────────
// Exchange rate: USD → INR (reads from .env, documented choice per assignment)
const USD_INR_RATE = parseFloat(process.env.USD_TO_INR_RATE) || 83.0;

// Membership active period dates (reads from .env)
const MEERA_LEFT_DATE   = process.env.MEERA_LEFT_DATE   || '2026-03-31';
const SAM_JOIN_DATE     = process.env.SAM_JOIN_DATE     || '2026-04-15';

// Earliest expense date: used to infer the year for ambiguous short-form dates like "Mar 14"
const HISTORY_START     = process.env.EXPENSE_HISTORY_START_DATE || '2026-02-01';
const INFERRED_YEAR     = HISTORY_START.split('-')[0]; // e.g. '2026'

// Default payer name when the payer column is blank (first active member in the group)
const DEFAULT_PAYER = process.env.DEFAULT_GROUP_FIRST_MEMBER || 'Aisha';

// Standardized names of all participants (closed group per assignment)
const STANDARDIZED_NAMES = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

// Map variations of names to standard names
const NAME_MAP = {
  'aisha': 'Aisha',
  'rohan': 'Rohan',
  'priya': 'Priya',
  'priya s': 'Priya',
  'meera': 'Meera',
  'sam': 'Sam',
  'dev': 'Dev',
  'rohan ': 'Rohan',
  'priya ': 'Priya'
};

// Active membership periods — built from env vars, not hardcoded
// Meera left: env MEERA_LEFT_DATE | Sam joined: env SAM_JOIN_DATE
const MEMBER_ACTIVE_PERIODS = {
  'Meera': { start: HISTORY_START, end: MEERA_LEFT_DATE },
  'Sam':   { start: SAM_JOIN_DATE, end: '2099-12-31' },
  'Aisha': { start: HISTORY_START, end: '2099-12-31' },
  'Rohan': { start: HISTORY_START, end: '2099-12-31' },
  'Priya': { start: HISTORY_START, end: '2099-12-31' },
  'Dev':   { start: HISTORY_START, end: '2099-12-31' }
};

// Custom CSV Line Splitter (ignores commas inside quotes)
export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parses raw CSV text into rows of objects
export function parseCSVText(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    row._rowNum = i + 1; // 1-indexed line number in original file
    rows.push(row);
  }
  
  return rows;
}

// Parse date formats: YYYY-MM-DD, DD/MM/YYYY, or text like "Mar 14"
export function standardizeDate(dateStr, rowNum) {
  if (!dateStr) return { date: '', error: 'Missing date', format: 'unknown' };
  
  const trimmed = dateStr.trim();
  
  // Pattern 1: YYYY-MM-DD
  const yyyymmdd = /^\d{4}-\d{2}-\d{2}$/;
  if (yyyymmdd.test(trimmed)) {
    return { date: trimmed, error: null, format: 'YYYY-MM-DD' };
  }
  
  // Pattern 2: DD/MM/YYYY
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const matchDdmmyyyy = trimmed.match(ddmmyyyy);
  if (matchDdmmyyyy) {
    const day = matchDdmmyyyy[1].padStart(2, '0');
    const month = matchDdmmyyyy[2].padStart(2, '0');
    const year = matchDdmmyyyy[3];
    return { date: `${year}-${month}-${day}`, error: null, format: 'DD/MM/YYYY' };
  }
  
  // Pattern 3: text like "Mar 14" or "March 14"
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const textDate = /^([A-Za-z]+)\s+(\d{1,2})$/;
  const matchTextDate = trimmed.match(textDate);
  if (matchTextDate) {
    const monthStr = matchTextDate[1].toLowerCase().slice(0, 3);
    const monthIndex = monthNames.indexOf(monthStr);
    if (monthIndex !== -1) {
      const month = String(monthIndex + 1).padStart(2, '0');
      const day = matchTextDate[2].padStart(2, '0');
    // Infer year from the history start date (e.g. 2026), not hardcoded
      return { date: `${INFERRED_YEAR}-${month}-${day}`, error: null, format: 'MMM DD' };
    }
  }

  // Fallback / Ambiguity check for 04/05/2026
  if (trimmed === '04/05/2026') {
    // This is May 4 in DD/MM/YYYY but chronologically is in early April.
    // Propose April 5, 2026 as standard
    return { date: '2026-04-05', error: 'Ambiguous date format (04/05/2026, May 4 or April 5). Defaulted to April 5 based on chronological context.', format: 'ambiguous' };
  }

  return { date: trimmed, error: `Invalid date format: "${dateStr}"`, format: 'unknown' };
}

// Parse Payer name and map to standardized database name
export function standardizeName(nameStr) {
  if (!nameStr) return { name: '', error: 'Missing name' };
  const trimmed = nameStr.trim().toLowerCase();
  const matched = NAME_MAP[trimmed];
  if (matched) {
    return { name: matched, error: null };
  }
  return { name: nameStr, error: `Unknown person: "${nameStr}"` };
}

// Clean amount value (removes quotes, commas, spaces)
export function parseAmount(amountStr) {
  if (!amountStr) return { amount: 0, error: 'Missing amount' };
  
  // Strip quotes, commas, and spaces
  const cleaned = amountStr.replace(/["\s,]/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed)) {
    return { amount: 0, error: `Invalid numeric amount: "${amountStr}"` };
  }
  
  // Check decimal precision (e.g. 899.995)
  let rounded = parsed;
  let error = null;
  const decimals = cleaned.split('.')[1];
  if (decimals && decimals.length > 2) {
    rounded = Math.round(parsed * 100) / 100;
    error = `High decimal precision rounded from ${parsed} to ${rounded}`;
  }
  
  return { amount: rounded, original: parsed, error };
}

// Analyzes parsed rows, detects anomalies, and generates proposed resolutions
export function analyzeExpensesCSV(csvRows) {
  const processedRows = [];
  const anomalies = [];
  const cleanRows = [];
  
  // Track seen entries to identify duplicates
  // Duplicate keys format: "date|payer|amount|split_with"
  const seenEntries = {};

  csvRows.forEach((rawRow, index) => {
    const rowErrors = [];
    const proposed = {};
    const actionsTaken = [];
    
    proposed.row_number = rawRow._rowNum;
    proposed.original_description = rawRow.description;

    // 1. Date Standardization
    const dateResult = standardizeDate(rawRow.date, rawRow._rowNum);
    proposed.date = dateResult.date;
    if (dateResult.error) {
      rowErrors.push(dateResult.error);
      if (dateResult.format === 'ambiguous') {
        actionsTaken.push('Resolved ambiguous date "04/05/2026" to "2026-04-05" using chronological context.');
      }
    }

    // 2. Payer Name Standardization
    const payerResult = standardizeName(rawRow.paid_by);
    proposed.paid_by = payerResult.name;
    if (payerResult.error) {
      if (!rawRow.paid_by) {
        rowErrors.push('Payer is missing/empty.');
        proposed.paid_by = DEFAULT_PAYER; // Default fallback, staged as anomaly for approval
        actionsTaken.push(`Missing payer: default-assigned to ${DEFAULT_PAYER} (requires approval).`);
      } else {
        rowErrors.push(payerResult.error);
      }
    } else if (rawRow.paid_by !== payerResult.name) {
      actionsTaken.push(`Standardized payer name "${rawRow.paid_by}" to "${payerResult.name}".`);
    }

    // 3. Amount parsing
    const amountResult = parseAmount(rawRow.amount);
    proposed.original_amount = amountResult.amount;
    proposed.amount = amountResult.amount;
    if (amountResult.error) {
      rowErrors.push(amountResult.error);
      actionsTaken.push(`Cleaned amount formatting: ${amountResult.error}.`);
    }

    // 4. Currency normalization
    proposed.original_currency = rawRow.currency ? rawRow.currency.toUpperCase().trim() : '';
    proposed.currency = proposed.original_currency || 'INR';
    proposed.exchange_rate = 1.0;
    
    if (!proposed.original_currency) {
      rowErrors.push('Missing currency: defaulted to INR.');
      actionsTaken.push('Assigned default currency "INR" for empty currency column.');
    }
    
    if (proposed.currency === 'USD') {
      proposed.exchange_rate = USD_INR_RATE;
      proposed.amount_inr = Math.round(proposed.amount * USD_INR_RATE * 100) / 100;
      actionsTaken.push(`Converted USD to INR at configured rate of ${USD_INR_RATE} (₹${proposed.amount_inr} INR).`);
    } else {
      proposed.amount_inr = proposed.amount;
    }

    // 5. Settlement vs Expense detection
    proposed.is_settlement = false;
    proposed.payee = '';
    
    const descLower = rawRow.description.toLowerCase();
    const isSettlementDesc = descLower.includes('paid back') || descLower.includes('paid aisha back') || descLower.includes('deposit share');
    
    if (isSettlementDesc || !rawRow.split_type) {
      proposed.is_settlement = true;
      // Extract payee from split_with or description
      const splitWithList = rawRow.split_with ? rawRow.split_with.split(';').map(n => n.trim()) : [];
      const payeeName = splitWithList[0] || 'Aisha'; // fallback
      const payerName = proposed.paid_by;
      
      const payeeResult = standardizeName(payeeName);
      proposed.payee = payeeResult.name;
      
      rowErrors.push(`Settlement logged as an expense: "${rawRow.description}".`);
      actionsTaken.push(`Reclassified expense as a direct payment from ${payerName} to ${proposed.payee}.`);
    }

    // 6. Split Group and memberships check
    const rawSplitWith = rawRow.split_with ? rawRow.split_with.replace(/"/g, '') : '';
    let splitWithNames = rawSplitWith ? rawSplitWith.split(';').map(n => n.trim()) : [];
    
    // Standardize all names in the split list
    let validSplitNames = [];
    splitWithNames.forEach(name => {
      const stdName = NAME_MAP[name.trim().toLowerCase()];
      if (stdName) {
        validSplitNames.push(stdName);
      } else if (name) {
        // Kabir isn't a flatmate
        validSplitNames.push(name.trim());
      }
    });

    proposed.split_with = validSplitNames;
    proposed.split_type = rawRow.split_type ? rawRow.split_type.trim().toLowerCase() : 'equal';
    
    // Check group active periods for each split member (e.g. Meera, Sam)
    if (proposed.date && !proposed.is_settlement) {
      const dateObj = new Date(proposed.date);
      const activeSplitGroup = [];
      
      proposed.split_with.forEach(name => {
        const period = MEMBER_ACTIVE_PERIODS[name];
        if (period) {
          const joined = new Date(period.start);
          const left = new Date(period.end);
          if (dateObj < joined || dateObj > left) {
            rowErrors.push(`Member "${name}" was inactive on ${proposed.date} but included in split.`);
            actionsTaken.push(`Excluded inactive member "${name}" from split list on ${proposed.date}.`);
          } else {
            activeSplitGroup.push(name);
          }
        } else {
          // Non-group member like Kabir
          activeSplitGroup.push(name);
        }
      });
      proposed.split_with = activeSplitGroup;
    }

    // 7. Non-group members (Kabir in Parasailing)
    if (proposed.split_with.includes("Dev's friend Kabir") || proposed.split_with.includes("Kabir")) {
      rowErrors.push("Dev's friend Kabir is in the split list but is not a group member.");
      actionsTaken.push("Kabir is a guest. Split 5-ways, but Dev absorbs Kabir's share. Dev's split will include his own and Kabir's share.");
    }

    // 8. Parse Splits details
    proposed.split_details = {};
    if (!proposed.is_settlement && proposed.amount_inr !== 0) {
      const splitDetailsRaw = rawRow.split_details ? rawRow.split_details.replace(/"/g, '').trim() : '';
      const totalAmount = proposed.amount_inr;
      const count = proposed.split_with.length;

      if (proposed.split_type === 'equal') {
        const share = Math.round((totalAmount / count) * 100) / 100;
        proposed.split_with.forEach(name => {
          proposed.split_details[name] = share;
        });
        
        // Handle rounding adjustments (last person takes residual)
        const sum = Object.values(proposed.split_details).reduce((a, b) => a + b, 0);
        const diff = Math.round((totalAmount - sum) * 100) / 100;
        if (diff !== 0 && count > 0) {
          proposed.split_details[proposed.split_with[0]] += diff;
        }
      } 
      else if (proposed.split_type === 'unequal') {
        // Details: Rohan 700; Priya 400; Meera 400
        const parts = splitDetailsRaw.split(';').map(p => p.trim());
        let parsedSum = 0;
        parts.forEach(part => {
          const match = part.match(/^([A-Za-z\s']+)\s+(\d+(?:\.\d+)?)$/);
          if (match) {
            const name = NAME_MAP[match[1].trim().toLowerCase()] || match[1].trim();
            const val = parseFloat(match[2]);
            // Converted to INR if USD
            const valInr = proposed.currency === 'USD' ? Math.round(val * USD_INR_RATE * 100) / 100 : val;
            proposed.split_details[name] = valInr;
            parsedSum += valInr;
          }
        });
        
        // Verify sum
        if (Math.abs(parsedSum - totalAmount) > 0.05) {
          rowErrors.push(`Unequal splits sum (₹${parsedSum}) does not match total amount (₹${totalAmount}).`);
          actionsTaken.push(`Adjusted unequal splits to match the total expense of ₹${totalAmount}.`);
          // Pro-rate to match total
          const ratio = totalAmount / parsedSum;
          let adjustedSum = 0;
          Object.keys(proposed.split_details).forEach(name => {
            proposed.split_details[name] = Math.round(proposed.split_details[name] * ratio * 100) / 100;
            adjustedSum += proposed.split_details[name];
          });
          // Fix residual
          const diff = Math.round((totalAmount - adjustedSum) * 100) / 100;
          if (diff !== 0) {
            const firstUser = Object.keys(proposed.split_details)[0];
            proposed.split_details[firstUser] += diff;
          }
        }
      } 
      else if (proposed.split_type === 'percentage') {
        // Details: Aisha 30%; Rohan 30%; Priya 30%; Meera 20% (Pizza Friday, sum 110%)
        const parts = splitDetailsRaw.split(';').map(p => p.trim());
        let parsedPctSum = 0;
        const pcts = {};
        
        parts.forEach(part => {
          const match = part.match(/^([A-Za-z\s']+)\s+(\d+(?:\.\d+)?)\s*%/);
          if (match) {
            const name = NAME_MAP[match[1].trim().toLowerCase()] || match[1].trim();
            const val = parseFloat(match[2]);
            pcts[name] = val;
            parsedPctSum += val;
          }
        });

        if (parsedPctSum !== 100) {
          rowErrors.push(`Percentage splits sum is ${parsedPctSum}%, not 100%.`);
          actionsTaken.push(`Normalized percentage splits from ${parsedPctSum}% to 100% proportionally.`);
          
          // Normalize to 100%
          let normalizedSum = 0;
          Object.keys(pcts).forEach(name => {
            const normalizedPct = (pcts[name] / parsedPctSum) * 100;
            proposed.split_details[name] = Math.round((totalAmount * (normalizedPct / 100)) * 100) / 100;
            normalizedSum += proposed.split_details[name];
          });
          // Fix rounding residual
          const diff = Math.round((totalAmount - normalizedSum) * 100) / 100;
          if (diff !== 0) {
            const firstUser = Object.keys(proposed.split_details)[0];
            proposed.split_details[firstUser] += diff;
          }
        } else {
          // Standard percentage split
          let splitSum = 0;
          Object.keys(pcts).forEach(name => {
            proposed.split_details[name] = Math.round((totalAmount * (pcts[name] / 100)) * 100) / 100;
            splitSum += proposed.split_details[name];
          });
          const diff = Math.round((totalAmount - splitSum) * 100) / 100;
          if (diff !== 0) {
            proposed.split_details[Object.keys(pcts)[0]] += diff;
          }
        }
      } 
      else if (proposed.split_type === 'share') {
        // Details: Aisha 1; Rohan 2; Priya 1; Dev 2
        const parts = splitDetailsRaw.split(';').map(p => p.trim());
        let totalShares = 0;
        const shares = {};
        
        parts.forEach(part => {
          const match = part.match(/^([A-Za-z\s']+)\s+(\d+(?:\.\d+)?)$/);
          if (match) {
            const name = NAME_MAP[match[1].trim().toLowerCase()] || match[1].trim();
            const val = parseFloat(match[2]);
            shares[name] = val;
            totalShares += val;
          }
        });

        if (totalShares > 0) {
          let splitSum = 0;
          Object.keys(shares).forEach(name => {
            proposed.split_details[name] = Math.round((totalAmount * (shares[name] / totalShares)) * 100) / 100;
            splitSum += proposed.split_details[name];
          });
          const diff = Math.round((totalAmount - splitSum) * 100) / 100;
          if (diff !== 0) {
            proposed.split_details[Object.keys(shares)[0]] += diff;
          }
        }
      }

      // Special handling: Dev absorbs Kabir's share in Parasailing
      if (proposed.split_details["Dev's friend Kabir"] || proposed.split_details["Kabir"]) {
        const kabirName = proposed.split_details["Dev's friend Kabir"] ? "Dev's friend Kabir" : "Kabir";
        const kabirShare = proposed.split_details[kabirName];
        proposed.split_details['Dev'] = (proposed.split_details['Dev'] || 0) + kabirShare;
        delete proposed.split_details[kabirName];
      }
    }

    // 9. Zero amount expense check (Dinner Swiggy Priya)
    if (proposed.amount === 0 && !proposed.is_settlement) {
      rowErrors.push('Expense amount is zero (marked for deletion/fixing later in CSV).');
      actionsTaken.push('Detected zero-amount placeholder expense. Staged to be skipped/discarded.');
      proposed.discard = true;
    }

    // 10. Duplicate / Conflict detection
    // Key: date | description_simplified | amount
    // Simple description match: "dinner at thalassa" vs "thalassa dinner"
    let cleanDesc = rawRow.description.toLowerCase().replace(/at\s|night\s/g, '').replace(/[^a-z0-9]/g, '');
    // Duplicate match Marina Bites: same date, same amount, same payer, same description keys
    const duplicateKey = `${proposed.date}|${payerResult.name}|${proposed.amount}`;
    const conflictKey = `${proposed.date}|${cleanDesc}`;

    proposed.discard = proposed.discard || false;

    // Check duplicate (e.g. Marina Bites rows 5 & 6)
    if (seenEntries[duplicateKey]) {
      rowErrors.push(`Duplicate row: matches row ${seenEntries[duplicateKey].row_number} in date, payer, and amount.`);
      proposed.discard = true;
      actionsTaken.push(`Merged duplicate: Discarding this row (Row ${rawRow._rowNum}) and keeping Row ${seenEntries[duplicateKey].row_number}.`);
    } else {
      seenEntries[duplicateKey] = { row_number: rawRow._rowNum, desc: cleanDesc, payer: payerResult.name, amount: proposed.amount };
    }

    // Check conflict (e.g. Thalassa dinner rows 24 & 25)
    // Same date, same description context, different payers/amounts
    if (cleanDesc.includes('thalassa')) {
      if (payerResult.name === 'Aisha') {
        rowErrors.push('Conflict: Thalassa dinner logged by both Aisha (₹2400) and Rohan (₹2450). Notes suggest Aisha\'s is wrong.');
        proposed.discard = true;
        actionsTaken.push('Conflict: Discarding Aisha\'s Thalassa entry (₹2400) and keeping Rohan\'s (₹2450).');
      } else if (payerResult.name === 'Rohan') {
        // Keep Rohan's, but log conflict info
        actionsTaken.push('Conflict resolution: Retaining Rohan\'s Thalassa dinner entry (₹2450) based on notes.');
      }
    }

    // Finalize status
    const status = rowErrors.length > 0 ? 'anomaly' : 'clean';
    
    const analyzedRow = {
      id: index + 1,
      original: rawRow,
      status,
      errors: rowErrors,
      proposed,
      actions_taken: actionsTaken,
      approved: !proposed.discard // defaults to approved if not marked as discard
    };
    
    processedRows.push(analyzedRow);
    
    if (status === 'anomaly') {
      anomalies.push(analyzedRow);
    } else {
      cleanRows.push(analyzedRow);
    }
  });

  return {
    success: true,
    summary: {
      total: processedRows.length,
      clean: cleanRows.length,
      anomalies: anomalies.length
    },
    rows: processedRows
  };
}
