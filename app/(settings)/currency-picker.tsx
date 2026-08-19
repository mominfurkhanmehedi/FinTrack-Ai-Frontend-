import { router } from 'expo-router';

import { PickerList, SettingsScreen } from '../../components/settings';
import { useAppStore } from '../../store';
import { CURRENCIES } from '../../types';

/**
 * Screen: CurrencyPicker
 * Choose the display currency. Applied app-wide via the useMoney hook, so
 * every formatted amount updates immediately.
 */
export default function CurrencyPicker() {
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);

  return (
    <SettingsScreen title="Currency" subtitle="Display currency">
      <PickerList
        options={CURRENCIES.map((c) => ({ key: c.code, label: `${c.symbol} ${c.label}` }))}
        selected={currency}
        onSelect={(key) => {
          setCurrency(key);
          router.back();
        }}
      />
    </SettingsScreen>
  );
}