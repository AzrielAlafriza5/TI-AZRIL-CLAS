import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  EmptyState,
  PageHeader,
  SegmentedControl,
  Select,
} from '../components/ui/DesignSystem.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { AuthUser, LeaderboardEntry } from '../types/index.ts';

interface LeaderboardPageProps {
  user: AuthUser;
}

export function LeaderboardPage({ user }: LeaderboardPageProps) {
  const [scope, setScope] = useState<'class' | 'study_program'>('class');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'semester' | 'all'>('all');
  const [targetId, setTargetId] = useState<string>('');

  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic')
      .then((res) => {
        setPrograms(res.programs);
        setClasses(res.classes);
        if (user.role === 'student' && user.student) {
          setTargetId(user.student.class_id);
        } else if (res.classes[0]) {
          setTargetId(res.classes[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('scope', scope);
    params.set('period', period);
    if (targetId) params.set('targetId', targetId);

    apiFetch<{ entries: LeaderboardEntry[]; myEntry: LeaderboardEntry | null }>(
      `/api/leaderboard?${params.toString()}`
    )
      .then((res) => {
        setEntries(res.entries);
        setMyEntry(res.myEntry);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope, period, targetId]);

  const handleScopeSwitch = (nextScope: 'class' | 'study_program') => {
    setScope(nextScope);
    if (nextScope === 'class') {
      if (user.role === 'student' && user.student) setTargetId(user.student.class_id);
      else setTargetId(classes[0]?.id ?? '');
    } else {
      if (user.role === 'student' && user.student) setTargetId(user.student.study_program_id);
      else setTargetId(programs[0]?.id ?? '');
    }
  };

  const topThree = entries.slice(0, 3);
  const podiumOrder: LeaderboardEntry[] =
    topThree.length >= 3
      ? [topThree[1], topThree[0], topThree[2]]
      : topThree;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="Peringkat kelas dan program studi berdasarkan total Poin Akademik."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <SegmentedControl
              value={scope}
              onChange={handleScopeSwitch}
              options={[
                { id: 'class', label: 'Ranking Kelas' },
                { id: 'study_program', label: 'Ranking Program Studi' },
              ]}
            />

            <Select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-full py-2"
            >
              <option value="">{scope === 'class' ? 'Semua Kelas' : 'Semua Program Studi'}</option>
              {scope === 'class'
                ? classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                : programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
            </Select>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 p-1.5 bg-white border border-[#D5E4B6] rounded-full">
          {[
            { id: 'weekly', label: 'Mingguan' },
            { id: 'monthly', label: 'Bulanan' },
            { id: 'semester', label: 'Semester' },
            { id: 'all', label: 'Keseluruhan' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id as any)}
              className={`font-display px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-all duration-150 cursor-pointer ${
                period === p.id
                  ? 'bg-[#B5D45D] text-[#171A17]'
                  : 'text-[#4E5849] hover:text-[#20251D] hover:bg-[#F0F8DF]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {myEntry && (
        <Card
          variant="dark"
          className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <div className="text-xs font-semibold text-[#B5D45D]">Peringkat Anda Saat Ini</div>
            <div className="font-display text-lg tablet:text-xl font-bold text-white mt-1 break-words">
              Peringkat #{myEntry.rank} · {myEntry.full_name}
            </div>
            <div className="text-xs text-[#DCECB8]/80 mt-0.5 break-words">
              {myEntry.class_name} · {myEntry.study_program_name}
            </div>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <div>
              <div className="text-xs text-[#DCECB8]/75">Poin Periode</div>
              <div className="font-display text-2xl font-bold text-[#B5D45D] tabular-nums">
                {myEntry.period_points}
              </div>
            </div>
            <div className="pl-6 border-l border-[#232822]">
              <div className="text-xs text-[#DCECB8]/75">EXP / Level</div>
              <div className="font-display text-lg font-bold text-white tabular-nums">
                {myEntry.total_exp} · Lv.{myEntry.current_level}
              </div>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-6 h-6" />}
          title="Belum ada data peringkat"
          description="Belum ada mahasiswa pada filter kelas, program studi, atau periode ini."
        />
      ) : (
        <>
          {/* Stepped Visual Podium (2 - 1 - 3 on all viewports) */}
          <div
            className={`grid items-end gap-2 tablet:gap-4 desktop:gap-5 pt-2 ${
              topThree.length === 1
                ? 'grid-cols-1 max-w-[240px] mx-auto'
                : topThree.length === 2
                  ? 'grid-cols-2 max-w-lg mx-auto'
                  : 'grid-cols-[1fr_1.12fr_1fr] tablet:grid-cols-3'
            }`}
          >
            {podiumOrder.map((entry) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;
              const stepHeight = isFirst
                ? 'min-h-[132px] tablet:min-h-[172px] desktop:min-h-[188px]'
                : isSecond
                  ? 'min-h-[104px] tablet:min-h-[138px] desktop:min-h-[150px]'
                  : 'min-h-[86px] tablet:min-h-[114px] desktop:min-h-[124px]';

              const stepSurface = isFirst
                ? 'bg-[#171A17] text-white border border-[#232822]'
                : isSecond
                  ? 'bg-[#DCECB8]/75 text-[#20251D] border border-[#B5D45D]'
                  : 'bg-white text-[#20251D] border border-[#D5E4B6]';

              return (
                <div
                  key={entry.student_id}
                  className="flex flex-col items-center justify-end min-w-0"
                >
                  {/* Student Identity Above Pedestal */}
                  <div className="flex flex-col items-center text-center px-1 pb-2.5 tablet:pb-3.5 w-full min-w-0">
                    <div
                      className={`w-10 h-10 tablet:w-12 tablet:h-12 rounded-2xl flex items-center justify-center shrink-0 mb-2 ${
                        isFirst
                          ? 'bg-[#171A17] text-[#B5D45D] border-2 border-[#B5D45D]'
                          : isSecond
                            ? 'bg-[#DCECB8] text-[#20251D] border border-[#B5D45D]'
                            : 'bg-[#FF7A1A]/15 text-[#FF7A1A] border border-[#FF7A1A]/35'
                      }`}
                    >
                      {isFirst ? (
                        <Trophy className="w-4 h-4 tablet:w-5 tablet:h-5" />
                      ) : (
                        <Medal className="w-4 h-4 tablet:w-5 tablet:h-5" />
                      )}
                    </div>

                    <div className="font-display text-[11px] tablet:text-sm desktop:text-[15px] font-bold text-[#20251D] leading-snug break-words w-full">
                      {entry.full_name}
                    </div>
                    <div className="text-[10px] tablet:text-xs text-[#6F7B68] leading-tight mt-0.5 break-words w-full">
                      {entry.class_name}
                    </div>
                  </div>

                  {/* Stepped Podium Pedestal */}
                  <div
                    className={`w-full rounded-t-[20px] rounded-b-[16px] tablet:rounded-t-[24px] tablet:rounded-b-[20px] px-2 py-3 tablet:px-4 tablet:py-4 flex flex-col items-center justify-between gap-2 text-center transition-all ${stepHeight} ${stepSurface}`}
                  >
                    <div
                      className={`font-display text-lg tablet:text-2xl font-extrabold leading-none tabular-nums ${
                        isFirst
                          ? 'text-[#B5D45D]'
                          : isSecond
                            ? 'text-[#3E7B27]'
                            : 'text-[#FF7A1A]'
                      }`}
                    >
                      #{entry.rank}
                    </div>

                    <div className="leading-none">
                      <div
                        className={`font-display text-xl tablet:text-3xl font-bold tabular-nums ${
                          isFirst ? 'text-white' : 'text-[#20251D]'
                        }`}
                      >
                        {entry.period_points}
                      </div>
                      <div
                        className={`text-[10px] tablet:text-xs font-semibold mt-0.5 ${
                          isFirst ? 'text-[#DCECB8]/80' : 'text-[#6F7B68]'
                        }`}
                      >
                        Poin
                      </div>
                    </div>

                    <div className="scale-[0.88] tablet:scale-100 origin-center">
                      <StudentStatusIndicator status={entry.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Ranking List */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3.5 px-5">Ranking</th>
                    <th className="py-3.5 px-5">Nama Mahasiswa</th>
                    <th className="py-3.5 px-5 hidden tablet:table-cell">Kelas</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Total Poin</th>
                    <th className="py-3.5 px-5 text-right hidden tablet:table-cell">EXP / Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/60">
                  {entries.map((e) => {
                    const isMe = user.student?.id === e.student_id;
                    return (
                      <tr
                        key={e.student_id}
                        className={
                          isMe ? 'bg-[#DCECB8]/55' : 'hover:bg-[#F0F8DF]/60 transition-colors'
                        }
                      >
                        <td className="py-3.5 px-5 font-display font-bold text-[#20251D] tabular-nums">
                          #{e.rank}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-display font-bold text-[#20251D]">
                            {e.full_name}{' '}
                            {isMe && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#B5D45D] text-[#171A17] text-[10px] font-bold">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#6F7B68] tabular-nums">
                            NIM {e.nim}
                            <span className="tablet:hidden"> · {e.class_name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#6F7B68] hidden tablet:table-cell">
                          <div className="font-semibold text-[#20251D]">{e.class_name}</div>
                          <div>{e.study_program_name}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <StudentStatusIndicator status={e.status} />
                        </td>
                        <td className="py-3.5 px-5 text-right font-display font-bold text-[#20251D] tabular-nums">
                          {e.period_points}
                        </td>
                        <td className="py-3.5 px-5 text-right text-xs tabular-nums text-[#4E5849] hidden tablet:table-cell">
                          {e.total_exp} EXP · Lv.{e.current_level}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
