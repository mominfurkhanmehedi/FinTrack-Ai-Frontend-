import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';

import { HamburgerButton } from '../../components/layout/HamburgerButton';
import { SidebarDrawer } from '../../components/layout/SidebarDrawer';
import { useI18n, type TranslationKey } from '../../i18n';
import { useActiveRoute } from '../../hooks/useActiveRoute';

/**
 * TABS GROUP LAYOUT
 * Single <Tabs> navigator for all 5 main tabs.
 *
 * Navigation is a slide-in <SidebarDrawer> at every screen size (desktop/web
 * and mobile alike). The sidebar is CLOSED by default (`isSidebarOpen` starts
 * `false`) and is never auto-opened on load, refresh, navigation, or re-render.
 *
 * - The top-right hamburger ONLY opens the sidebar (sets `isSidebarOpen` true).
 * - The X button inside the sidebar ONLY closes it (sets it false).
 * - Tapping the backdrop also closes it.
 *
 * One boolean `isSidebarOpen` is the single source of truth for the
 * open/close state — there are no duplicate drawer components or conflicting
 * states. The sidebar overlays (never pushes) the page when open and is fully
 * out of the viewport when closed.
 *
 * The `tabBar` prop must be a STABLE reference (useCallback) to avoid React
 * Navigation re-subscribing on every render ("Maximum update depth exceeded").
 */

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
  dashboard: { focused: 'home', unfocused: 'home-outline' },
  transactions: { focused: 'swap-horizontal', unfocused: 'swap-horizontal-outline' },
  insights: { focused: 'sparkles', unfocused: 'sparkles-outline' },
  budget: { focused: 'wallet', unfocused: 'wallet-outline' },
  reports: { focused: 'bar-chart', unfocused: 'bar-chart-outline' },
  settings: { focused: 'settings', unfocused: 'settings-outline' },
};

const TAB_LABELS: Record<string, TranslationKey> = {
  dashboard: 'nav.dashboard',
  transactions: 'nav.transactions',
  insights: 'nav.insights',
  budget: 'nav.budget',
  reports: 'nav.reports',
  settings: 'nav.settings',
};

export default function TabsLayout() {
  const { t } = useI18n();
  const active = useActiveRoute();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={({ route }) => {
          const icon = TAB_ICONS[route.name] ?? { focused: 'ellipse', unfocused: 'ellipse-outline' };
          const labelKey = TAB_LABELS[route.name];
          return {
            headerShown: false,
            ...(labelKey
              ? { tabBarLabel: t(labelKey), tabBarAccessibilityLabel: t(labelKey) }
              : {}),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />
            ),
            tabBarActiveTintColor: '#4f46e5',
            tabBarInactiveTintColor: '#6b7280',
          };
        }}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="budget" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="settings" />
      </Tabs>

      {/* Hamburger + slide-in drawer, shown at every screen size. The hamburger
          is hidden while the sidebar is open so it never covers the X button. */}
      {!isSidebarOpen && <HamburgerButton onPress={openSidebar} />}
      <SidebarDrawer
        open={isSidebarOpen}
        onClose={closeSidebar}
        active={active}
      />
    </View>
  );
}