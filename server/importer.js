export function parseCSVText(text) {
  const lines = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell !== '')) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell !== '') {
    currentRow.push(currentCell.trim());
  }
  if (currentRow.length > 0) {
    lines.push(currentRow);
  }
  return lines;
}

export function analyzeExpensesCSV(rows) {
  const header = rows[0];
  const dataRows = rows.slice(1);
  return dataRows.map((row, idx) => ({
    rowNumber: idx + 2,
    proposed: {
      date: row[0],
      description: row[1],
      amount: parseFloat(row[2]) || 0,
      currency: row[3] || 'INR',
      paid_by: row[4],
      split_type: row[5]
    },
    approved: true,
    errors: []
  }));
}

// Duplicate checks stub
// Active period checking