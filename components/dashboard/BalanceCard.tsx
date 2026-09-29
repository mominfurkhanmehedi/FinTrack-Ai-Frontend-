import { Platform, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useMoney } from '../../hooks';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useI18n } from '../../i18n';

/**
 * BalanceCard (dashboard)
 * Hero balance stat. Uses a gradient-like brand surface. The amount scales
 * down on narrow (desktop grid) columns so long currency values never clip.
 */
export function BalanceCard({ balance }: { balance: number }) {
  const { format } = useMoney();
  const { width } = useBreakpoint();
  const { t } = useI18n();
  const positive = balance >= 0;

  // Bigger on full-width mobile, tighter here so 4-up desktop stays balanced.
  const amountSize = width < 640 ? 'text-4xl' : width < 1024 ? 'text-3xl' : 'text-2xl';

  // adjustsFontSizeToFit is native-only; on web numberOfLines ellipsizes.
  const shrinkProps =
    Platform.OS === 'web' ? {} : { adjustsFontSizeToFit: true, minimumFontScale: 0.6 };

  return (
    <View className="flex-1 bg-brand-600 rounded-2xl p-5">
      <Text className="text-xs font-semibold uppercase tracking-wider text-brand-100">
        {t('dashboard.totalBalance')}
      </Text>
      <Text
        className={`${amountSize} font-bold tracking-tight text-white mt-2`}
        numberOfLines={1}
        style={{ flexShrink: 1 }}
        {...shrinkProps}
      >
        {format(balance)}
      </Text>
      <View className="flex-row items-center mt-3">
        <Ionicons
          name={positive ? 'trending-up' : 'trending-down'}
          size={16}
          color="#c7d2fe"
        />
        <Text className="text-sm text-brand-100 ml-1">
          {positive ? t('dashboard.onTrack') : t('dashboard.belowTarget')}
        </Text>
      </View>
    </View>
  );
}