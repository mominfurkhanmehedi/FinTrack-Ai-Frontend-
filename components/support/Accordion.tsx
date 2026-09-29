import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '../ui';

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  initialExpandedId?: string | null;
}

export function Accordion({ items, initialExpandedId = null }: AccordionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);

  return (
    <Card className="p-0 overflow-hidden">
      {items.map((item, index) => {
        const expanded = expandedId === item.id;

        return (
          <View
            key={item.id}
            className={index < items.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={item.question}
              onPress={() => setExpandedId(expanded ? null : item.id)}
              className="px-4 py-4 active:bg-gray-50 dark:active:bg-gray-800"
            >
              <View className="flex-row items-center gap-3">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1 leading-5">
                  {item.question}
                </Text>
                <View className="w-8 h-8 rounded-full bg-brand-50 dark:bg-gray-800 items-center justify-center">
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#4f46e5"
                  />
                </View>
              </View>
            </Pressable>
            {expanded ? (
              <View id={`accordion-answer-${item.id}`} className="px-4 pb-4 -mt-1">
                <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6">
                  {item.answer}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
