import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';
import type { UserProfile } from '@conduit/shared';

const mockUser: UserProfile = {
  id: 'usr_123',
  email: 'test@example.com',
  displayName: 'Test User',
  useCase: 'personal',
  subscriptionStatus: 'trial',
};

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isOnboarded: false,
    });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isOnboarded).toBe(false);
  });

  it('setUser sets user and marks authenticated', () => {
    useAuthStore.getState().setUser(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('clearUser resets everything', () => {
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setOnboarded(true);
    useAuthStore.getState().clearUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isOnboarded).toBe(false);
  });

  it('setOnboarded updates onboarding state', () => {
    useAuthStore.getState().setOnboarded(true);
    expect(useAuthStore.getState().isOnboarded).toBe(true);
  });

  it('setOnboarded to false', () => {
    useAuthStore.getState().setOnboarded(true);
    useAuthStore.getState().setOnboarded(false);
    expect(useAuthStore.getState().isOnboarded).toBe(false);
  });
});
