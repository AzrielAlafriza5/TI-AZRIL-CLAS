import { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, Select } from '../components/ui/DesignSystem.tsx';
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

  const podium = [entries[1], entries[0], entries[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Leaderboard</h1>
          <p className="text-sm text-[#73796C] mt-1">
            Peringkat kelas dan program studi berdasarkan total Poin Akademik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 bg-white border border-[#DDE6C9] rounded-full">
            <button
              type="button"
              onClick={() => handleScopeSwitch('class')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
                scope === 'class' ? 'bg-[#181A17] text-white' : 'text-[#73796C] hover:text-[#181A17]'
              }`}
            >
              Ranking Kelas
            </button>
            <button
              type="button"
              onClick={() => handleScopeSwitch('study_program')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
                scope === 'study_program'
                  ? 'bg-[#181A17] text-white'
                  : 'text-[#73796C] hover:text-[#181A17]'
              }`}
            >
              Ranking Program Studi
            </button>
          </div>

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

          <div className="flex items-center p-1 bg-white border border-[#DDE6C9] rounded-full">
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
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap transition-colors ${
                  period === p.id ? 'bg-[#B5D45D] text-[#181A17]' : 'text-[#73796C] hover:text-[#181A17]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {myEntry && (
        <Card variant="dark" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#B5D45D]">Peringkat Anda Saat Ini</div>
            <div className="text-xl font-bold mt-1">
              Peringkat #{myEntry.rank} · {myEntry.full_name}
            </div>
            <div className="text-xs text-[#DBECB8] mt-0.5">
              {myEntry.class_name} · {myEntry.study_program_name}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-[#DBECB8]">Poin Periode</div>
              <div className="text-2xl font-bold text-[#B5D45D] tabular-nums">
                {myEntry.period_points}
              </div>
            </div>
            <div>
              <div className="text-xs text-[#DBECB8]">EXP / Level</div>
              <div className="text-lg font-bold tabular-nums">
                {myEntry.total_exp} · Lv.{myEntry.current_level}
              </div>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : entries.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="w-8 h-8 text-[#73796C] mx-auto mb-3" />
          <p className="text-sm text-[#73796C]">Belum ada mahasiswa pada leaderboard ini.</p>
        </Card>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {podium.map((entry) => {
              const isFirst = entry.rank === 1;
              return (
                <Card
                  key={entry.student_id}
                  variant={isFirst ? 'soft' : 'white'}
                  className={`text-center ${
                    isFirst
                      ? 'md:order-2 md:py-8 border-[#B5D45D]'
                      : entry.rank === 2
                        ? 'md:order-1'
                        : 'md:order-3'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                      isFirst
                        ? 'bg-[#181A17] text-[#B5D45D]'
                        : entry.rank === 2
                          ? 'bg-[#DBECB8] text-[#181A17]'
                          : 'bg-[#D8A33D]/20 text-[#D8A33D]'
                    }`}
                  >
                    {isFirst ? <Trophy className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
                  </div>
                  <div className="text-xs font-bold text-[#73796C] mt-3">
                    PERINGKAT #{entry.rank}
                  </div>
                  <div className="text-base font-bold text-[#181A17] mt-1 truncate">
                    {entry.full_name}
                  </div>
                  <div className="text-xs text-[#73796C] mt-0.5">{entry.class_name}</div>
                  <div className="text-3xl font-bold text-[#181A17] tabular-nums mt-3">
                    {entry.period_points} <span className="text-xs font-semibold text-[#73796C]">Poin</span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <StudentStatusIndicator status={entry.status} />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Full Ranking List */}
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                    <th className="py-3.5 px-5">Ranking</th>
                    <th className="py-3.5 px-5">Nama Mahasiswa</th>
                    <th className="py-3.5 px-5">Kelas</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Total Poin</th>
                    <th className="py-3.5 px-5 text-right">EXP / Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE6C9]/60">
                  {entries.map((e) => {
                    const isMe = user.student?.id === e.student_id;
                    return (
                      <tr
                        key={e.student_id}
                        className={isMe ? 'bg-[#DBECB8]/50' : 'hover:bg-[#F0F8E0]/50 transition-colors'}
                      >
                        <td className="py-3.5 px-5 font-bold text-[#181A17] tabular-nums">
                          #{e.rank}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-[#181A17]">
                            {e.full_name}{' '}
                            {isMe && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#B5D45D] text-[#181A17] text-[10px] font-bold">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#73796C] tabular-nums">NIM {e.nim}</div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-[#73796C]">
                          <div className="font-semibold text-[#181A17]">{e.class_name}</div>
                          <div>{e.study_program_name}</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <StudentStatusIndicator status={e.status} />
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-[#181A17] tabular-nums">
                          {e.period_points}
                        </td>
                        <td className="py-3.5 px-5 text-right text-xs tabular-nums text-[#73796C]">
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
