# zivAI (zivai-web)

zivAI is an AI Teacher Assistant for O-Level/High School subjects, built by **Team ZWASCEND** (University of Zimbabwe) for the Huawei ICT Competition 2025–2026. It targets overcrowded classes with automated marking, mastery tracking on subject/topic/skill graphs, and offline-friendly delivery.

The repo currently holds a prototype (React + Express + MongoDB). The target architecture is defined in the latest GaussDB (openGauss) + GaussDB NoSQL DDL with edge/cloud sync (Orange Pi AIpro + Ascend), MindSpore/ModelArts for AI, and RAG-friendly KB tables.

## Current vs target architecture

- **Current (prototype)**: Vite + React, Express/Node, MongoDB, Socket.io, local uploads, cron.
- **Target (Huawei stack per new DDL)**:
  - Data: GaussDB (openGauss) relational core with UUIDs, sync_version, soft deletes; GaussDB (NoSQL/Mongo) for interaction logs, OCR payloads, event queues.
  - Domain: schools, classes, subjects → topics → skills; resources; rubric-aware questions; unified assessments (quiz/test/assignment/project/exam); attempts/answers with OCR + AI traces; mastery snapshots; KB chunks/embeddings; edge nodes/outbox/inbox for store-and-forward.
  - AI/ML: MindSpore/ModelArts, CANN on Ascend, MindSpore Lite on Orange Pi AIpro; AI model registry + versions + inference traces (as per DDL).
  - Infra: Huawei Cloud CCE/ECS, Huawei OCR, edge openGauss for continuity; RAG-ready KB tables (kb_versions/documents/chunks/embeddings).
  - APIs/Workers: Express gateway (current) plus FastAPI/ModelArts workers during migration.

## Tech stack (today)
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js (ES modules), Express, Socket.io
- Database: MongoDB (Mongoose)
- Storage: Local `uploads/` (S3 client present; moving to Huawei object storage later)
- Jobs: node-cron
- Auth: JWT + bcrypt

## Project structure (current)
- `server/` — Express server, routes, controllers, models, jobs
- `src/` — React app (Vite), components by feature
- `uploads/` — Local static uploads (ignored in git)

## Setup (current prototype)
Prerequisites: Node.js 18+, npm, MongoDB.

Install:
```bash
npm install
```

Environment (`.env`):
```
MONGO_URI=mongodb://localhost:27017/zivai
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-secure-secret
```

Run dev (frontend + backend):
```bash
npm run dev
```

Backend only:
```bash
npm run server
```

## API surface (current)
- `/api/auth` — login/register/profile
- `/api/students` — student CRUD
- `/api/courses` — course listing/teaching (to be renamed to subjects in upcoming refactor)
- `/api/assessments` — create/list/update/delete, results (will align to unified assessments)
- `/api/submissions` — student submissions, teacher review, stats
- `/api/development` — attributes, plans, assignments
- `/api/resources` — upload/list/download/reorder/delete
- `/api/chat` — teacher-student chat
- `/api/notifications` — list/mark/read counts
- `/api/ai` — question generation (additional AI endpoints to be added)

## Data highlights (from the new DDL)
- Schools and school users (multi-school).
- Subjects → topics → skills + prerequisites (high school syllabus graph).
- Classes, enrolments, class teachers (subject-scoped).
- Resources (school/subject), with status and ordering.
- Questions + rubric-aware marking schemes; question↔skill mapping.
- Unified assessments with assignments/enrollments/attempts; answers with OCR fields, AI traces, attachments, and grading overrides.
- Interaction events and mastery snapshots (DKT-friendly).
- Development plans/steps and student plans/attributes (by subject).
- Chat (chats/members/messages), notifications, calendar events.
- KB/RAG tables (kb_versions/documents/chunks/embeddings) without pgvector dependency.
- AI model registry, versions, inference runs, retrieval traces.
- Edge nodes, deployments, sync outbox/inbox for store-and-forward.
- Audit event log (append-only).

## Migration roadmap (aligned to new DDL)
1) Rename “courses” → “subjects” in the codebase and map to the GaussDB schema (UUID primary keys, sync_version, soft delete).
2) Introduce GaussDB (NoSQL) for interaction_logs/OCR/event_queue; wire edge outbox/inbox for store-and-forward.
3) Move grading/OCR/AI traces to the ai_* tables; hook inference runs to ModelArts/MindSpore.
4) Containerize services on CCE; add FastAPI workers for AI, keep Express gateway for REST/Socket.io.
5) Shift storage to Huawei Object Storage; connect Huawei OCR for scans.
6) Implement KB ingestion to kb_* tables and retrieval traces for RAG-based copilots.

## Project status snapshot
- **Current prototype**: Auth, class/enrolment, assessments/submissions, resources, chat, notifications, basic AI question generation on Mongo/Express/React.
- **Environment**: PORT 5000, CLIENT_URL http://localhost:5173, MongoDB local, uploads served from `/uploads`.
- **Transition plan**: openGauss/NoSQL migration, ModelArts/MindSpore pipelines, Ascend edge, CCE/ECS containerization, Huawei OCR/object storage, edge sync (outbox/inbox).
- **Risks/next actions**: finalize schema mapping in code, add integration/load tests pre-CCE, wire AI traces to ai_inference_runs, implement KB ingestion and retrieval traces.

## Team (ZWASCEND, University of Zimbabwe)
- Instructor: Mr. Bernad Mapako  
- Team captain: McDonald Andrew Mpofu  
- Team members: Buhle Mgazi, Jacob Nixon Majurira  

## Notes
- UI/UX is not being altered in this phase; changes focus on naming, documentation, and future stack alignment.
- For detailed design material, see `zivAI Documentation.md` and competition entry notes.
