import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import AlertItem from '@/components/AlertItem';
import type { Alert as AlertModel } from '@allstarfamhub/shared';

export default function AlertsScreen() {
  const familyId = useAppStore((s) => s.familyId);
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!familyId) return;
    try {
      const res = await api.get<AlertModel[]>(`/families/${familyId}/alerts`, {
        limit: 50,
      });
      setAlerts(res.data ?? []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  async function markRead(alertId: string) {
    // Optimistically update
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, readAt: new Date() } : a,
      ),
    );

    try {
      await api.patch(`/families/${familyId}/alerts/${alertId}`, {
        readAt: new Date().toISOString(),
      });
    } catch {
      // Revert on error by refetching
      fetchAlerts();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlertItem
            title={item.title}
            body={item.body}
            type={item.type}
            priority={item.priority}
            createdAt={String(item.createdAt)}
            isRead={item.readAt !== null}
            onPress={() => {
              if (!item.readAt) {
                markRead(item.id);
              }
            }}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No alerts at the moment</Text>
          </View>
        }
        contentContainerStyle={alerts.length === 0 ? styles.emptyList : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});
