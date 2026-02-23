import { storage } from "../storage";

export async function computeMetricsForReport(accountId: number, periodStart?: string, periodEnd?: string) {
  const kpis = await storage.computeKPIs(accountId, periodStart, periodEnd);
  const allDeals = await storage.getDeals(accountId);
  const allActivities = await storage.getActivities(accountId);
  const allMeetings = await storage.getMeetings(accountId);
  const firefliesMtgs = await storage.getFirefliesMeetings(accountId);
  const allSettings = await storage.getAllSettings(accountId);

  const periodActivities = filterByDateRange(allActivities, 'activityDate', periodStart, periodEnd);
  const periodMeetings = filterByDateRange(allMeetings, 'startTime', periodStart, periodEnd);

  const isClosedWon = (s: string) => s.toLowerCase() === "closed won" || s.toLowerCase() === "closedwon";
  const isClosedLost = (s: string) => s.toLowerCase() === "closed lost" || s.toLowerCase() === "closedlost";

  const openDeals = allDeals
    .filter(d => !isClosedWon(d.stage) && !isClosedLost(d.stage))
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

  const closedWonDeals = allDeals
    .filter(d => isClosedWon(d.stage))
    .map(d => ({
      name: d.name,
      company: d.companyName,
      amount: d.amount,
      stage: d.stage,
      closeDate: d.closeDate,
      owner: d.owner,
    }));

  const configuredReps = await storage.getActiveSalesReps(accountId);
  const repNames = configuredReps.length > 0
    ? configuredReps.map(r => r.name)
    : extractRepNamesFromData(allDeals, allActivities);

  const weeklyOutboundGoal = parseInt(allSettings.weeklyOutboundGoal || "50");
  const weeklyMeetingsGoal = parseInt(allSettings.weeklyMeetingsGoal || "15");
  const monthlyRevenueGoal = parseInt(allSettings.hubspotRevenueGoal || allSettings.monthlyRevenueGoal || "100000");

  const goals = {
    weeklyOutboundGoal,
    weeklyMeetingsGoal,
    monthlyRevenueGoal,
  };

  const byRep: Record<string, any> = {};
  for (const rep of repNames) {
    const repDeals = allDeals.filter(d => matchesRep(d.owner, rep));
    const repOpen = repDeals.filter(d => !isClosedWon(d.stage) && !isClosedLost(d.stage));
    const repAllWon = repDeals.filter(d => isClosedWon(d.stage));
    const repPeriodWon = periodStart
      ? repAllWon.filter(d => {
          const cd = d.closeDate || d.lastActivityDate;
          if (!cd) return false;
          return cd >= periodStart && (!periodEnd || cd <= periodEnd);
        })
      : repAllWon;
    const repActivities = periodActivities.filter(a => matchesRep(a.owner, rep));
    const repMeetings = periodMeetings.filter(m => matchesRep(m.owner, rep));

    const activityCounts = countByTypeNormalized(repActivities);

    byRep[rep] = {
      openDeals: repOpen.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, stage: d.stage, probability: d.probability, closeDate: d.closeDate })),
      totalOpenPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0), 0),
      weightedPipeline: repOpen.reduce((sum, d) => sum + (d.amount || 0) * (d.probability || 0) / 100, 0),
      dealsWonAllTime: repAllWon.length,
      revenueWonAllTime: repAllWon.reduce((sum, d) => sum + (d.amount || 0), 0),
      dealsWonThisPeriod: repPeriodWon.length,
      revenueWonThisPeriod: repPeriodWon.reduce((sum, d) => sum + (d.amount || 0), 0),
      wonDealsThisPeriod: repPeriodWon.map(d => ({ name: d.name, company: d.companyName, amount: d.amount, closeDate: d.closeDate })),
      calls: activityCounts["call"] || 0,
      callDetails: repActivities.filter(a => a.type?.toLowerCase() === "call").slice(0, 20).map(a => ({
        subject: a.subject,
        contactName: a.contactName,
        companyName: a.companyName,
        date: a.activityDate,
      })),
      emails: activityCounts["email"] || 0,
      emailDetails: repActivities.filter(a => a.type?.toLowerCase() === "email").slice(0, 20).map(a => ({
        subject: a.subject,
        contactName: a.contactName,
        companyName: a.companyName,
        date: a.activityDate,
      })),
      linkedinMessages: activityCounts["linkedin_message"] || 0,
      linkedinDetails: repActivities.filter(a => a.type?.toLowerCase() === "linkedin_message").slice(0, 20).map(a => ({
        subject: a.subject,
        contactName: a.contactName,
        companyName: a.companyName,
        date: a.activityDate,
      })),
      tasks: activityCounts["task"] || 0,
      notes: activityCounts["note"] || 0,
      totalOutbound: (activityCounts["call"] || 0) + (activityCounts["email"] || 0) + (activityCounts["linkedin_message"] || 0),
      weeklyOutboundGoal,
      meetingsHeld: repMeetings.length,
      weeklyMeetingsGoal,
      meetingDetails: repMeetings.slice(0, 20).map(m => ({
        title: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
        outcome: m.outcome,
        contactName: m.contactName,
        companyName: m.companyName,
        attendees: m.attendees,
      })),
      totalActivities: repActivities.length,
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
    closedWonDeals,
    byRep,
    repNames,
    goals,
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
  const ownerNorm = owner.toLowerCase().trim();
  const repNorm = rep.toLowerCase().trim();
  if (ownerNorm === repNorm) return true;
  const ownerParts = ownerNorm.split(/\s+/);
  const repParts = repNorm.split(/\s+/);
  if (ownerParts.length >= 2 && repParts.length >= 2) {
    return ownerParts[0] === repParts[0] && ownerParts[ownerParts.length - 1] === repParts[repParts.length - 1];
  }
  if (repParts.length === 1 && ownerParts.length >= 2) {
    return ownerParts[0] === repParts[0] || ownerParts[ownerParts.length - 1] === repParts[0];
  }
  return false;
}

function countByTypeNormalized(items: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = (item.type || "other").toLowerCase();
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}
