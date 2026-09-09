import { parseStatement } from "./shared/parser.mjs";
import { buildOpenAiSummary } from "./openai.mjs";

const OPENAI_FALLBACK = {
  trueRevenue: 0,
  mcaFunding: 0,
  mcaPayments: 0
};

function jsonResponse(code, body) {
  return {
    statusCode: code,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
}

function parseBody(event) {
  if (!event || !event.body) return {};
  if (typeof event.body === "object") return event.body;
  try {
    return JSON.parse(event.body);
  } catch (err) {
    return {};
  }
}

function aggregateCategoryTotals(transactions = []) {
  const totals = {};
  for (const tx of transactions) {
    const key = tx.category || "Unknown";
    totals[key] = (totals[key] || 0) + Math.abs(tx.amount || 0);
  }
  return totals;
}

function deriveMcaSignals(transactions = []) {
  const mcaPayments = transactions.filter((tx) => tx.category === "MCA Payment");
  const trueRevenue = transactions.filter((tx) => tx.category === "True Revenue");
  const totalMcaMonthlyBurden = mcaPayments.reduce((sum, tx) => sum + tx.amount, 0);
  const totalTrueRevenue = trueRevenue.reduce((sum, tx) => sum + tx.amount, 0);
  return {
    trueRevenueCount: trueRevenue.length,
    trueRevenueAmount: totalTrueRevenue,
    mcaPaymentCount: mcaPayments.length,
    mcaMonthlyBurden: totalMcaMonthlyBurden
  };
}

export async function handler(event) {
  const payload = parseBody(event);
  const rawText = (payload.statementText || payload.text || "").toString();
  const month = (payload.month || "").toString();
  const merchant = (payload.merchant || "").toString();

  if (!rawText) {
    return jsonResponse(400, { error: "Missing statementText." });
  }

  const parsed = parseStatement(rawText, { month });
  const categoryTotals = aggregateCategoryTotals(parsed.transactions);
  const signals = deriveMcaSignals(parsed.transactions);

  let aiSummary = OPENAI_FALLBACK;
  if (process.env.OPENAI_API_KEY) {
    aiSummary = await buildOpenAiSummary({
      merchant,
      month,
      transactions: parsed.transactions,
      rawSummary: parsed.rawSummary
    });
  }

  return jsonResponse(200, {
    parsedSummary: parsed.parsedSummary,
    rawSummary: parsed.rawSummary,
    categoryTotals,
    transactions: parsed.transactions,
    signals,
    aiSummary
  });
}
