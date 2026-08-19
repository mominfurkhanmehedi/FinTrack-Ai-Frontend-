import { useAppStore } from '../store';
import { formatCompact, formatCurrency } from '../utils';

/**
 * useMoney
 * Returns currency formatters bound to the store's current currency, so that
 * changing the currency in Settings reflects everywhere amounts are shown.
 */
export function useMoney() {
  const currency = useAppStore((s) => s.currency);

  return {
    currency,
    format: (amount: number) => formatCurrency(amount, currency),
    formatCompact: (amount: number) => formatCompact(amount, currency),
  };
}