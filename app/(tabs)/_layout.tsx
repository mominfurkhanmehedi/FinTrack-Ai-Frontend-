import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps, useCallback, useState } from 'react';
import { View } from 'react-native';

import { HamburgerButton } from '../../components/layout/HamburgerButton';
import { SidebarDrawer } from '../../components/layout/SidebarDrawer';
import { useActiveRoute } from '../../hooks/useActiveRoute';

/**
 * TABS GROUP LAYOUT
 * Single <Tabs> navigator for all 5 main tabs.
 *
 * Navigation is a slide-in <SidebarDrawer> at every screen size (desktop/web
 * and mobile alike). The sidebar is hidden by default; a top-left hamburger
 * opens it, and it slides in over a semi-transparent backdrop. Closes on
 * backdrop tap, the X, a hamburger re-tap, or selecting a nav item.
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

export default function TabsLayout() {
  const active = useActiveRoute();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((open) => !open);
  }, []);

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={({ route }) => {
          const icon = TAB_ICONS[route.name] ?? { focused: 'ellipse', unfocused: 'ellipse-outline' };
          return {
            headerShown: false,
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

      {/* Hamburger + slide-in drawer, shown at every screen size */}
      <HamburgerButton onPress={toggleDrawer} />
      <SidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={active}
      />
    </View>
  );
}