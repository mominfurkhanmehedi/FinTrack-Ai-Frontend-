import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';

import { SettingsScreen } from '../../components/settings';
import { Button, Card } from '../../components/ui';
import { useAppStore } from '../../store';
import { formatDate } from '../../utils';

/**
 * Screen: ExportData
 * Exports transactions as a CSV file and triggers a share/download. Uses
 * expo-file-system + expo-sharing on native; on web it falls back to a browser
 * download via a Blob.
 */
export default function ExportData() {
  const transactions = useAppStore((s) => s.transactions);
  const [exporting, setExporting] = useState(false);

  const buildCsv = (): string => {
    const header = 'id,title,amount,type,category,date';
    const rows = transactions.map((t) =>
      [t.id, `"${t.title.replace(/"/g, '""')}"`, t.amount, t.type, t.category, t.date].join(','),
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
        Alert.alert('Export complete', `Downloaded ${filename}.`);
      } else {
        const file = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(file, csv);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file, { mimeType: 'text/csv', dialogTitle: 'Export transactions' });
        } else {
          Alert.alert('Export complete', `Saved to ${file}`);
        }
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsScreen title="Export Data" subtitle="Download your transactions">
      <Card>
        <Text className="text-base text-gray-700 dark:text-gray-300 leading-6">
          Export all {transactions.length} transactions as a CSV file. The file includes title,
          amount, type, category, and date for every entry.
        </Text>
        <View className="h-4" />
        <Button title={exporting ? 'Preparing…' : 'Export CSV'} onPress={doExport} loading={exporting} fullWidth />
      </Card>
    </SettingsScreen>
  );
}