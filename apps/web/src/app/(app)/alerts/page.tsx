'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Filter, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { AlertCard } from '@/components/AlertCard';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import type { Alert } from '@allstarfamhub/shared';

type FilterOption = 'all' | 'unread' | 'read';

export default function AlertsPage() {
  const [filter, setFilter] = useState<FilterOption>('all');
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts', filter],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { limit: 50 };
      if (filter === 'unread') params.unread = true;
      if (filter === 'read') params.unread = false;
      const { data } = await api.get<Alert[]>('/alerts', params);
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { readAt: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, { dismissedAt: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/alerts/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const unreadCount = alerts?.filter((a: Alert) => !a.readAt).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-7 w-7 text-accent" />
            Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
              : 'All caught up!'}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-light text-primary'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <Card padding={false}>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : alerts && alerts.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {alerts.map((alert: Alert) => (
              <div key={alert.id} className="p-4">
                <AlertCard
                  type={alert.type}
                  title={alert.title}
                  body={alert.body}
                  priority={alert.priority}
                  createdAt={alert.createdAt as unknown as string}
                  readAt={alert.readAt as unknown as string | null}
                  onRead={() => markReadMutation.mutate(alert.id)}
                  onDismiss={() => dismissMutation.mutate(alert.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {filter === 'unread' ? 'No unread alerts' : 'No alerts yet'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
