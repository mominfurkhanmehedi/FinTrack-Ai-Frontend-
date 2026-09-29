import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { LAYOUT } from '../../constants/breakpoints';
import { useBreakpoint } from '../../hooks/useBreakpoint';

/**
 * ScreenHeader (ui)
 * Consistent page title area at the top of every screen. May include a
 * right-aligned `action` (e.g. an "Add" button).
 *
 * Every tab screen has a floating hamburger button pinned to the top-right
 * viewport corner, so the header always reserves room on the right to keep
 * titles/subtitles and action buttons from sliding underneath it. The reserve
 * and the title size are responsive: on a narrow phone the title drops to
 * `text-2xl` so it still fits on one line next to the action, while the
 * subtitle is allowed to wrap onto as many lines as it needs instead of being
 * clipped with an ellipsis.
 */
export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  const { width } = useBreakpoint();
  const compact = width < LAYOUT.smallMobile;

  return (
    <View className="mb-6 flex-row items-start justify-between" style={{ paddingRight: compact ? 60 : 68 }}>
      <View className="min-w-0 flex-1 pr-3">
        <Text
          className={`font-bold tracking-tight text-gray-900 dark:text-gray-100 ${compact ? 'text-2xl' : 'text-3xl'}`}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className={`mt-1 text-gray-500 dark:text-gray-400 ${compact ? 'text-sm' : 'text-base'}`}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
