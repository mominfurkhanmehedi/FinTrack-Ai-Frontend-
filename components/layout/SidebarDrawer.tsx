import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { SidebarNav } from './SidebarNav';

const DRAWER_WIDTH = 280;

/**
 * SidebarDrawer (layout)
 * Slide-in navigation drawer shown on mobile / narrow web widths instead of
 * the fixed desktop sidebar. Slides from the RIGHT with a semi-transparent
 * backdrop; closes on backdrop tap, X, or navigation.
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
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const navigate = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <View
      className="absolute inset-0 z-50"
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityViewIsModal={open}
    >
      {/* Backdrop */}
      <Animated.View className="absolute inset-0 bg-black" style={{ opacity: backdropOpacity }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" />
      </Animated.View>

      {/* Drawer panel — solid/opaque background so page content never bleeds through */}
      <Animated.View
        className="absolute top-0 bottom-0"
        style={{
          width: DRAWER_WIDTH,
          right: 0,
          transform: [{ translateX }],
          backgroundColor: isDark ? '#111827' : '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 16,
          zIndex: 2,
        }}
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
            accessibilityLabel="Close menu"
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#6b7280" />
          </Pressable>
        </View>

        <View className="px-3 py-4 flex-1">
          <SidebarNav active={active} onSelect={navigate} />
        </View>
      </Animated.View>
    </View>
  );
}