import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCmCXpQq4fRPoF04f24F1-o3Q3pNWy4DI4",
    authDomain: "appfinancas-72e6f.firebaseapp.com",
    projectId: "appfinancas-72e6f",
    storageBucket: "appfinancas-72e6f.firebasestorage.app",
    messagingSenderId: "901423771145",
    appId: "1:901423771145:web:9573bc07940f2eef1512d8",
    measurementId: "G-M6RDXBJDH6"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos da UI
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeBtn = document.getElementById('theme-btn');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const dateInput = document.getElementById('date');
const budgetListEl = document.getElementById('budget-list');

let currentUser = null;
let unsubscribeTransactions = null;
let allTransactions = [];
let expenseChart = null;

// Tetos de Orçamento por Categoria (Metas mensais)
const categoryBudgets = {
    "Alimentação": 800,
    "Moradia": 1200,
    "Transporte": 400,
    "Lazer": 300,
    "Outros": 200
};

// Configurar Data Atual
dateInput.value = new Date().toISOString().split('T')[0];

// Gerenciar Tema (Claro / Escuro)
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    themeBtn.textContent = '☀️';
} else {
    themeBtn.textContent = '🌙';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeBtn.textContent = isLight ? '☀️' : '🌙';
});

// Consumir API de Indicadores Econômicos (AwesomeAPI)
async function fetchCurrencyRates() {
    try {
        const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
        const data = await response.json();
        document.getElementById('usd-rate').textContent = `USD: R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
        document.getElementById('eur-rate').textContent = `EUR: R$ ${parseFloat(data.EURBRL.bid).toFixed(2)}`;
    } catch (e) {
        document.getElementById('usd-rate').textContent = 'USD: Indisponível';
        document.getElementById('eur-rate').textContent = 'EUR: Indisponível';
    }
}
fetchCurrencyRates();

// Autenticação Google
loginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userPhoto.src = user.photoURL || 'https://via.placeholder.com/40';
        userName.textContent = user.displayName || 'Usuário';
        loadTransactions(user.uid);
    } else {
        currentUser = null;
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        if (unsubscribeTransactions) unsubscribeTransactions();
        transactionList.innerHTML = '';
        allTransactions = [];
    }
});

// Adicionar Transação (com suporte a Recorrência)
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const isRecurring = document.getElementById('is-recurring').checked;

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            description,
            amount,
            type,
            category,
            date,
            isRecurring,
            createdAt: serverTimestamp()
        });
        transactionForm.reset();
        dateInput.value = new Date().toISOString().split('T')[0];
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
});

function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        allTransactions = [];
        snapshot.forEach((doc) => {
            allTransactions.push({ id: doc.id, ...doc.data() });
        });
        applyFiltersAndRender();
    });
}

filterMonth.addEventListener('change', applyFiltersAndRender);
filterYear.addEventListener('change', applyFiltersAndRender);

function applyFiltersAndRender() {
    const selectedMonth = filterMonth.value;
    const selectedYear = filterYear.value;

    const filtered = allTransactions.filter(tx => {
        if (!tx.date) return true;
        const [year, month] = tx.date.split('-');
        const matchMonth = (selectedMonth === 'all' || month === selectedMonth);
        const matchYear = (selectedYear === 'all' || year === selectedYear);
        return matchMonth && matchYear;
    });

    renderTransactions(filtered);
    updateSummary(filtered);
    updateChart(filtered);
    updateBudgets(filtered);
}

function renderTransactions(transactions) {
    transactionList.innerHTML = '';
    if (transactions.length === 0) {
        transactionList.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma transação encontrada.</td></tr>`;
        return;
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    transactions.forEach((tx) => {
        const tr = document.createElement('tr');
        const formattedAmount = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedDate = tx.date ? tx.date.split('-').reverse().join('/') : '-';
        
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td>${tx.description}</td>
            <td><span class="badge-category">${tx.category || 'Outros'}</span></td>
            <td style="color: ${tx.type === 'income' ? 'var(--income)' : 'var(--expense)'}">${formattedAmount}</td>
            <td>${tx.type === 'income' ? 'Receita' : 'Despesa'} ${tx.isRecurring ? '<span class="badge-recurring">Fixa</span>' : ''}</td>
            <td><button class="btn-delete" onclick="window.deleteTransaction('${tx.id}')">Excluir</button></td>
        `;
        transactionList.appendChild(tr);
    });
}

window.deleteTransaction = async function(id) {
    if (confirm("Deseja realmente excluir?")) {
        try { await deleteDoc(doc(db, "transactions", id)); } catch (e) { console.error(e); }
    }
}

function updateSummary(transactions) {
    let income = 0, expense = 0;
    transactions.forEach(tx => {
        if (tx.type === 'income') income += tx.amount;
        else expense += tx.amount;
    });

    totalBalanceEl.textContent = (income - expense).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalIncomeEl.textContent = income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalExpenseEl.textContent = expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Atualizar Barras de Orçamento / Metas
function updateBudgets(transactions) {
    const expensesByCategory = {};
    transactions.forEach(tx => {
        if (tx.type === 'expense') {
            const cat = tx.category || 'Outros';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + tx.amount;
        }
    });

    budgetListEl.innerHTML = '';
    for (const [cat, limit] of Object.entries(categoryBudgets)) {
        const spent = expensesByCategory[cat] || 0;
        const percentage = Math.min(Math.round((spent / limit) * 100), 100);
        
        let statusClass = '';
        if (percentage >= 90) statusClass = 'danger';
        else if (percentage >= 75) statusClass = 'warning';

        budgetListEl.innerHTML += `
            <div class="budget-item">
                <div class="budget-info">
                    <span>${cat} (${spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ${limit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                    <span>${percentage}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }
}

function updateChart(transactions) {
    const expensesByCategory = {};
    transactions.forEach(tx => {
        if (tx.type === 'expense') {
            const cat = tx.category || 'Outros';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + tx.amount;
        }
    });

    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expensesByCategory),
            datasets: [{
                data: Object.values(expensesByCategory),
                backgroundColor: ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6', '#64748b'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-color'), font: { family: 'Inter', size: 11 } } }
            }
        }
    });
}
