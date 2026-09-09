export const CATEGORIES = [
  "True Revenue",
  "Other",
  "MCA Funding",
  "MCA Payment",
  "Expense",
  "Personal",
  "Unknown"
];

const RULES = {
  trueRevenue: [
    "invoice", "payment from", "ach credit", "zelle", "wire transfer", "wire in",
    "check deposit", "customer", "client", "sale", "pos", "deposit", "stripe",
    "google checkout", "paypal"
  ],
  mcaFunding: [
    "mca", "merchant cash", "advance", "funding", "disbursement",
    "loan proceeds", "cash advance", "merchant finance"
  ],
  mcaPayment: [
    "mca", "merchant cash", "loan payment", "daily payment", "daily ach", "weekly payment",
    "advance payment", "mca payment", "payoff", "pay down", "finance charge", "payment to"
  ],
  expense: [
    "office", "rent", "supplies", "payroll", "advertising", "marketing", "fuel", "gas",
    "utility", "software", "subscription", "insurance", "cleaning", "maintenance", "service"
  ],
  personal: [
    "restaurant", "coffee", "uber", "lyft", "hotel", "starbucks", "cafe", "resort", "airbnb", "bar",
    "doordash", "grubhub", "target", "walmart", "costco", "kroger", "sams", "shell", "chevron",
    "personal", "cash withdrawal", "atm"
  ],
  otherCredit: [
    "line of credit", "interest", "refund", "chargeback", "reversal", "transfer", "internal",
    "returned", "loan", "credit line", "payout", "wire out"
  ]
};

function containsAny(text, tokens) {
  return tokens.some((token) => text.includes(token));
}

function parseMoney(raw) {
  if (raw == null) return null;
  const clean = String(raw).replace(/,/g, "").replace(/\$/g, "").trim();
  if (!clean) return null;
  const negative = clean.startsWith("-") || /^\(.*\)$/.test(clean);
  const num = parseFloat(clean.replace(/[()\-\s]/g, ""));
  if (Number.isNaN(num)) return null;
  return negative ? -num : num;
}

function parseSummaryFromText(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const numbers = { begin: null, end: null, credits: 0, debits: 0 };

  const findByLabel = (labels) => {
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (labels.some((label) => lower.includes(label))) {
        const found = line.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/);
        if (found) return parseMoney(found[0]);
      }
    }
    return null;
  };

  numbers.begin = findByLabel(["beginning balance", "opening balance", "balance forward", "prior balance"]);
  numbers.end = findByLabel(["ending balance", "closing balance", "balance as of", "final balance"]);
  numbers.credits = findByLabel(["total credits", "total credit", "deposits total", "sum credits"]) ?? 0;
  numbers.debits = findByLabel(["total debits", "total debit", "withdrawals total", "sum debits"]) ?? 0;
  return numbers;
}

function tokenizeCsvLine(line) {
  const output = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      output.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  output.push(current.trim());
  return output.map((value) => value.replace(/^"|"$/g, ""));
}

function isCsvLike(text) {
  const lines = String(text).split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return false;
  const header = lines[0].toLowerCase();
  return /,/.test(header) && /(date|description|amount|debit|credit|memo)/i.test(header);
}

function findHeaderIndex(header, names) {
  for (let i = 0; i < header.length; i += 1) {
    const column = header[i].trim().toLowerCase();
    if (names.some((name) => column.includes(name))) return i;
  }
  return -1;
}

function amountFromDebitCredit(debitText, creditText) {
  const debit = parseMoney(debitText);
  const credit = parseMoney(creditText);
  if (debit === null && credit === null) return null;
  if (debit !== null && credit !== null) return credit - debit;
  if (credit !== null) return credit;
  return -(debit || 0);
}

function parseTextRows(text) {
  const rows = [];
  const lines = String(text).split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(.+)$/);
    if (!match) continue;
    const date = match[1];
    const remainder = match[2];
    const money = remainder.match(/-?\(?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/g) || [];
    if (money.length === 0) continue;
    const amountText = money[money.length - 1];
    const amount = parseMoney(amountText);
    if (amount === null) continue;
    const description = remainder
      .replace(new RegExp(amountText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "")
      .replace(/\s{2,}/g, " ")
      .replace(/\|/g, " ")
      .trim();
    rows.push({ date, description, amount });
  }
  return rows;
}

function parseCsvRows(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length === 0) return [];
  const header = tokenizeCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iDate = findHeaderIndex(header, ["date", "trans date", "posting date", "transaction date"]);
  const iDesc = findHeaderIndex(header, ["description", "memo", "details", "transaction"]);
  const iAmt = findHeaderIndex(header, ["amount", "amt", "net amount", "transaction amount"]);
  const iDebit = findHeaderIndex(header, ["debit", "withdrawal", "outflow"]);
  const iCredit = findHeaderIndex(header, ["credit", "deposit", "inflow"]);
  if (iDate === -1 || iDesc === -1 || (iAmt === -1 && iDebit === -1 && iCredit === -1)) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = tokenizeCsvLine(lines[i]);
    if (!cols.length) continue;
    const rowAmount = iAmt !== -1 ? parseMoney(cols[iAmt]) : amountFromDebitCredit(cols[iDebit], cols[iCredit]);
    if (rowAmount === null || Number.isNaN(rowAmount)) continue;
    const rowDate = cols[iDate];
    const rowDesc = cols[iDesc] || "";
    if (!rowDate || !rowDesc) continue;
    rows.push({ date: rowDate, description: rowDesc, amount: rowAmount });
  }
  return rows;
}

function classifyTransaction(description, signedAmount) {
  const text = String(description || "").toLowerCase();
  const amount = Number(signedAmount);

  if (text.includes("mca") && text.includes("payment") && amount < 0) return "MCA Payment";
  if (containsAny(text, RULES.mcaPayment)) return "MCA Payment";
  if (containsAny(text, RULES.mcaFunding) && amount > 0) return "MCA Funding";
  if (containsAny(text, RULES.trueRevenue)) return "True Revenue";
  if (containsAny(text, RULES.personal)) return "Personal";
  if (containsAny(text, RULES.expense)) return "Expense";
  if (containsAny(text, RULES.otherCredit)) return "Other";
  if (amount > 0) return "True Revenue";
  return "Unknown";
}

function normalizeDescription(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMonthFallback(dateString, fallbackMonth) {
  const match = String(dateString || "").match(/^(\d{1,2})[\/-](\d{1,2})/);
  if (match) {
    const mm = match[1].padStart(2, "0");
    const dd = match[2].padStart(2, "0");
    return `${fallbackMonth}-${dd}`;
  }
  return String(dateString || "");
}

function normalizeDate(dateValue, fallbackMonth) {
  if (!dateValue) return "";
  return formatMonthFallback(dateValue, fallbackMonth);
}

function sumTransactions(transactions) {
  const credits = transactions.filter((tx) => tx.type === "credit").reduce((sum, tx) => sum + tx.amount, 0);
  const debits = transactions.filter((tx) => tx.type === "debit").reduce((sum, tx) => sum + tx.amount, 0);
  return { credits, debits };
}

export function parseStatement(rawText, opts = {}) {
  const month = opts.month || "";
  const rawSummary = parseSummaryFromText(rawText);
  const rows = isCsvLike(rawText) ? parseCsvRows(rawText) : parseTextRows(rawText);

  const transactions = rows
    .filter((row) => Number.isFinite(row.amount))
    .map((row) => {
      const amount = Number(row.amount);
      const type = amount >= 0 ? "credit" : "debit";
      return {
        id: crypto.randomUUID(),
        date: normalizeDate(row.date, month),
        description: normalizeDescription(row.description),
        amount: Math.abs(amount),
        signedAmount: amount,
        type,
        rawAmount: amount,
        category: classifyTransaction(row.description, amount)
      };
    });

  const totals = sumTransactions(transactions);
  const parsedSummary = {
    begin: rawSummary.begin,
    end: rawSummary.end,
    credits: totals.credits,
    debits: totals.debits,
    txCount: transactions.length
  };

  return {
    rawSummary,
    parsedSummary,
    transactions
  };
}

export function inferMerchantName({ subject = "", from = "", body = "" }) {
  const text = `${subject} ${from} ${body}`.toLowerCase();
  const subjectMatch = subject.match(/([A-Za-z0-9\s&.'-]{3,40})(?:\s+-\s+|\s*submission|\s*app|\bit\s+iso\b|\s*mca|\s*statement)/i);
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1].trim();
  }
  if (from.includes("@")) return from.split("@")[0].replace(/[._-]/g, " ").trim();
  return "Unknown merchant";
}

export function isMineSubmission(labelString = "") {
  return /\bIT\s*ISO\b/i.test(labelString);
}
