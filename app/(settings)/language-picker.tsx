import { router } from 'expo-router';

import { useI18n } from '../../i18n';
import { PickerList, SettingsScreen } from '../../components/settings';
import { useAppStore } from '../../store';
import { LANGUAGES } from '../../types';

/**
 * Screen: LanguagePicker
 * Choose the app language. Labels are shown in each language's native script;
 * English carries a "(Default)" marker.
 */
export default function LanguagePicker() {
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('pickers.languageTitle')} subtitle={t('pickers.languageSubtitle')}>
      <PickerList
        options={LANGUAGES.map((l) => ({
          key: l.code,
          label: l.isDefault
            ? `${l.label} (${t('pickers.languageDefault')})`
            : l.label,
        }))}
        selected={language}
        onSelect={(key) => {
          setLanguage(key);
          router.back();
        }}
      />
    </SettingsScreen>
  );
}