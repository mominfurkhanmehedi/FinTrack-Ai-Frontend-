import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TransactionForm } from '../../components/transactions/TransactionForm';
import { isValidIso } from '../../components/insights/calendarData';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';
import { isoToday } from '../../utils';

/**
 * Modal: AddTransaction
 * Creates a new transaction in the store and dismisses the modal.
 *
 * Accepts `?type=` and `?date=`. The Insights calendar passes the exact day the
 * user tapped so a new row lands on that day instead of today; an absent or
 * malformed `date` falls back to today.
 */
export default function AddTransaction() {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const { type, date } = useLocalSearchParams<{ type?: string; date?: string }>();
  const { t } = useI18n();
  const currency = useAppStore((s) => s.currency);

  const initialDate = isValidIso(date) ? date : isoToday();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TransactionForm
        initial={
          type === 'income' || type === 'expense'
            ? { type, title: '', amount: '', category: 'Other', date: initialDate }
            : undefined
        }
        submitLabel={t('transactions.form.saveTransaction')}
        onSubmit={(values) => {
          addTransaction({
            title: values.title,
            // Typed in the selected currency, which is the currency the store
            // records it in.
            amount: parseFloat(values.amount),
            type: values.type,
            category: values.category,
            date: values.date,
            currency,
          });
          // Close the modal after saving
          setTimeout(() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.dismiss();
            }
          }, 100);
        }}
      />
    </SafeAreaView>
  );
}