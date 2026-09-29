import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';

/**
 * HamburgerButton (layout)
 * Top-right button that OPENS the slide-in sidebar.
 *
 * It only ever sets the sidebar open (never toggles, never closes). Closing is
 * handled by the X button inside the sidebar or by tapping the backdrop, so
 * there is a single source of truth for the open/close state. Hidden while the
 * sidebar is open so it cannot cover the sidebar's X button.
 */
export function HamburgerButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav.openMenu')}
      hitSlop={8}
      className="absolute right-3 items-center justify-center rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
      style={{ top: insets.top + 8, width: 44, height: 44, zIndex: 1200 }}
    >
      <Ionicons name="menu-outline" size={26} color="#4f46e5" />
    </Pressable>
  );
}