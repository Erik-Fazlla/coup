package com.coup

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Makes CoupSoundModule available to JavaScript. Added by hand in MainApplication. */
class CoupSoundPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == CoupSoundModule.NAME) CoupSoundModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        CoupSoundModule.NAME to
            ReactModuleInfo(
                name = CoupSoundModule.NAME,
                className = CoupSoundModule::class.java.name,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                // A plain (legacy) module: React Native reaches it through its interop layer.
                isTurboModule = false,
            )
    )
  }
}
