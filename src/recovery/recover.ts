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

import {OTA_LOCK, OTA_CURRENT, OTA_BACKUP} from '../core/constants';
import {exists} from '../core/fileSystem';
import {cleanupOTA} from '../core/applyOTA';

export const recoverIfNeeded = async () => {
  const lockExists = await exists(OTA_LOCK);
  const currentExists = await exists(OTA_CURRENT);
  const backupExists = await exists(OTA_BACKUP);

  if (lockExists) {
    if (!currentExists && backupExists) {
      await RNFS.moveFile(OTA_BACKUP, OTA_CURRENT);
    }

    await cleanupOTA();
  }
};