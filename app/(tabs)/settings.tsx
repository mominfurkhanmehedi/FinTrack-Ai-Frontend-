import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar, ProfilePictureSheet, ProfilePictureViewer } from '../../components/profile';
import { SettingRow } from '../../components/settings';
import { Button } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { CURRENCIES, LANGUAGES } from '../../types';
import { useMoney } from '../../hooks';
import { netBalance } from '../../utils';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MAX_CONTENT_WIDTH = 768;

/**
 * Screen: Settings
 * Tab: Settings
 * Full-screen settings page with SafeAreaView for proper mobile rendering and a
 * centered max-width column on desktop. Sections: Profile, Preferences,
 * Account and Support & Legal. Every row navigates to a real sub-screen.
 */
export default function Settings() {
  const user = useAppStore((s) => s.user);
  const transactions = useAppStore((s) => s.transactions);
  const goals = useAppStore((s) => s.goals);
  const theme = useAppStore((s) => s.theme);
  const currency = useAppStore((s) => s.currency);
  const language = useAppStore((s) => s.language);
  const signOut = useAppStore((s) => s.signOut);
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const { format } = useMoney();
  const { t } = useI18n();

  const [pictureSheetOpen, setPictureSheetOpen] = useState(false);
  const [pictureViewerOpen, setPictureViewerOpen] = useState(false);

  const confirm = (title: string, msg: string, action: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${msg}\n\n${title}`)) {
        action();
      }
      return;
    }
    Alert.alert(title, msg, [
      { text: t('settings.confirmation.cancel'), style: 'cancel' },
      { text: t('settings.confirmation.confirm'), style: 'destructive', onPress: action },
    ]);
  };

  const themeLabel = theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight');
  const currencyLabel = CURRENCIES.find((c) => c.code === currency)?.code ?? currency;
  const languageEntry = LANGUAGES.find((l) => l.code === language);
  const languageLabel = languageEntry
    ? languageEntry.isDefault
      ? `${languageEntry.label} (${t('pickers.languageDefault')})`
      : languageEntry.label
    : language;

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace(ROUTES.LOGIN);
    } catch (e) {
      console.error('[signOut] failed:', e);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <View className="px-4 pt-2 pb-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('settings.screenTitle')}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {t('settings.screenSubtitle')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="w-full max-w-[768px] self-center px-4 pt-4"
          style={{ maxWidth: MAX_CONTENT_WIDTH }}
        >
          {/* Profile */}
          <View className="bg-white dark:bg-gray-900 rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-4">
              <View className="relative">
                <Pressable
                  onPress={() => {
                    if (user?.profilePicture) {
                      setPictureViewerOpen(true);
                    } else {
                      setPictureSheetOpen(true);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.profilePictureLabel')}
                >
                  <ProfileAvatar
                    uri={user?.profilePicture}
                    fallback={user?.avatar ?? (user?.name ?? '?').charAt(0).toUpperCase()}
                    size={72}
                  />
                </Pressable>
                <Pressable
                  onPress={() => setPictureSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.changeProfilePicture')}
                  hitSlop={6}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-600 border-2 border-white dark:border-gray-900 items-center justify-center active:bg-brand-700"
                >
                  <Ionicons name="images-outline" size={13} color="#ffffff" />
                </Pressable>
              </View>
              <Pressable
                onPress={() => setPictureSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('settings.changeProfilePicture')}
                className="flex-1 rounded-lg active:opacity-70"
              >
                <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {user?.name ?? t('settings.guest')}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email ?? t('settings.notSignedIn')}
                </Text>
                <Text className="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                  {t('settings.changeProfilePicture')}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row border-t border-gray-100 dark:border-gray-800 mt-4 pt-4">
              <StatItem label={t('settings.statBalance')} value={format(netBalance(transactions))} />
              <View className="w-px bg-gray-200 dark:bg-gray-700 mx-2" />
              <StatItem
                label={t('settings.statTransactions')}
                value={String(transactions.length)}
              />
              <View className="w-px bg-gray-200 dark:bg-gray-700 mx-2" />
              <StatItem label={t('settings.statGoals')} value={String(goals.length)} />
            </View>
          </View>

          {/* Profile actions */}
          <SectionCard title={t('settings.sectionProfile')}>
            <SettingRow
              icon="person"
              label={t('settings.editProfile')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.EDIT_PROFILE)}
            />
            <SettingRow
              icon="lock-closed"
              label={t('settings.changePassword')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CHANGE_PASSWORD)}
            />
          </SectionCard>

          <Spacer />

          {/* Preferences */}
          <SectionCard title={t('settings.sectionPreferences')}>
            <SettingRow
              icon="language"
              label={t('settings.language')}
              value={languageLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.LANGUAGE)}
            />
            <SettingRow
              icon="contrast"
              label={t('settings.theme')}
              value={themeLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.THEME)}
            />
            <SettingRow
              icon="cash"
              label={t('settings.currency')}
              value={currencyLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CURRENCY)}
            />
            <SettingRow
              icon="notifications"
              label={t('settings.notifications')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.NOTIFICATIONS)}
            />
          </SectionCard>

          <Spacer />

          {/* Account */}
          <SectionCard title={t('settings.sectionAccount')}>
            <SettingRow
              icon="download"
              label={t('settings.exportData')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.EXPORT_DATA)}
            />
            <SettingRow
              icon="refresh"
              label={t('settings.resetDemoData')}
              onPress={() =>
                confirm(t('settings.resetDemoTitle'), t('settings.resetDemoMessage'), resetDemoData)
              }
            />
            <SettingRow
              icon="trash"
              label={t('settings.clearAllData')}
              danger
              onPress={() =>
                confirm(t('settings.clearAllTitle'), t('settings.clearAllMessage'), clearAllData)
              }
            />
            <SettingRow
              icon="person-remove"
              label={t('settings.deleteAccount')}
              danger
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.DELETE_ACCOUNT)}
            />
          </SectionCard>

          <Spacer />

          {/* Support & Legal */}
          <SectionCard title={t('settings.sectionSupport')}>
            <SettingRow
              icon="help-circle"
              label={t('settings.helpSupport')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.HELP_SUPPORT)}
            />
            <SettingRow
              icon="chatbox-ellipses"
              label={t('settings.faqs')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.FAQS)}
            />
            <SettingRow
              icon="mail"
              label={t('settings.contactUs')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CONTACT_US)}
            />
            <SettingRow
              icon="information-circle"
              label={t('settings.about')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.ABOUT)}
            />
            <SettingRow
              icon="shield-checkmark"
              label={t('settings.privacyPolicy')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.PRIVACY_POLICY)}
            />
            <SettingRow
              icon="document-text"
              label={t('settings.terms')}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.TERMS)}
            />
          </SectionCard>

          <Spacer />

          <Button
            title={t('settings.signOut')}
            variant="danger"
            fullWidth
            onPress={() =>
              confirm(t('settings.signOutTitle'), t('settings.signOutMessage'), handleSignOut)
            }
          />
        </View>
      </ScrollView>

      <ProfilePictureSheet
        visible={pictureSheetOpen}
        hasPicture={Boolean(user?.profilePicture)}
        onClose={() => setPictureSheetOpen(false)}
      />
      <ProfilePictureViewer
        visible={pictureViewerOpen}
        uri={user?.profilePicture}
        onClose={() => setPictureViewerOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Stat item in the profile card */
function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
      <Text className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}

/** Section card wrapper */
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
      <Text className="px-4 pt-4 pb-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Spacer() {
  return <View className="h-4" />;
}