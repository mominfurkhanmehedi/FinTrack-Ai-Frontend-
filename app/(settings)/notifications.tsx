import { Switch } from 'react-native';

import { SettingRow, SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

const TOGGLES = [
  { key: 'transactionAlerts', icon: 'swap-horizontal', label: 'notifications.transactionAlerts' },
  { key: 'budgetLimitWarnings', icon: 'alert-circle', label: 'notifications.budgetLimitWarnings' },
  { key: 'weeklySummary', icon: 'calendar', label: 'notifications.weeklySummary' },
  { key: 'goalReminders', icon: 'flag', label: 'notifications.goalReminders' },
] as const;

/**
 * Screen: Notifications
 * Manage per-channel notification preferences.
 */
export default function Notifications() {
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const { t } = useI18n();

  return (
    <SettingsScreen title={t('notifications.title')} subtitle={t('notifications.subtitle')}>
      <Card>
        {TOGGLES.map((item) => (
          <SettingRow
            key={item.key}
            icon={item.icon}
            label={t(item.label)}
            onPress={() => setNotifications({ [item.key]: !notifications[item.key] })}
            right={
              <Switch
                value={notifications[item.key]}
                onValueChange={(v) => setNotifications({ [item.key]: v })}
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
