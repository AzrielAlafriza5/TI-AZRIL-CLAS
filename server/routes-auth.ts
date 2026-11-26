import crypto from 'node:crypto';
import { Router } from 'express';
import { db, hashPasswordSync, verifyPasswordSync } from './db.ts';
import {
  type AuthedRequest,
  clearSessionCookie,
  getJakartaDateString,
  getSystemSettings,
  logAudit,
  processStudentDailyStreak,
  requireAuth,
  setSessionCookie,
  signSessionToken,
} from './auth.ts';
import {
  isSupabaseServerConfigured,
  saveAdminToSupabase,
  syncAdminFromSupabase,
} from './supabase.ts';

export const authRouter = Router();

function buildUserResponse(profileId: string) {
  const profile = db
    .prepare(`SELECT id, username, full_name, email, role, avatar_url FROM profiles WHERE id = ?`)
    .get(profileId) as
    | { id: string; username: string; full_name: string; email: string | null; role: 'admin' | 'student'; avatar_url: string | null }
    | undefined;
  if (!profile) return null;

  let student = null;
  if (profile.role === 'student') {
    student = db
      .prepare(`
        SELECT s.*, sp.name AS study_program_name, sp.code AS study_program_code,
               c.name AS class_name,
               ls.current_streak, ls.best_streak, ls.total_login_days, ls.last_login_date
        FROM students s
        JOIN study_programs sp ON sp.id = s.study_program_id
        JOIN classes c ON c.id = s.class_id
        LEFT JOIN login_streaks ls ON ls.student_id = s.id
        WHERE s.profile_id = ?
      `)
      .get(profile.id);
  }

  return {
    id: profile.id,
    username: profile.username,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role,
    avatar_url: profile.avatar_url,
    student,
  };
}

authRouter.get('/status', async (_req, res) => {
  await syncAdminFromSupabase();
  const admin = db.prepare(`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`).get();
  res.json({
    adminProvisioned: Boolean(admin),
    adminManagedByEnv: Boolean(process.env.ADMIN_PASSWORD?.trim()),
    supabaseConfigured: isSupabaseServerConfigured,
    jakartaDate: getJakartaDateString(),
  });
});

authRouter.post('/bootstrap-admin', async (req, res) => {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    res.status(409).json({ error: 'Administrator utama telah dikonfigurasi melalui environment server.' });
    return;
  }

  await syncAdminFromSupabase();
  const existing = db.prepare(`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`).get();
  if (existing) {
    res.status(409).json({ error: 'Akun administrator utama sudah terdaftar dan tidak dapat ditambahkan lagi.' });
    return;
  }

  const fullName = String(req.body?.full_name ?? 'Administrator Utama').trim() || 'Administrator Utama';
  const rawEmail = String(req.body?.email ?? '').trim().toLowerCase();
  const email = rawEmail || 'admin@itazrilclas.ac.id';
  const password = String(req.body?.password ?? '');

  if (password.length < 6) {
    res.status(400).json({ error: 'Sandi / kode verifikasi administrator minimal 6 karakter wajib diisi.' });
    return;
  }

  const profileId = crypto.randomUUID();
  const passwordHash = hashPasswordSync(password);

  try {
    db.prepare(`
      INSERT INTO profiles (id, username, full_name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `).run(profileId, email, fullName, email, passwordHash);
  } catch {
    res.status(409).json({ error: 'Akun administrator utama sudah terdaftar.' });
    return;
  }

  await saveAdminToSupabase({
    id: profileId,
    username: email,
    fullName,
    email,
    passwordHash,
  });

  logAudit(profileId, 'ADMIN_BOOTSTRAPPED', 'profile', profileId, { email });

  const token = await signSessionToken(profileId, 'admin');
  setSessionCookie(req, res, token);

  res.status(201).json({
    token,
    user: buildUserResponse(profileId),
  });
});

authRouter.post('/login', async (req, res) => {
  const identifier = String(req.body?.identifier ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const expectedRole = req.body?.expectedRole === 'admin' || req.body?.expectedRole === 'student'
    ? (req.body.expectedRole as 'admin' | 'student')
    : null;

  if (expectedRole === 'admin') {
    if (!password) {
      res.status(400).json({ error: 'Sandi atau kode verifikasi admin wajib diisi.' });
      return;
    }

    await syncAdminFromSupabase();
    const adminProfile = db
      .prepare(`
        SELECT id, username, email, password_hash, role
        FROM profiles
        WHERE role = 'admin'
        LIMIT 1
      `)
      .get() as
      | { id: string; username: string; email: string | null; password_hash: string; role: 'admin' | 'student' }
      | undefined;

    if (!adminProfile || !verifyPasswordSync(password, adminProfile.password_hash)) {
      res.status(401).json({ error: 'Kode verifikasi atau sandi administrator tidak valid.' });
      return;
    }

    const token = await signSessionToken(adminProfile.id, 'admin');
    setSessionCookie(req, res, token);

    res.json({
      token,
      user: buildUserResponse(adminProfile.id),
      streakOutcome: null,
    });
    return;
  }

  if (!identifier || !password) {
    res.status(400).json({ error: 'Username/NIM dan password wajib diisi.' });
    return;
  }

  const profile = db
    .prepare(`
      SELECT id, username, email, password_hash, role
      FROM profiles
      WHERE LOWER(username) = ? OR LOWER(email) = ?
      LIMIT 1
    `)
    .get(identifier, identifier) as
    | { id: string; username: string; email: string | null; password_hash: string; role: 'admin' | 'student' }
    | undefined;

  if (!profile || !verifyPasswordSync(password, profile.password_hash)) {
    res.status(401).json({ error: 'Kredensial tidak valid. Periksa kembali username/NIM dan password Anda.' });
    return;
  }

  if (expectedRole && profile.role !== expectedRole) {
    res.status(403).json({
      error: 'Akun ini terdaftar sebagai Administrator. Silakan gunakan tab Login Admin.',
    });
    return;
  }

  let streakOutcome = null;
  if (profile.role === 'student') {
    const student = db
      .prepare(`SELECT id FROM students WHERE profile_id = ?`)
      .get(profile.id) as { id: string } | undefined;
    if (student) {
      streakOutcome = processStudentDailyStreak(student.id, profile.id);
    }
  }

  const token = await signSessionToken(profile.id, profile.role);
  setSessionCookie(req, res, token);

  res.json({
    token,
    user: buildUserResponse(profile.id),
    streakOutcome,
  });
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: AuthedRequest, res) => {
  const user = buildUserResponse(req.auth!.profileId);
  if (!user) {
    res.status(401).json({ error: 'Sesi tidak valid.' });
    return;
  }
  const settings = getSystemSettings();
  res.json({ user, settings });
});

authRouter.get('/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`
      SELECT id, recipient_profile_id, title, message, category, is_read, created_at
      FROM notifications
      WHERE recipient_profile_id = ?
      ORDER BY created_at DESC
      LIMIT 60
    `)
    .all(req.auth!.profileId);
  const unreadRow = db
    .prepare(`SELECT COUNT(*) AS count FROM notifications WHERE recipient_profile_id = ? AND is_read = 0`)
    .get(req.auth!.profileId) as { count: number };

  res.json({
    notifications: rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) })),
    unreadCount: Number(unreadRow?.count ?? 0),
  });
});

authRouter.post('/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_profile_id = ?`).run(req.auth!.profileId);
  res.json({ ok: true });
});

authRouter.patch('/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_profile_id = ?`).run(
    req.params.id,
    req.auth!.profileId
  );
  res.json({ ok: true });
});
