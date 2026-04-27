import { OTABundle } from './types/ota';
export declare const runOTA: (bundle: OTABundle) => Promise<{
    updated: boolean;
    reloadRequired: boolean;
    error?: undefined;
} | {
    updated: boolean;
    error: string | undefined;
    reloadRequired?: undefined;
}>;
//# sourceMappingURL=runOTA.d.ts.map