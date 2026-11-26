import { useEffect, useState } from 'react';
import { Flame, Calendar, CheckCircle2, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, StatCard } from '../components/ui/DesignSystem.tsx';
import { StreakFlame } from '../components/ui/BrandLogo.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';

export function StreakPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/student/streak')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <TableSkeleton rows={6} />;
  }

  const { streak, history, todayJakarta, loggedInToday } = data;
  const loginDateSet = new Set<string>(history.map((h: any) => h.login_date));

  const [yearNum, monthNum] = todayJakarta.split('-').map(Number);
  const firstDayOfMonth = new Date(Date.UTC(yearNum, monthNum - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(yearNum, monthNum - 1, 1)));

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayOfMonth; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Daily Login Streak</h1>
        <p className="text-sm text-[#73796C] mt-1">
          Login setiap hari (zona waktu Asia/Jakarta) untuk menjaga nyala streak dan meraih bonus EXP mingguan & bulanan.
        </p>
      </div>

      {/* Hero & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card variant="soft" className="lg:col-span-6 flex items-center gap-5">
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 border ${
              loggedInToday
                ? 'bg-white border-[#B5D45D]'
                : 'bg-[#F0F8E0] border-[#DDE6C9]'
            }`}
          >
            <Flame
              className={`w-10 h-10 ${
                loggedInToday ? 'text-[#D8A33D] fill-[#D8A33D] animate-flame' : 'text-[#73796C]'
              }`}
            />
          </div>
          <div className="min-w-0">
            <StreakFlame days={streak.current_streak} activeToday={loggedInToday} size="lg" />
            <div className="mt-2 text-xs text-[#181A17] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3D914C] shrink-0" />
              <span>
                {loggedInToday
                  ? `Streak hari ini (${todayJakarta}) telah tercatat otomatis saat login.`
                  : 'Login terverifikasi mencatat streak harian Anda.'}
              </span>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-3">
          <StatCard
            label="Best Streak"
            value={`${streak.best_streak} Hari`}
            sublabel="Rekor beruntun terbaik"
            icon={<Trophy className="w-5 h-5" />}
          />
        </div>

        <div className="lg:col-span-3">
          <StatCard
            label="Total Login Days"
            value={`${streak.total_login_days} Hari`}
            sublabel="Total hari aktif"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Calendar & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3D914C]" />
              <h2 className="text-base font-bold text-[#181A17]">
                Kalender Aktivitas — {monthLabel}
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F0F8E0] border border-[#DDE6C9] text-xs font-semibold text-[#73796C]">
              WIB (Asia/Jakarta)
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#73796C] mb-2">
            <div>Min</div>
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {cells.map((cell, idx) => {
              if (!cell.day || !cell.dateStr) {
                return <div key={idx} className="h-11 rounded-2xl bg-transparent" />;
              }
              const isLogged = loginDateSet.has(cell.dateStr);
              const isToday = cell.dateStr === todayJakarta;
              return (
                <div
                  key={cell.dateStr}
                  className={`h-11 rounded-2xl border flex items-center justify-center text-xs font-semibold tabular-nums transition-colors ${
                    isLogged
                      ? 'bg-[#181A17] border-[#181A17] text-[#B5D45D] font-bold'
                      : isToday
                        ? 'bg-[#DBECB8] border-[#B5D45D] text-[#181A17] font-bold'
                        : 'bg-[#F0F8E0]/60 border-[#DDE6C9] text-[#73796C]'
                  }`}
                >
                  <span>{cell.day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <h2 className="text-base font-bold text-[#181A17] mb-4">Riwayat Login Harian</h2>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#73796C]">Belum ada riwayat login.</div>
          ) : (
            <div className="divide-y divide-[#DDE6C9]/60 max-h-[340px] overflow-y-auto pr-1">
              {history.map((h: any) => (
                <div key={h.id} className="py-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#181A17] tabular-nums">{h.login_date}</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-xs font-bold text-[#181A17] tabular-nums">
                    <Flame className="w-3.5 h-3.5 text-[#D8A33D] fill-[#D8A33D]" />
                    <span>{h.streak_day} DAY STREAK</span>
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
