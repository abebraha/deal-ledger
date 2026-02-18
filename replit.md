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
- **Deal-centric**: Deals are the spine; activities, meetings, commitments all link to deals
- **Deterministic metrics**: KPIs computed in code (not by AI). AI only narrates and cites underlying records
- **Single user**: No authentication needed, only Abe uses the app
- **Commitment Ledger**: Fireflies action items compared against HubSpot KPIs in reports
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
- GET /api/commitments, PATCH /api/commitments/:id/status - Commitments
- GET/POST /api/settings - Goals/targets
- GET /api/connections, POST /api/connections/:service/connect|disconnect
- POST /api/sync/hubspot, POST /api/sync/fireflies, GET /api/sync/logs
- GET /api/reports, GET /api/reports/:id, GET /api/reports/:id/pdf, POST /api/reports/generate/weekly|biweekly, POST /api/reports/:id/send
- POST /api/chat - Streaming AI chat (SSE)

## Required Secrets
- HUBSPOT_API_KEY - HubSpot Private App token
- FIREFLIES_API_KEY - Fireflies API key

## Recent Changes
- 2026-02-18: Rep mapping in Settings — map Deb/Dovi to HubSpot owner IDs via dropdowns; HubSpot sync uses mapped IDs when set, falls back to name pattern matching
- 2026-02-18: Meeting selection for weekly reports — Reports page shows Fireflies meetings from last 30 days with checkboxes; user picks which meetings to include in each recap
- 2026-02-18: Weekly report redesigned as "Meeting Recap" — focused on selected Fireflies meetings (what was discussed, rep updates, action items) rather than duplicating HubSpot pipeline data; biweekly scorecard remains the full pipeline/metrics report
- 2026-02-18: Commitment ledger feature fully removed from schema references, storage, routes, metrics, AI reports, and all frontend pages
- 2026-02-18: Fireflies meetings now stored with full summaries, outlines, keywords, transcript snippets; AI reports include "Notable Activities & Context" section highlighting demos, presentations, internal projects per rep
- 2026-02-18: Revenue goal now synced from HubSpot goal_targets API (Settings page shows read-only); meetings/outbound goals remain manual in Settings
- 2026-02-18: HubSpot sync filters all data to Deb & Dovi only; non-rep deals/activities/meetings are excluded at sync time and cleaned up automatically
- 2026-02-18: PDF report generation (pdfkit), per-rep metrics breakdown (Deb/Dovi), improved AI prompts with rep separation, markdown rendering on Reports page
- 2026-02-18: Connection flow with API key validation, sync timestamp tracking, config preservation during syncs
- 2026-02-17: Initial full build - schema, storage, services, API routes, frontend connected to real APIs
