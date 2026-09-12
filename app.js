import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
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

// 1. MODO OFFLINE (Firestore Persistence)
enableIndexedDbPersistence(db).catch((err) => {
    console.log("Erro no modo offline:", err.code);
});

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeBtn = document.getElementById('theme-btn');
const privacyBtn = document.getElementById('privacy-btn'); // Novo botão

const transactionForm = document.getElementById('transaction-form');
const transactionListMobile = document.getElementById('transaction-list-mobile');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const dateInput = document.getElementById('date');

let currentUser = null;
let unsubscribeTransactions = null;
let allTransactions = [];
let expenseChart = null;

const categoryBudgets = { "Alimentação": 800, "Moradia": 1200, "Transporte": 400, "Veículo": 500, "Lazer": 300, "Outros": 200 };

dateInput.value = new Date().toISOString().split('T')[0];

// 2. MODO PRIVACIDADE (Esconde saldos)
let isPrivacyOn = localStorage.getItem('privacy') === 'true';

function applyPrivacyBlur() {
    const amountElements = document.querySelectorAll('.amount-text');
    amountElements.forEach(el => {
        if(isPrivacyOn) el.classList.add('privacy-blur');
        else el.classList.remove('privacy-blur');
    });
    privacyBtn.innerHTML = isPrivacyOn ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}

privacyBtn.addEventListener('click', () => {
    isPrivacyOn = !isPrivacyOn;
    localStorage.setItem('privacy', isPrivacyOn);
    applyPrivacyBlur();
});

// Tema
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') { document.body.classList.add('light-mode'); themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>'; }

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeBtn.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

// Abas Navegação
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(item.getAttribute('data-tab')).classList.add('active');
        window.scrollTo(0,0);
    });
});

// 3. EXPORTAR PDF
document.getElementById('export-pdf-btn').addEventListener('click', () => {
    const element = document.getElementById('export-area');
    const opt = {
        margin: 0.5,
        filename: 'meu-relatorio-financeiro.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

async function fetchCurrencyRates() {
    try {
        const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
        const data = await res.json();
        document.getElementById('usd-rate').textContent = `R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`;
        document.getElementById('eur-rate').textContent = `R$ ${parseFloat(data.EURBRL.bid).toFixed(2)}`;
    } catch (e) {}
}
fetchCurrencyRates();

loginBtn.addEventListener('click', async () => { const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); } catch(e){} });
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.add('hidden'); appScreen.classList.remove('hidden');
        document.getElementById('user-photo').src = user.photoURL || '';
        document.getElementById('profile-photo-large').src = user.photoURL || '';
        document.getElementById('user-name').textContent = user.displayName.split(' ')[0];
        document.getElementById('profile-name').textContent = user.displayName;
        loadTransactions(user.uid);
    } else {
        currentUser = null;
        authScreen.classList.remove('hidden'); appScreen.classList.add('hidden');
    }
});

const radioType = document.querySelectorAll('input[name="type-radio"]');
const hiddenType = document.getElementById('type');
radioType.forEach(radio => radio.addEventListener('change', (e) => hiddenType.value = e.target.value));

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            type: hiddenType.value,
            category: document.getElementById('category').value,
            date: document.getElementById('date').value,
            isRecurring: document.getElementById('is-recurring').checked,
            createdAt: serverTimestamp()
        });
        transactionForm.reset();
        document.querySelector('[data-tab="tab-home"]').click();
    } catch (e) { console.error(e); }
});

function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        allTransactions = [];
        snapshot.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() }));
        applyFiltersAndRender();
    });
}

filterMonth.addEventListener('change', applyFiltersAndRender);
filterYear.addEventListener('change', applyFiltersAndRender);

function applyFiltersAndRender() {
    const sMonth = filterMonth.value; const sYear = filterYear.value;
    const filtered = allTransactions.filter(tx => {
        if (!tx.date) return true;
        const [y, m] = tx.date.split('-');
        return (sMonth === 'all' || m === sMonth) && (sYear === 'all' || y === sYear);
    });
    renderTransactions(filtered); updateSummary(filtered); updateBudgets(filtered); updateChart(filtered);
    applyPrivacyBlur(); // Garante que a privacidade seja aplicada nos novos elementos rendenrizados
}

window.renderTransactions = function(transactions) {
    transactionListMobile.innerHTML = '';
    if (transactions.length === 0) { transactionListMobile.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Sem transações.</p>`; return; }
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15).forEach(tx => {
        const isInc = tx.type === 'income';
        const div = document.createElement('div');
        div.className = 'tx-item';
        div.innerHTML = `
            <div class="tx-left">
                <div class="tx-icon ${isInc ? 'income' : 'expense'}"><i class="fa-solid ${isInc ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                <div class="tx-info"><h4>${tx.description}</h4><span>${tx.category}</span></div>
            </div>
            <div class="tx-amount">
                <p class="amount-text" style="color: ${isInc ? 'var(--income)' : 'var(--text-color)'}">${isInc ? '+' : '-'} R$ ${tx.amount.toFixed(2)}</p>
                <span class="del-btn" onclick="window.deleteTransaction('${tx.id}')">Excluir</span>
            </div>
        `;
        transactionListMobile.appendChild(div);
    });
}

window.deleteTransaction = async function(id) { if(confirm("Excluir?")) await deleteDoc(doc(db, "transactions", id)); }

function updateSummary(transactions) {
    let inc = 0, exp = 0;
    transactions.forEach(tx => { if(tx.type === 'income') inc += tx.amount; else exp += tx.amount; });
    document.getElementById('total-balance').textContent = `R$ ${(inc - exp).toFixed(2)}`;
    document.getElementById('total-income').textContent = `R$ ${inc.toFixed(2)}`;
    document.getElementById('total-expense').textContent = `R$ ${exp.toFixed(2)}`;
}

function updateBudgets(transactions) {
    const expByCat = {};
    transactions.forEach(tx => { if (tx.type === 'expense') expByCat[tx.category || 'Outros'] = (expByCat[tx.category || 'Outros'] || 0) + tx.amount; });
    const bl = document.getElementById('budget-list'); bl.innerHTML = '';
    for (const [cat, limit] of Object.entries(categoryBudgets)) {
        const spent = expByCat[cat] || 0; const pct = Math.min(Math.round((spent/limit)*100), 100);
        bl.innerHTML += `<div class="budget-item"><div class="budget-info"><span>${cat}</span><span class="amount-text">${pct}%</span></div><div class="progress-bar"><div class="progress-fill ${pct>=90?'danger':pct>=75?'warning':''}" style="width:${pct}%"></div></div></div>`;
    }
}

function updateChart(transactions) {
    const expByCat = {};
    transactions.forEach(tx => { if (tx.type === 'expense') expByCat[tx.category || 'Outros'] = (expByCat[tx.category || 'Outros'] || 0) + tx.amount; });
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(expByCat), datasets: [{ data: Object.values(expByCat), backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });
}
