import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  accounts,
  deals, activities, meetings, settings,
  reports, syncLogs, connections, conversations, messages,
  firefliesMeetings, salesReps,
  type Account, type InsertAccount,
  type Deal, type InsertDeal,
  type Activity, type InsertActivity,
  type Meeting, type InsertMeeting,
  type FirefliesMeeting, type InsertFirefliesMeeting,
  type Report, type InsertReport,
  type Connection,
  type SalesRep, type InsertSalesRep,
} from "@shared/schema";

export interface IStorage {
  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  deleteAccount(id: number): Promise<void>;

  // Deals
  getDeals(accountId: number): Promise<Deal[]>;
  getDeal(accountId: number, id: number): Promise<Deal | undefined>;
  getDealByHubspotId(accountId: number, hubspotId: string): Promise<Deal | undefined>;
  upsertDeal(deal: InsertDeal): Promise<Deal>;
  
  // Activities
  getActivities(accountId: number, dealId?: number): Promise<Activity[]>;
  upsertActivity(activity: InsertActivity): Promise<Activity>;
  
  // Meetings
  getMeetings(accountId: number, dealId?: number): Promise<Meeting[]>;
  upsertMeeting(meeting: InsertMeeting): Promise<Meeting>;
  
  // Settings
  getSetting(accountId: number, key: string): Promise<string | undefined>;
  setSetting(accountId: number, key: string, value: string): Promise<void>;
  getAllSettings(accountId: number): Promise<Record<string, string>>;
  
  // Reports
  getReports(accountId: number, type?: string): Promise<Report[]>;
  getReport(accountId: number, id: number): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  updateReportContent(accountId: number, id: number, content: string, title?: string): Promise<Report | undefined>;
  deleteReport(accountId: number, id: number): Promise<void>;
  markReportSent(accountId: number, id: number): Promise<void>;
  
  // Sync logs
  createSyncLog(accountId: number, source: string, status: string, details?: string, recordsProcessed?: number): Promise<void>;
  getLatestSyncLogs(accountId: number): Promise<any[]>;
  
  // Connections
  getConnection(accountId: number, service: string): Promise<Connection | undefined>;
  upsertConnection(accountId: number, service: string, connected: boolean, config?: any, updateLastSync?: boolean): Promise<Connection>;
  
  // Conversations
  getConversations(accountId: number): Promise<any[]>;
  getConversation(id: number): Promise<any | undefined>;
  createConversation(accountId: number, title: string): Promise<any>;
  deleteConversation(id: number): Promise<void>;
  getMessages(conversationId: number): Promise<any[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<any>;

  // Fireflies Meetings
  getFirefliesMeetings(accountId: number): Promise<FirefliesMeeting[]>;
  upsertFirefliesMeeting(meeting: InsertFirefliesMeeting): Promise<FirefliesMeeting>;

  // Sales Reps
  getSalesReps(accountId: number): Promise<SalesRep[]>;
  getActiveSalesReps(accountId: number): Promise<SalesRep[]>;
  createSalesRep(rep: InsertSalesRep): Promise<SalesRep>;
  updateSalesRep(id: number, rep: Partial<InsertSalesRep>): Promise<SalesRep | undefined>;
  deleteSalesRep(id: number): Promise<void>;

  // Metrics (deterministic computations)
  computeKPIs(accountId: number, startDate?: string, endDate?: string): Promise<any>;
}

class DatabaseStorage implements IStorage {
  // ─── Accounts ───
  async getAccounts() {
    return db.select().from(accounts).orderBy(accounts.name);
  }

  async getAccount(id: number) {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(account: InsertAccount) {
    const [created] = await db.insert(accounts).values(account).returning();
    return created;
  }

  async deleteAccount(id: number) {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  // ─── Deals ───
  async getDeals(accountId: number) {
    return db.select().from(deals).where(eq(deals.accountId, accountId)).orderBy(desc(deals.updatedAt));
  }

  async getDeal(accountId: number, id: number) {
    const [deal] = await db.select().from(deals).where(and(eq(deals.id, id), eq(deals.accountId, accountId)));
    return deal;
  }

  async getDealByHubspotId(accountId: number, hubspotId: string) {
    const [deal] = await db.select().from(deals).where(and(eq(deals.accountId, accountId), eq(deals.hubspotId, hubspotId)));
    return deal;
  }

  async getDealByCloseId(accountId: number, closeId: string) {
    const [deal] = await db.select().from(deals).where(and(eq(deals.accountId, accountId), eq(deals.closeId, closeId)));
    return deal;
  }

  async upsertDeal(deal: InsertDeal) {
    if (deal.hubspotId) {
      const existing = await this.getDealByHubspotId(deal.accountId, deal.hubspotId);
      if (existing) {
        const [updated] = await db.update(deals).set({ ...deal, updatedAt: new Date() }).where(eq(deals.id, existing.id)).returning();
        return updated;
      }
    }
    if (deal.closeId) {
      const existing = await this.getDealByCloseId(deal.accountId, deal.closeId);
      if (existing) {
        const [updated] = await db.update(deals).set({ ...deal, updatedAt: new Date() }).where(eq(deals.id, existing.id)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  // ─── Activities ───
  async getActivities(accountId: number, dealId?: number) {
    if (dealId) {
      return db.select().from(activities).where(and(eq(activities.accountId, accountId), eq(activities.dealId, dealId))).orderBy(desc(activities.createdAt));
    }
    return db.select().from(activities).where(eq(activities.accountId, accountId)).orderBy(desc(activities.createdAt));
  }

  async upsertActivity(activity: InsertActivity) {
    if (activity.hubspotId) {
      const [existing] = await db.select().from(activities).where(and(eq(activities.accountId, activity.accountId), eq(activities.hubspotId, activity.hubspotId)));
      if (existing) {
        const [updated] = await db.update(activities).set(activity).where(eq(activities.id, existing.id)).returning();
        return updated;
      }
    }
    if (activity.closeId) {
      const [existing] = await db.select().from(activities).where(and(eq(activities.accountId, activity.accountId), eq(activities.closeId, activity.closeId)));
      if (existing) {
        const [updated] = await db.update(activities).set(activity).where(eq(activities.id, existing.id)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  // ─── Meetings ───
  async getMeetings(accountId: number, dealId?: number) {
    if (dealId) {
      return db.select().from(meetings).where(and(eq(meetings.accountId, accountId), eq(meetings.dealId, dealId))).orderBy(desc(meetings.createdAt));
    }
    return db.select().from(meetings).where(eq(meetings.accountId, accountId)).orderBy(desc(meetings.createdAt));
  }

  async upsertMeeting(meeting: InsertMeeting) {
    if (meeting.hubspotId) {
      const [existing] = await db.select().from(meetings).where(and(eq(meetings.accountId, meeting.accountId), eq(meetings.hubspotId, meeting.hubspotId)));
      if (existing) {
        const [updated] = await db.update(meetings).set(meeting).where(eq(meetings.id, existing.id)).returning();
        return updated;
      }
    }
    if (meeting.closeId) {
      const [existing] = await db.select().from(meetings).where(and(eq(meetings.accountId, meeting.accountId), eq(meetings.closeId, meeting.closeId)));
      if (existing) {
        const [updated] = await db.update(meetings).set(meeting).where(eq(meetings.id, existing.id)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }

  // ─── Settings ───
  async getSetting(accountId: number, key: string) {
    const [setting] = await db.select().from(settings).where(and(eq(settings.accountId, accountId), eq(settings.key, key)));
    return setting?.value;
  }

  async setSetting(accountId: number, key: string, value: string) {
    const [existing] = await db.select().from(settings).where(and(eq(settings.accountId, accountId), eq(settings.key, key)));
    if (existing) {
      await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.id, existing.id));
    } else {
      await db.insert(settings).values({ accountId, key, value });
    }
  }

  async getAllSettings(accountId: number) {
    const rows = await db.select().from(settings).where(eq(settings.accountId, accountId));
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ─── Reports ───
  async getReports(accountId: number, type?: string) {
    if (type) {
      return db.select().from(reports).where(and(eq(reports.accountId, accountId), eq(reports.type, type))).orderBy(desc(reports.createdAt));
    }
    return db.select().from(reports).where(eq(reports.accountId, accountId)).orderBy(desc(reports.createdAt));
  }

  async getReport(accountId: number, id: number) {
    const [report] = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.accountId, accountId)));
    return report;
  }

  async createReport(report: InsertReport) {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }

  async updateReportContent(accountId: number, id: number, content: string, title?: string) {
    const updates: any = { content };
    if (title) updates.title = title;
    const [updated] = await db.update(reports).set(updates).where(and(eq(reports.id, id), eq(reports.accountId, accountId))).returning();
    return updated;
  }

  async deleteReport(accountId: number, id: number) {
    await db.delete(reports).where(and(eq(reports.id, id), eq(reports.accountId, accountId)));
  }

  async markReportSent(accountId: number, id: number) {
    await db.update(reports).set({ sentAt: new Date() }).where(and(eq(reports.id, id), eq(reports.accountId, accountId)));
  }

  // ─── Sync Logs ───
  async createSyncLog(accountId: number, source: string, status: string, details?: string, recordsProcessed?: number) {
    await db.insert(syncLogs).values({
      accountId,
      source,
      status,
      details,
      recordsProcessed: recordsProcessed ?? 0,
      completedAt: status === "completed" || status === "error" ? new Date() : null,
    });
  }

  async getLatestSyncLogs(accountId: number) {
    return db.select().from(syncLogs).where(eq(syncLogs.accountId, accountId)).orderBy(desc(syncLogs.startedAt)).limit(20);
  }

  // ─── Connections ───
  async getConnection(accountId: number, service: string) {
    const [conn] = await db.select().from(connections).where(and(eq(connections.accountId, accountId), eq(connections.service, service)));
    return conn;
  }

  async upsertConnection(accountId: number, service: string, connected: boolean, config?: any, updateLastSync?: boolean) {
    const [existing] = await db.select().from(connections).where(and(eq(connections.accountId, accountId), eq(connections.service, service)));
    const updateData: any = { connected, config, updatedAt: new Date() };
    if (updateLastSync) {
      updateData.lastSyncAt = new Date();
    }
    if (existing) {
      const [updated] = await db.update(connections)
        .set(updateData)
        .where(eq(connections.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(connections).values({ accountId, service, connected, config, lastSyncAt: updateLastSync ? new Date() : null }).returning();
    return created;
  }

  // ─── Conversations ───
  async getConversations(accountId: number) {
    return db.select().from(conversations).where(eq(conversations.accountId, accountId)).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: number) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async createConversation(accountId: number, title: string) {
    const [conv] = await db.insert(conversations).values({ accountId, title }).returning();
    return conv;
  }

  async deleteConversation(id: number) {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async getMessages(conversationId: number) {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async createMessage(conversationId: number, role: string, content: string) {
    const [msg] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return msg;
  }

  // ─── Fireflies Meetings ───
  async getFirefliesMeetings(accountId: number) {
    return db.select().from(firefliesMeetings).where(eq(firefliesMeetings.accountId, accountId)).orderBy(desc(firefliesMeetings.createdAt));
  }

  async upsertFirefliesMeeting(meeting: InsertFirefliesMeeting) {
    if (meeting.firefliesId) {
      const [existing] = await db.select().from(firefliesMeetings).where(and(eq(firefliesMeetings.accountId, meeting.accountId), eq(firefliesMeetings.firefliesId, meeting.firefliesId)));
      if (existing) {
        const [updated] = await db.update(firefliesMeetings).set(meeting).where(eq(firefliesMeetings.id, existing.id)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(firefliesMeetings).values(meeting).returning();
    return created;
  }

  // ─── Sales Reps ───
  async getSalesReps(accountId: number) {
    return db.select().from(salesReps).where(eq(salesReps.accountId, accountId)).orderBy(salesReps.name);
  }

  async getActiveSalesReps(accountId: number) {
    return db.select().from(salesReps).where(and(eq(salesReps.accountId, accountId), eq(salesReps.excluded, false))).orderBy(salesReps.name);
  }

  async createSalesRep(rep: InsertSalesRep) {
    const [created] = await db.insert(salesReps).values(rep).returning();
    return created;
  }

  async updateSalesRep(id: number, rep: Partial<InsertSalesRep>) {
    const [updated] = await db.update(salesReps).set(rep).where(eq(salesReps.id, id)).returning();
    return updated;
  }

  async deleteSalesRep(id: number) {
    await db.delete(salesReps).where(eq(salesReps.id, id));
  }

  // ─── Deterministic KPI Computation ───
  async computeKPIs(accountId: number, startDate?: string, endDate?: string) {
    const allDeals = await this.getDeals(accountId);
    const allActivities = await this.getActivities(accountId);
    const allMeetings = await this.getMeetings(accountId);
    const allSettings = await this.getAllSettings(accountId);

    const isClosedWon = (s: string) => s.toLowerCase() === "closed won" || s.toLowerCase() === "closedwon";
    const isClosedLost = (s: string) => s.toLowerCase() === "closed lost" || s.toLowerCase() === "closedlost";

    const allClosedWon = allDeals.filter(d => isClosedWon(d.stage));
    const openDeals = allDeals.filter(d => !isClosedWon(d.stage) && !isClosedLost(d.stage));

    const periodClosedWon = startDate
      ? allClosedWon.filter(d => {
          const cd = d.closeDate || d.lastActivityDate;
          if (!cd) return false;
          return cd >= startDate && (!endDate || cd <= endDate);
        })
      : allClosedWon;

    const allTimeRevenue = allClosedWon.reduce((sum, d) => sum + (d.amount || 0), 0);
    const periodRevenue = periodClosedWon.reduce((sum, d) => sum + (d.amount || 0), 0);
    const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const weightedPipeline = openDeals.reduce((sum, d) => sum + (d.amount || 0) * ((d.probability || 0) / 100), 0);

    const activityStart = startDate || (() => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return weekStart.toISOString();
    })();

    const periodActivities = allActivities.filter(a => {
      if (!a.activityDate) return false;
      return a.activityDate >= activityStart && (!endDate || a.activityDate <= endDate);
    });

    const periodMeetings = allMeetings.filter(m => {
      if (!m.startTime) return false;
      return m.startTime >= activityStart && (!endDate || m.startTime <= endDate);
    });

    const calls = periodActivities.filter(a => a.type?.toLowerCase() === "call");
    const emails = periodActivities.filter(a => a.type?.toLowerCase() === "email");
    const linkedinMessages = periodActivities.filter(a => a.type?.toLowerCase() === "linkedin_message");
    const meetingsHeld = periodMeetings.filter(m => m.outcome === "COMPLETED" || m.outcome === "completed" || !m.outcome);

    const monthlyRevenueGoal = parseInt(allSettings.hubspotRevenueGoal || allSettings.monthlyRevenueGoal || "100000");
    const weeklyMeetingsGoal = parseInt(allSettings.weeklyMeetingsGoal || "15");
    const weeklyOutboundGoal = parseInt(allSettings.weeklyOutboundGoal || "50");

    return {
      revenue: {
        total: allTimeRevenue,
        periodRevenue,
        periodDealsWon: periodClosedWon.length,
        goal: monthlyRevenueGoal,
        attainment: monthlyRevenueGoal > 0 ? Math.round((allTimeRevenue / monthlyRevenueGoal) * 100) : 0,
      },
      pipeline: {
        total: pipelineValue,
        weighted: weightedPipeline,
        dealCount: openDeals.length,
      },
      activity: {
        calls: calls.length,
        emails: emails.length,
        linkedinMessages: linkedinMessages.length,
        meetingsHeld: meetingsHeld.length,
        meetingsGoal: weeklyMeetingsGoal,
        outboundGoal: weeklyOutboundGoal,
        totalOutbound: calls.length + emails.length + linkedinMessages.length,
      },
      deals: {
        total: allDeals.length,
        closedWon: allClosedWon.length,
        periodClosedWon: periodClosedWon.length,
        open: openDeals.length,
      },
    };
  }
}

export const storage = new DatabaseStorage();

export async function cleanupNonRepData(accountId: number) {
  const reps = await storage.getActiveSalesReps(accountId);
  const mappedIds = reps.filter(r => r.hubspotOwnerId).map(r => r.hubspotOwnerId!);

  if (mappedIds.length > 0) {
    return;
  }

  const repPatterns = reps.map(r => `%${r.name.toLowerCase()}%`);
  if (repPatterns.length === 0) return;

  const buildNotLike = (col: any) => {
    const conditions = repPatterns.map(p => sql`LOWER(${col}) NOT LIKE ${p}`);
    return sql.join(conditions, sql` AND `);
  };

  await db.delete(deals).where(
    and(
      eq(deals.accountId, accountId),
      sql`(${deals.owner} IS NULL OR (${buildNotLike(deals.owner)}))`
    )
  );
}
