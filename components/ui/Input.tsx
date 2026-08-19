import { forwardRef, useState } from 'react';
import {
  Text,
  TextInput,
  TextInputProps,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  secure?: boolean;
  leftIcon?: React.ReactNode;
}

/**
 * Input (ui)
 * Labeled text field with optional icon, password reveal toggle, and error text.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, secure = false, leftIcon, className, ...rest },
  ref,
) {
  const [hidden, setHidden] = useState(secure);

  return (
    <View className={`mb-4 ${className ?? ''}`}>
      {label ? (
        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</Text>
      ) : null}
      <View className="relative">
        {leftIcon ? <View className="absolute left-3 top-1/2 -translate-y-1/2 z-10">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          secureTextEntry={hidden}
          placeholderTextColor="#9ca3af"
          className={`w-full rounded-xl border bg-white dark:bg-gray-900 px-4 py-3 text-base text-gray-900 dark:text-gray-100 ${
            leftIcon ? 'pl-11' : ''
          } ${secure ? 'pr-11' : ''} ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          {...rest}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
            accessibilityRole="button"
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className="text-sm text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
});
