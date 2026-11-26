import { useState } from 'react';
import {
  Lock,
  KeyRound,
  User,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  BookOpen,
  Flame,
  Trophy,
} from 'lucide-react';
import { apiFetch, setAuthToken } from '../lib/api.ts';
import { BrandLogo, OFFICIAL_LOGO_SRC } from '../components/ui/BrandLogo.tsx';
import type { AuthUser } from '../types/index.ts';

interface LoginPageProps {
  adminProvisioned: boolean;
  adminManagedByEnv?: boolean;
  serverError?: string | null;
  onLoginSuccess: (user: AuthUser, streakOutcome?: any) => void;
  onAdminProvisioned: () => void;
}

export function LoginPage({
  adminProvisioned,
  adminManagedByEnv = false,
  serverError = null,
  onLoginSuccess,
  onAdminProvisioned,
}: LoginPageProps) {
  const [loginTab, setLoginTab] = useState<'student' | 'admin'>(
    adminProvisioned ? 'student' : 'admin'
  );

  // Student form state
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  // Admin passcode login state
  const [adminPasscode, setAdminPasscode] = useState('');

  // First-time Admin bootstrap state
  const [adminFullName, setAdminFullName] = useState('Azril Administrator');
  const [adminPassword, setAdminPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSwitchTab = (next: 'student' | 'admin') => {
    setLoginTab(next);
    setError('');
    setShowPassword(false);
  };

  const handleRoleLogin = async (
    e: React.FormEvent,
    expectedRole: 'student' | 'admin'
  ) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const payload =
      expectedRole === 'student'
        ? { identifier: studentIdentifier, password: studentPassword, expectedRole }
        : { password: adminPasscode, expectedRole };

    try {
      const res = await apiFetch<{
        token: string;
        user: AuthUser;
        streakOutcome?: any;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(res.token);
      onLoginSuccess(res.user, res.streakOutcome);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk ke IT AZRIL CLAS.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/bootstrap-admin',
        {
          method: 'POST',
          body: JSON.stringify({
            full_name: adminFullName,
            password: adminPassword,
          }),
        }
      );
      setAuthToken(res.token);
      onAdminProvisioned();
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Gagal mengaktifkan akun administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F8DF] text-[#20251D] flex items-center justify-center p-[18px] tablet:p-6 desktop:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 desktop:grid-cols-12 gap-5 items-stretch animate-page-enter">
        {/* Left Editorial Brand & Feature Showcase */}
        <div className="desktop:col-span-6 bg-[#171A17] text-white border border-[#232822] rounded-[26px] p-7 tablet:p-9 flex flex-col justify-between">
          <div>
            <BrandLogo darkSurface size="lg" />
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#232822] border border-[#B5D45D]/25 text-[#B5D45D] text-xs font-display font-semibold mt-8">
              <span>Academic Learning Platform</span>
            </div>
            <h1 className="font-display text-3xl tablet:text-4xl font-bold tracking-tight text-white mt-4 leading-[1.12]">
              Learn. Grow. <span className="text-[#B5D45D]">Compete.</span>
            </h1>
            <p className="text-sm text-[#DCECB8]/80 mt-3 leading-relaxed max-w-md">
              Platform manajemen akademik modern untuk pengelolaan kelas, tugas, absensi, materi,
              poin akademik, XP aktif, dan daily login streak mahasiswa.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {[
              {
                icon: BookOpen,
                title: 'Materi & Tugas Terstruktur',
                desc: 'Modul pembelajaran berurutan dengan progres dan penilaian transparan.',
                accent: 'bg-[#B5D45D] text-[#171A17]',
              },
              {
                icon: Flame,
                title: 'Daily Login Streak & XP',
                desc: 'Konsistensi harian membangun level akademik dan membuka pencapaian.',
                accent: 'bg-[#FF7A1A]/15 text-[#FF7A1A]',
              },
              {
                icon: Trophy,
                title: 'Leaderboard Kelas & Prodi',
                desc: 'Kompetisi akademik sehat berbasis kehadiran, tugas, dan poin aktif.',
                accent: 'bg-[#DCECB8]/15 text-[#B5D45D]',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-[#232822] border border-[#232822] rounded-[20px] p-4 flex items-start gap-3.5"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-white">{item.title}</div>
                    <div className="text-xs text-[#DCECB8]/75 mt-0.5 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Authentication Card with Dual Login Mode (Mahasiswa & Admin) */}
        <div className="desktop:col-span-6 bg-white border border-[#D5E4B6] rounded-[24px] p-7 tablet:p-9 flex flex-col justify-center">
          {/* 2-Portal Role Switcher */}
          <div
            role="tablist"
            aria-label="Pilih Portal Masuk"
            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-full bg-[#F0F8DF] border border-[#D5E4B6] mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginTab === 'student'}
              onClick={() => handleSwitchTab('student')}
              className={`font-display flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs tablet:text-sm font-bold transition-all duration-150 cursor-pointer ${
                loginTab === 'student'
                  ? 'bg-[#171A17] text-white'
                  : 'text-[#4E5849] hover:text-[#20251D]'
              }`}
            >
              <GraduationCap
                className={`w-4 h-4 ${
                  loginTab === 'student' ? 'text-[#B5D45D]' : 'text-[#6F7B68]'
                }`}
              />
              <span>Login Mahasiswa</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginTab === 'admin'}
              onClick={() => handleSwitchTab('admin')}
              className={`font-display flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs tablet:text-sm font-bold transition-all duration-150 cursor-pointer ${
                loginTab === 'admin'
                  ? 'bg-[#171A17] text-white'
                  : 'text-[#4E5849] hover:text-[#20251D]'
              }`}
            >
              <ShieldCheck
                className={`w-4 h-4 ${
                  loginTab === 'admin' ? 'text-[#B5D45D]' : 'text-[#6F7B68]'
                }`}
              />
              <span>Login Admin</span>
            </button>
          </div>

          {loginTab === 'student' ? (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECB8] text-[#20251D] text-xs font-display font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 text-[#3E7B27]" />
                    <span>Portal Mahasiswa</span>
                  </div>
                  <img
                    src={OFFICIAL_LOGO_SRC}
                    alt="Logo resmi IT AZRIL CLAS"
                    className="w-9 h-9 tablet:w-10 tablet:h-10 object-contain shrink-0"
                    decoding="async"
                  />
                </div>
                <h2 className="font-display text-2xl font-bold text-[#20251D] tracking-tight">
                  Masuk sebagai Mahasiswa
                </h2>
                <p className="text-sm text-[#4E5849] mt-1.5 leading-relaxed">
                  Gunakan NIM dan password Anda untuk mengakses kelas, tugas, materi, XP, dan leaderboard.
                </p>
              </div>

              {(serverError || error) && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[16px] bg-[#D13447]/10 border border-[#D13447]/25 text-xs text-[#D13447] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleRoleLogin(e, 'student')} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#20251D] mb-1.5">
                    NIM / Username Mahasiswa
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#6F7B68] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={studentIdentifier}
                      onChange={(e) => setStudentIdentifier(e.target.value)}
                      placeholder="Contoh: 230101001"
                      className="w-full pl-11 pr-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#20251D] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#6F7B68] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="Masukkan password mahasiswa"
                      className="w-full pl-11 pr-11 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6F7B68] hover:text-[#20251D] cursor-pointer"
                      aria-label="Tampilkan password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="font-display w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#B5D45D] hover:bg-[#C5E370] text-[#171A17] text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Memverifikasi...' : 'Masuk Mahasiswa'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#D5E4B6] text-xs text-[#6F7B68] leading-relaxed">
                Akun mahasiswa dibuat oleh Administrator. Pada login pertama, mahasiswa menggunakan{' '}
                <span className="font-semibold text-[#20251D]">NIM</span> sebagai username dan password awal.
              </div>
            </>
          ) : !adminProvisioned ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DCECB8] text-[#3E7B27] text-xs font-display font-semibold w-fit">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Aktivasi Awal Administrator Utama</span>
                </div>
                <img
                  src={OFFICIAL_LOGO_SRC}
                  alt="Logo resmi IT AZRIL CLAS"
                  className="w-9 h-9 tablet:w-10 tablet:h-10 object-contain shrink-0"
                  decoding="async"
                />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#20251D] tracking-tight">
                Buat Sandi Verifikasi Admin
              </h2>
              <p className="text-sm text-[#4E5849] mt-1.5 leading-relaxed">
                IT AZRIL CLAS hanya memiliki satu administrator utama. Buat sandi atau kode verifikasi
                untuk mengaktifkan akses dashboard admin.
              </p>

              {(serverError || error) && (
                <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-[16px] bg-[#D13447]/10 border border-[#D13447]/25 text-xs text-[#D13447] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={handleBootstrapAdmin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#20251D] mb-1.5">
                    Nama Administrator
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Contoh: Azril Administrator"
                    className="w-full px-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#20251D] mb-1.5">
                    Sandi / Kode Verifikasi Admin (min. 6 karakter)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#6F7B68] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Buat sandi / kode verifikasi admin"
                      className="w-full pl-11 pr-11 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6F7B68] hover:text-[#20251D] cursor-pointer"
                      aria-label="Tampilkan sandi"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="font-display w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#B5D45D] hover:bg-[#C5E370] text-[#171A17] text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Mengaktifkan...' : 'Aktifkan Akses Admin'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DCECB8] text-[#3E7B27] text-xs font-display font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verifikasi Administrator Utama</span>
                  </div>
                  <img
                    src={OFFICIAL_LOGO_SRC}
                    alt="Logo resmi IT AZRIL CLAS"
                    className="w-9 h-9 tablet:w-10 tablet:h-10 object-contain shrink-0"
                    decoding="async"
                  />
                </div>
                <h2 className="font-display text-2xl font-bold text-[#20251D] tracking-tight">
                  Masukkan Sandi Admin
                </h2>
                <p className="text-sm text-[#4E5849] mt-1.5 leading-relaxed">
                  Akses portal admin hanya memerlukan sandi atau kode verifikasi Administrator Utama tanpa perlu memasukkan email.
                </p>
              </div>

              {(serverError || error) && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[16px] bg-[#D13447]/10 border border-[#D13447]/25 text-xs text-[#D13447] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleRoleLogin(e, 'admin')} className="space-y-4">
                <div className="p-4 rounded-[20px] bg-[#F0F8DF] border border-[#D5E4B6]">
                  <label className="block text-xs font-semibold text-[#20251D] mb-2">
                    Sandi / Kode Verifikasi Administrator
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#3E7B27] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      placeholder="Masukkan sandi atau kode verifikasi"
                      className="w-full pl-11 pr-11 py-3 text-base font-semibold tracking-wider bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6F7B68] hover:text-[#20251D] cursor-pointer"
                      aria-label="Tampilkan sandi"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="font-display w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#B5D45D] hover:bg-[#C5E370] text-[#171A17] text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk Admin'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#D5E4B6] text-xs text-[#6F7B68] leading-relaxed space-y-1.5">
                <div>
                  Portal ini dilindungi kode verifikasi tunggal khusus{' '}
                  <span className="font-semibold text-[#20251D]">Administrator Utama</span>.
                </div>
                {adminManagedByEnv && (
                  <div>
                    Sandi verifikasi dikelola melalui variabel server{' '}
                    <span className="font-semibold text-[#20251D]">ADMIN_PASSWORD</span>.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
