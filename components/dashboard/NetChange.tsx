import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { useMoney } from '../../hooks';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useI18n } from '../../i18n';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * NetChange (dashboard)
 * Income vs. expenses summary row. Stays side-by-side at every size (mobile
 * design preserved); only in genuinely tight desktop ~1/4 columns does it
 * stack so the amounts never clip. The numbers scale/wrap safely.
 */
export function NetChange({ income, expenses }: { income: number; expenses: number }) {
  const { format } = useMoney();
  const { width } = useBreakpoint();
  const { t } = useI18n();
  const [innerWidth, setInnerWidth] = useState(0);

  // Under ~200px of usable room, two side-by-side value panes can't show a
  // full amount — stack them as full-width rows instead.
  const stacked = innerWidth > 0 && innerWidth < 200;

  const valueSize = stacked ? 'text-xl' : width < 1024 ? 'text-2xl' : 'text-lg';

  const shrinkProps =
    Platform.OS === 'web' ? {} : { adjustsFontSizeToFit: true, minimumFontScale: 0.6 };

  const panes = [
    {
      label: t('dashboard.income'),
      icon: 'arrow-down-circle' as IoniconName,
      accent: '#16a34a',
      iconBg: 'bg-green-100',
      tint: 'bg-green-50 dark:bg-green-900/30',
      border: 'border-green-100 dark:border-green-800',
      valueClass: 'text-green-700 dark:text-green-400',
      value: format(income),
    },
    {
      label: t('dashboard.expenses'),
      icon: 'arrow-up-circle' as IoniconName,
      accent: '#dc2626',
      iconBg: 'bg-red-100',
      tint: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-100 dark:border-red-800',
      valueClass: 'text-red-700 dark:text-red-400',
      value: format(expenses),
    },
  ];

  if (stacked) {
    return (
      <View className="gap-2">
        {panes.map((p) => (
          <View key={p.label} className={`flex-row items-center rounded-xl ${p.tint} border ${p.border} px-3 py-3`}>
            <View className={`w-7 h-7 rounded-full items-center justify-center shrink-0 ${p.iconBg}`}>
              <Ionicons name={p.icon} size={15} color={p.accent} />
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ml-2 flex-1" numberOfLines={1}>
              {p.label}
            </Text>
            <Text className={`${valueSize} font-bold tracking-tight ${p.valueClass} text-right ml-2`} numberOfLines={1} {...shrinkProps}>
              {p.value}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      className="flex-row gap-3"
      onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}
    >
      {panes.map((p) => (
        <Pane key={p.label} {...p} valueSize={valueSize} shrinkProps={shrinkProps} />
      ))}
    </View>
  );
}

function Pane({
  label,
  icon,
  accent,
  iconBg,
  tint,
  border,
  valueClass,
  value,
  valueSize,
  shrinkProps,
}: {
  label: string;
  icon: IoniconName;
  accent: string;
  iconBg: string;
  tint: string;
  border: string;
  valueClass: string;
  value: string;
  valueSize: string;
  shrinkProps: { adjustsFontSizeToFit: true; minimumFontScale: number } | {};
}) {
  return (
    <View className={`flex-1 min-w-0 rounded-xl ${tint} border ${border} px-3 py-3`}>
      <View className="flex-row items-center gap-1.5 mb-1.5">
        <View className={`w-7 h-7 rounded-full items-center justify-center ${iconBg}`}>
          <Ionicons name={icon} size={15} color={accent} />
        </View>
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className={`${valueSize} font-bold tracking-tight ${valueClass}`} numberOfLines={1} style={{ flexShrink: 1 }} {...shrinkProps}>
        {value}
      </Text>
    </View>
  );
}