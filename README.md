# RP-AI Interview Assistant

An AI-powered interview practice platform built for high-signal technical and behavioral interview preparation. Practice full multi-turn conversational mock interviews or targeted single drills, grounded in industry-standard questions via an offline local RAG engine, with instant 5-dimensional diagnostic grading, lifetime progress analytics, voice interaction, and customizable presets.

Everything runs locally on your machine with a **\$0 budget** using free-tier LLM APIs (Groq for real-time conversational turns, Google Gemini for deep holistic grading) and a lightweight local vector store.

> **Current Status: v0.5.0 Release**  
> Complete implementation of Multi-Turn Mock Interviews (Technical & Behavioral), Single Practice Drills (Technical & STAR), Grounded Offline RAG Question Bank, 5-Dimensional Evidence-Based Diagnostic Grader, Lifetime Analytics, Unified Saved Reports, Native Voice (STT/TTS), and the Organic Linen & Olive Design System.

---

## Key Features (v0.5.0)

### 1. Full Multi-Turn Mock Interviews
- **Conversational Simulation**: Dynamic, multi-turn interview dialogues with natural follow-ups and candidate-driven progression.
- **Track Branching**: Dedicated **Technical** (with domain selection like SWE, ML/AI, Backend, Frontend, System Design) and **Behavioral/HR** tracks.
- **Seniority & Context Calibration**: Adapts question depth and rubric stringency according to candidate seniority (*Fresher, Mid-Level, Senior, Lead*), target company, and location.
- **Full Transcript Preservation**: Running conversational turns held server-side for end-to-end evaluation.

### 2. Single-Question Practice Drills
- **Technical Questions Drill**: Instant, single-question technical drills tailored to your preset with immediate feedback and scoring.
- **Behavioral (STAR) Drill**: Specialized behavioral questions evaluated against the **STAR** (Situation, Task, Action, Result) methodology.

### 3. Local RAG Retrieval Engine & Question Bank
- **Curated Exemplar Bank**: 100+ vetted industry questions across 7 core domains (Backend, Frontend, ML/AI, System Design, DSA, DevOps/Cloud, Behavioral).
- **Pure Python Vector Store**: Built-in TF-IDF + BM25 hybrid retrieval engine with n-gram tokenization and $L_2$-normalized cosine similarity.
- **Zero Hallucination Grounding**: Contextually grounds the interviewer LLM with exemplar blueprints to generate realistic, high-depth interview questions without external vector database dependencies.
- **Question Bank Explorer**: Interactive UI to search, filter by domain/difficulty, and inspect grading rubrics.

### 4. 5-Dimensional Diagnostic Assessment Engine
- **Evidence-Based Grading**: Evaluates responses strictly on transcript evidence, citing exact strengths, gaps, and actionable improvements rather than generic praise.
- **5 Calibrated Dimensions (0–10 each)**:
  - **Technical Correctness**: Factual precision and technical validity.
  - **Depth of Knowledge**: Understanding of underlying mechanisms, trade-offs, and edge cases.
  - **Problem Solving**: Systematic decomposition, constraint evaluation, and adaptive reasoning.
  - **Communication**: Clarity, structure, conciseness, and professional coherence.
  - **Practical Readiness**: Production-level thinking, operational considerations, and architecture viability.
- **Seniority-Aware Bar**: Calibrated expectations tailored to your selected experience level.

### 5. Lifetime Analytics & Progress Tracking
- **Summary Metrics**: Lifetime interview counts, overall average score, practice time, top demonstrated competencies, and recommended focus areas.
- **Score Trajectory & Domain Radar**: Interactive visual breakdown of performance trends across domains and diagnostic dimensions.
- **Unified & Filterable Views**: View combined analytics or isolate Full Mock Interviews vs. Single Practice Drills.

### 6. Unified Saved Reports Repository
- **Comprehensive History**: Opt-in persistence for all practice sessions and mock interviews.
- **Smart Prioritized Search**: Search keywords across roles, companies, scores, feedback, and verbatim transcripts.
- **Multi-Criteria Filter Drawer**: Filter reports by drill type, target role, company, and minimum score.
- **Two-Step Safe Deletion**: Safe deletion confirmation with instant UI updates.

### 7. Native Voice Interface (Speech-to-Text & Text-to-Speech)
- **STT Dictation**: Browser-native voice input via the Web Speech API with live visual feedback.
- **Natural TTS Playback**: Natural voice synthesis for interviewer questions and feedback with audio wave indicators and cancellation controls.
- **Minimalist Controls**: Modern SVG icon-first controls designed for distraction-free practice.

### 8. Organic Linen & Olive Design System
- **Tactile Aesthetic**: Realistic woven fabric canvas texture with 8 switchable theme palettes (*Warm Linen, Sage Botanical, Forest Moss, Terracotta Sand, Slate Minimal, Deep Navy, Nocturne Olive, Espresso Roast*).
- **Responsive Navigation**: Collapsible right-hand drawer navigation with clean icon and label states.
- **Smart Onboarding**: Contextual preset onboarding banner on the Home page when starting fresh.

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 | High-performance asynchronous REST API |
| **Frontend** | React 19, TypeScript, Vite | Modern component architecture, React Router v7 |
| **Interviewer LLM** | Groq (`openai/gpt-oss-20b` or Llama 3) | Low-latency conversational turn generation |
| **Grading LLM** | Google Gemini (`gemini-3.6-flash`) | Large-context holistic diagnostic evaluation |
| **Retrieval Engine** | Pure Python TF-IDF + BM25 Vector Store | Offline local RAG ($0 cost, no external vector DB) |
| **Persistence** | SQLite via SQLAlchemy | Opt-in report storage and preset management |
| **Voice I/O** | Web Speech API | Client-side STT dictation and TTS synthesis |
| **Testing** | pytest, pytest-asyncio (211 tests) | 100% backend test suite with fake LLM providers |

---

## Project Architecture

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

## Project Structure

```text
RP-AI_Interview_Assistant/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── analytics.py          # GET /analytics/summary, /analytics/timeline, etc.
│   │   │   ├── grading.py            # POST /sessions/{id}/grade, /interviews/{id}/grade
│   │   │   ├── health.py             # GET /health
│   │   │   ├── interviews.py         # POST /interviews/start, /interviews/{id}/respond
│   │   │   ├── presets.py            # CRUD /presets
│   │   │   ├── questions.py          # GET /questions (curated bank explorer)
│   │   │   ├── reports.py            # CRUD /reports with multi-filter query support
│   │   │   ├── sessions.py           # Single-drill session management (Tech & STAR)
│   │   │   └── settings.py           # GET /settings, PUT /settings/theme
│   │   ├── core/
│   │   │   └── config.py             # Centralized settings & model declarations
│   │   ├── data/
│   │   │   └── question_bank.json    # Curated exemplar questions & rubrics
│   │   ├── db/
│   │   │   ├── base.py               # SQLite engine, Base, init_db()
│   │   │   └── models.py             # SavedReport and InterviewPreset ORM models
│   │   ├── schemas/
│   │   │   ├── analytics.py          # Analytics KPIs and chart models
│   │   │   ├── interview.py          # Mock interview requests and responses
│   │   │   ├── preset.py             # Preset models
│   │   │   ├── question.py           # Curated question models
│   │   │   ├── report.py             # Saved report models
│   │   │   └── session.py            # Single-practice session models
│   │   ├── services/
│   │   │   ├── llm/                  # Provider-agnostic LLM interface & retry engine
│   │   │   │   ├── base.py
│   │   │   │   ├── factory.py
│   │   │   │   ├── gemini_provider.py
│   │   │   │   ├── groq_provider.py
│   │   │   │   └── retry.py
│   │   │   ├── rag/                  # Offline RAG retrieval engine
│   │   │   │   ├── retriever.py      # Domain & keyword query retriever
│   │   │   │   └── vector_store.py   # Pure Python TF-IDF/BM25 vector space
│   │   │   ├── interview_store.py    # In-memory store for multi-turn mock interviews
│   │   │   └── session_store.py      # In-memory store for single drills
│   │   └── main.py                   # FastAPI app entry point & CORS
│   ├── tests/                        # 211 pytest test cases across all modules
│   ├── .env.example
│   ├── pyproject.toml
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/                      # Type-safe API clients for all backend routes
│   │   │   ├── analyticsApi.ts
│   │   │   ├── interviewApi.ts
│   │   │   ├── practiceApi.ts
│   │   │   └── questionsApi.ts
│   │   ├── components/               # Modular UI components
│   │   │   ├── BehavioralPracticeCard.tsx
│   │   │   ├── Icons.tsx             # Clean, modern SVG icon set
│   │   │   ├── InterviewPresets.tsx
│   │   │   ├── PracticeCard.tsx
│   │   │   ├── RightNavbar.tsx       # Collapsible right-hand navigation
│   │   │   ├── SavedReports.tsx
│   │   │   └── ThemeSelector.tsx
│   │   ├── pages/                    # Application pages
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── BehavioralPracticePage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   ├── MockInterviewPage.tsx
│   │   │   ├── PresetsPage.tsx
│   │   │   ├── QuestionBankPage.tsx
│   │   │   ├── SavedReportsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── TechnicalPracticePage.tsx
│   │   ├── theme.ts                  # 8 curated color palette definitions
│   │   ├── voiceSettings.ts          # Speech synthesis & recognition settings
│   │   ├── App.tsx
│   │   ├── index.css                 # Global theme variables & canvas textures
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── docs/
│   └── RP-AI_Interview_Assistant_Project_Scope.md # Architectural decisions & log
└── README.md
```

---

## Getting Started

### Prerequisites
- **Python 3.11+**
- **Node.js 20.19+, 22.13+, or 24+**
- Free API keys from [Groq Console](https://console.groq.com) and [Google AI Studio](https://aistudio.google.com)

---

### Backend Setup

1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. Create your `.env` file and populate your API keys:
   ```bash
   cp .env.example .env            # Windows: copy .env.example .env
   ```
   Open `.env` and configure:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The API will be available at `http://localhost:8000`. Interactive OpenAPI documentation is at `http://localhost:8000/docs`.

---

### Frontend Setup

In a separate terminal:

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### First Run Walkthrough

1. **Preset Setup**: When you first open the app, the Home page will prompt you to set up your primary interview preset (Target Role, Company, Location, and Seniority).
2. **Practice Single Drills**: Select **Technical Questions** or **Behavioral (STAR)** on the Home page to practice focused questions with instant feedback. Use the mic button for voice dictation or the speaker button to listen to questions.
3. **Run a Full Mock Interview**: Navigate to **Full Mock Interview**, choose your track (*Technical* or *Behavioral/HR*), select the domain and number of questions, and practice realistic conversational turn-taking.
4. **Review Holistic Diagnostics**: Once an interview concludes, review your overall score, 5-dimensional breakdown, specific strengths, actionable growth areas, and transcript citations.
5. **Track Progress**: Inspect your **Analytics** page to monitor your score trajectories and domain competency breakdown.
6. **Customize**: Open **Settings** to choose from 8 linen themes and configure your preferred natural voice.

---

## Running Tests

### Backend Test Suite (pytest)
The backend test suite covers all API routes, RAG vector retrieval, prompt generators, session stores, and retry logic using fake LLM providers and in-memory databases (no real API quota consumed):

```bash
cd backend
pytest -v
```
*(All 211 tests passing)*

### Frontend Verification
Verify TypeScript types and ESLint conformance:

```bash
cd frontend
npm run lint
npm run build
```

---

## Troubleshooting

- **`404 Model Not Found` from Groq or Gemini**: Free-tier providers periodically update available models. You can override default models anytime via your `.env` file (`GROQ_MODEL=...` or `GEMINI_MODEL=...`) without modifying code.
- **`502 Bad Gateway` on grading or generation**: Usually caused by momentary free-tier rate limits. The backend automatically retries with exponential backoff. If it still fails, wait a few seconds and retry — your active session transcript is preserved in memory.
- **Microphone / Speech Recognition Not Responding**: Ensure your browser has granted microphone permissions. The app automatically provides a text input fallback if microphone access is unavailable.

---

## Current Scope & Limitations

- **In-Memory Active Sessions**: Active in-progress mock interviews and drills reside in memory; restarting the backend server resets in-progress sessions (saved reports are fully persisted in SQLite).
- **Zero Cloud Deployment**: Designed and optimized specifically for local execution on individual developer machines.
- **Free-Tier Model Rate Limits**: Throughput is governed by provider free-tier concurrency limits.

---

## Roadmap towards v1.0.0

- [ ] **Interactive Live Coding Sandbox**: In-browser code editor with syntax highlighting and unit testing to verify the `practical_readiness` dimension.
- [ ] **Exportable PDF Reports**: Formatted report card exports for mock interviews to share with mentors or recruiters.
- [ ] **Targeted Weak-Spot Drills**: Direct integration from Analytics into targeted question bank drills based on lower-scoring dimensions.
- [ ] **Expanded Audio Customization**: Advanced voice pitch and speaking rate controls.

---

## License & Attribution

Designed and built by **Rugved Patil** as a portfolio project demonstrating end-to-end full-stack engineering, prompt design, local RAG architectures, and AI-assisted software development.