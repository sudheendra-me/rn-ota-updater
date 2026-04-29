package com.rnotaupdater;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class OTARestartModule extends ReactContextBaseJavaModule {
  private static final String NAME = "OTARestart";
  private static final String TAG = "rn-ota-updater";

  public OTARestartModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void restartApp(String packageName) {
    Activity activity = getCurrentActivity();

    if (activity == null) {
      Log.e(TAG, "Cannot restart app because current activity is unavailable");
      return;
    }

    String targetPackageName =
      packageName != null && packageName.trim().length() > 0
        ? packageName.trim()
        : activity.getPackageName();

    activity.runOnUiThread(() -> {
      try {
        Intent launchIntent = activity
          .getPackageManager()
          .getLaunchIntentForPackage(targetPackageName);

        if (launchIntent == null) {
          Log.e(TAG, "Cannot restart app because launch intent is unavailable");
          return;
        }

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        activity.startActivity(launchIntent);
        activity.finish();
        Runtime.getRuntime().exit(0);
      } catch (Exception e) {
        Log.e(TAG, "Restart failed", e);
      }
    });
  }
}
