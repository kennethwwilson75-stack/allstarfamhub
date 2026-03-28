'use client';

import { format } from 'date-fns';
import { X, MapPin, Clock, Calendar, ExternalLink, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceBadge } from './SourceBadge';
import { Button } from './Button';

interface EventDetail {
  id: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  location?: string | null;
  locationUrl?: string | null;
  eventType?: string;
  status?: string;
  priority?: string;
  source?: string;
  memberName?: string;
  memberColor?: string;
  signupUrl?: string | null;
  requiresSignup?: boolean;
}

interface EventDetailDrawerProps {
  event: EventDetail | null;
  open: boolean;
  onClose: () => void;
}

export function EventDetailDrawer({ event, open, onClose }: EventDetailDrawerProps) {
  if (!event) return null;

  const start = new Date(event.startAt);
  const isCancelled = event.status === 'CANCELLED';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={onClose} />
      )}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Event Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100%-65px)]">
          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {event.source && <SourceBadge source={event.source} />}
              {isCancelled && (
                <span className="text-xs font-medium text-danger bg-red-50 px-2 py-0.5 rounded">
                  Cancelled
                </span>
              )}
            </div>
            <h3
              className={cn(
                'text-xl font-semibold',
                isCancelled && 'line-through text-gray-400',
              )}
            >
              {event.title}
            </h3>
          </div>

          {/* Date/Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{format(start, 'EEEE, MMMM d, yyyy')}</p>
              {!event.allDay && (
                <p className="text-sm text-gray-500">
                  <Clock className="h-3.5 w-3.5 inline mr-1" />
                  {format(start, 'h:mm a')}
                  {event.endAt && ` - ${format(new Date(event.endAt), 'h:mm a')}`}
                </p>
              )}
              {event.allDay && (
                <p className="text-sm text-gray-500">All day</p>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm">{event.location}</p>
                {event.locationUrl && (
                  <a
                    href={event.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                  >
                    View map <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Member */}
          {event.memberName && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gray-400" />
              <span
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full"
                style={{
                  backgroundColor: `${event.memberColor ?? '#1D9E75'}20`,
                  color: event.memberColor ?? '#1D9E75',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: event.memberColor ?? '#1D9E75' }}
                />
                {event.memberName}
              </span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Description</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Signup */}
          {event.requiresSignup && event.signupUrl && (
            <a
              href={event.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary" className="w-full">
                Sign Up <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </>
  );
}
