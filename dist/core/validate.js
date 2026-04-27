"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStaging = void 0;
// @ts-ignore - react-native-fs is a peerDependency
let RNFS;
try {
    // @ts-ignore - require is available at runtime
    RNFS = require('react-native-fs');
}
catch (e) {
    throw new Error('[rn-ota-updater] Missing dependency: react-native-fs. Please install it in your app.');
}
const constants_1 = require("./constants");
const fileSystem_1 = require("./fileSystem");
const validateStaging = async (expectedHash) => {
    const bundlePath = `${constants_1.OTA_STAGING}/${constants_1.BUNDLE_NAME}`;
    const assetsJsonPath = `${constants_1.OTA_STAGING}/${constants_1.ASSETS_JSON}`;
    if (!(await (0, fileSystem_1.exists)(bundlePath))) {
        throw new Error('Bundle missing in staging');
    }
    if (!(await (0, fileSystem_1.exists)(assetsJsonPath))) {
        throw new Error('assets.json missing in staging');
    }
    const stat = await RNFS.stat(bundlePath);
    if (stat.size < constants_1.MIN_BUNDLE_SIZE) {
        throw new Error('Bundle too small');
    }
    if (expectedHash) {
        const actualHash = await (0, fileSystem_1.computeSHA256)(bundlePath);
        if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
            throw new Error('Bundle hash mismatch');
        }
    }
};
exports.validateStaging = validateStaging;
//# sourceMappingURL=validate.js.map