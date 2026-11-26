import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Search } from 'lucide-react';

interface CardProps {
  children: ReactNode;
  variant?: 'white' | 'soft' | 'dark' | 'elevated' | 'obsidian';
  className?: string;
}

export function Card({ children, variant = 'white', className = '' }: CardProps) {
  const base =
    variant === 'soft'
      ? 'rounded-[24px] bg-[#DCECB8] border border-[#D5E4B6] text-[#20251D]'
      : variant === 'dark'
        ? 'rounded-[26px] bg-[#171A17] border border-[#232822] text-white'
        : variant === 'elevated'
          ? 'rounded-[26px] bg-[#232822] border border-[#232822] text-white'
          : variant === 'obsidian'
            ? 'rounded-[26px] bg-[#101210] border border-[#232822] text-white'
            : 'rounded-[24px] bg-white border border-[#D5E4B6] text-[#20251D]';

  return <div className={`p-5 tablet:p-6 ${base} ${className}`}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: ReactNode;
  variant?: 'white' | 'soft' | 'dark';
}

export function StatCard({ label, value, sublabel, icon, variant = 'white' }: StatCardProps) {
  const isDark = variant === 'dark';
  const containerCls = isDark
    ? 'rounded-[26px] bg-[#171A17] border border-[#232822] text-white'
    : variant === 'soft'
      ? 'rounded-[24px] bg-[#DCECB8] border border-[#D5E4B6] text-[#20251D]'
      : 'rounded-[24px] bg-white border border-[#D5E4B6] text-[#20251D] hover:border-[#B5D45D]';

  return (
    <div
      className={`p-5 tablet:p-6 flex items-start justify-between gap-4 transition-all duration-150 ${containerCls}`}
    >
      <div className="min-w-0">
        <div
          className={`text-xs font-medium ${
            isDark ? 'text-[#DCECB8]/80' : 'text-[#6F7B68]'
          }`}
        >
          {label}
        </div>
        <div
          className={`font-display text-2xl tablet:text-3xl font-bold tabular-nums tracking-tight mt-2 ${
            isDark ? 'text-white' : 'text-[#20251D]'
          }`}
        >
          {value}
        </div>
        {sublabel && (
          <div
            className={`text-xs mt-1.5 ${
              isDark ? 'text-[#B5D45D]' : 'text-[#4E5849]'
            }`}
          >
            {sublabel}
          </div>
        )}
      </div>
      <div
        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
          isDark
            ? 'bg-[#232822] text-[#B5D45D] border border-[#B5D45D]/20'
            : variant === 'soft'
              ? 'bg-white text-[#20251D] border border-[#D5E4B6]'
              : 'bg-[#F0F8DF] text-[#20251D] border border-[#D5E4B6]'
        }`}
      >
        {icon}
      </div>
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'dark' | 'outline' | 'danger';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const sizeCls = size === 'sm' ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-sm';
  const variantCls =
    variant === 'dark'
      ? 'bg-[#171A17] text-white hover:bg-[#232822]'
      : variant === 'secondary'
        ? 'bg-[#DCECB8] text-[#20251D] border border-[#D5E4B6] hover:bg-[#C5E370]'
        : variant === 'outline'
          ? 'bg-white border border-[#D5E4B6] text-[#4E5849] hover:text-[#20251D] hover:border-[#B5D45D] hover:bg-[#F0F8DF]/60'
          : variant === 'danger'
            ? 'bg-[#D13447] text-white hover:bg-[#b82a3b]'
            : 'bg-[#B5D45D] text-[#171A17] hover:bg-[#C5E370]';

  return (
    <button
      {...props}
      className={`font-display inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeCls} ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all duration-150 ${className}`}
    />
  );
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`px-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all duration-150 ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all duration-150 ${className}`}
    />
  );
}

export function ProgressBar({
  percent,
  height = 'h-2.5',
  trackClass = 'bg-[#F0F8DF]',
  fillClass = 'bg-[#B5D45D]',
  darkTrack = false,
}: {
  percent: number;
  height?: string;
  trackClass?: string;
  fillClass?: string;
  darkTrack?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const resolvedTrack = darkTrack ? 'bg-[#232822] border-[#232822]' : `${trackClass} border-[#D5E4B6]/70`;
  return (
    <div className={`w-full ${height} ${resolvedTrack} rounded-full overflow-hidden border`}>
      <div
        className={`h-full ${fillClass} rounded-full transition-all duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Cari...',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-[#6F7B68] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#D5E4B6] rounded-[16px] text-[#20251D] placeholder:text-[#6F7B68] focus:outline-none focus:border-[#B5D45D] focus:ring-2 focus:ring-[#B5D45D]/25 transition-all duration-150"
      />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col tablet:flex-row tablet:items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl desktop:text-[26px] font-bold tracking-tight text-[#20251D]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[#4E5849] mt-1 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ id: T; label: string; icon?: ReactNode }>;
  value: T;
  onChange: (val: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 p-1.5 rounded-full bg-white border border-[#D5E4B6] ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`font-display inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs tablet:text-sm font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
              active
                ? 'bg-[#171A17] text-[#B5D45D]'
                : 'text-[#4E5849] hover:text-[#20251D] hover:bg-[#F0F8DF]'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-white border border-[#D5E4B6] px-6 py-12 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-2xl bg-[#F0F8DF] border border-[#D5E4B6] text-[#4E5849] flex items-center justify-center mb-3.5">
        {icon}
      </div>
      <div className="font-display text-sm font-bold text-[#20251D]">{title}</div>
      {description && (
        <p className="text-xs text-[#6F7B68] mt-1 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
