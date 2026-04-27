import RNFS from 'react-native-fs';

export const OTA_ROOT = `${RNFS.DocumentDirectoryPath}/ota`;
export const OTA_CURRENT = `${OTA_ROOT}/current`;
export const OTA_STAGING = `${OTA_ROOT}/staging`;
export const OTA_BACKUP = `${OTA_ROOT}/backup`;

export const OTA_ZIP = `${OTA_ROOT}/update.zip`;
export const OTA_LOCK = `${OTA_ROOT}/update.lock`;

export const BUNDLE_NAME = 'index.android.bundle';
export const ASSETS_JSON = 'assets.json';

export const MIN_BUNDLE_SIZE = 5 * 1024;