import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { LAYOUT } from '../../constants/breakpoints';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState } from '../ui';

/**
 * InsightsErrorState (insights)
 * Clean, non-crashing failure panel for a failed transaction load, with a retry
 * that re-runs the existing Supabase hydration action.
 */
export function InsightsErrorState({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  const { t } = useI18n();
  return (
    <Card>
      <EmptyState
        icon="cloud-offline-outline"
        title={t('insights.errorTitle')}
        message={t('insights.errorMessage')}
        action={
          <Button
            title={t('common.tryAgain')}
            onPress={onRetry}
            loading={retrying}
            leftIcon={<Ionicons name="refresh" size={18} color="#ffffff" />}
          />
        }
      />
    </Card>
  );
}

/**
 * InsightsNoDataState (insights)
 * Shown when the user genuinely has no transactions yet. The calendar and all
 * analytics stay visible and read zero — this only offers the first action.
 */
export function InsightsNoDataState({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  const { width } = useBreakpoint();
  // On a phone the icon, copy and button stack, so the button keeps its full
  // label and the message is never squeezed into a two-word column.
  const stack = width < LAYOUT.smallMobile;

  return (
    <View
      className={`mt-3 gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 ${
        stack ? 'items-start' : 'flex-row items-center'
      }`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20">
        <Ionicons name="receipt-outline" size={18} color="#4f46e5" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          {t('insights.noDataTitle')}
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">{t('insights.noDataMessage')}</Text>
      </View>
      <View className={stack ? 'w-full' : 'shrink-0'}>
        <Button
          title={t('insights.addTransaction')}
          onPress={onAdd}
          variant="secondary"
          fullWidth={stack}
        />
      </View>
    </View>
  );
}
