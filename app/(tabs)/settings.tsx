import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingRow } from '../../components/settings';
import { Button } from '../../components/ui';
import { ROUTES } from '../../constants/routes';
import { useAppStore } from '../../store';
import { CURRENCIES, LANGUAGES } from '../../types';
import { useMoney } from '../../hooks';
import { netBalance } from '../../utils';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Screen: Settings
 * Tab: Settings
 * Full-screen settings page with SafeAreaView for proper mobile rendering.
 * Profile, account actions, notifications, preferences, data, support,
 * privacy & security. Every row navigates to a real sub-screen.
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

  const confirm = (title: string, msg: string, action: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${msg}\n\n${title}`)) {
        action();
      }
      return;
    }
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);
  };

  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1);
  const currencyLabel = CURRENCIES.find((c) => c.code === currency)?.code ?? currency;
  const languageLabel = LANGUAGES.find((l) => l.code === language)?.label ?? language;

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
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">Manage your account</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4">
          {/* Profile Card */}
          <View className="bg-white dark:bg-gray-900 rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
            <View className="flex-row items-center gap-4 mb-4">
              <View className="w-16 h-16 rounded-full bg-brand-600 items-center justify-center">
                <Text className="text-2xl font-bold text-white">
                  {user?.avatar ?? (user?.name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {user?.name ?? 'Guest'}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {user?.email ?? 'Not signed in'}
                </Text>
              </View>
            </View>
            <View className="flex-row border-t border-gray-100 dark:border-gray-800 pt-4">
              <StatItem label="Balance" value={format(netBalance(transactions))} />
              <View className="w-px bg-gray-200 dark:bg-gray-700 mx-2" />
              <StatItem label="Transactions" value={String(transactions.length)} />
              <View className="w-px bg-gray-200 dark:bg-gray-700 mx-2" />
              <StatItem label="Goals" value={String(goals.length)} />
            </View>
          </View>

          {/* Account */}
          <SectionCard title="Account">
            <SettingRow
              icon="person"
              label="Edit Profile"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.EDIT_PROFILE)}
            />
            <SettingRow
              icon="lock-closed"
              label="Change Password"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CHANGE_PASSWORD)}
            />
            <SettingRow
              icon="trash"
              label="Delete Account"
              danger
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.DELETE_ACCOUNT)}
            />
          </SectionCard>

          <Spacer />

          {/* Notifications */}
          <SectionCard title="Notifications">
            <SettingRow
              icon="notifications"
              label="Manage Notifications"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.NOTIFICATIONS)}
            />
          </SectionCard>

          <Spacer />

          {/* Preferences */}
          <SectionCard title="Preferences">
            <SettingRow
              icon="contrast"
              label="Theme"
              value={themeLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.THEME)}
            />
            <SettingRow
              icon="cash"
              label="Currency"
              value={currencyLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CURRENCY)}
            />
            <SettingRow
              icon="language"
              label="Language"
              value={languageLabel}
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.LANGUAGE)}
            />
          </SectionCard>

          <Spacer />

          {/* Data */}
          <SectionCard title="Data">
            <SettingRow
              icon="download"
              label="Export Data"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.EXPORT_DATA)}
            />
            <SettingRow
              icon="refresh"
              label="Reset demo data"
              onPress={() =>
                confirm('Reset demo data', 'Restore the sample transactions and goals?', resetDemoData)
              }
            />
            <SettingRow
              icon="trash"
              label="Clear all data"
              danger
              onPress={() =>
                confirm('Clear all data', 'Delete every transaction and goal?', clearAllData)
              }
            />
          </SectionCard>

          <Spacer />

          {/* Support */}
          <SectionCard title="Support">
            <SettingRow
              icon="help-circle"
              label="Help & Support"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.HELP_SUPPORT)}
            />
            <SettingRow
              icon="chatbox-ellipses"
              label="FAQs"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.FAQS)}
            />
            <SettingRow
              icon="mail"
              label="Contact Us"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CONTACT_US)}
            />
            <SettingRow
              icon="information-circle"
              label="About FinTrack AI"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.ABOUT)}
            />
          </SectionCard>

          <Spacer />

          {/* Privacy & Security */}
          <SectionCard title="Privacy & Security">
            <SettingRow
              icon="shield-checkmark"
              label="Privacy Policy"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.PRIVACY_POLICY)}
            />
            <SettingRow
              icon="document-text"
              label="Terms & Conditions"
              onPress={() => router.push(ROUTES.SETTINGS_SCREENS.TERMS)}
            />
          </SectionCard>

          <Spacer />

          <Button
            title="Sign out"
            variant="danger"
            fullWidth
            onPress={() =>
              confirm('Sign out', 'You will be returned to the login screen.', handleSignOut)
            }
          />
        </View>
      </ScrollView>
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