import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
} from 'date-fns';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import EventCard from '@/components/EventCard';
import MemberPill from '@/components/MemberPill';
import type { FamilyEvent, FamilyMember } from '@allstarfamhub/shared';

export default function CalendarScreen() {
  const familyId = useAppStore((s) => s.familyId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchEvents = useCallback(async () => {
    if (!familyId) return;
    try {
      const dayStr = format(selectedDate, 'yyyy-MM-dd');
      const nextDay = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
      const query: Record<string, string | number | boolean | undefined> = {
        start: dayStr,
        end: nextDay,
      };
      if (selectedMember) {
        query.memberId = selectedMember;
      }
      const res = await api.get<FamilyEvent[]>(
        `/families/${familyId}/events`,
        query,
      );
      setEvents(res.data ?? []);
    } catch {
      // Failed — keep stale data
    } finally {
      setLoading(false);
    }
  }, [familyId, selectedDate, selectedMember]);

  const fetchMembers = useCallback(async () => {
    if (!familyId) return;
    try {
      const res = await api.get<FamilyMember[]>(`/families/${familyId}/members`);
      setMembers(res.data ?? []);
    } catch {
      // Ignore
    }
  }, [familyId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Week strip */}
      <View style={styles.weekStrip}>
        {weekDays.map((day) => {
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => setSelectedDate(day)}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isSelected && styles.dayLabelSelected,
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  isToday && !isSelected && styles.dayNumberToday,
                ]}
              >
                {format(day, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Member filter pills */}
      {members.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <MemberPill
            name="All"
            color={colors.primary}
            isSelected={selectedMember === null}
            onPress={() => setSelectedMember(null)}
          />
          {members.map((m) => (
            <MemberPill
              key={m.id}
              name={m.displayName}
              color={m.color}
              isSelected={selectedMember === m.id}
              onPress={() =>
                setSelectedMember(selectedMember === m.id ? null : m.id)
              }
            />
          ))}
        </ScrollView>
      )}

      {/* Day header */}
      <Text style={styles.dayHeader}>
        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
      </Text>

      {/* Events list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No events for this day</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              title={item.title}
              startAt={String(item.startAt)}
              endAt={item.endAt ? String(item.endAt) : null}
              allDay={item.allDay}
              eventType={item.eventType}
              location={item.location}
            />
          )}
          contentContainerStyle={styles.eventList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  weekStrip: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  dayLabelSelected: {
    color: colors.white,
  },
  dayNumber: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayNumberSelected: {
    color: colors.white,
  },
  dayNumberToday: {
    color: colors.primary,
  },
  pillRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dayHeader: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  eventList: {
    paddingBottom: spacing.xxl,
  },
});
