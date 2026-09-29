import { Platform, StyleProp, Text, View, ViewStyle } from 'react-native';

import { POINTER_EVENTS } from '../ui';

export interface TooltipRow {
  label: string;
  value: string;
  /** Optional dot color shown before the label (e.g. income green / expense red). */
  color?: string;
}

/**
 * ChartTooltip (reports)
 * Floating tooltip used by the cash-flow and balance charts. Always displays
 * currency-formatted values passed in by the caller, so the selected currency
 * is honored everywhere without any hardcoded symbol.
 */
export function ChartTooltip({
  title,
  rows = [],
  style,
}: {
  title?: string;
  rows?: TooltipRow[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="text"
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
      style={[
        {
          position: 'absolute',
          minWidth: 132,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }
            : {
                elevation: 4,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }),
        },
        style,
        // Last, matching where react-native-web used to append the deprecated
        // prop, so caller styles can no longer clobber it.
        POINTER_EVENTS.none,
      ]}
    >
      {title ? (
        <Text className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{title}</Text>
      ) : null}
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} className="mt-1 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center">
            {row.color ? (
              <View className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: row.color }} />
            ) : null}
            <Text className="text-[11px] text-gray-400 dark:text-gray-500">{row.label}</Text>
          </View>
          <Text className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{row.value}</Text>
        </View>
      ))}
    </View>
  );
}