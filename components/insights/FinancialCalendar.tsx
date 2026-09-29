import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useI18n } from '../../i18n';
import { InsightCard, useCardContentWidth } from './InsightsLayout';
import {
  buildMonthGrid,
  CalendarCell,
  DayIndex,
  shiftMonth,
  shiftYear,
  summarizeDay,
  yearRange,
} from './calendarData';
import { OptionSelect, Option } from './OptionSelect';

export interface FinancialCalendarProps {
  year: number;
  /** 0–11. */
  month: number;
  onMonthChange: (year: number, month: number) => void;
  selectedIso: string;
  onSelectDate: (iso: string) => void;
  /** Local `yyyy-mm-dd` for today. */
  todayIso: string;
  /** Prebuilt `yyyy-mm-dd` → transactions index (no per-day queries). */
  dayIndex: DayIndex;
  /** e.g. "September 2026" */
  monthLabel: string;
}

/** Month names are locale-formatted at render time, never hardcoded per screen. */
function monthOptions(locale: string): Option<number>[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  return Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: formatter.format(new Date(2024, month, 1)),
  }));
}

/**
 * FinancialCalendar (insights)
 * A real, functional month calendar wired to the user's transactions.
 *
 * Navigation is entirely Date-API driven (see `calendarData`), so it stays
 * correct for every month length, leap February, any start weekday and any
 * year in either direction — including the December → January and
 * January → December rollovers. Year and month can also be jumped directly
 * through the selectors, and "Today" returns to the current month and selects
 * today.
 *
 * Every date key is a LOCAL `yyyy-mm-dd` string, matching how transactions are
 * stored, so the highlighted cell always matches the day the user recorded
 * (no UTC off-by-one).
 *
 * Days with activity show up to three subtle dots — income, expense and
 * savings — read from the shared in-memory index, so changing the selected day
 * never triggers a database round-trip.
 */
export function FinancialCalendar({
  year,
  month,
  onMonthChange,
  selectedIso,
  onSelectDate,
  todayIso,
  dayIndex,
  monthLabel,
}: FinancialCalendarProps) {
  const { t, locale, dayShort } = useI18n();
  const { width } = useBreakpoint();
  const [contentWidth, onLayout] = useCardContentWidth();

  const cells = useMemo(() => buildMonthGrid(year, month, todayIso), [year, month, todayIso]);
  const monthOptionsList = useMemo(() => monthOptions(locale), [locale]);
  const yearOptions: Option<number>[] = useMemo(
    () => yearRange(year).map((y) => ({ value: y, label: String(y) })),
    [year],
  );

  const onPrevMonth = () => {
    const next = shiftMonth(year, month, -1);
    onMonthChange(next.year, next.month);
  };
  const onNextMonth = () => {
    const next = shiftMonth(year, month, 1);
    onMonthChange(next.year, next.month);
  };
  const onPrevYear = () => {
    const next = shiftYear(year, month, -1);
    onMonthChange(next.year, next.month);
  };
  const onNextYear = () => {
    const next = shiftYear(year, month, 1);
    onMonthChange(next.year, next.month);
  };
  const onToday = () => {
    const today = new Date(`${todayIso}T00:00:00`);
    onMonthChange(today.getFullYear(), today.getMonth());
    onSelectDate(todayIso);
  };

  // Derived from the card's real width: a 7-column grid of day cells plus the
  // month/year selectors needs less room per cell as the screen narrows, so the
  // day number and the selector widths step down instead of overflowing.
  const compact = contentWidth > 0 ? contentWidth < 300 : width < 420;
  const dayNumberSize = compact ? 12 : 13;
  const cellHeight = compact ? 36 : 40;

  return (
    <InsightCard onLayout={onLayout}>
      <View className="mb-3">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('insights.financialCalendar')}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {monthLabel}
        </Text>
      </View>

      {/* Controls: month stepper + selectors, year stepper + selector, Today.
          The row wraps instead of overflowing, so a 320px phone keeps every
          control reachable. */}
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row items-center gap-1.5">
          <NavButton icon="chevron-back" label={t('insights.calendar.previousMonth')} onPress={onPrevMonth} />
          <OptionSelect
            label={t('insights.calendar.monthLabel')}
            value={month}
            options={monthOptionsList}
            onChange={(m) => onMonthChange(year, m)}
            width={compact ? 118 : 140}
          />
          <NavButton icon="chevron-forward" label={t('insights.calendar.nextMonth')} onPress={onNextMonth} />
        </View>

        <View className="flex-row items-center gap-1.5">
          <NavButton icon="arrow-back" label={t('insights.calendar.previousYear')} onPress={onPrevYear} />
          <OptionSelect
            label={t('insights.calendar.yearLabel')}
            value={year}
            options={yearOptions}
            onChange={(y) => onMonthChange(y, month)}
            width={compact ? 96 : 104}
          />
          <NavButton icon="arrow-forward" label={t('insights.calendar.nextYear')} onPress={onNextYear} />
        </View>

        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityLabel={t('insights.calendar.today')}
          className="flex-row items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 active:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/20"
        >
          <Ionicons name="today-outline" size={14} color="#4f46e5" />
          <Text className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">
            {t('insights.calendar.today')}
          </Text>
        </Pressable>
      </View>

      {/* Weekday header — Sunday-first, matching Date#getDay() and the app's
          `days.short` dictionary. */}
      <View className="mb-1 flex-row">
        {dayShort.map((name, i) => (
          <View key={`h-${i}`} className="flex-1 items-center py-1">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {name}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((cell) => (
          <DayCell
            key={cell.iso}
            cell={cell}
            dayIndex={dayIndex}
            selectedIso={selectedIso}
            onSelect={onSelectDate}
            numberSize={dayNumberSize}
            cellHeight={cellHeight}
          />
        ))}
      </View>

      <View className="mt-3 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Legend color="#16a34a" label={t('insights.calendar.legendIncome')} />
        <Legend color="#dc2626" label={t('insights.calendar.legendExpense')} />
        <Legend color="#4f46e5" label={t('insights.calendar.legendSavings')} />
      </View>
    </InsightCard>
  );
}

function NavButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward' | 'arrow-back' | 'arrow-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      focusable
      hitSlop={6}
      className="h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white active:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:active:bg-gray-800"
    >
      <Ionicons name={icon} size={16} color="#4f46e5" />
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-[11px] text-gray-500 dark:text-gray-400">{label}</Text>
    </View>
  );
}

/** One calendar cell: day number + up to three activity dots. */
function DayCell({
  cell,
  dayIndex,
  selectedIso,
  onSelect,
  numberSize,
  cellHeight,
}: {
  cell: CalendarCell;
  dayIndex: DayIndex;
  selectedIso: string;
  onSelect: (iso: string) => void;
  numberSize: number;
  cellHeight: number;
}) {
  const summary = summarizeDay(cell.iso, dayIndex);
  const isSelected = cell.iso === selectedIso;
  const isDimmed = !cell.inCurrentMonth;

  const a11yBits: string[] = [];
  if (summary.hasIncome) a11yBits.push('income');
  if (summary.hasExpense) a11yBits.push('expense');
  if (summary.hasSavings) a11yBits.push('savings');

  // Today and selected must look different: today = outlined ring, selected =
  // solid brand fill (a selected non-today day), and a selected today keeps the
  // ring on top of the fill.
  const surface = isSelected
    ? 'bg-brand-600 border-brand-600'
    : cell.isToday
      ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/25 dark:border-brand-500'
      : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800';
  const numberTone = isSelected
    ? 'text-white'
    : cell.isToday
      ? 'text-brand-700 dark:text-brand-300'
      : cell.isFuture
        ? 'text-gray-300 dark:text-gray-600'
        : 'text-gray-700 dark:text-gray-200';

  return (
    <View style={{ width: `${100 / 7}%`, padding: 2 }}>
      <Pressable
        onPress={() => onSelect(cell.iso)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${cell.iso}${a11yBits.length ? `, ${a11yBits.join(', ')}` : ''}`}
        focusable
        className={`items-center justify-center rounded-lg border py-1 active:bg-brand-100 dark:active:bg-brand-900/40 ${surface}`}
        style={{ opacity: isDimmed ? 0.4 : 1, minHeight: cellHeight }}
      >
        <Text
          className={`font-semibold ${numberTone}`}
          style={{ fontSize: numberSize, lineHeight: numberSize + 4 }}
        >
          {cell.day}
        </Text>
        <View className="mt-[3px] h-[5px] flex-row items-center">
          {summary.hasIncome ? <Dot color="#22c55e" /> : null}
          {summary.hasExpense ? <Dot color="#ef4444" /> : null}
          {summary.hasSavings ? <Dot color="#4f46e5" /> : null}
        </View>
      </Pressable>
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return <View className="mx-[1px] h-[4px] w-[4px] rounded-full" style={{ backgroundColor: color }} />;
}
