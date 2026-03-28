import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import type { IntegrationStatus } from '@allstarfamhub/shared';

interface AgentCardProps {
  displayName: string;
  connectorName: string;
  status: IntegrationStatus;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  onPress?: () => void;
}

const statusConfig: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  ACTIVE: { color: colors.success, icon: 'checkmark-circle', label: 'Active' },
  PENDING: { color: colors.warning, icon: 'hourglass-outline', label: 'Pending' },
  ERROR: { color: colors.danger, icon: 'alert-circle', label: 'Error' },
  PAUSED: { color: colors.textMuted, icon: 'pause-circle', label: 'Paused' },
  EXPIRED: { color: colors.danger, icon: 'close-circle', label: 'Expired' },
};

export default function AgentCard({
  displayName,
  connectorName,
  status,
  lastSyncAt,
  lastSyncError,
  onPress,
}: AgentCardProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.connector}>{connectorName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${config.color}18` }]}>
          <Ionicons name={config.icon} size={14} color={config.color} />
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      {lastSyncAt ? (
        <Text style={styles.syncTime}>
          Last sync: {new Date(lastSyncAt).toLocaleString()}
        </Text>
      ) : null}

      {status === 'ERROR' && lastSyncError ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={12} color={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {lastSyncError}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  connector: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  syncTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.sm,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    flex: 1,
  },
});
