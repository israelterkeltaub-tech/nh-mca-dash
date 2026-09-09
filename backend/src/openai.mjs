const BASELINE = {
  score: 50,
  note: "insufficient context",
  recommendations: []
};

async function classifyWithOpenAI(payload = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return BASELINE;

  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "You are a risk analyst for merchant cash advance underwriting. Return compact JSON only."
        },
        {
          role: "user",
          content: `Summarize underwriting posture from parsed bank data. ${JSON.stringify(payload)}`
        }
      ],
      max_tokens: 300
    });
    const text = response.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(text);
      return {
        score: Number(parsed.score ?? BASELINE.score),
        note: String(parsed.note || BASELINE.note),
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    } catch (err) {
      return BASELINE;
    }
  } catch (err) {
    return BASELINE;
  }
}

export async function buildOpenAiSummary(payload = {}) {
  if (!process.env.OPENAI_API_KEY) return BASELINE;
  return classifyWithOpenAI(payload);
}
