const STORAGE_KEY = "nh_mca_dash_state_v1";
const STORAGE_VERSION = 2;

const CRM_STATUSES = ["review", "declined", "offered", "accepted", "funded"];

const STATUS_LABELS = {
  review: "review",
  offered: "offered",
  declined: "declined",
  accepted: "accepted",
  funded: "funded"
};

const CATEGORIES = [
  "True Revenue",
  "Other",
  "MCA Funding",
  "MCA Payment",
  "Expense",
  "Personal",
  "Loan",
  "Questionable",
  "Unknown"
];

const CATEGORIES_CLASS = {
  "True Revenue": "true_revenue",
  Other: "other",
  "MCA Funding": "mca_funding",
  "MCA Payment": "mca_payment",
  Expense: "expense",
  Personal: "personal",
  Loan: "questionable",
  Questionable: "questionable",
  Unknown: "unknown"
};

const RULES = {
  trueRevenue: [
    "invoice", "payment from", "ach credit", "zelle", "wire transfer", "wire in", "check deposit",
    "customer", "client", "sale", "pos", "deposit", "google checkout", "stripe", "payroll deduction reversal",
    "card settlement", "counter sales", "mobile check deposit", "cash deposit", "cash deposit"
  ],
  mcaFunding: [
    "mca", "merchant cash", "advance", "funding", "disbursement", "loan proceeds",
    "cash advance", "bridge", "factor"
  ],
  mcaPayment: [
    "mca", "merchant cash", "loan payment", "daily payment", "daily ach", "weekly payment",
    "advance payment", "mca payment", "payoff", "finance charge", "payment to",
    "receivables weekly", "weekly mca", "lender"
  ],
  expense: [
    "office", "rent", "supplies", "payroll", "advertising", "marketing", "fuel", "gas", "utility",
    "invoice fee", "software", "subscription", "insurance", "cleaning", "maintenance", "service", "office supplies",
    "fleet", "vehicle", "commercial repair", "shipping", "mail", "vendor", "business insurance", "bill pay"
  ],
  personal: [
    "restaurant", "coffee", "uber", "lyft", "hotel", "starbucks", "cafe", "resort", "airbnb", "bar",
    "doordash", "grubhub", "target", "walmart", "costco", "kroger", "sams", "shell", "chevron",
    "personal", "cash withdrawal", "atm", "children", "home grocery", "resort weekend", "house"
  ],
  loan: [
    "loc", "line of credit", "credit line", "business credit line", "loan", "term loan", "refinance"
  ],
  otherCredit: [
    "loan", "line of credit", "credit line", "refund", "returned", "reversal", "interest", "internal", "internal transfer",
    "wire", "advance", "other"
  ],
  questionable: [
    "questionable", "possible", "unclear", "nsf", "returned", "bounced", "refund", "reversal", "internal transfer", "transfer from", "transfer to"
  ]
};

const SAMPLE_DEALS_SEEDED_KEY = "nh_mca_dash_demo_seeded_v1";

const state = loadState();

const els = {
  manualDealBtn: document.getElementById("manualDealBtn"),
  manualDealPanel: document.getElementById("manualDealPanel"),
  dealForm: document.getElementById("dealForm"),
  merchantInput: document.getElementById("merchantInput"),
  subjectInput: document.getElementById("subjectInput"),
  labelsInput: document.getElementById("labelsInput"),
  fromInput: document.getElementById("fromInput"),
  isMineInput: document.getElementById("isMineInput"),
  statusInput: document.getElementById("statusInput"),
  crmBoard: document.getElementById("crmBoard"),
  noDealsState: document.getElementById("noDealsState"),
  noDealState: document.getElementById("noDealState"),
  dealWorkspace: document.getElementById("dealWorkspace"),
  dealMerchant: document.getElementById("dealMerchant"),
  dealSubject: document.getElementById("dealSubject"),
  dealBroker: document.getElementById("dealBroker"),
  mineBadge: document.getElementById("mineBadge"),
  dealStatus: document.getElementById("dealStatus"),
  statementForm: document.getElementById("statementForm"),
  monthInput: document.getElementById("monthInput"),
  accountInput: document.getElementById("accountInput"),
  statementFile: document.getElementById("statementFile"),
  statementText: document.getElementById("statementText"),
  seedDemoBtn: document.getElementById("seedDemoBtn"),
  monthTabs: document.getElementById("monthTabs"),
  selectedMonthSection: document.getElementById("selectedMonthSection"),
  summaryCompare: document.getElementById("summaryCompare"),
  categoryTotals: document.getElementById("categoryTotals"),
  monthDocList: document.getElementById("monthDocList"),
  categoryFilters: document.getElementById("categoryFilters"),
  txRows: document.getElementById("txRows")
};

state.version = state.version || 1;
state.deals = state.deals || [];
state.rules = state.rules || {};

state.view = state.view || {
  selectedDealId: null,
  selectedMonth: null,
  activeCategory: "All",
  selectedDoc: "all",
  showManualDealForm: false
};

els.manualDealBtn.addEventListener("click", () => {
  state.view.showManualDealForm = !state.view.showManualDealForm;
  if (!state.view.showManualDealForm) {
    clearDealForm();
  }
  render();
});

els.dealForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const merchant = els.merchantInput.value.trim();
  const subject = els.subjectInput.value.trim();
  const labels = els.labelsInput.value.trim();
  const from = els.fromInput.value.trim();
  const explicitMine = els.isMineInput.checked;
  const status = els.statusInput.value || "review";

  if (!merchant) {
    return;
  }

  const mineAuto = explicitMine || isMineLabel(labels);
  const now = new Date().toISOString();

  const deal = {
    id: crypto.randomUUID(),
    merchant,
    subject,
    labels,
    from,
    isMine: mineAuto,
    status,
    createdAt: now,
    source: "manual",
    months: {}
  };

  state.deals.unshift(deal);
  state.view.selectedDealId = deal.id;
  state.view.selectedMonth = null;
  state.view.activeCategory = "All";
  state.view.selectedDoc = "all";
  state.view.showManualDealForm = false;
  clearDealForm();
  persistState();
  render();
});

els.dealStatus.addEventListener("change", () => {
  const deal = currentDeal();
  if (!deal) return;
  deal.status = els.dealStatus.value;
  persistState();
  render();
});

els.statementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const deal = currentDeal();
  if (!deal) return;

  const month = els.monthInput.value;
  const account = els.accountInput.value.trim() || "Business checking";
  if (!month) return;

  const file = els.statementFile.files?.[0];
  const pastedText = els.statementText.value.trim();
  let rawText = "";

  if (file) {
    rawText = await readFile(file);
  } else {
    rawText = pastedText;
  }

  if (!rawText.trim()) return;

  const statement = parseStatement(rawText, month, account);

  if (!deal.months[month]) {
    deal.months[month] = {
      month,
      docs: []
    };
  }

  deal.months[month].docs.unshift({
    id: crypto.randomUUID(),
    account,
    sourceName: file ? file.name : "Pasted OCR",
    createdAt: new Date().toISOString(),
    rawText,
    rawSummary: statement.rawSummary,
    parsedSummary: statement.parsedSummary,
    parsedTransactions: statement.transactions
  });

  state.view.selectedMonth = month;
  state.view.selectedDoc = "all";
  state.view.activeCategory = "All";
  persistState();
  els.statementForm.reset();
  render();
});

els.monthTabs.addEventListener("click", (event) => {
  const btn = event.target.closest(".tab-btn");
  if (!btn) return;
  state.view.selectedMonth = btn.dataset.month;
  state.view.selectedDoc = "all";
  state.view.activeCategory = "All";
  render();
});

els.categoryFilters.addEventListener("click", (event) => {
  const chip = event.target.closest(".chip");
  if (!chip) return;
  state.view.activeCategory = chip.dataset.cat;
  render();
});

els.txRows.addEventListener("change", (event) => {
  const select = event.target.closest(".category-select");
  if (!select) return;
  const txId = select.dataset.txid;
  const nextCategory = select.value;
  const deal = currentDeal();
  const statementSet = getCurrentStatementSet(deal);
  if (!statementSet) return;

  for (const tx of statementSet.transactions) {
    if (tx.id === txId) {
      const prevCategory = tx.category;
      tx.category = nextCategory;
      if (prevCategory !== nextCategory) {
        addLearningRule(tx.description, nextCategory);
      }
      break;
    }
  }

  persistState();
  render();
});

els.seedDemoBtn.addEventListener("click", () => {
  if (localStorage.getItem(SAMPLE_DEALS_SEEDED_KEY) === "1") {
    if (state.deals.length === 0) {
      localStorage.removeItem(SAMPLE_DEALS_SEEDED_KEY);
    } else {
      return;
    }
  }

  const seeded = sampleDeals();
  state.deals = [...seeded, ...state.deals];
  state.view.selectedDealId = seeded[0].id;
  state.view.selectedMonth = "2026-07";
  state.view.activeCategory = "All";
  state.view.selectedDoc = "all";
  state.view.showManualDealForm = false;
  localStorage.setItem(SAMPLE_DEALS_SEEDED_KEY, "1");
  persistState();
  render();
});

function isMineLabel(labelText) {
  return /\bIT\s*ISO\b/i.test(labelText || "");
}

function currentDeal() {
  return state.deals.find((deal) => deal.id === state.view.selectedDealId) || null;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return { deals: [], rules: {} };
  }
  try {
    return JSON.parse(stored);
  } catch {
    return { deals: [], rules: {} };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...state,
    version: STORAGE_VERSION
  }));
}

function clearDealForm() {
  els.merchantInput.value = "";
  els.subjectInput.value = "";
  els.labelsInput.value = "";
  els.fromInput.value = "";
  els.isMineInput.checked = false;
  els.statusInput.value = "review";
}

function readFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

function render() {
  renderBoard();

  const deal = currentDeal();
  if (!deal) {
    els.noDealState.classList.remove("hidden");
    els.dealWorkspace.classList.add("hidden");
    if (els.manualDealPanel) {
      els.manualDealPanel.classList.toggle("hidden", !state.view.showManualDealForm);
    }
    return;
  }

  els.noDealState.classList.add("hidden");
  els.dealWorkspace.classList.remove("hidden");
  els.manualDealPanel.classList.add("hidden");
  state.view.showManualDealForm = false;

  els.dealMerchant.textContent = deal.merchant;
  els.dealSubject.textContent = deal.subject || "No subject";
  els.dealBroker.textContent = `ISO/Broker: ${deal.from || "not provided"}`;
  els.dealStatus.value = deal.status || "review";
  els.mineBadge.textContent = deal.isMine ? "mine (IT ISO)" : "not marked mine";
  els.mineBadge.className = `badge ${deal.isMine ? "mine" : ""}`;

  renderMonthTabs(deal);
  renderMonthDetail(deal);
}

function renderBoard() {
  const hasDeals = Array.isArray(state.deals) && state.deals.length > 0;
  els.noDealsState.classList.toggle("hidden", hasDeals);
  if (!hasDeals) {
    els.crmBoard.innerHTML = "";
    return;
  }

  const sorted = [...state.deals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const boardNodes = CRM_STATUSES.map((status) => {
    const lane = document.createElement("section");
    const statusList = sorted.filter((deal) => deal.status === status);
    lane.className = "lane";
    const readableStatus = STATUS_LABELS[status] || status;
    lane.innerHTML = `<h3>${escapeHtml(readableStatus)}</h3><p class="lane-meta">${statusList.length} deal(s)</p><div class="lane-list" data-lane="${status}"></div>`;

    const container = lane.querySelector(`[data-lane="${status}"]`);
    if (statusList.length === 0) {
      container.innerHTML = `<div class="crm-empty">No deals in ${readableStatus}.</div>`;
      return lane;
    }

    for (const deal of statusList) {
      const card = renderDealCard(deal);
      container.appendChild(card);
    }
    return lane;
  });

  els.crmBoard.replaceChildren(...boardNodes);
}

function renderDealCard(deal) {
  const card = document.createElement("button");
  const isSelected = deal.id === state.view.selectedDealId;
  card.type = "button";
  card.className = `crm-card ${isSelected ? "active" : ""}`;
  card.dataset.id = deal.id;

  const monthCount = Object.keys(deal.months || {}).length;
  const parseStatus = monthCount > 0 ? "parsing done" : "parsing pending";
  const mineLabel = deal.isMine ? "IT ISO" : "partner";

  card.innerHTML = `
    <p class="merchant">${escapeHtml(deal.merchant)}</p>
    <p class="meta">Subject: ${escapeHtml(deal.subject || "no subject")}</p>
    <p class="meta">ISO/Broker: ${escapeHtml(deal.from || "not set")}</p>
    <p class="meta">Arrived: ${escapeHtml(formatTime(deal.createdAt))}</p>
    <div class="card-row">
      <span class="badge ${deal.isMine ? "mine" : ""}">${mineLabel}</span>
      <span class="muted">${monthCount} month(s) · ${parseStatus}</span>
    </div>
  `;

  card.addEventListener("click", () => {
    state.view.selectedDealId = deal.id;
    const monthKeys = Object.keys(deal.months || {}).sort().reverse();
    state.view.selectedMonth = monthKeys[0] || null;
    state.view.activeCategory = "All";
    state.view.selectedDoc = "all";
    state.view.showManualDealForm = false;
    render();
  });

  return card;
}

function renderMonthTabs(deal) {
  const keys = Object.keys(deal.months || {}).sort().reverse();
  els.monthTabs.innerHTML = "";
  if (!keys.length) {
    state.view.selectedMonth = null;
    els.selectedMonthSection.classList.add("hidden");
    return;
  }

  const safeMonth = state.view.selectedMonth && keys.includes(state.view.selectedMonth) ? state.view.selectedMonth : keys[0];
  state.view.selectedMonth = safeMonth;

  for (const month of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-btn${state.view.selectedMonth === month ? " active" : ""}`;
    button.dataset.month = month;
    button.textContent = monthLabel(month);
    els.monthTabs.appendChild(button);
  }
}

function renderMonthDetail(deal) {
  const month = deal.months?.[state.view.selectedMonth];
  if (!month) {
    els.selectedMonthSection.classList.add("hidden");
    return;
  }
  els.selectedMonthSection.classList.remove("hidden");

  const docs = month.docs || [];
  const txSource = buildActiveMonthTransactions(deal, month);
  const parsedSummary = summarizeTransactions(txSource);
  const rawSummary = combineRawSummary(docs.map((doc) => doc.rawSummary));
  renderSummary(rawSummary, parsedSummary);
  renderMonthDocs(docs);

  const allForMonth = txSource;
  const filtered = filterTransactions(allForMonth);
  const totals = categoryTotals(allForMonth);

  renderCategoryTotals(totals);
  renderCategoryFilters(allForMonth, totals);
  renderTransactionRows(filtered);
}

function buildActiveMonthTransactions(deal, month) {
  if (!deal || !month) return [];
  if (state.view.selectedDoc === "all") {
    return month.docs.flatMap((doc) => doc.parsedTransactions.map((tx) => ({ ...tx, docId: doc.id })));
  }
  return month.docs
    .filter((doc) => doc.id === state.view.selectedDoc)
    .flatMap((doc) => doc.parsedTransactions.map((tx) => ({ ...tx, docId: doc.id })));
}

function getCurrentStatementSet(deal) {
  if (!deal) return null;
  const month = deal.months?.[state.view.selectedMonth];
  if (!month) return null;
  return {
    month,
    transactions: buildActiveMonthTransactions(deal, month)
  };
}

function renderSummary(raw, parsed) {
  const rows = [
    metricRow("Beginning balance", raw.begin, parsed.begin, "balance"),
    metricRow("Ending balance", raw.end, parsed.end, "balance"),
    metricRow("Total credits", raw.credits, parsed.credits, "money"),
    metricRow("Total debits", raw.debits, parsed.debits, "money")
  ];
  els.summaryCompare.innerHTML = `<div class="summary-rows">${rows.map((row) => `
    <div class="metric ${row.status}">
      <span class="metric-label">${escapeHtml(row.label)}</span>
      <span class="metric-raw">OCR ${row.raw}</span>
      <span class="metric-parse">Parsed ${row.parsed}</span>
      <span class="metric-diff">${row.statusIcon} ${row.diff}</span>
    </div>
  `).join("")}</div>`;
}

function metricRow(label, rawValue, parsedValue, kind) {
  const raw = typeof rawValue === "number" ? rawValue : null;
  const parsed = typeof parsedValue === "number" ? parsedValue : 0;
  const missing = raw === null;
  const diff = missing ? null : Math.abs(raw - parsed);
  const warn = missing || (kind === "money" ? diff > 1 : diff > 0);
  const status = warn ? (missing ? "warn" : "bad") : "ok";
  const statusIcon = warn ? "!" : "✓";

  return {
    label,
    raw: missing ? "not detected" : fmtMoney(raw),
    parsed: isFinite(parsed) ? fmtMoney(parsed) : "not detected",
    diff: missing ? "manual check" : fmtMoney(diff),
    status,
    statusIcon
  };
}

function renderMonthDocs(docs) {
  const lines = [];
  lines.push(`<div class="doc-pill"><strong>Combined document view</strong><p>Showing all docs for selected month.</p></div>`);
  for (const doc of docs) {
    const status = doc.parsedSummary ? "parsed" : "no parse";
    lines.push(`
      <div class="doc-pill">
        <p><strong>${escapeHtml(doc.account)}</strong> — ${escapeHtml(doc.sourceName)} <span class="badge">${escapeHtml(status)}</span></p>
        <p class="muted">${new Date(doc.createdAt).toLocaleString()}</p>
      </div>
    `);
  }

  if (!docs.length) {
    lines.push(`<div class="doc-pill"><p>No documents for this month yet.</p></div>`);
  }

  els.monthDocList.innerHTML = lines.join("");
}

function renderCategoryTotals(totals) {
  const lines = Object.entries(totals).map(([label, value]) => `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <span>${fmtMoney(value)}</span>
    </div>
  `);
  els.categoryTotals.innerHTML = lines.join("");
}

function renderCategoryFilters(txs) {
  const totals = categoryTotals(txs);
  const options = ["All", ...CATEGORIES];
  const chips = options.map((cat) => {
    const count = cat === "All" ? txs.length : txs.filter((tx) => tx.category === cat).length;
    const active = state.view.activeCategory === cat ? " active" : "";
    return `<button class="chip${active}" type="button" data-cat="${cat}">${escapeHtml(cat)} (${count})</button>`;
  });
  els.categoryFilters.innerHTML = chips.join("");
}

function filterTransactions(transactions) {
  if (state.view.activeCategory === "All") return transactions;
  return transactions.filter((tx) => tx.category === state.view.activeCategory);
}

function renderTransactionRows(transactions) {
  const rows = transactions
    .slice()
    .sort(sortTransactionsForDisplay)
    .map((tx) => renderTransactionRow(tx))
    .join("");

  els.txRows.innerHTML = rows || `<tr><td colspan="5" class="muted">No matching rows for this filter.</td></tr>`;
}

function renderTransactionRow(tx) {
  const cls = `cat-${CATEGORIES_CLASS[tx.category] || "unknown"}`;
  const amountClass = tx.type === "credit" ? "amount-pos" : "amount-neg";
  const amount = tx.type === "credit" ? tx.amount : -Math.abs(tx.amount);
  const select = CATEGORIES.map((cat) => `<option ${cat === tx.category ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("");
  return `
    <tr class="${cls}">
      <td>${escapeHtml(tx.date || "")}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td>${escapeHtml(tx.method || "manual")}</td>
      <td class="${amountClass}">${fmtMoney(amount)}</td>
      <td class="select-cell">
        <select class="category-select" data-txid="${tx.id}">
          ${select}
        </select>
      </td>
    </tr>
  `;
}

function categoryTotals(transactions) {
  const totals = {};
  for (const category of CATEGORIES) totals[category] = 0;

  for (const tx of transactions) {
    totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount || 0);
  }
  return totals;
}

function summarizeTransactions(transactions) {
  const positive = transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const negative = transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  return {
    begin: null,
    end: null,
    credits: positive,
    debits: Math.abs(negative)
  };
}

function combineRawSummary(summaries) {
  const total = {
    begin: null,
    end: null,
    credits: 0,
    debits: 0
  };

  for (const sum of summaries) {
    if (!sum) continue;
    if (sum.begin !== null && total.begin === null) total.begin = sum.begin;
    if (sum.end !== null && total.end === null) total.end = sum.end;
    if (typeof sum.credits === "number") total.credits += sum.credits;
    if (typeof sum.debits === "number") total.debits += sum.debits;
  }

  return total;
}

function parseStatement(text, month, account) {
  const rawSummary = parseSummaryFromText(text);
  let rows = [];

  if (isCsvLike(text)) {
    rows = parseCsvStatement(text);
  }

  if (!rows.length) {
    rows = parseTextStatement(text);
  }

  const transactions = rows
    .filter((row) => row.date && typeof row.amount === "number" && !Number.isNaN(row.amount))
    .map((row) => ({
      id: crypto.randomUUID(),
      date: normalizeDate(row.date, month),
      description: normalizeDescription(row.description || row.desc || ""),
      amount: Math.abs(Number(row.amount)),
      rawAmount: Number(row.amount),
      type: Number(row.amount) >= 0 ? "credit" : "debit",
      method: row.method || detectMethod(row.description || row.desc || ""),
      category: classifyTransaction(row.description || row.desc || "", Number(row.amount))
    }));

  const parsedSummary = {
    begin: rawSummary.begin || null,
    end: rawSummary.end || null,
    credits: transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0),
    debits: transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0),
    txCount: transactions.length,
    account
  };

  return { rawSummary, parsedSummary, transactions };
}

function parseSummaryFromText(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const numbers = {
    begin: null,
    end: null,
    credits: 0,
    debits: 0
  };

  const getByLabel = (labelPatterns) => {
    for (const line of lines) {
      const low = line.toLowerCase();
      if (labelPatterns.some((pattern) => low.includes(pattern))) {
        const value = findMoneyInLine(line);
        if (value !== null) return value;
      }
    }
    return null;
  };

  numbers.begin = getByLabel(["beginning balance", "opening balance", "balance forward", "prior balance"]);
  numbers.end = getByLabel(["ending balance", "closing balance", "final balance", "balance as of"]);
  numbers.credits = getByLabel(["total credits", "total credit", "deposits total", "sum credits"]) ?? 0;
  numbers.debits = getByLabel(["total debits", "total debit", "withdrawals total", "sum debits"]) ?? 0;
  return numbers;
}

function isCsvLike(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return false;
  const firstLine = lines[0];
  return /,/ .test(firstLine) && /date|description|amount|debit|credit|memo/i.test(firstLine);
}

function parseCsvStatement(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2) return [];

  const header = tokenizeCsvLine(lines[0]).map((x) => x.toLowerCase());
  const iDate = findHeaderIndex(header, ["date", "trans date", "posting date", "transaction date"]);
  const iDesc = findHeaderIndex(header, ["description", "memo", "details", "name", "transaction"]);
  const iMethod = findHeaderIndex(header, ["method", "type", "source", "channel"]);
  const iAmt = findHeaderIndex(header, ["amount", "amt", "net amount", "transaction amount"]);
  const iDeb = findHeaderIndex(header, ["debit", "withdrawal", "outflow"]);
  const iCred = findHeaderIndex(header, ["credit", "deposit", "inflow"]);

  if (iDate === -1 || iDesc === -1 || (iAmt === -1 && iDeb === -1 && iCred === -1)) {
    return [];
  }

  const rows = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const columns = tokenizeCsvLine(lines[rowIndex]);
    if (!columns.length) continue;
    const date = columns[iDate];
    const description = columns[iDesc] || "";
    const amount = iAmt !== -1
      ? parseMoney(columns[iAmt])
      : amountFromDebitCredit(columns[iDeb], columns[iCred]);
    const method = columns[iMethod] || "";
    if (date && amount !== null) {
      rows.push({ date, description, amount, method });
    }
  }
  return rows;
}

function amountFromDebitCredit(debitText, creditText) {
  const debit = parseMoney(debitText);
  const credit = parseMoney(creditText);
  if (debit === null && credit === null) return null;
  if (debit !== null && credit !== null) return credit - debit;
  if (credit !== null) return credit;
  return -(debit || 0);
}

function parseTextStatement(text) {
  const transactions = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseLineToTransaction(line);
    if (parsed) transactions.push(parsed);
  }
  return transactions;
}

function parseLineToTransaction(line) {
  const firstDate = line.match(/^\s*(\d{1,2}[\/\-\s]\d{1,2}(?:[\/\-\s]\d{2,4})?|\d{5,6})\s+(.+)$/);
  if (!firstDate) return null;

  const rawDate = firstDate[1];
  const tail = firstDate[2] || "";
  const moneyValues = findAllMoney(tail);
  if (!moneyValues.length) return null;

  const amountText = moneyValues[moneyValues.length - 1];
  let amount = parseMoney(amountText);
  if (amount == null) return null;

  const lowerTail = tail.toLowerCase();
  const method = detectMethod(tail);
  const hasDebitHint = containsAny(lowerTail, [
    "debit", "transfer to", "payment", "bill pay", "atm", "zelle to", "cash withdrawal", "vendor", "fee", "check",
    "returned", "nsf", "loan payment", "refill", "owner", "mca"
  ]);
  const hasCreditHint = containsAny(lowerTail, [
    "wire in", "cash deposit", "check deposit", "ach credit", "credit", "refund", "deposit", "zelle from"
  ]);
  if (hasDebitHint && !hasCreditHint) {
    amount = -Math.abs(amount);
  } else if (hasCreditHint && !hasDebitHint) {
    amount = Math.abs(amount);
  }

  const description = tail
    .replace(new RegExp(escapeForRegex(amountText), "g"), "")
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/\|/g, " ");

  return { date: normalizeDate(rawDate), description, amount, method };
}

function detectMethod(description) {
  const low = String(description).toLowerCase();
  if (containsAny(low, ["zelle", "zelle from", "zelle to"])) return "Zelle";
  if (containsAny(low, ["ach credit", "ach debit", "ach"])) return "ACH";
  if (containsAny(low, ["wire in", "wire out", "wire"])) return "Wire";
  if (containsAny(low, ["check deposit", "returned check", "check"])) return "Check";
  if (containsAny(low, ["card settlement", "debit card"])) return "Card";
  if (containsAny(low, ["transfer"])) return "Transfer";
  if (containsAny(low, ["bill pay"])) return "Bill pay";
  if (containsAny(low, ["cash deposit", "cash"])) return "Cash";
  return "Manual";
}

function normalizeDate(value, fallbackMonth) {
  const serial = Number(value);
  if (!isNaN(serial) && serial > 40000 && serial < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const asDate = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    const month = String(asDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(asDate.getUTCDate()).padStart(2, "0");
    return `${month}/${day}`;
  }

  const clean = String(value || "").trim();
  const parts = clean.split(/[\/\-]/);
  if (parts.length >= 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
    const mm = parts[0].padStart(2, "0");
    const dd = parts[1].padStart(2, "0");
    if (fallbackMonth) {
      return `${fallbackMonth}-${dd}`;
    }
    const year = parts[2] ? (parts[2].length === 2 ? `20${parts[2]}` : parts[2]) : "2026";
    return `${mm}/${dd}/${year}`;
  }

  return clean;
}

function classifyTransaction(desc, signedAmount) {
  const normalized = String(desc).toLowerCase();
  const amount = Number(signedAmount);
  const amountAbs = Math.abs(amount);
  const positive = amount > 0;
  const bestRule = matchLearnedRule(normalized);
  if (bestRule) return bestRule;

  if (positive) {
    if (containsAny(normalized, RULES.mcaFunding)) return "MCA Funding";
    if (containsAny(normalized, RULES.loan)) return "Loan";
    if (containsAny(normalized, RULES.trueRevenue)) return "True Revenue";
    if (containsAny(normalized, RULES.otherCredit)) return "Other";
    return amountAbs > 5000 ? "Other" : "True Revenue";
  }

  if (containsAny(normalized, RULES.mcaPayment)) return "MCA Payment";
  if (containsAny(normalized, RULES.personal)) return "Personal";
  if (containsAny(normalized, RULES.expense)) return "Expense";
  if (containsAny(normalized, RULES.loan)) return "Loan";
  if (containsAny(normalized, RULES.questionable)) return "Questionable";
  if (containsAny(normalized, RULES.otherCredit)) return "Other";
  return amountAbs > 3000 ? "Questionable" : "Unknown";
}

function matchLearnedRule(descriptionLower) {
  const rules = state.rules || {};
  for (const key in rules) {
    if (descriptionLower.includes(key)) return rules[key];
  }
  return null;
}

function addLearningRule(description, category) {
  const key = normalizeRuleKey(description);
  state.rules = state.rules || {};
  state.rules[key] = category;
}

function normalizeRuleKey(description) {
  return String(description)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(header, names) {
  for (let i = 0; i < header.length; i++) {
    const column = header[i].trim().toLowerCase();
    if (names.some((name) => column === name || column.includes(name))) return i;
  }
  return -1;
}

function tokenizeCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, ""));
}

function containsAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function findMoneyInLine(line) {
  const m = line.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/);
  return m ? parseMoney(m[0]) : null;
}

function findAllMoney(line) {
  return line.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g) || [];
}

function parseMoney(raw) {
  if (raw == null) return null;
  const clean = String(raw).replace(/,/g, "").replace(/\$/g, "").trim();
  if (!clean) return null;
  const isNegative = /^\(.*\)$/.test(clean) || clean.startsWith("-");
  const num = parseFloat(clean.replace(/[\(\)\-]/g, ""));
  if (Number.isNaN(num)) return null;
  return isNegative ? -num : num;
}

function normalizeDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/["“”']/g, "");
}

function sortTransactionsForDisplay(a, b) {
  if (a.type !== b.type) return a.type === "credit" ? -1 : 1;
  return compareDateDesc(a.date, b.date);
}

function compareDateDesc(a, b) {
  const aValue = Date.parse(toDateFallback(a));
  const bValue = Date.parse(toDateFallback(b));
  return bValue - aValue;
}

function toDateFallback(value) {
  const m = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return String(value || "");
}

function monthLabel(monthString) {
  if (!monthString) return "";
  const [y, m] = String(monthString).split("-");
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(`${y}-${m}-01T00:00:00`));
  return `${monthName} ${y}`;
}

function formatTime(isoString) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric"
  }).format(new Date(isoString));
}

function escapeForRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtMoney(value) {
  if (value == null || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function sampleDeals() {
  const reviewText = `
    Beginning balance 2500
    Total credits 203,209.00
    Total debits 87,169.00
    Ending balance 118,540.00

    46204 CARD SETTLEMENT - COUNTER SALES 7300 2100
    46205 ACH CREDIT - OAKFIELD MECHANICAL INV 7301 3047.13
    46205 ACH DEBIT - LANTERN RIDGE FUNDING WEEKLY MCA 7301 -1250
    46206 ZELLE FROM ELI MARTIN - NO MEMO 425
    46209 MOBILE CHECK DEPOSIT - TRADE CUSTOMER 7302 3994.26
    46213 CARD SETTLEMENT - COUNTER SALES 7306 7782.78
    46214 ZELLE TO M JONES - NO MEMO -980
    46210 ACH DEBIT - STONEBRIDGE RECEIVABLES WEEKLY MCA 7307 -875
    46218 WIRE IN - LANTERN RIDGE FUNDING MCA ADD-ON 12500
    46219 BRANCH CASH DEPOSIT - COUNTER SALES 7310 5670.3
    46220 WIRE IN - ALDER GATE LLC / REF 7317 4850
    46223 TRANSFER FROM BUSINESS RESERVE ACCT 8842 7000
    46218 MONTHLY INTEREST CREDIT 6.19
    46234 LOC PAYMENT - MEADOWBANK BUSINESS CREDIT LINE -350
  `;

  const parsed = parseStatement(reviewText, "2026-07", "Business checking");
  const julyDeal = {
    id: crypto.randomUUID(),
    merchant: "AA Plumbing Supply",
    subject: "IT ISO - new submission",
    labels: "IT ISO",
    from: "Creative Capital",
    isMine: true,
    status: "review",
    createdAt: new Date().toISOString(),
    source: "gmail",
    months: {
      "2026-07": {
        month: "2026-07",
        docs: [{
          id: crypto.randomUUID(),
          account: "Business checking",
          sourceName: "AA Plumbing — July statement",
          createdAt: new Date().toISOString(),
          rawText: reviewText,
          rawSummary: parsed.rawSummary,
          parsedSummary: parsed.parsedSummary,
          parsedTransactions: parsed.transactions
        }]
      }
    }
  };

  const deals = [
    julyDeal,
    {
      id: crypto.randomUUID(),
      merchant: "HH Care",
      subject: "IT ISO — new submission",
      labels: "IT ISO",
      from: "Creative Capital",
      isMine: true,
      status: "offered",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      source: "gmail",
      months: {}
    },
    {
      id: crypto.randomUUID(),
      merchant: "SONO Homes",
      subject: "IT ISO — funding request",
      labels: "IT ISO",
      from: "Creative Capital",
      isMine: true,
      status: "declined",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      source: "gmail",
      months: {}
    },
    {
      id: crypto.randomUUID(),
      merchant: "BSG Dance",
      subject: "Inbound submission",
      labels: "Broker",
      from: "Gogle Finance",
      isMine: false,
      status: "accepted",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      source: "gmail",
      months: {}
    },
    {
      id: crypto.randomUUID(),
      merchant: "GC Construction",
      subject: "Partner submission",
      labels: "Partner",
      from: "Marit Capital",
      isMine: false,
      status: "funded",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      source: "gmail",
      months: {}
    }
  ];

  return deals;
}

document.addEventListener("DOMContentLoaded", () => {
  render();
});
