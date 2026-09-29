import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { Platform, Text, TextProps, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Truncation props that behave on every platform: `adjustsFontSizeToFit` is
 * native-only, so on web we rely on `numberOfLines={1}` + flex shrink to stop
 * long currency values from wrapping or overflowing their tile.
 */
export function shrinkProps(): TextProps {
  return Platform.OS === 'web'
    ? { numberOfLines: 1 }
    : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 };
}

/** Font size for a money value, tightened on narrow phones. */
export function useAmountSize(): string {
  const { width } = useBreakpoint();
  return width < 480 ? 'text-[15px]' : width < 1024 ? 'text-[17px]' : 'text-lg';
}

export interface StatTileProps {
  icon?: IoniconName;
  label: string;
  value: string;
  /** Accent colour for the icon + value. */
  color?: string;
  /** Tailwind tint + border classes for the tile surface. */
  tint?: string;
  valueClassName?: string;
  size?: string;
  align?: 'left' | 'right';
  hint?: string;
}

/**
 * StatTile (insights)
 * Compact labelled metric used inside the summary cards. Colours are passed as
 * props (not hardcoded classes) so a tile can be tinted green for income and
 * red for expenses while still reading as one design system.
 */
export function StatTile({
  icon,
  label,
  value,
  color = '#4f46e5',
  tint = 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800',
  valueClassName = 'text-gray-900 dark:text-gray-100',
  size,
  align = 'left',
  hint,
}: StatTileProps) {
  const fallback = useAmountSize();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 min-w-0 rounded-xl border px-3 py-2.5 ${tint}`}
    >
      <View className={`flex-row items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        className={`mt-1 font-bold tracking-tight ${size ?? fallback} ${valueClassName}`}
        style={{ flexShrink: 1 }}
        {...shrinkProps()}
      >
        {value}
      </Text>
      {hint ? <Text className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500" numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

/** Label/value pair used inside the forecast card. */
export function DetailRow({
  label,
  value,
  valueClassName = 'text-gray-900 dark:text-gray-100',
  icon,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon?: IoniconName;
}) {
  return (
    <View className="flex-row items-center justify-between py-[5px]">
      <View className="flex-row items-center gap-1.5 flex-1 min-w-0 pr-3">
        {icon ? <Ionicons name={icon} size={13} color="#9ca3af" /> : null}
        <Text className="text-[13px] text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className={`text-[13px] font-semibold ${valueClassName}`} style={{ flexShrink: 1 }} {...shrinkProps()}>
        {value}
      </Text>
    </View>
  );
}

/** Thin progress bar used for goal progress. */
export function ProgressBar({ pct, tone = '#4f46e5' }: { pct: number; tone?: string }) {
  const clamped = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) : 0;
  return (
    <View
      className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(clamped), min: 0, max: 100 }}
    >
      <View
        className="h-full rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: tone }}
      />
    </View>
  );
}

/** Section heading used inside a card body (smaller than Card's own title). */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {children}
      </Text>
      {right}
    </View>
  );
}
