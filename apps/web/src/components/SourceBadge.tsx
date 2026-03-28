import { cn } from '@/lib/utils';

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  canvas: { bg: 'bg-red-100', text: 'text-red-700' },
  'infinite-campus': { bg: 'bg-blue-100', text: 'text-blue-700' },
  parentsquare: { bg: 'bg-purple-100', text: 'text-purple-700' },
  sportsyou: { bg: 'bg-green-100', text: 'text-green-700' },
  'google-classroom': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  remind: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  manual: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const SOURCE_LABELS: Record<string, string> = {
  canvas: 'Canvas',
  'infinite-campus': 'IC',
  parentsquare: 'ParentSquare',
  sportsyou: 'SportsYou',
  'google-classroom': 'Classroom',
  remind: 'Remind',
  manual: 'Manual',
};

interface SourceBadgeProps {
  source: string;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const colors = SOURCE_COLORS[source] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
  const label = SOURCE_LABELS[source] ?? source;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        colors.bg,
        colors.text,
        className,
      )}
    >
      {label}
    </span>
  );
}
