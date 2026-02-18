import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { syncHubSpot } from "./services/hubspot";
import { syncFireflies } from "./services/fireflies";
import { generateWeeklyEmail, generateBiweeklyScorecard, streamCustomReport } from "./services/ai-reports";
import { generateReportPDF } from "./services/pdf-report";
import { startScheduler } from "./services/scheduler";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Dashboard KPIs ───
  app.get("/api/kpis", async (_req, res) => {
    try {
      const kpis = await storage.computeKPIs();
      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deals ───
  app.get("/api/deals", async (_req, res) => {
    try {
      const allDeals = await storage.getDeals();
      res.json(allDeals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/deals/:id", async (req, res) => {
    try {
      const deal = await storage.getDeal(parseInt(req.params.id));
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Activities ───
  app.get("/api/activities", async (req, res) => {
    try {
      const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const allActivities = await storage.getActivities(dealId);
      res.json(allActivities.slice(0, limit));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Meetings ───
  app.get("/api/meetings", async (req, res) => {
    try {
      const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : undefined;
      const allMeetings = await storage.getMeetings(dealId);
      res.json(allMeetings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Settings ───
  app.get("/api/settings", async (_req, res) => {
    try {
      const all = await storage.getAllSettings();
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const entries = req.body;
      for (const [key, value] of Object.entries(entries)) {
        await storage.setSetting(key, String(value));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Connections ───
  app.get("/api/connections", async (_req, res) => {
    try {
      const hubspot = await storage.getConnection("hubspot");
      const fireflies = await storage.getConnection("fireflies");
      const sanitize = (conn: any) => conn ? { ...conn, config: undefined } : null;
      res.json({ hubspot: sanitize(hubspot), fireflies: sanitize(fireflies) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/connections/:service/connect", async (req, res) => {
    try {
      const service = req.params.service;
      if (service !== "hubspot" && service !== "fireflies") {
        return res.status(400).json({ error: "Invalid service" });
      }

      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
        return res.status(400).json({ error: "API key is required" });
      }

      // Validate the API key by making a test call
      if (service === "hubspot") {
        const testRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals?limit=1", {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!testRes.ok) {
          const errText = await testRes.text();
          return res.status(400).json({ error: `HubSpot API key validation failed (${testRes.status}). Please check your key.` });
        }
      } else {
        const testRes = await fetch("https://api.fireflies.ai/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify({ query: "{ user { email } }" }),
        });
        if (!testRes.ok) {
          return res.status(400).json({ error: `Fireflies API key validation failed (${testRes.status}). Please check your key.` });
        }
        const testData = await testRes.json();
        if (testData.errors) {
          return res.status(400).json({ error: `Fireflies API error: ${testData.errors[0]?.message || "Unknown error"}` });
        }
      }

      // Store the key in the connection config
      await storage.upsertConnection(service, true, { apiKey: apiKey.trim() });
      res.json({ success: true, message: `${service} connected successfully` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/connections/:service/disconnect", async (req, res) => {
    try {
      const service = req.params.service;
      await storage.upsertConnection(service, false, null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── HubSpot Owners (for rep mapping) ───
  app.get("/api/hubspot/owners", async (_req, res) => {
    try {
      let apiKey = process.env.HUBSPOT_API_KEY;
      try {
        const conn = await storage.getConnection("hubspot");
        if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
          apiKey = (conn.config as any).apiKey;
        }
      } catch (e) {}
      if (!apiKey) {
        return res.status(400).json({ error: "HubSpot not connected" });
      }
      const ownersResponse = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!ownersResponse.ok) {
        return res.status(ownersResponse.status).json({ error: "Failed to fetch HubSpot owners" });
      }
      const ownersData = await ownersResponse.json();
      const owners = (ownersData.results || []).map((o: any) => ({
        id: o.id,
        name: `${o.firstName || ""} ${o.lastName || ""}`.trim(),
        email: o.email || null,
      })).filter((o: any) => o.name.length > 0);
      res.json(owners);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Sales Reps ───
  app.get("/api/sales-reps", async (_req, res) => {
    try {
      const reps = await storage.getSalesReps();
      res.json(reps);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const createRepSchema = z.object({
    name: z.string().min(1, "Rep name is required").transform(s => s.trim()),
    hubspotOwnerId: z.string().nullable().optional().default(null),
    excluded: z.boolean().optional().default(false),
  });

  app.post("/api/sales-reps", async (req, res) => {
    try {
      const parsed = createRepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid data" });
      }
      const rep = await storage.createSalesRep(parsed.data);
      res.json(rep);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const updateRepSchema = z.object({
    name: z.string().min(1).transform(s => s.trim()).optional(),
    hubspotOwnerId: z.string().nullable().optional(),
    excluded: z.boolean().optional(),
  });

  app.patch("/api/sales-reps/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateRepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid data" });
      }
      const rep = await storage.updateSalesRep(id, parsed.data);
      if (!rep) return res.status(404).json({ error: "Rep not found" });
      res.json(rep);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/sales-reps/:id", async (req, res) => {
    try {
      await storage.deleteSalesRep(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Fireflies Meetings list (for report meeting selection) ───
  app.get("/api/fireflies-meetings", async (req, res) => {
    try {
      const allMeetings = await storage.getFirefliesMeetings();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const recent = allMeetings
        .filter(m => {
          if (!m.meetingDate) return true;
          return new Date(m.meetingDate) >= thirtyDaysAgo;
        })
        .sort((a, b) => {
          const da = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
          const db = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
          return db - da;
        })
        .map(m => ({
          id: m.id,
          firefliesId: m.firefliesId,
          title: m.title,
          meetingDate: m.meetingDate,
          duration: m.duration,
          participants: m.participants,
        }));
      res.json(recent);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Manual Sync ───
  app.post("/api/sync/hubspot", async (_req, res) => {
    try {
      const result = await syncHubSpot();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sync/fireflies", async (_req, res) => {
    try {
      const result = await syncFireflies();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sync/logs", async (_req, res) => {
    try {
      const logs = await storage.getLatestSyncLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Reports ───
  app.get("/api/reports", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const all = await storage.getReports(type);
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reports/:id", async (req, res) => {
    try {
      const report = await storage.getReport(parseInt(req.params.id));
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reports/generate/weekly", async (req, res) => {
    try {
      const { meetingIds } = req.body || {};
      const content = await generateWeeklyEmail(meetingIds);
      const kpis = await storage.computeKPIs();
      const report = await storage.createReport({
        type: "weekly",
        title: `Meeting Recap - ${new Date().toLocaleDateString()}`,
        content,
        kpis,
        periodStart: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
        periodEnd: new Date().toISOString().split("T")[0],
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reports/generate/biweekly", async (req, res) => {
    try {
      const { meetingIds } = req.body || {};
      const content = await generateBiweeklyScorecard(meetingIds);
      const kpis = await storage.computeKPIs();
      const report = await storage.createReport({
        type: "biweekly",
        title: `CEO Scorecard - ${new Date().toLocaleDateString()}`,
        content,
        kpis,
        periodStart: new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
        periodEnd: new Date().toISOString().split("T")[0],
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/reports/:id/send", async (req, res) => {
    try {
      await storage.markReportSent(parseInt(req.params.id));
      res.json({ success: true, message: "Report marked as sent (email delivery mocked)" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reports/:id/pdf", async (req, res) => {
    try {
      const report = await storage.getReport(parseInt(req.params.id));
      if (!report) return res.status(404).json({ error: "Report not found" });

      const filename = (report.title.replace(/[^a-zA-Z0-9 ]/g, "") || "Report").trim();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);

      generateReportPDF({
        title: report.title,
        type: report.type,
        content: report.content,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        createdAt: report.createdAt.toISOString(),
      }, res);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI Chat (streaming) ───
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await streamCustomReport(message);
      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, fullContent: fullResponse })}\n\n`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  });

  // Start the background scheduler
  startScheduler();

  return httpServer;
}
