/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LangCode,
  SUPPORTED_LANGS,
  LicenseTier,
  ProLicenseState,
  TRIAL_DURATION_MS,
  LEGAL_PRO_COPY,
  applyCertifiedDomTranslation,
  translateExactString,
} from './proLegalI18n';

interface AndroidBridgeAPI {
  hasMusicPermission?: () => boolean;
  requestMusicPermission?: () => void;
  rescanMusic?: () => void;
  updatePlaybackState?: (
    title: string,
    artist: string,
    isPlaying: boolean,
    positionMs: number,
    durationMs: number
  ) => void;
  vibrate?: (ms: number) => void;
  isIgnoringBatteryOptimizations?: () => boolean;
  openBatterySettings?: () => void;
  saveState?: (json: string) => boolean;
  loadState?: () => string;
  isInPhoneCall?: () => boolean;
  setWindowColors?: (statusHex: string, navHex: string) => void;
  getJackHiResInfo?: () => string;
  configureJackHiRes?: (enable: boolean, preferredRate: number) => string;
  syncGlobalDsp?: (configJson: string) => string;
  getGlobalDspStatus?: () => string;
  forceRebindGlobalDsp?: () => void | string;
  openSystemEqualizerSettings?: () => void;
  getHardwareVolumePct?: () => number;
  setHardwareVolumePct?: (pct: number) => void;
  launchProPurchase?: (plan: string) => void;
  restoreProPurchase?: () => boolean;
}

interface JackHardwareInfo {
  jackConnected: boolean;
  portType: 'jack_35mm' | 'usb_dac_jack' | 'bluetooth' | 'speaker' | 'web';
  deviceName: string;
  nativeRate: number;
  framesPerBuffer: number;
  arbitraryRates: boolean;
  maxSampleRate: number;
  supportedRates: number[];
  bitDepth: number;
  floatPcm: boolean;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeAPI;
    webkitAudioContext?: typeof AudioContext;
    __FORCED_EDITION?: 'pro' | 'classic';
    __onNativeTracks?: (tracksInput: unknown, reason?: string) => void;
    __onNativePermission?: (granted: boolean) => void;
    __onNativeJack?: (jackJson: unknown, reason?: string) => void;
    __onNativeUiState?: (visible: boolean, focused: boolean) => void;
    __onOpenConsoleFromSystem?: (pkg?: string) => void;
    __onOpenExternalTrack?: (trackJson: unknown) => void;
    __onProPurchaseResult?: (ok: boolean, plan?: string) => void;
    __nativeCmd?: (cmd: string, arg?: number) => void;
    __estudioEqBooted?: boolean;
  }
}

export function bootEstudioEQ(rootEl: HTMLElement): void {
  if (window.__estudioEqBooted) return;
  window.__estudioEqBooted = true;

  const EDITION_STORAGE_KEY = 'estudio_active_edition_v1';
  const IS_PRO_EDITION = (() => {
    if (window.__FORCED_EDITION === 'pro') return true;
    if (window.__FORCED_EDITION === 'classic') return false;
    try {
      return localStorage.getItem(EDITION_STORAGE_KEY) !== 'classic';
    } catch (_e) {
      return true;
    }
  })();
  document.body.dataset.edition = IS_PRO_EDITION ? 'pro' : 'classic';

  const NATIVE = typeof window.AndroidBridge !== 'undefined' && window.AndroidBridge !== null;
  const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = rootEl): T | null =>
    r.querySelector<T>(s) || document.querySelector<T>(s);

  function h(tag: string, props?: Record<string, any> | null, ...kids: any[]): HTMLElement {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = String(v);
        else if (k === 'text') e.textContent = String(v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else e.setAttribute(k, String(v));
      }
    }
    for (const c of kids.flat()) {
      if (c != null && c !== false) {
        e.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
    }
    return e;
  }

  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
  const dB = (x: number) => Math.pow(10, x / 20);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const fmtF = (f: number) => (f >= 1000 ? +(f / 1000).toFixed(2) + 'k' : String(f));
  const fmtHz = (f: number) => (f >= 1000 ? +(f / 1000).toFixed(2) + ' kHz' : f + ' Hz');
  const sgn = (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const mmss = (t: number) => {
    t = Math.max(0, t | 0);
    return ((t / 60) | 0) + ':' + String(t % 60).padStart(2, '0');
  };
  const normStr = (s: string) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  /* ---------- datos ---------- */
  const BANDS10 = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const LABELS10 = ['31', '62', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
  const BANDS30 = [
    25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
    2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
  ];
  const BANDS16 = [40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 5000, 8000, 10000, 12500, 16000];
  const NAMES16 = [
    'Sub', 'Graves', 'Bajos', 'Cuerpo', 'Calidez', 'Barro', 'Medios', 'Voz',
    'Claridad', 'Nitidez', 'Dicción', 'Brillo', 'Agudos', 'Aire', 'Aire +', 'Ultra',
  ];
  const INST: Array<{ grp: string; name: string; items: Array<[string, string, number, number]> }> = [
    {
      grp: 'drums',
      name: 'Batería',
      items: [
        ['kick', 'Bombo', 60, 1.2],
        ['snareB', 'Caja · cuerpo', 200, 1.4],
        ['snareC', 'Caja · chasquido', 5000, 1.2],
        ['tomF', 'Tom de piso', 90, 1.5],
        ['tomM', 'Tom medio', 160, 1.5],
        ['tomH', 'Tom agudo', 250, 1.5],
        ['hat', 'Hi-hat', 9000, 1],
        ['cym', 'Platillos', 12000, 0.8],
      ],
    },
    {
      grp: 'guitar',
      name: 'Guitarras',
      items: [
        ['gBody', 'Guitarra · cuerpo', 250, 1.2],
        ['gPres', 'Guitarra · presencia', 3000, 1.2],
        ['gAc', 'Acústica · brillo', 6000, 1],
      ],
    },
    {
      grp: 'bass',
      name: 'Bajo',
      items: [
        ['bLow', 'Bajo · cuerpo', 80, 1.4],
        ['bAtk', 'Bajo · ataque', 900, 1.4],
      ],
    },
    {
      grp: 'voice',
      name: 'Voces',
      items: [
        ['vWarm', 'Voz · calidez', 200, 1.2],
        ['vPres', 'Voz · presencia', 3500, 1.2],
        ['vSib', 'Voz · sibilancia', 7000, 2],
        ['vAir', 'Voz · aire', 12000, 0.8],
      ],
    },
    {
      grp: 'keys',
      name: 'Teclas y piano',
      items: [
        ['kBody', 'Piano · cuerpo', 300, 1.2],
        ['kBri', 'Piano · brillo', 4500, 1],
      ],
    },
  ];
  const FXN: Record<string, string> = {
    tone: 'Tono y filtros',
    comp: 'Compresor maestro',
    mbcomp: 'Compresor multibanda (3 bandas)',
    deess: 'De-Esser vocal dinámico',
    sat: 'Saturación analógica 4×',
    airexc: 'Excitador de aire armónico 4×',
    bmono: 'Centrador de subgraves (Mono)',
    xfeed: 'Crossfeed de audífonos',
    wid: 'Ancho estéreo M/S',
    rev: 'Reverberación HD',
    dly: 'Eco / Delay',
    sp: 'Sonido 3D Binaural',
    sub: 'Subgraves potentes',
    glass: 'Resonancia de vidrios',
    harm: 'Armónicos de graves 4×',
    trem: 'Temblor (trémolo)',
    vibr: 'Vibrato',
    hap: 'Vibración del teléfono',
  };

  function defState(): any {
    const inst: Record<string, { g: number; f: number; q: number }> = {};
    INST.forEach((g) => g.items.forEach(([id, , f, q]) => (inst[id] = { g: 0, f, q })));
    return {
      master: { pre: 0, vol: 0, ceil: -0.1, autoHead: false },
      play: { xfade: 0, gapless: true, rate: 1, keepPitch: true, hz432: false },
      jack: { hiRes: true, rate: 0, dither24: true },
      con: {
        enabled: true,
        subPage: 'eq',
        paramMode: false,
        eqOn: true,
        toneOn: true,
        limOn: true,
        vizOn: true,
        pre: 0,
        bands: Array(10).fill(0),
        bandFreqs: BANDS10.slice(),
        bandQs: Array(10).fill(1.41),
        bandQGlobal: 1.41,
        bass: 0,
        treb: 0,
        bassFreq: 90,
        bassQ: 0.75,
        trebFreq: 10000,
        trebQ: 0.75,
        compOn: false,
        attack: 2.5,
        release: 17.0,
        ratio: 8.7,
        freq: 20000,
        thresh: -50.0,
        gain: 0.0,
        balance: 0.0,
        stereoWidth: 100,
        conVol: 100,
        dvc: true,
        noDvcGain: -3.0,
        globalEq: false,
        sysWideMixExp: false,
        legacyHal: false,
        linkStudioGlobal: true,
        advTrack: false,
        locked: false,
        presetName: 'Plano 0.0 dB',
      },
      playerVol: 100,
      q30: 4.32,
      r30: 12,
      propQ30: true,
      eq: Array(30).fill(0),
      q16: 2.8,
      r16: 12,
      propQ16: true,
      cl: Array(16).fill(0),
      inst,
      fx: {
        tone: { bass: 0, bassF: 100, treb: 0, trebF: 8000, lc: 20, hc: 20000 },
        comp: { on: false, th: 0, ratio: 1, attack: 3, release: 250, knee: 0, makeup: 0 },
        mbcomp: { on: false, lowX: 160, highX: 3200, lowTh: -20, midTh: -18, highTh: -20, ratio: 3, lowG: 0, midG: 0, highG: 0 },
        deess: { on: false, freq: 6800, th: -24, amt: 6 },
        sat: { on: false, drive: 0, mix: 0, mode: 0 },
        airexc: { on: false, freq: 9500, drive: 25, mix: 0 },
        bmono: { on: false, freq: 100, mono: 100 },
        xfeed: { on: false, mix: 30, fc: 700 },
        wid: { on: false, w: 0 },
        rev: { on: false, irMode: 0, mix: 0, decay: 2, pre: 0, damp: 30, size: 50 },
        dly: { on: false, time: 250, fb: 0, mix: 0, tone: 8000 },
        sp: { on: false, mix: 0, az: 0, el: 0, dist: 1, rot: 0 },
        sub: { on: false, freq: 50, g: 0, q: 1.2 },
        glass: { on: false, freq: 90, g: 0, q: 6 },
        harm: { on: false, freq: 120, drive: 0, mix: 0 },
        trem: { on: false, rate: 5, depth: 0, shape: 0 },
        vibr: { on: false, rate: 5, depth: 0 },
        hap: { on: false, thr: 60, dur: 40, gap: 60, shake: 0 },
      },
      bypass: false,
      locks: {},
    };
  }

  const S = defState();
  const D = defState();

  function merge(t: any, s: any) {
    if (!s || typeof s !== 'object') return;
    for (const k in t) {
      if (!(k in s) || s[k] == null) continue;
      if (t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) merge(t[k], s[k]);
      else if (typeof t[k] === 'number') {
        const n = +s[k];
        if (isFinite(n)) t[k] = n;
      } else if (typeof t[k] === 'boolean') t[k] = !!s[k];
      else if (typeof t[k] === typeof s[k] && !Array.isArray(t[k])) t[k] = s[k];
    }
  }

  const SEC: Record<string, { n: string; get: (s: any) => any; set: (s: any, d: any) => void }> = {
    master: { n: 'Entrada y salida', get: (s) => clone(s.master), set: (s, d) => merge(s.master, d) },
    play: { n: 'Transición y motor de reproducción', get: (s) => clone(s.play), set: (s, d) => merge(s.play, d) },
    con: {
      n: 'Consola Master Independiente (Etapa Final)',
      get: (s) => ({
        ...clone(s.con),
        bands: Array.isArray(s.con.bands) ? s.con.bands.slice(0, 10) : Array(10).fill(0),
        bandFreqs: Array.isArray(s.con.bandFreqs) ? s.con.bandFreqs.slice(0, 10) : BANDS10.slice(),
        bandQs: Array.isArray(s.con.bandQs) ? s.con.bandQs.slice(0, 10) : Array(10).fill(1.41),
      }),
      set: (s, d) => {
        if (!d || typeof d !== 'object') return;
        const prevGlobal = s.con.globalEq;
        const prevSysMix = s.con.sysWideMixExp;
        const prevLegacy = s.con.legacyHal;
        const prevLinkStudio = s.con.linkStudioGlobal;
        const prevDvc = s.con.dvc;
        const prevAdv = s.con.advTrack;
        const prevLocked = s.con.locked;
        const prevSubPage = s.con.subPage;
        merge(s.con, d);
        if (Array.isArray(d.bands) && d.bands.length === 10) {
          s.con.bands = d.bands.map((v: any) => clamp(isFinite(+v) ? +v : 0, -15, 15));
        }
        if (Array.isArray(d.bandFreqs) && d.bandFreqs.length === 10) {
          s.con.bandFreqs = d.bandFreqs.map((v: any, idx: number) =>
            clamp(isFinite(+v) ? +v : BANDS10[idx], 20, 20000)
          );
        }
        if (Array.isArray(d.bandQs) && d.bandQs.length === 10) {
          s.con.bandQs = d.bandQs.map((v: any) => clamp(isFinite(+v) ? +v : 1.41, 0.25, 10));
        }
        if (d.globalEq === undefined) s.con.globalEq = prevGlobal;
        if (d.sysWideMixExp === undefined) s.con.sysWideMixExp = prevSysMix;
        if (d.legacyHal === undefined) s.con.legacyHal = prevLegacy;
        if (d.linkStudioGlobal === undefined) s.con.linkStudioGlobal = prevLinkStudio;
        if (d.dvc === undefined) s.con.dvc = prevDvc;
        if (d.advTrack === undefined) s.con.advTrack = prevAdv;
        if (d.locked === undefined) s.con.locked = prevLocked;
        if (d.subPage !== 'eq' && d.subPage !== 'comp' && d.subPage !== 'cfg') s.con.subPage = prevSubPage;
      },
    },
    eq30: {
      n: 'EQ de 30 bandas',
      get: (s) => ({ eq: s.eq.slice(), q30: s.q30, r30: s.r30, propQ30: !!s.propQ30 }),
      set: (s, d) => {
        if (!d || typeof d !== 'object') return;
        if (Array.isArray(d.eq) && d.eq.length === 30) s.eq = d.eq.map((v: any) => clamp(isFinite(+v) ? +v : 0, -24, 24));
        if (d.q30 != null && isFinite(+d.q30) && +d.q30 > 0) s.q30 = clamp(+d.q30, 0.3, 20);
        if (d.r30 != null && [6, 12, 24].includes(+d.r30)) s.r30 = +d.r30;
        if (typeof d.propQ30 === 'boolean') s.propQ30 = d.propQ30;
      },
    },
    cl16: {
      n: '16 bandas de claridad',
      get: (s) => ({ cl: s.cl.slice(), q16: s.q16, r16: s.r16, propQ16: !!s.propQ16 }),
      set: (s, d) => {
        if (!d || typeof d !== 'object') return;
        if (Array.isArray(d.cl) && d.cl.length === 16) s.cl = d.cl.map((v: any) => clamp(isFinite(+v) ? +v : 0, -24, 24));
        if (d.q16 != null && isFinite(+d.q16) && +d.q16 > 0) s.q16 = clamp(+d.q16, 0.3, 20);
        if (d.r16 != null && [6, 12, 24].includes(+d.r16)) s.r16 = +d.r16;
        if (typeof d.propQ16 === 'boolean') s.propQ16 = d.propQ16;
      },
    },
  };

  INST.forEach((g) => {
    SEC[g.grp] = {
      n: g.name,
      get: (s) => {
        const o: Record<string, any> = {};
        g.items.forEach(([id]) => (o[id] = clone(s.inst[id])));
        return o;
      },
      set: (s, d) => {
        if (d && typeof d === 'object') g.items.forEach(([id]) => { if (d[id]) merge(s.inst[id], d[id]); });
      },
    };
  });

  Object.keys(FXN).forEach((k) => {
    SEC[k] = { n: FXN[k], get: (s) => clone(s.fx[k]), set: (s, d) => merge(s.fx[k], d) };
  });

  /* IMPORTANTE: 'con' NO forma parte de ORDER para que la Consola sea 100% independiente:
     cambiar Géneros, Curvas de Referencia, Presets del Estudio o pulsar Cero/Bypass arriba JAMÁS borra ni pisa la Consola. */
  const ORDER = [
    'master', 'play', 'eq30', 'cl16', 'drums', 'guitar', 'bass', 'voice', 'keys',
    'tone', 'comp', 'mbcomp', 'deess', 'sat', 'airexc', 'bmono', 'xfeed', 'wid', 'rev', 'dly', 'sp', 'sub', 'glass', 'harm', 'trem', 'vibr', 'hap',
  ];
  const getFull = () => {
    const o: Record<string, any> = {};
    ORDER.forEach((k) => (o[k] = SEC[k].get(S)));
    return o;
  };
  const resetSec = (k: string) => SEC[k].set(S, SEC[k].get(D));

  /* ---------- almacenamiento nativo + local (aislado por app independiente) ---------- */
  const KEY = IS_PRO_EDITION ? 'jf-master-pro-hires-v1' : 'estudio-master-hires-v1';
  const CON_KEY = IS_PRO_EDITION ? 'jf-master-pro-console-indep-v1' : 'estudio-master-console-indep-v2';
  const LAST_TRACK_KEY = IS_PRO_EDITION ? 'jf-master-pro-last-track' : 'estudio-master-hires-last-track';
  const PRO_LIC_KEY = 'jf-master-pro-license-v2';
  const PRO_LANG_KEY = 'jf-master-pro-lang-v1';
  let trialAutoPromptShown = false;

  const detectDefaultLang = (): LangCode => {
    try {
      const saved = localStorage.getItem(PRO_LANG_KEY) as LangCode | null;
      if (saved && SUPPORTED_LANGS.some((x) => x.code === saved)) return saved;
    } catch (_e) {}
    const nav = (typeof navigator !== 'undefined' ? navigator.language || '' : '').toLowerCase();
    if (nav.startsWith('en')) return 'en';
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('de')) return 'de';
    if (nav.startsWith('ko')) return 'ko';
    return 'es';
  };

  let currentLang: LangCode = IS_PRO_EDITION ? detectDefaultLang() : 'es';

  const proState: ProLicenseState = {
    legalAccepted: false,
    legalAcceptedAt: 0,
    trialStartedAt: 0,
    proUnlocked: false,
    proUnlockedAt: 0,
    proPlan: '',
    proLicenseCode: '',
  };

  if (IS_PRO_EDITION) {
    try {
      const rawLic = localStorage.getItem(PRO_LIC_KEY) || localStorage.getItem('jf-master-pro-license-v1');
      if (rawLic) {
        const pl = JSON.parse(rawLic);
        if (pl && typeof pl === 'object') {
          proState.legalAccepted = !!pl.legalAccepted;
          proState.legalAcceptedAt = +pl.legalAcceptedAt || 0;
          proState.trialStartedAt = +pl.trialStartedAt || 0;
          proState.proUnlocked = !!pl.proUnlocked;
          proState.proUnlockedAt = +pl.proUnlockedAt || 0;
          proState.proPlan =
            pl.proPlan === 'annual' || pl.proPlan === 'monthly' || pl.proPlan === 'lifetime' ? pl.proPlan : '';
          proState.proLicenseCode = typeof pl.proLicenseCode === 'string' ? pl.proLicenseCode : '';
        }
      }
    } catch (_e) {}
  }

  function saveProLicenseState() {
    if (!IS_PRO_EDITION) return;
    try {
      localStorage.setItem(PRO_LIC_KEY, JSON.stringify(proState));
    } catch (_e) {}
  }

  function getLicenseTier(): LicenseTier {
    if (!IS_PRO_EDITION) return 'pro';
    if (proState.proUnlocked) return 'pro';
    if (proState.trialStartedAt > 0) {
      const elapsed = Date.now() - proState.trialStartedAt;
      return elapsed < TRIAL_DURATION_MS ? 'trial' : 'expired';
    }
    return 'free';
  }

  function hasProAccess(): boolean {
    const t = getLicenseTier();
    return t === 'pro' || t === 'trial';
  }

  const store: {
    last: any;
    console: any;
    conPresets: Array<{ name: string; ts: number; data: any }>;
    presets: any[];
    sec: Record<string, any[]>;
    pro?: ProLicenseState;
    lang?: LangCode;
  } = { last: null, console: null, conPresets: [], presets: [], sec: {} };
  let savedRepeat = 0;
  let savedShuffle = false;
  let savedSortMode: 'recent' | 'az' = 'recent';
  let savedLastTrackId: string | null = null;

  function loadRawStore(): string {
    if (NATIVE && window.AndroidBridge?.loadState) {
      try {
        const ns = window.AndroidBridge.loadState();
        if (ns && ns.length > 2) return ns;
      } catch (_e) {}
    }
    try {
      return localStorage.getItem(KEY) || '';
    } catch (_e) {
      return '';
    }
  }

  try {
    const r = loadRawStore();
    if (r) {
      const o = JSON.parse(r);
      if (o && typeof o === 'object') {
        store.last = o.last && typeof o.last === 'object' ? o.last : null;
        store.console = o.console && typeof o.console === 'object' ? o.console : null;
        store.conPresets = Array.isArray(o.conPresets) ? o.conPresets : [];
        store.presets = Array.isArray(o.presets) ? o.presets : [];
        store.sec = o.sec && typeof o.sec === 'object' ? o.sec : {};
        if (IS_PRO_EDITION && o.pro && typeof o.pro === 'object') {
          if (o.pro.legalAccepted) proState.legalAccepted = true;
          if (+o.pro.trialStartedAt > 0 && !proState.trialStartedAt) proState.trialStartedAt = +o.pro.trialStartedAt;
          if (o.pro.proUnlocked) proState.proUnlocked = true;
          if (o.pro.proPlan) proState.proPlan = o.pro.proPlan;
        }
        if (IS_PRO_EDITION && o.lang && SUPPORTED_LANGS.some((x) => x.code === o.lang)) {
          currentLang = o.lang;
        }
      }
    }
  } catch (_e) {}

  try {
    const cr = localStorage.getItem(CON_KEY);
    if (cr) {
      const co = JSON.parse(cr);
      if (co && typeof co === 'object') {
        if (!store.console && co.console) store.console = co.console;
        if (!store.conPresets.length && Array.isArray(co.conPresets)) store.conPresets = co.conPresets;
      }
    }
  } catch (_e) {}

  let toastTimer: any = null;
  function toast(m: string) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = IS_PRO_EDITION ? translateExactString(m, currentLang) : m;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2800);
  }

  function persist() {
    let ok = false;
    if (IS_PRO_EDITION) {
      store.pro = { ...proState };
      store.lang = currentLang;
      saveProLicenseState();
    }
    const raw = JSON.stringify(store);
    if (NATIVE && window.AndroidBridge?.saveState) {
      try {
        ok = !!window.AndroidBridge.saveState(raw);
      } catch (_e) {}
    }
    try {
      localStorage.setItem(KEY, raw);
      localStorage.setItem(CON_KEY, JSON.stringify({ console: store.console, conPresets: store.conPresets }));
      ok = true;
    } catch (_e) {}
    if (!ok) toast('Este navegador no permite guardar. Usa Exportar en Presets.');
    return ok;
  }

  function snapshotLast() {
    store.last = {
      data: getFull(),
      bypass: !!S.bypass,
      locks: clone(S.locks || {}),
      jack: clone(S.jack || { hiRes: true, rate: 0, dither24: true }),
      playerVol: clamp(isFinite(+S.playerVol) ? +S.playerVol : 100, 0, 100),
      repeat: savedRepeat,
      shuffle: savedShuffle,
      sortMode: savedSortMode,
      lastTrackId: savedLastTrackId,
    };
    store.console = SEC.con.get(S);
  }

  let saveT: any = 0;
  function persistNow() {
    clearTimeout(saveT);
    snapshotLast();
    return persist();
  }
  function saveSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      snapshotLast();
      persist();
    }, 280);
  }

  if (store.last) {
    S.locks = store.last.locks && typeof store.last.locks === 'object' ? store.last.locks : {};
    if (store.last.data && typeof store.last.data === 'object') {
      ORDER.forEach((k) => {
        if (store.last.data[k]) SEC[k].set(S, store.last.data[k]);
      });
      // Migración automática única si venía de v1.3.0 donde con estaba dentro de last.data
      if (!store.console && store.last.data.con) {
        SEC.con.set(S, store.last.data.con);
      }
    }
    if (!S.locks.play) {
      S.play.rate = 1;
      S.play.hz432 = false;
    }
    S.bypass = !!store.last.bypass;
    if (store.last.jack && typeof store.last.jack === 'object') {
      if (typeof store.last.jack.hiRes === 'boolean') S.jack.hiRes = store.last.jack.hiRes;
      if ([0, 48000, 96000, 192000].includes(+store.last.jack.rate)) S.jack.rate = +store.last.jack.rate;
      if (typeof store.last.jack.dither24 === 'boolean') S.jack.dither24 = store.last.jack.dither24;
    }
    if (store.last.playerVol != null && isFinite(+store.last.playerVol)) S.playerVol = clamp(+store.last.playerVol, 0, 100);
    if ([0, 1, 2].includes(+store.last.repeat)) savedRepeat = +store.last.repeat;
    if (typeof store.last.shuffle === 'boolean') savedShuffle = store.last.shuffle;
    if (store.last.sortMode === 'az' || store.last.sortMode === 'recent') savedSortMode = store.last.sortMode;
    if (store.last.lastTrackId != null) savedLastTrackId = String(store.last.lastTrackId);
  }
  if (store.console) {
    SEC.con.set(S, store.console);
  }
  /* Las opciones de Audio Global del Sistema en Consola arrancan SIEMPRE desactivadas
     para que el usuario las presione y active únicamente de forma manual. */
  S.con.globalEq = false;
  S.con.legacyHal = false;
  S.con.advTrack = false;
  S.con.sysWideMixExp = false;
  S.con.linkStudioGlobal = true;

  if (Array.isArray(store.sec.con) && store.sec.con.length && !store.conPresets.length) {
    store.conPresets = store.sec.con.slice();
  }
  try {
    if (!savedLastTrackId) savedLastTrackId = localStorage.getItem(LAST_TRACK_KEY);
  } catch (_e) {}

  if (IS_PRO_EDITION && !hasProAccess()) {
    S.con.paramMode = false;
    S.con.compOn = false;
    S.jack.hiRes = false;
  }

  let updateHeaderProUi: () => void = () => {};
  let updatePreviewBarUi: () => void = () => {};
  let openProModal: () => void = () => {};
  let openStartupLegalModal: (forceViewOnly?: boolean) => void = () => {};

  function setAppLanguage(lang: LangCode) {
    currentLang = lang;
    try {
      localStorage.setItem(PRO_LANG_KEY, lang);
    } catch (_e) {}
    if (IS_PRO_EDITION) {
      applyCertifiedDomTranslation(rootEl, currentLang);
      updateHeaderProUi();
      persistNow();
    }
  }

  function requireProAccess(): boolean {
    if (!IS_PRO_EDITION || hasProAccess()) return true;
    const cp = LEGAL_PRO_COPY[currentLang];
    toast(cp.previewLockedToast);
    return false;
  }

  const stamp = () => new Date().toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ---------- Motor DSP Nativo C++ 64-bit (Reloj 1:1 Bit-Perfect · Bypass de Carga Cero · Idéntico en Web y APK) ---------- */
  let ctx: AudioContext | null = null;
  let deckA!: HTMLAudioElement;
  let deckB!: HTMLAudioElement;
  let audio!: HTMLAudioElement;
  let standbyAudio!: HTMLAudioElement;
  let activeDeck: 'A' | 'B' = 'A';
  let engineGen = 0;
  let rebuildingCtx = false;
  let ditherReady = false;
  let jackStatusEl: HTMLElement | null = null;
  let jackHw: JackHardwareInfo = {
    jackConnected: false,
    portType: NATIVE ? 'speaker' : 'web',
    deviceName: NATIVE ? 'Altavoz del teléfono' : 'Salida directa del sistema',
    nativeRate: 48000,
    framesPerBuffer: 256,
    arbitraryRates: false,
    maxSampleRate: 48000,
    supportedRates: [48000],
    bitDepth: 24,
    floatPcm: true,
  };
  const N: Record<string, any> = {};
  let irKey = '';
  let irT: any = 0;
  let satSig = '';
  let airDriveSig = -1;
  let harmDrive = -1;
  let ceilSig = -999;
  let vizDirty = true;
  let nativeUiVisible = true;
  let nativeWindowFocused = true;
  let scrollBusyUntil = 0;
  const isUiAwake = () => !document.hidden && nativeUiVisible && nativeWindowFocused;

  let conLimSig = -999;
  const P_CACHE: Record<string, number> = Object.create(null);
  const FX_CONN = {
    conMaster: false,
    conEq: false,
    conCompFull: false,
    conCompSplit: false,
    conWid: false,
    bal: false,
    hp: false,
    lp: false,
    tone: false,
    eq30: false,
    cl16: false,
    inst: false,
    comp: false,
    wid: false,
    harm: false,
    sat: false,
    airexc: false,
    mbcomp: false,
    deess: false,
    bmono: false,
    xfeed: false,
    sp: false,
    rev: false,
    dly: false,
    trem: false,
    vibr: false,
    dither: false,
    an: false,
  };

  const chain = (...n: AudioNode[]) => {
    for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
  };
  function safeConn(a: AudioNode, b: AudioNode, on: boolean) {
    if (on) {
      try {
        a.connect(b);
      } catch (_e) {}
    } else {
      try {
        a.disconnect(b);
      } catch (_e) {}
    }
  }

  /* Descompresión de Nyquist (Orfanidis/RBJ) para que 10k–20k Hz suenen idénticos a 48 kHz y 96 kHz */
  function safeFreq(f: number, fs: number): number {
    return clamp(f, 10, Math.min(22000, fs * 0.458));
  }
  function decrampQ(f: number, q: number, fs: number): number {
    const fc = safeFreq(f, fs);
    const w0 = (2 * Math.PI * fc) / fs;
    if (w0 < 0.35) return clamp(q, 0.2, 24);
    const ratio = Math.sin(w0) / w0;
    return clamp(q * Math.max(0.32, ratio), 0.2, 24);
  }

  /* Curva de techo True-Peak: 100% lineal bit-exacta (y = x) hasta el 94% del techo, sin coloración ni bombeo */
  function makeCeilingCurve(ceilDb: number) {
    const n = 16384;
    const c = new Float32Array(n);
    const ceilLin = clamp(dB(ceilDb), 0.25, 0.999);
    const knee = ceilLin * 0.94;
    const span = Math.max(1e-4, ceilLin - knee);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      const ax = Math.abs(x);
      if (ax <= knee) {
        c[i] = x;
      } else {
        const y = knee + span * Math.tanh((ax - knee) / span);
        c[i] = x < 0 ? -y : y;
      }
    }
    return c;
  }

  /* Matrices Acústicas Reales WAV IEEE 32-bit Float Sin Compresión (integradas en /audio-data y APK STORE 0%) */
  const STUDIO_WAV_IRS: Record<number, { file: string; label: string; desc: string }> = {
    1: {
      file: '/audio-data/ir-mastering-room-32f.wav',
      label: 'Sala Mastering WAV 32f',
      desc: 'Impulso WAV IEEE 32-bit Float sin comprimir (0.9 s · Control Room acústico tratado).',
    },
    2: {
      file: '/audio-data/ir-studio-plate-32f.wav',
      label: 'Placa EMT WAV 32f',
      desc: 'Impulso WAV IEEE 32-bit Float sin comprimir (1.5 s · Placa analógica dorada de estudio).',
    },
    3: {
      file: '/audio-data/ir-acoustic-chamber-32f.wav',
      label: 'Cámara Madera WAV 32f',
      desc: 'Impulso WAV IEEE 32-bit Float sin comprimir (1.8 s · Cámara acústica natural en estéreo).',
    },
    4: {
      file: '/audio-data/ir-concert-hall-32f.wav',
      label: 'Auditorio HD WAV 32f',
      desc: 'Impulso WAV IEEE 32-bit Float sin comprimir (2.4 s · Sala sinfónica amplia sin pérdida).',
    },
  };
  const wavBufferCache: Record<string, AudioBuffer> = Object.create(null);
  const wavBufferPending: Record<string, Promise<AudioBuffer | null> | undefined> = Object.create(null);

  function loadStudioWavBuffer(ac: AudioContext, relUrl: string): Promise<AudioBuffer | null> {
    const cacheKey = (ac.sampleRate || 48000) + '|' + relUrl;
    if (wavBufferCache[cacheKey]) return Promise.resolve(wavBufferCache[cacheKey]);
    if (wavBufferPending[cacheKey]) return wavBufferPending[cacheKey]!;
    const cleanRel = relUrl.replace(/^\//, '');
    const p = fetch(cleanRel)
      .catch(() => fetch(relUrl))
      .then((res) => (res && res.ok ? res.arrayBuffer() : Promise.reject(new Error('wav_404'))))
      .then((ab) => ac.decodeAudioData(ab.slice(0)))
      .then((decoded) => {
        wavBufferCache[cacheKey] = decoded;
        delete wavBufferPending[cacheKey];
        return decoded;
      })
      .catch(() => {
        delete wavBufferPending[cacheKey];
        return null;
      });
    wavBufferPending[cacheKey] = p;
    return p;
  }

  /* Generador C++ de respaldo instantáneo 24-bit TPDF mientras se mapea el WAV IEEE 32-bit Float sin comprimir */
  function createNativeTpdf24Buffer(ac: AudioContext): AudioBuffer {
    const sr = ac.sampleRate || 48000;
    const frames = sr * 2;
    const buf = ac.createBuffer(2, frames, sr);
    const lsb = 1.1920928955078125e-7; // 1 LSB en 24-bit (-138.5 dBFS RMS triangular)
    const inv = 2.3283064365386963e-10;
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      let s = ch === 0 ? 0x6d2b79f5 : 0x9e3779b9;
      for (let i = 0; i < frames; i++) {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        const r1 = (s >>> 0) * inv;
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        const r2 = (s >>> 0) * inv;
        out[i] = (r1 - r2) * lsb;
      }
    }
    return buf;
  }

  function makeDeckEl(): HTMLAudioElement {
    const el = new Audio();
    el.setAttribute('playsinline', '');
    el.preload = 'auto';
    (el as any).preservesPitch = true;
    (el as any).webkitPreservesPitch = true;
    el.volume = 1;
    return el;
  }

  function parseNativeJackJson(raw: unknown): JackHardwareInfo | null {
    try {
      const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!o || typeof o !== 'object') return null;
      const obj = o as Record<string, any>;
      const nat = +obj.nativeRate || 48000;
      const rates = Array.isArray(obj.supportedRates)
        ? obj.supportedRates.map((x: any) => +x).filter((x: number) => isFinite(x) && x >= 44100)
        : [nat];
      return {
        jackConnected: !!obj.jackConnected,
        portType: obj.portType || 'speaker',
        deviceName: String(obj.deviceName || (obj.jackConnected ? 'Puerto Jack 3.5 mm' : 'Altavoz del teléfono')),
        nativeRate: nat,
        framesPerBuffer: +obj.framesPerBuffer || 256,
        arbitraryRates: false,
        maxSampleRate: +obj.maxSampleRate || nat,
        supportedRates: rates.length ? rates : [nat],
        bitDepth: +obj.bitDepth || 24,
        floatPcm: obj.floatPcm !== false,
      };
    } catch (_e) {
      return null;
    }
  }

  function refreshNativeJackSync() {
    if (!NATIVE || !window.AndroidBridge?.getJackHiResInfo) return;
    try {
      const parsed = parseNativeJackJson(window.AndroidBridge.getJackHiResInfo());
      if (parsed) jackHw = parsed;
    } catch (_e) {}
  }

  /* Buffer de hardware profundo (180 ms FIFO en móvil/APK) en reloj físico 1:1 del DAC:
     absorbe picos de CPU/GPU al bajar notificaciones, leer PDFs, cambiar de ventana o tocar el fondo de pantalla */
  function createHardwareSyncedContext(AC: typeof AudioContext): AudioContext {
    const isMobileTouch =
      NATIVE ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
    if (isMobileTouch) {
      try {
        return new AC({ latencyHint: 0.18 });
      } catch (_e0) {}
    }
    try {
      return new AC({ latencyHint: 'playback' });
    } catch (_e) {
      return new AC();
    }
  }

  function build(attachEvents?: (el: HTMLAudioElement) => void) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const gen = ++engineGen;
    if (NATIVE && window.AndroidBridge?.configureJackHiRes) {
      try {
        const updated = parseNativeJackJson(
          window.AndroidBridge.configureJackHiRes(!!S.jack.hiRes, jackHw.nativeRate || 48000)
        );
        if (updated) jackHw = updated;
      } catch (_e) {}
    }
    deckA = makeDeckEl();
    deckB = makeDeckEl();
    audio = deckA;
    standbyAudio = deckB;
    activeDeck = 'A';
    if (attachEvents) {
      attachEvents(deckA);
      attachEvents(deckB);
    }
    if (!AC) {
      toast('Este navegador no admite audio avanzado.');
      return;
    }
    ctx = createHardwareSyncedContext(AC);
    if (!NATIVE && ctx.sampleRate) {
      jackHw.nativeRate = ctx.sampleRate;
      jackHw.maxSampleRate = ctx.sampleRate;
      jackHw.supportedRates = [ctx.sampleRate];
    }
    const fs = ctx.sampleRate || 48000;

    ctx.addEventListener('statechange', () => {
      if (gen !== engineGen) return;
      updateEngineSpecUi();
      paintJackStatus();
    });
    const srcA = ctx.createMediaElementSource(deckA);
    const srcB = ctx.createMediaElementSource(deckB);
    const g = (v = 1) => {
      const n = ctx!.createGain();
      n.gain.value = v;
      return n;
    };
    const bq = (t: BiquadFilterType, f: number, q = 0.7071, gn = 0) => {
      const n = ctx!.createBiquadFilter();
      n.type = t;
      n.frequency.value = safeFreq(f, fs);
      n.Q.value = t === 'peaking' ? decrampQ(f, q, fs) : q;
      n.gain.value = gn;
      return n;
    };

    /* Mezclador Dual-Deck en 32-bit float para Gapless real y Crossfade igual-potencia */
    N.gA = g(1);
    N.gB = g(0);
    N.deckSum = g(1);
    srcA.connect(N.gA);
    srcB.connect(N.gB);
    N.gA.connect(N.deckSum);
    N.gB.connect(N.deckSum);

    N.pre = g(1);
    N.pre.channelCount = 2;
    N.pre.channelCountMode = 'explicit';
    N.pre.channelInterpretation = 'speakers';
    N.eqTrim = g(1);

    /* Bancos EQ C++ nativos del Estudio Principal con Bypass de Carga Cero por sección */
    N.hpDry = g(1);
    N.hp = bq('highpass', 20, 0.7071);
    N.hpWet = g(0);
    N.hpSum = g(1);

    N.lpDry = g(1);
    N.lp = bq('lowpass', 20000, 0.7071);
    N.lpWet = g(0);
    N.lpSum = g(1);

    N.toneDry = g(1);
    N.dc = bq('highpass', 12, 0.7071);
    N.bass = bq('lowshelf', 100);
    N.treb = bq('highshelf', 8000);
    N.vSub = bq('peaking', 50, 1.2);
    N.vRes = bq('peaking', 90, 6);
    N.toneWet = g(0);
    N.s1Out = g(1);

    N.eq30Dry = g(1);
    N.eq = BANDS30.map((f) => bq('peaking', f, 4.32));
    N.eq30Wet = g(0);
    N.s2Out = g(1);

    N.cl16Dry = g(1);
    N.cl = BANDS16.map((f) => bq('peaking', f, 2.8));
    N.cl16Wet = g(0);
    N.s3Out = g(1);

    N.instDry = g(1);
    N.inst = {};
    INST.forEach((gr) => gr.items.forEach(([id, , f, q]) => (N.inst[id] = bq('peaking', f, q))));
    const instArr = Object.values(N.inst) as BiquadFilterNode[];
    N.instWet = g(0);

    /* Armónicos de subgraves 2× (cero sobrecarga móvil) */
    N.xIn = g(1);
    N.xLp = bq('lowpass', 120, 0.7071);
    N.xSh = ctx.createWaveShaper();
    N.xSh.oversample = '2x';
    N.xHp = bq('highpass', 32, 0.7071);
    N.xWet = g(0);
    N.xSum = g(1);

    /* Modulación bajo demanda (LFOs creados solo al encenderse = 0% carga en reposo) */
    N.trem = g(1);
    N.tLfo = null;
    N.tG = g(0);
    N.vibDry = g(1);
    N.vib = ctx.createDelay(0.05);
    N.vib.delayTime.value = 0.01;
    N.vibWet = g(0);
    N.vLfo = null;
    N.vG = g(0);
    N.vOut = g(1);

    /* Saturación analógica + Excitador de Aire Armónico */
    N.satDry = g(1);
    N.shaper = ctx.createWaveShaper();
    N.shaper.oversample = '2x';
    N.satDc = bq('highpass', 15, 0.7071);
    N.satWet = g(0);
    N.airHp = bq('highpass', 9500, 0.7071);
    N.airSh = ctx.createWaveShaper();
    N.airSh.oversample = '2x';
    N.airClean = bq('highpass', 5500, 0.7071);
    N.airWet = g(0);
    N.satSum = g(1);

    /* De-Esser Vocal Dinámico por división de banda transparente */
    N.deDry = g(1);
    N.deLow = bq('lowpass', 6800, 0.7071);
    N.deHigh = bq('highpass', 6800, 0.7071);
    N.deComp = ctx.createDynamicsCompressor();
    N.deComp.knee.value = 4;
    N.deComp.ratio.value = 6;
    N.deComp.attack.value = 0.0008;
    N.deComp.release.value = 0.042;
    N.deWet = g(0);
    N.deOut = g(1);

    /* Compresor Multibanda de 3 bandas (Graves / Medios / Agudos) */
    N.mbDry = g(1);
    N.mbLp1 = bq('lowpass', 160, 0.7071);
    N.mbHp1 = bq('highpass', 160, 0.7071);
    N.mbLp2 = bq('lowpass', 3200, 0.7071);
    N.mbHp2 = bq('highpass', 3200, 0.7071);
    const mkMbComp = () => {
      const c = ctx!.createDynamicsCompressor();
      c.knee.value = 6;
      c.attack.value = 0.008;
      c.release.value = 0.14;
      return c;
    };
    N.mbLowC = mkMbComp();
    N.mbMidC = mkMbComp();
    N.mbHighC = mkMbComp();
    N.mbLowG = g(1);
    N.mbMidG = g(1);
    N.mbHighG = g(1);
    N.mbWet = g(0);
    N.mbOut = g(1);

    /* Compresor Maestro con Bypass real (evita los filtros allpass internos de Chromium cuando está apagado) */
    N.compDry = g(1);
    N.comp = ctx.createDynamicsCompressor();
    N.makeup = g(1);
    N.compWet = g(0);
    N.compOut = g(1);

    /* Matriz Estéreo Mid/Side con Bypass real cuando está en 0 */
    N.widDry = g(1);
    N.split = ctx.createChannelSplitter(2);
    N.mid = g(0.5);
    N.sL = g(0.5);
    N.sR = g(-0.5);
    N.sw = g(1);
    N.inv = g(-1);
    N.merge = ctx.createChannelMerger(2);
    N.widWet = g(0);
    N.widOut = g(1);

    /* Centrador Elíptico de Subgraves (Bass Mono Maker) */
    N.bmDry = g(1);
    N.bmSplit = ctx.createChannelSplitter(2);
    N.bmSL = g(0.5);
    N.bmSR = g(-0.5);
    N.bmLp = bq('lowpass', 100, 0.7071);
    N.bmNegL = g(0);
    N.bmPosR = g(0);
    N.bmMerge = ctx.createChannelMerger(2);
    N.bmOut = g(1);

    /* Crossfeed Binaural de Audífonos */
    N.xfDry = g(1);
    N.xfSplit = ctx.createChannelSplitter(2);
    N.xfDL = ctx.createDelay(0.01);
    N.xfDR = ctx.createDelay(0.01);
    N.xfDL.delayTime.value = 0.00028;
    N.xfDR.delayTime.value = 0.00028;
    N.xfLpL = bq('lowpass', 700, 0.7071);
    N.xfLpR = bq('lowpass', 700, 0.7071);
    N.xfGL = g(0);
    N.xfGR = g(0);
    N.xfMerge = ctx.createChannelMerger(2);
    N.xfOut = g(1);

    /* Audio Espacial 3D HRTF */
    N.spDry = g(1);
    N.pan = ctx.createPanner();
    N.pan.panningModel = 'HRTF';
    N.pan.distanceModel = 'inverse';
    N.pan.refDistance = 1;
    N.spWet = g(0);

    N.bus = g(1);
    N.busDry = g(1);
    N.preD = ctx.createDelay(1);
    N.conv = ctx.createConvolver();
    N.revWet = g(0);
    N.dly = ctx.createDelay(2);
    N.fb = g(0);
    N.dTone = bq('lowpass', 8000);
    N.dWet = g(0);
    N.fxSum = g(1);
    N.wet = g(1);
    N.direct = g(0);

    /* Salida Maestra del Estudio Principal (previa a la Consola Final Independiente) */
    N.master = g(1);
    N.clipSafe = ctx.createWaveShaper();
    N.clipSafe.oversample = 'none';
    N.clipSafe.curve = makeCeilingCurve(S.master.ceil);
    ceilSig = S.master.ceil;
    N.studioBus = g(1);

    /* ========== ETAPA FINAL INDEPENDIENTE: CONSOLA MASTER (POST-ESTUDIO, ESTILO POWERAMP EQUALIZER) ========== */
    N.conBypass = g(1);
    N.conIn = g(1);

    // 1. Preamp + DVC Headroom + 10 Bandas (Gráfico / Paramétrico) + Tono Dual (Shelf + Campana Q)
    N.conDry = g(1);
    N.conPre = g(1);
    N.conBands = BANDS10.map((f) => bq('peaking', f, 1.41));
    N.conBassShelf = bq('lowshelf', 90, 0.7071);
    N.conBassPeak = bq('peaking', 90, 0.75);
    N.conTrebShelf = bq('highshelf', 10000, 0.7071);
    N.conTrebPeak = bq('peaking', 10000, 0.75);
    N.conWet = g(0);
    N.conOut = g(1);

    // 2. Compresor de 6 Perillas con Crossover Linkwitz-Riley de 4° orden (LR4, suma 0.0 dB en fase exacta)
    N.conCompDry = g(1);
    N.conCompLp1 = bq('lowpass', 20000, 0.70710678);
    N.conCompLp2 = bq('lowpass', 20000, 0.70710678);
    N.conCompHp1 = bq('highpass', 20000, 0.70710678);
    N.conCompHp2 = bq('highpass', 20000, 0.70710678);
    N.conComp = ctx.createDynamicsCompressor();
    N.conComp.knee.value = 6;
    N.conCompGain = g(1);
    N.conCompWet = g(0);
    N.conCompOut = g(1);

    // 3. Expansión Estéreo M/S de Consola (0% Mono · 100% Original · 200% Escena Abierta)
    N.conWidDry = g(1);
    N.conSplit = ctx.createChannelSplitter(2);
    N.conMid = g(0.5);
    N.conSL = g(0.5);
    N.conSR = g(-0.5);
    N.conSideGain = g(1);
    N.conSideInv = g(-1);
    N.conMerge = ctx.createChannelMerger(2);
    N.conWidWet = g(0);
    N.conWidOut = g(1);

    // 4. Balance Estéreo L/R de Consola (-1.00 a +1.00)
    N.balDry = g(1);
    N.balPan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    N.balWet = g(0);
    N.balOut = g(1);

    // 5. Limitador True-Peak de Consola (Límit) + Volumen Final de Consola
    N.conLim = ctx.createWaveShaper();
    N.conLim.oversample = 'none';
    N.conLim.curve = S.con.enabled !== false && S.con.limOn !== false ? makeCeilingCurve(-0.12) : null;
    conLimSig = S.con.enabled !== false && S.con.limOn !== false ? -0.12 : -999;
    N.conVolGain = g(clamp(isFinite(+S.con.conVol) ? +S.con.conVol : 100, 0, 100) / 100);
    N.conFinalOut = g(1);

    /* Analizador conectado bajo demanda (se desconecta automáticamente al apagar pantalla o bajar notificaciones) */
    N.an = ctx.createAnalyser();
    N.an.fftSize = NATIVE ? 1024 : 2048;
    N.an.minDecibels = -92;
    N.an.maxDecibels = -6;
    N.an.smoothingTimeConstant = 0.78;
    N.pvol = g(clamp(S.playerVol, 0, 100) / 100);

    /* Dithering Analógico 24-bit TPDF bajo demanda (solo corre cuando se reproduce audio) */
    N.ditherGain = g(1);
    N.ditherBuf = createNativeTpdf24Buffer(ctx);
    N.ditherSrc = null;
    ditherReady = true;
    {
      const curCtx = ctx;
      loadStudioWavBuffer(curCtx, '/audio-data/dither-tpdf-24bit-32f.wav').then((wavBuf) => {
        if (!wavBuf || gen !== engineGen || ctx !== curCtx) return;
        N.ditherBuf = wavBuf;
        if (FX_CONN.dither && N.ditherGain) {
          try {
            const nextSrc = curCtx.createBufferSource();
            nextSrc.buffer = wavBuf;
            nextSrc.loop = true;
            nextSrc.connect(N.ditherGain);
            nextSrc.start();
            try {
              N.ditherSrc?.stop();
              N.ditherSrc?.disconnect();
            } catch (_e2) {}
            N.ditherSrc = nextSrc;
          } catch (_e3) {}
        }
      });
    }

    /* Cableado modular del Estudio Principal */
    chain(N.deckSum, N.pre, N.eqTrim);
    N.eqTrim.connect(N.hpDry);
    N.hpDry.connect(N.hpSum);
    chain(N.hp, N.hpWet, N.hpSum);

    N.hpSum.connect(N.lpDry);
    N.lpDry.connect(N.lpSum);
    chain(N.lp, N.lpWet, N.lpSum);

    N.lpSum.connect(N.toneDry);
    N.toneDry.connect(N.s1Out);
    chain(N.dc, N.bass, N.treb, N.vSub, N.vRes, N.toneWet, N.s1Out);

    N.s1Out.connect(N.eq30Dry);
    N.eq30Dry.connect(N.s2Out);
    chain(...N.eq, N.eq30Wet, N.s2Out);

    N.s2Out.connect(N.cl16Dry);
    N.cl16Dry.connect(N.s3Out);
    chain(...N.cl, N.cl16Wet, N.s3Out);

    N.s3Out.connect(N.instDry);
    N.instDry.connect(N.xIn);
    chain(...instArr, N.instWet, N.xIn);

    N.xIn.connect(N.xSum);
    chain(N.xLp, N.xSh, N.xHp, N.xWet, N.xSum);

    /* Etapa Trémolo + Vibrato */
    N.xSum.connect(N.trem);
    N.trem.connect(N.vibDry);
    N.vibDry.connect(N.vOut);
    chain(N.vib, N.vibWet, N.vOut);

    /* Etapa Saturación + Excitador de Aire */
    N.vOut.connect(N.satDry);
    N.satDry.connect(N.satSum);
    chain(N.shaper, N.satDc, N.satWet, N.satSum);
    chain(N.airHp, N.airSh, N.airClean, N.airWet, N.satSum);

    /* Etapa De-Esser Vocal Dinámico */
    N.satSum.connect(N.deDry);
    N.deDry.connect(N.deOut);
    N.deLow.connect(N.deWet);
    chain(N.deHigh, N.deComp, N.deWet);
    N.deWet.connect(N.deOut);

    /* Etapa Compresor Multibanda (3 bandas) */
    N.deOut.connect(N.mbDry);
    N.mbDry.connect(N.mbOut);
    chain(N.mbLp1, N.mbLowC, N.mbLowG, N.mbWet);
    chain(N.mbHp1, N.mbLp2, N.mbMidC, N.mbMidG, N.mbWet);
    chain(N.mbHp2, N.mbHighC, N.mbHighG, N.mbWet);
    N.mbWet.connect(N.mbOut);

    /* Etapa Compresor Maestro (con bypass limpio cuando está apagado) */
    N.mbOut.connect(N.compDry);
    N.compDry.connect(N.compOut);
    chain(N.comp, N.makeup, N.compWet, N.compOut);

    /* Etapa Matriz M/S (con bypass limpio cuando está apagado) */
    N.compOut.connect(N.widDry);
    N.widDry.connect(N.widOut);
    N.split.connect(N.mid, 0);
    N.split.connect(N.mid, 1);
    N.split.connect(N.sL, 0);
    N.split.connect(N.sR, 1);
    N.sL.connect(N.sw);
    N.sR.connect(N.sw);
    N.sw.connect(N.inv);
    N.mid.connect(N.merge, 0, 0);
    N.sw.connect(N.merge, 0, 0);
    N.mid.connect(N.merge, 0, 1);
    N.inv.connect(N.merge, 0, 1);
    N.merge.connect(N.widWet);
    N.widWet.connect(N.widOut);

    /* Etapa Centrador de Subgraves (Bass Mono Maker) */
    N.widOut.connect(N.bmDry);
    N.bmDry.connect(N.bmOut);
    N.bmSplit.connect(N.bmSL, 0);
    N.bmSplit.connect(N.bmSR, 1);
    N.bmSL.connect(N.bmLp);
    N.bmSR.connect(N.bmLp);
    N.bmLp.connect(N.bmNegL);
    N.bmLp.connect(N.bmPosR);
    N.bmNegL.connect(N.bmMerge, 0, 0);
    N.bmPosR.connect(N.bmMerge, 0, 1);
    N.bmMerge.connect(N.bmOut);

    /* Conexión Crossfeed Binaural */
    N.bmOut.connect(N.xfDry);
    N.xfDry.connect(N.xfOut);
    N.xfSplit.connect(N.xfDL, 0);
    N.xfDL.connect(N.xfLpL);
    N.xfLpL.connect(N.xfGL);
    N.xfGL.connect(N.xfMerge, 0, 1);
    N.xfSplit.connect(N.xfDR, 1);
    N.xfDR.connect(N.xfLpR);
    N.xfLpR.connect(N.xfGR);
    N.xfGR.connect(N.xfMerge, 0, 0);
    N.xfMerge.connect(N.xfOut);

    N.xfOut.connect(N.spDry);
    N.spDry.connect(N.bus);
    chain(N.pan, N.spWet, N.bus);
    N.bus.connect(N.busDry);
    N.busDry.connect(N.fxSum);
    chain(N.preD, N.conv, N.revWet, N.fxSum);
    chain(N.dly, N.dTone, N.dWet, N.fxSum);
    N.dTone.connect(N.fb);
    N.fb.connect(N.dly);
    chain(N.fxSum, N.wet, N.master, N.clipSafe, N.studioBus);
    N.deckSum.connect(N.direct);
    N.direct.connect(N.studioBus);

    /* ========== CABLEADO POST-MASTER DE LA CONSOLA FINAL INDEPENDIENTE ==========
       Recibe N.studioBus (toda la mezcla ya procesada por el resto de la interfaz) y aplica sus ajustes al final */
    N.studioBus.connect(N.conBypass);
    N.conBypass.connect(N.conFinalOut);

    // 1) EQ 10 Bandas + Tono Dual
    N.conIn.connect(N.conDry);
    N.conDry.connect(N.conOut);
    chain(N.conPre, ...N.conBands, N.conBassShelf, N.conBassPeak, N.conTrebShelf, N.conTrebPeak, N.conWet, N.conOut);

    // 2) Compresor 6 Perillas LR4 (se cablea bajo demanda Full-Band o Split LR4 en applyAllNow)
    N.conOut.connect(N.conCompDry);
    N.conCompDry.connect(N.conCompOut);
    chain(N.conCompLp1, N.conCompLp2);
    chain(N.conCompHp1, N.conCompHp2, N.conCompWet);
    chain(N.conComp, N.conCompGain, N.conCompWet, N.conCompOut);

    // 3) Expansión Estéreo M/S de Consola
    N.conCompOut.connect(N.conWidDry);
    N.conWidDry.connect(N.conWidOut);
    N.conSplit.connect(N.conMid, 0);
    N.conSplit.connect(N.conMid, 1);
    N.conSplit.connect(N.conSL, 0);
    N.conSplit.connect(N.conSR, 1);
    N.conSL.connect(N.conSideGain);
    N.conSR.connect(N.conSideGain);
    N.conSideGain.connect(N.conSideInv);
    N.conMid.connect(N.conMerge, 0, 0);
    N.conSideGain.connect(N.conMerge, 0, 0);
    N.conMid.connect(N.conMerge, 0, 1);
    N.conSideInv.connect(N.conMerge, 0, 1);
    N.conMerge.connect(N.conWidWet);
    N.conWidWet.connect(N.conWidOut);

    // 4) Balance Estéreo + Limitador de Consola + Volumen de Consola
    N.conWidOut.connect(N.balDry);
    N.balDry.connect(N.balOut);
    if (N.balPan) {
      chain(N.balPan, N.balWet, N.balOut);
    }
    chain(N.balOut, N.conLim, N.conVolGain, N.conFinalOut);

    /* Salida directa hacia el DAC; analizador desconectado cuando no es visible */
    chain(N.conFinalOut, N.pvol, ctx.destination);
  }

  /* Automatización limpia en tiempo real de AudioParam sin congelamientos ni saltos al arrastrar */
  function TP(key: string, p: AudioParam, v: number) {
    if (!ctx || !isFinite(v)) return;
    const prev = P_CACHE[key];
    if (prev !== undefined && Math.abs(prev - v) < 1e-5 && Math.abs(p.value - v) < 1e-3) return;
    P_CACHE[key] = v;
    const now = ctx.currentTime;
    if (ctx.state !== 'running') {
      try {
        p.cancelScheduledValues(0);
      } catch (_e) {}
      try {
        p.value = v;
        p.setValueAtTime(v, now);
      } catch (_e) {
        try {
          p.value = v;
        } catch (_e2) {}
      }
      return;
    }
    try {
      const anyP = p as any;
      if (typeof anyP.cancelAndHoldAtTime === 'function') {
        anyP.cancelAndHoldAtTime(now);
      } else {
        const cur = p.value;
        p.cancelScheduledValues(now);
        p.setValueAtTime(cur, now);
      }
      p.setTargetAtTime(v, now, 0.0045);
    } catch (_e) {
      try {
        p.cancelScheduledValues(0);
        p.value = v;
      } catch (_e2) {}
    }
  }

  /* Curvas analógicas de 8,192 muestras Float32 (0 = Cinta cálida, 1 = Válvula Triodo, 2 = Consola Punch) */
  function curve(d: number, mode = 0) {
    const n = 8192;
    const c = new Float32Array(n);
    const k = 1 + d * 0.25;
    if (mode === 1) {
      const asym = 0.16 * Math.min(1, d / 40);
      const posRef = Math.tanh(k * (1 + asym));
      const negRef = Math.tanh(k * (-1 + asym));
      const norm = Math.max(Math.abs(posRef), Math.abs(negRef)) || 1;
      const dcOff = Math.tanh(k * asym);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        c[i] = clamp((Math.tanh(k * (x + asym)) - dcOff) / norm, -1, 1);
      }
      return c;
    }
    if (mode === 2) {
      const p = 2.35;
      const nr = 1 / Math.pow(1 + Math.pow(k, p), 1 / p);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        const y = (k * x) / Math.pow(1 + Math.pow(Math.abs(k * x), p), 1 / p);
        c[i] = clamp(y / (k * nr || 1), -1, 1);
      }
      return c;
    }
    const nr = Math.tanh(k) || 1;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1;
      c[i] = Math.tanh(k * x) / nr;
    }
    return c;
  }

  /* Convolución Acústica HD: Reflexiones Tempranas estéreo + Difusión decorrelacionada + Absorción de aire */
  function makeIR(dec: number, damp: number, size: number) {
    const sr = ctx!.sampleRate;
    const safeDec = sr > 96000 ? Math.min(3.2, Math.max(0.1, dec)) : Math.max(0.1, dec);
    const len = Math.max(128, Math.floor(sr * safeDec));
    const b = ctx!.createBuffer(2, len, sr);
    const sz = clamp(size, 0, 100) / 100;
    const dm = clamp(damp, 0, 100) / 100;
    const baseA = 1 - dm * 0.88;
    const ex = 3.1 - sz * 1.75;
    const att = Math.floor(sr * (0.003 + sz * 0.008));
    const earlyTaps = [
      [0.007, 0.011, 0.52],
      [0.014, 0.017, -0.41],
      [0.021, 0.019, 0.35],
      [0.028, 0.031, -0.29],
      [0.036, 0.041, 0.24],
      [0.047, 0.052, -0.19],
    ];
    const hpCoef = Math.exp((-2 * Math.PI * 65) / sr);

    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp1 = 0;
      let lp2 = 0;
      let hpPrevX = 0;
      let hpPrevY = 0;
      let seed = c === 0 ? 0x13579bdf : 0x2468ace1;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const wn = (seed / 2147483648) - 1;
        const prog = i / len;
        const airA = clamp(baseA * (1 - prog * dm * 0.55), 0.03, 0.99);
        lp1 += airA * (wn - lp1);
        lp2 += clamp(airA * 1.15, 0.05, 1) * (lp1 - lp2);
        const env = Math.pow(1 - prog, ex) * (i < att ? 0.22 + (0.78 * i) / Math.max(1, att) : 1);
        const x = lp2 * env;
        const y = hpCoef * (hpPrevY + x - hpPrevX);
        hpPrevX = x;
        hpPrevY = y;
        d[i] = y;
      }
      const roomScale = 0.55 + sz * 0.95;
      for (const [tL, tR, amp] of earlyTaps) {
        const idx = Math.floor((c === 0 ? tL : tR) * roomScale * sr);
        if (idx > 0 && idx < len) d[idx] += amp * (1 - dm * 0.35);
      }
      let e = 0;
      for (let i = 0; i < len; i++) e += d[i] * d[i];
      const sc = 1 / Math.sqrt(e || 1);
      for (let i = 0; i < len; i++) d[i] *= sc;
    }
    return b;
  }

  function calcEffectiveQ(baseQ: number, gainDb: number, prop: boolean) {
    if (!prop) return baseQ;
    const gAbs = Math.abs(gainDb);
    if (gAbs < 0.05) return baseQ;
    return clamp(baseQ * (0.68 + 0.52 * Math.min(1, gAbs / 12)), 0.3, 24);
  }

  let applyTimer: any = 0;
  let lastApplyMs = 0;
  let globalSyncTimer: any = 0;
  let updateGlobalStatusUi: (() => void) | null = null;
  let drawConCurveFn: (() => void) | null = null;

  function syncAnalyserConnection() {
    if (!ctx || !N.pvol || !N.an) return;
    const playingNow = !!(audio && !audio.paused);
    const wantAn = !!(
      playingNow &&
      ((isUiAwake() && S.con.vizOn !== false) || S.fx.hap.on)
    );
    if (wantAn !== FX_CONN.an) {
      FX_CONN.an = wantAn;
      safeConn(N.pvol, N.an, wantAn);
    }
  }

  function syncDitherConnection() {
    if (!ctx || !ditherReady || !N.ditherGain) return;
    const playingNow = !!(audio && !audio.paused);
    const wantDither = !!(
      playingNow &&
      S.jack.hiRes &&
      S.jack.dither24 &&
      (!NATIVE || jackHw.jackConnected)
    );
    if (wantDither !== FX_CONN.dither) {
      FX_CONN.dither = wantDither;
      if (wantDither) {
        if (!N.ditherSrc && N.ditherBuf) {
          try {
            const src = ctx.createBufferSource();
            src.buffer = N.ditherBuf;
            src.loop = true;
            src.connect(N.ditherGain);
            src.start();
            N.ditherSrc = src;
          } catch (_e) {}
        }
        safeConn(N.ditherGain, ctx.destination, true);
      } else {
        safeConn(N.ditherGain, ctx.destination, false);
        if (N.ditherSrc) {
          try {
            N.ditherSrc.stop();
            N.ditherSrc.disconnect();
          } catch (_e) {}
          N.ditherSrc = null;
        }
      }
      updateEngineSpecUi();
      paintJackStatus();
    }
    syncAnalyserConnection();
  }

  const globalStudioFreqs30 = Float32Array.from(BANDS30);
  const globalStudioMag30 = new Float32Array(30);

  /* Evaluación matemática exacta RBJ Biquad IEEE 64-bit sobre cualquier malla de frecuencias:
     funciona en 0.0 ms tanto para WebAudio como cuando ctx es null (ej. Audio Global o vista previa). */
  function mulBiquadMagGrid(
    mag: Float32Array,
    freqs: Float32Array,
    type: 'peaking' | 'lowshelf' | 'highshelf' | 'highpass' | 'lowpass',
    f0Raw: number,
    gainDb: number,
    qRaw: number,
    fs: number
  ) {
    const f0 = safeFreq(f0Raw, fs);
    const w0 = (2 * Math.PI * f0) / fs;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    let b0 = 1,
      b1 = 0,
      b2 = 0,
      a0 = 1,
      a1 = 0,
      a2 = 0;

    if (type === 'peaking') {
      if (Math.abs(gainDb) < 0.01) return;
      const A = Math.pow(10, gainDb / 40);
      const q = decrampQ(f0Raw, qRaw, fs);
      const alpha = sinw0 / (2 * Math.max(0.15, q));
      b0 = 1 + alpha * A;
      b1 = -2 * cosw0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosw0;
      a2 = 1 - alpha / A;
    } else if (type === 'lowshelf') {
      if (Math.abs(gainDb) < 0.01) return;
      const A = Math.pow(10, gainDb / 40);
      const alpha = (sinw0 / 2) * Math.sqrt(2);
      const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cosw0 + twoSqrtAAlpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
      b2 = A * (A + 1 - (A - 1) * cosw0 - twoSqrtAAlpha);
      a0 = A + 1 + (A - 1) * cosw0 + twoSqrtAAlpha;
      a1 = -2 * (A - 1 + (A + 1) * cosw0);
      a2 = A + 1 + (A - 1) * cosw0 - twoSqrtAAlpha;
    } else if (type === 'highshelf') {
      if (Math.abs(gainDb) < 0.01) return;
      const A = Math.pow(10, gainDb / 40);
      const alpha = (sinw0 / 2) * Math.sqrt(2);
      const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cosw0 + twoSqrtAAlpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
      b2 = A * (A + 1 + (A - 1) * cosw0 - twoSqrtAAlpha);
      a0 = A + 1 - (A - 1) * cosw0 + twoSqrtAAlpha;
      a1 = 2 * (A - 1 - (A + 1) * cosw0);
      a2 = A + 1 - (A - 1) * cosw0 - twoSqrtAAlpha;
    } else if (type === 'highpass') {
      const alpha = sinw0 / (2 * Math.SQRT1_2);
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    } else if (type === 'lowpass') {
      const alpha = sinw0 / (2 * Math.SQRT1_2);
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
    }

    const nb0 = b0 / a0,
      nb1 = b1 / a0,
      nb2 = b2 / a0,
      na1 = a1 / a0,
      na2 = a2 / a0;

    const len = freqs.length;
    for (let i = 0; i < len; i++) {
      const phi = (2 * Math.PI * freqs[i]) / fs;
      const c1 = Math.cos(phi);
      const s1 = Math.sin(phi);
      const c2 = Math.cos(2 * phi);
      const s2 = Math.sin(2 * phi);
      const nr = nb0 + nb1 * c1 + nb2 * c2;
      const ni = -(nb1 * s1 + nb2 * s2);
      const dr = 1 + na1 * c1 + na2 * c2;
      const di = -(na1 * s1 + na2 * s2);
      const den = Math.max(1e-12, dr * dr + di * di);
      mag[i] *= Math.sqrt((nr * nr + ni * ni) / den);
    }
  }

  function evalStudioChainMag(mag: Float32Array, freqs: Float32Array, fs: number) {
    mag.fill(1);
    if (S.bypass) return;
    if (S.fx.tone.lc > 20.5) {
      mulBiquadMagGrid(mag, freqs, 'highpass', S.fx.tone.lc, 0, Math.SQRT1_2, fs);
    }
    if (S.fx.tone.hc < 19950) {
      mulBiquadMagGrid(mag, freqs, 'lowpass', S.fx.tone.hc, 0, Math.SQRT1_2, fs);
    }
    for (let k = 0; k < 30; k++) {
      const gv = +S.eq[k] || 0;
      if (Math.abs(gv) > 0.01) {
        mulBiquadMagGrid(mag, freqs, 'peaking', BANDS30[k], gv, calcEffectiveQ(S.q30, gv, !!S.propQ30), fs);
      }
    }
    for (let k = 0; k < 16; k++) {
      const gv = +S.cl[k] || 0;
      if (Math.abs(gv) > 0.01) {
        mulBiquadMagGrid(mag, freqs, 'peaking', BANDS16[k], gv, calcEffectiveQ(S.q16, gv, !!S.propQ16), fs);
      }
    }
    for (const id in S.inst) {
      const p = S.inst[id];
      if (p && Math.abs(+p.g || 0) > 0.01) {
        mulBiquadMagGrid(mag, freqs, 'peaking', +p.f || 1000, +p.g || 0, +p.q || 1.2, fs);
      }
    }
    if (Math.abs(+S.fx.tone.bass || 0) > 0.01) {
      mulBiquadMagGrid(mag, freqs, 'lowshelf', +S.fx.tone.bassF || 100, +S.fx.tone.bass || 0, 0.707, fs);
    }
    if (Math.abs(+S.fx.tone.treb || 0) > 0.01) {
      mulBiquadMagGrid(mag, freqs, 'highshelf', +S.fx.tone.trebF || 8000, +S.fx.tone.treb || 0, 0.707, fs);
    }
    if (S.fx.sub.on && Math.abs(+S.fx.sub.g || 0) > 0.01) {
      mulBiquadMagGrid(mag, freqs, 'peaking', +S.fx.sub.freq || 50, +S.fx.sub.g || 0, +S.fx.sub.q || 1.2, fs);
    }
    if (S.fx.glass.on && Math.abs(+S.fx.glass.g || 0) > 0.01) {
      mulBiquadMagGrid(mag, freqs, 'peaking', +S.fx.glass.freq || 90, +S.fx.glass.g || 0, +S.fx.glass.q || 6, fs);
    }
    // Integración tonal equivalente en tiempo real de los procesadores armónicos y dinámicos del Estudio hacia Consola / Global
    if (S.fx.harm.on && (+S.fx.harm.mix || 0) > 0) {
      const hmDb = ((+S.fx.harm.mix || 0) / 100) * (1.8 + ((+S.fx.harm.drive || 0) / 100) * 4.2);
      mulBiquadMagGrid(mag, freqs, 'peaking', clamp((+S.fx.harm.freq || 120) * 0.85, 45, 220), hmDb, 1.15, fs);
    }
    if (S.fx.sat.on && (+S.fx.sat.mix || 0) > 0) {
      const satDb = ((+S.fx.sat.mix || 0) / 100) * (0.8 + ((+S.fx.sat.drive || 0) / 100) * 2.8);
      mulBiquadMagGrid(mag, freqs, 'peaking', 180, satDb * 0.65, 0.9, fs);
      mulBiquadMagGrid(mag, freqs, 'peaking', 2800, satDb, 0.85, fs);
    }
    if (S.fx.airexc.on && (+S.fx.airexc.mix || 0) > 0) {
      const airDb = ((+S.fx.airexc.mix || 0) / 100) * (1.6 + ((+S.fx.airexc.drive || 0) / 100) * 4.8);
      mulBiquadMagGrid(mag, freqs, 'highshelf', clamp(+S.fx.airexc.freq || 9500, 5000, 15000), airDb, 0.707, fs);
    }
    if (S.fx.deess.on && (+S.fx.deess.amt || 0) > 0) {
      const deCut = -Math.min(8, (+S.fx.deess.amt || 0) * 0.55);
      mulBiquadMagGrid(mag, freqs, 'peaking', clamp(+S.fx.deess.freq || 6800, 3500, 12000), deCut, 2.4, fs);
    }
    if (S.fx.mbcomp.on) {
      if (Math.abs(+S.fx.mbcomp.lowG || 0) > 0.05) {
        mulBiquadMagGrid(mag, freqs, 'lowshelf', clamp(+S.fx.mbcomp.lowX || 160, 50, 500), +S.fx.mbcomp.lowG, 0.707, fs);
      }
      if (Math.abs(+S.fx.mbcomp.midG || 0) > 0.05) {
        mulBiquadMagGrid(mag, freqs, 'peaking', 950, +S.fx.mbcomp.midG, 0.8, fs);
      }
      if (Math.abs(+S.fx.mbcomp.highG || 0) > 0.05) {
        mulBiquadMagGrid(mag, freqs, 'highshelf', clamp(+S.fx.mbcomp.highX || 3200, 1200, 10000), +S.fx.mbcomp.highG, 0.707, fs);
      }
    }
  }

  function computeStudioBands30ForGlobal(): number[] {
    if (S.bypass) return Array(30).fill(0);
    const fs = (ctx && ctx.sampleRate) || 48000;
    evalStudioChainMag(globalStudioMag30, globalStudioFreqs30, fs);
    const preMasterDb = (+S.master.pre || 0) + (+S.master.vol || 0);
    const out = new Array<number>(30);
    for (let i = 0; i < 30; i++) {
      out[i] = clamp(r1(20 * Math.log10(Math.max(globalStudioMag30[i], 1e-4)) + preMasterDb * 0.5), -24, 24);
    }
    return out;
  }

  function buildNativeGlobalDspPayload(): string {
    const cn = S.con;
    const conOn = cn.enabled !== false;
    const paramOn = !!cn.paramMode;
    const effFreqs = BANDS10.map((f, i) =>
      paramOn && Array.isArray(cn.bandFreqs) && isFinite(+cn.bandFreqs[i]) ? clamp(+cn.bandFreqs[i], 20, 20000) : f
    );
    const effQs = BANDS10.map((_, i) =>
      paramOn && Array.isArray(cn.bandQs) && isFinite(+cn.bandQs[i])
        ? clamp(+cn.bandQs[i], 0.25, 10)
        : clamp(+cn.bandQGlobal || 1.41, 0.4, 4.5)
    );
    const studioWidDelta = !S.bypass && S.fx.wid.on ? +S.fx.wid.w || 0 : 0;
    const combinedWidth = clamp((isFinite(+cn.stereoWidth) ? +cn.stereoWidth : 100) + studioWidDelta, 0, 200);
    const studioCompActive = !S.bypass && !!S.fx.comp.on;
    const mergedCompOn = (conOn && !!cn.compOn) || studioCompActive;
    return JSON.stringify({
      globalEnabled: conOn && !!cn.globalEq,
      consoleEnabled: conOn,
      systemWideMix: conOn && !!cn.sysWideMixExp,
      legacyHalMode: !!cn.legacyHal,
      includeStudioInGlobal: !S.bypass,
      dvcEnabled: cn.dvc !== false,
      noDvcGainDb: isFinite(+cn.noDvcGain) ? +cn.noDvcGain : -3.0,
      advancedTracking: conOn && !!cn.advTrack,
      eqEnabled: conOn && !!cn.eqOn,
      toneEnabled: conOn && cn.toneOn !== false,
      limiterEnabled: conOn && cn.limOn !== false,
      compEnabled: mergedCompOn,
      preampDb: conOn ? +cn.pre || 0 : 0,
      bands: conOn && Array.isArray(cn.bands) ? cn.bands : Array(10).fill(0),
      bandFreqs: effFreqs,
      bandQs: effQs,
      studioBands30: !S.bypass ? computeStudioBands30ForGlobal() : Array(30).fill(0),
      bassPct: conOn ? +cn.bass || 0 : 0,
      treblePct: conOn ? +cn.treb || 0 : 0,
      bassFreqHz: +cn.bassFreq || 90,
      bassQ: +cn.bassQ || 0.75,
      trebleFreqHz: +cn.trebFreq || 10000,
      trebleQ: +cn.trebQ || 0.75,
      stereoWidthPct: conOn ? combinedWidth : clamp(100 + studioWidDelta, 0, 200),
      compAttackMs: conOn && cn.compOn ? +cn.attack || 2.5 : +S.fx.comp.attack || 3.0,
      compReleaseMs: conOn && cn.compOn ? +cn.release || 17.0 : +S.fx.comp.release || 250.0,
      compRatio: conOn && cn.compOn ? +cn.ratio || 8.7 : Math.max(1.5, +S.fx.comp.ratio || 3.0),
      compFreqHz: conOn && cn.compOn ? +cn.freq || 20000 : 20000,
      compThresholdDb: conOn && cn.compOn ? (isFinite(+cn.thresh) ? +cn.thresh : -50.0) : +S.fx.comp.th || -18.0,
      compGainDb: (conOn && cn.compOn ? +cn.gain || 0 : 0) + (studioCompActive ? +S.fx.comp.makeup || 0 : 0),
      masterCeilDb: +S.master.ceil || -0.1,
    });
  }

  function flushNativeGlobalDspNow() {
    clearTimeout(globalSyncTimer);
    if (!NATIVE || !window.AndroidBridge?.syncGlobalDsp) return;
    try {
      window.AndroidBridge.syncGlobalDsp(buildNativeGlobalDspPayload());
      if (updateGlobalStatusUi) updateGlobalStatusUi();
    } catch (_e) {}
  }

  function scheduleNativeGlobalDspSync() {
    if (!NATIVE || !window.AndroidBridge?.syncGlobalDsp) return;
    clearTimeout(globalSyncTimer);
    globalSyncTimer = setTimeout(() => {
      flushNativeGlobalDspNow();
    }, 18);
  }

  function applyAllNow() {
    applyTimer = 0;
    lastApplyMs = performance.now();
    scheduleNativeGlobalDspSync();
    vizDirty = true;
    if (drawConCurveFn && curTab === 'con') drawConCurveFn();
    if (!ctx) return;
    const fs = ctx.sampleRate || 48000;
    TP('pre', N.pre.gain, dB(S.master.pre));
    TP('mvol', N.master.gain, dB(S.master.vol));
    TP('pvol', N.pvol.gain, clamp(S.playerVol, 0, 100) / 100);
    TP('wet', N.wet.gain, S.bypass ? 0 : 1);
    TP('dir', N.direct.gain, S.bypass ? 1 : 0);

    /* Velocidad / Tono / Modo 432 Hz (por defecto 1.0× bit-perfect) */
    const baseRate = clamp(isFinite(+S.play.rate) ? +S.play.rate : 1, 0.5, 1.5);
    const effRate = S.play.hz432 ? baseRate * (432 / 440) : baseRate;
    const keepP = S.play.hz432 ? false : !!S.play.keepPitch;
    [deckA, deckB].forEach((el) => {
      if (!el) return;
      if ((el as any).preservesPitch !== keepP) {
        (el as any).preservesPitch = keepP;
        (el as any).webkitPreservesPitch = keepP;
      }
      if (Math.abs(el.playbackRate - effRate) > 1e-4) {
        el.playbackRate = effRate;
      }
    });

    /* Techo Brickwall True-Peak del Estudio Principal */
    const ceilDb = clamp(isFinite(+S.master.ceil) ? +S.master.ceil : -0.1, -6, -0.1);
    if (Math.abs(ceilDb - ceilSig) > 0.02) {
      ceilSig = ceilDb;
      N.clipSafe.curve = makeCeilingCurve(ceilDb);
    }

    syncDitherConnection();

    /* ========== ETAPA FINAL INDEPENDIENTE: CONSOLA MASTER (POST-ESTUDIO) ========== */
    const cn = S.con;
    const conMasterOn = cn.enabled !== false;
    if (conMasterOn !== FX_CONN.conMaster) {
      FX_CONN.conMaster = conMasterOn;
      safeConn(N.studioBus, N.conIn, conMasterOn);
    }
    TP('conbyp', N.conBypass.gain, conMasterOn ? 0 : 1);
    TP('convol', N.conVolGain.gain, conMasterOn ? clamp(isFinite(+cn.conVol) ? +cn.conVol : 100, 0, 100) / 100 : 1);

    const conLimActive = conMasterOn && cn.limOn !== false;
    const targetConLimSig = conLimActive ? -0.12 : -999;
    if (Math.abs(targetConLimSig - conLimSig) > 0.02) {
      conLimSig = targetConLimSig;
      N.conLim.curve = conLimActive ? makeCeilingCurve(-0.12) : null;
    }

    const toneActiveCon = conMasterOn && cn.toneOn !== false;
    const conBassDb = toneActiveCon ? (clamp(+cn.bass || 0, 0, 100) / 100) * 12 : 0;
    const conTrebDb = toneActiveCon ? (clamp(+cn.treb || 0, 0, 100) / 100) * 12 : 0;
    const bFreq = clamp(+cn.bassFreq || 90, 20, 250);
    const bQ = clamp(+cn.bassQ || 0.75, 0.25, 2.5);
    const tFreq = clamp(+cn.trebFreq || 10000, 2000, 16000);
    const tQ = clamp(+cn.trebQ || 0.75, 0.25, 2.5);

    let conHasBands = false;
    let conMaxBoost = Math.max(0, cn.eqOn ? +cn.pre || 0 : 0, conBassDb, conTrebDb);
    const paramOn = !!cn.paramMode;
    const globalBandQ = clamp(+cn.bandQGlobal || 1.41, 0.4, 4.5);
    for (let i = 0; i < 10; i++) {
      const bv = clamp(isFinite(+cn.bands[i]) ? +cn.bands[i] : 0, -15, 15);
      const bf =
        paramOn && Array.isArray(cn.bandFreqs) && isFinite(+cn.bandFreqs[i])
          ? clamp(+cn.bandFreqs[i], 20, 20000)
          : BANDS10[i];
      const bqVal =
        paramOn && Array.isArray(cn.bandQs) && isFinite(+cn.bandQs[i])
          ? clamp(+cn.bandQs[i], 0.25, 10)
          : globalBandQ;
      if (Math.abs(bv) >= 0.01) conHasBands = true;
      if (cn.eqOn && bv > conMaxBoost) conMaxBoost = bv;
      TP('conb' + i, N.conBands[i].gain, conMasterOn && cn.eqOn ? bv : 0);
      TP('conf' + i, N.conBands[i].frequency, safeFreq(bf, fs));
      TP('conq' + i, N.conBands[i].Q, decrampQ(bf, bqVal, fs));
    }

    const dvcHeadroomCon = !conMasterOn
      ? 0
      : cn.dvc !== false
        ? conMaxBoost > 3
          ? -Math.min(9.5, (conMaxBoost - 3) * 0.40)
          : 0
        : clamp(isFinite(+cn.noDvcGain) ? +cn.noDvcGain : -3, -12, 0);

    const preDbTotal = (conMasterOn && cn.eqOn ? clamp(+cn.pre || 0, -15, 15) : 0) + dvcHeadroomCon;
    const conEqActive =
      conMasterOn &&
      ((cn.eqOn && (Math.abs(preDbTotal) >= 0.01 || conHasBands)) ||
        Math.abs(dvcHeadroomCon) >= 0.01 ||
        conBassDb >= 0.04 ||
        conTrebDb >= 0.04);
    if (conEqActive !== FX_CONN.conEq) {
      FX_CONN.conEq = conEqActive;
      safeConn(N.conIn, N.conPre, conEqActive);
    }
    TP('condry', N.conDry.gain, conEqActive ? 0 : 1);
    TP('conwet', N.conWet.gain, conEqActive ? 1 : 0);
    TP('conpre', N.conPre.gain, dB(preDbTotal));
    TP('conbsf', N.conBassShelf.frequency, safeFreq(bFreq, fs));
    TP('conbsg', N.conBassShelf.gain, conBassDb * 0.72);
    TP('conbpf', N.conBassPeak.frequency, safeFreq(bFreq, fs));
    TP('conbpq', N.conBassPeak.Q, decrampQ(bFreq, bQ, fs));
    TP('conbpg', N.conBassPeak.gain, conBassDb * 0.36);
    TP('contsf', N.conTrebShelf.frequency, safeFreq(tFreq, fs));
    TP('contsg', N.conTrebShelf.gain, conTrebDb * 0.72);
    TP('contpf', N.conTrebPeak.frequency, safeFreq(tFreq, fs));
    TP('contpq', N.conTrebPeak.Q, decrampQ(tFreq, tQ, fs));
    TP('contpg', N.conTrebPeak.gain, conTrebDb * 0.36);

    /* Compresor Rotativo de 6 Perillas LR4 en Fase Exacta + Ganancia Calibrada sin distorsión */
    const conCompActive = conMasterOn && !!cn.compOn;
    const cFreq = clamp(+cn.freq || 20000, 20, 20000);
    const wantSplit = conCompActive && cFreq < 19800;
    const wantFull = conCompActive && !wantSplit;
    if (wantFull !== FX_CONN.conCompFull || wantSplit !== FX_CONN.conCompSplit) {
      FX_CONN.conCompFull = wantFull;
      FX_CONN.conCompSplit = wantSplit;
      safeConn(N.conOut, N.conComp, wantFull);
      safeConn(N.conOut, N.conCompLp1, wantSplit);
      safeConn(N.conCompLp2, N.conComp, wantSplit);
      safeConn(N.conOut, N.conCompHp1, wantSplit);
    }
    TP('ccdry', N.conCompDry.gain, conCompActive ? 0 : 1);
    TP('ccwet', N.conCompWet.gain, conCompActive ? 1 : 0);
    if (conCompActive) {
      if (wantSplit) {
        const safeSplit = safeFreq(cFreq, fs);
        TP('cclp1', N.conCompLp1.frequency, safeSplit);
        TP('cclp2', N.conCompLp2.frequency, safeSplit);
        TP('cchp1', N.conCompHp1.frequency, safeSplit);
        TP('cchp2', N.conCompHp2.frequency, safeSplit);
      }
      const cTh = clamp(isFinite(+cn.thresh) ? +cn.thresh : -50, -90, 0);
      const cRa = clamp(+cn.ratio || 8.7, 1, 20);
      const desiredGain = clamp(isFinite(+cn.gain) ? +cn.gain : 0, -10, 45);
      // Descuenta la ganancia automática estática que WebAudio DynamicsCompressor inyecta cuando el umbral es muy bajo
      const webAudioAutoMakeupDb = Math.max(0, -cTh * (1 - 1 / cRa) * 0.54);
      const calibratedMakeupDb = clamp(desiredGain - webAudioAutoMakeupDb * 0.64, -18, 22);
      TP('ccth', N.conComp.threshold, cTh);
      TP('ccra', N.conComp.ratio, cRa);
      TP('ccat', N.conComp.attack, clamp((+cn.attack || 2.5) / 1000, 0.0001, 0.5));
      TP('ccre', N.conComp.release, clamp((+cn.release || 17) / 1000, 0.001, 1.5));
      TP('ccmk', N.conCompGain.gain, dB(calibratedMakeupDb));
    }

    /* Expansión Estéreo M/S de Consola (100% = neutro bit-perfect) */
    const stWidth = isFinite(+cn.stereoWidth) ? clamp(+cn.stereoWidth, 0, 200) : 100;
    const conWidActive = conMasterOn && Math.abs(stWidth - 100) >= 1;
    if (conWidActive !== FX_CONN.conWid) {
      FX_CONN.conWid = conWidActive;
      safeConn(N.conCompOut, N.conSplit, conWidActive);
    }
    TP('cwid_dry', N.conWidDry.gain, conWidActive ? 0 : 1);
    TP('cwid_wet', N.conWidWet.gain, conWidActive ? 1 : 0);
    if (conWidActive) {
      TP('cwid_side', N.conSideGain.gain, clamp(stWidth / 100, 0, 2.2));
    }

    /* Balance Estéreo L/R de Consola (-1.00 a +1.00) */
    const balVal = clamp(+cn.balance || 0, -1, 1);
    const balActive = !!(conMasterOn && N.balPan && Math.abs(balVal) >= 0.005);
    if (balActive !== FX_CONN.bal && N.balPan) {
      FX_CONN.bal = balActive;
      safeConn(N.conWidOut, N.balPan, balActive);
    }
    TP('baldry', N.balDry.gain, balActive ? 0 : 1);
    TP('balwet', N.balWet.gain, balActive ? 1 : 0);
    if (balActive && N.balPan) {
      TP('balpan', N.balPan.pan, balVal);
    }

    /* Filtros de corte Pasa-Altos y Pasa-Bajos del Estudio Principal con bypass real cuando están en reposo */
    const t = S.fx.tone;
    const hpActive = t.lc > 20.5;
    if (hpActive !== FX_CONN.hp) {
      FX_CONN.hp = hpActive;
      safeConn(N.eqTrim, N.hp, hpActive);
    }
    TP('hpdry', N.hpDry.gain, hpActive ? 0 : 1);
    TP('hpwet', N.hpWet.gain, hpActive ? 1 : 0);
    if (hpActive) TP('lc', N.hp.frequency, safeFreq(t.lc, fs));

    const lpActive = t.hc < 19950;
    if (lpActive !== FX_CONN.lp) {
      FX_CONN.lp = lpActive;
      safeConn(N.hpSum, N.lp, lpActive);
    }
    TP('lpdry', N.lpDry.gain, lpActive ? 0 : 1);
    TP('lpwet', N.lpWet.gain, lpActive ? 1 : 0);
    if (lpActive) TP('hc', N.lp.frequency, safeFreq(t.hc, fs));

    /* Etapa Tono + Sub + Vidrios del Estudio Principal con bypass de carga cero */
    const sb = S.fx.sub;
    const gl = S.fx.glass;
    const toneActive =
      Math.abs(t.bass) >= 0.01 ||
      Math.abs(t.treb) >= 0.01 ||
      (sb.on && Math.abs(sb.g) >= 0.01) ||
      (gl.on && Math.abs(gl.g) >= 0.01);
    if (toneActive !== FX_CONN.tone) {
      FX_CONN.tone = toneActive;
      safeConn(N.lpSum, N.dc, toneActive);
    }
    TP('tonedry', N.toneDry.gain, toneActive ? 0 : 1);
    TP('tonewet', N.toneWet.gain, toneActive ? 1 : 0);
    TP('bg', N.bass.gain, t.bass);
    TP('bf', N.bass.frequency, safeFreq(t.bassF, fs));
    TP('tg', N.treb.gain, t.treb);
    TP('tf', N.treb.frequency, safeFreq(t.trebF, fs));
    TP('sbg', N.vSub.gain, sb.on ? sb.g : 0);
    TP('sbf', N.vSub.frequency, safeFreq(sb.freq, fs));
    TP('sbq', N.vSub.Q, decrampQ(sb.freq, sb.q, fs));
    TP('glg', N.vRes.gain, gl.on ? gl.g : 0);
    TP('glf', N.vRes.frequency, safeFreq(gl.freq, fs));
    TP('glq', N.vRes.Q, decrampQ(gl.freq, gl.q, fs));

    /* Banco EQ 30 con compensación Nyquist y bypass cuando está plano */
    let maxBoost = Math.max(0, t.bass, t.treb, sb.on ? sb.g : 0);
    let eq30Active = false;
    for (let i = 0; i < 30; i++) {
      const gv = S.eq[i];
      if (Math.abs(gv) >= 0.01) eq30Active = true;
      if (gv > maxBoost) maxBoost = gv;
      TP('eqf' + i, N.eq[i].frequency, safeFreq(BANDS30[i], fs));
      TP('eqg' + i, N.eq[i].gain, gv);
      TP('eqq' + i, N.eq[i].Q, decrampQ(BANDS30[i], calcEffectiveQ(S.q30, gv, !!S.propQ30), fs));
    }
    if (eq30Active !== FX_CONN.eq30) {
      FX_CONN.eq30 = eq30Active;
      safeConn(N.s1Out, N.eq[0], eq30Active);
    }
    TP('eq30dry', N.eq30Dry.gain, eq30Active ? 0 : 1);
    TP('eq30wet', N.eq30Wet.gain, eq30Active ? 1 : 0);

    /* Banco Claridad 16 con compensación Nyquist y bypass cuando está plano */
    let cl16Active = false;
    for (let i = 0; i < 16; i++) {
      const gv = S.cl[i];
      if (Math.abs(gv) >= 0.01) cl16Active = true;
      if (gv > maxBoost) maxBoost = gv;
      TP('clf' + i, N.cl[i].frequency, safeFreq(BANDS16[i], fs));
      TP('clg' + i, N.cl[i].gain, gv);
      TP('clq' + i, N.cl[i].Q, decrampQ(BANDS16[i], calcEffectiveQ(S.q16, gv, !!S.propQ16), fs));
    }
    if (cl16Active !== FX_CONN.cl16) {
      FX_CONN.cl16 = cl16Active;
      safeConn(N.s2Out, N.cl[0], cl16Active);
    }
    TP('cl16dry', N.cl16Dry.gain, cl16Active ? 0 : 1);
    TP('cl16wet', N.cl16Wet.gain, cl16Active ? 1 : 0);

    /* Banco Instrumentos con compensación Nyquist y bypass cuando está plano */
    let instActive = false;
    let firstInst: BiquadFilterNode | null = null;
    for (const id in N.inst) {
      const p = S.inst[id];
      const n = N.inst[id] as BiquadFilterNode;
      if (!firstInst) firstInst = n;
      if (Math.abs(p.g) >= 0.01) instActive = true;
      if (p.g > maxBoost) maxBoost = p.g;
      TP('ig_' + id, n.gain, p.g);
      TP('if_' + id, n.frequency, safeFreq(p.f, fs));
      TP('iq_' + id, n.Q, decrampQ(p.f, p.q, fs));
    }
    if (firstInst && instActive !== FX_CONN.inst) {
      FX_CONN.inst = instActive;
      safeConn(N.s3Out, firstInst, instActive);
    }
    TP('instdry', N.instDry.gain, instActive ? 0 : 1);
    TP('instwet', N.instWet.gain, instActive ? 1 : 0);

    /* Auto-Headroom propio del Estudio Principal (el DVC de Consola actúa independientemente en la etapa final) */
    const autoTrim = S.master.autoHead && maxBoost > 1.5 ? -Math.min(12, (maxBoost - 1.5) * 0.55) : 0;
    TP('eqtrim', N.eqTrim.gain, dB(autoTrim));

    /* Compresor Maestro con desconexión real cuando está apagado (0 coloración) */
    const c = S.fx.comp;
    const compActive = !!c.on;
    if (compActive !== FX_CONN.comp) {
      FX_CONN.comp = compActive;
      safeConn(N.mbOut, N.comp, compActive);
    }
    TP('compdry', N.compDry.gain, compActive ? 0 : 1);
    TP('compwet', N.compWet.gain, compActive ? 1 : 0);
    if (compActive) {
      TP('cth', N.comp.threshold, c.th);
      TP('ckn', N.comp.knee, c.knee);
      TP('cra', N.comp.ratio, c.ratio);
      TP('cat', N.comp.attack, c.attack / 1000);
      TP('cre', N.comp.release, c.release / 1000);
      TP('cmk', N.makeup.gain, dB(c.makeup));
    }

    /* Compresor Multibanda (Graves / Medios / Agudos) con bypass bit-perfect */
    const mb = S.fx.mbcomp;
    const mbActive = !!mb.on;
    if (mbActive !== FX_CONN.mbcomp) {
      FX_CONN.mbcomp = mbActive;
      safeConn(N.deOut, N.mbLp1, mbActive);
      safeConn(N.deOut, N.mbHp1, mbActive);
      safeConn(N.deOut, N.mbHp2, mbActive);
    }
    TP('mbdry', N.mbDry.gain, mbActive ? 0 : 1);
    TP('mbwet', N.mbWet.gain, mbActive ? 1 : 0);
    if (mbActive) {
      const lx = clamp(mb.lowX, 50, 500);
      const hx = clamp(mb.highX, 1200, 10000);
      TP('mblp1', N.mbLp1.frequency, lx);
      TP('mbhp1', N.mbHp1.frequency, lx);
      TP('mblp2', N.mbLp2.frequency, hx);
      TP('mbhp2', N.mbHp2.frequency, hx);
      TP('mblth', N.mbLowC.threshold, mb.lowTh);
      TP('mbmth', N.mbMidC.threshold, mb.midTh);
      TP('mbhth', N.mbHighC.threshold, mb.highTh);
      TP('mblra', N.mbLowC.ratio, mb.ratio);
      TP('mbmra', N.mbMidC.ratio, mb.ratio);
      TP('mbhra', N.mbHighC.ratio, mb.ratio);
      TP('mblg', N.mbLowG.gain, dB(mb.lowG));
      TP('mbmg', N.mbMidG.gain, dB(mb.midG));
      TP('mbhg', N.mbHighG.gain, dB(mb.highG));
    }

    /* De-Esser Vocal Dinámico */
    const de = S.fx.deess;
    const deActive = !!(de.on && de.amt > 0);
    if (deActive !== FX_CONN.deess) {
      FX_CONN.deess = deActive;
      safeConn(N.satSum, N.deLow, deActive);
      safeConn(N.satSum, N.deHigh, deActive);
    }
    TP('dedry', N.deDry.gain, deActive ? 0 : 1);
    TP('dewet', N.deWet.gain, deActive ? 1 : 0);
    if (deActive) {
      const df = clamp(de.freq, 3500, 12000);
      TP('delow', N.deLow.frequency, df);
      TP('dehigh', N.deHigh.frequency, df);
      TP('deth', N.deComp.threshold, de.th);
      TP('dera', N.deComp.ratio, clamp(1 + de.amt * 1.4, 1.5, 20));
    }

    /* Saturación analógica */
    const s = S.fx.sat;
    const satActive = !!(s.on && s.mix > 0);
    if (satActive !== FX_CONN.sat) {
      FX_CONN.sat = satActive;
      safeConn(N.vOut, N.shaper, satActive);
    }
    const nextSatSig = s.drive + '|' + (s.mode | 0);
    if (satActive && nextSatSig !== satSig) {
      satSig = nextSatSig;
      N.shaper.curve = curve(s.drive, s.mode | 0);
    }
    const sm = satActive ? s.mix / 100 : 0;
    TP('swet', N.satWet.gain, sm);
    TP('sdry', N.satDry.gain, 1 - sm);

    /* Excitador de Aire Armónico (10–20 kHz) */
    const ax = S.fx.airexc;
    const airActive = !!(ax.on && ax.mix > 0);
    if (airActive !== FX_CONN.airexc) {
      FX_CONN.airexc = airActive;
      safeConn(N.vOut, N.airHp, airActive);
    }
    if (airActive && ax.drive !== airDriveSig) {
      airDriveSig = ax.drive;
      N.airSh.curve = curve(ax.drive * 0.75, 1);
    }
    TP('airhp', N.airHp.frequency, safeFreq(clamp(ax.freq, 5000, 15000), fs));
    TP('aircl', N.airClean.frequency, safeFreq(clamp(ax.freq * 0.65, 3500, 11000), fs));
    TP('airw', N.airWet.gain, airActive ? (ax.mix / 100) * 0.65 : 0);

    /* Armónicos de subgraves */
    const hm = S.fx.harm;
    const harmActive = !!(hm.on && hm.mix > 0);
    if (harmActive !== FX_CONN.harm) {
      FX_CONN.harm = harmActive;
      safeConn(N.xIn, N.xLp, harmActive);
    }
    if (harmActive && hm.drive !== harmDrive) {
      harmDrive = hm.drive;
      N.xSh.curve = curve(hm.drive * 0.65, 1);
    }
    TP('xlp', N.xLp.frequency, hm.freq);
    TP('xwet', N.xWet.gain, harmActive ? hm.mix / 100 : 0);

    /* Trémolo y Vibrato con creación/apagado real de LFOs en reposo (0% CPU cuando están apagados) */
    const tr = S.fx.trem;
    const trActive = !!(tr.on && tr.depth > 0);
    if (trActive !== FX_CONN.trem) {
      FX_CONN.trem = trActive;
      if (trActive) {
        if (!N.tLfo) {
          const osc = ctx.createOscillator();
          osc.connect(N.tG);
          osc.start();
          N.tLfo = osc;
        }
        safeConn(N.tG, N.trem.gain, true);
      } else {
        safeConn(N.tG, N.trem.gain, false);
        if (N.tLfo) {
          try {
            N.tLfo.stop();
            N.tLfo.disconnect();
          } catch (_e) {}
          N.tLfo = null;
          delete P_CACHE.trf;
        }
      }
    }
    if (trActive && N.tLfo) {
      const tShape = (['sine', 'triangle', 'square'][tr.shape] || 'sine') as OscillatorType;
      if (N.tLfo.type !== tShape) N.tLfo.type = tShape;
      TP('trf', N.tLfo.frequency, tr.rate);
    }
    const td = trActive ? tr.depth / 100 : 0;
    TP('trg', N.trem.gain, 1 - td / 2);
    TP('trd', N.tG.gain, td / 2);

    const vb = S.fx.vibr;
    const vbActive = !!(vb.on && vb.depth > 0);
    if (vbActive !== FX_CONN.vibr) {
      FX_CONN.vibr = vbActive;
      if (vbActive) {
        if (!N.vLfo) {
          const osc = ctx.createOscillator();
          osc.connect(N.vG);
          osc.start();
          N.vLfo = osc;
        }
        safeConn(N.trem, N.vib, true);
        safeConn(N.vG, N.vib.delayTime, true);
      } else {
        safeConn(N.trem, N.vib, false);
        safeConn(N.vG, N.vib.delayTime, false);
        if (N.vLfo) {
          try {
            N.vLfo.stop();
            N.vLfo.disconnect();
          } catch (_e) {}
          N.vLfo = null;
          delete P_CACHE.vbf;
        }
      }
    }
    TP('vibdry', N.vibDry.gain, vbActive ? 0 : 1);
    TP('vibwet', N.vibWet.gain, vbActive ? 1 : 0);
    if (vbActive && N.vLfo) {
      TP('vbf', N.vLfo.frequency, vb.rate);
      TP('vbg', N.vG.gain, vb.depth / 1000);
    } else {
      TP('vbg', N.vG.gain, 0);
    }

    /* Matriz Ancho Estéreo M/S con bypass limpio cuando está apagado o en 0% */
    const w = S.fx.wid;
    const widActive = !!(w.on && Math.abs(w.w) >= 0.5);
    if (widActive !== FX_CONN.wid) {
      FX_CONN.wid = widActive;
      safeConn(N.compOut, N.split, widActive);
    }
    TP('widdry', N.widDry.gain, widActive ? 0 : 1);
    TP('widwet', N.widWet.gain, widActive ? 1 : 0);
    if (widActive) {
      TP('wid', N.sw.gain, clamp(1 + w.w / 100, 0, 3));
    }

    /* Centrador Elíptico de Subgraves (Bass Mono Maker) */
    const bm = S.fx.bmono;
    const bmActive = !!(bm.on && bm.mono > 0);
    if (bmActive !== FX_CONN.bmono) {
      FX_CONN.bmono = bmActive;
      safeConn(N.widOut, N.bmSplit, bmActive);
    }
    const bmK = bmActive ? clamp(bm.mono, 0, 100) / 100 : 0;
    TP('bmlp', N.bmLp.frequency, clamp(bm.freq, 35, 220));
    TP('bmnegl', N.bmNegL.gain, -bmK);
    TP('bmposr', N.bmPosR.gain, bmK);

    /* Crossfeed Binaural de Audífonos */
    const xf = S.fx.xfeed;
    const xfActive = !!(xf.on && xf.mix > 0);
    if (xfActive !== FX_CONN.xfeed) {
      FX_CONN.xfeed = xfActive;
      safeConn(N.bmOut, N.xfSplit, xfActive);
    }
    const xfAmt = xfActive ? (xf.mix / 100) * 0.42 : 0;
    TP('xfdry', N.xfDry.gain, xfActive ? 1 - xfAmt * 0.42 : 1);
    TP('xfgl', N.xfGL.gain, xfAmt);
    TP('xfgr', N.xfGR.gain, xfAmt);
    TP('xflpl', N.xfLpL.frequency, xf.fc);
    TP('xflpr', N.xfLpR.frequency, xf.fc);

    const sp = S.fx.sp;
    const spActive = !!(sp.on && sp.mix > 0);
    if (spActive !== FX_CONN.sp) {
      FX_CONN.sp = spActive;
      safeConn(N.xfOut, N.pan, spActive);
    }
    const spm = spActive ? sp.mix / 100 : 0;
    TP('spw', N.spWet.gain, spm);
    TP('spd', N.spDry.gain, 1 - spm);

    const r = S.fx.rev;
    const revActive = !!(r.on && r.mix > 0);
    if (revActive !== FX_CONN.rev) {
      FX_CONN.rev = revActive;
      safeConn(N.bus, N.preD, revActive);
    }
    TP('rvw', N.revWet.gain, revActive ? (r.mix / 100) * 1.5 : 0);
    TP('rvp', N.preD.delayTime, r.pre / 1000);
    if (revActive) {
      const irMode = r.irMode | 0;
      const wavSpec = STUDIO_WAV_IRS[irMode];
      if (wavSpec) {
        const key = 'wav|' + irMode + '|' + fs;
        if (key !== irKey) {
          irKey = key;
          clearTimeout(irT);
          const cached = wavBufferCache[fs + '|' + wavSpec.file];
          if (cached) {
            N.conv.buffer = cached;
          } else {
            if (!N.conv.buffer) N.conv.buffer = makeIR(1.6, 30, 55);
            const curCtx = ctx;
            loadStudioWavBuffer(curCtx, wavSpec.file).then((buf) => {
              if (buf && ctx === curCtx && (S.fx.rev.irMode | 0) === irMode) {
                N.conv.buffer = buf;
              }
            });
          }
        }
      } else {
        const key = 'param|' + r.decay + '|' + r.damp + '|' + r.size;
        if (key !== irKey) {
          const first = !irKey;
          irKey = key;
          clearTimeout(irT);
          irT = setTimeout(() => {
            const q = S.fx.rev;
            if (ctx && !(q.irMode | 0)) N.conv.buffer = makeIR(q.decay, q.damp, q.size);
          }, first ? 0 : 180);
        }
      }
    }

    const d = S.fx.dly;
    const dlyActive = !!(d.on && d.mix > 0);
    if (dlyActive !== FX_CONN.dly) {
      FX_CONN.dly = dlyActive;
      safeConn(N.bus, N.dly, dlyActive);
    }
    TP('dlt', N.dly.delayTime, d.time / 1000);
    TP('dlfb', N.fb.gain, dlyActive ? d.fb / 100 : 0);
    TP('dlw', N.dWet.gain, dlyActive ? d.mix / 100 : 0);
    TP('dltn', N.dTone.frequency, safeFreq(d.tone, fs));

    scheduleNativeGlobalDspSync();
    if (drawConCurveFn && curTab === 'con') drawConCurveFn();
  }

  function applyAll(immediate = false) {
    if (!ctx) {
      scheduleNativeGlobalDspSync();
      vizDirty = true;
      if (drawConCurveFn && curTab === 'con') drawConCurveFn();
      return;
    }
    if (immediate) {
      if (applyTimer) {
        clearTimeout(applyTimer);
        applyTimer = 0;
      }
      applyAllNow();
      return;
    }
    if (applyTimer) return;
    const elapsed = performance.now() - lastApplyMs;
    const wait = Math.max(0, 8 - elapsed);
    applyTimer = setTimeout(applyAllNow, wait);
  }

  let spAz = 0;
  let lastPanX = NaN;
  let lastPanY = NaN;
  let lastPanZ = NaN;
  function placePan(dt: number) {
    if (!ctx || !FX_CONN.sp) return;
    const sp = S.fx.sp;
    if (sp.on && sp.rot) spAz = (spAz + sp.rot * 6 * dt + 360) % 360;
    else spAz = sp.az;
    const a = (spAz * Math.PI) / 180;
    const e = (sp.el * Math.PI) / 180;
    const d = Math.max(0.1, sp.dist);
    const x = Math.sin(a) * Math.cos(e) * d;
    const y = Math.sin(e) * d;
    const z = -Math.cos(a) * Math.cos(e) * d;
    if (Math.abs(x - lastPanX) < 1e-4 && Math.abs(y - lastPanY) < 1e-4 && Math.abs(z - lastPanZ) < 1e-4) return;
    lastPanX = x;
    lastPanY = y;
    lastPanZ = z;
    const p = N.pan;
    if (p.positionX) {
      p.positionX.value = x;
      p.positionY.value = y;
      p.positionZ.value = z;
    } else p.setPosition(x, y, z);
  }

  /* ---------- estado → interfaz ---------- */
  const syncers: Array<() => void> = [];
  function syncAll() {
    syncers.forEach((f) => f());
    paintBypass();
    updateHeaderProUi();
    if (IS_PRO_EDITION) applyCertifiedDomTranslation(rootEl, currentLang);
    vizDirty = true;
  }
  function commit() {
    if (S.bypass && curTab !== 'con' && curTab !== 'music') {
      S.bypass = false;
      paintBypass();
    }
    vizDirty = true;
    calcResp();
    applyAll(false);
    if (drawConCurveFn && curTab === 'con') drawConCurveFn();
    saveSoon();
  }
  const getP = (p: string) => p.split('.').reduce((o, k) => o[k], S);
  const getD = (p: string) => p.split('.').reduce((o, k) => o[k], D);
  function setP(p: string, v: any) {
    const ks = p.split('.');
    const l = ks.pop()!;
    ks.reduce((o, k) => o[k], S)[l] = v;
  }
  const decs = (st: number) => {
    const s = String(st);
    return s.includes('.') ? s.split('.')[1].length : 0;
  };
  function holdBtn(btn: HTMLElement, fn: () => void) {
    let t: any;
    let iv: any;
    const stop = () => {
      clearTimeout(t);
      clearInterval(iv);
      persistNow();
    };
    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button > 0) return;
      e.preventDefault();
      fn();
      t = setTimeout(() => {
        iv = setInterval(fn, 70);
      }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('click', (e: MouseEvent) => {
      if (e.detail === 0) {
        fn();
        persistNow();
      }
    });
  }
  function row(path: string, label: string, o: any) {
    const dec = decs(o.step);
    const fine = o.fine || o.step;
    const num = h('input', {
      type: 'number',
      class: 'num in',
      id: 'n_' + path,
      step: o.step,
      min: o.min,
      max: o.max,
      inputmode: 'decimal',
      'aria-label': label,
    }) as HTMLInputElement;
    const rng = h('input', {
      type: 'range',
      id: 'r_' + path,
      'aria-label': label + ' (deslizador)',
      min: o.log ? 0 : o.min,
      max: o.log ? 1000 : o.max,
      step: o.log ? 1 : o.step,
    }) as HTMLInputElement;
    const toS = (v: number) => (o.log ? Math.round((1000 * Math.log(v / o.min)) / Math.log(o.max / o.min)) : v);
    const fromS = (s: string | number) => {
      if (!o.log) return +s;
      const v = o.min * Math.pow(o.max / o.min, +s / 1000);
      return o.step >= 1 ? Math.round(v) : +v.toFixed(dec);
    };
    const updPct = (el: HTMLInputElement) => {
      const mn = +el.min || 0;
      const mx = +el.max || 1;
      const pct = clamp(((+el.value - mn) / (mx - mn || 1)) * 100, 0, 100);
      el.style.setProperty('--p', pct.toFixed(1) + '%');
    };
    const show = () => {
      const v = getP(path);
      num.value = v.toFixed(dec);
      rng.value = String(toS(v));
      updPct(rng);
    };
    const set = (raw: string | number, flush: boolean) => {
      let v = clamp(+raw, o.min, o.max);
      if (!isFinite(v)) return show();
      v = +(Math.round(v / o.step) * o.step).toFixed(dec);
      if (getP(path) === v) {
        if (flush) persistNow();
        return;
      }
      setP(path, v);
      show();
      commit();
      if (flush) persistNow();
    };
    num.addEventListener('change', () => set(num.value, true));
    rng.addEventListener('input', () => set(fromS(rng.value), false));
    rng.addEventListener('change', () => persistNow());
    const minus = h('button', { class: 'step', 'aria-label': 'Restar ' + label, type: 'button', text: '−' });
    const plus = h('button', { class: 'step', 'aria-label': 'Sumar ' + label, type: 'button', text: '+' });
    holdBtn(minus, () => set(getP(path) - fine, false));
    holdBtn(plus, () => set(getP(path) + fine, false));
    const rst = h('button', {
      class: 'rst',
      'aria-label': 'Volver ' + label + ' a su valor inicial',
      type: 'button',
      text: '↺',
      onclick: () => set(getD(path), true),
    });
    syncers.push(show);
    show();
    return h(
      'div',
      { class: 'prow' },
      h(
        'div',
        { class: 'ptop' },
        h('label', { class: 'pl', for: 'n_' + path, text: label }),
        h('span', { class: 'pv' }, num, h('span', { class: 'u', text: o.unit || '' }))
      ),
      h('div', { class: 'pctl' }, minus, rng, plus, rst)
    );
  }

  const ICON_LOCK = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/></svg>';

  function card(key: string, title: string, opt: { on?: boolean } = {}) {
    const c = h('div', { class: 'card' });
    const body = h('div', { class: 'cbody' }) as HTMLElement & { inert?: boolean };
    const head = h('div', { class: 'chead' }, h('h2', { text: title }));
    let sw: HTMLElement | null = null;
    if (opt.on) {
      sw = h(
        'button',
        {
          class: 'sw',
          role: 'switch',
          type: 'button',
          'aria-label': 'Activar ' + title,
          onclick: () => {
            const proOnlyFx = ['mbcomp', 'deess', 'sat', 'airexc', 'hap'];
            if (!S.fx[key].on && proOnlyFx.includes(key) && !requireProAccess()) return;
            const turningOn = !S.fx[key].on;
            S.fx[key].on = turningOn;
            if (turningOn) {
              // Al prender un módulo de Efectos cuyos controles estaban aún en reposo neutro (0),
              // activa un punto musical audible inmediato para mezclarse en tiempo real con la Consola.
              const fxObj = S.fx[key];
              if (key === 'comp' && fxObj.th === 0 && fxObj.ratio <= 1.05 && fxObj.makeup === 0) {
                fxObj.th = -18;
                fxObj.ratio = 3.2;
                fxObj.makeup = 2.5;
              } else if (key === 'sat' && fxObj.mix === 0) {
                if (fxObj.drive === 0) fxObj.drive = 28;
                fxObj.mix = 35;
              } else if (key === 'airexc' && fxObj.mix === 0) {
                if (fxObj.drive === 0) fxObj.drive = 30;
                fxObj.mix = 36;
              } else if (key === 'wid' && Math.abs(fxObj.w) < 0.5) {
                fxObj.w = 35;
              } else if (key === 'rev' && fxObj.mix === 0) {
                fxObj.mix = 22;
              } else if (key === 'dly' && fxObj.mix === 0) {
                if (fxObj.fb === 0) fxObj.fb = 26;
                fxObj.mix = 20;
              } else if (key === 'sp' && fxObj.mix === 0) {
                fxObj.mix = 45;
              } else if (key === 'sub' && Math.abs(fxObj.g) < 0.05) {
                fxObj.g = 4.5;
              } else if (key === 'glass' && Math.abs(fxObj.g) < 0.05) {
                fxObj.g = 4.0;
              } else if (key === 'harm' && fxObj.mix === 0) {
                if (fxObj.drive === 0) fxObj.drive = 30;
                fxObj.mix = 30;
              } else if (key === 'trem' && fxObj.depth === 0) {
                fxObj.depth = 38;
              } else if (key === 'vibr' && fxObj.depth === 0) {
                fxObj.depth = 0.65;
              }
            }
            syncAll();
            commit();
            persistNow();
          },
        },
        h('i')
      );
      head.append(sw);
    }
    const lock = h('button', {
      class: 'ib',
      type: 'button',
      onclick: () => {
        S.locks[key] = !S.locks[key];
        if (!S.locks[key]) delete S.locks[key];
        syncAll();
        persistNow();
        toast(S.locks[key] ? title + ' bloqueado' : title + ' desbloqueado');
      },
    });
    const save = h('button', {
      class: 'ib',
      type: 'button',
      'aria-label': 'Guardar ajuste de ' + title,
      text: 'Guardar',
      onclick: () => saveSection(key),
    });
    const rs = h('button', {
      class: 'ib',
      type: 'button',
      'aria-label': 'Poner ' + title + ' en cero',
      text: 'Cero',
      onclick: () => {
        resetSec(key);
        syncAll();
        commit();
        persistNow();
        toast(title + ' en cero');
      },
    });
    head.append(h('div', { class: 'cacts' }, lock, save, rs));
    c.append(head, body);
    syncers.push(() => {
      const l = !!S.locks[key];
      c.classList.toggle('locked', l);
      body.inert = l;
      lock.setAttribute('aria-pressed', String(l));
      lock.setAttribute('aria-label', (l ? 'Desbloquear ' : 'Bloquear ') + title);
      lock.innerHTML = (l ? ICON_LOCK : ICON_OPEN) + '<span>' + (l ? 'Bloqueado' : 'Libre') + '</span>';
      if (sw) sw.setAttribute('aria-checked', String(!!S.fx[key].on));
    });
    return { c, body, head };
  }

  /* ---------- analizador espectral HD 4096 ---------- */
  const cv = $<HTMLCanvasElement>('#viz')!;
  const c2 = cv.getContext('2d')!;
  const VIZ_N = 180;
  const FF = Float32Array.from({ length: VIZ_N }, (_, i) => 20 * Math.pow(1000, i / (VIZ_N - 1)));
  const respMag = new Float32Array(VIZ_N);
  const respTmp = new Float32Array(VIZ_N);
  const respPh = new Float32Array(VIZ_N);
  let resp: Float32Array | null = null;
  let accC = '#22F3FF';
  let fgC = '#EDEBF5';
  let numFont = 'ui-monospace,monospace';
  let freqData: Uint8Array<ArrayBuffer> | null = null;
  let vizW = 0;
  let vizH = 0;
  let lastVizDraw = 0;
  let lastRespCalc = 0;

  let vizDpr = 1;
  function syncVizSize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    vizDpr = Math.min(window.devicePixelRatio || 1, NATIVE ? 1.5 : 2);
    vizW = Math.round(r.width * vizDpr);
    vizH = Math.round(r.height * vizDpr);
    if (vizW > 0 && vizH > 0 && (cv.width !== vizW || cv.height !== vizH)) {
      cv.width = vizW;
      cv.height = vizH;
      vizDirty = true;
    }
  }
  if (typeof ResizeObserver !== 'undefined' && cv) {
    new ResizeObserver(() => syncVizSize()).observe(cv);
  }
  window.addEventListener('resize', syncVizSize, { passive: true });

  const conOnlyMag = new Float32Array(VIZ_N);
  let studioResp: Float32Array | null = null;
  let conResp: Float32Array | null = null;

  function calcResp() {
    const fs = (ctx && ctx.sampleRate) || 48000;
    evalStudioChainMag(respMag, FF, fs);
    if (!studioResp) studioResp = new Float32Array(VIZ_N);
    for (let i = 0; i < VIZ_N; i++) studioResp[i] = 20 * Math.log10(Math.max(respMag[i], 1e-4));

    conOnlyMag.fill(1);
    const cn = S.con;
    if (cn.enabled !== false) {
      if (cn.eqOn && Array.isArray(cn.bands)) {
        const paramOn = !!cn.paramMode;
        const globalBandQ = clamp(+cn.bandQGlobal || 1.41, 0.4, 4.5);
        for (let k = 0; k < 10; k++) {
          const bv = +cn.bands[k] || 0;
          if (Math.abs(bv) > 0.01) {
            const bf =
              paramOn && Array.isArray(cn.bandFreqs) && isFinite(+cn.bandFreqs[k])
                ? clamp(+cn.bandFreqs[k], 20, 20000)
                : BANDS10[k];
            const bq =
              paramOn && Array.isArray(cn.bandQs) && isFinite(+cn.bandQs[k])
                ? clamp(+cn.bandQs[k], 0.25, 10)
                : globalBandQ;
            mulBiquadMagGrid(conOnlyMag, FF, 'peaking', bf, bv, bq, fs);
          }
        }
      }
      if (cn.toneOn !== false && (+cn.bass || 0) > 0.2) {
        const bDb = (clamp(+cn.bass || 0, 0, 100) / 100) * 12;
        const bFreq = clamp(+cn.bassFreq || 90, 20, 250);
        const bQ = clamp(+cn.bassQ || 0.75, 0.25, 2.5);
        mulBiquadMagGrid(conOnlyMag, FF, 'lowshelf', bFreq, bDb * 0.72, 0.707, fs);
        mulBiquadMagGrid(conOnlyMag, FF, 'peaking', bFreq, bDb * 0.36, bQ, fs);
      }
      if (cn.toneOn !== false && (+cn.treb || 0) > 0.2) {
        const tDb = (clamp(+cn.treb || 0, 0, 100) / 100) * 12;
        const tFreq = clamp(+cn.trebFreq || 10000, 2000, 16000);
        const tQ = clamp(+cn.trebQ || 0.75, 0.25, 2.5);
        mulBiquadMagGrid(conOnlyMag, FF, 'highshelf', tFreq, tDb * 0.72, 0.707, fs);
        mulBiquadMagGrid(conOnlyMag, FF, 'peaking', tFreq, tDb * 0.36, tQ, fs);
      }
    }
    if (!conResp) conResp = new Float32Array(VIZ_N);
    if (!resp) resp = new Float32Array(VIZ_N);
    const conPreVisual = cn.enabled !== false && cn.eqOn ? (+cn.pre || 0) * 0.45 : 0;
    for (let i = 0; i < VIZ_N; i++) {
      const cDb = 20 * Math.log10(Math.max(conOnlyMag[i], 1e-4)) + conPreVisual;
      conResp[i] = cDb;
      resp[i] = studioResp[i] + cDb;
    }
    vizDirty = false;
  }

  function sampleSpectrum() {
    if (ctx && N.an && FX_CONN.an && audio && !audio.paused) {
      if (!freqData || freqData.length !== N.an.frequencyBinCount) {
        freqData = new Uint8Array(N.an.frequencyBinCount);
      }
      N.an.getByteFrequencyData(freqData);
    }
  }

  const SILK_NB = 28;
  const silkEnv = new Float32Array(SILK_NB);
  const SILK_PTS = 32;
  const silkTopX = new Float32Array(SILK_PTS);
  const silkTopY = new Float32Array(SILK_PTS);
  const silkBotY = new Float32Array(SILK_PTS);
  const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gradW = 0;
  let silkFillGrads: CanvasGradient[] = [];
  let silkStrokeGrads: CanvasGradient[] = [];

  function ensureSilkGradients(w: number) {
    if (gradW === w && silkFillGrads.length === 3) return;
    gradW = w;
    const mk = (stops: Array<[number, string]>) => {
      const g = c2.createLinearGradient(0, 0, w, 0);
      stops.forEach(([p, col]) => g.addColorStop(p, col));
      return g;
    };
    silkFillGrads = [
      mk([[0, 'rgba(0,229,255,0.22)'], [0.46, 'rgba(157,78,221,0.18)'], [1, 'rgba(255,42,133,0.22)']]),
      mk([[0, 'rgba(56,249,215,0.16)'], [0.5, 'rgba(192,132,252,0.20)'], [1, 'rgba(255,93,162,0.18)']]),
      mk([[0, 'rgba(168,85,247,0.15)'], [0.52, 'rgba(0,229,255,0.14)'], [1, 'rgba(255,117,181,0.18)']]),
    ];
    silkStrokeGrads = [
      mk([[0, '#00F0FF'], [0.48, '#B36BFF'], [1, '#FF4FA3']]),
      mk([[0, '#5CEEFF'], [0.5, '#D896FF'], [1, '#FF75B5']]),
      mk([[0, '#A855F7'], [0.52, '#38F9D7'], [1, '#FF2A85']]),
    ];
  }

  function traceSmooth(xs: Float32Array, ys: Float32Array, n: number, rev: boolean) {
    if (!rev) {
      c2.moveTo(xs[0], ys[0]);
      for (let i = 0; i < n - 1; i++) {
        const mx = (xs[i] + xs[i + 1]) * 0.5;
        const my = (ys[i] + ys[i + 1]) * 0.5;
        c2.quadraticCurveTo(xs[i], ys[i], mx, my);
      }
      c2.lineTo(xs[n - 1], ys[n - 1]);
    } else {
      c2.lineTo(xs[n - 1], ys[n - 1]);
      for (let i = n - 1; i > 0; i--) {
        const mx = (xs[i] + xs[i - 1]) * 0.5;
        const my = (ys[i] + ys[i - 1]) * 0.5;
        c2.quadraticCurveTo(xs[i], ys[i], mx, my);
      }
      c2.lineTo(xs[0], ys[0]);
    }
  }

  function drawSilkWaves(now: number, w: number, hh: number, dpr: number, playing: boolean) {
    ensureSilkGradients(w);
    if (playing && S.con.vizOn !== false && ctx && freqData) {
      const sr = ctx.sampleRate;
      for (let j = 0; j < SILK_NB; j++) {
        const f0 = 22 * Math.pow(860, j / SILK_NB);
        const f1 = 22 * Math.pow(860, (j + 1) / SILK_NB);
        const a = Math.floor((f0 / (sr / 2)) * freqData.length);
        const b = Math.max(a + 1, Math.ceil((f1 / (sr / 2)) * freqData.length));
        let pk = 0;
        for (let k = a; k < b && k < freqData.length; k++) if (freqData[k] > pk) pk = freqData[k];
        const tgt = pk / 255;
        silkEnv[j] += (tgt - silkEnv[j]) * (tgt > silkEnv[j] ? 0.34 : 0.14);
      }
    } else {
      for (let j = 0; j < SILK_NB; j++) silkEnv[j] *= 0.88;
    }

    const t = reduceMotion || !playing || S.con.vizOn === false ? 1.2 : now * 0.00135;
    const cy = hh * 0.52;

    for (let r = 0; r < 3; r++) {
      const ph = t * (0.9 + r * 0.24) + r * 1.85;
      const freq1 = 2.1 + r * 0.55;
      const freq2 = 3.7 - r * 0.4;

      for (let i = 0; i < SILK_PTS; i++) {
        const u = i / (SILK_PTS - 1);
        silkTopX[i] = u * w;

        const bj = u * (SILK_NB - 1);
        const b0 = bj | 0;
        const b1 = Math.min(SILK_NB - 1, b0 + 1);
        const e = silkEnv[b0] + (silkEnv[b1] - silkEnv[b0]) * (bj - b0);

        let eqLift = 0;
        if (resp) {
          const ri = Math.min(VIZ_N - 1, Math.round(u * (VIZ_N - 1)));
          eqLift = clamp(resp[ri] / 18, -0.85, 0.85) * hh * 0.16;
        }

        const env = (0.14 + e * 0.30) * hh;
        const w1 = Math.sin(u * Math.PI * freq1 + ph) * 0.68 + Math.cos(u * Math.PI * freq2 - ph * 0.72) * 0.32;
        const w2 = Math.sin(u * Math.PI * (freq1 + 0.35) + ph + 0.78) * 0.62 + Math.cos(u * Math.PI * (freq2 - 0.25) - ph * 0.64 + 0.5) * 0.38;
        const taper = 0.38 + 0.62 * Math.sin(u * Math.PI);

        silkTopY[i] = cy - eqLift + w1 * env * taper;
        silkBotY[i] = cy - eqLift * 0.82 + w2 * env * taper * 0.86;
      }

      c2.fillStyle = silkFillGrads[r];
      c2.beginPath();
      traceSmooth(silkTopX, silkTopY, SILK_PTS, false);
      traceSmooth(silkTopX, silkBotY, SILK_PTS, true);
      c2.closePath();
      c2.fill();

      c2.strokeStyle = silkStrokeGrads[r];
      for (let s = 0; s <= 2; s++) {
        const k = s / 2;
        const isEdge = s === 0 || s === 2;
        c2.globalAlpha = isEdge ? 0.78 : 0.26;
        c2.lineWidth = (isEdge ? 1.55 : 0.9) * dpr;
        c2.beginPath();
        for (let i = 0; i < SILK_PTS; i++) {
          const y = silkTopY[i] + (silkBotY[i] - silkTopY[i]) * k;
          if (i === 0) c2.moveTo(silkTopX[0], y);
          else {
            const prevY = silkTopY[i - 1] + (silkBotY[i - 1] - silkTopY[i - 1]) * k;
            c2.quadraticCurveTo(silkTopX[i - 1], prevY, (silkTopX[i - 1] + silkTopX[i]) * 0.5, (prevY + y) * 0.5);
          }
        }
        const lastIdx = SILK_PTS - 1;
        c2.lineTo(silkTopX[lastIdx], silkTopY[lastIdx] + (silkBotY[lastIdx] - silkTopY[lastIdx]) * k);
        c2.stroke();
      }
      c2.globalAlpha = 1;
    }
  }

  function drawViz(now: number) {
    if (!isUiAwake()) return;
    if (now < scrollBusyUntil && !vizDirty) return;
    const playing = !!(audio && !audio.paused);
    const vizEnabled = S.con.vizOn !== false;
    const minDt = !playing || !vizEnabled ? (vizDirty ? 40 : 400) : NATIVE ? 42 : 34;
    if (now - lastVizDraw < minDt && !vizDirty) return;
    lastVizDraw = now;
    if (playing && vizEnabled) sampleSpectrum();
    if (!vizW || !vizH) syncVizSize();
    const w = vizW;
    const hh = vizH;
    const dpr = vizDpr;
    if (!w || !hh) return;
    c2.clearRect(0, 0, w, hh);

    if (vizDirty && (now - lastRespCalc > 32 || !playing)) {
      lastRespCalc = now;
      calcResp();
      if (drawConCurveFn && curTab === 'con') drawConCurveFn();
    }

    drawSilkWaves(now, w, hh, dpr, playing && vizEnabled);

    /* En EQ 30 y Claridad 16 superponemos la curva dB de precisión de estudio */
    if (curTab !== 'eq30' && curTab !== 'cl16') return;

    const isCl = curTab === 'cl16';
    const strokeCol = isCl ? '#7CFFB8' : '#9AF5FF';
    const barCol = isCl ? '#4DFF9E' : '#5CEEFF';

    c2.strokeStyle = isCl ? 'rgba(130, 255, 195, 0.18)' : 'rgba(185, 235, 255, 0.20)';
    c2.lineWidth = 1;
    c2.beginPath();
    c2.moveTo(0, hh / 2);
    c2.lineTo(w, hh / 2);
    c2.stroke();
    if (ctx && N.an && playing && freqData) {
      const nb = 64;
      const sr = ctx.sampleRate;
      const bw = w / nb;
      c2.fillStyle = barCol;
      c2.globalAlpha = 0.24;
      for (let i = 0; i < nb; i++) {
        const f0 = 20 * Math.pow(1000, i / nb);
        const f1 = 20 * Math.pow(1000, (i + 1) / nb);
        const a = Math.floor((f0 / (sr / 2)) * freqData.length);
        const b = Math.max(a + 1, Math.ceil((f1 / (sr / 2)) * freqData.length));
        let m = 0;
        for (let k = a; k < b && k < freqData.length; k++) if (freqData[k] > m) m = freqData[k];
        const bh = (m / 255) * hh * 0.88;
        c2.fillRect(i * bw + 1, hh - bh, Math.max(1, bw - 2), bh);
      }
      c2.globalAlpha = 1;
    }
    if (!resp) calcResp();
    if (resp) {
      c2.save();
      c2.strokeStyle = strokeCol;
      c2.shadowColor = barCol;
      c2.shadowBlur = 8 * dpr;
      c2.lineWidth = 2 * dpr;
      c2.beginPath();
      for (let i = 0; i < VIZ_N; i++) {
        const x = (i / (VIZ_N - 1)) * w;
        const y = hh / 2 - (clamp(resp[i], -18, 18) / 18) * (hh / 2) * 0.86;
        if (i) c2.lineTo(x, y);
        else c2.moveTo(x, y);
      }
      c2.stroke();
      c2.restore();
    }
    c2.fillStyle = 'rgba(215, 235, 255, 0.78)';
    c2.font = 10 * dpr + 'px ' + numFont;
    (
      [
        ['100', 100],
        ['1k', 1000],
        ['10k', 10000],
      ] as Array<[string, number]>
    ).forEach(([t, f]) => {
      const x = (Math.log(f / 20) / Math.log(1000)) * w;
      c2.fillText(t, x + 3 * dpr, hh - 5 * dpr);
    });
    c2.fillText('+18 dB', 6 * dpr, 13 * dpr);
    c2.fillText('−18', 6 * dpr, hh - 5 * dpr);
  }

  /* ---------- pestañas EQ (30 y 16 bandas con Q Proporcional) ---------- */
  const stripScrollSyncers: Array<() => void> = [];
  function eqTab(cfg: {
    key: string;
    arr: string;
    rk: string;
    qk: string;
    pqk: string;
    freqs: number[];
    names: string[] | null;
    title: string;
    hint: string;
  }) {
    const { c, body } = card(cfg.key, cfg.title);
    const arr = (): number[] => S[cfg.arr];
    const rg = (): number => S[cfg.rk];
    let sel = 0;
    let fineOn = false;
    body.append(h('p', { class: 'hint', text: cfg.hint }));
    const rchips = h('div', { class: 'chips' });
    [6, 12, 24].forEach((r) => {
      const b = h('button', {
        class: 'chip',
        type: 'button',
        text: '±' + r + ' dB',
        onclick: () => {
          if (arr().some((v) => Math.abs(v) > r)) {
            toast('Hay bandas fuera de ±' + r + ' dB');
            return;
          }
          S[cfg.rk] = r;
          syncAll();
          commit();
          persistNow();
        },
      });
      b.dataset.r = String(r);
      rchips.append(b);
    });
    const fineChip = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Precisión ×5',
      'aria-pressed': 'false',
      onclick: () => {
        fineOn = !fineOn;
        fineChip.setAttribute('aria-pressed', String(fineOn));
      },
    });
    const propChip = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Q Proporcional',
      'aria-pressed': String(!!S[cfg.pqk]),
      onclick: () => {
        S[cfg.pqk] = !S[cfg.pqk];
        syncAll();
        commit();
        persistNow();
        toast(S[cfg.pqk] ? 'Q Proporcional analógico activo' : 'Q Constante quirúrgico activo');
      },
    });
    body.append(
      h('div', { class: 'chips' }, rchips.children.length ? [...Array.from(rchips.children)] : [], fineChip, propChip)
    );

    const strip = h('div', { class: 'strip', role: 'group', 'aria-label': cfg.title });
    const panBar = h('input', {
      type: 'range',
      class: 'rfull strip-pan',
      min: 0,
      max: 1000,
      step: 1,
      value: 0,
      'aria-label': 'Recorrer bandas horizontalmente',
    }) as HTMLInputElement;
    panBar.style.setProperty('--p', '0%');
    const panWrap = h(
      'div',
      { class: 'strip-nav' },
      h('span', { class: 'strip-nav-lbl num', text: fmtF(cfg.freqs[0]) + ' Hz' }),
      panBar,
      h('span', { class: 'strip-nav-lbl num', text: fmtF(cfg.freqs[cfg.freqs.length - 1]) + ' Hz' })
    );
    const syncPanBar = () => {
      const maxSc = Math.max(0, strip.scrollWidth - strip.clientWidth);
      panWrap.hidden = maxSc < 8;
      if (maxSc < 8) return;
      const ratio = clamp(strip.scrollLeft / maxSc, 0, 1);
      panBar.value = String(Math.round(ratio * 1000));
      panBar.style.setProperty('--p', (ratio * 100).toFixed(1) + '%');
    };
    panBar.addEventListener('input', () => {
      const maxSc = Math.max(0, strip.scrollWidth - strip.clientWidth);
      const ratio = clamp(+panBar.value / 1000, 0, 1);
      strip.scrollLeft = ratio * maxSc;
      panBar.style.setProperty('--p', (ratio * 100).toFixed(1) + '%');
    });
    strip.addEventListener('scroll', syncPanBar, { passive: true });
    window.addEventListener('resize', syncPanBar, { passive: true });
    stripScrollSyncers.push(syncPanBar);
    body.append(panWrap);

    const cols: HTMLElement[] = [];
    const vals: HTMLElement[] = [];
    const fills: HTMLElement[] = [];
    const thumbs: HTMLElement[] = [];
    const tracks: HTMLElement[] = [];

    function paint(i: number) {
      const v = arr()[i];
      const r = rg();
      const p = ((v / r + 1) / 2) * 100;
      thumbs[i].style.top = 100 - p + '%';
      if (v >= 0) {
        fills[i].style.top = 100 - p + '%';
        fills[i].style.height = p - 50 + '%';
      } else {
        fills[i].style.top = '50%';
        fills[i].style.height = 50 - p + '%';
      }
      vals[i].textContent = (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
      const tr = tracks[i];
      tr.setAttribute('aria-valuenow', String(v));
      tr.setAttribute('aria-valuemin', String(-r));
      tr.setAttribute('aria-valuemax', String(r));
    }
    function paintAll() {
      arr().forEach((_, i) => paint(i));
      cols.forEach((colEl, i) => colEl.classList.toggle('sel', i === sel));
      body.querySelectorAll<HTMLElement>('[data-r]').forEach((b) =>
        b.setAttribute('aria-pressed', String(+(b.dataset.r || 0) === rg()))
      );
      propChip.setAttribute('aria-pressed', String(!!S[cfg.pqk]));
      updFine();
      syncPanBar();
    }
    function setBand(i: number, v: number, flush: boolean) {
      const nv = clamp(r1(v), -rg(), rg());
      if (arr()[i] === nv) {
        if (flush) persistNow();
        return;
      }
      arr()[i] = nv;
      paint(i);
      updFine();
      commit();
      if (flush) persistNow();
    }
    function select(i: number, scroll?: boolean) {
      sel = clamp(i, 0, cfg.freqs.length - 1);
      cols.forEach((colEl, k) => colEl.classList.toggle('sel', k === sel));
      updFine();
      if (scroll) {
        cols[sel].scrollIntoView({ inline: 'center', block: 'nearest' });
        setTimeout(syncPanBar, 40);
      }
    }

    cfg.freqs.forEach((f, i) => {
      const val = h('span', { class: 'bv num' });
      const fill = h('div', { class: 'bfill' });
      const thumb = h('div', { class: 'bthumb' });
      const bin = h('div', { class: 'bin' }, h('div', { class: 'brail' }), h('div', { class: 'bzero' }), fill, thumb);
      const track = h(
        'div',
        {
          class: 'btrack',
          tabindex: '0',
          role: 'slider',
          'aria-label': 'Banda ' + fmtHz(f) + (cfg.names ? ' ' + cfg.names[i] : ''),
          'aria-orientation': 'vertical',
          'aria-valuetext': '',
        },
        bin
      );
      let drag: { y: number; v: number; top: number; h: number; touchId?: number; ptrId?: number } | null = null;
      const fromDragY = (clientY: number) => (1 - clamp((clientY - drag!.top) / drag!.h, 0, 1)) * 2 - 1;
      const beginDrag = (clientY: number, touchId?: number, ptrId?: number) => {
        if (S.locks[cfg.key]) {
          toast(cfg.title + ' está bloqueado');
          return;
        }
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        select(i);
        const rc = bin.getBoundingClientRect();
        const trc = rc.height > 10 ? rc : track.getBoundingClientRect();
        drag = { y: clientY, v: arr()[i], top: trc.top, h: trc.height || 180, touchId, ptrId };
        track.classList.add('dragging');
        if (!fineOn) setBand(i, fromDragY(clientY) * rg(), false);
      };
      const moveDrag = (clientY: number) => {
        if (!drag) return;
        if (fineOn) setBand(i, drag.v + (((drag.y - clientY) / drag.h) * 2 * rg()) / 5, false);
        else setBand(i, fromDragY(clientY) * rg(), false);
      };
      const endDrag = () => {
        if (drag) {
          drag = null;
          track.classList.remove('dragging');
          persistNow();
        }
      };

      track.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          if (!e.changedTouches.length) return;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          const t = e.changedTouches[0];
          beginDrag(t.clientY, t.identifier, undefined);
        },
        { passive: false }
      );
      track.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (!drag || drag.touchId === undefined) return;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          for (let k = 0; k < e.changedTouches.length; k++) {
            if (e.changedTouches[k].identifier === drag.touchId) {
              moveDrag(e.changedTouches[k].clientY);
              break;
            }
          }
        },
        { passive: false }
      );
      track.addEventListener('touchend', (e: TouchEvent) => {
        if (!drag || drag.touchId === undefined) return;
        for (let k = 0; k < e.changedTouches.length; k++) {
          if (e.changedTouches[k].identifier === drag.touchId) {
            endDrag();
            break;
          }
        }
      });
      track.addEventListener('touchcancel', () => {
        if (drag && drag.touchId !== undefined) endDrag();
      });

      const onWinPtrMove = (e: PointerEvent) => {
        if (!drag || drag.ptrId !== e.pointerId) return;
        if (e.cancelable) e.preventDefault();
        moveDrag(e.clientY);
      };
      const onWinPtrUp = (e: PointerEvent) => {
        if (!drag || drag.ptrId !== e.pointerId) return;
        window.removeEventListener('pointermove', onWinPtrMove);
        window.removeEventListener('pointerup', onWinPtrUp);
        window.removeEventListener('pointercancel', onWinPtrUp);
        endDrag();
      };
      track.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.pointerType === 'touch' && 'ontouchstart' in window) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.cancelable) e.preventDefault();
        try {
          track.setPointerCapture(e.pointerId);
        } catch (_err) {}
        beginDrag(e.clientY, undefined, e.pointerId);
        window.addEventListener('pointermove', onWinPtrMove, { passive: false });
        window.addEventListener('pointerup', onWinPtrUp);
        window.addEventListener('pointercancel', onWinPtrUp);
      });

      track.addEventListener('keydown', (e: KeyboardEvent) => {
        const st = e.shiftKey ? 1 : 0.1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          setBand(i, arr()[i] + st, true);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setBand(i, arr()[i] - st, true);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setBand(i, 0, true);
        }
      });
      const col = h(
        'div',
        { class: 'bcol' },
        val,
        track,
        h('span', { class: 'bf num', text: fmtF(f) }),
        cfg.names ? h('span', { class: 'bn', text: cfg.names[i] }) : null
      );
      cols.push(col);
      vals.push(val);
      fills.push(fill);
      thumbs.push(thumb);
      tracks.push(track);
      strip.append(col);
    });
    body.append(strip);

    const fname = h('div', { class: 'fname' });
    const fval = h('div', { class: 'fval num' });
    const prev = h('button', { class: 'btn', type: 'button', 'aria-label': 'Banda anterior', text: '◀', onclick: () => select(sel - 1, true) });
    const next = h('button', { class: 'btn', type: 'button', 'aria-label': 'Banda siguiente', text: '▶', onclick: () => select(sel + 1, true) });
    const fnum = h('input', {
      type: 'number',
      class: 'num in',
      id: 'fn_' + cfg.key,
      step: 0.1,
      inputmode: 'decimal',
      'aria-label': 'Ganancia exacta de la banda seleccionada',
    }) as HTMLInputElement;
    fnum.addEventListener('change', () => {
      const v = parseFloat(fnum.value);
      if (isFinite(v)) setBand(sel, v, true);
      else updFine();
    });
    const adj = (d: number, t: string) => {
      const b = h('button', { class: 'btn', type: 'button', text: t, 'aria-label': (d > 0 ? 'Subir ' : 'Bajar ') + Math.abs(d) + ' dB' });
      holdBtn(b, () => setBand(sel, arr()[sel] + d, false));
      return b;
    };
    const frow = h(
      'div',
      { class: 'frow' },
      adj(-1, '−1'),
      adj(-0.1, '−0.1'),
      fnum,
      adj(0.1, '+0.1'),
      adj(1, '+1'),
      h('button', { class: 'btn', type: 'button', text: '0', onclick: () => setBand(sel, 0, true) })
    );
    function updFine() {
      const f = cfg.freqs[sel];
      fname.textContent = fmtHz(f) + (cfg.names ? ' · ' + cfg.names[sel] : '');
      const v = arr()[sel];
      fval.textContent = sgn(v) + ' dB';
      fnum.value = v.toFixed(1);
      fnum.max = String(rg());
      fnum.min = String(-rg());
    }
    body.append(h('div', { class: 'fine' }, h('div', { class: 'fnav' }, prev, h('div', { class: 'mid' }, fname, fval), next), frow));
    body.append(row(cfg.qk, 'Ancho de banda base (Q)', { min: 0.3, max: 20, step: 0.01, fine: 0.01, unit: 'Q' }));
    body.append(
      h(
        'div',
        { class: 'chips', style: 'margin-top:8px' },
        h('button', {
          class: 'btn',
          type: 'button',
          text: 'Aplanar',
          onclick: () => {
            arr().fill(0);
            paintAll();
            commit();
            persistNow();
          },
        }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: 'Suavizar curva',
          onclick: () => {
            const a = arr();
            const n = a.map((v, i) => r1((a[i - 1] ?? v) * 0.25 + v * 0.5 + (a[i + 1] ?? v) * 0.25));
            n.forEach((v, i) => (a[i] = v));
            paintAll();
            commit();
            persistNow();
          },
        }),
        h('button', {
          class: 'btn ghost',
          type: 'button',
          text: 'Invertir',
          onclick: () => {
            const a = arr();
            for (let i = 0; i < a.length; i++) a[i] = clamp(r1(-a[i]), -rg(), rg());
            paintAll();
            commit();
            persistNow();
          },
        })
      )
    );
    syncers.push(paintAll);
    return c;
  }

  /* ---------- reproductor Hi-Res + decodificador de respaldo 32-bit Float ---------- */
  interface TrackItem {
    id: string | number;
    name: string;
    artist: string;
    fmt?: string;
    kbps?: number;
    duration: number;
    dateAdded: number;
    url: string;
    rawFile?: File;
    decodedFallback?: boolean;
  }

  const PL: TrackItem[] = [];
  let nativeRaw: TrackItem[] = [];
  let cur = -1;
  let repeat = savedRepeat;
  let shuffle = savedShuffle;
  let seeking = false;
  let searchQ = '';
  let sortMode: 'recent' | 'az' = savedSortMode;
  let hasPerm = !NATIVE;
  let lastNotifSync = 0;
  let userWantsPlaying = false;
  let resumeT: any = 0;

  const REP = ['Repetir: no', 'Repetir: todo', 'Repetir: una'];
  function inPhoneCall(): boolean {
    if (NATIVE && window.AndroidBridge?.isInPhoneCall) {
      try {
        return !!window.AndroidBridge.isInPhoneCall();
      } catch (_e) {}
    }
    return false;
  }

  function detectFileFormat(f: File): string {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const map: Record<string, string> = {
      flac: 'FLAC Lossless',
      wav: 'WAV PCM',
      wave: 'WAV PCM',
      aif: 'AIFF Studio',
      aiff: 'AIFF Studio',
      aifc: 'AIFF Studio',
      m4a: 'M4A / ALAC',
      alac: 'ALAC Lossless',
      opus: 'OPUS Hi-Fi',
      ogg: 'OGG Vorbis',
      oga: 'OGG Audio',
      aac: 'AAC',
      weba: 'WebM Audio',
      webm: 'WebM Audio',
      mp3: 'MP3',
      caf: 'CAF Apple',
    };
    return map[ext] || (ext ? ext.toUpperCase() : 'AUDIO');
  }

  function isAudioFile(f: File) {
    return (
      (f.type && f.type.startsWith('audio')) ||
      /\.(mp3|m4a|alac|aac|wav|wave|flac|ogg|oga|opus|weba|webm|aif|aiff|aifc|caf|3gp|mp4)$/i.test(f.name)
    );
  }

  /* Convierte un AudioBuffer decodificado en WAV IEEE 32-bit Float sin pérdida para contenedores exóticos */
  function audioBufferToFloatWavBlob(buf: AudioBuffer): Blob {
    const numCh = Math.min(2, buf.numberOfChannels || 1);
    const sr = buf.sampleRate;
    const frames = buf.length;
    const bytesPerSample = 4;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = frames * blockAlign;
    const ab = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(ab);
    const wr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
    };
    wr(0, 'RIFF');
    dv.setUint32(4, 36 + dataSize, true);
    wr(8, 'WAVE');
    wr(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 3, true); /* Formato 3 = IEEE 32-bit Float */
    dv.setUint16(22, numCh, true);
    dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * blockAlign, true);
    dv.setUint16(32, blockAlign, true);
    dv.setUint16(34, 32, true);
    wr(36, 'data');
    dv.setUint32(40, dataSize, true);
    const ch0 = buf.getChannelData(0);
    const ch1 = numCh > 1 ? buf.getChannelData(1) : ch0;
    const out = new Float32Array(ab, 44, frames * numCh);
    if (numCh === 1) {
      out.set(ch0);
    } else {
      for (let i = 0, j = 0; i < frames; i++) {
        out[j++] = ch0[i];
        out[j++] = ch1[i];
      }
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  async function tryDecodeFallback(track: TrackItem): Promise<boolean> {
    if (!ctx || !track.rawFile || track.decodedFallback) return false;
    track.decodedFallback = true;
    try {
      const rawBuf = await track.rawFile.arrayBuffer();
      const decoded = await ctx.decodeAudioData(rawBuf);
      const wavBlob = audioBufferToFloatWavBlob(decoded);
      track.url = URL.createObjectURL(wavBlob);
      track.duration = Math.round(decoded.duration);
      track.fmt = (track.fmt || 'Hi-Res') + ' · 32f';
      audio.src = track.url;
      updateEngineSpecUi();
      if (userWantsPlaying) await playNow();
      return true;
    } catch (_e) {
      return false;
    }
  }

  let preloadedIdx = -1;
  let queuedShuffleNext = -1;
  let xfadeTimer: any = 0;
  let xfadeActive = false;

  function resetDeckGainsImmediate() {
    clearTimeout(xfadeTimer);
    xfadeActive = false;
    preloadedIdx = -1;
    if (standbyAudio && !standbyAudio.paused) {
      try {
        standbyAudio.pause();
      } catch (_e) {}
    }
    if (ctx && N.gA && N.gB) {
      const t = ctx.currentTime;
      const gAct = activeDeck === 'A' ? N.gA.gain : N.gB.gain;
      const gStb = activeDeck === 'A' ? N.gB.gain : N.gA.gain;
      gAct.cancelScheduledValues(t);
      gStb.cancelScheduledValues(t);
      gAct.setValueAtTime(1, t);
      gStb.setValueAtTime(0, t);
    }
  }

  function peekNextAutoIndex(): number {
    if (!PL.length) return -1;
    if (repeat === 2) return cur;
    if (shuffle && PL.length > 1) {
      if (queuedShuffleNext >= 0 && queuedShuffleNext < PL.length && queuedShuffleNext !== cur) {
        return queuedShuffleNext;
      }
      let r = cur;
      while (r === cur) r = Math.floor(Math.random() * PL.length);
      queuedShuffleNext = r;
      return r;
    }
    const nx = cur + 1;
    if (nx >= PL.length) {
      return repeat === 1 ? 0 : -1;
    }
    return nx;
  }

  function setDockTitleFor(i: number) {
    const t = PL[i];
    if (!t) return;
    const dTitle = $('#dTitle');
    if (dTitle) {
      dTitle.replaceChildren(
        h('span', { class: 'dt-name', text: t.name }),
        ...(t.artist ? [h('span', { class: 'dt-sep', text: ' · ' }), h('span', { class: 'dt-art', text: t.artist })] : [])
      );
    }
    if (t.id != null) {
      savedLastTrackId = String(t.id);
      try {
        localStorage.setItem(LAST_TRACK_KEY, savedLastTrackId);
      } catch (_e) {}
      saveSoon();
    }
  }

  function maybePreloadStandby() {
    if (!PL.length || cur < 0 || xfadeActive || !standbyAudio) return;
    if (!S.play.gapless && !(S.play.xfade > 0)) return;
    const dur = audio.duration;
    if (!dur || !isFinite(dur) || dur < 4) return;
    const rem = dur - audio.currentTime;
    const lead = Math.max(12, (S.play.xfade || 0) + 4);
    if (rem > lead) return;
    const nx = peekNextAutoIndex();
    if (nx < 0 || !PL[nx] || nx === cur) return;
    if (preloadedIdx !== nx || standbyAudio.src !== PL[nx].url) {
      preloadedIdx = nx;
      standbyAudio.src = PL[nx].url;
      standbyAudio.currentTime = 0;
      try {
        standbyAudio.load();
      } catch (_e) {}
    }
  }

  async function triggerDeckHandoff(nx: number, fadeSec: number): Promise<boolean> {
    if (!PL[nx] || !ctx || !N.gA || !N.gB || !standbyAudio) return false;
    clearTimeout(xfadeTimer);
    queuedShuffleNext = -1;
    const outEl = audio;
    const inEl = standbyAudio;
    const outGain = activeDeck === 'A' ? N.gA.gain : N.gB.gain;
    const inGain = activeDeck === 'A' ? N.gB.gain : N.gA.gain;
    if (preloadedIdx !== nx || inEl.src !== PL[nx].url) {
      inEl.src = PL[nx].url;
    }
    inEl.currentTime = 0;
    const baseRate = clamp(S.play.rate || 1, 0.5, 1.5);
    const effRate = S.play.hz432 ? baseRate * (432 / 440) : baseRate;
    const keepP = S.play.hz432 ? false : !!S.play.keepPitch;
    (inEl as any).preservesPitch = keepP;
    (inEl as any).webkitPreservesPitch = keepP;
    if (Math.abs(inEl.playbackRate - effRate) > 1e-4) inEl.playbackRate = effRate;

    try {
      if (ctx.state !== 'running') await ctx.resume();
      await inEl.play();
      const t0 = ctx.currentTime;
      const dur = clamp(fadeSec, 0.01, 12);
      outGain.cancelScheduledValues(t0);
      inGain.cancelScheduledValues(t0);
      if (dur >= 0.15) {
        const steps = 64;
        const cOut = new Float32Array(steps);
        const cIn = new Float32Array(steps);
        for (let k = 0; k < steps; k++) {
          const ph = (k / (steps - 1)) * Math.PI * 0.5;
          cOut[k] = Math.cos(ph);
          cIn[k] = Math.sin(ph);
        }
        outGain.setValueCurveAtTime(cOut, t0, dur);
        inGain.setValueCurveAtTime(cIn, t0, dur);
      } else {
        outGain.setValueAtTime(1, t0);
        inGain.setValueAtTime(0, t0);
        outGain.linearRampToValueAtTime(0, t0 + dur);
        inGain.linearRampToValueAtTime(1, t0 + dur);
      }

      activeDeck = activeDeck === 'A' ? 'B' : 'A';
      audio = inEl;
      standbyAudio = outEl;
      preloadedIdx = -1;
      cur = nx;
      xfadeActive = dur >= 0.15;
      syncDitherConnection();
      setDockTitleFor(nx);
      updateListSelectionFast();
      updateEngineSpecUi();
      syncMediaSession(true);

      xfadeTimer = setTimeout(() => {
        xfadeActive = false;
        try {
          if (outEl !== audio) outEl.pause();
        } catch (_e) {}
      }, Math.round(dur * 1000) + 60);
      return true;
    } catch (_e) {
      resetDeckGainsImmediate();
      return false;
    }
  }

  function paintJackStatus() {
    if (!jackStatusEl) return;
    const srTxt = ctx && ctx.sampleRate ? +(ctx.sampleRate / 1000).toFixed(1) + ' kHz' : '48 kHz';
    const ditherOn = !!(S.jack.hiRes && S.jack.dither24 && ditherReady);
    const parts: string[] = [];
    if (NATIVE) {
      if (jackHw.jackConnected) {
        parts.push(
          (jackHw.portType === 'usb_dac_jack' ? 'DAC USB-C / Jack activo' : 'Jack 3.5 mm activo') +
            (jackHw.deviceName && !jackHw.deviceName.includes('Jack') ? ' (' + jackHw.deviceName + ')' : '')
        );
        parts.push('Reloj nativo 1:1 · ' + srTxt);
        parts.push((jackHw.bitDepth || 24) + '-bit' + (ditherOn ? ' TPDF' : ''));
      } else {
        parts.push(jackHw.deviceName || 'Altavoz del teléfono');
        parts.push('Reloj nativo 1:1 · ' + srTxt);
        if (ditherOn) parts.push('TPDF listo para Jack');
      }
    } else {
      parts.push(S.jack.hiRes ? 'Salida Directa 1:1 Bit-Perfect' : 'Salida estándar');
      if (jackHw.deviceName && jackHw.deviceName !== 'Salida directa del sistema') parts.push(jackHw.deviceName);
      parts.push('Reloj DAC ' + srTxt);
      parts.push(ditherOn ? '24-bit TPDF' : '32-bit Float');
    }
    jackStatusEl.textContent = parts.join(' · ');
  }

  function updateEngineSpecUi() {
    const specEl = $('#dSpec');
    if (!specEl) return;
    const parts: string[] = [];
    const t = PL[cur];
    if (t && t.fmt) parts.push(t.fmt);
    if (t && t.kbps && t.kbps > 0) parts.push(t.kbps + ' kbps');
    if (S.jack.hiRes && jackHw.jackConnected) {
      parts.push('Jack Directo');
    }
    if (ctx && ctx.sampleRate) parts.push(+(ctx.sampleRate / 1000).toFixed(1) + ' kHz 1:1');
    if (FX_CONN.dither && ditherReady) parts.push('24-bit TPDF');
    parts.push('Motor C++ 64-bit');
    specEl.textContent = parts.join(' · ');
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    let n = 0;
    for (const f of Array.from(files)) {
      if (!isAudioFile(f)) continue;
      PL.push({
        id: 'local_' + Date.now() + '_' + n,
        name: f.name.replace(/\.[^.]+$/, ''),
        artist: '',
        fmt: detectFileFormat(f),
        duration: 0,
        dateAdded: Date.now() / 1000,
        url: URL.createObjectURL(f),
        rawFile: f,
      });
      n++;
    }
    renderList();
    if (!n) {
      toast('No encontré archivos de audio compatibles');
      return;
    }
    toast(n + ' pista' + (n > 1 ? 's' : '') + ' lista' + (n > 1 ? 's' : '') + ' en máxima calidad');
    if (cur < 0) loadTrack(0, false);
  }

  function syncMediaSession(force: boolean) {
    const t = PL[cur];
    if (!t || !audio) return;
    const now = performance.now();
    if (!force && now - lastNotifSync < 2500) return;
    lastNotifSync = now;
    const playing = userWantsPlaying || !audio.paused;
    if (NATIVE && window.AndroidBridge?.updatePlaybackState) {
      try {
        window.AndroidBridge.updatePlaybackState(
          t.name || 'Estudio Master Hi-Res',
          t.artist || 'Estudio Master Hi-Res',
          playing,
          Math.floor((audio.currentTime || 0) * 1000),
          Math.floor((audio.duration || t.duration || 0) * 1000)
        );
      } catch (_e) {}
    }
    if ('mediaSession' in navigator) {
      try {
        if (force || !navigator.mediaSession.metadata || navigator.mediaSession.metadata.title !== t.name) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: t.name || 'Estudio Master Hi-Res',
            artist: t.artist || 'Estudio Master Hi-Res',
            album: 'Estudio Master Hi-Res',
            artwork: [
              { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            ],
          });
        }
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
        if (audio.duration && isFinite(audio.duration) && typeof navigator.mediaSession.setPositionState === 'function') {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(audio.currentTime || 0, audio.duration),
          });
        }
      } catch (_e) {}
    }
  }

  function loadTrack(i: number, play: boolean) {
    if (!PL[i]) return;
    resetDeckGainsImmediate();
    queuedShuffleNext = -1;
    const sameUrl = cur === i && audio.src === PL[i].url;
    cur = i;
    if (!sameUrl) {
      audio.src = PL[i].url;
    }
    setDockTitleFor(i);
    updateEngineSpecUi();
    updateListSelectionFast();
    if (play) playNow();
    else syncMediaSession(true);
  }

  async function playNow() {
    userWantsPlaying = true;
    clearTimeout(resumeT);
    try {
      if (ctx && ctx.state !== 'running') await ctx.resume();
      await audio.play();
      updateEngineSpecUi();
      syncMediaSession(true);
    } catch (_e) {
      const t = PL[cur];
      if (t && t.rawFile && !t.decodedFallback) {
        const ok = await tryDecodeFallback(t);
        if (ok) return;
      }
      userWantsPlaying = false;
      toast('No se pudo reproducir esta pista');
    }
  }

  function pauseByUser() {
    userWantsPlaying = false;
    clearTimeout(resumeT);
    resetDeckGainsImmediate();
    audio.pause();
    const ic = $('#playIcon');
    if (ic) ic.innerHTML = '<path d="M8 5v14l11-7z"/>';
    $('#bPlay')?.setAttribute('aria-label', 'Reproducir');
    syncMediaSession(true);
  }

  function nextTrack(auto: boolean) {
    if (!PL.length) return;
    if (auto) {
      const nx = peekNextAutoIndex();
      if (nx < 0) {
        userWantsPlaying = false;
        syncMediaSession(true);
        return;
      }
      if (S.play.gapless && nx !== cur && preloadedIdx === nx) {
        triggerDeckHandoff(nx, 0.012).then((ok) => {
          if (!ok) loadTrack(nx, true);
        });
        return;
      }
      loadTrack(nx, true);
      return;
    }
    let i: number;
    if (shuffle && PL.length > 1) {
      do {
        i = Math.floor(Math.random() * PL.length);
      } while (i === cur);
    } else {
      i = (cur + 1) % PL.length;
    }
    loadTrack(i, true);
  }

  function prevTrack() {
    if (!PL.length) return;
    if (audio.currentTime > 3) {
      resetDeckGainsImmediate();
      audio.currentTime = 0;
      syncMediaSession(true);
      return;
    }
    loadTrack((cur - 1 + PL.length) % PL.length, true);
  }

  let lastPlSig = '';
  function applyNativeSortAndRebuild(reason: string) {
    const prevTrackObj = cur >= 0 ? PL[cur] : null;
    const prevCount = PL.length;
    const sorted = nativeRaw.slice().sort((a, b) => {
      if (sortMode === 'az') return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
      return (b.dateAdded || 0) - (a.dateAdded || 0);
    });
    const nextSig = sortMode + '|' + sorted.map((x) => x.id).join(',');
    const unchanged = nextSig === lastPlSig && PL.length === sorted.length && cur >= 0;
    lastPlSig = nextSig;
    PL.length = 0;
    for (const item of sorted) PL.push(item);
    if (prevTrackObj) {
      const idx = PL.findIndex((x) => String(x.id) === String(prevTrackObj.id) || x.url === prevTrackObj.url);
      cur = idx >= 0 ? idx : PL.length ? 0 : -1;
    } else if (PL.length) {
      const savedIdx = savedLastTrackId ? PL.findIndex((x) => String(x.id) === String(savedLastTrackId)) : -1;
      loadTrack(savedIdx >= 0 ? savedIdx : 0, false);
      return;
    } else {
      cur = -1;
      const dTitle = $('#dTitle');
      if (dTitle) dTitle.textContent = 'Sin pista';
      updateEngineSpecUi();
    }
    if (!unchanged) renderList();
    if (reason === 'observer' && PL.length > prevCount && prevCount > 0) {
      const diff = PL.length - prevCount;
      toast(diff === 1 ? 'Nueva canción detectada y añadida' : '+' + diff + ' canciones nuevas detectadas');
    }
  }

  window.__onNativeTracks = (tracksInput: unknown, reason?: string) => {
    try {
      const arr = typeof tracksInput === 'string' ? JSON.parse(tracksInput) : tracksInput;
      if (!Array.isArray(arr)) return;
      hasPerm = true;
      nativeRaw = arr.map((t: any) => ({
        id: t.id,
        name: t.name || 'Sin título',
        artist: t.artist || '',
        fmt: t.fmt || '',
        kbps: +t.kbps || 0,
        duration: +t.duration || 0,
        dateAdded: +t.dateAdded || 0,
        url: t.url,
      }));
      applyNativeSortAndRebuild(reason || 'init');
      updPermBanner();
    } catch (_e) {}
  };

  window.__onNativePermission = (granted: boolean) => {
    hasPerm = !!granted;
    updPermBanner();
    renderList();
  };

  window.__nativeCmd = (cmd: string, arg?: number) => {
    if (!PL.length) return;
    if (cmd === 'play') {
      if (cur < 0) loadTrack(0, true);
      else playNow();
    } else if (cmd === 'pause' || cmd === 'pause_user') {
      pauseByUser();
    } else if (cmd === 'toggle' || cmd === 'toggle_user') {
      if (!userWantsPlaying || audio.paused) {
        if (cur < 0) loadTrack(0, true);
        else playNow();
      } else {
        pauseByUser();
      }
    } else if (cmd === 'next') {
      nextTrack(false);
    } else if (cmd === 'prev') {
      prevTrack();
    } else if (cmd === 'seek') {
      if (arg !== undefined && isFinite(+arg)) {
        audio.currentTime = clamp(+arg / 1000, 0, audio.duration || 0);
        syncMediaSession(true);
      }
    }
  };

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => window.__nativeCmd?.('play'));
      navigator.mediaSession.setActionHandler('pause', () => window.__nativeCmd?.('pause_user'));
      navigator.mediaSession.setActionHandler('previoustrack', () => window.__nativeCmd?.('prev'));
      navigator.mediaSession.setActionHandler('nexttrack', () => window.__nativeCmd?.('next'));
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        if (d && typeof d.seekTime === 'number') {
          audio.currentTime = d.seekTime;
          syncMediaSession(true);
        }
      });
    } catch (_e) {}
  }

  let countBadge: HTMLElement | null = null;
  let permBox: HTMLElement | null = null;
  let batBtn: HTMLElement | null = null;

  function updPermBanner() {
    if (permBox) permBox.hidden = hasPerm;
    if (batBtn && NATIVE && window.AndroidBridge?.isIgnoringBatteryOptimizations) {
      try {
        batBtn.hidden = !!window.AndroidBridge.isIgnoringBatteryOptimizations();
      } catch (_e) {}
    }
  }

  function updateListSelectionFast() {
    const l = $('#plist');
    if (!l) return;
    const prev = l.querySelector<HTMLElement>('.pitem[aria-current="true"]');
    if (prev) prev.setAttribute('aria-current', 'false');
    if (cur >= 0) {
      const next = l.querySelector<HTMLElement>('.pitem[data-idx="' + cur + '"]');
      if (next) next.setAttribute('aria-current', 'true');
    }
  }

  function renderList() {
    const l = $('#plist');
    if (!l) return;
    l.replaceChildren();
    if (countBadge) countBadge.textContent = PL.length ? PL.length + ' pista' + (PL.length === 1 ? '' : 's') : '0 pistas';
    if (NATIVE && !hasPerm) {
      l.append(h('div', { class: 'empty', text: 'Concede permiso de audio para mostrar automáticamente todas tus canciones.' }));
      return;
    }
    if (!PL.length) {
      l.append(
        h('div', {
          class: 'empty',
          text: NATIVE
            ? 'No se encontraron canciones en la memoria del teléfono. Descarga música (FLAC, WAV, M4A, OPUS, MP3) y aparecerá aquí sola.'
            : 'Añade archivos FLAC, WAV, AIFF, M4A, OPUS o MP3 para escuchar en máxima fidelidad.',
        })
      );
      return;
    }
    const q = normStr(searchQ.trim());
    let shown = 0;
    const frag = document.createDocumentFragment();
    PL.forEach((t, i) => {
      if (q && !normStr(t.name + ' ' + t.artist).includes(q)) return;
      shown++;
      const subParts: string[] = [];
      if (t.artist) subParts.push(t.artist);
      if (t.fmt) subParts.push(t.fmt);
      const itemBtn = h(
        'button',
        { class: 'pitem', type: 'button', 'data-idx': String(i), 'aria-current': String(i === cur), onclick: () => loadTrack(i, true) },
        h('span', { class: 'num', text: String(i + 1).padStart(2, '0') }),
        h(
          'span',
          { class: 'pmeta' },
          h('span', { class: 'pt', text: t.name }),
          subParts.length ? h('span', { class: 'pa', text: subParts.join(' · ') }) : null
        ),
        t.duration > 0 ? h('span', { class: 'pdur num', text: mmss(t.duration) }) : null
      );
      frag.append(itemBtn);
    });
    if (!shown) {
      l.append(h('div', { class: 'empty', text: 'Ninguna canción coincide con “' + searchQ.trim() + '”.' }));
    } else {
      l.append(frag);
    }
    if (IS_PRO_EDITION) applyCertifiedDomTranslation(l, currentLang);
  }

  /* ---------- presets de referencia mundial ---------- */
  function applyData(data: Record<string, any>, { reset = false } = {}) {
    ORDER.forEach((k) => {
      if (S.locks[k]) return;
      if (reset) resetSec(k);
      if (data && data[k]) SEC[k].set(S, data[k]);
    });
    syncAll();
    commit();
    persistNow();
  }

  const pre = h('div', { class: 'pane' });
  const secSel = h('select', { class: 'field', id: 'secSel', 'aria-label': 'Sección' }) as HTMLSelectElement;
  secSel.append(h('option', { value: '__all__', text: 'Todas las secciones guardadas' }));
  ORDER.forEach((k) => secSel.append(h('option', { value: k, text: SEC[k].n })));
  const lists = { fact: h('div'), mine: h('div'), sec: h('div') };

  function saveSection(key: string) {
    const list = store.sec[key] || (store.sec[key] = []);
    const name = SEC[key].n + ' · ' + stamp();
    list.unshift({ name, ts: Date.now(), data: SEC[key].get(S) });
    list.length = Math.min(list.length, 40);
    if (secSel.value !== '__all__') secSel.value = key;
    if (persistNow()) toast('Guardado: ' + name);
    renderPresets();
  }
  function saveAllPreset(name: string) {
    name = (name || '').trim() || 'Ajuste ' + stamp();
    store.presets.unshift({ name, ts: Date.now(), data: getFull() });
    store.presets.length = Math.min(store.presets.length, 60);
    if (persistNow()) toast('Guardado todo: ' + name);
    renderPresets();
  }
  const ramp = (n: number, fn: (i: number) => number) => Array.from({ length: n }, (_, i) => r1(fn(i)));
  const FACT: Array<[string, string, Record<string, any>]> = [
    ['Plano Bit-Perfect', 'Respuesta neutra 0 dB de referencia', {}],
    [
      'Harman Reference Hi-Fi',
      'Curva audiófila mundial para audífonos + Crossfeed suave',
      {
        cl16: { cl: [3.2, 3.8, 2.4, 0.5, -0.6, -1.0, 0, 0.8, 2.2, 3.0, 2.1, 0.8, 1.4, 2.2, 2.0, 1.2], propQ16: true },
        xfeed: { on: true, mix: 24, fc: 700 },
        master: { ceil: -0.2, autoHead: true },
      },
    ],
    [
      'Mastering Analógico 4×',
      'Válvula triodo sutil, compresión glue y apertura M/S',
      {
        cl16: { cl: [1.5, 1.8, 1.0, 0, -0.8, -0.6, 0, 0.6, 1.2, 1.5, 1.0, 1.2, 1.8, 2.4, 2.2, 1.5], propQ16: true },
        sat: { on: true, drive: 14, mix: 16, mode: 1 },
        comp: { on: true, th: -18, ratio: 2.2, attack: 22, release: 190, knee: 8, makeup: 1.8 },
        wid: { on: true, w: 18 },
        master: { ceil: -0.2, autoHead: true },
      },
    ],
    ['Graves potentes', 'Realce limpio de 25 a 160 Hz', { eq30: { eq: ramp(30, (i) => Math.max(0, 6 - i * 0.42)) }, tone: { bass: 3 } }],
    ['Voz clara Studio', 'Presencia nítida y control de sibilancia', { cl16: { cl: [0, -1, -1, 0, 0, -1.5, 0, 1.5, 2.5, 3, 2, 0.5, 0, 1, 0.5, 0] }, voice: { vPres: { g: 3 }, vSib: { g: -2 }, vWarm: { g: 1 } } }],
    ['Rock en vivo', 'Pegada de consola, caja, guitarra y aire', { eq30: { eq: ramp(30, (i) => (Math.abs(i - 14) < 6 ? -1.5 : (Math.abs(i - 14) / 14) * 5)) }, drums: { kick: { g: 2.5 }, snareC: { g: 2 } }, guitar: { gPres: { g: 2.5 } }, sat: { on: true, drive: 16, mix: 14, mode: 2 }, comp: { on: true, th: -18, ratio: 3, attack: 12, release: 180, knee: 6, makeup: 3 } }],
    ['Electrónica Club', 'Subgraves profundos, curva en V y ancho M/S', { eq30: { eq: ramp(30, (i) => (Math.abs(i - 14.5) / 14.5) * 6 - 1) }, tone: { bass: 3, treb: 2 }, sat: { on: true, drive: 18, mix: 15, mode: 0 }, wid: { on: true, w: 30 } }],
    ['Estudio Acústico WAV 32f', 'Impulso real Sala Mastering WAV 32-bit Float sin comprimir', { rev: { on: true, irMode: 1, mix: 16, pre: 12, decay: 1.4, damp: 28, size: 45 }, xfeed: { on: true, mix: 18, fc: 700 }, master: { ceil: -0.2, autoHead: true } }],
    ['Cine Espacial 3D', 'Escena binaural HRTF + Auditorio Sinfónico WAV 32-bit Float', { rev: { on: true, irMode: 4, mix: 22, decay: 2.8, size: 70, damp: 38, pre: 18 }, sp: { on: true, mix: 48, rot: 0, dist: 1.6, az: 0, el: 8 }, wid: { on: true, w: 36 }, sub: { on: true, freq: 42, g: 4.5, q: 1.2 } }],
  ];

  const twoStep = (btn: HTMLElement, label: string, fn: () => void) => {
    let armed: any = 0;
    btn.addEventListener('click', () => {
      if (armed) {
        clearTimeout(armed);
        armed = 0;
        btn.textContent = btn.dataset.t || '';
        fn();
        return;
      }
      btn.textContent = label;
      armed = setTimeout(() => {
        armed = 0;
        btn.textContent = btn.dataset.t || '';
      }, 3000);
    });
  };
  function prRow(name: string, sub: string, apply: () => void, del?: () => void, upd?: () => void) {
    const a = h('button', { class: 'btn sm', type: 'button', text: 'Aplicar', onclick: apply });
    const r = h('div', { class: 'prrow' }, h('div', { class: 'prn' }, h('b', { text: name }), sub ? h('small', { text: sub }) : null), a);
    if (upd) {
      const u = h('button', { class: 'btn sm ghost', type: 'button', text: 'Actualizar' });
      u.dataset.t = 'Actualizar';
      twoStep(u, '¿Sobrescribir?', upd);
      r.append(u);
    }
    if (del) {
      const d = h('button', { class: 'btn sm ghost', type: 'button', text: 'Borrar' });
      d.dataset.t = 'Borrar';
      twoStep(d, '¿Seguro?', del);
      r.append(d);
    }
    return r;
  }
  function renderPresets() {
    lists.fact.replaceChildren(
      ...FACT.map(([n, s, d]) =>
        prRow(n, s, () => {
          applyData(d, { reset: true });
          toast('Aplicado: ' + n);
        })
      )
    );
    lists.mine.replaceChildren(
      ...(store.presets.length
        ? store.presets.map((p, i) =>
            prRow(
              p.name,
              Object.keys(p.data || {}).length + ' secciones',
              () => {
                applyData(p.data || {}, { reset: true });
                toast('Aplicado: ' + p.name);
              },
              () => {
                store.presets.splice(i, 1);
                persistNow();
                renderPresets();
                toast('Ajuste borrado');
              },
              () => {
                store.presets[i] = { name: p.name, ts: Date.now(), data: getFull() };
                persistNow();
                renderPresets();
                toast('Actualizado: ' + p.name);
              }
            )
          )
        : [h('div', { class: 'empty', text: 'Aún no guardaste ajustes completos.' })])
    );
    const selVal = secSel.value || '__all__';
    if (selVal === '__all__') {
      const allItems: Array<{ k: string; idx: number; p: any }> = [];
      ORDER.forEach((k) => {
        (store.sec[k] || []).forEach((p, idx) => allItems.push({ k, idx, p }));
      });
      allItems.sort((a, b) => (b.p.ts || 0) - (a.p.ts || 0));
      lists.sec.replaceChildren(
        ...(allItems.length
          ? allItems.map(({ k, idx, p }) =>
              prRow(
                p.name,
                SEC[k].n,
                () => {
                  if (S.locks[k]) {
                    toast(SEC[k].n + ' está bloqueado');
                    return;
                  }
                  SEC[k].set(S, p.data);
                  syncAll();
                  commit();
                  persistNow();
                  toast('Aplicado: ' + p.name);
                },
                () => {
                  store.sec[k].splice(idx, 1);
                  persistNow();
                  renderPresets();
                  toast('Ajuste borrado');
                },
                () => {
                  store.sec[k][idx] = { name: p.name, ts: Date.now(), data: SEC[k].get(S) };
                  persistNow();
                  renderPresets();
                  toast('Actualizado: ' + p.name);
                }
              )
            )
          : [h('div', { class: 'empty', text: 'Sin ajustes por sección guardados aún.' })])
      );
    } else {
      const k = selVal;
      const ls = store.sec[k] || [];
      lists.sec.replaceChildren(
        ...(ls.length
          ? ls.map((p, i) =>
              prRow(
                p.name,
                SEC[k].n,
                () => {
                  if (S.locks[k]) {
                    toast(SEC[k].n + ' está bloqueado');
                    return;
                  }
                  SEC[k].set(S, p.data);
                  syncAll();
                  commit();
                  persistNow();
                  toast('Aplicado: ' + p.name);
                },
                () => {
                  ls.splice(i, 1);
                  persistNow();
                  renderPresets();
                  toast('Ajuste borrado');
                },
                () => {
                  ls[i] = { name: p.name, ts: Date.now(), data: SEC[k].get(S) };
                  persistNow();
                  renderPresets();
                  toast('Actualizado: ' + p.name);
                }
              )
            )
          : [h('div', { class: 'empty', text: 'Sin ajustes guardados para esta sección.' })])
      );
    }
    if (IS_PRO_EDITION) applyCertifiedDomTranslation(pre, currentLang);
  }
  secSel.addEventListener('change', renderPresets);

  /* ---------- construcción de paneles ---------- */
  const main = $('#main')!;
  let previewBannerEl: HTMLElement | null = null;
  if (IS_PRO_EDITION) {
    const pvSpan = h('span');
    const pvBtn = h('button', {
      type: 'button',
      class: 'btn pri',
      onclick: () => openProModal(),
    });
    previewBannerEl = h('div', { class: 'jf-preview-bar', hidden: true }, pvSpan, pvBtn);
    main.append(previewBannerEl);
    updatePreviewBarUi = () => {
      if (!previewBannerEl) return;
      const showPv = IS_PRO_EDITION && !hasProAccess() && curTab !== 'music';
      previewBannerEl.hidden = !showPv;
      if (showPv) {
        const cp = LEGAL_PRO_COPY[currentLang];
        pvSpan.textContent = cp.previewBannerText;
        pvBtn.textContent = cp.previewBannerBtn;
      }
    };
  }
  const dockEl = $('#playerDock') || $('.dock');
  const panes: Record<string, HTMLElement> = {};
  function mkPane(id: string) {
    const p = h('section', { class: 'pane', role: 'tabpanel' });
    p.dataset.id = id;
    p.hidden = true;
    panes[id] = p;
    main.append(p);
    return p;
  }

  /* Música (ÚNICO apartado donde vive el reproductor .dock) */
  {
    const p = mkPane('music');
    if (dockEl) p.append(dockEl);

    countBadge = h('span', { class: 'mini num', text: '0 pistas' });
    const sIn = h('input', {
      type: 'search',
      class: 'field',
      placeholder: 'Buscar canción o artista...',
      'aria-label': 'Buscar en tu música',
    }) as HTMLInputElement;
    const sClr = h('button', {
      type: 'button',
      class: 'sclr',
      'aria-label': 'Limpiar búsqueda',
      text: '×',
      hidden: true,
      onclick: () => {
        sIn.value = '';
        searchQ = '';
        sClr.hidden = true;
        renderList();
      },
    });
    sIn.addEventListener('input', () => {
      searchQ = sIn.value;
      sClr.hidden = !searchQ;
      renderList();
    });
    const searchWrap = h('div', { class: 'sbox' }, sIn, sClr);

    const rep = h('button', {
      class: 'chip',
      type: 'button',
      text: REP[repeat],
      'aria-pressed': String(repeat > 0),
      onclick: () => {
        repeat = (repeat + 1) % 3;
        savedRepeat = repeat;
        rep.textContent = REP[repeat];
        rep.setAttribute('aria-pressed', String(repeat > 0));
        persistNow();
      },
    });
    const shf = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Aleatorio',
      'aria-pressed': String(shuffle),
      onclick: () => {
        shuffle = !shuffle;
        savedShuffle = shuffle;
        shf.setAttribute('aria-pressed', String(shuffle));
        persistNow();
      },
    });
    const sortBtn = h('button', {
      class: 'chip',
      type: 'button',
      text: sortMode === 'recent' ? 'Orden: Recientes' : 'Orden: A–Z',
      'aria-pressed': String(sortMode === 'az'),
      onclick: () => {
        sortMode = sortMode === 'recent' ? 'az' : 'recent';
        savedSortMode = sortMode;
        sortBtn.textContent = sortMode === 'recent' ? 'Orden: Recientes' : 'Orden: A–Z';
        sortBtn.setAttribute('aria-pressed', String(sortMode === 'az'));
        persistNow();
        if (NATIVE) applyNativeSortAndRebuild('sort');
        else {
          PL.sort((a, b) =>
            sortMode === 'az' ? String(a.name).localeCompare(String(b.name), 'es') : (b.dateAdded || 0) - (a.dateAdded || 0)
          );
          renderList();
        }
      },
    });

    const controlsRow = h('div', { class: 'chips' });
    if (NATIVE) {
      hasPerm = !!(window.AndroidBridge?.hasMusicPermission && window.AndroidBridge.hasMusicPermission());
      permBox = h(
        'div',
        { style: 'margin-bottom:8px', hidden: hasPerm },
        h('button', {
          class: 'btn pri',
          type: 'button',
          text: 'Permitir acceso a tu música',
          onclick: () => {
            try {
              window.AndroidBridge?.requestMusicPermission?.();
            } catch (_e) {}
          },
        })
      );
      batBtn = h('button', {
        class: 'chip',
        type: 'button',
        text: '2° plano sin límite',
        onclick: () => {
          try {
            window.AndroidBridge?.openBatterySettings?.();
          } catch (_e) {}
        },
      });
      controlsRow.append(sortBtn, rep, shf, batBtn);
    } else {
      const fileIn = h('input', {
        type: 'file',
        id: 'file',
        accept: 'audio/*,.flac,.wav,.wave,.aif,.aiff,.aifc,.m4a,.alac,.aac,.opus,.ogg,.oga,.mp3,.weba,.webm,.caf',
        multiple: true,
        class: 'vh',
      }) as HTMLInputElement;
      fileIn.addEventListener('change', () => {
        addFiles(fileIn.files);
        fileIn.value = '';
      });
      const add = h('label', { class: 'btn pri', for: 'file', style: 'display:inline-flex;align-items:center' }, 'Añadir música');
      controlsRow.append(fileIn, add, sortBtn, rep, shf);
    }

    const setRangeFill = (el: HTMLInputElement) => {
      const mn = +el.min || 0;
      const mx = +el.max || 1;
      el.style.setProperty('--p', clamp(((+el.value - mn) / (mx - mn || 1)) * 100, 0, 100).toFixed(1) + '%');
    };
    const vol = h('input', {
      type: 'range',
      id: 'vol',
      class: 'rfull',
      min: 0,
      max: 100,
      step: 1,
      value: S.playerVol,
      'aria-label': 'Volumen de monitoreo 32-bit',
    }) as HTMLInputElement;
    setRangeFill(vol);
    vol.addEventListener('input', () => {
      S.playerVol = +vol.value;
      setRangeFill(vol);
      commit();
    });
    vol.addEventListener('change', () => persistNow());
    syncers.push(() => {
      vol.value = String(S.playerVol);
      setRangeFill(vol);
    });
    const c1 = h(
      'div',
      { class: 'card' },
      h('div', { class: 'chead' }, h('h2', { text: 'Tu música' }), countBadge),
      permBox,
      searchWrap,
      controlsRow,
      h('div', { id: 'plist', class: 'plist', style: 'margin-top:8px' }),
      h('div', { class: 'prow', style: 'border:0' }, h('label', { class: 'pl', for: 'vol', text: 'Volumen (32-bit sin pérdida)' }), vol)
    );
    p.append(c1);

    if (!NATIVE) {
      const switchEdition = (target: 'pro' | 'classic') => {
        try {
          localStorage.setItem(EDITION_STORAGE_KEY, target);
        } catch (_e) {}
        window.location.reload();
      };

      const editionBar =
        window.__FORCED_EDITION == null
          ? h(
              'div',
              { class: 'jf-edition-switcher' },
              h('span', { class: 'mini', text: 'Vista previa de apps independientes:' }),
              h(
                'div',
                { class: 'chips' },
                h('button', {
                  type: 'button',
                  class: 'chip',
                  'aria-pressed': String(IS_PRO_EDITION),
                  text: 'JF Master Studio PRO (App Nueva)',
                  onclick: () => {
                    if (!IS_PRO_EDITION) switchEdition('pro');
                  },
                }),
                h('button', {
                  type: 'button',
                  class: 'chip',
                  'aria-pressed': String(!IS_PRO_EDITION),
                  text: 'Master Console DVC (App Libre Nueva)',
                  onclick: () => {
                    if (IS_PRO_EDITION) switchEdition('classic');
                  },
                })
              )
            )
          : null;

      const apkCard = IS_PRO_EDITION
        ? h(
            'div',
            { class: 'card' },
            editionBar,
            h(
              'div',
              { class: 'chead' },
              h('h2', { text: 'JF Master Studio PRO · Otra App Independiente (.apk)' }),
              h('span', { class: 'apk-badge', text: 'ID NUEVO · NO REEMPLAZA TU OTRA APP' })
            ),
            h('p', {
              class: 'hint',
              text: 'Aplicación 100% separada e independiente v2.0.0 Beta por Jack Friedrich (ID único: com.jackfriedrich.masterstudiopro) con nuevo icono propio Cyber-Gold. Se instala como OTRA APP aparte en tu teléfono sin borrar, pisar ni reemplazar Estudio Master Hi-Res ni versiones anteriores.',
            }),
            h(
              'div',
              { class: 'chips' },
              h('a', {
                class: 'btn pri',
                href: '/api/master-pro-jack-friedrich-android.zip',
                download: 'JF-Master-Studio-PRO-App-Independiente.zip',
                text: 'Descargar JF Master Studio PRO (.zip · Otra App)',
              }),
              h('a', {
                class: 'btn ghost',
                href: '/api/estudio-master-hires-android.zip',
                download: 'Master-Console-DVC-App-Independiente.zip',
                text: 'Descargar Master Console Libre (.zip · Otra App)',
              }),
              h('button', {
                type: 'button',
                class: 'chip',
                text: 'Aviso Legal · Jack Friedrich',
                onclick: () => openStartupLegalModal(true),
              })
            ),
            h(
              'details',
              { class: 'adv', style: 'margin-top:8px' },
              h('summary', { text: 'Pasos para instalar JF-Master-Studio-PRO.apk como OTRA APP en tu celular' }),
              h(
                'ol',
                { class: 'apk-steps' },
                h('li', { text: 'Crea un repositorio NUEVO en GitHub (ej. jf-master-studio-pro) y sube el ZIP descargado o exporta este proyecto.' }),
                h('li', { text: 'GitHub Actions generará JF-Master-Studio-PRO.apk con ID nuevo (com.jackfriedrich.masterstudiopro) e icono distinto en ~3 minutos.' }),
                h('li', { text: 'Descarga el APK desde Releases e instálalo: aparecerá como OTRA APP independiente junto a Estudio Master Hi-Res sin tocarla.' })
              )
            )
          )
        : h(
            'div',
            { class: 'card' },
            editionBar,
            h(
              'div',
              { class: 'chead' },
              h('h2', { text: 'Master Console DVC · Otra App Independiente (.apk)' }),
              h('span', { class: 'apk-badge', text: 'ID NUEVO · NO REEMPLAZA TU OTRA APP' })
            ),
            h('p', {
              class: 'hint',
              text: 'Aplicación libre 100% separada v2.0.0 (ID único: com.jackfriedrich.masterconsole) con nuevo icono propio, Consola Final DVC reparada y Audio Global Xiaomi HyperOS / Samsung corregido. Se instala como OTRA APP aparte sin reemplazar Estudio Master Hi-Res.',
            }),
            h(
              'div',
              { class: 'chips' },
              h('a', {
                class: 'btn pri',
                href: '/api/estudio-master-hires-android.zip',
                download: 'Master-Console-DVC-App-Independiente.zip',
                text: 'Descargar Master Console DVC (.zip · Otra App)',
              })
            ),
            h(
              'details',
              { class: 'adv', style: 'margin-top:8px' },
              h('summary', { text: 'Pasos para instalar Master-Console-DVC.apk como OTRA APP sin tocar la anterior' }),
              h(
                'ol',
                { class: 'apk-steps' },
                h('li', { text: 'Crea un repositorio NUEVO en GitHub (ej. master-console-dvc) y sube el ZIP descargado.' }),
                h('li', { text: 'GitHub Actions compilará Master-Console-DVC.apk con ID único (com.jackfriedrich.masterconsole) en ~3 minutos.' }),
                h('li', { text: 'Entra a Releases y descarga Master-Console-DVC.apk: se instalará aparte junto a tu app anterior sin sobrescribirla.' })
              )
            )
          );
      p.append(apkCard);
    } else if (IS_PRO_EDITION) {
      p.append(
        h(
          'div',
          { class: 'card' },
          h(
            'div',
            { class: 'chips' },
            h('button', {
              type: 'button',
              class: 'chip',
              text: 'Aviso Legal · Jack Friedrich',
              onclick: () => openStartupLegalModal(true),
            })
          )
        )
      );
    }

    /* Puerto Jack 3.5 mm · Salida Hi-Res Directa 1:1 (Sin remuestreo por software) */
    {
      const jackHead = h('div', { class: 'chead' }, h('h2', { text: 'Puerto Jack 3.5 mm · Salida Directa 1:1' }));
      const jackSw = h(
        'button',
        {
          class: 'sw',
          role: 'switch',
          type: 'button',
          'aria-label': 'Activar Salida Directa 1:1 para puerto Jack 3.5 mm',
          'aria-checked': String(!!S.jack.hiRes),
          onclick: () => {
            if (!S.jack.hiRes && !requireProAccess()) return;
            S.jack.hiRes = !S.jack.hiRes;
            S.jack.rate = 0;
            syncAll();
            applyAll(true);
            persistNow();
            toast(
              S.jack.hiRes
                ? 'Salida Directa 1:1 activa en reloj nativo del DAC'
                : 'Modo estándar activo'
            );
          },
        },
        h('i')
      );
      jackHead.append(jackSw);

      jackStatusEl = h('p', { class: 'hint num', style: 'color:var(--acc);margin-bottom:8px' });

      const syncChip = h('button', {
        class: 'chip',
        type: 'button',
        text: 'Reloj 1:1 Nativo DAC (0% remuestreo)',
        'aria-pressed': String(!!S.jack.hiRes),
        onclick: () => {
          S.jack.hiRes = true;
          S.jack.rate = 0;
          syncAll();
          applyAll(true);
          persistNow();
          toast('Sincronizado 1:1 con el reloj físico del DAC sin cortes');
        },
      });

      const ditherChip = h('button', {
        class: 'chip',
        type: 'button',
        text: 'Dithering Analógico 24-bit TPDF',
        'aria-pressed': String(!!S.jack.dither24),
        onclick: () => {
          S.jack.dither24 = !S.jack.dither24;
          syncAll();
          applyAll(true);
          persistNow();
          toast(
            S.jack.dither24
              ? 'Dithering C++ 24-bit TPDF activo en puerto Jack'
              : 'Dithering 24-bit desactivado'
          );
        },
      });

      syncers.push(() => {
        jackSw.setAttribute('aria-checked', String(!!S.jack.hiRes));
        syncChip.setAttribute('aria-pressed', String(!!S.jack.hiRes));
        ditherChip.setAttribute('aria-pressed', String(!!S.jack.dither24));
        paintJackStatus();
      });

      const jackCard = h(
        'div',
        { class: 'card', 'data-dsp-card': '1' },
        jackHead,
        jackStatusEl,
        h('div', { class: 'chips', style: 'margin-bottom:6px' }, syncChip, ditherChip),
        h('p', {
          class: 'mini',
          text: 'Trabaja bloqueado 1:1 al reloj físico real de tu DAC (48 kHz interno o 96/192 kHz en DAC USB-C dedicado) en C++ nativo sin forzar remuestreo artificial, garantizando cero cortes, cero aceleración y el mismo sonido exacto en web y app.',
        })
      );
      p.append(jackCard);
    }

    const playCard = card('play', 'Transición Gapless y Reproducción');
    playCard.c.dataset.dspCard = '1';
    const gaplessChip = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Gapless (0 ms)',
      'aria-pressed': String(!!S.play.gapless),
      onclick: () => {
        S.play.gapless = !S.play.gapless;
        syncAll();
        commit();
        persistNow();
        toast(S.play.gapless ? 'Transición sin pausa (Gapless) activa' : 'Gapless desactivado');
      },
    });
    const pitchChip = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Conservar tono',
      'aria-pressed': String(!!S.play.keepPitch),
      onclick: () => {
        S.play.keepPitch = !S.play.keepPitch;
        syncAll();
        commit();
        persistNow();
      },
    });
    const hz432Chip = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Afinación 432 Hz',
      'aria-pressed': String(!!S.play.hz432),
      onclick: () => {
        S.play.hz432 = !S.play.hz432;
        syncAll();
        commit();
        persistNow();
        toast(S.play.hz432 ? 'Afinación orgánica 432 Hz activa' : 'Afinación original 440 Hz (1.0×)');
      },
    });
    const resetSpeedBtn = h('button', {
      class: 'btn sm pri',
      type: 'button',
      hidden: true,
      text: 'Velocidad alterada · Toca para 1.00× normal',
      onclick: () => {
        S.play.rate = 1;
        S.play.hz432 = false;
        syncAll();
        commit();
        persistNow();
        toast('Velocidad restaurada a 1.00× Bit-Perfect');
      },
    });
    const speedAdvSummary = h('summary', { text: 'Velocidad y afinación avanzada (1.00× Bit-Perfect)' });
    syncers.push(() => {
      gaplessChip.setAttribute('aria-pressed', String(!!S.play.gapless));
      pitchChip.setAttribute('aria-pressed', String(!!S.play.keepPitch));
      hz432Chip.setAttribute('aria-pressed', String(!!S.play.hz432));
      const rateDiff = Math.abs((+S.play.rate || 1) - 1) > 0.005 || !!S.play.hz432;
      resetSpeedBtn.hidden = !rateDiff;
      if (rateDiff) {
        const lbl = (+S.play.rate || 1).toFixed(2) + '×' + (S.play.hz432 ? ' · 432 Hz' : '');
        resetSpeedBtn.textContent = 'Velocidad activa: ' + lbl + ' · Restaurar 1.00×';
        speedAdvSummary.textContent = 'Velocidad y afinación (' + lbl + ')';
      } else {
        speedAdvSummary.textContent = 'Velocidad y afinación avanzada (1.00× Bit-Perfect)';
      }
    });
    playCard.body.append(
      h('div', { class: 'chips', style: 'margin-bottom:6px' }, gaplessChip, resetSpeedBtn),
      row('play.xfade', 'Fundido cruzado (Crossfade)', { min: 0, max: 12, step: 0.5, fine: 0.5, unit: 's' }),
      h(
        'details',
        { class: 'adv' },
        speedAdvSummary,
        h('div', { class: 'chips', style: 'margin-bottom:6px' }, pitchChip, hz432Chip),
        row('play.rate', 'Velocidad de reproducción', { min: 0.5, max: 1.5, step: 0.01, fine: 0.01, unit: '×' })
      ),
      h('p', {
        class: 'mini',
        text: 'Doble lector en memoria: enlaza álbumes sin silencio (0 s) o mezcla suavemente en curva igual-potencia. En 1.00× permanece 100% bit-perfect.',
      })
    );

    const io = card('master', 'Mastering · Entrada y salida');
    io.c.dataset.dspCard = '1';
    const autoHeadBtn = h('button', {
      class: 'chip',
      type: 'button',
      text: 'Auto-Headroom inteligente',
      'aria-pressed': String(!!S.master.autoHead),
      onclick: () => {
        S.master.autoHead = !S.master.autoHead;
        syncAll();
        commit();
        persistNow();
        toast(S.master.autoHead ? 'Auto-Headroom activo (evita saturación)' : 'Auto-Headroom desactivado');
      },
    });
    syncers.push(() => autoHeadBtn.setAttribute('aria-pressed', String(!!S.master.autoHead)));
    io.body.append(
      h('div', { class: 'chips', style: 'margin-bottom:6px' }, autoHeadBtn),
      row('master.pre', 'Preamplificador', { min: -12, max: 12, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('master.vol', 'Salida maestra', { min: -12, max: 12, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('master.ceil', 'Techo Brickwall True-Peak', { min: -6.0, max: -0.1, step: 0.1, fine: 0.1, unit: 'dBFS' }),
      h('p', { class: 'mini', text: 'Limitador maestro Brickwall con anticipación de 2.5 ms y filtro subsónico DC a 12 Hz para máxima fidelidad sin distorsión.' })
    );
    p.append(
      playCard.c,
      io.c,
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Motor Mastering Ultra 64-bit · Datos Sin Comprimir' })),
        h('p', {
          class: 'hint',
          text: 'Cascada EQ en doble precisión IEEE-754 (64-bit Float64) con Bypass de Carga Cero, impulsos de estudio reales en WAV IEEE 32-bit Float sin compresión, matriz TPDF 24-bit dedicada y lectura nativa FLAC, WAV, AIFF, ALAC y OPUS.',
        }),
        h('p', {
          class: 'hint',
          text: 'Empaquetado nativo STORE (0% DEFLATE): el sistema mapea recursos, fuentes e impulsos directamente desde el almacenamiento flash sin gasto de CPU en descompresión.',
        })
      )
    );
  }

  /* ---------- Consola Master Independiente (Etapa Post-Master Final estilo Poweramp + Sistema Android) ---------- */
  let conCompReducEl: HTMLElement | null = null;
  {
    const p = mkPane('con');
    const isConLocked = () => !!(S.con.locked || S.locks.con);
    let selBand = 0;

    /* Helper SVG de Perilla Rotativa de Estudio (barrido 270° de -135° a +135°) */
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag: string, attrs: Record<string, string | number>) => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const k in attrs) el.setAttribute(k, String(attrs[k]));
      return el;
    };
    const polarPt = (deg: number, r = 42) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [50 + r * Math.cos(rad), 50 + r * Math.sin(rad)];
    };
    const describeArc = (startDeg: number, endDeg: number, r = 42) => {
      let a0 = startDeg;
      let a1 = endDeg;
      if (a1 < a0) {
        const tmp = a0;
        a0 = a1;
        a1 = tmp;
      }
      const span = clamp(a1 - a0, 0, 359.9);
      if (span < 0.35) return '';
      const [x0, y0] = polarPt(a0, r);
      const [x1, y1] = polarPt(a0 + span, r);
      const large = span > 180 ? 1 : 0;
      return (
        'M ' +
        x0.toFixed(2) +
        ' ' +
        y0.toFixed(2) +
        ' A ' +
        r +
        ' ' +
        r +
        ' 0 ' +
        large +
        ' 1 ' +
        x1.toFixed(2) +
        ' ' +
        y1.toFixed(2)
      );
    };

    interface RotaryKnobCfg {
      label: string;
      min: number;
      max: number;
      step: number;
      def: number;
      color: string;
      large?: boolean;
      bipolar?: boolean;
      log?: boolean;
      curvePow?: number;
      showZeroDot?: boolean;
      get: () => number;
      set: (v: number) => void;
      fmt: (v: number) => string;
    }

    function mkRotaryKnob(cfg: RotaryKnobCfg) {
      const dec = decs(cfg.step);
      const toNorm = (v: number) => {
        const cv2 = clamp(v, cfg.min, cfg.max);
        if (cfg.log && cfg.min > 0) {
          return clamp(Math.log(cv2 / cfg.min) / Math.log(cfg.max / cfg.min), 0, 1);
        }
        const lin = clamp((cv2 - cfg.min) / (cfg.max - cfg.min || 1), 0, 1);
        return cfg.curvePow ? Math.pow(lin, cfg.curvePow) : lin;
      };
      const fromNorm = (u: number) => {
        const cu = clamp(u, 0, 1);
        let raw: number;
        if (cfg.log && cfg.min > 0) {
          raw = cfg.min * Math.pow(cfg.max / cfg.min, cu);
        } else {
          const lin = cfg.curvePow ? Math.pow(cu, 1 / cfg.curvePow) : cu;
          raw = cfg.min + lin * (cfg.max - cfg.min);
        }
        const q = Math.round(raw / cfg.step) * cfg.step;
        return clamp(+q.toFixed(dec), cfg.min, cfg.max);
      };

      const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'knob-svg', 'aria-hidden': 'true' });
      const trackArc = svgEl('path', { class: 'knob-track-arc', d: describeArc(-135, 135, 42) });
      const valArc = svgEl('path', { class: 'knob-val-arc', d: '' });
      const face = svgEl('circle', { class: 'knob-face', cx: 50, cy: 50, r: 33 });
      const ptr = svgEl('line', { class: 'knob-ptr', x1: 50, y1: 23, x2: 50, y2: 30 });
      svg.append(trackArc, valArc, face, ptr);

      const touch = h(
        'div',
        {
          class: 'knob-touch',
          role: 'slider',
          tabindex: '0',
          'aria-label': cfg.label,
          'aria-valuemin': String(cfg.min),
          'aria-valuemax': String(cfg.max),
        },
        svg
      );
      touch.style.setProperty('--kcol', cfg.color);

      const lblEl = h('div', { class: 'knob-lbl', text: cfg.label });
      const valEl = h('div', { class: 'knob-readout num' });
      const cell = h('div', { class: 'knob-cell' + (cfg.large ? ' lg' : '') }, touch, lblEl, valEl);

      const paint = () => {
        const v = clamp(cfg.get(), cfg.min, cfg.max);
        const u = toNorm(v);
        const deg = -135 + u * 270;
        ptr.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' 50 50)');
        if (cfg.bipolar) {
          if (Math.abs(u - 0.5) < 0.008) {
            valArc.setAttribute('d', '');
          } else if (u > 0.5) {
            valArc.setAttribute('d', describeArc(0, deg, 42));
          } else {
            valArc.setAttribute('d', describeArc(deg, 0, 42));
          }
        } else {
          if (u <= 0.002 && !cfg.showZeroDot) {
            valArc.setAttribute('d', '');
          } else {
            const span = Math.max(4.5, u * 270);
            valArc.setAttribute('d', describeArc(-135, -135 + span, 42));
          }
        }
        const txt = cfg.fmt(v);
        valEl.textContent = txt;
        touch.setAttribute('aria-valuenow', String(v));
        touch.setAttribute('aria-valuetext', txt);
        touch.style.opacity = S.con.enabled !== false ? '1' : '0.45';
      };

      const applyNorm = (u: number, flush: boolean) => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        const nv = fromNorm(u);
        if (nv !== cfg.get()) {
          cfg.set(nv);
          paint();
          commit();
        }
        if (flush) persistNow();
      };

      let dragTouchId: number | null = null;
      let dragPid: number | null = null;
      let startY = 0;
      let startX = 0;
      let startU = 0;
      let lastTap = 0;

      const beginKnobGesture = (cx: number, cy: number) => {
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        const now = performance.now();
        if (now - lastTap < 280) {
          lastTap = 0;
          if (!isConLocked()) {
            cfg.set(cfg.def);
            paint();
            syncAll();
            commit();
            persistNow();
          } else {
            toast('Consola bloqueada');
          }
          return false;
        }
        lastTap = now;
        startX = cx;
        startY = cy;
        startU = toNorm(cfg.get());
        touch.classList.add('dragging');
        return true;
      };

      const moveKnobGesture = (cx: number, cy: number) => {
        const dy = startY - cy;
        const dx = (cx - startX) * 0.35;
        const sens = cfg.large ? 175 : 145;
        applyNorm(startU + (dy + dx) / sens, false);
      };

      const finishKnobGesture = () => {
        dragTouchId = null;
        dragPid = null;
        touch.classList.remove('dragging');
        persistNow();
      };

      /* Eventos táctiles directos sin retraso ni cancelación de scroll en celulares Android/iOS */
      touch.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          if (!e.changedTouches.length) return;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          const t = e.changedTouches[0];
          if (beginKnobGesture(t.clientX, t.clientY)) {
            dragTouchId = t.identifier;
          }
        },
        { passive: false }
      );
      touch.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (dragTouchId === null) return;
          for (let k = 0; k < e.changedTouches.length; k++) {
            const t = e.changedTouches[k];
            if (t.identifier === dragTouchId) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              moveKnobGesture(t.clientX, t.clientY);
              break;
            }
          }
        },
        { passive: false }
      );
      const onTouchEndKnob = (e: TouchEvent) => {
        if (dragTouchId === null) return;
        for (let k = 0; k < e.changedTouches.length; k++) {
          if (e.changedTouches[k].identifier === dragTouchId) {
            finishKnobGesture();
            break;
          }
        }
      };
      touch.addEventListener('touchend', onTouchEndKnob, { passive: true });
      touch.addEventListener('touchcancel', onTouchEndKnob, { passive: true });

      /* Respaldo Pointer Events en ventana para ratón / trackpad / lápiz */
      touch.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.pointerType === 'touch' && 'ontouchstart' in window) return;
        if (e.button > 0) return;
        e.preventDefault();
        if (!beginKnobGesture(e.clientX, e.clientY)) return;
        dragPid = e.pointerId;
        const onWinMove = (ev: PointerEvent) => {
          if (ev.pointerId !== dragPid) return;
          moveKnobGesture(ev.clientX, ev.clientY);
        };
        const onWinUp = (ev: PointerEvent) => {
          if (ev.pointerId !== dragPid) return;
          window.removeEventListener('pointermove', onWinMove);
          window.removeEventListener('pointerup', onWinUp);
          window.removeEventListener('pointercancel', onWinUp);
          finishKnobGesture();
        };
        window.addEventListener('pointermove', onWinMove);
        window.addEventListener('pointerup', onWinUp);
        window.addEventListener('pointercancel', onWinUp);
      });

      touch.addEventListener('keydown', (e: KeyboardEvent) => {
        const delta =
          e.key === 'ArrowUp' || e.key === 'ArrowRight'
            ? 0.02
            : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
              ? -0.02
              : 0;
        if (!delta) return;
        e.preventDefault();
        applyNorm(toNorm(cfg.get()) + delta, true);
      });

      syncers.push(paint);
      paint();
      return { cell, paint };
    }

    /* Color reactivo del tallo luminoso según ganancia (-15 a +15 dB) */
    const faderStemColors = (v: number): [string, string] => {
      if (v < -0.3) {
        return ['linear-gradient(180deg, #38F9D7 0%, #2589FF 100%)', 'rgba(37, 137, 255, 0.55)'];
      }
      if (v <= 3.5) {
        return ['linear-gradient(180deg, #42FF6B 0%, #00E04B 100%)', 'rgba(0, 230, 80, 0.52)'];
      }
      if (v <= 7.5) {
        return ['linear-gradient(180deg, #D9FF26 0%, #7CFF26 55%, #00E04B 100%)', 'rgba(180, 255, 45, 0.52)'];
      }
      return ['linear-gradient(180deg, #FFB81A 0%, #FFE026 52%, #9EFF26 100%)', 'rgba(255, 190, 30, 0.58)'];
    };

    const bandCols: HTMLElement[] = [];
    let syncParamBoxUi = () => {};

    function mkConsoleFader(
      bandIdx: number, // -1 para Preamp, 0..9 para bandas
      isPreamp: boolean,
      getVal: () => number,
      setVal: (v: number) => void
    ) {
      const marks = h('div', { class: 'cfmarks' });
      const rail = h('div', { class: 'cfrail' });
      const stem = h('div', { class: 'cfstem' });
      const cap = h('div', { class: 'cfcap' });
      const initLabel = isPreamp ? 'Preamp' : LABELS10[bandIdx];
      const track = h(
        'div',
        {
          class: 'cftrack',
          role: 'slider',
          tabindex: '0',
          'aria-label': isPreamp ? 'Preamp Consola' : 'Banda ' + initLabel + ' Consola',
          'aria-valuemin': '-15',
          'aria-valuemax': '15',
        },
        marks,
        rail,
        stem,
        cap
      );
      const freqLbl = h('div', { class: 'cffreq num', text: initLabel });
      const valLbl = h('div', { class: 'cfval num', text: '0.0' });
      const col = h('div', { class: 'cfcol' + (isPreamp ? ' is-preamp' : '') }, track, freqLbl, valLbl);

      const paint = () => {
        const v = clamp(getVal(), -15, 15);
        const pct = clamp((v + 15) / 30, 0, 1);
        const topPct = 14 + (1 - pct) * 72;
        cap.style.top = topPct.toFixed(2) + '%';
        const stemHeightPct = Math.max(2, 86 - topPct);
        stem.style.height = stemHeightPct.toFixed(2) + '%';
        const [grad, glow] = faderStemColors(v);
        stem.style.background = grad;
        stem.style.setProperty('--stem-glow', glow);
        stem.style.opacity = S.con.enabled !== false && S.con.eqOn ? '1' : '0.3';
        valLbl.textContent = v.toFixed(1);
        if (!isPreamp) {
          const fc = Array.isArray(S.con.bandFreqs) && isFinite(+S.con.bandFreqs[bandIdx])
            ? +S.con.bandFreqs[bandIdx]
            : BANDS10[bandIdx];
          freqLbl.textContent = S.con.paramMode ? fmtF(fc) : LABELS10[bandIdx];
          col.classList.toggle('sel', !!S.con.paramMode && selBand === bandIdx);
        }
        track.setAttribute('aria-valuenow', v.toFixed(1));
      };

      const setFromClientY = (clientY: number, flush: boolean) => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        const rect = track.getBoundingClientRect();
        const pad = rect.height * 0.14;
        const inner = Math.max(24, rect.height - pad * 2);
        const u = clamp(1 - (clientY - (rect.top + pad)) / inner, 0, 1);
        const nv = clamp(r1(-15 + u * 30), -15, 15);
        if (nv !== getVal()) {
          setVal(nv);
          S.con.presetName = 'Personalizado';
          paint();
          syncParamBoxUi();
          if (drawConCurveFn) drawConCurveFn();
          updatePresetBtnLabel();
          commit();
        }
        if (flush) persistNow();
      };

      let touchId: number | null = null;
      let pid: number | null = null;
      let lastTap = 0;

      const selectThisBand = () => {
        if (!isPreamp && selBand !== bandIdx) {
          selBand = bandIdx;
          bandCols.forEach((el, idx) => el.classList.toggle('sel', !!S.con.paramMode && idx === selBand));
          syncParamBoxUi();
        }
      };

      const beginFaderDrag = (clientY: number) => {
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        selectThisBand();
        const now = performance.now();
        if (now - lastTap < 280) {
          lastTap = 0;
          if (!isConLocked()) {
            setVal(0);
            S.con.presetName = 'Personalizado';
            paint();
            syncAll();
            commit();
            persistNow();
          } else {
            toast('Consola bloqueada');
          }
          return false;
        }
        lastTap = now;
        track.classList.add('dragging');
        setFromClientY(clientY, false);
        return true;
      };

      const finishFaderDrag = () => {
        touchId = null;
        pid = null;
        track.classList.remove('dragging');
        persistNow();
      };

      /* Touch nativo directo para arrastre fluido sin corte por scroll en celulares */
      track.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          if (!e.changedTouches.length) return;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          const t = e.changedTouches[0];
          if (beginFaderDrag(t.clientY)) {
            touchId = t.identifier;
          }
        },
        { passive: false }
      );
      track.addEventListener(
        'touchmove',
        (e: TouchEvent) => {
          if (touchId === null) return;
          for (let k = 0; k < e.changedTouches.length; k++) {
            const t = e.changedTouches[k];
            if (t.identifier === touchId) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              setFromClientY(t.clientY, false);
              break;
            }
          }
        },
        { passive: false }
      );
      const onTouchEndFader = (e: TouchEvent) => {
        if (touchId === null) return;
        for (let k = 0; k < e.changedTouches.length; k++) {
          if (e.changedTouches[k].identifier === touchId) {
            finishFaderDrag();
            break;
          }
        }
      };
      track.addEventListener('touchend', onTouchEndFader, { passive: true });
      track.addEventListener('touchcancel', onTouchEndFader, { passive: true });

      /* Pointer respaldo para escritorio */
      track.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.pointerType === 'touch' && 'ontouchstart' in window) return;
        if (e.button > 0) return;
        e.preventDefault();
        if (!beginFaderDrag(e.clientY)) return;
        pid = e.pointerId;
        const onWinMove = (ev: PointerEvent) => {
          if (ev.pointerId !== pid) return;
          setFromClientY(ev.clientY, false);
        };
        const onWinUp = (ev: PointerEvent) => {
          if (ev.pointerId !== pid) return;
          window.removeEventListener('pointermove', onWinMove);
          window.removeEventListener('pointerup', onWinUp);
          window.removeEventListener('pointercancel', onWinUp);
          finishFaderDrag();
        };
        window.addEventListener('pointermove', onWinMove);
        window.addEventListener('pointerup', onWinUp);
        window.addEventListener('pointercancel', onWinUp);
      });

      freqLbl.addEventListener('click', () => {
        selectThisBand();
      });

      track.addEventListener('keydown', (e: KeyboardEvent) => {
        const d =
          e.key === 'ArrowUp' ? 0.2 : e.key === 'ArrowDown' ? -0.2 : e.key === 'PageUp' ? 1 : e.key === 'PageDown' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        if (isConLocked()) return;
        selectThisBand();
        setVal(clamp(r1(getVal() + d), -15, 15));
        S.con.presetName = 'Personalizado';
        paint();
        syncParamBoxUi();
        if (drawConCurveFn) drawConCurveFn();
        updatePresetBtnLabel();
        commit();
        persistNow();
      });

      syncers.push(paint);
      paint();
      return col;
    }

    /* Helper compacto de control deslizante propio de Consola (independiente de SEC/row global) */
    function mkConSliderRow(cfg: {
      label: string;
      min: number;
      max: number;
      step: number;
      unit: string;
      log?: boolean;
      get: () => number;
      set: (v: number) => void;
    }) {
      const dec = decs(cfg.step);
      const valOut = h('span', { class: 'num', style: 'font-size:12.5px;color:var(--acc)' });
      const rng = h('input', {
        type: 'range',
        class: 'rfull',
        min: cfg.log ? 0 : cfg.min,
        max: cfg.log ? 1000 : cfg.max,
        step: cfg.log ? 1 : cfg.step,
        'aria-label': cfg.label,
      }) as HTMLInputElement;

      const toS = (v: number) => {
        const cv2 = clamp(v, cfg.min, cfg.max);
        return cfg.log ? Math.round((1000 * Math.log(cv2 / cfg.min)) / Math.log(cfg.max / cfg.min)) : cv2;
      };
      const fromS = (raw: string | number) => {
        if (!cfg.log) return +raw;
        const v = cfg.min * Math.pow(cfg.max / cfg.min, +raw / 1000);
        return cfg.step >= 1 ? Math.round(v) : +v.toFixed(dec);
      };
      const paint = () => {
        const v = clamp(cfg.get(), cfg.min, cfg.max);
        rng.value = String(toS(v));
        const mn = +rng.min || 0;
        const mx = +rng.max || 1;
        rng.style.setProperty('--p', clamp(((+rng.value - mn) / (mx - mn || 1)) * 100, 0, 100).toFixed(1) + '%');
        valOut.textContent = (cfg.unit === 'Hz' && v >= 1000 ? (v / 1000).toFixed(2) + ' kHz' : v.toFixed(dec) + (cfg.unit ? ' ' + cfg.unit : ''));
      };
      rng.addEventListener('input', () => {
        if (isConLocked()) {
          paint();
          toast('Consola bloqueada');
          return;
        }
        const nv = clamp(+(Math.round(fromS(rng.value) / cfg.step) * cfg.step).toFixed(dec), cfg.min, cfg.max);
        cfg.set(nv);
        paint();
        if (drawConCurveFn) drawConCurveFn();
        commit();
      });
      rng.addEventListener('change', () => persistNow());
      syncers.push(paint);
      paint();
      return h(
        'div',
        { class: 'prow', style: 'padding:6px 0' },
        h('div', { class: 'ptop' }, h('span', { class: 'pl', text: cfg.label }), valOut),
        rng
      );
    }

    /* ========== INTERRUPTOR GENERAL MAESTRO DE CONSOLA + NAVEGACIÓN 3 SUB-PÁGINAS ========== */
    const toggleAllConsolePower = () => {
      if (IS_PRO_EDITION && !hasProAccess()) {
        requireProAccess();
        return;
      }
      const nextOn = !(S.con.enabled !== false);
      S.con.enabled = nextOn;
      if (!nextOn) {
        // Al apagar el interruptor maestro de Consola se apaga TODO este apartado, incluyendo Audio Global si estaba activo
        S.con.globalEq = false;
        S.con.legacyHal = false;
        S.con.advTrack = false;
        S.con.sysWideMixExp = false;
      }
      syncAll();
      applyAll(true);
      flushNativeGlobalDspNow();
      persistNow();
      toast(
        nextOn
          ? 'Consola encendida · Mezclando en tiempo real con todo el Estudio'
          : 'Consola apagada por completo (0% procesado de Consola)'
      );
    };

    const conPowerSw = h(
      'button',
      {
        class: 'sw',
        role: 'switch',
        type: 'button',
        'aria-label': 'Interruptor General de Consola',
        'aria-checked': String(S.con.enabled !== false),
        onclick: toggleAllConsolePower,
      },
      h('i')
    );

    const conMasterPowerBadge = h('span', { class: 'con-master-power-badge num' });
    const conMasterPowerBtn = h('button', {
      type: 'button',
      class: 'con-master-power-btn',
      'aria-pressed': String(S.con.enabled !== false),
      onclick: toggleAllConsolePower,
    });

    const conMasterPowerStrip = h(
      'div',
      { class: 'con-master-power-strip', 'data-on': String(S.con.enabled !== false) },
      h(
        'div',
        { class: 'con-master-power-info' },
        h('strong', { text: 'Interruptor General de Consola' }),
        conMasterPowerBadge
      ),
      h('div', { class: 'con-master-power-actions' }, conMasterPowerBtn, conPowerSw)
    );

    const conLiveMixPill = h('div', { class: 'con-live-mix-pill num' });

    const conLockBtn = h('button', {
      type: 'button',
      class: 'ib',
      onclick: () => {
        S.con.locked = !S.con.locked;
        if (S.locks.con) delete S.locks.con;
        syncAll();
        persistNow();
        toast(S.con.locked ? 'Consola bloqueada independientemente' : 'Consola desbloqueada');
      },
    });

    const chainRouteStatus = h('span', { class: 'num' });

    const navEqBtn = h('button', { type: 'button', class: 'con-subnav-btn', role: 'tab', onclick: () => setSubPage('eq') });
    navEqBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 19v-6M10 19V7M15 19v-9M20 19V5"/></svg><span>Ecualizador</span>';
    const navCompBtn = h('button', { type: 'button', class: 'con-subnav-btn', role: 'tab', onclick: () => setSubPage('comp') });
    navCompBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 12L16.2 8.2"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg><span>Compresor</span>';
    const navCfgBtn = h('button', { type: 'button', class: 'con-subnav-btn', role: 'tab', onclick: () => setSubPage('cfg') });
    navCfgBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Sistema / DVC</span>';

    const subNav = h('div', { class: 'con-subnav', role: 'tablist', 'aria-label': 'Vistas de Consola' }, navEqBtn, navCompBtn, navCfgBtn);

    const shellBar = h(
      'div',
      { class: 'card con-shell-bar' },
      conMasterPowerStrip,
      h(
        'div',
        { class: 'con-shell-top' },
        h(
          'div',
          { class: 'con-shell-title' },
          h('strong', { text: 'Consola Master · Etapa Final Independiente' }),
          chainRouteStatus
        ),
        h('div', { class: 'cacts', style: 'margin-left:auto' }, conLockBtn)
      ),
      conLiveMixPill,
      subNav
    );

    const pageEq = h('div', { class: 'con-subpage' });
    const pageComp = h('div', { class: 'con-subpage', hidden: true });
    const pageCfg = h('div', { class: 'con-subpage', hidden: true });

    function setSubPage(sp: 'eq' | 'comp' | 'cfg') {
      S.con.subPage = sp;
      syncAll();
      persistNow();
      if (sp === 'eq' && drawConCurveFn) requestAnimationFrame(() => drawConCurveFn!());
    }

    /* ========== SUB-PÁGINA 1: ECUALIZADOR DVC + TONO DUAL + PREAJUSTES INDEPENDIENTES ========== */
    const CON_FACTORY_PRESETS: Array<{
      name: string;
      pre: number;
      bands: number[];
      bass: number;
      treb: number;
    }> = [
      { name: 'Plano 0.0 dB', pre: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bass: 0, treb: 0 },
      { name: 'Claridad Vocal Poweramp', pre: 0, bands: [0.0, 0.0, 0.0, 4.0, 6.4, 9.6, 9.7, 8.5, 8.4, 0.1], bass: 0, treb: 11 },
      { name: 'Subgraves Profundos DVC', pre: -1.5, bands: [7.8, 6.4, 3.4, 0.4, -0.8, 0.0, 1.5, 2.6, 3.2, 2.8], bass: 32, treb: 14 },
      { name: 'Punch & Presencia V', pre: -1.0, bands: [4.5, 3.8, 1.5, -0.6, -1.2, 0.6, 2.6, 4.2, 4.8, 3.6], bass: 18, treb: 18 },
      { name: 'Escena Acústica Hi-Fi', pre: 0, bands: [1.4, 1.8, 0.8, -0.5, 0.6, 2.2, 3.8, 4.5, 5.2, 4.0], bass: 8, treb: 16 },
      { name: 'Cine & Impacto', pre: -2.0, bands: [8.6, 7.0, 3.0, -1.0, -1.5, 1.2, 3.2, 4.4, 4.8, 3.6], bass: 38, treb: 22 },
    ];

    const presetBtn = h('button', {
      type: 'button',
      class: 'con-preset-btn',
      text: 'Preajuste',
    });
    const updatePresetBtnLabel = () => {
      const nm = S.con.presetName || 'Plano 0.0 dB';
      presetBtn.textContent = nm === 'Plano 0.0 dB' ? 'Preajuste · Plano' : 'Preajuste · ' + nm;
    };

    const modeGraphChip = h('button', {
      type: 'button',
      class: 'chip',
      text: 'Gráfico 10B',
      onclick: () => {
        S.con.paramMode = false;
        syncAll();
        commit();
        persistNow();
      },
    });
    const modeParamChip = h('button', {
      type: 'button',
      class: 'chip',
      text: 'Paramétrico (Frec + Q)',
      onclick: () => {
        if (!requireProAccess()) return;
        S.con.paramMode = true;
        syncAll();
        commit();
        persistNow();
      },
    });
    const smoothBtn = h('button', {
      type: 'button',
      class: 'ib',
      text: 'Suavizar',
      onclick: () => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        const src = S.con.bands.slice();
        for (let i = 0; i < 10; i++) {
          const prev = src[Math.max(0, i - 1)];
          const next = src[Math.min(9, i + 1)];
          S.con.bands[i] = r1(prev * 0.22 + src[i] * 0.56 + next * 0.22);
        }
        S.con.presetName = 'Personalizado';
        syncAll();
        commit();
        persistNow();
      },
    });
    const zeroConEqBtn = h('button', {
      type: 'button',
      class: 'ib',
      text: 'Cero EQ',
      onclick: () => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        S.con.pre = 0;
        S.con.bands = Array(10).fill(0);
        S.con.bass = 0;
        S.con.treb = 0;
        S.con.presetName = 'Plano 0.0 dB';
        syncAll();
        commit();
        persistNow();
        toast('Ecualizador y Tono de Consola en 0.0 dB (el resto del Estudio no cambió)');
      },
    });

    const conStrip = h('div', { class: 'con-strip' });
    conStrip.append(
      mkConsoleFader(
        -1,
        true,
        () => +S.con.pre || 0,
        (v) => {
          S.con.pre = v;
        }
      )
    );
    for (let bi = 0; bi < 10; bi++) {
      const bCol = mkConsoleFader(
        bi,
        false,
        () => +S.con.bands[bi] || 0,
        (v) => {
          S.con.bands[bi] = v;
        }
      );
      bandCols.push(bCol);
      conStrip.append(bCol);
    }

    /* Inspector Paramétrico por Banda (visible cuando Modo Paramétrico está activo) */
    const paramBandTitle = h('strong', { class: 'num', style: 'font-size:12.5px;color:var(--acc)' });
    const paramFreqSlider = mkConSliderRow({
      label: 'Frecuencia de banda seleccionada',
      min: 20,
      max: 20000,
      step: 1,
      unit: 'Hz',
      log: true,
      get: () => (Array.isArray(S.con.bandFreqs) && isFinite(+S.con.bandFreqs[selBand]) ? +S.con.bandFreqs[selBand] : BANDS10[selBand]),
      set: (v) => {
        S.con.bandFreqs[selBand] = v;
        S.con.presetName = 'Personalizado';
        syncAll();
      },
    });
    const paramQSlider = mkConSliderRow({
      label: 'Factor Q (ancho de campana)',
      min: 0.25,
      max: 10.0,
      step: 0.05,
      unit: 'Q',
      get: () => (Array.isArray(S.con.bandQs) && isFinite(+S.con.bandQs[selBand]) ? +S.con.bandQs[selBand] : 1.41),
      set: (v) => {
        S.con.bandQs[selBand] = v;
        S.con.presetName = 'Personalizado';
      },
    });
    const paramGainSlider = mkConSliderRow({
      label: 'Ganancia exacta de banda',
      min: -15,
      max: 15,
      step: 0.1,
      unit: 'dB',
      get: () => +S.con.bands[selBand] || 0,
      set: (v) => {
        S.con.bands[selBand] = v;
        S.con.presetName = 'Personalizado';
        syncAll();
      },
    });

    const paramBox = h(
      'div',
      { class: 'con-param-box', hidden: !S.con.paramMode },
      h(
        'div',
        { class: 'con-param-head' },
        paramBandTitle,
        h(
          'div',
          { class: 'cacts' },
          h('button', {
            type: 'button',
            class: 'ib',
            text: '◀ Banda',
            onclick: () => {
              selBand = (selBand + 9) % 10;
              syncAll();
            },
          }),
          h('button', {
            type: 'button',
            class: 'ib',
            text: 'Banda ▶',
            onclick: () => {
              selBand = (selBand + 1) % 10;
              syncAll();
            },
          }),
          h('button', {
            type: 'button',
            class: 'ib',
            text: 'ISO Fábrica',
            onclick: () => {
              if (isConLocked()) return;
              S.con.bandFreqs = BANDS10.slice();
              S.con.bandQs = Array(10).fill(1.41);
              syncAll();
              commit();
              persistNow();
              toast('Frecuencias ISO 31–16k y Q=1.41 restaurados');
            },
          })
        )
      ),
      paramFreqSlider,
      paramQSlider,
      paramGainSlider
    );

    syncParamBoxUi = () => {
      paramBox.hidden = !S.con.paramMode;
      const fc = Array.isArray(S.con.bandFreqs) ? +S.con.bandFreqs[selBand] || BANDS10[selBand] : BANDS10[selBand];
      const qv = Array.isArray(S.con.bandQs) ? +S.con.bandQs[selBand] || 1.41 : 1.41;
      const gv = +S.con.bands[selBand] || 0;
      paramBandTitle.textContent =
        'Banda #' + (selBand + 1) + ' · ' + fmtHz(fc) + ' · Q ' + qv.toFixed(2) + ' · ' + (gv >= 0 ? '+' : '') + gv.toFixed(1) + ' dB';
    };

    /* Gráfica dual en vivo: muestra la curva entrante del Estudio Principal + la curva propia de Consola */
    const curveCanvas = h('canvas', { class: 'con-curve', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    const curveCtx = curveCanvas.getContext('2d');
    const vizInlineBtn = h('button', {
      type: 'button',
      class: 'con-viz-btn',
      'aria-pressed': String(S.con.vizOn !== false),
      onclick: () => {
        S.con.vizOn = !S.con.vizOn;
        syncAnalyserConnection();
        syncAll();
        persistNow();
        if (drawConCurveFn) drawConCurveFn();
      },
    });
    const paintVizBtn = () => {
      const on = S.con.vizOn !== false;
      vizInlineBtn.setAttribute('aria-pressed', String(on));
      vizInlineBtn.textContent = on ? '● Espectro + Curva Final' : '○ Habilitar visualización';
    };

    drawConCurveFn = () => {
      if (!curveCtx || !isUiAwake()) return;
      const rect = curveCanvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const cw = Math.round(rect.width * dpr);
      const ch = Math.round(rect.height * dpr);
      if (curveCanvas.width !== cw || curveCanvas.height !== ch) {
        curveCanvas.width = cw;
        curveCanvas.height = ch;
      }
      if (vizDirty || !conResp || !studioResp) calcResp();
      curveCtx.clearRect(0, 0, cw, ch);

      const midY = ch * 0.54;
      curveCtx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      curveCtx.lineWidth = 1;
      curveCtx.beginPath();
      curveCtx.moveTo(0, midY);
      curveCtx.lineTo(cw, midY);
      curveCtx.stroke();

      /* Barras de espectro post-consola si la visualización está activa */
      if (S.con.vizOn !== false && audio && !audio.paused && freqData && ctx) {
        const nb = 28;
        const bw = cw / nb;
        const sr = ctx.sampleRate || 48000;
        curveCtx.fillStyle = 'rgba(56, 249, 215, 0.19)';
        for (let i = 0; i < nb; i++) {
          const f0 = 25 * Math.pow(720, i / nb);
          const f1 = 25 * Math.pow(720, (i + 1) / nb);
          const a = Math.floor((f0 / (sr / 2)) * freqData.length);
          const b = Math.max(a + 1, Math.ceil((f1 / (sr / 2)) * freqData.length));
          let pk = 0;
          for (let k = a; k < b && k < freqData.length; k++) if (freqData[k] > pk) pk = freqData[k];
          const bh = (pk / 255) * (ch * 0.84);
          curveCtx.fillRect(i * bw + 1, ch - bh, Math.max(1, bw - 2), bh);
        }
      }

      /* Curva tenue punteada: referencia del Estudio Principal entrando a Consola */
      if (studioResp) {
        let hasStudio = false;
        for (let i = 0; i < VIZ_N; i += 3) {
          if (Math.abs(studioResp[i]) > 0.2) {
            hasStudio = true;
            break;
          }
        }
        if (hasStudio) {
          curveCtx.save();
          curveCtx.beginPath();
          for (let i = 0; i < VIZ_N; i++) {
            const x = (i / (VIZ_N - 1)) * cw;
            const y = clamp(midY - (clamp(studioResp[i], -18, 18) / 18) * (ch * 0.42), 3 * dpr, ch - 3 * dpr);
            if (i === 0) curveCtx.moveTo(x, y);
            else curveCtx.lineTo(x, y);
          }
          curveCtx.strokeStyle = 'rgba(0, 229, 255, 0.36)';
          curveCtx.setLineDash([4 * dpr, 3 * dpr]);
          curveCtx.lineWidth = 1.4 * dpr;
          curveCtx.stroke();
          curveCtx.restore();
        }
      }

      /* Curva Principal en Tiempo Real: Salida Combinada (Estudio Principal + Consola Final) */
      const activeOutCurve = S.con.enabled !== false ? resp : studioResp;
      if (activeOutCurve) {
        let maxAbsDb = 0;
        let maxBoostDb = 0;
        for (let i = 0; i < VIZ_N; i++) {
          const av = Math.abs(activeOutCurve[i]);
          if (av > maxAbsDb) maxAbsDb = av;
          if (activeOutCurve[i] > maxBoostDb) maxBoostDb = activeOutCurve[i];
        }
        const grad = curveCtx.createLinearGradient(0, 0, cw, 0);
        if (S.con.enabled === false) {
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.65)');
          grad.addColorStop(1, 'rgba(148, 163, 184, 0.65)');
        } else if (maxBoostDb > 4.5) {
          grad.addColorStop(0, '#00E65B');
          grad.addColorStop(0.4, '#A8FF24');
          grad.addColorStop(0.76, '#FFB81A');
          grad.addColorStop(1, '#00E65B');
        } else if (maxAbsDb > 0.15) {
          grad.addColorStop(0, '#00E65B');
          grad.addColorStop(0.5, '#38F9D7');
          grad.addColorStop(1, '#2589FF');
        } else {
          grad.addColorStop(0, 'rgba(56, 249, 215, 0.72)');
          grad.addColorStop(1, 'rgba(37, 137, 255, 0.72)');
        }

        curveCtx.save();
        curveCtx.beginPath();
        for (let i = 0; i < VIZ_N; i++) {
          const x = (i / (VIZ_N - 1)) * cw;
          const y = clamp(midY - (clamp(activeOutCurve[i], -18, 18) / 18) * (ch * 0.42), 3.5 * dpr, ch - 3.5 * dpr);
          if (i === 0) curveCtx.moveTo(x, y);
          else curveCtx.lineTo(x, y);
        }
        curveCtx.strokeStyle = grad;
        curveCtx.lineWidth = 2.4 * dpr;
        curveCtx.stroke();
        curveCtx.restore();
      }
    };

    const graphWrap = h('div', { class: 'con-graph-wrap' }, vizInlineBtn, curveCanvas);

    /* Gestor de Preajustes EXCLUSIVO de Consola (100% independiente de Presets del Estudio) */
    const conPresetNameIn = h('input', {
      type: 'text',
      class: 'field',
      placeholder: 'Nombre del preajuste de Consola...',
      maxlength: 36,
    }) as HTMLInputElement;
    const conUserPresetsBox = h('div');
    const conJsonArea = h('textarea', {
      class: 'field',
      placeholder: 'JSON exclusivo de Consola para respaldar o pegar...',
      style: 'min-height:64px;margin-top:6px',
    }) as HTMLTextAreaElement;
    const conJsonWrap = h('details', { class: 'adv' }, h('summary', { text: 'Exportar / Importar JSON solo de Consola' }), conJsonArea);

    function renderConPresetList() {
      if (!Array.isArray(store.conPresets) || !store.conPresets.length) {
        conUserPresetsBox.replaceChildren(
          h('div', { class: 'mini', text: 'Aún no tienes preajustes propios guardados en la Consola.' })
        );
        return;
      }
      conUserPresetsBox.replaceChildren(
        ...store.conPresets.map((pr: any, idx: number) =>
          prRow(
            pr.name || 'Consola #' + (idx + 1),
            'Preajuste completo de Consola (EQ + Tono + Compresor)',
            () => {
              if (isConLocked()) {
                toast('Consola bloqueada');
                return;
              }
              const keepGlobal = !!S.con.globalEq;
              const keepSysMix = !!S.con.sysWideMixExp;
              const keepLegacy = !!S.con.legacyHal;
              const keepLink = S.con.linkStudioGlobal !== false;
              SEC.con.set(S, pr.data || {});
              S.con.globalEq = keepGlobal;
              S.con.sysWideMixExp = keepSysMix;
              S.con.legacyHal = keepLegacy;
              S.con.linkStudioGlobal = keepLink;
              S.con.presetName = pr.name;
              S.con.subPage = 'eq';
              syncAll();
              commit();
              persistNow();
              toast('Consola aplicada: ' + pr.name);
            },
            () => {
              store.conPresets.splice(idx, 1);
              persistNow();
              renderConPresetList();
              toast('Preajuste eliminado de Consola');
            },
            () => {
              pr.data = SEC.con.get(S);
              pr.ts = Date.now();
              S.con.presetName = pr.name;
              persistNow();
              renderConPresetList();
              syncAll();
              toast('Sobrescrito en Consola: ' + pr.name);
            }
          )
        )
      );
    }

    const factoryConChips = h('div', { class: 'chips' });
    CON_FACTORY_PRESETS.forEach((fp) => {
      factoryConChips.append(
        h('button', {
          type: 'button',
          class: 'chip',
          text: fp.name,
          onclick: () => {
            if (isConLocked()) {
              toast('Consola bloqueada');
              return;
            }
            S.con.enabled = true;
            S.con.eqOn = true;
            S.con.toneOn = true;
            S.con.pre = fp.pre;
            S.con.bands = fp.bands.slice();
            S.con.bandFreqs = BANDS10.slice();
            S.con.bandQs = Array(10).fill(1.41);
            S.con.bass = fp.bass;
            S.con.treb = fp.treb;
            S.con.presetName = fp.name;
            syncAll();
            commit();
            persistNow();
            toast('Curva de Consola: ' + fp.name);
          },
        })
      );
    });

    conJsonWrap.append(
      h(
        'div',
        { class: 'chips', style: 'margin-top:6px' },
        h('button', {
          type: 'button',
          class: 'btn sm',
          text: 'Generar respaldo Consola',
          onclick: () => {
            conJsonArea.value = JSON.stringify(
              { consoleApp: 'estudio-master-con-v1', current: SEC.con.get(S), presets: store.conPresets },
              null,
              2
            );
            toast('JSON de Consola listo para copiar');
          },
        }),
        h('button', {
          type: 'button',
          class: 'btn sm pri',
          text: 'Importar en Consola',
          onclick: () => {
            try {
              const parsed = JSON.parse(conJsonArea.value);
              if (parsed.current) {
                SEC.con.set(S, parsed.current);
              }
              if (Array.isArray(parsed.presets)) {
                parsed.presets.forEach((item: any) => {
                  if (item && item.name && item.data) {
                    store.conPresets.push({ name: String(item.name).slice(0, 36), ts: Date.now(), data: item.data });
                  }
                });
              }
              renderConPresetList();
              syncAll();
              commit();
              persistNow();
              toast('Ajustes de Consola importados');
            } catch (_e) {
              toast('JSON inválido');
            }
          },
        })
      )
    );

    const presetDrawer = h(
      'div',
      { class: 'con-preset-panel', hidden: true },
      h('span', { class: 'mini', text: 'Curvas integradas Poweramp (solo afectan a la Consola Final):' }),
      factoryConChips,
      h(
        'div',
        { class: 'chips' },
        conPresetNameIn,
        h('button', {
          type: 'button',
          class: 'btn sm pri',
          text: 'Guardar en Consola',
          onclick: () => {
            const nm = (conPresetNameIn.value || '').trim() || 'Consola ' + stamp();
            S.con.presetName = nm;
            store.conPresets.unshift({ name: nm, ts: Date.now(), data: SEC.con.get(S) });
            conPresetNameIn.value = '';
            persistNow();
            renderConPresetList();
            syncAll();
            toast('Guardado en Consola: ' + nm);
          },
        })
      ),
      conUserPresetsBox,
      conJsonWrap
    );
    renderConPresetList();

    presetBtn.addEventListener('click', () => {
      presetDrawer.hidden = !presetDrawer.hidden;
      if (!presetDrawer.hidden) renderConPresetList();
    });

    const moreBtn = h('button', {
      type: 'button',
      class: 'con-more-btn',
      'aria-label': 'Ir a Ajustes DVC y Audio Nativo del Sistema',
      onclick: () => setSubPage('cfg'),
    });
    moreBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

    const buildGlobalExpWarn = () =>
      h(
        'div',
        { class: 'con-exp-warn' },
        h('strong', { text: 'En desarrollo (Beta) · Posible falla o corte según celular y app' }),
        h('p', {
          text: 'En Spotify, YouTube Music y VLC funciona vía sesión oficial; si en Xiaomi HyperOS o Samsung se corta al instante, activa abajo “Modo Compatibilidad HyperOS / OEM (HAL)” y apaga Dolby Atmos / Xiaomi Sound en Ajustes de sonido. Apps cerradas (WhatsApp, TikTok, Juegos) bloquean el acceso externo por seguridad de Android 10–15; el reproductor interno funciona al 100%.',
        })
      );

    const globalBadgeBtn = h('button', {
      type: 'button',
      class: 'chip',
      style: 'align-self:center;font-size:11.5px;letter-spacing:0.04em;min-height:30px;padding:0 12px',
      onclick: () => {
        if (!S.con.globalEq && !requireProAccess()) return;
        S.con.globalEq = !S.con.globalEq;
        syncAll();
        commit();
        flushNativeGlobalDspNow();
        persistNow();
        toast(
          S.con.globalEq
            ? NATIVE
              ? 'Audio Externo Beta activo · Si se corta en tu ROM usa Modo Compatibilidad HAL en Sistema/DVC'
              : 'Audio Externo Beta marcado (en desarrollo · puede variar según celular al instalar el APK)'
            : 'Audio Externo desactivado'
        );
      },
    });

    const ecuBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      text: 'Ecu',
      onclick: () => {
        if (isConLocked()) return;
        S.con.eqOn = !S.con.eqOn;
        syncAll();
        commit();
        persistNow();
      },
    });
    const toneBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      text: 'Tono',
      onclick: () => {
        if (isConLocked()) return;
        S.con.toneOn = !(S.con.toneOn !== false);
        syncAll();
        commit();
        persistNow();
      },
    });
    const limitBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      text: 'Límit',
      onclick: () => {
        if (isConLocked()) return;
        S.con.limOn = !(S.con.limOn !== false);
        syncAll();
        commit();
        persistNow();
      },
    });
    const waveBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      'aria-label': 'Alternar ondas del espectro',
      onclick: () => {
        S.con.vizOn = !(S.con.vizOn !== false);
        syncAnalyserConnection();
        syncAll();
        persistNow();
        if (drawConCurveFn) drawConCurveFn();
      },
    });
    waveBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 13v-2M8 16V8M12 19V5M16 16V8M20 13v-2"/></svg>';

    const gravesKnob = mkRotaryKnob({
      label: 'Graves',
      min: 0,
      max: 100,
      step: 1,
      def: 0,
      color: '#2589FF',
      get: () => +S.con.bass || 0,
      set: (v) => {
        S.con.bass = v;
        if (drawConCurveFn) drawConCurveFn();
      },
      fmt: (v) => Math.round(v) + '%',
    });

    const agudosKnob = mkRotaryKnob({
      label: 'Agudos',
      min: 0,
      max: 100,
      step: 1,
      def: 0,
      color: '#2589FF',
      get: () => +S.con.treb || 0,
      set: (v) => {
        S.con.treb = v;
        if (drawConCurveFn) drawConCurveFn();
      },
      fmt: (v) => Math.round(v) + '%',
    });

    const toneAdvDetails = h(
      'details',
      { class: 'adv con-tone-adv' },
      h('summary', { text: 'Frecuencia y Q de Graves / Agudos (Poweramp Tone)' }),
      mkConSliderRow({
        label: 'Frecuencia central de Graves',
        min: 20,
        max: 250,
        step: 1,
        unit: 'Hz',
        log: true,
        get: () => +S.con.bassFreq || 90,
        set: (v) => {
          S.con.bassFreq = v;
        },
      }),
      mkConSliderRow({
        label: 'Ancho Q de Graves',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        unit: 'Q',
        get: () => +S.con.bassQ || 0.8,
        set: (v) => {
          S.con.bassQ = v;
        },
      }),
      mkConSliderRow({
        label: 'Frecuencia central de Agudos',
        min: 2000,
        max: 16000,
        step: 50,
        unit: 'Hz',
        log: true,
        get: () => +S.con.trebFreq || 10000,
        set: (v) => {
          S.con.trebFreq = v;
        },
      }),
      mkConSliderRow({
        label: 'Ancho Q de Agudos',
        min: 0.25,
        max: 2.5,
        step: 0.05,
        unit: 'Q',
        get: () => +S.con.trebQ || 0.75,
        set: (v) => {
          S.con.trebQ = v;
        },
      })
    );

    const faderCard = h(
      'div',
      { class: 'card con-fader-card' },
      h(
        'div',
        { class: 'chead' },
        h('div', { class: 'chips' }, modeGraphChip, modeParamChip),
        h('div', { class: 'cacts' }, smoothBtn, zeroConEqBtn)
      ),
      conStrip,
      paramBox,
      graphWrap,
      h(
        'div',
        { class: 'con-master-bar' },
        buildGlobalExpWarn(),
        globalBadgeBtn,
        h('div', { class: 'con-top-actions' }, presetBtn, moreBtn),
        presetDrawer,
        h(
          'div',
          { class: 'con-bottom-deck' },
          h('div', { class: 'con-pill-stack' }, ecuBtn, toneBtn, limitBtn, waveBtn),
          h('div', { class: 'con-tone-knobs' }, gravesKnob.cell, agudosKnob.cell)
        ),
        toneAdvDetails
      )
    );
    pageEq.append(faderCard);

    /* ========== SUB-PÁGINA 2: COMPRESOR POWERAMP 6 PERILLAS (LR4) + BALANCE + ESTÉREO + VOLUMEN ========== */
    const compGrid = h(
      'div',
      { class: 'knob-grid-6' },
      mkRotaryKnob({
        label: 'Ataque',
        min: 0.1,
        max: 250,
        step: 0.1,
        def: 2.5,
        color: '#2589FF',
        showZeroDot: true,
        get: () => +S.con.attack || 2.5,
        set: (v) => {
          S.con.attack = v;
        },
        fmt: (v) => v.toFixed(1) + 'ms',
      }).cell,
      mkRotaryKnob({
        label: 'Lanzamiento',
        min: 1.0,
        max: 1500,
        step: 0.5,
        def: 17.0,
        color: '#2589FF',
        showZeroDot: true,
        get: () => +S.con.release || 17.0,
        set: (v) => {
          S.con.release = v;
        },
        fmt: (v) => v.toFixed(1) + 'ms',
      }).cell,
      mkRotaryKnob({
        label: 'Proporción',
        min: 1.0,
        max: 20.0,
        step: 0.1,
        def: 8.7,
        color: '#FF8C1A',
        curvePow: 0.36,
        showZeroDot: true,
        get: () => +S.con.ratio || 8.7,
        set: (v) => {
          S.con.ratio = v;
        },
        fmt: (v) => v.toFixed(1),
      }).cell,
      mkRotaryKnob({
        label: 'Frecuencia',
        min: 20,
        max: 20000,
        step: 10,
        def: 20000,
        color: '#FF4D1A',
        log: true,
        showZeroDot: true,
        get: () => +S.con.freq || 20000,
        set: (v) => {
          S.con.freq = v;
        },
        fmt: (v) => (v >= 1000 ? (v / 1000).toFixed(1) + 'K' : Math.round(v) + 'Hz'),
      }).cell,
      mkRotaryKnob({
        label: 'Límite',
        min: -90.0,
        max: 0.0,
        step: 0.5,
        def: -50.0,
        color: '#00E66B',
        showZeroDot: true,
        get: () => (isFinite(+S.con.thresh) ? +S.con.thresh : -50.0),
        set: (v) => {
          S.con.thresh = v;
        },
        fmt: (v) => v.toFixed(1) + 'dB',
      }).cell,
      mkRotaryKnob({
        label: 'Ganancia',
        min: -10.0,
        max: 45.0,
        step: 0.5,
        def: 0.0,
        color: '#EAE218',
        showZeroDot: true,
        get: () => (isFinite(+S.con.gain) ? +S.con.gain : 0),
        set: (v) => {
          S.con.gain = v;
        },
        fmt: (v) => v.toFixed(1) + 'dB',
      }).cell
    );

    const compPowerBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      style: 'min-width:146px;min-height:44px',
      text: 'Compresor',
      onclick: () => {
        if (isConLocked()) return;
        if (!S.con.compOn && !requireProAccess()) return;
        S.con.compOn = !S.con.compOn;
        syncAll();
        commit();
        persistNow();
        toast(S.con.compOn ? 'Compresor Final LR4 activo' : 'Compresor de Consola en bypass puro');
      },
    });

    const loadRefCompBtn = h('button', {
      type: 'button',
      class: 'chip',
      text: 'Perfil Poweramp (2.5ms · 17ms · 8.7 · -50dB · +35dB)',
      onclick: () => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        if (!requireProAccess()) return;
        S.con.enabled = true;
        S.con.compOn = true;
        S.con.attack = 2.5;
        S.con.release = 17.0;
        S.con.ratio = 8.7;
        S.con.freq = 20000;
        S.con.thresh = -50.0;
        S.con.gain = 35.0;
        syncAll();
        commit();
        persistNow();
        toast('Compresor Poweramp calibrado cargado');
      },
    });

    conCompReducEl = h('div', {
      class: 'mini num',
      text: 'Bypass de carga cero (0.0 dB)',
    });

    const balKnob = mkRotaryKnob({
      label: 'Balance',
      min: -1.0,
      max: 1.0,
      step: 0.01,
      def: 0.0,
      color: '#38F9D7',
      large: true,
      bipolar: true,
      get: () => +S.con.balance || 0,
      set: (v) => {
        S.con.balance = v;
      },
      fmt: (v) => (Math.abs(v) < 0.005 ? '0.00' : (v > 0 ? '+' : '') + v.toFixed(2)),
    });

    const stereoExpKnob = mkRotaryKnob({
      label: 'Expansión X',
      min: 0,
      max: 200,
      step: 1,
      def: 100,
      color: '#C084FC',
      large: true,
      bipolar: true,
      get: () => (isFinite(+S.con.stereoWidth) ? +S.con.stereoWidth : 100),
      set: (v) => {
        S.con.stereoWidth = Math.round(v);
      },
      fmt: (v) => Math.round(v) + '%',
    });

    const volKnob = mkRotaryKnob({
      label: 'Volumen Consola',
      min: 0,
      max: 100,
      step: 1,
      def: 100,
      color: '#2589FF',
      large: true,
      get: () => clamp(isFinite(+S.con.conVol) ? +S.con.conVol : 100, 0, 100),
      set: (v) => {
        S.con.conVol = Math.round(v);
        if (NATIVE && S.con.globalEq && window.AndroidBridge?.setHardwareVolumePct) {
          try {
            window.AndroidBridge.setHardwareVolumePct(S.con.conVol);
          } catch (_e) {}
        }
      },
      fmt: (v) => Math.round(v) + '%',
    });

    const resetRotaryBtn = h('button', {
      type: 'button',
      class: 'con-toggle-btn',
      style: 'min-height:44px;padding:0 18px',
      text: 'Restablecer',
      onclick: () => {
        if (isConLocked()) {
          toast('Consola bloqueada');
          return;
        }
        S.con.compOn = false;
        S.con.attack = 2.5;
        S.con.release = 17.0;
        S.con.ratio = 8.7;
        S.con.freq = 20000;
        S.con.thresh = -50.0;
        S.con.gain = 0.0;
        S.con.balance = 0.0;
        S.con.stereoWidth = 100;
        S.con.conVol = 100;
        syncAll();
        commit();
        persistNow();
        toast('Compresor, Expansión Estéreo, Balance y Volumen de Consola restaurados');
      },
    });

    const rotaryCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'chead' }, h('h2', { text: 'Compresor Dinámico LR4 · Balance y Salida Final' })),
      compGrid,
      h('div', { class: 'comp-power-row' }, compPowerBtn, loadRefCompBtn, conCompReducEl),
      h(
        'div',
        { class: 'master-dials-wrap' },
        h('div', { class: 'con-dual-knobs' }, balKnob.cell, stereoExpKnob.cell),
        h('div', { class: 'vol-reset-row' }, volKnob.cell, resetRotaryBtn)
      )
    );
    pageComp.append(rotaryCard);

    /* ========== SUB-PÁGINA 3: AUDIO NATIVO DE TODO EL SISTEMA ANDROID + MOTOR DVC ========== */
    const mkDvcSwitchRow = (
      title: string,
      desc: string,
      getter: () => boolean,
      setter: (v: boolean) => void
    ) => {
      const sw = h(
        'button',
        {
          class: 'sw',
          role: 'switch',
          type: 'button',
          'aria-label': title,
          'aria-checked': String(getter()),
          onclick: () => {
            setter(!getter());
            syncAll();
            commit();
            persistNow();
          },
        },
        h('i')
      );
      syncers.push(() => sw.setAttribute('aria-checked', String(getter())));
      return h('div', { class: 'dvc-row' }, h('div', { class: 'dvc-meta' }, h('b', { text: title }), h('span', { text: desc })), sw);
    };

    const globalStatusLine = h('p', {
      class: 'hint num',
      style: 'color:var(--acc);margin-bottom:6px',
    });

    updateGlobalStatusUi = () => {
      if (!NATIVE || !window.AndroidBridge?.getGlobalDspStatus) {
        globalStatusLine.textContent =
          'Web / Vista previa: la Consola procesa al 100% toda la cadena interna. En Android APK, el enlace a apps externas (Spotify, YT Music, VLC) está en fase Beta experimental y depende de las restricciones de audio de cada marca.';
        return;
      }
      try {
        const st = JSON.parse(window.AndroidBridge.getGlobalDspStatus());
        const players: string[] = Array.isArray(st.activePlayers) ? st.activePlayers : [];
        const s0On = !!st.sessionZeroAttached;
        const eng = st.sessionZeroEngine || (st.legacyHalMode ? 'HAL Compatibilidad OEM' : 'DynamicsProcessing C++ 64-bit');
        const hijacked = !!st.oemControlHijacked;
        const bypassZero = !!st.internalPlayerBypassingZero;
        if (!st.globalEnabled) {
          globalStatusLine.textContent =
            'Motor Interno 64-bit activo al 100% · Activa el interruptor si deseas probar el enlace Beta con reproductores externos compatibles.';
        } else {
          const parts: string[] = [];
          if (bypassZero) {
            parts.push('Reproductor Hi-Res interno sonando al 100% (cero doble ecualización)');
          } else if (players.length) {
            parts.push('Apps enlazadas (' + eng + '): ' + players.join(', '));
          } else if (s0On) {
            parts.push('Modo Legacy Sesión 0 activo (' + eng + ')');
          } else {
            parts.push('Esperando sesión compatible (abre Spotify / YT Music / VLC y cambia o pausa/reproduce pista)');
          }
          if (hijacked) {
            parts.push('Aviso: Dolby Atmos / Xiaomi Sound del celular intentó bloquear el DSP; usa Modo Compatibilidad HAL y apaga efectos nativos de Android');
          }
          globalStatusLine.textContent = parts.join(' · ');
        }
      } catch (_e) {
        globalStatusLine.textContent = 'Motor Nativo C++ listo.';
      }
    };

    const sysActionsRow = h('div', { class: 'chips', style: 'margin-top:8px' });
    sysActionsRow.append(
      h('button', {
        type: 'button',
        class: 'btn sm pri',
        text: 'Re-enlazar Audio del Sistema Ahora',
        onclick: () => {
          if (!requireProAccess()) return;
          S.con.globalEq = true;
          syncAll();
          // Envía primero el snapshot matemático exacto sin temporizador diferido para evitar cortes de 85 ms
          clearTimeout(applyTimer);
          if (ctx) applyAllNow();
          flushNativeGlobalDspNow();
          persistNow();
          if (NATIVE && window.AndroidBridge?.forceRebindGlobalDsp) {
            try {
              window.AndroidBridge.forceRebindGlobalDsp();
            } catch (_e) {}
            setTimeout(() => {
              if (updateGlobalStatusUi) updateGlobalStatusUi();
            }, 160);
            toast('Sesiones compatibles sincronizadas sin corte · Si tu ROM corta el efecto, activa abajo Modo Compatibilidad HAL');
          } else {
            toast('En el APK Android sincroniza sesiones abiertas de Spotify / YT Music / VLC');
          }
        },
      })
    );
    if (NATIVE) {
      sysActionsRow.append(
        h('button', {
          type: 'button',
          class: 'chip',
          text: '2° plano sin restricción de batería',
          onclick: () => {
            try {
              window.AndroidBridge?.openBatterySettings?.();
            } catch (_e) {}
          },
        }),
        h('button', {
          type: 'button',
          class: 'chip',
          text: 'Ajustes de sonido de Android',
          onclick: () => {
            try {
              window.AndroidBridge?.openSystemEqualizerSettings?.();
            } catch (_e) {}
          },
        })
      );
    }

    const sysNativeCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'chead' }, h('h2', { text: 'Audio Nativo de Todo el Sistema Android' })),
      buildGlobalExpWarn(),
      h('div', { class: 'con-sys-box' }, globalStatusLine, sysActionsRow),
      mkDvcSwitchRow(
        'Procesar Todo el Audio del Sistema (Global)',
        'Siempre inicia APAGADO: presiónalo manualmente cuando quieras enlazar reproductores compatibles (Spotify, YT Music, VLC).',
        () => !!S.con.globalEq,
        (v) => {
          if (v && !requireProAccess()) return;
          S.con.globalEq = v;
          flushNativeGlobalDspNow();
        }
      ),
      mkDvcSwitchRow(
        'Modo Compatibilidad Xiaomi HyperOS / Samsung (HAL Nativo)',
        'Siempre inicia APAGADO: actívalo manualmente si en tu celular el efecto externo suena medio segundo y se corta.',
        () => !!S.con.legacyHal,
        (v) => {
          if (v && !requireProAccess()) return;
          S.con.legacyHal = v;
          flushNativeGlobalDspNow();
        }
      ),
      mkDvcSwitchRow(
        'Seguimiento avanzado de sesiones externas',
        'Siempre inicia APAGADO: actívalo manualmente si deseas detectar cambios de pista entre Spotify, YT Music y VLC.',
        () => !!S.con.advTrack,
        (v) => {
          if (v && !requireProAccess()) return;
          S.con.advTrack = v;
          flushNativeGlobalDspNow();
        }
      ),
      mkDvcSwitchRow(
        'Modo Legacy Sesión 0 (Experimental · Solo Android antiguo)',
        'Siempre inicia APAGADO: mantenlo desactivado en Android 10–15 y HyperOS salvo prueba manual en dispositivos antiguos.',
        () => !!S.con.sysWideMixExp,
        (v) => {
          if (v && !requireProAccess()) return;
          S.con.sysWideMixExp = v;
          flushNativeGlobalDspNow();
        }
      )
    );

    const dvcEngineCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'chead' }, h('h2', { text: 'Control de Volumen Directo (DVC) y Precisión' })),
      mkDvcSwitchRow(
        'Control de Volumen Directo (DVC)',
        'Calcula margen dinámico de alta precisión según los realces de EQ y Tono para evitar saturación o bombeo digital.',
        () => S.con.dvc !== false,
        (v) => {
          S.con.dvc = v;
        }
      ),
      mkConSliderRow({
        label: 'Atenuación preventiva cuando DVC está apagado',
        min: -12,
        max: 0,
        step: 0.5,
        unit: 'dB',
        get: () => (isFinite(+S.con.noDvcGain) ? +S.con.noDvcGain : -4.0),
        set: (v) => {
          S.con.noDvcGain = v;
        },
      }),
      mkConSliderRow({
        label: 'Ancho Q global en modo Gráfico 10B',
        min: 0.5,
        max: 4.0,
        step: 0.05,
        unit: 'Q',
        get: () => (isFinite(+S.con.bandQGlobal) ? +S.con.bandQGlobal : 1.41),
        set: (v) => {
          S.con.bandQGlobal = v;
        },
      })
    );

    pageCfg.append(sysNativeCard, dvcEngineCard);

    syncers.push(() => {
      const en = S.con.enabled !== false;
      const lck = isConLocked();
      const sp = S.con.subPage === 'comp' || S.con.subPage === 'cfg' ? S.con.subPage : 'eq';

      p.classList.toggle('con-is-off', !en);
      conMasterPowerStrip.dataset.on = String(en);
      conMasterPowerBadge.textContent = en ? '● CONSOLA ENCENDIDA' : '○ CONSOLA APAGADA';
      conMasterPowerBtn.setAttribute('aria-pressed', String(en));
      conMasterPowerBtn.textContent = en ? 'Apagar Todo Consola' : 'Prender Consola';

      conPowerSw.setAttribute('aria-checked', String(en));
      conLockBtn.setAttribute('aria-pressed', String(lck));
      conLockBtn.innerHTML = (lck ? ICON_LOCK : ICON_OPEN) + '<span>' + (lck ? 'Bloqueada' : 'Libre') + '</span>';

      // Resumen en vivo de los módulos del Estudio que se están mezclando hacia la Consola en tiempo real
      const activeMixMods: string[] = [];
      if (!S.bypass) {
        if (S.eq.some((v: number) => Math.abs(v) >= 0.05)) activeMixMods.push('EQ 30');
        if (S.cl.some((v: number) => Math.abs(v) >= 0.05)) activeMixMods.push('Claridad 16');
        let instCnt = 0;
        for (const ik in S.inst) if (Math.abs(+S.inst[ik]?.g || 0) >= 0.05) instCnt++;
        if (instCnt > 0) activeMixMods.push('Instrumentos (' + instCnt + ')');
        const fxActiveNames: string[] = [];
        if (Math.abs(S.fx.tone.bass) >= 0.05 || Math.abs(S.fx.tone.treb) >= 0.05 || S.fx.tone.lc > 20.5 || S.fx.tone.hc < 19950) {
          fxActiveNames.push('Tono');
        }
        (
          ['comp', 'mbcomp', 'deess', 'sat', 'airexc', 'bmono', 'xfeed', 'wid', 'rev', 'dly', 'sp', 'sub', 'glass', 'harm', 'trem', 'vibr'] as const
        ).forEach((fk) => {
          if (S.fx[fk]?.on) fxActiveNames.push(FXN[fk]?.split(' ')[0] || fk);
        });
        if (fxActiveNames.length) activeMixMods.push('Efectos (' + fxActiveNames.length + ')');
      }
      if (!en) {
        conLiveMixPill.textContent = 'Consola APAGADA · El audio pasa limpio desde el Estudio sin etapa final de Consola';
      } else if (S.bypass) {
        conLiveMixPill.textContent = 'Audio Original → Consola Activa (mueve cualquier otro apartado para mezclarlo al instante)';
      } else if (activeMixMods.length) {
        conLiveMixPill.textContent = 'Mezcla en Tiempo Real activa: ' + activeMixMods.join(' + ') + ' → Consola Final';
      } else {
        conLiveMixPill.textContent = 'Mezcla en Tiempo Real: Estudio + Consola (todo cambio en otros apartados entra directo aquí)';
      }

      chainRouteStatus.textContent = en
        ? (S.bypass ? 'Audio Original → Consola Final ACTIVA → Salida' : 'Estudio Principal → Consola Final ACTIVA → Salida')
        : 'Consola en Bypass Puro · Pasa directo desde Estudio Principal';

      navEqBtn.setAttribute('aria-selected', String(sp === 'eq'));
      navCompBtn.setAttribute('aria-selected', String(sp === 'comp'));
      navCfgBtn.setAttribute('aria-selected', String(sp === 'cfg'));
      pageEq.hidden = sp !== 'eq';
      pageComp.hidden = sp !== 'comp';
      pageCfg.hidden = sp !== 'cfg';

      modeGraphChip.setAttribute('aria-pressed', String(!S.con.paramMode));
      modeParamChip.setAttribute('aria-pressed', String(!!S.con.paramMode));
      ecuBtn.setAttribute('aria-pressed', String(!!S.con.eqOn));
      toneBtn.setAttribute('aria-pressed', String(S.con.toneOn !== false));
      limitBtn.setAttribute('aria-pressed', String(S.con.limOn !== false));
      waveBtn.setAttribute('aria-pressed', String(S.con.vizOn !== false));
      compPowerBtn.setAttribute('aria-pressed', String(!!S.con.compOn));

      globalBadgeBtn.setAttribute('aria-pressed', String(en && !!S.con.globalEq));
      globalBadgeBtn.textContent =
        en && S.con.globalEq ? 'AUDIO SISTEMA GLOBAL · ACTIVO' : 'ACTIVAR AUDIO DE TODO EL SISTEMA (MANUAL)';

      paintVizBtn();
      updatePresetBtnLabel();
      syncParamBoxUi();
      if (conCompReducEl && (!en || !S.con.compOn)) {
        conCompReducEl.textContent = 'Bypass de carga cero (0.0 dB)';
      }
      if (updateGlobalStatusUi) updateGlobalStatusUi();
      if (drawConCurveFn && sp === 'eq') drawConCurveFn();
    });

    p.append(shellBar, pageEq, pageComp, pageCfg);
  }

  /* EQ 30 */
  mkPane('eq30').append(
    eqTab({
      key: 'eq30',
      arr: 'eq',
      rk: 'r30',
      qk: 'q30',
      pqk: 'propQ30',
      freqs: BANDS30,
      names: null,
      title: 'EQ de 30 bandas',
      hint: '1/3 de octava ISO, de 25 Hz a 20 kHz. Q Proporcional adapta suavemente la campana según la ganancia como en consolas de mastering.',
    })
  );

  /* Claridad 16 */
  mkPane('cl16').append(
    eqTab({
      key: 'cl16',
      arr: 'cl',
      rk: 'r16',
      qk: 'q16',
      pqk: 'propQ16',
      freqs: BANDS16,
      names: NAMES16,
      title: '16 bandas de claridad',
      hint: 'Bandas musicales de fase limpia: graves firmes, medios sin barro y aire cristalino hasta 16 kHz.',
    })
  );

  /* Instrumentos (Sin texto de ayuda, sub-elementos seccionados como notificaciones ultra-transparentes + iluminación cristalina exclusiva) */
  {
    const p = mkPane('inst');
    const instSavedGain: Record<string, number> = {};

    const quickBar = h('div', { class: 'inst-quick-bar' });
    const instCards: Array<{
      grp: string;
      cardEl: HTMLElement;
      toggleBtn: HTMLButtonElement;
      jumpChip: HTMLButtonElement;
      setExpanded: (open: boolean) => void;
      isExpanded: () => boolean;
    }> = [];

    const toggleAllBtn = h('button', {
      type: 'button',
      class: 'btn sm inst-jump-chip',
      text: 'Desplegar todos',
      onclick: () => {
        const anyCollapsed = instCards.some((ic) => !ic.isExpanded());
        instCards.forEach((ic) => ic.setExpanded(anyCollapsed));
        syncToggleAllLabel();
        if (IS_PRO_EDITION) applyCertifiedDomTranslation(p, currentLang);
      },
    }) as HTMLButtonElement;

    function syncToggleAllLabel() {
      const allOpen = instCards.every((ic) => ic.isExpanded());
      toggleAllBtn.textContent = allOpen ? 'Contraer todos' : 'Desplegar todos';
    }

    quickBar.append(toggleAllBtn);
    p.append(quickBar);

    INST.forEach((g) => {
      const { c, body } = card(g.grp, g.name);
      c.classList.add('inst-card', 'collapsed');

      const headEl = c.querySelector('.chead') as HTMLElement | null;
      const h2El = headEl?.querySelector('h2') as HTMLElement | null;
      const activeMeta = h('span', { class: 'inst-active-meta num', text: 'Plana' });
      const chevSpan = h('span', { 'aria-hidden': 'true' });
      chevSpan.innerHTML =
        '<svg class="inst-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

      const toggleBtn = h(
        'button',
        {
          type: 'button',
          class: 'inst-toggle-hit',
          'aria-expanded': 'false',
        },
        chevSpan.firstElementChild as Node,
        h2El || h('h2', { text: g.name }),
        activeMeta
      ) as HTMLButtonElement;

      if (headEl) {
        headEl.prepend(toggleBtn);
      }

      const jumpChip = h('button', {
        type: 'button',
        class: 'chip inst-jump-chip',
        text: g.name,
        'aria-pressed': 'false',
        onclick: () => {
          const opening = c.classList.contains('collapsed');
          setExpanded(opening);
          syncToggleAllLabel();
          if (IS_PRO_EDITION) applyCertifiedDomTranslation(p, currentLang);
          if (opening) {
            requestAnimationFrame(() => c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
          }
        },
      }) as HTMLButtonElement;

      const setExpanded = (open: boolean) => {
        c.classList.toggle('collapsed', !open);
        toggleBtn.setAttribute('aria-expanded', String(open));
        jumpChip.setAttribute('aria-pressed', String(open));
      };

      toggleBtn.addEventListener('click', () => {
        setExpanded(c.classList.contains('collapsed'));
        syncToggleAllLabel();
        if (IS_PRO_EDITION) applyCertifiedDomTranslation(p, currentLang);
      });

      quickBar.append(jumpChip);
      instCards.push({
        grp: g.grp,
        cardEl: c,
        toggleBtn,
        jumpChip,
        setExpanded,
        isExpanded: () => !c.classList.contains('collapsed'),
      });

      g.items.forEach(([id, nm]) => {
        const gainRowEl = row('inst.' + id + '.g', nm, { min: -18, max: 18, step: 0.1, fine: 0.1, unit: 'dB' });
        const ptopLabel = gainRowEl.querySelector('.pl') as HTMLElement | null;
        const dotEl = h('span', { class: 'inst-crystal-dot', 'aria-hidden': 'true' });
        if (ptopLabel) {
          ptopLabel.classList.add('inst-notif-title');
          ptopLabel.prepend(dotEl);
        }

        const subCrystalSw = h('button', {
          type: 'button',
          class: 'inst-crystal-sw num',
          'aria-pressed': 'false',
          text: 'OFF',
          onclick: () => {
            if (S.locks[g.grp]) return;
            if (IS_PRO_EDITION && !hasProAccess()) {
              requireProAccess();
              return;
            }
            const curG = +S.inst[id]?.g || 0;
            if (Math.abs(curG) >= 0.05) {
              instSavedGain[id] = curG;
              S.inst[id].g = 0;
            } else {
              const restore = Math.abs(instSavedGain[id] || 0) >= 0.05 ? instSavedGain[id] : 3.2;
              S.inst[id].g = restore;
            }
            syncAll();
            commit();
            persistNow();
          },
        }) as HTMLButtonElement;

        const ptopEl = gainRowEl.querySelector('.ptop') as HTMLElement | null;
        const pvEl = gainRowEl.querySelector('.pv') as HTMLElement | null;
        if (ptopEl && pvEl) {
          pvEl.append(subCrystalSw);
        }

        const notifCard = h(
          'div',
          { class: 'inst-notif-card' },
          gainRowEl,
          h(
            'details',
            { class: 'adv' },
            h('summary', { text: 'Frecuencia y Q · ' + nm }),
            row('inst.' + id + '.f', 'Frecuencia', { min: 20, max: 20000, step: 1, fine: 1, unit: 'Hz', log: true }),
            row('inst.' + id + '.q', 'Q', { min: 0.3, max: 12, step: 0.05, fine: 0.05, unit: 'Q' })
          )
        );

        syncers.push(() => {
          const curG = +S.inst[id]?.g || 0;
          const isOn = !S.bypass && Math.abs(curG) >= 0.05;
          if (Math.abs(curG) >= 0.05) instSavedGain[id] = curG;
          notifCard.classList.toggle('is-crystal-on', isOn);
          subCrystalSw.setAttribute('aria-pressed', String(isOn));
          subCrystalSw.textContent = isOn ? 'ON' : 'OFF';
        });

        body.append(notifCard);
      });

      syncers.push(() => {
        let activeCount = 0;
        g.items.forEach(([id]) => {
          if (Math.abs(+S.inst[id]?.g || 0) >= 0.05) activeCount++;
        });
        const anyLit = !S.bypass && activeCount > 0;
        c.classList.toggle('has-crystal-on', anyLit);
        jumpChip.classList.toggle('has-crystal-on', anyLit);
        activeMeta.dataset.active = String(anyLit);
        activeMeta.textContent = activeCount > 0 ? activeCount + ' activas' : 'Plana';
      });

      p.append(c);
    });
  }

  /* Efectos */
  let reduc: HTMLElement | null = null;
  let mbReduc: HTMLElement | null = null;
  let deReduc: HTMLElement | null = null;
  let radar: HTMLCanvasElement | null = null;
  {
    const p = mkPane('fx');
    const tone = card('tone', FXN.tone);
    tone.body.append(
      row('fx.tone.bass', 'Graves (repisa)', { min: -24, max: 24, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.tone.bassF', 'Frecuencia de graves', { min: 30, max: 400, step: 1, fine: 1, unit: 'Hz', log: true }),
      row('fx.tone.treb', 'Agudos (repisa)', { min: -24, max: 24, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.tone.trebF', 'Frecuencia de agudos', { min: 2000, max: 16000, step: 10, fine: 10, unit: 'Hz', log: true }),
      row('fx.tone.lc', 'Corte de graves (pasa altos)', { min: 20, max: 500, step: 1, fine: 1, unit: 'Hz', log: true }),
      row('fx.tone.hc', 'Corte de agudos (pasa bajos)', { min: 2000, max: 20000, step: 10, fine: 10, unit: 'Hz', log: true })
    );

    const mbcomp = card('mbcomp', FXN.mbcomp, { on: true });
    mbReduc = h('span', { class: 'mini num', text: 'Graves 0.0 · Medios 0.0 · Agudos 0.0 dB' });
    mbcomp.body.append(
      mbReduc,
      row('fx.mbcomp.lowX', 'Cruce graves / medios', { min: 60, max: 400, step: 1, fine: 1, unit: 'Hz', log: true }),
      row('fx.mbcomp.highX', 'Cruce medios / agudos', { min: 1200, max: 8000, step: 10, fine: 10, unit: 'Hz', log: true }),
      row('fx.mbcomp.lowTh', 'Umbral graves', { min: -60, max: 0, step: 0.5, fine: 0.1, unit: 'dB' }),
      row('fx.mbcomp.midTh', 'Umbral medios', { min: -60, max: 0, step: 0.5, fine: 0.1, unit: 'dB' }),
      row('fx.mbcomp.highTh', 'Umbral agudos', { min: -60, max: 0, step: 0.5, fine: 0.1, unit: 'dB' }),
      row('fx.mbcomp.ratio', 'Proporción multibanda', { min: 1, max: 12, step: 0.1, fine: 0.1, unit: ': 1' }),
      row('fx.mbcomp.lowG', 'Ganancia banda graves', { min: -12, max: 12, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.mbcomp.midG', 'Ganancia banda medios', { min: -12, max: 12, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.mbcomp.highG', 'Ganancia banda agudos', { min: -12, max: 12, step: 0.1, fine: 0.1, unit: 'dB' }),
      h('p', { class: 'mini', text: 'Controla los bombos y subgraves de forma independiente sin apagar la voz ni los platillos.' })
    );

    const deess = card('deess', FXN.deess, { on: true });
    deReduc = h('span', { class: 'mini num', text: 'Atenuación sibilante 0.0 dB' });
    deess.body.append(
      deReduc,
      row('fx.deess.freq', 'Frecuencia vocal (S / Sh)', { min: 3500, max: 11000, step: 50, fine: 10, unit: 'Hz', log: true }),
      row('fx.deess.th', 'Sensibilidad (umbral)', { min: -55, max: 0, step: 0.5, fine: 0.1, unit: 'dB' }),
      row('fx.deess.amt', 'Suavizado dinámico', { min: 1, max: 16, step: 0.2, fine: 0.1, unit: ': 1' }),
      h('p', { class: 'mini', text: 'Domina únicamente los chispazos de las “S” fuertes conservando todo el brillo cuando no hay sibilancia.' })
    );

    const comp = card('comp', FXN.comp, { on: true });
    reduc = h('span', { class: 'mini num', text: 'Reducción 0.0 dB' });
    comp.body.append(
      reduc,
      row('fx.comp.th', 'Umbral', { min: -100, max: 0, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.comp.ratio', 'Proporción', { min: 1, max: 20, step: 0.1, fine: 0.1, unit: ': 1' }),
      row('fx.comp.attack', 'Ataque', { min: 0, max: 1000, step: 1, fine: 1, unit: 'ms' }),
      row('fx.comp.release', 'Liberación', { min: 0, max: 1000, step: 1, fine: 1, unit: 'ms' }),
      row('fx.comp.knee', 'Rodilla', { min: 0, max: 40, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.comp.makeup', 'Ganancia de compensación', { min: 0, max: 24, step: 0.1, fine: 0.1, unit: 'dB' })
    );

    const sat = card('sat', FXN.sat, { on: true });
    const satModes = [
      [0, 'Cinta cálida'],
      [1, 'Válvula Triodo'],
      [2, 'Consola Punch'],
    ] as Array<[number, string]>;
    const satChips = h('div', { class: 'chips', style: 'margin-bottom:6px' });
    const satBtns = satModes.map(([m, lbl]) =>
      h('button', {
        class: 'chip',
        type: 'button',
        text: lbl,
        'aria-pressed': String((S.fx.sat.mode | 0) === m),
        onclick: () => {
          S.fx.sat.mode = m;
          syncAll();
          commit();
          persistNow();
        },
      })
    );
    satChips.append(...satBtns);
    syncers.push(() => {
      satBtns.forEach((b, idx) => b.setAttribute('aria-pressed', String((S.fx.sat.mode | 0) === idx)));
    });
    sat.body.append(
      satChips,
      row('fx.sat.drive', 'Empuje armónico', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.sat.mix', 'Mezcla paralela', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      h('p', { class: 'mini', text: 'Sobremuestreo 4× y curva de 32,768 puntos sin aliasing digital.' })
    );

    const airexc = card('airexc', FXN.airexc, { on: true });
    airexc.body.append(
      row('fx.airexc.freq', 'Banda de aire superior', { min: 5000, max: 15000, step: 100, fine: 20, unit: 'Hz', log: true }),
      row('fx.airexc.drive', 'Síntesis armónica 4×', { min: 0, max: 100, step: 0.5, fine: 0.1, unit: '%' }),
      row('fx.airexc.mix', 'Brillo sedoso (Mezcla)', { min: 0, max: 100, step: 0.5, fine: 0.1, unit: '%' }),
      h('p', { class: 'mini', text: 'Reconstruye armónicos cristalinos en 4× oversampling sin levantar el soplido de fondo como un EQ normal.' })
    );

    const bmono = card('bmono', FXN.bmono, { on: true });
    bmono.body.append(
      row('fx.bmono.freq', 'Corte subgrave elíptico', { min: 35, max: 220, step: 1, fine: 1, unit: 'Hz' }),
      row('fx.bmono.mono', 'Centrado mono en subgraves', { min: 0, max: 100, step: 1, fine: 1, unit: '%' }),
      h('p', { class: 'mini', text: 'Alinea la fase por debajo de la frecuencia elegida para que los dos audífonos o bocinas empujen al unísono con el doble de firmeza.' })
    );

    const xfeed = card('xfeed', FXN.xfeed, { on: true });
    xfeed.body.append(
      row('fx.xfeed.mix', 'Mezcla natural', { min: 0, max: 100, step: 1, fine: 1, unit: '%' }),
      row('fx.xfeed.fc', 'Sombra acústica', { min: 350, max: 1400, step: 10, fine: 10, unit: 'Hz' }),
      h('p', { class: 'mini', text: 'Simula monitores de estudio frente a ti (retardo interaural de 0.28 ms) eliminando la fatiga en audífonos.' })
    );

    const wid = card('wid', FXN.wid, { on: true });
    wid.body.append(
      row('fx.wid.w', 'Ancho Mid/Side', { min: -100, max: 200, step: 1, fine: 1, unit: '%' }),
      h('p', { class: 'mini', text: '0 conserva el estéreo original. Negativo centra a mono; positivo expande la escena.' })
    );

    const rev = card('rev', FXN.rev, { on: true });
    const revIrModes: Array<[number, string]> = [
      [0, 'Paramétrico 64-bit'],
      [1, 'Sala Mastering WAV 32f'],
      [2, 'Placa EMT WAV 32f'],
      [3, 'Cámara Madera WAV 32f'],
      [4, 'Auditorio HD WAV 32f'],
    ];
    const revIrChips = h('div', { class: 'chips', style: 'margin-bottom:6px' });
    const revParamBox = h(
      'div',
      {},
      row('fx.rev.decay', 'Duración', { min: 0.1, max: 10, step: 0.01, fine: 0.01, unit: 's' }),
      row('fx.rev.damp', 'Absorción de agudos', { min: 0, max: 100, step: 1, fine: 1, unit: '%' }),
      row('fx.rev.size', 'Tamaño de sala', { min: 0, max: 100, step: 1, fine: 1, unit: '%' })
    );
    const revIrDesc = h('p', {
      class: 'mini',
      text: 'Convolución estéreo HD con reflexiones tempranas discretas y limpieza de graves a 65 Hz.',
    });
    const revIrBtns = revIrModes.map(([m, lbl]) =>
      h('button', {
        class: 'chip',
        type: 'button',
        text: lbl,
        'aria-pressed': String((S.fx.rev.irMode | 0) === m),
        onclick: () => {
          S.fx.rev.irMode = m;
          if (m > 0 && ctx && STUDIO_WAV_IRS[m]) {
            loadStudioWavBuffer(ctx, STUDIO_WAV_IRS[m].file);
          }
          syncAll();
          commit();
          persistNow();
        },
      })
    );
    revIrChips.append(...revIrBtns);
    syncers.push(() => {
      const m = S.fx.rev.irMode | 0;
      revIrBtns.forEach((b, idx) => b.setAttribute('aria-pressed', String(m === revIrModes[idx][0])));
      revParamBox.hidden = m > 0;
      revIrDesc.textContent =
        m > 0 && STUDIO_WAV_IRS[m]
          ? STUDIO_WAV_IRS[m].desc
          : 'Convolución estéreo HD ajustable al instante con reflexiones tempranas discretas y limpieza subsónica a 65 Hz.';
    });
    rev.body.append(
      revIrChips,
      row('fx.rev.mix', 'Mezcla', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.rev.pre', 'Pre-retardo', { min: 0, max: 500, step: 1, fine: 1, unit: 'ms' }),
      revParamBox,
      revIrDesc
    );

    const dly = card('dly', FXN.dly, { on: true });
    dly.body.append(
      row('fx.dly.time', 'Tiempo', { min: 1, max: 2000, step: 1, fine: 1, unit: 'ms' }),
      row('fx.dly.fb', 'Repeticiones', { min: 0, max: 95, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.dly.mix', 'Mezcla', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.dly.tone', 'Tono de repeticiones', { min: 500, max: 20000, step: 10, fine: 10, unit: 'Hz', log: true })
    );

    const sp = card('sp', FXN.sp, { on: true });
    radar = h('canvas', {
      class: 'radar',
      width: 264,
      height: 264,
      role: 'img',
      'aria-label': 'Posición del sonido alrededor de ti, vista desde arriba',
    }) as HTMLCanvasElement;
    sp.body.append(
      radar,
      row('fx.sp.mix', 'Mezcla 3D', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.sp.az', 'Ángulo (0° al frente)', { min: -180, max: 180, step: 1, fine: 1, unit: '°' }),
      row('fx.sp.el', 'Altura', { min: -90, max: 90, step: 1, fine: 1, unit: '°' }),
      row('fx.sp.dist', 'Distancia', { min: 0.5, max: 10, step: 0.1, fine: 0.1, unit: 'm' }),
      row('fx.sp.rot', 'Giro automático (8D)', { min: -60, max: 60, step: 0.1, fine: 0.1, unit: 'rpm' }),
      h('p', { class: 'mini', text: 'Motor posicional binaural HRTF; ideal con audífonos.' })
    );
    p.append(tone.c, mbcomp.c, deess.c, comp.c, sat.c, airexc.c, bmono.c, xfeed.c, wid.c, rev.c, dly.c, sp.c);
  }

  /* Vibración */
  const VIBK = ['sub', 'glass', 'harm', 'trem', 'vibr', 'hap'];
  function applyKeys(keys: string[], data: Record<string, any>) {
    keys.forEach((k) => {
      if (S.locks[k]) return;
      resetSec(k);
      if (data[k]) SEC[k].set(S, data[k]);
    });
    syncAll();
    commit();
    persistNow();
  }
  {
    const p = mkPane('vib');
    const VP: Array<[string, string, Record<string, any>]> = [
      ['Apagar todo', 'Todo en cero', {}],
      ['Vidrios suaves', 'Vibración leve en ventanas', { sub: { on: true, freq: 55, g: 5, q: 1.2 }, glass: { on: true, freq: 90, g: 3, q: 5 }, harm: { on: true, freq: 100, drive: 15, mix: 10 } }],
      ['Vidrios fuertes', 'Subgraves y resonancia marcados', { sub: { on: true, freq: 48, g: 9, q: 1.4 }, glass: { on: true, freq: 80, g: 6, q: 7 }, harm: { on: true, freq: 110, drive: 30, mix: 22 }, hap: { on: true, thr: 55, dur: 40, gap: 60, shake: 40 } }],
      ['Terremoto', 'Máximo temblor, usar con cuidado', { sub: { on: true, freq: 40, g: 14, q: 1.6 }, glass: { on: true, freq: 70, g: 9, q: 9 }, harm: { on: true, freq: 120, drive: 45, mix: 35 }, trem: { on: true, rate: 7, depth: 25, shape: 0 }, hap: { on: true, thr: 40, dur: 70, gap: 40, shake: 80 } }],
    ];
    p.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Temblor y vibración' })),
        h('p', { class: 'hint', text: 'Graves profundos para hacer vibrar vidrios, puertas y el propio teléfono. Todo empieza apagado y en 0.' }),
        h('p', { class: 'hint', text: 'Precaución: sube el volumen poco a poco. El limitador Brickwall protege la salida contra recortes digitales.' }),
        h(
          'div',
          { class: 'chips' },
          ...VP.map(([n, d, data]) =>
            h('button', {
              class: 'btn',
              type: 'button',
              text: n,
              title: d,
              onclick: () => {
                applyKeys(VIBK, data);
                toast('Aplicado: ' + n);
              },
            })
          )
        )
      )
    );
    const sub = card('sub', FXN.sub, { on: true });
    sub.body.append(
      row('fx.sub.g', 'Ganancia', { min: -12, max: 24, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.sub.freq', 'Frecuencia central', { min: 20, max: 150, step: 0.1, fine: 0.1, unit: 'Hz' }),
      row('fx.sub.q', 'Ancho (Q)', { min: 0.3, max: 12, step: 0.05, fine: 0.05, unit: 'Q' })
    );
    const glass = card('glass', FXN.glass, { on: true });
    glass.body.append(
      row('fx.glass.g', 'Ganancia', { min: 0, max: 24, step: 0.1, fine: 0.1, unit: 'dB' }),
      row('fx.glass.freq', 'Frecuencia de resonancia', { min: 40, max: 250, step: 0.1, fine: 0.1, unit: 'Hz' }),
      row('fx.glass.q', 'Estrechez (Q)', { min: 1, max: 20, step: 0.1, fine: 0.1, unit: 'Q' }),
      h('p', { class: 'mini', text: 'Mueve la resonancia entre 60 y 120 Hz hasta encontrar la frecuencia exacta de la sala.' })
    );
    const harm = card('harm', FXN.harm, { on: true });
    harm.body.append(
      row('fx.harm.freq', 'Corte de graves', { min: 40, max: 250, step: 1, fine: 1, unit: 'Hz' }),
      row('fx.harm.drive', 'Empuje armónico 4×', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.harm.mix', 'Mezcla', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      h('p', { class: 'mini', text: 'Síntesis de armónicos pares en 4× oversampling para percibir subgraves profundos incluso en altavoces compactos.' })
    );
    const trem = card('trem', FXN.trem, { on: true });
    trem.body.append(
      row('fx.trem.rate', 'Velocidad', { min: 0.1, max: 20, step: 0.1, fine: 0.1, unit: 'Hz' }),
      row('fx.trem.depth', 'Profundidad', { min: 0, max: 100, step: 0.1, fine: 0.1, unit: '%' }),
      row('fx.trem.shape', 'Forma de onda', { min: 0, max: 2, step: 1, fine: 1, unit: '' }),
      h('p', { class: 'mini', text: '0 senoidal, 1 triangular, 2 cuadrada.' })
    );
    const vibr = card('vibr', FXN.vibr, { on: true });
    vibr.body.append(
      row('fx.vibr.rate', 'Velocidad', { min: 0.1, max: 12, step: 0.1, fine: 0.1, unit: 'Hz' }),
      row('fx.vibr.depth', 'Profundidad', { min: 0, max: 3, step: 0.01, fine: 0.01, unit: 'ms' })
    );
    const hap = card('hap', FXN.hap, { on: true });
    hap.body.append(
      row('fx.hap.thr', 'Umbral de graves', { min: 0, max: 100, step: 1, fine: 1, unit: '%' }),
      row('fx.hap.dur', 'Duración del pulso', { min: 5, max: 200, step: 1, fine: 1, unit: 'ms' }),
      row('fx.hap.gap', 'Pausa entre pulsos', { min: 20, max: 500, step: 1, fine: 1, unit: 'ms' }),
      row('fx.hap.shake', 'Temblor de pantalla', { min: 0, max: 100, step: 1, fine: 1, unit: '%' }),
      h('p', { class: 'mini', text: 'Sincroniza el motor háptico del teléfono con cada golpe real de subgraves (20–150 Hz).' })
    );
    p.append(sub.c, glass.c, harm.c, trem.c, vibr.c, hap.c);
  }

  let lastVib = 0;
  let warnedVib = false;
  let shakeAmt = 0;
  const hapEls = [$('#viz'), main];
  function hapticTick(now: number) {
    const hp = S.fx.hap;
    const clr = () => {
      shakeAmt = 0;
      hapEls.forEach((e) => {
        if (e) e.style.transform = '';
      });
    };
    if (!hp.on || !ctx || !freqData || audio.paused) {
      if (shakeAmt) clr();
      return;
    }
    const bin = ctx.sampleRate / 2 / freqData.length;
    const a = Math.max(1, Math.floor(20 / bin));
    const b = Math.ceil(150 / bin);
    let m = 0;
    let n = 0;
    for (let k = a; k <= b && k < freqData.length; k++) {
      m += freqData[k];
      n++;
    }
    const lvl = n ? m / n / 255 : 0;
    const thr = hp.thr / 100;
    if (lvl > thr) {
      const amt = (lvl - thr) / (1 - thr + 1e-6);
      if (!document.hidden && hp.shake > 0) {
        shakeAmt = ((amt * hp.shake) / 100) * 6;
        hapEls.forEach((e) => {
          if (e)
            e.style.transform =
              'translate(' + ((Math.random() * 2 - 1) * shakeAmt).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * shakeAmt).toFixed(1) + 'px)';
        });
      }
      const durMs = Math.round(hp.dur * (0.5 + amt * 0.5));
      if (NATIVE && window.AndroidBridge?.vibrate) {
        if (now - lastVib > hp.gap + hp.dur) {
          lastVib = now;
          try {
            window.AndroidBridge.vibrate(durMs);
          } catch (_e) {}
        }
      } else if (typeof navigator.vibrate === 'function') {
        if (now - lastVib > hp.gap + hp.dur) {
          lastVib = now;
          try {
            navigator.vibrate(durMs);
          } catch (_e) {}
        }
      } else if (!warnedVib) {
        warnedVib = true;
        toast('Este navegador no permite vibrar el teléfono; queda el temblor de pantalla.');
      }
    } else if (shakeAmt) clr();
  }

  /* Géneros actualizados con curvas de referencia mundial */
  {
    const p = mkPane('gen');
    const ip = (pts: Array<[number, number]>, k: number) =>
      Array.from({ length: 30 }, (_, i) => {
        let v = pts[pts.length - 1][1];
        if (i <= pts[0][0]) v = pts[0][1];
        else
          for (let j = 0; j < pts.length - 1; j++) {
            const [a, x] = pts[j];
            const [b, y] = pts[j + 1];
            if (i >= a && i <= b) {
              v = x + ((y - x) * (i - a)) / (b - a);
              break;
            }
          }
        return clamp(r1(v * k), -24, 24);
      });
    type StyleFn = (k: number, g: (v: number) => number, m: (v: number) => number, w: (v: number) => number) => Record<string, any>;
    const GEN: Array<{ name: string; desc: string; list: Array<[string, string, StyleFn]> }> = [
      {
        name: 'Hi-Fi & Audiófilo',
        desc: 'Curvas de referencia mundial para escucha crítica, FLAC/WAV, jazz y música acústica.',
        list: [
          ['Harman Target Studio', 'Equilibrio mundial de referencia + Crossfeed natural', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 3.2], [4, 3.5], [8, 1.2], [12, -0.8], [16, 0.2], [21, 2.4], [25, 2.0], [29, 1.4]], k) }, xfeed: { on: true, mix: m(25), fc: 700 }, master: { autoHead: true, ceil: -0.2 }, voice: { vPres: { g: g(1) } } })],
          ['Jazz & Sala Acústica', 'Contrabajo orgánico, válvula cálida y escena íntima', (k, g, m, w) => ({ eq30: { eq: ip([[0, 1], [4, 2.2], [9, 1.4], [14, -0.5], [20, 1.5], [26, 2.5], [29, 2.2]], k) }, sat: { on: true, drive: m(12), mix: m(14), mode: 1 }, rev: { on: true, mix: m(12), decay: 1.7, size: 48, damp: 42, pre: 14 }, wid: { on: true, w: w(18) }, bass: { bLow: { g: g(1.5) } } })],
          ['Orquesta / Clásica HD', 'Rango dinámico puro sin compresión y gran palco estéreo', (k, _g, m, w) => ({ eq30: { eq: ip([[0, 1.8], [5, 2.0], [12, 0], [19, 1.0], [25, 2.2], [29, 2.8]], k) }, wid: { on: true, w: w(28) }, rev: { on: true, mix: m(15), decay: 2.6, size: 78, damp: 35, pre: 22 }, master: { autoHead: true, ceil: -0.1 } })],
          ['Voz & Podcast Master', 'Inteligibilidad cristalina sin sibilancia ni retumbo', (k, g, _m, _w) => ({ eq30: { eq: ip([[0, -4], [4, -1.5], [9, 1.2], [13, -1.2], [19, 2.8], [23, 2.2], [26, -1], [29, 1]], k) }, tone: { lc: 55 }, voice: { vWarm: { g: g(1.5) }, vPres: { g: g(3) }, vSib: { g: g(-2.5) } }, comp: { on: true, th: -20, ratio: 3, attack: 8, release: 140, knee: 6, makeup: g(2.5) } })],
        ],
      },
      {
        name: 'Electrónica',
        desc: 'Subgraves limpios, medios despejados y brillo abierto para clubes y festivales.',
        list: [
          ['EDM / Festival', 'Bombo y bajos grandes, agudos con chispa', (k, g, m, w) => ({ eq30: { eq: ip([[0, 5], [4, 6], [8, 2], [11, -2], [14, -2.5], [18, -0.5], [22, 1.5], [25, 3], [29, 4]], k) }, tone: { bass: g(2), bassF: 70 }, sub: { on: true, freq: 50, g: g(4), q: 1.2 }, sat: { on: true, drive: m(15), mix: m(12), mode: 2 }, wid: { on: true, w: w(35) }, comp: { on: true, th: -16, ratio: 3, attack: 10, release: 120, knee: 4, makeup: g(2) } })],
          ['House / Deep', 'Groove cálido de cinta con sala suave', (k, g, m, w) => ({ eq30: { eq: ip([[0, 2], [4, 4], [8, 2], [12, -1], [16, 0], [22, 1.5], [26, 3], [29, 3]], k) }, sat: { on: true, drive: m(12), mix: m(12), mode: 0 }, rev: { on: true, mix: m(12), decay: 1.8, size: 55, damp: 40, pre: 12 }, comp: { on: true, th: -18, ratio: 2.5, attack: 15, release: 140, knee: 6, makeup: g(1.5) }, wid: { on: true, w: w(25) } })],
          ['Techno Peak-Time', 'Golpe seco, hi-hats brillantes y eco oscuro', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 3], [5, 5], [9, 0], [13, -2], [18, 1], [23, 3], [27, 2], [29, 2]], k) }, sat: { on: true, drive: m(25), mix: m(20), mode: 2 }, dly: { on: true, time: 375, fb: 25, mix: m(10), tone: 6000 }, comp: { on: true, th: -14, ratio: 4, attack: 6, release: 90, knee: 2, makeup: g(2) } })],
          ['Dubstep / Phonk Bass', 'Subgraves extremos con armónicos 4×', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 8], [4, 9], [7, 3], [11, -3], [15, -2], [22, 2], [27, 3], [29, 3]], k) }, sub: { on: true, freq: 45, g: g(7), q: 1.3 }, glass: { on: true, freq: 85, g: g(4), q: 6 }, harm: { on: true, freq: 110, drive: m(35), mix: m(25) }, comp: { on: true, th: -12, ratio: 5, attack: 4, release: 80, knee: 2, makeup: g(3) } })],
        ],
      },
      {
        name: 'Rock',
        desc: 'Guitarras con presencia, caja con chasquido y bajos firmes.',
        list: [
          ['Rock clásico', 'Equilibrado, con guitarra y válvula al frente', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 0], [3, 2], [7, 2.5], [11, -1], [14, -1], [18, 1], [21, 2.5], [25, 2], [29, 1]], k) }, drums: { kick: { g: g(1.5) }, snareC: { g: g(1.5) } }, guitar: { gPres: { g: g(2) } }, sat: { on: true, drive: m(10), mix: m(12), mode: 1 }, comp: { on: true, th: -20, ratio: 2.5, attack: 20, release: 200, knee: 6, makeup: g(2) } })],
          ['Hard rock / Metal', 'Medios recortados, ataque de consola y pegada', (k, g, m, _w) => ({ eq30: { eq: ip([[0, -3], [4, 3], [8, 1], [12, -3.5], [15, -2], [20, 2.5], [23, 4], [27, 3], [29, 2]], k) }, sat: { on: true, drive: m(25), mix: m(15), mode: 2 }, guitar: { gBody: { g: g(1) }, gPres: { g: g(3) } }, drums: { kick: { g: g(3) }, snareC: { g: g(2) }, hat: { g: g(1) } }, comp: { on: true, th: -16, ratio: 4, attack: 8, release: 120, knee: 3, makeup: g(2) } })],
          ['Indie / Alternativo', 'Aire, sala corta y estéreo abierto', (k, _g, m, w) => ({ eq30: { eq: ip([[0, 0], [2, 1], [6, 1.5], [12, -0.5], [19, 1.5], [24, 1.5], [28, 2], [29, 2]], k) }, rev: { on: true, mix: m(14), decay: 1.6, size: 55, damp: 45, pre: 15 }, wid: { on: true, w: w(20) } })],
          ['Acústico / Balada', 'Cuerpo de guitarra y voz cálida', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 0], [3, 1], [9, 1.5], [14, 0], [20, 1], [26, 2], [29, 2]], k) }, guitar: { gAc: { g: g(2) } }, voice: { vWarm: { g: g(1) }, vPres: { g: g(1.5) } }, rev: { on: true, mix: m(10), decay: 1.4, size: 45, damp: 50, pre: 10 } })],
        ],
      },
      {
        name: 'Reggaetón & Urbano',
        desc: 'Bombo profundo, 808 definidos y voz clara por encima.',
        list: [
          ['Perreo clásico', 'Sub y bombo, voz al frente', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 6], [3, 8], [6, 3], [10, -1.5], [14, -2.5], [19, 0.5], [22, 2.5], [26, 3], [29, 3]], k) }, sub: { on: true, freq: 48, g: g(6), q: 1.4 }, glass: { on: true, freq: 80, g: g(3.5), q: 5 }, drums: { kick: { g: g(3) } }, voice: { vPres: { g: g(2) }, vSib: { g: g(-1.5) } }, comp: { on: true, th: -14, ratio: 4, attack: 6, release: 100, knee: 3, makeup: g(2) }, sat: { on: true, drive: m(12), mix: m(12), mode: 2 } })],
          ['Trap / 808 Moderno', '808 largos, hi-hats nítidos y voz con aire', (k, g, m, w) => ({ eq30: { eq: ip([[0, 7], [3, 9], [7, 2], [11, -2], [15, -2], [21, 1.5], [26, 3], [29, 3]], k) }, sub: { on: true, freq: 42, g: g(8), q: 1.5 }, drums: { hat: { g: g(2) } }, voice: { vAir: { g: g(2) } }, dly: { on: true, time: 333, fb: 20, mix: m(8), tone: 7000 }, wid: { on: true, w: w(25) }, comp: { on: true, th: -14, ratio: 4, attack: 6, release: 100, knee: 3, makeup: g(2) } })],
          ['Dembow de club', 'Bombo y caja con pegada', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 4], [4, 6], [8, 2], [12, -1.5], [18, 1], [23, 3], [27, 3], [29, 2]], k) }, sub: { on: true, freq: 52, g: g(5), q: 1.2 }, drums: { kick: { g: g(3) }, snareC: { g: g(2.5) } }, harm: { on: true, freq: 110, drive: m(20), mix: m(15) }, comp: { on: true, th: -14, ratio: 4, attack: 6, release: 100, knee: 3, makeup: g(2) } })],
          ['Urbano suave / R&B', 'Voz cálida de tubo y sala corta', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 2], [2, 3], [6, 2], [12, -1], [18, 1.5], [24, 2], [29, 2]], k) }, voice: { vWarm: { g: g(2) }, vPres: { g: g(2) } }, sat: { on: true, drive: m(10), mix: m(10), mode: 1 }, rev: { on: true, mix: m(10), decay: 1.5, size: 50, damp: 50, pre: 12 }, sub: { on: true, freq: 55, g: g(3), q: 1.2 } })],
        ],
      },
      {
        name: 'K-pop & Pop',
        desc: 'Voces brillantes y nítidas, graves ajustados y estéreo amplio.',
        list: [
          ['K-pop brillante', 'Voz con aire, agudos pulidos', (k, g, m, w) => ({ eq30: { eq: ip([[0, 1], [4, 2.5], [8, 1], [12, -1.5], [16, 0.5], [20, 2], [23, 3], [26, 3.5], [29, 3]], k) }, voice: { vPres: { g: g(3) }, vAir: { g: g(2.5) }, vSib: { g: g(-1.5) } }, comp: { on: true, th: -18, ratio: 3, attack: 10, release: 130, knee: 5, makeup: g(2) }, wid: { on: true, w: w(40) }, rev: { on: true, mix: m(10), decay: 1.5, size: 50, damp: 45, pre: 10 } })],
          ['Dance-pop', 'Energía, bajo firme y estéreo grande', (k, g, m, w) => ({ eq30: { eq: ip([[0, 2], [3, 4], [6, 3], [12, -1], [17, 0], [22, 2.5], [27, 3.5], [29, 3]], k) }, tone: { bass: g(3) }, comp: { on: true, th: -15, ratio: 4, attack: 8, release: 100, knee: 3, makeup: g(2.5) }, wid: { on: true, w: w(45) }, sat: { on: true, drive: m(8), mix: m(8), mode: 0 } })],
          ['Balada coreana', 'Voz cercana con sala amplia HD', (k, g, m, _w) => ({ eq30: { eq: ip([[0, 0], [3, 1], [8, 1], [14, -1], [20, 1.5], [26, 2.5], [29, 2.5]], k) }, voice: { vWarm: { g: g(1.5) }, vPres: { g: g(2) }, vAir: { g: g(2) } }, rev: { on: true, mix: m(18), decay: 2.4, size: 65, damp: 40, pre: 20 } })],
          ['Hip hop coreano', 'Graves pesados y voz presente', (k, g, _m, _w) => ({ eq30: { eq: ip([[0, 5], [4, 6], [8, 1], [10, -1.5], [16, 0], [20, 2], [26, 2], [29, 2]], k) }, sub: { on: true, freq: 50, g: g(4), q: 1.3 }, voice: { vPres: { g: g(2.5) } }, drums: { hat: { g: g(1.5) } }, comp: { on: true, th: -15, ratio: 3.5, attack: 8, release: 110, knee: 3, makeup: g(2) } })],
        ],
      },
    ];
    let gSel = 0;
    let gk = 100;
    const gChips = h('div', { class: 'chips' });
    const gDesc = h('p', { class: 'hint' });
    const gList = h('div');
    const gr = h('input', {
      type: 'range',
      id: 'gk',
      class: 'rfull',
      min: 0,
      max: 150,
      step: 1,
      value: 100,
      'aria-label': 'Intensidad del género',
    }) as HTMLInputElement;
    gr.style.setProperty('--p', '66.7%');
    const gv = h('span', { class: 'num', text: '100%' });
    gr.addEventListener('input', () => {
      gk = +gr.value;
      gv.textContent = gk + '%';
      gr.style.setProperty('--p', clamp((gk / 150) * 100, 0, 100).toFixed(1) + '%');
    });
    function gRender() {
      gChips.replaceChildren(
        ...GEN.map((g, i) =>
          h('button', {
            class: 'chip',
            type: 'button',
            text: g.name,
            'data-gen-cat': '1',
            'aria-pressed': String(i === gSel),
            onclick: () => {
              gSel = i;
              gRender();
            },
          })
        )
      );
      const g = GEN[gSel];
      gDesc.textContent = g.desc;
      gList.replaceChildren(
        ...g.list.map(([n, d, fn]) =>
          prRow(n, d, () => {
            const k = gk / 100;
            const gg = (v: number) => r1(v * k);
            const m = (v: number) => clamp(r1(v * k), 0, 100);
            const w = (v: number) => Math.round(v * k);
            applyData(fn(k, gg, m, w), { reset: true });
            toast(g.name + ' · ' + n + ' al ' + gk + '%');
          })
        )
      );
    }
    p.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Género musical' })),
        gChips,
        gDesc,
        h('div', { class: 'prow', style: 'border:0' }, h('div', { class: 'ptop' }, h('label', { class: 'pl', for: 'gk', text: 'Intensidad' }), gv), gr)
      ),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Estilos de referencia' })),
        gList,
        h('p', {
          class: 'mini',
          text: 'Aplicar ajusta todo el estudio respetando las secciones con candado. Luego puedes personalizar en EQ 30, Claridad 16 o Efectos.',
        })
      )
    );
    gRender();
  }

  function drawRadar() {
    if (!radar || document.hidden) return;
    const g = radar.getContext('2d')!;
    const w = radar.width;
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    g.strokeStyle = 'rgba(170,167,192,.35)';
    g.lineWidth = 2;
    [0.33, 0.66, 0.98].forEach((r) => {
      g.beginPath();
      g.arc(c, c, c * r, 0, 7);
      g.stroke();
    });
    g.beginPath();
    g.moveTo(c, 4);
    g.lineTo(c, w - 4);
    g.moveTo(4, c);
    g.lineTo(w - 4, c);
    g.stroke();
    g.fillStyle = fgC;
    g.beginPath();
    g.arc(c, c, 8, 0, 7);
    g.fill();
    const sp = S.fx.sp;
    const a = (spAz * Math.PI) / 180;
    const r = clamp(sp.dist / 10, 0.05, 1) * c * 0.9;
    g.fillStyle = accC;
    g.globalAlpha = sp.on ? 1 : 0.4;
    g.beginPath();
    g.arc(c + Math.sin(a) * r, c - Math.cos(a) * r, 12, 0, 7);
    g.fill();
    g.globalAlpha = 1;
  }

  /* Presets */
  {
    const nameIn = h('input', {
      class: 'field',
      id: 'pname',
      placeholder: 'Nombre del ajuste (opcional)',
      'aria-label': 'Nombre del ajuste',
      maxlength: 40,
    }) as HTMLInputElement;
    pre.dataset.id = 'pre';
    pre.hidden = true;
    pre.setAttribute('role', 'tabpanel');
    panes.pre = pre;
    main.append(pre);
    pre.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Guardar todo' })),
        h('p', { class: 'hint', text: 'Guarda todas las secciones con un toque. El último estado también se recuerda solo al volver.' }),
        nameIn,
        h(
          'div',
          { class: 'chips', style: 'margin-top:8px' },
          h('button', {
            class: 'btn pri',
            type: 'button',
            text: 'Guardar todo',
            onclick: () => {
              saveAllPreset(nameIn.value);
              nameIn.value = '';
            },
          })
        )
      ),
      h('div', { class: 'card' }, h('div', { class: 'chead' }, h('h2', { text: 'Curvas de referencia' })), lists.fact),
      h('div', { class: 'card' }, h('div', { class: 'chead' }, h('h2', { text: 'Mis ajustes' })), lists.mine),
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Por sección' })),
        h('p', { class: 'hint', text: 'Guarda y recupera una sola sección, por ejemplo solo el compresor o el crossfeed.' }),
        secSel,
        h('div', { style: 'margin-top:6px' }, lists.sec)
      )
    );
    const lk = h('div', { class: 'chips' });
    ORDER.forEach((k) => {
      const b = h('button', {
        class: 'ib',
        type: 'button',
        onclick: () => {
          S.locks[k] = !S.locks[k];
          if (!S.locks[k]) delete S.locks[k];
          syncAll();
          persistNow();
        },
      });
      syncers.push(() => {
        const l = !!S.locks[k];
        b.setAttribute('aria-pressed', String(l));
        b.innerHTML = (l ? ICON_LOCK : ICON_OPEN) + '<span></span>';
        if (b.lastChild) b.lastChild.textContent = SEC[k].n;
      });
      lk.append(b);
    });
    pre.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Bloqueos' })),
        h('p', { class: 'hint', text: 'Una sección bloqueada no cambia al aplicar un preset, al restablecer ni al editarla.' }),
        lk,
        h(
          'div',
          { class: 'chips', style: 'margin-top:8px' },
          h('button', {
            class: 'btn',
            type: 'button',
            text: 'Desbloquear todo',
            onclick: () => {
              S.locks = {};
              syncAll();
              persistNow();
            },
          })
        )
      )
    );
    const out = h('textarea', { class: 'field', id: 'exp', readonly: true, 'aria-label': 'Datos para respaldo' }) as HTMLTextAreaElement;
    const inp = h('textarea', { class: 'field', id: 'imp', 'aria-label': 'Pegar datos para importar', placeholder: 'Pega aquí un respaldo para importarlo' }) as HTMLTextAreaElement;
    const copy = h('button', {
      class: 'btn',
      type: 'button',
      text: 'Copiar',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(out.value);
          toast('Copiado');
        } catch (_e) {
          out.focus();
          out.select();
          toast('Selecciona y copia el texto');
        }
      },
    });
    pre.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'chead' }, h('h2', { text: 'Respaldo y web' })),
        h('p', { class: 'hint', text: 'Copia tus ajustes para guardarlos o llevarlos a otro dispositivo.' }),
        h(
          'div',
          { class: 'chips' },
          h('button', {
            class: 'btn',
            type: 'button',
            text: 'Exportar',
            onclick: () => {
              out.value = JSON.stringify({ app: 'estudio-eq', v: 2, presets: store.presets, sec: store.sec, current: getFull() }, null, 1);
            },
          }),
          copy
        ),
        out,
        h('div', { style: 'height:8px' }),
        inp,
        h(
          'div',
          { class: 'chips', style: 'margin-top:8px' },
          h('button', {
            class: 'btn',
            type: 'button',
            text: 'Importar',
            onclick: () => {
              try {
                const o = JSON.parse(inp.value);
                let n = 0;
                if (Array.isArray(o.presets))
                  o.presets.forEach((p: any) => {
                    if (p && p.name && p.data) {
                      store.presets.push({ name: String(p.name).slice(0, 40), ts: p.ts || Date.now(), data: p.data });
                      n++;
                    }
                  });
                if (o.sec && typeof o.sec === 'object')
                  for (const k in o.sec)
                    if (SEC[k] && Array.isArray(o.sec[k]))
                      o.sec[k].forEach((p: any) => {
                        if (p && p.name && p.data) {
                          (store.sec[k] || (store.sec[k] = [])).push(p);
                          n++;
                        }
                      });
                if (!n && o.current) {
                  store.presets.push({ name: 'Importado ' + stamp(), ts: Date.now(), data: o.current });
                  n = 1;
                }
                if (!n) {
                  toast('No encontré ajustes en ese texto');
                  return;
                }
                persistNow();
                renderPresets();
                toast(n + ' ajuste' + (n > 1 ? 's' : '') + ' importado' + (n > 1 ? 's' : ''));
              } catch (_e) {
                toast('El texto no es un respaldo válido');
              }
            },
          })
        )
      )
    );
  }

  /* ---------- pestañas, cabecera y dock ---------- */
  const TAB_ICONS: Record<string, string> = {
    music: '<svg viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    con: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.2 9.2l2.1 2.1"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M6.2 17.8a8.5 8.5 0 1 1 11.6 0" stroke-opacity=".5"/></svg>',
    eq30: '<svg viewBox="0 0 24 24"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="9" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="8" r="2"/></svg>',
    cl16: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" fill-opacity=".35"/></svg>',
    inst: '<svg viewBox="0 0 24 24"><path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7M8 21h8"/></svg>',
    fx: '<svg viewBox="0 0 24 24"><path d="M3 7c4 0 6 10 10 10h7M17 14l3 3-3 3M3 17c4 0 6-10 10-10h7M17 4l3 3-3 3"/></svg>',
    vib: '<svg viewBox="0 0 24 24"><path d="M2 12h3l2.5-6 4 12 3.5-9 2.5 3H22"/></svg>',
    gen: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.8"/><path d="M12 6.2a5.8 5.8 0 0 1 5.8 5.8"/></svg>',
    pre: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/></svg>',
  };

  const TABS: Array<[string, string]> = [
    ['music', 'Música'],
    ['con', 'Consola'],
    ['eq30', 'EQ 30'],
    ['cl16', 'Claridad 16'],
    ['inst', 'Instrumentos'],
    ['fx', 'Efectos'],
    ['vib', 'Vibración'],
    ['gen', 'Géneros'],
    ['pre', 'Presets'],
  ];
  const tabBar = $('#tabs')!;
  const tabBtns = TABS.map(([id, n]) => {
    const ico = h('span', { class: 'tab-ico', 'aria-hidden': 'true' });
    ico.innerHTML = TAB_ICONS[id] || '';
    const lbl = h('span', { class: 'tab-lbl', text: n });
    const b = h('button', { class: 'tab', type: 'button', role: 'tab', onclick: () => showTab(id) }, ico, lbl);
    b.dataset.id = id;
    tabBar.append(b);
    return b;
  });
  let curTab = 'music';
  function showTab(id: string) {
    curTab = id;
    document.body.dataset.tab = id;
    if (dockEl) (dockEl as HTMLElement).hidden = id !== 'music';
    tabBtns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    for (const k in panes) panes[k].hidden = k !== id;
    if (IS_PRO_EDITION) {
      updatePreviewBarUi();
      // La ventana emergente de Prueba Gratis 4 Días aparece SOLO UNA VEZ al pasar a otro apartado distinto de Música.
      // Si el usuario no acepta, puede ver todos los apartados como vista previa sin mover ni aplicar ajustes.
      if (id !== 'music' && !hasProAccess() && !trialAutoPromptShown && proState.legalAccepted) {
        trialAutoPromptShown = true;
        openProModal();
      }
    }
    const cs = getComputedStyle(document.body);
    accC = cs.getPropertyValue('--acc').trim() || accC;
    fgC = cs.getPropertyValue('--fg').trim() || fgC;
    numFont = cs.getPropertyValue('--f-num').trim() || numFont;
    syncVizSize();
    vizDirty = true;
    main.scrollTop = 0;
    requestAnimationFrame(() => {
      stripScrollSyncers.forEach((fn) => fn());
      if (id === 'con' && drawConCurveFn) drawConCurveFn();
      if (IS_PRO_EDITION) applyCertifiedDomTranslation(rootEl, currentLang);
    });
    const t = tabBtns.find((b) => b.dataset.id === id);
    if (t) t.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    if (NATIVE && window.AndroidBridge?.setWindowColors) {
      try {
        if (id === 'eq30') window.AndroidBridge.setWindowColors('#030613', '#06091A');
        else if (id === 'con') window.AndroidBridge.setWindowColors('#04050E', '#060816');
        else window.AndroidBridge.setWindowColors('#03020A', '#060412');
      } catch (_e) {}
    }
  }

  const byp = $('#bypass')!;
  const brandImg = $('.brand-ico') as HTMLImageElement | null;
  if (IS_PRO_EDITION) {
    const brandSpan = $('.brand-txt');
    if (brandSpan) {
      brandSpan.innerHTML = 'JF Master <span>Studio PRO</span>';
    }
    if (brandImg && !NATIVE) {
      brandImg.src = 'icons/pro-icon-192.png';
    }
  } else {
    const brandSpan = $('.brand-txt');
    if (brandSpan && window.__FORCED_EDITION === 'classic') {
      brandSpan.innerHTML = 'Master <span>Console DVC</span>';
    }
  }
  if (IS_PRO_EDITION) {
    const headerTop = $('header.top');
    const langBtnSpan = h('span', { text: SUPPORTED_LANGS.find((l) => l.code === currentLang)?.shortLabel || 'ES' });
    const langBtn = h(
      'button',
      {
        type: 'button',
        class: 'top-lang-btn',
        'aria-label': 'Language / Idioma',
        onclick: () => openLanguageQuickModal(),
      },
      langBtnSpan
    );
    const globeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    globeSvg.setAttribute('viewBox', '0 0 24 24');
    globeSvg.innerHTML =
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
    langBtn.prepend(globeSvg);

    const proBtn = h('button', {
      type: 'button',
      class: 'top-pro-btn num',
      onclick: () => openProModal(),
    });

    if (headerTop && byp.parentElement === headerTop) {
      headerTop.insertBefore(langBtn, byp);
      headerTop.insertBefore(proBtn, byp);
    }

    updateHeaderProUi = () => {
      const lm = SUPPORTED_LANGS.find((l) => l.code === currentLang) || SUPPORTED_LANGS[0];
      langBtnSpan.textContent = lm.shortLabel;
      const tier = getLicenseTier();
      proBtn.dataset.tier = tier;
      const cp = LEGAL_PRO_COPY[currentLang];
      if (tier === 'pro') {
        proBtn.textContent = 'PRO ★';
        proBtn.title = cp.proBtnActive;
      } else if (tier === 'trial') {
        const remHrs = Math.max(1, Math.ceil((TRIAL_DURATION_MS - (Date.now() - proState.trialStartedAt)) / 3600000));
        proBtn.textContent = cp.proBtnTrial(remHrs);
        proBtn.title = cp.proBtnTrial(remHrs);
      } else if (tier === 'expired') {
        proBtn.textContent = cp.proBtnExpired;
      } else {
        proBtn.textContent = cp.proBtnFree;
      }
      updatePreviewBarUi();
    };

    const buildFuturisticHero = (
      onLangSelect: (lc: LangCode) => void,
      opts?: { fullFold?: boolean; onScrollDown?: () => void }
    ) => {
      const cp = LEGAL_PRO_COPY[currentLang];
      const prismBars = h(
        'div',
        { class: 'jf-prism-bars', 'aria-hidden': 'true' },
        h('i'),
        h('i'),
        h('i'),
        h('i'),
        h('i'),
        h('i'),
        h('i')
      );
      const holoStage = h(
        'div',
        { class: 'jf-holo-stage', 'aria-hidden': 'true' },
        h('div', { class: 'jf-orbit-ring' }),
        h('div', { class: 'jf-orbit-ring inner' }),
        prismBars
      );
      const langSeg = h(
        'div',
        { class: 'jf-lang-seg', role: 'group', 'aria-label': cp.langMenuTitle },
        ...SUPPORTED_LANGS.map((lm) =>
          h('button', {
            type: 'button',
            'aria-pressed': String(lm.code === currentLang),
            text: lm.nativeLabel,
            onclick: () => onLangSelect(lm.code),
          })
        )
      );
      let scrollCue: HTMLElement | null = null;
      if (opts?.fullFold) {
        const arrowHolder = h('span', { 'aria-hidden': 'true' });
        arrowHolder.innerHTML =
          '<svg class="jf-scroll-cue-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
        scrollCue = h(
          'button',
          {
            type: 'button',
            class: 'jf-scroll-cue-btn',
            onclick: () => opts.onScrollDown?.(),
          },
          h('span', { class: 'jf-scroll-cue-pill' }, h('span', { text: cp.scrollDownLegalHint })),
          arrowHolder.firstElementChild as Node
        );
      }
      return h(
        'div',
        { class: 'jf-futuristic-hero' + (opts?.fullFold ? ' jf-hero-fullfold' : '') },
        h('div', { class: 'jf-laser-scan', 'aria-hidden': 'true' }),
        holoStage,
        h('div', { class: 'jf-kicker', text: cp.betaTag }),
        h('h2', { class: 'jf-dev-headline', text: cp.devCreditTitle }),
        h('p', { class: 'jf-dev-sub', text: cp.devCreditSub }),
        langSeg,
        scrollCue
      );
    };

    const openLanguageQuickModal = () => {
      const existing = document.getElementById('jfLangQuickBackdrop');
      if (existing) existing.remove();
      const backdrop = h('div', {
        id: 'jfLangQuickBackdrop',
        class: 'jf-modal-backdrop',
        onclick: (e: MouseEvent) => {
          if (e.target === backdrop) backdrop.remove();
        },
      });
      const renderContent = () => {
        const cp = LEGAL_PRO_COPY[currentLang];
        const cardModal = h(
          'div',
          { class: 'jf-glass-modal', style: 'max-width:440px', role: 'dialog', 'aria-modal': 'true' },
          h('button', {
            type: 'button',
            class: 'jf-close-top',
            'aria-label': cp.closeLabel,
            text: '×',
            onclick: () => backdrop.remove(),
          }),
          buildFuturisticHero((lc) => {
            setAppLanguage(lc);
            backdrop.remove();
          }),
          h(
            'div',
            { class: 'jf-modal-footer' },
            h('button', {
              type: 'button',
              class: 'btn ghost',
              text: cp.btnViewLegal,
              onclick: () => {
                backdrop.remove();
                openStartupLegalModal(true);
              },
            }),
            h('button', {
              type: 'button',
              class: 'btn pri',
              text: cp.closeLabel,
              onclick: () => backdrop.remove(),
            })
          )
        );
        backdrop.replaceChildren(cardModal);
      };
      renderContent();
      document.body.append(backdrop);
    };

    /* Ventana Emergente Translúcida Tipo Vidrio al Inicio:
       ARRIBA PRIMERO: Versión Beta + Desarrollado por Jack Friedrich + Animación Futurista
       ABAJO: Aviso de Privacidad Zero-Cloud, Seguridad Auditiva EN 50332/OMS, EULA y Condiciones Pro */
    openStartupLegalModal = (forceViewOnly = false) => {
      const prev = document.getElementById('jfStartupLegalBackdrop');
      if (prev) prev.remove();
      let checked = proState.legalAccepted || false;

      const backdrop = h('div', {
        id: 'jfStartupLegalBackdrop',
        class: 'jf-modal-backdrop',
        onclick: (e: MouseEvent) => {
          if (forceViewOnly && e.target === backdrop) backdrop.remove();
        },
      });

      const renderLegal = () => {
        const cp = LEGAL_PRO_COPY[currentLang];
        const chkInput = h('input', {
          type: 'checkbox',
        }) as HTMLInputElement;
        chkInput.checked = checked;

        const enterBtn = h('button', {
          type: 'button',
          class: 'jf-cta-btn',
          text: forceViewOnly && proState.legalAccepted ? cp.closeLabel : cp.btnAcceptEnter,
          onclick: () => {
            proState.legalAccepted = true;
            if (!proState.legalAcceptedAt) proState.legalAcceptedAt = Date.now();
            saveProLicenseState();
            persistNow();
            backdrop.remove();
          },
        }) as HTMLButtonElement;
        enterBtn.disabled = !checked;

        chkInput.addEventListener('change', () => {
          checked = chkInput.checked;
          enterBtn.disabled = !checked;
        });

        const legalSectionBody = h(
          'div',
          { class: 'jf-modal-body' },
          h('h3', { class: 'jf-section-heading', text: cp.welcomeModalTitle }),
          h(
            'div',
            { class: 'jf-legal-box' },
            h('div', { class: 'jf-legal-sec' }, h('h4', { text: cp.hearingTitle }), h('p', { text: cp.hearingBody })),
            h('div', { class: 'jf-legal-sec' }, h('h4', { text: cp.privacyTitle }), h('p', { text: cp.privacyBody })),
            h('div', { class: 'jf-legal-sec' }, h('h4', { text: cp.eulaTitle }), h('p', { text: cp.eulaBody })),
            h(
              'div',
              { class: 'jf-legal-sec' },
              h('h4', { text: cp.androidBillingTitle }),
              h('p', { text: cp.androidBillingBody })
            )
          ),
          h('label', { class: 'jf-ack-row' }, chkInput, h('span', { text: cp.chkAcknowledge }))
        );

        const modal = h(
          'div',
          {
            class: 'jf-glass-modal jf-startup-scroll-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': cp.welcomeModalTitle,
          },
          forceViewOnly && proState.legalAccepted
            ? h('button', {
                type: 'button',
                class: 'jf-close-top',
                'aria-label': cp.closeLabel,
                text: '×',
                onclick: () => backdrop.remove(),
              })
            : null,
          buildFuturisticHero(
            (lc) => {
              const prevScroll = modal.scrollTop;
              setAppLanguage(lc);
              renderLegal();
              const nextModal = backdrop.querySelector('.jf-startup-scroll-modal') as HTMLElement | null;
              if (nextModal) nextModal.scrollTop = prevScroll;
            },
            {
              fullFold: true,
              onScrollDown: () => {
                legalSectionBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
              },
            }
          ),
          legalSectionBody,
          h('div', { class: 'jf-modal-footer' }, enterBtn)
        );
        backdrop.replaceChildren(modal);
      };

      renderLegal();
      document.body.append(backdrop);
    };

    /* Modal Master PRO: 4 Días (96 Horas) + Pase Anual ($7.99 USD/año) + Mensualidad ($5.00 USD/mes) */
    let proTimerIv: any = 0;
    const activatePermanentPro = (plan: 'annual' | 'monthly' | 'lifetime', codeUsed = '') => {
      proState.proUnlocked = true;
      proState.proUnlockedAt = Date.now();
      proState.proPlan = plan;
      if (codeUsed) proState.proLicenseCode = codeUsed;
      // Las opciones de Audio Global permanecen desactivadas hasta que el usuario las active manualmente en Consola
      S.jack.hiRes = true;
      saveProLicenseState();
      updatePreviewBarUi();
      syncAll();
      commit();
      persistNow();
      toast(LEGAL_PRO_COPY[currentLang].proActivatedToast);
    };

    window.__onProPurchaseResult = (ok: boolean, plan?: string) => {
      if (ok) {
        const cleanPlan = plan === 'monthly' ? 'monthly' : plan === 'annual' ? 'annual' : 'annual';
        activatePermanentPro(cleanPlan);
        const bd = document.getElementById('jfProModalBackdrop');
        if (bd) bd.remove();
        clearInterval(proTimerIv);
      }
    };

    openProModal = () => {
      const prev = document.getElementById('jfProModalBackdrop');
      if (prev) prev.remove();
      clearInterval(proTimerIv);

      const backdrop = h('div', {
        id: 'jfProModalBackdrop',
        class: 'jf-modal-backdrop',
        onclick: (e: MouseEvent) => {
          if (e.target === backdrop) {
            clearInterval(proTimerIv);
            backdrop.remove();
            updatePreviewBarUi();
          }
        },
      });

      const renderPro = () => {
        const cp = LEGAL_PRO_COPY[currentLang];
        const tier = getLicenseTier();
        const statusEl = h('div', { class: 'jf-pro-status-box', 'data-tier': tier });

        const refreshCountdown = () => {
          const tNow = getLicenseTier();
          statusEl.dataset.tier = tNow;
          if (tNow === 'pro') {
            statusEl.textContent = cp.proStatusActivePlan;
          } else if (tNow === 'trial') {
            const remMs = Math.max(0, TRIAL_DURATION_MS - (Date.now() - proState.trialStartedAt));
            const d = Math.floor(remMs / 86400000);
            const hrs = Math.floor((remMs % 86400000) / 3600000);
            const mins = Math.floor((remMs % 3600000) / 60000);
            const secs = Math.floor((remMs % 60000) / 1000);
            statusEl.textContent = `${cp.proStatusTrial(d, hrs, mins)} (${String(secs).padStart(2, '0')}s)`;
          } else if (tNow === 'expired') {
            statusEl.textContent = cp.proStatusExpired;
          } else {
            statusEl.textContent = cp.proStatusFree;
          }
          updateHeaderProUi();
        };
        refreshCountdown();
        clearInterval(proTimerIv);
        proTimerIv = setInterval(refreshCountdown, 1000);

        const featList = h(
          'ul',
          { class: 'jf-pro-feat-list' },
          ...cp.proFeatures.map((ft) => h('li', { text: ft }))
        );

        const startTrialBtn =
          proState.trialStartedAt === 0 && !proState.proUnlocked
            ? h('button', {
                type: 'button',
                class: 'jf-trial-cta',
                text: cp.btnStart4DayTrial,
                onclick: () => {
                  proState.trialStartedAt = Date.now();
                  // Audio Global permanece desactivado hasta que el usuario lo presione manualmente en Consola
                  S.jack.hiRes = true;
                  saveProLicenseState();
                  updatePreviewBarUi();
                  syncAll();
                  commit();
                  persistNow();
                  toast(LEGAL_PRO_COPY[currentLang].trialStartedToast);
                  clearInterval(proTimerIv);
                  backdrop.remove();
                },
              })
            : !proState.proUnlocked && proState.trialStartedAt > 0
            ? h('div', { class: 'mini num', style: 'text-align:center;opacity:0.8', text: cp.trialUsedLabel })
            : null;

        const handleStorePurchase = (plan: 'annual' | 'monthly') => {
          if (NATIVE && window.AndroidBridge?.launchProPurchase) {
            try {
              window.AndroidBridge.launchProPurchase(plan);
              return;
            } catch (_e) {}
          }
          if (proState.trialStartedAt === 0 && !proState.proUnlocked) {
            proState.trialStartedAt = Date.now();
            S.jack.hiRes = true;
            saveProLicenseState();
            updatePreviewBarUi();
            syncAll();
            commit();
            persistNow();
            toast(LEGAL_PRO_COPY[currentLang].trialStartedToast);
            clearInterval(proTimerIv);
            backdrop.remove();
          } else {
            keyInput.focus();
            toast(cp.licenseCodePlaceholder);
          }
        };

        const keyInput = h('input', {
          type: 'text',
          class: 'field',
          placeholder: cp.licenseCodePlaceholder,
          maxlength: 40,
        }) as HTMLInputElement;

        const activateKeyBtn = h('button', {
          type: 'button',
          class: 'btn pri',
          text: cp.btnActivateCode,
          onclick: () => {
            const norm = (keyInput.value || '').trim().toUpperCase();
            if (['JACK-PRO-MASTER', 'JACK-FRIEDRICH', 'MASTER-PRO-2026', 'JF-MASTER-PRO'].includes(norm)) {
              activatePermanentPro('annual', norm);
              clearInterval(proTimerIv);
              backdrop.remove();
            } else {
              toast(LEGAL_PRO_COPY[currentLang].invalidCodeToast);
            }
          },
        });

        const modal = h(
          'div',
          { class: 'jf-glass-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': cp.proModalTitle },
          h('button', {
            type: 'button',
            class: 'jf-close-top',
            'aria-label': cp.closeLabel,
            text: '×',
            onclick: () => {
              clearInterval(proTimerIv);
              backdrop.remove();
              updatePreviewBarUi();
            },
          }),
          buildFuturisticHero((lc) => {
            setAppLanguage(lc);
            renderPro();
          }),
          h(
            'div',
            { class: 'jf-modal-body' },
            statusEl,
            startTrialBtn,
            h('h3', { class: 'jf-section-heading', text: cp.proFeaturesTitle }),
            featList,
            h('p', { class: 'mini', text: cp.freeAlwaysNote }),
            !proState.proUnlocked
              ? h(
                  'div',
                  { class: 'jf-plan-grid' },
                  h(
                    'div',
                    { class: 'jf-plan-card featured' },
                    h(
                      'div',
                      null,
                      h('strong', { text: cp.planAnnualTitle }),
                      h('div', { class: 'jf-plan-price', text: cp.planAnnualPrice }),
                      h('p', { class: 'mini', text: cp.planAnnualSub })
                    ),
                    h('button', {
                      type: 'button',
                      class: 'btn pri',
                      text: cp.btnSubscribeAnnual,
                      onclick: () => handleStorePurchase('annual'),
                    })
                  ),
                  h(
                    'div',
                    { class: 'jf-plan-card' },
                    h(
                      'div',
                      null,
                      h('strong', { text: cp.planMonthlyTitle }),
                      h('div', { class: 'jf-plan-price', text: cp.planMonthlyPrice }),
                      h('p', { class: 'mini', text: cp.planMonthlySub })
                    ),
                    h('button', {
                      type: 'button',
                      class: 'btn',
                      text: cp.btnSubscribeMonthly,
                      onclick: () => handleStorePurchase('monthly'),
                    })
                  )
                )
              : null,
            !proState.proUnlocked ? h('div', { class: 'jf-key-row' }, keyInput, activateKeyBtn) : null,
            h('p', { class: 'jf-billing-note', text: cp.billingLegalFooter })
          ),
          h(
            'div',
            { class: 'jf-modal-footer' },
            h('button', {
              type: 'button',
              class: 'btn ghost',
              text: cp.btnRestorePurchase,
              onclick: () => {
                if (NATIVE && window.AndroidBridge?.restoreProPurchase?.()) {
                  activatePermanentPro('annual');
                  renderPro();
                } else if (proState.proUnlocked) {
                  toast(cp.proStatusActivePlan);
                } else {
                  toast(cp.invalidCodeToast);
                }
              },
            }),
            h('button', {
              type: 'button',
              class: 'btn ghost',
              text: cp.btnViewLegal,
              onclick: () => {
                clearInterval(proTimerIv);
                backdrop.remove();
                openStartupLegalModal(true);
              },
            }),
            h('button', {
              type: 'button',
              class: 'btn pri',
              text: hasProAccess() ? cp.closeLabel : cp.btnPreviewOnlyDismiss,
              onclick: () => {
                clearInterval(proTimerIv);
                backdrop.remove();
                updatePreviewBarUi();
              },
            })
          )
        );
        backdrop.replaceChildren(modal);
      };

      renderPro();
      document.body.append(backdrop);
    };

    /* Bloqueo de Modo Vista Previa (Solo Lectura) cuando el usuario NO ha aceptado la Prueba Gratis de 4 días:
       permite navegar por todos los apartados, sub-pestañas e instrumentos desplegables, pero bloquea mover o aplicar ajustes. */
    let lastPreviewToastMs = 0;
    const isAllowedInPreviewMode = (target: Element | null): boolean => {
      if (!target) return true;
      if (
        target.closest(
          '#tabs, .top-lang-btn, .top-pro-btn, .jf-preview-bar, .con-subnav, .con-more-btn, .inst-toggle-hit, .inst-jump-chip, summary, .strip-nav, [data-gen-cat], #secSel'
        )
      ) {
        return true;
      }
      const inMusicPane = target.closest('.pane[data-id="music"]');
      if (inMusicPane && !target.closest('[data-dsp-card="1"]')) {
        return true;
      }
      return false;
    };

    const guardPreviewInteraction = (e: Event) => {
      if (!IS_PRO_EDITION || hasProAccess()) return;
      const t = e.target as Element | null;
      if (!t || isAllowedInPreviewMode(t)) return;
      const interactive = t.closest(
        'button, input, select, textarea, [role="slider"], [role="switch"], .fcol, .con-fcol, .rknob-dial, .prrow'
      );
      if (!interactive) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof (e as any).stopImmediatePropagation === 'function') {
        (e as any).stopImmediatePropagation();
      }
      const now = Date.now();
      if (now - lastPreviewToastMs > 1300) {
        lastPreviewToastMs = now;
        toast(LEGAL_PRO_COPY[currentLang].previewLockedToast);
      }
    };

    ['pointerdown', 'mousedown', 'touchstart', 'click', 'input', 'change', 'keydown'].forEach((evName) => {
      rootEl.addEventListener(evName, guardPreviewInteraction, true);
    });
  }
  function paintBypass() {
    byp.setAttribute('aria-checked', String(!S.bypass));
    byp.setAttribute('aria-label', S.bypass ? 'Procesado desactivado, audio original' : 'Procesado de audio activo');
  }
  byp.addEventListener('click', () => {
    S.bypass = !S.bypass;
    paintBypass();
    commit();
    persistNow();
    toast(S.bypass ? 'Audio original, sin procesar' : 'Procesado activo');
  });
  $('#saveAll')!.addEventListener('click', () => saveAllPreset(''));
  {
    const b = $('#resetAll')!;
    b.dataset.t = b.textContent || 'Cero';
    let a: any = 0;
    b.addEventListener('click', () => {
      if (a) {
        clearTimeout(a);
        a = 0;
        b.textContent = b.dataset.t || 'Cero';
        ORDER.forEach((k) => {
          if (!S.locks[k]) resetSec(k);
        });
        S.bypass = false;
        syncAll();
        commit();
        persistNow();
        toast('Todo en cero (menos lo bloqueado)');
        return;
      }
      b.textContent = '¿Seguro?';
      a = setTimeout(() => {
        a = 0;
        b.textContent = b.dataset.t || 'Cero';
      }, 3000);
    });
  }

  const seek = $<HTMLInputElement>('#seek')!;
  const updSeekPct = () => {
    const mx = +seek.max || 1;
    seek.style.setProperty('--p', clamp(((+seek.value || 0) / mx) * 100, 0, 100).toFixed(1) + '%');
  };
  updSeekPct();
  const dTimeEl = $('#dTime');
  let lastTimeSec = -1;
  let lastSeekCommit = 0;
  const commitSeekValue = (force: boolean) => {
    const now = performance.now();
    if (!force && now - lastSeekCommit < 180) return;
    lastSeekCommit = now;
    if (audio && isFinite(+seek.value)) {
      try {
        audio.currentTime = clamp(+seek.value, 0, audio.duration || +seek.max || 0);
      } catch (_e) {}
    }
  };
  seek.addEventListener('pointerdown', () => {
    seeking = true;
  });
  ['pointerup', 'pointercancel', 'change'].forEach((ev) =>
    seek.addEventListener(ev, () => {
      if (seeking || ev === 'change') commitSeekValue(true);
      seeking = false;
      syncMediaSession(true);
    })
  );
  seek.addEventListener('input', () => {
    seeking = true;
    updSeekPct();
    if (dTimeEl) dTimeEl.textContent = mmss(+seek.value) + ' / ' + mmss(audio.duration || 0);
    commitSeekValue(false);
  });

  function checkAutoCrossfade(el: HTMLAudioElement) {
    if (el !== audio || rebuildingCtx || !userWantsPlaying || el.paused || seeking || xfadeActive) return;
    maybePreloadStandby();
    const xf = S.play.xfade || 0;
    if (xf <= 0 || repeat === 2) return;
    const dur = el.duration;
    if (!dur || !isFinite(dur) || dur < Math.max(5, xf * 1.6)) return;
    const rem = dur - el.currentTime;
    if (rem <= xf && rem > 0.08) {
      const nx = peekNextAutoIndex();
      if (nx >= 0 && nx !== cur) {
        triggerDeckHandoff(nx, xf);
      }
    }
  }

  let lastHiddenTransitionTs = 0;
  let lastAutoBgResumeTs = 0;

  function bindDeckEvents(el: HTMLAudioElement) {
    el.addEventListener('play', () => {
      if (el !== audio || rebuildingCtx) return;
      userWantsPlaying = true;
      clearTimeout(resumeT);
      const ic = $('#playIcon');
      if (ic) ic.innerHTML = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
      $('#bPlay')!.setAttribute('aria-label', 'Pausar');
      syncDitherConnection();
      updateEngineSpecUi();
      syncMediaSession(true);
    });
    el.addEventListener('pause', () => {
      if (el !== audio || rebuildingCtx) return;
      if (userWantsPlaying && !el.ended) {
        const now = performance.now();
        const isSpuriousBgPause =
          (!isUiAwake() || now - lastHiddenTransitionTs < 1200) &&
          now - lastAutoBgResumeTs > 1200 &&
          !inPhoneCall();
        if (isSpuriousBgPause) {
          lastAutoBgResumeTs = now;
          clearTimeout(resumeT);
          resumeT = setTimeout(() => {
            if (el !== audio || rebuildingCtx || !userWantsPlaying || !el.paused || el.ended || inPhoneCall()) return;
            if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
            el.play().catch(() => {});
          }, 70);
          return;
        }
        /* Pausa real solicitada por el sistema (llamada o AudioFocus permanente): respetarla */
        userWantsPlaying = false;
      }
      syncDitherConnection();
      const ic = $('#playIcon');
      if (ic) ic.innerHTML = '<path d="M8 5v14l11-7z"/>';
      $('#bPlay')!.setAttribute('aria-label', 'Reproducir');
      syncMediaSession(true);
    });
    el.addEventListener('loadedmetadata', () => {
      if (el !== audio) return;
      const dur = el.duration || 0;
      seek.max = String(dur || 1);
      if (PL[cur] && dur > 0) {
        const prevDur = PL[cur].duration || 0;
        const nextDur = Math.round(dur);
        PL[cur].duration = nextDur;
        if (PL[cur].rawFile && !PL[cur].kbps) {
          PL[cur].kbps = Math.round((PL[cur].rawFile!.size * 8) / (dur * 1000));
        }
        if (Math.abs(prevDur - nextDur) > 1) {
          const rowBtn = $('#plist')?.querySelector<HTMLElement>('.pitem[data-idx="' + cur + '"]');
          if (rowBtn) {
            let durSpan = rowBtn.querySelector<HTMLElement>('.pdur');
            if (!durSpan) {
              durSpan = h('span', { class: 'pdur num' });
              rowBtn.append(durSpan);
            }
            durSpan.textContent = mmss(nextDur);
          }
        }
      }
      updateEngineSpecUi();
      updSeekPct();
      syncMediaSession(true);
    });
    el.addEventListener('timeupdate', () => {
      if (el !== audio) return;
      if (!seeking) {
        seek.value = String(el.currentTime);
        updSeekPct();
      }
      const sec = el.currentTime | 0;
      if (sec !== lastTimeSec) {
        lastTimeSec = sec;
        if (dTimeEl) dTimeEl.textContent = mmss(sec) + ' / ' + mmss(el.duration || 0);
      }
      checkAutoCrossfade(el);
    });
    el.addEventListener('ended', () => {
      if (el !== audio || rebuildingCtx) return;
      if (repeat === 2) {
        el.currentTime = 0;
        playNow();
      } else nextTrack(true);
    });
    el.addEventListener('error', async () => {
      if (el !== audio || rebuildingCtx) return;
      if (el.src) {
        const t = PL[cur];
        if (t && t.rawFile && !t.decodedFallback) {
          const ok = await tryDecodeFallback(t);
          if (ok) return;
        }
        userWantsPlaying = false;
        syncDitherConnection();
        toast('Formato no compatible con este dispositivo');
      }
    });
  }

  /* Solo reconstruye el contexto si un DAC USB-C externo cambió realmente el reloj físico del sistema */
  function rebuildIfHardwareClockChanged() {
    if (!ctx || !NATIVE) {
      applyAll(true);
      updateEngineSpecUi();
      paintJackStatus();
      return;
    }
    const hwRate = jackHw.nativeRate || 48000;
    if (Math.abs(ctx.sampleRate - hwRate) < 100) {
      applyAll(true);
      updateEngineSpecUi();
      paintJackStatus();
      return;
    }
    const oldCtx = ctx;
    const oldA = deckA;
    const oldB = deckB;
    const curSrc = audio ? audio.src : '';
    const curPos = audio ? audio.currentTime || 0 : 0;
    const shouldResume = !!(userWantsPlaying && curSrc);

    rebuildingCtx = true;
    clearTimeout(resumeT);
    clearTimeout(xfadeTimer);
    clearTimeout(irT);
    xfadeActive = false;
    preloadedIdx = -1;

    try {
      N.tLfo?.stop?.();
      N.vLfo?.stop?.();
      N.ditherSrc?.stop?.();
    } catch (_e) {}

    for (const k in P_CACHE) delete P_CACHE[k];
    (Object.keys(FX_CONN) as Array<keyof typeof FX_CONN>).forEach((k) => {
      FX_CONN[k] = false;
    });
    for (const k in N) delete N[k];
    ditherReady = false;
    irKey = '';
    satSig = '';
    airDriveSig = -1;
    harmDrive = -1;
    ceilSig = -999;
    conLimSig = -999;
    lastPanX = NaN;
    lastPanY = NaN;
    lastPanZ = NaN;
    freqData = null;
    vizDirty = true;

    build(bindDeckEvents);

    try {
      if (oldA) {
        oldA.pause();
        oldA.removeAttribute('src');
        oldA.load();
      }
      if (oldB) {
        oldB.pause();
        oldB.removeAttribute('src');
        oldB.load();
      }
    } catch (_e) {}
    if (oldCtx) {
      oldCtx.close().catch(() => {});
    }

    applyAll(true);

    if (curSrc && audio) {
      audio.src = curSrc;
      const restorePos = () => {
        if (curPos > 0) {
          try {
            audio.currentTime = curPos;
          } catch (_e) {}
        }
      };
      if (audio.readyState >= 1) restorePos();
      else audio.addEventListener('loadedmetadata', restorePos, { once: true });
    }

    rebuildingCtx = false;
    updateEngineSpecUi();
    paintJackStatus();

    if (shouldResume && audio) {
      playNow();
    }
  }

  window.__onNativeJack = (jackJson: unknown, reason?: string) => {
    const prevConnected = jackHw.jackConnected;
    const parsed = parseNativeJackJson(jackJson);
    if (!parsed) return;
    jackHw = parsed;
    rebuildIfHardwareClockChanged();
    if (prevConnected !== parsed.jackConnected && parsed.jackConnected && ctx && reason === 'plug') {
      toast(
        parsed.deviceName +
          ' activo · Reloj 1:1 ' +
          +(ctx.sampleRate / 1000).toFixed(1) +
          ' kHz / ' +
          parsed.bitDepth +
          '-bit'
      );
    }
  };

  if (!NATIVE && typeof navigator !== 'undefined' && navigator.mediaDevices) {
    const probeWebAudioOutputs = async () => {
      try {
        if (!navigator.mediaDevices.enumerateDevices) return;
        const devs = await navigator.mediaDevices.enumerateDevices();
        const outs = devs.filter((d) => d.kind === 'audiooutput');
        const wired = outs.find((d) => /headphone|headset|wired|jack|line|usb|external|audifono|auricular/i.test(d.label || ''));
        if (wired && wired.label) {
          jackHw.jackConnected = true;
          jackHw.deviceName = wired.label;
        } else {
          jackHw.deviceName = 'Salida directa del sistema';
        }
        updateEngineSpecUi();
        paintJackStatus();
      } catch (_e) {}
    };
    probeWebAudioOutputs();
    try {
      navigator.mediaDevices.addEventListener('devicechange', probeWebAudioOutputs);
    } catch (_e) {}
  }

  refreshNativeJackSync();
  build(bindDeckEvents);
  updateEngineSpecUi();
  paintJackStatus();

  $('#bPlay')!.addEventListener('click', () => {
    if (!PL.length) {
      showTab('music');
      if (NATIVE && !hasPerm) {
        try {
          window.AndroidBridge?.requestMusicPermission?.();
        } catch (_e) {}
      } else toast(NATIVE ? 'No hay canciones en el teléfono' : 'Añade música primero');
      return;
    }
    if (cur < 0) loadTrack(0, true);
    else if (audio.paused || !userWantsPlaying) playNow();
    else pauseByUser();
  });
  $('#bNext')!.addEventListener('click', () => nextTrack(false));
  $('#bPrev')!.addEventListener('click', prevTrack);

  document.addEventListener(
    'pointerdown',
    () => {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    { passive: true }
  );

  /* Pausa de GPU al hacer scroll dentro de la app para liberar 100% del bus de memoria al audio */
  main.addEventListener(
    'scroll',
    () => {
      scrollBusyUntil = performance.now() + 140;
    },
    { passive: true }
  );

  let loopRaf = 0;
  let last = performance.now();
  let lastCompUi = 0;

  const readCompDb = (node: any) => {
    if (!node) return 0;
    const r = node.reduction;
    return Math.abs(typeof r === 'number' ? r : (r && r.value) || 0);
  };

  function loop(now: number) {
    loopRaf = 0;
    if (!isUiAwake()) return;
    loopRaf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    placePan(dt);
    drawViz(now);
    if (S.fx.hap.on || shakeAmt) hapticTick(now);
    if (now - lastCompUi > 90) {
      lastCompUi = now;
      if (curTab === 'con' && ctx && conCompReducEl && S.con.enabled !== false && S.con.compOn) {
        const rdb = readCompDb(N.conComp);
        conCompReducEl.textContent = 'Compresor LR4 activo · Reducción −' + rdb.toFixed(1) + ' dB';
        if (S.con.vizOn !== false && audio && !audio.paused && drawConCurveFn) {
          drawConCurveFn();
        }
      } else if (curTab === 'con' && S.con.vizOn !== false && audio && !audio.paused && drawConCurveFn) {
        drawConCurveFn();
      } else if (curTab === 'fx') {
        if (S.fx.sp.on) drawRadar();
        if (ctx && reduc && S.fx.comp.on) {
          reduc.textContent = 'Reducción ' + readCompDb(N.comp).toFixed(1) + ' dB';
        }
        if (ctx && mbReduc && S.fx.mbcomp.on) {
          mbReduc.textContent =
            'Graves ' +
            readCompDb(N.mbLowC).toFixed(1) +
            ' · Medios ' +
            readCompDb(N.mbMidC).toFixed(1) +
            ' · Agudos ' +
            readCompDb(N.mbHighC).toFixed(1) +
            ' dB';
        }
        if (ctx && deReduc && S.fx.deess.on) {
          deReduc.textContent = 'Atenuación sibilante ' + readCompDb(N.deComp).toFixed(1) + ' dB';
        }
      }
    }
  }

  function applyUiAwakeTransition() {
    const awake = isUiAwake();
    document.body.classList.toggle('ui-idle', !awake);
    syncAnalyserConnection();
    if (!awake) {
      if (loopRaf) {
        cancelAnimationFrame(loopRaf);
        loopRaf = 0;
      }
    } else {
      vizDirty = true;
      last = performance.now();
      bgLast = last;
      if (curTab === 'con' && drawConCurveFn) drawConCurveFn();
      if (updateGlobalStatusUi) updateGlobalStatusUi();
      if (!loopRaf) loopRaf = requestAnimationFrame(loop);
    }
  }

  /* Notificación nativa instantánea desde MainActivity al bajar notificaciones, abrir PDF, cambiar ventana o tocar fondo de pantalla */
  window.__onNativeUiState = (visible: boolean, focused: boolean) => {
    const wasAwake = isUiAwake();
    nativeUiVisible = !!visible;
    nativeWindowFocused = !!focused;
    if (wasAwake !== isUiAwake()) {
      lastHiddenTransitionTs = performance.now();
      applyUiAwakeTransition();
      if (!isUiAwake()) persistNow();
    }
  };

  /* Apertura desde Ajustes de Sonido o panel de ecualizador de Android: abre Consola sin auto-encender Audio Global */
  window.__onOpenConsoleFromSystem = (callerPkg?: string) => {
    S.con.subPage = 'cfg';
    showTab('con');
    syncAll();
    toast(
      callerPkg
        ? 'Consola abierta para ' + callerPkg + ' · Activa manualmente el interruptor Global si deseas enlazarlo'
        : 'Consola abierta · Activa manualmente las opciones globales que necesites'
    );
  };

  /* Apertura directa como Reproductor de Música Predeterminado de Android (audios de WhatsApp, Chrome, Archivos, Telegram) */
  window.__onOpenExternalTrack = (rawJson: unknown) => {
    try {
      const o = typeof rawJson === 'string' ? JSON.parse(rawJson) : (rawJson as any);
      if (!o || !o.url) return;
      let idx = PL.findIndex((x) => x.url === o.url || String(x.id) === String(o.id));
      if (idx < 0) {
        PL.unshift({
          id: String(o.id || 'ext_' + Date.now()),
          name: String(o.name || 'Audio externo'),
          artist: String(o.artist || 'Abierto desde Android'),
          fmt: String(o.fmt || 'AUDIO'),
          duration: 0,
          dateAdded: Date.now() / 1000,
          url: String(o.url),
        });
        idx = 0;
        renderList();
      }
      showTab('music');
      loadTrack(idx, true);
      toast('Reproduciendo con Estudio + Consola: ' + (o.name || 'Audio'));
    } catch (_e) {}
  };

  /* Temporizador ligero solo para 2° plano (crossfade / giro 8D / háptica), 0% render GPU */
  let bgLast = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.4, (now - bgLast) / 1000);
    bgLast = now;
    if (!audio || audio.paused || rebuildingCtx) return;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!isUiAwake()) {
      checkAutoCrossfade(audio);
      if (S.fx.sp.on && S.fx.sp.rot) placePan(dt);
      if (S.fx.hap.on) {
        sampleSpectrum();
        hapticTick(now);
      }
    }
  }, 450);

  document.addEventListener('visibilitychange', () => {
    updPermBanner();
    lastHiddenTransitionTs = performance.now();
    applyUiAwakeTransition();
    if (!isUiAwake()) persistNow();
  });
  window.addEventListener('pagehide', () => persistNow());

  renderList();
  renderPresets();
  syncAll();
  applyAll(true);
  showTab('music');
  updPermBanner();

  if (IS_PRO_EDITION) {
    applyCertifiedDomTranslation(rootEl, currentLang);
    updateHeaderProUi();
    if (!proState.legalAccepted) {
      openStartupLegalModal(false);
    }
    setInterval(() => {
      updateHeaderProUi();
    }, 30000);
  }

  if (NATIVE && window.AndroidBridge?.rescanMusic) {
    try {
      window.AndroidBridge.rescanMusic();
    } catch (_e) {}
  }

  applyUiAwakeTransition();
}
