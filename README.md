# zivAI Technical Documentation

This document describes the current zivAI platform implementation as represented in this workspace, with `zivai-web` as the primary frontend.

## 1) System overview

zivAI is an LMS + AI-assisted education platform targeting O-Level/High School workflows:

- Teaching and class management
- Assessment creation, assignment, submission, and review
- Student mastery and development plans
- Resource upload/search and content organization
- Reporting and term forecast analytics
- Teacher-student messaging with realtime updates
- Edge/cloud deployment support for intermittent connectivity

## 2) Repository and component map

Main folders in this workspace:

- `zivai-web`: React frontend (this repo)
- `core-backend`: Spring Boot LMS backend (REST + WebSocket + edge/cloud sync runtime roles)
- `ai-services-backend`: FastAPI AI service scaffold (stub routes)
- `zivAI_ASAG_ENGINE`: Flask AI engine (assessment/content/tutor/resource intelligence)
- `zivai-infra`: infrastructure assets (DB artifacts)
- `msmodels`, `msmodels2`, `mscpu`, `mindocr`: model and OCR related workspaces

## 3) High-level architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                              zivai-web                              │
│             (Vite + React + TypeScript, port 5173)                 │
└───────────────────────┬───────────────────────────┬─────────────────┘
                        │                           │
                        │ REST (/api/*)             │ WebSocket (/ws/chat)
                        ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           core-backend                              │
│  Spring Boot LMS (default port 5000, profiles: edge | cloud)       │
│  - auth, users, classes, subjects, assessments, submissions         │
│  - development plans, reports, resources, notifications, chat       │
│  - edge/cloud sync APIs and workers                                 │
└───────────────────────┬──────────────────────────────────────────────┘
                        │
                        │ JDBC
                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL / GaussDB                            │
│     schemas: lms, lookups, edge, kb, ai, audit, util               │
└──────────────────────────────────────────────────────────────────────┘

Optional AI integration path(s):

zivai-web --> AI endpoint on :8000 (hardcoded in some services today)
           --> expected "/api/v1/agents/*" contract for plan/assessment flows

Additional backend candidates in workspace:
- ai-services-backend (FastAPI scaffold, default docs/examples on :8001)
- zivAI_ASAG_ENGINE (Flask engine, default port :8000, "/api/v1/zivai/*", "/api/v1/resources/*", etc.)
```

## 4) Frontend (`zivai-web`) technical design

### 4.1 Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router
- Fetch-based service layer (`src/services/http.ts`)
- Radix/headless UI primitives + custom components

### 4.2 Entry points and structure

- App bootstrap: `src/main.tsx`
- Route composition and role gates: `src/App.tsx`
- Primary modules:
  - `src/components/admin/*`
  - `src/components/student/*`
  - `src/components/resources/*`
  - `src/components/calendar/*`
  - `src/components/assessments/*`
  - `src/components/development/*`
  - `src/components/report/*`
  - `src/components/staffroom/*`
  - `src/components/classroom/*`
- Page-level screens: `src/pages/*`
- API/service layer: `src/services/*`

### 4.3 Authentication/session model

- Login endpoint: `POST /api/auth/login` (via `authService`)
- Session artifacts:
  - `localStorage.token`
  - `localStorage.user`
  - `sessionStorage.auth_session_active` marker
- Frontend checks token expiry if token is JWT-shaped (`exp` claim parse attempt).
- Authorization header behavior:
  - `fetchData` sends `Authorization: Bearer <token>` when token is present.

Note: backend login currently returns an opaque random token, so frontend-side JWT expiry checks are effectively no-op unless token format changes.

### 4.4 Data access and caching

`src/services/http.ts` centralizes API requests:

- `API_URL = import.meta.env.VITE_API_URL || '/api'`
- GET caching:
  - in-memory + sessionStorage
  - default TTL: 20s
  - in-flight request de-duplication
- Write operations clear cache to avoid stale UI state.
- Error normalization converts raw API failures to user-facing messages.

### 4.5 WebSocket chat

- Client endpoint resolved by `src/utils/ws.ts`
- Source precedence:
  1. `VITE_WS_URL`
  2. derive from `VITE_API_URL`
  3. empty string (disabled)
- Connection format:
  - `ws://<host>/ws/chat?studentId=<uuid>`

## 5) Backend interfaces used by the frontend

### 5.1 Core backend (`core-backend`)

Base URL:

- `http://localhost:5000/api` (default local)

Main controller groups currently present:

- `/api/auth`
- `/api/admin`
- `/api/users`
- `/api/teachers`
- `/api/students`
- `/api/subjects`
- `/api/classes`, `/api/enrolments`
- `/api/assessments`, `/api/submissions`, `/api/assessment-*`
- `/api/development`, `/api/reteach-cards`
- `/api/resources`
- `/api/reports`, `/api/term-forecasts`
- `/api/calendar/events`
- `/api/chat`, `/api/chats`, `/api/messages`, `/api/notifications`
- `/api/peer-study/requests`
- `/api/ocr` (and `/ocr`)
- Sync endpoints:
  - cloud role: `/api/sync/push`, `/api/sync/pull`
  - edge role: `/api/sync/edge/status`, `/api/sync/edge/run`

WebSocket:

- `/ws/chat` (allowed origins currently open via pattern `*`)

### 5.2 AI integration from frontend (current state)

Some frontend services call hardcoded AI URLs on port `8000`:

- `src/services/aiService.ts`
- `src/services/planningService.ts`
- `src/services/externalAssessmentService.ts`
- `src/components/assessments/AIAssessmentModal.tsx` (PDF endpoint call)

Expected contract in frontend (examples):

- `POST http://localhost:8000/api/v1/agents/teacher/plan-generation`
- `POST http://localhost:8000/api/v1/agents/teacher/assessment-generation`
- `POST http://localhost:8000/api/v1/agents/student/assessment`
- `POST http://localhost:8000/api/v1/agents/ocr/general`

Important alignment note:

- `ai-services-backend` currently exposes scaffold routes such as `/ocr/extract`, `/asag/grade`, `/dkt/update`, `/agents/route` (default docs/examples on port `8001`).
- `zivAI_ASAG_ENGINE` exposes different Flask routes (for example `/api/v1/zivai/teacher/assessments`, `/api/v1/zivai/teacher/content`, `/api/v1/resources/upload`).

This means AI endpoint contracts need a gateway/adapter or code alignment before full production integration.

## 6) Runtime and deployment modes (core backend)

`core-backend` supports role-driven runtime:

- `edge` role
- `cloud` role

Profile files:

- `application-edge.properties`
- `application-cloud.properties`

Scenarios:

- `CLOUD_ONLY`
- `EDGE_ONLY`
- `HYBRID`
- `AUTO` (derived behavior)

Operational guidance for scenarios is documented in:

- `core-backend/docs/deployment-scenarios.md`

## 7) Data model summary

Canonical DDL at workspace root: `postgres_ddl.sql`

Top-level schemas:

- `util`
- `lookups`
- `lms`
- `kb`
- `ai`
- `edge`
- `audit`

Selected key domains:

- Identity and roles (`lms.users`, `lms.user_roles`)
- Teaching structure (`lms.subjects`, `lms.topics`, `lms.classes`, `lms.enrolments`)
- Assessments (`lms.assessments`, `lms.assessment_assignments`, `lms.assessment_results`)
- Development planning (`lms.skills`, `lms.mastery_snapshots`, plan-related tables)
- Resources and content (`lms.resources`, `lms.topic_resources`)
- Messaging and notifications (`lms.chats`, `lms.messages`, `lms.notifications`)
- Edge sync (`edge.sync_outbox`, `edge.sync_inbox`, checkpoints/conflicts)

## 8) Local development setup

### 8.1 Frontend only

```bash
cd zivai-web
npm install
npm run dev
```

Default URL: `http://localhost:5173`

### 8.2 Full local stack (recommended)

1. Start PostgreSQL/GaussDB and load schema (`postgres_ddl.sql`).
2. Start LMS backend:

```bash
cd core-backend
./mvnw spring-boot:run
```

3. Start AI backend that matches frontend contract (port `8000`) or provide compatible proxy/gateway.
4. Start frontend:

```bash
cd zivai-web
npm run dev
```

## 9) Environment configuration

### 9.1 Frontend runtime vars

Supported in code:

- `VITE_API_URL` (default `/api`)
- `VITE_WS_URL` (optional, chat websocket)
- `VITE_CALENDAR_INTEGRATIONS` (`true`/`false`)
- `VITE_ENABLE_STUDENT_ASSESSMENT_ENDPOINTS` (`true`/`false`)

Vite dev server process vars:

- `VITE_DEV_HOST` (default `localhost`)
- `VITE_DEV_PORT` (default `5173`)
- `VITE_API_PROXY_TARGET` (default `http://localhost:5000`)

Example `.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000/ws/chat
VITE_CALENDAR_INTEGRATIONS=false
VITE_ENABLE_STUDENT_ASSESSMENT_ENDPOINTS=true

VITE_DEV_HOST=localhost
VITE_DEV_PORT=5173
VITE_API_PROXY_TARGET=http://localhost:5000
```

### 9.2 Core backend vars (selected)

- `ZIVAI_DB_URL`
- `ZIVAI_DB_USERNAME`
- `ZIVAI_DB_PASSWORD`
- `SPRING_PROFILES_ACTIVE` (`edge` or `cloud`)
- `APP_RUNTIME_SCENARIO` / `app.runtime.scenario`
- Sync identity/config: `ZIVAI_EDGE_NODE_ID`, `ZIVAI_EDGE_AUTH_KEY`, `ZIVAI_CLOUD_SYNC_BASE_URL`
- OCR integration vars: `HWC_*`

## 10) Build and quality commands

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Backend:

```bash
cd core-backend
./mvnw test
./mvnw spring-boot:run
```

## 11) Known integration gaps and risks

- AI endpoint contracts are not yet unified across `zivai-web`, `ai-services-backend`, and `zivAI_ASAG_ENGINE`.
- Several AI frontend calls are hardcoded to `localhost:8000` instead of environment-driven base URLs.
- Auth token from backend is opaque random text; frontend expiry logic assumes JWT format when available.
- CORS on core backend is currently restricted to `http://localhost:5173` for `/api/**`, so non-default frontend origins require backend config update.

## 12) Suggested next implementation steps

1. Introduce a single `VITE_AI_API_URL` and migrate all hardcoded AI URLs.
2. Standardize AI endpoint contracts (or add a small adapter gateway).
3. Add OpenAPI contract docs for frontend-consumed endpoints.
4. Add integration tests for key cross-service flows (login, assessment lifecycle, plan generation fallback, resource upload, realtime chat).
