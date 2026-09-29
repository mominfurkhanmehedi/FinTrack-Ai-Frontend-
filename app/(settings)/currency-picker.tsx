import { router } from 'expo-router';

import { useI18n } from '../../i18n';
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
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('pickers.currencyTitle')} subtitle={t('pickers.currencySubtitle')}>
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