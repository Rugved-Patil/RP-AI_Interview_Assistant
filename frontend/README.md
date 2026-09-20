# Frontend

The React + TypeScript (Vite) interface for RP-AI Interview Assistant. For the full setup — backend, API keys, first run — see the [root README](../README.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Needs Node.js 20.19+, 22.13+, or 24+. The backend must be running on `http://localhost:8000`: that URL is `API_BASE_URL` in `src/api/practiceApi.ts`, and the backend's `FRONTEND_ORIGIN` setting (CORS) must match the dev server's origin.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-checks with `tsc -b`, then builds to `dist/` |
| `npm run lint` | ESLint (including the React hooks rules) |
| `npm run preview` | Serves the production build locally |

`tsc --noEmit` on its own checks nothing in this project — the root `tsconfig.json` only references `tsconfig.app.json` and `tsconfig.node.json` — so use `npm run build` (or `npx tsc -b`) to type-check. There are no automated frontend tests yet.

## Routes

| Path | Page |
|---|---|
| `/` | Home — pick a practice mode |
| `/practice` | Technical questions (start → answer → grade → save) |
| `/presets` | Create, edit, delete, and choose the active interview preset |
| `/reports` | Saved reports, with two-step delete |
| `/mock-interview` | Placeholder for the full mock interview (planned for v1.0.0) |

## Source layout

```text
src/
├── api/practiceApi.ts     # typed fetch wrappers for every backend endpoint
├── components/            # PracticeCard, InterviewPresets, SavedReports (each with its .css)
├── pages/                 # one file per route; thin wrappers around the components
├── activePreset.ts        # reads/writes the active preset id in localStorage
├── App.tsx                # router + persistent header
├── main.tsx               # entry point
└── index.css              # global styles and design tokens
```

## Things worth knowing

- **No state library.** Each component owns its state. Multi-step flows use a discriminated union — see `Stage` in `PracticeCard.tsx` — so impossible combinations (for example "graded" with no score) can't be represented.
- **The active preset is browser-local.** Presets themselves live in the backend database, but which one is active is stored in `localStorage` under `rp-ai:active-preset-id`.
- **Answer length limit.** `MAX_ANSWER_LENGTH` in `practiceApi.ts` mirrors the backend's limit (`backend/app/schemas/session.py`) — change them together.
- **Fonts load from Google Fonts** (see `index.html`), so offline you'll see fallback fonts.
- **Routes and page names.** The `/practice` route is served by `SituationalPracticePage.tsx`; the file keeps its old name until a second practice mode is added.