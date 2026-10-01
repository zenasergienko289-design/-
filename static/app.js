// =====================================================
// TELEGRAM WEB APP
// =====================================================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// =====================================================
// API
// =====================================================
const API = "";  // тот же домен, откуда открыт фронт

function initData() {
    return tg?.initData || "";
}

async function api(path, opts = {}) {
    const headers = {
        "X-Init-Data": initData(),
        ...(opts.headers || {}),
    };
    if (opts.body && typeof opts.body === "object") {
        headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(API + path, { ...opts, headers });
    if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
    return res.json();
}

// =====================================================
// СОСТОЯНИЕ
// =====================================================
let state = {
    me: null,
    details: {},
    wallets: {},
    currentWallet: "TON",
};

// =====================================================
// ПЕРЕКЛЮЧЕНИЕ ТАБОВ
// =====================================================
function switchTab(tab) {
    document.querySelectorAll(".tab-screen").forEach(el => {
        el.classList.toggle("active", el.id === `tab-${tab}`);
    });
    document.querySelectorAll(".nav-btn").forEach(el => {
        el.classList.toggle("active", el.dataset.tab === tab);
    });
    if (tab === "deals") loadDeals();
    if (tab === "leaders") loadLeaders();
    if (tab === "profile") loadProfile();
    if (tab === "wallets") loadWalletForm();
}

// =====================================================
// ЗАГРУЗКА ДАННЫХ
// =====================================================
async function loadMe() {
    try {
        state.me = await api("/api/me");
        document.getElementById("prof-name").textContent =
            state.me.first_name || state.me.username || "Пользователь";
        document.getElementById("prof-id").textContent =
            (state.me.username ? "@" + state.me.username : "") +
            " · ID " + state.me.user_id;
    } catch (e) {
        console.error("loadMe error", e);
    }
}

async function loadDeals() {
    const el = document.getElementById("deals-list");
    el.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
        const deals = await api("/api/deals?status=active");
        if (!deals.length) {
            el.innerHTML = '<div class="empty">Нет активных сделок</div>';
            return;
        }
        el.innerHTML = deals.map(dealCard).join("");
    } catch (e) {
        el.innerHTML = '<div class="empty">Ошибка загрузки</div>';
    }
}

function dealCard(d) {
    const statusLabel = {
        pending: "Ожидает подтверждения",
        active: "Активна",
        paid: "Оплачена",
        gift_sent: "Товар отправлен",
        done: "Завершена",
        cancelled: "Отменена",
    }[d.status] || d.status;

    const statusClass = {
        done: "done",
        cancelled: "cancelled",
        active: "active",
        paid: "active",
        gift_sent: "active",
    }[d.status] || "";

    const cur = d.currency === "STR" ? "⭐" : d.currency;
    return `
        <div class="deal-card">
            <div class="deal-head">
                <div class="deal-code">#${d.code}</div>
                <div class="deal-amount">${d.amount} ${cur}</div>
            </div>
            <div class="deal-desc">${escapeHtml(d.description)}</div>
            <div class="deal-meta">
                <span>${d.role === "seller" ? "Продавец" : "Покупатель"}</span>
                <span class="deal-status ${statusClass}">${statusLabel}</span>
            </div>
        </div>
    `;
}

async function loadLeaders() {
    const el = document.getElementById("leaders-list");
    el.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
        const leaders = await api("/api/leaders");
        if (!leaders.length) {
            el.innerHTML = '<div class="empty">Пока нет данных</div>';
            return;
        }
        el.innerHTML = leaders.map((u, i) => `
            <div class="leader-row">
                <div><span class="pos">#${i + 1}</span>${escapeHtml(u.username || u.first_name)}</div>
                <div>${u.deals_count} сд.</div>
            </div>
        `).join("");
    } catch (e) {
        el.innerHTML = '<div class="empty">Ошибка загрузки</div>';
    }
}

async function loadProfile() {
    await loadMe();
    try {
        state.details = await api("/api/details");
    } catch (e) {
        state.details = {};
    }
    // Инпуты реквизитов
    document.getElementById("det-ton").value = state.details.ton || "";
    document.getElementById("det-card").value = state.details.card || "";
    document.getElementById("det-stars").value = state.details.stars || "";
    document.getElementById("det-usdt").value = state.details.usdt || "";
    document.getElementById("det-btc").value = state.details.btc || "";

    renderBalances();
}

function renderBalances() {
    const wrap = document.getElementById("balances-list");
    const hideZero = document.getElementById("hide-zero").checked;
    const balance = state.me?.balance ?? 0;

    const list = [
        { code: "TON",   name: "TON",   color: "#0098EA", ico: "◆", amount: 0 },
        { code: "USDT",  name: "USDT",  color: "#26A17B", ico: "₮", amount: 0 },
        { code: "STARS", name: "STARS", color: "#F5A623", ico: "★", amount: 0 },
        { code: "RUB",   name: "RUB",   color: "#1e7bff", ico: "₽", amount: balance },
        { code: "KZT",   name: "KZT",   color: "#0284c7", ico: "₸", amount: 0 },
        { code: "UAH",   name: "UAH",   color: "#eab308", ico: "₴", amount: 0 },
        { code: "USD",   name: "USD",   color: "#16a34a", ico: "$", amount: 0 },
        { code: "BTC",   name: "BTC",   color: "#F7931A", ico: "₿", amount: 0 },
    ];

    const filtered = hideZero ? list.filter(x => x.amount > 0) : list;

    if (!filtered.length) {
        wrap.innerHTML = '<div class="empty">Все балансы пусты</div>';
        return;
    }

    wrap.innerHTML = filtered.map(b => `
        <div class="balance-row">
            <div class="balance-left">
                <div class="balance-ico" style="background:${b.color}">${b.ico}</div>
                <div>${b.name}</div>
            </div>
            <div class="balance-amount">${b.amount.toFixed(2)}</div>
        </div>
    `).join("");
}

// =====================================================
// КОШЕЛЬКИ
// =====================================================
const WALLET_META = {
    TON:   { label: "TON Кошелёк",     placeholder: "UQ…",       ico: "💎", field: "ton" },
    USDT:  { label: "USDT Кошелёк",    placeholder: "T… (TRC20)", ico: "💵", field: "usdt" },
    STARS: { label: "Stars @username", placeholder: "username",  ico: "⭐", field: "stars" },
    RUB:   { label: "Карта RUB",        placeholder: "0000 0000 0000 0000", ico: "₽", field: "card" },
    KZT:   { label: "Карта KZT",        placeholder: "0000 0000 0000 0000", ico: "₸", field: "card" },
    UAH:   { label: "Карта UAH",        placeholder: "0000 0000 0000 0000", ico: "₴", field: "card" },
    USD:   { label: "Карта USD",        placeholder: "0000 0000 0000 0000", ico: "$", field: "card" },
    BTC:   { label: "BTC Кошелёк",     placeholder: "bc1…",      ico: "₿", field: "btc" },
};

async function loadWalletForm() {
    if (!Object.keys(state.details).length) {
        try { state.details = await api("/api/details"); } catch (e) {}
    }
    renderWalletForm();
}

function renderWalletForm() {
    const cur = state.currentWallet;
    const meta = WALLET_META[cur];
    document.getElementById("wallet-label").textContent = meta.label;
    const input = document.getElementById("wallet-input");
    input.placeholder = meta.placeholder;
    input.value = state.details[meta.field] || "";
    document.getElementById("wallet-ico").textContent = meta.ico;
    document.getElementById("wallet-btn-text").textContent = `Подключить ${cur} кошелёк`;
}

async function saveWallet() {
    const cur = state.currentWallet;
    const meta = WALLET_META[cur];
    const value = document.getElementById("wallet-input").value.trim();
    try {
        await api("/api/details", {
            method: "POST",
            body: { field: meta.field, value },
        });
        state.details[meta.field] = value;
        if (tg) tg.showAlert("Сохранено ✅");
    } catch (e) {
        if (tg) tg.showAlert("Ошибка сохранения");
    }
}

document.querySelectorAll(".cur-pill").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".cur-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.currentWallet = btn.dataset.cur;
        renderWalletForm();
    });
});

// =====================================================
// РЕКВИЗИТЫ (профиль)
// =====================================================
async function saveDetails() {
    const fields = {
        ton:   document.getElementById("det-ton").value.trim(),
        card:  document.getElementById("det-card").value.trim(),
        stars: document.getElementById("det-stars").value.trim(),
        usdt:  document.getElementById("det-usdt").value.trim(),
        btc:   document.getElementById("det-btc").value.trim(),
    };
    try {
        for (const [field, value] of Object.entries(fields)) {
            await api("/api/details", { method: "POST", body: { field, value } });
        }
        state.details = { ...state.details, ...fields };
        if (tg) tg.showAlert("Сохранено ✅");
    } catch (e) {
        if (tg) tg.showAlert("Ошибка сохранения");
    }
}

// =====================================================
// СОЗДАНИЕ СДЕЛКИ
// =====================================================
function openCreateDeal() {
    document.getElementById("modal-create").classList.remove("hidden");
}

function closeCreateDeal() {
    document.getElementById("modal-create").classList.add("hidden");
}

async function submitCreateDeal() {
    const role = document.getElementById("deal-role").value;
    const currency = document.getElementById("deal-currency").value;
    const amount = parseFloat(document.getElementById("deal-amount").value);
    const description = document.getElementById("deal-desc").value.trim();

    if (!amount || amount <= 0) {
        if (tg) tg.showAlert("Введите сумму");
        return;
    }
    if (!description) {
        if (tg) tg.showAlert("Введите описание");
        return;
    }

    try {
        const res = await api("/api/deal", {
            method: "POST",
            body: { role, amount, currency, description },
        });
        closeCreateDeal();
        if (tg) tg.showAlert(`Сделка #${res.code} создана ✅`);
        loadDeals();
    } catch (e) {
        if (tg) tg.showAlert("Ошибка создания");
    }
}

function scrollToDeals() {
    document.getElementById("deals-list").scrollIntoView({ behavior: "smooth" });
}

// =====================================================
// ТРАНЗАКЦИИ
// =====================================================
async function showTransactions() {
    document.getElementById("modal-tx").classList.remove("hidden");
    const el = document.getElementById("tx-list");
    el.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
        const txs = await api("/api/transactions");
        if (!txs.length) {
            el.innerHTML = '<div class="empty">Пока нет транзакций</div>';
            return;
        }
        el.innerHTML = txs.map(t => {
            const sign = t.amount >= 0 ? "+" : "";
            const cls = t.amount >= 0 ? "plus" : "minus";
            const date = t.created_at ? new Date(t.created_at).toLocaleDateString() : "";
            return `
                <div class="tx-row">
                    <div class="tx-info">
                        <div>${escapeHtml(t.comment || t.type)}</div>
                        <div class="tx-date">${date}</div>
                    </div>
                    <div class="tx-amount ${cls}">${sign}${t.amount.toFixed(2)} ${t.currency}</div>
                </div>
            `;
        }).join("");
    } catch (e) {
        el.innerHTML = '<div class="empty">Ошибка загрузки</div>';
    }
}

function closeTx() {
    document.getElementById("modal-tx").classList.add("hidden");
}

// =====================================================
// ЯЗЫКИ
// =====================================================
function showLangPicker() {
    document.getElementById("modal-lang").classList.remove("hidden");
}

function closeLang() {
    document.getElementById("modal-lang").classList.add("hidden");
}

async function setLang(lang) {
    try {
        await api("/api/lang", { method: "POST", body: { lang } });
        if (tg) tg.showAlert("Язык сохранён ✅");
        closeLang();
    } catch (e) {
        if (tg) tg.showAlert("Ошибка");
    }
}

// =====================================================
// ТАЙМЕР ЛИДЕРОВ
// =====================================================
function startLeadersTimer() {
    const target = new Date();
    target.setDate(target.getDate() + 30); // 30 дней вперёд
    setInterval(() => {
        const now = new Date();
        const diff = Math.max(0, target - now);
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        document.getElementById("t-d").textContent = String(d).padStart(2, "0");
        document.getElementById("t-h").textContent = String(h).padStart(2, "0");
        document.getElementById("t-m").textContent = String(m).padStart(2, "0");
        document.getElementById("t-s").textContent = String(s).padStart(2, "0");
    }, 1000);
}

// =====================================================
// УТИЛИТЫ
// =====================================================
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// =====================================================
// КАРУСЕЛЬ БАННЕРА
// =====================================================
function startBannerCarousel() {
    const slides = document.querySelectorAll(".banner-slide");
    const dots = document.querySelectorAll(".banner-dots .dot");
    if (slides.length < 2) return;

    let current = 0;
    setInterval(() => {
        slides[current].classList.remove("active");
        dots[current]?.classList.remove("active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("active");
        dots[current]?.classList.add("active");
    }, 5000);
}

// =====================================================
// СТАРТ
// =====================================================
document.getElementById("hide-zero").addEventListener("change", renderBalances);

(async function init() {
    await loadMe();
    await loadDeals();
    startLeadersTimer();
    startBannerCarousel();
})();