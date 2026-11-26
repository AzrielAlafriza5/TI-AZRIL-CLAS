import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  Building2,
  Layers,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  ClipboardList,
  Send,
  Coins,
  Sparkles,
  Flame,
  Trophy,
  ArrowUpRight,
  UserPlus,
  CalendarCheck,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { DESIGN_TOKENS } from '../lib/designTokens.ts';
import {
  StatCard,
  Card,
  Button,
  Select,
  PageHeader,
} from '../components/ui/DesignSystem.tsx';
import { KpiGridSkeleton, HeroSkeleton } from '../components/ui/Skeleton.tsx';
import type { NavRoute } from '../components/layout/AppShell.tsx';

interface AdminDashboardProps {
  onNavigate: (route: NavRoute) => void;
  onSelectStudent: (studentId: string) => void;
}

export function AdminDashboard({ onNavigate, onSelectStudent }: AdminDashboardProps) {
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; study_program_id: string }>>([]);

  const [studyProgramId, setStudyProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('30d');

  const [data, setData] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<any[]>([]);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic')
      .then((res) => {
        setPrograms(res.programs);
        setClasses(res.classes);
      })
      .catch(() => {});

    apiFetch<{ logs: any[] }>('/api/admin/audit-logs?limit=6')
      .then((res) => setRecentLogs((res.logs || []).slice(0, 6)))
      .catch(() => {});

    apiFetch<{ assignments: any[] }>('/api/assignments')
      .then((res) => setRecentAssignments((res.assignments || []).slice(0, 4)))
      .catch(() => {});

    apiFetch<{ students: any[] }>('/api/admin/students')
      .then((res) => setRecentStudents((res.students || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (studyProgramId) params.set('studyProgramId', studyProgramId);
    if (classId) params.set('classId', classId);
    params.set('period', period);

    apiFetch(`/api/admin/dashboard?${params.toString()}`)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studyProgramId, classId, period]);

  const filteredClasses = studyProgramId
    ? classes.filter((c) => c.study_program_id === studyProgramId)
    : classes;

  const quickActions: Array<{
    label: string;
    sublabel: string;
    route: NavRoute;
    icon: any;
  }> = [
    { label: 'Tambah Mahasiswa', sublabel: 'Kelola data & akun', route: 'students', icon: UserPlus },
    { label: 'Input Absensi', sublabel: 'Catat kehadiran kelas', route: 'attendance', icon: CalendarCheck },
    { label: 'Kelola Tugas', sublabel: 'Buat & nilai tugas', route: 'assignments', icon: ClipboardList },
    { label: 'Berikan Poin', sublabel: 'Reward & penyesuaian', route: 'points', icon: Coins },
    { label: 'Import Excel', sublabel: 'Sinkronisasi massal', route: 'excel-import', icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6">
      {/* Clean Page Header & Filters */}
      <PageHeader
        title="Dashboard Administrator"
        description="Ringkasan akademik, kehadiran, pengumpulan tugas, poin, dan XP mahasiswa IT AZRIL CLAS."
        actions={
          <>
            <Select
              value={studyProgramId}
              onChange={(e) => {
                setStudyProgramId(e.target.value);
                setClassId('');
              }}
              className="rounded-full py-2 text-xs tablet:text-sm"
              aria-label="Filter Program Studi"
            >
              <option value="">Semua Program Studi</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-full py-2 text-xs tablet:text-sm"
              aria-label="Filter Kelas"
            >
              <option value="">Semua Kelas</option>
              {filteredClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <div className="flex items-center p-1 bg-white border border-[#D5E4B6] rounded-full">
              {[
                { id: '7d', label: '7H' },
                { id: '30d', label: '30H' },
                { id: '90d', label: '90H' },
                { id: 'all', label: 'Semua' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`font-display px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                    period === p.id
                      ? 'bg-[#171A17] text-[#B5D45D]'
                      : 'text-[#4E5849] hover:text-[#20251D]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {loading || !data ? (
        <div className="space-y-5">
          <HeroSkeleton />
          <KpiGridSkeleton count={8} />
        </div>
      ) : (
        <>
          {/* Dark Hero Card (#171A17) */}
          <Card variant="dark" className="relative overflow-hidden">
            <div className="grid grid-cols-1 desktop:grid-cols-12 gap-6 items-center">
              <div className="desktop:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#232822] border border-[#B5D45D]/25 text-[#B5D45D] text-xs font-display font-semibold">
                  <span>Ringkasan Akademik Real-Time</span>
                </div>
                <div>
                  <h2 className="font-display text-2xl tablet:text-[28px] font-bold tracking-tight text-white leading-tight">
                    {data.kpis.totalStudents} Mahasiswa Terdaftar di {data.kpis.totalClasses} Kelas Aktif
                  </h2>
                  <p className="text-sm text-[#DCECB8]/80 mt-1.5 leading-relaxed">
                    Tingkat kehadiran {data.kpis.attendanceStats.rate}% dengan total{' '}
                    {data.kpis.totalSubmissions} pengumpulan tugas dan {data.kpis.activeToday ?? 0}{' '}
                    login aktif hari ini.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button onClick={() => onNavigate('attendance')}>
                    <CalendarCheck className="w-4 h-4" />
                    <span>Catat Absensi</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate('students')}
                    className="!bg-[#232822] !border-[#232822] !text-white hover:!border-[#B5D45D]/50"
                  >
                    <Users className="w-4 h-4 text-[#B5D45D]" />
                    <span>Data Mahasiswa</span>
                  </Button>
                </div>
              </div>

              <div className="desktop:col-span-5 grid grid-cols-2 gap-3">
                <div className="rounded-[20px] bg-[#232822] p-4 border border-[#232822]">
                  <div className="text-[11px] font-medium text-[#DCECB8]/75">Tingkat Kehadiran</div>
                  <div className="font-display text-2xl font-bold text-[#B5D45D] tabular-nums mt-1">
                    {data.kpis.attendanceStats.rate}%
                  </div>
                  <div className="text-[11px] text-[#DCECB8]/70 mt-1 tabular-nums">
                    Hadir {data.kpis.attendanceStats.hadir} · Alpha {data.kpis.attendanceStats.alpha}
                  </div>
                </div>
                <div className="rounded-[20px] bg-[#232822] p-4 border border-[#232822]">
                  <div className="text-[11px] font-medium text-[#DCECB8]/75">Login Aktif Hari Ini</div>
                  <div className="font-display text-2xl font-bold text-white tabular-nums mt-1">
                    {data.kpis.activeToday ?? 0}
                  </div>
                  <div className="text-[11px] text-[#FF7A1A] mt-1 tabular-nums font-medium">
                    Rata-rata streak {data.kpis.avgStreak} hari
                  </div>
                </div>
                <div className="rounded-[20px] bg-[#232822] p-4 border border-[#232822]">
                  <div className="text-[11px] font-medium text-[#DCECB8]/75">Total Poin Akademik</div>
                  <div className="font-display text-xl font-bold text-white tabular-nums mt-1">
                    {data.kpis.totalPoints.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="rounded-[20px] bg-[#232822] p-4 border border-[#232822]">
                  <div className="text-[11px] font-medium text-[#DCECB8]/75">Total XP Aktif</div>
                  <div className="font-display text-xl font-bold text-[#B5D45D] tabular-nums mt-1">
                    {data.kpis.totalExp.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {data.kpis.totalPrograms === 0 && (
            <Card variant="soft" className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#20251D]">
                  Mulai Kelola IT AZRIL CLAS
                </h2>
                <p className="text-sm text-[#4E5849] mt-1">
                  Tambahkan Program Studi dan Kelas pertama Anda, atau muat template kurikulum awal melalui Pengaturan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button onClick={() => onNavigate('programs')}>Buat Program Studi</Button>
                <Button variant="dark" onClick={() => onNavigate('settings')}>
                  Pengaturan Sistem
                </Button>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-bold text-[#20251D] tracking-tight">
                Aksi Cepat Administrator
              </h2>
            </div>
            <div className="grid grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-5 gap-3">
              {quickActions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.route}
                    type="button"
                    onClick={() => onNavigate(act.route)}
                    className="text-left p-4 rounded-[24px] bg-white border border-[#D5E4B6] hover:border-[#B5D45D] hover:bg-[#F0F8DF]/40 transition-all duration-150 active:scale-[0.99] flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-[#DCECB8] text-[#20251D] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs tablet:text-sm font-bold text-[#20251D] truncate">
                        {act.label}
                      </div>
                      <div className="text-[11px] text-[#6F7B68] truncate">{act.sublabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary KPI Cards */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
            <StatCard
              variant="soft"
              label="Total Mahasiswa"
              value={data.kpis.totalStudents}
              sublabel={`${data.kpis.totalPrograms} Prodi · ${data.kpis.totalClasses} Kelas`}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              label="Program Studi & Kelas"
              value={`${data.kpis.totalPrograms} / ${data.kpis.totalClasses}`}
              sublabel="Struktur akademik aktif"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
              label="Total Tugas"
              value={data.kpis.totalAssignments}
              sublabel={`${data.kpis.totalSubmissions} kiriman masuk`}
              icon={<ClipboardList className="w-5 h-5" />}
            />
            <StatCard
              label="Tingkat Kehadiran"
              value={`${data.kpis.attendanceStats.rate}%`}
              sublabel={`Hadir ${data.kpis.attendanceStats.hadir} · Alpha ${data.kpis.attendanceStats.alpha}`}
              icon={<Layers className="w-5 h-5 text-[#3E7B27]" />}
            />
          </div>

          {/* Status & Academic Breakdown */}
          <div className="grid grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-5 gap-4">
            <StatCard
              label="Mahasiswa Lulus"
              value={data.kpis.statusCounts.hijau}
              sublabel="Status Hijau"
              icon={<CheckCircle2 className="w-5 h-5 text-[#3E7B27]" />}
            />
            <StatCard
              label="Mahasiswa Aktif"
              value={data.kpis.statusCounts.netral}
              sublabel="Status Netral"
              icon={<CircleDot className="w-5 h-5 text-[#20251D]" />}
            />
            <StatCard
              label="Mahasiswa AFK"
              value={data.kpis.statusCounts.merah}
              sublabel="Status Merah"
              icon={<AlertTriangle className="w-5 h-5 text-[#D13447]" />}
            />
            <StatCard
              label="Total Poin"
              value={data.kpis.totalPoints.toLocaleString('id-ID')}
              sublabel="Akumulasi leaderboard"
              icon={<Coins className="w-5 h-5 text-[#C27C0A]" />}
            />
            <StatCard
              label="Total Pengumpulan"
              value={data.kpis.totalSubmissions}
              sublabel="Kiriman tugas mahasiswa"
              icon={<Send className="w-5 h-5 text-[#3E7B27]" />}
            />
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
            {[
              {
                title: 'Peringkat Poin Tertinggi',
                item: data.leaders.topPoints,
                metric: data.leaders.topPoints ? `${data.leaders.topPoints.total_points} Poin` : '—',
                icon: Trophy,
                iconCls: 'bg-[#DCECB8] text-[#3E7B27]',
              },
              {
                title: 'Login Paling Konsisten',
                item: data.leaders.topStreak,
                metric: data.leaders.topStreak
                  ? `${data.leaders.topStreak.current_streak} Hari (Best ${data.leaders.topStreak.best_streak})`
                  : '—',
                icon: Flame,
                iconCls: 'bg-[#171A17] text-[#FF7A1A]',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#6F7B68]">{card.title}</div>
                    {card.item ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(card.item.id)}
                          className="font-display text-base font-bold text-[#20251D] hover:text-[#3E7B27] flex items-center gap-1 text-left cursor-pointer"
                        >
                          <span className="truncate">{card.item.full_name}</span>
                          <ArrowUpRight className="w-4 h-4 shrink-0" />
                        </button>
                        <div className="text-xs text-[#6F7B68] mt-1 tabular-nums">
                          {card.item.class_name} ·{' '}
                          <span className="font-semibold text-[#20251D]">{card.metric}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-[#6F7B68] mt-2">Belum ada data</div>
                    )}
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.iconCls}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-5">
            <Card>
              <h3 className="font-display text-base font-bold text-[#20251D]">Grafik Perkembangan Poin</h3>
              <p className="text-xs text-[#6F7B68] mt-0.5">Akumulasi poin akademik per tanggal</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.pointsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DESIGN_TOKENS.charts.gridLine} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <YAxis tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: DESIGN_TOKENS.charts.tooltipBorder,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="points"
                      name="Poin"
                      stroke={DESIGN_TOKENS.charts.primaryBar}
                      fill={DESIGN_TOKENS.charts.limeBar}
                      fillOpacity={0.55}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-base font-bold text-[#20251D]">Grafik Absensi Kelas</h3>
              <p className="text-xs text-[#6F7B68] mt-0.5">Kehadiran Hadir, Izin, Sakit, dan Alpha</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.attendanceChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DESIGN_TOKENS.charts.gridLine} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <YAxis tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: DESIGN_TOKENS.charts.tooltipBorder,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="hadir" name="Hadir" stackId="a" fill={DESIGN_TOKENS.charts.successBar} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="izin" name="Izin" stackId="a" fill={DESIGN_TOKENS.charts.limeBar} />
                    <Bar dataKey="sakit" name="Sakit" stackId="a" fill={DESIGN_TOKENS.charts.warningBar} />
                    <Bar dataKey="alpha" name="Alpha" stackId="a" fill={DESIGN_TOKENS.charts.errorBar} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-base font-bold text-[#20251D]">Statistik Pengumpulan Tugas</h3>
              <p className="text-xs text-[#6F7B68] mt-0.5">Perbandingan ketepatan waktu pengumpulan</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.submissionChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DESIGN_TOKENS.charts.gridLine} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <YAxis tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: DESIGN_TOKENS.charts.tooltipBorder,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tepat_waktu" name="Tepat Waktu / Dinilai" fill={DESIGN_TOKENS.charts.primaryBar} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="terlambat" name="Terlambat" fill={DESIGN_TOKENS.charts.warningBar} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="revisi" name="Revisi" fill={DESIGN_TOKENS.charts.errorBar} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-base font-bold text-[#20251D]">Grafik Aktivitas Login Harian</h3>
              <p className="text-xs text-[#6F7B68] mt-0.5">Jumlah login terverifikasi per hari (WIB)</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.activityChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DESIGN_TOKENS.charts.gridLine} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <YAxis tick={{ fontSize: 11, fill: DESIGN_TOKENS.charts.axisTick }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        borderColor: DESIGN_TOKENS.charts.tooltipBorder,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="logins"
                      name="Login Aktif"
                      stroke={DESIGN_TOKENS.charts.successBar}
                      fill={DESIGN_TOKENS.charts.mintBar}
                      fillOpacity={0.85}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Recent Activity & Student/Task Overview */}
          <div className="grid grid-cols-1 desktop:grid-cols-2 gap-5">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] text-[#20251D] flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[#20251D]">Aktivitas Terbaru</h3>
                    <p className="text-xs text-[#6F7B68]">Log aktivitas sistem administrator</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate('settings')}>
                  Semua Log
                </Button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#6F7B68]">
                  Belum ada log aktivitas tercatat.
                </div>
              ) : (
                <div className="divide-y divide-[#D5E4B6]">
                  {recentLogs.map((log: any) => (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#20251D] truncate">
                          {log.details || log.action}
                        </div>
                        <div className="text-xs text-[#6F7B68] mt-0.5">
                          {log.actor_name || 'Administrator'} · {log.target_type || 'sistem'}
                        </div>
                      </div>
                      <span className="text-[11px] text-[#6F7B68] tabular-nums shrink-0">
                        {String(log.created_at).slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#DCECB8] text-[#20251D] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[#20251D]">
                      Informasi Mahasiswa & Tugas
                    </h3>
                    <p className="text-xs text-[#6F7B68]">Ringkasan tugas aktif & mahasiswa terbaru</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate('assignments')}>
                  Kelola Tugas
                </Button>
              </div>

              <div className="space-y-4">
                {recentAssignments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6F7B68]">
                      Tugas Terbaru
                    </div>
                    <div className="divide-y divide-[#D5E4B6] rounded-[16px] border border-[#D5E4B6] px-3.5 bg-[#F0F8DF]/40">
                      {recentAssignments.map((a: any) => (
                        <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-[#20251D] truncate">{a.title}</div>
                            <div className="text-[#6F7B68] mt-0.5 tabular-nums">
                              {a.class_name || 'Semua Kelas'} · Deadline {String(a.deadline).slice(0, 10)}
                            </div>
                          </div>
                          <span className="font-display font-bold text-[#3E7B27] tabular-nums shrink-0">
                            {a.max_points} Poin
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recentStudents.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6F7B68]">
                      Mahasiswa Terdaftar
                    </div>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
                      {recentStudents.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectStudent(s.id)}
                          className="p-3 rounded-[16px] border border-[#D5E4B6] bg-white hover:border-[#B5D45D] text-left transition-colors cursor-pointer"
                        >
                          <div className="font-display text-xs font-bold text-[#20251D] truncate">
                            {s.full_name}
                          </div>
                          <div className="text-[11px] text-[#6F7B68] tabular-nums mt-0.5 truncate">
                            {s.nim} · {s.class_name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentAssignments.length === 0 && recentStudents.length === 0 && (
                  <div className="py-8 text-center text-sm text-[#6F7B68]">
                    Belum ada data mahasiswa atau tugas terbaru.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
