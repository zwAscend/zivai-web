# zivAI (zivai-web)

zivAI is an AI Teacher Assistant for O-Level education, built by **Team ZWASCEND** (University of Zimbabwe) for the Huawei ICT Competition 2025–2026. The goal is to deliver adaptive teaching, automated grading, mastery tracking, and offline-friendly operations across classroom, homework, and revision flows.

This repository currently contains the working prototype (React + Node/Express + MongoDB). The next phase will align to the Huawei stack outlined in the competition entry: MindSpore/ModelArts for training and deployment, CANN on Ascend hardware (Orange Pi AIpro) for edge inference, and GaussDB (openGauss + NoSQL) for core storage and high-throughput logs/OCR.

## Current vs target architecture

- **Current (prototype)**: Vite + React front-end, Express/Node API, MongoDB, Socket.io, local uploads, cron jobs for resource sync.
- **Target (Huawei stack)**:
  - AI/ML: Huawei MindSpore (training/fine-tuning), ModelArts (full lifecycle), CANN for Ascend acceleration, MindSpore Lite for offline edge inference.
  - Edge: Orange Pi AIpro (Ascend 310) running lightweight openGauss for continuity and local inference.
  - Databases: GaussDB (openGauss) for relational core; GaussDB (NoSQL, Mongo-compatible) for interaction logs/OCR payloads.
  - Services: Huawei Cloud CCE (containerized backend), ECS, Huawei Cloud OCR.
  - Frontend/Backend: React/Angular on the web tier; Python FastAPI services for AI workers (in addition to the existing Node API while migrating).

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
- `/api/courses` — course listing/teaching
- `/api/assessments` — create/list/update/delete, results
- `/api/submissions` — student submissions, teacher review, stats
- `/api/development` — attributes, plans, assignments
- `/api/resources` — upload/list/download/reorder/delete
- `/api/chat` — teacher-student chat
- `/api/notifications` — list/mark/read counts
- `/api/ai` — question generation (additional AI endpoints to be added)

## Data highlights
- Users, Students, Courses, Assessments, Results, Submissions, Development Plans/Attributes, Resources, Messages, Notifications, Calendar Events.
- See `server/models/` for the current Mongoose schemas; these will be migrated to openGauss (relational) and GaussDB NoSQL for logs/OCR.

## Migration roadmap (Huawei stack)
1) Move core schema to GaussDB (openGauss) and refactor ORM layer.  
2) Add GaussDB (NoSQL) for interaction logs, OCR payloads, AI traces.  
3) Shift AI services to MindSpore/ModelArts with Ascend acceleration and MindSpore Lite on Orange Pi AIpro.  
4) Containerize backend on CCE; introduce FastAPI workers for AI pipelines.  
5) Replace local uploads with Huawei Object Storage and integrate Huawei Cloud OCR.  
6) Add offline/edge sync between Orange Pi and cloud (store-and-forward).  

## Team (ZWASCEND, University of Zimbabwe)
- Instructor: Mr. Bernad Mapako  
- Team captain: McDonald Andrew Mpofu  
- Team members: Buhle Mgazi, Jacob Nixon Majurira  

## Notes
- UI/UX is not being altered in this phase; changes focus on naming, documentation, and future stack alignment.
- For detailed design material, see `zivAI Documentation.md` and competition entry notes.
