import { Stack } from 'expo-router';

/**
 * SETTINGS SUB-GROUP LAYOUT
 * Full-screen stack (push navigation with back) for settings sub-pages:
 * profile/password, notifications, preferences, export, support, legal.
 */
export default function SettingsSubLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="delete-account" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="theme-picker" />
      <Stack.Screen name="currency-picker" />
      <Stack.Screen name="language-picker" />
      <Stack.Screen name="export-data" />
      <Stack.Screen name="help-support" />
      <Stack.Screen name="faqs" />
      <Stack.Screen name="contact-us" />
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms" />
    </Stack>
  );
}