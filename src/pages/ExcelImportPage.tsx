import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../lib/api.ts';
import { Card, Button, Input } from '../components/ui/DesignSystem.tsx';
import { StudentStatusIndicator } from '../components/ui/StatusBadge.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { StudentStatus } from '../types/index.ts';

interface ExcelImportPageProps {
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function ExcelImportPage({ onToast }: ExcelImportPageProps) {
  const [tab, setTab] = useState<'attendance' | 'status' | 'history'>('attendance');

  // Attendance Import State
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attMeeting, setAttMeeting] = useState(1);
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attPreview, setAttPreview] = useState<any | null>(null);

  // Status Import State
  const [statusFile, setStatusFile] = useState<File | null>(null);
  const [statusPreview, setStatusPreview] = useState<any | null>(null);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ history: any[] }>('/api/admin/import/history');
      setHistory(res.history);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  const downloadTemplate = (type: 'attendance' | 'status') => {
    const rows =
      type === 'attendance'
        ? [
            { NIM: '230101001', Nama: 'Azril Al Afriza', Status: 'Hadir' },
            { NIM: '230101002', Nama: 'Nadia Putri Maharani', Status: 'Izin' },
          ]
        : [
            { NIM: '230101001', Nama: 'Azril Al Afriza', Status: 'Hijau' },
            { NIM: '230101002', Nama: 'Nadia Putri Maharani', Status: 'Netral' },
          ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(
      wb,
      type === 'attendance'
        ? 'template_absensi_it_azril_clas.xlsx'
        : 'template_status_it_azril_clas.xlsx'
    );
  };

  const handlePreviewAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attFile) {
      onToast('error', 'Pilih file Excel terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', attFile);
      form.append('attendanceDate', attDate);
      form.append('meetingNumber', String(attMeeting));

      const token = getAuthToken();
      const res = await fetch('/api/admin/import/attendance/preview', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses file Excel');
      setAttPreview(data);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitAttendance = async () => {
    if (!attPreview) return;
    setCommitting(true);
    try {
      const res = await apiFetch<{ committed: number }>('/api/admin/import/attendance/commit', {
        method: 'POST',
        body: JSON.stringify({
          fileName: attPreview.fileName,
          attendanceDate: attPreview.attendanceDate,
          meetingNumber: attPreview.meetingNumber,
          rows: attPreview.rows,
        }),
      });
      onToast('success', `${res.committed} data absensi berhasil diimpor dan poin dihitung.`);
      setAttPreview(null);
      setAttFile(null);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setCommitting(false);
    }
  };

  const handlePreviewStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusFile) {
      onToast('error', 'Pilih file Excel status terlebih dahulu.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', statusFile);

      const token = getAuthToken();
      const res = await fetch('/api/admin/import/status/preview', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membaca file Excel');
      setStatusPreview(data);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommitStatus = async () => {
    if (!statusPreview) return;
    setCommitting(true);
    try {
      const res = await apiFetch<{ updatedCount: number }>('/api/admin/import/status/commit', {
        method: 'POST',
        body: JSON.stringify({
          fileName: statusPreview.fileName,
          rows: statusPreview.rows,
        }),
      });
      onToast('success', `${res.updatedCount} status mahasiswa berhasil diperbarui.`);
      setStatusPreview(null);
      setStatusFile(null);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#181A17] tracking-tight">Impor Excel & Validasi NIM</h1>
        <p className="text-sm text-[#73796C] mt-1">
          Cocokkan data absensi dan pembaruan status secara akurat menggunakan NIM, lengkap dengan preview dan pencegahan duplikasi.
        </p>
      </div>

      {/* Segmented Pill Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-[#DDE6C9] rounded-full w-fit">
        {[
          { id: 'attendance', label: 'Impor Absensi' },
          { id: 'status', label: 'Impor Status Mahasiswa' },
          { id: 'history', label: 'Riwayat Impor Excel' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-[#181A17] text-white' : 'text-[#73796C] hover:text-[#181A17]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ATTENDANCE IMPORT */}
      {tab === 'attendance' && (
        <div className="space-y-6">
          <Card>
            <form onSubmit={handlePreviewAttendance} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#3D914C]" />
                  <h2 className="text-base font-bold text-[#181A17]">Unggah File Excel Absensi</h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadTemplate('attendance')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Absensi</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
                    Tanggal Absensi
                  </label>
                  <Input
                    type="date"
                    required
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
                    Pertemuan Ke-
                  </label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={attMeeting}
                    onChange={(e) => setAttMeeting(Math.max(1, Number(e.target.value)))}
                    className="tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#73796C] mb-1.5">
                    File (.xlsx / .xls / .csv)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setAttFile(e.target.files?.[0] ?? null)}
                    className="text-xs text-[#73796C] mt-2"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading || !attFile}>
                <Upload className="w-4 h-4" />
                <span>{loading ? 'Memeriksa Data...' : 'Baca & Tampilkan Preview'}</span>
              </Button>
            </form>
          </Card>

          {attPreview && (
            <Card className="p-0 overflow-hidden">
              <div className="p-6 border-b border-[#DDE6C9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#181A17]">
                    Preview Impor: {attPreview.fileName}
                  </h3>
                  <p className="text-xs text-[#73796C] mt-0.5 tabular-nums">
                    Cocok: {attPreview.summary.matched} · Duplikat: {attPreview.summary.duplicates} ·
                    Tidak Ditemukan: {attPreview.summary.notFound} · Tidak Valid:{' '}
                    {attPreview.summary.invalid}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={committing || attPreview.summary.matched === 0}
                  onClick={handleCommitAttendance}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {committing
                      ? 'Menyimpan...'
                      : `Konfirmasi & Simpan (${attPreview.summary.matched} Data)`}
                  </span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                      <th className="py-3 px-5">Baris</th>
                      <th className="py-3 px-4">NIM</th>
                      <th className="py-3 px-4">Mahasiswa</th>
                      <th className="py-3 px-4">Label</th>
                      <th className="py-3 px-4">Kelas</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Poin</th>
                      <th className="py-3 px-5">Hasil Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE6C9]/60">
                    {attPreview.rows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F0F8E0]/40">
                        <td className="py-3 px-5 text-xs text-[#73796C] tabular-nums">
                          {r.rowNumber}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-[#181A17] tabular-nums">
                          {r.nim || '—'}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#181A17]">
                          {r.full_name || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {r.student_status ? (
                            <StudentStatusIndicator status={r.student_status as StudentStatus} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#73796C]">{r.class_name || '—'}</td>
                        <td className="py-3 px-4 uppercase text-xs font-bold text-[#181A17]">
                          {r.status || r.rawStatus || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-[#3D914C]">
                          {r.pointsPreview !== undefined ? `+${r.pointsPreview}` : '—'}
                        </td>
                        <td className="py-3 px-5 text-xs">
                          {r.matchState === 'matched' ? (
                            <span className="inline-flex items-center gap-1 text-[#3D914C] font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Siap diimpor
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#C44750] font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: STATUS IMPORT */}
      {tab === 'status' && (
        <div className="space-y-6">
          <Card>
            <form onSubmit={handlePreviewStatus} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#3D914C]" />
                  <h2 className="text-base font-bold text-[#181A17]">
                    Impor Pembaruan Status Mahasiswa
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadTemplate('status')}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Template Status</span>
                </Button>
              </div>

              <p className="text-xs text-[#73796C]">
                Kolom wajib: <span className="font-bold text-[#181A17]">NIM</span> dan{' '}
                <span className="font-bold text-[#181A17]">Status</span> (Hijau/Lulus, Netral/Aktif,
                atau Merah/AFK). Pencocokan selalu menggunakan NIM dan memerlukan konfirmasi admin sebelum disimpan.
              </p>

              <div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setStatusFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-[#73796C]"
                />
              </div>

              <Button type="submit" disabled={loading || !statusFile}>
                <Upload className="w-4 h-4" />
                <span>{loading ? 'Memeriksa Data...' : 'Preview Perubahan Status'}</span>
              </Button>
            </form>
          </Card>

          {statusPreview && (
            <Card className="p-0 overflow-hidden">
              <div className="p-6 border-b border-[#DDE6C9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-[#181A17]">
                    Preview Status: {statusPreview.fileName}
                  </h3>
                  <p className="text-xs text-[#73796C] tabular-nums mt-0.5">
                    Cocok: {statusPreview.summary.matched} · Tidak Ditemukan:{' '}
                    {statusPreview.summary.notFound} · Tidak Valid: {statusPreview.summary.invalid}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={committing || statusPreview.summary.matched === 0}
                  onClick={handleCommitStatus}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {committing
                      ? 'Menyimpan...'
                      : `Konfirmasi Perubahan (${statusPreview.summary.matched} Mahasiswa)`}
                  </span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                      <th className="py-3 px-5">Baris</th>
                      <th className="py-3 px-4">NIM</th>
                      <th className="py-3 px-4">Mahasiswa</th>
                      <th className="py-3 px-4">Status Saat Ini</th>
                      <th className="py-3 px-4">Status Baru</th>
                      <th className="py-3 px-5">Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE6C9]/60">
                    {statusPreview.rows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F0F8E0]/40">
                        <td className="py-3 px-5 text-xs text-[#73796C] tabular-nums">
                          {r.rowNumber}
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-[#181A17] tabular-nums">
                          {r.nim || '—'}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#181A17]">
                          {r.full_name || '—'}
                        </td>
                        <td className="py-3 px-4 uppercase text-xs text-[#73796C]">
                          {r.current_status || '—'}
                        </td>
                        <td className="py-3 px-4 uppercase text-xs font-bold text-[#3D914C]">
                          {r.new_status || r.rawStatus || '—'}
                        </td>
                        <td className="py-3 px-5 text-xs">
                          {r.matchState === 'matched' ? (
                            <span className="text-[#3D914C] font-semibold">Valid</span>
                          ) : (
                            <span className="text-[#C44750] font-semibold">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: IMPORT HISTORY */}
      {tab === 'history' && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DDE6C9] flex items-center gap-2">
            <History className="w-4 h-4 text-[#3D914C]" />
            <h2 className="text-base font-bold text-[#181A17]">Riwayat Impor Excel</h2>
          </div>

          {loading ? (
            <div className="p-6">
              <TableSkeleton rows={5} />
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#73796C]">
              Belum ada riwayat impor Excel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#DDE6C9] bg-[#F0F8E0]/60 text-xs font-semibold text-[#73796C]">
                    <th className="py-3 px-5">Waktu</th>
                    <th className="py-3 px-4">Jenis</th>
                    <th className="py-3 px-4">Nama File</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Berhasil</th>
                    <th className="py-3 px-4 text-right">Dilewati</th>
                    <th className="py-3 px-5">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE6C9]/60">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-[#F0F8E0]/40">
                      <td className="py-3 px-5 text-xs text-[#73796C] tabular-nums whitespace-nowrap">
                        {String(h.created_at).slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-3 px-4 text-xs font-bold uppercase text-[#3D914C]">
                        {h.import_type === 'attendance' ? 'Absensi' : 'Status Mahasiswa'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#181A17]">{h.file_name}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[#73796C]">
                        {h.total_rows}
                      </td>
                      <td className="py-3 px-4 text-right text-[#3D914C] font-bold tabular-nums">
                        {h.matched_rows}
                      </td>
                      <td className="py-3 px-4 text-right text-[#73796C] tabular-nums">
                        {h.skipped_rows}
                      </td>
                      <td className="py-3 px-5 text-xs text-[#73796C]">
                        {h.imported_by_name ?? 'Admin'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
