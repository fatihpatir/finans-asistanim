const storage = {
    get: (key, fallback) => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// --- State ---
let journal = storage.get('finans_v3_journal', []);
let portfolio = storage.get('finans_v3_portfolio', {
    fon: { lot: 0, cost: 0, price: 0 },
    bfren: { lot: 0, cost: 0, price: 0 }
});
let currentTheme = storage.get('finans_theme', 'theme-blue');

// Varsayılan günlük hedef %0.10
let TARGET_DAILY_RATE = storage.get('finans_v3_target_rate', 0.10);

// --- Init ---
function init() {
    applyTheme(currentTheme);
    setupNavigation();
    setupJournal();
    setupPortfolio();
    setupPWA();
    
    // Set default values
    document.getElementById('daily-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('target-rate-input').value = TARGET_DAILY_RATE;
    
    renderJournal();

    // Theme toggle
    document.getElementById('theme-toggle').onclick = () => {
        document.getElementById('theme-menu').classList.toggle('hidden');
    };
}

function applyTheme(theme) {
    document.body.className = `dark-theme ${theme}`;
    storage.set('finans_theme', theme);
}

window.setTheme = (theme) => {
    applyTheme(theme);
    document.getElementById('theme-menu').classList.add('hidden');
};

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById(`${tab}-page`).classList.remove('hidden');
        });
    });
}

// --- PWA Installation ---
let deferredPrompt;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('install-btn');
        if (installBtn) installBtn.classList.remove('hidden');
    });

    const installBtn = document.getElementById('install-btn');
    if (isIOS && installBtn) {
        installBtn.classList.remove('hidden');
    }

    if (installBtn) {
        installBtn.onclick = () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choice) => {
                    if (choice.outcome === 'accepted') installBtn.classList.add('hidden');
                    deferredPrompt = null;
                });
            } else if (isIOS) {
                showIOSGuide();
            }
        };
    }
}

function showIOSGuide() {
    const modal = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="ios-guide">
            <i class="ph ph-device-mobile-speaker" style="font-size:48px; color:var(--primary); margin-bottom:15px"></i>
            <h2>Ana Ekrana Ekle</h2>
            <p>Bu uygulamayı telefonunuza yüklemek için:</p>
            <div class="step"><div class="num">1</div><p>Tarayıcı altındaki <strong>Paylaş <i class="ph ph-export"></i></strong> butonuna dokunun.</p></div>
            <div class="step"><div class="num">2</div><p>Menüyü aşağı kaydırıp <strong>Ana Ekrana Ekle <i class="ph ph-plus-square"></i></strong> seçeneğini seçin.</p></div>
            <button class="btn-submit" onclick="document.getElementById('modal-container').classList.add('hidden')" style="margin-top:20px; padding:12px">Anladım</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

// --- Journal Logic ---
function setupJournal() {
    const saveBtn = document.getElementById('save-daily-btn');
    const targetInput = document.getElementById('target-rate-input');

    saveBtn.addEventListener('click', () => {
        const val = parseFloat(document.getElementById('daily-total-input').value);
        const date = document.getElementById('daily-date-input').value;

        if (!val || !date) return alert("Lütfen miktar ve tarih girin.");

        const entry = { date, value: val };
        
        const existing = journal.findIndex(j => j.date === date);
        if (existing > -1) journal[existing] = entry;
        else journal.unshift(entry);

        journal.sort((a, b) => new Date(b.date) - new Date(a.date));
        storage.set('finans_v3_journal', journal);
        
        renderJournal();
        document.getElementById('daily-total-input').value = '';
    });

    targetInput.addEventListener('input', () => {
        TARGET_DAILY_RATE = parseFloat(targetInput.value) || 0;
        storage.set('finans_v3_target_rate', TARGET_DAILY_RATE);
        renderJournal();
    });

    document.getElementById('global-reset-btn').onclick = () => {
        if (confirm("TÜM veriler silinecek. Emin misiniz?")) {
            localStorage.clear();
            location.reload();
        }
    };
    
    document.getElementById('close-modal').onclick = () => {
        document.getElementById('modal-container').classList.add('hidden');
    };
}

function renderJournal() {
    const list = document.getElementById('journal-list');
    const summaryContainer = document.getElementById('monthly-summary-container');
    list.innerHTML = '';
    summaryContainer.innerHTML = '';

    if (journal.length === 0) return;

    const now = new Date();
    const lastMonthEntries = journal.filter(j => {
        const d = new Date(j.date);
        return d.getMonth() === (now.getMonth() - 1 === -1 ? 11 : now.getMonth() - 1);
    });

    if (lastMonthEntries.length >= 2) {
        const first = lastMonthEntries[lastMonthEntries.length - 1].value;
        const last = lastMonthEntries[0].value;
        const profit = last - first;
        summaryContainer.innerHTML = `
            <div class="monthly-summary">
                <h4>Geçen Ayın Özeti</h4>
                <p>${formatCurrency(profit)} Kâr Ettiniz</p>
            </div>
        `;
    }

    journal.forEach((entry, index) => {
        let diffHTML = '';
        let targetHTML = '';

        if (index < journal.length - 1) {
            const prev = journal[index + 1].value;
            const diff = entry.value - prev;
            const isGain = diff >= 0;
            const percentDiff = ((diff / prev) * 100).toFixed(2);

            const targetGain = prev * (TARGET_DAILY_RATE / 100);
            const isAboveTarget = diff >= targetGain;

            diffHTML = `<div class="diff-box ${isGain ? 'gain' : 'loss'}">${isGain ? '+' : ''}${formatCurrency(diff)} (${isGain ? '+' : ''}${percentDiff}%)</div>`;
            
            targetHTML = `
                <div class="target-box ${isAboveTarget ? 'success' : 'fail'}">
                    Hedef: ${formatCurrency(targetGain)} | Durum: <span class="status">${isAboveTarget ? 'BAŞARILI' : 'DÜŞÜK'}</span>
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `
            <div class="log-main">
                <span class="log-date">${formatDate(entry.date)}</span>
                <span class="log-val">${formatCurrency(entry.value)}</span>
            </div>
            <div class="log-stats">
                ${diffHTML}
                ${targetHTML}
            </div>
        `;
        list.appendChild(div);
    });
}

// --- Portfolio Logic ---
function setupPortfolio() {
    const inputs = ['p-fon-lot', 'p-fon-cost', 'p-fon-price', 'p-bfren-lot', 'p-bfren-cost', 'p-bfren-price'];
    
    document.getElementById('p-fon-lot').value = portfolio.fon.lot || '';
    document.getElementById('p-fon-cost').value = portfolio.fon.cost || '';
    document.getElementById('p-fon-price').value = portfolio.fon.price || '';
    document.getElementById('p-bfren-lot').value = portfolio.bfren.lot || '';
    document.getElementById('p-bfren-cost').value = portfolio.bfren.cost || '';
    document.getElementById('p-bfren-price').value = portfolio.bfren.price || '';

    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updatePortfolioData();
            calculatePortfolio();
        });
    });

    calculatePortfolio();
}

function updatePortfolioData() {
    portfolio = {
        fon: {
            lot: parseFloat(document.getElementById('p-fon-lot').value) || 0,
            cost: parseFloat(document.getElementById('p-fon-cost').value) || 0,
            price: parseFloat(document.getElementById('p-fon-price').value) || 0
        },
        bfren: {
            lot: parseFloat(document.getElementById('p-bfren-lot').value) || 0,
            cost: parseFloat(document.getElementById('p-bfren-cost').value) || 0,
            price: parseFloat(document.getElementById('p-bfren-price').value) || 0
        }
    };
    storage.set('finans_v3_portfolio', portfolio);
}

function calculatePortfolio() {
    const fonVal = portfolio.fon.lot * portfolio.fon.price;
    const bfrenVal = portfolio.bfren.lot * portfolio.bfren.price;
    const total = fonVal + bfrenVal;

    document.getElementById('p-fon-value').innerText = formatCurrency(fonVal);
    document.getElementById('p-bfren-value').innerText = formatCurrency(bfrenVal);
    document.getElementById('p-total-value').innerText = formatCurrency(total);
}

// --- Helpers ---
function formatCurrency(val) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
}

function formatDate(dateStr) {
    const options = { day: 'numeric', month: 'short', weekday: 'short' };
    return new Date(dateStr).toLocaleDateString('tr-TR', options);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => console.log('SW Registered')).catch(err => console.log('SW Failed', err));
    }
}

init();
registerServiceWorker();
