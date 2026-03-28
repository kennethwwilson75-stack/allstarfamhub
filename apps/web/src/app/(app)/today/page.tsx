'use client';

import { useQuery } from '@tanstack/react-query';
import { format, startOfDay, endOfDay, startOfTomorrow } from 'date-fns';
import { Calendar, Bell, Sun, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/Card';
import { EventCard } from '@/components/EventCard';
import { AlertCard } from '@/components/AlertCard';
import type { FamilyEvent, Alert, FamilyMember } from '@allstarfamhub/shared';

interface EventWithMembers extends FamilyEvent {
  members?: FamilyMember[];
  sourceConnectorId?: string;
}

export default function TodayPage() {
  const today = new Date();

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'today'],
    queryFn: async () => {
      const { data } = await api.get<EventWithMembers[]>('/events', {
        start: startOfDay(today).toISOString(),
        end: endOfDay(today).toISOString(),
      });
      return data;
    },
  });

  const { data: tomorrowEvents } = useQuery({
    queryKey: ['events', 'tomorrow'],
    queryFn: async () => {
      const tomorrow = startOfTomorrow();
      const { data } = await api.get<EventWithMembers[]>('/events', {
        start: tomorrow.toISOString(),
        end: endOfDay(tomorrow).toISOString(),
      });
      return data;
    },
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', 'recent'],
    queryFn: async () => {
      const { data } = await api.get<Alert[]>('/alerts', { unread: true, limit: 5 });
      return data;
    },
  });

  async function handleMarkRead(alertId: string) {
    await api.patch(`/alerts/${alertId}`, { readAt: new Date().toISOString() });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sun className="h-7 w-7 text-accent" />
          Today
        </h1>
        <p className="text-gray-500 mt-1">{format(today, 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Events */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Calendar className="h-5 w-5 inline mr-2 text-primary" />
                  Today&apos;s Schedule
                </CardTitle>
                <Link
                  href="/calendar"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  View calendar <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardHeader>

            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    title={event.title}
                    startAt={event.startAt as unknown as string}
                    endAt={event.endAt as unknown as string | null}
                    allDay={event.allDay}
                    location={event.location}
                    memberName={event.members?.[0]?.displayName}
                    memberColor={event.members?.[0]?.color}
                    source={event.sourceConnectorId}
                    status={event.status}
                    priority={event.priority}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No events scheduled for today</p>
                <p className="text-xs mt-1">Enjoy your free day!</p>
              </div>
            )}
          </Card>

          {/* Tomorrow Preview */}
          {tomorrowEvents && tomorrowEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tomorrow</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {tomorrowEvents.slice(0, 3).map((event) => (
                  <EventCard
                    key={event.id}
                    title={event.title}
                    startAt={event.startAt as unknown as string}
                    endAt={event.endAt as unknown as string | null}
                    allDay={event.allDay}
                    location={event.location}
                    memberName={event.members?.[0]?.displayName}
                    memberColor={event.members?.[0]?.color}
                    source={event.sourceConnectorId}
                    status={event.status}
                    priority={event.priority}
                  />
                ))}
                {tomorrowEvents.length > 3 && (
                  <p className="text-sm text-gray-400 text-center pt-2">
                    +{tomorrowEvents.length - 3} more events
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Alerts Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Bell className="h-5 w-5 inline mr-2 text-accent" />
                  Recent Alerts
                </CardTitle>
                <Link
                  href="/alerts"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CardHeader>

            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    type={alert.type}
                    title={alert.title}
                    body={alert.body}
                    priority={alert.priority}
                    createdAt={alert.createdAt as unknown as string}
                    readAt={alert.readAt as unknown as string | null}
                    onRead={() => handleMarkRead(alert.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No new alerts</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
