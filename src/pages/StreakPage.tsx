import { useEffect, useState } from 'react';
import { Flame, Calendar, CheckCircle2, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, PageHeader, StatCard } from '../components/ui/DesignSystem.tsx';
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
      <PageHeader
        title="Daily Login Streak"
        description="Login setiap hari (zona waktu Asia/Jakarta) untuk menjaga nyala streak dan meraih bonus EXP mingguan & bulanan."
      />

      {/* Hero & Stats */}
      <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-12 gap-4">
        <Card
          variant="dark"
          className="tablet:col-span-2 desktop:col-span-6 flex items-center gap-5"
        >
          <div
            className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 border ${
              loggedInToday
                ? 'bg-[#232822] border-[#FF7A1A]/35'
                : 'bg-[#232822] border-[#232822]'
            }`}
          >
            <Flame
              className={`w-10 h-10 ${
                loggedInToday ? 'text-[#FF7A1A] fill-[#FF7A1A] animate-flame' : 'text-[#6F7B68]'
              }`}
            />
          </div>
          <div className="min-w-0">
            <StreakFlame
              days={streak.current_streak}
              activeToday={loggedInToday}
              size="lg"
              darkSurface
            />
            <div className="mt-2.5 text-xs text-[#DCECB8]/85 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#B5D45D] shrink-0" />
              <span>
                {loggedInToday
                  ? `Streak hari ini (${todayJakarta}) telah tercatat otomatis saat login.`
                  : 'Login terverifikasi mencatat streak harian Anda.'}
              </span>
            </div>
          </div>
        </Card>

        <div className="desktop:col-span-3">
          <StatCard
            label="Best Streak"
            value={`${streak.best_streak} Hari`}
            sublabel="Rekor beruntun terbaik"
            icon={<Trophy className="w-5 h-5" />}
            variant="soft"
          />
        </div>

        <div className="desktop:col-span-3">
          <StatCard
            label="Total Login Days"
            value={`${streak.total_login_days} Hari`}
            sublabel="Total hari aktif"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Calendar & History */}
      <div className="grid grid-cols-1 desktop:grid-cols-12 gap-6">
        <Card className="desktop:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3E7B27]" />
              <h2 className="font-display text-base font-bold text-[#20251D]">
                Kalender Aktivitas — {monthLabel}
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] text-xs font-semibold text-[#4E5849]">
              WIB (Asia/Jakarta)
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#6F7B68] mb-2">
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
                      ? 'bg-[#171A17] border-[#171A17] text-[#B5D45D] font-bold'
                      : isToday
                        ? 'bg-[#DCECB8] border-[#B5D45D] text-[#20251D] font-bold'
                        : 'bg-[#F0F8DF]/70 border-[#D5E4B6] text-[#6F7B68]'
                  }`}
                >
                  <span>{cell.day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="desktop:col-span-5">
          <h2 className="font-display text-base font-bold text-[#20251D] mb-4">
            Riwayat Login Harian
          </h2>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6F7B68]">Belum ada riwayat login.</div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]/60 max-h-[340px] overflow-y-auto pr-1">
              {history.map((h: any) => (
                <div key={h.id} className="py-3 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#20251D] tabular-nums">{h.login_date}</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECB8] text-xs font-bold text-[#20251D] tabular-nums">
                    <Flame className="w-3.5 h-3.5 text-[#FF7A1A] fill-[#FF7A1A]" />
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
