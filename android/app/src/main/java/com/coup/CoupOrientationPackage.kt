package com.coup

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Makes CoupOrientationModule available to JavaScript. Added by hand in MainApplication. */
class CoupOrientationPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == CoupOrientationModule.NAME) CoupOrientationModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        CoupOrientationModule.NAME to
            ReactModuleInfo(
                name = CoupOrientationModule.NAME,
                className = CoupOrientationModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                // A plain (legacy) module: React Native reaches it through its interop layer.
                isTurboModule = false,
            )
    )
  }
}
