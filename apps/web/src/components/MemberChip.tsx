'use client';

import { cn } from '@/lib/utils';

interface MemberChipProps {
  name: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function MemberChip({ name, color, active = false, onClick, size = 'md' }: MemberChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors',
        active
          ? 'bg-opacity-20 border-current'
          : 'bg-white border-gray-200 hover:border-gray-300',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
      style={active ? { backgroundColor: `${color}20`, borderColor: color, color } : undefined}
    >
      <span
        className="inline-block rounded-full"
        style={{
          backgroundColor: color,
          width: size === 'sm' ? '8px' : '10px',
          height: size === 'sm' ? '8px' : '10px',
        }}
      />
      {name}
    </button>
  );
}
