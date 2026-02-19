import cron from "node-cron";
import { syncHubSpot } from "./hubspot";
import { syncFireflies } from "./fireflies";
import { syncClose } from "./close";
import { generateWeeklyEmail, generateBiweeklyScorecard } from "./ai-reports";
import { storage } from "../storage";
import { log } from "../index";

let biweeklyCounter = 0;

export function startScheduler() {
  cron.schedule("0 * * * *", async () => {
    log("Running hourly sync for all accounts...", "scheduler");
    try {
      const accounts = await storage.getAccounts();
      for (const account of accounts) {
        const hubspotConn = await storage.getConnection(account.id, "hubspot");
        if (hubspotConn?.connected) {
          const hubspotResult = await syncHubSpot(account.id);
          log(`[${account.name}] HubSpot sync: ${hubspotResult.success ? "OK" : "FAIL"} (${hubspotResult.recordsProcessed} records)`, "scheduler");
        }

        const firefliesConn = await storage.getConnection(account.id, "fireflies");
        if (firefliesConn?.connected) {
          const firefliesResult = await syncFireflies(account.id);
          log(`[${account.name}] Fireflies sync: ${firefliesResult.success ? "OK" : "FAIL"} (${firefliesResult.recordsProcessed} records)`, "scheduler");
        }

        const closeConn = await storage.getConnection(account.id, "close");
        if (closeConn?.connected) {
          const closeResult = await syncClose(account.id);
          log(`[${account.name}] Close sync: ${closeResult.success ? "OK" : "FAIL"} (${closeResult.recordsProcessed} records)`, "scheduler");
        }
      }
    } catch (err) {
      log(`Hourly sync error: ${err}`, "scheduler");
    }
  });

  cron.schedule("0 8 * * 1", async () => {
    log("Generating weekly email for all accounts...", "scheduler");
    try {
      const accounts = await storage.getAccounts();
      for (const account of accounts) {
        try {
          const content = await generateWeeklyEmail(account.id);
          const kpis = await storage.computeKPIs(account.id);
          await storage.createReport({
            accountId: account.id,
            type: "weekly",
            title: `Weekly Pipeline Update - ${new Date().toLocaleDateString()}`,
            content,
            kpis,
            periodStart: getWeekStart(),
            periodEnd: new Date().toISOString().split("T")[0],
          });
          log(`[${account.name}] Weekly email generated successfully`, "scheduler");
        } catch (err) {
          log(`[${account.name}] Weekly email error: ${err}`, "scheduler");
        }
      }
    } catch (err) {
      log(`Weekly email error: ${err}`, "scheduler");
    }
  });

  cron.schedule("0 8 * * 2", async () => {
    biweeklyCounter++;
    if (biweeklyCounter % 2 !== 0) return;
    
    log("Generating biweekly scorecard for all accounts...", "scheduler");
    try {
      const accounts = await storage.getAccounts();
      for (const account of accounts) {
        try {
          const content = await generateBiweeklyScorecard(account.id);
          const kpis = await storage.computeKPIs(account.id);
          await storage.createReport({
            accountId: account.id,
            type: "biweekly",
            title: `CEO Scorecard - ${new Date().toLocaleDateString()}`,
            content,
            kpis,
            periodStart: getBiweeklyStart(),
            periodEnd: new Date().toISOString().split("T")[0],
          });
          log(`[${account.name}] Biweekly scorecard generated successfully`, "scheduler");
        } catch (err) {
          log(`[${account.name}] Biweekly scorecard error: ${err}`, "scheduler");
        }
      }
    } catch (err) {
      log(`Biweekly scorecard error: ${err}`, "scheduler");
    }
  });

  log("Scheduler started: hourly sync, weekly email (Mon 8AM), biweekly scorecard (every other Tue 8AM)", "scheduler");
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diff);
  return weekStart.toISOString().split("T")[0];
}

function getBiweeklyStart(): string {
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);
  return twoWeeksAgo.toISOString().split("T")[0];
}
