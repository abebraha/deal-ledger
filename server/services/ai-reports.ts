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
- Use clear markdown section headers (## and ###).
- Be concise but thorough.
- Use bullet points for lists.
- Include actionable recommendations.
- CRITICAL: Every report MUST have separate sections for each sales rep. Present each rep's data independently so the CEO can evaluate each person's performance.
- Use --- horizontal rules between major sections for visual separation.
- Format numbers with commas for readability (e.g., $125,000 not $125000).
- IMPORTANT: Include a "Notable Activities & Context" section that highlights non-deal work, demos, presentations, internal projects, and any other notable things each rep has been working on based on Fireflies meeting transcripts and summaries. This context is critical for the CEO to understand WHY performance may be lower or higher in a given week.
- When analyzing Fireflies meeting transcripts, look for mentions of demos, presentations, training, internal meetings, customer calls, and any other context that explains what each rep has been focused on.`;

export async function generateWeeklyEmail(selectedMeetingIds?: number[]): Promise<string> {
  const metrics = await computeMetricsForReport();
  const allFirefliesMeetings = await storage.getFirefliesMeetings();

  let selectedMeetings: typeof allFirefliesMeetings;

  if (selectedMeetingIds && selectedMeetingIds.length > 0) {
    selectedMeetings = allFirefliesMeetings.filter(m => selectedMeetingIds.includes(m.id));
  } else {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceThursday = (dayOfWeek + 7 - 4) % 7 || 7;
    const lastThursday = new Date(now);
    lastThursday.setDate(now.getDate() - daysSinceThursday);
    lastThursday.setHours(0, 0, 0, 0);
    const weekStart = new Date(lastThursday);
    weekStart.setDate(lastThursday.getDate() - 3);

    selectedMeetings = allFirefliesMeetings.filter(m => {
      if (!m.meetingDate) return false;
      const d = new Date(m.meetingDate);
      return d >= weekStart && d <= now;
    });
  }

  const meetingsData = selectedMeetings.map(m => ({
    title: m.title,
    date: m.meetingDate,
    duration: m.duration,
    participants: m.participants,
    summary: m.summary,
    outline: m.outline,
    keywords: m.keywords,
    transcriptSnippet: m.transcript ? m.transcript.substring(0, 4000) : null,
  }));

  const prompt = `Generate a weekly sales meeting recap email for Abe.

This report should be focused on what was discussed in the selected meetings, NOT a full pipeline review. The biweekly scorecard covers pipeline metrics in detail — this weekly email is about the meetings themselves.

SELECTED MEETINGS (${meetingsData.length} meeting${meetingsData.length !== 1 ? "s" : ""}):
${meetingsData.length > 0 ? JSON.stringify(meetingsData, null, 2) : "No meetings were selected or found. Generate a brief note indicating no meeting data is available for this period."}

BRIEF PIPELINE CONTEXT (for reference only, not the focus):
- Total pipeline: $${metrics.kpis.pipeline.total.toLocaleString()} (${metrics.kpis.pipeline.dealCount} deals)
- Revenue closed: $${metrics.kpis.revenue.total.toLocaleString()}
- Rep names: ${metrics.repNames.join(", ")}

Format as a professional email with markdown formatting:

## Subject Line
Reference the meeting date(s) and key takeaway

## Meeting Recap
Summarize the key topics, discussions, and outcomes from the selected meetings. What was talked about? What decisions were made? What updates did each rep share?

## Rep Updates: [Rep Name]
(Repeat for EACH rep: ${metrics.repNames.join(", ")})
Based on what was discussed in the meeting:
- What did this rep report on?
- What deals or prospects did they mention?
- Any challenges or wins they shared?
- What are they focused on this coming week?

## Key Discussion Points
Bullet-point the main topics covered in the meeting — deals discussed, strategies debated, challenges raised, decisions made

## Action Items & Next Steps
What needs to happen before the next meeting? Who owns what?

## Quick Pipeline Check
Just 2-3 sentences of high-level pipeline context (total value, any notable changes) — keep this brief since the biweekly scorecard covers this in depth`;

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

export async function generateBiweeklyScorecard(selectedMeetingIds?: number[]): Promise<string> {
  const metrics = await computeMetricsForReport();
  const allFirefliesMeetings = await storage.getFirefliesMeetings();

  let selectedMeetings: typeof allFirefliesMeetings;
  if (selectedMeetingIds && selectedMeetingIds.length > 0) {
    selectedMeetings = allFirefliesMeetings.filter(m => selectedMeetingIds.includes(m.id));
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    selectedMeetings = allFirefliesMeetings.filter(m => {
      if (!m.meetingDate) return true;
      return new Date(m.meetingDate) >= thirtyDaysAgo;
    });
  }

  const meetingsData = selectedMeetings.map(m => ({
    title: m.title,
    date: m.meetingDate,
    duration: m.duration,
    participants: m.participants,
    summary: m.summary,
    outline: m.outline,
    keywords: m.keywords,
    transcriptSnippet: m.transcript ? m.transcript.substring(0, 4000) : null,
  }));

  const prompt = `Generate a biweekly CEO scorecard report for Abe.

PIPELINE & ACTIVITY DATA:
${JSON.stringify(metrics, null, 2)}

SELECTED FIREFLIES MEETINGS (${meetingsData.length} meeting${meetingsData.length !== 1 ? "s" : ""} for context):
${meetingsData.length > 0 ? JSON.stringify(meetingsData, null, 2) : "No meetings selected. Use available data for the Notable Activities section."}

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

  const prompt = `User request: "${userPrompt}"

AVAILABLE DATA:
KPIs: ${JSON.stringify(metrics.kpis, null, 2)}

REP BREAKDOWN:
${JSON.stringify(metrics.byRep, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

FIREFLIES MEETING SUMMARIES (for context on what reps have been working on):
${JSON.stringify(metrics.recentFirefliesMeetings, null, 2)}

Generate a report addressing the user's specific request. ALWAYS separate data by rep (${metrics.repNames.join(", ")}). Include evidence from the data with specific deal names, amounts, and references. Use markdown formatting with clear headers. Include notable activities and context from Fireflies meetings where relevant.`;

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

  const prompt = `User request: "${userPrompt}"

AVAILABLE DATA:
KPIs: ${JSON.stringify(metrics.kpis, null, 2)}

REP BREAKDOWN:
${JSON.stringify(metrics.byRep, null, 2)}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, hubspotUrl: d.hubspotUrl })), null, 2)}

FIREFLIES MEETING SUMMARIES (for context on what reps have been working on):
${JSON.stringify(metrics.recentFirefliesMeetings, null, 2)}

Generate a report addressing the user's specific request. ALWAYS separate data by rep (${metrics.repNames.join(", ")}). Include evidence from the data with specific deal names, amounts, and references. Use markdown formatting with clear headers. Include notable activities and context from Fireflies meetings where relevant.`;

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
