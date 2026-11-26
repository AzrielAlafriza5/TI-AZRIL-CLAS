import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { db, UPLOADS_DIR, withTransaction } from './db.ts';
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
import {
  downloadFileFromSupabaseStorage,
  uploadFileToSupabaseStorage,
} from './supabase.ts';

export const learningRouter = Router();
learningRouter.use(requireAuth);

const uploadDisk = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function isSafeHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// REFERENCE DATA (Study Programs & Classes for filters/dropdowns)
// ---------------------------------------------------------------------------
learningRouter.get('/reference/academic', (_req, res) => {
  const programs = db.prepare(`SELECT id, code, name FROM study_programs ORDER BY name ASC`).all();
  const classes = db
    .prepare(`
      SELECT c.id, c.name, c.study_program_id, c.academic_year, sp.name AS study_program_name
      FROM classes c
      JOIN study_programs sp ON sp.id = c.study_program_id
      ORDER BY sp.name ASC, c.name ASC
    `)
    .all();
  res.json({ programs, classes });
});

// ---------------------------------------------------------------------------
// SECURE FILE UPLOAD & PATH-CONFINED DOWNLOAD
// ---------------------------------------------------------------------------
learningRouter.post('/upload', uploadDisk.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Tidak ada file yang diunggah.' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const allowedExt = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg', '.txt'];
  if (ext && !allowedExt.includes(ext)) {
    res.status(400).json({ error: 'Tipe file tidak diizinkan.' });
    return;
  }

  const safeStoredName = `${crypto.randomUUID()}${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, safeStoredName);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    res.status(400).json({ error: 'Path file tidak valid.' });
    return;
  }

  fs.writeFileSync(targetPath, req.file.buffer);
  await uploadFileToSupabaseStorage(safeStoredName, req.file.buffer);
  res.json({
    file_url: `/api/files/${safeStoredName}`,
    file_name: req.file.originalname,
  });
});

learningRouter.get('/files/:filename', async (req, res) => {
  const cleanName = path.basename(String(req.params.filename ?? ''));
  const resolved = path.resolve(UPLOADS_DIR, cleanName);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    res.status(404).json({ error: 'File tidak ditemukan.' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    const remoteBuffer = await downloadFileFromSupabaseStorage(cleanName);
    if (!remoteBuffer) {
      res.status(404).json({ error: 'File tidak ditemukan.' });
      return;
    }
    fs.writeFileSync(resolved, remoteBuffer);
  }
  res.download(resolved, cleanName);
});

// ---------------------------------------------------------------------------
// ASSIGNMENTS & SUBMISSIONS
// ---------------------------------------------------------------------------
learningRouter.get('/assignments', (req: AuthedRequest, res) => {
  const isAdmin = req.auth!.role === 'admin';
  const studentId = req.auth!.studentId;
  const classId = req.auth!.classId;

  let assignments: Record<string, any>[];
  if (isAdmin) {
    assignments = db
      .prepare(`
        SELECT a.*,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'graded') AS graded_count
        FROM assignments a
        ORDER BY a.deadline DESC
      `)
      .all();
  } else if (classId) {
    assignments = db
      .prepare(`
        SELECT DISTINCT a.*
        FROM assignments a
        JOIN assignment_targets at ON at.assignment_id = a.id
        WHERE at.class_id = ?
        ORDER BY a.deadline ASC
      `)
      .all(classId);
  } else {
    assignments = [];
  }

  const enriched = assignments.map((a) => {
    const targets = db
      .prepare(`
        SELECT at.class_id, c.name AS class_name, at.study_program_id, sp.name AS study_program_name
        FROM assignment_targets at
        JOIN classes c ON c.id = at.class_id
        JOIN study_programs sp ON sp.id = at.study_program_id
        WHERE at.assignment_id = ?
      `)
      .all(a.id);

    let mySubmission = null;
    if (!isAdmin && studentId) {
      mySubmission =
        db
          .prepare(`SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?`)
          .get(a.id, studentId) ?? null;
    }

    return {
      ...a,
      targets,
      my_submission: mySubmission,
    };
  });

  res.json({ assignments: enriched });
});

learningRouter.post('/assignments', requireAdmin, (req: AuthedRequest, res) => {
  const title = String(req.body?.title ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const instructions = String(req.body?.instructions ?? '').trim();
  const deadline = String(req.body?.deadline ?? '').trim();
  const maxPoints = Math.max(0, Math.round(Number(req.body?.max_points ?? 100)));
  const attachmentUrl = req.body?.attachment_url ? String(req.body.attachment_url) : null;
  const attachmentName = req.body?.attachment_name ? String(req.body.attachment_name) : null;
  const classIds: string[] = Array.isArray(req.body?.class_ids) ? req.body.class_ids.map(String) : [];

  if (!title || !deadline || classIds.length === 0) {
    res.status(400).json({ error: 'Judul tugas, deadline, dan minimal satu kelas penerima wajib diisi.' });
    return;
  }

  const id = crypto.randomUUID();

  withTransaction(() => {
    db.prepare(`
      INSERT INTO assignments (id, title, description, instructions, attachment_url, attachment_name, deadline, max_points, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description, instructions, attachmentUrl, attachmentName, deadline, maxPoints, req.auth!.profileId);

    const placeholders = classIds.map(() => '?').join(',');
    const classRows = db
      .prepare(`SELECT id, study_program_id FROM classes WHERE id IN (${placeholders})`)
      .all(...classIds) as Array<{ id: string; study_program_id: string }>;

    for (const c of classRows) {
      db.prepare(`
        INSERT OR IGNORE INTO assignment_targets (id, assignment_id, study_program_id, class_id)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), id, c.study_program_id, c.id);
    }

    // Notify targeted students
    const targetStudents = db
      .prepare(`SELECT profile_id FROM students WHERE class_id IN (${placeholders})`)
      .all(...classIds) as Array<{ profile_id: string }>;
    for (const st of targetStudents) {
      createNotification(
        st.profile_id,
        `Tugas Baru: ${title}`,
        `Deadline pengumpulan: ${deadline.replace('T', ' ')}. Maksimal ${maxPoints} poin.`,
        'assignment'
      );
    }

    logAudit(req.auth!.profileId, 'CREATE_ASSIGNMENT', 'assignment', id, { title, classIds });
  });

  res.status(201).json({ id });
});

learningRouter.patch('/assignments/:id', requireAdmin, (req: AuthedRequest, res) => {
  const title = String(req.body?.title ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const instructions = String(req.body?.instructions ?? '').trim();
  const deadline = String(req.body?.deadline ?? '').trim();
  const maxPoints = Math.max(0, Math.round(Number(req.body?.max_points ?? 100)));
  const classIds: string[] = Array.isArray(req.body?.class_ids) ? req.body.class_ids.map(String) : [];

  if (!title || !deadline) {
    res.status(400).json({ error: 'Judul dan deadline wajib diisi.' });
    return;
  }

  withTransaction(() => {
    db.prepare(`
      UPDATE assignments
      SET title = ?, description = ?, instructions = ?, deadline = ?, max_points = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description, instructions, deadline, maxPoints, req.params.id);

    if (classIds.length > 0) {
      db.prepare(`DELETE FROM assignment_targets WHERE assignment_id = ?`).run(req.params.id);
      const placeholders = classIds.map(() => '?').join(',');
      const classRows = db
        .prepare(`SELECT id, study_program_id FROM classes WHERE id IN (${placeholders})`)
        .all(...classIds) as Array<{ id: string; study_program_id: string }>;
      for (const c of classRows) {
        db.prepare(`
          INSERT OR IGNORE INTO assignment_targets (id, assignment_id, study_program_id, class_id)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), req.params.id, c.study_program_id, c.id);
      }
    }

    logAudit(req.auth!.profileId, 'UPDATE_ASSIGNMENT', 'assignment', req.params.id, { title });
  });

  res.json({ ok: true });
});

learningRouter.delete('/assignments/:id', requireAdmin, (req: AuthedRequest, res) => {
  db.prepare(`DELETE FROM assignments WHERE id = ?`).run(req.params.id);
  logAudit(req.auth!.profileId, 'DELETE_ASSIGNMENT', 'assignment', req.params.id);
  res.json({ ok: true });
});

learningRouter.get('/assignments/:id/submissions', requireAdmin, (req, res) => {
  const assignment = db.prepare(`SELECT * FROM assignments WHERE id = ?`).get(req.params.id);
  if (!assignment) {
    res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    return;
  }

  const rows = db
    .prepare(`
      SELECT s.id AS student_id, s.nim, s.full_name AS student_name, c.name AS class_name,
             sub.id AS submission_id, sub.file_url, sub.file_name, sub.drive_link, sub.answer_text,
             COALESCE(sub.status, 'not_submitted') AS status, sub.score, sub.awarded_points,
             sub.admin_notes, sub.submitted_at, sub.graded_at
      FROM assignment_targets at
      JOIN students s ON s.class_id = at.class_id
      JOIN classes c ON c.id = s.class_id
      LEFT JOIN submissions sub ON sub.assignment_id = at.assignment_id AND sub.student_id = s.id
      WHERE at.assignment_id = ?
      ORDER BY c.name ASC, s.nim ASC
    `)
    .all(req.params.id);

  res.json({ assignment, submissions: rows });
});

learningRouter.post('/assignments/:id/submit', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya mahasiswa yang dapat mengumpulkan tugas.' });
    return;
  }

  const assignment = db
    .prepare(`
      SELECT a.*
      FROM assignments a
      JOIN assignment_targets at ON at.assignment_id = a.id
      WHERE a.id = ? AND at.class_id = ?
    `)
    .get(req.params.id, req.auth!.classId ?? '') as { id: string; title: string; deadline: string } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Tugas tidak ditemukan atau bukan untuk kelas Anda.' });
    return;
  }

  const fileUrl = req.body?.file_url ? String(req.body.file_url).trim() : null;
  const fileName = req.body?.file_name ? String(req.body.file_name).trim() : null;
  const driveLink = req.body?.drive_link ? String(req.body.drive_link).trim() : null;
  const answerText = String(req.body?.answer_text ?? '').trim();

  if (driveLink && !isSafeHttpUrl(driveLink)) {
    res.status(400).json({ error: 'Link Google Drive harus menggunakan URL http:// atau https:// yang valid.' });
    return;
  }

  if (!fileUrl && !driveLink && !answerText) {
    res.status(400).json({ error: 'Lampirkan file, link Google Drive, atau jawaban teks.' });
    return;
  }

  const studentId = req.auth!.studentId;
  const isLate = new Date().getTime() > new Date(assignment.deadline).getTime();
  const status = isLate ? 'late' : 'submitted';

  withTransaction(() => {
    const existing = db
      .prepare(`SELECT id, status FROM submissions WHERE assignment_id = ? AND student_id = ?`)
      .get(assignment.id, studentId) as { id: string; status: string } | undefined;

    if (existing) {
      if (existing.status === 'graded') {
        throw new Error('ALREADY_GRADED');
      }
      db.prepare(`
        UPDATE submissions
        SET file_url = COALESCE(?, file_url),
            file_name = COALESCE(?, file_name),
            drive_link = ?,
            answer_text = ?,
            status = ?,
            submitted_at = datetime('now')
        WHERE id = ?
      `).run(fileUrl, fileName, driveLink, answerText, status, existing.id);
    } else {
      db.prepare(`
        INSERT INTO submissions (id, assignment_id, student_id, file_url, file_name, drive_link, answer_text, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        assignment.id,
        studentId,
        fileUrl,
        fileName,
        driveLink,
        answerText,
        status
      );
    }

    const admin = db.prepare(`SELECT id FROM profiles WHERE role = 'admin' LIMIT 1`).get() as { id: string } | undefined;
    if (admin) {
      createNotification(
        admin.id,
        `Pengumpulan Tugas: ${assignment.title}`,
        `${req.auth!.fullName} (${req.auth!.username}) telah mengumpulkan tugas (${isLate ? 'Terlambat' : 'Tepat waktu'}).`,
        'submission'
      );
    }
  });

  res.json({ ok: true, status });
});

learningRouter.post('/submissions/:id/grade', requireAdmin, (req: AuthedRequest, res) => {
  const submission = db
    .prepare(`
      SELECT sub.*, a.title AS assignment_title, a.max_points, s.profile_id AS student_profile_id
      FROM submissions sub
      JOIN assignments a ON a.id = sub.assignment_id
      JOIN students s ON s.id = sub.student_id
      WHERE sub.id = ?
    `)
    .get(req.params.id) as
    | {
        id: string;
        assignment_id: string;
        student_id: string;
        student_profile_id: string;
        assignment_title: string;
        max_points: number;
        awarded_points: number;
      }
    | undefined;

  if (!submission) {
    res.status(404).json({ error: 'Pengumpulan tidak ditemukan.' });
    return;
  }

  const status = String(req.body?.status ?? 'graded') as 'graded' | 'revision';
  if (!['graded', 'revision'].includes(status)) {
    res.status(400).json({ error: 'Status penilaian harus graded atau revision.' });
    return;
  }

  const score = req.body?.score !== undefined && req.body?.score !== '' ? Number(req.body.score) : null;
  const requestedPoints = Math.max(0, Math.min(submission.max_points, Math.round(Number(req.body?.awarded_points ?? 0))));
  const awardedPoints = status === 'revision' ? 0 : requestedPoints;
  const adminNotes = String(req.body?.admin_notes ?? '').trim();

  withTransaction(() => {
    const prevPoints = Number(submission.awarded_points ?? 0);
    const delta = awardedPoints - prevPoints;

    db.prepare(`
      UPDATE submissions
      SET status = ?, score = ?, awarded_points = ?, admin_notes = ?, graded_at = datetime('now'), graded_by = ?
      WHERE id = ?
    `).run(status, score, awardedPoints, adminNotes, req.auth!.profileId, submission.id);

    if (delta !== 0) {
      const hasOrig = db
        .prepare(`
          SELECT id FROM point_transactions
          WHERE student_id = ? AND source = 'assignment' AND reference_type = 'submission' AND reference_id = ?
        `)
        .get(submission.student_id, submission.id);

      if (!hasOrig && awardedPoints > 0) {
        db.prepare(`
          INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
          VALUES (?, ?, ?, 'assignment', ?, 'submission', ?, ?)
        `).run(
          crypto.randomUUID(),
          submission.student_id,
          awardedPoints,
          `Penilaian tugas "${submission.assignment_title}"`,
          submission.id,
          req.auth!.profileId
        );
      } else {
        db.prepare(`
          INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
          VALUES (?, ?, ?, 'adjustment', ?, 'submission_adjust', ?, ?)
        `).run(
          crypto.randomUUID(),
          submission.student_id,
          delta,
          `Pembaruan nilai tugas "${submission.assignment_title}" (${prevPoints} → ${awardedPoints} poin)`,
          `${submission.id}:${Date.now()}`,
          req.auth!.profileId
        );
      }
      recalculateStudentTotals(submission.student_id);
    }

    createNotification(
      submission.student_profile_id,
      status === 'revision' ? `Revisi Tugas: ${submission.assignment_title}` : `Tugas Dinilai: ${submission.assignment_title}`,
      status === 'revision'
        ? `Admin meminta revisi pada tugas Anda.${adminNotes ? ` Catatan: ${adminNotes}` : ''}`
        : `Tugas Anda telah dinilai (${score ?? '-'}/100) dan memperoleh +${awardedPoints} poin akademik.`,
      'grade'
    );

    logAudit(req.auth!.profileId, 'GRADE_SUBMISSION', 'submission', submission.id, {
      status,
      score,
      awardedPoints,
    });
  });

  res.json({ ok: true });
});

learningRouter.post('/assignments/:id/auto-grade', requireAdmin, (req: AuthedRequest, res) => {
  const assignment = db
    .prepare(`SELECT id, title FROM assignments WHERE id = ?`)
    .get(req.params.id) as { id: string; title: string } | undefined;

  if (!assignment) {
    res.status(404).json({ error: 'Tugas tidak ditemukan.' });
    return;
  }

  const allSubmissions = db
    .prepare(`
      SELECT sub.*, s.profile_id AS student_profile_id, s.full_name AS student_name
      FROM submissions sub
      JOIN students s ON s.id = sub.student_id
      WHERE sub.assignment_id = ?
    `)
    .all(assignment.id) as Array<{
      id: string;
      student_id: string;
      student_profile_id: string;
      student_name: string;
      status: string;
      awarded_points: number;
      admin_notes: string;
    }>;

  if (allSubmissions.length === 0) {
    res.status(400).json({ error: 'Belum ada mahasiswa yang mengumpulkan tugas ini.' });
    return;
  }

  const pendingSubmissions = allSubmissions.filter((sub) => sub.status !== 'graded');
  if (pendingSubmissions.length === 0) {
    res.status(400).json({ error: 'Semua pengumpulan pada tugas ini sudah dinilai.' });
    return;
  }

  const autoPoints = 100;
  const autoScore = 100;

  withTransaction(() => {
    for (const sub of pendingSubmissions) {
      const prevPoints = Number(sub.awarded_points ?? 0);
      const delta = autoPoints - prevPoints;
      const notes = sub.admin_notes?.trim()
        ? sub.admin_notes.trim()
        : 'Dikoreksi otomatis (+100 poin)';

      db.prepare(`
        UPDATE submissions
        SET status = 'graded',
            score = ?,
            awarded_points = ?,
            admin_notes = ?,
            graded_at = datetime('now'),
            graded_by = ?
        WHERE id = ?
      `).run(autoScore, autoPoints, notes, req.auth!.profileId, sub.id);

      if (delta !== 0) {
        const hasOrig = db
          .prepare(`
            SELECT id FROM point_transactions
            WHERE student_id = ? AND source = 'assignment' AND reference_type = 'submission' AND reference_id = ?
          `)
          .get(sub.student_id, sub.id);

        if (!hasOrig) {
          db.prepare(`
            INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
            VALUES (?, ?, ?, 'assignment', ?, 'submission', ?, ?)
          `).run(
            crypto.randomUUID(),
            sub.student_id,
            autoPoints,
            `Koreksi otomatis tugas "${assignment.title}"`,
            sub.id,
            req.auth!.profileId
          );
        } else {
          db.prepare(`
            INSERT INTO point_transactions (id, student_id, amount, source, description, reference_type, reference_id, admin_id)
            VALUES (?, ?, ?, 'adjustment', ?, 'submission_adjust', ?, ?)
          `).run(
            crypto.randomUUID(),
            sub.student_id,
            delta,
            `Koreksi otomatis tugas "${assignment.title}" (${prevPoints} → ${autoPoints} poin)`,
            `${sub.id}:${Date.now()}`,
            req.auth!.profileId
          );
        }

        recalculateStudentTotals(sub.student_id);
      }

      createNotification(
        sub.student_profile_id,
        `Tugas Dinilai: ${assignment.title}`,
        `Tugas Anda telah dikoreksi otomatis (${autoScore}/100) dan memperoleh +${autoPoints} poin akademik.`,
        'grade'
      );
    }

    logAudit(req.auth!.profileId, 'AUTO_GRADE_ASSIGNMENT', 'assignment', assignment.id, {
      title: assignment.title,
      gradedCount: pendingSubmissions.length,
      awardedPoints: autoPoints,
    });
  });

  res.json({
    ok: true,
    gradedCount: pendingSubmissions.length,
    awardedPoints: autoPoints,
  });
});

// ---------------------------------------------------------------------------
// LEARNING MATERIALS (MATERI PEMBELAJARAN)
// ---------------------------------------------------------------------------
learningRouter.get('/materials', (req: AuthedRequest, res) => {
  const isAdmin = req.auth!.role === 'admin';
  const filterClassId = String(req.query.classId ?? '').trim();
  const filterProgramId = String(req.query.studyProgramId ?? '').trim();

  let materials: Record<string, any>[];
  if (isAdmin) {
    if (filterClassId) {
      materials = db
        .prepare(`
          SELECT DISTINCT m.*
          FROM materials m
          JOIN material_targets mt ON mt.material_id = m.id
          WHERE mt.class_id = ?
          ORDER BY m.order_index ASC, m.created_at ASC
        `)
        .all(filterClassId);
    } else if (filterProgramId) {
      materials = db
        .prepare(`
          SELECT DISTINCT m.*
          FROM materials m
          JOIN material_targets mt ON mt.material_id = m.id
          WHERE mt.study_program_id = ?
          ORDER BY m.order_index ASC, m.created_at ASC
        `)
        .all(filterProgramId);
    } else {
      materials = db.prepare(`SELECT * FROM materials ORDER BY order_index ASC, created_at ASC`).all();
    }
  } else {
    materials = db
      .prepare(`
        SELECT DISTINCT m.*
        FROM materials m
        JOIN material_targets mt ON mt.material_id = m.id
        WHERE mt.class_id = ? AND m.is_published = 1
        ORDER BY m.order_index ASC, m.created_at ASC
      `)
      .all(req.auth!.classId ?? '');
  }

  const enriched = materials.map((m) => {
    const targets = db
      .prepare(`
        SELECT mt.class_id, c.name AS class_name, mt.study_program_id, sp.name AS study_program_name
        FROM material_targets mt
        JOIN classes c ON c.id = mt.class_id
        JOIN study_programs sp ON sp.id = mt.study_program_id
        WHERE mt.material_id = ?
      `)
      .all(m.id);

    let myStatus = 'not_started';
    if (!isAdmin && req.auth!.studentId) {
      const prog = db
        .prepare(`SELECT status FROM material_progress WHERE material_id = ? AND student_id = ?`)
        .get(m.id, req.auth!.studentId) as { status: string } | undefined;
      if (prog) myStatus = prog.status;
    }

    const completedRow = db
      .prepare(`SELECT COUNT(*) AS c FROM material_progress WHERE material_id = ? AND status = 'completed'`)
      .get(m.id) as { c: number };

    return {
      ...m,
      is_published: Boolean(m.is_published),
      targets,
      my_status: myStatus,
      completed_count: Number(completedRow?.c ?? 0),
    };
  });

  const totalCount = enriched.length;
  const completedByMe = enriched.filter((m) => m.my_status === 'completed').length;
  const progressPercent = totalCount > 0 ? Math.round((completedByMe / totalCount) * 100) : 0;

  res.json({
    materials: enriched,
    progressSummary: {
      total: totalCount,
      completed: completedByMe,
      percent: progressPercent,
    },
  });
});

learningRouter.post('/materials', requireAdmin, (req: AuthedRequest, res) => {
  const title = String(req.body?.title ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const topic = String(req.body?.topic ?? 'Umum').trim();
  const driveUrl = String(req.body?.drive_url ?? '').trim();
  const orderIndex = Math.max(1, Math.round(Number(req.body?.order_index ?? 1)));
  const publishedAt = String(req.body?.published_at ?? getJakartaDateString()).trim();
  const isPublished = req.body?.is_published !== false;
  const classIds: string[] = Array.isArray(req.body?.class_ids) ? req.body.class_ids.map(String) : [];

  if (!title || !driveUrl || classIds.length === 0) {
    res.status(400).json({ error: 'Judul, link Google Drive, dan minimal satu kelas penerima wajib diisi.' });
    return;
  }
  if (!isSafeHttpUrl(driveUrl)) {
    res.status(400).json({ error: 'Link Google Drive harus diawali http:// atau https://.' });
    return;
  }

  const id = crypto.randomUUID();
  withTransaction(() => {
    db.prepare(`
      INSERT INTO materials (id, title, description, topic, drive_url, order_index, published_at, is_published, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description, topic, driveUrl, orderIndex, publishedAt, isPublished ? 1 : 0, req.auth!.profileId);

    const placeholders = classIds.map(() => '?').join(',');
    const classRows = db
      .prepare(`SELECT id, study_program_id FROM classes WHERE id IN (${placeholders})`)
      .all(...classIds) as Array<{ id: string; study_program_id: string }>;

    for (const c of classRows) {
      db.prepare(`
        INSERT OR IGNORE INTO material_targets (id, material_id, study_program_id, class_id)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), id, c.study_program_id, c.id);
    }

    if (isPublished) {
      const targetStudents = db
        .prepare(`SELECT profile_id FROM students WHERE class_id IN (${placeholders})`)
        .all(...classIds) as Array<{ profile_id: string }>;
      for (const st of targetStudents) {
        createNotification(
          st.profile_id,
          `Materi Baru: ${String(orderIndex).padStart(2, '0')}. ${title}`,
          `Topik "${topic}" telah dipublikasikan di menu Materi Pembelajaran.`,
          'material'
        );
      }
    }

    logAudit(req.auth!.profileId, 'CREATE_MATERIAL', 'material', id, { title, orderIndex, classIds });
  });

  res.status(201).json({ id });
});

learningRouter.patch('/materials/:id', requireAdmin, (req: AuthedRequest, res) => {
  const existing = db.prepare(`SELECT * FROM materials WHERE id = ?`).get(req.params.id) as Record<string, any> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Materi tidak ditemukan.' });
    return;
  }

  const title = req.body?.title !== undefined ? String(req.body.title).trim() : existing.title;
  const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
  const topic = req.body?.topic !== undefined ? String(req.body.topic).trim() : existing.topic;
  const driveUrl = req.body?.drive_url !== undefined ? String(req.body.drive_url).trim() : existing.drive_url;
  const orderIndex = req.body?.order_index !== undefined ? Math.max(1, Number(req.body.order_index)) : existing.order_index;
  const publishedAt = req.body?.published_at !== undefined ? String(req.body.published_at) : existing.published_at;
  const isPublished = req.body?.is_published !== undefined ? (req.body.is_published ? 1 : 0) : existing.is_published;
  const classIds: string[] | null = Array.isArray(req.body?.class_ids) ? req.body.class_ids.map(String) : null;

  if (!isSafeHttpUrl(driveUrl)) {
    res.status(400).json({ error: 'Link Google Drive tidak valid.' });
    return;
  }

  withTransaction(() => {
    db.prepare(`
      UPDATE materials
      SET title = ?, description = ?, topic = ?, drive_url = ?, order_index = ?, published_at = ?, is_published = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description, topic, driveUrl, orderIndex, publishedAt, isPublished, req.params.id);

    if (classIds && classIds.length > 0) {
      db.prepare(`DELETE FROM material_targets WHERE material_id = ?`).run(req.params.id);
      const placeholders = classIds.map(() => '?').join(',');
      const classRows = db
        .prepare(`SELECT id, study_program_id FROM classes WHERE id IN (${placeholders})`)
        .all(...classIds) as Array<{ id: string; study_program_id: string }>;
      for (const c of classRows) {
        db.prepare(`
          INSERT OR IGNORE INTO material_targets (id, material_id, study_program_id, class_id)
          VALUES (?, ?, ?, ?)
        `).run(crypto.randomUUID(), req.params.id, c.study_program_id, c.id);
      }
    }

    logAudit(req.auth!.profileId, 'UPDATE_MATERIAL', 'material', req.params.id, { title, isPublished });
  });

  res.json({ ok: true });
});

learningRouter.post('/materials/reorder', requireAdmin, (req: AuthedRequest, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  withTransaction(() => {
    const stmt = db.prepare(`UPDATE materials SET order_index = ?, updated_at = datetime('now') WHERE id = ?`);
    for (const item of items) {
      if (item.id && typeof item.order_index === 'number') {
        stmt.run(Math.max(1, Math.round(item.order_index)), String(item.id));
      }
    }
    logAudit(req.auth!.profileId, 'REORDER_MATERIALS', 'material', 'batch');
  });
  res.json({ ok: true });
});

learningRouter.delete('/materials/:id', requireAdmin, (req: AuthedRequest, res) => {
  db.prepare(`DELETE FROM materials WHERE id = ?`).run(req.params.id);
  logAudit(req.auth!.profileId, 'DELETE_MATERIAL', 'material', req.params.id);
  res.json({ ok: true });
});

learningRouter.post('/materials/:id/progress', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya mahasiswa yang dapat memperbarui progres materi.' });
    return;
  }
  const status = String(req.body?.status ?? '').trim();
  if (!['not_started', 'in_progress', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Status progres tidak valid.' });
    return;
  }

  db.prepare(`
    INSERT INTO material_progress (id, material_id, student_id, status, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(material_id, student_id)
    DO UPDATE SET status = excluded.status, updated_at = datetime('now')
  `).run(crypto.randomUUID(), req.params.id, req.auth!.studentId, status);

  res.json({ ok: true, status });
});

// ---------------------------------------------------------------------------
// LEADERBOARD (CLASS & STUDY PROGRAM, RANKED STRICTLY BY ACADEMIC POINTS)
// ---------------------------------------------------------------------------
learningRouter.get('/leaderboard', (req: AuthedRequest, res) => {
  const scope = String(req.query.scope ?? 'class'); // 'class' | 'study_program'
  const period = String(req.query.period ?? 'all'); // 'weekly' | 'monthly' | 'semester' | 'all'
  let targetId = String(req.query.targetId ?? '').trim();

  if (!targetId && req.auth!.role === 'student') {
    targetId = scope === 'class' ? req.auth!.classId ?? '' : req.auth!.studyProgramId ?? '';
  }

  const now = new Date();
  let cutoffDate: string | null = null;
  if (period === 'weekly') {
    cutoffDate = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  } else if (period === 'monthly') {
    cutoffDate = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  } else if (period === 'semester') {
    cutoffDate = new Date(now.getTime() - 180 * 86400000).toISOString().slice(0, 10);
  }

  const whereParts: string[] = [];
  const params: Array<string | number | null> = [];

  if (scope === 'class' && targetId) {
    whereParts.push('s.class_id = ?');
    params.push(targetId);
  } else if (scope === 'study_program' && targetId) {
    whereParts.push('s.study_program_id = ?');
    params.push(targetId);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const dateFilter = cutoffDate ? `AND date(pt.created_at) >= ?` : '';
  const queryParams: Array<string | number | null> = cutoffDate ? [cutoffDate, ...params] : params;

  const rows = db
    .prepare(`
      SELECT
        s.id AS student_id,
        s.nim,
        s.full_name,
        s.class_id,
        c.name AS class_name,
        s.study_program_id,
        sp.name AS study_program_name,
        s.status,
        s.total_points,
        s.total_exp,
        s.current_level,
        COALESCE(ls.current_streak, 0) AS current_streak,
        COALESCE((
          SELECT SUM(pt.amount)
          FROM point_transactions pt
          WHERE pt.student_id = s.id ${dateFilter}
        ), 0) AS period_points
      FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN study_programs sp ON sp.id = s.study_program_id
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ${whereClause}
      ORDER BY period_points DESC, s.total_points DESC, s.full_name ASC
    `)
    .all(...queryParams) as Array<Record<string, any>>;

  const isAdmin = req.auth!.role === 'admin';
  const ranked = rows.map((r, index) => ({
    rank: index + 1,
    student_id: String(r.student_id),
    ...(isAdmin ? { nim: String(r.nim) } : {}),
    full_name: String(r.full_name),
    class_id: String(r.class_id),
    class_name: String(r.class_name),
    study_program_id: String(r.study_program_id),
    study_program_name: String(r.study_program_name),
    status: String(r.status),
    current_level: Number(r.current_level),
    current_streak: Number(r.current_streak),
    period_points: Number(r.period_points),
    total_points: Number(r.total_points),
    total_exp: Number(r.total_exp),
  }));

  const myEntry = req.auth!.studentId
    ? ranked.find((r) => r.student_id === req.auth!.studentId) ?? null
    : null;

  res.json({
    entries: ranked,
    myEntry,
    scope,
    period,
    targetId,
  });
});

// ---------------------------------------------------------------------------
// STUDENT DASHBOARD, STREAK & EXP VIEWS
// ---------------------------------------------------------------------------
function computeStudentRank(studentId: string, scopeCol: 'class_id' | 'study_program_id', scopeVal: string): number {
  const rows = db
    .prepare(`
      SELECT id FROM students
      WHERE ${scopeCol} = ?
      ORDER BY total_points DESC, full_name ASC
    `)
    .all(scopeVal) as Array<{ id: string }>;
  const idx = rows.findIndex((r) => r.id === studentId);
  return idx >= 0 ? idx + 1 : 0;
}

learningRouter.get('/student/dashboard', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya tersedia untuk akun mahasiswa.' });
    return;
  }

  const studentId = req.auth!.studentId;
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
    .get(studentId) as Record<string, any>;

  const classRank = computeStudentRank(studentId, 'class_id', student.class_id);
  const programRank = computeStudentRank(studentId, 'study_program_id', student.study_program_id);
  const classTotal = Number(
    (db.prepare(`SELECT COUNT(*) AS c FROM students WHERE class_id = ?`).get(student.class_id) as { c: number }).c
  );
  const programTotal = Number(
    (
      db
        .prepare(`SELECT COUNT(*) AS c FROM students WHERE study_program_id = ?`)
        .get(student.study_program_id) as { c: number }
    ).c
  );

  const assignments = db
    .prepare(`
      SELECT a.*, sub.status AS submission_status, sub.score, sub.awarded_points
      FROM assignments a
      JOIN assignment_targets at ON at.assignment_id = a.id
      LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
      WHERE at.class_id = ?
      ORDER BY a.deadline ASC
      LIMIT 5
    `)
    .all(studentId, student.class_id);

  const materials = db
    .prepare(`
      SELECT m.*, COALESCE(mp.status, 'not_started') AS progress_status
      FROM materials m
      JOIN material_targets mt ON mt.material_id = m.id
      LEFT JOIN material_progress mp ON mp.material_id = m.id AND mp.student_id = ?
      WHERE mt.class_id = ? AND m.is_published = 1
      ORDER BY m.order_index ASC
    `)
    .all(studentId, student.class_id) as Array<Record<string, any>>;

  const completedMaterials = materials.filter((m) => m.progress_status === 'completed').length;
  const materialPercent = materials.length > 0 ? Math.round((completedMaterials / materials.length) * 100) : 0;

  const recentAttendance = db
    .prepare(`
      SELECT attendance_date, meeting_number, status
      FROM attendance
      WHERE student_id = ?
      ORDER BY attendance_date DESC, meeting_number DESC
      LIMIT 8
    `)
    .all(studentId);

  const recentPoints = db
    .prepare(`
      SELECT id, amount, source, description, created_at
      FROM point_transactions
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT 8
    `)
    .all(studentId);

  const settings = getSystemSettings();

  res.json({
    student,
    ranks: {
      classRank,
      classTotal,
      programRank,
      programTotal,
    },
    assignments,
    materials: materials.slice(0, 5),
    materialProgress: {
      total: materials.length,
      completed: completedMaterials,
      percent: materialPercent,
    },
    recentAttendance,
    recentPoints,
    levels: settings.levels,
    todayJakarta: getJakartaDateString(),
  });
});

learningRouter.get('/student/streak', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya tersedia untuk akun mahasiswa.' });
    return;
  }

  const streak = db
    .prepare(`SELECT * FROM login_streaks WHERE student_id = ?`)
    .get(req.auth!.studentId) ?? {
    current_streak: 0,
    best_streak: 0,
    total_login_days: 0,
    last_login_date: null,
  };

  const history = db
    .prepare(`
      SELECT id, login_date, streak_day, logged_in_at
      FROM login_history
      WHERE student_id = ?
      ORDER BY login_date DESC
      LIMIT 120
    `)
    .all(req.auth!.studentId);

  const todayJakarta = getJakartaDateString();
  const loggedInToday = history.some((h: any) => h.login_date === todayJakarta);

  res.json({
    streak,
    history,
    todayJakarta,
    loggedInToday,
  });
});

learningRouter.get('/student/exp', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya tersedia untuk akun mahasiswa.' });
    return;
  }

  const student = db
    .prepare(`SELECT total_exp, current_level FROM students WHERE id = ?`)
    .get(req.auth!.studentId) as { total_exp: number; current_level: number };

  const settings = getSystemSettings();
  const history = db
    .prepare(`
      SELECT id, amount, source, description, created_at
      FROM exp_transactions
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT 60
    `)
    .all(req.auth!.studentId);

  const achievements = db
    .prepare(`
      SELECT a.*, sa.unlocked_at
      FROM achievements a
      LEFT JOIN student_achievements sa
        ON sa.achievement_id = a.id AND sa.student_id = ?
      ORDER BY a.streak_required ASC
    `)
    .all(req.auth!.studentId)
    .map((a: any) => ({
      ...a,
      unlocked: Boolean(a.unlocked_at),
    }));

  res.json({
    totalExp: student.total_exp,
    currentLevel: student.current_level,
    levels: settings.levels,
    expConfig: settings.exp,
    history,
    achievements,
  });
});

learningRouter.get('/student/attendance', (req: AuthedRequest, res) => {
  if (req.auth!.role !== 'student' || !req.auth!.studentId) {
    res.status(403).json({ error: 'Hanya tersedia untuk akun mahasiswa.' });
    return;
  }

  const records = db
    .prepare(`
      SELECT a.id, a.attendance_date, a.meeting_number, a.status, a.source, a.created_at, c.name AS class_name
      FROM attendance a
      JOIN classes c ON c.id = a.class_id
      WHERE a.student_id = ?
      ORDER BY a.attendance_date DESC, a.meeting_number DESC
      LIMIT 100
    `)
    .all(req.auth!.studentId);

  const summary = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: records.length, rate: 0 };
  for (const r of records as Array<{ status: 'hadir' | 'izin' | 'sakit' | 'alpha' }>) {
    summary[r.status] = (summary[r.status] ?? 0) + 1;
  }
  summary.rate = summary.total > 0 ? Math.round((summary.hadir / summary.total) * 100) : 0;

  res.json({ records, summary });
});

learningRouter.get('/exp/overview', requireAdmin, (_req, res) => {
  const settings = getSystemSettings();
  const students = db
    .prepare(`
      SELECT s.id, s.nim, s.full_name, s.total_exp, s.current_level, s.status,
             c.name AS class_name, sp.name AS study_program_name,
             COALESCE(ls.current_streak, 0) AS current_streak,
             COALESCE(ls.best_streak, 0) AS best_streak,
             COALESCE(ls.total_login_days, 0) AS total_login_days
      FROM students s
      JOIN classes c ON c.id = s.class_id
      JOIN study_programs sp ON sp.id = s.study_program_id
      LEFT JOIN login_streaks ls ON ls.student_id = s.id
      ORDER BY s.total_exp DESC, COALESCE(ls.current_streak, 0) DESC, s.full_name ASC
      LIMIT 100
    `)
    .all();

  const recentExp = db
    .prepare(`
      SELECT et.id, et.amount, et.source, et.description, et.created_at,
             s.full_name AS student_name, s.nim
      FROM exp_transactions et
      JOIN students s ON s.id = et.student_id
      ORDER BY et.created_at DESC
      LIMIT 40
    `)
    .all();

  res.json({ students, recentExp, levels: settings.levels, expConfig: settings.exp });
});

