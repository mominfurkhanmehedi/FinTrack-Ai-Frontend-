import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PickerList, SettingsScreen } from '../../components/settings';
import { Card } from '../../components/ui';
import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { CURRENCIES } from '../../types';
import type { TranslationKey } from '../../i18n';
import { currencyFractionDigits } from '../../utils';
import { RATE_PROVIDER_LABELS } from '../../services/rateProviders';

/**
 * Why a currency change was refused, mapped to the message shown for it.
 * `same-currency` is absent on purpose: re-selecting the current currency is a
 * success that changes nothing, so it never reaches an error dialog.
 */
const CURRENCY_ERROR_KEYS: Record<string, TranslationKey> = {
  unsupported: 'pickers.currencyChangeError.unsupported',
  'no-rate': 'pickers.currencyChangeError.noRate',
  'invalid-amount': 'pickers.currencyChangeError.failed',
  busy: 'pickers.currencyChangeError.busy',
  'persist-failed': 'pickers.currencyChangeError.failed',
};

/**
 * Screen: CurrencyPicker
 * Choose the currency the whole app works in.
 *
 * Selecting a currency PERMANENTLY CONVERTS the user's existing financial data —
 * every transaction amount (income and expense), every goal target, every
 * savings total and the safety buffer — from the currency it is currently stored
 * in into the newly selected one, and rewrites it in the database. The selection
 * is only committed after that conversion succeeds, so a failed rate lookup
 * leaves both the data and the previous currency untouched.
 *
 * Because the conversion is destructive and irreversible, picking a different
 * currency asks for confirmation first, naming both the current and the target
 * currency.
 *
 * This screen is also where rate availability is surfaced: conversion needs a
 * live rate table, so the user is told plainly whether rates are current, cached,
 * or unavailable (in which case the switch is refused rather than guessed). A
 * fetch in progress reads as "updating", not as an outage, and the feed the
 * numbers came from is shown so a fallback provider is visible rather than
 * silent.
 */
export default function CurrencyPicker() {
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const { t, locale } = useI18n();
  const { ratesStatus, ratesUpdatedAt, ratesSource, refreshRates, canConvert } = useMoney();
  const [converting, setConverting] = useState<string | null>(null);

  const updatedLabel = ratesUpdatedAt
    ? new Date(ratesUpdatedAt).toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const isLoading = ratesStatus === 'loading';
  // Human label for where the numbers came from, so a user who is being served
  // by a fallback feed (rather than the primary one) can see that.
  const sourceLabel = ratesSource ? (RATE_PROVIDER_LABELS[ratesSource] ?? ratesSource) : null;

  const status = {
    idle: {
      text: t('pickers.ratesUnavailable'),
      icon: 'alert-circle-outline' as const,
      tone: 'text-amber-600 dark:text-amber-400',
    },
    loading: {
      // A fetch in progress is not an outage. Saying "unavailable" here told
      // users their data was at risk while the table was simply being fetched.
      text: t('pickers.ratesLoading'),
      icon: 'sync-outline' as const,
      tone: 'text-gray-500 dark:text-gray-400',
    },
    ready: {
      text: updatedLabel
        ? t('pickers.ratesUpdated', { time: updatedLabel })
        : t('pickers.ratesUpdated', { time: '—' }),
      icon: 'checkmark-circle-outline' as const,
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
    stale: {
      text: t('pickers.ratesStale'),
      icon: 'cloud-offline-outline' as const,
      tone: 'text-amber-600 dark:text-amber-400',
    },
    unavailable: {
      text: t('pickers.ratesUnavailable'),
      icon: 'alert-circle-outline' as const,
      tone: 'text-red-600 dark:text-red-400',
    },
  }[ratesStatus];

  const applyCurrency = async (next: string) => {
    setConverting(next);
    try {
      const result = await setCurrency(next);
      if (result.ok) {
        router.back();
        return;
      }
      // The previous currency is still in effect — say why, and say what the user
      // would have switched to, so the screen is not left looking like it worked.
      Alert.alert(
        t('pickers.currencyChangeTitle'),
        t(CURRENCY_ERROR_KEYS[result.error ?? 'persist-failed'], { from: currency, to: next }),
      );
    } finally {
      // Always clear the busy state, even if `setCurrency` rejects, so the screen
      // never gets stuck showing a conversion that already ended.
      setConverting(null);
    }
  };

  const onSelect = (next: string) => {
    if (next === currency || converting) {
      router.back();
      return;
    }
    Alert.alert(
      t('pickers.currencyChangeTitle'),
      t('pickers.currencyChangeMessage', { from: currency, to: next }),
      [
        { text: t('settings.confirmation.cancel'), style: 'cancel' },
        {
          text: t('settings.confirmation.confirm'),
          style: 'destructive',
          onPress: () => void applyCurrency(next),
        },
      ],
    );
  };

  return (
    <SettingsScreen title={t('pickers.currencyTitle')} subtitle={t('pickers.currencySubtitle')}>
      <PickerList
        options={CURRENCIES.map((c) => ({
          key: c.code,
          label: `${c.symbol} ${c.label}`,
          description: t('pickers.ratesDataNote', {
            code: c.code,
            dp: currencyFractionDigits(c.code),
          }),
        }))}
        selected={currency}
        onSelect={onSelect}
      />

      {converting ? (
        <Text className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('pickers.currencyChangeBusy', { to: converting })}
        </Text>
      ) : null}

      <Card className="mt-4">
        <View className="flex-row items-start gap-2">
          <Ionicons
            name={isLoading ? 'sync' : status.icon}
            size={18}
            color="#6b7280"
            className={`mt-0.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('pickers.ratesTitle')}
            </Text>
            <Text className={`mt-0.5 text-sm ${status.tone}`}>{status.text}</Text>
            <Text className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t('pickers.ratesStorageNote', { code: currency })}
            </Text>
            {sourceLabel ? (
              <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {t('pickers.ratesSource', { source: sourceLabel })}
              </Text>
            ) : null}
            {!canConvert ? (
              <Text className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {t('pickers.ratesUnavailable')}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isLoading, disabled: isLoading }}
          disabled={isLoading}
          onPress={refreshRates}
          className={`mt-3 flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 ${
            isLoading
              ? 'bg-gray-50 dark:bg-gray-800/50'
              : 'active:bg-gray-50 dark:active:bg-gray-800'
          }`}
        >
          <Ionicons
            name="refresh"
            size={16}
            color={isLoading ? '#9ca3af' : '#4f46e5'}
            className={isLoading ? 'animate-spin' : ''}
          />
          <Text
            className={`text-sm font-semibold ${
              isLoading
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-brand-600 dark:text-brand-400'
            }`}
          >
            {isLoading ? t('pickers.ratesRefreshing') : t('pickers.ratesRefresh')}
          </Text>
        </Pressable>
      </Card>
    </SettingsScreen>
  );
}
