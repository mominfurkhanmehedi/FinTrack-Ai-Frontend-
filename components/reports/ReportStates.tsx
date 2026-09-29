import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Text, View } from 'react-native';

import { useI18n } from '../../i18n';
import { Button, EmptyState } from '../ui';

function usePulse(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

/**
 * ReportsSkeleton (reports)
 * Polished placeholder shown while the store hydrates real transactions from
 * the backend. Mirrors the Reports layout so switching to the page never shows
 * a flash of broken/empty charts or a bare spinner.
 */
export function ReportsSkeleton() {
  const opacity = usePulse();

  const block = (className: string) => (
    <Animated.View className={`rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} style={{ opacity }} />
  );

  return (
    <View>
      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <View className="flex-row gap-3">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-1">
              {block('h-3 w-16')}
              {block('mt-2 h-7 w-full')}
            </View>
          ))}
        </View>
      </View>

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {block('h-4 w-32')}
        {block('mt-4 h-40 w-full')}
        {block('mt-3 h-2 w-full')}
      </View>

      <View className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {block('h-4 w-40')}
        {block('mt-4 h-40 w-full')}
      </View>

      <View className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {block('h-4 w-36')}
        {block('mt-4 h-44 w-full')}
      </View>
    </View>
  );
}

/**
 * ReportsErrorState (reports)
 * Friendly error panel with a retry action when the initial data load fails.
 */
export function ReportsErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();

  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <EmptyState
        icon="cloud-offline-outline"
        title={t('reports.errorTitle')}
        message={t('reports.errorMessage')}
        action={
          <Button
            title={t('reports.tryAgain')}
            onPress={onRetry}
            leftIcon={<Ionicons name="refresh" size={18} color="#ffffff" />}
          />
        }
      />
    </View>
  );
}