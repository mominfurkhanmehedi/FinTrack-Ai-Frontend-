import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useBreakpoint } from '../../hooks/useBreakpoint';
import { MAX_CONTENT_WIDTH } from '../../constants/breakpoints';

/**
 * ResponsiveContainer (ui)
 * Scrollable, horizontally centered page wrapper used by every screen.
 * On mobile it is full width; on wider screens content is constrained to
 * MAX_CONTENT_WIDTH and centered for readability.
 */
export function ResponsiveContainer({
  children,
  scrollable = true,
}: {
  children: ReactNode | ((bp: ReturnType<typeof useBreakpoint>) => ReactNode);
  scrollable?: boolean;
}) {
  const bp = useBreakpoint();

  const content = (
    <View
      className={`w-full self-center px-4 py-6 ${scrollable ? '' : 'flex-1'}`}
      style={bp.width > MAX_CONTENT_WIDTH ? { width: MAX_CONTENT_WIDTH } : undefined}
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