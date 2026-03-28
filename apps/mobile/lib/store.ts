import { create } from 'zustand';
import type { MemberRole } from '@allstarfamhub/shared';

interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  familyId: string;
  role: MemberRole;
}

interface AppState {
  /** Whether we have checked SecureStore for an existing token */
  isReady: boolean;
  /** The currently authenticated user, or null */
  user: AuthUser | null;
  /** Active family ID */
  familyId: string | null;

  setReady: () => void;
  setUser: (user: AuthUser | null) => void;
  setFamilyId: (id: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isReady: false,
  user: null,
  familyId: null,

  setReady: () => set({ isReady: true }),
  setUser: (user) => set({ user, familyId: user?.familyId ?? null }),
  setFamilyId: (familyId) => set({ familyId }),
  logout: () => set({ user: null, familyId: null }),
}));
