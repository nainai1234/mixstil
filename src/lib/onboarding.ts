export const ONBOARDING_COMPLETE_KEY = 'snooze:onboarding:complete';

export const shouldShowOnboarding = () => {
  if (typeof localStorage === 'undefined') return false;
  if (localStorage.getItem(ONBOARDING_COMPLETE_KEY) === '1') return false;
  return !Object.keys(localStorage).some((key) => (
    key === 'snooze_auth_token'
    || key === 'snooze:offline:mixes'
    || key.startsWith('snooze:playback:')
  ));
};

export const completeOnboarding = () => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
};
