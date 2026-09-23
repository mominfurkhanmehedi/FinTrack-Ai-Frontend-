import { Stack } from 'expo-router';

/**
 * MODALS GROUP LAYOUT
 * Presented as a modal sheet (iOS) / centered dialog. Screens here handle
 * transactional flows like adding/editing a transaction or goal.
 */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'modal',
        headerShown: false,
      }}
    >
      <Stack.Screen name="add-transaction" />
      <Stack.Screen name="edit-transaction" />
      <Stack.Screen name="transaction-detail" />
      <Stack.Screen name="add-goal" />
      <Stack.Screen name="add-saving" />
    </Stack>
  );
}
