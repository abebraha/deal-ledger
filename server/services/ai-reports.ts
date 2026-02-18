import OpenAI from "openai";
import { computeMetricsForReport } from "./metrics";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const WEEKLY_SYSTEM_PROMPT = `You are writing detailed sales updates for a CEO named Abe. Write like a sharp executive assistant — direct, specific, informative.

RULES:
- All facts MUST come from the data provided. Never invent numbers or names.
- Be specific and detailed. Include who was spoken to, what was discussed, and what comes next.
- Each point can be 2-4 lines — enough to convey the full picture.
- Separate each rep's section clearly.
- Format numbers with commas (e.g., $125,000).
- Write in a conversational but professional tone — like thorough briefing notes from a trusted assistant.`;

const SCORECARD_SYSTEM_PROMPT = `You are a sales operations analyst for a CEO named Abe. You generate clear, data-driven scorecard reports.

RULES:
- All metrics you cite MUST come from the structured data provided. Never invent numbers.
- When referencing a deal, include the deal name and amount.
- Use clear markdown section headers (## and ###).
- Be concise but thorough.
- CRITICAL: Every report MUST have separate sections for each sales rep.
- Format numbers with commas (e.g., $125,000).
- Use --- horizontal rules between major sections.`;

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
    transcriptSnippet: m.transcript ? m.transcript.substring(0, 6000) : null,
  }));

  const prompt = `Write a detailed weekly sales update for Abe based on the meeting recordings below.

SELECTED MEETINGS (${meetingsData.length}):
${meetingsData.length > 0 ? JSON.stringify(meetingsData, null, 2) : "No meetings selected."}

Rep names: ${metrics.repNames.join(", ")}

INSTRUCTIONS — follow this format exactly:

Start with one line: "Here's this week's update."

Then for EACH rep, write a section like this:

## [Rep Name]

Start with a quick one-line summary of their week (e.g., "Four broker meetings this week plus a demo build.").

Then list each key contact, deal, or topic discussed — one per block, with short bullet points underneath. Like this:

**[Contact Name] – [Company].**
Brief context about the relationship or opportunity.
Why it matters — one line.

**[Deal or Topic Name]**
What happened. One or two lines max.
What it means or what's next.

End each rep section with a brief "Outreach" or "Other" note if relevant (e.g., LinkedIn activity, CRM updates, tools built).

STYLE RULES:
- Be detailed but scannable. Include specifics — names, amounts, next steps, context.
- No headers like "Meeting Recap" or "Action Items" — just flow naturally per rep.
- No pipeline numbers or KPI tables — that's for the biweekly scorecard.
- Bold contact/company names. Use line breaks between points, not nested bullets.
- If a deal has a dollar amount or size metric (lives, caregivers, etc.), include it.
- Include specific quotes or notable details from transcripts when they add value.
- For each contact, explain: who they are, what was discussed, what the opportunity is, and what the next step is.
- Tone: direct, informal, like briefing notes from a trusted assistant.
- The report should give Abe enough detail to feel fully informed without reading the transcripts himself.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: WEEKLY_SYSTEM_PROMPT },
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
      { role: "system", content: SCORECARD_SYSTEM_PROMPT },
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
      { role: "system", content: SCORECARD_SYSTEM_PROMPT },
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
      { role: "system", content: SCORECARD_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 4096,
    stream: true,
  });
}
