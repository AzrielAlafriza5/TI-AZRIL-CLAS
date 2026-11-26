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
} from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { StatCard, Card, Button, Select } from '../components/ui/DesignSystem.tsx';
import { KpiGridSkeleton } from '../components/ui/Skeleton.tsx';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic')
      .then((res) => {
        setPrograms(res.programs);
        setClasses(res.classes);
      })
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

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">
            Dashboard Administrator
          </h1>
          <p className="text-sm text-[#73796C] mt-1">
            Ringkasan statistik akademik, kehadiran, pengumpulan tugas, poin, dan EXP mahasiswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={studyProgramId}
            onChange={(e) => {
              setStudyProgramId(e.target.value);
              setClassId('');
            }}
            className="rounded-full py-2"
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
            className="rounded-full py-2"
            aria-label="Filter Kelas"
          >
            <option value="">Semua Kelas</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center p-1 bg-white border border-[#DDE6C9] rounded-full">
            {[
              { id: '7d', label: '7 Hari' },
              { id: '30d', label: '30 Hari' },
              { id: '90d', label: '90 Hari' },
              { id: 'all', label: 'Semua' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  period === p.id
                    ? 'bg-[#181A17] text-white'
                    : 'text-[#73796C] hover:text-[#181A17]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading || !data ? (
        <KpiGridSkeleton count={8} />
      ) : (
        <>
          {data.kpis.totalPrograms === 0 && (
            <Card variant="soft" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#181A17]">
                  Mulai Kelola IT AZRIL CLAS
                </h2>
                <p className="text-sm text-[#73796C] mt-1">
                  Tambahkan Program Studi dan Kelas pertama Anda, atau muat template kurikulum awal melalui Pengaturan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button onClick={() => onNavigate('programs')}>Buat Program Studi</Button>
                <Button variant="secondary" onClick={() => onNavigate('settings')}>
                  Pengaturan Sistem
                </Button>
              </div>
            </Card>
          )}

          {/* Primary Statistics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              variant="soft"
              label="Total Mahasiswa"
              value={data.kpis.totalStudents}
              sublabel={`${data.kpis.totalPrograms} Prodi · ${data.kpis.totalClasses} Kelas`}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              label="Total Kelas"
              value={data.kpis.totalClasses}
              sublabel="Kelas aktif terkelola"
              icon={<Layers className="w-5 h-5" />}
            />
            <StatCard
              label="Total Program Studi"
              value={data.kpis.totalPrograms}
              sublabel="Program studi terdaftar"
              icon={<Building2 className="w-5 h-5" />}
            />
            <StatCard
              label="Tingkat Kehadiran"
              value={`${data.kpis.attendanceStats.rate}%`}
              sublabel={`Hadir ${data.kpis.attendanceStats.hadir} · Alpha ${data.kpis.attendanceStats.alpha}`}
              icon={<Flame className="w-5 h-5 text-[#D8A33D]" />}
            />
          </div>

          {/* Student Status & Learning Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Mahasiswa Lulus"
              value={data.kpis.statusCounts.hijau}
              sublabel="Status Hijau"
              icon={<CheckCircle2 className="w-5 h-5 text-[#3D914C]" />}
            />
            <StatCard
              label="Mahasiswa Aktif"
              value={data.kpis.statusCounts.netral}
              sublabel="Status Netral"
              icon={<CircleDot className="w-5 h-5 text-[#181A17]" />}
            />
            <StatCard
              label="Mahasiswa AFK"
              value={data.kpis.statusCounts.merah}
              sublabel="Status Merah"
              icon={<AlertTriangle className="w-5 h-5 text-[#C44750]" />}
            />
            <StatCard
              label="Total Tugas"
              value={data.kpis.totalAssignments}
              sublabel="Tugas terdistribusi"
              icon={<ClipboardList className="w-5 h-5" />}
            />
            <StatCard
              label="Pengumpulan Tugas"
              value={data.kpis.totalSubmissions}
              sublabel="Total kiriman masuk"
              icon={<Send className="w-5 h-5" />}
            />
          </div>

          {/* Points, EXP & Top Performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              variant="soft"
              label="Total Poin Akademik"
              value={data.kpis.totalPoints.toLocaleString('id-ID')}
              sublabel="Akumulasi poin leaderboard"
              icon={<Coins className="w-5 h-5" />}
            />
            <StatCard
              variant="soft"
              label="Total EXP Konsistensi"
              value={data.kpis.totalExp.toLocaleString('id-ID')}
              sublabel={`Rata-rata streak ${data.kpis.avgStreak} hari`}
              icon={<Sparkles className="w-5 h-5" />}
            />

            {[
              {
                title: 'Peringkat Poin Tertinggi',
                item: data.leaders.topPoints,
                metric: data.leaders.topPoints ? `${data.leaders.topPoints.total_points} Poin` : '—',
                icon: Trophy,
              },
              {
                title: 'Login Paling Konsisten',
                item: data.leaders.topStreak,
                metric: data.leaders.topStreak
                  ? `${data.leaders.topStreak.current_streak} Hari (Best ${data.leaders.topStreak.best_streak})`
                  : '—',
                icon: Flame,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs font-medium text-[#73796C]">
                    <span>{card.title}</span>
                    <div className="w-9 h-9 rounded-full bg-[#F0F8E0] text-[#181A17] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  {card.item ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onSelectStudent(card.item.id)}
                        className="text-base font-bold text-[#181A17] hover:text-[#3D914C] flex items-center gap-1 text-left"
                      >
                        <span className="truncate">{card.item.full_name}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" />
                      </button>
                      <div className="text-xs text-[#73796C] mt-1 tabular-nums">
                        {card.item.class_name} · <span className="font-semibold text-[#181A17]">{card.metric}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#73796C] mt-4">Belum ada data</div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-base font-bold text-[#181A17]">Grafik Perkembangan Poin</h3>
              <p className="text-xs text-[#73796C] mt-0.5">Akumulasi poin akademik per tanggal</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.pointsChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE6C9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#73796C' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#73796C' }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="points"
                      name="Poin"
                      stroke="#181A17"
                      fill="#B5D45D"
                      fillOpacity={0.55}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-bold text-[#181A17]">Grafik Absensi Kelas</h3>
              <p className="text-xs text-[#73796C] mt-0.5">Kehadiran Hadir, Izin, Sakit, dan Alpha</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.attendanceChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE6C9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#73796C' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#73796C' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="hadir" name="Hadir" stackId="a" fill="#3D914C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="izin" name="Izin" stackId="a" fill="#B5D45D" />
                    <Bar dataKey="sakit" name="Sakit" stackId="a" fill="#D8A33D" />
                    <Bar dataKey="alpha" name="Alpha" stackId="a" fill="#C44750" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-bold text-[#181A17]">Statistik Pengumpulan Tugas</h3>
              <p className="text-xs text-[#73796C] mt-0.5">Perbandingan ketepatan waktu pengumpulan</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.submissionChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE6C9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#73796C' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#73796C' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tepat_waktu" name="Tepat Waktu / Dinilai" fill="#181A17" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="terlambat" name="Terlambat" fill="#D8A33D" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="revisi" name="Revisi" fill="#C44750" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-bold text-[#181A17]">Grafik Aktivitas Login Harian</h3>
              <p className="text-xs text-[#73796C] mt-0.5">Jumlah login terverifikasi per hari (WIB)</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.activityChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#DDE6C9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#73796C' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#73796C' }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="logins"
                      name="Login Aktif"
                      stroke="#3D914C"
                      fill="#DBECB8"
                      fillOpacity={0.8}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
