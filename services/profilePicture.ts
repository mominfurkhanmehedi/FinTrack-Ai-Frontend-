import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerResult } from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * PROFILE PICTURE SERVICE
 * Picks, validates, downscales, and persists a user profile picture.
 *
 * Persistence strategy (never a temporary blob URL):
 *  - Native (Android/iOS): the picked file is copied from the image-picker's
 *    cache into the app's persistent `documentDirectory`, and the app returns
 *    that `file://` path to store on the user.
 *  - Web: the browser picker returns a blog/blob URL, which does NOT survive a
 *    reload. Instead we ask image-manipulator for base64 and build a durable
 *    `data:` URI that is stored directly on the user record.
 *
 * Re-login persistence (same device): a small per-user cache is stored in
 * AsyncStorage under `fintrack-profile-picture:<userId>`. The root layout
 * restores it right after a user signs in, so a `file://` path or `data:` URI
 * survives a full sign-out/sign-in for the same account. The image is NOT
 * mirrored into Supabase `user_metadata` — large base64 payloads break Supabase
 * JWTs (user_metadata is embedded in the access token).
 *
 * Validation:
 *  - Allowed formats: JPEG, PNG, WebP.
 *  - Hard size limit (`MAX_PROFILE_IMAGE_BYTES`) before any processing.
 *  - Downscaled to a small square avatar so stored data stays tiny even on web.
 */

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const AVATAR_SIZE = 512;
const AVATAR_FILENAME_PREFIX = 'fintrack-profile-picture-';
const CACHE_PREFIX = 'fintrack-profile-picture:';

export class ProfilePictureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfilePictureError';
  }
}

/** Per-user cache key so the picture survives sign-out/sign-in for the same account. */
export function profilePictureCacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

type ProfilePictureSource = {
  uri: string;
  mimeType?: string;
  fileSize?: number;
  file?: File;
};

/** Human-readable error for common picker failure modes. */
function toFriendlyError(reason: unknown): Error {
  if (reason instanceof ProfilePictureError) return reason;
  if (reason instanceof Error && /permission/i.test(reason.message)) {
    return new ProfilePictureError(
      'Photo library permission was denied. Enable it in your device settings to choose a profile picture.',
    );
  }
  return new ProfilePictureError(
    'Could not load that image. Choose a JPG, PNG, or WebP file and try again.',
  );
}

function mimeOf(uri: string, mimeType?: string): string {
  if (mimeType) return mimeType.toLowerCase();
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  return ext === 'png' ? 'image/png' : (map[ext] ?? 'image/jpeg');
}

function validateImage(mime: string, bytes: number | undefined): void {
  if (!ALLOWED_MIME.has(mime)) {
    throw new ProfilePictureError('Unsupported image format. Please choose a JPG, PNG, or WebP image.');
  }
  if (bytes != null && bytes > MAX_PROFILE_IMAGE_BYTES) {
    const mb = Math.round(bytes / 1024 / 1024);
    throw new ProfilePictureError(`Image is too large (${mb} MB). Please choose an image under 5 MB.`);
  }
}

async function processProfilePictureSource(source: ProfilePictureSource): Promise<string> {
  const mime = mimeOf(source.uri, source.mimeType);
  const byteSize = source.fileSize ?? (source.file ? source.file.size : undefined);
  validateImage(mime, byteSize);

  const processed = await manipulateAsync(
    source.uri,
    [{ resize: { width: AVATAR_SIZE } }],
    { compress: 0.85, format: SaveFormat.JPEG, base64: Platform.OS === 'web' },
  );

  if (Platform.OS === 'web') {
    if (processed.base64) {
      return `data:image/jpeg;base64,${processed.base64}`;
    }
    throw new ProfilePictureError('Could not encode the image for storage.');
  }

  if (!FileSystem.documentDirectory) {
    throw new ProfilePictureError('Could not access app storage for the profile picture.');
  }
  const dest = `${FileSystem.documentDirectory}${AVATAR_FILENAME_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.copyAsync({ from: processed.uri, to: dest });
  return dest;
}

function openWebGalleryInput(): Promise<File | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.setAttribute('aria-hidden', 'true');
  input.setAttribute('data-testid', 'profile-gallery-input');
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.left = '-10000px';
  input.style.top = '0';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';

  return new Promise<File | null>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };

    const handleChange = () => {
      const file = input.files?.[0] ?? null;
      if (!file) {
        console.log('[profilePicture] Browser gallery input canceled');
        finish(null);
        return;
      }
      console.log('[profilePicture] Browser gallery input selected', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      finish(file);
    };

    const handleCancel = () => {
      console.log('[profilePicture] Browser gallery input canceled');
      finish(null);
    };

    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel);
    document.body.appendChild(input);

    console.log('[profilePicture] Opening browser gallery input');
    try {
      input.click();
      console.log('[profilePicture] Browser gallery input click invoked');
    } catch (reason) {
      settled = true;
      cleanup();
      reject(reason);
    }
  });
}

async function processPickerResult(result: ImagePickerResult): Promise<string | null> {
  if (result.canceled || !result.assets?.length) {
    return null;
  }
  return processProfilePictureSource(result.assets[0]);
}

/**
 * Opens the system image picker (gallery on Android/iOS, file input on web).
 * Returns a durable, persisted image reference ready to store on the user, or
 * `null` when the user cancelled the picker.
 */
export async function pickProfilePicture(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const file = await openWebGalleryInput();
      if (!file) {
        return null;
      }
      return await processProfilePictureFile(file);
    }

    const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new ProfilePictureError(
        'Photo library permission was denied. Enable it in your device settings to choose a profile picture.',
      );
    }

    return await processPickerResult(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      }),
    );
  } catch (reason) {
    throw toFriendlyError(reason);
  }
}

export async function processProfilePictureFile(file: File): Promise<string> {
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    return await processProfilePictureSource({
      uri: objectUrl,
      mimeType: file.type,
      fileSize: file.size,
      file,
    });
  } catch (reason) {
    throw toFriendlyError(reason);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/** Removes a persisted profile picture file (native), ignoring web data URIs. */
export async function removeProfilePictureFile(uri: string | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file://')) {
    return;
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (e) {
    console.warn('[profilePicture] failed to remove persisted file:', e);
  }
}

/** Stores (or clears) the per-user picture cache used to restore after sign-in. */
export async function cacheProfilePicture(userId: string, uri: string | null): Promise<void> {
  try {
    const key = profilePictureCacheKey(userId);
    if (uri) {
      await AsyncStorage.setItem(key, uri);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('[profilePicture] cache write failed:', e);
  }
}

/** Reads the per-user cached picture reference. Returns null when absent. */
export async function getCachedProfilePicture(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(profilePictureCacheKey(userId));
  } catch (e) {
    console.warn('[profilePicture] cache read failed:', e);
    return null;
  }
}