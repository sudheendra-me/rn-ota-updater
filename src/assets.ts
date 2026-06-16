type SourceTransformerSetter = (transformer: (resolver: any) => any) => void;

let setCustomSourceTransformer: SourceTransformerSetter | undefined;

// Peer deps
let RNFS: typeof import("react-native-fs");
// @ts-ignore - require is available at runtime
let Image: typeof import("react-native").Image;

// -------------------- LOAD INTERNALS --------------------

try {
  // @ts-ignore - require is available at runtime
  const resolveAssetSource = require("react-native/Libraries/Image/resolveAssetSource");
  const defaultExport = resolveAssetSource?.default;

  setCustomSourceTransformer =
    resolveAssetSource?.setCustomSourceTransformer ||
    defaultExport?.setCustomSourceTransformer;
} catch (e) {
  // ignore
  if (__DEV__) {
    console.warn(
      "[rn-ota-updater] Failed to resolve Asset Source OTA",
      e,
    );
  }
}

try {
  // @ts-ignore - require is available at runtime
  RNFS = require("react-native-fs");
} catch (e) {
  throw new Error(
    "[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.",
  );
}

try {
  // @ts-ignore - require is available at runtime
  Image = require("react-native").Image;
} catch {
  // ignore
  throw new Error(
    "[rn-ota-updater] Missing dependency: react-native :). Please install it in your app.",
  );
}

// -------------------- CONSTANTS --------------------

const OTA_DIR = `${RNFS.DocumentDirectoryPath}/ota/current`;
const OTA_ASSETS_DIR = `${OTA_DIR}/assets`;
const OTA_ASSETS_MAP = `${OTA_DIR}/assets.json`;

// -------------------- STATE --------------------

let assetsMap: Record<string, any> = {};
let assetKeys: string[] = [];
let fileNameIndex: Record<string, string> = {};
let validAssetSet: Set<string> = new Set();

let isLoaded = false;
let isPatched = false;
let originalResolveAssetSource: ((source: any) => any) | undefined;

// -------------------- HELPERS --------------------

const normalizeUri = (uri: string): string =>
  uri
    .replace(/\\/g, "/")
    .replace(/^asset:\//, "")
    .replace(/^file:\/\//, "")
    .split("?")[0]
    .split("#")[0];

const getFileName = (value: string): string | undefined =>
  normalizeUri(value).split("/").pop();

const removeScaleSuffix = (fileName: string): string => {
  const extIndex = fileName.lastIndexOf(".");
  if (extIndex <= 0) return fileName;

  const ext = fileName.slice(extIndex);
  const base = fileName.slice(0, extIndex).replace(/@\dx$/, "");
  return `${base}${ext}`;
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
  addFileNameIndex(removeScaleSuffix(fileName), key);
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
        if (exists) validAssetSet.add(key);
      } catch {}
    }),
  );
};

const findAssetKeyForUri = (uri: string): string | undefined => {
  const clean = normalizeUri(uri);

  if (assetsMap[clean]) return clean;

  const parts = clean.split("/").filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const key = parts.slice(i).join("/");
    if (assetsMap[key]) return key;
  }

  const fileName = getFileName(clean);
  if (fileName && fileNameIndex[fileName]) return fileNameIndex[fileName];

  if (fileName) {
    const noScale = removeScaleSuffix(fileName);
    if (fileNameIndex[noScale]) return fileNameIndex[noScale];
  }

  return undefined; 
};

// -------------------- CORE PATCH --------------------

const patchResolveAssetSource = () => {
  if (!Image || isPatched) return;

  const original = Image.resolveAssetSource;
  if (!original) return;
  originalResolveAssetSource = original;

  Image.resolveAssetSource = (source: any) => {
    const resolved = original(source);

    try {
      if (!resolved?.uri) return resolved;

      const matchKey = findAssetKeyForUri(resolved.uri);

      if (matchKey && validAssetSet.has(matchKey)) {
        return {
          ...resolved,
          uri: `file://${OTA_ASSETS_DIR}/${matchKey}`,
        };
      }

      return resolved;
    } catch {
      return resolved;
    }
  };

  isPatched = true;
};

// -------------------- TRANSFORMER --------------------

const attachTransformer = () => {
  if (typeof setCustomSourceTransformer !== "function") {
    return;
  }

  setCustomSourceTransformer((resolver) => {
    const asset = resolver.defaultAsset();
    if (!asset?.uri) return asset;

    const matchKey = findAssetKeyForUri(asset.uri);

    if (matchKey && validAssetSet.has(matchKey)) {
      return {
        ...asset,
        uri: `file://${OTA_ASSETS_DIR}/${matchKey}`,
      };
    }
    return asset;
  });
};

// -------------------- PUBLIC API --------------------

export const initOtaAssets = async (): Promise<void> => {
  if (isLoaded) return;

  try {
    const exists = await RNFS.exists(OTA_ASSETS_MAP);
    if (!exists) {
      // STILL patch so future loads work
      patchResolveAssetSource();
      isLoaded = true;
      return;
    }
    const content = await RNFS.readFile(OTA_ASSETS_MAP, "utf8");
    assetsMap = JSON.parse(content);

    buildAssetIndexes();
    await buildValidAssetSet();

    // Try transformer (optional)
    attachTransformer();

    // Always patch (main fix)
    patchResolveAssetSource();

    isLoaded = true;
  } catch (e) {
    if(__DEV__) console.warn("[rn-ota-updater] Failed to initialize OTA assets", e);
  }
};

export const loadOtaAssetsMap = initOtaAssets;

export const clearOtaAssetsMap = () => {
  assetsMap = {};
  assetKeys = [];
  fileNameIndex = {};
  validAssetSet = new Set();
  isLoaded = false;
  isPatched = false;

  if (originalResolveAssetSource && Image) {
    Image.resolveAssetSource = originalResolveAssetSource;
    originalResolveAssetSource = undefined;
  }
};

export const getOtaAssetsMap = () => ({ ...assetsMap });
