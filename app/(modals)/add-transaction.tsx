import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native';

import { TransactionForm } from '../../components/transactions/TransactionForm';
import { useAppStore } from '../../store';
import { isoToday } from '../../utils';

/**
 * Modal: AddTransaction
 * Creates a new transaction in the store and dismisses the modal.
 */
export default function AddTransaction() {
  const addTransaction = useAppStore((s) => s.addTransaction);
  const { type } = useLocalSearchParams<{ type?: string }>();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TransactionForm
        initial={type === 'income' || type === 'expense' ? { type, title: '', amount: '', category: 'Other', date: isoToday() } : undefined}
        submitLabel="Save transaction"
        onSubmit={(values) => {
          addTransaction({
            title: values.title,
            amount: parseFloat(values.amount),
            type: values.type,
            category: values.category,
            date: values.date,
          });
          // Close the modal after saving
          setTimeout(() => router.back(), 100);
        }}
      />
    </SafeAreaView>
  );
}