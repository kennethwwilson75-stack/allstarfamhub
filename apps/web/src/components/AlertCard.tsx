'use client';

import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  MapPin,
  Clock,
  BookOpen,
  Bell,
  XCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertType, Priority } from '@allstarfamhub/shared';

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  EVENT_ADDED: Calendar,
  EVENT_CHANGED: Info,
  EVENT_CANCELLED: XCircle,
  LOCATION_CHANGED: MapPin,
  TIME_CHANGED: Clock,
  DEADLINE_TOMORROW: AlertTriangle,
  DEADLINE_TODAY: AlertTriangle,
  GRADE_POSTED: BookOpen,
  SIGNUP_NEEDED: Bell,
  SYNC_ERROR: AlertTriangle,
  CONFLICT_DETECTED: AlertTriangle,
};

interface AlertCardProps {
  type: AlertType;
  title: string;
  body: string;
  priority: Priority;
  createdAt: string;
  readAt?: string | null;
  onRead?: () => void;
  onDismiss?: () => void;
}

export function AlertCard({
  type,
  title,
  body,
  priority,
  createdAt,
  readAt,
  onRead,
  onDismiss,
}: AlertCardProps) {
  const Icon = ALERT_ICONS[type] ?? Bell;
  const isUnread = !readAt;
  const isUrgent = priority === 'URGENT' || priority === 'HIGH';

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        isUnread ? 'bg-white border-primary/20' : 'bg-gray-50 border-gray-200',
        isUrgent && isUnread && 'border-accent/40 bg-amber-50/50',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg flex-shrink-0',
            isUrgent ? 'bg-accent/10 text-accent' : 'bg-primary-light text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn('text-sm font-medium', isUnread && 'font-semibold')}>
              {title}
            </h4>
            {isUnread && (
              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{body}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </span>
            {isUnread && onRead && (
              <button
                onClick={onRead}
                className="text-xs text-primary hover:underline"
              >
                Mark read
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
