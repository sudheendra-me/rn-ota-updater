export type OTABundle = {
    url: string;
    version: string;
    shaHash: string;
    bundleHash?: string;
    sizeBytes?: number;
    signature?: string;
    autoReload?: boolean;
    restartPackageName?: string;
};
export interface OTAMetadata {
    version: string | number;
    bundleHash: string;
    zipHash: string;
    installedAt: number;
    bundleSize: number;
}
export type OTAResult = {
    onSuccess: boolean;
    error?: string;
    metadata?: OTAMetadata;
};
export type RunOTAResult = {
    updated: boolean;
    reloadRequired: boolean;
    error?: string;
};
export interface OTARestartOptions {
    packageName?: string;
    delayMs?: number;
}
//# sourceMappingURL=ota.d.ts.map