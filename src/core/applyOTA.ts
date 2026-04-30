import {Platform} from 'react-native';

// @ts-ignore - react-native-fs is a peerDependency
let RNFS: typeof import('react-native-fs');
// @ts-ignore - react-native-zip-archive is a peerDependency
let unzip: typeof import('react-native-zip-archive').unzip;

try {
  // @ts-ignore - require is available at runtime
  RNFS = require('react-native-fs');
} catch (e) {
  throw new Error(
    '[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.'
  );
}

try {
  // @ts-ignore - require is available at runtime
  unzip = require('react-native-zip-archive').unzip;
} catch (e) {
  throw new Error(
    '[rn-ota-updater] Missing dependency: react-native-zip-archive. Please install it in your app.'
  );
}

import {
  OTA_ROOT,
  OTA_CURRENT,
  OTA_STAGING,
  OTA_BACKUP,
  OTA_ZIP,
  OTA_LOCK,
  BUNDLE_NAME,
  ASSETS_JSON,
} from './constants';

import {safeUnlink, computeSHA256, ensureDiskSpace, exists} from './fileSystem';
import {validateStaging} from './validate';
import {OTABundle, OTAResult} from '../types/ota';

// cleanup
export const cleanupOTA = async () => {
  await safeUnlink(OTA_ZIP);
  await safeUnlink(OTA_LOCK);
  await safeUnlink(OTA_STAGING);
};

// atomic swap
const atomicSwap = async () => {
  if (await exists(OTA_BACKUP)) {
    await safeUnlink(OTA_BACKUP);
  }

  if (await exists(OTA_CURRENT)) {
    await RNFS.moveFile(OTA_CURRENT, OTA_BACKUP);
  }

  await RNFS.mkdir(OTA_CURRENT);

  await RNFS.moveFile(
    `${OTA_STAGING}/${BUNDLE_NAME}`,
    `${OTA_CURRENT}/${BUNDLE_NAME}`,
  );

  await RNFS.moveFile(
    `${OTA_STAGING}/hash.txt`,
    `${OTA_CURRENT}/hash.txt`,
  );

  await RNFS.moveFile(
    `${OTA_STAGING}/${ASSETS_JSON}`,
    `${OTA_CURRENT}/${ASSETS_JSON}`,
  );

  if (await exists(`${OTA_STAGING}/assets`)) {
    await RNFS.moveFile(
      `${OTA_STAGING}/assets`,
      `${OTA_CURRENT}/assets`,
    );
  }
};

// main
export const applyOTABundle = async (
  bundle: OTABundle,
): Promise<OTAResult> => {
  if (Platform.OS !== 'android') {
    return {onSuccess: false, error: 'Unsupported platform'};
  }

  try {
    await RNFS.mkdir(OTA_ROOT);

    // lock
    await RNFS.writeFile(OTA_LOCK, '1');

    await cleanupOTA();

    if (bundle.sizeBytes) {
      await ensureDiskSpace(bundle.sizeBytes);
    }

    // download
    const res = await RNFS.downloadFile({
      fromUrl: bundle.url,
      toFile: OTA_ZIP,
    }).promise;

    if (res.statusCode !== 200) {
      throw new Error('Download failed');
    }

    // verify zip
    const zipHash = await computeSHA256(OTA_ZIP);
    if (zipHash.toLowerCase() !== bundle.shaHash.toLowerCase()) {
      throw new Error('ZIP hash mismatch');
    }

    // unzip
    await safeUnlink(OTA_STAGING);
    await unzip(OTA_ZIP, OTA_STAGING);

    // validate
    await validateStaging(bundle.bundleHash);

    // write hash.txt for native
    await RNFS.writeFile(
      `${OTA_STAGING}/hash.txt`,
      bundle.bundleHash || '',
      'utf8',
    );

    // swap
    await atomicSwap();

    await cleanupOTA();

    return {onSuccess: true};
  } catch (e: any) {
    // rollback
    if (await exists(OTA_BACKUP)) {
      if (await exists(OTA_CURRENT)) {
        await safeUnlink(OTA_CURRENT);
      }
      await RNFS.moveFile(OTA_BACKUP, OTA_CURRENT);
    }

    await cleanupOTA();

    return {onSuccess: false, error: e.message};
  } finally {
    await safeUnlink(OTA_LOCK);
  }
};
