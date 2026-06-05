# LLM Logger

A developer tool for monitoring and inspecting LLM inference in real time. Built with React, Redux Toolkit, and [Puter.js](https://puter.com) — no API key required.

![LLM Logger](https://img.shields.io/badge/version-0.0.1-blue) ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)

---

## Overview

LLM Logger is a local web app that wraps Puter's free AI gateway, giving you a clean chat interface while automatically capturing every inference call's metadata: latency, token usage, model, status, and more. Switch between chat, logs, conversations, and a live dashboard — all without setting up a backend or managing API keys.

---

## Features

- **Chat** — Stream responses from 15+ models (GPT-4o, Claude, Gemini, Llama, Grok, Mistral, DeepSeek, and more) with per-message streaming indicators
- **Inference Logs** — Every request is automatically logged with latency, prompt/completion token estimates, status, input/output previews, and request IDs. Filterable by model, status, and search query
- **Conversations** — Full conversation history with resume, cancel, and delete actions
- **Dashboard** — Live metrics including:
  - Total requests, success rate, average latency, total tokens
  - Latency and throughput time-series charts
  - Model usage breakdown (donut chart)
  - Error and token usage trends
  - Recent activity feed
- **PII Redaction** — Optional client-side redaction of emails, phone numbers, SSNs, and card numbers before previews are stored
- **Streaming toggle** — Switch between streaming and non-streaming modes per session
- **Dark / light theme** — System-aware with manual override

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| State | Redux Toolkit 2 |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Charts | Recharts 3 |
| Icons | Lucide React |
| AI Gateway | Puter.js (`@heyputer/puter.js`) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or any compatible package manager

### Install

```bash
npm install
```

### Run (development)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> On first use, Puter.js will prompt you to sign in with a free Puter account. No credit card or API key is needed.

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

---

## Project Structure

```
src/
├── components/
│   ├── chat/               # Chat interface, message bubbles, settings panel
│   ├── conversations/      # Conversation history view
│   ├── dashboard/          # Metrics dashboard with charts
│   ├── layout/             # Sidebar and header
│   ├── logs/               # Inference log viewer with filters
│   └── ui/                 # shadcn/ui primitives
├── helpers/
│   ├── chartHelpers.ts     # Time-series bucketing for charts
│   ├── conversationHelpers.ts  # Status colors and date formatting
│   ├── logHelpers.tsx      # Log status badges and timestamp formatting
│   └── modelHelpers.ts     # Model color palette and label lookup
├── sdk/
│   └── llmSdk.ts           # Puter.js wrapper, PII redaction, log dispatch
├── store/
│   ├── slices/             # Redux slices: conversations, logs, settings, ui
│   ├── hooks.ts            # Typed useAppSelector / useAppDispatch
│   └── index.ts            # Store configuration
└── types/
    └── index.ts            # Shared TypeScript types
```

---

## Supported Models

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

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format all TS/TSX files with Prettier |
| `npm run typecheck` | Run TypeScript compiler check without emitting |

---

## Notes

- Token counts are estimated (4 characters ≈ 1 token) since Puter.js does not yet expose usage data from its SDK
- All data is stored in Redux (in-memory) and resets on page refresh — there is no persistence layer yet
- PII redaction applies to stored previews only; full message content is still sent to the model

---

## DEMO

- VIDEO:- [VIDEO_LINK](https://drive.google.com/file/d/1jPsQOe_GTHGoG6GwqTWY9PSnqoBR6UR0/view?usp=sharing)
