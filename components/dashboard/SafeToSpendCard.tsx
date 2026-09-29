import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';

import { ROUTES } from '../../constants/routes';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useSafeToSpend, StatusTone } from '../../hooks';
import { useI18n } from '../../i18n';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TONE_STYLES: Record<StatusTone, { hero: string; badge: string; text: string; icon: IoniconName }> = {
  healthy: { hero: 'text-green-600 dark:text-green-400', badge: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: 'checkmark-circle' },
  attention: { hero: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: 'alert-circle' },
  risk: { hero: 'text-red-600 dark:text-red-400', badge: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: 'alert-circle' },
  neutral: { hero: 'text-brand-600 dark:text-brand-400', badge: 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800', text: 'text-brand-700 dark:text-brand-400', icon: 'shield-checkmark' },
};

const STATUS_COPY = {
  healthy: 'dashboard.statusHealthy',
  attention: 'dashboard.statusAttention',
  risk: 'dashboard.statusRisk',
  neutral: 'dashboard.statusNeutral',
} as const;

const TONE_COLOR: Record<StatusTone, string> = {
  healthy: '#16a34a',
  attention: '#d97706',
  risk: '#dc2626',
  neutral: '#4f46e5',
};

const shrinkProps =
  Platform.OS === 'web' ? {} : { adjustsFontSizeToFit: true, minimumFontScale: 0.6 };

/**
 * SafeToSpendCard (dashboard)
 * The "Safe to Spend" summary card: how much can be spent right now without
 * hurting goals, upcoming expenses, or the safety buffer. Links to the detail
 * modal and the What-If simulator. The action row stacks in narrow desktop
 * columns so the buttons keep readable labels and full-width tap targets.
 */
export function SafeToSpendCard() {
  const { breakdown, daily, goalEstimates, format, statusTone } = useSafeToSpend();
  const { width } = useBreakpoint();
  const { t } = useI18n();
  const tone = TONE_STYLES[statusTone];
  const [actionsWidth, setActionsWidth] = useState(0);

  // 4-up desktop columns are narrow, so the hero drops a size to never clip.
  const heroSize = width < 640 ? 'text-3xl' : width < 1024 ? 'text-3xl' : 'text-2xl';

  const activeGoals = goalEstimates.filter((e) => e.remaining > 0);
  const heading =
    activeGoals.length === 0
      ? t('dashboard.headingNoGoals')
      : activeGoals.every((e) => e.onTrack)
        ? t('dashboard.headingOnTrack')
        : t('dashboard.headingAttention');

  const stacked = actionsWidth > 0 && actionsWidth < 280;
  const onActionsLayout = (e: LayoutChangeEvent) => setActionsWidth(e.nativeEvent.layout.width);

  return (
    <View>
      {/* Headline */}
      <View className="flex-row items-center mb-3">
        <View className={`w-9 h-9 rounded-full items-center justify-center mr-2 ${tone.badge} border`}>
          <Ionicons name={tone.icon} size={20} color={TONE_COLOR[statusTone]} />
        </View>
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.safeToSpendHeadline')}
        </Text>
      </View>

      {/* Hero amount */}
      <Text
        className={`${heroSize} font-bold tracking-tight ${tone.hero}`}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
        {...shrinkProps}
      >
        {format(breakdown.safeToSpend)}
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4" numberOfLines={1}>
        {heading}
      </Text>

      {/* Breakdown rows */}
      <Row label={t('dashboard.dailyLimit')} value={t('dashboard.dailyLimitValue', { amount: format(daily.daily) })} />
      <Row label={t('dashboard.goalReserved')} value={format(breakdown.goalReserve)} />
      <Row label={t('dashboard.upcomingExpenses')} value={format(breakdown.upcomingExpenses)} />
      <Row label={t('dashboard.safetyBuffer')} value={format(breakdown.emergencyBuffer)} />

      {/* Status line */}
      <View className={`flex-row items-center rounded-xl border px-3 py-2.5 mt-4 ${tone.badge}`}>
        <Ionicons name={tone.icon} size={16} color={TONE_COLOR[statusTone]} />
        <Text className={`text-sm font-medium ml-2 flex-1 ${tone.text}`} numberOfLines={2}>
          {t(STATUS_COPY[statusTone])}
        </Text>
      </View>

      {/* Actions */}
      <View onLayout={onActionsLayout}>
        {stacked ? (
          <View className="gap-2 mt-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.SAFE_TO_SPEND)}
              className="flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-3 active:bg-brand-700"
            >
              <Ionicons name="speedometer-outline" size={16} color="#ffffff" />
              <Text className="text-white font-semibold text-sm">{t('dashboard.viewDetails')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.WHAT_IF)}
              className="flex-row items-center justify-center gap-1.5 rounded-xl border border-brand-600 py-3 active:bg-brand-50 dark:active:bg-brand-900/30"
            >
              <Ionicons name="analytics-outline" size={16} color="#4f46e5" />
              <Text className="text-brand-600 font-semibold text-sm">{t('dashboard.whatIf')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-3 mt-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.SAFE_TO_SPEND)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 active:bg-brand-700"
            >
              <Ionicons name="speedometer-outline" size={16} color="#ffffff" />
              <Text className="text-white font-semibold text-sm" numberOfLines={1}>{t('dashboard.viewDetails')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(ROUTES.MODALS.WHAT_IF)}
              className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-brand-600 py-2.5 active:bg-brand-50 dark:active:bg-brand-900/30"
            >
              <Ionicons name="analytics-outline" size={16} color="#4f46e5" />
              <Text className="text-brand-600 font-semibold text-sm">{t('dashboard.whatIf')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-sm text-gray-500 dark:text-gray-400 mr-2" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-right"
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}