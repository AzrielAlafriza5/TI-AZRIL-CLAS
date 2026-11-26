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

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
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
          {/* Unified 3-Column Stepped Podium (2 - 1 - 3 across all screen sizes) */}
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-6 pt-2">
            {topThree.map((entry) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;

              const orderCls = isFirst
                ? 'order-2'
                : isSecond
                  ? 'order-1'
                  : 'order-3';

              const cardStyle = isFirst
                ? 'min-h-[175px] sm:min-h-[240px] bg-[#141612] text-white border border-[#232822]'
                : isSecond
                  ? 'min-h-[145px] sm:min-h-[200px] bg-[#DCECB8] text-[#20251D] border border-[#B5D45D]'
                  : 'min-h-[130px] sm:min-h-[185px] bg-white text-[#20251D] border border-[#D5E4B6]';

              return (
                <div
                  key={entry.student_id}
                  className={`${orderCls} ${cardStyle} rounded-[20px] sm:rounded-[26px] p-2 sm:p-5 flex flex-col items-center justify-between gap-2 text-center min-w-0 transition-all`}
                >
                  {/* Trophy / Medal Icon + Rank */}
                  <div className="flex flex-col items-center gap-1 w-full min-w-0">
                    <div
                      className={`w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${
                        isFirst
                          ? 'bg-[#c5ec6c] text-[#141612]'
                          : isSecond
                            ? 'bg-white text-[#3E7B27] border border-[#B5D45D]'
                            : 'bg-[#FF7A1A]/15 text-[#FF7A1A]'
                      }`}
                    >
                      {isFirst ? (
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                      ) : (
                        <Medal className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
                      )}
                    </div>

                    <div
                      className={`font-display text-[10px] sm:text-xs font-extrabold tracking-wide tabular-nums ${
                        isFirst
                          ? 'text-[#c5ec6c]'
                          : isSecond
                            ? 'text-[#3E7B27]'
                            : 'text-[#6F7B68]'
                      }`}
                    >
                      #{entry.rank}
                    </div>

                    <div
                      className={`font-display text-[11px] sm:text-sm font-bold leading-tight text-center line-clamp-2 w-full break-words ${
                        isFirst ? 'text-white' : 'text-[#20251D]'
                      }`}
                    >
                      {entry.full_name}
                    </div>

                    <div
                      className={`text-[10px] sm:text-xs text-center truncate w-full ${
                        isFirst ? 'text-[#c5ec6c]/80' : 'text-[#6F7B68]'
                      }`}
                    >
                      {entry.class_name}
                    </div>
                  </div>

                  {/* Points & Status */}
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="leading-none">
                      <span
                        className={`font-display text-lg sm:text-3xl font-extrabold tabular-nums ${
                          isFirst ? 'text-[#c5ec6c]' : 'text-[#20251D]'
                        }`}
                      >
                        {entry.period_points}
                      </span>
                      <span
                        className={`ml-1 text-[9px] sm:text-xs font-semibold ${
                          isFirst ? 'text-[#c5ec6c]/80' : 'text-[#6F7B68]'
                        }`}
                      >
                        Poin
                      </span>
                    </div>

                    <StudentStatusIndicator status={entry.status} compact />
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
