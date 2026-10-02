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
// СОСТОЯНИЕ
// =====================================================
let state = {
    me: null,
    details: {},
    currentWallet: "TON",
    // flow создания сделки
    flow: {
        role: null,
        currency: null,
        amount: null,
        description: null,
        createdCode: null,
    },
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
    if (tab === "reviews") loadReviews();
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
        if (state.me.bot_username) {
            window.__BOT_USERNAME__ = state.me.bot_username;
        }
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
        pending: "Ожидает",
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
        <div class="deal-card clickable" onclick="openDealDetail('${d.code}')">
            <div class="deal-head">
                <div class="deal-code">#${d.code}</div>
                <div class="deal-amount">${d.amount} ${cur}</div>
            </div>
            <div class="deal-desc">${escapeHtml(d.description)}</div>
            <div class="deal-meta">
                <span>${d.role === "seller" ? "Вы продавец" : "Вы покупатель"}</span>
                <span class="deal-status ${statusClass}">${statusLabel}</span>
            </div>
        </div>
    `;
}

async function openDealDetail(code) {
    const modal = document.getElementById("modal-deal");
    const body = document.getElementById("deal-detail-body");
    if (!modal || !body) return;
    modal.classList.remove("hidden");
    body.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
        const d = await api("/api/deal/" + code);
        const cur = d.currency === "STR" ? "⭐" : d.currency;
        const statusLabel = {
            pending: "Ожидает участника",
            active: "Активна",
            paid: "Оплачена",
            gift_sent: "Товар отправлен",
            done: "Завершена",
            cancelled: "Отменена",
        }[d.status] || d.status;

        const canPay = d.is_buyer && (d.status === "pending" || d.status === "active");
        const canCancel = d.is_creator && (d.status === "pending" || d.status === "active");
        const canJoin = !d.is_creator && !d.is_buyer && !d.is_seller &&
                        (d.status === "pending" || d.status === "active");

        let linkHtml = "";
        const botUser = window.__BOT_USERNAME__ || "";
        if (botUser) {
            const link = `https://t.me/${botUser}?start=deal_${d.code}`;
            linkHtml = `
                <div class="input-group">
                    <label>Ссылка для второй стороны</label>
                    <input id="deal-share-link" readonly value="${link}" onclick="this.select()" />
                </div>
                <button class="btn btn-white big" onclick="copyDealLink()">📋 Скопировать ссылку</button>
            `;
        }

        body.innerHTML = `
            <div class="deal-detail-amount">${d.amount} ${cur}</div>
            <div class="deal-status ${d.status === "done" ? "done" : d.status === "cancelled" ? "cancelled" : "active"}" style="margin-bottom:12px">${statusLabel}</div>
            <div class="deal-desc" style="margin-bottom:12px">${escapeHtml(d.description)}</div>
            <div class="dim small" style="margin-bottom:8px">Роль при создании: ${d.role === "seller" ? "продавец" : "покупатель"}</div>
            ${linkHtml}
            ${canJoin ? `<button class="btn btn-blue big" onclick="joinDeal('${d.code}')">🤝 Присоединиться</button>` : ""}
            ${canPay ? `<button class="btn btn-blue big" onclick="payDeal('${d.code}')">💳 Оплатить с баланса</button>` : ""}
            ${canCancel ? `<button class="btn btn-white big" onclick="cancelDeal('${d.code}')">❌ Отменить сделку</button>` : ""}
            <button class="btn btn-white big" onclick="closeDealDetail()">Закрыть</button>
        `;
    } catch (e) {
        body.innerHTML = `<div class="empty">${escapeHtml(e.message || "Ошибка")}</div>
            <button class="btn btn-white big" onclick="closeDealDetail()">Закрыть</button>`;
    }
}

function closeDealDetail() {
    document.getElementById("modal-deal")?.classList.add("hidden");
}

function copyDealLink() {
    const el = document.getElementById("deal-share-link");
    if (!el) return;
    el.select();
    navigator.clipboard?.writeText(el.value).then(() => {
        if (tg) tg.showAlert("Ссылка скопирована ✅");
    }).catch(() => {
        if (tg) tg.showAlert(el.value);
    });
}

async function joinDeal(code) {
    try {
        await api("/api/deal/" + code + "/join", { method: "POST" });
        if (tg) tg.showAlert("Вы присоединились к сделке ✅");
        closeDealDetail();
        loadDeals();
    } catch (e) {
        if (tg) tg.showAlert(e.message || "Ошибка");
    }
}

async function payDeal(code) {
    if (!confirm("Оплатить сделку с баланса?")) return;
    try {
        const res = await api("/api/deal/" + code + "/pay", { method: "POST" });
        if (tg) tg.showAlert(`Оплачено ✅\nСписано: ${res.paid}\nБаланс: ${res.balance}`);
        await loadMe();
        closeDealDetail();
        loadDeals();
    } catch (e) {
        if (tg) tg.showAlert(e.message || "Ошибка оплаты");
    }
}

async function cancelDeal(code) {
    if (!confirm("Отменить сделку?")) return;
    try {
        await api("/api/deal/" + code + "/cancel", { method: "POST" });
        if (tg) tg.showAlert("Сделка отменена");
        closeDealDetail();
        loadDeals();
    } catch (e) {
        if (tg) tg.showAlert(e.message || "Ошибка");
    }
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
    document.getElementById("det-ton").value = state.details.ton || "";
    document.getElementById("det-card").value = state.details.card || "";
    document.getElementById("det-stars").value = state.details.stars || "";
    document.getElementById("det-usdt").value = state.details.usdt || "";
    document.getElementById("det-btc").value = state.details.btc || "";

    renderBalances();
}

function renderBalances() {
    const wrap = document.getElementById("balances-list");
    if (!wrap) return;
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
    RUB:   { label: "Карта RUB",       placeholder: "0000 0000 0000 0000", ico: "₽", field: "card" },
    KZT:   { label: "Карта KZT",       placeholder: "0000 0000 0000 0000", ico: "₸", field: "card" },
    UAH:   { label: "Карта UAH",       placeholder: "0000 0000 0000 0000", ico: "₴", field: "card" },
    USD:   { label: "Карта USD",       placeholder: "0000 0000 0000 0000", ico: "$", field: "card" },
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
    if (!meta) return;
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
// FLOW: СОЗДАНИЕ СДЕЛКИ (10 шагов)
// =====================================================

const CURRENCIES = [
    { code: "TON",   name: "TON",   color: "#0098EA", ico: "◆" },
    { code: "USDT",  name: "USDT",  color: "#26A17B", ico: "₮" },
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
    // сброс flow
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

// Шаг 1: выбор роли
function flowChooseRole(role) {
    state.flow.role = role;
    renderCurrencyGrid();
    flowShowStep(2);
}

// Шаг 2: сетка валют
function renderCurrencyGrid() {
    const grid = document.getElementById("flow-currency-grid");
    if (!grid) return;
    grid.innerHTML = CURRENCIES.map(c => `
        <div class="cur-card ${state.flow.currency === c.code ? 'selected' : ''}" data-code="${c.code}" onclick="flowChooseCurrency('${c.code}')">
            <div class="cur-ico" style="background:${c.color}">${c.ico}</div>
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

// Шаг 3: сумма
function flowStep4() {
    const amount = parseFloat(document.getElementById("flow-amount").value);
    if (!amount || amount <= 0) {
        if (tg) tg.showAlert("Введите сумму больше 0");
        return;
    }
    state.flow.amount = amount;
    flowShowStep(4);
}

// Шаг 4: описание
function flowStep5() {
    const desc = document.getElementById("flow-desc").value.trim();
    if (!desc) {
        if (tg) tg.showAlert("Опишите товар");
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

// Шаг 5 → Шаг 6 (таймер 10 сек)
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
    btn.textContent = `Прочитайте — ${left}с`;

    safetyTimerId = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearInterval(safetyTimerId);
            safetyTimerId = null;
            btn.disabled = false;
            btn.textContent = "Создать сделку";
        } else {
            btn.textContent = `Прочитайте — ${left}с`;
        }
    }, 1000);
}

// Создание сделки
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
            if (tg) tg.showAlert("Сервер не вернул код сделки");
            return;
        }
        state.flow.createdCode = res.code;
        await renderCreatedDeal(res.code);
        flowShowStep(7);
    } catch (e) {
        if (tg) tg.showAlert(e.message || "Ошибка создания");
    }
}

// Шаг 7: экран созданной сделки
async function renderCreatedDeal(code) {
    document.getElementById("deal-screen-code").textContent = `#${code}`;

    // Прогресс: Шаг 1 из 5
    updateProgressBar(1);

    let d;
    try {
        d = await api("/api/deal/" + code);
    } catch (e) {
        if (tg) tg.showAlert("Не удалось загрузить сделку");
        return;
    }

    const cur = d.currency === "STARS" || d.currency === "STR" ? "STARS" : d.currency;

    document.getElementById("deal-product-ico").textContent =
        (CURRENCIES.find(c => c.code === d.currency)?.ico) || "💎";
    document.getElementById("deal-product-amount").textContent = `${d.amount} ${cur}`;
    document.getElementById("deal-product-desc").textContent = d.description;

    document.getElementById("deal-info-status").textContent = "Ожидание оплаты";

    const sellerName = d.seller_username
        ? `@${d.seller_username}${d.is_creator && d.role === "seller" ? " (Вы)" : ""}`
        : "—";
    const buyerName = d.buyer_username
        ? `@${d.buyer_username}${d.is_creator && d.role === "buyer" ? " (Вы)" : ""}`
        : "Покупатель не присоединился";

    document.getElementById("deal-info-seller").textContent = sellerName;
    document.getElementById("deal-info-buyer").textContent = buyerName;
    document.getElementById("deal-info-created").textContent =
        d.created_at ? new Date(d.created_at).toLocaleString("ru-RU") : "—";

    document.getElementById("deal-now-text").textContent =
        "Ожидаем покупателя. Поделитесь ссылкой на сделку, чтобы он присоединился.";
}

function updateProgressBar(step) {
    const dots = document.querySelectorAll(".progress-dot");
    dots.forEach(el => {
        el.classList.toggle("active", Number(el.dataset.step) <= step);
    });
    const labels = ["Создана", "Покупатель", "Оплачена", "В эскроу", "Получена"];
    document.getElementById("deal-progress-label").textContent =
        `Шаг ${step} из 5 — ${labels[step - 1] || ""}`;
}

function flowShareDeal() {
    const code = state.flow.createdCode;
    if (!code) return;
    const botUser = window.__BOT_USERNAME__ || "";
    const link = botUser ? `https://t.me/${botUser}?start=deal_${code}` : code;
    const text = `🤝 Сделка #${code}\nОткрой: ${link}`;
    if (tg) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Присоединяйся к сделке #" + code)}`;
        tg.openTelegramLink(shareUrl);
    }
}

async function flowCancelDeal() {
    const code = state.flow.createdCode;
    if (!code) return;
    if (!confirm("Отменить сделку?")) return;
    try {
        await api("/api/deal/" + code + "/cancel", { method: "POST" });
        if (tg) tg.showAlert("Сделка отменена");
        closeFlow();
        loadDeals();
    } catch (e) {
        if (tg) tg.showAlert(e.message || "Ошибка");
    }
}

// Открытие сделки по ?deal=CODE (когда пользователь перешёл по ссылке)
async function openDealFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("deal");
    if (!code) return;
    try {
        await api("/api/deal/" + code + "/join", { method: "POST" }).catch(() => {});
        // показать экран сделки
        state.flow.createdCode = code;
        await renderCreatedDeal(code);
        flowShowStep(7);
        // очистить URL
        window.history.replaceState({}, "", window.location.pathname);
    } catch (e) {
        console.error("openDealFromURL", e);
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
    target.setDate(target.getDate() + 30);
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
// ОТЗЫВЫ
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
// СТАРТ
// =====================================================
document.getElementById("hide-zero")?.addEventListener("change", renderBalances);

(async function init() {
    await loadMe();
    await loadDeals();
    startLeadersTimer();
    startBannerCarousel();
    await openDealFromURL();
})();