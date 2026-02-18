# DealFlow - CEO Sales Intelligence App

## Overview
Private single-user web application for Abe (CEO) that connects to HubSpot and Fireflies, stores synced data locally in Postgres, computes deterministic sales metrics, and uses AI to generate weekly email updates and biweekly CEO scorecard reports.

## Architecture
- **Frontend**: React + Vite + TypeScript, using shadcn/ui components, wouter routing, @tanstack/react-query
- **Backend**: Express.js API, Drizzle ORM with PostgreSQL
- **AI**: OpenAI via Replit AI Integrations (env vars: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL)
- **Sync**: HubSpot REST API, Fireflies GraphQL API
- **Scheduler**: node-cron for hourly syncs, weekly emails (Mon 8AM), biweekly scorecards (every other Tue 8AM)

## Key Design Decisions
- **Deal-centric**: Deals are the spine; activities, meetings all link to deals
- **Deterministic metrics**: KPIs computed in code (not by AI). AI only narrates and cites underlying records
- **Single user**: No authentication needed, only Abe uses the app
- **Owner name resolution**: HubSpot sync resolves owner IDs to configured rep names from sales_reps table (e.g., owner_id 84998473 → "Dovi") instead of raw HubSpot names
- **Email delivery**: Mocked with "send" button (no actual email sending)

## Project Structure
```
shared/schema.ts          - Drizzle schema (deals, activities, meetings, commitments, settings, reports, sync_logs, connections, conversations, messages)
server/db.ts              - Database connection
server/storage.ts         - Storage layer with CRUD + deterministic KPI computation
server/routes.ts          - All API endpoints
server/services/
  hubspot.ts              - HubSpot sync service
  fireflies.ts            - Fireflies sync service  
  metrics.ts              - Metrics computation for reports (per-rep breakdown)
  ai-reports.ts           - AI report generation (weekly, biweekly, custom, streaming)
  pdf-report.ts           - PDF generation from report content using pdfkit
  scheduler.ts            - Background cron jobs
client/src/
  lib/context.tsx          - React context with real API calls via react-query
  pages/                   - Dashboard, Connections, Settings, Reports, ChatPage, DealsPage
  components/dashboard/    - KPICard, DealTable, CommitmentList
  components/layout/       - Layout, Sidebar
```

## API Endpoints
- GET /api/kpis - Dashboard KPIs
- GET/api/deals, GET /api/deals/:id - Deals
- GET /api/activities, GET /api/meetings - Activities/Meetings
- GET/POST /api/settings - Goals/targets
- GET/POST /api/sales-reps, PATCH/DELETE /api/sales-reps/:id - Dynamic rep management
- GET /api/connections, POST /api/connections/:service/connect|disconnect
- POST /api/sync/hubspot, POST /api/sync/fireflies, GET /api/sync/logs
- GET /api/reports, GET /api/reports/:id, GET /api/reports/:id/pdf, POST /api/reports/generate/weekly|biweekly, POST /api/reports/:id/send
- POST /api/chat - Streaming AI chat (SSE)

## Required Secrets
- HUBSPOT_API_KEY - HubSpot Private App token
- FIREFLIES_API_KEY - Fireflies API key

## Recent Changes
- 2026-02-18: Biweekly scorecard updated — removed weighted pipeline value; added detailed "Meetings Held" and "Meetings Scheduled" sections per rep using new scheduledDate field (synced from HubSpot hs_createdate)
- 2026-02-18: Fixed LinkedIn message sync — Communications API channel type filter corrected from "LINKEDIN" to "LINKEDIN_MESSAGE"; removed incorrect note-body heuristic; all 66 LinkedIn messages now properly synced from Deb
- 2026-02-18: LinkedIn message syncing from HubSpot Communications API; outbound KPI now includes calls + emails + LinkedIn messages; report prompts emphasize outreach actions breakdown per rep
- 2026-02-18: Report metrics now filtered by period (7 days for weekly, 14 days for biweekly) instead of counting all historical activity
- 2026-02-18: HubSpot sync now resolves owner IDs to configured rep names (e.g., "Dov rovt" → "Dovi"), fixing missing data for reps whose HubSpot names didn't match their configured names
- 2026-02-18: Weekly report AI prompt updated for more detailed output — increased transcript context (6000 chars), token limit (4096), and system prompt emphasizes thoroughness
- 2026-02-18: MeetingSelector refactored with React.memo and stable useCallback props to prevent scroll jumps on checkbox toggle
- 2026-02-18: Dynamic rep management — sales_reps table replaces hardcoded Deb/Dovi; add/remove reps in Settings, map each to HubSpot user, toggle exclude from data/reports
- 2026-02-18: Meeting selection for BOTH report types — Reports page shows side-by-side weekly recap and biweekly scorecard cards, each with independent meeting selection checkboxes
- 2026-02-18: HubSpot sync and metrics now driven by configured reps — no hardcoded names; cleanup function uses dynamic rep list
- 2026-02-18: Weekly report redesigned as "Meeting Recap" — focused on selected Fireflies meetings (what was discussed, rep updates, action items) rather than duplicating HubSpot pipeline data; biweekly scorecard remains the full pipeline/metrics report
- 2026-02-18: Commitment ledger feature fully removed from schema references, storage, routes, metrics, AI reports, and all frontend pages
- 2026-02-18: Fireflies meetings now stored with full summaries, outlines, keywords, transcript snippets; AI reports include "Notable Activities & Context" section highlighting demos, presentations, internal projects per rep
- 2026-02-18: Revenue goal now synced from HubSpot goal_targets API (Settings page shows read-only); meetings/outbound goals remain manual in Settings
- 2026-02-18: HubSpot sync filters all data to Deb & Dovi only; non-rep deals/activities/meetings are excluded at sync time and cleaned up automatically
- 2026-02-18: PDF report generation (pdfkit), per-rep metrics breakdown (Deb/Dovi), improved AI prompts with rep separation, markdown rendering on Reports page
- 2026-02-18: Connection flow with API key validation, sync timestamp tracking, config preservation during syncs
- 2026-02-17: Initial full build - schema, storage, services, API routes, frontend connected to real APIs
