# RP-AI Interview Assistant — Project Scope Document

**Status:** Planning / Pre-development
**Owner:** AI & Data Science student (personal practice/passion project)
**Purpose:** A self-directed learning project to improve skills in (a) using AI coding tools effectively (Claude Code) and (b) AI prompt engineering — built by designing and implementing a voice/text-based mock interview practice app. This is **not** intended as a commercial product; similar products exist, and that's fine — the goal is the learning process, with a working, polished result as a CV portfolio piece.

---

## 1. Vision

An AI-powered interview practice web app, run locally (cloned from GitHub, not publicly deployed), that lets a user practice for interviews in two ways:

1. **Situational practice mode** — user picks a specific situation (e.g., "Tell me about yourself," a single behavioral question, a single technical question) and answers just that one prompt. Graded individually once the user marks the answer as done.
2. **Full mock interview mode** — user configures an interview (type: HR or Technical; if Technical, which domain; optionally target company and experience level), and the AI conducts a full back-and-forth conversation as an interviewer, asking natural follow-ups based on the user's answers. At the end, the whole interview is graded holistically with a numeric score and qualitative strengths/weaknesses.

Both modes support **voice interaction as the primary mode**, with a **text-based fallback** for users without a mic/camera or who prefer typing.

---

## 2. Non-Goals

- Not a commercial product — no monetization, no public deployment/hosting.
- Not training or fine-tuning a custom model — too resource-intensive for this project's purpose.
- Not required to cost anything — **hard constraint: $0 budget.** Every dependency (LLM API, storage, hosting) must be free.
- Not initially targeting adaptive difficulty, deep NLP answer analysis (filler words, pacing), or company-specific fine-tuned personalization — these are explicitly stretch goals, not MVP requirements.

---

## 3. Core Feature Scope

### 3.1 Practice Modes
- **Situational Practice**: single question drawn from a specific category (e.g., self-introduction, a single behavioral question, a single technical question). User answers (voice or text) → clicks "Done" → answer is graded immediately.
- **Full Mock Interview**: user selects interview type (HR / Technical), and if Technical, a domain (e.g., AI/ML engineer, data scientist, general SWE). Optional parameters: target company, experience level. The AI plays interviewer for the full session, asking follow-up questions based on prior answers (not a fixed static question list). Grading happens once at the end of the session, covering the full transcript.

### 3.2 Interaction Modes
- **Voice-based (primary)**: browser-native speech-to-text for user answers, text-to-speech for the AI interviewer's questions.
- **Text-based (fallback)**: manual typing, automatically available if mic access isn't present or the user prefers it. Feature-detected, not a separate "mode" the user has to explicitly pick unless they want to.

### 3.3 Grading
- **Both a numeric score and qualitative feedback** (strengths/weaknesses) are the target — can be implemented incrementally (numeric first, qualitative added after, or both together).
- Situational practice: graded per answer.
- Full mock interview: graded holistically at the end from the full transcript, using a separate "grading" prompt distinct from the "interviewer" prompt used during the conversation.

### 3.4 Question Generation
- Questions are generated dynamically by an LLM rather than pulled from a fully static bank, personalized by domain/company/experience level via prompt parameters.
- A **RAG (Retrieval-Augmented Generation) pipeline** is a planned v2 addition: a curated, domain-tagged question bank + vector store (e.g., Chroma or FAISS, both free/local) that the LLM retrieves from before generating a question, to reduce hallucinated/generic questions and better reflect real interview patterns. Not required for MVP — MVP relies on well-designed prompting alone.

### 3.5 Conversation "Memory"
LLM APIs are stateless — memory is implemented by resending the full running transcript (`system prompt + all prior Q/A turns`) with every request during a mock interview, so the model can generate contextually appropriate follow-ups. Session transcripts should be held server-side (in-memory or SQLite-backed) keyed by a session ID.

### 3.6 Data Persistence
- Local storage of past mock interview reports (scores + feedback) is a desired feature; likely implemented via **SQLite** (free, zero-setup, file-based).
- Exact scope (persist every report vs. single-session only) is still to be finalized — see Open Decisions.

---

## 4. Tech Stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Backend | Python + FastAPI | Plays to primary language strength; async-friendly for streaming LLM responses; widely used in industry (good CV signal) |
| Frontend | HTML/CSS/JS, or React (open decision) | User is not committed to a frontend framework; React would look more polished for a CV demo but adds setup overhead. Vanilla JS is simpler and keeps more of the code in Python-adjacent territory. |
| Voice I/O | Browser Web Speech API (`SpeechRecognition` + `SpeechSynthesis`) | Free, client-side, no extra backend/API cost; naturally supports feature-detected fallback to text |
| LLM Provider | Google AI Studio (Gemini free tier) and/or Groq free tier | Both have usable permanent free tiers as of 2026; Gemini offers a large context window and multimodal input; Groq offers high-speed inference on open-weight models, useful for conversational latency. LLM calls should sit behind a provider-agnostic wrapper so providers can be swapped if rate limits tighten. |
| Local DB | SQLite | Free, file-based, no server setup, sufficient for single-user local storage of past reports |
| RAG (v2) | Chroma or FAISS (local vector store) + a curated question dataset | Free, runs locally, no hosted vector DB cost |
| Version Control | GitHub | Already in use; also lets the project's build-up be visible over time |

**Note on language flexibility:** while Python is the primary/preferred language, the user is open to using any language where it makes implementation easier (e.g., JS/TS for frontend), and plans to use Claude Code to assist with parts outside their current skillset.

---

## 5. Architecture Overview

```
┌─────────────────────────┐        ┌──────────────────────────┐        ┌───────────────────────┐
│        Frontend         │        │         Backend          │        │      LLM Provider      │
│  (HTML/JS or React)     │◄──────►│      (Python/FastAPI)     │◄──────►│  (Gemini / Groq free)   │
│  - Mic capture (Web      │  HTTP/  │  - Session/transcript mgmt│  API    │  - Interviewer persona  │
│    Speech API STT)       │  WS     │  - Prompt construction    │  calls  │  - Grading persona      │
│  - TTS playback           │        │  - Grading logic           │        │                        │
│  - Mode selection UI      │        │  - SQLite persistence       │        └───────────────────────┘
└─────────────────────────┘        │  - (v2) RAG retrieval layer │
                                     └──────────────────────────┘
                                                  │
                                                  ▼
                                          ┌───────────────┐
                                          │    SQLite      │
                                          │  (local file)  │
                                          └───────────────┘
```

---

## 6. Development Phases

### Phase 1 — MVP (core loop working end-to-end)
- Text-based interaction only (voice deferred to Phase 2)
- Single practice mode: situational practice, one domain (AI/DS technical)
- LLM call via provider-agnostic wrapper (Gemini or Groq free tier)
- Per-answer grading: numeric score first, qualitative feedback added once that works
- SQLite persistence for saved reports

### Phase 2 — Full Feature Set
- Full mock interview mode: multi-turn conversational back-and-forth, HR/Technical branching, domain + company + experience-level personalization
- Voice mode via Web Speech API, with automatic text fallback
- Holistic end-of-interview grading (numeric + qualitative) from full transcript

### Phase 3 — Enhancement Layer
- RAG pipeline: curated, tagged question bank + vector retrieval to ground question generation
- Possible stretch goals depending on remaining interest/time: adaptive difficulty, deeper answer analysis (filler words, pacing, structure/STAR scoring), expanded domain/company coverage

---

## 7. Open Decisions (to be finalized during development)

- Frontend framework: plain HTML/CSS/JS vs. React
- Persistence scope: save every mock interview report by default, or keep single-session unless the user opts in to saving
- Exact prompt design for the "interviewer persona" vs. "grading persona" (to be iterated on empirically)
- Final choice of primary LLM provider (Gemini vs. Groq vs. using both for different purposes, e.g., Groq for low-latency conversation, Gemini for grading/long-context tasks)
- Repo structure and milestone/issue breakdown on GitHub

---

## 8. Constraints Recap

- **$0 budget** — every service used must have a permanent free tier; no paid APIs, no paid hosting.
- **Local-only** — the app is meant to be cloned and run locally, not deployed/published as a live service.
- **No custom model training** — reliance on prompting existing free-tier LLMs, with RAG (not fine-tuning) as the mechanism for domain-specific grounding.
- **No hard deadline** — this is a passion/practice project; pacing is flexible.
