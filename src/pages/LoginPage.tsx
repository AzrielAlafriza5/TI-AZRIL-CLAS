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
import { BrandLogo } from '../components/ui/BrandLogo.tsx';
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
    <div className="min-h-screen bg-[#F0F8E0] text-[#181A17] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Image-Free Brand & Feature Showcase */}
        <div className="lg:col-span-6 bg-[#DBECB8] border border-[#DDE6C9] rounded-[30px] p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <BrandLogo />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#181A17] mt-10 leading-tight">
              Learn. Grow. Compete.
            </h1>
            <p className="text-sm sm:text-base text-[#73796C] mt-3 leading-relaxed max-w-md">
              Platform manajemen pembelajaran modern untuk pengelolaan kelas, tugas, absensi, materi,
              poin akademik, EXP, dan daily login streak mahasiswa.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {[
              {
                icon: BookOpen,
                title: 'Materi & Tugas Terstruktur',
                desc: 'Modul pembelajaran Google Drive berurutan dengan progres individual.',
              },
              {
                icon: Flame,
                title: 'Daily Login Streak & EXP',
                desc: 'Konsistensi harian membangun level dan membuka pencapaian belajar.',
              },
              {
                icon: Trophy,
                title: 'Leaderboard Kelas & Prodi',
                desc: 'Kompetisi akademik sehat berbasis poin kehadiran, tugas, dan diskusi.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="bg-white/90 border border-[#DDE6C9] rounded-[22px] p-4 flex items-start gap-3.5"
                >
                  <div className="w-10 h-10 rounded-full bg-[#B5D45D] text-[#181A17] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#181A17]">{item.title}</div>
                    <div className="text-xs text-[#73796C] mt-0.5">{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Authentication Card with Dual Login Mode (Mahasiswa & Admin) */}
        <div className="lg:col-span-6 bg-white border border-[#DDE6C9] rounded-[30px] p-8 sm:p-10 shadow-[0_4px_20px_rgba(24,26,23,0.03)] flex flex-col justify-center">
          {/* 2-Portal Role Switcher */}
          <div
            role="tablist"
            aria-label="Pilih Portal Masuk"
            className="grid grid-cols-2 gap-1.5 p-1.5 rounded-full bg-[#F0F8E0] border border-[#DDE6C9] mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginTab === 'student'}
              onClick={() => handleSwitchTab('student')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                loginTab === 'student'
                  ? 'bg-[#181A17] text-white shadow-sm'
                  : 'text-[#73796C] hover:text-[#181A17]'
              }`}
            >
              <GraduationCap
                className={`w-4 h-4 ${
                  loginTab === 'student' ? 'text-[#B5D45D]' : 'text-[#73796C]'
                }`}
              />
              <span>Login Mahasiswa</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginTab === 'admin'}
              onClick={() => handleSwitchTab('admin')}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                loginTab === 'admin'
                  ? 'bg-[#181A17] text-white shadow-sm'
                  : 'text-[#73796C] hover:text-[#181A17]'
              }`}
            >
              <ShieldCheck
                className={`w-4 h-4 ${
                  loginTab === 'admin' ? 'text-[#B5D45D]' : 'text-[#73796C]'
                }`}
              />
              <span>Login Admin</span>
            </button>
          </div>

          {loginTab === 'student' ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-[#181A17] text-xs font-semibold mb-3">
                  <GraduationCap className="w-3.5 h-3.5 text-[#3D914C]" />
                  <span>Portal Mahasiswa</span>
                </div>
                <h2 className="text-2xl font-bold text-[#181A17]">Masuk sebagai Mahasiswa</h2>
                <p className="text-sm text-[#73796C] mt-1.5">
                  Gunakan NIM dan password Anda untuk mengakses kelas, tugas, materi, EXP, dan leaderboard.
                </p>
              </div>

              {(serverError || error) && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FCECEF] text-xs text-[#C44750] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleRoleLogin(e, 'student')} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#181A17] mb-1.5">
                    NIM / Username Mahasiswa
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#73796C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={studentIdentifier}
                      onChange={(e) => setStudentIdentifier(e.target.value)}
                      placeholder="Contoh: 230101001"
                      className="w-full pl-11 pr-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl focus:outline-none focus:border-[#B5D45D]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#181A17] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#73796C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="Masukkan password mahasiswa"
                      className="w-full pl-11 pr-11 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl focus:outline-none focus:border-[#B5D45D]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73796C] hover:text-[#181A17]"
                      aria-label="Tampilkan password"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#181A17] hover:bg-[#2c302a] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Memverifikasi...' : 'Masuk Mahasiswa'}</span>
                  <ArrowRight className="w-4 h-4 text-[#B5D45D]" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#DDE6C9] text-xs text-[#73796C] leading-relaxed">
                Akun mahasiswa dibuat oleh Administrator. Pada login pertama, mahasiswa menggunakan{' '}
                <span className="font-bold text-[#181A17]">NIM</span> sebagai username dan password awal.
              </div>
            </>
          ) : !adminProvisioned ? (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold w-fit mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Aktivasi Awal Administrator Utama</span>
              </div>
              <h2 className="text-2xl font-bold text-[#181A17]">Buat Sandi Verifikasi Admin</h2>
              <p className="text-sm text-[#73796C] mt-1.5 leading-relaxed">
                IT AZRIL CLAS hanya memiliki satu administrator utama. Buat sandi atau kode verifikasi
                untuk mengaktifkan akses dashboard admin.
              </p>

              {(serverError || error) && (
                <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FCECEF] text-xs text-[#C44750] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={handleBootstrapAdmin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#181A17] mb-1.5">
                    Nama Administrator
                  </label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Contoh: Azril Administrator"
                    className="w-full px-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl focus:outline-none focus:border-[#B5D45D]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#181A17] mb-1.5">
                    Sandi / Kode Verifikasi Admin (min. 6 karakter)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#73796C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Buat sandi / kode verifikasi admin"
                      className="w-full pl-11 pr-11 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl focus:outline-none focus:border-[#B5D45D]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73796C] hover:text-[#181A17]"
                      aria-label="Tampilkan sandi"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#181A17] hover:bg-[#2c302a] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Mengaktifkan...' : 'Aktifkan Akses Admin'}</span>
                  <ArrowRight className="w-4 h-4 text-[#B5D45D]" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DBECB8] text-[#3D914C] text-xs font-semibold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verifikasi Administrator Utama</span>
                </div>
                <h2 className="text-2xl font-bold text-[#181A17]">Masukkan Sandi Admin</h2>
                <p className="text-sm text-[#73796C] mt-1.5">
                  Akses portal admin hanya memerlukan sandi atau kode verifikasi Administrator Utama tanpa perlu memasukkan email.
                </p>
              </div>

              {(serverError || error) && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#FCECEF] text-xs text-[#C44750] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || serverError}</span>
                </div>
              )}

              <form onSubmit={(e) => handleRoleLogin(e, 'admin')} className="space-y-4">
                <div className="p-4 rounded-[22px] bg-[#F0F8E0] border border-[#DDE6C9]">
                  <label className="block text-xs font-semibold text-[#181A17] mb-2">
                    Sandi / Kode Verifikasi Administrator
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#3D914C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={adminPasscode}
                      onChange={(e) => setAdminPasscode(e.target.value)}
                      placeholder="Masukkan sandi atau kode verifikasi"
                      className="w-full pl-11 pr-11 py-3 text-base font-semibold tracking-wider bg-white border border-[#DDE6C9] rounded-2xl focus:outline-none focus:border-[#B5D45D]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73796C] hover:text-[#181A17]"
                      aria-label="Tampilkan sandi"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-[#181A17] hover:bg-[#2c302a] text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk Admin'}</span>
                  <ArrowRight className="w-4 h-4 text-[#B5D45D]" />
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#DDE6C9] text-xs text-[#73796C] leading-relaxed space-y-1.5">
                <div>
                  Portal ini dilindungi kode verifikasi tunggal khusus{' '}
                  <span className="font-bold text-[#181A17]">Administrator Utama</span>.
                </div>
                {adminManagedByEnv && (
                  <div>
                    Sandi verifikasi dikelola melalui variabel server{' '}
                    <span className="font-bold text-[#181A17]">ADMIN_PASSWORD</span>.
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
