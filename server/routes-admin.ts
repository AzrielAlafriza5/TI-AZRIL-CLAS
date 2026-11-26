import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db, hashPasswordSync, withTransaction } from './db.ts';
import {
  type AuthedRequest,
  createNotification,
  getJakartaDateString,
  getSystemSettings,
  logAudit,
  recalculateStudentTotals,
  requireAdmin,
  requireAuth,
} from './auth.ts';
import type { AttendanceStatus, StudentStatus } from '../src/types/index.ts';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function getPeriodCutoff(period: string): string | null {
  const now = new Date();
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  }
  if (period === '30d') {
    return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  }
  if (period === '90d') {
    return new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// DASHBOARD ANALYTICS
// ---------------------------------------------------------------------------
adminRouter.get('/dashboard', (req, res) => {
  const studyProgramId = String(req.query.studyProgramId ?? '').trim();
  const classId = String(req.query.classId ?? '').trim();
  const period = String(req.query.period ?? '30d').trim();
  const cutoffDate = getPeriodCutoff(period);

  const studentFilters: string[] = [];
  const studentParams: Array<string | number | null> = [];
  if (studyProgramId) {
    studentFilters.push('s.study_program_id = ?');
    studentParams.push(studyProgramId);
  }
  if (classId) {
    studentFilters.push('s.class_id = ?');
    studentParams.push(classId);
  }
  const whereStudent = studentFilters.length ? `WHERE ${studentFilters.join(' AND ')}` : '';

  const totalStudents = Number(
    (db.prepare(`SELECT COUNT(*) AS c FROM students s ${whereStudent}`).get(...studentParams) as { c: number }).c
  );
  const totalPrograms = Number(
    (db.prepare(`SELECT COUNT(*) AS c FROM study_programs`).get() as { c: number }).c
  );
  const totalClasses = Number(
    (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM classes ${studyProgramId ? 'WHERE study_program_id = ?' : ''}`
        )
        .get(...(studyProgramId ? [studyProgramId] : [])) as { c: number }
    ).c
  );

  const statusCountsRaw = db
    .prepare(`SELECT s.status, COUNT(*) AS c FROM students s ${whereStudent} GROUP BY s.status`)
    .all(...studentParams) as Array<{ status: StudentStatus; c: number }>;
  const statusCounts = { hijau: 0, netral: 0, merah: 0 };
  for (const row of statusCountsRaw) {
    statusCounts[row.status] = Number(row.c);
  }

  const assignmentCountRow = classId
    ? (db
        .prepare(`SELECT COUNT(DISTINCT assignment_id) AS c FROM assignment_targets WHERE class_id = ?`)
        .get(classId) as { c: number })
    : studyProgramId
      ? (db
          .prepare(`SELECT COUNT(DISTINCT assignment_id) AS c FROM assignment_targets WHERE study_program_id = ?`)
          .get(studyProgramId) as { c: number })
      : (db.prepare(`SELECT COUNT(*) AS c FROM assignments`).get() as { c: number });
  const totalAssignments = Number(assignmentCountRow.c);

  const subFilters: string[] = [...studentFilters];
  const subParams: Array<string | number | null> = [...studentParams];
  if (cutoffDate) {
    subFilters.push(`date(sub.submitted_at) >= ?`);
    subParams.push(cutoffDate);
  }
  const whereSub = subFilters.length ? `WHERE ${subFilters.join(' AND ')}` : '';
  const totalSubmissions = Number(
    (
      db
        .prepare(`
          SELECT COUNT(*) AS c
          FROM submissions sub
          JOIN students s ON s.id = sub.student_id
          ${whereSub}
        `)
        .get(...subParams) as { c: number }
    ).c
  );

  // Totals for Points, EXP, Streaks
  const aggRow = db
    .prepare(`
      SELECT
        COALESCE(SUM(s.total_points), 0) AS sum_points,
        COALESCE(SUM(s.total_exp), 0) AS sum_exp,
        COALESCE(AVG(COALESCE(ls.current_streak, 0)), 0) AS avg_streak,
        COALESCE(MAX(COALESCE(ls.current_streak, 0)), 0) AS max_streak
      FROM students s
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ${whereStudent}
    `)
    .get(...studentParams) as {
    sum_points: number;
    sum_exp: number;
    avg_streak: number;
    max_streak: number;
  };

  const todayJakarta = getJakartaDateString();
  const activeTodayRow = db
    .prepare(`
      SELECT COUNT(DISTINCT lh.student_id) AS c
      FROM login_history lh
      JOIN students s ON s.id = lh.student_id
      ${whereStudent ? `${whereStudent} AND` : 'WHERE'} lh.login_date = ?
    `)
    .get(...studentParams, todayJakarta) as { c: number };

  // Attendance stats
  const attFilters: string[] = [...studentFilters];
  const attParams: Array<string | number | null> = [...studentParams];
  if (cutoffDate) {
    attFilters.push(`a.attendance_date >= ?`);
    attParams.push(cutoffDate);
  }
  const whereAtt = attFilters.length ? `WHERE ${attFilters.join(' AND ')}` : '';
  const attSummaryRows = db
    .prepare(`
      SELECT a.status, COUNT(*) AS c
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      ${whereAtt}
      GROUP BY a.status
    `)
    .all(...attParams) as Array<{ status: AttendanceStatus; c: number }>;
  const attendanceStats = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0, rate: 0 };
  for (const r of attSummaryRows) {
    attendanceStats[r.status] = Number(r.c);
    attendanceStats.total += Number(r.c);
  }
  attendanceStats.rate =
    attendanceStats.total > 0 ? Math.round((attendanceStats.hadir / attendanceStats.total) * 100) : 0;

  // Top Leaders (Points, EXP, Consistency)
  const topPoints = db
    .prepare(`
      SELECT s.id, s.nim, s.full_name, s.total_points, c.name AS class_name
      FROM students s
      JOIN classes c ON c.id = s.class_id
      ${whereStudent}
      ORDER BY s.total_points DESC, s.full_name ASC
      LIMIT 1
    `)
    .get(...studentParams) ?? null;

  const topExp = db
    .prepare(`
      SELECT s.id, s.nim, s.full_name, s.total_exp, s.current_level, c.name AS class_name
      FROM students s
      JOIN classes c ON c.id = s.class_id
      ${whereStudent}
      ORDER BY s.total_exp DESC, s.full_name ASC
      LIMIT 1
    `)
    .get(...studentParams) ?? null;

  const topStreak = db
    .prepare(`
      SELECT s.id, s.nim, s.full_name, COALESCE(ls.current_streak, 0) AS current_streak,
             COALESCE(ls.best_streak, 0) AS best_streak, c.name AS class_name
      FROM students s
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ${whereStudent}
      ORDER BY COALESCE(ls.current_streak, 0) DESC, COALESCE(ls.best_streak, 0) DESC
      LIMIT 1
    `)
    .get(...studentParams) ?? null;

  // Chart 1: Points Progress by date
  const ptFilters: string[] = [...studentFilters];
  const ptParams: Array<string | number | null> = [...studentParams];
  if (cutoffDate) {
    ptFilters.push(`date(pt.created_at) >= ?`);
    ptParams.push(cutoffDate);
  }
  const wherePt = ptFilters.length ? `WHERE ${ptFilters.join(' AND ')}` : '';
  const pointsChart = db
    .prepare(`
      SELECT date(pt.created_at) AS date, SUM(pt.amount) AS points
      FROM point_transactions pt
      JOIN students s ON s.id = pt.student_id
      ${wherePt}
      GROUP BY date(pt.created_at)
      ORDER BY date ASC
      LIMIT 30
    `)
    .all(...ptParams);

  // Chart 2: Attendance by date
  const attendanceChart = db
    .prepare(`
      SELECT a.attendance_date AS date,
             SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS hadir,
             SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) AS izin,
             SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
             SUM(CASE WHEN a.status = 'alpha' THEN 1 ELSE 0 END) AS alpha
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      ${whereAtt}
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date ASC
      LIMIT 20
    `)
    .all(...attParams);

  // Chart 3: Assignment Submissions by assignment
  const submissionChart = db
    .prepare(`
      SELECT a.title AS name,
             SUM(CASE WHEN sub.status IN ('submitted', 'graded') THEN 1 ELSE 0 END) AS tepat_waktu,
             SUM(CASE WHEN sub.status = 'late' THEN 1 ELSE 0 END) AS terlambat,
             SUM(CASE WHEN sub.status = 'revision' THEN 1 ELSE 0 END) AS revisi
      FROM assignments a
      LEFT JOIN submissions sub ON sub.assignment_id = a.id
      LEFT JOIN students s ON s.id = sub.student_id
      ${whereStudent}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT 8
    `)
    .all(...studentParams);

  // Chart 4: Student Activity (daily logins + submissions + material completions)
  const lhFilters: string[] = [...studentFilters];
  const lhParams: Array<string | number | null> = [...studentParams];
  if (cutoffDate) {
    lhFilters.push(`lh.login_date >= ?`);
    lhParams.push(cutoffDate);
  }
  const whereLh = lhFilters.length ? `WHERE ${lhFilters.join(' AND ')}` : '';
  const activityChart = db
    .prepare(`
      SELECT lh.login_date AS date, COUNT(*) AS logins
      FROM login_history lh
      JOIN students s ON s.id = lh.student_id
      ${whereLh}
      GROUP BY lh.login_date
      ORDER BY lh.login_date ASC
      LIMIT 30
    `)
    .all(...lhParams);

  // Chart 5: Streak Distribution
  const streakDistribution = db
    .prepare(`
      SELECT
        CASE
          WHEN COALESCE(ls.current_streak, 0) = 0 THEN '0 Hari'
          WHEN ls.current_streak BETWEEN 1 AND 3 THEN '1-3 Hari'
          WHEN ls.current_streak BETWEEN 4 AND 7 THEN '4-7 Hari'
          WHEN ls.current_streak BETWEEN 8 AND 14 THEN '8-14 Hari'
          ELSE '15+ Hari'
        END AS bucket,
        COUNT(*) AS count
      FROM students s
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ${whereStudent}
      GROUP BY bucket
    `)
    .all(...studentParams);

  res.json({
    kpis: {
      totalStudents,
      totalPrograms,
      totalClasses,
      statusCounts,
      totalAssignments,
      totalSubmissions,
      attendanceStats,
      totalPoints: Number(aggRow.sum_points),
      totalExp: Number(aggRow.sum_exp),
      avgStreak: Math.round(Number(aggRow.avg_streak) * 10) / 10,
      maxStreak: Number(aggRow.max_streak),
      activeToday: Number(activeTodayRow?.c ?? 0),
    },
    leaders: {
      topPoints,
      topExp,
      topStreak,
    },
    charts: {
      pointsChart,
      attendanceChart,
      submissionChart,
      activityChart,
      streakDistribution,
    },
  });
});

// ---------------------------------------------------------------------------
// STUDY PROGRAMS & CLASSES
// ---------------------------------------------------------------------------
adminRouter.get('/study-programs', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT sp.*,
        (SELECT COUNT(*) FROM classes c WHERE c.study_program_id = sp.id) AS class_count,
        (SELECT COUNT(*) FROM students s WHERE s.study_program_id = sp.id) AS student_count
      FROM study_programs sp
      ORDER BY sp.name ASC
    `)
    .all();
  res.json({ programs: rows });
});

adminRouter.post('/study-programs', (req: AuthedRequest, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama program studi wajib diisi.' });
    return;
  }
  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO study_programs (id, code, name, description)
      VALUES (?, ?, ?, ?)
    `).run(id, code, name, description);
    logAudit(req.auth!.profileId, 'CREATE_STUDY_PROGRAM', 'study_program', id, { code, name });
    res.status(201).json({ id, code, name, description });
  } catch {
    res.status(409).json({ error: 'Kode program studi sudah digunakan.' });
  }
});

adminRouter.patch('/study-programs/:id', (req: AuthedRequest, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!code || !name) {
    res.status(400).json({ error: 'Kode dan nama program studi wajib diisi.' });
    return;
  }
  try {
    const info = db
      .prepare(`
        UPDATE study_programs
        SET code = ?, name = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      .run(code, name, description, req.params.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Program studi tidak ditemukan.' });
      return;
    }
    logAudit(req.auth!.profileId, 'UPDATE_STUDY_PROGRAM', 'study_program', req.params.id, { code, name });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Kode program studi sudah digunakan.' });
  }
});

adminRouter.delete('/study-programs/:id', (req: AuthedRequest, res) => {
  const hasClasses = db
    .prepare(`SELECT id FROM classes WHERE study_program_id = ? LIMIT 1`)
    .get(req.params.id);
  if (hasClasses) {
    res.status(400).json({ error: 'Tidak dapat menghapus program studi yang masih memiliki kelas aktif.' });
    return;
  }
  db.prepare(`DELETE FROM study_programs WHERE id = ?`).run(req.params.id);
  logAudit(req.auth!.profileId, 'DELETE_STUDY_PROGRAM', 'study_program', req.params.id);
  res.json({ ok: true });
});

adminRouter.get('/classes', (req, res) => {
  const studyProgramId = String(req.query.studyProgramId ?? '').trim();
  const where = studyProgramId ? 'WHERE c.study_program_id = ?' : '';
  const rows = db
    .prepare(`
      SELECT c.*, sp.name AS study_program_name, sp.code AS study_program_code,
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
      FROM classes c
      JOIN study_programs sp ON sp.id = c.study_program_id
      ${where}
      ORDER BY sp.name ASC, c.name ASC
    `)
    .all(...(studyProgramId ? [studyProgramId] : []));
  res.json({ classes: rows });
});

adminRouter.post('/classes', (req: AuthedRequest, res) => {
  const studyProgramId = String(req.body?.study_program_id ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const academicYear = String(req.body?.academic_year ?? '2026/2027').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!studyProgramId || !name) {
    res.status(400).json({ error: 'Program studi dan nama kelas wajib diisi.' });
    return;
  }
  const id = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO classes (id, study_program_id, name, academic_year, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, studyProgramId, name, academicYear, description);
    logAudit(req.auth!.profileId, 'CREATE_CLASS', 'class', id, { name, studyProgramId });
    res.status(201).json({ id, study_program_id: studyProgramId, name, academic_year: academicYear, description });
  } catch {
    res.status(409).json({ error: 'Kelas dengan nama tersebut sudah ada pada program studi ini.' });
  }
});

adminRouter.patch('/classes/:id', (req: AuthedRequest, res) => {
  const studyProgramId = String(req.body?.study_program_id ?? '').trim();
  const name = String(req.body?.name ?? '').trim();
  const academicYear = String(req.body?.academic_year ?? '2026/2027').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!studyProgramId || !name) {
    res.status(400).json({ error: 'Program studi dan nama kelas wajib diisi.' });
    return;
  }
  try {
    db.prepare(`
      UPDATE classes
      SET study_program_id = ?, name = ?, academic_year = ?, description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(studyProgramId, name, academicYear, description, req.params.id);
    logAudit(req.auth!.profileId, 'UPDATE_CLASS', 'class', req.params.id, { name });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Nama kelas sudah ada pada program studi tersebut.' });
  }
});

adminRouter.delete('/classes/:id', (req: AuthedRequest, res) => {
  const hasStudents = db.prepare(`SELECT id FROM students WHERE class_id = ? LIMIT 1`).get(req.params.id);
  if (hasStudents) {
    res.status(400).json({ error: 'Tidak dapat menghapus kelas yang masih memiliki mahasiswa.' });
    return;
  }
  db.prepare(`DELETE FROM classes WHERE id = ?`).run(req.params.id);
  logAudit(req.auth!.profileId, 'DELETE_CLASS', 'class', req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// STUDENTS MANAGEMENT
// ---------------------------------------------------------------------------
adminRouter.get('/students', (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const studyProgramId = String(req.query.studyProgramId ?? '').trim();
  const classId = String(req.query.classId ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 15)));
  const offset = (page - 1) * limit;

  const filters: string[] = [];
  const params: Array<string | number | null> = [];

  if (search) {
    filters.push(`(LOWER(s.full_name) LIKE ? OR LOWER(s.nim) LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`);
  }
  if (studyProgramId) {
    filters.push(`s.study_program_id = ?`);
    params.push(studyProgramId);
  }
  if (classId) {
    filters.push(`s.class_id = ?`);
    params.push(classId);
  }
  if (status && ['hijau', 'netral', 'merah'].includes(status)) {
    filters.push(`s.status = ?`);
    params.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM students s ${where}`)
    .get(...params) as { c: number };

  const rows = db
    .prepare(`
      SELECT s.*, sp.name AS study_program_name, sp.code AS study_program_code,
             c.name AS class_name,
             COALESCE(ls.current_streak, 0) AS current_streak,
             COALESCE(ls.best_streak, 0) AS best_streak,
             COALESCE(ls.total_login_days, 0) AS total_login_days,
             ls.last_login_date
      FROM students s
      JOIN study_programs sp ON sp.id = s.study_program_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  res.json({
    students: rows,
    pagination: {
      page,
      limit,
      total: Number(totalRow.c),
      totalPages: Math.max(1, Math.ceil(Number(totalRow.c) / limit)),
    },
  });
});

adminRouter.post('/students', (req: AuthedRequest, res) => {
  const fullName = String(req.body?.full_name ?? '').trim();
  const nim = String(req.body?.nim ?? '').trim();
  const studyProgramId = String(req.body?.study_program_id ?? '').trim();
  const classId = String(req.body?.class_id ?? '').trim();

  if (!fullName || !nim || !studyProgramId || !classId) {
    res.status(400).json({ error: 'Nama lengkap, NIM, program studi, dan kelas wajib diisi.' });
    return;
  }

  const classObj = db
    .prepare(`SELECT id, study_program_id FROM classes WHERE id = ?`)
    .get(classId) as { id: string; study_program_id: string } | undefined;
  if (!classObj || classObj.study_program_id !== studyProgramId) {
    res.status(400).json({ error: 'Kelas tidak valid untuk program studi yang dipilih.' });
    return;
  }

  const profileId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  // Username = NIM, Initial Password = NIM (hashed cleanly with scrypt)
  const passwordHash = hashPasswordSync(nim);

  try {
    withTransaction(() => {
      db.prepare(`
        INSERT INTO profiles (id, username, full_name, email, password_hash, role)
        VALUES (?, ?, ?, NULL, ?, 'student')
      `).run(profileId, nim, fullName, passwordHash);

      db.prepare(`
        INSERT INTO students (id, profile_id, nim, full_name, study_program_id, class_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 'netral')
      `).run(studentId, profileId, nim, fullName, studyProgramId, classId);

      db.prepare(`
        INSERT INTO login_streaks (id, student_id, current_streak, best_streak, total_login_days)
        VALUES (?, ?, 0, 0, 0)
      `).run(crypto.randomUUID(), studentId);

      logAudit(req.auth!.profileId, 'CREATE_STUDENT', 'student', studentId, { nim, fullName, classId });
    });

    res.status(201).json({
      id: studentId,
      profile_id: profileId,
      nim,
      full_name: fullName,
      initial_credentials: { username: nim, initial_password_hint: 'Sama dengan NIM' },
    });
  } catch {
    res.status(409).json({ error: `NIM "${nim}" sudah terdaftar dalam sistem.` });
  }
});

adminRouter.get('/students/:id', (req, res) => {
  const student = db
    .prepare(`
      SELECT s.*, sp.name AS study_program_name, sp.code AS study_program_code,
             c.name AS class_name,
             COALESCE(ls.current_streak, 0) AS current_streak,
             COALESCE(ls.best_streak, 0) AS best_streak,
             COALESCE(ls.total_login_days, 0) AS total_login_days,
             ls.last_login_date
      FROM students s
      JOIN study_programs sp ON sp.id = s.study_program_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      WHERE s.id = ?
    `)
    .get(req.params.id);

  if (!student) {
    res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
    return;
  }

  const points = db
    .prepare(`
      SELECT pt.*, p.full_name AS admin_name
      FROM point_transactions pt
      LEFT JOIN profiles p ON p.id = pt.admin_id
      WHERE pt.student_id = ?
      ORDER BY pt.created_at DESC
    `)
    .all(req.params.id);

  const exp = db
    .prepare(`
      SELECT * FROM exp_transactions
      WHERE student_id = ?
      ORDER BY created_at DESC
    `)
    .all(req.params.id);

  const attendance = db
    .prepare(`
      SELECT a.*, c.name AS class_name
      FROM attendance a
      JOIN classes c ON c.id = a.class_id
      WHERE a.student_id = ?
      ORDER BY a.attendance_date DESC, a.meeting_number DESC
    `)
    .all(req.params.id);

  const submissions = db
    .prepare(`
      SELECT sub.*, a.title AS assignment_title, a.deadline, a.max_points
      FROM submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      WHERE sub.student_id = ?
      ORDER BY sub.submitted_at DESC
    `)
    .all(req.params.id);

  const loginHistory = db
    .prepare(`
      SELECT * FROM login_history
      WHERE student_id = ?
      ORDER BY login_date DESC
      LIMIT 60
    `)
    .all(req.params.id);

  const statusHistory = db
    .prepare(`
      SELECT ssh.*, p.full_name AS changed_by_name
      FROM student_status_history ssh
      LEFT JOIN profiles p ON p.id = ssh.changed_by
      WHERE ssh.student_id = ?
      ORDER BY ssh.created_at DESC
    `)
    .all(req.params.id);

  res.json({
    student,
    points,
    exp,
    attendance,
    submissions,
    loginHistory,
    statusHistory,
  });
});

adminRouter.patch('/students/:id', (req: AuthedRequest, res) => {
  const student = db.prepare(`SELECT * FROM students WHERE id = ?`).get(req.params.id) as
    | { id: string; profile_id: string; nim: string; full_name: string; study_program_id: string; class_id: string }
    | undefined;
  if (!student) {
    res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
    return;
  }

  const fullName = String(req.body?.full_name ?? student.full_name).trim();
  const nim = String(req.body?.nim ?? student.nim).trim();
  const studyProgramId = String(req.body?.study_program_id ?? student.study_program_id).trim();
  const classId = String(req.body?.class_id ?? student.class_id).trim();

  if (!fullName || !nim) {
    res.status(400).json({ error: 'Nama dan NIM tidak boleh kosong.' });
    return;
  }

  const classObj = db
    .prepare(`SELECT id, study_program_id FROM classes WHERE id = ?`)
    .get(classId) as { id: string; study_program_id: string } | undefined;
  if (!classObj || classObj.study_program_id !== studyProgramId) {
    res.status(400).json({ error: 'Kelas tidak valid untuk program studi yang dipilih.' });
    return;
  }

  try {
    withTransaction(() => {
      db.prepare(`
        UPDATE profiles SET username = ?, full_name = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(nim, fullName, student.profile_id);

      db.prepare(`
        UPDATE students
        SET nim = ?, full_name = ?, study_program_id = ?, class_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(nim, fullName, studyProgramId, classId, student.id);

      logAudit(req.auth!.profileId, 'UPDATE_STUDENT', 'student', student.id, { nim, fullName, classId });
    });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'NIM sudah digunakan oleh mahasiswa lain.' });
  }
});

adminRouter.delete('/students/:id', (req: AuthedRequest, res) => {
  const student = db.prepare(`SELECT profile_id, nim, full_name FROM students WHERE id = ?`).get(req.params.id) as
    | { profile_id: string; nim: string; full_name: string }
    | undefined;
  if (!student) {
    res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
    return;
  }
  db.prepare(`DELETE FROM profiles WHERE id = ?`).run(student.profile_id);
  logAudit(req.auth!.profileId, 'DELETE_STUDENT', 'student', req.params.id, { nim: student.nim, name: student.full_name });
  res.json({ ok: true });
});

adminRouter.post('/students/:id/reset-password', (req: AuthedRequest, res) => {
  const student = db
    .prepare(`SELECT id, profile_id, nim, full_name FROM students WHERE id = ?`)
    .get(req.params.id) as { id: string; profile_id: string; nim: string; full_name: string } | undefined;
  if (!student) {
    res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
    return;
  }

  const customPassword = String(req.body?.new_password ?? '').trim();
  const targetPassword = customPassword || student.nim;
  if (targetPassword.length < 4) {
    res.status(400).json({ error: 'Password minimal 4 karakter.' });
    return;
  }

  const hashed = hashPasswordSync(targetPassword);
  db.prepare(`UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
    hashed,
    student.profile_id
  );
  logAudit(req.auth!.profileId, 'RESET_STUDENT_PASSWORD', 'student', student.id, {
    nim: student.nim,
    resetToNim: !customPassword,
  });
  res.json({
    ok: true,
    message: customPassword
      ? `Password untuk ${student.full_name} berhasil diperbarui.`
      : `Password untuk ${student.full_name} berhasil direset ke NIM (${student.nim}).`,
  });
});

// ---------------------------------------------------------------------------
// STUDENT STATUS (MANUAL & EXCEL IMPORT)
// ---------------------------------------------------------------------------
adminRouter.patch('/students/:id/status', (req: AuthedRequest, res) => {
  const newStatus = String(req.body?.status ?? '').trim() as StudentStatus;
  const reason = String(req.body?.reason ?? '').trim();
  if (!['hijau', 'netral', 'merah'].includes(newStatus)) {
    res.status(400).json({ error: 'Status harus hijau, netral, atau merah.' });
    return;
  }
  const student = db
    .prepare(`SELECT id, profile_id, status, full_name FROM students WHERE id = ?`)
    .get(req.params.id) as { id: string; profile_id: string; status: StudentStatus; full_name: string } | undefined;
  if (!student) {
    res.status(404).json({ error: 'Mahasiswa tidak ditemukan.' });
    return;
  }

  withTransaction(() => {
    db.prepare(`UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      newStatus,
      student.id
    );
    db.prepare(`
      INSERT INTO student_status_history (id, student_id, previous_status, new_status, reason, source, changed_by)
      VALUES (?, ?, ?, ?, ?, 'manual', ?)
    `).run(crypto.randomUUID(), student.id, student.status, newStatus, reason, req.auth!.profileId);

    const statusLabel =
      newStatus === 'hijau' ? 'HIJAU — LULUS' : newStatus === 'merah' ? 'MERAH — TIDAK AKTIF / AFK' : 'NETRAL — AKTIF';
    createNotification(
      student.profile_id,
      'Perubahan Status Akademik',
      `Status Anda diperbarui menjadi ${statusLabel}.${reason ? ` Catatan: ${reason}` : ''}`,
      'status'
    );
    logAudit(req.auth!.profileId, 'UPDATE_STUDENT_STATUS', 'student', student.id, {
      from: student.status,
      to: newStatus,
      reason,
    });
  });

  res.json({ ok: true });
});

adminRouter.get('/status-history', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT ssh.*, s.nim, s.full_name AS student_name, c.name AS class_name, p.full_name AS changed_by_name
      FROM student_status_history ssh
      JOIN students s ON s.id = ssh.student_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN profiles p ON p.id = ssh.changed_by
      ORDER BY ssh.created_at DESC
      LIMIT 100
    `)
    .all();
  res.json({ history: rows });
});

function normalizeStatusInput(raw: string): StudentStatus | null {
  const s = raw.trim().toLowerCase();
  if (['hijau', 'lulus', 'green', 'passed'].includes(s)) return 'hijau';
  if (['netral', 'aktif', 'neutral', 'active'].includes(s)) return 'netral';
  if (['merah', 'tidak aktif', 'afk', 'nonaktif', 'red', 'inactive'].includes(s)) return 'merah';
  return null;
}

adminRouter.post('/import/status/preview', uploadMemory.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File Excel (.xlsx / .xls / .csv) wajib diunggah.' });
    return;
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const seenNims = new Set<string>();
  const previewRows = rawRows.map((row, idx) => {
    const keys = Object.keys(row);
    const nimKey = keys.find((k) => k.trim().toLowerCase() === 'nim') ?? keys.find((k) => k.toLowerCase().includes('nim'));
    const statusKey =
      keys.find((k) => k.trim().toLowerCase() === 'status') ?? keys.find((k) => k.toLowerCase().includes('status'));
    const reasonKey = keys.find((k) => ['keterangan', 'catatan', 'reason'].includes(k.trim().toLowerCase()));

    const nim = nimKey ? String(row[nimKey]).trim() : '';
    const rawStatus = statusKey ? String(row[statusKey]).trim() : '';
    const reason = reasonKey ? String(row[reasonKey]).trim() : 'Pembaruan melalui Impor Excel';
    const parsedStatus = normalizeStatusInput(rawStatus);

    if (!nim) {
      return { rowNumber: idx + 2, nim: '', rawStatus, reason, matchState: 'invalid', error: 'Kolom NIM kosong' };
    }
    if (seenNims.has(nim)) {
      return { rowNumber: idx + 2, nim, rawStatus, reason, matchState: 'duplicate', error: 'NIM duplikat di dalam file' };
    }
    seenNims.add(nim);

    const student = db
      .prepare(`
        SELECT s.id, s.nim, s.full_name, s.status, c.name AS class_name
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE s.nim = ?
      `)
      .get(nim) as
      | { id: string; nim: string; full_name: string; status: StudentStatus; class_name: string }
      | undefined;

    if (!student) {
      return { rowNumber: idx + 2, nim, rawStatus, reason, matchState: 'not_found', error: 'NIM tidak ditemukan' };
    }
    if (!parsedStatus) {
      return {
        rowNumber: idx + 2,
        nim,
        student_id: student.id,
        full_name: student.full_name,
        class_name: student.class_name,
        current_status: student.status,
        rawStatus,
        reason,
        matchState: 'invalid',
        error: `Status "${rawStatus}" tidak dikenali (gunakan Hijau/Lulus, Netral/Aktif, Merah/AFK)`,
      };
    }

    return {
      rowNumber: idx + 2,
      nim,
      student_id: student.id,
      full_name: student.full_name,
      class_name: student.class_name,
      current_status: student.status,
      new_status: parsedStatus,
      reason,
      matchState: 'matched',
    };
  });

  res.json({
    fileName: req.file.originalname,
    rows: previewRows,
    summary: {
      total: previewRows.length,
      matched: previewRows.filter((r) => r.matchState === 'matched').length,
      notFound: previewRows.filter((r) => r.matchState === 'not_found').length,
      duplicates: previewRows.filter((r) => r.matchState === 'duplicate').length,
      invalid: previewRows.filter((r) => r.matchState === 'invalid').length,
    },
  });
});

adminRouter.post('/import/status/commit', (req: AuthedRequest, res) => {
  const fileName = String(req.body?.fileName ?? 'status_import.xlsx');
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const validRows = rows.filter(
    (r: any) => r.matchState === 'matched' && r.student_id && ['hijau', 'netral', 'merah'].includes(r.new_status)
  );

  if (validRows.length === 0) {
    res.status(400).json({ error: 'Tidak ada baris valid untuk disimpan.' });
    return;
  }

  let updatedCount = 0;
  withTransaction(() => {
    for (const r of validRows) {
      const student = db
        .prepare(`SELECT id, profile_id, status FROM students WHERE id = ?`)
        .get(r.student_id) as { id: string; profile_id: string; status: StudentStatus } | undefined;
      if (!student) continue;

      if (student.status !== r.new_status) {
        db.prepare(`UPDATE students SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
          r.new_status,
          student.id
        );
        db.prepare(`
          INSERT INTO student_status_history (id, student_id, previous_status, new_status, reason, source, changed_by)
          VALUES (?, ?, ?, ?, ?, 'excel', ?)
        `).run(
          crypto.randomUUID(),
          student.id,
          student.status,
          r.new_status,
          String(r.reason ?? 'Pembaruan melalui Impor Excel'),
          req.auth!.profileId
        );
        createNotification(
          student.profile_id,
          'Status Akademik Diperbarui',
          `Status mahasiswa Anda diubah menjadi ${String(r.new_status).toUpperCase()} melalui pembaruan data kelas.`,
          'status'
        );
        updatedCount++;
      }
    }

    const importId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO excel_import_history (id, import_type, file_name, total_rows, matched_rows, skipped_rows, error_rows, summary_json, imported_by)
      VALUES (?, 'student_status', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      importId,
      fileName,
      rows.length,
      validRows.length,
      rows.length - validRows.length,
      rows.filter((r: any) => r.matchState !== 'matched').length,
      JSON.stringify({ updatedCount }),
      req.auth!.profileId
    );

    createNotification(
      req.auth!.profileId,
      'Impor Status Mahasiswa Selesai',
      `${updatedCount} status mahasiswa berhasil diperbarui dari ${fileName}.`,
      'import'
    );
    logAudit(req.auth!.profileId, 'EXCEL_IMPORT_STATUS', 'excel_import_history', importId, {
      fileName,
      updatedCount,
    });
  });

  res.json({ ok: true, updatedCount });
});

// ---------------------------------------------------------------------------
// ATTENDANCE (MANUAL & EXCEL IMPORT)
// ---------------------------------------------------------------------------
function getAttendancePoints(status: AttendanceStatus): number {
  const settings = getSystemSettings();
  return Number(settings.points[status] ?? 0);
}

adminRouter.get('/attendance', (req, res) => {
  const classId = String(req.query.classId ?? '').trim();
  const attendanceDate = String(req.query.date ?? getJakartaDateString()).trim();
  const meetingNumber = Math.max(1, Number(req.query.meetingNumber ?? 1));

  if (!classId) {
    res.status(400).json({ error: 'classId wajib dipilih.' });
    return;
  }

  const students = db
    .prepare(`
      SELECT s.id AS student_id, s.nim, s.full_name, s.status AS student_status,
             a.id AS attendance_id, a.status AS attendance_status, a.source
      FROM students s
      LEFT JOIN attendance a
        ON a.student_id = s.id AND a.attendance_date = ? AND a.meeting_number = ?
      WHERE s.class_id = ?
      ORDER BY s.nim ASC
    `)
    .all(attendanceDate, meetingNumber, classId);

  res.json({ students, attendanceDate, meetingNumber });
});

adminRouter.post('/attendance/manual', (req: AuthedRequest, res) => {
  const classId = String(req.body?.classId ?? '').trim();
  const attendanceDate = String(req.body?.attendanceDate ?? '').trim();
  const meetingNumber = Math.max(1, Number(req.body?.meetingNumber ?? 1));
  const records = Array.isArray(req.body?.records) ? req.body.records : [];

  if (!classId || !attendanceDate || records.length === 0) {
    res.status(400).json({ error: 'Kelas, tanggal, pertemuan, dan daftar absensi wajib diisi.' });
    return;
  }

  const refId = `${attendanceDate}:m${meetingNumber}`;
  let savedCount = 0;

  withTransaction(() => {
    for (const rec of records) {
      const studentId = String(rec.student_id ?? '').trim();
      const status = String(rec.status ?? '').trim() as AttendanceStatus;
      if (!studentId || !['hadir', 'izin', 'sakit', 'alpha'].includes(status)) continue;

      const existing = db
        .prepare(`SELECT id, status FROM attendance WHERE student_id = ? AND attendance_date = ? AND meeting_number = ?`)
        .get(studentId, attendanceDate, meetingNumber) as { id: string; status: AttendanceStatus } | undefined;

      const targetPoints = getAttendancePoints(status);

      if (!existing) {
        const attId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO attendance (id, student_id, class_id, attendance_date, meeting_number, status, source, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)
        `).run(attId, studentId, classId, attendanceDate, meetingNumber, status, req.auth!.profileId);

        if (targetPoints !== 0) {
          db.prepare(`
            INSERT OR IGNORE INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
            VALUES (?, ?, ?, 'attendance', ?, 'attendance', ?, ?)
          `).run(
            crypto.randomUUID(),
            studentId,
            targetPoints,
            `Kehadiran Pertemuan ${meetingNumber} (${attendanceDate}) — ${status.toUpperCase()}`,
            refId,
            req.auth!.profileId
          );
          recalculateStudentTotals(studentId);
        }
        savedCount++;
      } else if (existing.status !== status) {
        const oldPoints = getAttendancePoints(existing.status);
        const delta = targetPoints - oldPoints;

        db.prepare(`
          UPDATE attendance SET status = ?, updated_at = datetime('now') WHERE id = ?
        `).run(status, existing.id);

        if (delta !== 0) {
          // Use adjustment transaction so point ledger history is never deleted
          db.prepare(`
            INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
            VALUES (?, ?, ?, 'adjustment', ?, 'attendance_adjust', ?, ?)
          `).run(
            crypto.randomUUID(),
            studentId,
            delta,
            `Penyesuaian absensi Pertemuan ${meetingNumber} (${attendanceDate}): ${existing.status.toUpperCase()} → ${status.toUpperCase()}`,
            `${refId}:${Date.now()}`,
            req.auth!.profileId
          );
          recalculateStudentTotals(studentId);
        }
        savedCount++;
      }
    }

    logAudit(req.auth!.profileId, 'MANUAL_ATTENDANCE_SAVE', 'attendance', refId, {
      classId,
      attendanceDate,
      meetingNumber,
      savedCount,
    });
  });

  res.json({ ok: true, savedCount });
});

function normalizeAttendanceInput(raw: string): AttendanceStatus | null {
  const v = raw.trim().toLowerCase();
  if (['hadir', 'h', 'present', 'masuk'].includes(v)) return 'hadir';
  if (['izin', 'i', 'permit', 'excused'].includes(v)) return 'izin';
  if (['sakit', 's', 'sick'].includes(v)) return 'sakit';
  if (['alpha', 'a', 'alpa', 'absent', 'tanpa keterangan'].includes(v)) return 'alpha';
  return null;
}

adminRouter.post('/import/attendance/preview', uploadMemory.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File Excel absensi wajib diunggah.' });
    return;
  }

  const attendanceDate = String(req.body?.attendanceDate ?? getJakartaDateString()).trim();
  const meetingNumber = Math.max(1, Number(req.body?.meetingNumber ?? 1));

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const seenNims = new Set<string>();
  const previewRows = rawRows.map((row, idx) => {
    const keys = Object.keys(row);
    const nimKey = keys.find((k) => k.trim().toLowerCase() === 'nim') ?? keys.find((k) => k.toLowerCase().includes('nim'));
    const statusKey =
      keys.find((k) => ['status', 'kehadiran', 'absensi'].includes(k.trim().toLowerCase())) ??
      keys.find((k) => k.toLowerCase().includes('status') || k.toLowerCase().includes('hadir'));

    const nim = nimKey ? String(row[nimKey]).trim() : '';
    const rawStatus = statusKey ? String(row[statusKey]).trim() : '';
    const parsedStatus = normalizeAttendanceInput(rawStatus);

    if (!nim) {
      return { rowNumber: idx + 2, nim: '', rawStatus, matchState: 'invalid', error: 'Kolom NIM kosong' };
    }
    if (seenNims.has(nim)) {
      return { rowNumber: idx + 2, nim, rawStatus, matchState: 'duplicate', error: 'NIM duplikat dalam file Excel' };
    }
    seenNims.add(nim);

    const student = db
      .prepare(`
        SELECT s.id, s.nim, s.full_name, s.class_id, c.name AS class_name
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE s.nim = ?
      `)
      .get(nim) as
      | { id: string; nim: string; full_name: string; class_id: string; class_name: string }
      | undefined;

    if (!student) {
      return { rowNumber: idx + 2, nim, rawStatus, matchState: 'not_found', error: 'NIM tidak terdaftar di database' };
    }
    if (!parsedStatus) {
      return {
        rowNumber: idx + 2,
        nim,
        student_id: student.id,
        full_name: student.full_name,
        class_name: student.class_name,
        rawStatus,
        matchState: 'invalid',
        error: `Status "${rawStatus}" tidak dikenali (Hadir/Izin/Sakit/Alpha)`,
      };
    }

    const existing = db
      .prepare(`SELECT id, status FROM attendance WHERE student_id = ? AND attendance_date = ? AND meeting_number = ?`)
      .get(student.id, attendanceDate, meetingNumber) as { id: string; status: string } | undefined;

    if (existing) {
      return {
        rowNumber: idx + 2,
        nim,
        student_id: student.id,
        full_name: student.full_name,
        class_id: student.class_id,
        class_name: student.class_name,
        status: parsedStatus,
        rawStatus,
        matchState: 'duplicate',
        error: `Sudah tercatat absensi (${existing.status.toUpperCase()}) pada tanggal & pertemuan ini`,
      };
    }

    return {
      rowNumber: idx + 2,
      nim,
      student_id: student.id,
      full_name: student.full_name,
      class_id: student.class_id,
      class_name: student.class_name,
      status: parsedStatus,
      pointsPreview: getAttendancePoints(parsedStatus),
      matchState: 'matched',
    };
  });

  res.json({
    fileName: req.file.originalname,
    attendanceDate,
    meetingNumber,
    rows: previewRows,
    summary: {
      total: previewRows.length,
      matched: previewRows.filter((r) => r.matchState === 'matched').length,
      notFound: previewRows.filter((r) => r.matchState === 'not_found').length,
      duplicates: previewRows.filter((r) => r.matchState === 'duplicate').length,
      invalid: previewRows.filter((r) => r.matchState === 'invalid').length,
    },
  });
});

adminRouter.post('/import/attendance/commit', (req: AuthedRequest, res) => {
  const fileName = String(req.body?.fileName ?? 'absensi.xlsx');
  const attendanceDate = String(req.body?.attendanceDate ?? '').trim();
  const meetingNumber = Math.max(1, Number(req.body?.meetingNumber ?? 1));
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!attendanceDate) {
    res.status(400).json({ error: 'Tanggal absensi wajib diisi.' });
    return;
  }

  const validRows = rows.filter(
    (r: any) =>
      r.matchState === 'matched' && r.student_id && r.class_id && ['hadir', 'izin', 'sakit', 'alpha'].includes(r.status)
  );

  if (validRows.length === 0) {
    res.status(400).json({ error: 'Tidak ada data valid baru untuk diimpor.' });
    return;
  }

  const importId = crypto.randomUUID();
  const refId = `${attendanceDate}:m${meetingNumber}`;
  let committed = 0;

  withTransaction(() => {
    for (const r of validRows) {
      const insertAtt = db
        .prepare(`
          INSERT OR IGNORE INTO attendance (id, student_id, class_id, attendance_date, meeting_number, status, source, import_id, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, 'excel', ?, ?)
        `)
        .run(
          crypto.randomUUID(),
          r.student_id,
          r.class_id,
          attendanceDate,
          meetingNumber,
          r.status,
          importId,
          req.auth!.profileId
        );

      if (insertAtt.changes > 0) {
        const pts = getAttendancePoints(r.status);
        if (pts !== 0) {
          db.prepare(`
            INSERT OR IGNORE INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
            VALUES (?, ?, ?, 'attendance', ?, 'attendance', ?, ?)
          `).run(
            crypto.randomUUID(),
            r.student_id,
            pts,
            `Kehadiran Impor Excel Pertemuan ${meetingNumber} (${attendanceDate}) — ${String(r.status).toUpperCase()}`,
            refId,
            req.auth!.profileId
          );
          recalculateStudentTotals(r.student_id);
        }
        committed++;
      }
    }

    db.prepare(`
      INSERT INTO excel_import_history (id, import_type, file_name, total_rows, matched_rows, skipped_rows, error_rows, summary_json, imported_by)
      VALUES (?, 'attendance', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      importId,
      fileName,
      rows.length,
      committed,
      rows.length - committed,
      rows.filter((r: any) => r.matchState === 'invalid' || r.matchState === 'not_found').length,
      JSON.stringify({ attendanceDate, meetingNumber, committed }),
      req.auth!.profileId
    );

    createNotification(
      req.auth!.profileId,
      'Impor Absensi Excel Berhasil',
      `${committed} data absensi (Pertemuan ${meetingNumber}, ${attendanceDate}) berhasil disimpan dari ${fileName}.`,
      'import'
    );
    logAudit(req.auth!.profileId, 'EXCEL_IMPORT_ATTENDANCE', 'excel_import_history', importId, {
      fileName,
      attendanceDate,
      meetingNumber,
      committed,
    });
  });

  res.json({ ok: true, committed, importId });
});

adminRouter.get('/import/history', (_req, res) => {
  const rows = db
    .prepare(`
      SELECT eih.*, p.full_name AS imported_by_name
      FROM excel_import_history eih
      LEFT JOIN profiles p ON p.id = eih.imported_by
      ORDER BY eih.created_at DESC
      LIMIT 100
    `)
    .all();
  res.json({
    history: rows.map((r) => ({
      ...r,
      summary: (() => {
        try {
          return JSON.parse(String(r.summary_json || '{}'));
        } catch {
          return {};
        }
      })(),
    })),
  });
});

// ---------------------------------------------------------------------------
// POINTS MANAGEMENT
// ---------------------------------------------------------------------------
adminRouter.get('/points', (req, res) => {
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const source = String(req.query.source ?? '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const filters: string[] = [];
  const params: Array<string | number | null> = [];

  if (search) {
    filters.push(`(LOWER(s.full_name) LIKE ? OR LOWER(s.nim) LIKE ? OR LOWER(pt.description) LIKE ?)`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (source) {
    filters.push(`pt.source = ?`);
    params.push(source);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const totalRow = db
    .prepare(`
      SELECT COUNT(*) AS c
      FROM point_transactions pt
      JOIN students s ON s.id = pt.student_id
      ${where}
    `)
    .get(...params) as { c: number };

  const rows = db
    .prepare(`
      SELECT pt.*, s.full_name AS student_name, s.nim, c.name AS class_name, p.full_name AS admin_name
      FROM point_transactions pt
      JOIN students s ON s.id = pt.student_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN profiles p ON p.id = pt.admin_id
      ${where}
      ORDER BY pt.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  res.json({
    transactions: rows,
    pagination: {
      page,
      limit,
      total: Number(totalRow.c),
      totalPages: Math.max(1, Math.ceil(Number(totalRow.c) / limit)),
    },
  });
});

adminRouter.post('/points/award', (req: AuthedRequest, res) => {
  const targetType = String(req.body?.targetType ?? 'single'); // single | selected | class | study_program
  const targetIds = Array.isArray(req.body?.targetIds) ? req.body.targetIds.map(String) : [];
  const source = String(req.body?.source ?? 'bonus');
  const description = String(req.body?.description ?? '').trim();
  const amount = Math.round(Number(req.body?.amount ?? 0));

  if (!['question', 'critical_question', 'discussion', 'bonus', 'adjustment'].includes(source)) {
    res.status(400).json({ error: 'Sumber poin tidak valid.' });
    return;
  }
  if (!description || amount === 0) {
    res.status(400).json({ error: 'Keterangan dan jumlah poin (tidak nol) wajib diisi.' });
    return;
  }

  let students: Array<{ id: string; profile_id: string; full_name: string }> = [];
  if (targetType === 'single' || targetType === 'selected') {
    if (targetIds.length === 0) {
      res.status(400).json({ error: 'Pilih minimal satu mahasiswa.' });
      return;
    }
    const placeholders = targetIds.map(() => '?').join(',');
    students = db
      .prepare(`SELECT id, profile_id, full_name FROM students WHERE id IN (${placeholders})`)
      .all(...targetIds) as Array<{ id: string; profile_id: string; full_name: string }>;
  } else if (targetType === 'class' && targetIds[0]) {
    students = db
      .prepare(`SELECT id, profile_id, full_name FROM students WHERE class_id = ?`)
      .all(targetIds[0]) as Array<{ id: string; profile_id: string; full_name: string }>;
  } else if (targetType === 'study_program' && targetIds[0]) {
    students = db
      .prepare(`SELECT id, profile_id, full_name FROM students WHERE study_program_id = ?`)
      .all(targetIds[0]) as Array<{ id: string; profile_id: string; full_name: string }>;
  }

  if (students.length === 0) {
    res.status(404).json({ error: 'Tidak ada mahasiswa target ditemukan.' });
    return;
  }

  withTransaction(() => {
    for (const s of students) {
      db.prepare(`
        INSERT INTO point_transactions (id, student_id, amount, source, description, admin_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), s.id, amount, source, description, req.auth!.profileId);
      recalculateStudentTotals(s.id);
      createNotification(
        s.profile_id,
        amount > 0 ? `+${amount} Poin Akademik` : `Penyesuaian ${amount} Poin`,
        `${description} (${amount > 0 ? `+${amount}` : amount} poin).`,
        'points'
      );
    }
    logAudit(req.auth!.profileId, 'AWARD_POINTS', targetType, targetIds.join(','), {
      source,
      amount,
      description,
      count: students.length,
    });
  });

  res.json({ ok: true, affectedCount: students.length });
});

adminRouter.post('/points/adjust', (req: AuthedRequest, res) => {
  const transactionId = String(req.body?.transactionId ?? '').trim();
  const reason = String(req.body?.reason ?? '').trim();
  if (!transactionId || !reason) {
    res.status(400).json({ error: 'ID transaksi dan alasan pembatalan/penyesuaian wajib diisi.' });
    return;
  }

  const orig = db
    .prepare(`SELECT * FROM point_transactions WHERE id = ?`)
    .get(transactionId) as
    | { id: string; student_id: string; amount: number; description: string }
    | undefined;

  if (!orig) {
    res.status(404).json({ error: 'Transaksi poin tidak ditemukan.' });
    return;
  }

  withTransaction(() => {
    const reversalAmount = -orig.amount;
    db.prepare(`
      INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
      VALUES (?, ?, ?, 'adjustment', ?, 'reversal', ?, ?)
    `).run(
      crypto.randomUUID(),
      orig.student_id,
      reversalAmount,
      `Pembatalan transaksi "${orig.description}": ${reason}`,
      orig.id,
      req.auth!.profileId
    );
    recalculateStudentTotals(orig.student_id);
    logAudit(req.auth!.profileId, 'REVERSE_POINT_TRANSACTION', 'point_transaction', orig.id, {
      reversalAmount,
      reason,
    });
  });

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// SYSTEM SETTINGS & AUDIT LOGS
// ---------------------------------------------------------------------------
adminRouter.get('/settings', (_req, res) => {
  res.json({ settings: getSystemSettings() });
});

adminRouter.put('/settings', (req: AuthedRequest, res) => {
  const { points, exp, levels } = req.body ?? {};
  if (!points || !exp || !Array.isArray(levels)) {
    res.status(400).json({ error: 'Format pengaturan tidak valid.' });
    return;
  }

  withTransaction(() => {
    const upsert = db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);
    upsert.run('points', JSON.stringify(points));
    upsert.run('exp', JSON.stringify(exp));
    upsert.run('levels', JSON.stringify(levels));

    // Recalculate all student levels if thresholds changed
    const allStudents = db.prepare(`SELECT id FROM students`).all() as Array<{ id: string }>;
    for (const s of allStudents) {
      recalculateStudentTotals(s.id);
    }

    logAudit(req.auth!.profileId, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', 'all');
  });

  res.json({ ok: true, settings: getSystemSettings() });
});

adminRouter.get('/audit-logs', (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
  const offset = (page - 1) * limit;

  const total = Number((db.prepare(`SELECT COUNT(*) AS c FROM audit_logs`).get() as { c: number }).c);
  const rows = db
    .prepare(`
      SELECT al.*, p.full_name AS actor_name
      FROM audit_logs al
      LEFT JOIN profiles p ON p.id = al.actor_profile_id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset);

  res.json({
    logs: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

// Optional starter curriculum template loader (explicitly triggered by Admin in Settings)
adminRouter.post('/seed-template', (req: AuthedRequest, res) => {
  const existingPrograms = Number((db.prepare(`SELECT COUNT(*) AS c FROM study_programs`).get() as { c: number }).c);
  if (existingPrograms > 0) {
    res.status(409).json({ error: 'Database sudah memiliki program studi. Template hanya tersedia untuk workspace kosong.' });
    return;
  }

  withTransaction(() => {
    const tiId = crypto.randomUUID();
    const siId = crypto.randomUUID();
    db.prepare(`INSERT INTO study_programs (id, code, name, description) VALUES (?, 'TI', 'Teknik Informatika', 'Program Studi Teknik Informatika & Rekayasa Perangkat Lunak')`).run(tiId);
    db.prepare(`INSERT INTO study_programs (id, code, name, description) VALUES (?, 'SI', 'Sistem Informasi', 'Program Studi Sistem Informasi & Analitika Bisnis')`).run(siId);

    const ti2a = crypto.randomUUID();
    const ti2b = crypto.randomUUID();
    const si2a = crypto.randomUUID();
    db.prepare(`INSERT INTO classes (id, study_program_id, name, academic_year) VALUES (?, ?, 'Teknik Informatika 2A', '2026/2027')`).run(ti2a, tiId);
    db.prepare(`INSERT INTO classes (id, study_program_id, name, academic_year) VALUES (?, ?, 'Teknik Informatika 2B', '2026/2027')`).run(ti2b, tiId);
    db.prepare(`INSERT INTO classes (id, study_program_id, name, academic_year) VALUES (?, ?, 'Sistem Informasi 2A', '2026/2027')`).run(si2a, siId);

    const sampleStudents = [
      { nim: '230101001', name: 'Azril Al Afriza', prodi: tiId, cls: ti2a, status: 'hijau' },
      { nim: '230101002', name: 'Nadia Putri Maharani', prodi: tiId, cls: ti2a, status: 'netral' },
      { nim: '230101003', name: 'Raka Pratama Wijaya', prodi: tiId, cls: ti2a, status: 'netral' },
      { nim: '230101004', name: 'Siti Rahma Aulia', prodi: tiId, cls: ti2b, status: 'netral' },
      { nim: '230201001', name: 'Dimas Aditya Saputra', prodi: siId, cls: si2a, status: 'netral' },
      { nim: '230201002', name: 'Fajar Ramadhan', prodi: siId, cls: si2a, status: 'merah' },
    ];

    for (const st of sampleStudents) {
      const pid = crypto.randomUUID();
      const sid = crypto.randomUUID();
      db.prepare(`INSERT INTO profiles (id, username, full_name, password_hash, role) VALUES (?, ?, ?, ?, 'student')`).run(
        pid,
        st.nim,
        st.name,
        hashPasswordSync(st.nim)
      );
      db.prepare(`INSERT INTO students (id, profile_id, nim, full_name, study_program_id, class_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        sid,
        pid,
        st.nim,
        st.name,
        st.prodi,
        st.cls,
        st.status
      );
      db.prepare(`INSERT INTO login_streaks (id, student_id, current_streak, best_streak, total_login_days) VALUES (?, ?, 0, 0, 0)`).run(
        crypto.randomUUID(),
        sid
      );
    }

    const materials = [
      { order: 1, title: 'Pengenalan Materi & Lingkungan Kerja', topic: 'Algoritma & Pemrograman' },
      { order: 2, title: 'Dasar-Dasar Pemrograman', topic: 'Algoritma & Pemrograman' },
      { order: 3, title: 'Variabel dan Tipe Data', topic: 'Algoritma & Pemrograman' },
      { order: 4, title: 'Percabangan dan Logika Kondisi', topic: 'Algoritma & Pemrograman' },
    ];
    for (const m of materials) {
      const mid = crypto.randomUUID();
      db.prepare(`
        INSERT INTO materials (id, title, description, topic, drive_url, order_index, published_at, is_published, created_by)
        VALUES (?, ?, ?, ?, 'https://drive.google.com', ?, ?, 1, ?)
      `).run(mid, m.title, `Modul pertemuan ke-${m.order}: ${m.title}`, m.topic, m.order, getJakartaDateString(), req.auth!.profileId);
      db.prepare(`INSERT INTO material_targets (id, material_id, study_program_id, class_id) VALUES (?, ?, ?, ?)`).run(
        crypto.randomUUID(),
        mid,
        tiId,
        ti2a
      );
    }

    const assignId = crypto.randomUUID();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
    db.prepare(`
      INSERT INTO assignments (id, title, description, instructions, deadline, max_points, created_by)
      VALUES (?, 'Praktikum 1: Struktur Kontrol & Percabangan', 'Buat program studi kasus manajemen nilai mahasiswa menggunakan percabangan.', 'Unggah file source code (.zip/.pdf) atau cantumkan link Google Drive.', ?, 100, ?)
    `).run(assignId, nextWeek, req.auth!.profileId);
    db.prepare(`INSERT INTO assignment_targets (id, assignment_id, study_program_id, class_id) VALUES (?, ?, ?, ?)`).run(
      crypto.randomUUID(),
      assignId,
      tiId,
      ti2a
    );

    logAudit(req.auth!.profileId, 'SEED_STARTER_TEMPLATE', 'system', 'template');
  });

  res.json({ ok: true, message: 'Struktur program studi, kelas, mahasiswa awal, materi, dan tugas contoh berhasil dimuat.' });
});
