import { useEffect, useState } from 'react';
import {
  Trophy,
  Sparkles,
  Coins,
  ClipboardList,
  BookOpen,
  CalendarCheck,
  ArrowRight,
  ExternalLink,
  Flame,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { StreakFlame } from '../components/ui/BrandLogo.tsx';
import { Card, StatCard, ProgressBar, Button } from '../components/ui/DesignSystem.tsx';
import {
  StudentStatusIndicator,
  SubmissionStatusIndicator,
  AttendanceStatusIndicator,
  MaterialStatusIndicator,
} from '../components/ui/StatusBadge.tsx';
import { KpiGridSkeleton, HeroSkeleton } from '../components/ui/Skeleton.tsx';
import type { NavRoute } from '../components/layout/AppShell.tsx';

interface StudentDashboardProps {
  onNavigate: (route: NavRoute) => void;
}

export function StudentDashboard({ onNavigate }: StudentDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/student/dashboard')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <HeroSkeleton />
        <KpiGridSkeleton count={4} />
      </div>
    );
  }

  const { student, ranks, assignments, materials, materialProgress, recentAttendance, recentPoints, levels } = data;

  const sortedLevels = [...(levels || [])].sort((a: any, b: any) => a.min_exp - b.min_exp);
  const currentLvlObj = sortedLevels.find((l: any) => l.level === student.current_level) ?? sortedLevels[0];
  const nextLvlObj = sortedLevels.find((l: any) => l.level === student.current_level + 1);
  const expProgressPercent = nextLvlObj
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((student.total_exp - (currentLvlObj?.min_exp ?? 0)) /
              Math.max(1, nextLvlObj.min_exp - (currentLvlObj?.min_exp ?? 0))) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="space-y-6">
      {/* Personal Greeting */}
      <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4E5849]">
            <span className="font-semibold text-[#20251D] tabular-nums">NIM {student.nim}</span>
            <span aria-hidden="true">·</span>
            <span>{student.study_program_name}</span>
            <span aria-hidden="true">·</span>
            <span>{student.class_name}</span>
          </div>
          <h1 className="font-display text-2xl desktop:text-[28px] font-bold text-[#20251D] tracking-tight mt-1">
            Halo, {student.full_name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StudentStatusIndicator status={student.status} />
          <span className="px-3.5 py-1 rounded-full bg-[#DCECB8] border border-[#D5E4B6] text-[#20251D] text-xs font-display font-bold">
            Level {student.current_level} · {currentLvlObj?.title ?? 'Learner'}
          </span>
        </div>
      </div>

      {/* Hero Dark Cards: XP/EXP & Daily Login Streak */}
      <div className="grid grid-cols-1 desktop:grid-cols-12 gap-5 items-stretch">
        {/* XP & EXP Dark Card */}
        <Card variant="dark" className="desktop:col-span-7 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#232822] text-[#B5D45D] text-xs font-display font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>XP & EXP Aktif</span>
              </div>
              <div className="font-display text-3xl tablet:text-4xl font-bold text-white tabular-nums tracking-tight mt-4">
                {student.total_exp.toLocaleString('id-ID')}{' '}
                <span className="text-lg text-[#B5D45D]">EXP</span>
              </div>
              <p className="text-xs text-[#DCECB8]/75 mt-1">
                Level {student.current_level} — {currentLvlObj?.title ?? 'Learner'}
              </p>
            </div>
            <Button size="sm" onClick={() => onNavigate('exp')}>
              <span>Detail XP</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="mt-6 pt-5 border-t border-[#232822]">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-[#DCECB8]">Progres Menuju Level Berikutnya</span>
              <span className="text-[#B5D45D] tabular-nums">{expProgressPercent}%</span>
            </div>
            <ProgressBar
              percent={expProgressPercent}
              height="h-3"
              darkTrack
              fillClass="bg-[#B5D45D]"
            />
            <div className="text-xs text-[#DCECB8]/75 mt-2 tabular-nums">
              {nextLvlObj
                ? `${Math.max(0, nextLvlObj.min_exp - student.total_exp)} EXP lagi untuk membuka Level ${nextLvlObj.level} (${nextLvlObj.title})`
                : 'Level tertinggi telah tercapai'}
            </div>
          </div>
        </Card>

        {/* Daily Login Streak Dark Card (#171A17 + #FF7A1A) */}
        <Card variant="dark" className="desktop:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#232822] text-[#FF7A1A] text-xs font-display font-semibold">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>Daily Login Streak</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('streak')}
                className="text-xs font-display font-semibold text-[#B5D45D] hover:underline cursor-pointer"
              >
                Lihat kalender
              </button>
            </div>

            <div className="mt-4">
              <StreakFlame days={student.current_streak ?? 0} size="lg" darkSurface />
            </div>
            <p className="text-xs text-[#DCECB8]/75 mt-2 leading-relaxed">
              Pertahankan login harian (WIB) untuk bonus mingguan 7 hari dan bulanan 30 hari.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-[#232822] border border-[#232822] rounded-[18px] p-3.5">
              <div className="text-[11px] text-[#DCECB8]/75">Best Streak</div>
              <div className="font-display text-xl font-bold text-white tabular-nums mt-0.5">
                {student.best_streak ?? 0} Hari
              </div>
            </div>
            <div className="bg-[#232822] border border-[#232822] rounded-[18px] p-3.5">
              <div className="text-[11px] text-[#DCECB8]/75">Total Login</div>
              <div className="font-display text-xl font-bold text-[#B5D45D] tabular-nums mt-0.5">
                {student.total_login_days ?? 0} Hari
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        <StatCard
          variant="soft"
          label="Total Poin Akademik"
          value={student.total_points.toLocaleString('id-ID')}
          sublabel="Menentukan peringkat leaderboard"
          icon={<Coins className="w-5 h-5" />}
        />
        <StatCard
          label="Total EXP"
          value={student.total_exp.toLocaleString('id-ID')}
          sublabel={`Level ${student.current_level} aktif`}
          icon={<Sparkles className="w-5 h-5 text-[#3E7B27]" />}
        />
        <StatCard
          label="Ranking Kelas"
          value={`#${ranks.classRank}`}
          sublabel={`Dari ${ranks.classTotal} mahasiswa di kelas`}
          icon={<Trophy className="w-5 h-5 text-[#C27C0A]" />}
        />
        <StatCard
          label="Ranking Program Studi"
          value={`#${ranks.programRank}`}
          sublabel={`Dari ${ranks.programTotal} mahasiswa prodi`}
          icon={<Trophy className="w-5 h-5 text-[#3E7B27]" />}
        />
      </div>

      {/* Assignments & Materials */}
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-[#20251D]" />
              </div>
              <h2 className="font-display text-base font-bold text-[#20251D]">Tugas & Deadline</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('assignments')}>
              <span>Semua Tugas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {assignments.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6F7B68]">
              Belum ada tugas untuk kelas Anda.
            </div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]">
              {assignments.map((a: any) => (
                <div key={a.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-[#20251D] truncate">
                      {a.title}
                    </div>
                    <div className="text-xs text-[#6F7B68] mt-0.5 tabular-nums">
                      Deadline: {String(a.deadline).replace('T', ' ')} · Maks {a.max_points} Poin
                    </div>
                  </div>
                  <div className="shrink-0">
                    <SubmissionStatusIndicator status={a.submission_status ?? 'not_submitted'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#20251D]" />
              </div>
              <h2 className="font-display text-base font-bold text-[#20251D]">Progress Pembelajaran</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('materials')}>
              <span>Buka Materi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="mb-4 p-3.5 rounded-[16px] bg-[#F0F8DF] border border-[#D5E4B6]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#4E5849] mb-1.5">
              <span>Penyelesaian Materi</span>
              <span className="text-[#20251D] tabular-nums">
                {materialProgress.completed}/{materialProgress.total} ({materialProgress.percent}%)
              </span>
            </div>
            <ProgressBar percent={materialProgress.percent} height="h-2" />
          </div>

          {materials.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6F7B68]">
              Belum ada materi dipublikasikan.
            </div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]">
              {materials.map((m: any) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-[#20251D] truncate">
                      {String(m.order_index).padStart(2, '0')}. {m.title}
                    </div>
                    <div className="mt-1">
                      <MaterialStatusIndicator status={m.progress_status} />
                    </div>
                  </div>
                  <a
                    href={m.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#171A17] bg-[#B5D45D] hover:bg-[#C5E370] rounded-full whitespace-nowrap shrink-0 transition-colors"
                  >
                    <span>Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Attendance & Activity */}
      <div className="grid grid-cols-1 desktop:grid-cols-2 gap-5">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-[#20251D]" />
              </div>
              <h2 className="font-display text-base font-bold text-[#20251D]">
                Riwayat Absensi Terakhir
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('attendance')}>
              Lihat Semua
            </Button>
          </div>
          {recentAttendance.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6F7B68]">Belum ada catatan absensi.</div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]">
              {recentAttendance.map((att: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between text-sm">
                  <div className="font-medium text-[#20251D] tabular-nums">
                    Pertemuan {att.meeting_number} ·{' '}
                    <span className="text-[#6F7B68]">{att.attendance_date}</span>
                  </div>
                  <AttendanceStatusIndicator status={att.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] flex items-center justify-center">
              <Coins className="w-4 h-4 text-[#20251D]" />
            </div>
            <h2 className="font-display text-base font-bold text-[#20251D]">
              Aktivitas Terbaru Poin
            </h2>
          </div>
          {recentPoints.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#6F7B68]">Belum ada aktivitas poin.</div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]">
              {recentPoints.map((pt: any) => (
                <div key={pt.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-[#20251D] font-medium truncate">{pt.description}</div>
                    <div className="text-xs text-[#6F7B68] tabular-nums">
                      {String(pt.created_at).slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <span
                    className={`font-display font-bold tabular-nums shrink-0 ${
                      pt.amount >= 0 ? 'text-[#3E7B27]' : 'text-[#D13447]'
                    }`}
                  >
                    {pt.amount >= 0 ? `+${pt.amount}` : pt.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
