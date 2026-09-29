import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { useMoney } from '../../hooks/useMoney';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { buildCategoryData, categoryPercentLabels } from '../reports/reportData';
import { donutSegment, str } from '../reports/reportChartMath';
import { EmptyState } from '../ui';
import { InsightCard, useCardContentWidth } from './InsightsLayout';
import { shrinkProps } from './StatTile';

export interface SpendingDonutProps {
  /** Expense rows for the month on screen (already filtered by the page). */
  transactions: Parameters<typeof buildCategoryData>[0];
  monthLabel: string;
  /** Ask FinTrack — opens the assistant focused on this category. */
  onAsk?: (category: string) => void;
}

/** Donut + legend only fit side by side from this much inner width. */
const ROW_LAYOUT_MIN = 460;
/** Donut size used when the legend sits beside it. */
const ROW_DONUT_SIZE = 168;
/** Donut size bounds when the donut sits above the legend (phones). */
const STACKED_DONUT_MIN = 132;
const STACKED_DONUT_MAX = 200;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * SpendingDonutCard (insights)
 * Interactive "Spending by category" donut.
 *
 * Slices come from the existing `buildCategoryData` report builder fed with the
 * real expense rows for the displayed month, and the geometry reuses the shared
 * `donutSegment` SVG helper — so there is no duplicated chart maths and no
 * duplicated financial logic. All amounts run through `useMoney`, so the chart
 * always uses the currency selected in Settings and never a hardcoded symbol.
 *
 * Sizing is derived from the width the card actually has rather than from fixed
 * numbers, and the chart is always rendered — no empty card while waiting for a
 * measurement. On a phone the donut shrinks, centres above the legend, and the
 * legend amount shrinks to fit instead of pushing the row wider than the card.
 *
 * Percentages come from `categoryPercentLabels`, so the printed values always
 * total 100% and a real but tiny category reads "<1%" rather than a misleading
 * "0%". The chart geometry still uses the exact `pct`, so the slice sizes and
 * the labels can never disagree.
 *
 * Interaction: hover (web) or tap a slice/legend row to select it. The selection
 * surfaces as a tooltip inside the donut hole, dims the other slices, and
 * highlights the matching legend row.
 */
export function SpendingDonutCard({ transactions, monthLabel, onAsk }: SpendingDonutProps) {
  const { format, formatCompact } = useMoney();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [contentWidth, onLayout] = useCardContentWidth();

  const items = useMemo(() => buildCategoryData(transactions), [transactions]);
  const total = useMemo(() => items.reduce((s, it) => s + it.value, 0), [items]);
  const labels = useMemo(() => categoryPercentLabels(items), [items]);

  if (items.length === 0) {
    return (
      <InsightCard onLayout={onLayout}>
        <Header monthLabel={monthLabel} />
        <EmptyState
          compact
          icon="pie-chart-outline"
          title={t('insights.noExpenseDataTitle')}
          message={t('insights.noExpenseDataMessage')}
        />
      </InsightCard>
    );
  }

  // Side-by-side once there is room; otherwise the donut sits above the legend
  // so it never gets squeezed on a phone. `contentWidth` is 0 for the first
  // frame in a multi-column grid, which clamps to the smallest donut.
  const rowLayout = contentWidth >= ROW_LAYOUT_MIN;
  const donutSize = rowLayout
    ? ROW_DONUT_SIZE
    : Math.round(clamp(contentWidth - 12, STACKED_DONUT_MIN, STACKED_DONUT_MAX));
  const rOuter = donutSize / 2;
  const rInner = rOuter * 0.62;
  const cx = donutSize / 2;
  const cy = donutSize / 2;
  const padDeg = items.length > 1 ? 1.4 : 0;

  const selected = active != null ? items[active] : null;
  const selectedLabel = active != null ? labels[active] : '';

  let angle = -90;
  const segments = items.map((it, i) => {
    const sweep = it.pct * 3.6;
    const start = angle;
    angle += sweep;
    const isActive = active === i;
    return (
      <G key={`seg-${i}`}>
        <Path
          d={donutSegment(cx, cy, rOuter, rInner, start + padDeg / 2, Math.max(sweep - padDeg, 0.4))}
          fill={it.color}
          fillOpacity={active == null || isActive ? 1 : 0.35}
          stroke={isDark ? '#111827' : '#ffffff'}
          strokeWidth={str(isActive ? 3 : 1)}
          strokeLinejoin="round"
        />
      </G>
    );
  });

  const legend = items.map((it, i) => {
    const isActive = active === i;
    return (
      <Pressable
        key={`legend-${it.name}`}
        onPress={() => setActive((cur) => (cur === i ? null : i))}
        onHoverIn={() => setActive(i)}
        onHoverOut={() => setActive(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${it.name}: ${format(it.value)}, ${labels[i]}`}
        className={`flex-row items-center rounded-lg px-2.5 py-2 active:bg-gray-100 ${
          isActive ? 'bg-brand-50 dark:bg-brand-900/20' : ''
        } ${i < items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}`}
      >
        <View className="h-2.5 w-2.5 rounded-full mr-2.5" style={{ backgroundColor: it.color }} />
        {/* Shrinks hardest so the amount always keeps its full glyphs. */}
        <Text
          className="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-gray-200"
          numberOfLines={1}
          style={{ flexShrink: 3 }}
        >
          {it.name}
        </Text>
        <Text
          className="w-11 shrink-0 text-right text-xs font-semibold text-gray-500 dark:text-gray-400"
          numberOfLines={1}
        >
          {labels[i]}
        </Text>
        <Text
          className="ml-2.5 min-w-0 text-sm font-bold text-gray-900 dark:text-gray-100"
          style={{ flexShrink: 1 }}
          {...shrinkProps()}
        >
          {format(it.value)}
        </Text>
      </Pressable>
    );
  });

  return (
    <InsightCard onLayout={onLayout}>
      <Header monthLabel={monthLabel} />
      <View className="w-full">
        <View className={rowLayout ? 'flex-row items-center gap-5' : 'items-center'}>
          <View className={rowLayout ? '' : 'items-center'}>
            <Svg
              width={str(donutSize)}
              height={str(donutSize)}
              accessibilityLabel={t('insights.spendingByCategory')}
            >
              {segments}
              <Circle
                cx={str(cx)}
                cy={str(cy)}
                r={str(rInner - 3)}
                fill={isDark ? '#1f2937' : '#ffffff'}
              />
              {/* Tooltip: the selected slice's name, amount and share. */}
              <SvgText
                x={str(cx)}
                y={str(cy - (selected ? 6 : 2))}
                fontSize={str(Math.min(rInner * (selected ? 0.24 : 0.32), selected ? 15 : 17))}
                fontWeight="700"
                fill={isDark ? '#e5e7eb' : '#111827'}
                textAnchor="middle"
              >
                {selected ? formatCompact(selected.value) : formatCompact(total)}
              </SvgText>
              <SvgText
                x={str(cx)}
                y={str(cy + Math.min(rInner * 0.28, 16))}
                fontSize={str(Math.min(rInner * 0.17, 11))}
                fill={isDark ? '#9ca3af' : '#6b7280'}
                textAnchor="middle"
              >
                {selected ? `${selected.name} · ${selectedLabel}` : t('reports.totalSpent')}
              </SvgText>
            </Svg>
            {selected && onAsk ? (
              <Pressable
                onPress={() => onAsk(selected.name)}
                accessibilityRole="button"
                accessibilityLabel={t('insights.askAboutCategory', { name: selected.name })}
                className="mt-2 flex-row items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 active:bg-brand-100 dark:bg-brand-900/20"
              >
                <Ionicons name="sparkles" size={12} color="#4f46e5" />
                <Text className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                  {t('insights.askAboutCategoryShort')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View className={`min-w-0 flex-1 ${rowLayout ? '' : 'mt-5 w-full'}`}>
            {legend}
            <View className="mt-2 flex-row items-center rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50">
              <Text className="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-gray-100" numberOfLines={1}>
                {t('reports.total')}
              </Text>
              <Text
                className="w-11 shrink-0 text-right text-xs font-semibold text-gray-500 dark:text-gray-400"
                numberOfLines={1}
              >
                100%
              </Text>
              <Text
                className="ml-2.5 min-w-0 text-sm font-bold text-gray-900 dark:text-gray-100"
                style={{ flexShrink: 1 }}
                {...shrinkProps()}
              >
                {format(total)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </InsightCard>
  );
}

function Header({ monthLabel }: { monthLabel: string }) {
  const { t } = useI18n();
  return (
    <View className="mb-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t('insights.spendingByCategory')}
      </Text>
      <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
        {monthLabel}
      </Text>
    </View>
  );
}
