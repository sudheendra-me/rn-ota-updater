import {DevSettings, NativeModules, Platform} from 'react-native';

const {OTARestart: NativeOTARestart} = NativeModules;

export const reloadApp = () => {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }

  if (Platform.OS === 'android' && NativeOTARestart?.restartApp) {
    NativeOTARestart.restartApp();
    return;
  }

  console.warn('[rn-ota-updater] Restart module not available');
};

export const OTARestart = {
  restartApp: reloadApp,
};
