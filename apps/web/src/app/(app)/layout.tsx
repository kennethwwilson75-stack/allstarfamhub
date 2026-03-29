'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { Alert, AuthResponse } from '@allstarfamhub/shared';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, setAuth, clearAuth, isLoading, setLoading } = useAuthStore();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          clearAuth();
          router.push('/login');
          return;
        }

        // If we have a session but no user in store, re-authenticate
        if (!user) {
          const token = localStorage.getItem('access_token');
          if (token) {
            try {
              const { data } = await api.get<AuthResponse['user']>('/auth/me');
              setAuth(data, token);
            } catch {
              clearAuth();
              router.push('/login');
              return;
            }
          } else {
            clearAuth();
            router.push('/login');
            return;
          }
        }
      } catch {
        clearAuth();
        router.push('/login');
        return;
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    }

    checkAuth();
  }, []);

  // Fetch unread alert count
  const { data: alertsData } = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<Alert[]>('/alerts', { unread: true, limit: 50 });
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = alertsData?.length ?? 0;

  if (isLoading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar unreadAlerts={unreadCount} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
