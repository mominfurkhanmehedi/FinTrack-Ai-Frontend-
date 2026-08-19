import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * HamburgerButton (layout)
 * Top-left menu toggle shown on mobile / narrow web widths to open the
 * slide-in drawer. Sized for a 44x44px touch target.
 */
export function HamburgerButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      className="absolute left-3 items-center justify-center rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
      style={{ top: insets.top + 8, width: 44, height: 44, zIndex: 60 }}
    >
      <Ionicons name="menu-outline" size={26} color="#4f46e5" />
    </Pressable>
  );
}