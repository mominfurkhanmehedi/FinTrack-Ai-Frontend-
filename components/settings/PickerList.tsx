import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Card } from '../ui';

export interface PickerOption {
  key: string;
  label: string;
  description?: string;
}

/**
 * PickerList (settings)
 * Radio-style option list used by the theme / currency / language pickers.
 * Selecting an option calls onSelect and the screen routes back.
 */
export function PickerList({
  options,
  selected,
  onSelect,
}: {
  options: PickerOption[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <Card>
      {options.map((opt, i) => {
        const isSelected = opt.key === selected;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            onPress={() => onSelect(opt.key)}
            className={`flex-row items-center justify-between py-3 ${
              i < options.length - 1
                ? 'border-b border-gray-100 dark:border-gray-800'
                : ''
            } active:bg-gray-50 dark:active:bg-gray-800 px-1 -mx-1 rounded-lg`}
          >
            <View className="flex-1 pr-2">
              <Text className="text-base text-gray-900 dark:text-gray-100">{opt.label}</Text>
              {opt.description ? (
                <Text className="text-sm text-gray-500 dark:text-gray-400">{opt.description}</Text>
              ) : null}
            </View>
            {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#4f46e5" /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}