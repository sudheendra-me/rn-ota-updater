import {applyOTABundle} from './core/applyOTA';
import {OTABundle} from './types/ota';

export const runOTA = async (bundle: OTABundle) => {
  const res = await applyOTABundle(bundle);

  if (res.onSuccess) {
    return {updated: true, reloadRequired: true};
  }

  return {updated: false, error: res.error};
};