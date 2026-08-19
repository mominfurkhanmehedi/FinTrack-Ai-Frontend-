import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native';

import { TransactionForm } from '../../components/transactions/TransactionForm';
import { useAppStore } from '../../store';

/**
 * Modal: EditTransaction
 * Loads an existing transaction by id, lets the user modify it, then persists.
 */
export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactions = useAppStore((s) => s.transactions);
  const updateTransaction = useAppStore((s) => s.updateTransaction);

  const tx = transactions.find((t) => t.id === id);
  if (!tx) {
    router.back();
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TransactionForm
        initial={{
          title: tx.title,
          amount: String(tx.amount),
          type: tx.type,
          category: tx.category,
          date: tx.date,
        }}
        submitLabel="Update transaction"
        onSubmit={(values) => {
          updateTransaction(id, {
            title: values.title,
            amount: parseFloat(values.amount),
            type: values.type,
            category: values.category,
            date: values.date,
          });
          router.back();
        }}
      />
    </SafeAreaView>
  );
}