# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**git-push-pray** is an AI-powered educational chatbot where a 3D VRM avatar acts as an eager student learning from users. The AI (Gemini 2.5 Flash via Vertex AI) responds with emotional metadata that drives avatar facial expressions and body animations.

## Development Commands

### Quick Start (via Makefile)
```bash
make back       # Run backend: cd backend && go run ./cmd/server
make front      # Run frontend: cd frontend && npm run dev
make database   # Start Cloud SQL Auth Proxy
```

### Backend (Go)
```bash
cd backend
go mod download
go run ./cmd/server          # Start server on :8081
go test ./...                # Run all tests
go build ./cmd/server        # Build binary
```

### Frontend (Node 24+)
```bash
cd frontend
npm install
npm run dev          # Dev server on :5173 (proxies /api/* to :8081)
npm run build        # TypeScript check + Vite production build
npm run lint         # ESLint
npm run format       # Prettier
```

### Infrastructure
```bash
cd terraform
terraform init
terraform plan
terraform apply
```

## Architecture

### Data Flow
```
User → React Frontend → Go Backend → Vertex AI (Gemini 2.5 Flash)
                                   ↓
                      emotion + reply in JSON response
                                   ↓
               3D VRM Avatar facial blendshapes + body animations
```

### Backend (`backend/`)
- `cmd/server/main.go` — entry point, route registration, CORS/auth middleware
- `internal/handler/handler.go` — HTTP handlers for `/api/chat`, `/api/history`, `/api/sessions`
- `internal/service/chat.go` — Gemini integration, in-memory conversation store (thread-safe map)
- `internal/middleware/auth.go` — Firebase ID token verification (required on all endpoints)
- `internal/repository/db.go` — PostgreSQL via GORM (minimal usage currently; conversation state is in-memory)

**Chat response schema:** The backend instructs Gemini to return `{"reply": "...", "emotion": "happy|sad|surprised|thinking|neutral"}` as JSON inside the text response, then parses it out before sending to the frontend.

### Frontend (`frontend/src/`)
- `App.tsx` — top-level chat logic, session management, API calls
- `components/AvatarViewer.tsx` — 3D VRM avatar using React Three Fiber + @pixiv/three-vrm; maps emotion strings to blendshape presets and body animations
- `contexts/AuthContext.tsx` — Firebase Google Sign-In context
- `lib/firebase.ts` — Firebase initialization
- `types.ts` — shared TypeScript interfaces (`ChatMessage`, `ChatSession`)

**Vite dev proxy:** `/api/*` is proxied to `http://localhost:8081`, so frontend calls `/api/chat` directly.

### Emotion → Avatar Mapping
Emotions from backend (`happy`, `sad`, `surprised`, `thinking`, `neutral`) drive:
- VRM blendshape presets (facial expressions)
- Body animations: breathing, head movement, spine bending

### Deployment
- **Frontend:** nginx-unprivileged container on Cloud Run (port 8080); `VITE_API_BASE_URL` injected at build time
- **Backend:** Go binary on Cloud Run (port 8081); uses Application Default Credentials for Vertex AI
- **Database:** Cloud SQL (PostgreSQL) — connected via Unix socket in Cloud Run
- **CI/CD:** GitHub Actions builds Docker images → Artifact Registry → Cloud Run

## Environment Setup

### Backend `.env`
```
GOOGLE_CLOUD_PROJECT=<project-id>
GOOGLE_CLOUD_LOCATION=<region>
GOOGLE_GENAI_USE_VERTEXAI=true
DATABASE_URL=<postgres-connection-string>
```

### Frontend `.env`
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Local development requires `gcloud auth application-default login` for Vertex AI access.
