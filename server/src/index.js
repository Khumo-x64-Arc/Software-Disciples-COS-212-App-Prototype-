import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createStore } from './store.js';
import { javaAvailable } from './javaRunner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const DATA_FILE = process.env.DATA_FILE ?? path.join(here, '..', 'data', 'db.json');

const javaReady = javaAvailable();
const app = createApp(createStore(DATA_FILE), { javaReady });
const server = app.listen(PORT, async () => {
  console.log(`COS212 Graphs & Transitive Closure API on http://localhost:${PORT}`);
  console.log((await javaReady) ? 'Java found: the test section can mark code.' : 'WARNING: javac not found. Install a JDK (8 or later) to mark Java problems.');
});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use by another program (often an older copy of this server still running).`);
    console.error('Close the other terminal or program using it, or restart your computer, then run "npm run dev" again.\n');
  } else console.error(err);
  process.exit(1);
});
