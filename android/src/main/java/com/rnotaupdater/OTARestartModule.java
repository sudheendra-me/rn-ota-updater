package com.rnotaupdater;

import android.app.Activity;
import android.content.Intent;
import android.os.Process;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class OTARestartModule extends ReactContextBaseJavaModule {
    private static final String NAME = "OTARestart";
    private static final String TAG = "rn-ota-updater";
    private final ReactApplicationContext reactContext;

    public OTARestartModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return NAME;
    }

    @ReactMethod
    public void restartApp() {
        Activity activity = getCurrentActivity();

        if (activity == null) {
            Log.e(TAG, "Cannot restart app because current activity is unavailable");
            return;
        }

        // Get the actual app package name from application context
        // This correctly handles debug variants, flavors, and multi-module setups
        String packageName = reactContext.getApplicationContext().getPackageName();
        Log.d(TAG, "Restarting app with package: " + packageName);

        activity.runOnUiThread(() -> {
            try {
                Intent launchIntent = activity
                    .getPackageManager()
                    .getLaunchIntentForPackage(packageName);

                if (launchIntent == null) {
                    Log.e(TAG, "Cannot restart app because launch intent is unavailable for package: " + packageName);
                    return;
                }

                // Clear the back stack and start fresh
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);

                activity.startActivity(launchIntent);
                activity.finish();

                // Kill the current process for a clean restart
                // Use both methods for maximum reliability
                Runtime.getRuntime().exit(0);
                Process.killProcess(Process.myPid());

            } catch (Exception e) {
                Log.e(TAG, "Restart failed for package: " + packageName, e);
            }
        });
    }
}