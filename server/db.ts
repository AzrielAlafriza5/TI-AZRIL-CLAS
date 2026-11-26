import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'it_azril_clas.db');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasswordSync(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function initDatabase(): void {
  db.exec(`
    -- 1. profiles
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_single_admin_role
      ON profiles (role)
      WHERE role = 'admin';

    -- 2. study_programs
    CREATE TABLE IF NOT EXISTS study_programs (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. classes
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      study_program_id TEXT NOT NULL REFERENCES study_programs(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      academic_year TEXT NOT NULL DEFAULT '2026/2027',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (study_program_id, name)
    );

    -- 4. students
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      profile_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      nim TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      study_program_id TEXT NOT NULL REFERENCES study_programs(id) ON DELETE RESTRICT,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'netral' CHECK (status IN ('hijau', 'netral', 'merah')),
      total_points INTEGER NOT NULL DEFAULT 0,
      total_exp INTEGER NOT NULL DEFAULT 0,
      current_level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. assignments
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      attachment_url TEXT,
      attachment_name TEXT,
      deadline TEXT NOT NULL,
      max_points INTEGER NOT NULL DEFAULT 100 CHECK (max_points >= 0),
      created_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. assignment_targets
    CREATE TABLE IF NOT EXISTS assignment_targets (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      study_program_id TEXT NOT NULL REFERENCES study_programs(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      UNIQUE (assignment_id, class_id)
    );

    -- 7. submissions
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      file_url TEXT,
      file_name TEXT,
      drive_link TEXT,
      answer_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'graded', 'revision')),
      score REAL,
      awarded_points INTEGER NOT NULL DEFAULT 0,
      admin_notes TEXT NOT NULL DEFAULT '',
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      graded_at TEXT,
      graded_by TEXT REFERENCES profiles(id),
      UNIQUE (assignment_id, student_id)
    );

    -- 8. materials
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT 'Umum',
      drive_url TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 1,
      published_at TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 9. material_targets
    CREATE TABLE IF NOT EXISTS material_targets (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      study_program_id TEXT NOT NULL REFERENCES study_programs(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      UNIQUE (material_id, class_id)
    );

    -- 10. material_progress
    CREATE TABLE IF NOT EXISTS material_progress (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (material_id, student_id)
    );

    -- 11. attendance
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      attendance_date TEXT NOT NULL,
      meeting_number INTEGER NOT NULL CHECK (meeting_number >= 1),
      status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel')),
      import_id TEXT,
      recorded_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, attendance_date, meeting_number)
    );

    -- 12. point_transactions
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('assignment', 'attendance', 'question', 'critical_question', 'discussion', 'bonus', 'adjustment')),
      description TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      admin_id TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_point_unique_ref
      ON point_transactions(student_id, source, reference_type, reference_id)
      WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND source IN ('attendance', 'assignment');

    -- 13. student_status_history
    CREATE TABLE IF NOT EXISTS student_status_history (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL CHECK (previous_status IN ('hijau', 'netral', 'merah')),
      new_status TEXT NOT NULL CHECK (new_status IN ('hijau', 'netral', 'merah')),
      reason TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel')),
      changed_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 14. login_streaks
    CREATE TABLE IF NOT EXISTS login_streaks (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      current_streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      total_login_days INTEGER NOT NULL DEFAULT 0,
      last_login_date TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 15. login_history
    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      login_date TEXT NOT NULL,
      streak_day INTEGER NOT NULL,
      logged_in_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, login_date)
    );

    -- 16. exp_transactions
    CREATE TABLE IF NOT EXISTS exp_transactions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL CHECK (amount >= 0),
      source TEXT NOT NULL CHECK (source IN ('daily_login', 'weekly_streak', 'monthly_streak', 'achievement', 'bonus')),
      description TEXT NOT NULL,
      reference_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, reference_key)
    );

    -- 17. achievements
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      streak_required INTEGER NOT NULL UNIQUE,
      exp_reward INTEGER NOT NULL DEFAULT 0,
      badge_icon TEXT NOT NULL DEFAULT 'flame'
    );

    -- 18. student_achievements
    CREATE TABLE IF NOT EXISTS student_achievements (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (student_id, achievement_id)
    );

    -- 19. notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'system',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 20. excel_import_history
    CREATE TABLE IF NOT EXISTS excel_import_history (
      id TEXT PRIMARY KEY,
      import_type TEXT NOT NULL CHECK (import_type IN ('attendance', 'student_status')),
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      matched_rows INTEGER NOT NULL DEFAULT 0,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT NOT NULL DEFAULT '{}',
      imported_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 21. system_settings
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 22. audit_logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default system settings if absent
  const defaultSettings: Record<string, unknown> = {
    points: {
      hadir: 10,
      izin: 0,
      sakit: 0,
      alpha: 0,
      question: 5,
      critical_question: 10,
      discussion: 5,
    },
    exp: {
      daily_login: 5,
      weekly_streak_7: 50,
      monthly_streak_30: 200,
    },
    levels: [
      { level: 1, min_exp: 0, title: 'Novice Learner' },
      { level: 2, min_exp: 100, title: 'Active Explorer' },
      { level: 3, min_exp: 250, title: 'Consistent Builder' },
      { level: 4, min_exp: 500, title: 'Tech Scholar' },
      { level: 5, min_exp: 800, title: 'Lead Innovator' },
      { level: 6, min_exp: 1200, title: 'Master Fellow' },
      { level: 7, min_exp: 1800, title: 'Grand Architect' },
    ],
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, JSON.stringify(v));
  }

  // Seed streak achievements catalog
  const defaultAchievements = [
    {
      id: 'ach-streak-3',
      code: 'streak_3',
      title: '3 Hari Konsisten',
      description: 'Login 3 hari berturut-turut di IT AZRIL CLAS.',
      streak_required: 3,
      exp_reward: 20,
      badge_icon: 'flame',
    },
    {
      id: 'ach-streak-7',
      code: 'streak_7',
      title: 'Pejuang Mingguan',
      description: 'Pertahankan daily login streak selama 7 hari beruntun.',
      streak_required: 7,
      exp_reward: 50,
      badge_icon: 'zap',
    },
    {
      id: 'ach-streak-14',
      code: 'streak_14',
      title: 'Momentum Dua Pekan',
      description: 'Pertahankan daily login streak selama 14 hari beruntun.',
      streak_required: 14,
      exp_reward: 100,
      badge_icon: 'award',
    },
    {
      id: 'ach-streak-30',
      code: 'streak_30',
      title: 'Dedikasi Satu Bulan',
      description: 'Mencapai 30 hari login streak tanpa putus.',
      streak_required: 30,
      exp_reward: 200,
      badge_icon: 'trophy',
    },
    {
      id: 'ach-streak-60',
      code: 'streak_60',
      title: 'Disiplin Elite',
      description: 'Mencapai 60 hari login streak secara konsisten.',
      streak_required: 60,
      exp_reward: 400,
      badge_icon: 'shield',
    },
    {
      id: 'ach-streak-100',
      code: 'streak_100',
      title: 'Legenda 100 Hari',
      description: 'Mencapai 100 hari login streak luar biasa.',
      streak_required: 100,
      exp_reward: 750,
      badge_icon: 'crown',
    },
  ];

  const insertAch = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, code, title, description, streak_required, exp_reward, badge_icon)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of defaultAchievements) {
    insertAch.run(a.id, a.code, a.title, a.description, a.streak_required, a.exp_reward, a.badge_icon);
  }

  // If ADMIN_PASSWORD env is set, ensure single principal admin exists and matches env credentials
  const envAdminPass = process.env.ADMIN_PASSWORD?.trim();
  const envAdminEmail = (process.env.ADMIN_EMAIL?.trim() || 'admin@itazrilclas.ac.id').toLowerCase();
  if (envAdminPass) {
    const existingAdmin = db.prepare(`SELECT id, username, email FROM profiles WHERE role = 'admin'`).get();
    const hashed = hashPasswordSync(envAdminPass);
    if (!existingAdmin) {
      db.prepare(`
        INSERT INTO profiles (id, username, full_name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?, 'admin')
      `).run(crypto.randomUUID(), envAdminEmail, 'Administrator Utama', envAdminEmail, hashed);
    } else {
      db.prepare(`
        UPDATE profiles SET username = ?, email = ?, password_hash = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(envAdminEmail, envAdminEmail, hashed, existingAdmin.id);
    }
  }
}

export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
