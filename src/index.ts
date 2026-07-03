// Core OTA functions
export {
  applyOTABundle,
  cleanupOTA,
  getCurrentBundleVersion,
  getCurrentBundleMetadata,
  getMetadata,
} from './core/applyOTA';

// Runtime functions
export {runOTA} from './runOTA';
export {OTARestart, reloadApp} from './reloadApp';

// Recovery
export {recoverIfNeeded} from './recovery/recover';

// Assets management
export {
  initOtaAssets,
  loadOtaAssetsMap,
  clearOtaAssetsMap,
  getOtaAssetsMap,
} from './assets';

// Types
export * from './types/ota';