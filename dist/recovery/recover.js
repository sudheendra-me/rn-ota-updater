"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recoverIfNeeded = void 0;
// @ts-ignore - react-native-fs is a peerDependency
let RNFS;
try {
    // @ts-ignore - require is available at runtime
    RNFS = require('react-native-fs');
}
catch (e) {
    throw new Error('[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.');
}
const constants_1 = require("../core/constants");
const fileSystem_1 = require("../core/fileSystem");
const applyOTA_1 = require("../core/applyOTA");
const recoverIfNeeded = async () => {
    const lockExists = await (0, fileSystem_1.exists)(constants_1.OTA_LOCK);
    const currentExists = await (0, fileSystem_1.exists)(constants_1.OTA_CURRENT);
    const backupExists = await (0, fileSystem_1.exists)(constants_1.OTA_BACKUP);
    if (lockExists) {
        if (!currentExists && backupExists) {
            await RNFS.moveFile(constants_1.OTA_BACKUP, constants_1.OTA_CURRENT);
        }
        await (0, applyOTA_1.cleanupOTA)();
    }
};
exports.recoverIfNeeded = recoverIfNeeded;
//# sourceMappingURL=recover.js.map