import { useEffect, useState } from 'react';
import { CalendarCheck, Save, CheckCircle2, Clock, XCircle, Percent } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  StatCard,
  Button,
  Input,
  Select,
  SearchBar,
  PageHeader,
} from '../components/ui/DesignSystem.tsx';
import { AttendanceStatusIndicator, StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { AttendanceStatus, AuthUser, StudentStatus } from '../types/index.ts';

interface AttendancePageProps {
  user: AuthUser;
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function AttendancePage({ user, onToast }: AttendancePageProps) {
  const isAdmin = user.role === 'admin';

  // Student Attendance State
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [studentSummary, setStudentSummary] = useState({
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpha: 0,
    total: 0,
    rate: 0,
  });

  // Admin Attendance State
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; study_program_id: string }>>([]);

  const [studyProgramId, setStudyProgramId] = useState('');
  const [classId, setClassId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingNumber, setMeetingNumber] = useState(1);

  const [roster, setRoster] = useState<Array<any>>([]);
  const [counts, setCounts] = useState({ hijau: 0, netral: 0, merah: 0 });
  const [includeAfk, setIncludeAfk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'netral' | 'hijau'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(true);
      apiFetch<{ records: any[]; summary: any }>('/api/student/attendance')
        .then((res) => {
          setStudentRecords(res.records);
          setStudentSummary(res.summary);
        })
        .catch((err) => onToast('error', err.message))
        .finally(() => setLoading(false));
      return;
    }

    apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic')
      .then((res) => {
        setPrograms(res.programs);
        setClasses(res.classes);
        if (res.classes[0]) {
          setStudyProgramId(res.classes[0].study_program_id);
          setClassId(res.classes[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [isAdmin]);

  const loadAttendance = async () => {
    if (!isAdmin || !classId) {
      setRoster([]);
      setCounts({ hijau: 0, netral: 0, merah: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        classId,
        date: attendanceDate,
        meetingNumber: String(meetingNumber),
        includeAfk: includeAfk ? '1' : '0',
      });
      const res = await apiFetch<{
        students: Array<any & { student_status?: StudentStatus }>;
        counts?: { hijau: number; netral: number; merah: number };
      }>(`/api/admin/attendance?${qs.toString()}`);
      setRoster(res.students);
      if (res.counts) {
        setCounts(res.counts);
      }
      const map: Record<string, AttendanceStatus> = {};
      for (const s of res.students) {
        map[s.student_id] = s.attendance_status || 'hadir';
      }
      setStatuses(map);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAttendance();
  }, [isAdmin, classId, attendanceDate, meetingNumber, includeAfk]);

  const visibleRoster = roster.filter((s) => {
    if (statusFilter !== 'all' && s.student_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        String(s.full_name ?? '').toLowerCase().includes(q) ||
        String(s.nim ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleMarkAll = (st: AttendanceStatus) => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const s of visibleRoster) next[s.student_id] = st;
      return next;
    });
  };

  const handleSave = async () => {
    if (!classId || roster.length === 0) return;
    setSaving(true);
    try {
      const records = roster.map((s) => ({
        student_id: s.student_id,
        status: statuses[s.student_id] || 'hadir',
      }));
      const res = await apiFetch<{ savedCount: number }>('/api/admin/attendance/manual', {
        method: 'POST',
        body: JSON.stringify({
          classId,
          attendanceDate,
          meetingNumber,
          records,
        }),
      });
      onToast(
        'success',
        `Absensi disimpan (${res.savedCount} perubahan dicatat dan poin dihitung otomatis).`
      );
      await loadAttendance();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Riwayat Absensi"
          description="Ringkasan kehadiran kelas Anda beserta poin akademik yang tercatat dari setiap pertemuan."
        />

        <div className="grid grid-cols-2 desktop:grid-cols-4 gap-4">
          <StatCard
            label="Tingkat Kehadiran"
            value={`${studentSummary.rate}%`}
            sublabel={`${studentSummary.total} Pertemuan tercatat`}
            icon={<Percent className="w-5 h-5" />}
            variant="soft"
          />
          <StatCard
            label="Hadir"
            value={studentSummary.hadir}
            sublabel="Pertemuan hadir penuh"
            icon={<CheckCircle2 className="w-5 h-5 text-[#3E7B27]" />}
          />
          <StatCard
            label="Izin & Sakit"
            value={studentSummary.izin + studentSummary.sakit}
            sublabel={`${studentSummary.izin} Izin · ${studentSummary.sakit} Sakit`}
            icon={<Clock className="w-5 h-5 text-[#C27C0A]" />}
          />
          <StatCard
            label="Alpha"
            value={studentSummary.alpha}
            sublabel="Tanpa keterangan"
            icon={<XCircle className="w-5 h-5 text-[#D13447]" />}
          />
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#D5E4B6] flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#3E7B27]" />
            <h2 className="font-display text-base font-bold text-[#20251D]">Log Pertemuan</h2>
          </div>

          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : studentRecords.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#6F7B68]">
              Belum ada catatan absensi untuk kelas Anda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3.5 px-5">Pertemuan</th>
                    <th className="py-3.5 px-5">Tanggal</th>
                    <th className="py-3.5 px-5">Kelas</th>
                    <th className="py-3.5 px-5">Sumber</th>
                    <th className="py-3.5 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70">
                  {studentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 font-display font-bold text-[#20251D] tabular-nums">
                        Pertemuan {r.meeting_number}
                      </td>
                      <td className="py-3.5 px-5 text-[#6F7B68] tabular-nums">{r.attendance_date}</td>
                      <td className="py-3.5 px-5 text-[#20251D]">{r.class_name}</td>
                      <td className="py-3.5 px-5 text-xs text-[#6F7B68] capitalize">{r.source}</td>
                      <td className="py-3.5 px-5 text-right">
                        <AttendanceStatusIndicator status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const filteredClasses = studyProgramId
    ? classes.filter((c) => c.study_program_id === studyProgramId)
    : classes;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Absensi Kelas Manual"
        description="Mahasiswa berstatus Aktif (Netral) maupun Lulus (Hijau) tetap tersedia di daftar absen agar lulusan yang masih mengikuti kelas tetap dapat diabsen."
      />

      {/* Controls */}
      <Card className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Program Studi</label>
          <Select
            value={studyProgramId}
            onChange={(e) => {
              const pid = e.target.value;
              setStudyProgramId(pid);
              const nextClasses = pid ? classes.filter((c) => c.study_program_id === pid) : classes;
              setClassId(nextClasses[0]?.id ?? '');
            }}
            className="w-full"
          >
            <option value="">Semua Program Studi</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Kelas</label>
          <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full">
            <option value="">Pilih Kelas</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Tanggal</label>
          <Input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Pertemuan Ke-</label>
          <Input
            type="number"
            min={1}
            value={meetingNumber}
            onChange={(e) => setMeetingNumber(Math.max(1, Number(e.target.value)))}
            className="tabular-nums"
          />
        </div>
      </Card>

      {/* Checklist Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-[#D5E4B6] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#3E7B27]" />
                <span className="font-display text-base font-bold text-[#20251D]">
                  Checklist Kehadiran ({visibleRoster.length} Mahasiswa)
                </span>
              </div>
              {classId && (
                <p className="text-xs text-[#6F7B68] mt-1 tabular-nums">
                  Aktif: {counts.netral} · Lulus (Hijau): {counts.hijau}
                  {counts.merah > 0 &&
                    ` · AFK (Merah): ${counts.merah} ${includeAfk ? '(ditampilkan)' : '(disembunyikan)'}`}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => handleMarkAll('hadir')}>
                Tandai Semua Hadir
              </Button>
              <Button size="sm" disabled={saving || roster.length === 0} onClick={handleSave}>
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Absensi'}</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Cari NIM atau nama..."
                className="w-full tablet:w-56"
              />

              <div className="flex items-center p-1 bg-[#F0F8DF] border border-[#D5E4B6] rounded-full">
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'netral', label: 'Aktif' },
                  { id: 'hijau', label: 'Lulus (Hijau)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatusFilter(opt.id as 'all' | 'netral' | 'hijau')}
                    className={`font-display px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === opt.id
                        ? 'bg-[#171A17] text-[#B5D45D]'
                        : 'text-[#4E5849] hover:text-[#20251D]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#20251D] cursor-pointer select-none px-3.5 py-2 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] hover:border-[#B5D45D] transition-colors">
              <input
                type="checkbox"
                checked={includeAfk}
                onChange={(e) => setIncludeAfk(e.target.checked)}
                className="accent-[#171A17] w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Tampilkan juga Mahasiswa AFK / Merah ({counts.merah})</span>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : roster.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#6F7B68]">
            {classId && counts.merah > 0 && !includeAfk
              ? 'Semua mahasiswa di kelas ini berstatus AFK (Merah). Centang "Tampilkan juga Mahasiswa AFK / Merah" untuk menampilkannya.'
              : 'Pilih kelas yang memiliki mahasiswa untuk mengisi absensi.'}
          </div>
        ) : visibleRoster.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#6F7B68]">
            Tidak ada mahasiswa yang sesuai dengan filter atau pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                  <th className="py-3.5 px-5">NIM</th>
                  <th className="py-3.5 px-5">Nama Mahasiswa</th>
                  <th className="py-3.5 px-5">Status Mahasiswa</th>
                  <th className="py-3.5 px-5">Tercatat Sebelumnya</th>
                  <th className="py-3.5 px-5">Status Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E4B6]/70 text-sm">
                {visibleRoster.map((s) => {
                  const val = statuses[s.student_id] || 'hadir';
                  return (
                    <tr key={s.student_id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs font-semibold text-[#6F7B68] tabular-nums">
                        {s.nim}
                      </td>
                      <td className="py-3.5 px-5 font-display font-bold text-[#20251D]">
                        {s.full_name}
                      </td>
                      <td className="py-3.5 px-5">
                        <StudentStatusIndicator status={(s.student_status as StudentStatus) || 'netral'} />
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#6F7B68]">
                        {s.attendance_status
                          ? `${s.attendance_status.toUpperCase()} (${s.source})`
                          : 'Belum dicatat'}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(['hadir', 'izin', 'sakit', 'alpha'] as AttendanceStatus[]).map((st) => {
                            const active = val === st;
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setStatuses((prev) => ({ ...prev, [s.student_id]: st }))
                                }
                                className={`font-display px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors capitalize cursor-pointer ${
                                  active
                                    ? st === 'hadir'
                                      ? 'bg-[#3E7B27] text-white border-[#3E7B27]'
                                      : st === 'alpha'
                                        ? 'bg-[#D13447] text-white border-[#D13447]'
                                        : 'bg-[#C27C0A] text-white border-[#C27C0A]'
                                    : 'bg-white text-[#4E5849] border-[#D5E4B6] hover:border-[#B5D45D] hover:text-[#20251D]'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
