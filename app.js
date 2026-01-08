// ============================================
// TELEGRAM WEBAPP INIT
// ============================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ============================================
// GAME STATE
// ============================================
let state = {
    balance: 0,
    clickValue: 1,
    totalClicks: 0,
    totalEarned: 0,
    level: 1,
    exp: 0,
    expToNext: 100,
    lastBonus: null,
    upgrades: {
        click: { level: 0, basePrice: 50 },
        auto: { level: 0, basePrice: 200 },
        multi: { level: 0, basePrice: 500 }
    }
};

// Данные улучшений
const upgradesData = [
    {
        id: 'click',
        name: 'Сила клика',
        icon: '👆',
        desc: '+1 к клику',
        effect: () => state.clickValue++
    },
    {
        id: 'auto',
        name: 'Автокликер',
        icon: '🤖',
        desc: '+1/сек автоматически',
        effect: () => {} // Обрабатывается отдельно
    },
    {
        id: 'multi',
        name: 'Множитель',
        icon: '✖️',
        desc: 'x2 к клику',
        effect: () => state.clickValue *= 2
    }
];

// ============================================
// LOAD/SAVE
// ============================================
const userId = tg.initDataUnsafe?.user?.id || 'guest';
const SAVE_KEY = `miniapp_${userId}`;

function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
        state = { ...state, ...JSON.parse(saved) };
    }
}

// ============================================
// UI UPDATE
// ============================================
function updateUI() {
    // User
    const user = tg.initDataUnsafe?.user;
    document.getElementById('userName').textContent = user?.first_name || 'Игрок';
    document.getElementById('userLevel').textContent = `Уровень ${state.level}`;
    
    // Balance
    document.getElementById('balance').textContent = formatNumber(state.balance);
    document.getElementById('clickValue').textContent = state.clickValue;
    
    // Stats
    document.getElementById('totalClicks').textContent = formatNumber(state.totalClicks);
    document.getElementById('totalEarned').textContent = formatNumber(state.totalEarned);
    document.getElementById('level').textContent = state.level;
    
    // Progress
    const expPercent = (state.exp / state.expToNext) * 100;
    document.getElementById('expProgress').style.width = `${expPercent}%`;
    document.getElementById('currentExp').textContent = state.exp;
    document.getElementById('expNeeded').textContent = state.expToNext;
    
    // Upgrades
    renderUpgrades();
    
    // Bonus timer
    updateBonusButton();
    
    saveGame();
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// ============================================
// CLICKER
// ============================================
function setupClicker() {
    const clicker = document.getElementById('clicker');
    
    clicker.addEventListener('click', (e) => {
        // Добавляем монеты
        state.balance += state.clickValue;
        state.totalClicks++;
        state.totalEarned += state.clickValue;
        
        // Добавляем опыт
        addExp(1);
        
        // Haptic feedback
        tg.HapticFeedback.impactOccurred('light');
        
        // Анимация монеты
        createFloatingCoin(e.clientX, e.clientY);
        
        updateUI();
    });
}

function createFloatingCoin(x, y) {
    const coin = document.createElement('div');
    coin.className = 'floating-coin';
    coin.textContent = `+${state.clickValue}`;
    coin.style.left = `${x}px`;
    coin.style.top = `${y}px`;
    coin.style.color = '#ffd700';
    
    document.getElementById('floatingCoins').appendChild(coin);
    
    setTimeout(() => coin.remove(), 1000);
}

// ============================================
// LEVEL SYSTEM
// ============================================
function addExp(amount) {
    state.exp += amount;
    
    while (state.exp >= state.expToNext) {
        state.exp -= state.expToNext;
        state.level++;
        state.expToNext = Math.floor(state.expToNext * 1.5);
        
        // Бонус за уровень
        const bonus = state.level * 25;
        state.balance += bonus;
        state.totalEarned += bonus;
        
        tg.HapticFeedback.notificationOccurred('success');
        showNotification(`🎉 Уровень ${state.level}! +${bonus} монет`);
    }
}

// ============================================
// UPGRADES
// ============================================
function renderUpgrades() {
    const container = document.getElementById('upgrades');
    container.innerHTML = upgradesData.map(upg => {
        const level = state.upgrades[upg.id].level;
        const price = getUpgradePrice(upg.id);
        const canBuy = state.balance >= price;
        
        return `
            <div class="upgrade" onclick="buyUpgrade('${upg.id}')">
                <div class="upgrade-info">
                    <span class="upgrade-icon">${upg.icon}</span>
                    <div>
                        <div class="upgrade-name">${upg.name}</div>
                        <div class="upgrade-desc">${upg.desc}</div>
                        <div class="upgrade-level">Уровень: ${level}</div>
                    </div>
                </div>
                <button class="btn btn-buy" ${!canBuy ? 'disabled' : ''}>
                    ${price} 💰
                </button>
            </div>
        `;
    }).join('');
}

function getUpgradePrice(id) {
    const upg = state.upgrades[id];
    return Math.floor(upg.basePrice * Math.pow(1.5, upg.level));
}

function buyUpgrade(id) {
    const price = getUpgradePrice(id);
    
    if (state.balance < price) {
        tg.HapticFeedback.notificationOccurred('error');
        document.querySelector('.balance').classList.add('shake');
        setTimeout(() => document.querySelector('.balance').classList.remove('shake'), 300);
        return;
    }
    
    state.balance -= price;
    state.upgrades[id].level++;
    
    // Применяем эффект
    const upgrade = upgradesData.find(u => u.id === id);
    upgrade.effect();
    
    tg.HapticFeedback.notificationOccurred('success');
    showNotification(`✅ ${upgrade.name} улучшен!`);
    
    updateUI();
}

// ============================================
// AUTO CLICKER
// ============================================
function startAutoClicker() {
    setInterval(() => {
        const autoLevel = state.upgrades.auto.level;
        if (autoLevel > 0) {
            state.balance += autoLevel;
            state.totalEarned += autoLevel;
            addExp(autoLevel);
            updateUI();
        }
    }, 1000);
}

// ============================================
// DAILY BONUS
// ============================================
function setupBonus() {
    document.getElementById('bonusBtn').addEventListener('click', claimBonus);
}

function claimBonus() {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 часа
    
    if (state.lastBonus && (now - state.lastBonus) < cooldown) {
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }
    
    const bonus = 100 + (state.level * 10);
    state.balance += bonus;
    state.totalEarned += bonus;
    state.lastBonus = now;
    
    addExp(50);
    tg.HapticFeedback.notificationOccurred('success');
    showNotification(`🎁 Бонус получен: +${bonus} монет!`);
    
    updateUI();
}

function updateBonusButton() {
    const btn = document.getElementById('bonusBtn');
    const timer = document.getElementById('bonusTimer');
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    
    if (state.lastBonus && (now - state.lastBonus) < cooldown) {
        btn.disabled = true;
        const remaining = cooldown - (now - state.lastBonus);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        timer.textContent = `Следующий через: ${hours}ч ${minutes}м`;
    } else {
        btn.disabled = false;
        const bonus = 100 + (state.level * 10);
        btn.textContent = `Получить +${bonus} 💰`;
        timer.textContent = '';
    }
}

// ============================================
// NOTIFICATIONS
// ============================================
function showNotification(text) {
    // Используем встроенное уведомление Telegram если возможно
    tg.showPopup({
        title: 'Уведомление',
        message: text,
        buttons: [{ type: 'ok' }]
    });
}

// ============================================
// INIT
// ============================================
function init() {
    loadGame();
    setupClicker();
    setupBonus();
    startAutoClicker();
    updateUI();
    
    // Обновление таймера каждую минуту
    setInterval(updateBonusButton, 60000);
    
    console.log('🎮 Game initialized!');
}

document.addEventListener('DOMContentLoaded', init);