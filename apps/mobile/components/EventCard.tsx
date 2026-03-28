import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import type { EventType } from '@allstarfamhub/shared';
import SourceBadge from './SourceBadge';

interface EventCardProps {
  title: string;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  eventType: EventType;
  location?: string | null;
  memberColor?: string;
  memberName?: string;
  sourceName?: string | null;
  onPress?: () => void;
}

const eventTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  ASSIGNMENT: 'document-text-outline',
  EXAM: 'school-outline',
  SCHOOL_EVENT: 'flag-outline',
  NO_SCHOOL: 'sunny-outline',
  SPORTS: 'football-outline',
  MEETING: 'people-outline',
  ANNOUNCEMENT: 'megaphone-outline',
  PERSONAL: 'person-outline',
};

export default function EventCard({
  title,
  startAt,
  endAt,
  allDay,
  eventType,
  location,
  memberColor,
  memberName,
  sourceName,
  onPress,
}: EventCardProps) {
  const start = new Date(startAt);
  const timeStr = allDay
    ? 'All Day'
    : endAt
      ? `${format(start, 'h:mm a')} - ${format(new Date(endAt), 'h:mm a')}`
      : format(start, 'h:mm a');

  const icon = eventTypeIcons[eventType] ?? 'calendar-outline';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={[styles.stripe, { backgroundColor: memberColor ?? colors.primary }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name={icon} size={16} color={colors.textSecondary} />
          <Text style={styles.time}>{timeStr}</Text>
          {sourceName ? <SourceBadge name={sourceName} /> : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.footer}>
          {memberName ? (
            <View style={styles.memberRow}>
              <View style={[styles.memberDot, { backgroundColor: memberColor ?? colors.primary }]} />
              <Text style={styles.memberName}>{memberName}</Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  stripe: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  locationText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flex: 1,
  },
});
