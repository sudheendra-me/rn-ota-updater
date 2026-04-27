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

import {
  OTA_STAGING,
  BUNDLE_NAME,
  ASSETS_JSON,
  MIN_BUNDLE_SIZE,
} from './constants';
import {exists, computeSHA256} from './fileSystem';

export const validateStaging = async (expectedHash?: string) => {
  const bundlePath = `${OTA_STAGING}/${BUNDLE_NAME}`;
  const assetsJsonPath = `${OTA_STAGING}/${ASSETS_JSON}`;

  if (!(await exists(bundlePath))) {
    throw new Error('Bundle missing in staging');
  }

  if (!(await exists(assetsJsonPath))) {
    throw new Error('assets.json missing in staging');
  }

  const stat = await RNFS.stat(bundlePath);
  if (stat.size < MIN_BUNDLE_SIZE) {
    throw new Error('Bundle too small');
  }

  if (expectedHash) {
    const actualHash = await computeSHA256(bundlePath);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error('Bundle hash mismatch');
    }
  }
};