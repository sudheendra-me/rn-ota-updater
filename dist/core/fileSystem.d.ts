export declare const exists: (path: string) => Promise<boolean>;
export declare const safeUnlink: (path: string) => Promise<void>;
export declare const computeSHA256: (filePath: string) => Promise<string>;
export declare const ensureDiskSpace: (requiredBytes: number) => Promise<void>;
//# sourceMappingURL=fileSystem.d.ts.map