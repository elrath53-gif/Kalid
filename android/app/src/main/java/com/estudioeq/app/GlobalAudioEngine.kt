package com.estudioeq.app

import android.content.Context
import android.media.AudioManager
import android.media.AudioPlaybackConfiguration
import android.media.audiofx.AudioEffect
import android.media.audiofx.BassBoost
import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

object GlobalAudioEngine {

    private const val PREFS_NAME = "estudio_master_global_dsp"
    private const val KEY_CONFIG = "global_dsp_config"
    private const val KEY_KNOWN_SESSIONS = "known_audio_sessions_v2"
    private const val SESSION_SYSTEM_MIX = 0

    private val dspExecutor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    // Cascada de prioridades desde Int.MAX_VALUE para competir con MiSound / Dolby / SoundAlive sin fallar
    private val PRIORITIES = intArrayOf(Int.MAX_VALUE, 10_000_000, 100_000, 1_000, 0)

    private val DEFAULT_CONSOLE_FREQS = floatArrayOf(
        31.25f, 62.5f, 125f, 250f, 500f, 1000f, 2000f, 4000f, 8000f, 16000f
    )

    private val STUDIO_BANDS30_FREQS = floatArrayOf(
        25f, 31.5f, 40f, 50f, 63f, 80f, 100f, 125f, 160f, 200f,
        250f, 315f, 400f, 500f, 630f, 800f, 1000f, 1250f, 1600f, 2000f,
        2500f, 3150f, 4000f, 5000f, 6300f, 8000f, 10000f, 12500f, 16000f, 20000f
    )

    private val STUDIO_BANDS30_CUTOFFS = floatArrayOf(
        28f, 35.5f, 45f, 56f, 71f, 90f, 112f, 140f, 180f, 224f,
        280f, 355f, 450f, 560f, 710f, 900f, 1120f, 1400f, 1800f, 2240f,
        2800f, 3550f, 4500f, 5600f, 7100f, 9000f, 11200f, 14000f, 18000f, 20000f
    )

    data class DspSnapshot(
        val globalEnabled: Boolean = false,
        val consoleEnabled: Boolean = true,
        // CRÍTICO: En Android 9-15 / Xiaomi HyperOS, Session 0 está restringida por Google y colisiona con Spotify (sid > 0).
        // Se mantiene desactivada por defecto y jamás se adjunta mientras haya una sesión real (sid > 0) activa.
        val systemWideMix: Boolean = false,
        val legacyHalMode: Boolean = false,
        val includeStudioInGlobal: Boolean = true,
        val dvcEnabled: Boolean = true,
        val noDvcGainDb: Float = -3.0f,
        val advancedTracking: Boolean = false,
        val eqEnabled: Boolean = true,
        val toneEnabled: Boolean = true,
        val limiterEnabled: Boolean = true,
        val compEnabled: Boolean = false,
        val preampDb: Float = 0f,
        val bands10: FloatArray = FloatArray(10),
        val bandFreqs10: FloatArray = DEFAULT_CONSOLE_FREQS.copyOf(),
        val bandQs10: FloatArray = FloatArray(10) { 1.41f },
        val studioBands30: FloatArray = FloatArray(30),
        val bassPct: Float = 0f,
        val treblePct: Float = 0f,
        val bassFreqHz: Float = 90f,
        val bassQ: Float = 0.75f,
        val trebleFreqHz: Float = 10000f,
        val trebleQ: Float = 0.75f,
        val stereoWidthPct: Float = 100f,
        val compAttackMs: Float = 2.5f,
        val compReleaseMs: Float = 17.0f,
        val compRatio: Float = 8.7f,
        val compFreqHz: Float = 20000f,
        val compThresholdDb: Float = -50.0f,
        val compGainDb: Float = 0.0f,
        val masterCeilDb: Float = -0.1f
    )

    private class SessionAttachment(
        val sessionId: Int,
        var packageName: String,
        var isLegacyHal: Boolean = false,
        var engineLabel: String = "",
        var dp: DynamicsProcessing? = null,
        var eq: Equalizer? = null,
        var bb: BassBoost? = null,
        var virt: Virtualizer? = null,
        var le: LoudnessEnhancer? = null,
        @Volatile var controlLost: Boolean = false,
        var dpHandoffFallback: Boolean = false
    ) {
        fun hasActiveControl(): Boolean {
            return try {
                val mainFx: AudioEffect? = dp ?: eq
                mainFx != null && mainFx.hasControl() && !controlLost
            } catch (_: Exception) {
                false
            }
        }

        fun releaseAll() {
            try {
                dp?.setControlStatusListener(null)
                dp?.setEnableStatusListener(null)
                dp?.enabled = false
                dp?.release()
            } catch (_: Exception) {
            }
            try {
                eq?.setControlStatusListener(null)
                eq?.setEnableStatusListener(null)
                eq?.enabled = false
                eq?.release()
            } catch (_: Exception) {
            }
            try {
                bb?.enabled = false
                bb?.release()
            } catch (_: Exception) {
            }
            try {
                virt?.enabled = false
                virt?.release()
            } catch (_: Exception) {
            }
            try {
                le?.enabled = false
                le?.release()
            } catch (_: Exception) {
            }
            dp = null
            eq = null
            bb = null
            virt = null
            le = null
        }
    }

    private val sessions = ConcurrentHashMap<Int, SessionAttachment>()
    private val knownSessionPackages = ConcurrentHashMap<Int, String>()

    @Volatile
    private var currentConfig = DspSnapshot()

    @Volatile
    private var initialized = false

    @Volatile
    private var playbackCallbackRegistered = false

    @Volatile
    private var internalPlayerPlaying = false

    @Volatile
    private var oemControlHijacked = false

    @Volatile
    private var lastAutoRecoverMs = 0L

    private var appContext: Context? = null

    private val playbackCallback = object : AudioManager.AudioPlaybackCallback() {
        override fun onPlaybackConfigChanged(configs: MutableList<AudioPlaybackConfiguration>?) {
            super.onPlaybackConfigChanged(configs)
            if (!currentConfig.globalEnabled) return
            dspExecutor.execute {
                if (!currentConfig.globalEnabled) return@execute
                // IMPORTANTE: Solo adjunta sesiones NUEVAS descubiertas; NO re-escribe ni resetea sesiones ya sanas
                // para evitar que Xiaomi HyperOS / ExoPlayer corte el audio tras cambiar de estado.
                val addedAny = discoverActivePlaybackSessionsInternal(configs)
                syncSystemMixSessionInternal()
                if (addedAny) {
                    reapplyAllSessionsInternal()
                }
            }
        }
    }

    fun ensureInitialized(context: Context) {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            val appCtx = context.applicationContext
            appContext = appCtx
            try {
                val prefs = appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val saved = prefs.getString(KEY_CONFIG, null)
                if (!saved.isNullOrBlank()) {
                    // Al iniciar la app, todas las opciones de Audio Global arrancan SIEMPRE apagadas
                    // para que el usuario las presione y active únicamente de forma manual.
                    currentConfig = parseConfig(saved).copy(
                        globalEnabled = false,
                        systemWideMix = false,
                        legacyHalMode = false,
                        advancedTracking = false
                    )
                }
                val savedSessions = prefs.getString(KEY_KNOWN_SESSIONS, null)
                if (!savedSessions.isNullOrBlank()) {
                    val obj = JSONObject(savedSessions)
                    val keys = obj.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        val sid = k.toIntOrNull() ?: 0
                        val pkg = obj.optString(k, "")
                        if (sid > 0 && pkg.isNotBlank() && pkg != appCtx.packageName) {
                            knownSessionPackages[sid] = pkg
                        }
                    }
                }
            } catch (_: Exception) {
            }
            updatePlaybackCallbackRegistration(appCtx)
            initialized = true
        }
    }

    private fun persistKnownSessions() {
        val ctx = appContext ?: return
        try {
            val obj = JSONObject()
            for ((sid, pkg) in knownSessionPackages) {
                if (sid > 0 && pkg.isNotBlank()) {
                    obj.put(sid.toString(), pkg)
                }
            }
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_KNOWN_SESSIONS, obj.toString())
                .apply()
        } catch (_: Exception) {
        }
    }

    private fun updatePlaybackCallbackRegistration(context: Context) {
        mainHandler.post {
            try {
                val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return@post
                if (currentConfig.globalEnabled && !playbackCallbackRegistered) {
                    am.registerAudioPlaybackCallback(playbackCallback, mainHandler)
                    playbackCallbackRegistered = true
                } else if (!currentConfig.globalEnabled && playbackCallbackRegistered) {
                    am.unregisterAudioPlaybackCallback(playbackCallback)
                    playbackCallbackRegistered = false
                }
            } catch (_: Exception) {
            }
        }
    }

    fun setInternalPlayerPlaying(context: Context, playing: Boolean) {
        val appCtx = context.applicationContext
        ensureInitialized(appCtx)
        if (internalPlayerPlaying == playing) return
        internalPlayerPlaying = playing
        dspExecutor.execute {
            if (!currentConfig.globalEnabled) return@execute
            syncSystemMixSessionInternal()
        }
    }

    fun onExternalAudioSessionOpened(context: Context, sessionId: Int, pkg: String?) {
        val appCtx = context.applicationContext
        ensureInitialized(appCtx)
        val cleanPkg = pkg?.trim().orEmpty()
        if (cleanPkg == appCtx.packageName) return
        dspExecutor.execute {
            if (sessionId > 0) {
                // Si la misma app (ej. Spotify) abre un nuevo audioSessionId, limpia sesiones viejas de esa misma app
                // para que jamás queden dos instancias C++ peleando sobre pistas anteriores de Spotify.
                if (cleanPkg.isNotEmpty()) {
                    val staleIds = knownSessionPackages.entries
                        .filter { it.key != sessionId && it.value == cleanPkg }
                        .map { it.key }
                    for (oldSid in staleIds) {
                        knownSessionPackages.remove(oldSid)
                        sessions.remove(oldSid)?.releaseAll()
                    }
                    knownSessionPackages[sessionId] = cleanPkg
                    persistKnownSessions()
                }
                if (currentConfig.globalEnabled) {
                    oemControlHijacked = false
                    attachOrUpdateSessionInternal(
                        sessionId,
                        cleanPkg.ifEmpty { knownSessionPackages[sessionId] ?: "Reproductor externo" },
                        forceRecreate = false
                    )
                    syncSystemMixSessionInternal()
                }
            }
        }
    }

    fun onExternalAudioSessionClosed(context: Context, sessionId: Int, pkg: String?) {
        if (sessionId <= 0) return
        val appCtx = context.applicationContext
        if (pkg == appCtx.packageName) return
        dspExecutor.execute {
            knownSessionPackages.remove(sessionId)
            persistKnownSessions()
            sessions.remove(sessionId)?.releaseAll()
            if (currentConfig.globalEnabled) {
                syncSystemMixSessionInternal()
            }
        }
    }

    fun forceRebindAll(context: Context): String {
        val appCtx = context.applicationContext
        ensureInitialized(appCtx)
        val latch = java.util.concurrent.CountDownLatch(1)
        dspExecutor.execute {
            try {
                oemControlHijacked = false
                if (!currentConfig.globalEnabled) {
                    releaseAllSessionsInternal()
                } else {
                    // Re-enlace inteligente sin corte: conserva sesiones sanas que ya tienen control C++
                    // y recrea únicamente sesiones caídas, sin control o que cambiaron de modo (DP <-> Legacy HAL).
                    discoverActivePlaybackSessionsInternal(null)
                    for ((sid, pkg) in knownSessionPackages) {
                        if (sid > 0) {
                            val cur = sessions[sid]
                            val needRecreate = cur == null || !cur.hasActiveControl() || (cur.isLegacyHal != currentConfig.legacyHalMode && !cur.dpHandoffFallback)
                            attachOrUpdateSessionInternal(sid, pkg, forceRecreate = needRecreate)
                        }
                    }
                    syncSystemMixSessionInternal()
                    reapplyAllSessionsInternal()
                }
            } finally {
                latch.countDown()
            }
        }
        try {
            latch.await(320, java.util.concurrent.TimeUnit.MILLISECONDS)
        } catch (_: Exception) {
        }
        if (currentConfig.globalEnabled) {
            PlaybackService.notifyGlobalModeChanged(appCtx, true)
        }
        return buildStatusJson(appCtx)
    }

    fun updateFromJson(context: Context, rawJson: String): String {
        val appCtx = context.applicationContext
        ensureInitialized(appCtx)
        val parsed = parseConfig(rawJson)
        val effectiveParsed = if (!parsed.consoleEnabled) {
            parsed.copy(globalEnabled = false, systemWideMix = false)
        } else {
            parsed
        }
        val prevGlobal = currentConfig.globalEnabled
        val prevLegacy = currentConfig.legacyHalMode
        currentConfig = effectiveParsed

        dspExecutor.execute {
            try {
                appCtx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_CONFIG, rawJson)
                    .apply()
            } catch (_: Exception) {
            }
            updatePlaybackCallbackRegistration(appCtx)
            if (!effectiveParsed.globalEnabled || !effectiveParsed.consoleEnabled) {
                releaseAllSessionsInternal()
            } else {
                if (prevLegacy != effectiveParsed.legacyHalMode) {
                    // Si el usuario cambió entre DynamicsProcessing C++ y Modo Compatibilidad OEM (HAL), recreamos limpio
                    oemControlHijacked = false
                    releaseAllSessionsInternal()
                }
                discoverActivePlaybackSessionsInternal(null)
                for ((sid, pkg) in knownSessionPackages) {
                    if (sid > 0) attachOrUpdateSessionInternal(sid, pkg, forceRecreate = false)
                }
                syncSystemMixSessionInternal()
                reapplyAllSessionsInternal()
            }
            if (prevGlobal != effectiveParsed.globalEnabled) {
                PlaybackService.notifyGlobalModeChanged(appCtx, effectiveParsed.globalEnabled)
            }
        }
        return buildStatusJson(appCtx)
    }

    fun isGlobalActive(): Boolean = currentConfig.globalEnabled

    fun buildStatusJson(context: Context): String {
        ensureInitialized(context)
        val obj = JSONObject()
        val cfg = currentConfig
        val sysHolder = sessions[SESSION_SYSTEM_MIX]
        val appHolders = sessions.values.filter { it.sessionId != SESSION_SYSTEM_MIX && it.hasActiveControl() }
        val activeEngine = appHolders.firstOrNull()?.engineLabel ?: sysHolder?.engineLabel ?: ""

        obj.put("globalEnabled", cfg.globalEnabled)
        obj.put("consoleEnabled", cfg.consoleEnabled)
        obj.put("systemWideMix", cfg.systemWideMix)
        obj.put("legacyHalMode", cfg.legacyHalMode)
        obj.put("includeStudioInGlobal", cfg.includeStudioInGlobal)
        obj.put("dvcEnabled", cfg.dvcEnabled)
        obj.put("advancedTracking", cfg.advancedTracking)
        obj.put("apiDynamicsProcessing", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
        obj.put("sessionZeroAttached", sysHolder != null && sysHolder.hasActiveControl())
        obj.put("sessionZeroEngine", activeEngine)
        obj.put("oemControlHijacked", oemControlHijacked)
        obj.put("manufacturer", Build.MANUFACTURER ?: "")
        obj.put("internalPlayerBypassingZero", internalPlayerPlaying && cfg.globalEnabled)
        obj.put("activeSessionsCount", appHolders.size + (if (sysHolder != null) 1 else 0))

        val playersArr = JSONArray()
        appHolders
            .map { friendlyPlayerName(it.packageName) }
            .distinct()
            .forEach { p -> playersArr.put(p) }
        obj.put("activePlayers", playersArr)
        return obj.toString()
    }

    private fun friendlyPlayerName(pkg: String): String {
        val lower = pkg.lowercase()
        return when {
            "spotify" in lower -> "Spotify"
            "youtube" in lower && "music" in lower -> "YouTube Music"
            "youtube" in lower -> "YouTube"
            "tiktok" in lower || "musically" in lower || "trill" in lower -> "TikTok"
            "instagram" in lower -> "Instagram"
            "apple" in lower -> "Apple Music"
            "tidal" in lower -> "TIDAL"
            "deezer" in lower -> "Deezer"
            "amazon" in lower -> "Amazon Music"
            "vlc" in lower -> "VLC"
            "soundcloud" in lower -> "SoundCloud"
            "chrome" in lower -> "Chrome"
            "whatsapp" in lower -> "WhatsApp"
            pkg.contains('.') -> pkg.substringAfterLast('.').replaceFirstChar { it.uppercase() }
            else -> pkg.ifBlank { "App externa" }
        }
    }

    private fun discoverActivePlaybackSessionsInternal(configs: List<AudioPlaybackConfiguration>?): Boolean {
        val ctx = appContext ?: return false
        if (!currentConfig.advancedTracking) return false
        var attachedNew = false
        try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
            val activeList = configs ?: am.activePlaybackConfigurations
            for (apc in activeList) {
                try {
                    val m = apc.javaClass.getMethod("getAudioSessionId")
                    val sid = (m.invoke(apc) as? Int) ?: 0
                    if (sid > 0 && !sessions.containsKey(sid)) {
                        val pkg = knownSessionPackages[sid] ?: "Sesión activa #$sid"
                        knownSessionPackages[sid] = pkg
                        attachOrUpdateSessionInternal(sid, pkg, forceRecreate = false)
                        attachedNew = true
                    }
                } catch (_: Exception) {
                    // Sin permiso DUMP vía ADB, Android oculta getAudioSessionId; se usan los broadcasts oficiales de música.
                }
            }
        } catch (_: Exception) {
        }
        return attachedNew
    }

    private fun hasActivePerAppSession(): Boolean {
        return sessions.values.any { it.sessionId > 0 && it.hasActiveControl() }
    }

    private fun syncSystemMixSessionInternal() {
        // NUNCA adjuntar Sesión 0 si ya existe una app real enlazada (ej. Spotify), ni cuando suena el reproductor interno:
        // en Xiaomi HyperOS / Samsung OneUI adjuntar Sesión 0 rompe la cadena de Spotify y causa corte inmediato.
        val wantZero = currentConfig.globalEnabled &&
            currentConfig.systemWideMix &&
            !internalPlayerPlaying &&
            !hasActivePerAppSession()
        if (!wantZero) {
            sessions.remove(SESSION_SYSTEM_MIX)?.releaseAll()
            return
        }
        attachOrUpdateSessionInternal(SESSION_SYSTEM_MIX, "Mezcla Legacy Sesión 0", forceRecreate = false)
    }

    private fun releaseAllSessionsInternal() {
        val iter = sessions.entries.iterator()
        while (iter.hasNext()) {
            val entry = iter.next()
            entry.value.releaseAll()
            iter.remove()
        }
    }

    private fun reapplyAllSessionsInternal() {
        if (!currentConfig.globalEnabled) {
            releaseAllSessionsInternal()
            return
        }
        val dead = mutableListOf<Int>()
        for ((sid, holder) in sessions) {
            if (sid == SESSION_SYSTEM_MIX && (!currentConfig.systemWideMix || internalPlayerPlaying || hasActivePerAppSession())) {
                dead.add(sid)
                continue
            }
            if (!holder.hasActiveControl()) {
                dead.add(sid)
                continue
            }
            val ok = applyConfigToHolder(holder, currentConfig)
            if (!ok) dead.add(sid)
        }
        for (sid in dead) {
            sessions.remove(sid)?.releaseAll()
        }
    }

    private fun registerEffectGuards(holder: SessionAttachment, fx: AudioEffect) {
        fx.setEnableStatusListener { effect, enabled ->
            if (!enabled && currentConfig.globalEnabled && !holder.controlLost) {
                dspExecutor.execute {
                    try {
                        if (effect.hasControl() && currentConfig.globalEnabled) {
                            effect.enabled = true
                        }
                    } catch (_: Exception) {
                    }
                }
            }
        }
        fx.setControlStatusListener { _, controlGranted ->
            if (!controlGranted) {
                holder.controlLost = true
                oemControlHijacked = true
                val now = SystemClock.elapsedRealtime()
                // Si Xiaomi Sound / Dolby Atmos roba el control de DynamicsProcessing tras unos milisegundos,
                // conmutamos esa sesión automáticamente una vez al HAL Equalizer de respaldo sin bucle infinito.
                if (now - lastAutoRecoverMs > 2500L && holder.sessionId > 0 && currentConfig.globalEnabled) {
                    lastAutoRecoverMs = now
                    mainHandler.postDelayed({
                        dspExecutor.execute {
                            if (!currentConfig.globalEnabled) return@execute
                            val sid = holder.sessionId
                            val pkg = holder.packageName
                            val wasDp = !holder.isLegacyHal
                            sessions.remove(sid)?.releaseAll()
                            if (wasDp) {
                                attachSessionWithMode(sid, pkg, forceLegacy = true, markFallback = true)
                            }
                        }
                    }, 220L)
                }
            } else {
                holder.controlLost = false
            }
        }
    }

    private fun attachOrUpdateSessionInternal(sessionId: Int, pkgName: String, forceRecreate: Boolean) {
        if (sessionId < 0) return
        val existing = sessions[sessionId]
        if (existing != null) {
            if (!forceRecreate && existing.hasActiveControl()) {
                existing.packageName = pkgName
                if (!applyConfigToHolder(existing, currentConfig)) {
                    sessions.remove(sessionId)?.releaseAll()
                }
                return
            }
            sessions.remove(sessionId)?.releaseAll()
        }
        // En Sesión 0 jamás usar DynamicsProcessing (Android 9+ exige sessionId != 0 para DynamicsProcessing).
        val useLegacy = currentConfig.legacyHalMode || sessionId == SESSION_SYSTEM_MIX
        attachSessionWithMode(sessionId, pkgName, forceLegacy = useLegacy, markFallback = false)
    }

    private fun attachSessionWithMode(
        sessionId: Int,
        pkgName: String,
        forceLegacy: Boolean,
        markFallback: Boolean
    ) {
        val holder = SessionAttachment(
            sessionId = sessionId,
            packageName = pkgName,
            dpHandoffFallback = markFallback
        )
        var attached = false

        // 1) Motor C++ DynamicsProcessing de 2 etapas (solo cuando sessionId > 0 y no está en Modo Compatibilidad OEM)
        if (!forceLegacy && sessionId > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            for (prio in PRIORITIES) {
                try {
                    val dpConfig = DynamicsProcessing.Config.Builder(
                        DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                        2,
                        true,
                        30,
                        true,
                        2,
                        true,
                        10,
                        true
                    ).build()
                    val dp = DynamicsProcessing(prio, sessionId, dpConfig)
                    if (!dp.hasControl()) {
                        try {
                            dp.release()
                        } catch (_: Exception) {
                        }
                        oemControlHijacked = true
                        continue
                    }
                    holder.dp = dp
                    holder.isLegacyHal = false
                    if (applyDynamicsProcessing(dp, currentConfig)) {
                        registerEffectGuards(holder, dp)
                        holder.engineLabel = "DynamicsProcessing C++ 64-bit"
                        attached = true
                        break
                    } else {
                        try {
                            dp.release()
                        } catch (_: Exception) {
                        }
                        holder.dp = null
                    }
                } catch (_: Exception) {
                    holder.dp = null
                }
            }
        }

        // 2) Motor Compatibilidad OEM / Xiaomi HyperOS / Samsung (Equalizer + BassBoost + Virtualizer + LoudnessEnhancer HAL)
        if (!attached) {
            for (prio in PRIORITIES) {
                try {
                    val eq = Equalizer(prio, sessionId)
                    if (!eq.hasControl()) {
                        try {
                            eq.release()
                        } catch (_: Exception) {
                        }
                        oemControlHijacked = true
                        continue
                    }
                    val bb = try {
                        BassBoost(prio, sessionId)
                    } catch (_: Exception) {
                        null
                    }
                    val virt = try {
                        Virtualizer(prio, sessionId)
                    } catch (_: Exception) {
                        null
                    }
                    val le = try {
                        if (sessionId > 0) LoudnessEnhancer(sessionId) else null
                    } catch (_: Exception) {
                        null
                    }
                    holder.eq = eq
                    holder.bb = bb
                    holder.virt = virt
                    holder.le = le
                    holder.isLegacyHal = true
                    if (applyLegacyEffects(eq, bb, virt, le, currentConfig)) {
                        registerEffectGuards(holder, eq)
                        holder.engineLabel = if (markFallback) {
                            "HAL Compatibilidad OEM (Auto-recuperado)"
                        } else {
                            "HAL Compatibilidad OEM (${eq.numberOfBands}B)"
                        }
                        attached = true
                        break
                    } else {
                        holder.releaseAll()
                    }
                } catch (_: Exception) {
                    holder.releaseAll()
                }
            }
        }

        if (attached) {
            sessions[sessionId] = holder
        } else {
            holder.releaseAll()
        }
    }

    private fun applyConfigToHolder(holder: SessionAttachment, cfg: DspSnapshot): Boolean {
        if (!holder.hasActiveControl()) return false
        val dp = holder.dp
        if (dp != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return applyDynamicsProcessing(dp, cfg)
        }
        val eq = holder.eq
        if (eq != null) {
            return applyLegacyEffects(eq, holder.bb, holder.virt, holder.le, cfg)
        }
        return false
    }

    private fun evalConsoleToneAtHz(freqHz: Float, cfg: DspSnapshot): Float {
        if (!cfg.consoleEnabled || !cfg.toneEnabled) return 0f
        var addDb = 0f
        val bassDb = (cfg.bassPct.coerceIn(0f, 100f) / 100f) * 12f
        val trebDb = (cfg.treblePct.coerceIn(0f, 100f) / 100f) * 12f
        if (bassDb > 0.02f) {
            val bf = cfg.bassFreqHz.coerceIn(20f, 350f)
            val bq = cfg.bassQ.coerceIn(0.25f, 3.0f)
            val shelfRatio = 1f / (1f + (freqHz / bf).pow(2.0f))
            val logDist = ln((freqHz.coerceAtLeast(15f) / bf).toDouble()).toFloat()
            val bell = kotlin.math.exp((-0.5f * (logDist * bq * 2.1f).pow(2)).toDouble()).toFloat()
            addDb += bassDb * (0.72f * shelfRatio + 0.36f * bell)
        }
        if (trebDb > 0.02f) {
            val tf = cfg.trebleFreqHz.coerceIn(1500f, 18000f)
            val tq = cfg.trebleQ.coerceIn(0.25f, 3.0f)
            val shelfRatio = 1f / (1f + (tf / freqHz.coerceAtLeast(20f)).pow(2.0f))
            val logDist = ln((freqHz.coerceAtLeast(20f) / tf).toDouble()).toFloat()
            val bell = kotlin.math.exp((-0.5f * (logDist * tq * 2.1f).pow(2)).toDouble()).toFloat()
            addDb += trebDb * (0.72f * shelfRatio + 0.36f * bell)
        }
        return addDb
    }

    private fun computeConsoleBandGain(idx: Int, cfg: DspSnapshot): Float {
        if (!cfg.consoleEnabled) return 0f
        val centerHz = cfg.bandFreqs10.getOrElse(idx) { DEFAULT_CONSOLE_FREQS[idx.coerceIn(0, 9)] }
        var g = if (cfg.eqEnabled && idx in cfg.bands10.indices) cfg.bands10[idx] else 0f
        g += evalConsoleToneAtHz(centerHz, cfg)
        return g.coerceIn(-18f, 18f)
    }

    private fun interpolateArrayAtHz(freqHz: Float, centers: FloatArray, gains: FloatArray): Float {
        if (centers.isEmpty() || gains.isEmpty()) return 0f
        if (freqHz <= centers.first()) return gains.first()
        if (freqHz >= centers.last()) return gains.last()
        for (i in 0 until min(centers.size, gains.size) - 1) {
            val f0 = centers[i]
            val f1 = centers[i + 1]
            if (freqHz in f0..f1) {
                val u = ln((freqHz / f0).toDouble()) / ln((f1 / f0).toDouble()).coerceAtLeast(1e-4)
                return (gains[i] + (gains[i + 1] - gains[i]) * u.toFloat())
            }
        }
        return 0f
    }

    private fun computeSortedConsoleCutoffs(cfg: DspSnapshot): Pair<FloatArray, IntArray> {
        val order = (0 until 10).sortedBy { cfg.bandFreqs10[it] }.toIntArray()
        val sortedCenters = FloatArray(10) { i -> cfg.bandFreqs10[order[i]].coerceIn(20f, 19500f) }
        val cutoffs = FloatArray(10)
        var prev = 22f
        for (i in 0 until 9) {
            val geom = kotlin.math.sqrt((sortedCenters[i] * sortedCenters[i + 1]).toDouble()).toFloat()
            val safeCut = max(prev + 4f, geom.coerceIn(26f, 19200f))
            cutoffs[i] = safeCut
            prev = safeCut
        }
        cutoffs[9] = 20000f
        return cutoffs to order
    }

    private fun applyDynamicsProcessing(dp: DynamicsProcessing, cfg: DspSnapshot): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
        return try {
            // Etapa 1 (Pre-EQ 30 bandas ISO): Todas las bandas permanecen enabled=true para preservar la malla espectral FFT exacta
            var maxPreBoost = 0f
            val studioOn = cfg.includeStudioInGlobal
            for (i in 0 until 30) {
                val sg = if (studioOn) cfg.studioBands30.getOrElse(i) { 0f }.coerceIn(-24f, 24f) else 0f
                if (sg > maxPreBoost) maxPreBoost = sg
                dp.setPreEqBandAllChannelsTo(
                    i,
                    DynamicsProcessing.EqBand(true, STUDIO_BANDS30_CUTOFFS[i], sg)
                )
            }

            // Etapa 2 (Consola Final Independiente): 10 Bandas + Tono + Preamp + DVC
            val conPre = if (cfg.consoleEnabled && cfg.eqEnabled) cfg.preampDb else 0f
            var maxConBoost = max(0f, conPre)
            val (postCutoffs, order) = computeSortedConsoleCutoffs(cfg)
            for (pos in 0 until 10) {
                val origIdx = order[pos]
                val bg = computeConsoleBandGain(origIdx, cfg)
                if (bg > maxConBoost) maxConBoost = bg
                dp.setPostEqBandAllChannelsTo(
                    pos,
                    DynamicsProcessing.EqBand(true, postCutoffs[pos], bg)
                )
            }

            val totalPeakBoost = maxPreBoost + maxConBoost
            val headroomDb = if (cfg.dvcEnabled) {
                if (totalPeakBoost > 3.0f) -min(9.0f, (totalPeakBoost - 3.0f) * 0.36f) else 0.0f
            } else {
                if (totalPeakBoost > 0.2f) cfg.noDvcGainDb.coerceIn(-15f, 0f) else 0.0f
            }
            val totalInputDb = (conPre + headroomDb).coerceIn(-18f, 15f)
            dp.setInputGainAllChannelsTo(totalInputDb)

            // CRÍTICO: En Android C++ libdynproc, las frecuencias de cruce MBC DEBEN ser estrictamente crecientes (band0 < band1).
            // Jamás enviar 20000f en ambas bandas (causaba rechazo EINVAL -22 / corte tras el primer bloque FFT).
            val compActive = cfg.consoleEnabled && cfg.compEnabled
            val rawSplit = cfg.compFreqHz.coerceIn(80f, 20000f)
            val fullBand = rawSplit >= 18500f
            val lowCutoffHz = if (fullBand) 1200f else rawSplit.coerceIn(80f, 18000f)
            val ratio = if (compActive) cfg.compRatio.coerceIn(1f, 30f) else 1.0f
            val thresh = if (compActive) cfg.compThresholdDb.coerceIn(-90f, 0f) else 0.0f
            val safePostGain = if (compActive) cfg.compGainDb.coerceIn(-12f, 36f) * 0.52f else 0.0f
            val atk = cfg.compAttackMs.coerceIn(0.1f, 500f)
            val rel = cfg.compReleaseMs.coerceIn(1f, 2000f)

            val lowBand = DynamicsProcessing.MbcBand(
                compActive,
                lowCutoffHz,
                atk,
                rel,
                ratio,
                thresh,
                if (compActive) 6.0f else 0.0f,
                -90f,
                1.0f,
                0f,
                safePostGain
            )
            val highBand = DynamicsProcessing.MbcBand(
                compActive && fullBand,
                20000f,
                atk,
                rel,
                if (compActive && fullBand) ratio else 1.0f,
                if (compActive && fullBand) thresh else 0.0f,
                if (compActive && fullBand) 6.0f else 0.0f,
                -90f,
                1.0f,
                0f,
                if (compActive && fullBand) safePostGain else 0.0f
            )
            dp.setMbcBandAllChannelsTo(0, lowBand)
            dp.setMbcBandAllChannelsTo(1, highBand)

            val limOn = !cfg.consoleEnabled || cfg.limiterEnabled
            val limiter = DynamicsProcessing.Limiter(
                limOn,
                true,
                0,
                1.2f,
                32.0f,
                10.0f,
                cfg.masterCeilDb.coerceIn(-6.0f, -0.1f),
                0.0f
            )
            dp.setLimiterAllChannelsTo(limiter)
            if (!dp.enabled) {
                dp.enabled = true
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun applyLegacyEffects(
        eq: Equalizer,
        bb: BassBoost?,
        virt: Virtualizer?,
        le: LoudnessEnhancer?,
        cfg: DspSnapshot
    ): Boolean {
        return try {
            val range = eq.bandLevelRange
            val minMb = range[0].toInt()
            val maxMb = range[1].toInt()
            val nBands = eq.numberOfBands.toInt()

            val conGains = FloatArray(10) { i -> computeConsoleBandGain(i, cfg) }
            val (_, order) = computeSortedConsoleCutoffs(cfg)
            val sortedFreqs = FloatArray(10) { i -> cfg.bandFreqs10[order[i]] }
            val sortedGains = FloatArray(10) { i -> conGains[order[i]] }

            for (b in 0 until nBands) {
                val centerHz = eq.getCenterFreq(b.toShort()) / 1000f
                var totalDb = 0f
                if (cfg.includeStudioInGlobal) {
                    totalDb += interpolateArrayAtHz(centerHz, STUDIO_BANDS30_FREQS, cfg.studioBands30)
                }
                if (cfg.consoleEnabled) {
                    totalDb += interpolateArrayAtHz(centerHz, sortedFreqs, sortedGains)
                }
                val targetMb = (totalDb * 100f).roundToInt().coerceIn(minMb, maxMb)
                eq.setBandLevel(b.toShort(), targetMb.toShort())
            }
            if (!eq.enabled) {
                eq.enabled = true
            }

            if (bb != null) {
                val bassStrength = if (cfg.consoleEnabled && cfg.toneEnabled) {
                    (cfg.bassPct.coerceIn(0f, 100f) * 10f).roundToInt().coerceIn(0, 1000)
                } else 0
                if (bb.strengthSupported) {
                    bb.setStrength(bassStrength.toShort())
                }
                bb.enabled = bassStrength > 0
            }

            if (virt != null) {
                val extraWidth = (cfg.stereoWidthPct - 100f).coerceIn(0f, 100f)
                val virtStrength = if (cfg.consoleEnabled && extraWidth > 1f) {
                    (extraWidth * 10f).roundToInt().coerceIn(0, 1000)
                } else 0
                if (virt.strengthSupported) {
                    virt.setStrength(virtStrength.toShort())
                }
                virt.enabled = virtStrength > 0
            }

            if (le != null) {
                val preDb = (if (cfg.consoleEnabled && cfg.eqEnabled) cfg.preampDb else 0f) +
                    (if (cfg.consoleEnabled && cfg.compEnabled) cfg.compGainDb * 0.25f else 0f)
                val preMb = (preDb * 100f).roundToInt().coerceIn(-1200, 1500)
                le.setTargetGain(max(0, preMb))
                le.enabled = preMb > 0
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun parseConfig(rawJson: String): DspSnapshot {
        return try {
            val o = JSONObject(rawJson)
            val bands = FloatArray(10)
            o.optJSONArray("bands")?.let { arr ->
                for (i in 0 until min(10, arr.length())) {
                    bands[i] = arr.optDouble(i, 0.0).toFloat().coerceIn(-18f, 18f)
                }
            }
            val bandFreqs = DEFAULT_CONSOLE_FREQS.copyOf()
            o.optJSONArray("bandFreqs")?.let { arr ->
                for (i in 0 until min(10, arr.length())) {
                    bandFreqs[i] = arr.optDouble(i, DEFAULT_CONSOLE_FREQS[i].toDouble()).toFloat().coerceIn(20f, 20000f)
                }
            }
            val bandQs = FloatArray(10) { 1.41f }
            o.optJSONArray("bandQs")?.let { arr ->
                for (i in 0 until min(10, arr.length())) {
                    bandQs[i] = arr.optDouble(i, 1.41).toFloat().coerceIn(0.2f, 12f)
                }
            }
            val studio30 = FloatArray(30)
            o.optJSONArray("studioBands30")?.let { arr ->
                for (i in 0 until min(30, arr.length())) {
                    studio30[i] = arr.optDouble(i, 0.0).toFloat().coerceIn(-24f, 24f)
                }
            }
            DspSnapshot(
                globalEnabled = o.optBoolean("globalEnabled", false),
                consoleEnabled = o.optBoolean("consoleEnabled", true),
                systemWideMix = o.optBoolean("systemWideMix", false),
                legacyHalMode = o.optBoolean("legacyHalMode", false),
                includeStudioInGlobal = o.optBoolean("includeStudioInGlobal", true),
                dvcEnabled = o.optBoolean("dvcEnabled", true),
                noDvcGainDb = o.optDouble("noDvcGainDb", -3.0).toFloat(),
                advancedTracking = o.optBoolean("advancedTracking", true),
                eqEnabled = o.optBoolean("eqEnabled", true),
                toneEnabled = o.optBoolean("toneEnabled", true),
                limiterEnabled = o.optBoolean("limiterEnabled", true),
                compEnabled = o.optBoolean("compEnabled", false),
                preampDb = o.optDouble("preampDb", 0.0).toFloat(),
                bands10 = bands,
                bandFreqs10 = bandFreqs,
                bandQs10 = bandQs,
                studioBands30 = studio30,
                bassPct = o.optDouble("bassPct", 0.0).toFloat(),
                treblePct = o.optDouble("treblePct", 0.0).toFloat(),
                bassFreqHz = o.optDouble("bassFreqHz", 90.0).toFloat(),
                bassQ = o.optDouble("bassQ", 0.75).toFloat(),
                trebleFreqHz = o.optDouble("trebleFreqHz", 10000.0).toFloat(),
                trebleQ = o.optDouble("trebleQ", 0.75).toFloat(),
                stereoWidthPct = o.optDouble("stereoWidthPct", 100.0).toFloat(),
                compAttackMs = o.optDouble("compAttackMs", 2.5).toFloat(),
                compReleaseMs = o.optDouble("compReleaseMs", 17.0).toFloat(),
                compRatio = o.optDouble("compRatio", 8.7).toFloat(),
                compFreqHz = o.optDouble("compFreqHz", 20000.0).toFloat(),
                compThresholdDb = o.optDouble("compThresholdDb", -50.0f.toDouble()).toFloat(),
                compGainDb = o.optDouble("compGainDb", 0.0).toFloat(),
                masterCeilDb = o.optDouble("masterCeilDb", -0.1).toFloat()
            )
        } catch (_: Exception) {
            DspSnapshot()
        }
    }
}
