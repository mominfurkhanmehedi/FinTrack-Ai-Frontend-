import { Redirect } from 'expo-router';

import { useAppStore } from '../store';

/**
 * Root index route.
 * Routing rules:
 *  - Signed-in user            -> Dashboard directly.
 *  - Signed-out user           -> Landing.
 *  - Fresh install (not onboarded) -> Landing (then Onboarding).
 * The root layout's effect also guards this, but an explicit index is required
 * so `app/` always resolves to something.
 */
export default function Index() {
  const user = useAppStore((s) => s.user);

  if (user) {
    return <Redirect href="/dashboard" />;
  }
  return <Redirect href="/landing" />;
}