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
import {OTABundle, OTAResult, OTAMetadata} from '../types/ota';

// ===== CLEANUP =====
export const cleanupOTA = async () => {
  await safeUnlink(OTA_ZIP);
  await safeUnlink(OTA_STAGING);
  // DO NOT delete OTA_LOCK here
};

const installedAt = Date.now();

// ===== ATOMIC SWAP =====
const atomicSwap = async () => {
  // Remove old backup if exists
  if (await exists(OTA_BACKUP)) {
    await safeUnlink(OTA_BACKUP);
  }

  // Move current to backup
  if (await exists(OTA_CURRENT)) {
    await RNFS.moveFile(OTA_CURRENT, OTA_BACKUP);
  }

  // Move staging to current
  await RNFS.moveFile(OTA_STAGING, OTA_CURRENT);
};

// ===== CREATE METADATA =====
const createMetadata = async (
  stagingPath: string,
  bundle: OTABundle,
  bundleHash: string,
  zipHash: string
): Promise<void> => {
  const metadata: OTAMetadata = {
    version: bundle.version,
    bundleHash: bundleHash,
    zipHash: zipHash,
    installedAt: installedAt,
    bundleSize: bundle.sizeBytes || 0,
  };

  await RNFS.writeFile(
    `${stagingPath}/metadata.json`,
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
  
  console.log('📦 Metadata created:', metadata);
};

// ===== MAIN APPLY FUNCTION =====
export const applyOTABundle = async (
  bundle: OTABundle,
): Promise<OTAResult> => {
  if (Platform.OS !== 'android') {
    return {onSuccess: false, error: 'Unsupported platform'};
  }

  let createdMetadata: OTAMetadata | null = null;

  try {
    // Ensure OTA root exists
    await RNFS.mkdir(OTA_ROOT);

    // Clean up previous download and staging files
    await safeUnlink(OTA_ZIP);
    await safeUnlink(OTA_STAGING);

    // Create lock file AFTER cleanup
    await RNFS.writeFile(OTA_LOCK, '1');

    // Check disk space
    if (bundle.sizeBytes) {
      await ensureDiskSpace(bundle.sizeBytes);
    }

    // Download
    const res = await RNFS.downloadFile({
      fromUrl: bundle.url,
      toFile: OTA_ZIP,
    }).promise;

    if (res.statusCode !== 200) {
      throw new Error(`Download failed with status ${res.statusCode}`);
    }

    // Verify zip hash
    const zipHash = await computeSHA256(OTA_ZIP);
    if (zipHash.toLowerCase() !== bundle.shaHash.toLowerCase()) {
      throw new Error('ZIP hash mismatch');
    }

    // Unzip
    await safeUnlink(OTA_STAGING);
    await unzip(OTA_ZIP, OTA_STAGING);

    // Validate staging contents
    await validateStaging(bundle.bundleHash);

    // Compute or use provided bundle hash
    const bundlePath = `${OTA_STAGING}/${BUNDLE_NAME}`;
    const bundleHash = bundle.bundleHash
      ? bundle.bundleHash
      : await computeSHA256(bundlePath);

    // Write hash.txt for native verification
    await RNFS.writeFile(`${OTA_STAGING}/hash.txt`, bundleHash, 'utf8');

    // Create metadata.json
    await createMetadata(OTA_STAGING, bundle, bundleHash, zipHash);
    
    // Store metadata for result
    createdMetadata = {
      version: bundle.version,
      bundleHash: bundleHash,
      zipHash: zipHash,
      installedAt: installedAt,
      bundleSize: bundle.sizeBytes || 0,
    };

    // Atomic swap
    await atomicSwap();

    // Cleanup temporary files
    await cleanupOTA();

    // Remove lock only on success
    await safeUnlink(OTA_LOCK);

    return {
      onSuccess: true,
      metadata: createdMetadata,
    };
    
  } catch (e: any) {
    console.error('📦 OTA update failed:', e.message);
    
    // Rollback on failure
    try {
      if (await exists(OTA_BACKUP)) {
        if (await exists(OTA_CURRENT)) {
          await safeUnlink(OTA_CURRENT);
        }
        await RNFS.moveFile(OTA_BACKUP, OTA_CURRENT);
        console.log('📦 Rollback successful');
      }
    } catch (rollbackError) {
      console.error('📦 Rollback failed:', rollbackError);
    }

    // Cleanup temporary files
    await cleanupOTA();
    
    // Remove lock even on failure
    await safeUnlink(OTA_LOCK);

    return {
      onSuccess: false,
      error: e.message || 'Unknown error occurred',
    };
  }
};

// ===== METADATA READER =====
export const getMetadata = async (): Promise<OTAMetadata | null> => {
  const metadataPath = `${OTA_CURRENT}/metadata.json`;
  
  try {
    const metadataExists = await exists(metadataPath);
    if (!metadataExists) {
      // Try backup if current doesn't exist
      const backupPath = `${OTA_BACKUP}/metadata.json`;
      if (await exists(backupPath)) {
        const content = await RNFS.readFile(backupPath, 'utf8');
        return JSON.parse(content);
      }
      return null;
    }

    const content = await RNFS.readFile(metadataPath, 'utf8');
    const metadata: OTAMetadata = JSON.parse(content);
    
    // Validate metadata structure
    if (!metadata.version || !metadata.zipHash) {
      console.warn('📦 Incomplete metadata found');
      return null;
    }
    
    return metadata;
    
  } catch (error) {
    console.error('📦 Failed to read metadata:', error);
    return null;
  }
};

// ===== PUBLIC API =====

/**
 * Get the current OTA bundle version
 * Returns '0' if no OTA is installed
 */
export const getCurrentBundleVersion = async (): Promise<string> => {
  try {
    const metadata = await getMetadata();
    return metadata ? String(metadata.version) : '0';
  } catch (error) {
    console.error('[rn-ota-updater] Failed to get version:', error);
    return '0';
  }
};

/**
 * Get detailed OTA metadata
 * Returns null if no OTA is installed
 */
export const getCurrentBundleMetadata = async (): Promise<OTAMetadata | null> => {
  try {
    return await getMetadata();
  } catch (error) {
    console.error('[rn-ota-updater] Failed to get metadata:', error);
    return null;
  }
};
