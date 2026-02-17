import cron from "node-cron";
import { syncHubSpot } from "./hubspot";
import { syncFireflies } from "./fireflies";
import { generateWeeklyEmail, generateBiweeklyScorecard } from "./ai-reports";
import { storage } from "../storage";
import { log } from "../index";

let biweeklyCounter = 0;

export function startScheduler() {
  // Hourly sync (at minute 0 of every hour)
  cron.schedule("0 * * * *", async () => {
    log("Running hourly sync...", "scheduler");
    try {
      const hubspotResult = await syncHubSpot();
      log(`HubSpot sync: ${hubspotResult.success ? "OK" : "FAIL"} (${hubspotResult.recordsProcessed} records)`, "scheduler");

      const firefliesResult = await syncFireflies();
      log(`Fireflies sync: ${firefliesResult.success ? "OK" : "FAIL"} (${firefliesResult.recordsProcessed} records)`, "scheduler");
    } catch (err) {
      log(`Hourly sync error: ${err}`, "scheduler");
    }
  });

  // Weekly email - Monday 8:00 AM
  cron.schedule("0 8 * * 1", async () => {
    log("Generating weekly email...", "scheduler");
    try {
      const content = await generateWeeklyEmail();
      const kpis = await storage.computeKPIs();
      await storage.createReport({
        type: "weekly",
        title: `Weekly Pipeline Update - ${new Date().toLocaleDateString()}`,
        content,
        kpis,
        periodStart: getWeekStart(),
        periodEnd: new Date().toISOString().split("T")[0],
      });
      log("Weekly email generated successfully", "scheduler");
    } catch (err) {
      log(`Weekly email error: ${err}`, "scheduler");
    }
  });

  // Biweekly scorecard - Tuesday 8:00 AM (every other week)
  cron.schedule("0 8 * * 2", async () => {
    biweeklyCounter++;
    if (biweeklyCounter % 2 !== 0) return;
    
    log("Generating biweekly scorecard...", "scheduler");
    try {
      const content = await generateBiweeklyScorecard();
      const kpis = await storage.computeKPIs();
      await storage.createReport({
        type: "biweekly",
        title: `CEO Scorecard - ${new Date().toLocaleDateString()}`,
        content,
        kpis,
        periodStart: getBiweeklyStart(),
        periodEnd: new Date().toISOString().split("T")[0],
      });
      log("Biweekly scorecard generated successfully", "scheduler");
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
