import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useMoney } from '../../hooks/useMoney';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { Transaction } from '../../types';
import { formatDate } from '../../utils';
import { Card, EmptyState, POINTER_EVENTS } from '../ui';
import { ChartTooltip } from './ChartTooltip';
import { buildPath, clamp, str } from './reportChartMath';
import { buildBalanceSeries } from './reportData';
import { RangeSelector } from './RangeSelector';

const BRAND = '#4f46e5';
const POSITIVE = '#22c55e';
const NEGATIVE = '#ef4444';
const Y_TICKS = 4;

/**
 * BalanceOverTimeChart (reports)
 * The user's REAL balance history, day by day. Every point is the running
 * total of actual income minus expenses (balance = previous balance + income −
 * expenses); quiet days carry the balance forward instead of inventing zeros.
 *
 * A date-range selector (7D → 1Y) rebuilds the series from the same store
 * transactions, so it always reflects real data. Axes and the hover/tap tooltip
 * are currency-formatted through the shared `useMoney` formatter.
 */
export function BalanceOverTimeChart({ transactions }: { transactions: Transaction[] }) {
  const { format, formatCompact } = useMoney();
  const { isDark } = useTheme();
  const { t, locale, dayShort } = useI18n();
  const [range, setRange] = useState(30);
  const [measured, setMeasured] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const points = useMemo(() => buildBalanceSeries(transactions, range), [transactions, range]);
  const hasBalance = useMemo(
    () => points.some((p) => p.balance !== 0) || points.some((p) => p.hasActivity),
    [points],
  );

  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  const w = measured;

  const header = (
    <View className="mb-4 w-full flex-row flex-wrap items-start justify-between gap-3">
      <View className="flex-1 min-w-0 pr-2">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('balanceOverTime.title')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {t('balanceOverTime.subtitle')}
        </Text>
      </View>
      {hasBalance ? (
        <View className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 dark:border-brand-800 dark:bg-brand-900/20">
          <Text className="text-[11px] font-medium text-brand-700 dark:text-brand-300">
            {t('safeToSpend.currentBalance')}
          </Text>
          <Text className="text-sm font-bold text-brand-800 dark:text-brand-200">
            {format(points[points.length - 1].balance)}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (!hasBalance) {
    return (
      <Card>
        {header}
        <RangeSelector value={range} onChange={setRange} />
        <EmptyState
          icon="trending-up"
          title={t('balanceOverTime.noDataTitle')}
          message={t('balanceOverTime.noDataMessage')}
        />
      </Card>
    );
  }

  const height = Math.round(clamp(w * 0.42, 200, 290));
  const n = points.length;
  const formatAxisDate = (date: Date, rangeDays: number) => {
    if (rangeDays <= 7) return dayShort[date.getDay()];
    if (rangeDays <= 30) return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    return date.toLocaleDateString(locale, { month: 'short' });
  };

  const balanceValues = points.map((p) => p.balance);
  const minV = Math.min(...balanceValues, 0);
  const maxV = Math.max(...balanceValues, 0);
  const span = Math.max(maxV - minV, 1);
  const topV = maxV + span * 0.08;
  const bottomV = minV - span * 0.08;

  const ticks = Array.from({ length: Y_TICKS + 1 }, (_, t) => bottomV + ((topV - bottomV) * t) / Y_TICKS);
  const widestLabel = Math.max(...ticks.map((t) => formatCompact(t).length));
  const GUTTER = Math.max(44, Math.min(72, widestLabel * 6.5 + 16));
  const TOP_PAD = 18;
  const X_LABEL_H = 18;
  const RIGHT_PAD = 4;

  const plotX0 = GUTTER;
  const plotY0 = TOP_PAD;
  const plotY1 = height - X_LABEL_H;
  const plotW = Math.max(w - GUTTER - RIGHT_PAD, 40);
  const plotH = Math.max(plotY1 - plotY0, 40);

  const y = (v: number) => plotY0 + plotH - ((v - bottomV) / (topV - bottomV)) * plotH;
  const x = (i: number) => plotX0 + (i * plotW) / Math.max(n - 1, 1);

  const grid = ticks.map((t, ti) => (
    <G key={`grid-${ti}`}>
      <Line
        x1={str(plotX0)}
        y1={str(y(t))}
        x2={str(w - RIGHT_PAD)}
        y2={str(y(t))}
        stroke={isDark ? '#374151' : '#eef0f3'}
        strokeWidth={str(1)}
        strokeDasharray={ti === 0 || ti === Y_TICKS ? undefined : '4 6'}
      />
      <SvgText x={str(plotX0 - 8)} y={str(y(t) + 4)} fontSize={str(10)} fill={isDark ? '#9ca3af' : '#6b7280'} textAnchor="end">
        {formatCompact(t)}
      </SvgText>
    </G>
  ));

  const zeroLine = minV < 0 && maxV > 0 ? (
    <Line
      x1={str(plotX0)}
      y1={str(y(0))}
      x2={str(w - RIGHT_PAD)}
      y2={str(y(0))}
      stroke={isDark ? '#6b7280' : '#d1d5db'}
      strokeWidth={str(1)}
      strokeDasharray="2 4"
    />
  ) : null;

  const linePath = buildPath(points.map((p, i) => ({ x: x(i), y: y(p.balance) })));
  const areaPath = linePath
    ? `${linePath} L ${x(n - 1)} ${plotY1} L ${x(0)} ${plotY1} Z`
    : '';

  const dots = points
    .map((p, i) =>
      p.hasActivity ? (
        <Circle key={`dot-${i}`} cx={str(x(i))} cy={str(y(p.balance))} r={str(3.2)} fill={BRAND} />
      ) : null,
    )
    .filter(Boolean);

  const isLastIndex = (i: number) => i === n - 1;
  const labelStep = Math.max(Math.ceil(n / 6), 1);
  const xLabels = points
    .map((p, i) =>
      i % labelStep === 0 || isLastIndex(i) || i === 0 ? (
        <SvgText
          key={`xl-${i}`}
          x={str(x(i))}
          y={str(height - 6)}
          fontSize={str(10)}
          fill={isDark ? '#9ca3af' : '#6b7280'}
          textAnchor={isLastIndex(i) ? 'end' : i === 0 ? 'start' : 'middle'}
        >
          {formatAxisDate(p.date, range)}
        </SvgText>
      ) : null,
    )
    .filter(Boolean);

  const zones = Math.min(n, 16);
  const zoneW = plotW / zones;
  const snapIndex = (i: number) => Math.round(((i + 0.5) / zones) * (n - 1));
  const TOOLTIP_W = 158;
  const tooltipLeft =
    active != null
      ? clamp(x(snapIndex(active)) - TOOLTIP_W / 2, 4, Math.max(w - TOOLTIP_W - 4, 4))
      : 0;

  const tooltipRows = active != null
    ? (() => {
        const p = points[snapIndex(active)];
        const rows = [{ label: t('reports.balance'), value: format(p.balance), color: p.balance >= 0 ? POSITIVE : NEGATIVE }];
        if (p.hasActivity) {
          rows.push({ label: t('reports.income'), value: format(p.income), color: POSITIVE });
          rows.push({ label: t('reports.expenses'), value: format(p.expenses), color: NEGATIVE });
        }
        return rows;
      })()
    : [];

  return (
    <Card>
      {header}
      <RangeSelector value={range} onChange={setRange} />

      <View className="w-full" onLayout={onLayout} style={{ position: 'relative' }}>
        {w > 0 && (
          <>
            <Svg width={str(w)} height={str(height)}>
              {grid}
              {zeroLine}
              {areaPath ? <Path d={areaPath} fill={BRAND} fillOpacity={isDark ? 0.08 : 0.06} /> : null}
              {linePath ? (
                <Path
                  d={linePath}
                  fill="none"
                  stroke={BRAND}
                  strokeWidth={str(2.4)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {dots}
              <Circle cx={str(x(n - 1))} cy={str(y(points[n - 1].balance))} r={str(4.5)} fill="#ffffff" stroke={BRAND} strokeWidth={str(2.5)} />
              {xLabels}
            </Svg>

            <View
              className="absolute"
              style={[
                {
                  position: 'absolute',
                  left: plotX0,
                  top: 0,
                  width: plotW,
                  height,
                },
                POINTER_EVENTS.boxNone,
              ]}
            >
              {Array.from({ length: zones }, (_, i) => (
                <Pressable
                  key={`z-${i}`}
                  className="flex-1"
                  onPress={() => setActive((cur) => (cur === i ? null : i))}
                  onHoverIn={() => setActive(i)}
                  onHoverOut={() => setActive(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDate(points[snapIndex(i)].iso, locale)}: ${t('reports.balance')} ${format(points[snapIndex(i)].balance)}`}
                />
              ))}
            </View>

            {active != null && tooltipRows.length > 0 && (
              <ChartTooltip
                title={formatDate(points[snapIndex(active)].iso, locale)}
                rows={tooltipRows}
                style={{ left: tooltipLeft, top: 4 }}
              />
            )}
          </>
        )}
      </View>
    </Card>
  );
}