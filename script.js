const STORAGE_KEY = "nh_mca_dash_state_v1";
const DEMO_STATE_KEY = "nh_mca_dash_demo_state_v1";

const CATEGORIES = [
  "True Revenue",
  "Other",
  "MCA Funding",
  "MCA Payment",
  "Expense",
  "Personal",
  "Unknown"
];

const CATEGORIES_CLASS = {
  "True Revenue": "true_revenue",
  Other: "other",
  "MCA Funding": "mca_funding",
  "MCA Payment": "mca_payment",
  Expense: "expense",
  Personal: "personal",
  Unknown: "unknown"
};

const RULES = {
  trueRevenue: [
    "invoice", "payment from", "ach credit", "zelle", "wire transfer", "wire in", "check deposit",
    "customer", "client", "sale", "pos", "deposit", "google checkout", "stripe", "payroll deduction reversal"
  ],
  mcaFunding: [
    "mca", "merchant cash", "advance", "funding", "disbursement", "loan proceeds",
    "cash advance", "bridge", "factor"
  ],
  mcaPayment: [
    "mca", "merchant cash", "loan payment", "daily payment", "daily ach", "weekly payment",
    "advance payment", "mca payment", "payoff", "pay down", "finance charge", "payment to"
  ],
  expense: [
    "office", "rent", "supplies", "payroll", "advertising", "marketing", "fuel", "gas", "utility",
    "invoice fee", "software", "subscription", "insurance", "cleaning", "maintenance", "service", "office supplies"
  ],
  personal: [
    "restaurant", "coffee", "uber", "lyft", "hotel", "starbucks", "cafe", "resort", "airbnb", "bar",
    "doordash", "grubhub", "target", "walmart", "costco", "kroger", "sams", "shell", "chevron",
    "personal", "cash withdrawal", "atm"
  ],
  otherCredit: [
    "line of credit", "interest", "refund", "chargeback", "reversal", "transfer", "internal", "returned", "wire out", "loan", "credit line", "payout"
  ]
};

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
  dealList: document.getElementById("dealList"),
  noDealState: document.getElementById("noDealState"),
  dealWorkspace: document.getElementById("dealWorkspace"),
  dealMerchant: document.getElementById("dealMerchant"),
  dealSubject: document.getElementById("dealSubject"),
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

els.dealForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const merchant = els.merchantInput.value.trim();
  const subject = els.subjectInput.value.trim();
  const labels = els.labelsInput.value.trim();
  const from = els.fromInput.value.trim();
  const explicitMine = els.isMineInput.checked;
  const status = els.statusInput.value || "review";

  if (!merchant) return;

  const mineAuto = explicitMine || isMineLabel(labels);
  const deal = {
    id: crypto.randomUUID(),
    merchant,
    subject,
    labels,
    from,
    isMine: mineAuto,
    status,
    createdAt: new Date().toISOString(),
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
  renderDealList();
});

els.statementForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const deal = currentDeal();
  if (!deal) return;

  const month = els.monthInput.value;
  const account = els.accountInput.value.trim() || "Account";
  if (!month) return;
  const file = els.statementFile.files?.[0];
  const pastedText = els.statementText.value.trim();
  let rawText = "";

  if (file) {
    rawText = await readFile(file);
  } else {
    rawText = pastedText;
  }
  if (!rawText.trim()) {
    return;
  }

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
    parsedTransactions: statement.transactions,
    parsedSummary: statement.parsedSummary
  });

  state.view.selectedMonth = month;
  state.view.selectedDoc = "all";
  state.view.activeCategory = "All";
  persistState();
  els.statementForm.reset();
  render();
});

els.monthTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  state.view.selectedMonth = btn.dataset.month;
  state.view.selectedDoc = "all";
  state.view.activeCategory = "All";
  render();
});

els.categoryFilters.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.view.activeCategory = chip.dataset.cat;
  render();
});

els.txRows.addEventListener("change", (e) => {
  const select = e.target.closest(".category-select");
  if (!select) return;

  const txId = select.dataset.txid;
  const nextCategory = select.value;
  const deal = currentDeal();
  const statement = getCurrentStatementSet(deal);
  if (!statement) return;

  for (const tx of statement.transactions) {
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
  if (state.demoLoaded) return;
  state.deals.unshift(sampleDeal());
  state.view.selectedDealId = state.deals[0].id;
  state.view.selectedMonth = state.deals[0].months["2026-07"].month;
  state.view.selectedDoc = "all";
  state.view.activeCategory = "All";
  state.demoLoaded = true;
  persistState();
  render();
});

function isMineLabel(labelText) {
  return /\bIT\s*ISO\b/i.test(labelText || "");
}

function currentDeal() {
  return state.deals.find((d) => d.id === state.view.selectedDealId) || null;
}

function readFile(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (ev) => resolve(String(ev.target?.result || ""));
    r.onerror = () => resolve("");
    r.readAsText(file);
  });
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearDealForm() {
  els.merchantInput.value = "";
  els.subjectInput.value = "";
  els.labelsInput.value = "";
  els.fromInput.value = "";
  els.isMineInput.checked = false;
  els.statusInput.value = "review";
}

function render() {
  renderDealList();
  const deal = currentDeal();
  if (!deal) {
    els.noDealState.classList.remove("hidden");
    els.dealWorkspace.classList.add("hidden");
    if (els.manualDealPanel) els.manualDealPanel.classList.toggle("hidden", !state.view.showManualDealForm);
    return;
  }

  els.noDealState.classList.add("hidden");
  els.dealWorkspace.classList.remove("hidden");
  els.manualDealPanel.classList.add("hidden");
  state.view.showManualDealForm = false;

  els.dealMerchant.textContent = `${deal.merchant}`;
  els.dealSubject.textContent = [deal.subject, deal.from].filter(Boolean).join(" • ");
  els.dealStatus.value = deal.status || "review";
  els.mineBadge.textContent = deal.isMine ? "mine (IT ISO)" : "not marked mine";
  els.mineBadge.className = `badge ${deal.isMine ? "mine" : ""}`;
  renderMonthTabs(deal);
  renderMonthDetail(deal);
}

function renderDealList() {
  els.dealList.innerHTML = "";
  const sorted = [...state.deals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const d of sorted) {
    const card = document.createElement("div");
    card.className = "deal-item";
    if (state.view.selectedDealId === d.id) card.classList.add("active");
    const docsCount = Object.keys(d.months || {}).length;
    card.innerHTML = `
      <button class="title-row" type="button" data-id="${d.id}">
        <strong>${escapeHtml(d.merchant)}</strong>
        <span class="badge">${d.status || "review"}</span>
      </button>
      <p class="deal-meta">
        <span>${escapeHtml(d.subject || "no subject")}</span>
        <span class="badge ${d.isMine ? "mine" : ""}">${d.isMine ? "IT ISO" : "external"}</span>
        <span>${docsCount} month(s)</span>
      </p>
    `;
    card.querySelector("button").addEventListener("click", () => {
      state.view.selectedDealId = d.id;
      state.view.selectedMonth = null;
      state.view.selectedDoc = "all";
      state.view.activeCategory = "All";
      render();
    });
    els.dealList.appendChild(card);
  }

  if (sorted.length === 0) {
    els.dealList.innerHTML = `<div class="deal-item"><p>No submissions yet. Add or wait for one to begin.</p></div>`;
  }
}

function renderMonthTabs(deal) {
  const keys = Object.keys(deal.months || {}).sort().reverse();
  els.monthTabs.innerHTML = "";
  if (keys.length === 0) {
    state.view.selectedMonth = null;
    els.selectedMonthSection.classList.add("hidden");
    els.monthTabs.innerHTML = `<span class="badge">No statement docs yet</span>`;
    return;
  }

  const safe = state.view.selectedMonth && keys.includes(state.view.selectedMonth) ? state.view.selectedMonth : keys[0];
  state.view.selectedMonth = safe;
  for (const month of keys) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab-btn${state.view.selectedMonth === month ? " active" : ""}`;
    btn.textContent = month;
    btn.dataset.month = month;
    els.monthTabs.appendChild(btn);
  }
}

function renderMonthDetail(deal) {
  const month = deal.months[state.view.selectedMonth];
  if (!month) {
    els.selectedMonthSection.classList.add("hidden");
    return;
  }

  els.selectedMonthSection.classList.remove("hidden");

  const docs = month.docs || [];
  const txSource = state.view.selectedDoc === "all"
    ? docs.flatMap((d) => d.parsedTransactions.map((t) => ({ ...t, docId: d.id })))
    : docs.filter((d) => d.id === state.view.selectedDoc).flatMap((d) => d.parsedTransactions.map((t) => ({ ...t, docId: d.id })));

  const parsedSummary = summarizeTransactions(txSource);
  const rawSummary = combineRawSummary(docs.map((d) => d.rawSummary));
  renderSummary(rawSummary, parsedSummary);
  renderMonthDocs(docs);

  const allForMonth = txSource;
  const filtered = filterTransactions(txSource);
  const totals = categoryTotals(allForMonth);
  renderCategoryTotals(totals);
  renderCategoryFilters(allForMonth, totals);
  renderTransactionRows(filtered);
}

function getCurrentStatementSet(deal) {
  if (!deal) return null;
  const month = deal.months[state.view.selectedMonth];
  if (!month) return null;
  const docs = month.docs || [];
  return {
    month,
    transactions: state.view.selectedDoc === "all"
      ? docs.flatMap((d) => d.parsedTransactions.map((t) => ({ ...t, docId: d.id })))
      : docs.filter((d) => d.id === state.view.selectedDoc).flatMap((d) => d.parsedTransactions.map((t) => ({ ...t, docId: d.id })))
  };
}

function renderMonthDocs(docs) {
  const lines = [];
  lines.push(`<div class="doc-pill"><strong>Combined document view</strong><p>Showing all docs for selected month.</p></div>`);
  for (const doc of docs) {
    lines.push(`
      <div class="doc-pill">
        <p><strong>${escapeHtml(doc.account)}</strong> — ${escapeHtml(doc.sourceName)}</p>
        <p class="muted">${new Date(doc.createdAt).toLocaleString()}</p>
      </div>
    `);
  }
  els.monthDocList.innerHTML = lines.join("");
}

function combineRawSummary(summaries) {
  const total = {
    begin: null,
    end: null,
    credits: 0,
    debits: 0,
    missing: 0
  };

  for (const sum of summaries) {
    if (!sum) continue;
    if (sum.begin !== null && total.begin === null) total.begin = sum.begin;
    if (sum.end !== null && total.end === null) total.end = sum.end;
    if (typeof sum.credits === "number") total.credits += sum.credits;
    if (typeof sum.debits === "number") total.debits += sum.debits;
  }
  total.missing = summaries.filter((s) => s && s.missing).length;
  return total;
}

function renderSummary(raw, parsed) {
  const items = [
    metricItem("Beginning balance", raw.begin, parsed.begin, "balance"),
    metricItem("Ending balance", raw.end, parsed.end, "balance"),
    metricItem("Total credits", raw.credits, parsed.credits, "money"),
    metricItem("Total debits", raw.debits, parsed.debits, "money")
  ];
  els.summaryCompare.innerHTML = items.map((x) => toMetricHtml(x)).join("");
}

function metricItem(label, rawValue, parsedValue, kind) {
  const o = typeof rawValue === "number" ? rawValue : null;
  const p = typeof parsedValue === "number" ? parsedValue : 0;
  const missing = typeof rawValue !== "number";
  const diff = missing ? null : Math.abs(o - p);
  const status = missing ? "warn" : (diff > toleranceByKind(kind) ? "bad" : "ok");
  return {
    label,
    raw: missing ? "not detected" : fmtMoney(o),
    parsed: isFinite(p) ? fmtMoney(p) : "not detected",
    status,
    diff
  };
}

function toleranceByKind(kind) {
  return kind === "money" ? 1.0 : 0.0;
}

function toMetricHtml(item) {
  const flag = item.status === "ok" ? "✓" : item.status === "warn" ? "?" : "!";
  const flagClass = item.status === "ok" ? "ok" : item.status === "warn" ? "warn" : "bad";
  const diff = item.diff === null ? "" : `<span class="badge-flag ${flagClass}">${flag} ${fmtMoney(item.diff)} diff</span>`;
  return `
    <div class="metric ${flagClass}">
      <span class="label">${escapeHtml(item.label)}</span>
      <span class="val">${diff}</span>
      <span>OCR: ${item.raw}</span>
      <span>Parsed: ${item.parsed}</span>
    </div>
  `;
}

function renderCategoryTotals(totals) {
  const order = Object.entries(totals);
  const lines = order.map(([k, v]) => `<div class="metric"><span>${escapeHtml(k)}</span><span>${fmtMoney(v)}</span></div>`);
  els.categoryTotals.innerHTML = lines.join("");
}

function renderCategoryFilters(txs) {
  const totals = categoryTotals(txs);
  const options = ["All", ...CATEGORIES];
  const chips = options.map((cat) => {
    const count = cat === "All" ? txs.length : txs.filter((t) => t.category === cat).length;
    const active = state.view.activeCategory === cat ? " active" : "";
    return `<button class="chip${active}" type="button" data-cat="${cat}">${escapeHtml(cat)} (${count})</button>`;
  });
  els.categoryFilters.innerHTML = chips.join("");
}

function filterTransactions(txs) {
  if (state.view.activeCategory === "All") return txs;
  return txs.filter((t) => t.category === state.view.activeCategory);
}

function renderTransactionRows(txs) {
  const rows = txs
    .slice()
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "credit" ? -1 : 1;
      return compareDateDesc(a.date, b.date);
    })
    .map((tx) => renderTxRow(tx))
    .join("");
  els.txRows.innerHTML = rows;
}

function renderTxRow(tx) {
  const cls = `cat-${CATEGORIES_CLASS[tx.category] || "unknown"}`;
  const amountClass = tx.type === "credit" ? "amount-pos" : "amount-neg";
  const amt = tx.type === "credit" ? tx.amount : -Math.abs(tx.amount);
  const select = CATEGORIES.map((cat) => `<option ${cat === tx.category ? "selected" : ""}>${escapeHtml(cat)}</option>`).join("");
  return `
    <tr class="${cls}">
      <td>${escapeHtml(tx.date || "")}</td>
      <td>${escapeHtml(tx.description)}</td>
      <td class="${amountClass}">${fmtMoney(amt)}</td>
      <td class="select-cell">
        <select class="category-select" data-txid="${tx.id}">
          ${select}
        </select>
      </td>
    </tr>
  `;
}

function categoryTotals(txs) {
  const totals = {};
  for (const c of CATEGORIES) totals[c] = 0;
  for (const tx of txs) {
    if (!totals[tx.category]) totals[tx.category] = 0;
    totals[tx.category] += Math.abs(tx.amount || 0);
  }
  return totals;
}

function summarizeTransactions(txs) {
  const positive = txs.filter((t) => t.type === "credit").reduce((acc, t) => acc + t.amount, 0);
  const negative = txs.filter((t) => t.type === "debit").reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const begin = null;
  const end = null;
  return {
    begin,
    end,
    credits: positive,
    debits: negative
  };
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

  const txs = rows
    .filter((r) => r.date && typeof r.amount === "number" && !Number.isNaN(r.amount))
    .map((r) => ({
      id: crypto.randomUUID(),
      date: formatDate(r.date, month),
      description: normalizeDescription(r.description || r.desc || ""),
      amount: Math.abs(Number(r.amount)),
      type: Number(r.amount) >= 0 ? "credit" : "debit",
      rawAmount: r.amount,
      category: classifyTransaction(r.description || r.desc || "", Number(r.amount))
    }));

  const parsedSummary = {
    begin: rawSummary.begin || null,
    end: rawSummary.end || null,
    credits: txs.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0),
    debits: txs.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0),
    txCount: txs.length,
    account
  };

  return { rawSummary, parsedSummary, transactions: txs };
}

function parseSummaryFromText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const numbers = {
    begin: null,
    end: null,
    credits: 0,
    debits: 0
  };

  const findByLabel = (labelPatterns) => {
    for (const line of lines) {
      const low = line.toLowerCase();
      if (labelPatterns.some((p) => low.includes(p))) {
        const value = findMoneyInLine(line);
        if (value != null) return value;
      }
    }
    return null;
  };

  numbers.begin = findByLabel(["beginning balance", "opening balance", "balance forward", "prior balance"]);
  numbers.end = findByLabel(["ending balance", "closing balance", "final balance", "balance as of"]);
  numbers.credits = findByLabel(["total credits", "total credit", "deposits total", "sum credits"]) ?? 0;
  numbers.debits = findByLabel(["total debits", "total debit", "withdrawals total", "sum debits"]) ?? 0;
  return numbers;
}

function parseCsvStatement(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  const header = tokenizeCsvLine(lines[0] || "").map((x) => x.toLowerCase());
  const iDate = findHeaderIndex(header, ["date", "trans date", "posting date", "transaction date"]);
  const iDesc = findHeaderIndex(header, ["description", "memo", "details", "name", "transaction"]);
  const iAmt = findHeaderIndex(header, ["amount", "amt", "net amount", "transaction amount"]);
  const iDeb = findHeaderIndex(header, ["debit", "withdrawal", "outflow"]);
  const iCred = findHeaderIndex(header, ["credit", "deposit", "inflow"]);

  if (iDate === -1 || iDesc === -1 || (iAmt === -1 && iDeb === -1 && iCred === -1)) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = tokenizeCsvLine(lines[i]);
    if (!cols.length) continue;
    const date = cols[iDate];
    const desc = cols[iDesc] || "";
    const amount = iAmt !== -1 ? parseMoney(cols[iAmt]) : amountFromDebitCredit(cols[iDeb], cols[iCred]);
    rows.push({ date, description: desc, amount });
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
  const txs = [];
  const lines = text.split(/\r?\n/);
  for (const ln of lines) {
    const match = lineToTransaction(ln);
    if (!match) continue;
    txs.push(match);
  }
  return txs;
}

function lineToTransaction(line) {
  const firstDate = line.match(/^\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(.+)$/);
  if (!firstDate) return null;
  const date = firstDate[1];
  const tail = firstDate[2];
  const money = findAllMoney(tail);
  if (!money.length) return null;
  let amountText = money[money.length - 1];
  const amount = parseMoney(amountText);
  if (amount == null) return null;

  const description = tail
    .replace(new RegExp(escapeForRegex(amountText), "g"), "")
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/\|/g, " ")
    .trim();

  return { date, description, amount };
}

function isCsvLike(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return false;
  const first = lines[0];
  return first.includes(",") && /date|description|amount|debit|credit|memo/i.test(first);
}

function classifyTransaction(desc, signedAmount) {
  const normalized = desc.toLowerCase();
  const amount = Number(signedAmount);
  const positive = amount > 0;
  const negative = amount < 0;

  const bestRule = matchLearnedRule(normalized);
  if (bestRule) return bestRule;

  if (positive) {
    if (containsAny(normalized, RULES.mcaFunding)) return "MCA Funding";
    if (containsAny(normalized, RULES.otherCredit)) return "Other";
    if (containsAny(normalized, RULES.trueRevenue)) return "True Revenue";
    return Math.abs(amount) > 4000 && containsAny(normalized, ["loan", "line of credit"]) ? "Other" : "True Revenue";
  }

  if (negative) {
    if (containsAny(normalized, RULES.mcaPayment)) return "MCA Payment";
    if (containsAny(normalized, RULES.personal)) return "Personal";
    if (containsAny(normalized, RULES.expense)) return "Expense";
    if (containsAny(normalized, RULES.otherCredit)) return "Other";
    if (Math.abs(amount) > 5000 && containsAny(normalized, ["loan", "finance", "card"])) return "Expense";
    return "Unknown";
  }

  return "Unknown";
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
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function findHeaderIndex(header, names) {
  for (let i = 0; i < header.length; i++) {
    const col = header[i].trim().toLowerCase();
    if (names.some((name) => col === name || col.includes(name))) return i;
  }
  return -1;
}

function tokenizeCsvLine(line) {
  const result = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' ) {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result.map((x) => x.replace(/^"|"$/g, ""));
}

function findMoneyInLine(line) {
  const m = line.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/);
  return m ? parseMoney(m[0]) : null;
}

function findAllMoney(line) {
  return line.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/g) || [];
}

function parseMoney(raw) {
  if (raw == null) return null;
  const clean = String(raw).replace(/,/g, "").replace(/\$/g, "").trim();
  if (!clean) return null;
  const negative = /^\(.*\)$/.test(clean) || clean.startsWith("-");
  const num = parseFloat(clean.replace(/[\(\)\-]/g, ""));
  if (Number.isNaN(num)) return null;
  return negative ? -num : num;
}

function formatDate(value, fallbackMonth) {
  const parts = String(value || "").split("/");
  if (parts.length >= 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
    const mm = parts[0].padStart(2, "0");
    const dd = parts[1].padStart(2, "0");
    return `${fallbackMonth}-${dd}`;
  }
  return String(value || "").trim();
}

function fmtMoney(val) {
  if (val == null || Number.isNaN(val)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val || 0);
}

function normalizeDescription(v) {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/["“”']/g, "");
}

function compareDateDesc(a, b) {
  const aV = Date.parse(toDateFallback(a));
  const bV = Date.parse(toDateFallback(b));
  return bV - aV;
}

function toDateFallback(v) {
  const m = String(v || "").match(/(\d{2})-(\d{2})-(\d{2,4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3].length === 2 ? `20${m[3]}` : m[3]}`;
  return String(v || "");
}

function escapeForRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sampleDeal() {
  const demoRaw =
`Beginning Balance 5,120.00
Total Credits 18,240.00
Total Debits 14,900.00
Ending Balance 8,460.00
06/03/2026 POS Sale ACME Inc 1,250.00
06/04/2026 ACME Supplies Invoice -1,200.00
06/05/2026 Zelle from customer - John 3,500.00
06/06/2026 Wire - Merchant cash payment to lender 500.00
06/06/2026 Restaurant Lunch Client Meeting 32.15
06/07/2026 ACH credit mortgage payoff -2,000.00
06/08/2026 MCA DAILY PAYMENT -550.00
06/09/2026 ACH transfer payroll -1,300.00
06/10/2026 ACH funding incoming - Loan disbursement 2,000.00`;

  const parsed = parseStatement(demoRaw, "2026-06", "Main checking");
  const deal = {
    id: crypto.randomUUID(),
    merchant: "Demo Grocery Supply LLC",
    subject: "IT ISO Demo - new submission",
    labels: "IT ISO",
    from: "it_iso@broker.com",
    isMine: true,
    status: "review",
    createdAt: new Date().toISOString(),
    months: {
      "2026-06": {
        month: "2026-06",
        docs: [{
          id: crypto.randomUUID(),
          account: "Main checking",
          sourceName: "demo.txt",
          createdAt: new Date().toISOString(),
          rawText: demoRaw,
          rawSummary: parsed.rawSummary,
          parsedTransactions: parsed.transactions,
          parsedSummary: parsed.parsedSummary
        }]
      }
    }
  };

  return deal;
}

document.addEventListener("DOMContentLoaded", () => {
  render();
});
