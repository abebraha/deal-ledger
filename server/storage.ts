import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  deals, activities, meetings, settings,
  reports, syncLogs, connections, conversations, messages,
  firefliesMeetings,
  type Deal, type InsertDeal,
  type Activity, type InsertActivity,
  type Meeting, type InsertMeeting,
  type FirefliesMeeting, type InsertFirefliesMeeting,
  type Report, type InsertReport,
  type Connection,
} from "@shared/schema";

export interface IStorage {
  // Deals
  getDeals(): Promise<Deal[]>;
  getDeal(id: number): Promise<Deal | undefined>;
  getDealByHubspotId(hubspotId: string): Promise<Deal | undefined>;
  upsertDeal(deal: InsertDeal): Promise<Deal>;
  
  // Activities
  getActivities(dealId?: number): Promise<Activity[]>;
  upsertActivity(activity: InsertActivity): Promise<Activity>;
  
  // Meetings
  getMeetings(dealId?: number): Promise<Meeting[]>;
  upsertMeeting(meeting: InsertMeeting): Promise<Meeting>;
  
  // Settings
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;
  
  // Reports
  getReports(type?: string): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  markReportSent(id: number): Promise<void>;
  
  // Sync logs
  createSyncLog(source: string, status: string, details?: string, recordsProcessed?: number): Promise<void>;
  getLatestSyncLogs(): Promise<any[]>;
  
  // Connections
  getConnection(service: string): Promise<Connection | undefined>;
  upsertConnection(service: string, connected: boolean, config?: any, updateLastSync?: boolean): Promise<Connection>;
  
  // Conversations
  getConversations(): Promise<any[]>;
  getConversation(id: number): Promise<any | undefined>;
  createConversation(title: string): Promise<any>;
  deleteConversation(id: number): Promise<void>;
  getMessages(conversationId: number): Promise<any[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<any>;

  // Fireflies Meetings
  getFirefliesMeetings(): Promise<FirefliesMeeting[]>;
  upsertFirefliesMeeting(meeting: InsertFirefliesMeeting): Promise<FirefliesMeeting>;

  // Metrics (deterministic computations)
  computeKPIs(startDate?: string, endDate?: string): Promise<any>;
}

class DatabaseStorage implements IStorage {
  // ─── Deals ───
  async getDeals() {
    return db.select().from(deals).orderBy(desc(deals.updatedAt));
  }

  async getDeal(id: number) {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async getDealByHubspotId(hubspotId: string) {
    const [deal] = await db.select().from(deals).where(eq(deals.hubspotId, hubspotId));
    return deal;
  }

  async upsertDeal(deal: InsertDeal) {
    if (deal.hubspotId) {
      const existing = await this.getDealByHubspotId(deal.hubspotId);
      if (existing) {
        const [updated] = await db.update(deals).set({ ...deal, updatedAt: new Date() }).where(eq(deals.hubspotId, deal.hubspotId)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  // ─── Activities ───
  async getActivities(dealId?: number) {
    if (dealId) {
      return db.select().from(activities).where(eq(activities.dealId, dealId)).orderBy(desc(activities.createdAt));
    }
    return db.select().from(activities).orderBy(desc(activities.createdAt));
  }

  async upsertActivity(activity: InsertActivity) {
    if (activity.hubspotId) {
      const [existing] = await db.select().from(activities).where(eq(activities.hubspotId, activity.hubspotId));
      if (existing) {
        const [updated] = await db.update(activities).set(activity).where(eq(activities.hubspotId, activity.hubspotId)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  // ─── Meetings ───
  async getMeetings(dealId?: number) {
    if (dealId) {
      return db.select().from(meetings).where(eq(meetings.dealId, dealId)).orderBy(desc(meetings.createdAt));
    }
    return db.select().from(meetings).orderBy(desc(meetings.createdAt));
  }

  async upsertMeeting(meeting: InsertMeeting) {
    if (meeting.hubspotId) {
      const [existing] = await db.select().from(meetings).where(eq(meetings.hubspotId, meeting.hubspotId));
      if (existing) {
        const [updated] = await db.update(meetings).set(meeting).where(eq(meetings.hubspotId, meeting.hubspotId)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(meetings).values(meeting).returning();
    return created;
  }

  // ─── Settings ───
  async getSetting(key: string) {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string) {
    const [existing] = await db.select().from(settings).where(eq(settings.key, key));
    if (existing) {
      await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getAllSettings() {
    const rows = await db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ─── Reports ───
  async getReports(type?: string) {
    if (type) {
      return db.select().from(reports).where(eq(reports.type, type)).orderBy(desc(reports.createdAt));
    }
    return db.select().from(reports).orderBy(desc(reports.createdAt));
  }

  async getReport(id: number) {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async createReport(report: InsertReport) {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }

  async markReportSent(id: number) {
    await db.update(reports).set({ sentAt: new Date() }).where(eq(reports.id, id));
  }

  // ─── Sync Logs ───
  async createSyncLog(source: string, status: string, details?: string, recordsProcessed?: number) {
    await db.insert(syncLogs).values({
      source,
      status,
      details,
      recordsProcessed: recordsProcessed ?? 0,
      completedAt: status === "completed" || status === "error" ? new Date() : null,
    });
  }

  async getLatestSyncLogs() {
    return db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(20);
  }

  // ─── Connections ───
  async getConnection(service: string) {
    const [conn] = await db.select().from(connections).where(eq(connections.service, service));
    return conn;
  }

  async upsertConnection(service: string, connected: boolean, config?: any, updateLastSync?: boolean) {
    const [existing] = await db.select().from(connections).where(eq(connections.service, service));
    const updateData: any = { connected, config, updatedAt: new Date() };
    if (updateLastSync) {
      updateData.lastSyncAt = new Date();
    }
    if (existing) {
      const [updated] = await db.update(connections)
        .set(updateData)
        .where(eq(connections.service, service))
        .returning();
      return updated;
    }
    const [created] = await db.insert(connections).values({ service, connected, config, lastSyncAt: updateLastSync ? new Date() : null }).returning();
    return created;
  }

  // ─── Conversations ───
  async getConversations() {
    return db.select().from(conversations).orderBy(desc(conversations.createdAt));
  }

  async getConversation(id: number) {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async createConversation(title: string) {
    const [conv] = await db.insert(conversations).values({ title }).returning();
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
  async getFirefliesMeetings() {
    return db.select().from(firefliesMeetings).orderBy(desc(firefliesMeetings.createdAt));
  }

  async upsertFirefliesMeeting(meeting: InsertFirefliesMeeting) {
    if (meeting.firefliesId) {
      const [existing] = await db.select().from(firefliesMeetings).where(eq(firefliesMeetings.firefliesId, meeting.firefliesId));
      if (existing) {
        const [updated] = await db.update(firefliesMeetings).set(meeting).where(eq(firefliesMeetings.firefliesId, meeting.firefliesId)).returning();
        return updated;
      }
    }
    const [created] = await db.insert(firefliesMeetings).values(meeting).returning();
    return created;
  }

  // ─── Deterministic KPI Computation ───
  async computeKPIs(startDate?: string, endDate?: string) {
    const allDeals = await this.getDeals();
    const allActivities = await this.getActivities();
    const allMeetings = await this.getMeetings();
    const allSettings = await this.getAllSettings();

    const closedWon = allDeals.filter(d => d.stage === "Closed Won" || d.stage === "closedwon");
    const openDeals = allDeals.filter(d => d.stage !== "Closed Won" && d.stage !== "closedwon" && d.stage !== "Closed Lost" && d.stage !== "closedlost");
    
    const totalRevenue = closedWon.reduce((sum, d) => sum + (d.amount || 0), 0);
    const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount || 0), 0);
    const weightedPipeline = openDeals.reduce((sum, d) => sum + (d.amount || 0) * ((d.probability || 0) / 100), 0);

    const calls = allActivities.filter(a => a.type === "CALL" || a.type === "call");
    const emails = allActivities.filter(a => a.type === "EMAIL" || a.type === "email");
    const meetingsHeld = allMeetings.filter(m => m.outcome === "COMPLETED" || m.outcome === "completed" || !m.outcome);

    const monthlyRevenueGoal = parseInt(allSettings.hubspotRevenueGoal || allSettings.monthlyRevenueGoal || "100000");
    const weeklyMeetingsGoal = parseInt(allSettings.weeklyMeetingsGoal || "15");
    const weeklyOutboundGoal = parseInt(allSettings.weeklyOutboundGoal || "50");

    return {
      revenue: {
        total: totalRevenue,
        goal: monthlyRevenueGoal,
        attainment: monthlyRevenueGoal > 0 ? Math.round((totalRevenue / monthlyRevenueGoal) * 100) : 0,
      },
      pipeline: {
        total: pipelineValue,
        weighted: weightedPipeline,
        dealCount: openDeals.length,
      },
      activity: {
        calls: calls.length,
        emails: emails.length,
        meetingsHeld: meetingsHeld.length,
        meetingsGoal: weeklyMeetingsGoal,
        outboundGoal: weeklyOutboundGoal,
        totalOutbound: calls.length + emails.length,
      },
      deals: {
        total: allDeals.length,
        closedWon: closedWon.length,
        open: openDeals.length,
      },
    };
  }
}

export const storage = new DatabaseStorage();

export async function cleanupNonRepData() {
  const repPatterns = ["%deb%", "%dov%"];
  
  await db.delete(deals).where(
    sql`(${deals.owner} IS NULL OR (LOWER(${deals.owner}) NOT LIKE ${repPatterns[0]} AND LOWER(${deals.owner}) NOT LIKE ${repPatterns[1]}))`
  );
  await db.delete(activities).where(
    sql`(${activities.owner} IS NOT NULL AND LOWER(${activities.owner}) NOT LIKE ${repPatterns[0]} AND LOWER(${activities.owner}) NOT LIKE ${repPatterns[1]})`
  );
  await db.delete(meetings).where(
    sql`(${meetings.owner} IS NOT NULL AND LOWER(${meetings.owner}) NOT LIKE ${repPatterns[0]} AND LOWER(${meetings.owner}) NOT LIKE ${repPatterns[1]})`
  );
}
