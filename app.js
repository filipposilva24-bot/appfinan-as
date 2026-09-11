// Importando os SDKs do Firebase (versão 12.19.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

// Sua configuração oficial do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCmCXpQq4fRPoF04f24F1-o3Q3pNWy4DI4",
    authDomain: "appfinancas-72e6f.firebaseapp.com",
    projectId: "appfinancas-72e6f",
    storageBucket: "appfinancas-72e6f.firebasestorage.app",
    messagingSenderId: "901423771145",
    appId: "1:901423771145:web:9573bc07940f2eef1512d8",
    measurementId: "G-M6RDXBJDH6"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Elementos da UI
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const transactionForm = document.getElementById('transaction-form');
const transactionList = document.getElementById('transaction-list');
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');

let currentUser = null;
let unsubscribeTransactions = null;

// Autenticação com Google
loginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Erro no login:", error);
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

// Observador de Estado de Autenticação
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
    }
});

// Adicionar Transação
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;

    try {
        await addDoc(collection(db, "transactions"), {
            uid: currentUser.uid,
            description,
            amount,
            type,
            createdAt: serverTimestamp()
        });
        transactionForm.reset();
    } catch (error) {
        console.error("Erro ao adicionar transação: ", error);
    }
});

// Carregar Transações em Tempo Real (Firestore)
function loadTransactions(uid) {
    const q = query(collection(db, "transactions"), where("uid", "==", uid));
    
    unsubscribeTransactions = onSnapshot(q, (snapshot) => {
        let transactions = [];
        snapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        renderTransactions(transactions);
        updateSummary(transactions);
    });
}

// Renderizar Transações na Tabela
function renderTransactions(transactions) {
    transactionList.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhuma transação cadastrada.</td></tr>`;
        return;
    }

    transactions.forEach((tx) => {
        const tr = document.createElement('tr');
        const formattedAmount = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        tr.innerHTML = `
            <td>${tx.description}</td>
            <td style="color: ${tx.type === 'income' ? 'var(--income)' : 'var(--expense)'}">${formattedAmount}</td>
            <td>${tx.type === 'income' ? 'Receita' : 'Despesa'}</td>
            <td><button class="btn-delete" onclick="window.deleteTransaction('${tx.id}')">Excluir</button></td>
        `;
        transactionList.appendChild(tr);
    });
}

// Deletar Transação
window.deleteTransaction = async function(id) {
    if (confirm("Deseja realmente excluir esta transação?")) {
        try {
            await deleteDoc(doc(db, "transactions", id));
        } catch (error) {
            console.error("Erro ao deletar: ", error);
        }
    }
}

// Atualizar Resumo (Cards)
function updateSummary(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            income += tx.amount;
        } else {
            expense += tx.amount;
        }
    });

    const balance = income - expense;

    totalBalanceEl.textContent = balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalIncomeEl.textContent = income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    totalExpenseEl.textContent = expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
