import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { formatDate, recordCurrency } from '../../utils';

/**
 * Screen: ExportData
 * Exports transactions as a CSV file and triggers a share/download. Uses
 * expo-file-system + expo-sharing on native; on web it falls back to a browser
 * download via a Blob.
 *
 * The export carries a `currency` column, so a file opened outside the app still
 * says what the amounts are denominated in — without it, a converted data set
 * would be unreadable.
 */
export default function ExportData() {
  const transactions = useAppStore((s) => s.transactions);
  const [exporting, setExporting] = useState(false);
  const { t } = useI18n();

  const buildCsv = (): string => {
    const header = 'id,title,amount,currency,type,category,date';
    const rows = transactions.map((t) =>
      [
        t.id,
        `"${t.title.replace(/"/g, '""')}"`,
        t.amount,
        // A row predating the currency column is in the legacy base currency.
        recordCurrency(t),
        t.type,
        t.category,
        t.date,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const csv = buildCsv();
      const filename = `fintrack-export-${Date.now()}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert(t('exportData.exportCompleteTitle'), t('exportData.downloaded', { file: filename }));
      } else {
        const file = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(file, csv);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file, { mimeType: 'text/csv', dialogTitle: t('exportData.shareDialogTitle') });
        } else {
          Alert.alert(t('exportData.exportCompleteTitle'), t('exportData.savedTo', { file }));
        }
      }
    } catch (e) {
      Alert.alert(
        t('exportData.exportFailedTitle'),
        e instanceof Error ? e.message : t('common.unexpectedError'),
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsScreen title={t('exportData.title')} subtitle={t('exportData.subtitle')}>
      <Card>
        <Text className="text-base text-gray-700 dark:text-gray-300 leading-6">
          {t('exportData.body', { count: transactions.length })}
        </Text>
        <View className="h-4" />
        <Button
          title={exporting ? t('common.preparing') : t('exportData.exportCsv')}
          onPress={doExport}
          loading={exporting}
          fullWidth
        />
      </Card>
    </SettingsScreen>
  );
}
