# COS212 Graphs & Transitive Closure: e-learning app

A working build of the *COS212 Graphs & Transitive Closure E-Learning App: Draft Design (2027)*. It teaches CS2023 AL-Foundational **CS Core topic 8 (Graphs)** and **KA Core topic 15a (Transitive closure, Warshall's)** using Drozdek, *Data Structures and Algorithms in Java*, 2nd ed., Chapter 8.

- **Front end:** React (Vite). **Back end:** Node.js (Express). **Java:** learners' code is compiled with `javac --release 8` and run by the back end.
- **No API keys and no outside AI service.** The chatbot and the feedback are rules, search and graph algorithms that run on your own server.

## Run it

Needs Node.js 20+ and a JDK (11 or newer) on the PATH.

```bash
npm run setup      # install server and client packages
npm run build      # build the React front end
npm start          # serves the app and API on http://localhost:3001
```

Development with hot reload: `npm run dev:server` in one terminal and `npm run dev:client` in another (open http://localhost:5173).

With Docker: `docker build -t cos212-graphs . && docker run -p 3001:3001 -v $(pwd)/data:/app/data cos212-graphs`

### Signing in (pilot)

| Role | How |
| --- | --- |
| Student | Any student number such as `u21000001`. The tutorial group is assigned automatically. |
| Tutor | Name, a tutorial group, and passcode `cos212-tutor` |
| Lecturer | Name and passcode `cos212-lecturer` |

Change the passcodes with `LECTURER_PASSCODE` and `TUTOR_PASSCODE`. In production, replace this sign-in with UP single sign-on (`/api/login` in `server/src/index.js`).

On first start the app adds **24 demo learners** so the lecturer dashboard has something to show. Turn this off with `SEED_DEMO=0`, or remove them with **Clear demo data** on the dashboard.

## What is in it

| Requirement (design doc section) | Where |
| --- | --- |
| Learning path, U0–U8, 80% to unlock, two tracks | `client/src/pages/Home.jsx`, `Unit.jsx`; content and checks in `server/src/units.js` |
| Graph theory from Drozdek Ch. 8 (definitions, §8.1 representations, §8.2 traversals, §8.3.1 WFI, §8.6 connectivity, §8.14 exercises 2, 3, 5, 31) | Lesson content in `server/src/units.js`; chatbot cards in `server/src/chatbot.js` |
| Build a graph page: click to add a vertex, drag to connect or move, toggles, live panels, closure, Step k, DFS/BFS, export, keyboard equivalents, read-aloud | `client/src/pages/Builder.jsx` |
| Test section P1–P11 in Java, per-learner hidden tests, Fitchfork-style I/O, no `java.util` collections | `server/src/problems.js`, `server/src/runner.js`, `client/src/pages/Problem.jsx` |
| Feedback on each answer: misconception catalogue and hint ladder | `server/src/feedback.js`; unit-check grading in `server/src/units.js` |
| Graph Helper chatbot: graph engine, knowledge base and fallback, no API keys, no test solutions | `server/src/chatbot.js`, `client/src/components/Chat.jsx` |
| Lecturer dashboard: most-asked questions, class overview, struggle map, student profile, filters, CSV, role-based access | `server/src/analytics.js`, `client/src/pages/Dashboard.jsx` |
| Okabe–Ito palette, shapes and words with every colour, Atkinson Hyperlegible, reduced motion | `client/src/styles.css`, `LevelIcon` in `client/src/lib.jsx` |
| Privacy: consent notice, anonymous chat logs, tutors see only their group | `client/src/App.jsx`, `server/src/store.js`, `server/src/analytics.js` |

### Shared graph logic
`shared/graph.js` holds the graph algorithms (closure, Warshall trace, reachability, properties, test format). The browser, the server, the unit checks and the test generators all use it, so they always agree.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 3001 | HTTP port |
| `DATA_DIR` | `./data` | Where `db.json` is stored |
| `RUNNER` | `local` | `docker` runs each Java submission in a throwaway container with no network |
| `RUNNER_IMAGE` | `eclipse-temurin:21-jdk` | Image used when `RUNNER=docker` |
| `RUNNER_PARALLEL` | 2 | Java runs at the same time |
| `SEED_DEMO` | on | `0` disables demo learners |
| `LECTURER_PASSCODE`, `TUTOR_PASSCODE` | see above | Pilot staff sign-in |

## Tests

`npm test` runs every reference solution in `server/test/solutions` through the real Java runner; every hidden test passes. It also runs the planted bugs in `server/test/buggy`, and each one is matched to the right misconception:

| Planted bug | Detected as |
| --- | --- |
| Undirected edge added one way (P1) | Edge added in one direction only |
| DFS without visited marks (P5) | StackOverflowError → missing visited marks |
| Kₙ checked by counting edges (P4) | Counting edges instead of checking every pair |
| Diagonal pre-filled with 1s (P7) | Paths of zero edges counted |
| k as the inner loop (P10 starter) | k is not the outermost loop, found from both the failing tests and the code structure |
| `ArrayList` used, a compile error | Blocked before running; plain-language compile message |

## Before real students use it

- **Sandboxing:** the default `local` runner limits time and memory and blocks dangerous calls such as `Runtime`, network, file writing and reflection, but it is not a full sandbox. In production set `RUNNER=docker`, or run the whole app in the container above as a non-root user.
- **Storage:** `db.json` is fine for a pilot. Move to a database (for example PostgreSQL) for a full class.
- **Sign-in:** replace the pilot sign-in with UP single sign-on, and decide how long results are kept (the open questions in the design doc).
- **Content review:** a tutor should review the knowledge-base cards and unit checks before launch.
- **Accessibility testing:** run an accessibility review with real users, including screen-reader and colour-blind testers.
