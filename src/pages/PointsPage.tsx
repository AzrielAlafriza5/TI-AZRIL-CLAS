import { useEffect, useState } from 'react';
import { Coins, Plus, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import {
  Card,
  Button,
  Input,
  Select,
  SearchBar,
  PageHeader,
  EmptyState,
} from '../components/ui/DesignSystem.tsx';
import { Modal } from '../components/ui/Modal.tsx';
import { TableSkeleton } from '../components/ui/Skeleton.tsx';
import type { PointTransaction, StudentProfile, SystemSettings } from '../types/index.ts';

interface PointsPageProps {
  onToast: (type: 'success' | 'error', text: string) => void;
}

export function PointsPage({ onToast }: PointsPageProps) {
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [awardOpen, setAwardOpen] = useState(false);
  const [targetType, setTargetType] = useState<'single' | 'selected' | 'class' | 'study_program'>(
    'single'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [source, setSource] = useState<'question' | 'critical_question' | 'discussion' | 'bonus'>(
    'question'
  );
  const [amount, setAmount] = useState(5);
  const [description, setDescription] = useState('');

  const [adjustTarget, setAdjustTarget] = useState<PointTransaction | null>(null);
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMeta = async () => {
    try {
      const [sRes, refRes, setRes] = await Promise.all([
        apiFetch<{ students: StudentProfile[] }>('/api/admin/students?limit=100'),
        apiFetch<{ programs: any[]; classes: any[] }>('/api/reference/academic'),
        apiFetch<{ settings: SystemSettings }>('/api/admin/settings'),
      ]);
      setStudents(sRes.students);
      setPrograms(refRes.programs);
      setClasses(refRes.classes);
      setSettings(setRes.settings);
    } catch {
      // ignore
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sourceFilter) params.set('source', sourceFilter);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await apiFetch<{
        transactions: PointTransaction[];
        pagination: { totalPages: number };
      }>(`/api/admin/points?${params.toString()}`);
      setTransactions(res.transactions);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [search, sourceFilter, page]);

  const handleSourceChange = (
    nextSource: 'question' | 'critical_question' | 'discussion' | 'bonus'
  ) => {
    setSource(nextSource);
    if (!settings) return;
    if (nextSource === 'question') setAmount(settings.points.question);
    else if (nextSource === 'critical_question') setAmount(settings.points.critical_question);
    else if (nextSource === 'discussion') setAmount(settings.points.discussion);
  };

  const handleAwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ affectedCount: number }>('/api/admin/points/award', {
        method: 'POST',
        body: JSON.stringify({
          targetType,
          targetIds: selectedIds,
          source,
          amount,
          description,
        }),
      });
      onToast('success', `Poin berhasil diberikan kepada ${res.affectedCount} mahasiswa.`);
      setAwardOpen(false);
      setDescription('');
      await loadTransactions();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/points/adjust', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: adjustTarget.id,
          reason: adjustReason,
        }),
      });
      onToast('success', 'Transaksi penyesuaian poin tercatat dengan audit trail.');
      setAdjustTarget(null);
      setAdjustReason('');
      await loadTransactions();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Poin Akademik"
        description="Berikan poin keaktifan secara individual atau massal. Koreksi menggunakan transaksi penyesuaian tanpa menghapus histori."
        actions={
          <Button
            onClick={() => {
              setTargetType('single');
              setSelectedIds(students[0] ? [students[0].id] : []);
              handleSourceChange('question');
              setAwardOpen(true);
            }}
            disabled={students.length === 0}
          >
            <Plus className="w-4 h-4" />
            <span>Berikan Poin</span>
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Cari mahasiswa, NIM, atau keterangan..."
          className="flex-1 min-w-[220px]"
        />
        <Select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-full"
        >
          <option value="">Semua Sumber Poin</option>
          <option value="attendance">Kehadiran</option>
          <option value="assignment">Pengumpulan Tugas</option>
          <option value="question">Pertanyaan</option>
          <option value="critical_question">Pertanyaan Kritis</option>
          <option value="discussion">Kontribusi Diskusi</option>
          <option value="bonus">Poin Tambahan</option>
          <option value="adjustment">Penyesuaian / Koreksi</option>
        </Select>
      </Card>

      {/* Ledger Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Coins className="w-5 h-5" />}
            title="Belum ada transaksi poin"
            description="Transaksi poin akademik dari absensi, tugas, atau pemberian langsung akan tercatat di sini."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#D5E4B6] bg-[#F0F8DF]/70 text-xs font-semibold text-[#6F7B68]">
                    <th className="py-3.5 px-5">Waktu</th>
                    <th className="py-3.5 px-4">Mahasiswa</th>
                    <th className="py-3.5 px-4">Sumber</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                    <th className="py-3.5 px-4 text-right">Poin</th>
                    <th className="py-3.5 px-5 text-right">Koreksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4B6]/70">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[#F0F8DF]/50 transition-colors">
                      <td className="py-3.5 px-5 text-xs text-[#6F7B68] tabular-nums whitespace-nowrap">
                        {String(t.created_at).slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-display font-bold text-[#20251D]">{t.student_name}</div>
                        <div className="text-xs text-[#6F7B68] tabular-nums">
                          {t.nim} · {t.class_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold text-[#6F7B68] uppercase">
                        {t.source.replace('_', ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-[#20251D]">{t.description}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-display font-bold tabular-nums ${
                          t.amount >= 0 ? 'text-[#3E7B27]' : 'text-[#D13447]'
                        }`}
                      >
                        {t.amount >= 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {t.source !== 'adjustment' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustTarget(t);
                              setAdjustReason('');
                            }}
                            title="Buat transaksi pembatalan / koreksi"
                            className="font-display inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#6F7B68] hover:text-[#D13447] hover:bg-[#D13447]/10 rounded-full transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Koreksi</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-[#D5E4B6] flex items-center justify-between text-xs text-[#6F7B68]">
              <span className="tabular-nums font-medium">
                Halaman {page} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 rounded-full border border-[#D5E4B6] bg-white disabled:opacity-40 hover:border-[#B5D45D] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-full border border-[#D5E4B6] bg-white disabled:opacity-40 hover:border-[#B5D45D] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Award Points Modal */}
      <Modal
        open={awardOpen}
        title="Berikan Poin Akademik"
        onClose={() => setAwardOpen(false)}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleAwardSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Target Penerima
            </label>
            <Select
              value={targetType}
              onChange={(e) => {
                const tt = e.target.value as any;
                setTargetType(tt);
                if (tt === 'single') setSelectedIds(students[0] ? [students[0].id] : []);
                else if (tt === 'selected') setSelectedIds([]);
                else if (tt === 'class') setSelectedIds(classes[0] ? [classes[0].id] : []);
                else if (tt === 'study_program')
                  setSelectedIds(programs[0] ? [programs[0].id] : []);
              }}
              className="w-full"
            >
              <option value="single">Satu Mahasiswa</option>
              <option value="selected">Beberapa Mahasiswa Terpilih</option>
              <option value="class">Seluruh Mahasiswa Dalam Satu Kelas</option>
              <option value="study_program">Seluruh Mahasiswa Dalam Satu Program Studi</option>
            </Select>
          </div>

          {targetType === 'single' && (
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Pilih Mahasiswa
              </label>
              <Select
                value={selectedIds[0] ?? ''}
                onChange={(e) => setSelectedIds([e.target.value])}
                className="w-full"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nim} — {s.full_name} ({s.class_name})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {targetType === 'selected' && (
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Pilih Mahasiswa ({selectedIds.length} dipilih)
              </label>
              <div className="max-h-36 overflow-y-auto border border-[#D5E4B6] rounded-[16px] p-3 space-y-2 bg-[#F0F8DF]/50">
                {students.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          )
                        }
                      />
                      <span className="tabular-nums text-[#6F7B68]">{s.nim}</span>
                      <span className="font-semibold text-[#20251D]">{s.full_name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {targetType === 'class' && (
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Pilih Kelas</label>
              <Select
                value={selectedIds[0] ?? ''}
                onChange={(e) => setSelectedIds([e.target.value])}
                className="w-full"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {targetType === 'study_program' && (
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Pilih Program Studi
              </label>
              <Select
                value={selectedIds[0] ?? ''}
                onChange={(e) => setSelectedIds([e.target.value])}
                className="w-full"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Sumber Poin
              </label>
              <Select
                value={source}
                onChange={(e) => handleSourceChange(e.target.value as any)}
                className="w-full"
              >
                <option value="question">Pertanyaan</option>
                <option value="critical_question">Pertanyaan Kritis</option>
                <option value="discussion">Kontribusi Diskusi</option>
                <option value="bonus">Poin Tambahan</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
                Jumlah Poin
              </label>
              <Input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">Keterangan</label>
            <Input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Aktif bertanya pada sesi Struktur Data"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAwardOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Kirim Poin'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust/Reversal Modal */}
      <Modal
        open={Boolean(adjustTarget)}
        title="Penyesuaian / Pembatalan Poin"
        subtitle={
          adjustTarget
            ? `Membatalkan transaksi ${
                adjustTarget.amount >= 0 ? `+${adjustTarget.amount}` : adjustTarget.amount
              } poin untuk ${adjustTarget.student_name}`
            : ''
        }
        onClose={() => setAdjustTarget(null)}
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <p className="text-xs text-[#4E5849] leading-relaxed">
            Riwayat asli tetap tersimpan untuk kebutuhan audit. Sistem akan membuat transaksi
            penyesuaian baru sebesar{' '}
            <span className="font-bold text-[#20251D] tabular-nums">
              {adjustTarget ? -adjustTarget.amount : 0} poin
            </span>
            .
          </p>
          <div>
            <label className="block text-xs font-semibold text-[#4E5849] mb-1.5">
              Alasan Koreksi
            </label>
            <Input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Contoh: Salah input mahasiswa penerima"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)}>
              Batal
            </Button>
            <Button type="submit" variant="danger" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Catat Penyesuaian'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
