"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDiskSpace = exports.computeSHA256 = exports.safeUnlink = exports.exists = void 0;
// @ts-ignore - react-native-fs is a peerDependency
let RNFS;
try {
    // @ts-ignore - require is available at runtime
    RNFS = require('react-native-fs');
}
catch (e) {
    throw new Error('[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.');
}
const exists = (path) => RNFS.exists(path);
exports.exists = exists;
const safeUnlink = async (path) => {
    if (await (0, exports.exists)(path)) {
        await RNFS.unlink(path);
    }
};
exports.safeUnlink = safeUnlink;
const computeSHA256 = (filePath) => RNFS.hash(filePath, 'sha256');
exports.computeSHA256 = computeSHA256;
const ensureDiskSpace = async (requiredBytes) => {
    const fsInfo = await RNFS.getFSInfo();
    if (fsInfo.freeSpace < requiredBytes * 2) {
        throw new Error('Insufficient disk space for OTA');
    }
};
exports.ensureDiskSpace = ensureDiskSpace;
//# sourceMappingURL=fileSystem.js.map