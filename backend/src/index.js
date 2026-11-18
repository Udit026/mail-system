import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import emailRoutes from './routes/emails.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();

// Proxy (nginx / render / railway) ke peeche ho to rate-limit ko sahi IP milti hai
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));

// Webhook ko RAW body chahiye (signature verify), isliye express.json() se PEHLE mount
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhookRoutes);

// Attachments base64 me aate hain, isliye limit badi rakhi hai
app.use(express.json({ limit: '20mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
});
