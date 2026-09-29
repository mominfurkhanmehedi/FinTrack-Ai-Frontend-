import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { useMoney } from '../../hooks/useMoney';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { Transaction } from '../../types';
import { Card, EmptyState } from '../ui';
import { donutSegment, str } from './reportChartMath';
import { buildCategoryData } from './reportData';

/**
 * CategoryChart (reports)
 * "Spending by category" donut. Derived only from real expense transactions
 * (income is never a spending category; "Savings" only if the app recorded it
 * as an expense). Legend lists every category with its name, percentage and
 * currency-formatted amount, and selecting a row highlights the matching slice.
 * Currencies flow in through the shared `useMoney` formatter.
 */
export function CategoryChart({ transactions }: { transactions: Transaction[] }) {
  const { format, formatCompact } = useMoney();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [measured, setMeasured] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const items = useMemo(() => buildCategoryData(transactions), [transactions]);
  const total = useMemo(() => items.reduce((s, it) => s + it.value, 0), [items]);

  if (items.length === 0) {
    return (
      <Card>
        <View className="mb-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('reports.categoryTitle')}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t('reports.categorySubtitle')}
          </Text>
        </View>
        <EmptyState
          icon="pie-chart-outline"
          title={t('reports.noSpendingTitle')}
          message={t('reports.noSpendingMessage')}
        />
      </Card>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  const w = measured;
  const rowLayout = w >= 520;
  const donutSize = rowLayout ? 172 : Math.min(Math.max(w - 8, 0), 216);
  const rOuter = donutSize / 2;
  const rInner = rOuter * 0.6;

  const cx = donutSize / 2;
  const cy = donutSize / 2;
  const padDeg = items.length > 1 ? 1.25 : 0;

  let angle = -90;
  const segments = items.map((it, i) => {
    const sweep = it.pct * 3.6;
    const start = angle;
    angle += sweep;
    const path = donutSegment(cx, cy, rOuter, rInner, start + padDeg / 2, Math.max(sweep - padDeg, 0.4));
    const isActive = active === i;
    return (
      <G key={`seg-${i}`}>
        <Path
          d={path}
          fill={it.color}
          fillOpacity={active == null || isActive ? 1 : 0.45}
          stroke={isDark ? '#111827' : '#ffffff'}
          strokeWidth={str(isActive ? 3.5 : 1)}
          strokeLinejoin="round"
        />
      </G>
    );
  });

  const legend = items.map((it, i) => {
    const isActive = active === i;
    return (
      <Pressable
        key={`legend-${i}`}
        onPress={() => setActive((cur) => (cur === i ? null : i))}
        onHoverIn={() => setActive(i)}
        onHoverOut={() => setActive(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${it.name}: ${format(it.value)}, ${Math.round(it.pct)}%`}
        className={`flex-row items-center rounded-lg px-2.5 py-2 ${
          isActive ? 'bg-brand-50 dark:bg-brand-900/20' : ''
        } ${i < items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
      >
        <View className="h-2.5 w-2.5 rounded-full mr-2.5" style={{ backgroundColor: it.color }} />
        <Text className="flex-1 min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200" numberOfLines={1}>
          {it.name}
        </Text>
        <Text className="w-12 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
          {Math.round(it.pct)}%
        </Text>
        <Text className="ml-3 text-sm font-bold text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {format(it.value)}
        </Text>
      </Pressable>
    );
  });

  return (
    <Card>
      <View className="mb-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('reports.categoryTitle')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {t('reports.categorySubtitle')}
        </Text>
      </View>

      <View className="w-full" onLayout={onLayout}>
        {w > 0 && (
          <View className={rowLayout ? 'flex-row items-center gap-6' : ''}>
            <View className={rowLayout ? '' : 'items-center'}>
              <Svg width={str(donutSize)} height={str(donutSize)}>
                {segments}
                <Circle cx={str(cx)} cy={str(cy)} r={str(4)} fill={isDark ? '#1f2937' : '#ffffff'} />
                <SvgText
                  x={str(cx)}
                  y={str(cy - 2)}
                  fontSize={str(Math.min(rInner * 0.34, 17))}
                  fontWeight="700"
                  fill={isDark ? '#e5e7eb' : '#111827'}
                  textAnchor="middle"
                >
                  {formatCompact(total)}
                </SvgText>
                <SvgText
                  x={str(cx)}
                  y={str(cy + Math.min(rInner * 0.26, 14))}
                  fontSize={str(Math.min(rInner * 0.17, 11))}
                  fill={isDark ? '#9ca3af' : '#6b7280'}
                  textAnchor="middle"
                >
                  {t('reports.totalSpent')}
                </SvgText>
              </Svg>
            </View>

            <View className={`mt-6 flex-1 ${rowLayout ? 'mt-0' : ''}`}>
              {legend}
              <View className="mt-2 flex-row items-center rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5">
                <Text className="flex-1 text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t('reports.total')}
                </Text>
                <Text className="w-12 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                  100%
                </Text>
                <Text className="ml-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                  {format(total)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}