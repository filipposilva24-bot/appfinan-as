import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// Modo Offline
enableIndexedDbPersistence(db).catch(err => console.log("Erro offline:", err.code));

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeBtn = document.getElementById('theme-btn');
const privacyBtn = document.getElementById('privacy-btn');

const transactionForm = document.getElementById('transaction-form');
const transactionListMobile = document.getElementById('transaction-list-mobile');
const filterMonth = document.getElementById('filter-month');
const filterYear = document.getElementById('filter-year');
const dateInput = document.getElementById('date');

// Seletores Dinâmicos
const categorySelect = document.getElementById('category');
const vehiclesListContainer = document.getElementById('vehicles-list');
const categoryManageList = document.getElementById('category-manage-list');

// Modais
const modalCategory = document.getElementById('modal-category');
const modalVehicle = document.getElementById('modal-vehicle');
document.getElementById('btn-open-category-modal').addEventListener('click', () => modalCategory.classList.remove('hidden'));
document.getElementById('btn-open-vehicle-modal').addEventListener('click', () => modalVehicle.classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => { modalCategory.classList.add('hidden'); modalVehicle.classList.add('hidden'); }));

let currentUser = null;
let allTransactions = [];
let expenseChart = null;

dateInput.value = new Date().toISOString().split('T')[0];

// Privacidade e Tema (Como antes)
let isPrivacyOn = localStorage.getItem('privacy') === 'true';
function applyPrivacyBlur() {
    document.querySelectorAll('.amount-text').forEach(el => isPrivacyOn ? el.classList.add('privacy-blur') : el.classList.remove('privacy-blur'));
    privacyBtn.innerHTML = isPrivacyOn ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}
privacyBtn.addEventListener('click', () => { isPrivacyOn = !isPrivacyOn; localStorage.setItem('privacy', isPrivacyOn); applyPrivacyBlur(); });

if (localStorage.getItem('theme') === 'light') { document.body.classList.add('light-mode'); themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>'; }
themeBtn.addEventListener('click', () => { document.body.classList.toggle('light-mode'); const isL = document.body.classList.contains('light-mode'); localStorage.setItem('theme', isL ? 'light' : 'dark'); themeBtn.innerHTML = isL ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; });

// Abas de Navegação
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active')); tabContents.forEach(t => t.classList.remove('active'));
        item.classList.add('active'); document.getElementById(item.getAttribute('data-tab')).classList.add('active'); window.scrollTo(0,0);
    });
});

// API Moedas e PDF
async function fetchCurrencyRates() {
    try { const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL'); const data = await res.json(); document.getElementById('usd-rate').textContent = `R$ ${parseFloat(data.USDBRL.bid).toFixed(2)}`; document.getElementById('eur-rate').textContent = `R$ ${parseFloat(data.EURBRL.bid).toFixed(2)}`; } catch (e) {}
}
fetchCurrencyRates();
document.getElementById('export-pdf-btn').addEventListener('click', () => html2pdf().set({ margin: 0.5, filename: 'relatorio.pdf', html2canvas: { scale: 2 } }).from(document.getElementById('export-area')).save());

// ================= AUTENTICAÇÃO E INICIALIZAÇÃO =================
loginBtn.addEventListener('click', async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch(e){} });
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.add('hidden'); appScreen.classList.remove('hidden');
        document.getElementById('user-photo').src = user.photoURL; document.getElementById('profile-photo-large').src = user.photoURL;
        document.getElementById('user-name').textContent = user.displayName.split(' ')[0]; document.getElementById('profile-name').textContent = user.displayName;
        
        loadCategories(user.uid);
        loadVehicles(user.uid);
        loadTransactions(user.uid);
    } else {
        currentUser = null;
        authScreen.classList.remove('hidden'); appScreen.classList.add('hidden');
    }
});

// ================= GERENCIAMENTO DE CATEGORIAS =================
async function setupDefaultCategories(uid) {
    const defaults = ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Salário', 'Outros'];
    for (const cat of defaults) { await addDoc(collection(db, "categories"), { uid, name: cat }); }
}

function loadCategories(uid) {
    onSnapshot(query(collection(db, "categories"), where("uid", "==", uid)), (snapshot) => {
        if (snapshot.empty && !sessionStorage.getItem('catSetup')) {
            sessionStorage.setItem('catSetup', 'true');
            setupDefaultCategories(uid);
            return;
        }
        
        categorySelect.innerHTML = '';
        categoryManageList.innerHTML = '';
        
        snapshot.forEach(docSnap => {
            const cat = docSnap.data();
            
            // Adiciona no formulário
            const option = document.createElement('option');
            option.value = cat.name; option.textContent = cat.name;
            categorySelect.appendChild(option);
            
            // Adiciona na lista de gerenciamento (Modal)
            const li = document.createElement('li');
            li.className = 'manage-item';
            li.innerHTML = `<span>${cat.name}</span> <button class="btn-delete-icon" onclick="window.deleteCategory('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>`;
            categoryManageList.appendChild(li);
        });
    });
}

document.getElementById('btn-save-category').addEventListener('click', async () => {
    const name = document.getElementById('new-category-name').value.trim();
    if (name && currentUser) {
        await addDoc(collection(db, "categories"), { uid: currentUser.uid, name });
        document.getElementById('new-category-name').value = '';
    }
});

window.deleteCategory = async function(id) {
    if(confirm("Excluir esta categoria? Lançamentos antigos não serão apagados.")) await deleteDoc(doc(db, "categories", id));
}

// ================= GERENCIAMENTO DE VEÍCULOS =================
async function setupDefaultVehicles(uid) {
    await addDoc(collection(db, "vehicles"), { uid, name: 'Yamaha FZ25', type: 'motorcycle' });
    await addDoc(collection(db, "vehicles"), { uid, name: 'Carro Principal', type: 'car' });
}

function loadVehicles(uid) {
    onSnapshot(query(collection(db, "vehicles"), where("uid", "==", uid)), (snapshot) => {
        if (snapshot.empty && !sessionStorage.getItem('vehSetup')) {
            sessionStorage.setItem('vehSetup', 'true');
            setupDefaultVehicles(uid);
            return;
        }
        
        vehiclesListContainer.innerHTML = '';
        if (snapshot.empty) {
            vehiclesListContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:2rem;">Nenhum veículo cadastrado.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const veh = docSnap.data();
            const isMoto = veh.type === 'motorcycle';
            
            const div = document.createElement('div');
            div.className = 'vehicle-card';
            div.innerHTML = `
                <button class="btn-delete-vehicle" onclick="window.deleteVehicle('${docSnap.id}')"><i class="fa-solid fa-trash"></i></button>
                <div class="vehicle-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div class="vehicle-icon"><i class="fa-solid ${isMoto ? 'fa-motorcycle' : 'fa-car'}"></i></div>
                        <h3>${veh.name}</h3>
                    </div>
                </div>
                <div class="vehicle-stats">
                    <div class="stat-box"><span>Gasto no Mês</span><p class="amount-text" style="color:var(--expense);">R$ 0,00</p></div>
                    <div class="stat-box"><span>Status</span><p>Ativo</p></div>
                </div>
            `;
            vehiclesListContainer.appendChild(div);
        });
        applyPrivacyBlur();
    });
}

document.getElementById('btn-save-vehicle').addEventListener('click', async () => {
    const name = document.getElementById('new-vehicle-name').value.trim();
    const type = document.getElementById('new-vehicle-type').value;
    if (name && currentUser) {
        await addDoc(collection(db, "vehicles"), { uid: currentUser.uid, name, type });
        document.getElementById('new-vehicle-name').value = '';
        modalVehicle.classList.add('hidden');
    }
});

window.deleteVehicle = async function(id) {
    if(confirm("Excluir este veículo?")) await deleteDoc(doc(db, "vehicles", id));
}

// ================= TRANSAÇÕES =================
const hiddenType = document.getElementById('type');
document.querySelectorAll('input[name="type-radio"]').forEach(r => r.addEventListener('change', (e) => hiddenType.value = e.target.value));

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid, description: document.getElementById('description').value, amount: parseFloat(document.getElementById('amount').value),
            type: hiddenType.value, category: categorySelect.value, date: document.getElementById('date').value,
            isRecurring: document.getElementById('is-recurring').checked, createdAt: serverTimestamp()
        });
        transactionForm.reset(); document.querySelector('[data-tab="tab-home"]').click();
    } catch (e) { console.error(e); }
});

function loadTransactions(uid) {
    onSnapshot(query(collection(db, "transactions"), where("uid", "==", uid)), (snapshot) => {
        allTransactions = []; snapshot.forEach(doc => allTransactions.push({ id: doc.id, ...doc.data() })); applyFiltersAndRender();
    });
}

filterMonth.addEventListener('change', applyFiltersAndRender); filterYear.addEventListener('change', applyFiltersAndRender);

function applyFiltersAndRender() {
    const sMonth = filterMonth.value; const sYear = filterYear.value;
    const filtered = allTransactions.filter(tx => {
        if (!tx.date) return true; const [y, m] = tx.date.split('-'); return (sMonth === 'all' || m === sMonth) && (sYear === 'all' || y === sYear);
    });
    
    transactionListMobile.innerHTML = '';
    if (filtered.length === 0) transactionListMobile.innerHTML = `<p style="text-align:center; color: var(--text-muted);">Sem transações.</p>`;
    else {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15).forEach(tx => {
            const isInc = tx.type === 'income'; const div = document.createElement('div'); div.className = 'tx-item';
            div.innerHTML = `<div class="tx-left"><div class="tx-icon ${isInc ? 'income' : 'expense'}"><i class="fa-solid ${isInc ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div><div class="tx-info"><h4>${tx.description}</h4><span>${tx.category}</span></div></div><div class="tx-amount"><p class="amount-text" style="color: ${isInc ? 'var(--income)' : 'var(--text-color)'}">${isInc ? '+' : '-'} R$ ${tx.amount.toFixed(2)}</p><span class="del-btn" onclick="window.deleteTransaction('${tx.id}')">Excluir</span></div>`;
            transactionListMobile.appendChild(div);
        });
    }

    let inc = 0, exp = 0; filtered.forEach(tx => { if(tx.type === 'income') inc += tx.amount; else exp += tx.amount; });
    document.getElementById('total-balance').textContent = `R$ ${(inc - exp).toFixed(2)}`; document.getElementById('total-income').textContent = `R$ ${inc.toFixed(2)}`; document.getElementById('total-expense').textContent = `R$ ${exp.toFixed(2)}`;

    const expByCat = {}; filtered.forEach(tx => { if (tx.type === 'expense') expByCat[tx.category || 'Outros'] = (expByCat[tx.category || 'Outros'] || 0) + tx.amount; });
    
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    expenseChart = new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(expByCat), datasets: [{ data: Object.values(expByCat), backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } } });

    applyPrivacyBlur();
}

window.deleteTransaction = async function(id) { if(confirm("Excluir?")) await deleteDoc(doc(db, "transactions", id)); }
