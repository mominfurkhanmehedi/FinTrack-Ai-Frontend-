import { Image, Text, View } from 'react-native';

import { useI18n } from '../../i18n';

interface ProfileAvatarProps {
  /** Profile picture reference (data: URI on web, file:// path on native). */
  uri?: string | null;
  /** Fallback text (emoji/character) shown when no picture is set. */
  fallback: string;
  size?: number;
}

/**
 * ProfileAvatar
 * Circular avatar. Shows the user's picture with cover fit, or the given
 * fallback character/emoji on a brand background when no picture is set.
 */
export function ProfileAvatar({ uri, fallback, size = 64 }: ProfileAvatarProps) {
  const { t } = useI18n();
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <View style={[avatarStyle, { overflow: 'hidden', backgroundColor: '#4f46e5' }]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityLabel={t('common.profilePictureLabel')}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        avatarStyle,
        { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5' },
      ]}
    >
      <Text
        className="font-bold text-white"
        style={{ fontSize: size * 0.375, lineHeight: size * 0.5 }}
      >
        {fallback}
      </Text>
    </View>
  );
}
