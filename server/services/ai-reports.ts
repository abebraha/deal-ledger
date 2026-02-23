import OpenAI from "openai";
import { computeMetricsForReport } from "./metrics";
import { storage } from "../storage";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const WEEKLY_SYSTEM_PROMPT = `You are writing detailed sales updates for a CEO named Abe. Write like a sharp executive assistant — direct, specific, informative.

RULES:
- All facts MUST come from the data provided. Never invent numbers, names, or activities.
- If you don't have data for something, say "No data available" — do NOT guess or fabricate.
- Be specific and detailed. Include who was spoken to, what was discussed, and what comes next.
- Each point can be 2-4 lines — enough to convey the full picture.
- Separate each rep's section clearly.
- Format numbers with commas (e.g., $125,000).
- Write in a conversational but professional tone — like thorough briefing notes from a trusted assistant.
- CRITICAL: Activity counts (calls, emails, LinkedIn messages) MUST exactly match the numbers provided in the structured data. Do not round, estimate, or change these numbers.`;

const SCORECARD_SYSTEM_PROMPT = `You are a sales operations analyst for a CEO named Abe. You generate clear, data-driven scorecard reports.

RULES:
- All metrics you cite MUST come from the structured data provided. Never invent numbers.
- If a metric is not in the data, say "Data not available" — do NOT estimate or fabricate.
- When referencing a deal, include the deal name and amount.
- Use clear markdown section headers (## and ###).
- Be concise but thorough.
- CRITICAL: Every report MUST have separate sections for each sales rep.
- Format numbers with commas (e.g., $125,000).
- Use --- horizontal rules between major sections.
- CRITICAL: Activity counts (calls, emails, LinkedIn messages, total outbound) MUST exactly match the numbers in the provided data. Copy them directly — do not round, estimate, or change them.
- When comparing to goals, use the exact goal numbers provided.`;

export async function generateWeeklyEmail(accountId: number, selectedMeetingIds?: number[]): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const metrics = await computeMetricsForReport(accountId, weekAgo.toISOString(), now.toISOString());
  const allFirefliesMeetings = await storage.getFirefliesMeetings(accountId);

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

  const repSummaries = metrics.repNames.map(rep => {
    const rd = metrics.byRep[rep];
    if (!rd) return `${rep}: No data available`;

    const formatDetails = (items: any[]) => items.length > 0
      ? items.map((d: any) => `  - ${d.contactName || 'Unknown'} ${d.companyName ? `(${d.companyName})` : ''} — ${d.subject || ''} — ${d.date || ''}`).join('\n')
      : '  (none)';

    const formatMeetings = (items: any[]) => items.length > 0
      ? items.map((m: any) => `  - "${m.title}" with ${m.contactName || 'Unknown'}${m.companyName ? ` (${m.companyName})` : ''}${m.attendees ? ` [attendees: ${m.attendees}]` : ''} — ${m.startTime || ''} — outcome: ${m.outcome || 'N/A'}`).join('\n')
      : '  (none)';

    return `### ${rep}

**Activity Counts:**
- Calls: ${rd.calls}
- Emails: ${rd.emails}
- LinkedIn Messages: ${rd.linkedinMessages}
- Total Outbound: ${rd.totalOutbound} (goal: ${rd.weeklyOutboundGoal})
- Meetings Booked: ${rd.meetingsHeld} (goal: ${rd.weeklyMeetingsGoal})

**Call Details:**
${formatDetails(rd.callDetails || [])}

**Email Details:**
${formatDetails(rd.emailDetails || [])}

**LinkedIn Message Details:**
${formatDetails(rd.linkedinDetails || [])}

**Meeting Details (with contacts and companies):**
${formatMeetings(rd.meetingDetails || [])}

**Open Deals:**
${(rd.openDeals || []).map((d: any) => `  - ${d.name}${d.company ? ` (${d.company})` : ''} — $${(d.amount || 0).toLocaleString()} — Stage: ${d.stage} — Probability: ${d.probability || 0}% — Close: ${d.closeDate || 'TBD'}`).join('\n') || '  (none)'}

**Pipeline:** $${(rd.totalOpenPipeline || 0).toLocaleString()} (${rd.openDeals?.length || 0} deals) | Weighted: $${(rd.weightedPipeline || 0).toLocaleString()}
**Deals Won This Period:** ${rd.dealsWonThisPeriod} ($${(rd.revenueWonThisPeriod || 0).toLocaleString()})`;
  }).join('\n\n');

  const prompt = `Write a detailed weekly sales update for Abe based on the data below.

STRUCTURED ACTIVITY DATA (these numbers are exact — use them as-is):
${repSummaries}

SELECTED MEETINGS (${meetingsData.length}):
${meetingsData.length > 0 ? JSON.stringify(meetingsData, null, 2) : "No meetings selected."}

INSTRUCTIONS — follow this format exactly:

Start with one line: "Here's this week's update."

Then for EACH rep (${metrics.repNames.join(", ")}), write a section like this:

## [Rep Name]

Start with a quick one-line summary of their week (e.g., "Four broker meetings this week plus a demo build.").

Then list each key contact, deal, or topic discussed — one per block, with short bullet points underneath. Like this:

**[Contact Name] – [Company].**
Brief context about the relationship or opportunity.
Why it matters — one line.

**[Deal or Topic Name]**
What happened. One or two lines max.
What it means or what's next.

End each rep section with an **"Outreach This Week"** summary that EXACTLY matches the structured data above:
- Calls: [exact number from data]
- Emails: [exact number from data]
- LinkedIn Messages: [exact number from data]
- Total Outbound: [exact number from data] vs goal of [exact goal from data]
- Meetings: [exact number from data] vs goal of [exact goal from data]

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

export async function generateBiweeklyScorecard(accountId: number, selectedMeetingIds?: number[]): Promise<string> {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const metrics = await computeMetricsForReport(accountId, twoWeeksAgo.toISOString(), now.toISOString());
  const allFirefliesMeetings = await storage.getFirefliesMeetings(accountId);

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

  const formatActivityDetails = (items: any[]) => items.length > 0
    ? items.map((d: any) => `  - ${d.contactName || 'Unknown'} ${d.companyName ? `(${d.companyName})` : ''} — ${d.subject || ''} — ${d.date || ''}`).join('\n')
    : '  (none this period)';

  const formatMeetingDetails = (items: any[]) => items.length > 0
    ? items.map((m: any) => `  - "${m.title}" with ${m.contactName || 'Unknown'}${m.companyName ? ` (${m.companyName})` : ''}${m.attendees ? ` [attendees: ${m.attendees}]` : ''} — ${m.startTime || ''} — outcome: ${m.outcome || 'N/A'}`).join('\n')
    : '  (none this period)';

  const repDataSummaries = metrics.repNames.map(rep => {
    const rd = metrics.byRep[rep];
    if (!rd) return `${rep}: No data`;
    return `### ${rep} — EXACT NUMBERS (copy these directly)

**Counts:**
- Calls: ${rd.calls}, Emails: ${rd.emails}, LinkedIn: ${rd.linkedinMessages}, Total Outbound: ${rd.totalOutbound} (goal: ${rd.weeklyOutboundGoal})
- Meetings Booked: ${rd.meetingsHeld} (goal: ${rd.weeklyMeetingsGoal})

**Call Details:**
${formatActivityDetails(rd.callDetails || [])}

**Email Details:**
${formatActivityDetails(rd.emailDetails || [])}

**LinkedIn Details:**
${formatActivityDetails(rd.linkedinDetails || [])}

**Meeting Details (contacts & companies):**
${formatMeetingDetails(rd.meetingDetails || [])}

**All Open Deals:**
${(rd.openDeals || []).map((d: any) => `  - ${d.name}${d.company ? ` (${d.company})` : ''} — $${(d.amount || 0).toLocaleString()} — Stage: ${d.stage} — Prob: ${d.probability || 0}% — Close: ${d.closeDate || 'TBD'}`).join('\n') || '  (none)'}

**Pipeline:** $${(rd.totalOpenPipeline || 0).toLocaleString()} (${rd.openDeals?.length || 0} deals) | Weighted: $${(rd.weightedPipeline || 0).toLocaleString()}
**Deals Won This Period:** ${rd.dealsWonThisPeriod} ($${(rd.revenueWonThisPeriod || 0).toLocaleString()})
${(rd.wonDealsThisPeriod || []).map((d: any) => `  - ${d.name}${d.company ? ` (${d.company})` : ''} — $${(d.amount || 0).toLocaleString()}`).join('\n') || ''}
**All-Time Won:** ${rd.dealsWonAllTime} deals, $${(rd.revenueWonAllTime || 0).toLocaleString()}`;
  }).join('\n\n');

  const prompt = `Generate a biweekly CEO scorecard report for Abe.

OVERALL KPIs (exact numbers):
- All-Time Revenue (Closed Won): $${(metrics.kpis.revenue.total || 0).toLocaleString()}
- Revenue Won This Period: $${(metrics.kpis.revenue.periodRevenue || 0).toLocaleString()} (${metrics.kpis.revenue.periodDealsWon || 0} deals)
- Monthly Revenue Goal: $${(metrics.goals.monthlyRevenueGoal || 0).toLocaleString()}
- Open Pipeline: $${(metrics.kpis.pipeline.total || 0).toLocaleString()} (${metrics.kpis.pipeline.dealCount} deals)
- Weighted Pipeline: $${(metrics.kpis.pipeline.weighted || 0).toLocaleString()}

PER-REP DATA (these are exact — use these numbers directly, including contact/company details):
${repDataSummaries}

SELECTED FIREFLIES MEETINGS (${meetingsData.length} meeting${meetingsData.length !== 1 ? "s" : ""} for context):
${meetingsData.length > 0 ? JSON.stringify(meetingsData, null, 2) : "No meetings selected. Use available data for the Notable Activities section."}

Format as a formal scorecard with markdown formatting:

## CEO Scorecard — Biweekly Review

### Overall Health Score
Rate as Green/Yellow/Red based on the data, with brief justification

### Revenue Performance
- Revenue vs target (use exact numbers from above)
- Pipeline coverage ratio

---

### Rep Scorecard: [Rep Name]
(Repeat this section for EACH rep: ${metrics.repNames.join(", ")})
For each rep include:
- Pipeline Summary: open deals count, total value, weighted value — USE EXACT NUMBERS
- Activity Dashboard: calls (with who), emails (with who), LinkedIn messages (with who), meetings (with who at which company) — USE EXACT NUMBERS AND CONTACT DETAILS
- Outreach Summary: total outbound vs weekly goal — USE EXACT NUMBERS
- All Deals: list ALL deals with company, amount, stage, probability, close date — USE DEAL DATA EXACTLY
- Meetings Detail: list each meeting with contact name, company, date, outcome
- Performance Rating: Green/Yellow/Red with brief commentary

---

### Notable Activities & Context This Period
For EACH rep, reference specific contacts and companies from the activity data:
- Key meetings and who they were with
- Notable outreach patterns
- Context for performance from Fireflies transcripts if available

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

const REFINE_SYSTEM_PROMPT = `You are a report editor for a CEO named Abe. You receive an existing sales report and an instruction to modify it.

RULES:
- Return the COMPLETE updated report, not just the changed parts.
- Preserve the original markdown structure and formatting unless the instruction says to change it.
- All facts must come from the original report. Do not invent new data.
- You may reorganize, rewrite, add emphasis, remove sections, change tone, or restructure based on the instruction.
- Format numbers with commas (e.g., $125,000).
- CRITICAL: Do not change any numbers, metrics, or activity counts unless the instruction explicitly asks you to correct them.

FORMATTING (VERY IMPORTANT):
- You MUST use rich markdown formatting throughout. Never return plain text.
- Use # for main title, ## for major sections, ### for subsections, #### for sub-subsections.
- Use **bold** for key metrics, names, and emphasis.
- Use bullet lists (- item) for listing activities, deals, and details.
- Use numbered lists (1. item) for rankings or ordered items.
- Use markdown tables (| col1 | col2 |) for tabular data like metrics comparisons.
- Use --- for section dividers where appropriate.
- Match the formatting style and structure of the original report as closely as possible.`;

export async function refineReport(currentContent: string, instruction: string) {
  const prompt = `Here is the current report in markdown format:

\`\`\`markdown
${currentContent}
\`\`\`

INSTRUCTION: ${instruction}

Produce the COMPLETE updated report incorporating the requested changes. You MUST return the full report content using the same rich markdown formatting (headers, bold, bullet lists, tables, etc.) as the original. Do NOT return plain text.`;

  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: REFINE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 8192,
    stream: true,
  });
}

export async function streamCustomReport(accountId: number, userPrompt: string) {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const metrics = await computeMetricsForReport(accountId, twoWeeksAgo.toISOString(), now.toISOString());
  const allDeals = await storage.getDeals(accountId);

  const formatAD = (items: any[]) => items.length > 0
    ? items.map((d: any) => `  - ${d.contactName || 'Unknown'} ${d.companyName ? `(${d.companyName})` : ''} — ${d.subject || ''} — ${d.date || ''}`).join('\n')
    : '  (none)';
  const formatMD = (items: any[]) => items.length > 0
    ? items.map((m: any) => `  - "${m.title}" with ${m.contactName || 'Unknown'}${m.companyName ? ` (${m.companyName})` : ''}${m.attendees ? ` [${m.attendees}]` : ''} — ${m.startTime || ''}`).join('\n')
    : '  (none)';

  const repDataSummaries = metrics.repNames.map(rep => {
    const rd = metrics.byRep[rep];
    if (!rd) return `${rep}: No data`;
    return `### ${rep}
- Calls: ${rd.calls}, Emails: ${rd.emails}, LinkedIn: ${rd.linkedinMessages}, Total Outbound: ${rd.totalOutbound} (goal: ${rd.weeklyOutboundGoal})
- Meetings: ${rd.meetingsHeld} (goal: ${rd.weeklyMeetingsGoal})
- Pipeline: $${(rd.totalOpenPipeline || 0).toLocaleString()} | Weighted: $${(rd.weightedPipeline || 0).toLocaleString()}
- Won This Period: ${rd.dealsWonThisPeriod} deals, $${(rd.revenueWonThisPeriod || 0).toLocaleString()}
Call Details:
${formatAD(rd.callDetails || [])}
Email Details:
${formatAD(rd.emailDetails || [])}
LinkedIn Details:
${formatAD(rd.linkedinDetails || [])}
Meeting Details:
${formatMD(rd.meetingDetails || [])}
Open Deals:
${(rd.openDeals || []).map((d: any) => `  - ${d.name}${d.company ? ` (${d.company})` : ''} — $${(d.amount || 0).toLocaleString()} — ${d.stage} — ${d.probability || 0}% — Close: ${d.closeDate || 'TBD'}`).join('\n') || '  (none)'}`;
  }).join('\n\n');

  const prompt = `User request: "${userPrompt}"

AVAILABLE DATA — use these exact numbers:

OVERALL KPIs:
${JSON.stringify(metrics.kpis, null, 2)}

GOALS:
${JSON.stringify(metrics.goals, null, 2)}

PER-REP DATA (exact numbers, with contact/company details):
${repDataSummaries}

ALL DEALS:
${JSON.stringify(allDeals.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate, owner: d.owner, pipeline: d.pipeline, hubspotUrl: d.hubspotUrl })), null, 2)}

FIREFLIES MEETING SUMMARIES (for context on what reps have been working on):
${JSON.stringify(metrics.recentFirefliesMeetings, null, 2)}

Generate a report addressing the user's specific request. ALWAYS separate data by rep (${metrics.repNames.join(", ")}). Include evidence from the data with specific deal names, amounts, and references. Use markdown formatting with clear headers. Include notable activities and context from Fireflies meetings where relevant.
CRITICAL: All numbers must exactly match the data provided above. Do not estimate, round, or invent numbers.`;

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
