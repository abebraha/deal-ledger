# DealFlow - CEO Sales Intelligence App

## Overview
Multi-tenant web application for Abe (CEO consultant) that manages multiple client company accounts. Each account has isolated HubSpot/Close CRM/Fireflies connections, sales reps, deals, activities, meetings, and reports. The app syncs data from HubSpot, Close CRM, and Fireflies, computes deterministic sales metrics, and uses AI to generate weekly meeting recaps and biweekly CEO scorecard reports formatted as downloadable PDFs.

## Architecture
- **Frontend**: React + Vite + TypeScript, using shadcn/ui components, wouter v3 routing (nested), @tanstack/react-query
- **Backend**: Express.js API, Drizzle ORM with PostgreSQL
- **AI**: OpenAI via Replit AI Integrations (env vars: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL)
- **Sync**: HubSpot REST API, Close CRM REST API, Fireflies GraphQL API
- **Scheduler**: node-cron for hourly syncs, weekly emails (Mon 8AM), biweekly scorecards (every other Tue 8AM)
- **Multi-tenancy**: Account-based isolation via `account_id` foreign keys with CASCADE delete on all data tables

## Key Design Decisions
- **Multi-tenant**: Accounts table with account_id FK on all data tables; each account has its own connections, reps, deals, etc.
- **Deal-centric**: Deals are the spine; activities, meetings all link to deals
- **Deterministic metrics**: KPIs computed in code (not by AI). AI only narrates and cites underlying records
- **Single user**: No authentication needed, only Abe uses the app
- **Owner name resolution**: HubSpot and Close sync resolve owner/user IDs to configured rep names from sales_reps table
- **Email delivery**: Mocked with "send" button (no actual email sending)
- **API key storage**: Per-account connection configs stored in connections table (not global secrets)

## Project Structure
```
shared/schema.ts          - Drizzle schema (accounts, deals, activities, meetings, settings, reports, sync_logs, connections, sales_reps, fireflies_meetings, conversations, messages)
server/db.ts              - Database connection
server/storage.ts         - Storage layer with CRUD + deterministic KPI computation (all methods accept accountId)
server/routes.ts          - All API endpoints under /api/accounts/:accountId/...
server/services/
  hubspot.ts              - HubSpot sync service (account-scoped)
  close.ts                - Close CRM sync service (account-scoped)
  fireflies.ts            - Fireflies sync service (account-scoped)
  metrics.ts              - Metrics computation for reports (per-rep breakdown, account-scoped)
  ai-reports.ts           - AI report generation (weekly, biweekly, streaming, account-scoped)
  pdf-report.ts           - PDF generation from report content using pdfkit
  scheduler.ts            - Background cron jobs (iterates all accounts)
client/src/
  lib/context.tsx          - React context with account-scoped API calls via react-query
  pages/AccountsPage.tsx   - Landing page: list/create/delete client accounts
  pages/AccountApp.tsx     - Account wrapper: loads account, provides AppProvider context
  pages/                   - Dashboard, Connections, Settings, Reports, ChatPage, DealsPage
  components/dashboard/    - KPICard, DealTable
  components/layout/       - Layout, Sidebar (with account name + back to clients link)
```

## API Endpoints
### Account Management
- GET /api/accounts - List all accounts
- POST /api/accounts - Create account
- GET /api/accounts/:accountId - Get account
- DELETE /api/accounts/:accountId - Delete account + all data (CASCADE)

### Account-Scoped (all under /api/accounts/:accountId/)
- GET /kpis - Dashboard KPIs
- GET /deals, GET /deals/:id - Deals
- GET /activities, GET /meetings - Activities/Meetings
- GET/POST /settings - Goals/targets
- GET/POST /sales-reps, PATCH/DELETE /sales-reps/:id - Dynamic rep management
- GET /hubspot/owners - HubSpot owner list for rep mapping
- GET /close/users - Close CRM user list for rep mapping
- GET /connections, POST /connections/:service/connect|disconnect (hubspot, fireflies, close)
- POST /sync/hubspot, POST /sync/fireflies, POST /sync/close, GET /sync/logs
- GET /reports, GET /reports/:id, GET /reports/:id/pdf, POST /reports/generate/weekly|biweekly, POST /reports/:id/send
- GET /fireflies-meetings - Fireflies meetings for report selection
- POST /chat - Streaming AI chat (SSE)

## Frontend Routing
- `/` - AccountsPage (list/manage client accounts)
- `/accounts/:accountId` - Dashboard (nested via wouter v3 nest)
- `/accounts/:accountId/deals` - Deal pipeline
- `/accounts/:accountId/reports` - Report generation & history
- `/accounts/:accountId/chat` - AI analyst chat
- `/accounts/:accountId/connections` - Data source connections
- `/accounts/:accountId/settings` - Sales reps, goals

## Recent Changes
- 2026-02-23: Report refinement with AI — inline chat panel on any report to iteratively refine content with AI; streaming SSE refine endpoint; save/revert refined changes; PATCH /reports/:id to update content
- 2026-02-19: Close CRM integration — sync opportunities, calls, emails, notes, meetings; closeId/closeUrl on deals/activities/meetings; closeUserId on sales_reps; API key validation, connect/disconnect, manual sync; Close user mapping in Settings; scheduler includes Close sync
- 2026-02-18: Multi-tenancy — accounts table, account_id on all data tables, API routes restructured to /api/accounts/:accountId/..., frontend AccountsPage + nested routing, scheduler iterates all accounts
- 2026-02-18: Fixed LinkedIn message sync — Communications API channel type filter corrected from "LINKEDIN" to "LINKEDIN_MESSAGE"
- 2026-02-18: LinkedIn message syncing from HubSpot Communications API; outbound KPI now includes calls + emails + LinkedIn messages
- 2026-02-18: Report metrics now filtered by period (7 days for weekly, 14 days for biweekly)
- 2026-02-18: HubSpot sync now resolves owner IDs to configured rep names
- 2026-02-18: Dynamic rep management — sales_reps table; add/remove reps in Settings, map each to HubSpot user
- 2026-02-18: Meeting selection for BOTH report types
- 2026-02-18: HubSpot sync and metrics now driven by configured reps — no hardcoded names
- 2026-02-18: Weekly report redesigned as "Meeting Recap"; biweekly scorecard remains full pipeline/metrics report
- 2026-02-18: Fireflies meetings stored with full summaries, outlines, keywords, transcript snippets
- 2026-02-18: Revenue goal synced from HubSpot goal_targets API
- 2026-02-18: PDF report generation (pdfkit), per-rep metrics breakdown
- 2026-02-18: Connection flow with API key validation, sync timestamp tracking
- 2026-02-17: Initial full build
