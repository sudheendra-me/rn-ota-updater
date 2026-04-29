"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOtaAssetsMap = exports.clearOtaAssetsMap = exports.loadOtaAssetsMap = exports.recoverIfNeeded = exports.cleanupOTA = exports.applyOTABundle = exports.reloadApp = exports.OTARestart = exports.runOTA = void 0;
var runOTA_1 = require("./runOTA");
Object.defineProperty(exports, "runOTA", { enumerable: true, get: function () { return runOTA_1.runOTA; } });
var reloadApp_1 = require("./reloadApp");
Object.defineProperty(exports, "OTARestart", { enumerable: true, get: function () { return reloadApp_1.OTARestart; } });
Object.defineProperty(exports, "reloadApp", { enumerable: true, get: function () { return reloadApp_1.reloadApp; } });
var applyOTA_1 = require("./core/applyOTA");
Object.defineProperty(exports, "applyOTABundle", { enumerable: true, get: function () { return applyOTA_1.applyOTABundle; } });
Object.defineProperty(exports, "cleanupOTA", { enumerable: true, get: function () { return applyOTA_1.cleanupOTA; } });
var recover_1 = require("./recovery/recover");
Object.defineProperty(exports, "recoverIfNeeded", { enumerable: true, get: function () { return recover_1.recoverIfNeeded; } });
var assets_1 = require("./assets");
Object.defineProperty(exports, "loadOtaAssetsMap", { enumerable: true, get: function () { return assets_1.loadOtaAssetsMap; } });
Object.defineProperty(exports, "clearOtaAssetsMap", { enumerable: true, get: function () { return assets_1.clearOtaAssetsMap; } });
Object.defineProperty(exports, "getOtaAssetsMap", { enumerable: true, get: function () { return assets_1.getOtaAssetsMap; } });
__exportStar(require("./types/ota"), exports);
//# sourceMappingURL=index.js.map