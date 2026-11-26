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
  PanelLeftClose,
  PanelLeftOpen,
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
  { id: 'exp', label: 'XP Aktif', icon: Sparkles },
  { id: 'leaderboard', label: 'Ranking', icon: Trophy },
];

const ADMIN_BOTTOM_NAV: Array<{ id: NavRoute; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const navItems = user.role === 'admin' ? ADMIN_NAV : STUDENT_NAV;
  const bottomItems = user.role === 'admin' ? ADMIN_BOTTOM_NAV : STUDENT_BOTTOM_NAV;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGlobalSearch(searchInput.trim());
  };

  const renderSidebar = (isMobileDrawer: boolean) => {
    const isCollapsed = !isMobileDrawer && collapsed;
    return (
      <div className="flex flex-col h-full bg-white border-r border-[#DDE6C9]">
        <div className={`px-5 py-5 border-b border-[#DDE6C9] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <BrandLogo compact={isCollapsed} />
          {!isMobileDrawer && !isCollapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-full text-[#73796C] hover:text-[#181A17] hover:bg-[#F0F8E0] transition-colors"
              aria-label="Ciutkan sidebar"
              title="Ciutkan sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <div className="pt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-full text-[#73796C] hover:text-[#181A17] hover:bg-[#F0F8E0] transition-colors"
              aria-label="Perluas sidebar"
              title="Perluas sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeRoute === item.id ||
              (item.id === 'students' && activeRoute === 'student-detail');
            return (
              <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
                } py-2.5 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#181A17] text-white'
                    : 'text-[#73796C] hover:text-[#181A17] hover:bg-[#DBECB8]/60'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#B5D45D]' : 'text-[#73796C]'
                    }`}
                    aria-hidden="true"
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!isCollapsed && item.id === 'notifications' && unreadNotifications > 0 && (
                  <span
                    className={`text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-[#B5D45D] text-[#181A17]'
                        : 'bg-[#181A17] text-[#B5D45D]'
                    }`}
                  >
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#DDE6C9] space-y-2">
          {!isCollapsed && user.role === 'student' && user.student && (
            <button
              type="button"
              onClick={() => {
                onNavigate('streak');
                setMobileOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-[#DBECB8]/70 border border-[#DDE6C9] hover:border-[#B5D45D] transition-colors"
            >
              <StreakFlame days={user.student.current_streak ?? 0} size="sm" />
              <span className="text-xs font-bold text-[#181A17] tabular-nums">
                Lv.{user.student.current_level}
              </span>
            </button>
          )}
          <button
            type="button"
            title={isCollapsed ? 'Keluar Akun' : undefined}
            onClick={onLogout}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
            } py-2.5 rounded-full text-sm font-medium text-[#73796C] hover:text-[#C44750] hover:bg-[#FCECEF] transition-colors whitespace-nowrap`}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!isCollapsed && <span>Keluar Akun</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F0F8E0] text-[#181A17] flex">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebar(false)}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#181A17]/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-50">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-3 p-2 rounded-full text-[#73796C] hover:bg-[#F0F8E0] z-10"
              aria-label="Tutup menu"
            >
              <X className="w-4 h-4" />
            </button>
            {renderSidebar(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#F0F8E0]/90 backdrop-blur-md border-b border-[#DDE6C9] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-full bg-white border border-[#DDE6C9] text-[#181A17]"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="lg:hidden shrink-0">
              <BrandLogo compact />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-[#181A17] truncate">
                {ROUTE_TITLES[activeRoute]}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {user.role === 'admin' && (
              <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative">
                <Search className="w-4 h-4 text-[#73796C] absolute left-4 pointer-events-none" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama atau NIM..."
                  className="pl-10 pr-4 py-2 text-sm bg-white border border-[#DDE6C9] rounded-full w-56 text-[#181A17] placeholder:text-[#73796C] focus:outline-none focus:border-[#B5D45D]"
                />
              </form>
            )}

            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 rounded-full bg-white border border-[#DDE6C9] text-[#73796C] hover:text-[#181A17] hover:border-[#B5D45D] transition-colors"
              aria-label="Segarkan halaman"
              title="Segarkan data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="relative p-2.5 rounded-full bg-white border border-[#DDE6C9] text-[#73796C] hover:text-[#181A17] hover:border-[#B5D45D] transition-colors"
              aria-label="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#181A17] text-[#B5D45D] text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full bg-white border border-[#DDE6C9]">
              <div className="w-7 h-7 rounded-full bg-[#DBECB8] text-[#181A17] text-xs font-bold flex items-center justify-center shrink-0">
                {getInitials(user.full_name)}
              </div>
              <div className="text-left min-w-0 max-w-[150px]">
                <div className="text-xs font-bold text-[#181A17] truncate leading-tight">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-[#73796C] truncate leading-tight">
                  {user.role === 'admin'
                    ? 'Administrator'
                    : `NIM ${user.student?.nim ?? user.username}`}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport with bottom clearance for mobile floating navigation */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-10 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation (#181A17) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#181A17] text-white rounded-[28px] px-2 py-2 shadow-[0_10px_30px_rgba(24,26,23,0.18)] flex items-center justify-around"
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-2xl transition-colors min-w-[56px] ${
                active ? 'bg-[#B5D45D] text-[#181A17]' : 'text-white/75 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-semibold whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notifications */}
      <div className="fixed bottom-24 lg:bottom-5 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3.5 rounded-[20px] border shadow-[0_8px_24px_rgba(24,26,23,0.08)] text-sm ${
              t.type === 'success'
                ? 'bg-white border-[#DDE6C9] text-[#181A17]'
                : 'bg-[#FCECEF] border-[#C44750]/30 text-[#C44750]'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#3D914C]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C44750]" />
            )}
            <span className="flex-1 font-medium">{t.text}</span>
            <button
              type="button"
              onClick={() => onDismissToast(t.id)}
              className="text-[#73796C] hover:text-[#181A17]"
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
