import { ReactNode } from 'react';
import { Text, View, ViewProps } from 'react-native';

export interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  /** Rendered on the right side of the header row. */
  action?: ReactNode;
}

/**
 * Card (ui)
 * Surface container used across every screen for grouping content.
 * Header is optional and may include a title, subtitle, and a trailing action.
 */
export function Card({ title, subtitle, children, action, className, style, ...rest }: CardProps) {
  return (
    <View
      className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm ${className ?? ''}`}
      style={style}
      {...rest}
    >
      {title ? (
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1 pr-2">
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</Text>
            {subtitle ? (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}