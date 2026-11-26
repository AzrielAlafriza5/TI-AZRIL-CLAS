import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  SkipForward,
  Users,
  Download,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../../lib/api.ts';
import { Button, Input } from '../ui/DesignSystem.tsx';
import { StudentStatusIndicator } from '../ui/StatusBadge.tsx';
import type { StudentStatus } from '../../types/index.ts';

interface ParsedSheetInfo {
  name: string;
  isHes: boolean;
  isOtherProdi: boolean;
  selected: boolean;
  totalRows: number;
  hesRows: number;
  note: string;
}

interface ParsedStudentRow {
  rowNumber: number;
  sheetName: string;
  nim: string;
  fullName: string;
  rawProdi: string;
  isHes: boolean;
  targetProgramName: string;
  targetClassName: string;
  detectedColor: 'red' | 'green' | 'neutral';
  detectedColorLabel: 'Merah' | 'Hijau' | 'Netral';
  detectedColorHex: string | null;
  status: StudentStatus;
  statusLabel: 'AFK' | 'Lulus' | 'Aktif';
  actionState: 'new' | 'skipped_duplicate' | 'skipped_non_hes' | 'invalid';
  reason: string;
  attendanceWeeks: Array<{ week: number; label: string; raw: string; status: string | null }>;
  attendanceCount: number;
}

interface PreviewResponse {
  fileName: string;
  sheets: ParsedSheetInfo[];
  targetAssignment: {
    studyProgramId: string | null;
    studyProgramCode: string;
    studyProgramName: string;
    classId: string | null;
    className: string;
    willAutoCreate: boolean;
  };
  hasWeeklyAttendance: boolean;
  rows: ParsedStudentRow[];
  summary: {
    totalRows: number;
    newTotal: number;
    newAktif: number;
    newLulus: number;
    newAfk: number;
    skippedDuplicate: number;
    skippedNonHes: number;
    invalid: number;
  };
}

interface CommitSummary {
  totalProcessed: number;
  createdTotal: number;
  createdAktif: number;
  createdLulus: number;
  createdAfk: number;
  skippedTotal: number;
  skippedDuplicate: number;
  skippedNonHes: number;
  invalidCount: number;
  attendanceSynced: number;
}

interface StudentExcelImportPanelProps {
  onToast?: (type: 'success' | 'error', text: string) => void;
  onImportComplete?: () => void;
  onClose?: () => void;
}

export function StudentExcelImportPanel({
  onToast,
  onImportComplete,
  onClose,
}: StudentExcelImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [rowFilter, setRowFilter] = useState<'all' | 'new' | 'skipped_duplicate' | 'skipped_non_hes'>('all');
  const [syncAttendance, setSyncAttendance] = useState(true);
  const [attendanceStartDate, setAttendanceStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [commitResult, setCommitResult] = useState<{
    targetProgram: string;
    targetClass: string;
    summary: CommitSummary;
  } | null>(null);

  const downloadSampleTemplate = () => {
    const hesRows = [
      {
        NIM: '240401001',
        Nama: 'Ahmad Fauzan Pratama',
        'Minggu ke-1': 'H',
        'Minggu ke-2': 'H',
        'Minggu ke-3': 'H',
      },
      {
        NIM: '240401002',
        Nama: 'Siti Aisyah Rahmawati',
        'Minggu ke-1': 'H',
        'Minggu ke-2': 'I',
        'Minggu ke-3': 'H',
      },
    ];
    const wb = XLSX.utils.book_new();
    const wsHes = XLSX.utils.json_to_sheet(hesRows);
    XLSX.utils.book_append_sheet(wb, wsHes, 'HES-3B');
    XLSX.writeFile(wb, 'template_impor_mahasiswa_hes.xlsx');
  };

  const runPreviewRequest = async (targetFile: File, selectedSheets?: string[]) => {
    setParsing(true);
    setCommitResult(null);
    try {
      const form = new FormData();
      form.append('file', targetFile);
      if (selectedSheets) {
        form.append('selectedSheets', JSON.stringify(selectedSheets));
      }

      const token = getAuthToken();
      const res = await fetch('/api/admin/import/students/preview', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membaca file Excel.');

      setPreview(data);
      setSyncAttendance(Boolean(data.hasWeeklyAttendance));
      setRowFilter('all');
    } catch (err: any) {
      onToast?.('error', err.message || 'Gagal memproses file Excel.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      onToast?.('error', 'Pilih file Excel (.xlsx / .xls) terlebih dahulu.');
      return;
    }
    await runPreviewRequest(file);
  };

  const handleToggleSheet = async (sheetName: string) => {
    if (!file || !preview) return;
    const currentSelected = preview.sheets.filter((s) => s.selected).map((s) => s.name);
    const nextSelected = currentSelected.includes(sheetName)
      ? currentSelected.filter((n) => n !== sheetName)
      : [...currentSelected, sheetName];
    await runPreviewRequest(file, nextSelected);
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        targetProgram: string;
        targetClass: string;
        summary: CommitSummary;
      }>('/api/admin/import/students/commit', {
        method: 'POST',
        body: JSON.stringify({
          fileName: preview.fileName,
          rows: preview.rows,
          syncAttendance: preview.hasWeeklyAttendance && syncAttendance,
          attendanceStartDate,
        }),
      });

      setCommitResult({
        targetProgram: res.targetProgram,
        targetClass: res.targetClass,
        summary: res.summary,
      });
      setPreview(null);
      onToast?.(
        'success',
        `Impor selesai: ${res.summary.createdTotal} akun mahasiswa baru berhasil dibuat.`
      );
      onImportComplete?.();
    } catch (err: any) {
      onToast?.('error', err.message || 'Gagal menyimpan data impor mahasiswa.');
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setCommitResult(null);
    setRowFilter('all');
  };

  const filteredRows = preview
    ? preview.rows.filter((r) => (rowFilter === 'all' ? true : r.actionState === rowFilter))
    : [];

  return (
    <div className="space-y-5">
      {/* Guide & Upload Form */}
      {!preview && !commitResult && (
        <form onSubmit={handleFileSubmit} className="space-y-5">
          <div className="rounded-[20px] bg-[#F0F8DF] border border-[#D5E4B6] p-4 space-y-2.5 text-xs text-[#4E5849]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display font-bold text-sm text-[#20251D] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#3E7B27]" />
                <span>Aturan Impor Otomatis Prodi HES</span>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={downloadSampleTemplate}>
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template HES</span>
              </Button>
            </div>
            <ul className="space-y-1 list-disc pl-4 leading-relaxed">
              <li>
                Sistem memindai seluruh sheet, mengekstrak kolom <strong className="text-[#20251D]">NIM</strong>,{' '}
                <strong className="text-[#20251D]">Nama</strong>, serta absensi mingguan{' '}
                <strong className="text-[#20251D]">Minggu ke-1 s/d ke-9</strong> (jika tersedia).
              </li>
              <li>
                Hanya data Program Studi <strong className="text-[#20251D]">HES</strong> (misal sheet{' '}
                <strong className="text-[#20251D]">HES-3B</strong>) yang diproses dan ditempatkan otomatis ke
                kelas tunggal Prodi HES aktif; sheet prodi lain seperti <strong className="text-[#20251D]">PJKR</strong>{' '}
                atau <strong className="text-[#20251D]">FARMASI</strong> otomatis diabaikan.
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span>Deteksi warna sel/baris:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#D13447]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF0000] inline-block" /> Merah → AFK
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#3E7B27]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00B050] inline-block" /> Hijau → Lulus
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-[#20251D]">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#D5E4B6] inline-block" /> Tanpa Warna/Netral → Aktif
                </span>
              </li>
              <li>
                Mahasiswa yang sudah terdaftar (NIM atau Nama sama) dilewati otomatis tanpa duplikasi;
                akun baru menggunakan <strong className="text-[#20251D]">Username = NIM</strong> dan{' '}
                <strong className="text-[#20251D]">Password awal = NIM</strong>.
              </li>
            </ul>
          </div>

          <div className="rounded-[20px] border border-dashed border-[#B5D45D] bg-white p-5 space-y-3">
            <label className="block text-xs font-semibold text-[#20251D]">
              Pilih File Excel Mahasiswa (.xlsx / .xls)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
              }}
              className="block w-full text-xs text-[#4E5849] file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#DCECB8] file:text-[#20251D] hover:file:bg-[#B5D45D] cursor-pointer"
            />
            {file && (
              <div className="text-xs text-[#3E7B27] font-medium">
                File siap dipindai: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Tutup
              </Button>
            )}
            <Button type="submit" disabled={parsing || !file}>
              <Upload className="w-4 h-4" />
              <span>{parsing ? 'Memindai Warna & Data...' : 'Baca & Tampilkan Preview'}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Preview Table & Controls */}
      {preview && (
        <div className="space-y-4">
          {/* Target Prodi / Class & Sheet Filter */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-[#171A17] text-white p-4 space-y-1">
              <div className="text-[11px] text-[#DCECB8]/75">Penempatan Prodi & Kelas Otomatis</div>
              <div className="font-display text-base font-bold text-[#B5D45D]">
                {preview.targetAssignment.studyProgramName} · {preview.targetAssignment.className}
              </div>
              <div className="text-xs text-[#DCECB8]/80">
                {preview.targetAssignment.willAutoCreate
                  ? 'Prodi/kelas HES akan dibuat otomatis saat konfirmasi impor.'
                  : 'Terhubung ke kelas tunggal aktif Prodi HES di database.'}
              </div>
            </div>

            <div className="rounded-[20px] bg-[#F0F8DF] border border-[#D5E4B6] p-4 space-y-2">
              <div className="text-[11px] font-semibold text-[#4E5849]">
                Filter Sheet Excel ({preview.sheets.length} sheet terdeteksi)
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.sheets.map((sh) => (
                  <label
                    key={sh.name}
                    title={sh.note}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
                      sh.isOtherProdi
                        ? 'bg-white/60 border-[#D5E4B6] text-[#6F7B68] opacity-70 cursor-not-allowed'
                        : sh.selected
                          ? 'bg-[#DCECB8] border-[#B5D45D] text-[#20251D] font-semibold cursor-pointer'
                          : 'bg-white border-[#D5E4B6] text-[#4E5849] cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sh.selected}
                      disabled={sh.isOtherProdi || parsing}
                      onChange={() => handleToggleSheet(sh.name)}
                      className="accent-[#3E7B27]"
                    />
                    <span>{sh.name}</span>
                    <span className="text-[10px] text-[#6F7B68] tabular-nums">
                      ({sh.totalRows}) {sh.isOtherProdi ? '· Diabaikan' : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Breakdown Strip */}
          <div className="grid grid-cols-2 tablet:grid-cols-4 gap-3">
            <div className="rounded-[18px] bg-white border border-[#D5E4B6] p-3.5">
              <div className="text-[11px] text-[#6F7B68]">Total Data Dipindai</div>
              <div className="font-display text-xl font-bold text-[#20251D] tabular-nums mt-0.5">
                {preview.summary.totalRows}
              </div>
            </div>
            <div className="rounded-[18px] bg-[#DCECB8]/50 border border-[#B5D45D] p-3.5">
              <div className="text-[11px] text-[#3E7B27] font-semibold">Akun Baru Siap Dibuat</div>
              <div className="font-display text-xl font-bold text-[#20251D] tabular-nums mt-0.5">
                {preview.summary.newTotal}
              </div>
              <div className="text-[11px] text-[#4E5849] mt-0.5 tabular-nums">
                {preview.summary.newAktif} Aktif · {preview.summary.newLulus} Lulus · {preview.summary.newAfk} AFK
              </div>
            </div>
            <div className="rounded-[18px] bg-white border border-[#D5E4B6] p-3.5">
              <div className="text-[11px] text-[#6F7B68]">Dilewati (Terdaftar)</div>
              <div className="font-display text-xl font-bold text-[#C27C0A] tabular-nums mt-0.5">
                {preview.summary.skippedDuplicate}
              </div>
            </div>
            <div className="rounded-[18px] bg-white border border-[#D5E4B6] p-3.5">
              <div className="text-[11px] text-[#6F7B68]">Dilewati (Bukan HES)</div>
              <div className="font-display text-xl font-bold text-[#6F7B68] tabular-nums mt-0.5">
                {preview.summary.skippedNonHes}
              </div>
            </div>
          </div>

          {/* Optional Weekly Attendance Sync Option */}
          {preview.hasWeeklyAttendance && (
            <div className="rounded-[18px] bg-white border border-[#D5E4B6] px-4 py-3 flex flex-col tablet:flex-row tablet:items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-xs font-medium text-[#20251D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncAttendance}
                  onChange={(e) => setSyncAttendance(e.target.checked)}
                  className="w-4 h-4 accent-[#3E7B27]"
                />
                <span>
                  Sinkronkan absensi mingguan awal (Minggu ke-1 s/d ke-9) sekaligus hitung poin kehadiran
                </span>
              </label>
              {syncAttendance && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#6F7B68]">Mulai Minggu ke-1:</span>
                  <Input
                    type="date"
                    value={attendanceStartDate}
                    onChange={(e) => setAttendanceStartDate(e.target.value)}
                    className="!py-1.5 !px-3 !text-xs w-auto"
                  />
                </div>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F0F8DF] border border-[#D5E4B6] p-1 rounded-full">
              {[
                { id: 'all', label: `Semua (${preview.rows.length})` },
                { id: 'new', label: `Baru (${preview.summary.newTotal})` },
                { id: 'skipped_duplicate', label: `Terdaftar (${preview.summary.skippedDuplicate})` },
                { id: 'skipped_non_hes', label: `Bukan HES (${preview.summary.skippedNonHes})` },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRowFilter(opt.id as any)}
                  className={`font-display px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                    rowFilter === opt.id
                      ? 'bg-[#171A17] text-[#B5D45D]'
                      : 'text-[#4E5849] hover:text-[#20251D]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-[#6F7B68] truncate">File: {preview.fileName}</div>
          </div>

          {/* Preview Data Table */}
          <div className="rounded-[20px] border border-[#D5E4B6] overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[#F0F8DF] border-b border-[#D5E4B6] text-[#4E5849] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Sheet / Baris</th>
                    <th className="py-3 px-3">NIM</th>
                    <th className="py-3 px-3">Nama Mahasiswa</th>
                    <th className="py-3 px-3">Prodi / Kelas Otomatis</th>
                    <th className="py-3 px-3">Deteksi Warna → Status</th>
                    {preview.hasWeeklyAttendance && <th className="py-3 px-3">Absensi M1–M9</th>}
                    <th className="py-3 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={preview.hasWeeklyAttendance ? 7 : 6}
                        className="py-8 text-center text-[#6F7B68]"
                      >
                        Tidak ada baris data pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, idx) => (
                      <tr
                        key={`${r.sheetName}-${r.rowNumber}-${idx}`}
                        className={
                          r.actionState === 'new'
                            ? 'hover:bg-[#F0F8DF]/40'
                            : 'bg-[#F0F8DF]/20 text-[#6F7B68]'
                        }
                      >
                        <td className="py-2.5 px-4 whitespace-nowrap tabular-nums">
                          <span className="font-semibold text-[#20251D]">{r.sheetName}</span> · #{r.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#20251D] tabular-nums whitespace-nowrap">
                          {r.nim || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#20251D]">{r.fullName || '—'}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.isHes ? (
                            <span className="font-semibold text-[#20251D]">
                              {r.targetProgramName} · {r.targetClassName}
                            </span>
                          ) : (
                            <span className="text-[#6F7B68]">{r.rawProdi || r.sheetName} (Bukan HES)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <span
                              title={r.detectedColorHex || 'Tanpa warna'}
                              className="w-3.5 h-3.5 rounded-full border border-[#D5E4B6] shrink-0"
                              style={{
                                backgroundColor:
                                  r.detectedColor === 'red'
                                    ? r.detectedColorHex || '#FF0000'
                                    : r.detectedColor === 'green'
                                      ? r.detectedColorHex || '#00B050'
                                      : r.detectedColorHex || '#FFFFFF',
                              }}
                            />
                            <span className="text-[11px] text-[#6F7B68]">{r.detectedColorLabel} →</span>
                            <StudentStatusIndicator status={r.status} compact />
                          </div>
                        </td>
                        {preview.hasWeeklyAttendance && (
                          <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                            {r.attendanceCount > 0 ? `${r.attendanceCount} minggu` : '—'}
                          </td>
                        )}
                        <td className="py-2.5 px-4">
                          {r.actionState === 'new' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#3E7B27]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.reason}</span>
                            </span>
                          )}
                          {r.actionState === 'skipped_duplicate' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#C27C0A]">
                              <SkipForward className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.reason}</span>
                            </span>
                          )}
                          {r.actionState === 'skipped_non_hes' && (
                            <span className="inline-flex items-center gap-1 text-[#6F7B68]">
                              <SkipForward className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.reason}</span>
                            </span>
                          )}
                          {r.actionState === 'invalid' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#D13447]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>{r.reason}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <Button type="button" variant="outline" onClick={handleReset} disabled={committing}>
              <RefreshCw className="w-4 h-4" />
              <span>Ganti File Excel</span>
            </Button>

            <div className="flex flex-wrap items-center gap-2.5">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose} disabled={committing}>
                  Batal
                </Button>
              )}
              <Button
                type="button"
                disabled={committing || preview.summary.newTotal === 0}
                onClick={handleConfirmImport}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {committing
                    ? 'Membuat Akun Mahasiswa...'
                    : `Konfirmasi Impor (${preview.summary.newTotal} Akun Baru)`}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Commit Result Summary */}
      {commitResult && (
        <div className="space-y-5">
          <div className="rounded-[22px] bg-[#171A17] text-white p-5 flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-[#B5D45D] text-[#171A17] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Impor Data Mahasiswa Prodi {commitResult.targetProgram} Selesai
              </h3>
              <p className="text-xs text-[#DCECB8]/85 mt-1 leading-relaxed">
                Seluruh akun baru otomatis ditempatkan di kelas{' '}
                <strong className="text-[#B5D45D]">{commitResult.targetClass}</strong> dengan login individu
                menggunakan <strong className="text-white">Username = NIM</strong> dan{' '}
                <strong className="text-white">Password awal = NIM</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 tablet:grid-cols-3 gap-3">
            <div className="rounded-[20px] bg-white border border-[#D5E4B6] p-4">
              <div className="text-xs text-[#6F7B68]">Total Data Diproses</div>
              <div className="font-display text-2xl font-bold text-[#20251D] tabular-nums mt-1">
                {commitResult.summary.totalProcessed}
              </div>
              <div className="text-[11px] text-[#6F7B68] mt-1">Baris terbaca dari file Excel</div>
            </div>

            <div className="rounded-[20px] bg-[#DCECB8]/55 border border-[#B5D45D] p-4">
              <div className="text-xs font-semibold text-[#3E7B27]">Akun Baru Berhasil Dibuat</div>
              <div className="font-display text-2xl font-bold text-[#20251D] tabular-nums mt-1">
                {commitResult.summary.createdTotal}
              </div>
              <div className="text-xs text-[#20251D] mt-1.5 tabular-nums font-medium">
                {commitResult.summary.createdAktif} Aktif · {commitResult.summary.createdLulus} Lulus ·{' '}
                {commitResult.summary.createdAfk} AFK
              </div>
            </div>

            <div className="rounded-[20px] bg-white border border-[#D5E4B6] p-4">
              <div className="text-xs text-[#6F7B68]">Total Data Dilewati</div>
              <div className="font-display text-2xl font-bold text-[#C27C0A] tabular-nums mt-1">
                {commitResult.summary.skippedTotal}
              </div>
              <div className="text-[11px] text-[#4E5849] mt-1.5 tabular-nums">
                {commitResult.summary.skippedDuplicate} sudah terdaftar · {commitResult.summary.skippedNonHes}{' '}
                bukan prodi HES
                {commitResult.summary.invalidCount > 0 ? ` · ${commitResult.summary.invalidCount} tidak valid` : ''}
              </div>
            </div>
          </div>

          {commitResult.summary.attendanceSynced > 0 && (
            <div className="rounded-[18px] bg-[#F0F8DF] border border-[#D5E4B6] px-4 py-3 text-xs text-[#20251D]">
              Sinkronisasi absensi mingguan awal: <strong>{commitResult.summary.attendanceSynced}</strong>{' '}
              catatan kehadiran Minggu ke-1 s/d ke-9 telah disimpan dan poin kehadiran dihitung otomatis.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={handleReset}>
              <Upload className="w-4 h-4" />
              <span>Impor File Excel Lain</span>
            </Button>
            {onClose && (
              <Button type="button" onClick={onClose}>
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
