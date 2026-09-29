import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../../i18n';

export const BALANCE_RANGES = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
] as const;

export type BalanceRangeDays = (typeof BALANCE_RANGES)[number]['days'];

/**
 * RangeSelector (reports)
 * Segmented control for the Balance-over-time date range. Pill buttons keep the
 * touch target comfortably large, wrap to a second line on narrow screens, and
 * announce their selected state for screen readers.
 */
export function RangeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  const { t } = useI18n();

  return (
    <View className="flex-row flex-wrap gap-1.5" accessibilityRole="tablist">
      {BALANCE_RANGES.map((r) => {
        const activeDays = value === r.days;
        return (
          <Pressable
            key={r.days}
            accessibilityRole="button"
            accessibilityState={{ selected: activeDays }}
            accessibilityLabel={t('reports.rangeLast', { range: r.label })}
            onPress={() => onChange(r.days)}
            className={`rounded-full border px-3.5 py-2 ${
              activeDays
                ? 'border-brand-600 bg-brand-600'
                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                activeDays ? 'text-white' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}