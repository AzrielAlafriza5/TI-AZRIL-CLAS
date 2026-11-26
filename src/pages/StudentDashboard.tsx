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
import { KpiGridSkeleton } from '../components/ui/Skeleton.tsx';
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
    return <KpiGridSkeleton count={8} />;
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
      {/* Greeting, Identity, Streak Flame & EXP Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#73796C]">
              <span className="text-[#181A17]">NIM {student.nim}</span>
              <span aria-hidden="true">·</span>
              <span>{student.study_program_name}</span>
              <span aria-hidden="true">·</span>
              <span>{student.class_name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#181A17] tracking-tight mt-2">
              Halo, {student.full_name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StudentStatusIndicator status={student.status} />
              <span className="px-3 py-1 rounded-full bg-[#B5D45D] text-[#181A17] text-xs font-bold">
                Level {student.current_level} · {currentLvlObj?.title ?? 'Learner'}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-[#DDE6C9]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#181A17] mb-2">
              <span>Progres EXP Menuju Level Berikutnya</span>
              <span className="tabular-nums">{student.total_exp} EXP</span>
            </div>
            <ProgressBar percent={expProgressPercent} height="h-3" />
            <div className="text-xs text-[#73796C] mt-2 tabular-nums">
              {nextLvlObj
                ? `${Math.max(0, nextLvlObj.min_exp - student.total_exp)} EXP lagi untuk membuka Level ${nextLvlObj.level} (${nextLvlObj.title})`
                : 'Level tertinggi telah tercapai'}
            </div>
          </div>
        </Card>

        {/* Daily Login Streak Highlight Card */}
        <Card variant="soft" className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-[#73796C]">Daily Login Streak</div>
            <div className="mt-3">
              <StreakFlame days={student.current_streak ?? 0} size="lg" />
            </div>
            <p className="text-xs text-[#73796C] mt-2 leading-relaxed">
              Pertahankan login harian (zona waktu WIB) untuk bonus mingguan 7 hari dan bulanan 30 hari.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-white/90 border border-[#DDE6C9] rounded-2xl p-3.5">
              <div className="text-[11px] text-[#73796C]">Best Streak</div>
              <div className="text-xl font-bold text-[#181A17] tabular-nums mt-0.5">
                {student.best_streak ?? 0} Hari
              </div>
            </div>
            <div className="bg-white/90 border border-[#DDE6C9] rounded-2xl p-3.5">
              <div className="text-[11px] text-[#73796C]">Total Login</div>
              <div className="text-xl font-bold text-[#181A17] tabular-nums mt-0.5">
                {student.total_login_days ?? 0} Hari
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Poin Akademik"
          value={student.total_points.toLocaleString('id-ID')}
          sublabel="Menentukan peringkat leaderboard"
          icon={<Coins className="w-5 h-5" />}
        />
        <StatCard
          label="Total EXP"
          value={student.total_exp.toLocaleString('id-ID')}
          sublabel={`Level ${student.current_level} aktif`}
          icon={<Sparkles className="w-5 h-5" />}
        />
        <StatCard
          label="Ranking Kelas"
          value={`#${ranks.classRank}`}
          sublabel={`Dari ${ranks.classTotal} mahasiswa di kelas`}
          icon={<Trophy className="w-5 h-5" />}
        />
        <StatCard
          label="Ranking Program Studi"
          value={`#${ranks.programRank}`}
          sublabel={`Dari ${ranks.programTotal} mahasiswa prodi`}
          icon={<Trophy className="w-5 h-5 text-[#3D914C]" />}
        />
      </div>

      {/* Assignments & Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#DBECB8] flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-[#181A17]" />
              </div>
              <h2 className="text-base font-bold text-[#181A17]">Tugas Terbaru</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('assignments')}>
              <span>Semua Tugas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {assignments.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#73796C]">
              Belum ada tugas untuk kelas Anda.
            </div>
          ) : (
            <div className="divide-y divide-[#DDE6C9]">
              {assignments.map((a: any) => (
                <div key={a.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#181A17] truncate">{a.title}</div>
                    <div className="text-xs text-[#73796C] mt-0.5 tabular-nums">
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
              <div className="w-9 h-9 rounded-full bg-[#DBECB8] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#181A17]" />
              </div>
              <h2 className="text-base font-bold text-[#181A17]">Materi Terbaru</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('materials')}>
              <span>Buka Materi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-[#73796C] mb-1.5">
              <span>Progres Penyelesaian Materi</span>
              <span className="text-[#181A17] tabular-nums">
                {materialProgress.completed}/{materialProgress.total} ({materialProgress.percent}%)
              </span>
            </div>
            <ProgressBar percent={materialProgress.percent} height="h-2" />
          </div>

          {materials.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#73796C]">
              Belum ada materi dipublikasikan.
            </div>
          ) : (
            <div className="divide-y divide-[#DDE6C9]">
              {materials.map((m: any) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#181A17] truncate">
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
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-[#181A17] bg-[#B5D45D] hover:bg-[#a7c84d] rounded-full whitespace-nowrap shrink-0"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#DBECB8] flex items-center justify-center">
                <CalendarCheck className="w-4 h-4 text-[#181A17]" />
              </div>
              <h2 className="text-base font-bold text-[#181A17]">Riwayat Absensi Terakhir</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('attendance')}>
              Lihat Semua
            </Button>
          </div>
          {recentAttendance.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#73796C]">Belum ada catatan absensi.</div>
          ) : (
            <div className="divide-y divide-[#DDE6C9]">
              {recentAttendance.map((att: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between text-sm">
                  <div className="font-medium text-[#181A17] tabular-nums">
                    Pertemuan {att.meeting_number} · <span className="text-[#73796C]">{att.attendance_date}</span>
                  </div>
                  <AttendanceStatusIndicator status={att.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#DBECB8] flex items-center justify-center">
              <Coins className="w-4 h-4 text-[#181A17]" />
            </div>
            <h2 className="text-base font-bold text-[#181A17]">Riwayat Aktivitas Poin</h2>
          </div>
          {recentPoints.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#73796C]">Belum ada aktivitas poin.</div>
          ) : (
            <div className="divide-y divide-[#DDE6C9]">
              {recentPoints.map((pt: any) => (
                <div key={pt.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-[#181A17] font-medium truncate">{pt.description}</div>
                    <div className="text-xs text-[#73796C] tabular-nums">
                      {String(pt.created_at).slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      pt.amount >= 0 ? 'text-[#3D914C]' : 'text-[#C44750]'
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
