# zivAI Web (zivai-web)

zivAI is an AI Teacher Assistant for O-Level/High School subjects, built by **Team ZWASCEND** (University of Zimbabwe) for the Huawei ICT Competition 2025–2026. It targets overcrowded classes with automated marking, mastery tracking on subject/topic/skill graphs, and offline-friendly delivery.

This repository contains the **web frontend** (Vite + React + TypeScript). The LMS APIs are provided by the Spring Boot core backend, and AI workflows are handled by the AI services backend.

## Tech stack (current)
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **UI**: Headless UI + custom components
- **HTTP**: Fetch + Axios

## Dependent services
This web app expects the following services to be running:
- **Core Backend (LMS)**: Spring Boot service (`core-backend`) on `http://localhost:5000`
- **AI Services Backend**: (if enabled for AI features) on `http://localhost:8000`
- **Database**: PostgreSQL / GaussDB (openGauss) for LMS data (used by core-backend)

> Note: The web app is a client; it does not host APIs itself.

## Setup
Prerequisites:
- Node.js 18+
- npm (or pnpm/yarn)

Install dependencies:
```bash
npm install
```

Run the web app (development):
```bash
npm run dev
```

The app will be available at:
```
http://localhost:5173
```

## Environment variables
Create a `.env` file if you need to override API endpoints:
```
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000/ws/chat
```

## Common endpoints used by the UI
- `/api/auth` — login/profile (via core-backend)
- `/api/students` — student profiles
- `/api/subjects` — subject listing/teaching
- `/api/assessments` — assessments and results
- `/api/submissions` — student submissions and teacher review
- `/api/development` — attributes and plans
- `/api/resources` — uploads and downloads
- `/api/chat` — teacher-student chat
- `/api/notifications` — notifications and unread counts
- `/api/ai` — AI generation endpoints (via AI services backend)

## Notes
- UI/UX is not being altered in this phase; updates focus on naming, docs, and service wiring.
- See `zivAI Documentation.md` for system architecture and design reference.

## Recent frontend updates (admin portal)
- **Admin management screens**: Users, Subjects, Classes, Edge Nodes.
- **Edge nodes**: Create/Edit/Delete supported via `/api/admin/edge-nodes` (custom confirm dialog, toast notifications).
- **Subjects**:
  - Exam board selection now uses a dropdown (`ZIMSEC`, `CAMBRIDGE`).
  - Grades/forms are selectable (Form 1–Form 6) and displayed in the subject table.
- **UX**:
  - Default browser confirms removed; custom admin confirmation dialogs used instead.
  - Loading placeholders (skeletons) used in admin tables.

## Recent frontend updates (LMS wiring)
- **Development plans**: UI now consumes real `/api/development` endpoints; AI generation falls back to a local plan template if AI services are unavailable.
- **Resources**: UI is wired to `/api/resources` (counts, recent, subject resources, upload/download).
- **Calendar**: Events are created/updated via `/api/calendar/events` (backend resolves creator/school when not supplied).
