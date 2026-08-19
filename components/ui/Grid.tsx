import { Children, ReactNode } from 'react';
import { View, DimensionValue } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * ResponsiveGrid (ui)
 * Lays out children in a responsive grid: stacked cards on mobile, multiple
 * columns on tablet/desktop/web driven by the shared useBreakpoint hook.
 */
export function ResponsiveGrid({
  children,
  gap = 12,
}: {
  children: ReactNode;
  gap?: number;
}) {
  const { gridColumns } = useBreakpoint();
  const items = Children.toArray(children);
  const itemWidth = `${100 / gridColumns}%` as DimensionValue;

  return (
    <View className="flex-row flex-wrap items-stretch" style={{ marginHorizontal: -gap / 2 }}>
      {items.map((item, i) => (
        <View
          key={i}
          style={{ width: itemWidth, paddingHorizontal: gap / 2, paddingVertical: gap / 2 }}
        >
          {item}
        </View>
      ))}
    </View>
  );
}
