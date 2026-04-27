"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyOTABundle = exports.cleanupOTA = void 0;
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
// cleanup
const cleanupOTA = async () => {
    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_ZIP);
    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_LOCK);
    await (0, fileSystem_1.safeUnlink)(constants_1.OTA_STAGING);
};
exports.cleanupOTA = cleanupOTA;
// atomic swap
const atomicSwap = async () => {
    if (await (0, fileSystem_1.exists)(constants_1.OTA_BACKUP)) {
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_BACKUP);
    }
    if (await (0, fileSystem_1.exists)(constants_1.OTA_CURRENT)) {
        await RNFS.moveFile(constants_1.OTA_CURRENT, constants_1.OTA_BACKUP);
    }
    await RNFS.mkdir(constants_1.OTA_CURRENT);
    await RNFS.moveFile(`${constants_1.OTA_STAGING}/${constants_1.BUNDLE_NAME}`, `${constants_1.OTA_CURRENT}/${constants_1.BUNDLE_NAME}`);
    await RNFS.moveFile(`${constants_1.OTA_STAGING}/hash.txt`, `${constants_1.OTA_CURRENT}/hash.txt`);
};
// main
const applyOTABundle = async (bundle) => {
    if (react_native_1.Platform.OS !== 'android') {
        return { onSuccess: false, error: 'Unsupported platform' };
    }
    try {
        await RNFS.mkdir(constants_1.OTA_ROOT);
        // lock
        await RNFS.writeFile(constants_1.OTA_LOCK, '1');
        await (0, exports.cleanupOTA)();
        if (bundle.sizeBytes) {
            await (0, fileSystem_1.ensureDiskSpace)(bundle.sizeBytes);
        }
        // download
        const res = await RNFS.downloadFile({
            fromUrl: bundle.url,
            toFile: constants_1.OTA_ZIP,
        }).promise;
        if (res.statusCode !== 200) {
            throw new Error('Download failed');
        }
        // verify zip
        const zipHash = await (0, fileSystem_1.computeSHA256)(constants_1.OTA_ZIP);
        if (zipHash.toLowerCase() !== bundle.shaHash.toLowerCase()) {
            throw new Error('ZIP hash mismatch');
        }
        // unzip
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_STAGING);
        await unzip(constants_1.OTA_ZIP, constants_1.OTA_STAGING);
        // validate
        await (0, validate_1.validateStaging)(bundle.bundleHash);
        // write hash.txt for native
        await RNFS.writeFile(`${constants_1.OTA_STAGING}/hash.txt`, bundle.bundleHash || '', 'utf8');
        // swap
        await atomicSwap();
        await (0, exports.cleanupOTA)();
        return { onSuccess: true };
    }
    catch (e) {
        // rollback
        if (await (0, fileSystem_1.exists)(constants_1.OTA_BACKUP)) {
            if (await (0, fileSystem_1.exists)(constants_1.OTA_CURRENT)) {
                await (0, fileSystem_1.safeUnlink)(constants_1.OTA_CURRENT);
            }
            await RNFS.moveFile(constants_1.OTA_BACKUP, constants_1.OTA_CURRENT);
        }
        await (0, exports.cleanupOTA)();
        return { onSuccess: false, error: e.message };
    }
    finally {
        await (0, fileSystem_1.safeUnlink)(constants_1.OTA_LOCK);
    }
};
exports.applyOTABundle = applyOTABundle;
//# sourceMappingURL=applyOTA.js.map