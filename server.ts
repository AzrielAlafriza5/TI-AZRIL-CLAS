import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db.ts';
import { authRouter } from './server/routes-auth.ts';
import { adminRouter } from './server/routes-admin.ts';
import { learningRouter } from './server/routes-learning.ts';

async function startServer() {
  initDatabase();

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'IT AZRIL CLAS' });
  });

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', learningRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IT AZRIL CLAS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start IT AZRIL CLAS server:', err);
  process.exit(1);
});
