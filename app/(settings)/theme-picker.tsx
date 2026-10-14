import { router } from 'expo-router';

import { useI18n } from '../../i18n';
import { PickerList, SettingsScreen } from '../../components/settings';
import { useAppStore } from '../../store';
import { ThemeMode } from '../../types';

/**
 * Screen: ThemePicker
 * Choose a light / dark theme (Light is the default; no "system" option).
 * Applying the selection via useTheme drives NativeWind `dark:` variants.
 */
export default function ThemePicker() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const { t } = useI18n();

  const options: { key: ThemeMode; label: string; description: string }[] = [
    { key: 'light', label: t('pickers.lightDefault'), description: t('pickers.lightDesc') },
    { key: 'dark', label: t('pickers.dark'), description: t('pickers.darkDesc') },
  ];

  return (
    <SettingsScreen title={t('pickers.themeTitle')} subtitle={t('pickers.themeSubtitle')}>
      <PickerList
        options={options.map((o) => ({ key: o.key, label: o.label, description: o.description }))}
        selected={theme}
        onSelect={(key) => {
          setTheme(key as ThemeMode);
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/settings');
          }
        }}
      />
    </SettingsScreen>
  );
}