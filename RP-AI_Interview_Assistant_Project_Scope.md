# RP-AI Interview Assistant — Project Scope

**Status:** Phase 1 (MVP) complete — situational practice + opt-in save, working end-to-end
**Owner:** AI & Data Science student (personal practice/passion project)
**Last updated:** 2026-09-15 — Phase 1 complete; persistence library resolved (SQLAlchemy); v1 scope confirmed as Phase 1 only; `.env` safety audit complete; LLM model-name drift documented as an ongoing operational practice — see Section 7

**Purpose:** A self-directed learning project to improve skills in (a) using AI coding tools effectively (Claude Code) and (b) AI prompt engineering — built by designing and implementing a voice/text-based mock interview practice app. This is not intended as a commercial product; similar products exist, and that's fine — the goal is the learning process, with a working, polished result as a CV portfolio piece.

## 1. Vision

An AI-powered interview practice web app, run locally (cloned from GitHub, not publicly deployed), that lets a user practice for interviews in two ways:

1. **Situational practice mode** — user picks a specific situation (e.g., "Tell me about yourself," a single behavioral question, a single technical question) and answers just that one prompt. Graded individually once the user marks the answer as done.
2. **Full mock interview mode** — user configures an interview (type: HR or Technical; if Technical, which domain; optionally target company and experience level), and the AI conducts a full back-and-forth conversation as an interviewer, asking natural follow-ups based on the user's answers. At the end, the whole interview is graded holistically with a numeric score and qualitative strengths/weaknesses.

Both modes support voice interaction as the primary mode, with a text-based fallback for users without a mic/camera or who prefer typing.

## 2. Non-Goals

- Not a commercial product — no monetization, no public deployment/hosting.
- Not training or fine-tuning a custom model — too resource-intensive for this project's purpose.
- Not required to cost anything — hard constraint: $0 budget. Every dependency (LLM API, storage, hosting) must be free.
- Not initially targeting adaptive difficulty, deep NLP answer analysis (filler words, pacing), or company-specific fine-tuned personalization — these are explicitly stretch goals, not MVP requirements.

## 3. Core Feature Scope

### 3.1 Practice Modes

- **Situational Practice:** single question drawn from a specific category (e.g., self-introduction, a single behavioral question, a single technical question). User answers (voice or text) → clicks "Done" → answer is graded immediately.
- **Full Mock Interview:** user selects interview type (HR / Technical), and if Technical, a domain (e.g., AI/ML engineer, data scientist, general SWE). Optional parameters: target company, experience level. The AI plays interviewer for the full session, asking follow-up questions based on prior answers (not a fixed static question list). Grading happens once at the end of the session, covering the full transcript.

### 3.2 Interaction Modes

- **Voice-based (primary):** browser-native speech-to-text for user answers, text-to-speech for the AI interviewer's questions.
- **Text-based (fallback):** manual typing, automatically available if mic access isn't present or the user prefers it. Feature-detected, not a separate "mode" the user has to explicitly pick unless they want to.

### 3.3 Grading

Both a numeric score and qualitative feedback (strengths/weaknesses) are the target.

- Situational practice: graded per answer — implemented as a single grading call that returns numeric score + qualitative feedback together.
- Full mock interview: graded holistically at the end from the full transcript, using a separate "grading" prompt distinct from the "interviewer" prompt used during the conversation.

### 3.4 Question Generation

Questions are generated dynamically by an LLM rather than pulled from a fully static bank, personalized by domain/company/experience level via prompt parameters.

A RAG (Retrieval-Augmented Generation) pipeline is a planned v2 addition: a curated, domain-tagged question bank + vector store (e.g., Chroma or FAISS, both free/local) that the LLM retrieves from before generating a question, to reduce hallucinated/generic questions and better reflect real interview patterns. Not required for MVP — MVP relies on well-designed prompting alone.

### 3.5 Conversation "Memory"

LLM APIs are stateless — memory is implemented by resending the full running transcript (system prompt + all prior Q/A turns) with every request during a mock interview, so the model can generate contextually appropriate follow-ups. Session transcripts should be held server-side (in-memory or SQLite-backed) keyed by a session ID.

### 3.6 Data Persistence

**Resolved & implemented:** Single-session by default — a report is not saved automatically. The user explicitly opts in via a "Save this report" button, which calls `POST /sessions/{id}/save` and persists the report (question, answer, score, feedback, timestamp) to SQLite via SQLAlchemy. Saved reports are retrieved via `GET /reports` and surfaced in the frontend as a "Past reports" list, most recent first, expandable per report.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI | Plays to primary language strength; async-friendly for streaming LLM responses; widely used in industry (good CV signal) |
| Frontend | **React** *(decided)* | Chosen over vanilla HTML/CSS/JS for a more polished CV demo, accepting the added setup overhead as a worthwhile trade-off |
| Voice I/O | Browser Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) | Free, client-side, no extra backend/API cost; naturally supports feature-detected fallback to text |
| LLM Provider | **Both, split by role** *(decided)*: Groq free tier for the live interviewer conversation; Google AI Studio Gemini (Flash-tier) for grading | Groq offers low-latency inference on open-weight models, well suited to real-time conversational turn-taking. Gemini's Flash-tier models retain a large context window (Pro moved behind a paid tier in 2026), which suits reviewing a full transcript at once for grading. LLM calls sit behind a provider-agnostic wrapper so providers can be swapped if rate limits tighten; both providers retry with backoff on transient 429/5xx failures. |
| Local DB | SQLite, accessed via **SQLAlchemy** *(decided)* | Free, file-based, no server setup, sufficient for single-user local storage of past reports. SQLAlchemy chosen over SQLModel for broader CV recognizability across the wider Python ecosystem, and because it reinforces separating the DB-row class from the API-schema class — a standard, interview-relevant design pattern given the project's own subject matter. |
| RAG (v2) | Chroma or FAISS (local vector store) + a curated question dataset | Free, runs locally, no hosted vector DB cost |
| Version Control | GitHub | Already in use; also lets the project's build-up be visible over time |

Note on language flexibility: while Python is the primary/preferred language, the user is open to using any language where it makes implementation easier (e.g., JS/TS for the React frontend), and plans to use Claude Code to assist with parts outside their current skillset.

### 4.1 Repository Structure *(decided)*

Single monorepo (not separate repos per component) — simpler for solo maintenance and a cleaner commit history for a CV reviewer.

rp-ai-interview-assistant/
├── backend/ # FastAPI app, LLM wrapper, session/grading logic, SQLite
├── frontend/ # React app (Vite)
├── docs/ # This scope doc, ADRs, any design notes
└── README.md


GitHub Milestones map to the three Development Phases (Section 6); Issues under each milestone are broken down from that phase's feature bullets.

## 5. Architecture Overview

┌───────────────────────────┐         ┌────────────────────────────┐          ┌────────────────────────┐
│ Frontend (React)          │ ◄──────►│ Backend (Python/FastAPI)   │ ◄──────► │ LLM Provider           │
│ - Mic capture             │   HTTP/ │ - Session/transcript mgmt. │    API   │ (Gemini / Groq free)   │
│ (Web Speech API STT)      │    WS   │ - Prompt construction      │   calls  │ - Interviewer persona  │
│ - TTS playback            │         │ - Grading logic            │          │ - Grading persona      │
│ - Mode selection UI       │         │ - SQLite persistence       │          └────────────────────────┘
└───────────────────────────┘         │ - (v2) RAG retrieval layer │
                                      └────────────────────────────┘
             │
             ▼
     ┌───────────────┐
     │    SQLite     │
     │  (local file) │
     └───────────────┘


## 6. Development Phases

**Phase 1 — MVP (core loop working end-to-end) — ✅ Complete**
- Text-based interaction only (voice deferred to Phase 2)
- Single practice mode: situational practice, one domain (AI/DS technical)
- LLM call via provider-agnostic wrapper (Groq for interviewer, Gemini for grading), with retry-with-backoff on transient 429/5xx provider failures
- Per-answer grading: numeric score + qualitative feedback, returned together in one grading call
- SQLite persistence for saved reports (opt-in, via SQLAlchemy) — a "Save this report" action and a "Past reports" list, both wired end-to-end in the frontend

**Phase 2 — Full Feature Set — not started**
- Full mock interview mode: multi-turn conversational back-and-forth, HR/Technical branching, domain + company + experience-level personalization — *explicitly confirmed as out of v1/Phase 1 scope (2026-09-15); this is where it lives*
- Voice mode via Web Speech API, with automatic text fallback
- Holistic end-of-interview grading (numeric + qualitative) from full transcript

**Phase 3 — Enhancement Layer — not started**
- RAG pipeline: curated, tagged question bank + vector retrieval to ground question generation
- Possible stretch goals depending on remaining interest/time: adaptive difficulty, deeper answer analysis (filler words, pacing, structure/STAR scoring), expanded domain/company coverage

## 7. Decisions Log

### 7.1 Resolved

- **Frontend framework:** React (over plain HTML/CSS/JS).
- **Persistence scope:** Single-session by default; user opts in to save a report. Implemented end-to-end (backend + frontend).
- **Persistence library:** SQLAlchemy (over SQLModel) — chosen for broader recognizability across the Python ecosystem on a CV, and because it reinforces separating the DB-row class from the API-schema class.
- **Primary LLM provider(s):** Both, split by role — Groq for the live interviewer conversation (latency-sensitive), Gemini Flash-tier for grading (benefits from large context window over a full transcript).
- **Rate-limit / transient-failure handling:** Retry-with-backoff added to both LLM providers for real transient status codes (429/5xx), verified against actual `groq`/`google-genai` SDK exception shapes.
- **`.env` safety audit:** Confirmed `.gitignore` covers `.env`; confirmed `.env` is untracked and was never committed at any point in history (checked via `git log --all --full-history -- "**/.env"`, not just the current working tree); confirmed `.env.example` contains only placeholder values, no real keys.
- **Repo structure / milestones:** Single monorepo (`/backend`, `/frontend`, `/docs`); GitHub Milestones = the three Development Phases, Issues broken down from each phase's feature bullets.
- **v1 scope:** Confirmed "v1" = Phase 1 MVP only (situational practice + opt-in save). Full mock interview mode is not pulled forward into v1 — it stays Phase 2, to be picked up deliberately rather than by drift.

### 7.2 Deferred (intentionally)

- **Exact prompt design** for the "interviewer persona" vs. "grading persona" — not finalized in the abstract; to be iterated on empirically now that there are real graded examples to look back on.

### 7.3 Ongoing Operational Practices

Unlike 7.1, these aren't one-time decisions with an end state — they're recurring risks that come with depending on free-tier third-party LLM APIs, to be managed for as long as the project does.

- **LLM free-tier model name drift:** `groq_model` and `gemini_model` (in `backend/app/core/config.py`) should be treated as values to periodically re-verify against provider docs, not stable constants. Groq and Google both deprecate, rename, or move models off their free tier, sometimes with little notice — this project has already hit multiple 404s from exactly that during development, requiring both defaults to be updated mid-project. This isn't fixable the way a code bug is: a 404 ("model not found") is a *permanent* failure, not a transient one like a rate limit, so no amount of retry logic (see the resolved item above) helps here — the actual fix is always a human checking the current model list and updating the default, either directly in `config.py` or by overriding via `.env` (`GROQ_MODEL=...` / `GEMINI_MODEL=...`) without touching code. Current docs to check when a 404 appears: https://console.groq.com/docs/models and https://ai.google.dev/gemini-api/docs/models.

## 8. Constraints Recap

- **$0 budget** — every service used must have a permanent free tier; no paid APIs, no paid hosting.
- **Local-only** — the app is meant to be cloned and run locally, not deployed/published as a live service.
- **No custom model training** — reliance on prompting existing free-tier LLMs, with RAG (not fine-tuning) as the mechanism for domain-specific grounding.
- **No hard deadline** — this is a passion/practice project; pacing is flexible.
