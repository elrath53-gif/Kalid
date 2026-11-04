package com.estudioeq.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.audiofx.AudioEffect

class AudioSessionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val ctx = context?.applicationContext ?: return
        val action = intent?.action ?: return

        GlobalAudioEngine.ensureInitialized(ctx)

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.QUICKBOOT_POWERON",
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                // Las opciones de Audio Global permanecen desactivadas al iniciar hasta que el usuario las active manualmente
            }
            AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION -> {
                val sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, 0)
                val pkg = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME)
                if (GlobalAudioEngine.isGlobalActive()) {
                    PlaybackService.notifyGlobalModeChanged(ctx, true)
                }
                if (sessionId > 0) {
                    GlobalAudioEngine.onExternalAudioSessionOpened(ctx, sessionId, pkg)
                }
            }
            AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> {
                val sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, 0)
                val pkg = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME)
                if (sessionId > 0) {
                    GlobalAudioEngine.onExternalAudioSessionClosed(ctx, sessionId, pkg)
                }
            }
        }
    }
}
