import {applyOTABundle} from './core/applyOTA';
import {reloadApp} from './reloadApp';
import {OTABundle, RunOTAResult} from './types/ota';

export const runOTA = async (bundle: OTABundle): Promise<RunOTAResult> => {
  const res = await applyOTABundle(bundle);

  if (res.onSuccess) {
    if (bundle.autoReload) {
      reloadApp();
    }

    return {updated: true, reloadRequired: true};
  }

  return {updated: false, reloadRequired: false, error: res.error};
};
