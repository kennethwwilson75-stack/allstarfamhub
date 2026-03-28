'use client';

import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DatesSetArg } from '@fullcalendar/core';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string | null;
  allDay?: boolean;
  color?: string;
  extendedProps?: Record<string, unknown>;
}

interface CalendarWrapperProps {
  events: CalendarEvent[];
  onEventClick?: (eventId: string) => void;
  onDateRangeChange?: (start: Date, end: Date) => void;
  loading?: boolean;
}

export function CalendarWrapper({
  events,
  onEventClick,
  onDateRangeChange,
  loading,
}: CalendarWrapperProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState('dayGridMonth');

  function handleEventClick(info: EventClickArg) {
    onEventClick?.(info.event.id);
  }

  function handleDatesSet(info: DatesSetArg) {
    setCurrentView(info.view.type);
    onDateRangeChange?.(info.start, info.end);
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={currentView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        events={events.map((e) => ({
          ...e,
          end: e.end ?? undefined,
        }))}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        height="auto"
        nowIndicator
        dayMaxEvents={3}
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
      />
    </div>
  );
}
