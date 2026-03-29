'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CalendarWrapper } from '@/components/CalendarWrapper';
import { EventDetailDrawer } from '@/components/EventDetailDrawer';
import { MemberChip } from '@/components/MemberChip';
import { Card } from '@/components/Card';
import type { FamilyEvent, FamilyMember } from '@allstarfamhub/shared';

interface EventWithMembers extends FamilyEvent {
  members?: FamilyMember[];
  sourceConnectorId?: string;
}

export default function CalendarPage() {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: members } = useQuery<FamilyMember[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const { data } = await api.get<FamilyMember[]>('/members');
      return data;
    },
  });

  const { data: events, isLoading } = useQuery<EventWithMembers[]>({
    queryKey: ['events', 'calendar', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return [];
      const { data } = await api.get<EventWithMembers[]>('/events', {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      });
      return data;
    },
    enabled: !!dateRange,
  });

  const filteredEvents = events?.filter((event: EventWithMembers) => {
    if (selectedMemberIds.size === 0) return true;
    return event.members?.some((m: FamilyMember) => selectedMemberIds.has(m.id));
  });

  const calendarEvents = (filteredEvents ?? []).map((event: EventWithMembers) => ({
    id: event.id,
    title: event.title,
    start: event.startAt as unknown as string,
    end: event.endAt as unknown as string | null,
    allDay: event.allDay,
    color: event.members?.[0]?.color ?? '#1D9E75',
    extendedProps: {
      location: event.location,
      status: event.status,
      priority: event.priority,
      source: event.sourceConnectorId,
      memberName: event.members?.[0]?.displayName,
      memberColor: event.members?.[0]?.color,
    },
  }));

  const selectedEvent = events?.find((e: EventWithMembers) => e.id === selectedEventId);

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  function toggleMember(memberId: string) {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  function handleEventClick(eventId: string) {
    setSelectedEventId(eventId);
    setDrawerOpen(true);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
      </div>

      {/* Member filters */}
      {members && members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((member: FamilyMember) => (
            <MemberChip
              key={member.id}
              name={member.displayName}
              color={member.color}
              active={selectedMemberIds.has(member.id)}
              onClick={() => toggleMember(member.id)}
            />
          ))}
          {selectedMemberIds.size > 0 && (
            <button
              onClick={() => setSelectedMemberIds(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Calendar */}
      <Card padding={false} className="p-4">
        <CalendarWrapper
          events={calendarEvents}
          onEventClick={handleEventClick}
          onDateRangeChange={handleDateRangeChange}
          loading={isLoading}
        />
      </Card>

      {/* Event Detail Drawer */}
      <EventDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={
          selectedEvent
            ? {
                id: selectedEvent.id,
                title: selectedEvent.title,
                description: selectedEvent.description,
                startAt: selectedEvent.startAt as unknown as string,
                endAt: selectedEvent.endAt as unknown as string | null,
                allDay: selectedEvent.allDay,
                location: selectedEvent.location,
                locationUrl: selectedEvent.locationUrl,
                eventType: selectedEvent.eventType,
                status: selectedEvent.status,
                priority: selectedEvent.priority,
                source: selectedEvent.sourceConnectorId,
                memberName: selectedEvent.members?.[0]?.displayName,
                memberColor: selectedEvent.members?.[0]?.color,
                signupUrl: selectedEvent.signupUrl,
                requiresSignup: selectedEvent.requiresSignup,
              }
            : null
        }
      />
    </div>
  );
}
