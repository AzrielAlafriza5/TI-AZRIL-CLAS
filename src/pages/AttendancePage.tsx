import { useEffect, useState } from 'react';
import { CalendarCheck, Save, CheckCircle2, Clock, XCircle, Percent } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { Card, StatCard, Button, Input, Select } from '../components/ui/DesignSystem.tsx';
import { AttendanceStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { AttendanceStatus, AuthUser } from '../types/index.ts';

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
    if (!isAdmin || !classId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ students: any[] }>(
        `/api/admin/attendance?classId=${classId}&date=${attendanceDate}&meetingNumber=${meetingNumber}`
      );
      setRoster(res.students);
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
    if (isAdmin && classId) loadAttendance();
  }, [isAdmin, classId, attendanceDate, meetingNumber]);

  const handleMarkAll = (st: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    for (const s of roster) next[s.student_id] = st;
    setStatuses(next);
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
        <div>
          <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Riwayat Absensi</h1>
          <p className="text-sm text-[#73796C] mt-1">
            Ringkasan kehadiran kelas Anda beserta poin akademik yang tercatat dari setiap pertemuan.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            label="Izin & Sakit"
            value={studentSummary.izin + studentSummary.sakit}
            sublabel={`${studentSummary.izin} Izin · ${studentSummary.sakit} Sakit`}
            icon={<Clock className="w-5 h-5" />}
          />
          <StatCard
            label="Alpha"
            value={studentSummary.alpha}
            sublabel="Tanpa keterangan"
            icon={<XCircle className="w-5 h-5" />}
          />
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DDE6C9] flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#3D914C]" />
            <h2 className="text-base font-bold text-[#181A17]">Log Pertemuan</h2>
          </div>

          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : studentRecords.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#73796C]">
              Belum ada catatan absensi untuk kelas Anda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                    <th className="py-3.5 px-5">Pertemuan</th>
                    <th className="py-3.5 px-5">Tanggal</th>
                    <th className="py-3.5 px-5">Kelas</th>
                    <th className="py-3.5 px-5">Sumber</th>
                    <th className="py-3.5 px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE6C9]/60">
                  {studentRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F0F8E0]/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-[#181A17] tabular-nums">
                        Pertemuan {r.meeting_number}
                      </td>
                      <td className="py-3.5 px-5 text-[#73796C] tabular-nums">{r.attendance_date}</td>
                      <td className="py-3.5 px-5 text-[#181A17]">{r.class_name}</td>
                      <td className="py-3.5 px-5 text-xs text-[#73796C] capitalize">{r.source}</td>
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
      <div>
        <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Absensi Kelas Manual</h1>
        <p className="text-sm text-[#73796C] mt-1">
          Pilih program studi, kelas, tanggal, dan pertemuan. Poin kehadiran dihitung otomatis tanpa duplikasi.
        </p>
      </div>

      {/* Controls */}
      <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Program Studi</label>
          <Select
            value={studyProgramId}
            onChange={(e) => {
              const pid = e.target.value;
              setStudyProgramId(pid);
              const firstCls = classes.find((c) => c.study_program_id === pid);
              setClassId(firstCls?.id ?? '');
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
          <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Kelas</label>
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
          <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Tanggal</label>
          <Input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#73796C] mb-1.5">Pertemuan Ke-</label>
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
        <div className="px-6 py-5 border-b border-[#DDE6C9] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#3D914C]" />
            <span className="text-base font-bold text-[#181A17]">
              Checklist Kehadiran ({roster.length} Mahasiswa)
            </span>
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

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : roster.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#73796C]">
            Pilih kelas yang memiliki mahasiswa untuk mengisi absensi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                  <th className="py-3.5 px-5">NIM</th>
                  <th className="py-3.5 px-5">Nama Mahasiswa</th>
                  <th className="py-3.5 px-5">Tercatat Sebelumnya</th>
                  <th className="py-3.5 px-5">Status Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE6C9]/60 text-sm">
                {roster.map((s) => {
                  const val = statuses[s.student_id] || 'hadir';
                  return (
                    <tr key={s.student_id} className="hover:bg-[#F0F8E0]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs font-semibold text-[#73796C] tabular-nums">
                        {s.nim}
                      </td>
                      <td className="py-3.5 px-5 font-bold text-[#181A17]">{s.full_name}</td>
                      <td className="py-3.5 px-5 text-xs text-[#73796C]">
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
                                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors capitalize ${
                                  active
                                    ? st === 'hadir'
                                      ? 'bg-[#3D914C] text-white border-[#3D914C]'
                                      : st === 'alpha'
                                        ? 'bg-[#C44750] text-white border-[#C44750]'
                                        : 'bg-[#D8A33D] text-white border-[#D8A33D]'
                                    : 'bg-white text-[#73796C] border-[#DDE6C9] hover:border-[#B5D45D] hover:text-[#181A17]'
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
