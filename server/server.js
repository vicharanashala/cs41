import express from 'express';
import cors from 'cors';
import { initDb, saveDb } from './db/database.js';
import { runMigrations } from './utils/migrate.js';
import { authenticate, requireFaculty } from './middleware/auth.js';
import api from './routes/api.js';
import facultyRouter from './routes/faculty.js';
import analyticsRouter from './routes/analytics.js';
import settingsRouter from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api', api);
app.use('/api/faculty', authenticate, requireFaculty, facultyRouter);
app.use('/api/faculty/analytics', authenticate, requireFaculty, analyticsRouter);
app.use('/api/faculty/settings', authenticate, requireFaculty, settingsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const persistAndExit = () => { saveDb(); };
process.on('exit', persistAndExit);
process.on('SIGTERM', () => { saveDb(); process.exit(0); });
process.on('SIGINT',  () => { saveDb(); process.exit(0); });

initDb().then((db) => {
  const ran = runMigrations(db);
  console.log(ran === 0 ? '  (no new migrations)' : `  ✅ ${ran} migration(s) applied`);
  saveDb(); // ← THIS is the one-line fix that was missing
  console.log('  💾 DB persisted');

  app.listen(PORT, () => {
    console.log(`🚀 Server on http://localhost:${PORT}`);
  });
}).catch(err => { console.error(err); process.exit(1); });
