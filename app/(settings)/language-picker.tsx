import { router } from 'expo-router';

import { PickerList, SettingsScreen } from '../../components/settings';
import { useAppStore } from '../../store';
import { LANGUAGES } from '../../types';

/**
 * Screen: LanguagePicker
 * Choose the app language.
 */
export default function LanguagePicker() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  return (
    <SettingsScreen title="Language" subtitle="App language">
      <PickerList
        options={LANGUAGES.map((l) => ({ key: l.code, label: l.label }))}
        selected={language}
        onSelect={(key) => {
          setLanguage(key);
          router.back();
        }}
      />
    </SettingsScreen>
  );
}