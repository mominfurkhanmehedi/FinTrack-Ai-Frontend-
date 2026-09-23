import { Stack } from 'expo-router';

/**
 * AUTH GROUP LAYOUT
 * Modal-free stack for pre-auth screens (landing, login, signup, forgot).
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="landing" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}