export type OTABundle = {
    url: string;
    version: string;
    shaHash: string;
    bundleHash?: string;
    sizeBytes?: number;
    signature?: string;
};
export type OTAResult = {
    onSuccess: boolean;
    error?: string;
};
//# sourceMappingURL=ota.d.ts.map