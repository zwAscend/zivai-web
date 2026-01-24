
# Chapter 3 — Analysis & Design

## 3.1 Introduction

This chapter gives the system analysis and the design blueprint for the AI-Driven Adaptive Teaching and Learning System (KundAI). It translates the problem definition and requirements (Chapter 2 and the project proposal) into a structured, implementable architecture and design. The chapter covers stakeholder-driven requirements, functional and non-functional requirements, high-level architecture, data schema summaries, API and sequence designs, UI considerations, security, scalability, deployment and testing strategies.

## 3.2 Stakeholders and Goals

Primary stakeholders:
- Teachers: reduce marking workload, get actionable analytics and reteach suggestions.
- Students: receive personalized development plans and feedback.
- Administrators: manage users, classes and resources; audit and reporting.
- Developers/DevOps: deploy, monitor and scale the system.

Design goals (derived from requirements):
- Automate grading of scanned paper assessments and produce individualized development plans.
- Provide real-time communication (chat) between users with persistent storage for audit.
- Support low-bandwidth access pathways (web + optional SMS/USSD) for inclusive access.
- Ensure data security, privacy and resilience under realistic classroom loads.

## 3.3 Functional Requirements (summary)

- User account management: register/login, roles (student, teacher, admin), profile management.
- Assessment ingestion: upload/scan image, OCR extraction, storage of original files.
- Automatic grading: convert OCR/extracted answers to structured responses and compute marks.
- Skill analysis & plan generation: map assessments to skill tags, compute current vs potential, recommend development plan.
- Resource management: upload, tag, reorder and serve resources to classes.
- Chat & notifications: real-time messaging with persistent history and push notifications for key events.
- Admin dashboards: analytics and exportable reports.

## 3.4 Non-functional Requirements (NFRs)

- Performance: API Gateway must handle concurrent requests (hundreds) and keep response times low for typical operations.
- Scalability: horizontal scale of backend components (API & ML workers) and ability to separate heavy compute onto separate workers.
- Availability: target multi-hour/month downtime (design for at least 99% uptime in typical deployments).
- Security: TLS for transport, hashed passwords, JWT-based auth with refresh tokens, input validation.
- Maintainability: modular codebase with clear separation between API Gateway (Node), ML services (Python) and front-end (React).
- Accessibility: responsive UI, and optional SMS/USSD APIs for resource-limited contexts.

## 3.5 High-level Architecture

Architecture style: Hybrid microservices (single API gateway + specialized compute microservices).

Components:
- API Gateway (Node.js + Express): authentication, routing, lightweight business logic, and orchestration of other services.
- ML/Compute Services (Python + FastAPI): OCR, grading rules, skill-diagnosis and plan generation. These are stateless workers behind authenticated REST endpoints.
- Database (MongoDB): primary persistent store for users, students, courses, resources, messages, submissions and plans.
- Real-time Layer (Socket.io): bi-directional messaging; messages persisted to MongoDB for history and audit.
- Storage (uploads/ local or S3): store uploaded files (images, docs, media). Served via secure endpoints or CDN in production.
- Front-end (React + Vite): single-page app for teachers/students/admin with route-based code splitting and auth context.

Deployment options:
- Single-host Docker Compose for local/dev.
- Containerized microservices (Docker/Kubernetes) for production with separate nodes for API, ML workers and DB.

Architecture diagram (placeholder — include as image in final report):

- [Client] <--HTTPS/WebSocket--> [API Gateway (Node/Express)]
															/       |         \
														 /        |          \
											[FastAPI ML]  [MongoDB]  [Uploads/S3]

## 3.6 Data Model & Schema Design (logical)

Primary entities (high-level):

- User
	- id, firstName, lastName, email, passwordHash, role (student|teacher|admin), avatar, studentId
- Student
	- id, firstName, lastName, email, overall, engagement, strength, performance, courses[], activePlanId
- Course
	- id, name, code, attributes[], resources[]
- Resource
	- id, title, type, tags[], size, uploadedBy, path, downloads, ordering
- Assessment / Submission
	- id, studentId, courseId, uploadedFile, extractedAnswers, score, gradedAt, graderId (auto/manual)
- StudentAttribute (skills)
	- id, studentId, skillName, currentScore, potentialScore, updatedAt
- StudentPlan
	- id, studentId, name, skills[], progress, potentialOverall, eta, description
- Message
	- id, chatId (or room), senderId, receiverIds[], content, attachments[], createdAt, status

Notes about design choices:
- MongoDB is used because entities are document-centric and flexible (plans and attributes are nested documents). Use references for common lists (courses, plans) and virtuals for computed/populated fields as in `studentModel.js`.
- Messages are persisted to enable audit, offline retrieval, and re-sending on reconnect.

ERD (textual summary):
- User 1 — * Student (optional link via studentId)
- Student 1 — * Submission
- Student 1 — * StudentPlan
- Course 1 — * Resource

Indexing recommendations:
- Users: unique index on email.
- Students/Submissions: index on studentId, createdAt for queries.
- Resources: compound index on tags and course for fast filtering.

## 3.7 API Design & Contracts

Design principle: RESTful endpoints on the API Gateway; compute-heavy ops delegated to FastAPI workers via authenticated REST calls.

Auth: JWT tokens (access + refresh). All protected endpoints must validate JWT and user role.

Representative endpoints:

- POST /api/auth/login — {email, password} -> {accessToken, refreshToken, user}
- POST /api/auth/refresh — {refreshToken} -> {accessToken}
- GET /api/students/:id — protected; returns student profile (+ populated attributes)
- POST /api/submissions — multipart form upload: {file, studentId, courseId} -> stores submission, enqueues OCR/grading job
- GET /api/resources?courseId=&tag= — list resources with pagination
- GET /api/chat/:chatId/messages — returns paginated messages
- POST /api/ai/ocr — (internal) accepts image and returns extracted text/structured answers (used by API gateway)
- POST /api/ai/grade — (internal) accepts extracted answers and returns grading results and skill tags

Integration pattern:
- API gateway receives submission -> stores file -> forwards file or pointer to FastAPI OCR endpoint -> OCR returns structured answers -> gateway calls grading API -> gateway persists results and notifies user via websocket and notification record.

Error handling and contracts:
- Use consistent error envelope: {success: false, code: 'string', message: 'human readable', details: {}}.
- Validate and return 4xx for client errors, 5xx for server errors. Log all server-side errors with unique IDs for support.

## 3.8 Sequence & Interaction Flows

1) Submission -> OCR -> Grading -> Plan generation (happy path)

- Teacher uploads image (POST /api/submissions)
- Server saves file and returns a submission record with status `processing`.
- Gateway POSTs file URL to FastAPI /api/ocr endpoint.
- FastAPI returns structured answers; gateway POSTs to /api/ai/grade.
- Grading service returns scores and skill tags; gateway persists results, updates submission status to `graded` and writes StudentAttribute changes.
- Gateway requests plan generation from ML service or uses local mapping rules and creates/updates StudentPlan document.
- Notify teacher (Socket.io message) and write Notification record.

2) Chat flow

- Client connects to Socket.io (with token). On `join_chat` the server ensures user is authorized for the chat and joins room.
- On `send_message`, server persists the message to MongoDB, then emits `receive_message` to room members.

3) Resource reorder

- Client sends new ordering via PATCH /api/resources/order with resourceId list.
- Server validates and persists ordering atomically (use a transaction or per-resource update with ordering field and timestamp).

## 3.9 UI / UX Design Considerations

Principal screens:
- Login / Register
- Teacher Dashboard: unresolved submissions, analytics, class roster, quick actions to grade/approve
- Student Dashboard: recent feedback, development plan, recommended resources
- Resource Manager: upload / drag-and-drop reorder / tag / share to class
- Chat & Notifications: persistent chat view and toast notifications

Accessibility & responsiveness:
- Semantic HTML, keyboard navigation, color contrast and ARIA labels.
- Prefer progressive enhancement: core features work at low bandwidth; heavier visualizations can load asynchronously.

## 3.10 Security Design

Authentication & Authorization:
- JWT access tokens (short-lived) + refresh tokens stored securely (httpOnly cookies or secure storage depending on client).
- Role-based access control: endpoints authorize by role.

Data protection & validation:
- Use `express-validator` or `zod` for incoming payload validation.
- Sanitize and limit uploaded file types and sizes; scan files if possible.
- Encrypt sensitive fields (if required) at database level.

Transport & storage:
- Enforce HTTPS/TLS in production.
- For file storage use signed S3 URLs and restrict access via bucket policies when possible.

Operational security:
- Rate-limit authentication endpoints and sensitive write endpoints.
- Monitor logs, integrate alerting on suspicious activity.

## 3.11 Scalability, Availability & Resilience

Scaling strategy:
- Stateless Node API and FastAPI services behind a load balancer; scale horizontally.
- MongoDB as a managed cluster with replicas for high availability.
- Offload heavy ML processing to separate worker pool with autoscaling (Kubernetes HPA or cloud autoscale groups).

Resilience patterns:
- Circuit breakers and retries for internal service calls to ML workers.
- Queueing for processing submissions (e.g., RabbitMQ/Redis queue) to decouple ingestion from compute and to smooth spikes.

## 3.12 Deployment & Operations

Local dev: Docker Compose that includes API, FastAPI worker(s), MongoDB and a mock S3 (minio) and Redis (optional for queues).

Production: containerized deployment (Kubernetes recommended):
- API Deployment + HPA, ML worker Deployment + HPA, MongoDB managed service, Object storage (S3), Ingress with TLS, and a CDN for static files.

CI/CD suggestions:
- Lint/test/build steps on PRs. Build and push container images on merge.
- Blue/green or rolling deployments for minimal downtime.

## 3.13 Testing Strategy

Recommended automated tests:
- Unit tests: controller and small utility functions (Jest for Node, pytest for Python ML services).
- Integration tests: API Gateway routes + DB (use test DB) with Supertest (Node) and pytest for FastAPI.
- End-to-end tests: Cypress or Playwright for critical flows (login, submission, grading notification).
- Load tests: k6 or Artillery for endpoint concurrency profiling, especially `/api/submissions` and auth flows.

Manual checks:
- Security review (OWASP checklist), penetration test for auth and file upload.

## 3.14 Constraints, Assumptions & Open Issues

Constraints:
- Some ML tasks (OCR quality, handwritten recognition) may require ongoing model improvements and dataset curation.
- Low-bandwidth channels (SMS/USSD) may need third-party gateway integration and additional costs.

Assumptions:
- MongoDB is available and acceptable as the primary datastore.
- The OCR and grading algorithms can be encapsulated in Python services callable over REST.

Open issues / decisions to resolve:
- Exact schema for skill-tagging taxonomy and mapping from questions to skills.
- Whether to implement a persistent job queue immediately or rely on synchronous calls for MVP.
- Final choice for file storage (local vs S3) depending on production target.

## 3.15 Conclusion

This chapter formalizes the analysis and design of KundAI into a practical, implementation-ready blueprint. The architecture separates concerns between a high-throughput API gateway, specialized ML workers, and a persistent document database. The design prioritizes teacher workload reduction, student personalization, and system maintainability. The next chapter (Chapter 4) should implement the prioritized features in an incremental manner, starting with secure auth, submission upload + OCR pipeline, persistent chat, and basic plan generation.

---

Appendix: Suggested artifacts to add alongside Chapter 3
- ERD diagram (PNG/SVG)
- Sequence diagrams (submission & chat flows) — PlantUML or draw.io exports
- `docker-compose.yml` for local dev
- `.env.example` listing required env vars

