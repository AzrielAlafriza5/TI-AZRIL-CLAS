import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Search } from 'lucide-react';

interface CardProps {
  children: ReactNode;
  variant?: 'white' | 'soft' | 'dark';
  className?: string;
}

export function Card({ children, variant = 'white', className = '' }: CardProps) {
  const base =
    variant === 'soft'
      ? 'bg-[#DBECB8] border border-[#DDE6C9] text-[#181A17]'
      : variant === 'dark'
        ? 'bg-[#181A17] border border-[#181A17] text-white'
        : 'bg-white border border-[#DDE6C9] text-[#181A17]';

  return (
    <div
      className={`rounded-[26px] shadow-[0_4px_20px_rgba(24,26,23,0.03)] p-6 ${base} ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: ReactNode;
  variant?: 'white' | 'soft';
}

export function StatCard({ label, value, sublabel, icon, variant = 'white' }: StatCardProps) {
  return (
    <div
      className={`rounded-[26px] border border-[#DDE6C9] p-6 shadow-[0_4px_20px_rgba(24,26,23,0.03)] flex items-start justify-between gap-4 transition-transform duration-200 hover:-translate-y-0.5 ${
        variant === 'soft' ? 'bg-[#DBECB8]' : 'bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-medium text-[#73796C]">{label}</div>
        <div className="text-3xl font-bold text-[#181A17] tabular-nums tracking-tight mt-2">
          {value}
        </div>
        {sublabel && <div className="text-xs text-[#73796C] mt-2">{sublabel}</div>}
      </div>
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
          variant === 'soft' ? 'bg-white text-[#181A17]' : 'bg-[#DBECB8] text-[#181A17]'
        }`}
      >
        {icon}
      </div>
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
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
    variant === 'secondary'
      ? 'bg-[#B5D45D] text-[#181A17] hover:bg-[#a7c84d]'
      : variant === 'outline'
        ? 'bg-transparent border border-[#DDE6C9] text-[#73796C] hover:text-[#181A17] hover:border-[#B5D45D] hover:bg-white'
        : variant === 'danger'
          ? 'bg-[#C44750] text-white hover:bg-[#b03c45]'
          : 'bg-[#181A17] text-white hover:bg-[#2c302a]';

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer ${sizeCls} ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl text-[#181A17] placeholder:text-[#73796C] focus:outline-none focus:border-[#B5D45D] transition-colors ${className}`}
    />
  );
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`px-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl text-[#181A17] focus:outline-none focus:border-[#B5D45D] transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-2xl text-[#181A17] placeholder:text-[#73796C] focus:outline-none focus:border-[#B5D45D] transition-colors ${className}`}
    />
  );
}

export function ProgressBar({
  percent,
  height = 'h-2.5',
  trackClass = 'bg-[#F0F8E0]',
  fillClass = 'bg-[#B5D45D]',
}: {
  percent: number;
  height?: string;
  trackClass?: string;
  fillClass?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className={`w-full ${height} ${trackClass} rounded-full overflow-hidden border border-[#DDE6C9]/60`}>
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
      <Search className="w-4 h-4 text-[#73796C] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#DDE6C9] rounded-full text-[#181A17] placeholder:text-[#73796C] focus:outline-none focus:border-[#B5D45D] transition-colors"
      />
    </div>
  );
}
