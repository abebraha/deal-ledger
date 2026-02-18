import { storage } from "../storage";

export async function computeMetricsForReport(periodStart?: string, periodEnd?: string) {
  const kpis = await storage.computeKPIs(periodStart, periodEnd);
  const allDeals = await storage.getDeals();
  const allCommitments = await storage.getCommitments();
  const allActivities = await storage.getActivities();

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

  const overdueCommitments = allCommitments
    .filter(c => {
      if (c.status !== "pending" || !c.dueDate) return false;
      return new Date(c.dueDate) < new Date();
    })
    .map(c => ({
      content: c.content,
      owner: c.owner,
      dueDate: c.dueDate,
      meetingTitle: c.meetingTitle,
      firefliesUrl: c.firefliesUrl,
      snippet: c.snippet,
    }));

  const recentCommitments = allCommitments
    .slice(0, 20)
    .map(c => ({
      content: c.content,
      owner: c.owner,
      status: c.status,
      dueDate: c.dueDate,
      meetingTitle: c.meetingTitle,
      type: c.type,
      firefliesUrl: c.firefliesUrl,
    }));

  const repNames = extractRepNames(allDeals, allActivities, allCommitments);

  const byRep: Record<string, any> = {};
  for (const rep of repNames) {
    const repDeals = allDeals.filter(d => matchesRep(d.owner, rep));
    const repOpen = repDeals.filter(d => d.stage !== "Closed Won" && d.stage !== "closedwon" && d.stage !== "Closed Lost" && d.stage !== "closedlost");
    const repWon = repDeals.filter(d => d.stage === "Closed Won" || d.stage === "closedwon");
    const repActivities = allActivities.filter(a => matchesRep(a.owner, rep));
    const repCommitments = allCommitments.filter(c => matchesRep(c.owner, rep));
    const repOverdue = repCommitments.filter(c => c.status === "pending" && c.dueDate && new Date(c.dueDate) < new Date());

    byRep[rep] = {
      openDeals: repOpen.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate })),
      totalOpenPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0), 0),
      weightedPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0) * (d.probability || 0) / 100, 0),
      dealsWon: repWon.length,
      revenueWon: repWon.reduce((sum, d) => sum + (d.amount || 0), 0),
      totalActivities: repActivities.length,
      activitiesByType: countByType(repActivities),
      commitments: repCommitments.slice(0, 10).map(c => ({ content: c.content, status: c.status, dueDate: c.dueDate, meetingTitle: c.meetingTitle, type: c.type })),
      overdueCommitments: repOverdue.map(c => ({ content: c.content, dueDate: c.dueDate, meetingTitle: c.meetingTitle })),
      overdueCount: repOverdue.length,
    };
  }

  return {
    kpis,
    openDeals,
    overdueCommitments,
    recentCommitments,
    byRep,
    repNames,
    generatedAt: new Date().toISOString(),
  };
}

function extractRepNames(deals: any[], activities: any[], commitments: any[]): string[] {
  const owners = new Set<string>();
  for (const d of deals) { if (d.owner) owners.add(normalizeRepName(d.owner)); }
  for (const a of activities) { if (a.owner) owners.add(normalizeRepName(a.owner)); }
  for (const c of commitments) { if (c.owner) owners.add(normalizeRepName(c.owner)); }

  const reps = Array.from(owners).filter(name => name.length > 0);
  
  if (reps.length === 0) {
    return ["Deb", "Dovi"];
  }
  return reps.sort();
}

function normalizeRepName(name: string): string {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  if (lower.includes("deborah") || lower.includes("deb")) return "Deb";
  if (lower.includes("dov") || lower.includes("dovi")) return "Dovi";
  return name.trim();
}

function matchesRep(owner: string | null | undefined, rep: string): boolean {
  if (!owner) return false;
  return normalizeRepName(owner) === rep;
}

function countByType(items: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = item.type || "other";
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}
