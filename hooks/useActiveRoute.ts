import { usePathname } from 'expo-router';

/**
 * useActiveRoute
 * Derives the active primary nav route (dashboard, transactions, insights,
 * budget, settings) from the current pathname for highlighting in the drawer.
 */
export function useActiveRoute(): string {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const top = segments[0] ?? 'dashboard';
  if (['dashboard', 'transactions', 'insights', 'budget', 'reports', 'settings'].includes(top)) {
    return top;
  }
  return 'dashboard';
}