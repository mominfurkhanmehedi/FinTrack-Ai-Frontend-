import { Redirect } from 'expo-router';

import { useAppStore } from '../store';

/**
 * Root index route.
 * Routing rules:
 *  - Signed-in user            -> Dashboard directly.
 *  - Signed-out returning user -> Login (not Landing again).
 *  - Fresh install (not onboarded) -> Landing (then Onboarding).
 * The root layout's effect also guards this, but an explicit index is required
 * so `app/` always resolves to something.
 */
export default function Index() {
  const user = useAppStore((s) => s.user);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  if (user) {
    return <Redirect href="/dashboard" />;
  }
  return <Redirect href={hasOnboarded ? '/login' : '/landing'} />;
}