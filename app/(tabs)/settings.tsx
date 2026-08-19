import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

import { Card, ResponsiveContainer, ScreenHeader } from '../../components/ui';
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
      // Alert.alert is a no-op on react-native-web, so use the browser confirm.
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

  const handleSignOut = () => {
    try {
      console.log('[signOut] before:', { user: useAppStore.getState().user, hasOnboarded: useAppStore.getState().hasOnboarded });
      signOut();
      console.log('[signOut] after:', { user: useAppStore.getState().user });
      router.replace(ROUTES.LOGIN);
    } catch (e) {
      console.error('[signOut] failed:', e);
    }
  };

  return (
    <ResponsiveContainer scrollable={false}>
      <ScreenHeader title="Settings" subtitle="Manage your account" />
      <ScrollView contentContainerClassName="pb-12" className="flex-1">
        {/* Profile */}
        <Card>
          <View className="flex-row items-center gap-4">
            <View className="w-14 h-14 rounded-full bg-brand-600 items-center justify-center">
              <Text className="text-2xl">{user?.avatar ?? (user?.name ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {user?.name ?? 'Guest'}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">{user?.email ?? 'Not signed in'}</Text>
            </View>
          </View>
          <View className="flex-row gap-4 mt-5">
            <Stat label="Balance" value={format(netBalance(transactions))} />
            <Stat label="Transactions" value={String(transactions.length)} />
            <Stat label="Goals" value={String(goals.length)} />
          </View>
        </Card>

        <Spacer />

        {/* Account actions */}
        <Card title="Account">
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
        </Card>

        <Spacer />

        {/* Notifications */}
        <Card title="Notifications">
          <SettingRow
            icon="notifications"
            label="Manage Notifications"
            onPress={() => router.push(ROUTES.SETTINGS_SCREENS.NOTIFICATIONS)}
          />
        </Card>

        <Spacer />

        {/* Preferences */}
        <Card title="Preferences">
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
        </Card>

        <Spacer />

        {/* Data */}
        <Card title="Data">
          <SettingRow
            icon="download"
            label="Export Data"
            onPress={() => router.push(ROUTES.SETTINGS_SCREENS.EXPORT_DATA)}
          />
          <SettingRow
            icon="refresh"
            label="Reset demo data"
            onPress={() => confirm('Reset demo data', 'Restore the sample transactions and goals?', resetDemoData)}
          />
          <SettingRow
            icon="trash"
            label="Clear all data"
            danger
            onPress={() => confirm('Clear all data', 'Delete every transaction and goal?', clearAllData)}
          />
        </Card>

        <Spacer />

        {/* Support */}
        <Card title="Support">
          <SettingRow
            icon="help-circle"
            label="Help & Support"
            onPress={() => router.push(ROUTES.SETTINGS_SCREENS.HELP_SUPPORT)}
          />
          <SettingRow icon="chatbox-ellipses" label="FAQs" onPress={() => router.push(ROUTES.SETTINGS_SCREENS.FAQS)} />
          <SettingRow icon="mail" label="Contact Us" onPress={() => router.push(ROUTES.SETTINGS_SCREENS.CONTACT_US)} />
          <SettingRow icon="information-circle" label="About FinTrack AI" onPress={() => router.push(ROUTES.SETTINGS_SCREENS.ABOUT)} />
        </Card>

        <Spacer />

        {/* Privacy & Security */}
        <Card title="Privacy & Security">
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
        </Card>

        <Spacer />

        <Button
          title="Sign out"
          variant="danger"
          fullWidth
          onPress={() =>
            confirm('Sign out', 'You will be returned to the login screen.', handleSignOut)
          }
        />
      </ScrollView>
    </ResponsiveContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}

function Spacer() {
  return <View className="h-4" />;
}
