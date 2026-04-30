type SourceTransformerSetter = (transformer: (resolver: any) => any) => void;

let setCustomSourceTransformer: SourceTransformerSetter | undefined;
let assetTransformerLoadError: unknown;
// @ts-ignore - react-native-fs is a peerDependency
let RNFS: typeof import("react-native-fs");

try {
  // @ts-ignore - require is available at runtime
  const resolveAssetSource = require("react-native/Libraries/Image/resolveAssetSource");
  const defaultExport = resolveAssetSource?.default;

  setCustomSourceTransformer =
    resolveAssetSource?.setCustomSourceTransformer ||
    defaultExport?.setCustomSourceTransformer;
} catch (e) {
  assetTransformerLoadError = e;
}

try {
  // @ts-ignore - require is available at runtime
  RNFS = require("react-native-fs");
} catch (e) {
  throw new Error(
    "[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.",
  );
}

const OTA_DIR = `${RNFS.DocumentDirectoryPath}/ota/current`;
const OTA_ASSETS_DIR = `${OTA_DIR}/assets`;
const OTA_ASSETS_MAP = `${OTA_DIR}/assets.json`;

let assetsMap: Record<string, any> = {};
let assetKeys: string[] = [];
let fileNameIndex: Record<string, string> = {};
let validAssetSet: Set<string> = new Set();
let isLoaded = false;

const getFileName = (value: string): string | undefined => {
  const cleanValue = value.split("?")[0].split("#")[0];
  return cleanValue.split("/").pop();
};

const addFileNameIndex = (name: string | undefined, key: string) => {
  if (name && !fileNameIndex[name]) {
    fileNameIndex[name] = key;
  }
};

const addRnAssetAliases = (key: string) => {
  if (!key.startsWith("rn/")) return;

  const fileName = getFileName(key);
  if (!fileName) return;

  addFileNameIndex(fileName, key);

  const extIndex = fileName.lastIndexOf(".");
  if (extIndex <= 0) return;

  const ext = fileName.slice(extIndex);
  let baseName = fileName.slice(0, extIndex);
  const hashMatch = baseName.match(/_[a-f0-9]{6,}$/i);

  if (hashMatch) {
    baseName = baseName.slice(0, hashMatch.index);
    addFileNameIndex(`${baseName}${ext}`, key);
  }

  const parts = baseName.split("_").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    addFileNameIndex(`${parts.slice(i).join("_")}${ext}`, key);
  }
};

const buildAssetIndexes = () => {
  assetKeys = Object.keys(assetsMap);
  fileNameIndex = {};

  assetKeys.forEach((key) => {
    addFileNameIndex(getFileName(key), key);
    addRnAssetAliases(key);
  });
};

const buildValidAssetSet = async () => {
  validAssetSet = new Set();

  await Promise.all(
    assetKeys.map(async (key) => {
      try {
        const exists = await RNFS.exists(`${OTA_ASSETS_DIR}/${key}`);
        if (exists) {
          validAssetSet.add(key);
        }
      } catch {
        // Ignore a single bad asset path and keep the rest of the map usable.
      }
    }),
  );
};

const findAssetKeyForUri = (uri: string): string | undefined => {
  const cleanUri = uri.replace(/\\/g, "/").split("?")[0].split("#")[0];

  const parts = cleanUri.split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const key = parts.slice(i).join("/");
    if (assetsMap[key]) {
      return key;
    }
  }

  const fileName = getFileName(cleanUri);
  if (fileName && fileNameIndex[fileName]) {
    return fileNameIndex[fileName];
  }
};

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
    // if (!exists) return;
    if (!exists) {
      isLoaded = true;
      return;
    }

    const assetsDirExists = await RNFS.exists(OTA_ASSETS_DIR);
    if (!assetsDirExists) {
      console.log("[OTA] assets directory missing");
      return;
    }

    const content = await RNFS.readFile(OTA_ASSETS_MAP, "utf8");
    try {
      assetsMap = JSON.parse(content);
    } catch {
      console.log("[OTA] Invalid assets.json");
      return;
    }

    buildAssetIndexes();
    await buildValidAssetSet();
    console.log("[OTA] Assets loaded:", validAssetSet.size);

    if (typeof setCustomSourceTransformer !== "function") {
      console.log(
        "[OTA] Transformer not available",
        assetTransformerLoadError || "",
      );
      isLoaded = true;
      return;
    }

    setCustomSourceTransformer((resolver) => {
      try {
        const defaultSource = resolver.defaultAsset();
        if (!defaultSource || !defaultSource.uri) return defaultSource;

        const uri = defaultSource.uri;
        const matchKey = findAssetKeyForUri(uri);

        if (matchKey && validAssetSet.has(matchKey)) {
          return {
            ...defaultSource,
            uri: `file://${OTA_ASSETS_DIR}/${matchKey}`,
          };
        }

        return defaultSource;
      } catch (err) {
        if (typeof __DEV__ !== "undefined" && __DEV__) {
          console.log("[OTA] Image interceptor error", err);
        }
        return resolver.defaultAsset();
      }
    });

    isLoaded = true;
  } catch (e) {
    console.log("[OTA] Failed to load assets map", e);
  }
};

/**
 * Clears the loaded assets map and resets the asset interceptor.
 * Useful for testing or when switching between different OTA versions.
 */
export const clearOtaAssetsMap = (): void => {
  assetsMap = {};
  assetKeys = [];
  fileNameIndex = {};
  validAssetSet = new Set();
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
