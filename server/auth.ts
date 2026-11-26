import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db, withTransaction } from './db.ts';
import type { LevelThreshold, SystemSettings } from '../src/types/index.ts';

const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
export const COOKIE_NAME = 'it_azril_session';

export interface TokenPayload {
  sub: string;
  role: 'admin' | 'student';
  exp: number;
}

export function signSessionToken(profileId: string, role: 'admin' | 'student'): string {
  const payload: TokenPayload = {
    sub: profileId,
    role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.sub || !payload.role || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieAttrs = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isHttps) {
    cookieAttrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    cookieAttrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieAttrs = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
  ];
  if (isHttps) {
    cookieAttrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    cookieAttrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', cookieAttrs.join('; '));
}

function parseCookieToken(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const pairs = raw.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    if (k === COOKIE_NAME) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export interface AuthedRequest extends Request {
  auth?: {
    profileId: string;
    role: 'admin' | 'student';
    username: string;
    fullName: string;
    studentId?: string;
    classId?: string;
    studyProgramId?: string;
  };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  let usedCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = parseCookieToken(req);
    usedCookie = Boolean(token);
  }

  if (!token) {
    res.status(401).json({ error: 'Sesi autentikasi diperlukan. Silakan login terlebih dahulu.' });
    return;
  }

  // CSRF Origin verification on state-changing requests authenticated via cookie
  if (usedCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'Origin tidak valid.' });
          return;
        }
      } catch {
        res.status(403).json({ error: 'Origin tidak valid.' });
        return;
      }
    }
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token sesi tidak valid atau sudah kedaluwarsa.' });
    return;
  }

  const profile = db
    .prepare(`SELECT id, username, full_name, role FROM profiles WHERE id = ?`)
    .get(payload.sub) as { id: string; username: string; full_name: string; role: 'admin' | 'student' } | undefined;

  if (!profile) {
    res.status(401).json({ error: 'Akun tidak ditemukan.' });
    return;
  }

  let studentInfo: { id: string; class_id: string; study_program_id: string } | undefined;
  if (profile.role === 'student') {
    studentInfo = db
      .prepare(`SELECT id, class_id, study_program_id FROM students WHERE profile_id = ?`)
      .get(profile.id) as { id: string; class_id: string; study_program_id: string } | undefined;
  }

  req.auth = {
    profileId: profile.id,
    role: profile.role,
    username: profile.username,
    fullName: profile.full_name,
    studentId: studentInfo?.id,
    classId: studentInfo?.class_id,
    studyProgramId: studentInfo?.study_program_id,
  };

  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Akses ditolak. Hanya administrator utama yang diizinkan.' });
    return;
  }
  next();
}

export function getJakartaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getJakartaYesterdayString(todayJakarta: string): string {
  const [y, m, d] = todayJakarta.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const prev = new Date(utcMidnight - 24 * 60 * 60 * 1000);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const pd = String(prev.getUTCDate()).padStart(2, '0');
  return `${py}-${pm}-${pd}`;
}

export function getSystemSettings(): SystemSettings {
  const rows = db.prepare(`SELECT key, value FROM system_settings`).all() as Array<{ key: string; value: string }>;
  const map: Record<string, any> = {};
  for (const r of rows) {
    try {
      map[r.key] = JSON.parse(r.value);
    } catch {
      // ignore malformed
    }
  }
  return {
    points: map.points ?? {
      hadir: 10,
      izin: 0,
      sakit: 0,
      alpha: 0,
      question: 5,
      critical_question: 10,
      discussion: 5,
    },
    exp: map.exp ?? {
      daily_login: 5,
      weekly_streak_7: 50,
      monthly_streak_30: 200,
    },
    levels: map.levels ?? [
      { level: 1, min_exp: 0, title: 'Novice Learner' },
      { level: 2, min_exp: 100, title: 'Active Explorer' },
      { level: 3, min_exp: 250, title: 'Consistent Builder' },
      { level: 4, min_exp: 500, title: 'Tech Scholar' },
      { level: 5, min_exp: 800, title: 'Lead Innovator' },
    ],
  };
}

export function computeLevel(totalExp: number, levels: LevelThreshold[]): number {
  const sorted = [...levels].sort((a, b) => a.min_exp - b.min_exp);
  let level = 1;
  for (const l of sorted) {
    if (totalExp >= l.min_exp) {
      level = l.level;
    }
  }
  return level;
}

export function recalculateStudentTotals(studentId: string): { totalPoints: number; totalExp: number; currentLevel: number } {
  const ptRow = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM point_transactions WHERE student_id = ?`)
    .get(studentId) as { total: number };
  const expRow = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM exp_transactions WHERE student_id = ?`)
    .get(studentId) as { total: number };

  const settings = getSystemSettings();
  const totalPoints = Number(ptRow?.total ?? 0);
  const totalExp = Number(expRow?.total ?? 0);
  const currentLevel = computeLevel(totalExp, settings.levels);

  db.prepare(`
    UPDATE students
    SET total_points = ?, total_exp = ?, current_level = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(totalPoints, totalExp, currentLevel, studentId);

  return { totalPoints, totalExp, currentLevel };
}

export function createNotification(recipientProfileId: string, title: string, message: string, category: string): void {
  db.prepare(`
    INSERT INTO notifications (id, recipient_profile_id, title, message, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), recipientProfileId, title, message, category);
}

export function logAudit(
  actorProfileId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {}
): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_profile_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), actorProfileId, action, targetType, targetId, JSON.stringify(details));
}

export interface StreakOutcome {
  alreadyLoggedToday: boolean;
  currentStreak: number;
  bestStreak: number;
  totalLoginDays: number;
  expEarnedToday: number;
  unlockedAchievements: string[];
  leveledUpTo: number | null;
}

export function processStudentDailyStreak(studentId: string, profileId: string): StreakOutcome {
  return withTransaction(() => {
    const todayJakarta = getJakartaDateString();
    const yesterdayJakarta = getJakartaYesterdayString(todayJakarta);
    const settings = getSystemSettings();

    const existingToday = db
      .prepare(`SELECT id, streak_day FROM login_history WHERE student_id = ? AND login_date = ?`)
      .get(studentId, todayJakarta) as { id: string; streak_day: number } | undefined;

    let streakRow = db
      .prepare(`SELECT * FROM login_streaks WHERE student_id = ?`)
      .get(studentId) as
      | { id: string; current_streak: number; best_streak: number; total_login_days: number; last_login_date: string | null }
      | undefined;

    if (!streakRow) {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO login_streaks (id, student_id, current_streak, best_streak, total_login_days, last_login_date)
        VALUES (?, ?, 0, 0, 0, NULL)
      `).run(id, studentId);
      streakRow = { id, current_streak: 0, best_streak: 0, total_login_days: 0, last_login_date: null };
    }

    if (existingToday) {
      return {
        alreadyLoggedToday: true,
        currentStreak: streakRow.current_streak,
        bestStreak: streakRow.best_streak,
        totalLoginDays: streakRow.total_login_days,
        expEarnedToday: 0,
        unlockedAchievements: [],
        leveledUpTo: null,
      };
    }

    const prevStudent = db
      .prepare(`SELECT current_level FROM students WHERE id = ?`)
      .get(studentId) as { current_level: number };

    const newStreak =
      streakRow.last_login_date === yesterdayJakarta ? streakRow.current_streak + 1 : 1;
    const newBest = Math.max(streakRow.best_streak, newStreak);
    const newTotalDays = streakRow.total_login_days + 1;

    db.prepare(`
      UPDATE login_streaks
      SET current_streak = ?, best_streak = ?, total_login_days = ?, last_login_date = ?, updated_at = datetime('now')
      WHERE student_id = ?
    `).run(newStreak, newBest, newTotalDays, todayJakarta, studentId);

    db.prepare(`
      INSERT INTO login_history (id, student_id, login_date, streak_day)
      VALUES (?, ?, ?, ?)
    `).run(crypto.randomUUID(), studentId, todayJakarta, newStreak);

    let expEarnedToday = 0;

    // Daily Login EXP (idempotent via reference_key)
    const dailyExp = Math.max(0, Number(settings.exp.daily_login ?? 5));
    if (dailyExp > 0) {
      const res = db
        .prepare(`
          INSERT OR IGNORE INTO exp_transactions (id, student_id, amount, source, description, reference_key)
          VALUES (?, ?, ?, 'daily_login', ?, ?)
        `)
        .run(
          crypto.randomUUID(),
          studentId,
          dailyExp,
          `Login harian (${todayJakarta}) — Streak Hari ke-${newStreak}`,
          `daily_login:${todayJakarta}`
        );
      if (res.changes > 0) expEarnedToday += dailyExp;
    }

    // Weekly 7-day milestone bonus (anti-duplication per exact cycle day)
    if (newStreak > 0 && newStreak % 7 === 0) {
      const weeklyBonus = Math.max(0, Number(settings.exp.weekly_streak_7 ?? 50));
      if (weeklyBonus > 0) {
        const res = db
          .prepare(`
            INSERT OR IGNORE INTO exp_transactions (id, student_id, amount, source, description, reference_key)
            VALUES (?, ?, ?, 'weekly_streak', ?, ?)
          `)
          .run(
            crypto.randomUUID(),
            studentId,
            weeklyBonus,
            `Bonus konsistensi mingguan (${newStreak} hari streak)`,
            `weekly_streak:${todayJakarta}`
          );
        if (res.changes > 0) {
          expEarnedToday += weeklyBonus;
          createNotification(
            profileId,
            'Bonus Streak Mingguan!',
            `Selamat! Anda mempertahankan ${newStreak} hari streak beruntun dan meraih +${weeklyBonus} EXP.`,
            'reward'
          );
        }
      }
    }

    // Monthly 30-day milestone bonus
    if (newStreak > 0 && newStreak % 30 === 0) {
      const monthlyBonus = Math.max(0, Number(settings.exp.monthly_streak_30 ?? 200));
      if (monthlyBonus > 0) {
        const res = db
          .prepare(`
            INSERT OR IGNORE INTO exp_transactions (id, student_id, amount, source, description, reference_key)
            VALUES (?, ?, ?, 'monthly_streak', ?, ?)
          `)
          .run(
            crypto.randomUUID(),
            studentId,
            monthlyBonus,
            `Bonus konsistensi bulanan (${newStreak} hari streak)`,
            `monthly_streak:${todayJakarta}`
          );
        if (res.changes > 0) {
          expEarnedToday += monthlyBonus;
          createNotification(
            profileId,
            'Bonus Streak Bulanan!',
            `Luar biasa! Anda mencapai ${newStreak} hari streak dan mendapatkan +${monthlyBonus} EXP.`,
            'reward'
          );
        }
      }
    }

    // Check one-time milestone achievements (3, 7, 14, 30, 60, 100)
    const eligibleAchievements = db
      .prepare(`SELECT * FROM achievements WHERE streak_required <= ? ORDER BY streak_required ASC`)
      .all(newStreak) as Array<{
      id: string;
      code: string;
      title: string;
      exp_reward: number;
    }>;

    const unlockedAchievements: string[] = [];
    for (const ach of eligibleAchievements) {
      const unlockRes = db
        .prepare(`
          INSERT OR IGNORE INTO student_achievements (id, student_id, achievement_id)
          VALUES (?, ?, ?)
        `)
        .run(crypto.randomUUID(), studentId, ach.id);

      if (unlockRes.changes > 0) {
        unlockedAchievements.push(ach.title);
        if (ach.exp_reward > 0) {
          const expRes = db
            .prepare(`
              INSERT OR IGNORE INTO exp_transactions (id, student_id, amount, source, description, reference_key)
              VALUES (?, ?, ?, 'achievement', ?, ?)
            `)
            .run(
              crypto.randomUUID(),
              studentId,
              ach.exp_reward,
              `Pencapaian terbuka: ${ach.title}`,
              `achievement:${ach.code}`
            );
          if (expRes.changes > 0) expEarnedToday += ach.exp_reward;
        }
        createNotification(
          profileId,
          `Pencapaian Terbuka: ${ach.title}`,
          `Anda membuka pencapaian "${ach.title}" dan menerima +${ach.exp_reward} EXP!`,
          'achievement'
        );
      }
    }

    const updated = recalculateStudentTotals(studentId);
    const leveledUpTo = updated.currentLevel > prevStudent.current_level ? updated.currentLevel : null;

    createNotification(
      profileId,
      `Streak Hari ke-${newStreak}!`,
      `Login harian tercatat (${todayJakarta}). Anda mendapatkan +${dailyExp} EXP.`,
      'streak'
    );

    if (leveledUpTo) {
      createNotification(
        profileId,
        `Naik ke Level ${leveledUpTo}!`,
        `Total EXP Anda kini ${updated.totalExp} EXP. Terus pertahankan konsistensi belajar Anda.`,
        'level_up'
      );
    }

    return {
      alreadyLoggedToday: false,
      currentStreak: newStreak,
      bestStreak: newBest,
      totalLoginDays: newTotalDays,
      expEarnedToday,
      unlockedAchievements,
      leveledUpTo,
    };
  });
}
