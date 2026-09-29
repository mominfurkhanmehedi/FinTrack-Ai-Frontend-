import { Children, ReactElement, ReactNode, useCallback, useState } from 'react';
import { DimensionValue, LayoutChangeEvent, View, ViewStyle } from 'react-native';

import { insightColumns, insightGap, pagePaddingX } from '../../constants/breakpoints';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, CardProps } from '../ui';

/** `Card` horizontal padding (p-5) on each side. */
export const CARD_PADDING_X = 20;

/**
 * Equal-height row behaviour for cards sitting side by side.
 *
 * `flexBasis: 'auto'` is the important part: the card's base size is its CONTENT
 * height, and it only grows to fill a row that a taller sibling stretched. A card
 * must never use `flex-1` (i.e. `flexBasis: 0%`) here — with a content-sized
 * parent that collapses to nothing on a single-column phone and leaves the big
 * empty panels that used to appear between the header and the spending chart.
 */
const FILL_ROW: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' };

/** Column count + gap the Insights grid resolves to at the current width. */
export function useInsightGrid(): { columns: 1 | 2 | 12; gap: number } {
  const { width } = useBreakpoint();
  return { columns: insightColumns(width), gap: insightGap(width) };
}

/**
 * Style that makes a card fill the height of the grid row it sits in.
 * `undefined` on a single-column phone, where every card is exactly as tall as
 * its own content.
 */
export function useInsightRowFill(): ViewStyle | undefined {
  const { columns } = useInsightGrid();
  return columns > 1 ? FILL_ROW : undefined;
}

/**
 * The width actually available INSIDE an Insights card, so tile counts and chart
 * sizes are derived from the space the card really has instead of a hardcoded
 * breakpoint. Attach the returned `onLayout` to the card root.
 *
 * Before the first measurement it falls back to the window width, which is exact
 * on a phone (one card fills the page). In a multi-column grid the card is a
 * fraction of the window, so `0` is returned instead — callers must handle that
 * rather than render a chart that is briefly sized for a card they are not in.
 */
export function useCardContentWidth(paddingX: number = CARD_PADDING_X): [number, (e: LayoutChangeEvent) => void] {
  const { width } = useBreakpoint();
  const { columns } = useInsightGrid();
  const [measured, setMeasured] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setMeasured(e.nativeEvent.layout.width), []);

  if (measured > 0) return [Math.max(measured - paddingX * 2, 0), onLayout];
  if (columns > 1) return [0, onLayout];
  return [Math.max(width - pagePaddingX(width) * 2 - paddingX * 2, 0), onLayout];
}

/**
 * InsightCard (insights)
 * The card surface used by every Insights panel. Identical styling to `Card`,
 * except that it grows to match the tallest card in its row on multi-column
 * layouts and stays content-sized on a phone.
 */
export function InsightCard({ className, style, ...rest }: CardProps) {
  const fill = useInsightRowFill();
  return <Card {...rest} className={className} style={fill || style ? [fill, style] : undefined} />;
}

export interface InsightPanelProps {
  children: ReactNode;
  /** Span on the 12-column desktop grid. */
  span?: number;
  /** Span on the 2-column tablet grid. Defaults to the desktop span rescaled. */
  tabletSpan?: number;
}

/**
 * InsightPanel (insights)
 * Declares a column span for InsightsLayout and renders no markup itself, the
 * same span contract DashboardLayout / ReportsLayout already use.
 */
export function InsightPanel({ children }: InsightPanelProps) {
  return <>{children}</>;
}

/**
 * InsightsLayout (insights)
 * Professional fintech grid for the AI Insights dashboard.
 *
 *   phone (< 768)       → 1 column: every card takes the full content width and
 *                          is exactly as tall as its content
 *   tablet (768–1023)   → 2 columns, so cards are not stretched to a pointless
 *                          full-screen width; `tabletSpan` tunes each row
 *   desktop (≥ 1024)    → 12 columns: Forecast / Monthly Overview /
 *                          Smart Suggestions sit in one row (4 each),
 *                          Spending chart + Ask FinTrack share the next row
 *                          (7 + 5), the monthly statistics strip spans 12,
 *                          and the calendar (7) sits beside the selected
 *                          date transactions (5)
 *
 * Fluid percentage widths + one shared gap mean no horizontal scrolling and no
 * over-stretched cards at any width. The negative-margin gutter trick is only
 * used for the 12-column grid so a phone card really does use the whole
 * available content width instead of being pulled 6px inwards on each side.
 */
export function InsightsLayout({ children }: { children: ReactNode }) {
  const { columns, gap } = useInsightGrid();
  const single = columns === 1;

  const items = Children.toArray(children).filter(
    (child): child is ReactElement<InsightPanelProps> =>
      typeof child === 'object' && child !== null && 'type' in child,
  );

  return (
    <View className="flex-row flex-wrap items-stretch" style={single ? undefined : { marginHorizontal: -gap / 2 }}>
      {items.map((item, i) => {
        const desktopSpan = Math.min(Math.max(item.props?.span ?? 1, 1), 12);
        const rescaled = item.props?.tabletSpan ?? Math.ceil((desktopSpan / 12) * columns);
        const span = Math.min(Math.max(columns === 12 ? desktopSpan : rescaled, 1), columns);
        const itemWidth = `${(span / columns) * 100}%` as DimensionValue;
        // A single column is a plain vertical stack, so the gap goes on top of
        // each card after the first and there is no trailing gap below the last.
        const first = i === 0;
        return (
          <View
            key={i}
            className="flex"
            style={{
              width: itemWidth,
              paddingHorizontal: single ? 0 : gap / 2,
              paddingTop: single ? (first ? 0 : gap) : 0,
              marginBottom: single ? 0 : gap,
              // Without this a long unbroken amount inside a card can win the
              // width negotiation and push the row wider than the screen.
              minWidth: 0,
            }}
          >
            {item}
          </View>
        );
      })}
    </View>
  );
}
