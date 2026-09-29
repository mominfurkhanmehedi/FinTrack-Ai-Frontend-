import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT, MAX_CONTENT_WIDTH } from '../../constants/breakpoints';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * ResponsiveContainer (ui)
 * Scrollable, horizontally centered page wrapper used by every screen.
 * On mobile it is full width with tight padding; on wider screens padding
 * grows and content is constrained to MAX_CONTENT_WIDTH and centered, so the
 * dashboard never leaves excessive empty gutters on desktop.
 *
 * The scrollable variant also adds the bottom safe-area inset to its content, so
 * the last card of a page can never end up flush against the bottom tab bar (or
 * under a gesture bar on a device with no hardware navigation).
 */
export function ResponsiveContainer({
  children,
  scrollable = true,
}: {
  children: ReactNode | ((bp: ReturnType<typeof useBreakpoint>) => ReactNode);
  scrollable?: boolean;
}) {
  const bp = useBreakpoint();
  const insets = useSafeAreaInsets();

  const paddingX = bp.width < LAYOUT.largeMobile ? 16 : bp.width < LAYOUT.tablet ? 24 : 32;
  const paddingY = bp.width < LAYOUT.largeMobile ? 24 : 32;

  const content = (
    <View
      className={`w-full self-center ${scrollable ? '' : 'flex-1'}`}
      style={{
        paddingHorizontal: paddingX,
        paddingTop: paddingY,
        paddingBottom: scrollable ? paddingY + Math.max(insets.bottom, 8) : paddingY,
        alignSelf: 'center',
        maxWidth: MAX_CONTENT_WIDTH,
      }}
    >
      {typeof children === 'function' ? children(bp) : children}
    </View>
  );

  if (!scrollable) {
    return <View className="flex-1 self-center bg-gray-50 dark:bg-gray-950">{content}</View>;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ flexGrow: 1 }}>
      {content}
    </ScrollView>
  );
}