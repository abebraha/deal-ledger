import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Conversations (for AI chat) ───
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Deals (spine of the app) ───
export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  hubspotId: text("hubspot_id").unique(),
  name: text("name").notNull(),
  amount: real("amount").default(0),
  stage: text("stage").notNull(),
  owner: text("owner"),
  closeDate: text("close_date"),
  lastActivityDate: text("last_activity_date"),
  probability: real("probability").default(0),
  companyName: text("company_name"),
  hubspotUrl: text("hubspot_url"),
  pipeline: text("pipeline"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Deal Stage History ───
export const dealStageHistory = pgTable("deal_stage_history", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull().references(() => deals.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  enteredAt: timestamp("entered_at").notNull(),
  exitedAt: timestamp("exited_at"),
});

// ─── Activities (calls/emails/notes/tasks from HubSpot) ───
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  hubspotId: text("hubspot_id").unique(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  subject: text("subject"),
  body: text("body"),
  owner: text("owner"),
  activityDate: text("activity_date"),
  hubspotUrl: text("hubspot_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Meetings (from HubSpot) ───
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  hubspotId: text("hubspot_id").unique(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  title: text("title"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  outcome: text("outcome"),
  owner: text("owner"),
  attendees: text("attendees"),
  hubspotUrl: text("hubspot_url"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Commitment Ledger (from Fireflies) ───
export const commitments = pgTable("commitments", {
  id: serial("id").primaryKey(),
  firefliesMeetingId: text("fireflies_meeting_id"),
  meetingDate: text("meeting_date"),
  meetingTitle: text("meeting_title"),
  type: text("type").notNull(),
  content: text("content").notNull(),
  owner: text("owner"),
  dueDate: text("due_date"),
  status: text("status").default("pending").notNull(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "set null" }),
  firefliesUrl: text("fireflies_url"),
  snippet: text("snippet"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Settings (goals/targets) ───
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Generated Reports ───
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  kpis: jsonb("kpis"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Sync Log ───
export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  details: text("details"),
  recordsProcessed: integer("records_processed").default(0),
  startedAt: timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Connection Config ───
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  service: text("service").notNull().unique(),
  connected: boolean("connected").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  config: jsonb("config"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// ─── Insert Schemas ───
export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true });
export const insertCommitmentSchema = createInsertSchema(commitments).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertReportSchema = createInsertSchema(reports).omit({ id: true, createdAt: true });
export const insertSyncLogSchema = createInsertSchema(syncLogs).omit({ id: true, startedAt: true });
export const insertConnectionSchema = createInsertSchema(connections).omit({ id: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

// ─── Types ───
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Commitment = typeof commitments.$inferSelect;
export type InsertCommitment = z.infer<typeof insertCommitmentSchema>;
export type Setting = typeof settings.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type SyncLog = typeof syncLogs.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ChatMessage = typeof messages.$inferSelect;
