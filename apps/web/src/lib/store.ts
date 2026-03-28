'use client';

import { create } from 'zustand';
import type { MemberRole } from '@allstarfamhub/shared';

interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  familyId: string;
  role: MemberRole;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  setAuth: (user, token) => {
    localStorage.setItem('access_token', token);
    set({ user, accessToken: token, isLoading: false });
  },
  clearAuth: () => {
    localStorage.removeItem('access_token');
    set({ user: null, accessToken: null, isLoading: false });
  },
  setLoading: (loading) => set({ isLoading: loading }),
}));
