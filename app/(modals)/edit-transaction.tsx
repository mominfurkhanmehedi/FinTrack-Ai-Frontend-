import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TransactionForm } from '../../components/transactions/TransactionForm';
import { useMoney } from '../../hooks/useMoney';
import { useI18n } from '../../i18n';
import { useAppStore } from '../../store';

/**
 * Modal: EditTransaction
 * Loads an existing transaction by id, lets the user modify it, then persists.
 *
 * The stored amount is already in the selected currency, so the field is
 * pre-filled with it as-is. `storedAmount` is passed alongside it and is what
 * gets submitted if the user does not touch the field — a title-only edit
 * therefore cannot shift the amount by a rounding step.
 */
export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transactions = useAppStore((s) => s.transactions);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const { toInputValue } = useMoney();
  const { t } = useI18n();

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
          amount: String(toInputValue(tx.amount)),
          storedAmount: tx.amount,
          type: tx.type,
          category: tx.category,
          date: tx.date,
        }}
        submitLabel={t('transactions.form.updateTransaction')}
        onSubmit={(values) => {
          updateTransaction(id, {
            title: values.title,
            // Already in the stored currency, which the store re-stamps.
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
