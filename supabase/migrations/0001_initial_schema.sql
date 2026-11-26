-- =============================================================================
-- IT AZRIL CLAS — Complete Supabase PostgreSQL Schema & Row Level Security
-- 22 Core Tables + Foreign Keys + Unique Anti-Duplication Constraints + RLS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles (linked to auth.users, single principal admin + students)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce single principal admin at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_admin_role
  ON public.profiles (role)
  WHERE role = 'admin';

-- 2. study_programs
CREATE TABLE IF NOT EXISTS public.study_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. classes
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_program_id UUID NOT NULL REFERENCES public.study_programs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL DEFAULT '2026/2027',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_program_id, name)
);

-- 4. students (one active class at a time, unique NIM)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nim TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  study_program_id UUID NOT NULL REFERENCES public.study_programs(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'netral' CHECK (status IN ('hijau', 'netral', 'merah')),
  total_points INTEGER NOT NULL DEFAULT 0,
  total_exp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_nim ON public.students(nim);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_program ON public.students(study_program_id);

-- 5. assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  deadline TIMESTAMPTZ NOT NULL,
  max_points INTEGER NOT NULL DEFAULT 100 CHECK (max_points >= 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. assignment_targets (multi-class / multi-program delivery)
CREATE TABLE IF NOT EXISTS public.assignment_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  study_program_id UUID NOT NULL REFERENCES public.study_programs(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE (assignment_id, class_id)
);

-- 7. submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_url TEXT,
  file_name TEXT,
  drive_link TEXT,
  answer_text TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'graded', 'revision')),
  score NUMERIC(6,2),
  awarded_points INTEGER NOT NULL DEFAULT 0,
  admin_notes TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES public.profiles(id),
  UNIQUE (assignment_id, student_id)
);

-- 8. materials
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'Umum',
  drive_url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 1,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. material_targets
CREATE TABLE IF NOT EXISTS public.material_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  study_program_id UUID NOT NULL REFERENCES public.study_programs(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  UNIQUE (material_id, class_id)
);

-- 10. material_progress (per-student individual status)
CREATE TABLE IF NOT EXISTS public.material_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, student_id)
);

-- 11. attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  meeting_number INTEGER NOT NULL CHECK (meeting_number >= 1),
  status TEXT NOT NULL CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel')),
  import_id UUID,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, attendance_date, meeting_number)
);

-- 12. point_transactions (append-only academic points ledger)
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('assignment', 'attendance', 'question', 'critical_question', 'discussion', 'bonus', 'adjustment')),
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  admin_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_unique_ref
  ON public.point_transactions(student_id, source, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL AND source IN ('attendance', 'assignment');

-- 13. student_status_history
CREATE TABLE IF NOT EXISTS public.student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('hijau', 'netral', 'merah')),
  new_status TEXT NOT NULL CHECK (new_status IN ('hijau', 'netral', 'merah')),
  reason TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'excel')),
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. login_streaks
CREATE TABLE IF NOT EXISTS public.login_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID UNIQUE NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  total_login_days INTEGER NOT NULL DEFAULT 0,
  last_login_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. login_history (1 record per local Asia/Jakarta calendar day)
CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  streak_day INTEGER NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, login_date)
);

-- 16. exp_transactions (anti-duplication unique reference index)
CREATE TABLE IF NOT EXISTS public.exp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  source TEXT NOT NULL CHECK (source IN ('daily_login', 'weekly_streak', 'monthly_streak', 'achievement', 'bonus')),
  description TEXT NOT NULL,
  reference_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, reference_key)
);

-- 17. achievements
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  streak_required INTEGER NOT NULL UNIQUE,
  exp_reward INTEGER NOT NULL DEFAULT 0,
  badge_icon TEXT NOT NULL DEFAULT 'flame'
);

-- 18. student_achievements (1 time unlock per achievement per student)
CREATE TABLE IF NOT EXISTS public.student_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, achievement_id)
);

-- 19. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. excel_import_history
CREATE TABLE IF NOT EXISTS public.excel_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL CHECK (import_type IN ('attendance', 'student_status')),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  matched_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- HELPER FUNCTIONS & ROW LEVEL SECURITY (RLS)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_import_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Admin reads all, users read own profile
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.is_admin());
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (id = auth.uid());

-- Study Programs & Classes: Readable by authenticated users, writable only by Admin
CREATE POLICY "programs_read_auth" ON public.study_programs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "programs_admin_write" ON public.study_programs FOR ALL USING (public.is_admin());

CREATE POLICY "classes_read_auth" ON public.classes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "classes_admin_write" ON public.classes FOR ALL USING (public.is_admin());

-- Students: Admin full access, Student reads own record (public leaderboard handled via secure RPC/backend view)
CREATE POLICY "students_admin_all" ON public.students FOR ALL USING (public.is_admin());
CREATE POLICY "students_self_select" ON public.students FOR SELECT USING (profile_id = auth.uid());

-- Assignments & Targets: Admin all, Student reads assignments targeting their class
CREATE POLICY "assignments_admin_all" ON public.assignments FOR ALL USING (public.is_admin());
CREATE POLICY "assignments_student_select" ON public.assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.assignment_targets at
    JOIN public.students s ON s.class_id = at.class_id
    WHERE at.assignment_id = assignments.id AND s.profile_id = auth.uid()
  )
);
CREATE POLICY "assignment_targets_admin_all" ON public.assignment_targets FOR ALL USING (public.is_admin());
CREATE POLICY "assignment_targets_student_select" ON public.assignment_targets FOR SELECT USING (
  class_id = (SELECT class_id FROM public.students WHERE profile_id = auth.uid())
);

-- Submissions: Admin full access, Student inserts/reads/updates own ungraded submission
CREATE POLICY "submissions_admin_all" ON public.submissions FOR ALL USING (public.is_admin());
CREATE POLICY "submissions_student_own" ON public.submissions FOR SELECT USING (student_id = public.current_student_id());
CREATE POLICY "submissions_student_insert" ON public.submissions FOR INSERT WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "submissions_student_update" ON public.submissions FOR UPDATE USING (student_id = public.current_student_id() AND status IN ('submitted', 'revision'));

-- Materials & Progress
CREATE POLICY "materials_admin_all" ON public.materials FOR ALL USING (public.is_admin());
CREATE POLICY "materials_student_select" ON public.materials FOR SELECT USING (
  is_published = TRUE AND EXISTS (
    SELECT 1 FROM public.material_targets mt
    JOIN public.students s ON s.class_id = mt.class_id
    WHERE mt.material_id = materials.id AND s.profile_id = auth.uid()
  )
);
CREATE POLICY "material_targets_admin_all" ON public.material_targets FOR ALL USING (public.is_admin());
CREATE POLICY "material_targets_student_select" ON public.material_targets FOR SELECT USING (
  class_id = (SELECT class_id FROM public.students WHERE profile_id = auth.uid())
);
CREATE POLICY "material_progress_admin_all" ON public.material_progress FOR ALL USING (public.is_admin());
CREATE POLICY "material_progress_student_own" ON public.material_progress FOR ALL USING (student_id = public.current_student_id());

-- Attendance, Points, Status History, Streaks, EXP (Admin writes, Student reads own)
CREATE POLICY "attendance_admin_all" ON public.attendance FOR ALL USING (public.is_admin());
CREATE POLICY "attendance_student_select" ON public.attendance FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "points_admin_all" ON public.point_transactions FOR ALL USING (public.is_admin());
CREATE POLICY "points_student_select" ON public.point_transactions FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "status_history_admin_all" ON public.student_status_history FOR ALL USING (public.is_admin());
CREATE POLICY "status_history_student_select" ON public.student_status_history FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "streaks_admin_all" ON public.login_streaks FOR ALL USING (public.is_admin());
CREATE POLICY "streaks_student_select" ON public.login_streaks FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "login_history_admin_all" ON public.login_history FOR ALL USING (public.is_admin());
CREATE POLICY "login_history_student_select" ON public.login_history FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "exp_admin_all" ON public.exp_transactions FOR ALL USING (public.is_admin());
CREATE POLICY "exp_student_select" ON public.exp_transactions FOR SELECT USING (student_id = public.current_student_id());

-- Achievements, Notifications, Imports, Settings, Audit Logs
CREATE POLICY "achievements_read_auth" ON public.achievements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "achievements_admin_all" ON public.achievements FOR ALL USING (public.is_admin());

CREATE POLICY "student_achievements_admin_all" ON public.student_achievements FOR ALL USING (public.is_admin());
CREATE POLICY "student_achievements_self" ON public.student_achievements FOR SELECT USING (student_id = public.current_student_id());

CREATE POLICY "notifications_self_select" ON public.notifications FOR SELECT USING (recipient_profile_id = auth.uid());
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE USING (recipient_profile_id = auth.uid());
CREATE POLICY "notifications_admin_all" ON public.notifications FOR ALL USING (public.is_admin());

CREATE POLICY "excel_imports_admin_only" ON public.excel_import_history FOR ALL USING (public.is_admin());
CREATE POLICY "settings_read_auth" ON public.system_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "settings_admin_write" ON public.system_settings FOR ALL USING (public.is_admin());
CREATE POLICY "audit_logs_admin_only" ON public.audit_logs FOR ALL USING (public.is_admin());

-- =============================================================================
-- SUPABASE STORAGE BUCKET
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('it-azril-clas-files', 'it-azril-clas-files', false)
ON CONFLICT (id) DO NOTHING;
