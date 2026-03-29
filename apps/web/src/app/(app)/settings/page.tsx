'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useAuthStore } from '@/lib/store';
import type { Family } from '@allstarfamhub/shared';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saved, setSaved] = useState(false);

  const { data: family, isLoading } = useQuery<Family>({
    queryKey: ['family'],
    queryFn: async () => {
      const { data } = await api.get<Family>('/family');
      return data;
    },
  });

  useEffect(() => {
    if (family) {
      setFamilyName(family.name);
      setTimezone(family.timezone);
    }
  }, [family]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/family', { name: familyName, timezone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage your family hub settings</p>
      </div>

      {/* Family Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Family Information</CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="familyName"
              label="Family Name"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              required
            />

            <div className="space-y-1">
              <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                loading={updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1.5" />
                Save Changes
              </Button>
              {saved && (
                <span className="text-sm text-primary font-medium">Settings saved!</span>
              )}
            </div>
          </form>
        )}
      </Card>

      {/* Plan Info */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Plan</span>
            <span className="px-3 py-1 bg-primary-light text-primary rounded-full text-sm font-medium">
              {family?.plan ?? 'FREE'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Free plan includes 1 agent. Upgrade to add more agents and unlock AI-powered parsing.
          </p>
          <Button variant="secondary" className="w-full">
            Upgrade Plan
          </Button>
        </div>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Role</span>
            <span className="text-sm font-medium">{user?.role}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
