import { OTABundle, OTAResult, OTAMetadata } from '../types/ota';
export declare const cleanupOTA: () => Promise<void>;
export declare const applyOTABundle: (bundle: OTABundle) => Promise<OTAResult>;
export declare const getMetadata: () => Promise<OTAMetadata | null>;
/**
 * Get the current OTA bundle version
 * Returns '0' if no OTA is installed
 */
export declare const getCurrentBundleVersion: () => Promise<string>;
/**
 * Get detailed OTA metadata
 * Returns null if no OTA is installed
 */
export declare const getCurrentBundleMetadata: () => Promise<OTAMetadata | null>;
//# sourceMappingURL=applyOTA.d.ts.map