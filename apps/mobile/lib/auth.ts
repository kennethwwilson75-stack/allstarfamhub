import { api, setTokens, clearTokens, getRefreshToken } from './api';
import { useAppStore } from './store';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@allstarfamhub/shared';

export async function login(credentials: LoginRequest): Promise<void> {
  const result = await api.post<AuthResponse>('/auth/login', credentials);
  const { accessToken, refreshToken, user } = result.data;
  await setTokens(accessToken, refreshToken);
  useAppStore.getState().setUser(user);
}

export async function register(data: RegisterRequest): Promise<void> {
  const result = await api.post<AuthResponse>('/auth/register', data);
  const { accessToken, refreshToken, user } = result.data;
  await setTokens(accessToken, refreshToken);
  useAppStore.getState().setUser(user);
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Ignore errors during logout — we clear local state regardless
  }
  await clearTokens();
  useAppStore.getState().logout();
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const result = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefresh, user } = result.data;
    await setTokens(accessToken, newRefresh);
    useAppStore.getState().setUser(user);
    return true;
  } catch {
    await clearTokens();
    useAppStore.getState().logout();
    return false;
  }
}

export async function checkAuth(): Promise<boolean> {
  try {
    const result = await api.get<AuthResponse['user']>('/auth/me');
    useAppStore.getState().setUser(result.data);
    return true;
  } catch {
    // Token may be expired, try refresh
    return refreshAccessToken();
  }
}
