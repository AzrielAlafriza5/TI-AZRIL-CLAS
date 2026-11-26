import 'dotenv/config';
import express from 'express';
import { initDatabase } from './db.ts';
import { authRouter } from './routes-auth.ts';
import { adminRouter } from './routes-admin.ts';
import { learningRouter } from './routes-learning.ts';
import {
  isSupabaseServerConfigured,
  syncSqliteSnapshotFromSupabase,
  uploadSqliteSnapshotToSupabase,
} from './supabase.ts';

let initialized = false;

export function createApiApp() {
  if (!initialized) {
    initDatabase();
    initialized = true;
  }

  const app = express();
  app.set('trust proxy', true);

  // Preserve pre-parsed req.body on serverless runtimes (e.g. Vercel)
  app.use((req, _res, next) => {
    if (req.body !== undefined && typeof (req as { _body?: boolean })._body !== 'boolean') {
      (req as { _body?: boolean })._body = true;
    }
    next();
  });

  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'IT AZRIL CLAS' });
  });

  // On serverless environments (Vercel), sync SQLite state with private Supabase Storage
  if (process.env.VERCEL && isSupabaseServerConfigured) {
    app.use('/api', async (req, res, next) => {
      try {
        const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
        const skipSync = req.path === '/health' || req.path === '/auth/logout';
        if (!skipSync) {
          await syncSqliteSnapshotFromSupabase(isMutation);
        }

        if (isMutation && !skipSync) {
          const origJson = res.json.bind(res);
          res.json = ((body: unknown) => {
            if (res.statusCode < 400) {
              uploadSqliteSnapshotToSupabase()
                .catch(() => {})
                .finally(() => {
                  origJson(body);
                });
              return res;
            }
            return origJson(body);
          }) as typeof res.json;
        }
        next();
      } catch (err) {
        next(err);
      }
    });
  }

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', learningRouter);

  // Ensure unknown /api/* routes return JSON 404 rather than HTML SPA fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  return app;
}
