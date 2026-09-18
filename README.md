# RP-AI Interview Assistant

An AI-powered mock interview practice app. Answer a practice question, get graded by an LLM with a numeric score and specific feedback, and optionally save the report for later — all running locally against free-tier LLM APIs.

This is a self-directed learning project (AI coding tools + prompt engineering), built and documented as a CV portfolio piece. Full design rationale and decision history lives in [`RP-AI_Interview_Assistant_Project_Scope.md`](./RP-AI_Interview_Assistant_Project_Scope.md).

## Features (current — Phase 1 / v1)

- **Situational practice:** get one AI-generated interview question, answer it, get graded immediately with a 0–10 score and written feedback.
- **Opt-in save:** keep a graded report to SQLite with one click; browse everything you've saved so far, most recent first.
- Text-based only for now — voice input/output and full multi-turn mock interviews are planned for Phase 2 (see the scope doc).

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Python, FastAPI |
| Frontend | React + TypeScript (Vite) |
| Interviewer LLM | Groq (free tier) |
| Grading LLM | Google Gemini (free tier) |
| Persistence | SQLite via SQLAlchemy |

## Project Structure
├── backend/ # FastAPI app, LLM wrapper, session/grading logic, SQLite<br>
├── frontend/ # React app (Vite)<br>
└── RP-AI_Interview_Assistant_Project_Scope.md<br>

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Free API keys from [console.groq.com](https://console.groq.com) and [aistudio.google.com](https://aistudio.google.com)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env and paste in your real GROQ_API_KEY / GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```

Check it's running at `http://localhost:8000/docs`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Running Tests

```bash
cd backend
pytest tests/ -v
```

These are mocked unit tests for the LLM wrapper — no API calls, no cost. `backend/scripts/smoke_test_llm.py` is a separate, manually-run script that hits the real Groq/Gemini APIs, kept out of the automated test suite deliberately.

## Troubleshooting

**Getting a `404 model not found` from Groq or Gemini?** This is expected to happen occasionally, not a bug — free-tier providers deprecate, rename, or move models off the free tier over time, and this project has already hit it more than once during development. It's a quick fix:

1. Check the current model lists: [Groq](https://console.groq.com/docs/models) / [Gemini](https://ai.google.dev/gemini-api/docs/models).
2. Update `groq_model` / `gemini_model` in `backend/app/core/config.py`, or override either without touching code by adding `GROQ_MODEL=...` / `GEMINI_MODEL=...` to your `.env`.

## Roadmap

- **Phase 2:** full mock interview mode (multi-turn, HR/Technical branching), voice input/output via the Web Speech API, holistic end-of-interview grading.
- **Phase 3:** RAG-grounded question generation, and possible stretch goals (adaptive difficulty, deeper answer analysis).

See the [scope document](./RP-AI_Interview_Assistant_Project_Scope.md) for full detail on every decision and trade-off behind this project.
