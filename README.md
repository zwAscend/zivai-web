# KundAI (Kundai)

A full-stack educational platform combining a Vite + React front-end with an Express + Node backend, MongoDB persistence, real-time messaging via Socket.io, scheduled jobs, and resource management features.

## Table of contents

- Project overview
- System architecture
- Tech stack
- Project structure
- Installation & prerequisites
- Environment variables
- Running the project
- API overview
- Data models (summary)
- Background jobs & cron
- Front-end
- Deployment notes
- Tests & verification
- Contribution
- License

## Project overview

KundAI (Kundai) is a learning management and analytics system. It exposes a REST API for core resources (students, courses, resources, submissions, assessments, notifications, etc.), serves a React-based front-end, uses Socket.io for real-time chat, and runs periodic background jobs (e.g., resource sync).

This README documents the system architecture, key components, setup and run instructions, API surface, data models, and operational notes to help developers run and extend the system.

## System architecture

High-level flow:

Client (Vite + React)
  ↕ (HTTP / WebSocket)
Express API (server/index.js)
  ↕
MongoDB (via Mongoose)

Other components:
- Static file storage: `uploads/` served at `/uploads`
- Background jobs: `jobs/syncResourcesJob.js` scheduled with `node-cron`
- Real-time: Socket.io on the same HTTP server

ASCII diagram

  [Browser / Client] <--HTTP/WebSocket--> [Express + Socket.io Server]
                                     |
                                     +--> MongoDB (Mongoose)
                                     |
                                     +--> Local uploads/ (static)
                                     +--> Background jobs (node-cron)

## Tech stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js (ES Modules), Express, Socket.io
- Database: MongoDB (via Mongoose)
- Storage: Local `uploads/` folder (S3 client code present for AWS S3 integrations)
- Realtime: Socket.io
- Jobs: node-cron
- Auth: JSON Web Tokens (jsonwebtoken) and bcryptjs for password hashing

## Project structure (key files)

- `server/` - Backend code
  - `index.js` - Main server entry (Express + Socket.io + cron + routes)
  - `config/db.js` - MongoDB connection helper
  - `routes/` - API route modules (e.g. `studentRoutes.js`, `authRoutes.js`, `aiRoutes.js`, ...)
  - `controllers/` - Route handlers and business logic
  - `models/` - Mongoose models (Student, User, Course, Resource, Submission, etc.)
  - `jobs/` - Background jobs (resource sync)
  - `middleware/` - Auth and error middleware

- `src/` - Front-end React app (Vite)
  - `main.tsx` - App bootstrap
  - `App.tsx` - Routes and layout
  - `components/` - React components grouped by feature

- `uploads/` - Static files uploaded by users (served via Express at `/uploads`)
- `data/` - Static JSON fixtures and import scripts used during development

## Installation & prerequisites

Prerequisites:
- Node.js (v18+ recommended)
- npm (or yarn)
- MongoDB instance (local or remote)

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root with the environment variables described in the next section.

## Environment variables

Create a `.env` (not committed) file and set at least the following:

- `MONGO_URI` - MongoDB connection string
- `PORT` - (optional) server port, default 5000
- `CLIENT_URL` - (optional) front-end origin allowed by CORS (e.g. `http://localhost:5173`)
- `JWT_SECRET` - secret used for JWT token generation
- (Optional / AWS) `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` if S3 uploads are used

Example `.env` (do NOT commit):

```env
MONGO_URI=mongodb://localhost:27017/kundai
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-secure-secret
```

## Running the project

The repository includes convenient npm scripts in `package.json`.

- `npm run dev` — Starts both the front-end dev server (Vite) and the backend with `nodemon` (uses `concurrently`). Ideal for local development.
- `npm run server` — Start only the backend server: `node server/index.js`.
- `npm run build` — Build the front-end for production.

Development (both client & server):

```bash
npm run dev
```

Start only server (useful in production or testing):

```bash
npm run server
```

Notes:
- `dev` uses `concurrently` to run `vite` and `nodemon server/index.js` together.
- `server/index.js` creates an HTTP server and attaches Socket.io. It also schedules the resource sync job with `node-cron`.

## API overview

All API routes are mounted under `/api/*` in `server/index.js`:

- `/api/auth` - Authentication (login, register, token)
- `/api/students` - Student profiles and operations
- `/api/assessments` - Assessments management
- `/api/development` - Development plan endpoints
- `/api/chat` - Chat endpoints
- `/api/resources` - Uploads, resource listing and sync
- `/api/courses` - Courses and curriculum
- `/api/ai` - AI endpoints (document processing / AI features)
- `/api/submissions` - Student submissions
- `/api/notifications` - Notifications/alerts

Static uploads are served from `/uploads` (Express static middleware).

Realtime: Socket.io is attached to the same HTTP server and supports events such as `join_chat`, `send_message`, and `receive_message`. The server namespace and CORS are configured in `server/index.js`.

Error handling middleware is located in `server/middleware/errorMiddleware.js`.

For full route details, inspect `server/routes/*.js` and their respective controllers in `server/controllers/`.

## Data models (summary)

Representative models (more present in `server/models`):

- Student (`server/models/studentModel.js`):
  - Fields: `id`, `firstName`, `lastName`, `email`, `overall`, `engagement`, `strength`, `performance`, `courses` (refs), `activePlan` (ref)
  - Uses virtual populate for `attributes` and `plans`.

- User (`server/models/userModel.js`):
  - Fields: `firstName`, `lastName`, `email`, `password` (hashed), `isAdmin`, `isTeacher`, `avatar`, `role`, `studentId` (optional link)
  - Password hashing via bcrypt in `pre('save')` and `matchPassword` method.

Other models include `courseModel`, `resourceModel`, `submissionModel`, `assessmentModel`, `notificationModel`, `studentAttributeModel`, `studentPlanModel`, `resultModel`, and `planModel`. Inspect `server/models` for detailed schemas.

## Background jobs & cron

- `jobs/syncResourcesJob.js` is scheduled from `server/index.js` using `node-cron`. In the current development branch the schedule is configured to run every minute (`'* * * * *'`) — adjust to a sensible production schedule (e.g., `0 3 * * *` for daily at 3am) in `server/index.js`.

## Front-end overview

- Bootstrapped with Vite + React + TypeScript.
- `src/main.tsx` renders the app and mounts `App.tsx` inside a `BrowserRouter`.
- `App.tsx` contains the React Router routes and redirects for authenticated users. Authentication state is provided via `context/AuthContext.tsx`.
- Styling: Tailwind CSS and utility components under `src/components/ui`.

## Deployment notes

Typical production flow for a simple deploy:

1. Build the front-end:

```bash
npm run build
```

2. Serve the built front-end using a static host (Vercel, Netlify, S3 + CloudFront) or serve via Express (add a static middleware pointing to the `dist` folder).

3. Start the server:

```bash
NODE_ENV=production node server/index.js
```

Consider using process managers like PM2 or systemd for the backend, and ensure `MONGO_URI` and `JWT_SECRET` are set in your production environment. For scaling, run multiple server instances behind a load balancer and use a shared S3 or CDN for file uploads.

## Tests & verification

There are no automated test scripts in this repository yet. Recommended quick checks:

- Run `npm run dev` and verify the front-end loads at `http://localhost:5173` and the API responds at `http://localhost:5000`.
- Use Postman or curl to hit: `GET /api/students` and `GET /` (root returns "API is running...").
- Ensure MongoDB connection string (`MONGO_URI`) is correct and the server logs `MongoDB Connected` on start.

Suggested next steps: add unit tests for controllers and integration tests for main routes using Jest + Supertest.

## Contribution

Contributions welcome. Typical workflow:

1. Fork the repository.
2. Create a feature branch `feature/your-feature`.
3. Make changes and include tests where appropriate.
4. Open a pull request describing the change.

Please follow existing code style and lint rules (`npm run lint`).

## License

Specify your license here (e.g., MIT). If you don't want to open-source the code, note that here.

---

If you'd like, I can also:

- Add an `.env.example` with required environment variables.
- Create a short `DEVELOPMENT.md` with quick run & debug tips.
- Add a simple Dockerfile and docker-compose for local development.

Tell me which of those you'd like next and I will implement them.
# zivai-web
