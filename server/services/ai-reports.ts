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
- Use clear markdown section headers (## and ###).
- Be concise but thorough.
- Use bullet points for lists.
- Include actionable recommendations.
- Flag any overdue commitments prominently.
- CRITICAL: Every report MUST have separate sections for each sales rep. Present each rep's data independently so the CEO can evaluate each person's performance.
- Use --- horizontal rules between major sections for visual separation.
- Format numbers with commas for readability (e.g., $125,000 not $125000).
- IMPORTANT: Include a "Notable Activities & Context" section that highlights non-deal work, demos, presentations, internal projects, and any other notable things each rep has been working on based on Fireflies meeting transcripts and summaries. This context is critical for the CEO to understand WHY performance may be lower or higher in a given week.
- When analyzing Fireflies meeting transcripts, look for mentions of demos, presentations, training, internal meetings, customer calls, and any other context that explains what each rep has been focused on.`;

export async function generateWeeklyEmail(): Promise<string> {
  const metrics = await computeMetricsForReport();

  const prompt = `Generate a weekly sales pipeline email update for Abe.

DATA:
${JSON.stringify(metrics, null, 2)}

Format as a professional report with markdown formatting:

## Subject Line
A clear, data-driven subject line

## Executive Summary
2-3 sentence overview of the week, including any notable context from team meetings

## Overall Revenue & Pipeline
- Total pipeline value, weighted pipeline, deals won this period
- Brief trend commentary

## Rep Performance: [Rep Name]
(Repeat this section for EACH rep in the data: ${metrics.repNames.join(", ")})
For each rep include:
- Open pipeline value and deal count
- Weighted pipeline
- Revenue won
- Activity count and breakdown (calls, emails, meetings, tasks)
- Meetings held this period
- Key deals to watch (top 3 by amount)
- Overdue commitments (if any, flag prominently)

## Notable Activities & Context
For EACH rep, review the Fireflies meeting transcripts and summaries to highlight:
- Demos given or being prepared
- Presentations created or delivered
- Internal projects or collaboration (e.g., working with colleagues on demos, training)
- Customer-facing activities beyond standard deal work
- Any other context that explains what each rep has been focused on
- This section is CRITICAL - the CEO needs to understand what reps are doing beyond just deal numbers

## Commitment Ledger
- Overdue items grouped by rep
- Recent commitments status

## Recommended Actions
- Specific, actionable items for the week ahead`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "Failed to generate report.";
}

export async function generateBiweeklyScorecard(): Promise<string> {
  const metrics = await computeMetricsForReport();

  const prompt = `Generate a biweekly CEO scorecard report for Abe.

DATA:
${JSON.stringify(metrics, null, 2)}

Format as a formal scorecard with markdown formatting:

## CEO Scorecard — Biweekly Review

### Overall Health Score
Rate as Green/Yellow/Red based on the data, with brief justification

### Revenue Performance
- Revenue vs target (if available)
- Pipeline coverage ratio
- Win rate trends

---

### Rep Scorecard: [Rep Name]
(Repeat this section for EACH rep: ${metrics.repNames.join(", ")})
For each rep include:
- Pipeline Summary: open deals count, total value, weighted value
- Activity Dashboard: calls, emails, meetings, tasks
- Top Deals: top 3-5 deals by amount with stage and close date
- Commitment Compliance: pending vs completed vs overdue
- Performance Rating: Green/Yellow/Red with brief commentary

---

### Notable Activities & Context This Period
For EACH rep, extract from Fireflies meeting transcripts and summaries:
- Key non-deal activities (demos, presentations, internal projects, training)
- Collaboration highlights (working with team members on specific projects)
- Customer-facing activities that provide context for performance
- Anything else notable that helps explain performance levels

---

### Risk Flags & Blockers
- Deals at risk (stale, low activity, approaching close date)
- Overdue commitments by rep

### Strategic Recommendations
- Specific actions for each rep
- Overall team recommendations`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 4096,
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

REP BREAKDOWN:
${JSON.stringify(metrics.byRep, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

COMMITMENT LEDGER:
${JSON.stringify(allCommitments.map(c => ({ content: c.content, type: c.type, owner: c.owner, status: c.status, dueDate: c.dueDate, meetingTitle: c.meetingTitle, meetingDate: c.meetingDate, firefliesUrl: c.firefliesUrl, snippet: c.snippet })), null, 2)}

FIREFLIES MEETING SUMMARIES (for context on what reps have been working on):
${JSON.stringify(metrics.recentFirefliesMeetings, null, 2)}

Generate a report addressing the user's specific request. ALWAYS separate data by rep (${metrics.repNames.join(", ")}). Include evidence from the data with specific deal names, amounts, and commitment references. Use markdown formatting with clear headers. Include notable activities and context from Fireflies meetings where relevant.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 4096,
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

REP BREAKDOWN:
${JSON.stringify(metrics.byRep, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

COMMITMENT LEDGER:
${JSON.stringify(allCommitments.map(c => ({ content: c.content, type: c.type, owner: c.owner, status: c.status, dueDate: c.dueDate, meetingTitle: c.meetingTitle, meetingDate: c.meetingDate, firefliesUrl: c.firefliesUrl, snippet: c.snippet })), null, 2)}

FIREFLIES MEETING SUMMARIES (for context on what reps have been working on):
${JSON.stringify(metrics.recentFirefliesMeetings, null, 2)}

Generate a report addressing the user's specific request. ALWAYS separate data by rep (${metrics.repNames.join(", ")}). Include evidence from the data with specific deal names, amounts, and commitment references. Use markdown formatting with clear headers. Include notable activities and context from Fireflies meetings where relevant.`;

  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 4096,
    stream: true,
  });
}
