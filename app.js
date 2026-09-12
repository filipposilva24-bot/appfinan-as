import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

// Configuração oficial do Firebase
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

// === Elementos da UI ===
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeBtn = document.getElementById('theme-btn');

// Perfil
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const profilePhotoLarge = document.getElementById('profile-photo-large');
const profileName = document.getElementById('profile-name');

// Formulário e Resumos
const transactionForm = document.getElementById('transaction-form');
const transactionListMobile = document.getElementById('transaction-list-mobile');
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const dateInput = document.getElementById('date');
const budgetListEl = document.getElementById('budget-list');

// Variáveis de Estado
let currentUser = null;
let unsubscribeTransactions = null;
let allTransactions = [];
let expenseChart = null;

// Tetos de Orçamento por Categoria
const categoryBudgets = {
    "Alimentação": 800,
    "Moradia": 1200,
    "Transporte": 400,
    "Lazer": 300,
    "Outros": 200
};

// === Configurações Iniciais ===
dateInput.value = new Date().toISOString().split('T')[0];

const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
} else {
    themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

// === Navegação em Abas (Menu Inferior) ===
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        
        item.classList.add('active');
        const tabId = item.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        window.scrollTo(0,0);
    });
});

// === API de Moedas (AwesomeAPI) ===
async function fetchCurrencyRates() {
    try {
        const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
        const data = await response.json();
        document.getElementById('usd-rate').textContent = `R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
        document.getElementById('eur-rate').textContent = `R$ ${parseFloat(data.EURBRL.bid).toFixed(2)}`;
    } catch (e) {
        document.getElementById('usd-rate').textContent = 'Indisponível';
        document.getElementById('eur-rate').textContent = 'Indisponível';
    }
}
fetchCurrencyRates();

// === Autenticação ===
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
        
        // Popular dados do usuário em ambas as telas (Home e Perfil)
        const photo = user.photoURL || 'https://via.placeholder.com/90';
        const name = user.displayName || 'Usuário';
        
        userPhoto.src = photo;
        userName.textContent = name.split(' ')[0]; // Pega só o primeiro nome pra home
        profilePhotoLarge.src = photo;
        profileName.textContent = name;
        
        loadTransactions(user.uid);
    } else {
        currentUser = null;
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        if (unsubscribeTransactions) unsubscribeTransactions();
        transactionListMobile.innerHTML = '';
        allTransactions = [];
    }
});

// === Sincronizar Rádio de Tipo com Campo Oculto ===
const radioType = document.querySelectorAll('input[name="type-radio"]');
const hiddenType = document.getElementById('type');
radioType.forEach(radio => {
    radio.addEventListener('change', (e) => {
        hiddenType.value = e.target.value;
    });
});

// === Adicionar Transação ===
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = hiddenType.value; // Pega o valor do radio selecionado
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
        
        // Voltar para a Home após salvar com sucesso
        document.querySelector('[data-tab="tab-home"]').click();
        
    } catch (e) {
        console.error("Erro ao salvar:", e);
    }
});

// === Carregar e Filtrar Dados ===
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
    updateBudgets(filtered);
    updateChart(filtered);
}

// === Renderizar Lista de Transações (Mobile Estilo App) ===
window.renderTransactions = function(transactions) {
    transactionListMobile.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionListMobile.innerHTML = `<p style="text-align:center; color: var(--text-muted); margin-top: 2rem;">Nenhuma transação neste período.</p>`;
        return;
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    transactions.forEach((tx) => {
        const isInc = tx.type === 'income';
        const formattedAmount = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedDate = tx.date ? tx.date.split('-').reverse().join('/') : '';
        
        const div = document.createElement('div');
        div.className = 'tx-item';
        div.innerHTML = `
            <div class="tx-left">
                <div class="tx-icon ${isInc ? 'income' : 'expense'}">
                    <i class="fa-solid ${isInc ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="tx-info">
                    <h4>${tx.description}</h4>
                    <span>${tx.category} • ${formattedDate} ${tx.isRecurring ? '🔄' : ''}</span>
                </div>
            </div>
            <div class="tx-amount">
                <p style="color: ${isInc ? 'var(--income)' : 'var(--text-color)'}">
                    ${isInc ? '+' : '-'} ${formattedAmount}
                </p>
                <span class="del-btn" onclick="window.deleteTransaction('${tx.id}')">Excluir</span>
            </div>
        `;
        transactionListMobile.appendChild(div);
    });
}

// === Deletar Transação ===
window.deleteTransaction = async function(id) {
    if (confirm("Deseja realmente excluir?")) {
        try { await deleteDoc(doc(db, "transactions", id)); } catch (e) { console.error(e); }
    }
}

// === Atualizar Card de Saldo ===
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

// === Atualizar Metas de Orçamento ===
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

// === Gráfico em Rosca (Chart.js) ===
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
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { color: getComputedStyle(document.body).getPropertyValue('--text-muted'), font: { family: 'Inter', size: 12 } } 
                }
            }
        }
    });
}
