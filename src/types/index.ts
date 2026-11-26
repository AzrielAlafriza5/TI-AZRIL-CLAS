export type UserRole = 'admin' | 'student';
export type StudentStatus = 'hijau' | 'netral' | 'merah';
export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpha';
export type SubmissionStatus = 'not_submitted' | 'submitted' | 'late' | 'graded' | 'revision';
export type MaterialProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  avatar_url: string | null;
  student?: StudentProfile | null;
}

export interface StudentProfile {
  id: string;
  profile_id: string;
  nim: string;
  full_name: string;
  study_program_id: string;
  study_program_name?: string;
  study_program_code?: string;
  class_id: string;
  class_name?: string;
  status: StudentStatus;
  total_points: number;
  total_exp: number;
  current_level: number;
  current_streak?: number;
  best_streak?: number;
  total_login_days?: number;
  last_login_date?: string | null;
  created_at: string;
}

export interface StudyProgram {
  id: string;
  code: string;
  name: string;
  description: string;
  class_count?: number;
  student_count?: number;
  created_at: string;
}

export interface ClassGroup {
  id: string;
  study_program_id: string;
  study_program_name?: string;
  study_program_code?: string;
  name: string;
  academic_year: string;
  description: string;
  student_count?: number;
  created_at: string;
}

export interface AssignmentTarget {
  class_id: string;
  class_name?: string;
  study_program_id: string;
  study_program_name?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  attachment_url: string | null;
  attachment_name: string | null;
  deadline: string;
  max_points: number;
  created_at: string;
  targets: AssignmentTarget[];
  submission_count?: number;
  graded_count?: number;
  my_submission?: Submission | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  student_id: string;
  student_name?: string;
  student_nim?: string;
  class_name?: string;
  file_url: string | null;
  file_name: string | null;
  drive_link: string | null;
  answer_text: string;
  status: 'submitted' | 'late' | 'graded' | 'revision';
  score: number | null;
  awarded_points: number;
  admin_notes: string;
  submitted_at: string;
  graded_at: string | null;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  topic: string;
  drive_url: string;
  order_index: number;
  published_at: string;
  is_published: boolean;
  targets: AssignmentTarget[];
  my_status?: MaterialProgressStatus;
  completed_count?: number;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name?: string;
  nim?: string;
  class_id: string;
  class_name?: string;
  attendance_date: string;
  meeting_number: number;
  status: AttendanceStatus;
  source: 'manual' | 'excel';
  created_at: string;
}

export interface PointTransaction {
  id: string;
  student_id: string;
  student_name?: string;
  nim?: string;
  class_name?: string;
  amount: number;
  source: 'assignment' | 'attendance' | 'question' | 'critical_question' | 'discussion' | 'bonus' | 'adjustment';
  description: string;
  admin_name?: string;
  created_at: string;
}

export interface ExpTransaction {
  id: string;
  student_id: string;
  amount: number;
  source: string;
  description: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  streak_required: number;
  exp_reward: number;
  badge_icon: string;
  unlocked?: boolean;
  unlocked_at?: string | null;
}

export interface LevelThreshold {
  level: number;
  min_exp: number;
  title: string;
}

export interface SystemSettings {
  points: {
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    question: number;
    critical_question: number;
    discussion: number;
  };
  exp: {
    daily_login: number;
    weekly_streak_7: number;
    monthly_streak_30: number;
  };
  levels: LevelThreshold[];
}

export interface NotificationItem {
  id: string;
  recipient_profile_id: string;
  title: string;
  message: string;
  category: string;
  is_read: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  nim: string;
  full_name: string;
  class_id: string;
  class_name: string;
  study_program_id: string;
  study_program_name: string;
  status: StudentStatus;
  period_points: number;
  total_points: number;
  total_exp: number;
  current_level: number;
  current_streak: number;
}
