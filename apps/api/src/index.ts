import express from 'express';
import statusRoutes from './routes/status';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// NEW:
app.use(statusRoutes);

// ...existing endpoints: /export/dry-run, /events, /stats/week, etc.

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`[api] listening on ${port}`));
