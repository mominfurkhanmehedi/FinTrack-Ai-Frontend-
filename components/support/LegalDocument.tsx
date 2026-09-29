import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import { Button, Card } from '../ui';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface LegalSection {
  id: string;
  title: string;
  icon: IoniconName;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export interface LegalDocumentProps {
  intro: string;
  noticeTitle: string;
  noticeBody: string;
  sections: readonly LegalSection[];
  contactTitle: string;
  contactBody: string;
  contactButtonTitle: string;
  contactEmail: string;
}

export function LegalDocument({
  intro,
  noticeTitle,
  noticeBody,
  sections,
  contactTitle,
  contactBody,
  contactButtonTitle,
  contactEmail,
}: LegalDocumentProps) {
  const openEmail = async () => {
    const url = `mailto:${contactEmail}`;

    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      Alert.alert(contactTitle, contactEmail);
      return;
    }

    Alert.alert(contactTitle, contactEmail);
  };

  return (
    <>
      <Card>
        <View className="flex-row items-start gap-3">
          <View className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center">
            <Ionicons name="document-text" size={20} color="#4f46e5" />
          </View>
          <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6 flex-1">
            {intro}
          </Text>
        </View>
      </Card>

      <View className="h-4" />

      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <View className="flex-row items-start gap-3">
          <Ionicons name="information-circle" size={22} color="#d97706" />
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {noticeTitle}
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-300 leading-6 mt-1">
              {noticeBody}
            </Text>
          </View>
        </View>
      </Card>

      {sections.map((section) => (
        <View key={section.id}>
          <View className="h-4" />
          <Card>
            <View className="flex-row items-start gap-3 mb-3">
              <View className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center">
                <Ionicons name={section.icon} size={19} color="#4f46e5" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 leading-6">
                {section.title}
              </Text>
            </View>
            {section.paragraphs.map((paragraph) => (
              <Text
                key={paragraph}
                className="text-sm text-gray-600 dark:text-gray-300 leading-6 mb-3"
              >
                {paragraph}
              </Text>
            ))}
            {section.bullets ? (
              <View className="mt-1 gap-2">
                {section.bullets.map((bullet) => (
                  <View key={bullet} className="flex-row items-start gap-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2.5" />
                    <Text className="text-sm text-gray-600 dark:text-gray-300 leading-6 flex-1">
                      {bullet}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </View>
      ))}

      <View className="h-4" />

      <Card>
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-gray-800 items-center justify-center">
            <Ionicons name="mail" size={20} color="#4f46e5" />
          </View>
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1">
            {contactTitle}
          </Text>
        </View>
        <Text className="text-sm text-gray-500 dark:text-gray-400 leading-6 mb-4">
          {contactBody}
        </Text>
        <Button
          title={contactButtonTitle}
          variant="secondary"
          fullWidth
          leftIcon={<Ionicons name="open-outline" size={18} color="#4338ca" />}
          onPress={openEmail}
        />
        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
          {contactEmail}
        </Text>
      </Card>
    </>
  );
}
