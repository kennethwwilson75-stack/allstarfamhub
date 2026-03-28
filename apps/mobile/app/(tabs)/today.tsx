import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, spacing, fontSize, borderRadius } from '@/lib/theme';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import EventCard from '@/components/EventCard';
import type { FamilyEvent, Alert as AlertModel } from '@allstarfamhub/shared';

interface TodayData {
  urgentAlerts: AlertModel[];
  events: FamilyEvent[];
  comingUp: FamilyEvent[];
}

export default function TodayScreen() {
  const familyId = useAppStore((s) => s.familyId);
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!familyId) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(
        new Date(Date.now() + 86400000),
        'yyyy-MM-dd',
      );
      const nextWeek = format(
        new Date(Date.now() + 7 * 86400000),
        'yyyy-MM-dd',
      );

      const [eventsRes, alertsRes, comingUpRes] = await Promise.all([
        api.get<FamilyEvent[]>(`/families/${familyId}/events`, {
          start: today,
          end: tomorrow,
        }),
        api.get<AlertModel[]>(`/families/${familyId}/alerts`, {
          unread: true,
          limit: 5,
        }),
        api.get<FamilyEvent[]>(`/families/${familyId}/events`, {
          start: tomorrow,
          end: nextWeek,
          limit: 5,
        }),
      ]);

      setData({
        urgentAlerts: eventsRes.data ? alertsRes.data : [],
        events: eventsRes.data ?? [],
        comingUp: comingUpRes.data ?? [],
      });
    } catch {
      // Failed to load — data stays null or stale
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  // Initial load
  React.useEffect(() => {
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

  const urgentAlerts = data?.urgentAlerts ?? [];
  const events = data?.events ?? [];
  const comingUp = data?.comingUp ?? [];

  const sections: Array<{ type: 'header'; title: string } | { type: 'event'; item: FamilyEvent } | { type: 'alert-banner' } | { type: 'empty'; message: string }> = [];

  // Urgent alerts banner
  if (urgentAlerts.length > 0) {
    sections.push({ type: 'alert-banner' });
  }

  // Today's events
  sections.push({ type: 'header', title: `Today - ${format(new Date(), 'EEEE, MMM d')}` });
  if (events.length === 0) {
    sections.push({ type: 'empty', message: 'No events today. Enjoy your free time!' });
  } else {
    for (const ev of events) {
      sections.push({ type: 'event', item: ev });
    }
  }

  // Coming up
  if (comingUp.length > 0) {
    sections.push({ type: 'header', title: 'Coming Up' });
    for (const ev of comingUp) {
      sections.push({ type: 'event', item: ev });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={sections}
        keyExtractor={(item, index) => {
          if (item.type === 'event') return item.item.id;
          return `${item.type}-${index}`;
        }}
        renderItem={({ item }) => {
          if (item.type === 'alert-banner') {
            return (
              <View style={styles.alertBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.white} />
                <Text style={styles.alertBannerText}>
                  {urgentAlerts.length} urgent alert{urgentAlerts.length > 1 ? 's' : ''} need attention
                </Text>
              </View>
            );
          }
          if (item.type === 'header') {
            return (
              <Text style={styles.sectionHeader}>{item.title}</Text>
            );
          }
          if (item.type === 'empty') {
            return (
              <View style={styles.emptyBox}>
                <Ionicons name="sunny-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>{item.message}</Text>
              </View>
            );
          }
          // event
          return (
            <EventCard
              title={item.item.title}
              startAt={String(item.item.startAt)}
              endAt={item.item.endAt ? String(item.item.endAt) : null}
              allDay={item.item.allDay}
              eventType={item.item.eventType}
              location={item.item.location}
            />
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.list}
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.danger,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  alertBannerText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  sectionHeader: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  emptyBox: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
