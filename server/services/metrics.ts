import { storage } from "../storage";

export async function computeMetricsForReport(periodStart?: string, periodEnd?: string) {
  const kpis = await storage.computeKPIs(periodStart, periodEnd);
  const allDeals = await storage.getDeals();
  const allCommitments = await storage.getCommitments();

  const openDeals = allDeals
    .filter(d => d.stage !== "Closed Won" && d.stage !== "closedwon" && d.stage !== "Closed Lost" && d.stage !== "closedlost")
    .map(d => ({
      name: d.name,
      company: d.companyName,
      amount: d.amount,
      stage: d.stage,
      probability: d.probability,
      closeDate: d.closeDate,
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
    .slice(0, 10)
    .map(c => ({
      content: c.content,
      owner: c.owner,
      status: c.status,
      dueDate: c.dueDate,
      meetingTitle: c.meetingTitle,
      type: c.type,
      firefliesUrl: c.firefliesUrl,
    }));

  return {
    kpis,
    openDeals,
    overdueCommitments,
    recentCommitments,
    generatedAt: new Date().toISOString(),
  };
}
