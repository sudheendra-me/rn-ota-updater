// @ts-ignore - react-native-fs is a peerDependency
let RNFS: typeof import('react-native-fs');

try {
  // @ts-ignore - require is available at runtime
  RNFS = require('react-native-fs');
} catch (e) {
  throw new Error(
    '[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.'
  );
}

export const exists = (path: string) => RNFS.exists(path);

export const safeUnlink = async (path: string) => {
  if (await exists(path)) {
    await RNFS.unlink(path);
  }
};

export const computeSHA256 = (filePath: string) =>
  RNFS.hash(filePath, 'sha256');

export const ensureDiskSpace = async (requiredBytes: number) => {
  const fsInfo = await RNFS.getFSInfo();
  if (fsInfo.freeSpace < requiredBytes * 2) {
    throw new Error('Insufficient disk space for OTA');
  }
};