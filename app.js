// app.js
// This file handles auth and dashboard logic for the demo finance tracker.

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showMessage(msg, el='#message', timeout=3500) {
  const target = document.querySelector(el);
  if (!target) return;
  target.textContent = msg;
  target.style.opacity = 1;
  setTimeout(()=> target.style.opacity = 0, timeout);
}

function todayISO(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

// safe parse
function loadJSON(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch(e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Auth (signup/login) ----------
if (document.getElementById('signup-form')) {
  const signupForm = $('#signup-form');
  const loginForm = $('#login-form');
  $('#show-signup').addEventListener('click', e => {
    e.preventDefault();
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
  });
  $('#show-login').addEventListener('click', e => {
    e.preventDefault();
    signupForm.classList.remove('active');
    loginForm.classList.add('active');
  });

  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#signup-name').value.trim();
    const email = $('#signup-email').value.trim().toLowerCase();
    const password = $('#signup-password').value;

    if (!name || !email || password.length < 6) {
      showMessage('Please enter valid details (password >= 6 chars).');
      return;
    }

    const users = loadJSON('ft_users', {});
    if (users[email]) {
      showMessage('An account with this email already exists.');
      return;
    }

    // store user (NOTE: storing plain password — demo only)
    users[email] = {
      name, email, password,
      transactions: [] // per-user transactions
    };
    saveJSON('ft_users', users);
    showMessage('Account created. You can sign in now.');
    // switch to login
    setTimeout(()=> {
      signupForm.classList.remove('active');
      loginForm.classList.add('active');
      signupForm.reset();
    }, 800);
  });

  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#login-email').value.trim().toLowerCase();
    const password = $('#login-password').value;
    const users = loadJSON('ft_users', {});
    const user = users[email];
    if (!user || user.password !== password) {
      showMessage('Invalid email or password.');
      return;
    }
    // set session
    localStorage.setItem('ft_currentUser', email);
    showMessage('Signed in — redirecting...');
    setTimeout(()=> window.location.href = 'dashboard.html', 800);
  });
}

// ---------- Dashboard logic ----------
if (document.getElementById('transaction-form') || document.getElementById('tx-table')) {
  const currentEmail = localStorage.getItem('ft_currentUser');
  if (!currentEmail) {
    window.location.href = 'index.html';
    throw new Error('Not logged in');
  }

  const users = loadJSON('ft_users', {});
  const user = users[currentEmail];
  if (!user) {
    // corrupt session
    localStorage.removeItem('ft_currentUser');
    window.location.href = 'index.html';
    throw new Error('User not found');
  }

  // UI refs
  const greeting = $('#greeting');
  const signout = $('#signout');
  const txForm = $('#transaction-form');
  const txTableBody = document.querySelector('#tx-table tbody');
  const totalBalanceEl = $('#total-balance');
  const monthIncomeEl = $('#month-income');
  const monthExpenseEl = $('#month-expense');
  const eraseBtn = $('#erase-all');

  greeting.textContent = `Hi, ${user.name}`;

  signout.addEventListener('click', () => {
    localStorage.removeItem('ft_currentUser');
    window.location.href = 'index.html';
  });

  function getTransactions() {
    // reload from storage in case of external changes
    const all = loadJSON('ft_users', {});
    return all[currentEmail].transactions || [];
  }
  function saveTransactions(txs) {
    const all = loadJSON('ft_users', {});
    all[currentEmail].transactions = txs;
    saveJSON('ft_users', all);
  }

  // initialize date default to today
  $('#tx-date').value = todayISO();

  // add transaction
  txForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = $('#tx-type').value;
    const amountRaw = $('#tx-amount').value;
    const amount = parseFloat(amountRaw);
    const category = $('#tx-category').value.trim() || 'Other';
    const date = $('#tx-date').value;
    const desc = $('#tx-desc').value.trim();

    if (!amount || isNaN(amount)) {
      showMessage('Please enter a valid amount.');
      return;
    }
    const tx = {
      id: 'tx_' + Date.now(),
      type,
      amount: Math.abs(amount),
      category,
      date,
      description: desc
    };
    const txs = getTransactions();
    txs.push(tx);
    saveTransactions(txs);
    txForm.reset();
    $('#tx-date').value = todayISO();
    renderAll();
  });

  // erase all
  eraseBtn.addEventListener('click', () => {
    if (!confirm('Erase ALL your transactions? This cannot be undone.')) return;
    saveTransactions([]);
    renderAll();
  });

  function deleteTx(id) {
    let txs = getTransactions();
    txs = txs.filter(t => t.id !== id);
    saveTransactions(txs);
    renderAll();
  }

  // Render functions
  let pieChart = null;
  let lineChart = null;

  function formatCurrency(num) {
    // show two decimals
    const n = Number(num) || 0;
    // RWF doesn't use decimals in practice; still show two decimals for clarity
    return n.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  function renderAll() {
    const txs = getTransactions();

    // totals
    let total = 0;
    let thisMonthIncome = 0;
    let thisMonthExpense = 0;

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth(); // 0-based
    txs.forEach(t => {
      if (t.type === 'income') total += Number(t.amount);
      else total -= Number(t.amount);

      const d = new Date(t.date);
      if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) {
        if (t.type === 'income') thisMonthIncome += Number(t.amount);
        else thisMonthExpense += Number(t.amount);
      }
    });

    totalBalanceEl.textContent = `RWF ${formatCurrency(total)}`;
    monthIncomeEl.textContent = `RWF ${formatCurrency(thisMonthIncome)}`;
    monthExpenseEl.textContent = `RWF ${formatCurrency(thisMonthExpense)}`;

    // recent transactions (sorted desc by date)
    const sorted = [...txs].sort((a,b) => new Date(b.date) - new Date(a.date));
    txTableBody.innerHTML = '';
    sorted.slice(0, 50).forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.type}</td>
        <td>${t.category}</td>
        <td>${t.description || ''}</td>
        <td class="amount">${t.type === 'expense' ? '-' : ''}RWF ${formatCurrency(t.amount)}</td>
        <td><button class="btn small" data-id="${t.id}">Delete</button></td>
      `;
      txTableBody.appendChild(tr);
    });

    // attach delete listeners
    txTableBody.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteTx(id);
      });
    });

    // Pie chart: spending by category (expenses) and incomes combined
    const categoryMap = {};
    txs.forEach(t => {
      const key = t.category || 'Other';
      const value = (t.type === 'expense') ? -Number(t.amount) : Number(t.amount);
      categoryMap[key] = (categoryMap[key] || 0) + value;
    });

    const categories = Object.keys(categoryMap);
    const catValues = categories.map(k => Math.abs(categoryMap[k])); // show absolute share

    // destroy old chart to avoid overlay
    if (pieChart) pieChart.destroy();
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: categories.length ? categories : ['No data'],
        datasets: [{
          data: categories.length ? catValues : [1],
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Line chart: balance trend from January to current month (this year)
    const months = [];
    const monthLabels = [];
    for (let m = 0; m <= thisMonth; m++) {
      const mm = new Date(thisYear, m, 1);
      monthLabels.push(mm.toLocaleString(undefined, { month: 'short' }));
      months.push(m);
    }

    // compute running balance at each month end
    const monthBalance = months.map(m => {
      // sum transactions up to end of this month
      const end = new Date(thisYear, m + 1, 1); // exclusive
      let bal = 0;
      txs.forEach(t => {
        const d = new Date(t.date);
        if (d < end) {
          bal += (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
        }
      });
      return bal;
    });

    if (lineChart) lineChart.destroy();
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'Balance',
          data: monthBalance,
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(val){
                return 'RWF ' + Number(val).toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  // initial render
  renderAll();
}
