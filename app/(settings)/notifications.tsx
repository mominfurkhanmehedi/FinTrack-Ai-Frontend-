import { Switch } from 'react-native';

import { SettingRow, SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';
import { useAppStore } from '../../store';

const TOGGLES: { key: 'transactionAlerts' | 'budgetLimitWarnings' | 'weeklySummary' | 'goalReminders'; icon: 'swap-horizontal' | 'alert-circle' | 'calendar' | 'flag'; label: string }[] = [
  { key: 'transactionAlerts', icon: 'swap-horizontal', label: 'Transaction alerts' },
  { key: 'budgetLimitWarnings', icon: 'alert-circle', label: 'Budget limit warnings' },
  { key: 'weeklySummary', icon: 'calendar', label: 'Weekly summary' },
  { key: 'goalReminders', icon: 'flag', label: 'Goal reminders' },
];

/**
 * Screen: Notifications
 * Manage per-channel notification preferences.
 */
export default function Notifications() {
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);

  return (
    <SettingsScreen title="Notifications" subtitle="Choose what you want to be alerted about">
      <Card>
        {TOGGLES.map((t) => (
          <SettingRow
            key={t.key}
            icon={t.icon}
            label={t.label}
            onPress={() => setNotifications({ [t.key]: !notifications[t.key] })}
            right={
              <Switch
                value={notifications[t.key]}
                onValueChange={(v) => setNotifications({ [t.key]: v })}
                trackColor={{ false: '#d1d5db', true: '#4f46e5' }}
                thumbColor="#ffffff"
              />
            }
          />
        ))}
      </Card>
    </SettingsScreen>
  );
}