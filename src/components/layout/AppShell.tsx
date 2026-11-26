import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  ClipboardList,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  ShieldCheck,
  Coins,
  Trophy,
  Flame,
  Sparkles,
  Bell,
  Settings,
  LogOut,
  Search,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { BrandLogo, StreakFlame } from '../ui/BrandLogo.tsx';
import type { AuthUser } from '../../types/index.ts';

export type NavRoute =
  | 'dashboard'
  | 'programs'
  | 'classes'
  | 'students'
  | 'student-detail'
  | 'assignments'
  | 'materials'
  | 'attendance'
  | 'excel-import'
  | 'student-status'
  | 'points'
  | 'leaderboard'
  | 'streak'
  | 'exp'
  | 'notifications'
  | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

interface AppShellProps {
  user: AuthUser;
  activeRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  onRefresh: () => void;
  onGlobalSearch: (q: string) => void;
  unreadNotifications: number;
  onLogout: () => void;
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  children: ReactNode;
}

const ADMIN_NAV: Array<{ id: NavRoute; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'students', label: 'Mahasiswa', icon: Users },
  { id: 'programs', label: 'Program Studi', icon: Building2 },
  { id: 'classes', label: 'Kelas', icon: Layers },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList },
  { id: 'materials', label: 'Materi', icon: BookOpen },
  { id: 'attendance', label: 'Absensi', icon: CalendarCheck },
  { id: 'excel-import', label: 'Import Excel', icon: FileSpreadsheet },
  { id: 'student-status', label: 'Status', icon: ShieldCheck },
  { id: 'points', label: 'Poin', icon: Coins },
  { id: 'exp', label: 'XP Aktif', icon: Sparkles },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'notifications', label: 'Notifikasi', icon: Bell },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const STUDENT_NAV: Array<{ id: NavRoute; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'attendance', label: 'Absensi', icon: CalendarCheck },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList },
  { id: 'materials', label: 'Materi', icon: BookOpen },
  { id: 'exp', label: 'XP Aktif', icon: Sparkles },
  { id: 'streak', label: 'Streak', icon: Flame },
  { id: 'leaderboard', label: 'Ranking', icon: Trophy },
  { id: 'notifications', label: 'Notifikasi', icon: Bell },
];

const STUDENT_BOTTOM_NAV: Array<{ id: NavRoute; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'attendance', label: 'Absensi', icon: CalendarCheck },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList },
  { id: 'exp', label: 'XP', icon: Sparkles },
  { id: 'leaderboard', label: 'Ranking', icon: Trophy },
];

const ADMIN_BOTTOM_NAV: Array<{ id: NavRoute; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
  { id: 'students', label: 'Mahasiswa', icon: Users },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList },
  { id: 'attendance', label: 'Absensi', icon: CalendarCheck },
  { id: 'points', label: 'Poin', icon: Coins },
];

const ROUTE_TITLES: Record<NavRoute, string> = {
  dashboard: 'Dashboard',
  programs: 'Program Studi',
  classes: 'Kelas',
  students: 'Mahasiswa',
  'student-detail': 'Detail Mahasiswa',
  assignments: 'Tugas',
  materials: 'Materi Pembelajaran',
  attendance: 'Absensi',
  'excel-import': 'Import Excel',
  'student-status': 'Status Mahasiswa',
  points: 'Poin Akademik',
  leaderboard: 'Leaderboard',
  streak: 'Daily Login Streak',
  exp: 'XP Aktif & Level',
  notifications: 'Notifikasi',
  settings: 'Pengaturan Sistem',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'IT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  user,
  activeRoute,
  onNavigate,
  onRefresh,
  onGlobalSearch,
  unreadNotifications,
  onLogout,
  toasts,
  onDismissToast,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const navItems = user.role === 'admin' ? ADMIN_NAV : STUDENT_NAV;
  const bottomItems = user.role === 'admin' ? ADMIN_BOTTOM_NAV : STUDENT_BOTTOM_NAV;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGlobalSearch(searchInput.trim());
  };

  const isItemActive = (itemId: NavRoute) =>
    activeRoute === itemId || (itemId === 'students' && activeRoute === 'student-detail');

  const renderFullDarkSidebar = (isDrawer: boolean) => (
    <div className="flex flex-col h-full bg-[#171A17] text-white border-r border-[#232822]">
      <div className="px-5 py-5 border-b border-[#232822] flex items-center justify-between gap-2">
        <BrandLogo darkSurface />
        {isDrawer && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="p-2 rounded-full text-[#DCECB8]/70 hover:text-white hover:bg-[#232822] transition-colors cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav
        aria-label="Menu navigasi utama"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setDrawerOpen(false);
              }}
              className={`font-display w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#B5D45D] text-[#171A17]'
                  : 'text-[#DCECB8]/80 hover:text-white hover:bg-[#232822]'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    active ? 'bg-[#171A17]/10 text-[#171A17]' : 'bg-[#232822] text-[#B5D45D]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'notifications' && unreadNotifications > 0 && (
                <span
                  className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full ${
                    active
                      ? 'bg-[#171A17] text-[#B5D45D]'
                      : 'bg-[#B5D45D] text-[#171A17]'
                  }`}
                >
                  {unreadNotifications}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#232822] space-y-2">
        {user.role === 'student' && user.student && (
          <button
            type="button"
            onClick={() => {
              onNavigate('streak');
              setDrawerOpen(false);
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-[18px] bg-[#232822] border border-[#232822] hover:border-[#B5D45D]/40 transition-colors cursor-pointer"
          >
            <StreakFlame
              days={user.student.current_streak ?? 0}
              size="sm"
              darkSurface
            />
            <span className="font-display text-xs font-bold text-[#B5D45D] tabular-nums">
              Lv.{user.student.current_level}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="font-display w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13px] font-semibold text-[#DCECB8]/75 hover:text-[#D13447] hover:bg-[#D13447]/15 transition-colors whitespace-nowrap cursor-pointer"
        >
          <span className="w-7 h-7 rounded-full bg-[#232822] flex items-center justify-center shrink-0">
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <span>Keluar Akun</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F8DF] text-[#20251D] flex">
      {/* Desktop Permanent Dark Sidebar (240px, >=840px) */}
      <aside className="hidden desktop:block w-[240px] shrink-0 sticky top-0 h-screen">
        {renderFullDarkSidebar(false)}
      </aside>

      {/* Tablet Navigation Rail (600px–839px) */}
      <aside className="hidden tablet:flex desktop:hidden w-[76px] shrink-0 sticky top-0 h-screen flex-col items-center bg-[#171A17] text-white border-r border-[#232822] py-4 justify-between">
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <BrandLogo compact darkSurface />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full bg-[#232822] text-[#DCECB8] hover:text-[#B5D45D] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Buka seluruh menu"
            title="Semua Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav
          aria-label="Navigasi rail tablet"
          className="flex-1 overflow-y-auto w-full px-2 py-4 flex flex-col items-center gap-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => onNavigate(item.id)}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#B5D45D] text-[#171A17]'
                    : 'text-[#DCECB8]/75 hover:text-white hover:bg-[#232822]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.1} aria-hidden="true" />
                {item.id === 'notifications' && unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF7A1A] text-white text-[9px] font-bold tabular-nums flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-2">
          <button
            type="button"
            onClick={onLogout}
            title="Keluar Akun"
            aria-label="Keluar Akun"
            className="w-11 h-11 rounded-full bg-[#232822] text-[#DCECB8]/75 hover:text-[#D13447] hover:bg-[#D13447]/15 flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Mobile & Tablet Full Menu Slide-Over Drawer (<840px) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 desktop:hidden flex">
          <div
            className="fixed inset-0 bg-[#101210]/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative w-[264px] max-w-[85vw] h-full z-50 animate-page-enter">
            {renderFullDarkSidebar(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Editorial Topbar */}
        <header className="sticky top-0 z-30 bg-[#F0F8DF]/90 backdrop-blur-md border-b border-[#D5E4B6] px-[18px] tablet:px-6 desktop:px-[28px] h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="desktop:hidden p-2 rounded-full bg-white border border-[#D5E4B6] text-[#20251D] hover:border-[#B5D45D] transition-colors cursor-pointer shrink-0"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="shrink-0">
              <BrandLogo compact size="sm" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-base tablet:text-lg font-bold text-[#20251D] truncate">
                {ROUTE_TITLES[activeRoute]}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user.role === 'admin' && (
              <form onSubmit={handleSearchSubmit} className="hidden tablet:flex items-center relative">
                <Search className="w-4 h-4 text-[#6F7B68] absolute left-3.5 pointer-events-none" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama atau NIM..."
                  className="pl-9 pr-4 py-2 text-sm bg-white border border-[#D5E4B6] rounded-[16px] w-48 desktop:w-60 text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] transition-colors"
                />
              </form>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-full bg-white border border-[#D5E4B6] text-[#4E5849] hover:text-[#20251D] hover:border-[#B5D45D] transition-colors cursor-pointer"
              aria-label="Segarkan data"
              title="Segarkan data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="relative p-2.5 rounded-full bg-white border border-[#D5E4B6] text-[#4E5849] hover:text-[#20251D] hover:border-[#B5D45D] transition-colors cursor-pointer"
              aria-label="Notifikasi"
              title="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#171A17] text-[#B5D45D] text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            <div className="hidden tablet:flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full bg-white border border-[#D5E4B6]">
              <div className="w-7 h-7 rounded-full bg-[#DCECB8] text-[#20251D] text-xs font-display font-bold flex items-center justify-center shrink-0">
                {getInitials(user.full_name)}
              </div>
              <div className="text-left min-w-0 max-w-[140px]">
                <div className="font-display text-xs font-bold text-[#20251D] truncate leading-tight">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-[#6F7B68] truncate leading-tight">
                  {user.role === 'admin'
                    ? 'Administrator'
                    : `NIM ${user.student?.nim ?? user.username}`}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport: Mobile 18px, Tablet 24px, Desktop 28px; mobile clearance pb-32 */}
        <main className="flex-1 p-[18px] tablet:p-6 desktop:p-[28px] pb-32 tablet:pb-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Floating Pill Bottom Navigation (<600px, max 5 core items) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="tablet:hidden fixed bottom-3.5 left-3.5 right-3.5 z-40 bg-[#171A17] text-white border border-[#232822] rounded-full px-2 py-1.5 shadow-[0_8px_24px_rgba(16,18,16,0.2)] flex items-center justify-around"
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`font-display flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-full transition-all duration-150 min-w-[54px] cursor-pointer ${
                active ? 'bg-[#B5D45D] text-[#171A17]' : 'text-[#DCECB8]/75 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2.1} />
              <span className="text-[10px] font-semibold whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notifications */}
      <div className="fixed bottom-24 tablet:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 tablet:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-enter pointer-events-auto flex items-start gap-2.5 px-4 py-3.5 rounded-[20px] border text-sm ${
              t.type === 'success'
                ? 'bg-white border-[#D5E4B6] text-[#20251D]'
                : 'bg-[#FFF5F6] border-[#D13447]/35 text-[#D13447]'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#3E7B27]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D13447]" />
            )}
            <span className="flex-1 font-medium">{t.text}</span>
            <button
              type="button"
              onClick={() => onDismissToast(t.id)}
              className="text-[#6F7B68] hover:text-[#20251D] cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
