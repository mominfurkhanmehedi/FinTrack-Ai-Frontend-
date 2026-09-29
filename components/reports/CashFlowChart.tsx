import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useMoney } from '../../hooks/useMoney';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { Transaction } from '../../types';
import { Card, EmptyState, POINTER_EVENTS } from '../ui';
import { ChartTooltip } from './ChartTooltip';
import { clamp, niceMax, roundedBarPath, str } from './reportChartMath';
import { buildCashFlow, CASH_FLOW_DAYS } from './reportData';

const INCOME_COLOR = '#22c55e';
const EXPENSE_COLOR = '#ef4444';
const Y_TICKS = 4;

/**
 * CashFlowChart (reports)
 * Grouped bar chart of the trailing 7 days: Income (green) vs Expenses (red).
 * A custom react-native-svg renderer so the currency is always dynamic: axis
 * ticks, value labels, and the hover/tap tooltip all go through `useMoney`.
 * Labels ("Income"/"Expenses") plus colored dots keep the two series distinct
 * beyond color alone.
 */
export function CashFlowChart({ transactions }: { transactions: Transaction[] }) {
  const { format, formatCompact } = useMoney();
  const { isDark } = useTheme();
  const { width } = useBreakpoint();
  const { t, dayShort, dayFull } = useI18n();
  const [measured, setMeasured] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const days = useMemo(() => buildCashFlow(transactions, CASH_FLOW_DAYS), [transactions]);
  const totals = useMemo(
    () => ({
      income: days.reduce((s, d) => s + d.income, 0),
      expenses: days.reduce((s, d) => s + d.expenses, 0),
    }),
    [days],
  );

  const onLayout = (e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width);
  const w = measured;

  if (totals.income + totals.expenses <= 0) {
    return (
      <Card>
        <Header subtitle={t('reports.cashFlowSubtitle')} />
        <EmptyState
          icon="swap-horizontal"
          title={t('reports.noCashFlowTitle')}
          message={t('reports.noCashFlowMessage')}
        />
      </Card>
    );
  }

  const height = Math.round(clamp(w * 0.5, 200, 280));
  const scaleMax = niceMax(Math.max(totals.income, totals.expenses, 1));
  const ticks = Array.from({ length: Y_TICKS + 1 }, (_, t) => (scaleMax * t) / Y_TICKS);

  const widestLabel = Math.max(...ticks.map((t) => formatCompact(t).length));
  const GUTTER = Math.max(44, Math.min(64, widestLabel * 6.5 + 16));
  const TOP_PAD = 18;
  const X_LABEL_H = 18;
  const RIGHT_PAD = 4;

  const plotX0 = GUTTER;
  const plotY0 = TOP_PAD;
  const plotY1 = height - X_LABEL_H;
  const plotW = Math.max(w - GUTTER - RIGHT_PAD, 40);
  const plotH = Math.max(plotY1 - plotY0, 40);

  const slotW = plotW / CASH_FLOW_DAYS;
  const barW = Math.min(slotW * 0.24, 20);
  const offset = barW * 0.62 + 1;
  const barR = Math.min(barW / 2, 7);
  const showValues = width >= 640 && slotW >= 64;

  const y = (v: number) => plotY0 + plotH - (v / scaleMax) * plotH;
  const slotCenterX = (i: number) => plotX0 + slotW * i + slotW / 2;

  const grid = ticks.map((t, ti) => (
    <G key={`grid-${ti}`}>
      <Line
        x1={str(plotX0)}
        y1={str(y(t))}
        x2={str(w - RIGHT_PAD)}
        y2={str(y(t))}
        stroke={isDark ? '#374151' : '#eef0f3'}
        strokeWidth={str(1)}
        strokeDasharray={ti === 0 ? undefined : '4 6'}
      />
      <SvgText x={str(plotX0 - 8)} y={str(y(t) + 4)} fontSize={str(10)} fill={isDark ? '#9ca3af' : '#6b7280'} textAnchor="end">
        {formatCompact(t)}
      </SvgText>
    </G>
  ));

  const series: { color: string; name: string; get: (i: number) => number }[] = [
    { color: INCOME_COLOR, name: t('reports.income'), get: (i) => days[i].income },
    { color: EXPENSE_COLOR, name: t('reports.expenses'), get: (i) => days[i].expenses },
  ];

  const bars = days.map((d, i) => {
    const cx = slotCenterX(i);
    return (
      <G key={`day-${i}`}>
        {series.map((s, si) => {
          const v = s.get(i);
          if (v <= 0) {
            return (
              <Rect
                key={si}
                x={str(cx + (si === 0 ? -offset : offset) - barW / 2)}
                y={str(y(0) - 2)}
                width={str(barW)}
                height={str(2)}
                rx={str(1)}
                fill={isDark ? '#374151' : '#e5e7eb'}
              />
            );
          }
          const h = Math.max(y(0) - y(v), 2);
          const y0 = y(v);
          return (
            <G key={si}>
              <Path d={roundedBarPath(cx + (si === 0 ? -offset : offset) - barW / 2, y0, barW, h, barR)} fill={s.color} />
              {showValues && (
                <SvgText
                  x={str(cx + (si === 0 ? -offset : offset))}
                  y={str(y0 - 5)}
                  fontSize={str(9)}
                  fontWeight="600"
                  fill={s.color}
                  textAnchor="middle"
                >
                  {formatCompact(v)}
                </SvgText>
              )}
            </G>
          );
        })}
      </G>
    );
  });

  const xLabels = days.map((d, i) => (
    <SvgText key={`xl-${i}`} x={str(slotCenterX(i))} y={str(height - 6)} fontSize={str(10)} fill={isDark ? '#9ca3af' : '#6b7280'} textAnchor="middle">
      {dayShort[d.date.getDay()]}
    </SvgText>
  ));

  const TOOLTIP_W = 150;
  const tooltipLeft =
    active != null ? clamp(slotCenterX(active) - TOOLTIP_W / 2, 4, Math.max(w - TOOLTIP_W - 4, 4)) : 0;

  return (
    <Card>
      <Header subtitle={t('reports.cashFlowSubtitle')} />

      <View className="mb-3 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendChip color={INCOME_COLOR} label={t('reports.income')} value={format(totals.income)} />
        <LegendChip color={EXPENSE_COLOR} label={t('reports.expenses')} value={format(totals.expenses)} />
      </View>

      <View className="w-full" onLayout={onLayout} style={{ position: 'relative' }}>
        {w > 0 && (
          <>
            <Svg width={str(w)} height={str(height)}>
              {grid}
              {bars}
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
              {days.map((d, i) => (
                <Pressable
                  key={`press-${i}`}
                  className="flex-1"
                  onPress={() => setActive((cur) => (cur === i ? null : i))}
                  onHoverIn={() => setActive(i)}
                  onHoverOut={() => setActive(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${dayFull[d.date.getDay()]}: ${t('reports.income')} ${format(d.income)}, ${t('reports.expenses')} ${format(d.expenses)}`}
                />
              ))}
            </View>

            {active != null && (
              <ChartTooltip
                title={dayFull[days[active].date.getDay()]}
                rows={[
                  { label: t('reports.income'), value: format(days[active].income), color: INCOME_COLOR },
                  { label: t('reports.expenses'), value: format(days[active].expenses), color: EXPENSE_COLOR },
                ]}
                style={{ left: tooltipLeft, top: 4 }}
              />
            )}
          </>
        )}
      </View>
    </Card>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  const { t } = useI18n();

  return (
    <View className="mb-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('reports.cashFlow')}</Text>
      <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</Text>
    </View>
  );
}

function LegendChip({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      <View className="h-2.5 w-2.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1.5">{label}</Text>
      <Text className="text-xs font-bold text-gray-900 dark:text-gray-100">{value}</Text>
    </View>
  );
}