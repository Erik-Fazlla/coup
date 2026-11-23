package com.coup

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * Lets one screen hold the phone in landscape (either way round) while the rest of the
 * app keeps following rotation. JavaScript reaches it as `CoupOrientation`; see
 * src/ui/orientationLock.ts. The activity handles orientation changes itself
 * (`configChanges` in the manifest), so locking never restarts it.
 */
class CoupOrientationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun lockLandscape() = setOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE)

  @ReactMethod
  fun unlock() = setOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED)

  private fun setOrientation(value: Int) {
    UiThreadUtil.runOnUiThread {
      try {
        reactApplicationContext.currentActivity?.requestedOrientation = value
      } catch (_: Exception) {
        // A phone that refuses simply keeps following rotation.
      }
    }
  }

  companion object {
    const val NAME = "CoupOrientation"
  }
}
