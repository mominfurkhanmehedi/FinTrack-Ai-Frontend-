import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { COLORS } from '../../constants/theme';
import { useMoney, useTheme } from '../../hooks';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { Transaction } from '../../types';
import { isoToday, sumByType } from '../../utils';
import { EmptyState, POINTER_EVENTS } from '../ui';

const DAY_COUNT = 7;
const Y_TICKS = 4;

// str: never emit NaN/Infinity into SVG attributes (crashes SVG parsing).
const str = (n: number): string => (Number.isFinite(n) ? String(n) : '0');

interface DayDatum {
  iso: string;
  weekday: number;
  spent: number;
}

/** Expense totals for the trailing 7 days (oldest → today). Income excluded. */
function buildDays(txs: Transaction[]): DayDatum[] {
  const days: DayDatum[] = [];
  for (let i = DAY_COUNT - 1; i >= 0; i--) {
    const iso = isoToday(i);
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    days.push({
      iso,
      weekday: date.getDay(),
      spent: sumByType(txs.filter((t) => t.date === iso), 'expense'),
    });
  }
  return days;
}

/**
 * Round a value up to a "nice" scale for the axis (1, 2, 2.5, 5, 10 × 10ⁿ) so
 * tick labels stay round without sized padding or clipping.
 */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(v));
  const frac = v / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

/** Rounded-top bar path; keeps the bottom flush with the axis. */
function roundedBarPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return (
    `M ${x} ${y + h} ` +
    `L ${x} ${y + rr} ` +
    `Q ${x} ${y} ${x + rr} ${y} ` +
    `L ${x + w - rr} ${y} ` +
    `Q ${x + w} ${y} ${x + w} ${y + rr} ` +
    `L ${x + w} ${y + h} Z`
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * SpendingOverview (dashboard)
 * "Last 7 days" expense bar chart for the Spending overview card. Custom
 * react-native-svg renderer so currency is always dynamic (no hardcoded $),
 * with an on-tap/on-hover tooltip, an emphasis on the highest-spending day,
 * and a clean empty state. Formatters come from the shared `useMoney` hook.
 */
export function SpendingOverview() {
  const transactions = useAppStore((s) => s.transactions);
  const { convert, formatValue, formatCompactValue } = useMoney();
  const { isDark } = useTheme();
  const { t, dayShort, dayFull } = useI18n();

  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // `buildDays` totals stored expenses, which are already in the selected
  // currency. The bars are plotted from those same numbers, so the geometry, the
  // axis scale and the axis labels all describe one value (hence
  // `formatCompactValue`, which never converts a second time). `totalSpent` is
  // their sum, so the headline total is exactly the sum of the bars above it.
  const days = useMemo(() => {
    const base = buildDays(transactions);
    return base.map((d) => ({ ...d, spent: convert(d.spent) ?? d.spent }));
  }, [transactions, convert]);
  const totalSpent = useMemo(() => days.reduce((sum, d) => sum + d.spent, 0), [days]);
  const maxSpent = useMemo(() => Math.max(...days.map((d) => d.spent), 0), [days]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (totalSpent <= 0) {
    return (
      <View className="w-full" onLayout={onLayout}>
        <EmptyState
          icon="bar-chart-outline"
          title={t('dashboard.noSpendingRecorded')}
          message={t('dashboard.noSpendingMessage')}
        />
      </View>
    );
  }

  const height = Math.round(clamp(width * 0.55, 180, 250));
  const scaleMax = niceMax(maxSpent);
  const ticks = Array.from({ length: Y_TICKS + 1 }, (_, t) => (scaleMax * t) / Y_TICKS);

  const widestLabel = Math.max(...ticks.map((t) => formatCompactValue(t).length));
  const GUTTER = Math.max(44, Math.min(64, widestLabel * 6.5 + 16));
  const TOP_PAD = 16;
  const X_LABEL_H = 18;
  const RIGHT_PAD = 8;

  const plotX0 = GUTTER;
  const plotY0 = TOP_PAD;
  const plotY1 = height - X_LABEL_H;
  const plotW = Math.max(width - GUTTER - RIGHT_PAD, 40);
  const plotH = Math.max(plotY1 - plotY0, 40);

  const slotW = plotW / DAY_COUNT;
  const barW = Math.min(slotW * 0.56, 34);
  const barR = Math.min(barW / 2, 8);
  const showValues = slotW >= 56;

  const y = (v: number) => plotY0 + plotH - (v / scaleMax) * plotH;
  const slotCenterX = (i: number) => plotX0 + slotW * i + slotW / 2;

  const grid = ticks.map((t, ti) => (
    <G key={`grid-${ti}`}>
      <Line
        x1={str(plotX0)}
        y1={str(y(t))}
        x2={str(width - RIGHT_PAD)}
        y2={str(y(t))}
        stroke={isDark ? '#374151' : '#eef0f3'}
        strokeWidth={str(1)}
        strokeDasharray={ti === 0 ? undefined : '4 6'}
      />
      <SvgText x={str(plotX0 - 8)} y={str(y(t) + 4)} fontSize={str(10)} fill={isDark ? '#9ca3af' : '#6b7280'} textAnchor="end">
        {formatCompactValue(t)}
      </SvgText>
    </G>
  ));

  const bars = days.map((d, i) => {
    const cx = slotCenterX(i);
    const x0 = cx - barW / 2;
    if (d.spent <= 0) {
      return (
        <G key={`bar-${i}`}>
          <Rect x={str(x0)} y={str(y(0) - 3)} width={str(barW)} height={str(3)} rx={str(1.5)} fill={isDark ? '#374151' : '#e5e7eb'} />
        </G>
      );
    }
    const isMax = d.spent === maxSpent;
    const h = Math.max(y(0) - y(d.spent), 2);
    const y0 = y(d.spent);
    return (
      <G key={`bar-${i}`}>
        <Path d={roundedBarPath(x0, y0, barW, h, barR)} fill={COLORS.brand} fillOpacity={isMax ? 1 : 0.45} />
        {showValues && (
          <SvgText
            x={str(cx)}
            y={str(y0 - 6)}
            fontSize={str(10)}
            fontWeight="600"
            fill={isMax ? COLORS.brand : isDark ? '#a5b4fc' : '#818cf8'}
            textAnchor="middle"
          >
            {formatCompactValue(d.spent)}
          </SvgText>
        )}
      </G>
    );
  });

  const xLabels = days.map((d, i) => (
    <SvgText key={`xl-${i}`} x={str(slotCenterX(i))} y={str(height - 6)} fontSize={str(10)} fill={isDark ? '#9ca3af' : '#6b7280'} textAnchor="middle">
      {dayShort[d.weekday]}
    </SvgText>
  ));

  const tooltipTipW = 128;
  const tooltipLeft =
    active != null
      ? clamp(slotCenterX(active) - tooltipTipW / 2, 4, Math.max(width - tooltipTipW - 4, 4))
      : 0;

  return (
    <View className="w-full" onLayout={onLayout}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('dashboard.last7Days')}
        </Text>
        <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.totalSpent')}: {formatValue(totalSpent)}
        </Text>
      </View>

      {width === 0 ? (
        <View style={{ height }} />
      ) : (
        <View className="w-full" style={{ position: 'relative' }}>
          <Svg width={str(width)} height={str(height)}>
            {grid}
            {bars}
            {xLabels}
          </Svg>

          <View className="absolute inset-0 flex-row" style={POINTER_EVENTS.boxNone}>
            {days.map((d, i) => (
              <Pressable
                key={`press-${i}`}
                className="flex-1"
                onPress={() => setActive((cur) => (cur === i ? null : i))}
                onHoverIn={() => setActive(i)}
                onHoverOut={() => setActive(null)}
                accessibilityLabel={`${dayFull[d.weekday]}, ${formatValue(d.spent)}`}
              />
            ))}
          </View>

          {active != null && (
            <View
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
              style={[
                POINTER_EVENTS.none,
                {
                  position: 'absolute',
                  top: 4,
                  left: tooltipLeft,
                  width: tooltipTipW,
                  ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' } : { elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }),
                },
              ]}
            >
              <Text className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {dayFull[days[active].weekday]}
              </Text>
              <Text className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">
                {days[active].spent > 0 ? formatValue(days[active].spent) : t('dashboard.noSpending')}
              </Text>
              {days[active].spent > 0 && (
                <Text className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t('dashboard.spent')}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}