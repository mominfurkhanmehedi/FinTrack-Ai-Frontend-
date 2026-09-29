import { Children, ReactElement, ReactNode } from 'react';
import { DimensionValue, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';

// Desktop layouts 12-column for balanced chart widths. Below desktop every
// card stacks full width so charts never get squeezed into unreadable
// columns (Summary spans all 12, the two charts split 6/6, Balance spans 12).
const columnsFor = (width: number) => (width < 1024 ? 1 : 12);
const gapFor = (width: number) => (width < 640 ? 12 : width < 1024 ? 16 : 20);

/**
 * ReportPanel (reports)
 * Thin wrapper used ONLY to declare a column span for ReportsLayout
 * (12-col desktop grid; any span on mobile/tablet collapses to full width).
 * Renders no markup itself.
 */
export function ReportPanel({ children }: { children: ReactNode; span?: number }) {
  return <>{children}</>;
}

/**
 * ReportsLayout (reports)
 * Purpose-built responsive grid for the Reports page:
 *
 *   mobile/tablet (< 1024) → 1 column: every card stacks full width
 *   desktop (≥ 1024)       → 12 columns: Summary spans 12, Cash flow and
 *                            Spending by category span 6 each, Balance spans 12
 *
 * Fluid percentage widths + a shared gap mean there is no horizontal scrolling,
 * no excessive empty space, and no stretched/narrowed charts at any width.
 */
export function ReportsLayout({ children }: { children: ReactNode }) {
  const { width } = useBreakpoint();
  const cols = columnsFor(width);
  const gap = gapFor(width);

  const items = Children.toArray(children).filter(
    (child): child is ReactElement<{ span?: number }> =>
      typeof child === 'object' && child !== null && 'type' in child,
  );

  return (
    <View className="flex-row flex-wrap items-stretch" style={{ marginHorizontal: -gap / 2 }}>
      {items.map((item, i) => {
        const span = Math.min(Math.max(item.props?.span ?? 1, 1), cols);
        const itemWidth = `${(span / cols) * 100}%` as DimensionValue;
        return (
          <View
            key={i}
            className="flex"
            style={{ width: itemWidth, paddingHorizontal: gap / 2, marginBottom: gap }}
          >
            {item}
          </View>
        );
      })}
    </View>
  );
}