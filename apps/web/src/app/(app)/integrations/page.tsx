'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { Puzzle, Plus, RefreshCw, AlertCircle, Pause, Play, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { cn } from '@/lib/utils';
import type { Integration, ConnectorDefinition } from '@allstarfamhub/shared';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof RefreshCw }> = {
  ACTIVE: { label: 'Active', color: 'text-green-600 bg-green-50', icon: RefreshCw },
  PENDING: { label: 'Pending', color: 'text-yellow-600 bg-yellow-50', icon: AlertCircle },
  ERROR: { label: 'Needs Attention', color: 'text-red-600 bg-red-50', icon: AlertCircle },
  PAUSED: { label: 'Paused', color: 'text-gray-600 bg-gray-100', icon: Pause },
  EXPIRED: { label: 'Expired', color: 'text-orange-600 bg-orange-50', icon: AlertCircle },
};

export default function IntegrationsPage() {
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const { data } = await api.get<Integration[]>('/integrations');
      return data;
    },
  });

  const { data: connectors } = useQuery({
    queryKey: ['connectors'],
    queryFn: async () => {
      const { data } = await api.get<ConnectorDefinition[]>('/connectors');
      return data;
    },
  });

  function getConnectorName(connectorId: string): string {
    const connector = connectors?.find((c) => c.id === connectorId);
    return connector?.displayName ?? connectorId;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Puzzle className="h-7 w-7 text-primary" />
            Your Agents
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Agents automatically sync events from your platforms
          </p>
        </div>
        <Link href="/integrations/add">
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Agent
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : integrations && integrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => {
            const statusConfig = STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.PENDING;
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
                      <Puzzle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{integration.displayName}</h3>
                      <p className="text-xs text-gray-500">{getConnectorName(integration.connectorId)}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                      statusConfig.color,
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {integration.lastSyncAt && (
                    <p>
                      Last synced: {format(new Date(integration.lastSyncAt), 'MMM d, h:mm a')}
                    </p>
                  )}
                  {integration.lastSyncError && (
                    <p className="text-danger text-xs">{integration.lastSyncError}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    Syncs every {integration.syncIntervalMin} min
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  {integration.status === 'ACTIVE' && (
                    <button className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
                      <Pause className="h-3 w-3" /> Pause
                    </button>
                  )}
                  {integration.status === 'PAUSED' && (
                    <button className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      <Play className="h-3 w-3" /> Resume
                    </button>
                  )}
                  <button className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 ml-auto">
                    <Settings2 className="h-3 w-3" /> Configure
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="text-center py-16">
            <Puzzle className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No agents yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Add your first agent to start automatically syncing events from Canvas, SportsYou,
              Infinite Campus, and more.
            </p>
            <Link href="/integrations/add">
              <Button>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Your First Agent
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
