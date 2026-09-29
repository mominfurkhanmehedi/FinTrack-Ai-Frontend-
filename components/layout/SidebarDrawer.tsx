import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { POINTER_EVENTS } from '../ui';
import { SidebarNav } from './SidebarNav';

const DRAWER_WIDTH = 280;

// Shadows: `shadow*` style props are deprecated on web, so use boxShadow there
// while keeping the native shadow/elevation rendering intact.
const drawerShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)' },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});

/**
 * SidebarDrawer (layout)
 * Slide-in navigation drawer that opens from the RIGHT edge of the screen.
 *
 * - The drawer PANEL is always mounted (so it can animate in/out) but while
 *   closed it is held fully outside the viewport via translateX(100%) and set
 *   to a low z-index with `style.pointerEvents: 'none'` — it never sits above or
 *   blocks the dashboard / bottom navigation.
 * - The BACKDROP is only rendered while the drawer is open and closes the
 *   drawer when tapped. The X button in the panel header also closes it.
 */
export function SidebarDrawer({
  open,
  onClose,
  active,
}: {
  open: boolean;
  onClose: () => void;
  active: string;
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { t } = useI18n();
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      // Native driver is not supported on web — fall back to the JS driver there.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [open, progress]);

  // 0 → translateX(DRAWER_WIDTH) (fully off-screen right)
  // 1 → translateX(0) (slid in against the right edge)
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  // Fixed to the viewport on web for a true overlay (height 100vh); absolute
  // (full-screen parent) on native. RN's DimensionValue type doesn't model
  // "vh", so cast it — react-native-web handles it correctly at runtime.
  const overlayStyle =
    Platform.OS === 'web'
      ? { position: 'fixed' as const, top: 0, left: 0, right: 0, height: '100vh' as never }
      : { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

  const panelStyle =
    Platform.OS === 'web'
      ? { position: 'fixed' as const, top: 0, right: 0, height: '100vh' as never }
      : { position: 'absolute' as const, top: 0, right: 0, bottom: 0 };

  const navigate = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <>
      {/* Backdrop — exists ONLY while the sidebar is open (requirement: the
          overlay must not linger when closed). Tapping it closes the drawer. */}
      {open && (
        <Animated.View
          style={[
            overlayStyle,
            { zIndex: 1000, backgroundColor: '#000', opacity: backdropOpacity },
          ]}
        >
          <Pressable
            className="flex-1"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('nav.closeMenu')}
          />
        </Animated.View>
      )}

      {/* Drawer panel — pinned to the right edge, full height. When closed it
          sits outside the viewport (translateX(100%)), at z-index 0 and with
          pointer events disabled, so it never overlaps the page or intercepts
          taps on the dashboard / bottom navigation while animating out. */}
      <Animated.View
        style={[
          panelStyle,
          {
            right: 0,
            width: DRAWER_WIDTH,
            backgroundColor: isDark ? '#111827' : '#ffffff',
            transform: [{ translateX }],
            zIndex: open ? 1100 : 0,
            elevation: 16,
            ...drawerShadow,
          },
          // Applied via style rather than the deprecated `pointerEvents` prop.
          open ? POINTER_EVENTS.auto : POINTER_EVENTS.none,
        ]}
        accessibilityViewIsModal={open}
      >
        <View style={{ paddingTop: insets.top + 12 }} className="px-4 pb-4 flex-row items-center justify-between border-b border-gray-200 dark:border-gray-800">
          <View className="flex-row items-center gap-2">
            <View className="w-9 h-9 rounded-xl bg-brand-600 items-center justify-center">
              <Ionicons name="logo-electron" size={20} color="#ffffff" />
            </View>
            <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">FinTrack AI</Text>
          </View>
          <Pressable
            onPress={onClose}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel={t('nav.closeMenu')}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <View className="px-3 py-4 flex-1">
          <SidebarNav active={active} onSelect={navigate} />
        </View>
      </Animated.View>
    </>
  );
}