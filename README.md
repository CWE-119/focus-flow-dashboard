<div align="center">
  <img src="public/FucosFlow.png" width="96" alt="FocusFlow logo" />
  <h1>FocusFlow</h1>
  <p><strong>Focus deeply, plan clearly, and connect what you learn.</strong></p>
  <p>A local-first productivity workspace for focus sessions, tasks, reminders, Markdown notes, knowledge graphs, and visual thinking.</p>

  [![Release](https://img.shields.io/github/v/release/CWE-119/focus-flow-dashboard?style=flat-square)](https://github.com/CWE-119/focus-flow-dashboard/releases)
  [![Windows release](https://github.com/CWE-119/focus-flow-dashboard/actions/workflows/release-windows.yml/badge.svg)](https://github.com/CWE-119/focus-flow-dashboard/actions/workflows/release-windows.yml)
  ![React](https://img.shields.io/badge/React-18-20232a?style=flat-square&logo=react)
  ![Electron](https://img.shields.io/badge/Electron-40-20232a?style=flat-square&logo=electron)
  ![SQLite](https://img.shields.io/badge/SQLite-local-20232a?style=flat-square&logo=sqlite)
</div>

## A calmer home for productive work

FocusFlow brings the parts of a productive day into one desktop workspace. Run
a focus session, plan categorized tasks, remember what comes next, write rich
Markdown notes, follow ideas through an Obsidian-style graph, and sketch on a
freeform canvas. Data is stored locally in SQLite; no MongoDB server or cloud
account is required.

## What is included

### Focus dashboard

- Focus timer with saved session history and an active-session indicator
- Tasks with priorities, due dates, repeat rules, categories, and filters
- Reminders, a contribution calendar, streaks, session statistics, and tips
- Live clock, audio visualizer, keyboard shortcuts, and 12 visual themes

### Connected notes

- Folder-based Markdown notes with autosave, conflict detection, revisions,
  pinned notes, recent notes, daily notes, and templates
- Wiki links, backlinks, outgoing links, missing links, and unlinked mentions
- LaTeX, highlighted code, Mermaid, DBML, images, video, callouts, and paper
  backgrounds
- Preview annotations with drawing tools, layers, locking, undo, and redo
- Markdown-folder import/export, including annotation sidecar files
- Searchable whole-vault and local graph views with filters, ghost nodes, zoom,
  pan, drag, pinning, previews, and direct note opening

### Visual canvas

- Persistent freeform drawings with pen, text, shapes, and images
- Selection, layering, undo/redo, autosave, and PNG export

## Download

Windows x64 is the automated release target. Open
[GitHub Releases](https://github.com/CWE-119/focus-flow-dashboard/releases) and
choose the asset that fits your use case:

- **Setup EXE** — installed application with in-app update support
- **Portable EXE** — runs without installation and is updated manually

The repository contains macOS and Linux builder targets, but those release
paths are not yet validated or published automatically. See the
[Windows release guide](docs/WINDOWS_RELEASES.md) for publishing and updater
verification.

## Run it locally

### Requirements

- Node.js 22 (the release workflow uses 22.12)
- npm

```bash
git clone https://github.com/CWE-119/focus-flow-dashboard.git
cd focus-flow-dashboard
npm ci
```

For the complete desktop development experience, including the local backend:

```bash
npm run dev:electron
```

For browser development, run the API and Vite in separate terminals:

```bash
# Terminal 1 — Express + SQLite on http://localhost:5000
npm --prefix backend start

# Terminal 2 — React on http://localhost:3000
npm run dev
```

No `.env` file is required. Optional configuration:

| Variable | Purpose |
| --- | --- |
| `PORT` | Override the backend port (default `5000`) |
| `FOCUSFLOW_DB_PATH` | Override the SQLite file location |
| `VITE_API_URL` | Point the browser build at another API base URL |
| `FOCUSFLOW_FRONTEND_ORIGIN` | Allow an additional exact browser origin for local deadline integration settings |

## End dates and calendar connections

In the dashboard, open **End dates → Connections** to add Canvas LMS or Google
Calendar credentials. Save the connection, then choose **Sync now**. Click any
imported date to see its deadlines, reminders, and focus sessions together in
Activity. The grid also supports future days and year navigation.

See [calendar setup and API details](docs/deadline-integrations.md) for credentials,
sync behavior, and local storage. Help includes these features, the noted-words
glossary, and the note editor's recent additions.

Suggested next work is prioritized in the [research and education roadmap](docs/research-education-roadmap.md).

## Promotional screenshot studio

The app includes deterministic static-data scenes for creating consistent
product images. Start Vite, then open:

| Route | Best use |
| --- | --- |
| `/showcase` | Scene picker and capture instructions |
| `/showcase/focus` | Dashboard hero and feature announcements |
| `/showcase/notes` | Notes, writing, and knowledge-management promotion |
| `/showcase/graph` | Connected-thinking and graph-view promotion |

Add `?capture=1` to any scene to remove studio controls, for example:
`http://localhost:3000/showcase/focus?capture=1`.

For consistent framing, capture at **1400 × 900**. The scenes render without
backend data and never write showcase content to the user's database.

## How it works

```text
React renderer  ──HTTP──>  Express API  ──>  SQLite
      │                         ▲
      └──── Electron shell ─────┘
             starts the API,
             owns updates and
             chooses the data path
```

| Layer | Source of truth |
| --- | --- |
| UI and routes | `src/` — React, TypeScript, Vite, Tailwind, Radix/shadcn |
| Desktop shell | `electron/main.cjs` and `electron/preload.js` |
| API runtime | `backend/index.js` — the canonical Express backend |
| Data | SQLite via `sqlite3` |
| Packaging | `electron-builder.json` and `scripts/after-pack.cjs` |
| Windows publishing | `.github/workflows/release-windows.yml` |

In browser development, SQLite is created at `backend/focusflow.db` unless
`FOCUSFLOW_DB_PATH` is set. In the packaged desktop app, Electron places the
database in its writable user-data directory so updates do not overwrite it.

The API covers task categories, todos, notes, note references and revisions,
the graph, folders, focus history and sessions, reminders, annotations, and
drawings, deadlines, calendar connections, and glossary terms. The desktop build
packages the same backend used during development.

## Project map

```text
focus-flow-dashboard/
├── src/
│   ├── components/          reusable app and editor UI
│   ├── contexts/            sessions, reminders, notes, themes, timers
│   ├── lib/                 API client, note links, vault import/export
│   ├── pages/               dashboard, notes, canvas, help
│   ├── pages/showcase/      promotional capture scenes
│   └── test/                frontend unit and integration tests
├── backend/
│   ├── index.js             canonical API and SQLite schema
│   └── test/                backend integration tests
├── electron/                desktop process and secure preload bridge
├── scripts/                 packaging, cleanup, and release checks
├── docs/
│   └── WINDOWS_RELEASES.md  release operator guide
└── .github/workflows/       Windows tag-release automation
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port 3000 |
| `npm run dev:electron` | Start Vite and the Electron desktop shell |
| `npm run test` | Run Vitest once |
| `npm run test:backend` | Run Node backend integration tests |
| `npm run lint` | Run ESLint |
| `npm run build` | Create the production renderer bundle |
| `npm run build:electron:win` | Build Windows installer and portable targets |
| `npm run release:check` | Run release guards, tests, and a production build |
| `npm run clean:electron` | Remove stale Electron build output |

## Roadmap

The next improvements are intentionally focused on reliability and a complete
local-first experience:

- Add pull-request CI plus broader backend, Electron, and end-to-end coverage
- Complete recurring-task generation and add scheduled desktop notifications
- Bind the desktop API to loopback, narrow CORS, add request limits, consistent
  validation, a health endpoint, and structured logs
- Split the canonical backend into testable route, service, and database modules
- Add whole-app backup/restore and PDF/HTML note export
- Add note tags, stronger search filters, a session calendar, goals, and habits
- Sign Windows installers and validate native macOS/Linux release pipelines

## Contributing and license

Bug reports and focused pull requests are welcome. Run the frontend tests,
backend tests, lint, and production build before opening a pull request.

This repository does not currently include a software license. Add an explicit
license before treating the code as generally redistributable or reusable.

## Updates

### Unreleased — July 12, 2026

- Added a dedicated promotional screenshot studio with deterministic focus,
  notes, and graph scenes plus clean capture URLs
- Replaced the stale README with a source-accurate product, development,
  architecture, release, promotion, and roadmap guide
- Consolidated the documentation into this README and one Windows release guide
- Removed obsolete MongoDB-era documents, historical completion reports, empty
  notes, and unused UI boilerplate
- Removed the dead duplicate backend trees and stale MongoDB environment file
  from both the source tree and future desktop packages
- Corrected single-note lookup for the SQLite schema and added integration coverage
- Removed leftover Lovable tooling/metadata and cleared the project's lint errors

### v1.2.0 — July 11, 2026

- Persisted task categories in SQLite and migrated legacy browser-only category data
- Added the tag-driven Windows installer/portable release and auto-update workflow
- Fixed packaged backend resolution and enforced a Windows-native SQLite binding
- Refined the notes workspace navigation and list experience
