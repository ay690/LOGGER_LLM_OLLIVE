# LLM Logger

A full-stack developer tool for monitoring LLM inference in real time. Chat with 15+ models through a clean interface while every request — latency, tokens, status, previews — is automatically captured, persisted to MongoDB, and visualised on a live dashboard.

![version](https://img.shields.io/badge/version-0.0.1-blue)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb)

---

## What it does

- **Chat** — stream responses from 15+ models (GPT-4o, Claude, Gemini, Llama, Grok, Mistral, DeepSeek) via [Puter.js](https://puter.com) — no API key needed
- **Inference Logs** — every request is logged automatically: latency, prompt/completion token estimates, status, input/output previews, request IDs; filterable and paginated
- **Conversations** — full history persisted to MongoDB; resume, cancel, or delete any conversation
- **Dashboard** — live metrics aggregated server-side: success rate, avg latency, total tokens, per-minute time-series charts, model breakdown
- **PII Redaction** — optional client-side scrub of emails, phones, SSNs, card numbers before previews are stored
- **Settings persistence** — model choice, streaming toggle, and PII toggle survive page refresh (stored in MongoDB)

---

## DEMO

- Video: [Youtube](https://youtu.be/WLGwKVZgCjc)

## Repository layout

```
logger_llm/
├── client/          # React + Vite SPA
├── server/          # Express + MongoDB ingestion API
├── README.md
└── ARCHITECTURE.md
```

---

## Tech stack

### Client
| | |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| State | Redux Toolkit 2 |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| Charts | Recharts 3 |
| AI gateway | Puter.js (`@heyputer/puter.js`) |

### Server
| | |
|---|---|
| Runtime | Node.js (CommonJS) |
| Framework | Express 4 |
| Database | MongoDB via Mongoose 8 |
| Validation | Zod 3 |
| Dev server | ts-node-dev |

---

## Getting started

### Prerequisites

- Node.js 18+
- A running MongoDB instance (local or Atlas)

### 1. Start the backend

```bash
cd server
npm install
```

Create `server/.env`:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/?appName=Cluster0
PORT=3001
NODE_ENV=development
```

```bash
npm run dev
```

The API will be available at `http://localhost:3001/api`.

### 2. Start the frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> On first use Puter.js will prompt you to sign in with a free Puter account. No credit card or API key required.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/api/conversations` | List all conversations (no message body, includes `messageCount`) |
| `POST` | `/api/conversations` | Create a conversation |
| `GET` | `/api/conversations/:id` | Fetch a conversation with all messages |
| `POST` | `/api/conversations/:id/messages` | Append a message |
| `PATCH` | `/api/conversations/:id/status` | Update status (`active` / `cancelled` / `completed`) |
| `DELETE` | `/api/conversations/:id` | Delete a conversation |
| `POST` | `/api/logs` | Ingest a single inference log (idempotent via `requestId`) |
| `POST` | `/api/logs/batch` | Ingest up to 50 logs at once |
| `GET` | `/api/logs` | Paginated log list (`?model=`, `?status=`, `?search=`, `?page=`, `?limit=`) |
| `GET` | `/api/logs/stats` | Aggregated dashboard metrics (`?since=` ISO timestamp) |
| `GET` | `/api/logs/:id` | Fetch a single log |
| `GET` | `/api/settings` | Get user settings (auto-creates defaults) |
| `PATCH` | `/api/settings` | Update settings (partial) |

---

## Available scripts

### Client (`client/`)

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier on all TS/TSX files |
| `npm run typecheck` | TypeScript check without emit |

### Server (`server/`)

| Command | Description |
|---|---|
| `npm run dev` | ts-node-dev with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |

---

## Supported models

All models are proxied through Puter's free AI gateway:

| Provider | Models |
|---|---|
| OpenAI | GPT-4o mini, GPT-4o, GPT-4.1, o4-mini |
| Anthropic | Claude Sonnet 4.5, Claude Haiku 3.5 |
| Google | Gemini 2.0 Flash, Gemini 1.5 Pro |
| Meta | Llama 3.3 70B Instruct |
| xAI | Grok 3, Grok 3 Mini |
| Mistral | Mistral Large, Mistral Small |
| DeepSeek | DeepSeek R1, DeepSeek V3 |

---

## Notes

- Token counts are estimated (4 chars ≈ 1 token) — Puter.js does not yet expose usage data from its SDK
- PII redaction applies to stored previews only; full message content is sent to the model
- The `Provider` type is designed for future expansion; only `"puter"` is implemented today
- Streaming abort uses the browser `AbortController`; mid-stream cancellation behaviour depends on the underlying model

