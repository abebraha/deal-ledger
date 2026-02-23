import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { syncHubSpot } from "./services/hubspot";
import { syncFireflies } from "./services/fireflies";
import { syncClose } from "./services/close";
import { generateWeeklyEmail, generateBiweeklyScorecard, streamCustomReport } from "./services/ai-reports";
import { generateReportPDF } from "./services/pdf-report";
import { startScheduler } from "./services/scheduler";
import { z } from "zod";

function getAccountId(req: Request): number {
  return parseInt(req.params.accountId as string);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ─── Accounts ───
  app.get("/api/accounts", async (_req, res) => {
    try {
      const allAccounts = await storage.getAccounts();
      res.json(allAccounts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Account name is required" });
      }
      const account = await storage.createAccount({ name: name.trim() });
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/accounts/:accountId", async (req, res) => {
    try {
      const account = await storage.getAccount(getAccountId(req));
      if (!account) return res.status(404).json({ error: "Account not found" });
      res.json(account);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/accounts/:accountId", async (req, res) => {
    try {
      await storage.deleteAccount(getAccountId(req));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Dashboard KPIs ───
  app.get("/api/accounts/:accountId/kpis", async (req, res) => {
    try {
      const kpis = await storage.computeKPIs(getAccountId(req));
      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deals ───
  app.get("/api/accounts/:accountId/deals", async (req, res) => {
    try {
      const allDeals = await storage.getDeals(getAccountId(req));
      res.json(allDeals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/accounts/:accountId/deals/:id", async (req, res) => {
    try {
      const deal = await storage.getDeal(getAccountId(req), parseInt(req.params.id));
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      res.json(deal);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Activities ───
  app.get("/api/accounts/:accountId/activities", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const allActivities = await storage.getActivities(accountId, dealId);
      res.json(allActivities.slice(0, limit));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Meetings ───
  app.get("/api/accounts/:accountId/meetings", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : undefined;
      const allMeetings = await storage.getMeetings(accountId, dealId);
      res.json(allMeetings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Settings ───
  app.get("/api/accounts/:accountId/settings", async (req, res) => {
    try {
      const all = await storage.getAllSettings(getAccountId(req));
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/settings", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const entries = req.body;
      for (const [key, value] of Object.entries(entries)) {
        await storage.setSetting(accountId, key, String(value));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Connections ───
  app.get("/api/accounts/:accountId/connections", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const hubspot = await storage.getConnection(accountId, "hubspot");
      const fireflies = await storage.getConnection(accountId, "fireflies");
      const close = await storage.getConnection(accountId, "close");
      const sanitize = (conn: any) => conn ? { ...conn, config: undefined } : null;
      res.json({ hubspot: sanitize(hubspot), fireflies: sanitize(fireflies), close: sanitize(close) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/connections/:service/connect", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const service = req.params.service;
      if (service !== "hubspot" && service !== "fireflies" && service !== "close") {
        return res.status(400).json({ error: "Invalid service" });
      }

      const { apiKey } = req.body;
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
        return res.status(400).json({ error: "API key is required" });
      }

      if (service === "hubspot") {
        const testRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals?limit=1", {
          headers: { Authorization: `Bearer ${apiKey.trim()}` },
        });
        if (!testRes.ok) {
          return res.status(400).json({ error: `HubSpot API key validation failed (${testRes.status}). Please check your key.` });
        }
      } else if (service === "fireflies") {
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
      } else if (service === "close") {
        const testRes = await fetch("https://api.close.com/api/v1/me/", {
          headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey.trim()}:`).toString("base64")}`,
            Accept: "application/json",
          },
        });
        if (!testRes.ok) {
          return res.status(400).json({ error: `Close CRM API key validation failed (${testRes.status}). Please check your key.` });
        }
      }

      await storage.upsertConnection(accountId, service, true, { apiKey: apiKey.trim() });
      res.json({ success: true, message: `${service} connected successfully` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/connections/:service/disconnect", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const service = req.params.service;
      await storage.upsertConnection(accountId, service, false, null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── HubSpot Owners (for rep mapping) ───
  app.get("/api/accounts/:accountId/hubspot/owners", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      let apiKey: string | undefined;
      try {
        const conn = await storage.getConnection(accountId, "hubspot");
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

  // ─── Close Users (for rep mapping) ───
  app.get("/api/accounts/:accountId/close/users", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      let apiKey: string | undefined;
      try {
        const conn = await storage.getConnection(accountId, "close");
        if (conn?.config && typeof conn.config === "object" && (conn.config as any).apiKey) {
          apiKey = (conn.config as any).apiKey;
        }
      } catch (e) {}
      if (!apiKey) {
        return res.status(400).json({ error: "Close CRM not connected" });
      }
      const usersResponse = await fetch("https://api.close.com/api/v1/user/", {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
          Accept: "application/json",
        },
      });
      if (!usersResponse.ok) {
        return res.status(usersResponse.status).json({ error: "Failed to fetch Close users" });
      }
      const usersData = await usersResponse.json();
      const users = (usersData.data || []).map((u: any) => ({
        id: u.id,
        name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
        email: u.email || null,
      })).filter((u: any) => u.name.length > 0);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Sales Reps ───
  app.get("/api/accounts/:accountId/sales-reps", async (req, res) => {
    try {
      const reps = await storage.getSalesReps(getAccountId(req));
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

  app.post("/api/accounts/:accountId/sales-reps", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const parsed = createRepSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid data" });
      }
      const rep = await storage.createSalesRep({ ...parsed.data, accountId });
      res.json(rep);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const updateRepSchema = z.object({
    name: z.string().min(1).transform(s => s.trim()).optional(),
    hubspotOwnerId: z.string().nullable().optional(),
    closeUserId: z.string().nullable().optional(),
    excluded: z.boolean().optional(),
  });

  app.patch("/api/accounts/:accountId/sales-reps/:id", async (req, res) => {
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

  app.delete("/api/accounts/:accountId/sales-reps/:id", async (req, res) => {
    try {
      await storage.deleteSalesRep(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Fireflies Meetings list (for report meeting selection) ───
  app.get("/api/accounts/:accountId/fireflies-meetings", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const allMeetings = await storage.getFirefliesMeetings(accountId);
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
  app.post("/api/accounts/:accountId/sync/hubspot", async (req, res) => {
    try {
      const result = await syncHubSpot(getAccountId(req));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/sync/fireflies", async (req, res) => {
    try {
      const result = await syncFireflies(getAccountId(req));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/sync/close", async (req, res) => {
    try {
      const result = await syncClose(getAccountId(req));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/accounts/:accountId/sync/logs", async (req, res) => {
    try {
      const logs = await storage.getLatestSyncLogs(getAccountId(req));
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Reports ───
  app.get("/api/accounts/:accountId/reports", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const all = await storage.getReports(getAccountId(req), type);
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/accounts/:accountId/reports/:id", async (req, res) => {
    try {
      const report = await storage.getReport(getAccountId(req), parseInt(req.params.id));
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/reports/generate/weekly", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const { meetingIds } = req.body || {};
      const content = await generateWeeklyEmail(accountId, meetingIds);
      const kpis = await storage.computeKPIs(accountId);
      const report = await storage.createReport({
        accountId,
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

  app.post("/api/accounts/:accountId/reports/generate/biweekly", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const { meetingIds } = req.body || {};
      const content = await generateBiweeklyScorecard(accountId, meetingIds);
      const kpis = await storage.computeKPIs(accountId);
      const report = await storage.createReport({
        accountId,
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

  app.post("/api/accounts/:accountId/reports/:id/send", async (req, res) => {
    try {
      await storage.markReportSent(getAccountId(req), parseInt(req.params.id));
      res.json({ success: true, message: "Report marked as sent (email delivery mocked)" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/accounts/:accountId/reports/:id", async (req, res) => {
    try {
      await storage.deleteReport(getAccountId(req), parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/accounts/:accountId/reports/:id", async (req, res) => {
    try {
      const { content, title } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });
      const updated = await storage.updateReportContent(getAccountId(req), parseInt(req.params.id), content, title);
      if (!updated) return res.status(404).json({ error: "Report not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/accounts/:accountId/reports/:id/refine", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const reportId = parseInt(req.params.id);
      const { instruction, currentContent } = req.body;
      if (!instruction) return res.status(400).json({ error: "Instruction is required" });

      const report = await storage.getReport(accountId, reportId);
      if (!report) return res.status(404).json({ error: "Report not found" });

      const contentToRefine = currentContent || report.content;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { refineReport } = await import("./services/ai-reports");
      const stream = await refineReport(contentToRefine, instruction);
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

  app.get("/api/accounts/:accountId/reports/:id/pdf", async (req, res) => {
    try {
      const report = await storage.getReport(getAccountId(req), parseInt(req.params.id));
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

  // ─── Save custom report ───
  app.post("/api/accounts/:accountId/reports/save-custom", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const { title, content, prompt } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });

      const kpis = await storage.computeKPIs(accountId);
      const report = await storage.createReport({
        accountId,
        type: "custom",
        title: title || `Custom Report - ${new Date().toLocaleDateString()}`,
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

  // ─── Generate custom report (non-streaming, saved) ───
  app.post("/api/accounts/:accountId/reports/generate/custom", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Prompt is required" });

      const stream = await streamCustomReport(accountId, prompt);
      let fullContent = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) fullContent += content;
      }

      const kpis = await storage.computeKPIs(accountId);
      const titleMatch = prompt.substring(0, 80);
      const report = await storage.createReport({
        accountId,
        type: "custom",
        title: `Custom: ${titleMatch}${prompt.length > 80 ? "..." : ""}`,
        content: fullContent,
        kpis,
        periodStart: new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0],
        periodEnd: new Date().toISOString().split("T")[0],
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI Chat (streaming) ───
  app.post("/api/accounts/:accountId/chat", async (req, res) => {
    try {
      const accountId = getAccountId(req);
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await streamCustomReport(accountId, message);
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
