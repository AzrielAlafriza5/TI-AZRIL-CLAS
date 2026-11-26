import crypto from 'node:crypto';
import fs from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DB_PATH, db, initDatabase } from './db.ts';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let cachedAdminClient: SupabaseClient | null = null;
let cachedSharedSessionSecret: string | null = null;
let lastSyncedSnapshotMarker: string | null = null;
let lastCheckedAt = 0;
let stateBucketEnsured = false;
let filesBucketEnsured = false;
let dbSyncQueue: Promise<void> = Promise.resolve();

const STATE_BUCKET = 'it-azril-clas-state';
const FILES_BUCKET = 'it-azril-clas-files';
const DB_OBJECT_NAME = 'it_azril_clas.db';
const SYSTEM_SESSION_EMAIL = 'system-session@itazrilclas.internal';

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedAdminClient;
}

export async function getOrCreateSharedSessionSecret(): Promise<string> {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret) return envSecret;

  if (cachedSharedSessionSecret) return cachedSharedSessionSecret;

  const client = getSupabaseAdmin();
  if (client) {
    try {
      const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
      const existing = data?.users?.find((u) => u.email?.toLowerCase() === SYSTEM_SESSION_EMAIL);
      const savedSecret = existing?.app_metadata?.session_secret;
      if (typeof savedSecret === 'string' && savedSecret.length >= 32) {
        cachedSharedSessionSecret = savedSecret;
        return cachedSharedSessionSecret;
      }

      const generated = crypto.randomBytes(32).toString('hex');
      if (existing) {
        await client.auth.admin.updateUserById(existing.id, {
          app_metadata: {
            ...existing.app_metadata,
            session_secret: generated,
          },
        });
      } else {
        await client.auth.admin.createUser({
          email: SYSTEM_SESSION_EMAIL,
          email_confirm: true,
          app_metadata: {
            internal: true,
            session_secret: generated,
          },
        });
      }
      cachedSharedSessionSecret = generated;
      return cachedSharedSessionSecret;
    } catch {
      // Fallback below if Supabase Auth is unreachable
    }
  }

  cachedSharedSessionSecret = crypto.randomBytes(32).toString('hex');
  return cachedSharedSessionSecret;
}

async function ensurePrivateBucket(bucketName: string, flag: 'state' | 'files'): Promise<boolean> {
  const client = getSupabaseAdmin();
  if (!client) return false;
  if (flag === 'state' && stateBucketEnsured) return true;
  if (flag === 'files' && filesBucketEnsured) return true;

  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      await client.storage.createBucket(bucketName, { public: false });
    }
    if (flag === 'state') stateBucketEnsured = true;
    else filesBucketEnsured = true;
    return true;
  } catch {
    return false;
  }
}

export async function syncSqliteSnapshotFromSupabase(forceCheck = false): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  const now = Date.now();
  if (!forceCheck && lastSyncedSnapshotMarker && now - lastCheckedAt < 1500) {
    return;
  }

  const run = dbSyncQueue.then(async () => {
    try {
      const ready = await ensurePrivateBucket(STATE_BUCKET, 'state');
      if (!ready) return;

      const { data: listData, error: listErr } = await client.storage
        .from(STATE_BUCKET)
        .list('', { limit: 10, search: DB_OBJECT_NAME });
      lastCheckedAt = Date.now();
      if (listErr || !listData) return;

      const remoteMeta = listData.find((item) => item.name === DB_OBJECT_NAME);
      if (!remoteMeta) return;

      const remoteMarker = String(remoteMeta.updated_at || remoteMeta.created_at || remoteMeta.id || '');
      if (remoteMarker && remoteMarker === lastSyncedSnapshotMarker) {
        return;
      }

      const { data: blob, error: dlErr } = await client.storage
        .from(STATE_BUCKET)
        .download(DB_OBJECT_NAME);
      if (dlErr || !blob) return;

      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length < 1024) return;

      try {
        db.close();
      } catch {
        // ignore if already closed
      }
      fs.writeFileSync(DB_PATH, buf);
      db.open();
      db.exec('PRAGMA foreign_keys = ON;');
      try {
        db.exec('PRAGMA journal_mode = DELETE;');
      } catch {
        // ignore
      }
      initDatabase();
      lastSyncedSnapshotMarker = remoteMarker || `dl-${Date.now()}`;
    } catch {
      try {
        db.open();
      } catch {
        // already open
      }
    }
  });

  dbSyncQueue = run.catch(() => {});
  await run;
}

export async function uploadSqliteSnapshotToSupabase(): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  const run = dbSyncQueue.then(async () => {
    try {
      const ready = await ensurePrivateBucket(STATE_BUCKET, 'state');
      if (!ready) return;
      if (!fs.existsSync(DB_PATH)) return;

      try {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      } catch {
        // ignore if DELETE journal mode
      }

      const buf = fs.readFileSync(DB_PATH);
      const { error } = await client.storage
        .from(STATE_BUCKET)
        .upload(DB_OBJECT_NAME, buf, {
          contentType: 'application/x-sqlite3',
          upsert: true,
        });

      if (!error) {
        const { data: listData } = await client.storage
          .from(STATE_BUCKET)
          .list('', { limit: 10, search: DB_OBJECT_NAME });
        const remoteMeta = listData?.find((item) => item.name === DB_OBJECT_NAME);
        if (remoteMeta) {
          lastSyncedSnapshotMarker = String(
            remoteMeta.updated_at || remoteMeta.created_at || remoteMeta.id || `up-${Date.now()}`
          );
        }
        lastCheckedAt = Date.now();
      }
    } catch {
      // Non-fatal
    }
  });

  dbSyncQueue = run.catch(() => {});
  await run;
}

export async function uploadFileToSupabaseStorage(filename: string, buffer: Buffer): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const ready = await ensurePrivateBucket(FILES_BUCKET, 'files');
    if (!ready) return;
    await client.storage.from(FILES_BUCKET).upload(filename, buffer, { upsert: true });
  } catch {
    // Non-fatal
  }
}

export async function downloadFileFromSupabaseStorage(filename: string): Promise<Buffer | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  try {
    const ready = await ensurePrivateBucket(FILES_BUCKET, 'files');
    if (!ready) return null;
    const { data, error } = await client.storage.from(FILES_BUCKET).download(filename);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

export async function saveAdminToSupabase(params: {
  id: string;
  username: string;
  fullName: string;
  email: string;
  passwordHash: string;
}): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { data } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
    const existing = data?.users?.find(
      (u) =>
        u.app_metadata?.role === 'admin' ||
        (u.email && u.email.toLowerCase() === params.email.toLowerCase())
    );

    if (existing) {
      await client.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          ...existing.app_metadata,
          role: 'admin',
          local_profile_id: params.id,
          username: params.username,
          full_name: params.fullName,
          password_hash: params.passwordHash,
        },
      });
    } else {
      await client.auth.admin.createUser({
        email: params.email,
        email_confirm: true,
        app_metadata: {
          role: 'admin',
          local_profile_id: params.id,
          username: params.username,
          full_name: params.fullName,
          password_hash: params.passwordHash,
        },
      });
    }
  } catch {
    // Non-fatal fallback if Supabase auth admin API is unavailable
  }
}

export async function syncAdminFromSupabase(): Promise<void> {
  if (process.env.ADMIN_PASSWORD?.trim()) return;

  const existingLocal = db
    .prepare(`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`)
    .get();
  if (existingLocal) return;

  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error || !data?.users) return;

    const adminUser = data.users.find(
      (u) => u.app_metadata?.role === 'admin' && typeof u.app_metadata?.password_hash === 'string'
    );
    if (!adminUser) return;

    const profileId = String(adminUser.app_metadata.local_profile_id || adminUser.id);
    const email = String(adminUser.email || 'admin@itazrilclas.ac.id').toLowerCase();
    const username = String(adminUser.app_metadata.username || email).toLowerCase();
    const fullName = String(adminUser.app_metadata.full_name || 'Administrator Utama');
    const passwordHash = String(adminUser.app_metadata.password_hash);

    db.prepare(`
      INSERT OR IGNORE INTO profiles (id, username, full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `).run(profileId, username, fullName, email, passwordHash);
  } catch {
    // Non-fatal fallback
  }
}
