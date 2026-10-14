import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askFinTrack, AiAnswer } from '../../services/ai';
import { useI18n, type TranslationKey } from '../../i18n';
import { useSafeToSpend } from '../../hooks';
import { useAppStore } from '../../store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  translationKey?: TranslationKey;
  source?: AiAnswer['source'];
}

let messageCount = 0;
const nextId = () => `msg-${++messageCount}`;

/**
 * Modal: Ask FinTrack
 * Chat-style interface over the AI abstraction (services/ai.ts). Answers come
 * from a connected provider when available, otherwise from the honest local
 * analyzer — always computed from the user's real data. Nothing is shared
 * beyond the question's context and nothing is ever modified.
 */
export default function AskFinTrack() {
  const { transactions, goals, goalEstimates, format, currency, toBase } = useSafeToSpend();
  const emergencyBuffer = useAppStore((s) => s.emergencyBuffer);
  const { t } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      role: 'assistant',
      text: '',
      translationKey: 'askFinTrack.greeting',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId(), role: 'user', text }]);
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    try {
      const answer = await askFinTrack(text, {
        transactions,
        goals,
        goalEstimates,
        format,
        currency,
        toBase,
        emergencyBuffer,
      });
      setMessages((m) => [...m, { id: nextId(), role: 'assistant', text: answer.text, source: answer.source }]);
    } catch (err) {
      console.error('[askFinTrack] failed:', err);
      setMessages((m) => [
        ...m,
        { id: nextId(), role: 'assistant', text: '', translationKey: 'askFinTrack.sorry' },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100 dark:border-gray-800">
          <View className="flex-row items-center">
            <Ionicons name="sparkles" size={20} color="#4f46e5" />
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100 ml-2">{t('askFinTrack.title')}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.dismiss();
              }
            }}
          >
            <Text className="text-brand-600 dark:text-brand-400 font-semibold">{t('askFinTrack.close')}</Text>
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerClassName="py-4"
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}
          {loading ? (
            <View className="self-start flex-row items-center gap-2 rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-3 my-1">
              <ActivityIndicator size="small" color="#6b7280" />
              <Text className="text-sm text-gray-500 dark:text-gray-400">{t('common.thinking')}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Input */}
        <View className="flex-row items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('askFinTrack.inputPlaceholder')}
            placeholderTextColor="#9ca3af"
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-gray-100"
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
            editable={!loading}
          />
          <Pressable
            accessibilityRole="button"
            onPress={send}
            disabled={loading || input.trim() === ''}
            className={`w-11 h-11 items-center justify-center rounded-xl bg-brand-600 active:bg-brand-700 ${
              loading || input.trim() === '' ? 'opacity-50' : ''
            }`}
          >
            <Ionicons name="send" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  return (
    <View
      className={`max-w-[85%] rounded-2xl px-4 py-3 my-1 ${
        isUser ? 'self-end bg-brand-600' : 'self-start bg-gray-100 dark:bg-gray-800'
      }`}
    >
      <Text className={`text-base leading-5 ${isUser ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
        {message.translationKey ? t(message.translationKey) : message.text}
      </Text>
      {!isUser && message.source ? (
        <Text className="text-[10px] mt-1 text-gray-500 dark:text-gray-400">
          {message.source === 'provider' ? t('askFinTrack.aiInput') : t('askFinTrack.basedOnYourData')}
        </Text>
      ) : null}
    </View>
  );
}