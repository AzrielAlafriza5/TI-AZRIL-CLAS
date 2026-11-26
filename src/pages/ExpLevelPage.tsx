import { useEffect, useState } from 'react';
import {
  Sparkles,
  Award,
  Flame,
  Zap,
  Trophy,
  Shield,
  Crown,
  CheckCircle2,
  Lock,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, EmptyState, PageHeader, ProgressBar, StatCard } from '../components/ui/DesignSystem.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { AuthUser } from '../types/index.ts';

function AchievementIcon({ name, unlocked }: { name: string; unlocked: boolean }) {
  const cls = `w-5 h-5 ${unlocked ? 'text-[#171A17]' : 'text-[#6F7B68]'}`;
  switch (name) {
    case 'zap':
      return <Zap className={cls} />;
    case 'award':
      return <Award className={cls} />;
    case 'trophy':
      return <Trophy className={cls} />;
    case 'shield':
      return <Shield className={cls} />;
    case 'crown':
      return <Crown className={cls} />;
    default:
      return <Flame className={cls} />;
  }
}

interface ExpLevelPageProps {
  user: AuthUser;
}

export function ExpLevelPage({ user }: ExpLevelPageProps) {
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const endpoint = isAdmin ? '/api/exp/overview' : '/api/student/exp';
    apiFetch(endpoint)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (loading || !data) {
    return <TableSkeleton rows={6} />;
  }

  if (isAdmin) {
    const { students, recentExp, expConfig } = data;
    const totalExpAll = students.reduce((acc: number, s: any) => acc + Number(s.total_exp || 0), 0);
    const activeStreaks = students.filter((s: any) => Number(s.current_streak || 0) > 0).length;
    const topLevel = students.reduce((max: number, s: any) => Math.max(max, Number(s.current_level || 1)), 1);

    return (
      <div className="space-y-6">
        <PageHeader
          title="XP Aktif & Konsistensi"
          description="Pantau akumulasi EXP harian, level mahasiswa, dan aktivitas login streak seluruh kelas."
        />

        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
          <StatCard
            label="Total EXP Terkumpul"
            value={totalExpAll.toLocaleString('id-ID')}
            sublabel="Seluruh mahasiswa aktif"
            icon={<Sparkles className="w-5 h-5" />}
            variant="dark"
          />
          <StatCard
            label="Streak Harian Aktif"
            value={activeStreaks}
            sublabel={`Dari ${students.length} mahasiswa`}
            icon={<Flame className="w-5 h-5 text-[#FF7A1A]" />}
            variant="soft"
          />
          <StatCard
            label="Level Tertinggi"
            value={`Lv.${topLevel}`}
            sublabel="Pencapaian saat ini"
            icon={<Crown className="w-5 h-5" />}
          />
          <StatCard
            label="Reward Harian / 7d / 30d"
            value={`${expConfig.daily_login} / ${expConfig.weekly_streak_7} / ${expConfig.monthly_streak_30}`}
            sublabel="Aturan EXP aktif"
            icon={<Users className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 desktop:grid-cols-12 gap-6">
          <Card className="desktop:col-span-7 p-0 overflow-hidden">
            <div className="px-6 py-5 border-b border-[#D5E4B6] flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#20251D]">
                Peringkat EXP & Streak Mahasiswa
              </h2>
              <span className="text-xs font-semibold text-[#6F7B68] tabular-nums">
                {students.length} Mahasiswa
              </span>
            </div>
            {students.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Users className="w-5 h-5" />}
                  title="Belum ada data mahasiswa"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                      <th className="py-3 px-5">Mahasiswa</th>
                      <th className="py-3 px-4 hidden tablet:table-cell">Kelas</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Streak</th>
                      <th className="py-3 px-5 text-right">EXP / Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E4B6]/60">
                    {students.map((s: any) => (
                      <tr key={s.id} className="hover:bg-[#F0F8DF]/60 transition-colors">
                        <td className="py-3 px-5">
                          <div className="font-display font-bold text-[#20251D]">{s.full_name}</div>
                          <div className="text-xs text-[#6F7B68] tabular-nums">
                            NIM {s.nim}
                            <span className="tablet:hidden"> · {s.class_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#6F7B68] hidden tablet:table-cell">
                          <div className="font-semibold text-[#20251D]">{s.class_name}</div>
                          <div>{s.study_program_name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <StudentStatusIndicator status={s.status} />
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCECB8] text-xs font-bold text-[#20251D]">
                            <Flame className="w-3 h-3 text-[#FF7A1A] fill-[#FF7A1A]" />
                            {s.current_streak}d
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums">
                          <div className="font-display font-bold text-[#20251D]">
                            {Number(s.total_exp).toLocaleString('id-ID')} EXP
                          </div>
                          <div className="text-xs text-[#3E7B27] font-semibold">Lv.{s.current_level}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="desktop:col-span-5">
            <h2 className="font-display text-base font-bold text-[#20251D] mb-4">
              Aktivitas EXP Terbaru
            </h2>
            {recentExp.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6F7B68]">Belum ada transaksi EXP.</div>
            ) : (
              <div className="divide-y divide-[#D5E4B6]/60 max-h-[520px] overflow-y-auto pr-1">
                {recentExp.map((e: any) => (
                  <div key={e.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[#20251D] truncate">
                        {e.student_name}
                      </div>
                      <div className="text-xs text-[#4E5849] truncate">{e.description}</div>
                      <div className="text-[11px] text-[#6F7B68] tabular-nums mt-0.5">
                        {String(e.created_at).slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#DCECB8] text-xs font-bold text-[#3E7B27] tabular-nums shrink-0">
                      +{e.amount} EXP
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

  // Student View
  const { totalExp, currentLevel, levels, expConfig, history, achievements } = data;
  const sortedLevels = [...levels].sort((a: any, b: any) => a.min_exp - b.min_exp);
  const currentLvlObj = sortedLevels.find((l: any) => l.level === currentLevel) ?? sortedLevels[0];
  const nextLvlObj = sortedLevels.find((l: any) => l.level === currentLevel + 1);
  const pct = nextLvlObj
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((totalExp - (currentLvlObj?.min_exp ?? 0)) /
              Math.max(1, nextLvlObj.min_exp - (currentLvlObj?.min_exp ?? 0))) *
              100
          )
        )
      )
    : 100;

  return (
    <div className="space-y-6">
      <PageHeader
        title="XP Aktif, Level & Pencapaian"
        description="EXP mencerminkan konsistensi belajar Anda dan terpisah dari Poin Akademik leaderboard."
      />

      {/* Level Dark Hero Card */}
      <Card
        variant="dark"
        className="flex flex-col desktop:flex-row desktop:items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-[#B5D45D] text-[#171A17] flex flex-col items-center justify-center shrink-0">
            <span className="font-display text-[10px] font-bold tracking-wider">LEVEL</span>
            <span className="font-display text-2xl font-extrabold leading-none tabular-nums">
              {currentLevel}
            </span>
          </div>
          <div>
            <div className="text-xs font-bold text-[#B5D45D]">
              {currentLvlObj?.title ?? `Level ${currentLevel}`}
            </div>
            <div className="font-display text-3xl font-bold text-white tabular-nums mt-0.5">
              {totalExp.toLocaleString('id-ID')} EXP
            </div>
            <div className="text-xs text-[#DCECB8]/80 mt-1 tabular-nums">
              Harian: +{expConfig.daily_login} EXP · Mingguan (7d): +{expConfig.weekly_streak_7} EXP · Bulanan (30d): +
              {expConfig.monthly_streak_30} EXP
            </div>
          </div>
        </div>

        <div className="w-full desktop:w-80 bg-[#232822] rounded-[20px] p-4 border border-[#232822]">
          <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
            <span>Progres ke Level {nextLvlObj ? nextLvlObj.level : currentLevel}</span>
            <span className="text-[#B5D45D] tabular-nums">{pct}%</span>
          </div>
          <ProgressBar percent={pct} height="h-3" darkTrack fillClass="bg-[#B5D45D]" />
          <div className="text-xs text-[#DCECB8]/80 mt-2 tabular-nums">
            {nextLvlObj
              ? `Butuh ${Math.max(0, nextLvlObj.min_exp - totalExp)} EXP lagi untuk membuka "${nextLvlObj.title}"`
              : 'Anda berada di level tertinggi!'}
          </div>
        </div>
      </Card>

      {/* Achievements Grid */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-4 h-4 text-[#3E7B27]" />
          <h2 className="font-display text-base font-bold text-[#20251D]">
            Daftar Pencapaian & Reward Konsistensi
          </h2>
        </div>

        <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 gap-4">
          {achievements.map((a: any) => (
            <div
              key={a.id}
              className={`border rounded-[20px] p-4 flex items-start gap-3.5 transition-colors ${
                a.unlocked
                  ? 'bg-[#DCECB8]/70 border-[#B5D45D]'
                  : 'bg-[#F0F8DF]/60 border-[#D5E4B6] opacity-90'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  a.unlocked ? 'bg-[#B5D45D]' : 'bg-white border border-[#D5E4B6]'
                }`}
              >
                <AchievementIcon name={a.badge_icon} unlocked={a.unlocked} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-[#20251D] truncate">
                    {a.title}
                  </span>
                  {a.unlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-[#3E7B27] shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-[#6F7B68] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#4E5849] mt-1">{a.description}</p>
                <div className="mt-2.5 flex items-center gap-2 text-xs font-bold tabular-nums">
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-[#3E7B27] border border-[#D5E4B6]">
                    +{a.exp_reward} EXP
                  </span>
                  <span className="text-[#6F7B68]">Target {a.streak_required} hari</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Level Ladder & EXP History */}
      <div className="grid grid-cols-1 desktop:grid-cols-12 gap-6">
        <Card className="desktop:col-span-5">
          <h2 className="font-display text-base font-bold text-[#20251D] mb-4">Tingkatan Level</h2>
          <div className="divide-y divide-[#D5E4B6]/60">
            {sortedLevels.map((l: any) => {
              const reached = totalExp >= l.min_exp;
              return (
                <div key={l.level} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-full font-display font-bold text-xs flex items-center justify-center tabular-nums ${
                        reached
                          ? 'bg-[#171A17] text-[#B5D45D]'
                          : 'bg-[#F0F8DF] border border-[#D5E4B6] text-[#6F7B68]'
                      }`}
                    >
                      {l.level}
                    </span>
                    <span className={reached ? 'font-bold text-[#20251D]' : 'text-[#6F7B68]'}>
                      {l.title}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-[#6F7B68] tabular-nums">
                    {l.min_exp}+ EXP
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="desktop:col-span-7">
          <h2 className="font-display text-base font-bold text-[#20251D] mb-4">
            Riwayat Perolehan EXP
          </h2>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#6F7B68]">Belum ada riwayat EXP.</div>
          ) : (
            <div className="divide-y divide-[#D5E4B6]/60 max-h-[340px] overflow-y-auto pr-1">
              {history.map((h: any) => (
                <div key={h.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <div className="font-semibold text-[#20251D]">{h.description}</div>
                    <div className="text-xs text-[#6F7B68] tabular-nums mt-0.5">
                      {String(h.created_at).slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#DCECB8] text-xs font-bold text-[#3E7B27] tabular-nums shrink-0">
                    +{h.amount} EXP
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
