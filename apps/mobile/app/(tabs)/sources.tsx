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
import AgentCard from '@/components/AgentCard';
import type { Integration, ConnectorDefinition } from '@allstarfamhub/shared';

interface IntegrationWithConnector extends Integration {
  connectorName?: string;
}

export default function SourcesScreen() {
  const familyId = useAppStore((s) => s.familyId);
  const [integrations, setIntegrations] = useState<IntegrationWithConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!familyId) return;
    try {
      const [intRes, connRes] = await Promise.all([
        api.get<Integration[]>(`/families/${familyId}/integrations`),
        api.get<ConnectorDefinition[]>('/connectors'),
      ]);

      const connectors = connRes.data ?? [];
      const connectorMap = new Map(connectors.map((c) => [c.id, c.displayName]));

      const enriched: IntegrationWithConnector[] = (intRes.data ?? []).map((i) => ({
        ...i,
        connectorName: connectorMap.get(i.connectorId) ?? 'Unknown',
      }));

      setIntegrations(enriched);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

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
        data={integrations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AgentCard
            displayName={item.displayName}
            connectorName={item.connectorName ?? 'Unknown'}
            status={item.status}
            lastSyncAt={item.lastSyncAt ? String(item.lastSyncAt) : null}
            lastSyncError={item.lastSyncError}
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
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <Text style={styles.headerTitle}>Integrations</Text>
            <Text style={styles.headerSubtitle}>
              Your connected data sources and agents
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No integrations yet</Text>
            <Text style={styles.emptySubtext}>
              Connect your first data source to start syncing events
            </Text>
          </View>
        }
        contentContainerStyle={integrations.length === 0 ? styles.emptyList : styles.list}
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
  list: {
    paddingBottom: spacing.xxl,
  },
  headerBox: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyList: {
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
