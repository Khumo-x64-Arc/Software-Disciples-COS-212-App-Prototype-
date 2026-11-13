# Software Disciples · COS212 Graphs

A playful e-learning app for COS212 that teaches **only** graph data structures, BFS and DFS, and transitive closure. It uses the Software Disciples look (black, electric blue, white, bold uppercase headings), follows Drozdek, *Data Structures and Algorithms in Java* (2010), and the COS212 graph slides, and maps every lesson to CS2023 AL-Foundational (CS core and KA core).
React 18 (Vite + TypeScript) client, Node.js (Express) API, and a sandboxed Java runner for the coding questions.

## Run it

Requirements:
- Node.js 20 or later.
- A JDK (`javac` and `java`, version 8 or later) to mark the test section. Without one, everything else still works and the test section says that marking is unavailable.

```bash
npm run install:all     # root, server and client dependencies
npm run seed --prefix server   # optional: 20 sample students, points, chat questions and test results for the Lecturer page
npm run dev             # API on http://localhost:4000, app on http://localhost:5173
```

Production or demo build (one server for the API and the app):

```bash
npm run build           # builds client/dist
npm start               # http://localhost:4000
```

Tests:

```bash
npm test                # server: engine, marking (reference Java solutions), Graph Helper, API · client: quiz bank, translations
```

### Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `DATA_FILE` | `server/data/db.json` | JSON data store |
| `STAFF_CODE` | `cos212-staff` | Code that opens the Lecturer page. **Change it** before real use. |
| `JAVAC`, `JAVA` | `javac`, `java` | Java tools |
| `JAVA_PARALLEL` | `2` | Submissions compiled and run at the same time |

### Java sandbox (production note)

Each submission is compiled with `javac --release 8` in a fresh temp folder, then run with `-Xmx256m`, a per-test time limit and a scrubbed environment (no `JAVA_TOOL_OPTIONS`, no secrets).
Static checks reject `java.util` (except `Scanner`), collection types, file, network and process APIs, reflection and `System.exit`.
These are good for a classroom server but are **not** a security boundary. For a public deployment, run the runner in a container or VM with no network, a read-only file system and CPU and memory limits (for example Docker with `--network none --read-only --memory 512m --pids-limit 64`).

## What is in the app

**Start screen.** Choose *I’m a student* or *I’m a lecturer*, and a language.
- Students start straight away as a guest: no sign-in, nothing locked. Signing in with a student number is optional (on the Student page or the start screen); it asks for POPIA consent first and keeps the guest’s points and work.
- The Lecturer page asks for the staff code before it shows any class data. *Back to student mode* returns to the student session.

**Lessons (8 core + 4 bonus).** Every lesson is open at any time. Each has *Learn* (goal, key ideas, an example and a clean reference such as “Drozdek (2010), Section 8.3.1, All-to-all shortest path problem, pages 390–392”), *Try it* (an activity) and a *Quiz*.

| Lesson | Try it |
|---|---|
| L1 Recap: lists and arrays | Read item i from an array (1 step) and from a linked list (walk node by node); add a node |
| L2 Introduction to graphs | Friendship graph: select a person to see neighbours, degree and the handshake rule |
| L3 Types of graphs | Six example graphs with live type, degrees and Kₙ counts |
| L4 Applications of graphs | Taxi routes, social network, the web and module prerequisites as graphs |
| L5 Building a graph in code | Add and remove nodes and edges on the adjacency matrix and list side by side |
| L6 Introduction to BFS | BFS step by step with its queue |
| L7 Introduction to DFS | DFS step by step with its stack, plus the queue-vs-stack checkpoint |
| L8 Traversal walkthrough | Animated scenario: Naledi explores the campus from the Library (Play, Pause, speed, step, “predict the next building”) |
| U5–U8 Transitive closure (bonus) | R⁺ prediction, Warshall’s k-by-k trace, repeated DFS vs Warshall, module prerequisites |

Transitive closure is **recommended** once a learner reaches Level 2 (Rookie, 200 points). It is never enforced.

**Quizzes.** Five questions per attempt with instant feedback: multiple choice, fill in the blank, put in order (drag and drop) and sort into boxes (drag and drop). Drag and drop also works with buttons (↑ ↓, or tap a card then a box). Each question has a tier (warm-up, core, challenge) and the mix gets harder as the level rises.

**Rewards.**
- Points: 10 / 15 / 20 per correct answer by tier (once per question), 25 for finishing a lesson, 60 for passing a coding question (20 if the model solution was shown first).
- Four levels: Beginner (0), Rookie (200), Master (500), Legend (900), with a level-up pop-up and confetti (off with Reduce motion).
- 17 colourful badges, streaks, and chatbot notifications after every answer (“Well done! +15 points” / “Try again, you’ll get it this time 💪”).
- Home shows the level card, badges, a mini roadmap and tiles. The **Roadmap** page gives feedback on every stop (best quiz score, strong / good / worth a revisit, points earned).

**Coding questions (P1–P9).** They open once the 8 core lessons are done.
- P1–P2 graph creation on a matrix and on linked lists: add and remove nodes (`removeVertex` renumbers later vertices) and edges.
- P3 BFS order and P4 DFS order.
- P5–P9 transitive closure: repeated DFS, Warshall’s, Warshall’s trace, prerequisites, find the bug.
- Marked in the Java sandbox against visible samples and per-learner hidden tests, with misconception matching (for example BFS and DFS mixed up, no visited marks, k not the outer loop).
- **A wrong submission shows the full model solution** (from `server/solutions/`). Hints can be opened at any time, one rung at a time.

**Graph Helper** (rule-based chatbot, Alt + H). Answers about the learner’s own graph (reachability, degree, BFS/DFS order, fewest-edge path, closure), then knowledge-base cards with a source, then the three closest topics and the module email. No external AI. It asks for an attempt before the model solution and gives the next hint instead. Questions are stored without the user.

**Lecturer page** (staff code). Most-asked questions on top (top 3 highlighted, trend against the previous period), unanswered questions, class overview by lesson, problem, outcome and misconception, and a struggle map with each student’s points and level. Tutors see only their group. CSV export. A lesson plan page lists times, activities, sources and CS2023 outcomes.

**Languages.** Settings (and the start screen) offer all 11 official written languages: English, isiZulu, isiXhosa, Sepedi, Afrikaans, Setswana, Sesotho, Xitsonga, siSwati, Tshivenḓa and isiNdebele. Menus, buttons, feedback, chatbot messages, levels and lesson text are translated. Quiz questions, code and knowledge-base answers stay in English. **The non-English text is a draft** and should be reviewed by first-language speakers before release (`client/src/i18n/locales/*.ts`; any missing key falls back to English).

**Also:** Build a graph (with BFS/DFS orders in the Props tab), a Videos page with four YouTube thumbnails, read-aloud, larger text and reduced motion.

### Accessibility

- Read-aloud for lesson text, questions and Graph Helper answers.
- Text forms of every graph and real tables for every matrix.
- The walkthrough animation only plays when you press Play; every trace can be stepped by hand.
- Drag-and-drop questions have button alternatives. Colour is never the only cue (✓, ✗, shapes and words).

## CS2023 coverage (AL-Foundational)

| Code | Outcome | Lessons | Problems |
|---|---|---|---|
| CS-ARR | Arrays, single and multi-dimensional (CS core) | L1, L5 | P1 |
| CS-ADT | Abstract data types, e.g. List (CS core) | L1, L5 | P1, P2 |
| CS-GRAPH | Graphs: (un)directed, (a)cyclic, (un)connected, (un)weighted (CS core) | L2, L3, L4 | |
| CS-REP | Adjacency list and matrix representations (CS core) | L5 | P1, P2 |
| CS-BFS | Breadth-first search (CS core) | L6, L8 | P3 |
| CS-DFS | Depth-first search: connectivity, reachability (CS core) | L7, L8, U5, U7 | P4, P5 |
| KA-TC | Transitive closure, Warshall’s algorithm (KA core) | U5–U8 | P5–P9 |
| KA-CMP | Choosing between algorithms by their cost (KA core) | U7 | P5 |

## Project structure

```
shared/            ES modules used by both the server and the app
  graph-core.mjs   graph engine: representations, properties, DFS/BFS traces, Warshall, text format
  units.mjs        lessons L1–L8 and U5–U8, CS2023 outcomes, references, levels, points
  graph-helper.mjs Graph Helper: graph engine answers, knowledge-base cards, fallback
  videos.mjs       the four YouTube links
server/src
  app.js           REST API (guest start, optional sign-in, staff code, progress, checks, problems, chat, dashboard)
  problems.js      P1–P9 with starters, harnesses, test generators and hints
  grader.js        marking and misconception matching · javaRunner.js sandbox
  dashboard.js     Lecturer page data and CSV · store.js JSON store · seed.js sample data
server/solutions   model solutions shown after a wrong submission (also used by the tests)
client/src
  pages/           Welcome, Home, LessonPage (+ lessonWidgets, unitWidgets), Roadmap, Tests (coding),
                   People (Student and Lecturer pages), Dashboard, BuildGraph, Videos, Info (settings, lesson plan)
  components/      Quiz, GraphCanvas, HelperChat, Layout, ui
  state/           AppContext (session, progress, settings), rewards (points, levels, badges, pop-ups)
  lib/quizBank.ts  question banks: multiple choice, fill in the blank, order, sort
  i18n/            translations (en is the source; 10 draft languages)
  theme.css        the Software Disciples theme (black, electric blue, Montserrat headings)
```
