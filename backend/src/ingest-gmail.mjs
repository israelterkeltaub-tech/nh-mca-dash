import { isMineSubmission, inferMerchantName } from "./shared/parser.mjs";

const DEFAULT_STATUS = "review";

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
  if (!event || !event.body) {
    return {};
  }
  if (typeof event.body === "object") {
    return event.body;
  }
  try {
    return JSON.parse(event.body);
  } catch (err) {
    return {};
  }
}

function normalizeSubmission(payload = {}) {
  const subject = (payload.subject || "").toString().trim();
  const from = (payload.from || payload.sender || "").toString().trim();
  const labels = (payload.labels || "").toString();
  const body = (payload.bodyText || payload.snippet || "").toString();

  return {
    id: payload.messageId || payload.id || crypto.randomUUID(),
    source: "gmail",
    merchant: payload.merchant || inferMerchantName({ subject, from, body }),
    subject,
    from,
    labels,
    status: DEFAULT_STATUS,
    isMine: isMineSubmission(labels),
    receivedAt: payload.receivedAt || new Date().toISOString(),
    notes: payload.notes || "",
    attachmentCount: Array.isArray(payload.attachments) ? payload.attachments.length : 0
  };
}

export async function handler(event) {
  const payload = parseBody(event);
  if (!payload.subject && !payload.from && !payload.bodyText && !payload.snippet) {
    return jsonResponse(400, { error: "Missing email payload." });
  }

  const submission = normalizeSubmission(payload);
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const statements = attachments.map((attachment) => ({
    account: attachment.account || "Primary account",
    monthHint: attachment.monthHint || "",
    sourceName: attachment.fileName || "statement attachment",
    mimeType: attachment.mimeType || "text/plain",
    text: attachment.text || "",
    attachedAt: attachment.attachedAt || new Date().toISOString()
  }));

  return jsonResponse(200, { submission, statements });
}
