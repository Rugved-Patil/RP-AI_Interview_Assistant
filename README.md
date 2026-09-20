# RP-AI Interview Assistant

An AI-powered mock interview practice app. Pick a role, get a technical interview question written for it, answer in your own words, and get graded by an LLM with a 0–10 score and specific feedback. Optionally save the report for later. Everything runs locally against free-tier LLM APIs — no paid services.

This is a self-directed learning project (AI coding tools + prompt engineering), built and documented as a CV portfolio piece. Full design rationale and decision history lives in [`RP-AI_Interview_Assistant_Project_Scope.md`](./docs/RP-AI_Interview_Assistant_Project_Scope.md).

> **Status: v0.1.0.** Phase 1 (technical-question practice with presets and saved reports) is complete. The full mock interview and voice mode are planned for v1.0.0.

## Features (current — Phase 1, v0.1.0)

- **Technical questions:** get one AI-generated technical question tailored to your role (and optionally a company and location), answer it in the text box, and get graded right away with a 0–10 score and written feedback. The grader is told the same role/company/location, so the bar it applies fits the role rather than being generic.
- **Interview presets:** save role / company / location combinations, choose which one is active, and edit or delete them on a dedicated Presets page. Only the role is required.
- **Opt-in save:** nothing is stored unless you click "Save this report". Saved reports keep the question, your answer, the score, the feedback, and the role/company/location it was graded against. Browse them most recent first, and delete any you no longer want.
- Text-based only for now. Voice input/output, a full multi-turn mock interview, and a Behavioral mode are planned (see the [Roadmap](#roadmap)).

## How it works

1. You choose an active interview preset. The backend asks the **interviewer** LLM (Groq) for one technical question, using a prompt built from that preset.
2. Your answer is held in memory for the life of that practice attempt.
3. The **grader** LLM (Gemini) scores it with a separate grading prompt, also built from the preset. If the grader's reply can't be parsed, the request fails with a clear error and you can retry — the app never invents a score.
4. Only if you click "Save this report" does anything get written to disk (SQLite).

Both LLM calls go through a provider-agnostic wrapper with shared retry-with-backoff for transient errors such as free-tier rate limits, so providers can be swapped without touching the routes.

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python, FastAPI |
| Frontend | React + TypeScript (Vite) |
| Interviewer LLM | Groq (free tier) |
| Grading LLM | Google Gemini (free tier) |
| Persistence | SQLite via SQLAlchemy |
| Testing | pytest, with fake LLM providers and an in-memory database |

## Project Structure

```text
RP-AI_Interview_Assistant/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── health.py             # GET /health
│   │   │   ├── sessions.py           # POST /sessions/situational, POST /sessions/{id}/answer
│   │   │   ├── grading.py            # POST /sessions/{id}/grade
│   │   │   ├── reports.py            # POST /sessions/{id}/save, GET /reports, DELETE /reports/{id}
│   │   │   └── presets.py            # POST/GET /presets, GET/PUT/DELETE /presets/{id}
│   │   ├── core/
│   │   │   └── config.py             # env-driven settings (API keys, model names, CORS origin)
│   │   ├── db/
│   │   │   ├── base.py               # SQLAlchemy engine/session, Base, init_db()
│   │   │   └── models.py             # SavedReport and InterviewPreset ORM models
│   │   ├── schemas/
│   │   │   ├── session.py            # request/response models for sessions (incl. answer limits)
│   │   │   ├── report.py             # request/response models for saved reports
│   │   │   ├── preset.py             # request/response models for presets
│   │   │   └── personalization.py    # shared role/company/location validation rules
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── base.py           # LLMProvider interface, Message/Role types
│   │   │   │   ├── factory.py        # get_provider(LLMRole) -> the right provider
│   │   │   │   ├── groq_provider.py  # interviewer provider (Groq free tier)
│   │   │   │   ├── gemini_provider.py# grader provider (Gemini free tier)
│   │   │   │   └── retry.py          # shared retry-with-backoff for transient errors
│   │   │   └── session_store.py      # in-memory store for in-progress PracticeSessions
│   │   └── main.py                   # FastAPI app, CORS, router registration
│   ├── scripts/
│   │   └── smoke_test_llm.py         # manual script - hits the real Groq/Gemini APIs
│   ├── tests/
│   │   ├── conftest.py               # in-memory DB + fake LLM providers shared by the tests
│   │   ├── test_llm_wrapper.py       # LLM wrapper / provider behaviour
│   │   ├── test_retry.py             # retry-with-backoff
│   │   ├── test_prompts.py           # interviewer prompt construction
│   │   ├── test_grading.py           # grader route and reply parser
│   │   ├── test_sessions.py          # start-session and submit-answer routes
│   │   ├── test_presets.py           # preset CRUD
│   │   └── test_reports.py           # opt-in save, list, delete
│   ├── .env.example
│   ├── pyproject.toml                # pytest configuration
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── api/
│       │   └── practiceApi.ts             # fetch wrapper for every backend endpoint
│       ├── components/
│       │   ├── PracticeCard.tsx/.css      # technical-question flow (start → answer → grade → save)
│       │   ├── InterviewPresets.tsx/.css  # create / edit / delete presets, choose the active one
│       │   └── SavedReports.tsx/.css      # list + two-step-confirm delete of saved reports
│       ├── pages/
│       │   ├── HomePage.tsx/.css          # mode-selection landing page
│       │   ├── SituationalPracticePage.tsx# hosts the technical-question flow (/practice)
│       │   ├── MockInterviewPage.tsx/.css # Phase 2 placeholder - not built yet
│       │   ├── PresetsPage.tsx            # /presets
│       │   └── SavedReportsPage.tsx       # /reports
│       ├── activePreset.ts                # which preset is active (browser localStorage)
│       ├── App.tsx/.css                   # BrowserRouter + persistent header/nav layout
│       ├── main.tsx
│       └── index.css
│
├── docs/
│   └── RP-AI_Interview_Assistant_Project_Scope.md  # design rationale + decisions log
└── README.md
```

(Standard boilerplate — `tsconfig*.json`, `eslint.config.js`, lockfiles, empty `__init__.py` package markers — is omitted above for readability.)

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20.19+, 22.13+, or 24+ (the Vite and ESLint versions in the lockfile don't support anything older)
- Free API keys from [console.groq.com](https://console.groq.com) and [aistudio.google.com](https://aistudio.google.com)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # Windows: copy .env.example .env
# then edit .env and paste in your real GROQ_API_KEY / GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```

Check it's running at `http://localhost:8000/docs`. The SQLite database file (`interview_reports.db`) is created inside `backend/` the first time the server starts.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### First run

1. Open **Presets** in the header and add a preset. Only the role is required; company and location are optional.
2. Click **Use this** on the preset to make it active.
3. Go back to the home page, open **Technical questions**, and start a practice question.
4. Type your answer, submit it, read the score and feedback, and click **Save this report** if you want to keep it. Saved reports are under **Saved reports** in the header.

## Running Tests

```bash
cd backend
pytest -v
```

The backend suite covers the LLM wrapper and retry logic, prompt construction, grading and its reply parser, sessions, presets, and saved reports. LLM providers and the database are faked, so the tests make no API calls, cost nothing, and never touch your real `interview_reports.db`.

`backend/scripts/smoke_test_llm.py` is a separate, manually-run script that hits the real Groq/Gemini APIs. It is kept out of the automated suite deliberately, because it uses a sliver of real API quota.

The frontend has no automated tests yet. Check it with:

```bash
cd frontend
npm run lint
npm run build     # type-checks with tsc -b, then builds
```

## Troubleshooting

**Getting a `404 model not found` from Groq or Gemini?** This is expected to happen occasionally, not a bug — free-tier providers deprecate, rename, or move models off the free tier over time, and this project has already hit it more than once during development. It's a quick fix:

1. Check the current model lists: [Groq](https://console.groq.com/docs/models) / [Gemini](https://ai.google.dev/gemini-api/docs/models).
2. Update `groq_model` / `gemini_model` in `backend/app/core/config.py`, or override either without touching code by adding `GROQ_MODEL=...` / `GEMINI_MODEL=...` to your `.env`.

**Getting a `502` when starting a question or grading an answer?** Usually a free-tier rate limit or a malformed model reply. Wait a few seconds and retry — your typed answer is kept when grading fails.

**Getting `no such column` from SQLite after updating the code?** The project creates tables with `create_all()` rather than migrations, so it can't alter a table that already exists. Stop the backend and delete `backend/interview_reports.db`; a fresh one is created on the next start. This removes your saved reports and presets.

## Known Limitations

- **In-progress practice sessions live in memory.** Restarting the backend discards any question you haven't finished (saved reports are unaffected). The UI offers "Start over" when this happens.
- **No database migrations.** Schema changes between versions mean deleting the local `.db` file (see Troubleshooting). Alembic is a candidate for when Phase 2 adds mock-interview persistence.
- **Local only.** There is no authentication or hosting setup; it is designed to be cloned and run on your own machine.
- **Free-tier limits.** Rate limits and available models depend on Groq's and Google's current free tiers.

## Roadmap

- **Phase 2 (the v1.0.0 milestone):** full mock interview mode (multi-turn, HR/Technical branching, holistic end-of-interview grading), and voice input/output via the Web Speech API with a text fallback.
- **Behavioral mode:** its own mode, with its own interviewer prompt and a STAR-based grading rubric.
- **Phase 3:** RAG-grounded question generation, and possible stretch goals (adaptive difficulty, deeper answer analysis).

See the [scope document](./docs/RP-AI_Interview_Assistant_Project_Scope.md) for full detail on every decision and trade-off behind this project.