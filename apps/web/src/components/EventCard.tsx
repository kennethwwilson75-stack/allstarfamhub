'use client';

import { format } from 'date-fns';
import { MapPin, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceBadge } from './SourceBadge';

interface EventCardProps {
  title: string;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  location?: string | null;
  memberName?: string;
  memberColor?: string;
  source?: string;
  status?: string;
  priority?: string;
  onClick?: () => void;
}

export function EventCard({
  title,
  startAt,
  endAt,
  allDay,
  location,
  memberName,
  memberColor = '#1D9E75',
  source,
  status,
  priority,
  onClick,
}: EventCardProps) {
  const start = new Date(startAt);
  const isCancelled = status === 'CANCELLED';
  const isUrgent = priority === 'URGENT' || priority === 'HIGH';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all hover:shadow-md',
        isCancelled
          ? 'bg-red-50 border-danger/30 opacity-75'
          : 'bg-white border-gray-200 hover:border-primary/30',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
          style={{ backgroundColor: memberColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isUrgent && <AlertTriangle className="h-3.5 w-3.5 text-accent flex-shrink-0" />}
            <h4
              className={cn(
                'text-sm font-medium truncate',
                isCancelled && 'line-through text-gray-500',
              )}
            >
              {title}
            </h4>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {allDay
                ? format(start, 'MMM d')
                : format(start, 'h:mm a')}
              {endAt && !allDay && ` - ${format(new Date(endAt), 'h:mm a')}`}
            </span>
            {location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            {memberName && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${memberColor}20`, color: memberColor }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: memberColor }}
                />
                {memberName}
              </span>
            )}
            {source && <SourceBadge source={source} />}
            {isCancelled && (
              <span className="text-xs text-danger font-medium">Cancelled</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
