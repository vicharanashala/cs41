import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import api from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api', api);

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Start server only after DB is ready
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Crowd Source FAQs API running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});