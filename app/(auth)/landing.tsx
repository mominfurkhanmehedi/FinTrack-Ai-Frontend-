import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '../../components/ui';
import { useAppStore } from '../../store';

/**
 * Screen: Landing
 * Entry point for signed-out users. Simple hero + auth CTA. First-time users
 * (not onboarded) are routed into the Onboarding screen before login.
 */
export default function Landing() {
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);

  const go = (route: 'login' | 'signup') =>
    router.push(hasOnboarded ? `/${route}` : '/onboarding');

  return (
    <View className="flex-1 bg-brand-600">
      <ScrollView contentContainerClassName="flex-grow justify-center px-8 py-10">
        <View className="flex-1 justify-center">
          <View className="flex-row items-center gap-2 mb-4">
            <Ionicons name="logo-electron" size={34} color="#ffffff" />
            <Text className="text-3xl font-bold text-white">FinTrack AI</Text>
          </View>
          <Text className="text-xl text-brand-100 leading-7">
            Take control of your money with AI-powered insights, budgets, and goals.
          </Text>
        </View>

        <View className="pt-8 pb-4">
          <Button title="Log in" variant="secondary" fullWidth onPress={() => go('login')} />
          <View className="h-3" />
          <Button title="Create account" fullWidth onPress={() => go('signup')} />
          <Pressable
            className="items-center py-3 mt-2"
            accessibilityRole="button"
            onPress={() => router.push(hasOnboarded ? '/forgot-password' : '/onboarding')}
          >
            <Text className="text-brand-100 underline">Forgot password?</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
