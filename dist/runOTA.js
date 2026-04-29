"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOTA = void 0;
const applyOTA_1 = require("./core/applyOTA");
const reloadApp_1 = require("./reloadApp");
const runOTA = async (bundle) => {
    const res = await (0, applyOTA_1.applyOTABundle)(bundle);
    if (res.onSuccess) {
        if (bundle.autoReload) {
            (0, reloadApp_1.reloadApp)();
        }
        return { updated: true, reloadRequired: true };
    }
    return { updated: false, reloadRequired: false, error: res.error };
};
exports.runOTA = runOTA;
//# sourceMappingURL=runOTA.js.map