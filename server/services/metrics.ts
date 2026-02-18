import { storage } from "../storage";

export async function computeMetricsForReport(accountId: number, periodStart?: string, periodEnd?: string) {
  const kpis = await storage.computeKPIs(accountId, periodStart, periodEnd);
  const allDeals = await storage.getDeals(accountId);
  const allActivities = await storage.getActivities(accountId);
  const allMeetings = await storage.getMeetings(accountId);
  const firefliesMtgs = await storage.getFirefliesMeetings(accountId);

  const periodActivities = filterByDateRange(allActivities, 'activityDate', periodStart, periodEnd);
  const periodMeetings = filterByDateRange(allMeetings, 'startTime', periodStart, periodEnd);

  const openDeals = allDeals
    .filter(d => d.stage !== "Closed Won" && d.stage !== "closedwon" && d.stage !== "Closed Lost" && d.stage !== "closedlost")
    .map(d => ({
      name: d.name,
      company: d.companyName,
      amount: d.amount,
      stage: d.stage,
      probability: d.probability,
      closeDate: d.closeDate,
      owner: d.owner,
      hubspotUrl: d.hubspotUrl,
    }));

  const configuredReps = await storage.getActiveSalesReps(accountId);
  const repNames = configuredReps.length > 0
    ? configuredReps.map(r => r.name)
    : extractRepNamesFromData(allDeals, allActivities);

  const byRep: Record<string, any> = {};
  for (const rep of repNames) {
    const repDeals = allDeals.filter(d => matchesRep(d.owner, rep));
    const repOpen = repDeals.filter(d => d.stage !== "Closed Won" && d.stage !== "closedwon" && d.stage !== "Closed Lost" && d.stage !== "closedlost");
    const repWon = repDeals.filter(d => d.stage === "Closed Won" || d.stage === "closedwon");
    const repActivities = periodActivities.filter(a => matchesRep(a.owner, rep));
    const repMeetings = periodMeetings.filter(m => matchesRep(m.owner, rep));

    byRep[rep] = {
      openDeals: repOpen.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate })),
      totalOpenPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0), 0),
      weightedPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0) * (d.probability || 0) / 100, 0),
      dealsWon: repWon.length,
      revenueWon: repWon.reduce((sum, d) => sum + (d.amount || 0), 0),
      totalActivities: repActivities.length,
      activitiesByType: countByType(repActivities),
      meetingsHeld: repMeetings.length,
      meetings: repMeetings.slice(0, 10).map(m => ({ title: m.title, startTime: m.startTime, outcome: m.outcome })),
    };
  }

  const periodFireflies = periodStart
    ? firefliesMtgs.filter(m => {
        if (!m.meetingDate) return false;
        const d = new Date(m.meetingDate).toISOString();
        return d >= periodStart && (!periodEnd || d <= periodEnd);
      })
    : firefliesMtgs;

  const recentFirefliesMeetings = periodFireflies
    .slice(0, 20)
    .map(m => ({
      title: m.title,
      date: m.meetingDate,
      duration: m.duration,
      participants: m.participants,
      summary: m.summary,
      outline: m.outline,
      keywords: m.keywords,
      transcriptSnippet: m.transcript ? m.transcript.substring(0, 2000) : null,
    }));

  return {
    kpis,
    openDeals,
    byRep,
    repNames,
    recentFirefliesMeetings,
    generatedAt: new Date().toISOString(),
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
  };
}

function filterByDateRange(items: any[], dateField: string, start?: string, end?: string): any[] {
  if (!start) return items;
  return items.filter(item => {
    const d = item[dateField];
    if (!d) return false;
    return d >= start && (!end || d <= end);
  });
}

function extractRepNamesFromData(deals: any[], activities: any[]): string[] {
  const owners = new Set<string>();
  for (const d of deals) { if (d.owner) owners.add(d.owner.trim()); }
  for (const a of activities) { if (a.owner) owners.add(a.owner.trim()); }
  const reps = Array.from(owners).filter(name => name.length > 0);
  return reps.length > 0 ? reps.sort() : [];
}

function matchesRep(owner: string | null | undefined, rep: string): boolean {
  if (!owner) return false;
  const lower = owner.toLowerCase().trim();
  const repLower = rep.toLowerCase();
  return lower.includes(repLower) || lower === repLower;
}

function countByType(items: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = item.type || "other";
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}
