import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { db } from './db.ts';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let cachedAdminClient: SupabaseClient | null = null;

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
