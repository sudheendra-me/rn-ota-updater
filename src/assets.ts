// @ts-ignore - react-native is a peerDependency
let setCustomSourceTransformer: typeof import('react-native/Libraries/Image/resolveAssetSource').setCustomSourceTransformer;
// @ts-ignore - react-native-fs is a peerDependency
let RNFS: typeof import('react-native-fs');

try {
  // @ts-ignore - require is available at runtime
  setCustomSourceTransformer = require('react-native/Libraries/Image/resolveAssetSource').setCustomSourceTransformer;
} catch (e) {
  throw new Error(
    '[rn-ota-updater] Missing dependency: react-native. Please install it in your app.'
  );
}

try {
  // @ts-ignore - require is available at runtime
  RNFS = require('react-native-fs');
} catch (e) {
  throw new Error(
    '[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.'
  );
}

const OTA_DIR = `${RNFS.DocumentDirectoryPath}/ota`;
const OTA_ASSETS_DIR = `${OTA_DIR}/assets`;
const OTA_ASSETS_MAP = `${OTA_DIR}/assets.json`;

let assetsMap: Record<string, any> = {};
let isLoaded = false;

/**
 * Loads the OTA assets map and sets up asset interception for images and other assets.
 * This allows the app to serve updated assets from the OTA directory instead of bundled assets.
 *
 * Call this function early in your app initialization, preferably after recoverIfNeeded().
 *
 * @returns Promise that resolves when assets mapping is loaded
 */
export const loadOtaAssetsMap = async (): Promise<void> => {
  if (isLoaded) return;

  try {
    const exists = await RNFS.exists(OTA_ASSETS_MAP);
    if (!exists) return;

    const content = await RNFS.readFile(OTA_ASSETS_MAP, 'utf8');
    assetsMap = JSON.parse(content);
    isLoaded = true;

    setCustomSourceTransformer(resolver => {
      try {
        const defaultSource = resolver.defaultAsset();
        if (!defaultSource || !defaultSource.uri) return defaultSource;

        const uri = defaultSource.uri;

        // Extract path after last '/'
        const parts = uri.split('/');
        const fileName = parts[parts.length - 1];

        // Try RN asset match (for assets bundled with metro)
        const rnKey = `rn/${fileName}`;
        if (assetsMap[rnKey]) {
          const newUri = `file://${OTA_ASSETS_DIR}/${rnKey}`;
          return {
            ...defaultSource,
            uri: newUri,
          };
        }

        // Try Android drawable match
        const drawableMatch = uri.match(/(drawable[^/]*\/[^/]+)$/);
        if (drawableMatch && assetsMap[drawableMatch[1]]) {
          const newUri = `file://${OTA_ASSETS_DIR}/${drawableMatch[1]}`;
          return {
            ...defaultSource,
            uri: newUri,
          };
        }

        // Try Android mipmap match
        const mipmapMatch = uri.match(/(mipmap[^/]*\/[^/]+)$/);
        if (mipmapMatch && assetsMap[mipmapMatch[1]]) {
          const newUri = `file://${OTA_ASSETS_DIR}/${mipmapMatch[1]}`;
          return {
            ...defaultSource,
            uri: newUri,
          };
        }

        return defaultSource;
      } catch (err) {
        console.log('[OTA] Image interceptor error', err);
        return resolver.defaultAsset();
      }
    });
  } catch (e) {
    console.log('[OTA] Failed to load assets map', e);
  }
};

/**
 * Clears the loaded assets map and resets the asset interceptor.
 * Useful for testing or when switching between different OTA versions.
 */
export const clearOtaAssetsMap = (): void => {
  assetsMap = {};
  isLoaded = false;
};

/**
 * Gets the current assets map for debugging purposes.
 *
 * @returns The loaded assets mapping object
 */
export const getOtaAssetsMap = (): Record<string, any> => {
  return { ...assetsMap };
};