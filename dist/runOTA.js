"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOTA = void 0;
const applyOTA_1 = require("./core/applyOTA");
const runOTA = async (bundle) => {
    const res = await (0, applyOTA_1.applyOTABundle)(bundle);
    if (res.onSuccess) {
        return { updated: true, reloadRequired: true };
    }
    return { updated: false, error: res.error };
};
exports.runOTA = runOTA;
//# sourceMappingURL=runOTA.js.map