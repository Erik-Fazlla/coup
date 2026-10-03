package com.coup

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.ConcurrentHashMap

/**
 * Plays the game's short sound effects (res/raw/sfx_*.wav, made by `npm run sounds`).
 *
 * JavaScript reaches it as `NativeModules.CoupSound` and only ever calls `play(name)`;
 * see src/ui/sound.ts. Nothing here may crash the app: a phone that cannot play a
 * sound simply stays silent.
 *
 * - The sounds follow the media volume and are played at a modest level.
 * - Audio focus is never requested, so music or a call in another app is not
 *   paused or turned down.
 * - Several sounds may overlap (up to MAX_STREAMS).
 * - Nothing is played unless the phone's ringer is on (not silent, not vibrate).
 */
class CoupSoundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val lock = Any()
  private var pool: SoundPool? = null
  /** Sound name -> SoundPool id, for every sound that has been handed to the pool. */
  private val soundIds = HashMap<String, Int>()
  /** SoundPool ids that have finished loading and can be played. */
  private val ready: MutableSet<Int> = ConcurrentHashMap.newKeySet()

  override fun getName(): String = NAME

  /** Loads the sounds as soon as the module exists, so the first one is not late. */
  override fun initialize() {
    super.initialize()
    try {
      ensurePool()
    } catch (error: Throwable) {
      // Stay silent: sounds are an extra.
    }
  }

  @ReactMethod
  fun play(name: String) {
    try {
      if (!ringerIsOn()) {
        return
      }
      val current = ensurePool()
      val id = synchronized(lock) { soundIds[name] } ?: return
      if (!ready.contains(id)) {
        // Still loading (only possible in the first moments): skip rather than play late.
        return
      }
      current.play(id, VOLUME, VOLUME, 1, 0, 1f)
    } catch (error: Throwable) {
      // Stay silent.
    }
  }

  override fun invalidate() {
    synchronized(lock) {
      try {
        pool?.release()
      } catch (error: Throwable) {
        // Nothing to do.
      }
      pool = null
      soundIds.clear()
      ready.clear()
    }
    super.invalidate()
  }

  private fun ringerIsOn(): Boolean {
    val audio =
        reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            ?: return true
    return audio.ringerMode == AudioManager.RINGER_MODE_NORMAL
  }

  /** The pool with every sound handed to it; created on first use. */
  private fun ensurePool(): SoundPool {
    synchronized(lock) {
      val existing = pool
      if (existing != null) {
        return existing
      }
      val attributes =
          AudioAttributes.Builder()
              // "Game" sounds use the media volume and need no audio focus.
              .setUsage(AudioAttributes.USAGE_GAME)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
      val created =
          SoundPool.Builder().setMaxStreams(MAX_STREAMS).setAudioAttributes(attributes).build()
      created.setOnLoadCompleteListener { _, sampleId, status ->
        if (status == 0) {
          ready.add(sampleId)
        }
      }
      for ((name, resource) in SOUNDS) {
        soundIds[name] = created.load(reactApplicationContext, resource, 1)
      }
      pool = created
      return created
    }
  }

  companion object {
    const val NAME = "CoupSound"
    private const val VOLUME = 0.6f
    private const val MAX_STREAMS = 4

    /** The names JavaScript uses (SoundName in src/ui/sound.ts) and the file each one plays. */
    private val SOUNDS =
        mapOf(
            "turn" to R.raw.sfx_turn,
            "prompt" to R.raw.sfx_prompt,
            "coin" to R.raw.sfx_coin,
            "card" to R.raw.sfx_card,
            "challenge" to R.raw.sfx_challenge,
            "win" to R.raw.sfx_win,
            "lose" to R.raw.sfx_lose,
        )
  }
}
