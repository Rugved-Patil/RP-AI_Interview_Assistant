# RP-AI Interview Assistant — Project Scope

**Status:** **v0.5.0 Release** — Feature-complete across Phases 1, 2, 3, and 4. Implements Full Multi-Turn Mock Interviews (Technical & Behavioral/HR), Single Practice Drills (Technical & STAR), Grounded Offline RAG Question Bank, 5-Dimensional Evidence-Based Diagnostic Grader, Lifetime Analytics & Score Trajectory, Unified Saved Reports Repository with Smart Search, Native Voice (STT/TTS), and the Organic Linen & Olive Design System. Phase 5 (Live Coding Sandbox, PDF Export) is scheduled for the upcoming v1.0.0 release.

**Owner:** AI & Data Science student (personal practice/portfolio project)

**Last updated:** 2026-10-01 — v0.5.0 release preparation: unified reports and analytics, minimalist symbol-first voice controls, calibrated 5-dimension diagnostic grading, and theme engine finalized.

**Purpose:** A self-directed learning project to demonstrate proficiency in (a) building production-grade full-stack AI applications, (b) advanced prompt engineering and evidence-based diagnostic rubrics, (c) local offline RAG architectures with zero paid dependencies, and (d) clean, modern UI/UX design.

---

## 1. Vision

An AI-powered interview practice platform, run locally (cloned from GitHub, $0 budget), providing two main practice modes:

1. **Single-Question Practice Drills**:
   - **Technical Questions**: Tailored, role-specific problem-solving questions with immediate per-answer grading.
   - **Behavioral (STAR) Questions**: Behavioral situational drills evaluated strictly against the **STAR** (Situation, Task, Action, Result) methodology.
2. **Full Multi-Turn Mock Interviews**:
   - Realistic conversational interview simulation across **Technical** (SWE, ML/AI, Backend, Frontend, System Design) and **Behavioral/HR** tracks.
   - Dynamic follow-ups and candidate-driven conversational turns.
   - End-of-interview holistic diagnostic assessment with 5 calibrated dimension scores.

Both practice formats support browser-native voice interaction (STT speech recognition and natural TTS speech synthesis) with seamless text fallbacks.

---

## 2. Non-Goals

- **Not a commercial product**: No subscription paywalls, no proprietary cloud hosting required.
- **Not training/fine-tuning models**: Avoids resource-heavy custom model training by leveraging prompt engineering and local RAG grounding.
- **Zero API or infrastructure costs**: Hard constraint of **\$0 budget**. Uses permanent free-tier LLM providers (Groq and Google Gemini) and local SQLite/pure Python vector storage.
- **No reliance on external hosted vector databases**: Vector indexing and similarity search are performed locally in pure Python.

---

## 3. Core Feature Scope

### 3.1 Practice Modes
- **Technical Questions Drill (Phase 1)**: Single AI-generated technical questions tailored to target role, company, and location with instant feedback.
- **Behavioral STAR Drill (Phase 2)**: Dedicated single-question behavioral drills evaluated on STAR structure.
- **Full Mock Interview (Phase 2)**: Conversational multi-turn interviews with dynamic follow-ups, seniority calibration (*Fresher, Mid-Level, Senior, Lead*), and track branching (*Technical* vs *Behavioral/HR*).

### 3.2 Interaction Modes
- **Voice-Based (Primary)**: Browser-native Speech-to-Text (STT) for candidate responses and Text-to-Speech (TTS) for interviewer audio playback.
- **Text-Based (Fallback)**: Seamless typing interface for users without microphone access.

### 3.3 Diagnostic Assessment & Grading
- **Single Drills**: Immediate 0–10 numeric score with qualitative strengths, weaknesses, and model answers.
- **Holistic 5-Dimension Diagnostic Engine (Phase 4)**: Evaluates multi-turn mock interviews across 5 distinct dimensions (0–10 each):
  1. `technical_correctness`: Factual accuracy and technical validity.
  2. `depth_of_knowledge`: Comprehension of mechanisms, trade-offs, and edge cases.
  3. `problem_solving`: Problem decomposition, constraint evaluation, and adaptive reasoning.
  4. `communication`: Structure, clarity, conciseness, and articulation.
  5. `practical_readiness`: Production viability and implementation readiness.
- **Evidence-Based Feedback**: Direct citations of candidate transcript statements to substantiate all scores and recommendations.

### 3.4 Question Generation & Offline RAG (Phase 3)
- Grounded generation via an offline local RAG engine.
- 100+ curated industry-standard exemplar questions across 7 core domains.
- Pure Python TF-IDF + BM25 vector index with n-gram tokenization and $L_2$-normalized cosine similarity.
- Interactive **Question Bank Explorer** for browsing, searching, and inspecting evaluation rubrics.

### 3.5 Conversation Memory & Session Stores
- **In-Memory Session Architecture**:
  - `TechnicalSession`: Single-attempt technical and behavioral drills.
  - `InterviewSession`: Multi-turn conversational mock interviews with turn-by-turn history.
- Context window management resending relevant transcript turns to maintain coherence without token exhaustion.

### 3.6 Data Persistence & History
- **Opt-In Report Storage**: Sessions are only saved when explicitly requested by the user, storing full transcripts, scores, and metadata in local SQLite via SQLAlchemy.
- **Unified Reports Management**: Filterable by drill type, role, company, and score with prioritized multi-field keyword search and safe deletion.

### 3.7 Lifetime Analytics (Phase 4)
- Aggregated KPIs: Total interviews completed, overall average score, time spent, top strengths, and focus areas.
- Interactive score trajectory timeline and domain competency radar charts.
- Combined view across Mock Interviews and Single Practice Drills with toggleable filters.

### 3.8 Design System & UX (Phase 4)
- **Organic Linen & Olive Aesthetic**: Realistic woven fabric texture canvas with 8 selectable themes.
- **Collapsible Right-Hand Navigation**: Space-efficient drawer navigation.
- **Minimalist Symbol-First Voice Controls**: Icon-first controls with audio wave indicators.
- **Empty-State Onboarding**: Guided setup prompt for first-time users.

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 | Async execution, type safety, automatic OpenAPI documentation |
| **Frontend** | React 19, TypeScript, Vite, React Router v7 | Type safety, component modularity, instant hot reloading |
| **Interviewer LLM** | Groq (`openai/gpt-oss-20b` or Llama 3) | Low-latency inference for conversational turns |
| **Grading LLM** | Google Gemini (`gemini-3.6-flash`) | Large context window for holistic transcript evaluation |
| **RAG Engine** | Pure Python TF-IDF + BM25 Vector Store | Offline, zero-dependency, $0 cost |
| **Database** | SQLite via SQLAlchemy ORM | Lightweight, zero-config local persistence |
| **Voice I/O** | Web Speech API | Client-side STT dictation and TTS playback |
| **Testing** | pytest, pytest-asyncio (211 tests) | Complete backend test coverage with mock providers |

---

## 5. Architecture Overview

```text
┌────────────────────────────────────────────────────────┐
│               Frontend (React + TypeScript)            │
│  - Multi-Turn Mock & Single Practice Drills (Tech/STAR)│
│  - Question Bank Explorer & RAG Search                 │
│  - Lifetime Analytics & Score Trajectory               │
│  - Unified Reports Drawer & Filter Modal               │
│  - Web Speech API (STT Voice Input / TTS Playback)     │
│  - Theme Engine (8 Palettes + Linen Canvas Texture)    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON
                            ▼
┌────────────────────────────────────────────────────────┐
│                  Backend (FastAPI)                     │
│  ├── API Routes: sessions, interviews, grading,       │
│  │               reports, presets, questions, analytics │
│  ├── In-Memory Stores: Technical & Mock Sessions       │
│  ├── Local Offline RAG Engine (TF-IDF / BM25)          │
│  ├── Provider-Agnostic LLM Wrapper & Retry Backoff     │
│  └── SQLite Database (SQLAlchemy ORM)                  │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────┐  ┌──────────────────────┐
│       LLM Providers          │  │ SQLite Local Storage │
│ - Groq: Real-time turn engine│  │ - Saved Reports      │
│ - Gemini: Diagnostic grader  │  │ - Interview Presets  │
└──────────────────────────────┘  └──────────────────────┘
```

---

## 6. Development Phases & Milestone Status

### Phase 1 — MVP Core Loop (v0.1.0) — ✅ Completed
- Technical questions single-drill mode with instant grading.
- Interview presets CRUD (role, company, location).
- Provider-agnostic LLM client with retry-with-backoff.
- Opt-in SQLite report saving.

### Phase 2 — Conversational Mocks & Voice (v0.2.0 - v0.3.0) — ✅ Completed
- Full multi-turn conversational mock interview engine.
- Dedicated Behavioral (STAR) practice mode.
- Browser-native STT and TTS voice integration.
- Track selection (Technical vs Behavioral/HR) and seniority calibration.

### Phase 3 — Local RAG & Question Bank (v0.4.0) — ✅ Completed
- Curated question bank (100+ exemplars across 7 domains).
- Pure Python offline TF-IDF/BM25 vector search engine.
- Grounded question generation pipeline.
- Interactive Question Bank Explorer.

### Phase 4 — Diagnostic Grading & Analytics (v0.5.0) — ✅ Completed
- Evidence-based holistic diagnostic grader with 5 calibrated dimension scores.
- Lifetime progress analytics, score trajectories, and domain breakdowns.
- Unified saved reports repository with prioritized keyword search and filters.
- Organic Linen & Olive design system with 8 theme palettes and canvas fabric textures.
- Minimalist symbol-first voice UI.

### Phase 5 — Interactive Coding & Export Engine (v1.0.0 Target) — ⏳ Scheduled
- In-browser live coding editor and sandbox for interactive coding interviews.
- Exportable, beautifully formatted PDF report cards.
- Targeted weak-spot practice recommendations linked directly to question bank drills.

---

## 7. Decisions Log

### 7.1 Resolved Architectural Decisions

1. **Local-Only Offline RAG**: Built a pure Python TF-IDF + BM25 vector retrieval engine instead of relying on external hosted vector databases. This keeps memory footprints minimal, guarantees zero cloud setup, and preserves the $0 budget constraint.
2. **Provider-Agnostic LLM Abstraction**: Separated LLM provider implementations (Groq and Gemini) behind a shared interface with exponential backoff for transient rate limits (429/5xx).
3. **Calibrated 5-Dimension Diagnostic Rubric**: Standardized holistic grading across 5 discrete dimensions (`technical_correctness`, `depth_of_knowledge`, `problem_solving`, `communication`, `practical_readiness`) with mandatory transcript citations, replacing subjective or generic feedback.
4. **Unified Saved Reports & Analytics**: Merged single drills and multi-turn mock interviews into unified views with multi-criteria filtering, allowing candidates to view holistic progress without fragmenting data.
5. **Symbol-First Minimalist Voice UI**: Replaced raw text buttons with modern SVG icon-only controls and subtle audio wave animations, maximizing visual focus during interview practice.

---

## 8. Constraints & Operating Principles

- **\$0 Budget**: Permanent reliance on free-tier APIs and local execution.
- **Local Machine Deployment**: Completely self-contained for local cloning and execution.
- **High Test Quality**: Strict maintenance of 100% backend test pass rate and clean frontend builds.
- **Maintainable Architecture**: Clear separation of concerns between API routers, domain services, RAG vector spaces, and database schemas.