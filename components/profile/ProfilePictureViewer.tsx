import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '../../i18n';
import { POINTER_EVENTS } from '../ui';

interface ProfilePictureViewerProps {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
}

type ImageSize = { width: number; height: number };

export function ProfilePictureViewer({ visible, uri, onClose }: ProfilePictureViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const closing = useRef(false);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [loading, setLoading] = useState(false);

  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom, 12);
  const availableWidth = Math.max(width - 32, 1);
  const availableHeight = Math.max(height - topInset - bottomInset - 72, 1);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, opacity, scale]);

  useEffect(() => {
    if (!visible || !uri) return;

    closing.current = false;
    opacity.setValue(0);
    scale.setValue(0.96);
    setImageSize(null);
    setLoading(true);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    let active = true;
    Image.getSize(
      uri,
      (imageWidth, imageHeight) => {
        if (!active) return;
        setImageSize({ width: imageWidth, height: imageHeight });
        setLoading(false);
      },
      () => {
        if (!active) return;
        setImageSize(null);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [opacity, scale, uri, visible]);

  if (!visible || !uri) return null;

  const displaySize = imageSize
    ? (() => {
        const ratio = Math.min(
          availableWidth / imageSize.width,
          availableHeight / imageSize.height,
        );
        return {
          width: Math.max(1, Math.round(imageSize.width * ratio)),
          height: Math.max(1, Math.round(imageSize.height * ratio)),
        };
      })()
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={close}
    >
      <Animated.View style={[styles.root, { opacity, transform: [{ scale }] }]}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        <View
          style={[
            styles.safeArea,
            { paddingTop: topInset, paddingBottom: bottomInset },
            POINTER_EVENTS.boxNone,
          ]}
        >
          <View className="h-14 px-4 flex-row items-center justify-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              onPress={close}
              className="w-11 h-11 rounded-full items-center justify-center bg-white/15 border border-white/20 active:bg-white/25"
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>

          <View className="flex-1 items-center justify-center px-4 pb-4">
            {loading && !displaySize ? (
              <ActivityIndicator size="large" color="#ffffff" style={POINTER_EVENTS.none} />
            ) : displaySize ? (
              <Pressable
                accessibilityRole="image"
                accessibilityLabel={t('common.profilePictureLabel')}
                onPress={close}
                style={displaySize}
              >
                <Image
                  source={{ uri }}
                  style={displaySize}
                  resizeMode="contain"
                  accessibilityLabel={t('common.profilePictureLabel')}
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setImageSize(null);
                    setLoading(false);
                  }}
                />
              </Pressable>
            ) : (
              <Image
                source={{ uri }}
                style={styles.fallbackImage}
                resizeMode="contain"
                accessibilityLabel={t('common.profilePictureLabel')}
                onError={() => setLoading(false)}
              />
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
  },
});
