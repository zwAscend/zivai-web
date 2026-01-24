# Project Status Log - zivAI Platform

## Current scope (prototype)
- Auth with JWT (student/teacher/admin)
- Course management and enrollment
- Assessments, submissions, and grading (with AI question generation hooks)
- Resources (upload/download/reorder), chat, notifications
- MongoDB + Express/Node + React/Vite (running locally)

## Transition plan (Huawei stack)
1. Migrate core schema to GaussDB (openGauss) for relational data.
2. Add GaussDB (NoSQL, Mongo-compatible) for interaction logs/OCR blobs.
3. Move AI workloads to MindSpore/ModelArts; enable Ascend (CANN) acceleration and MindSpore Lite on Orange Pi AIpro.
4. Containerize services on Huawei Cloud CCE/ECS; edge sync between Orange Pi and cloud.
5. Swap local uploads for Huawei Object Storage and Huawei Cloud OCR.

## Environment (current dev)
- PORT 5000, CLIENT_URL http://localhost:5173
- MongoDB local instance (to be replaced by GaussDB)
- Local uploads served from `/uploads`

## Risks / next actions
- Schema migration planning (Mongo -> openGauss/NoSQL split)
- Harden AI pipelines for grading/ocr before moving to ModelArts
- Add integration and load tests ahead of CCE containerization

Last Updated: February 2025
