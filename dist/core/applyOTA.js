"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentBundleMetadata = exports.getCurrentBundleVersion = exports.getMetadata = exports.applyOTABundle = exports.cleanupOTA = void 0;
const react_native_1 = require("react-native");
// @ts-ignore - react-native-fs is a peerDependency
let RNFS;
// @ts-ignore - react-native-zip-archive is a peerDependency
let unzip;
try {
    // @ts-ignore - require is available at runtime
    RNFS = require('react-native-fs');
}
catch (e) {
    throw new Error('[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.');
}
try {
    // @ts-ignore - require is available at runtime
    unzip = require('react-native-zip-archive').unzip;
}
catch (e) {
    throw new Error('[rn-ota-updater] Missing dependency: react-native-zip-archive. Please install it in your app.');
}
const constants_1 = require("./constants");
const fileSystem_1 = require("./fileSystem");
const validate_1 = require("./validate");
// ===== CLEANUP =====
const cleanupOTA = async () => {
    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_ZIP);
    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_STAGING);
    // DO NOT delete OTA_LOCK here
};
exports.cleanupOTA = cleanupOTA;
const installedAt = Date.now();
// ===== ATOMIC SWAP =====
const atomicSwap = async () => {
    // Remove old backup if exists
    if (await (0, fileSystem_1.exists)(constants_1.OTA_BACKUP)) {
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_BACKUP);
    }
    // Move current to backup
    if (await (0, fileSystem_1.exists)(constants_1.OTA_CURRENT)) {
        await RNFS.moveFile(constants_1.OTA_CURRENT, constants_1.OTA_BACKUP);
    }
    // Move staging to current
    await RNFS.moveFile(constants_1.OTA_STAGING, constants_1.OTA_CURRENT);
};
// ===== CREATE METADATA =====
const createMetadata = async (stagingPath, bundle, bundleHash, zipHash) => {
    const metadata = {
        version: bundle.version,
        bundleHash: bundleHash,
        zipHash: zipHash,
        installedAt: installedAt,
        bundleSize: bundle.sizeBytes || 0,
    };
    await RNFS.writeFile(`${stagingPath}/metadata.json`, JSON.stringify(metadata, null, 2), 'utf8');
    console.log('📦 Metadata created:', metadata);
};
// ===== MAIN APPLY FUNCTION =====
const applyOTABundle = async (bundle) => {
    if (react_native_1.Platform.OS !== 'android') {
        return { onSuccess: false, error: 'Unsupported platform' };
    }
    let createdMetadata = null;
    try {
        // Ensure OTA root exists
        await RNFS.mkdir(constants_1.OTA_ROOT);
        // Clean up previous download and staging files
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_ZIP);
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_STAGING);
        // Create lock file AFTER cleanup
        await RNFS.writeFile(constants_1.OTA_LOCK, '1');
        // Check disk space
        if (bundle.sizeBytes) {
            await (0, fileSystem_1.ensureDiskSpace)(bundle.sizeBytes);
        }
        // Download
        const res = await RNFS.downloadFile({
            fromUrl: bundle.url,
            toFile: constants_1.OTA_ZIP,
        }).promise;
        if (res.statusCode !== 200) {
            throw new Error(`Download failed with status ${res.statusCode}`);
        }
        // Verify zip hash
        const zipHash = await (0, fileSystem_1.computeSHA256)(constants_1.OTA_ZIP);
        if (zipHash.toLowerCase() !== bundle.shaHash.toLowerCase()) {
            throw new Error('ZIP hash mismatch');
        }
        // Unzip
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_STAGING);
        await unzip(constants_1.OTA_ZIP, constants_1.OTA_STAGING);
        // Validate staging contents
        await (0, validate_1.validateStaging)(bundle.bundleHash);
        // Compute or use provided bundle hash
        const bundlePath = `${constants_1.OTA_STAGING}/${constants_1.BUNDLE_NAME}`;
        const bundleHash = bundle.bundleHash
            ? bundle.bundleHash
            : await (0, fileSystem_1.computeSHA256)(bundlePath);
        // Write hash.txt for native verification
        await RNFS.writeFile(`${constants_1.OTA_STAGING}/hash.txt`, bundleHash, 'utf8');
        // Create metadata.json
        await createMetadata(constants_1.OTA_STAGING, bundle, bundleHash, zipHash);
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
        await (0, exports.cleanupOTA)();
        // Remove lock only on success
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_LOCK);
        return {
            onSuccess: true,
            metadata: createdMetadata,
        };
    }
    catch (e) {
        console.error('📦 OTA update failed:', e.message);
        // Rollback on failure
        try {
            if (await (0, fileSystem_1.exists)(constants_1.OTA_BACKUP)) {
                if (await (0, fileSystem_1.exists)(constants_1.OTA_CURRENT)) {
                    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_CURRENT);
                }
                await RNFS.moveFile(constants_1.OTA_BACKUP, constants_1.OTA_CURRENT);
                console.log('📦 Rollback successful');
            }
        }
        catch (rollbackError) {
            console.error('📦 Rollback failed:', rollbackError);
        }
        // Cleanup temporary files
        await (0, exports.cleanupOTA)();
        // Remove lock even on failure
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_LOCK);
        return {
            onSuccess: false,
            error: e.message || 'Unknown error occurred',
        };
    }
};
exports.applyOTABundle = applyOTABundle;
// ===== METADATA READER =====
const getMetadata = async () => {
    const metadataPath = `${constants_1.OTA_CURRENT}/metadata.json`;
    try {
        const metadataExists = await (0, fileSystem_1.exists)(metadataPath);
        if (!metadataExists) {
            // Try backup if current doesn't exist
            const backupPath = `${constants_1.OTA_BACKUP}/metadata.json`;
            if (await (0, fileSystem_1.exists)(backupPath)) {
                const content = await RNFS.readFile(backupPath, 'utf8');
                return JSON.parse(content);
            }
            return null;
        }
        const content = await RNFS.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(content);
        // Validate metadata structure
        if (!metadata.version || !metadata.zipHash) {
            console.warn('📦 Incomplete metadata found');
            return null;
        }
        return metadata;
    }
    catch (error) {
        console.error('📦 Failed to read metadata:', error);
        return null;
    }
};
exports.getMetadata = getMetadata;
// ===== PUBLIC API =====
/**
 * Get the current OTA bundle version
 * Returns '0' if no OTA is installed
 */
const getCurrentBundleVersion = async () => {
    try {
        const metadata = await (0, exports.getMetadata)();
        return metadata ? String(metadata.version) : '0';
    }
    catch (error) {
        console.error('[rn-ota-updater] Failed to get version:', error);
        return '0';
    }
};
exports.getCurrentBundleVersion = getCurrentBundleVersion;
/**
 * Get detailed OTA metadata
 * Returns null if no OTA is installed
 */
const getCurrentBundleMetadata = async () => {
    try {
        return await (0, exports.getMetadata)();
    }
    catch (error) {
        console.error('[rn-ota-updater] Failed to get metadata:', error);
        return null;
    }
};
exports.getCurrentBundleMetadata = getCurrentBundleMetadata;
//# sourceMappingURL=applyOTA.js.map