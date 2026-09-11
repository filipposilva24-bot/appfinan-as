// ====== LÓGICA DO NOVO DESIGN MOBILE (Menu Abas) ======

// Navegação do Menu Inferior
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Remove active de todos
        navItems.forEach(n => n.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));
        
        // Adiciona active no clicado
        item.classList.add('active');
        const tabId = item.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // Rola pro topo
        window.scrollTo(0,0);
    });
});

// Atualizar a Foto e Nome no Perfil
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('profile-name').textContent = user.displayName;
        document.getElementById('profile-photo-large').src = user.photoURL || 'https://via.placeholder.com/90';
    }
});

// Sincronizar o Botão Rádio de Receita/Despesa com o campo Oculto
const radioType = document.querySelectorAll('input[name="type-radio"]');
const hiddenType = document.getElementById('type');
radioType.forEach(radio => {
    radio.addEventListener('change', (e) => {
        hiddenType.value = e.target.value;
    });
});

// SOBRESCREVER A FUNÇÃO RENDER TRANSACTIONS PARA O NOVO LAYOUT DE CARD
window.renderTransactions = function(transactions) {
    const mobileList = document.getElementById('transaction-list-mobile');
    mobileList.innerHTML = '';
    
    if (transactions.length === 0) {
        mobileList.innerHTML = `<p style="text-align:center; color: var(--text-muted); margin-top: 2rem;">Nenhuma transação neste período.</p>`;
        return;
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Exibir apenas as 10 últimas na home (opcional)
    const displayList = document.getElementById('tab-home').classList.contains('active') ? transactions.slice(0, 15) : transactions;

    displayList.forEach((tx) => {
        const isInc = tx.type === 'income';
        const formattedAmount = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedDate = tx.date ? tx.date.split('-').reverse().join('/') : '';
        const icon = isInc ? 'fa-arrow-up' : 'fa-basket-shopping'; // Ícone genérico
        
        const div = document.createElement('div');
        div.className = 'tx-item';
        div.innerHTML = `
            <div class="tx-left">
                <div class="tx-icon ${isInc ? 'income' : 'expense'}">
                    <i class="fa-solid ${isInc ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                </div>
                <div class="tx-info">
                    <h4>${tx.description}</h4>
                    <span>${tx.category} • ${formattedDate}</span>
                </div>
            </div>
            <div class="tx-amount">
                <p style="color: ${isInc ? 'var(--income)' : 'var(--text-color)'}">
                    ${isInc ? '+' : '-'} ${formattedAmount}
                </p>
                <span class="del-btn" onclick="window.deleteTransaction('${tx.id}')">Excluir</span>
            </div>
        `;
        mobileList.appendChild(div);
    });
}
