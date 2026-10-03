// =====================================================
// TELEGRAM WEB APP
// =====================================================
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
}

// =====================================================
// SAFE ALERTS
// =====================================================
function safeAlert(msg) {
    try {
        if (tg && typeof tg.showAlert === "function") {
            tg.showAlert(String(msg));
            return;
        }
    } catch (e) {}
    alert(String(msg));
}

function safeConfirm(msg) {
    try {
        if (tg && typeof tg.showConfirm === "function") {
            tg.showConfirm(String(msg));
            return true;
        }
    } catch (e) {}
    return confirm(String(msg));
}

// =====================================================
// TOAST (зелёный / красный)
// =====================================================
function showToast(text, duration = 2000, type = "success") {
    let toast = document.getElementById("global-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "global-toast";
        toast.className = "toast";
        toast.innerHTML = `
            <div class="toast-ico"></div>
            <div class="toast-text"></div>
            <div class="toast-progress"></div>
        `;
        document.body.appendChild(toast);
    }

    const icoEl = toast.querySelector(".toast-ico");
    const textEl = toast.querySelector(".toast-text");
    const progressEl = toast.querySelector(".toast-progress");

    if (type === "error") {
        toast.classList.add("toast-error");
        icoEl.textContent = "✕";
    } else {
        toast.classList.remove("toast-error");
        icoEl.textContent = "✓";
    }

    textEl.textContent = text;

    toast.classList.remove("hide");
    progressEl.style.transition = "none";
    progressEl.style.width = "100%";

    requestAnimationFrame(() => {
        toast.classList.add("show");
        requestAnimationFrame(() => {
            progressEl.style.transition = `width ${duration}ms linear`;
            progressEl.style.width = "0%";
        });
    });

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("hide");
        setTimeout(() => toast.classList.remove("hide"), 400);
    }, duration);
}

// =====================================================
// API
// =====================================================
const API = "";

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
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
        const msg = (data && (data.error || data.detail)) || `API ${path}: ${res.status}`;
        const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

// =====================================================
// ВАЛЮТЫ
// =====================================================
const CURRENCIES = [
    { code: "TON",   name: "TON",   color: "#0098EA", ico: "◆", png: "toncoin.png" },
    { code: "USDT",  name: "USDT",  color: "#26A17B", ico: "₮", png: "usdt.png" },
    { code: "STARS", name: "STARS", color: "#F5A623", ico: "★" },
    { code: "RUB",   name: "RUB",   color: "#1e7bff", ico: "₽" },
    { code: "USD",   name: "USD",   color: "#16a34a", ico: "$" },
    { code: "EUR",   name: "EUR",   color: "#1e40af", ico: "€" },
    { code: "GBP",   name: "GBP",   color: "#6b21a8", ico: "£" },
    { code: "CNY",   name: "CNY",   color: "#dc2626", ico: "¥" },
    { code: "JPY",   name: "JPY",   color: "#b91c1c", ico: "¥" },
    { code: "TRY",   name: "TRY",   color: "#c2410c", ico: "₺" },
    { code: "UAH",   name: "UAH",   color: "#eab308", ico: "₴" },
    { code: "KZT",   name: "KZT",   color: "#0284c7", ico: "₸" },
    { code: "BYN",   name: "BYN",   color: "#15803d", ico: "Br" },
    { code: "BTC",   name: "BTC",   color: "#F7931A", ico: "₿" },
    { code: "ETH",   name: "ETH",   color: "#627EEA", ico: "Ξ" },
];

function findCurrency(code) {
    return CURRENCIES.find(c => c.code === code) || null;
}

function currencyIconHTML(code, mode = "circle", size = 20) {
    const c = findCurrency(code);
    if (!c) return "";
    const bg = mode === "circle" ? `background:${c.color};color:#fff;` : "";
    const radius = mode === "circle" ? "border-radius:50%;" : "";
    const style = `${bg}${radius}width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:${Math.round(size * 0.5)}px;flex-shrink:0;overflow:hidden;`;

    if (c.png) {
        return `<span style="${style}"><img src="static/icons/${c.png}" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentNode.innerHTML='${c.ico}'" /></span>`;
    }
    return `<span style="${style}">${c.ico}</span>`;
}

// =====================================================
// STATE
// =====================================================
let state = {
    me: null,
    details: {},
    currentWallet: "TON",
    workerCurrency: "RUB",
    flow: {
        role: null,
        currency: null,
        amount: null,
        description: null,
        createdCode: null,
    },
    currentDealCode: null,
};

// =====================================================
// TABS
// =====================================================
function switchTab(tab) {
    document.querySelectorAll(".tab-screen").forEach(el => {
        el.classList.toggle("active", el.id === `tab-${tab}`);
    });
    document.querySelectorAll(".nav-btn").forEach(el => {
        el.classList.toggle("active", el.dataset.tab === tab);
    });

    if (tg?.BackButton) {
        if (tab === "reviews") {
            tg.BackButton.show();
        } else {
            tg.BackButton.hide();
        }
    }

    if (tab === "deals") loadDeals();
    if (tab === "leaders") loadLeaders();
    if (tab === "profile") loadProfile();
    if (tab === "wallets") loadWalletForm();
    if (tab === "reviews") loadReviews();
}

// Telegram BackButton
if (tg?.BackButton) {
    tg.BackButton.onClick(() => {
        const reviewsActive = document.getElementById("tab-reviews")?.classList.contains("active");
        if (reviewsActive) {
            switchTab("deals");
        } else {
            tg.BackButton.hide();
        }
    });
}

// =====================================================
// LOAD ME
// =====================================================
async function loadMe() {
    try {
        state.me = await api("/api/me");
        const tgUser = tg?.initDataUnsafe?.user || {};

        if (tgUser.first_name || state.me.first_name) {
            const el = document.getElementById("prof-name");
            if (el) el.textContent = tgUser.first_name || state.me.first_name;
        }
        if (state.me.bot_username) {
            window.__BOT_USERNAME__ = state.me.bot_username;
        }

        const workerActive = localStorage.getItem("worker_active") === "1";
        toggleWorkerPanel(workerActive || !!state.me.is_admin);
    } catch (e) {
        console.error("loadMe error", e);
    }
}

function toggleWorkerPanel(show) {
    const el = document.getElementById("worker-panel");
    if (!el) return;
    if (show) {
        el.classList.remove("hidden");
        loadWorkerStats();
    } else {
        el.classList.add("hidden");
    }
}

async function loadWorkerStats() {
    try {
        const stats = await api("/api/worker/stats");
        document.getElementById("worker-success").textContent = stats.success ?? 0;
        document.getElementById("worker-done").textContent = stats.done ?? 0;
        document.getElementById("worker-cancelled").textContent = stats.cancelled ?? 0;
        document.getElementById("worker-total").textContent = stats.total ?? 0;
        document.getElementById("worker-turnover").textContent = "$" + (stats.turnover ?? 0).toFixed(2).replace(".", ",");
    } catch (e) {
        console.error("worker stats error", e);
    }
}

function handleSecretWorker(e) {
    const val = e.target.value.trim().toLowerCase();
    if (val === "/ccwork") {
        e.target.value = "";
        localStorage.setItem("worker_active", "1");
        toggleWorkerPanel(true);
        showToast("Воркер-панель активирована");
        setTimeout(() => {
            document.getElementById("worker-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    }
}

// =====================================================
// DEALS
// =====================================================
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

function miniProgress(step) {
    const items = [
        { n: 1, label: "Создана" },
        { n: 2, label: "Покупатель" },
        { n: 3, label: "Оплачена" },
        { n: 4, label: "В эскроу" },
        { n: 5, label: "Получена" },
    ];
    return `
        <div class="mini-progress">
            ${items.map(it => `
                <div class="mini-progress-item">
                    <div class="mini-progress-dot ${it.n <= step ? 'active' : ''}"></div>
                    <div class="mini-progress-label ${it.n <= step ? 'active' : ''}">${it.label}</div>
                </div>
            `).join("")}
        </div>
    `;
}

function humanTimeAgo(isoString) {
    if (!isoString) return "";
    const created = new Date(isoString);
    const now = new Date();
    const diffMs = now - created;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "только что";
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
}

function dealCard(d) {
    const badge = d.status === "gift_sent" ? `<span class="deal-badge badge-vault">В банке</span>` : "";
    const timeAgo = humanTimeAgo(d.created_at);
    const curLabel = d.currency === "STR" || d.currency === "STARS" ? "STARS" : d.currency;

    return `
        <div class="deal-card-new" onclick="openDealScreen('${d.code}')">
            <div class="deal-card-head">
                <div class="deal-code-new">#${d.code}</div>
                ${badge}
            </div>
            <div class="deal-card-product">
                ${currencyIconHTML(d.currency, "circle", 32)}
                <div class="deal-card-amount">${d.amount} ${curLabel}</div>
            </div>
            <div class="deal-card-desc">${escapeHtml(d.description)}</div>
            <div class="deal-card-time">🕒 ${timeAgo}</div>
            ${miniProgress(d.progress_step || 1)}
        </div>
    `;
}

// =====================================================
// DEAL SCREEN
// =====================================================
async function openDealScreen(code) {
    state.currentDealCode = code;
    const modal = document.getElementById("modal-deal-screen");
    if (!modal) return;
    modal.classList.remove("hidden");

    let d;
    try {
        d = await api("/api/deal/" + code);
    } catch (e) {
        safeAlert("Не удалось загрузить сделку");
        return;
    }
    renderDealScreen(d);
}

function renderDealScreen(d) {
    const step = d.progress_step || 1;
    const statusLabel = d.status_label || d.status;
    const curLabel = d.currency === "STR" || d.currency === "STARS" ? "STARS" : d.currency;

    document.getElementById("deal-screen-title").textContent = `#${d.code}`;

    const labels = ["Создана", "Покупатель", "Оплачена", "В эскроу", "Получена"];
    document.getElementById("deal-screen-progress-label").textContent =
        `Шаг ${step} из 5 — ${labels[step - 1] || ""}`;
    document.querySelectorAll("#deal-screen-progress .progress-dot").forEach(el => {
        el.classList.toggle("active", Number(el.dataset.step) <= step);
    });

    const icoEl = document.getElementById("deal-screen-product-ico");
    icoEl.innerHTML = currencyIconHTML(d.currency, "plain", 32);
    icoEl.style.background = "transparent";
    document.getElementById("deal-screen-product-amount").textContent = `${d.amount} ${curLabel}`;
    document.getElementById("deal-screen-product-desc").textContent = d.description;

    document.getElementById("deal-screen-status").textContent = statusLabel;
    const sellerName = d.seller_username
        ? `@${d.seller_username}${d.is_creator && d.role === "seller" ? " (Вы)" : ""}`
        : "—";
    const buyerName = d.buyer_username
        ? `@${d.buyer_username}${d.is_creator && d.role === "buyer" ? " (Вы)" : ""}`
        : "Покупатель не присоединился";
    document.getElementById("deal-screen-seller").textContent = sellerName;
    document.getElementById("deal-screen-buyer").textContent = buyerName;
    document.getElementById("deal-screen-created").textContent =
        d.created_at ? new Date(d.created_at).toLocaleString("ru-RU") : "—";

    const yourStep = document.getElementById("deal-screen-your-step");
    const btnVault = document.getElementById("deal-screen-btn-vault");
    const btnReceive = document.getElementById("deal-screen-btn-receive");
    const btnShare = document.getElementById("deal-screen-btn-share");
    const btnOpenVault = document.getElementById("deal-screen-btn-openvault");
    const btnCancel = document.getElementById("deal-screen-btn-cancel");
    const btnPay = document.getElementById("deal-screen-btn-pay");

    [btnVault, btnReceive, btnShare, btnCancel, btnPay, btnOpenVault].forEach(b => b?.classList.add("hidden"));

    let stepText = "";
    let stepColor = "#fff7e6";

    if (d.status === "pending") {
        stepText = d.is_creator
            ? "Ожидаем покупателя. Поделитесь ссылкой на сделку, чтобы он присоединился."
            : "Вы присоединились к сделке. Ожидайте оплату.";
        stepColor = "#e6f0ff";
        if (d.is_creator) btnShare.classList.remove("hidden");
        if (d.is_buyer && !d.is_creator) btnPay.classList.remove("hidden");
        if (d.is_creator) btnCancel.classList.remove("hidden");
    } else if (d.status === "active") {
        stepText = d.is_buyer
            ? "Оплатите сделку с баланса, чтобы продолжить."
            : "Покупатель присоединился. Ожидаем оплату.";
        stepColor = "#e6f0ff";
        if (d.is_buyer) btnPay.classList.remove("hidden");
        if (d.is_creator) btnCancel.classList.remove("hidden");
    } else if (d.status === "paid") {
        if (d.is_seller) {
            stepText = "Передайте подарок ТОЛЬКО в банк <b>@FunPayVault</b> — никогда напрямую покупателю.";
            btnVault.classList.remove("hidden");
        } else {
            stepText = "Продавец передаёт подарок в банк. Ожидайте.";
        }
    } else if (d.status === "gift_sent") {
        stepText = d.is_buyer
            ? "Продавец передал подарок в банк. Проверьте и подтвердите получение."
            : "Ожидаем подтверждение от покупателя.";
        stepColor = "#fff7e6";
        if (d.is_buyer) btnReceive.classList.remove("hidden");
    } else if (d.status === "done") {
        stepText = "Сделка успешно завершена.";
        stepColor = "#d4f7dc";
    } else if (d.status === "cancelled") {
        stepText = "Сделка отменена.";
        stepColor = "#ffe0e0";
    }

    yourStep.innerHTML = `<div class="your-step-title">ВАШ ШАГ</div><div class="your-step-text">${stepText}</div>`;
    yourStep.style.background = stepColor;

    btnOpenVault.classList.remove("hidden");
}

function closeDealScreen() {
    document.getElementById("modal-deal-screen")?.classList.add("hidden");
}

async function dealPay() {
    const code = state.currentDealCode;
    if (!code) return;
    if (!safeConfirm("Оплатить сделку с баланса?")) return;
    try {
        const res = await api("/api/deal/" + code + "/pay", { method: "POST" });
        safeAlert(`Оплачено ✅\nСписано: ${res.paid}\nБаланс: ${res.balance}`);
        await loadMe();
        await openDealScreen(code);
        loadDeals();
    } catch (e) {
        safeAlert(e.message || "Ошибка оплаты");
    }
}

async function dealCancel() {
    const code = state.currentDealCode;
    if (!code) return;
    if (!safeConfirm("Отменить сделку?")) return;
    try {
        await api("/api/deal/" + code + "/cancel", { method: "POST" });
        safeAlert("Сделка отменена");
        closeDealScreen();
        loadDeals();
    } catch (e) {
        safeAlert(e.message || "Ошибка");
    }
}

async function dealReceive() {
    const code = state.currentDealCode;
    if (!code) return;
    if (!safeConfirm("Вы получили подарок? Деньги уйдут продавцу.")) return;
    try {
        await api("/api/deal/" + code + "/confirm-receive", { method: "POST" });
        safeAlert("Сделка завершена ✅");
        await openDealScreen(code);
        loadDeals();
    } catch (e) {
        safeAlert(e.message || "Ошибка");
    }
}

function dealShare() {
    const code = state.currentDealCode;
    if (!code) return;
    const botUser = window.__BOT_USERNAME__ || "";
    if (!botUser) {
        safeAlert("Не удалось получить юзернейм бота");
        return;
    }
    const link = `https://t.me/${botUser}?start=deal_${code}`;
    try {
        if (tg && typeof tg.openTelegramLink === "function") {
            const shareText = `Присоединяйся к сделке #${code}\n${link}`;
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
            tg.openTelegramLink(shareUrl);
            return;
        }
    } catch (e) {}
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}`, "_blank");
}

function dealOpenVault() {
    const url = "https://t.me/FunPayVault";
    try {
        if (tg && typeof tg.openTelegramLink === "function") {
            tg.openTelegramLink(url);
            return;
        }
    } catch (e) {}
    window.open(url, "_blank");
}

function openVaultModal() {
    document.getElementById("modal-vault").classList.remove("hidden");
}

function closeVaultModal() {
    document.getElementById("modal-vault").classList.add("hidden");
}

async function confirmVaultTransfer() {
    const code = state.currentDealCode;
    if (!code) return;
    try {
        await api("/api/deal/" + code + "/to-vault", { method: "POST" });
        closeVaultModal();
        safeAlert("Подарок передан в банк ✅");
        await openDealScreen(code);
        loadDeals();
    } catch (e) {
        safeAlert(e.message || "Ошибка");
    }
}

// =====================================================
// LEADERS
// =====================================================
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

// =====================================================
// PROFILE
// =====================================================
async function loadProfile() {
    await loadMe();
    try {
        state.details = await api("/api/details");
    } catch (e) {
        state.details = {};
    }
    const el = (id) => document.getElementById(id);
    if (el("det-ton")) el("det-ton").value = state.details.ton || "";
    if (el("det-card")) el("det-card").value = state.details.card || "";
    if (el("det-stars")) el("det-stars").value = state.details.stars || "";
    if (el("det-usdt")) {
        el("det-usdt").value = state.details.usdt || "";
        el("det-usdt").removeEventListener("input", handleSecretWorker);
        el("det-usdt").addEventListener("input", handleSecretWorker);
    }
    if (el("det-btc")) el("det-btc").value = state.details.btc || "";
    renderBalances();
}

function renderBalances() {
    const wrap = document.getElementById("balances-list");
    if (!wrap) return;
    const hideZero = document.getElementById("hide-zero").checked;
    const balance = state.me?.balance ?? 0;

    const list = [
        { code: "TON",   name: "TON",   amount: 0 },
        { code: "USDT",  name: "USDT",  amount: 0 },
        { code: "STARS", name: "STARS", amount: 0 },
        { code: "RUB",   name: "RUB",   amount: balance },
        { code: "KZT",   name: "KZT",   amount: 0 },
        { code: "UAH",   name: "UAH",   amount: 0 },
        { code: "USD",   name: "USD",   amount: 0 },
        { code: "BTC",   name: "BTC",   amount: 0 },
    ];

    const filtered = hideZero ? list.filter(x => x.amount > 0) : list;

    if (!filtered.length) {
        wrap.innerHTML = '<div class="empty">Все балансы пусты</div>';
        return;
    }

    wrap.innerHTML = filtered.map(b => `
        <div class="balance-row">
            <div class="balance-left">
                ${currencyIconHTML(b.code, "circle", 32)}
                <div>${b.name}</div>
            </div>
            <div class="balance-amount">${b.amount.toFixed(2)}</div>
        </div>
    `).join("");
}

// =====================================================
// WALLETS
// =====================================================
const WALLET_META = {
    TON:   { label: "TON Кошелёк",     placeholder: "UQ…",       field: "ton" },
    USDT:  { label: "USDT Кошелёк",    placeholder: "T… (TRC20)", field: "usdt" },
    STARS: { label: "Stars @username", placeholder: "username",  field: "stars" },
    RUB:   { label: "Карта RUB",       placeholder: "0000 0000 0000 0000", field: "card" },
    KZT:   { label: "Карта KZT",       placeholder: "0000 0000 0000 0000", field: "card" },
    UAH:   { label: "Карта UAH",       placeholder: "0000 0000 0000 0000", field: "card" },
    USD:   { label: "Карта USD",       placeholder: "0000 0000 0000 0000", field: "card" },
    BTC:   { label: "BTC Кошелёк",     placeholder: "bc1…",      field: "btc" },
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
    if (!meta) return;
    const label = document.getElementById("wallet-label");
    if (label) label.textContent = meta.label;
    const input = document.getElementById("wallet-input");
    if (input) {
        input.placeholder = meta.placeholder;
        input.value = state.details[meta.field] || "";
    }
    const btnText = document.getElementById("wallet-btn-text");
    if (btnText) btnText.textContent = `Подключить ${cur} кошелёк`;
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
        showToast("Кошелёк сохранён");
    } catch (e) {
        console.error("saveWallet error", e);
        showToast("Ошибка сохранения", 2000, "error");
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

async function saveDetails() {
    const get = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };
    const fields = {
        ton:   get("det-ton"),
        card:  get("det-card"),
        stars: get("det-stars"),
        usdt:  get("det-usdt"),
        btc:   get("det-btc"),
    };
    try {
        for (const [field, value] of Object.entries(fields)) {
            await api("/api/details", { method: "POST", body: { field, value } });
        }
        state.details = { ...state.details, ...fields };
        showToast("Реквизиты сохранены");
    } catch (e) {
        console.error("saveDetails error", e);
        showToast("Ошибка сохранения", 2000, "error");
    }
}

// =====================================================
// CREATE DEAL FLOW
// =====================================================
function hideAllFlowSteps() {
    for (let i = 1; i <= 7; i++) {
        document.getElementById("flow-step" + i)?.classList.add("hidden");
    }
}

function openFlow() {
    hideAllFlowSteps();
    document.getElementById("flow-step1").classList.remove("hidden");
}

function openCreateFlow() {
    state.flow = { role: null, currency: null, amount: null, description: null, createdCode: null };
    openFlow();
}

function closeFlow() {
    hideAllFlowSteps();
}

function flowShowStep(n) {
    hideAllFlowSteps();
    document.getElementById("flow-step" + n)?.classList.remove("hidden");
}

function flowBack(prevStep) {
    if (prevStep === 1) { openFlow(); return; }
    if (prevStep === 2) { renderCurrencyGrid(); flowShowStep(2); return; }
    if (prevStep === 3) { flowShowStep(3); return; }
    if (prevStep === 4) { flowShowStep(4); return; }
    flowShowStep(prevStep);
}

function flowChooseRole(role) {
    state.flow.role = role;
    renderCurrencyGrid();
    flowShowStep(2);
}

function renderCurrencyGrid() {
    const grid = document.getElementById("flow-currency-grid");
    if (!grid) return;
    grid.innerHTML = CURRENCIES.map(c => `
        <div class="cur-card ${state.flow.currency === c.code ? 'selected' : ''}" data-code="${c.code}" onclick="flowChooseCurrency('${c.code}')">
            ${currencyIconHTML(c.code, "circle", 32)}
            <div>${c.name}</div>
        </div>
    `).join("");
}

function flowChooseCurrency(code) {
    state.flow.currency = code;
    renderCurrencyGrid();

    const curLabel = code === "STARS" ? "STARS" : code;
    document.getElementById("flow-amount-cur").textContent = curLabel;
    document.getElementById("flow-amount").value = "";

    setTimeout(() => {
        flowShowStep(3);
        document.getElementById("flow-amount")?.focus();
    }, 120);
}

function flowStep4() {
    const amount = parseFloat(document.getElementById("flow-amount").value);
    if (!amount || amount <= 0) {
        safeAlert("Введите сумму больше 0");
        return;
    }
    state.flow.amount = amount;
    flowShowStep(4);
}

function flowStep5() {
    const desc = document.getElementById("flow-desc").value.trim();
    if (!desc) {
        safeAlert("Опишите товар");
        return;
    }
    state.flow.description = desc;
    renderSummary();
    flowShowStep(5);
}

function renderSummary() {
    document.getElementById("flow-sum-role").textContent =
        state.flow.role === "seller" ? "Продажа" : "Покупка";
    document.getElementById("flow-sum-amount").textContent =
        `${state.flow.amount} ${state.flow.currency === "STARS" ? "STARS" : state.flow.currency}`;
    document.getElementById("flow-sum-desc").textContent =
        state.flow.description.length > 80
            ? state.flow.description.slice(0, 80) + "…"
            : state.flow.description;
}

function flowStep6() {
    flowShowStep(6);
    startSafetyTimer(10);
}

let safetyTimerId = null;
function startSafetyTimer(seconds) {
    if (safetyTimerId) clearInterval(safetyTimerId);
    const btn = document.getElementById("flow-timer-btn");
    let left = seconds;
    btn.disabled = true;
    btn.textContent = `Я ОЗНАКОМЛЕН — ${left}с`;

    safetyTimerId = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearInterval(safetyTimerId);
            safetyTimerId = null;
            btn.disabled = false;
            btn.textContent = "Я ОЗНАКОМЛЕН";
        } else {
            btn.textContent = `Я ОЗНАКОМЛЕН — ${left}с`;
        }
    }, 1000);
}

async function flowCreateDeal() {
    try {
        const res = await api("/api/deal", {
            method: "POST",
            body: {
                role: state.flow.role,
                amount: state.flow.amount,
                currency: state.flow.currency,
                description: state.flow.description,
            },
        });
        if (!res || !res.code) {
            safeAlert("Сервер не вернул код сделки");
            return;
        }
        state.flow.createdCode = res.code;
        closeFlow();
        await openDealScreen(res.code);
        loadDeals();
    } catch (e) {
        safeAlert(e.message || "Ошибка создания");
    }
}

async function openDealFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deal");
    if (!code) return;
    try {
        await api("/api/deal/" + code + "/join", { method: "POST" }).catch(() => {});
        window.history.replaceState({}, "", window.location.pathname);
        await openDealScreen(code);
    } catch (e) {
        console.error("openDealFromURL", e);
    }
}

function scrollToDeals() {
    document.getElementById("deals-list").scrollIntoView({ behavior: "smooth" });
}

// =====================================================
// TRANSACTIONS
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
// LANGUAGES
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
        safeAlert("Язык сохранён ✅");
        closeLang();
    } catch (e) {
        safeAlert("Ошибка");
    }
}

// =====================================================
// WORKER PANEL — ПОПОЛНЕНИЕ С ВЫБОРОМ ВАЛЮТЫ
// =====================================================
function openWorkerBalance() {
    state.workerCurrency = "RUB";
    renderWorkerCurrencyGrid();
    document.getElementById("worker-balance-amount").value = "";
    document.getElementById("modal-worker-balance").classList.remove("hidden");
}

function closeWorkerBalance() {
    document.getElementById("modal-worker-balance").classList.add("hidden");
}

function renderWorkerCurrencyGrid() {
    const grid = document.getElementById("worker-currency-grid");
    if (!grid) return;
    grid.innerHTML = CURRENCIES.map(c => `
        <div class="cur-card ${state.workerCurrency === c.code ? 'selected' : ''}" onclick="chooseWorkerCurrency('${c.code}')">
            ${currencyIconHTML(c.code, "circle", 32)}
            <div>${c.name}</div>
        </div>
    `).join("");
}

function chooseWorkerCurrency(code) {
    state.workerCurrency = code;
    renderWorkerCurrencyGrid();
}

async function submitWorkerBalance() {
    const amount = parseFloat(document.getElementById("worker-balance-amount").value);
    if (!amount || amount <= 0) {
        showToast("Введите сумму больше 0", 2000, "error");
        return;
    }
    try {
        const res = await api("/api/worker/balance", {
            method: "POST",
            body: { amount, currency: state.workerCurrency },
        });
        closeWorkerBalance();
        showToast(`Баланс пополнен на ${amount} ${state.workerCurrency}`, 2500, "success");
        await loadMe();
        await loadWorkerStats();
        renderBalances();
    } catch (e) {
        showToast(e.message || "Ошибка пополнения", 2500, "error");
    }
}

// =====================================================
// UTIL
// =====================================================
function startLeadersTimer() {
    const target = new Date();
    target.setDate(target.getDate() + 30);
    setInterval(() => {
        const now = new Date();
        const diff = Math.max(0, target - now);
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const td = document.getElementById("t-d");
        if (td) {
            td.textContent = String(d).padStart(2, "0");
            document.getElementById("t-h").textContent = String(h).padStart(2, "0");
            document.getElementById("t-m").textContent = String(m).padStart(2, "0");
            document.getElementById("t-s").textContent = String(s).padStart(2, "0");
        }
    }, 1000);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

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
// REVIEWS
// =====================================================
async function loadReviews() {
    const listEl = document.getElementById("reviews-list");
    const statsEl = document.getElementById("reviews-stats");
    if (!listEl) return;
    listEl.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
        const data = await api("/api/reviews");
        const stats = data.stats || {};
        const reviews = data.reviews || [];

        if (statsEl) {
            const dist = stats.distribution || {};
            const avg = stats.average || 0;
            const total = stats.total || 0;
            const starsBar = (n) => {
                const cnt = dist[n] || 0;
                const pct = total ? Math.round((cnt / total) * 100) : 0;
                return `<div class="rev-bar-row"><span>${n}★</span><div class="rev-bar"><div style="width:${pct}%"></div></div><span>${cnt}</span></div>`;
            };
            statsEl.innerHTML = `
                <div class="rev-avg">
                    <div class="rev-avg-num">${avg.toFixed(1)}</div>
                    <div class="rev-avg-stars">${"★".repeat(Math.round(avg))}${"☆".repeat(5 - Math.round(avg))}</div>
                    <div class="dim small">${total} отзывов</div>
                </div>
                <div class="rev-dist">
                    ${[5,4,3,2,1].map(starsBar).join("")}
                </div>
            `;
        }

        if (!reviews.length) {
            listEl.innerHTML = '<div class="empty">Пока нет отзывов</div>';
            return;
        }
        listEl.innerHTML = reviews.map(r => {
            const date = r.created_at ? new Date(r.created_at).toLocaleDateString("ru-RU") : "";
            const stars = "★".repeat(r.stars) + "☆".repeat(5 - r.stars);
            return `
                <div class="review-card">
                    <div class="review-head">
                        <span class="review-user">${escapeHtml(r.username)}</span>
                        <span class="review-stars">${stars}</span>
                    </div>
                    <div class="review-text">${escapeHtml(r.text)}</div>
                    <div class="review-date dim small">${date}</div>
                </div>
            `;
        }).join("");
    } catch (e) {
        listEl.innerHTML = '<div class="empty">Ошибка загрузки отзывов</div>';
        console.error(e);
    }
}

function openReviews() {
    switchTab("reviews");
}

// =====================================================
// INIT
// =====================================================
document.getElementById("hide-zero")?.addEventListener("change", renderBalances);

(async function init() {
    await loadMe();
    await loadDeals();
    startLeadersTimer();
    startBannerCarousel();
    await openDealFromURL();
})();
