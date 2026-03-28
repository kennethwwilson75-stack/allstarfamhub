import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import type { AlertType, Priority } from '@allstarfamhub/shared';

interface AlertItemProps {
  title: string;
  body: string;
  type: AlertType;
  priority: Priority;
  createdAt: string;
  isRead: boolean;
  onPress?: () => void;
}

const alertTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  EVENT_ADDED: 'add-circle-outline',
  EVENT_CHANGED: 'create-outline',
  EVENT_CANCELLED: 'close-circle-outline',
  LOCATION_CHANGED: 'location-outline',
  TIME_CHANGED: 'time-outline',
  DEADLINE_TOMORROW: 'alarm-outline',
  DEADLINE_TODAY: 'alert-circle-outline',
  GRADE_POSTED: 'ribbon-outline',
  SIGNUP_NEEDED: 'hand-left-outline',
  SYNC_ERROR: 'warning-outline',
  CONFLICT_DETECTED: 'git-compare-outline',
};

const priorityColors: Record<string, string> = {
  LOW: colors.textMuted,
  NORMAL: colors.info,
  HIGH: colors.warning,
  URGENT: colors.danger,
};

export default function AlertItem({
  title,
  body,
  type,
  priority,
  createdAt,
  isRead,
  onPress,
}: AlertItemProps) {
  const icon = alertTypeIcons[type] ?? 'notifications-outline';
  const iconColor = priorityColors[priority] ?? colors.textSecondary;
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  return (
    <TouchableOpacity
      style={[styles.container, !isRead && styles.unreadBg]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {!isRead ? <View style={styles.unreadDot} /> : null}
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !isRead && styles.unreadTitle]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  unreadBg: {
    backgroundColor: colors.primaryLight,
  },
  unreadDot: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.lg + 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.unreadDot,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  unreadTitle: {
    fontWeight: '600',
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
});
