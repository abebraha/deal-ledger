import OpenAI from "openai";
import { computeMetricsForReport } from "./metrics";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a sales operations analyst for a CEO named Abe. You generate clear, data-driven reports.

RULES:
- All metrics you cite MUST come from the structured data provided. Never invent numbers.
- When referencing a deal, include the deal name and amount.
- When referencing a commitment from Fireflies, include the meeting title and any URL if available.
- Use clear section headers.
- Be concise but thorough.
- Use bullet points for lists.
- Include actionable recommendations.
- Flag any overdue commitments prominently.`;

export async function generateWeeklyEmail(): Promise<string> {
  const metrics = await computeMetricsForReport();

  const prompt = `Generate a weekly sales pipeline email update for Abe.

DATA:
${JSON.stringify(metrics, null, 2)}

Format as an email with:
1. Subject line
2. Executive summary (2-3 sentences)
3. Revenue & Pipeline section with exact numbers
4. Activity metrics vs goals
5. Commitment Ledger update (overdue items flagged)
6. Key deals to watch
7. Recommended actions for the week`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "Failed to generate report.";
}

export async function generateBiweeklyScorecard(): Promise<string> {
  const metrics = await computeMetricsForReport();

  const prompt = `Generate a biweekly CEO scorecard report for Abe.

DATA:
${JSON.stringify(metrics, null, 2)}

Format as a formal scorecard with:
1. Title: "CEO Scorecard - Biweekly Review"
2. Overall Health Score (Red/Yellow/Green based on data)
3. Revenue Performance vs Target
4. Pipeline Health Analysis
5. Activity Metrics Dashboard
6. Commitment Compliance (compare Fireflies commitments against HubSpot KPIs)
7. Team Performance Summary
8. Risk Flags and Blockers
9. Strategic Recommendations`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "Failed to generate scorecard.";
}

export async function generateCustomReport(userPrompt: string): Promise<string> {
  const metrics = await computeMetricsForReport();
  const allDeals = await storage.getDeals();
  const allCommitments = await storage.getCommitments();

  const prompt = `User request: "${userPrompt}"

AVAILABLE DATA:
KPIs: ${JSON.stringify(metrics.kpis, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

COMMITMENT LEDGER:
${JSON.stringify(allCommitments.map(c => ({ content: c.content, type: c.type, owner: c.owner, status: c.status, dueDate: c.dueDate, meetingTitle: c.meetingTitle, meetingDate: c.meetingDate, firefliesUrl: c.firefliesUrl, snippet: c.snippet })), null, 2)}

Generate a report addressing the user's specific request. Include evidence from the data with specific deal names, amounts, and commitment references.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "Failed to generate custom report.";
}

export async function streamCustomReport(userPrompt: string) {
  const metrics = await computeMetricsForReport();
  const allDeals = await storage.getDeals();
  const allCommitments = await storage.getCommitments();

  const prompt = `User request: "${userPrompt}"

AVAILABLE DATA:
KPIs: ${JSON.stringify(metrics.kpis, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

COMMITMENT LEDGER:
${JSON.stringify(allCommitments.map(c => ({ content: c.content, type: c.type, owner: c.owner, status: c.status, dueDate: c.dueDate, meetingTitle: c.meetingTitle, meetingDate: c.meetingDate, firefliesUrl: c.firefliesUrl, snippet: c.snippet })), null, 2)}

Generate a report addressing the user's specific request. Include evidence from the data with specific deal names, amounts, and commitment references.`;

  return openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4096,
    stream: true,
  });
}
