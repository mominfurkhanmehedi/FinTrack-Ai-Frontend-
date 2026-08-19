import { router } from 'expo-router';

import { PickerList, SettingsScreen } from '../../components/settings';
import { useAppStore } from '../../store';
import { ThemeMode } from '../../types';

const OPTIONS: { key: ThemeMode; label: string; description: string }[] = [
  { key: 'light', label: 'Light', description: 'Always use the light theme' },
  { key: 'dark', label: 'Dark', description: 'Always use the dark theme' },
  { key: 'system', label: 'System', description: 'Match your device setting' },
];

/**
 * Screen: ThemePicker
 * Choose light / dark / system theme. Applying the selection via useTheme
 * drives NativeWind `dark:` variants app-wide.
 */
export default function ThemePicker() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <SettingsScreen title="Theme" subtitle="Appearance">
      <PickerList
        options={OPTIONS.map((o) => ({ key: o.key, label: o.label, description: o.description }))}
        selected={theme}
        onSelect={(key) => {
          setTheme(key as ThemeMode);
          router.back();
        }}
      />
    </SettingsScreen>
  );
}