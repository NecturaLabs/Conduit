export interface User {
  id: string;
  email: string;
  displayName: string;
  useCase: 'personal' | 'team' | 'agency';
  onboardingComplete: boolean;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'free';
  trialStartedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingPayload {
  displayName: string;
  useCase: User['useCase'];
}

export interface UserProfile
  extends Pick<
    User,
    'id' | 'email' | 'displayName' | 'useCase' | 'subscriptionStatus'
  > {}
