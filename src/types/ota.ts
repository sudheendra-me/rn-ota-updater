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

export type OTAResult = {
  onSuccess: boolean;
  error?: string;
};

export type RunOTAResult = {
  updated: boolean;
  reloadRequired: boolean;
  error?: string;
};
