"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_BUNDLE_SIZE = exports.ASSETS_JSON = exports.BUNDLE_NAME = exports.OTA_LOCK = exports.OTA_ZIP = exports.OTA_BACKUP = exports.OTA_STAGING = exports.OTA_CURRENT = exports.OTA_ROOT = void 0;
const react_native_fs_1 = __importDefault(require("react-native-fs"));
exports.OTA_ROOT = `${react_native_fs_1.default.DocumentDirectoryPath}/ota`;
exports.OTA_CURRENT = `${exports.OTA_ROOT}/current`;
exports.OTA_STAGING = `${exports.OTA_ROOT}/staging`;
exports.OTA_BACKUP = `${exports.OTA_ROOT}/backup`;
exports.OTA_ZIP = `${exports.OTA_ROOT}/update.zip`;
exports.OTA_LOCK = `${exports.OTA_ROOT}/update.lock`;
exports.BUNDLE_NAME = 'index.android.bundle';
exports.ASSETS_JSON = 'assets.json';
exports.MIN_BUNDLE_SIZE = 5 * 1024;
//# sourceMappingURL=constants.js.map