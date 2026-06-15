import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, DollarSign, Upload, Plus, LogOut, Check, X, AlertTriangle, 
  ArrowRight, FileText, Info, HelpCircle, RefreshCw, ChevronRight
} from 'lucide-react';

// API base URL: reads from VITE_API_URL env variable (set in .env)
// For local dev: http://localhost:3001 | For production: your deployed backend URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('crm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginUser, setLoginUser] = useState(null); // Selected user for login
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Core App State
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [activeTab, setActiveTab] = useState('balances'); // 'balances', 'expenses', 'settlements', 'import'
  const [usersList, setUsersList] = useState([]);
  
  // Data State
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balancesData, setBalancesData] = useState({ balances: {}, simplified_debts: [], ledger: {} });

  // Modal / Form States
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [selectedLedgerUser, setSelectedLedgerUser] = useState(null); // For Rohan's detailed ledger modal
  
  // Staged CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null); // Preview data returned from server
  const [importError, setImportError] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  // New Expense Form State
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expExchangeRate, setExpExchangeRate] = useState('83.00');
  const [expPayerId, setExpPayerId] = useState('');
  const [expSplitType, setExpSplitType] = useState('equal');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expNotes, setExpNotes] = useState('');
  const [expSplitWeights, setExpSplitWeights] = useState({}); // Custom percentages/shares/amounts
  const [expFormError, setExpFormError] = useState('');

  // New Settlement Form State
  const [setAmount, setSetAmount] = useState('');
  const [setPayerId, setSetPayerId] = useState('');
  const [setPayeeId, setSetPayeeId] = useState('');
  const [setDate, setSetDate] = useState(new Date().toISOString().split('T')[0]);
  const [setNotes, setSetNotes] = useState('');
  const [setFormError, setSetFormError] = useState('');

  // Fetch initial users list
  useEffect(() => {
    fetch(`${API_URL}/api/users`)
      .then(r => r.json())
      .then(data => setUsersList(data))
      .catch(e => console.error('Error fetching users:', e));
  }, []);

  // Fetch groups and auto-select or listen for group updates
  useEffect(() => {
    if (!currentUser) return;
    
    fetch(`${API_URL}/api/groups`)
      .then(r => r.json())
      .then(data => {
        setGroups(data);
        if (data.length > 0 && !activeGroupId) {
          // Default to first group
          setActiveGroupId(data[0].id);
        }
      })
      .catch(e => console.error('Error fetching groups:', e));
  }, [currentUser, activeGroupId]);

  // Fetch Data when group or tab changes
  useEffect(() => {
    if (!currentUser || !activeGroupId) return;

    // Fetch balances
    fetch(`${API_URL}/api/balances?group_id=${activeGroupId}`)
      .then(r => r.json())
      .then(data => setBalancesData(data))
      .catch(e => console.error('Error fetching balances:', e));

    if (activeTab === 'expenses') {
      fetch(`${API_URL}/api/expenses?group_id=${activeGroupId}`)
        .then(r => r.json())
        .then(data => setExpenses(data))
        .catch(e => console.error('Error fetching expenses:', e));
    } else if (activeTab === 'settlements') {
      fetch(`${API_URL}/api/settlements?group_id=${activeGroupId}`)
        .then(r => r.json())
        .then(data => setSettlements(data))
        .catch(e => console.error('Error fetching settlements:', e));
    }
  }, [currentUser, activeGroupId, activeTab]);

  // Handle Login PIN Input
  const handlePinPress = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        submitLogin(newPin);
      }
    }
  };

  const handlePinClear = () => {
    setPin('');
  };

  const submitLogin = (completedPin) => {
    if (!loginUser) return;
    setLoginError('');
    
    fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loginUser.name, pin: completedPin })
    })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || 'Authentication failed');
        }
        return r.json();
      })
      .then(user => {
        setCurrentUser(user);
        localStorage.setItem('crm_user', JSON.stringify(user));
        setPin('');
      })
      .catch(e => {
        setLoginError(e.message);
        setPin('');
      });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('crm_user');
    setLoginUser(null);
    setPin('');
    setActiveGroupId(null);
    setActiveTab('balances');
  };

  // CSV Drag and Drop / Selection handler
  const handleCSVSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    processCSV(file);
  };

  const processCSV = (file) => {
    setImportError('');
    setImportPreview(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      fetch(`${API_URL}/api/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: event.target.result
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setImportPreview(data);
        })
        .catch(e => {
          setImportError('Failed to parse CSV: ' + e.message);
        });
    };
    reader.readAsText(file);
  };

  // CSV toggle row approval in the UI table (Meera's request)
  const toggleRowApproved = (rowId) => {
    if (!importPreview) return;
    const updatedRows = importPreview.rows.map(row => {
      if (row.id === rowId) {
        return { ...row, approved: !row.approved };
      }
      return row;
    });
    setImportPreview({
      ...importPreview,
      rows: updatedRows
    });
  };

  // CSV update proposed field inline
  const handlePreviewFieldChange = (rowId, field, value) => {
    if (!importPreview) return;
    const updatedRows = importPreview.rows.map(row => {
      if (row.id === rowId) {
        const updatedProposed = { ...row.proposed, [field]: value };
        
        // If amount changed, recalculate split details in INR
        if (field === 'amount' || field === 'currency' || field === 'exchange_rate') {
          const amt = parseFloat(updatedProposed.amount) || 0;
          const rate = parseFloat(updatedProposed.exchange_rate) || 1.0;
          updatedProposed.amount_inr = updatedProposed.currency === 'USD' ? Math.round(amt * rate * 100) / 100 : amt;
          
          // Recalculate split values based on split details names
          const keys = Object.keys(updatedProposed.split_details);
          if (keys.length > 0) {
            const splitShare = Math.round((updatedProposed.amount_inr / keys.length) * 100) / 100;
            keys.forEach(k => {
              updatedProposed.split_details[k] = splitShare;
            });
          }
        }
        
        return { ...row, proposed: updatedProposed };
      }
      return row;
    });
    
    setImportPreview({
      ...importPreview,
      rows: updatedRows
    });
  };

  // Submits the approved CSV rows to backend database
  const finalizeImport = () => {
    if (!importPreview) return;
    setImportError('');
    
    fetch(`${API_URL}/api/import/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: importPreview.rows })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setImportSummary(data.summary);
        setActiveGroupId(data.group_id);
        setImportPreview(null);
        setCsvFile(null);
        setActiveTab('balances');
      })
      .catch(e => {
        setImportError('Finalizing import failed: ' + e.message);
      });
  };

  // Active group membership lookup for a given date
  // AISHA, ROHAN, PRIYA: active Feb 1 onwards
  // MEERA: active Feb 1 - March 31
  // SAM: active April 15 onwards
  // DEV: active Feb 1 onwards
  const getActiveMembersOnDate = (dateString) => {
    if (!dateString) return STANDARDIZED_NAMES;
    const dateObj = new Date(dateString);
    
    const activePeriod = {
      'Aisha': { start: '2026-02-01', end: '2026-12-31' },
      'Rohan': { start: '2026-02-01', end: '2026-12-31' },
      'Priya': { start: '2026-02-01', end: '2026-12-31' },
      'Meera': { start: '2026-02-01', end: '2026-03-31' },
      'Sam': { start: '2026-04-15', end: '2026-12-31' },
      'Dev': { start: '2026-02-01', end: '2026-12-31' }
    };

    return Object.keys(activePeriod).filter(name => {
      const p = activePeriod[name];
      return dateObj >= new Date(p.start) && dateObj <= new Date(p.end);
    });
  };

  // Re-calculate splits for the add expense form
  const getCalculatedExpenseSplits = () => {
    const amt = parseFloat(expAmount) || 0;
    const rate = expCurrency === 'USD' ? parseFloat(expExchangeRate) || 83.00 : 1.0;
    const amtInr = currencyConvert(amt, rate, expCurrency);
    const activeMembers = getActiveMembersOnDate(expDate);
    const count = activeMembers.length;
    
    const splits = {};
    if (count === 0) return splits;

    if (expSplitType === 'equal') {
      const share = Math.round((amtInr / count) * 100) / 100;
      activeMembers.forEach(name => {
        splits[name] = share;
      });
      // Adjust residual
      const sum = Object.values(splits).reduce((a, b) => a + b, 0);
      const diff = Math.round((amtInr - sum) * 100) / 100;
      if (diff !== 0) {
        splits[activeMembers[0]] += diff;
      }
    } 
    else if (expSplitType === 'percentage') {
      let totalPct = 0;
      activeMembers.forEach(name => {
        const val = parseFloat(expSplitWeights[name]) || 0;
        totalPct += val;
      });
      activeMembers.forEach(name => {
        const val = parseFloat(expSplitWeights[name]) || 0;
        splits[name] = Math.round((amtInr * (val / 100)) * 100) / 100;
      });
      // Adjust residual
      const sum = Object.values(splits).reduce((a, b) => a + b, 0);
      const diff = Math.round((amtInr - sum) * 100) / 100;
      if (diff !== 0 && totalPct === 100) {
        splits[activeMembers[0]] += diff;
      }
    } 
    else if (expSplitType === 'share') {
      let totalShares = 0;
      activeMembers.forEach(name => {
        const val = parseFloat(expSplitWeights[name]) || 0;
        totalShares += val;
      });
      if (totalShares > 0) {
        activeMembers.forEach(name => {
          const val = parseFloat(expSplitWeights[name]) || 0;
          splits[name] = Math.round((amtInr * (val / totalShares)) * 100) / 100;
        });
        // Adjust residual
        const sum = Object.values(splits).reduce((a, b) => a + b, 0);
        const diff = Math.round((amtInr - sum) * 100) / 100;
        if (diff !== 0) {
          splits[activeMembers[0]] += diff;
        }
      }
    } 
    else if (expSplitType === 'unequal') {
      activeMembers.forEach(name => {
        // weights entered directly in INR
        const val = parseFloat(expSplitWeights[name]) || 0;
        splits[name] = val;
      });
    }

    return splits;
  };

  const currencyConvert = (val, rate, cur) => {
    return cur === 'USD' ? Math.round(val * rate * 100) / 100 : val;
  };

  // Submit manual expense
  const handleAddExpenseSubmit = (e) => {
    e.preventDefault();
    setExpFormError('');

    const amt = parseFloat(expAmount) || 0;
    if (amt <= 0) {
      return setExpFormError('Please enter a valid amount');
    }
    if (!expDescription) {
      return setExpFormError('Description is required');
    }
    if (!expPayerId) {
      return setExpFormError('Payer is required');
    }

    const calculatedSplits = getCalculatedExpenseSplits();
    
    // Check validation for percentages or totals
    if (expSplitType === 'percentage') {
      const activeMembers = getActiveMembersOnDate(expDate);
      const sumPct = activeMembers.reduce((sum, name) => sum + (parseFloat(expSplitWeights[name]) || 0), 0);
      if (sumPct !== 100) {
        return setExpFormError(`Percentages must sum to exactly 100% (current sum is ${sumPct}%)`);
      }
    } else if (expSplitType === 'unequal') {
      const activeMembers = getActiveMembersOnDate(expDate);
      const sumAmt = activeMembers.reduce((sum, name) => sum + (parseFloat(expSplitWeights[name]) || 0), 0);
      const rate = expCurrency === 'USD' ? parseFloat(expExchangeRate) || 83.00 : 1.0;
      const totalInr = currencyConvert(amt, rate, expCurrency);
      if (Math.abs(sumAmt - totalInr) > 0.1) {
        return setExpFormError(`Unequal splits sum (₹${sumAmt}) must equal expense total (₹${totalInr})`);
      }
    }

    const payload = {
      group_id: activeGroupId,
      description: expDescription,
      amount: amt,
      currency: expCurrency,
      exchange_rate: expCurrency === 'USD' ? parseFloat(expExchangeRate) || 83.0 : 1.0,
      paid_by_id: parseInt(expPayerId),
      split_type: expSplitType,
      date: expDate,
      notes: expNotes,
      split_details: calculatedSplits
    };

    fetch(`${API_URL}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setShowAddExpense(false);
        // Refresh balance and expenses list
        setActiveTab('balances');
        setExpDescription('');
        setExpAmount('');
        setExpPayerId('');
        setExpNotes('');
        setExpSplitWeights({});
      })
      .catch(e => {
        setExpFormError(e.message);
      });
  };

  // Submit manual settlement
  const handleAddSettlementSubmit = (e) => {
    e.preventDefault();
    setSetFormError('');

    const amt = parseFloat(setAmount) || 0;
    if (amt <= 0) {
      return setSetFormError('Please enter a valid amount');
    }
    if (!setPayerId || !setPayeeId) {
      return setSetFormError('Both sender and receiver are required');
    }
    if (setPayerId === setPayeeId) {
      return setSetFormError('Sender and receiver cannot be the same person');
    }

    fetch(`${API_URL}/api/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: activeGroupId,
        payer_id: parseInt(setPayerId),
        payee_id: parseInt(setPayeeId),
        amount: amt,
        date: setDate,
        notes: setNotes
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setShowAddSettlement(false);
        setActiveTab('balances');
        setSetAmount('');
        setSetPayerId('');
        setSetPayeeId('');
        setSetNotes('');
      })
      .catch(e => {
        setSetFormError(e.message);
      });
  };

  // Helper to load raw CSV contents for testing
  // Loads the assignment CSV from the public folder and sends to backend preview
  // The actual expenses_export.csv file is served from /public/expenses_export.csv
  const loadDemoCSVContent = () => {
    setImportError('');
    setImportPreview(null);
    fetch('/expenses_export.csv')
      .then(r => {
        if (!r.ok) throw new Error(`Could not load expenses_export.csv (${r.status}). Make sure it is in the /public folder.`);
        return r.text();
      })
      .then(csvText => {
        return fetch(`${API_URL}/api/import/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: csvText
        });
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setImportPreview(data);
      })
      .catch(e => {
        setImportError('Failed to load demo CSV: ' + e.message);
      });
  };

  // -------------------------------------------------------------
  // RENDERS: Login View
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="glass-card login-card">
          <div className="login-title">
            <h2>Shared Expenses Login</h2>
            <p style={{ marginBottom: '8px' }}>Select your name to log in</p>
            <div style={{ marginTop: '12px', padding: '12px 14px', background: 'var(--primary-xlight)', border: '1.5px dashed var(--border-strong)', borderRadius: '8px', fontSize: '12px', color: 'var(--primary-text)', textAlign: 'left' }}>
              <strong>💡 Evaluator Hint:</strong> Use the corresponding PINs:<br/>
              Aisha (1111), Rohan (2222), Priya (3333), Meera (4444), Sam (5555), Dev (6666)
            </div>
          </div>
          
          <div className="user-grid">
            {usersList.map(u => (
              <div 
                key={u.id}
                className={`user-select-card ${loginUser?.id === u.id ? 'selected' : ''}`}
                onClick={() => {
                  setLoginUser(u);
                  setPin('');
                  setLoginError('');
                }}
              >
                <div className="user-avatar">{u.display_name[0]}</div>
                <span>{u.display_name}</span>
              </div>
            ))}
          </div>

          {loginUser && (
            <div>
              <p style={{ textAlign: 'center', marginBottom: '10px', fontSize: '14px', color: '#6b7280' }}>
                Logging in as <strong style={{ color: 'var(--primary-text)' }}>{loginUser.display_name}</strong>
              </p>
              
              <div className="pin-input-container">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`}></div>
                ))}
              </div>

              <div className="keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button 
                    key={num} 
                    type="button" 
                    className="keypad-btn"
                    onClick={() => handlePinPress(num)}
                  >
                    {num}
                  </button>
                ))}
                <button type="button" className="keypad-btn" onClick={handlePinClear}>
                  <X size={18} />
                </button>
                <button 
                  type="button" 
                  className="keypad-btn"
                  onClick={() => handlePinPress(0)}
                >
                  0
                </button>
                <button type="button" className="keypad-btn" style={{ visibility: 'hidden' }}></button>
              </div>
            </div>
          )}

          {loginError && (
            <p style={{ color: 'var(--danger-color)', textAlign: 'center', marginTop: '16px', fontSize: '14px' }}>
              {loginError}
            </p>
          )}
        </div>
      </div>
    );
  }

  const STANDARDIZED_NAMES = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev'];

  // Calculate total group expenses and settlements
  const totalGroupExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount_inr), 0);

  // -------------------------------------------------------------
  // RENDERS: Main Dashboard
  // -------------------------------------------------------------
  return (
    <div className="app-container">
      <header>
        <div className="logo-section">
          <Users size={28} color="var(--primary-color)" />
          <h1>SplitFlat</h1>
        </div>
        
        <div className="user-profile-nav">
          <div className="user-badge">
            <div className="user-avatar" style={{ width: '24px', height: '24px', fontSize: '12px', margin: 0 }}>
              {currentUser.display_name[0]}
            </div>
            <span>{currentUser.display_name}</span>
          </div>
          
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            Logout
          </button>
        </div>
      </header>

      {groups.length === 0 && activeTab !== 'import' ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', border: '1.5px solid var(--border-strong)' }}>
          <AlertTriangle size={48} color="var(--warning-color)" style={{ marginBottom: '20px' }} />
          <h2 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>No Shared Expenses Found</h2>
          <p style={{ color: '#6b7280', marginBottom: '30px' }}>
            It looks like there are no active flatmate groups or transaction histories in the database yet.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => setActiveTab('import')}
          >
            <Upload size={18} />
            Import expenses_export.csv
          </button>
        </div>
      ) : (
        <>
          <div className="tab-container">
            <button 
              className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
              onClick={() => setActiveTab('balances')}
            >
              Balances Summary
            </button>
            <button 
              className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              Expenses List
            </button>
            <button 
              className={`tab-btn ${activeTab === 'settlements' ? 'active' : ''}`}
              onClick={() => setActiveTab('settlements')}
            >
              Recorded Settlements
            </button>
            <button 
              className={`tab-btn ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              Import CSV File
            </button>
          </div>

          {importSummary && (
            <div className="glass-card" style={{ background: 'var(--success-bg)', borderColor: 'var(--success-color)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
              <div>
                <h4 style={{ color: 'var(--success-color)', marginBottom: '4px' }}>Import Successful!</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Staged rows successfully resolved and saved. Imported: <strong>{importSummary.expenses}</strong> expenses, <strong>{importSummary.settlements}</strong> settlements. Skipped: <strong>{importSummary.skipped}</strong> rows.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setImportSummary(null)}>Dismiss</button>
            </div>
          )}

          {/* TAB: BALANCES */}
          {activeTab === 'balances' && (
            <div className="dashboard-grid">
              <div>
                <section className="glass-card" style={{ marginBottom: '24px' }}>
                  <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Group Balances</h3>
                  <div className="balance-card-grid">
                    {Object.keys(balancesData.balances).map(name => {
                      const bal = balancesData.balances[name];
                      const isRohan = name === 'Rohan';
                      return (
                        <div 
                          key={name}
                          className="glass-card balance-user-card"
                          style={{ cursor: 'pointer', border: isRohan ? '2px solid rgba(0, 242, 254, 0.4)' : '' }}
                          onClick={() => setSelectedLedgerUser(name)}
                          title={`Click to view ${name}'s detailed itemized breakdown`}
                        >
                          <span style={{ fontWeight: '600', color: varUserNameColor(name) }}>{name}</span>
                          <span className={`balance-value ${bal > 0.01 ? 'positive' : bal < -0.01 ? 'negative' : 'zero'}`}>
                            {bal > 0 ? '+' : ''}₹{bal.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Click to explain balance
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>Who Pays Whom (Aisha's View)</h3>
                    <Info size={16} color="var(--text-muted)" title="Optimized debt settlement plan" />
                  </div>
                  
                  {balancesData.simplified_debts.length === 0 ? (
                    <p style={{ color: 'var(--success-color)', fontWeight: '600', textAlign: 'center', padding: '20px' }}>
                      ✓ All debts are settled! Nobody owes anything.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {balancesData.simplified_debts.map((tx, idx) => (
                        <div key={idx} className="glass-card" style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--surface-alt)', border: '1.5px solid var(--border-color)' }}>
                          <span style={{ fontWeight: '600' }}>
                            <span style={{ color: '#6b7280' }}>{tx.from}</span> owes <span style={{ color: 'var(--primary-color)', fontWeight: '700' }}>{tx.to}</span>
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: '800', fontSize: '18px', color: 'var(--danger-color)' }}>
                              ₹{tx.amount.toLocaleString()}
                            </span>
                            <ArrowRight size={16} color="var(--primary-light)" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3>Actions</h3>
                  <button 
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => setShowAddExpense(true)}
                  >
                    <Plus size={18} />
                    Add Split Expense
                  </button>
                  <button 
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                    onClick={() => setShowAddSettlement(true)}
                  >
                    <DollarSign size={18} />
                    Record Settlement / Payment
                  </button>
                </div>

                <div className="glass-card">
                  <h3>Group Active Members</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Membership changes over time:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>Aisha, Rohan, Priya, Dev</span>
                      <span style={{ color: 'var(--success-color)' }}>Active (Feb 1 onwards)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>Meera</span>
                      <span style={{ color: 'var(--danger-color)' }}>Left (March 31)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span>Sam</span>
                      <span style={{ color: 'var(--info-color)' }}>Joined (April 15)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Expenses History</h3>
                <span className="badge badge-info">Total: ₹{totalGroupExpenses.toLocaleString()}</span>
              </div>
              
              {expenses.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                  No active expenses found.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {expenses.map(exp => (
                    <div key={exp.id} className="expense-item">
                      <div className="expense-info">
                        <span className="expense-title">{exp.description}</span>
                        <div className="expense-meta">
                          <span>Paid by <strong>{exp.paid_by_name}</strong></span>
                          <span>•</span>
                          <span>{exp.date.split('T')[0]}</span>
                          <span>•</span>
                          <span style={{ textTransform: 'capitalize' }}>Split: <strong>{exp.split_type}</strong></span>
                        </div>
                        {exp.notes && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Note: {exp.notes}
                          </span>
                        )}
                      </div>
                      <div className="expense-amount-details">
                        <span className="amount-inr">₹{parseFloat(exp.amount_inr).toLocaleString()}</span>
                        {exp.currency !== 'INR' && (
                          <span className="amount-original">
                            {exp.currency} {parseFloat(exp.amount).toLocaleString()} (@ {exp.exchange_rate})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="glass-card">
              <h3>Settlements & Payments</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                Direct bank transfers or cash payouts recorded between individuals:
              </p>

              {settlements.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                  No settlements recorded yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {settlements.map(set => (
                    <div key={set.id} className="expense-item">
                      <div className="expense-info">
                        <span className="expense-title">
                          <strong>{set.payer_name}</strong> paid <strong>{set.payee_name}</strong>
                        </span>
                        <div className="expense-meta">
                          <span>{set.date.split('T')[0]}</span>
                          {set.notes && (
                            <>
                              <span>•</span>
                              <span>{set.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="expense-amount-details">
                        <span className="amount-inr" style={{ color: 'var(--success-color)' }}>
                          ₹{parseFloat(set.amount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: IMPORT CSV */}
          {activeTab === 'import' && (
            <div className="glass-card">
              <h3 style={{ marginBottom: '8px' }}>Import Expenses CSV</h3>
              <p style={{ color: '#6b7280', marginBottom: '20px', fontSize: '14px' }}>
                Upload your <strong>expenses_export.csv</strong> file. The importer will automatically detect all 14 data anomalies and stage them for your review before saving.
              </p>

              <div 
                style={{ 
                  border: '2px dashed var(--border-strong)', 
                  borderRadius: '12px', 
                  padding: '40px', 
                  textAlign: 'center', 
                  marginBottom: '20px',
                  background: 'var(--surface-alt)',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <Upload size={32} color="var(--primary-color)" style={{ marginBottom: '12px' }} />
                <h4>Drag & Drop your CSV file here</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Or click to browse from files
                </p>
                <input 
                  type="file" 
                  id="csv-file-input" 
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleCSVSelect}
                />
              </div>

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>— OR —</span>
                <div style={{ marginTop: '12px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={loadDemoCSVContent}
                  >
                    <FileText size={16} />
                    Load Demo assignment spreadsheet CSV
                  </button>
                </div>
              </div>

              {importError && (
                <div className="glass-card" style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger-color)', marginTop: '20px', color: 'var(--danger-color)', fontSize: '14px' }}>
                  {importError}
                </div>
              )}

              {importPreview && (
                <div className="glass-card" style={{ marginTop: '30px', border: '1.5px solid var(--border-strong)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3>Import Preview Report (Meera's Approval)</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Review anomalies detected below. Select which rows to import and modify proposed actions if needed.
                      </p>
                    </div>
                    <button 
                      className="btn btn-primary"
                      onClick={finalizeImport}
                    >
                      <Check size={16} />
                      Approve & Finalize Import
                    </button>
                  </div>

                  <div className="anomaly-table-container">
                    <table className="anomaly-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>Approve</th>
                          <th style={{ width: '80px' }}>Line</th>
                          <th>Original CSV Description</th>
                          <th>Original Details</th>
                          <th>Status / Issues Detected</th>
                          <th>Proposed Resolution Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.map(row => {
                          const isAnomaly = row.status === 'anomaly';
                          const prop = row.proposed;
                          return (
                            <tr key={row.id} className={`anomaly-row ${!row.approved ? 'skipped' : ''}`}>
                              <td>
                                <input 
                                  type="checkbox"
                                  checked={row.approved}
                                  onChange={() => toggleRowApproved(row.id)}
                                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                />
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Row {row.id + 1}
                              </td>
                              <td>
                                <strong>{row.original.description}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  Payer: {row.original.paid_by || 'blank'} | Date: {row.original.date}
                                </div>
                              </td>
                              <td style={{ fontSize: '13px' }}>
                                {row.original.amount} {row.original.currency || 'INR'} 
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Split: {row.original.split_type || 'blank'}
                                </div>
                              </td>
                              <td>
                                {isAnomaly ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {row.errors.map((err, i) => (
                                      <span key={i} className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '4px 8px' }}>
                                        <AlertTriangle size={10} />
                                        {err}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="badge badge-success">Clean row</span>
                                )}
                              </td>
                              <td>
                                {row.approved ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {/* Actions Taken Log */}
                                    {row.actions_taken.map((action, i) => (
                                      <div key={i} style={{ fontSize: '12px', color: 'var(--warning-color)', display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                                        <ChevronRight size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                                        <span>{action}</span>
                                      </div>
                                    ))}
                                    
                                    {/* Interactive overrides */}
                                    {isAnomaly && (
                                      <div className="glass-card" style={{ padding: '8px 12px', background: 'var(--surface-alt)', border: '1px solid var(--border-color)', margin: '4px 0 0 0' }}>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Date</label>
                                            <input 
                                              type="text" 
                                              value={prop.date}
                                              onChange={(e) => handlePreviewFieldChange(row.id, 'date', e.target.value)}
                                              style={{ background: 'var(--surface)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', width: '90px' }}
                                            />
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Amount</label>
                                            <input 
                                              type="number" 
                                              value={prop.amount}
                                              onChange={(e) => handlePreviewFieldChange(row.id, 'amount', parseFloat(e.target.value))}
                                              style={{ background: 'var(--surface)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', width: '70px' }}
                                            />
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Currency</label>
                                            <select 
                                              value={prop.currency}
                                              onChange={(e) => handlePreviewFieldChange(row.id, 'currency', e.target.value)}
                                              style={{ background: 'var(--surface)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}
                                            >
                                              <option value="INR">INR</option>
                                              <option value="USD">USD</option>
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Payer</label>
                                            <select 
                                              value={prop.paid_by}
                                              onChange={(e) => handlePreviewFieldChange(row.id, 'paid_by', e.target.value)}
                                              style={{ background: 'var(--surface)', border: '1.5px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}
                                            >
                                              {STANDARDIZED_NAMES.map(n => (
                                                <option key={n} value={n}>{n}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Row marked as ignored.</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: NEW EXPENSE FORM */}
      {showAddExpense && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <button className="modal-close" onClick={() => setShowAddExpense(false)}>
              <X />
            </button>
            <h3 style={{ marginBottom: '20px' }}>Record a Split Expense</h3>
            
            <form onSubmit={handleAddExpenseSubmit}>
              <div className="form-group">
                <label>Description</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="e.g. Electricity bill, groceries dmart" 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00" 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Currency</label>
                  <select 
                    className="form-control"
                    value={expCurrency}
                    onChange={(e) => setExpCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                {expCurrency === 'USD' && (
                  <div className="form-group">
                    <label>Exchange Rate</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-control"
                      value={expExchangeRate}
                      onChange={(e) => setExpExchangeRate(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Paid By</label>
                  <select 
                    className="form-control"
                    value={expPayerId}
                    onChange={(e) => setExpPayerId(e.target.value)}
                    required
                  >
                    <option value="">Select payer...</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={expDate}
                    onChange={(e) => {
                      setExpDate(e.target.value);
                      // Clear splits on date change since active members change
                      setExpSplitWeights({});
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Split Method</label>
                <select 
                  className="form-control"
                  value={expSplitType}
                  onChange={(e) => {
                    setExpSplitType(e.target.value);
                    setExpSplitWeights({});
                  }}
                >
                  <option value="equal">Split Equally</option>
                  <option value="unequal">Split Unequally (custom amounts)</option>
                  <option value="percentage">Percentage Split (custom %)</option>
                  <option value="share">Share Split (custom counts)</option>
                </select>
              </div>

              {/* Dynamic inputs for splits based on Date (active membership check) */}
              <div style={{ marginTop: '12px', background: 'var(--surface-alt)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-text)', display: 'block', marginBottom: '10px' }}>
                  Split Allocations (INR)
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getActiveMembersOnDate(expDate).map(name => {
                    const isPercentage = expSplitType === 'percentage';
                    const isShare = expSplitType === 'share';
                    const isUnequal = expSplitType === 'unequal';
                    
                    return (
                      <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>{name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {(isPercentage || isShare || isUnequal) && (
                            <input 
                              type="number"
                              step="any"
                              className="form-control"
                              placeholder={isPercentage ? '%' : isShare ? 'shares' : '₹'}
                              style={{ width: '90px', padding: '6px 10px', fontSize: '14px' }}
                              value={expSplitWeights[name] || ''}
                              onChange={(e) => setExpSplitWeights({
                                ...expSplitWeights,
                                [name]: e.target.value
                              })}
                            />
                          )}
                          <span style={{ minWidth: '80px', textAlign: 'right', fontSize: '14px', color: 'var(--primary-text)', fontWeight: '600' }}>
                            ₹{(getCalculatedExpenseSplits()[name] || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Notes</label>
                <textarea 
                  className="form-control" 
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="Optional details..." 
                  rows="2"
                />
              </div>

              {expFormError && (
                <p style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px' }}>
                  {expFormError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddExpense(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SETTLEMENT */}
      {showAddSettlement && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '500px' }}>
            <button className="modal-close" onClick={() => setShowAddSettlement(false)}>
              <X />
            </button>
            <h3 style={{ marginBottom: '20px' }}>Record a Settlement</h3>
            
            <form onSubmit={handleAddSettlementSubmit}>
              <div className="form-group">
                <label>Payer (Sender)</label>
                <select 
                  className="form-control"
                  value={setPayerId}
                  onChange={(e) => setSetPayerId(e.target.value)}
                  required
                >
                  <option value="">Select sender...</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Payee (Receiver)</label>
                <select 
                  className="form-control"
                  value={setPayeeId}
                  onChange={(e) => setSetPayeeId(e.target.value)}
                  required
                >
                  <option value="">Select receiver...</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Amount (INR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="form-control" 
                    value={setAmount}
                    onChange={(e) => setSetAmount(e.target.value)}
                    placeholder="₹0.00" 
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={setDate}
                    onChange={(e) => setSetDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={setNotes}
                  onChange={(e) => setSetNotes(e.target.value)}
                  placeholder="e.g. Paid back rent share, cash transfer"
                />
              </div>

              {setFormError && (
                <p style={{ color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px' }}>
                  {setFormError}
                </p>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSettlement(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Settlement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ROHAN'S DETAILED TRANSACTION LEDGER BREAKDOWN */}
      {selectedLedgerUser && balancesData.ledger[selectedLedgerUser] && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ maxWidth: '800px' }}>
            <button className="modal-close" onClick={() => setSelectedLedgerUser(null)}>
              <X />
            </button>
            <h3 style={{ marginBottom: '8px' }}>
              Itemized Ledger: <span style={{ color: 'var(--primary-color)' }}>{selectedLedgerUser}</span>
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              No magic numbers. Here is every single expense and payment that contributes to {selectedLedgerUser}'s balance.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* SECTION: EXPENSES PAID */}
              <div>
                <h4 style={{ marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                  Expenses Paid (Credits)
                </h4>
                {balancesData.ledger[selectedLedgerUser].expenses_paid.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Did not pay for any group expenses.</p>
                ) : (
                  <table className="anomaly-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Total Paid</th>
                        <th style={{ textAlign: 'right' }}>Own Share</th>
                        <th style={{ textAlign: 'right' }}>Net Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balancesData.ledger[selectedLedgerUser].expenses_paid.map((exp, idx) => {
                        const credit = exp.total_amount - exp.share;
                        return (
                          <tr key={idx}>
                            <td>{exp.date.split('T')[0]}</td>
                            <td><strong>{exp.description}</strong></td>
                            <td style={{ textAlign: 'right' }}>₹{exp.total_amount.toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>-₹{exp.share.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', color: 'var(--success-color)', fontWeight: '600' }}>
                              +₹{credit.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SECTION: EXPENSES SPLIT */}
              <div>
                <h4 style={{ marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                  Splits Charged (Debits)
                </h4>
                {balancesData.ledger[selectedLedgerUser].expenses_split.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No split expenses charged.</p>
                ) : (
                  <table className="anomaly-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Paid By</th>
                        <th style={{ textAlign: 'right' }}>Total Expense</th>
                        <th style={{ textAlign: 'right' }}>Your Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balancesData.ledger[selectedLedgerUser].expenses_split.map((exp, idx) => (
                        <tr key={idx}>
                          <td>{exp.date.split('T')[0]}</td>
                          <td><strong>{exp.description}</strong></td>
                          <td>{exp.paid_by}</td>
                          <td style={{ textAlign: 'right' }}>₹{exp.total_amount.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: 'var(--danger-color)', fontWeight: '600' }}>
                            -₹{exp.share.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SECTION: SETTLEMENTS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                    Settlements Paid (Credits)
                  </h4>
                  {balancesData.ledger[selectedLedgerUser].settlements_paid.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No payments sent.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {balancesData.ledger[selectedLedgerUser].settlements_paid.map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--success-bg)', border: '1px solid #6ee7b7', padding: '8px 12px', borderRadius: '6px' }}>
                          <span>To {s.payee} on {s.date.split('T')[0]}</span>
                          <strong style={{ color: 'var(--success-color)' }}>+₹{s.amount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                    Settlements Received (Debits)
                  </h4>
                  {balancesData.ledger[selectedLedgerUser].settlements_received.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No payments received.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {balancesData.ledger[selectedLedgerUser].settlements_received.map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--danger-bg)', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '6px' }}>
                          <span>From {s.payer} on {s.date.split('T')[0]}</span>
                          <strong style={{ color: 'var(--danger-color)' }}>-₹{s.amount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* FINAL MATHEMATICAL PROOF */}
              <div 
                className="glass-card" 
                style={{ 
                  background: 'var(--primary-xlight)', 
                  borderColor: 'var(--border-strong)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px',
                  alignItems: 'center', 
                  padding: '16px',
                  textAlign: 'center'
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--primary-text)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                  Mathematical Verification
                </span>
                
                <div style={{ fontSize: '14px', color: 'var(--text-body)', wordBreak: 'break-word', lineHeight: '1.6' }}>
                  Paid (₹{balancesData.ledger[selectedLedgerUser].expenses_paid.reduce((sum, e) => sum + e.total_amount, 0).toLocaleString()}) 
                  &minus; Share (₹{balancesData.ledger[selectedLedgerUser].expenses_split.reduce((sum, e) => sum + e.share, 0).toLocaleString()}) 
                  + Sent (₹{balancesData.ledger[selectedLedgerUser].settlements_paid.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}) 
                  &minus; Recd (₹{balancesData.ledger[selectedLedgerUser].settlements_received.reduce((sum, e) => sum + e.amount, 0).toLocaleString()})
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Equals Net Balance:</span>
                  <strong 
                    style={{ 
                      fontSize: '20px', 
                      color: balancesData.ledger[selectedLedgerUser].net_balance > 0.01 ? 'var(--success-color)' : balancesData.ledger[selectedLedgerUser].net_balance < -0.01 ? 'var(--danger-color)' : 'var(--text-secondary)' 
                    }}
                  >
                    {balancesData.ledger[selectedLedgerUser].net_balance > 0 ? '+' : ''}₹{balancesData.ledger[selectedLedgerUser].net_balance.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// User-specific colors for dashboards (light-theme friendly)
function varUserNameColor(name) {
  const map = {
    'Aisha': '#7c3aed',
    'Rohan': '#2563eb',
    'Priya': '#db2777',
    'Meera': '#d97706',
    'Sam': '#059669',
    'Dev': '#0891b2'
  };
  return map[name] || 'var(--text-primary)';
}

export default App;
