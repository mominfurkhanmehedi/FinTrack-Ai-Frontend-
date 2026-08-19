import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 active:bg-brand-700',
  secondary: 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 active:bg-brand-100',
  danger: 'bg-danger-500 active:bg-red-600',
  ghost: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
};

const textClasses: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-brand-700 dark:text-brand-300',
  danger: 'text-white',
  ghost: 'text-brand-600 dark:text-brand-400',
};

/**
 * Button (ui)
 * Primary interactive control. Variants cover the common actions; `loading`
 * swaps the label for a spinner.
 */
export const Button = forwardRef<ViewStyle, ButtonProps>(function Button(
  { title, variant = 'primary', loading = false, fullWidth = false, leftIcon, style, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      ref={ref as never}
      accessibilityRole="button"
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-xl px-5 py-3 ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''}`}
      style={style}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? '#4338ca' : '#ffffff'} />
      ) : (
        <>
          {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
          <Text className={`text-base font-semibold ${textClasses[variant]}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
});
