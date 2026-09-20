# RP-AI Interview Assistant — Project Scope

**Status:** Phase 1 (MVP) feature-complete — Technical questions, saved interview presets, and opt-in report saving working end-to-end; versioned **v0.1.0**. v1.0.0 is reserved for the release that includes the Phase 2 features (full mock interview mode). Phase 2 design is in progress — the session model is decided (see 7.1)

**Owner:** AI & Data Science student (personal practice/passion project)

**Last updated:** 2026-09-20 — Phase 2 design started (mock interview gets its own in-memory `InterviewSession`; `PracticeSession` renamed `TechnicalSession`); earlier the same day: release plan changed (Phase 1 = v0.1.0; v1.0.0 reserved for the release that includes Phase 2) and pre-release pass: role/company/location personalization and saved presets; "Situational practice" renamed "Technical questions" (separate modes per category); grader/LLM robustness fixes; saved reports now record their context; answer validation; pinned dependencies; scope doc moved to `docs/` — see Section 7

**Purpose:** A self-directed learning project to improve skills in (a) using AI coding tools effectively (Claude Code) and (b) AI prompt engineering — built by designing and implementing a voice/text-based mock interview practice app. This is not intended as a commercial product; similar products exist, and that's fine — the goal is the learning process, with a working, polished result as a CV portfolio piece.

## 1. Vision

An AI-powered interview practice web app, run locally (cloned from GitHub, not publicly deployed), that lets a user practice for interviews in two ways:

1. **Single-question practice modes** — the user answers one prompt at a time and it is graded individually once they submit. Each question category is its own mode, with its own interviewer prompt and grading rubric. **Technical questions** is the first mode (and the only one in Phase 1), tailored to the user's role; a **Behavioral** mode (e.g., "Tell me about a time…", "Tell me about yourself") is planned as a separate mode later.
2. **Full mock interview mode** — user configures an interview (type: HR or Technical; if Technical, which domain; optionally target company and experience level), and the AI conducts a full back-and-forth conversation as an interviewer, asking natural follow-ups based on the user's answers. At the end, the whole interview is graded holistically with a numeric score and qualitative strengths/weaknesses.

Both kinds of mode are intended to support voice interaction as the primary mode, with a text-based fallback for users without a mic/camera or who prefer typing. Phase 1 is text-only; voice arrives in Phase 2.

## 2. Non-Goals

- Not a commercial product — no monetization, no public deployment/hosting.
- Not training or fine-tuning a custom model — too resource-intensive for this project's purpose.
- Not required to cost anything — hard constraint: $0 budget. Every dependency (LLM API, storage, hosting) must be free.
- Not initially targeting adaptive difficulty, deep NLP answer analysis (filler words, pacing), or company-specific *fine-tuned* personalization — these are explicitly stretch goals, not MVP requirements. (Prompt-level personalization by role/company/location *is* in scope — see 3.4.)

## 3. Core Feature Scope

### 3.1 Practice Modes

- **Technical questions** *(built, Phase 1)*: one AI-generated technical question per attempt — role-specific knowledge or problem-solving, defined broadly enough to also work for non-coding roles — personalized by the user's active interview preset (see 3.7). The user types an answer and submits it; it is graded immediately. Answers are trimmed and must be 1–5,000 characters (enforced by the backend).
- **Behavioral questions** *(planned)*: a separate mode for behavioral prompts (e.g., a single "tell me about a time…" question, or "Tell me about yourself"), with its own interviewer prompt and grading rubric. Deliberately not built as a category selector inside the Technical mode (see 7.1).
- **Full Mock Interview** *(Phase 2)*: user selects interview type (HR / Technical), and if Technical, a domain (e.g., AI/ML engineer, data scientist, general SWE). Optional parameters: target company, experience level. The AI plays interviewer for the full session, asking follow-up questions based on prior answers (not a fixed static question list). Grading happens once at the end of the session, covering the full transcript.

### 3.2 Interaction Modes

- **Voice-based (primary, Phase 2):** browser-native speech-to-text for user answers, text-to-speech for the AI interviewer's questions.
- **Text-based (fallback; the only mode in Phase 1):** manual typing, automatically available if mic access isn't present or the user prefers it. Feature-detected, not a separate "mode" the user has to explicitly pick unless they want to.

### 3.3 Grading

Both a numeric score and qualitative feedback (strengths/weaknesses) are the target.

- Single-question modes: graded per answer — implemented as a single grading call that returns a 0–10 score plus written feedback together. The grading prompt receives the same role/company/location context the question was generated for, so the bar reflects the target role rather than a generic average. If the grader's reply is empty or can't be parsed, the request fails with a 502 and the session stays ungraded (no made-up score); the user can retry.
- Full mock interview: graded holistically at the end from the full transcript, using a separate "grading" prompt distinct from the "interviewer" prompt used during the conversation.

### 3.4 Question Generation

Questions are generated dynamically by an LLM rather than pulled from a fully static bank, personalized via prompt parameters. Phase 1 personalizes by **role** (required) and **company** and **location** (both optional); experience level and HR/Technical domain branching arrive with the full mock interview in Phase 2.

A RAG (Retrieval-Augmented Generation) pipeline is a planned Phase 3 addition: a curated, domain-tagged question bank + vector store (e.g., Chroma or FAISS, both free/local) that the LLM retrieves from before generating a question, to reduce hallucinated/generic questions and better reflect real interview patterns. Not required for MVP — MVP relies on well-designed prompting alone.

### 3.5 Conversation "Memory"

LLM APIs are stateless — memory is implemented by resending the full running transcript (system prompt + all prior Q/A turns) with every request during a mock interview, so the model can generate contextually appropriate follow-ups. Session transcripts should be held server-side (in-memory or SQLite-backed) keyed by a session ID.

Phase 1 already uses this shape in reduced form: a single-question `TechnicalSession` (formerly `PracticeSession`; question, answer, score, feedback, plus the role/company/location it was created for) is held in an in-memory store keyed by session ID. Restarting the backend discards any unfinished session; that's accepted, since nothing is meant to persist unless the user saves it.

**Decided for Phase 2 (2026-09-20):** the full mock interview gets its own `InterviewSession` class (interview configuration, running transcript, status), separate from `TechnicalSession`, and it is held in memory keyed by session ID. Restarting the backend (including auto-reload during development) discards an in-progress interview; that's accepted for now, with SQLite-backed transcripts as an option to revisit later (see 7.2). The exact fields, the lifecycle, and how an interview starts, continues and ends are still to be designed.

### 3.6 Data Persistence

**Resolved & implemented:** Single-session by default — a report is not saved automatically. The user explicitly opts in via a "Save this report" button, which calls `POST /sessions/{id}/save` and persists the report (question, answer, score, feedback, the role/company/location it was graded against, timestamp) to SQLite via SQLAlchemy. Saved reports are retrieved via `GET /reports` and surfaced in the frontend as a "Past reports" list, most recent first, expandable per report, with a two-step inline delete (`DELETE /reports/{id}`).

The tables are created with SQLAlchemy's `create_all()` rather than migrations, which can't alter a table that already exists — so a schema change between versions means deleting the local `.db` file (see 7.2).

### 3.7 Interview Presets *(added 2026-09-20)*

Rather than retyping role/company/location for every question, the user saves them as **presets** (SQLite table `interview_presets`), managed on a dedicated Presets page with full create / edit / delete. One preset is "active" at a time; the practice page shows it read-only, with a link to change it. Which preset is active is stored only in the browser's localStorage, not in the database. Role is required; company and location are optional.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI | Plays to primary language strength; async-friendly for streaming LLM responses; widely used in industry (good CV signal) |
| Frontend | **React + TypeScript (Vite)**, `react-router-dom` for routing, ESLint *(decided)* | Chosen over vanilla HTML/CSS/JS for a more polished CV demo, accepting the added setup overhead as a worthwhile trade-off. TypeScript and ESLint chosen over plain JS for portfolio legibility despite the added friction. A router (rather than manual view-switching) gives real URLs, working back/forward, and room for the mock interview's own route. |
| Voice I/O | Browser Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) | Free, client-side, no extra backend/API cost; naturally supports feature-detected fallback to text. Phase 2. |
| LLM Provider | **Both, split by role** *(decided)*: Groq free tier for the live interviewer conversation; Google AI Studio Gemini (Flash-tier) for grading | Groq offers low-latency inference on open-weight models, well suited to real-time conversational turn-taking. Gemini's Flash-tier models retain a large context window (Pro moved behind a paid tier in 2026), which suits reviewing a full transcript at once for grading. LLM calls sit behind a provider-agnostic wrapper so providers can be swapped if rate limits tighten; both providers retry with backoff on transient 429/5xx failures. Both current default models are reasoning models (see 7.1 and 7.3). |
| Local DB | SQLite, accessed via **SQLAlchemy** *(decided)* | Free, file-based, no server setup, sufficient for single-user local storage of saved reports and presets. SQLAlchemy chosen over SQLModel for broader CV recognizability across the wider Python ecosystem, and because it reinforces separating the DB-row class from the API-schema class — a standard, interview-relevant design pattern given the project's own subject matter. |
| Testing | pytest + pytest-asyncio, with fake LLM providers and an in-memory database | No API calls, no quota, and the tests never touch the real database. Backend only — the frontend has no automated tests yet. |
| Dependencies | Exact versions pinned in `backend/requirements.txt`; frontend locked by the committed `package-lock.json` | A fresh clone should install what was actually tested — free-tier SDKs change quickly. |
| RAG (Phase 3) | Chroma or FAISS (local vector store) + a curated question dataset | Free, runs locally, no hosted vector DB cost |
| Version Control | GitHub | Already in use; also lets the project's build-up be visible over time |

Note on language flexibility: while Python is the primary/preferred language, the user is open to using any language where it makes implementation easier (e.g., JS/TS for the React frontend), and plans to use Claude Code to assist with parts outside their current skillset.

### 4.1 Repository Structure *(decided)*

Single monorepo (not separate repos per component) — simpler for solo maintenance and a cleaner commit history for a CV reviewer.

```text
RP-AI_Interview_Assistant/
├── backend/     # FastAPI app, LLM wrapper, session/grading logic, SQLite, pytest suite
├── frontend/    # React + TypeScript app (Vite)
├── docs/        # This scope doc, ADRs, any design notes
└── README.md
```

GitHub Milestones map to the three Development Phases (Section 6); Issues under each milestone are broken down from that phase's feature bullets.

## 5. Architecture Overview

```text
┌───────────────────────────┐         ┌───────────────────────────┐         ┌──────────────────────┐
│ Frontend (React + TS)     │◄───────►│ Backend (FastAPI)         │◄───────►│ LLM Providers (free) │
│ - Modes, presets, reports │  HTTP   │ - In-memory sessions      │API calls│ - Groq: interviewer  │
│ - Text answer input       │         │ - Prompt construction     │         │ - Gemini: grader     │
│ - (Phase 2) Mic + STT     │         │ - Grading + reply parser  │         │ - Provider-agnostic  │
│ - (Phase 2) TTS output    │         │ - SQLite save (opt-in)    │         │   wrapper + retry    │
│                           │         │ - (Phase 3) RAG retrieval │         │                      │
│                           │         │                           │         │                      │
└───────────────────────────┘         └───────────────────────────┘         └──────────────────────┘
                                                    │
                                                    ▼
                                         ┌─────────────────────┐
                                         │ SQLite (local file) │
                                         │ - saved reports     │
                                         │ - interview presets │
                                         └─────────────────────┘
```

Phase 1 implements everything shown except the parts labelled Phase 2 (voice) and Phase 3 (RAG).

## 6. Development Phases

**Phase 1 — MVP (core loop working end-to-end) — ✅ Feature-complete — v0.1.0**
- Text-based interaction only (voice deferred to Phase 2)
- Single practice mode: **Technical questions**, role-driven — personalized by a required role plus optional company and location taken from a saved interview preset (replaces the original "one domain (AI/DS technical)" framing)
- Interview presets: create/edit/delete on a dedicated Presets page, one active at a time
- LLM calls via provider-agnostic wrapper (Groq for interviewer, Gemini for grading), with retry-with-backoff on transient 429/5xx provider failures
- Per-answer grading: numeric score + qualitative feedback, returned together in one grading call and personalized with the same role/company/location; an unparseable grader reply is a retryable 502, not a fake score
- Answer validation: trimmed, 1–5,000 characters, enforced by the backend
- SQLite persistence for saved reports (opt-in, via SQLAlchemy) — a "Save this report" action, a "Past reports" list with delete, and each report records the role/company/location it was graded against, all wired end-to-end in the frontend
- Multi-page UI (home, Technical questions, Presets, Saved reports, and a Phase 2 placeholder page) with a persistent header
- Backend pytest suite using fake providers and an in-memory database

**Phase 2 — Full Feature Set — design in progress (completing it is the milestone for v1.0.0)**
- Full mock interview mode: multi-turn conversational back-and-forth, HR/Technical branching, domain + company + experience-level personalization — *explicitly confirmed as out of Phase 1 scope (2026-09-15); this is where it lives, and it is the centerpiece of v1.0.0*
- Voice mode via Web Speech API, with automatic text fallback
- Holistic end-of-interview grading (numeric + qualitative) from full transcript
- Behavioral questions mode: its own interviewer prompt and grading rubric (e.g., STAR structure), as a separate mode rather than a category selector — timing relative to the mock interview not yet decided

**Phase 3 — Enhancement Layer — not started**
- RAG pipeline: curated, tagged question bank + vector retrieval to ground question generation
- Possible stretch goals depending on remaining interest/time: adaptive difficulty, deeper answer analysis (filler words, pacing, structure/STAR scoring), expanded domain/company coverage

## 7. Decisions Log

### 7.1 Resolved

**Product & scope**

- **Versioning and release plan** *(revised 2026-09-20)*: Phase 1 is versioned **v0.1.0** (`0.x` = initial development). **v1.0.0 is reserved for the release that includes the Phase 2 features** (full mock interview mode and the rest of Phase 2), not for Phase 1 alone. This supersedes the earlier decision (2026-09-15) that "v1" = Phase 1 MVP only. Full mock interview mode is still not pulled forward into Phase 1 — it stays Phase 2, to be picked up deliberately rather than by drift. Version numbers are kept consistent across the release tag, `frontend/package.json` and the FastAPI app metadata in `backend/app/main.py`.
- **Personalization pulled into Phase 1:** Questions and grading are personalized by role (required), company and location (optional) via prompt parameters — earlier than 3.4's original wording, which tied personalization to the full mock interview. This also replaces the "one domain (AI/DS technical)" framing: Phase 1 is role-driven, not tied to one domain. Grading receives the same context as question generation, rather than judging the question/answer pair in the abstract. Experience level stays in Phase 2.
- **Interview presets:** After trying a blank per-attempt setup form with no memory between questions, the project moved to saved presets — one active at a time, managed on their own Presets page. Sub-decisions: the active selection lives in browser localStorage only (not a "default" flag on the database row); the practice page shows the active preset read-only, with editing only on the Presets page; presets support full create/edit/delete, not just create/delete.
- **Mode split — "Technical questions":** "Situational practice" was renamed "Technical questions" because it only ever produced technical questions (the interviewer prompt opened with "You are a technical interviewer"). The prompt now asks explicitly for a technical question, defined as role-specific knowledge or problem-solving so it also works for non-coding roles. There is no category selector inside one mode: each category (Behavioral next) becomes its own mode, because each needs its own interviewer prompt and grading rubric (correctness for technical, STAR structure for behavioral). The internal names (`/sessions/situational`, `startSituationalSession`, `SituationalPracticePage`) are deliberately unchanged until a second mode decides the endpoint shape. *Update (2026-09-20):* the session class `PracticeSession` has since been renamed `TechnicalSession`, because the mock interview now has its own class and the old name no longer distinguished them; the routes, function and page names above are still unchanged.
- **Multi-page navigation:** `react-router-dom` over manual state-based view switching, for real URLs, working browser back/forward, and future-proofing (the mock interview will want its own route). A persistent header carries the Presets and Saved reports links on every page.

**Phase 2 design** *(started 2026-09-20)*

- **Separate session class for the mock interview:** `InterviewSession` sits beside `TechnicalSession` instead of generalizing one session type with a `kind` field and a list of turns. Reasons: it leaves the working, tested Technical questions mode untouched, and it matches the rule that each mode owns its own prompt and rubric. Cost accepted: some duplicated plumbing between the two classes. Considered and passed on: one generalized session (a single-question practice becoming a one-turn session) — less duplication, but it means refactoring working code and coupling two different grading approaches.
- **In-memory transcripts to start:** the running interview transcript is held in memory, keyed by session ID, like `TechnicalSession`. Cost accepted: a backend restart (including auto-reload in development) loses an in-progress interview. Considered and deferred: SQLite from the start — it would let interviews survive restarts and be resumed, but it pulls the Alembic question forward and blurs the "nothing persists unless the user saves it" rule. It can be added later if wanted (see 7.2).
- **`PracticeSession` renamed `TechnicalSession`:** the class now carries the mode name, since `PracticeSession` was an older name from before the mode split and no longer said what it was. It lives in `backend/app/services/session_store.py`, and that file keeps its name — it is the in-memory session store, not a file named after one class. Pure rename (plus two docstring wording tweaks), no behaviour change and no database change (sessions are in memory). Behavioral mode's session class is not decided yet.

**LLM & backend behaviour**

- **Primary LLM provider(s):** Both, split by role — Groq for the live interviewer conversation (latency-sensitive), Gemini Flash-tier for grading (benefits from large context window over a full transcript).
- **Rate-limit / transient-failure handling:** Retry-with-backoff added to both LLM providers for real transient status codes (429/5xx), verified against actual `groq`/`google-genai` SDK exception shapes.
- **Reasoning models need token headroom:** Both current default models are reasoning models whose hidden thinking tokens count against the same output-token limit as the visible reply, so a limit that is too small returns an empty reply rather than an error. Mitigations: generous `max_tokens` on every call, `reasoning_effort="low"` on Groq and `thinking_level="low"` on Gemini (a constructor argument; `None` disables it), providers returning `""` instead of `None` when nothing visible comes back, and routes treating an empty reply as a 502.
- **Grader failures return a 502, never a made-up score:** An empty or unparseable grader reply returns a 502 and leaves the session ungraded (so saving is correctly refused and a retry can re-grade it), instead of falling back to a score of 0 plus the raw text. A fabricated 0 looks identical to a real one and could be saved as one. The raw reply is logged to help tune the grader prompt.
- **Answer validation in the backend:** Answers are trimmed and must be 1–5,000 characters, enforced in the request schema (and mirrored as the textarea's `maxLength`) so the API doesn't rely on the frontend alone and an accidental huge paste can't eat free-tier quota.

**Data**

- **Persistence scope:** Single-session by default; user opts in to save a report. Implemented end-to-end (backend + frontend).
- **Persistence library:** SQLAlchemy (over SQLModel) — chosen for broader recognizability across the Python ecosystem on a CV, and because it reinforces separating the DB-row class from the API-schema class.
- **Saved reports record their context:** Reports store the role/company/location they were graded against, as plain text copied from the session at save time — a snapshot, not a link to a preset, so editing or deleting a preset later doesn't rewrite history. Because `create_all()` can't add columns to an existing table, the one-time fix was deleting the local `.db` (only a couple of test reports existed); a manual `ALTER TABLE` and Alembic were considered and passed on.
- **Deleting reports:** `DELETE /reports/{id}` keyed on the report's own ID. The UI uses an inline two-step "Delete → Confirm delete" instead of a native `confirm()` popup, and removes the row from local state rather than refetching the list.

**Process & repo**

- **Repo structure / milestones:** Single monorepo (`/backend`, `/frontend`, `/docs`); GitHub Milestones = the three Development Phases, Issues broken down from each phase's feature bullets. This scope document lives in `docs/`.
- **Testing approach:** Backend pytest suite with fake LLM providers and an in-memory SQLite database (shared fixtures in `conftest.py`), so tests never call the real APIs or touch the real database. The frontend has no automated tests; it is checked with `npm run lint` and `npm run build` (the build runs the TypeScript type-check first via `tsc -b`; a bare `tsc --noEmit` checks nothing here, because the root `tsconfig.json` only references the real configs).
- **Reproducible installs:** Backend dependencies are pinned to exact versions in `requirements.txt` (generated from the working virtual environment). The frontend relies on the committed `package-lock.json`; its locked Vite and ESLint versions set the Node requirement (20.19+, 22.13+, or 24+).
- **`.env` safety audit:** Confirmed `.gitignore` covers `.env`; confirmed `.env` is untracked and was never committed at any point in history (checked via `git log --all --full-history -- "**/.env"`, not just the current working tree); confirmed `.env.example` contains only placeholder values, no real keys.

### 7.2 Deferred (intentionally)

- **Exact prompt design** for the "interviewer persona" vs. "grading persona" — not finalized in the abstract; to be iterated on empirically now that there are real graded examples to look back on. First candidates: score spread and consistency across strong/vague/wrong answers, whether the grader's temperature (currently 0.3) is right for the chosen model, and question variety and difficulty on the interviewer side.
- **Database migrations (Alembic):** not adopted — `create_all()` is enough for a single-developer, local-only project. Worth revisiting if Phase 2 ends up persisting mock interviews (see the SQLite-backed transcripts item below).
- **Friendlier UI error messages:** the UI currently shows raw text such as `Request failed (502): {"detail": …}`. Deliberately skipped for v0.1.0.
- **Frontend automated tests:** none yet (see the testing approach in 7.1).
- **Internal "situational" names:** the routes, `startSituationalSession` and `SituationalPracticePage` are left as-is until a second mode decides the endpoint shape (the session class itself was renamed `TechnicalSession` — see 7.1).
- **SQLite-backed interview transcripts:** in-progress mock interviews live in memory for now. Revisit if losing an interview to a backend restart becomes a real annoyance, or when deciding whether finished interviews can be saved; that decision would also reopen the Alembic question.
- **LICENSE:** no license is added yet; the choice is deferred to the v1.0.0 release. Until then the code is "all rights reserved" by default.
- **README screenshot/GIF:** deferred to the v1.0.0 release, when the full feature set can be shown.
- **Project rename:** a simpler name (e.g., "Interview Assistant") was considered and deferred as not important yet.

### 7.3 Ongoing Operational Practices

Unlike 7.1, these aren't one-time decisions with an end state — they're recurring risks that come with depending on free-tier third-party LLM APIs, to be managed for as long as the project does.

- **LLM free-tier model name drift:** `groq_model` and `gemini_model` (in `backend/app/core/config.py`) should be treated as values to periodically re-verify against provider docs, not stable constants. Groq and Google both deprecate, rename, or move models off their free tier, sometimes with little notice — this project has already hit multiple 404s from exactly that during development, requiring both defaults to be updated mid-project. This isn't fixable the way a code bug is: a 404 ("model not found") is a *permanent* failure, not a transient one like a rate limit, so no amount of retry logic (see the resolved item above) helps here — the actual fix is always a human checking the current model list and updating the default, either directly in `config.py` or by overriding via `.env` (`GROQ_MODEL=...` / `GEMINI_MODEL=...`) without touching code. Current docs to check when a 404 appears: https://console.groq.com/docs/models and https://ai.google.dev/gemini-api/docs/models. As of 2026-09-20 the defaults are `openai/gpt-oss-20b` (Groq) and `gemini-3.6-flash` (Gemini).

## 8. Constraints Recap

- **$0 budget** — every service used must have a permanent free tier; no paid APIs, no paid hosting.
- **Local-only** — the app is meant to be cloned and run locally, not deployed/published as a live service.
- **No custom model training** — reliance on prompting existing free-tier LLMs, with RAG (not fine-tuning) as the mechanism for domain-specific grounding.
- **No hard deadline** — this is a passion/practice project; pacing is flexible.