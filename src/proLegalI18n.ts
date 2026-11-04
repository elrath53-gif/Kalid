/* eslint-disable @typescript-eslint/no-explicit-any */

export type LangCode = 'es' | 'en' | 'zh' | 'ja' | 'de' | 'ko';

export interface LangMeta {
  code: LangCode;
  nativeLabel: string;
  shortLabel: string;
  htmlLang: string;
}

export const SUPPORTED_LANGS: LangMeta[] = [
  { code: 'es', nativeLabel: 'Español', shortLabel: 'ES', htmlLang: 'es' },
  { code: 'en', nativeLabel: 'English', shortLabel: 'EN', htmlLang: 'en' },
  { code: 'zh', nativeLabel: '简体中文', shortLabel: '中文', htmlLang: 'zh-CN' },
  { code: 'ja', nativeLabel: '日本語', shortLabel: '日本語', htmlLang: 'ja' },
  { code: 'de', nativeLabel: 'Deutsch', shortLabel: 'DE', htmlLang: 'de' },
  { code: 'ko', nativeLabel: '한국어', shortLabel: '한국어', htmlLang: 'ko' },
];

export type LicenseTier = 'free' | 'trial' | 'pro' | 'expired';

export interface ProLicenseState {
  legalAccepted: boolean;
  legalAcceptedAt: number;
  trialStartedAt: number; // 0 = no iniciada aún (arranca exactamente al pulsar Desbloquear 4 días)
  proUnlocked: boolean;
  proUnlockedAt: number;
  proPlan: '' | 'annual' | 'monthly' | 'lifetime';
  proLicenseCode: string;
}

export const TRIAL_DURATION_MS = 4 * 24 * 60 * 60 * 1000; // Exactamente 4 días (96 horas)

export interface LegalAndProCopy {
  betaTag: string;
  devCreditTitle: string;
  devCreditSub: string;
  engineBadge: string;
  welcomeModalTitle: string;
  hearingTitle: string;
  hearingBody: string;
  privacyTitle: string;
  privacyBody: string;
  eulaTitle: string;
  eulaBody: string;
  androidBillingTitle: string;
  androidBillingBody: string;
  chkAcknowledge: string;
  btnAcceptEnter: string;
  btnViewLegal: string;
  scrollDownLegalHint: string;

  // Pro & 4-day Trial Modal
  proBtnFree: string;
  proBtnTrial: (hrsLeft: number) => string;
  proBtnActive: string;
  proBtnExpired: string;
  proModalTitle: string;
  proModalSubtitle: string;
  proStatusFree: string;
  proStatusTrial: (days: number, hrs: number, mins: number) => string;
  proStatusExpired: string;
  proStatusActivePlan: string;
  proFeaturesTitle: string;
  proFeatures: string[];
  freeAlwaysNote: string;
  btnStart4DayTrial: string;
  btnPreviewOnlyDismiss: string;
  trialUsedLabel: string;
  planAnnualTitle: string;
  planAnnualPrice: string;
  planAnnualSub: string;
  planMonthlyTitle: string;
  planMonthlyPrice: string;
  planMonthlySub: string;
  btnSubscribeAnnual: string;
  btnSubscribeMonthly: string;
  btnRestorePurchase: string;
  licenseCodePlaceholder: string;
  btnActivateCode: string;
  previewBannerText: string;
  previewBannerBtn: string;
  previewLockedToast: string;
  trialStartedToast: string;
  proActivatedToast: string;
  invalidCodeToast: string;
  billingLegalFooter: string;
  closeLabel: string;
  langMenuTitle: string;
}

export const LEGAL_PRO_COPY: Record<LangCode, LegalAndProCopy> = {
  es: {
    betaTag: 'VERSIÓN BETA · EDICIÓN MASTER PRO',
    devCreditTitle: 'Desarrollado por Jack Friedrich',
    devCreditSub: 'Arquitectura Acústica IEEE 64-bit Float · Motor C++ DVC & Sistema Global',
    engineBadge: 'JACK FRIEDRICH AUDIO LABS · STORE 0% UNCOMPRESSED',
    welcomeModalTitle: 'Acuerdo Legal, Seguridad Auditiva y Aviso de Privacidad',
    hearingTitle: '1. Seguridad Acústica y Protección Auditiva (Normas EN 50332 / OMS ITU-T H.870)',
    hearingBody:
      'Este software procesa ganancia de preamplificación, subgraves de alta energía, excitación armónica y Control de Volumen Directo (DVC). La exposición prolongada a niveles de presión sonora superiores a 85 dB(A) puede provocar pérdida auditiva permanente o acúfenos (tinnitus), así como sobrecarga física en altavoces o transductores IEM. Empiece siempre con volumen moderado y mantenga activo el Limitador Brickwall True-Peak.',
    privacyTitle: '2. Aviso de Privacidad Internacional Zero-Cloud (GDPR / LFPDPPP / CCPA / PIPA / APPI / PIPL)',
    privacyBody:
      'Procesamiento 100% Local en el Dispositivo: Estudio Master Hi-Res NO recopila, almacena, vende ni transmite datos personales, listas de reproducción, archivos de audio, grabaciones de micrófono ni identificadores publicitarios hacia servidores externos. Los permisos READ_MEDIA_AUDIO, MODIFY_AUDIO_SETTINGS y FOREGROUND_SERVICE se emplean exclusivamente en memoria local para reproducir su biblioteca y enlazar el motor DSP del dispositivo.',
    eulaTitle: '3. Licencia de Usuario Final (EULA) y Limitación de Responsabilidad',
    eulaBody:
      'Software en fase Beta desarrollado por Jack Friedrich, suministrado «TAL CUAL» (AS-IS) sin garantías implícitas sobre controladores propietarios de terceros. El usuario asume la responsabilidad exclusiva por la configuración de ganancia aplicada a sus equipos de audio. Queda prohibida la ingeniería inversa o redistribución no autorizada del paquete.',
    androidBillingTitle: '4. Condiciones Transparentes de Prueba de 4 Días y Versión Pro',
    androidBillingBody:
      'La aplicación incluye funciones base gratuitas permanentes. La prueba completa Master Pro dura exactamente 4 días (96 horas) contados únicamente desde el momento en que usted pulsa «Desbloquear 4 días de prueba» (sin cargos automáticos ocultos). En distribución Google Play / App Store, las compras y suscripciones se gestionan mediante la facturación oficial de la tienda y pueden cancelarse en cualquier momento.',
    chkAcknowledge: 'He leído y acepto el Aviso de Privacidad Local, la Advertencia de Seguridad Auditiva y el Acuerdo EULA.',
    btnAcceptEnter: 'Aceptar y Entrar al Estudio',
    btnViewLegal: 'Aviso Legal y Créditos',
    scrollDownLegalHint: 'Desliza hacia abajo · Aviso Legal y Continuar',

    proBtnFree: 'PRO · 4d',
    proBtnTrial: (h) => `PRO · ${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · Prueba de 4 Días',
    proModalSubtitle: 'Desarrollado por Jack Friedrich · Desbloqueo total de grado audiófilo',
    proStatusFree: 'Modo Vista Previa · Acepta tus 4 días (96 h) de prueba gratis para desbloquear y mover todos los ajustes del estudio.',
    proStatusTrial: (d, h, m) => `Prueba Master PRO Activa · Tiempo restante: ${d}d ${h}h ${m}m`,
    proStatusExpired: 'Tu prueba gratuita de 4 días ha finalizado · Elige tu Pase Anual o Mensual para volver a mover y aplicar ajustes.',
    proStatusActivePlan: 'Suscripción Master PRO Activa · Todas las etapas de 64-bit y Consola DVC desbloqueadas.',
    proFeaturesTitle: 'Todo lo que desbloquea Master PRO:',
    proFeatures: [
      'Interacción total en todos los apartados: Consola DVC, EQ 30 ISO, Claridad 16, Instrumentos, Efectos, Vibración, Géneros y Presets',
      'Consola Final Independiente completa (Modo Paramétrico Frec/Q + Compresor LR4 6 perillas + DVC)',
      'Rack Completo: Compresor Multibanda, De-Esser, Saturación 4×, Excitador de Aire y Reverb WAV 32-bit',
      'Salida Directa 1:1 para Puerto Jack 3.5 mm / DAC USB-C + Dithering 24-bit TPDF + Vibración Háptica',
      'Audio Global experimental para otras apps en Android (actualmente en desarrollo Beta)',
    ],
    freeAlwaysNote: 'Si cierras esta ventana sin aceptar, podrás ver todos los apartados como vista previa, pero los controles permanecerán fijos hasta desbloquear.',
    btnStart4DayTrial: 'Aceptar y Desbloquear 4 Días de Prueba Gratis ($0.00 hoy)',
    btnPreviewOnlyDismiss: 'Solo ver en Modo Vista Previa (sin ajustar)',
    trialUsedLabel: 'Prueba gratuita de 4 días ya utilizada en este dispositivo',
    planAnnualTitle: 'Pase Anual Master PRO (Mejor Valor)',
    planAnnualPrice: '$7.99 USD / año',
    planAnnualSub: 'Equivale a ~$0.67 USD/mes · Ahorras más del 85% frente al plan mensual',
    planMonthlyTitle: 'Mensualidad Master PRO',
    planMonthlyPrice: '$5.00 USD / mes',
    planMonthlySub: 'Acceso completo mes a mes · Cancela cuando quieras en Google Play',
    btnSubscribeAnnual: 'Activar Pase Anual · $7.99/año',
    btnSubscribeMonthly: 'Activar Mensualidad · $5.00/mes',
    btnRestorePurchase: 'Restaurar compra',
    licenseCodePlaceholder: 'Código Beta / Clave de fundador (ej. JACK-PRO-MASTER)',
    btnActivateCode: 'Activar clave',
    previewBannerText: 'Modo Vista Previa (solo lectura) · Desbloquea tus 4 días gratis para mover y aplicar ajustes',
    previewBannerBtn: 'Activar 4 Días Gratis',
    previewLockedToast: 'Modo Vista Previa · Pulsa «Activar 4 Días Gratis» o el botón PRO arriba para mover ajustes',
    trialStartedToast: '¡4 días (96 horas) de Master PRO desbloqueados! Ya puedes mover todos los ajustes.',
    proActivatedToast: '¡Pase Master PRO activado! Gracias por apoyar a Jack Friedrich.',
    invalidCodeToast: 'Clave no reconocida',
    billingLegalFooter:
      'Divulgación obligatoria de facturación: La prueba local de 4 días (96 h) no realiza ningún cobro automático al vencer. Las suscripciones en tienda ($7.99 USD/año o $5.00 USD/mes) se renuevan automáticamente salvo cancelación al menos 24 h antes del fin del periodo en Google Play → Pagos y suscripciones.',
    closeLabel: 'Cerrar',
    langMenuTitle: 'Idioma nativo certificado',
  },

  en: {
    betaTag: 'BETA RELEASE · MASTER PRO EDITION',
    devCreditTitle: 'Developed by Jack Friedrich',
    devCreditSub: 'IEEE 64-bit Float Acoustic Architecture · C++ DVC & System-Wide DSP Engine',
    engineBadge: 'JACK FRIEDRICH AUDIO LABS · STORE 0% UNCOMPRESSED',
    welcomeModalTitle: 'Legal Agreement, Hearing Safety & Privacy Notice',
    hearingTitle: '1. Hearing Protection & Acoustic Safety Warning (EN 50332 / WHO ITU-T H.870)',
    hearingBody:
      'This software performs high-precision preamplification, sub-bass synthesis, harmonic excitation, and Direct Volume Control (DVC). Prolonged listening above 85 dB(A) may cause permanent Noise-Induced Hearing Loss (NIHL), tinnitus, or physical damage to headphones, IEMs, and speakers. Always start at low volume and keep the True-Peak Brickwall Limiter engaged.',
    privacyTitle: '2. Zero-Cloud International Privacy Notice (GDPR / CCPA / UK-GDPR / PIPA / APPI / PIPL)',
    privacyBody:
      '100% On-Device Processing: Estudio Master Hi-Res does NOT collect, store, sell, or transmit personal data, music libraries, audio streams, microphone input, or advertising identifiers to external servers. Android permissions (READ_MEDIA_AUDIO, MODIFY_AUDIO_SETTINGS, FOREGROUND_SERVICE) operate strictly on-device to play local files and attach hardware audio effects.',
    eulaTitle: '3. End-User License Agreement (EULA) & Limitation of Liability',
    eulaBody:
      'Beta software developed by Jack Friedrich, provided strictly "AS IS" without warranties of any kind across third-party OEM audio HALs. To the maximum extent permitted by applicable law, the developer shall not be liable for hearing injury or audio transducer damage resulting from user-selected gain settings.',
    androidBillingTitle: '4. Transparent 4-Day Free Trial & Master Pro Terms',
    androidBillingBody:
      'Local playback works immediately, and all studio panes can be inspected in read-only Preview Mode. Your 4-day (96-hour) full Master Pro trial begins exclusively when you tap "Unlock 4-Day Free Trial" with zero automatic charges upon expiration. Official store subscriptions ($7.99/yr or $5.00/mo) are processed via Google Play / App Store Billing and may be canceled anytime.',
    chkAcknowledge: 'I have read and agree to the On-Device Privacy Notice, Hearing Safety Warning, and EULA.',
    btnAcceptEnter: 'Accept & Enter Studio',
    btnViewLegal: 'Legal Notice & Credits',
    scrollDownLegalHint: 'Scroll down · Legal Notice & Continue',

    proBtnFree: 'PRO · 4d',
    proBtnTrial: (h) => `PRO · ${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · 4-Day Free Trial',
    proModalSubtitle: 'Engineered by Jack Friedrich · Full Audiophile Mastering Suite',
    proStatusFree: 'Preview Mode Active · Accept your 4-day (96-hour) free trial to unlock and adjust all studio parameters.',
    proStatusTrial: (d, h, m) => `Master PRO Trial Active · Time remaining: ${d}d ${h}h ${m}m`,
    proStatusExpired: 'Your 4-day Pro trial has ended · Choose an Annual or Monthly pass to adjust studio controls again.',
    proStatusActivePlan: 'Master PRO Pass Active · All 64-bit Mastering & DVC Console stages unlocked.',
    proFeaturesTitle: 'Everything unlocked in Master PRO:',
    proFeatures: [
      'Full interactive control across Console DVC, 30-Band ISO EQ, Clarity 16, Instruments, Effects, Haptics, Genres & Presets',
      'Independent Final-Stage Console (Parametric Freq/Q Mode + 6-Knob LR4 Compressor + DVC)',
      'Full Studio Rack: 3-Band Multiband Compressor, De-Esser, 4× Tube/Tape Saturation & 32-bit Float WAV Reverb',
      'Bit-Perfect 1:1 3.5mm Jack / USB-C DAC Output + 24-bit TPDF Dither + Sub-Bass Haptics',
      'Experimental Android System-Wide Audio for external apps (currently in Beta development)',
    ],
    freeAlwaysNote: 'If you close this window without accepting, you can view all tabs in read-only Preview Mode, but sliders and presets remain locked until unlocked.',
    btnStart4DayTrial: 'Accept & Unlock 4-Day Free PRO Trial ($0.00 Today)',
    btnPreviewOnlyDismiss: 'Browse in Read-Only Preview Mode',
    trialUsedLabel: '4-day free trial already used on this device',
    planAnnualTitle: 'Master PRO Annual Pass (Best Value)',
    planAnnualPrice: '$7.99 USD / year',
    planAnnualSub: 'Just ~$0.67 USD/mo · Save over 85% compared to monthly billing',
    planMonthlyTitle: 'Master PRO Monthly Pass',
    planMonthlyPrice: '$5.00 USD / month',
    planMonthlySub: 'Flexible month-to-month access · Cancel anytime in Google Play',
    btnSubscribeAnnual: 'Subscribe Annual Pass · $7.99/yr',
    btnSubscribeMonthly: 'Subscribe Monthly · $5.00/mo',
    btnRestorePurchase: 'Restore Purchase',
    licenseCodePlaceholder: 'Beta / Founder License Key (e.g. JACK-PRO-MASTER)',
    btnActivateCode: 'Activate Key',
    previewBannerText: 'Preview Mode (Read-Only) · Unlock your 4-day free trial to move and apply adjustments',
    previewBannerBtn: 'Unlock 4-Day Trial',
    previewLockedToast: 'Read-Only Preview Mode · Tap "Unlock 4-Day Trial" or the top PRO button to adjust controls',
    trialStartedToast: '4-Day (96-hour) Master PRO Trial unlocked! All controls are now interactive.',
    proActivatedToast: 'Master PRO Pass activated! Thank you for supporting Jack Friedrich.',
    invalidCodeToast: 'Invalid license key',
    billingLegalFooter:
      'Mandatory Billing Disclosure: The 4-day (96h) trial begins upon manual activation and never auto-charges when finished. Store subscriptions ($7.99 USD/yr or $5.00 USD/mo) automatically renew unless canceled at least 24 hours before the end of the billing cycle in Google Play → Subscriptions.',
    closeLabel: 'Close',
    langMenuTitle: 'Certified Native Language',
  },

  zh: {
    betaTag: 'BETA 测试版 · MASTER PRO 专业母带版',
    devCreditTitle: '由 Jack Friedrich 独立研发 (Developed by Jack Friedrich)',
    devCreditSub: 'IEEE 64位浮点声学架构 · C++ DVC 直通音量与全局系统音频引擎',
    engineBadge: 'JACK FRIEDRICH 声学实验室 · STORE 0% 无损零压缩封装',
    welcomeModalTitle: '法律声明、听力安全警示与隐私保护协议',
    hearingTitle: '1. 听力保护与声学安全警示（符合欧盟 EN 50332 / 世卫组织 ITU-T H.870 标准）',
    hearingBody:
      '本软件具备高精度前级增益放大、超低频谐波合成及直接音量控制（DVC）功能。长时间在高于 85 dB(A) 的声压级下聆听可能导致永久性噪声性听力损伤（NIHL）、耳鸣，或造成耳机/入耳式监听（IEM）及扬声器振膜物理损坏。请务必从低音量开始调节，并保持 True-Peak 砖墙限幅器开启。',
    privacyTitle: '2. 零云端本地隐私保护声明（符合中国《个人信息保护法》PIPL / GDPR 标准）',
    privacyBody:
      '100% 设备本地离线运算：Estudio Master Hi-Res 绝不收集、存储、出售或向任何外部服务器上传您的个人信息、本地音乐库、音频流、麦克风数据或广告标识符。系统音频与媒体读取权限仅在手机本地内存中用于无损播放与全局 DSP 音效挂载。',
    eulaTitle: '3. 最终用户许可协议（EULA）与免责声明',
    eulaBody:
      '本测试版（Beta）软件由 Jack Friedrich 开发，按“原样（AS-IS）”提供。在适用法律允许的最大范围内，开发者不对因用户自行设置过高增益而导致的听力受损或音响硬件损坏承担赔偿责任。严禁对本软件进行逆向工程或未经授权的商业分发。',
    androidBillingTitle: '4. 4天免费试用与 Master Pro 计费透明披露',
    androidBillingBody:
      '本地音乐库可直接使用，未解锁前所有专业页面均支持只读预览。Master Pro 4 天（精确 96 小时）免费试用仅在您主动点击“解锁 4 天免费试用”时开始计时，到期绝无自动暗扣。商店订阅（年度 $7.99 USD / 月度 $5.00 USD）均通过官方结算系统处理，可随时取消。',
    chkAcknowledge: '我已阅读并同意《本地隐私保护声明》、《听力安全警示》及《用户许可协议（EULA）》。',
    btnAcceptEnter: '同意并进入母带工作室',
    btnViewLegal: '法律声明与开发者信息',
    scrollDownLegalHint: '向下滑动 · 阅读法律声明并继续',

    proBtnFree: 'PRO·4天',
    proBtnTrial: (h) => `PRO·${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · 4天免费试用',
    proModalSubtitle: 'Jack Friedrich 倾力研发 · 发烧级全功能母带音频引擎',
    proStatusFree: '当前为只读预览模式 · 开启 4 天（96 小时）免费试用即可解锁并调节全部母带音效参数。',
    proStatusTrial: (d, h, m) => `Master PRO 免费试用已开启 · 剩余时间：${d}天 ${h}小时 ${m}分`,
    proStatusExpired: '您的 4 天免费试用已结束 · 选择年度通行证或月度订阅即可继续调节全部母带参数。',
    proStatusActivePlan: 'Master PRO 正式通行证已激活 · 全部 64 位母带模块与终极调音台已完全解锁。',
    proFeaturesTitle: 'Master PRO 完整解锁特权：',
    proFeatures: [
      '全面解锁所有专业模块推子与旋钮交互：终极调音台、30段均衡、16段清晰度、乐器精调、母带机架、共振与预设',
      '独立终极母带调音台（自由参数频率/Q值模式 + 6旋钮 LR4 动态压缩器 + DVC 直通动态余量）',
      '全套母带机架：3段多频段压缩、齿音消除器、4倍过采样电子管/磁带饱和、32位浮点 WAV 卷积混响',
      '3.5mm 耳机孔 / USB-C 解码耳放 1:1 源码直出 + 24-bit TPDF 抖动 + 超低音物理触觉共振',
      'Android 第三方外部应用全局音频实验性支持（当前处于 Beta 研发阶段）',
    ],
    freeAlwaysNote: '若关闭此窗口且暂不开启试用，您仍可浏览全部页面作为视觉预览，但所有调节推子与预设将保持锁定直至接受试用。',
    btnStart4DayTrial: '接受并开启 4 天 PRO 免费试用（今日 $0.00 · 无自动扣费）',
    btnPreviewOnlyDismiss: '暂不开启，仅以只读预览模式查看',
    trialUsedLabel: '此设备已使用过 4 天免费试用',
    planAnnualTitle: 'Master PRO 年度通行证（超值推荐）',
    planAnnualPrice: '$7.99 USD / 年',
    planAnnualSub: '折合仅约 $0.67 USD/月 · 相比按月订阅立省逾 85%',
    planMonthlyTitle: 'Master PRO 月度订阅',
    planMonthlyPrice: '$5.00 USD / 月',
    planMonthlySub: '按月灵活订阅 · 可随时在 Google Play 订阅管理中取消',
    btnSubscribeAnnual: '开通年度通行证 · $7.99/年',
    btnSubscribeMonthly: '开通月度订阅 · $5.00/月',
    btnRestorePurchase: '恢复已购项目',
    licenseCodePlaceholder: '输入 Beta 测试码 / 创始激活码 (例: JACK-PRO-MASTER)',
    btnActivateCode: '激活授权码',
    previewBannerText: '只读预览模式 · 开启 4 天免费试用即可滑动并应用所有音频参数',
    previewBannerBtn: '开启 4 天免费试用',
    previewLockedToast: '当前处于只读预览模式 · 请点击顶部 PRO 按钮接受 4 天免费试用后再调节参数',
    trialStartedToast: '已成功开启 4 天（96 小时）Master PRO 试用！所有推子与旋钮现已解锁。',
    proActivatedToast: 'Master PRO 通行证已激活！感谢支持开发者 Jack Friedrich。',
    invalidCodeToast: '激活码无效，请检查后重试',
    billingLegalFooter:
      '计费合规说明：4天（96小时）本地试用由用户手动开启，到期不会自动扣费。应用商店订阅（年度 $7.99 USD/年 或 月度 $5.00 USD/月）将按周期自动续费，您可在当前周期结束前至少 24 小时前往商店“付款和订阅”随时取消。',
    closeLabel: '关闭',
    langMenuTitle: '认证母语级界面语言',
  },

  ja: {
    betaTag: 'ベータ版 · MASTER PRO エディション',
    devCreditTitle: '開発者：Jack Friedrich (Developed by Jack Friedrich)',
    devCreditSub: 'IEEE 64-bit Float 音響アーキテクチャ · C++ DVC & システム全体DSPエンジン',
    engineBadge: 'JACK FRIEDRICH AUDIO LABS · STORE 0% 非圧縮オーディオ構造',
    welcomeModalTitle: '利用規約・聴覚安全警告およびプライバシーポリシー',
    hearingTitle: '1. 聴覚保護および音響安全に関する警告（EN 50332 / WHO ITU-T H.870 準拠）',
    hearingBody:
      '本ソフトウェアは高精度プリアンプ増幅、重低音倍音合成、およびダイレクトボリュームコントロール（DVC）を実行します。85 dB(A) を超える大音量での長時間聴取は、永続的な騒音性難聴や耳鳴り、イヤホン（IEM）・ヘッドホン・スピーカーの破損を招く恐れがあります。必ず小音量から開始し、True-Peak ブリックウォールリミッターを有効にしてご使用ください。',
    privacyTitle: '2. 完全ローカル処理プライバシーポリシー（日本国 個人情報保護法 APPI / GDPR 準拠）',
    privacyBody:
      '100% デバイス内オフライン処理：Estudio Master Hi-Res は、個人情報、音楽ライブラリ、再生履歴、マイク音声、広告識別子を外部サーバーへ収集・保存・送信することは一切ありません。要求されるシステム権限は、端末内の楽曲再生およびオーディオエフェクト処理のみに使用されます。',
    eulaTitle: '3. エンドユーザー使用許諾契約（EULA）および免責事項',
    eulaBody:
      '本ソフトウェアは Jack Friedrich により開発されたベータ版であり、「現状有姿（AS-IS）」で提供されます。適用法で認められる最大限の範囲において、ユーザーのゲイン設定に起因する聴覚障害やオーディオ機器の損傷について開発者は一切の責任を負いません。無断でのリバースエンジニアリングや再配布を禁じます。',
    androidBillingTitle: '4. 4日間無料トライアルおよび Master Pro 課金条件の明示',
    androidBillingBody:
      'ローカル楽曲再生はすぐにご利用いただけ、未解除の状態でも全タブをプレビュー閲覧できます。Master Pro 4日間（96時間）無料体験は「4日間無料体験を開始」を押した時点からのみ開始され、終了後に自動課金されることはありません。定期購入（年額 $7.99 / 月額 $5.00）はストア決済で管理され、いつでも解約可能です。',
    chkAcknowledge: '「プライバシーポリシー」「聴覚安全警告」および「利用規約（EULA）」を確認し、同意します。',
    btnAcceptEnter: '同意してスタジオを開始',
    btnViewLegal: '法的表示・クレジット',
    scrollDownLegalHint: '下へスクロール · 利用規約と開始',

    proBtnFree: 'PRO·4日',
    proBtnTrial: (h) => `PRO·${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · 4日間無料体験',
    proModalSubtitle: 'Developed by Jack Friedrich · オーディオファイル向け完全マスタリングスイート',
    proStatusFree: 'プレビュー閲覧モード · 4日間（96時間）の無料体験を開始すると、すべてのフェーダーとエフェクトを操作・適用できます。',
    proStatusTrial: (d, h, m) => `Master PRO 無料体験中 · 残り時間：${d}日 ${h}時間 ${m}分`,
    proStatusExpired: '4日間の無料体験期間が終了しました · 年間パスまたは月額プランを選択して全機能の操作を再開できます。',
    proStatusActivePlan: 'Master PRO パス有効 · すべての64-bitマスタリング＆最終コンソールが解放されています。',
    proFeaturesTitle: 'Master PRO で解放される全機能：',
    proFeatures: [
      '全セクションの完全操作：最終DVCコンソール、30バンドISO EQ、明瞭度16、楽器別EQ、エフェクト、振動、ジャンル＆プリセット',
      '独立ポストマスター最終コンソール（パラメトリック周波数/Qモード + 6ノブ LR4 コンプレッサー + DVC）',
      'フルスタジオラック：3バンドマルチコンプ、ディエッサー、4倍オーバーサンプリング真空管/テープ飽和、32-bit Float WAV リバーブ',
      '3.5mmジャック / USB-C DAC 1:1 ビットパーフェクト出力 + 24-bit TPDF ディザリング + 重低音ハプティクス振動',
      '他社アプリ向け Android システム全体オーディオ処理（現在ベータ開発中の実験機能）',
    ],
    freeAlwaysNote: '開始せずに閉じた場合、全セクションを「読み取り専用プレビュー」として閲覧できますが、無料体験に同意するまでパラメータ変更や適用はできません。',
    btnStart4DayTrial: '同意して 4日間 PRO 無料体験を開始（本日 $0.00・自動課金なし）',
    btnPreviewOnlyDismiss: '操作せずプレビュー表示のみ見る',
    trialUsedLabel: 'この端末での4日間無料体験は使用済みです',
    planAnnualTitle: 'Master PRO 年間パス（最もお得）',
    planAnnualPrice: '$7.99 USD / 年',
    planAnnualSub: '月額換算 約$0.67 USD · 月額プランより85%以上お得',
    planMonthlyTitle: 'Master PRO 月額プラン',
    planMonthlyPrice: '$5.00 USD / 月',
    planMonthlySub: '1ヶ月単位の柔軟なプラン · Google Play からいつでも解約可能',
    btnSubscribeAnnual: '年間パスを開始 · $7.99/年',
    btnSubscribeMonthly: '月額プランを開始 · $5.00/月',
    btnRestorePurchase: '購入を復元',
    licenseCodePlaceholder: 'ベータ / ファウンダー認証キー (例: JACK-PRO-MASTER)',
    btnActivateCode: 'キーを認証',
    previewBannerText: 'プレビュー専用モード（読み取り専用） · 4日間無料体験を開始すると全設定を動かせます',
    previewBannerBtn: '4日間無料体験を開始',
    previewLockedToast: 'プレビュー専用モードです · 上部の「PRO」ボタンから4日間無料体験を開始すると調整できます',
    trialStartedToast: '4日間（96時間）の Master PRO 無料体験が開始されました！すべての調整が可能です。',
    proActivatedToast: 'Master PRO パスが有効化されました！開発者 Jack Friedrich へのご支援ありがとうございます。',
    invalidCodeToast: '認証キーが正しくありません',
    billingLegalFooter:
      '特定商取引法・ストア規約に基づく表示：4日間（96時間）の無料体験は手動開始式であり、終了時に自動課金されることはありません。定期購入（年額 $7.99 USD / 月額 $5.00 USD）は期間終了の24時間前までに Google Play「お支払いと定期購入」で解約しない限り自動更新されます。',
    closeLabel: '閉じる',
    langMenuTitle: '公認ネイティブ言語設定',
  },

  de: {
    betaTag: 'BETA-VERSION · MASTER PRO EDITION',
    devCreditTitle: 'Entwickelt von Jack Friedrich',
    devCreditSub: 'IEEE 64-Bit-Float-Akustikarchitektur · C++ DVC & Systemweite DSP-Engine',
    engineBadge: 'JACK FRIEDRICH AUDIO LABS · STORE 0% UNKOMPRIMIERT',
    welcomeModalTitle: 'Rechtliche Hinweise, Gehörschutz & Datenschutzerklärung',
    hearingTitle: '1. Gehörschutz- & Akustiksicherheitswarnung (DIN EN 50332 / WHO ITU-T H.870)',
    hearingBody:
      'Diese Software ermöglicht hochpräzise Vorverstärkung, Subbass-Synthese, harmonische Sättigung und Direct Volume Control (DVC). Längeres Hören bei Schalldruckpegeln über 85 dB(A) kann zu dauerhaften Hörschäden, Tinnitus oder Sachschäden an Kopfhörern, IEMs und Lautsprechern führen. Beginnen Sie stets mit niedriger Lautstärke und lassen Sie den True-Peak-Brickwall-Limiter aktiviert.',
    privacyTitle: '2. Zero-Cloud-Datenschutzerklärung (DSGVO / GDPR / BDSG / PIPA / APPI)',
    privacyBody:
      '100 % lokale Verarbeitung auf Ihrem Gerät: Estudio Master Hi-Res erhebt, speichert, verkauft oder überträgt KEINE personenbezogenen Daten, Musikbibliotheken, Audiodateien, Mikrofondaten oder Werbe-IDs an externe Server. Systemberechtigungen werden ausschließlich lokal im Arbeitsspeicher für Audiowiedergabe und Hardware-DSP-Anbindung genutzt.',
    eulaTitle: '3. Endbenutzer-Lizenzvertrag (EULA) & Haftungsbeschränkung',
    eulaBody:
      'Beta-Software entwickelt von Jack Friedrich, bereitgestellt „WIE BESEHEN“ (AS-IS) ohne Gewährleistung für herstellerspezifische Audio-Treiber. Soweit gesetzlich zulässig, übernimmt der Nutzer die alleinige Verantwortung für überhöhte Pegel- und Bass-Einstellungen. Reverse Engineering ist untersagt.',
    androidBillingTitle: '4. Transparente Bedingungen für den 4-Tage-Gratis-Test & Master Pro',
    androidBillingBody:
      'Die Musikwiedergabe ist sofort nutzbar und alle Studio-Bereiche können im schreibgeschützten Vorschaumodus besichtigt werden. Ihre 4-tägige (96 Stunden) Master-Pro-Testphase startet erst, wenn Sie aktiv auf „4 Tage kostenlos testen“ tippen – ohne versteckte Abbuchung nach Ablauf. Abos ($7.99/Jahr oder $5.00/Monat) sind jederzeit über Google Play kündbar.',
    chkAcknowledge: 'Ich habe die Datenschutzerklärung (DSGVO), die Gehörschutzwarnung und den EULA-Vertrag gelesen und akzeptiere diese.',
    btnAcceptEnter: 'Akzeptieren & Studio öffnen',
    btnViewLegal: 'Rechtliches & Credits',
    scrollDownLegalHint: 'Nach unten wischen · Rechtliches & Weiter',

    proBtnFree: 'PRO·4T',
    proBtnTrial: (h) => `PRO·${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · 4 Tage Gratis testen',
    proModalSubtitle: 'Entwickelt von Jack Friedrich · Komplette Audiophile Mastering-Suite',
    proStatusFree: 'Vorschaumodus aktiv · Akzeptieren Sie Ihren kostenlosen 4-Tage-Test (96 Std.), um alle Regler und Klangmodule freizuschalten.',
    proStatusTrial: (d, h, m) => `Master PRO Testphase aktiv · Verbleibend: ${d}T ${h}Std ${m}Min`,
    proStatusExpired: 'Ihre 4-tägige Testphase ist abgelaufen · Wählen Sie den Jahrespass oder das Monatsabo, um alle Regler wieder zu bedienen.',
    proStatusActivePlan: 'Master PRO Pass aktiv · Alle 64-Bit-Mastering- & DVC-Konsolenmodule freigeschaltet.',
    proFeaturesTitle: 'Alle Vorteile von Master PRO:',
    proFeatures: [
      'Volle Bedienung aller Bereiche: DVC-Endkonsole, 30-Band-ISO-EQ, Klarheit 16, Instrumente, Effekte, Vibration, Genres & Presets',
      'Unabhängige Post-Master-Endstufenkonsole (Parametrischer Frequenz/Q-Modus + 6-Regler LR4-Kompressor + DVC)',
      'Komplettes Studio-Rack: 3-Band-Multiband-Kompressor, De-Esser, 4× Röhren-/Bandsättigung & 32-Bit-Float-WAV-Hall',
      'Bit-perfekte 1:1 Ausgabe für 3,5-mm-Klinke / USB-C-DAC + 24-Bit-TPDF-Dither + Subbass-Haptik',
      'Experimentelles systemweites Android-Audio für Drittanbieter-Apps (derzeit in Beta-Entwicklung)',
    ],
    freeAlwaysNote: 'Wenn Sie ohne Bestätigung schließen, können Sie alle Reiter als Vorschau ansehen, aber Regler und Presets lassen sich erst nach Freischaltung verändern.',
    btnStart4DayTrial: 'Akzeptieren & 4 Tage PRO kostenlos starten (Heute $0.00 · Kein Auto-Abo)',
    btnPreviewOnlyDismiss: 'Nur im schreibgeschützten Vorschaumodus ansehen',
    trialUsedLabel: '4-Tage-Test auf diesem Gerät bereits genutzt',
    planAnnualTitle: 'Master PRO Jahrespass (Bester Preis)',
    planAnnualPrice: '$7.99 USD / Jahr',
    planAnnualSub: 'Umgerechnet nur ~$0.67 USD/Monat · Über 85 % Ersparnis gegenüber Einzelmonaten',
    planMonthlyTitle: 'Master PRO Monatsabo',
    planMonthlyPrice: '$5.00 USD / Monat',
    planMonthlySub: 'Flexibel monatlich nutzbar · Jederzeit in Google Play kündbar',
    btnSubscribeAnnual: 'Jahrespass aktivieren · $7.99/J.',
    btnSubscribeMonthly: 'Monatsabo aktivieren · $5.00/M.',
    btnRestorePurchase: 'Kauf wiederherstellen',
    licenseCodePlaceholder: 'Beta- / Gründer-Lizenzschlüssel (z. B. JACK-PRO-MASTER)',
    btnActivateCode: 'Schlüssel aktivieren',
    previewBannerText: 'Vorschaumodus (Schreibgeschützt) · Starte deinen 4-Tage-Gratis-Test, um Einstellungen zu bewegen',
    previewBannerBtn: '4 Tage Gratis starten',
    previewLockedToast: 'Vorschaumodus (nur Ansicht) · Tippe oben auf PRO, um die 4 Gratis-Tage zu akzeptieren',
    trialStartedToast: '4 Tage (96 Stunden) Master PRO freigeschaltet! Alle Regler sind jetzt aktiv.',
    proActivatedToast: 'Master PRO Pass aktiviert! Danke für Ihre Unterstützung von Jack Friedrich.',
    invalidCodeToast: 'Ungültiger Lizenzschlüssel',
    billingLegalFooter:
      'Pflichtangabe zur Abrechnung: Der lokale 4-Tage-Test (96 Std.) endet automatisch ohne Kosten. Store-Abos ($7.99 USD/Jahr oder $5.00 USD/Monat) verlängern sich automatisch, sofern sie nicht mindestens 24 Stunden vor Ablauf unter Google Play → Zahlungen & Abos gekündigt werden.',
    closeLabel: 'Schließen',
    langMenuTitle: 'Zertifizierte Systemsprache',
  },

  ko: {
    betaTag: '베타 버전 · MASTER PRO 에디션',
    devCreditTitle: '개발자: Jack Friedrich (Developed by Jack Friedrich)',
    devCreditSub: 'IEEE 64-bit Float 음향 아키텍처 · C++ DVC 및 안드로이드 전역 시스템 DSP 엔진',
    engineBadge: 'JACK FRIEDRICH AUDIO LABS · STORE 0% 무압축 오디오 엔진',
    welcomeModalTitle: '법적 고지, 청력 보호 안전 경고 및 개인정보 처리방침',
    hearingTitle: '1. 청력 보호 및 음향 안전 경고 (유럽 EN 50332 / WHO ITU-T H.870 기준 준수)',
    hearingBody:
      '본 소프트웨어는 고정밀 프리앰프 증폭, 초저역 배음 합성 및 다이렉트 볼륨 컨트롤(DVC)을 수행합니다. 85 dB(A) 이상의 높은 음압에서 장시간 청취할 경우 영구적인 소음성 난청, 이명(Tinnitus)이 발생할 수 있으며 이어폰(IEM), 헤드폰 및 스피커 유닛이 손상될 수 있습니다. 항상 낮은 볼륨에서 시작하고 True-Peak 브릭월 리미터를 활성화해 주십시오.',
    privacyTitle: '2. 제로 클라우드 로컬 개인정보 처리방침 (대한민국 개인정보 보호법 PIPA / GDPR 준수)',
    privacyBody:
      '100% 기기 내 오프라인 처리: Estudio Master Hi-Res는 사용자의 개인정보, 음악 라이브러리, 오디오 스트림, 마이크 입력 또는 광고 식별자를 외부 서버로 수집·저장·판매·전송하지 않습니다. 요청되는 오디오 및 포그라운드 권한은 오직 기기 내부의 무손실 재생과 시스템 DSP 효과 연결에만 사용됩니다.',
    eulaTitle: '3. 최종 사용자 라이선스 계약(EULA) 및 책임의 제한',
    eulaBody:
      '본 베타 소프트웨어는 Jack Friedrich가 개발하였으며 "있는 그대로(AS-IS)" 제공됩니다. 관련 법령이 허용하는 최대 범위 내에서, 사용자가 설정한 과도한 게인 및 저역 부스트로 인해 발생한 청력 손상이나 음향 기기 파손에 대해 개발자는 책임을 지지 않습니다. 무단 역설계(리버스 엔지니어링) 및 재배포를 금지합니다.',
    androidBillingTitle: '4. 4일 무료 체험 및 Master Pro 결제 투명성 고지',
    androidBillingBody:
      '음악 재생은 즉시 가능하며 체험을 시작하기 전에도 모든 스튜디오 탭을 읽기 전용 미리보기로 둘러볼 수 있습니다. Master Pro 4일(96시간) 무료 체험은 직접 「4일 무료 체험 잠금 해제」를 누른 시점부터 시작되며 종료 후 자동 결제되지 않습니다. 정기 결제(연간 $7.99 / 월간 $5.00)는 스토어를 통해 안전하게 처리되며 언제든 해지 가능합니다.',
    chkAcknowledge: '로컬 개인정보 처리방침(PIPA), 청력 안전 경고 및 최종 사용자 라이선스 계약(EULA)을 읽었으며 이에 동의합니다.',
    btnAcceptEnter: '동의 후 마스터 스튜디오 입장',
    btnViewLegal: '법적 고지 및 개발자 정보',
    scrollDownLegalHint: '아래로 스크롤 · 법적 고지 확인 및 시작',

    proBtnFree: 'PRO·4일',
    proBtnTrial: (h) => `PRO·${h}h`,
    proBtnActive: 'PRO ★',
    proBtnExpired: 'PRO',
    proModalTitle: 'Master Hi-Res PRO · 4일 무료 체험',
    proModalSubtitle: 'Developed by Jack Friedrich · 오디오파일 풀 마스터링 스위트',
    proStatusFree: '미리보기 전용 모드 · 4일(96시간) 무료 체험을 수락하면 모든 스튜디오 페이더와 노브를 직접 움직이고 적용할 수 있습니다.',
    proStatusTrial: (d, h, m) => `Master PRO 무료 체험 진행 중 · 남은 시간: ${d}일 ${h}시간 ${m}분`,
    proStatusExpired: '4일 무료 체험이 종료되었습니다 · 연간 패스 또는 월간 구독을 선택하여 사운드 조절을 계속 이용하세요.',
    proStatusActivePlan: 'Master PRO 패스 활성화됨 · 모든 64-bit 마스터링 및 DVC 콘솔이 잠금 해제되었습니다.',
    proFeaturesTitle: 'Master PRO 전체 잠금 해제 기능:',
    proFeatures: [
      '모든 탭 완벽 조작 가능: 최종 DVC 콘솔, 30밴드 ISO EQ, 클리어 16, 악기별 EQ, 이펙트, 진동, 장르 및 프리셋',
      '독립형 최종 마스터 콘솔 (파라메트릭 주파수/Q 모드 + 6노브 LR4 컴프레서 + DVC 다이렉트 볼륨)',
      '풀 스튜디오 랙: 3밴드 멀티밴드 컴프레서, 디에서, 4× 진공관/테이프 새추레이션 및 32-bit Float WAV 컨볼루션 리버브',
      '3.5mm 단자 / USB-C DAC 1:1 비트퍼펙트 직결 출력 + 24-bit TPDF 디더링 + 초저역 햅틱 진동',
      '외부 앱을 위한 Android 시스템 전역 오디오 실험 기능 (현재 베타 개발 중)',
    ],
    freeAlwaysNote: '수락하지 않고 닫더라도 모든 탭을 미리보기 화면으로 구경할 수 있으나, 무료 체험을 수락하기 전에는 슬라이더 이동이나 설정 적용이 잠깁니다.',
    btnStart4DayTrial: '동의 및 4일 무료 PRO 체험 시작 (오늘 $0.00 · 자동 결제 없음)',
    btnPreviewOnlyDismiss: '조작 없이 미리보기 화면만 둘러보기',
    trialUsedLabel: '이 기기에서 이미 4일 무료 체험을 사용하셨습니다',
    planAnnualTitle: 'Master PRO 연간 패스 (최고 가성비)',
    planAnnualPrice: '$7.99 USD / 년',
    planAnnualSub: '월 약 $0.67 USD 수준 · 월간 구독 대비 85% 이상 절약',
    planMonthlyTitle: 'Master PRO 월간 구독',
    planMonthlyPrice: '$5.00 USD / 월',
    planMonthlySub: '부담 없는 월 단위 이용 · Google Play에서 언제든지 해지 가능',
    btnSubscribeAnnual: '연간 패스 구독 · $7.99/년',
    btnSubscribeMonthly: '월간 구독 시작 · $5.00/월',
    btnRestorePurchase: '구매 내역 복원',
    licenseCodePlaceholder: '베타 / 파운더 라이선스 키 입력 (예: JACK-PRO-MASTER)',
    btnActivateCode: '키 활성화',
    previewBannerText: '미리보기 전용 모드 (읽기 전용) · 4일 무료 체험을 시작하면 모든 조절기를 움직일 수 있습니다',
    previewBannerBtn: '4일 무료 체험 시작',
    previewLockedToast: '미리보기 전용 상태입니다 · 상단 PRO 버튼을 눌러 4일 무료 체험을 수락해 주세요',
    trialStartedToast: '4일(96시간) 동안 Master PRO 모든 컨트롤이 잠금 해제되었습니다!',
    proActivatedToast: 'Master PRO 패스가 활성화되었습니다! Jack Friedrich를 응원해 주셔서 감사합니다.',
    invalidCodeToast: '유효하지 않은 라이선스 키입니다',
    billingLegalFooter:
      '결제 필수 고지: 4일(96시간) 무료 체험은 직접 시작 시점부터 적용되며 만료 시 자동 청구되지 않습니다. 스토어 정기 결제(연간 $7.99 USD / 월간 $5.00 USD)는 결제 주기 종료 최소 24시간 전에 Google Play → 결제 및 정기 결제에서 해지하지 않으면 자동 갱신됩니다.',
    closeLabel: '닫기',
    langMenuTitle: '공식 인증 네이티브 언어',
  },
};

/* ---------- Diccionario Técnico UI Nativo y Certificado (ES -> EN / ZH / JA / DE / KO) ----------
   Traduce con terminología exacta de ingeniería de sonido (DAW / Mastering / Poweramp / Audio Pro)
   todos los controles, pestañas, bandas, efectos, géneros y mensajes de la aplicación. */
type DictRow = [en: string, zh: string, ja: string, de: string, ko: string];

const EXACT_UI_DICT: Record<string, DictRow> = {
  // Cabecera y pestañas principales
  'Guardar': ['Save', '保存', '保存', 'Speichern', '저장'],
  'Cero': ['Zero', '归零', 'ゼロ', 'Null', '초기화'],
  '¿Seguro?': ['Sure?', '确定归零？', 'リセット？', 'Sicher?', '초기화할까요?'],
  'Sin pista': ['No Track Loaded', '未加载曲目', 'トラック未選択', 'Kein Titel geladen', '트랙 없음'],
  'Motor C++ 64-bit · Reloj 1:1 Bit-Perfect': [
    '64-bit C++ Engine · 1:1 Bit-Perfect Clock',
    '64位 C++ 引擎 · 1:1 源码级时钟同步',
    '64-bit C++ エンジン · 1:1 Bit-Perfect クロック',
    '64-Bit C++-Engine · 1:1 Bit-Perfect-Takt',
    '64-bit C++ 엔진 · 1:1 비트퍼펙트 클럭',
  ],
  'Música': ['Music', '音乐库', 'ミュージック', 'Musik', '뮤직'],
  'Consola': ['Console', '终极调音台', 'コンソール', 'Konsole', '콘솔'],
  'EQ 30': ['EQ 30', '30段均衡', 'EQ 30', 'EQ 30', 'EQ 30'],
  'Claridad 16': ['Clarity 16', '16段清晰度', '明瞭度 16', 'Klarheit 16', '클리어 16'],
  'Instrumentos': ['Instruments', '乐器精调', '楽器別EQ', 'Instrumente', '악기 EQ'],
  'Efectos': ['Effects', '母带效果器', 'エフェクト', 'Effekte', '이펙트'],
  'Vibración': ['Vibration', '超低音共振', 'バイブレーション', 'Vibration', '서브 진동'],
  'Interruptor General de Consola': [
    'Console Master Power Switch',
    '终极调音台总电源开关',
    'コンソール総合電源スイッチ',
    'Hauptschalter der Konsole',
    '콘솔 마스터 전원 스위치',
  ],
  'CONSOLA ENCENDIDA': ['CONSOLE ON', '调音台已开启', 'コンソール ON', 'KONSOLE EIN', '콘솔 켜짐'],
  'CONSOLA APAGADA': ['CONSOLE OFF', '调音台已关闭', 'コンソール OFF', 'KONSOLE AUS', '콘솔 꺼짐'],
  'Prender Consola': ['Turn Console ON', '开启调音台', 'コンソールをON', 'Konsole einschalten', '콘솔 켜기'],
  'Apagar Todo Consola': ['Turn All Console OFF', '关闭整个调音台', 'コンソール全OFF', 'Gesamte Konsole aus', '콘솔 전체 끄기'],
  'Mezcla en Tiempo Real: Estudio + Consola': [
    'Real-Time Mix: Studio + Console',
    '实时混合链路：母带工作室 + 调音台',
    'リアルタイム統合：スタジオ＋コンソール',
    'Echtzeit-Mix: Studio + Konsole',
    '실시간 믹스: 스튜디오 + 콘솔',
  ],
  'Géneros': ['Genres', '曲风母带', 'ジャンル', 'Genres', '장르'],
  'Presets': ['Presets', '预设管理', 'プリセット', 'Presets', '프리셋'],

  // Pestaña Música y Reproductor
  'Tu música': ['Your Music Library', '本地高解析音乐库', 'マイミュージック', 'Deine Musikmediathek', '내 음악 라이브러리'],
  'Añadir música': ['Add Audio Files', '导入本地音频', '音楽を追加', 'Musik hinzufügen', '음악 파일 추가'],
  'Permitir acceso a tu música': ['Grant Music Library Access', '授权访问本地音乐库', '音楽ファイルへのアクセスを許可', 'Musikzugriff erlauben', '음악 라이브러리 접근 허용'],
  '2° plano sin límite': ['Unrestricted Background', '后台无限制运行', 'バックグラウンド制限解除', 'Hintergrund ohne Limit', '백그라운드 무제한 실행'],
  'Aleatorio': ['Shuffle', '随机播放', 'シャッフル', 'Zufall', '셔플'],
  'Repetir: no': ['Repeat: Off', '循环：关闭', 'リピート：オフ', 'Wiederholen: Aus', '반복: 끔'],
  'Repetir: todo': ['Repeat: All', '循环：全部', 'リピート：全曲', 'Wiederholen: Alle', '반복: 전체'],
  'Repetir: una': ['Repeat: One', '循环：单曲', 'リピート：1曲', 'Wiederholen: Titel', '반복: 한 곡'],
  'Orden: Recientes': ['Sort: Recent', '排序：最近添加', '並び順：追加日', 'Sortierung: Neueste', '정렬: 최신순'],
  'Orden: A–Z': ['Sort: A–Z', '排序：A–Z', '並び順：A–Z', 'Sortierung: A–Z', '정렬: 가나다/A–Z'],
  'Buscar canción o artista...': ['Search track or artist...', '搜索歌曲或艺术家...', '曲名・アーティストを検索...', 'Titel oder Künstler suchen...', '곡명 또는 아티스트 검색...'],
  'Volumen (32-bit sin pérdida)': ['Monitor Volume (Lossless 32-bit Float)', '监听音量（32位浮点无损）', 'モニター音量（32-bit 無劣化）', 'Monitor-Lautstärke (32-Bit verlustfrei)', '모니터 볼륨 (32-bit 무손실)'],
  'App Independiente Android (.apk)': ['Standalone Android App (.apk)', 'Android 独立原生安装包 (.apk)', 'Android スタンドアロンアプリ (.apk)', 'Eigenständige Android-App (.apk)', '안드로이드 독립 실행형 앱 (.apk)'],
  'STORE 0% · Sin Comprimir': ['STORE 0% · Uncompressed', 'STORE 0% · 零压缩封装', 'STORE 0% · 完全非圧縮', 'STORE 0% · Unkomprimiert', 'STORE 0% · 무압축 패키지'],
  'Descargar proyecto Android (.zip)': ['Download Android Project (.zip)', '下载 Android 原生工程 (.zip)', 'Android プロジェクトを入手 (.zip)', 'Android-Projekt herunterladen (.zip)', '안드로이드 프로젝트 다운로드 (.zip)'],

  // Jack 3.5 mm / Gapless / Mastering IO
  'Puerto Jack 3.5 mm · Salida Directa 1:1': ['3.5mm Audio Jack · 1:1 Direct Output', '3.5mm 耳机孔 / DAC · 1:1 源码直出', '3.5mm ジャック · 1:1 ダイレクト出力', '3,5-mm-Klinke · 1:1 Direktausgang', '3.5mm 오디오 단자 · 1:1 다이렉트 출력'],
  'Reloj 1:1 Nativo DAC (0% remuestreo)': ['1:1 Native DAC Clock (0% Resampling)', '1:1 原生 DAC 时钟（0% 重采样）', '1:1 ネイティブDACクロック（リサンプリング0%）', '1:1 Nativer DAC-Takt (0 % Resampling)', '1:1 네이티브 DAC 클럭 (리샘플링 0%)'],
  'Dithering Analógico 24-bit TPDF': ['24-bit TPDF Analog Dither', '24-bit TPDF 模拟三角抖动', '24-bit TPDF アナログディザリング', 'Analoger 24-Bit-TPDF-Dither', '24-bit TPDF 아날로그 디더링'],
  'Transición Gapless y Reproducción': ['Gapless Transition & Playback Engine', '无缝衔接（Gapless）与播放引擎', 'ギャップレス再生＆トランスポート', 'Gapless-Übergang & Wiedergabe', '갭리스 전환 및 재생 엔진'],
  'Gapless (0 ms)': ['Gapless (0 ms)', '无缝播放 (0 ms)', 'ギャップレス (0 ms)', 'Gapless (0 ms)', '갭리스 (0 ms)'],
  'Fundido cruzado (Crossfade)': ['Equal-Power Crossfade', '等功率交叉淡入淡出 (Crossfade)', 'クロスフェード', 'Crossfade (Überblendung)', '이퀄 파워 크로스페이드'],
  'Conservar tono': ['Preserve Pitch', '保持原调 (Pitch Lock)', 'ピッチを維持', 'Tonhöhe halten', '원음 피치 유지'],
  'Afinación 432 Hz': ['432 Hz Natural Tuning', '432 Hz 自然律调音', '432 Hz チューニング', '432-Hz-Stimmung', '432 Hz 자연 튜닝'],
  'Velocidad de reproducción': ['Playback Speed', '播放速度', '再生速度', 'Wiedergabetempo', '재생 속도'],
  'Mastering · Entrada y salida': ['Mastering · Input & Output Stage', '母带总控 · 输入与砖墙输出', 'マスタリング · 入出力ステージ', 'Mastering · Ein- & Ausgangsstufe', '마스터링 · 입출력 스테이지'],
  'Auto-Headroom inteligente': ['Smart Auto-Headroom', '智能动态余量保护 (Auto-Headroom)', 'スマート Auto-Headroom', 'Intelligenter Auto-Headroom', '스마트 오토 헤드룸'],
  'Preamplificador': ['Input Preamp', '前级放大 (Preamp)', 'プリアンプ', 'Vorverstärker (Preamp)', '입력 프리앰프'],
  'Salida maestra': ['Master Output Gain', '主输出增益', 'マスター出力ゲイン', 'Master-Ausgangspegel', '마스터 출력 게인'],
  'Techo Brickwall True-Peak': ['True-Peak Brickwall Ceiling', 'True-Peak 砖墙限幅上限', 'True-Peak ブリックウォール上限', 'True-Peak-Brickwall-Decke', '트루피크 브릭월 실링'],

  // Consola Master Independiente (Estilo Poweramp)
  'Consola Master · Etapa Final Independiente': [
    'Master Console · Independent Final Stage',
    '母带终极调音台 · 独立后级输出模块',
    'マスターコンソール · 独立最終ステージ',
    'Master-Konsole · Unabhängige Endstufe',
    '마스터 콘솔 · 독립형 최종 출력 스테이지',
  ],
  'Ecualizador': ['Equalizer', '均衡器', 'イコライザー', 'Equalizer', '이퀄라이저'],
  'Compresor': ['Compressor', '动态压缩器', 'コンプレッサー', 'Kompressor', '컴프레서'],
  'Sistema / DVC': ['System / DVC', '全局系统 / DVC', 'システム / DVC', 'System / DVC', '시스템 / DVC'],
  'Gráfico 10B': ['Graphic 10B', '10段图示模式', 'グラフィック 10B', 'Grafisch 10B', '그래픽 10B'],
  'Paramétrico (Frec + Q)': ['Parametric (Freq + Q)', '自由参数模式 (频率+Q)', 'パラメトリック (周波数+Q)', 'Parametrisch (Freq + Q)', '파라메트릭 (주파수+Q)'],
  'Suavizar': ['Smooth', '平滑曲线', 'スムーズ', 'Glätten', '곡선 스무딩'],
  'Cero EQ': ['Flat EQ', '均衡归零', 'フラット', 'EQ Null', 'EQ 초기화'],
  'Ecu': ['EQ', '均衡', 'EQ', 'EQ', 'EQ'],
  'Tono': ['Tone', '音调', 'トーン', 'Klang', '톤'],
  'Límit': ['Limit', '限幅', 'リミット', 'Limit', '리미터'],
  'Graves': ['Bass', '低音增强', '低音 (Bass)', 'Bässe', '베이스'],
  'Agudos': ['Treble', '高音增强', '高音 (Treble)', 'Höhen', '트레블'],
  'Frecuencia y Q de Graves / Agudos (Poweramp Tone)': [
    'Bass & Treble Frequency / Q (Poweramp Tone)',
    '高低音中心频率与 Q 值精调 (Poweramp Tone)',
    '低音・高音の中心周波数＆Q値 (Poweramp Tone)',
    'Bass- & Höhen-Frequenz / Q (Poweramp Tone)',
    '베이스 & 트레블 중심 주파수 / Q 설정 (Poweramp Tone)',
  ],
  'Ataque': ['Attack', '启动时间', 'アタック', 'Attack', '어택'],
  'Lanzamiento': ['Release', '释放时间', 'リリース', 'Release', '릴리즈'],
  'Proporción': ['Ratio', '压缩比', 'レシオ', 'Ratio', '레이시오'],
  'Frecuencia': ['Frequency', '分频点', '周波数', 'Frequenz', '주파수'],
  'Límite': ['Threshold', '阈值', 'スレッショルド', 'Schwellenwert', '스레숄드'],
  'Ganancia': ['Makeup Gain', '补偿增益', 'メイクアップゲイン', 'Aufholverstärkung', '메이크업 게인'],
  'Balance': ['Stereo Balance', '左右声道平衡', 'ステレオバランス', 'Stereo-Balance', '스테레오 밸런스'],
  'Expansión X': ['Stereo Expand', '立体声扩展', 'ステレオ拡張', 'Stereo-Basis', '스테레오 확장'],
  'Volumen Consola': ['Console Volume', '调音台主音量', 'コンソール音量', 'Konsolen-Lautstärke', '콘솔 마스터 볼륨'],
  'Restablecer': ['Reset', '重置参数', 'リセット', 'Zurücksetzen', '초기화'],
  'Compresor Dinámico LR4 · Balance y Salida Final': [
    'LR4 Dynamic Compressor · Balance & Final Output',
    'LR4 相位一致动态压缩器 · 声道平衡与终极输出',
    'LR4 ダイナミックコンプレッサー · バランス＆最終出力',
    'LR4-Dynamikkompressor · Balance & Endausgang',
    'LR4 다이내믹 컴프레서 · 밸런스 및 최종 출력',
  ],
  'Audio Nativo de Todo el Sistema Android': [
    'Native Android System-Wide Audio Engine',
    'Android 全局系统原生音频引擎',
    'Android システム全体ネイティブ音響エンジン',
    'Natives systemweites Android-Audio-Processing',
    '안드로이드 시스템 전체 네이티브 오디오 엔진',
  ],
  'Re-enlazar Audio del Sistema Ahora': [
    'Rebind System Audio Sessions Now',
    '立即重新挂载系统全局音频',
    'システム音声セッションを今すぐ再接続',
    'System-Audio jetzt neu verbinden',
    '시스템 오디오 세션 즉시 재연결',
  ],
  '2° plano sin restricción de batería': [
    'Unrestricted Battery Background Mode',
    '开启后台无限制电池保护',
    'バッテリー最適化を解除（常駐保護）',
    'Uneingeschränkter Akku-Hintergrundmodus',
    '배터리 최적화 제외 (백그라운드 유지)',
  ],
  'Ajustes de sonido de Android': [
    'Android Sound Settings',
    'Android 系统声音设置',
    'Android サウンド設定',
    'Android-Toneinstellungen',
    '안드로이드 시스템 사운드 설정',
  ],
  'Procesar Todo el Audio del Sistema (Global)': [
    'Process All System Audio (Global Mode)',
    '接管并处理全系统所有音频（全局模式）',
    'システム全体の音声を処理（グローバルモード）',
    'Gesamtes System-Audio verarbeiten (Global)',
    '시스템의 모든 오디오 처리 (전역 모드)',
  ],
  'Control de Volumen Directo (DVC)': [
    'Direct Volume Control (DVC)',
    '直接音量控制 (DVC 高动态余量)',
    'ダイレクトボリュームコントロール (DVC)',
    'Direct Volume Control (DVC)',
    '다이렉트 볼륨 컨트롤 (DVC)',
  ],
  'Control de Volumen Directo (DVC) y Precisión': [
    'Direct Volume Control (DVC) & Filter Precision',
    '直接音量控制 (DVC) 与滤波器精度',
    'ダイレクトボリュームコントロール (DVC) ＆精度設定',
    'Direct Volume Control (DVC) & Filterpräzision',
    '다이렉트 볼륨 컨트롤 (DVC) 및 필터 정밀도',
  ],
  'AUDIO SISTEMA GLOBAL · ACTIVO': [
    'GLOBAL SYSTEM AUDIO · ACTIVE',
    '全局系统音频处理 · 已激活',
    'システム全体オーディオ · 稼働中',
    'GLOBALES SYSTEM-AUDIO · AKTIV',
    '시스템 전역 오디오 · 활성화됨',
  ],
  'ACTIVAR AUDIO DE TODO EL SISTEMA': [
    'ENABLE SYSTEM-WIDE AUDIO',
    '开启全系统全局音频处理',
    'システム全体オーディオを有効化',
    'SYSTEMWEITES AUDIO AKTIVIEREN',
    '시스템 전역 오디오 활성화',
  ],

  // EQ 30 & Claridad 16
  'EQ de 30 bandas': ['30-Band ISO Mastering EQ', '30段 ISO 母带图示均衡器', '30バンド ISO マスタリングEQ', '30-Band ISO Mastering-EQ', '30밴드 ISO 마스터링 EQ'],
  '16 bandas de claridad': ['16-Band Musical Clarity EQ', '16段音乐清晰度均衡器', '16バンド ミュージカル明瞭度EQ', '16-Band Musikalische Klarheit', '16밴드 뮤지컬 클리어리티 EQ'],
  'Precisión ×5': ['Fine ×5', '5倍微调', '微調整 ×5', 'Fein ×5', '정밀 ×5'],
  'Q Proporcional': ['Proportional Q', '比例 Q 值', '比例 Q', 'Proportional-Q', '비례 Q'],
  'Bloqueado': ['Locked', '已锁定', 'ロック中', 'Gesperrt', '잠김'],
  'Libre': ['Unlocked', '未锁定', '解除中', 'Frei', '해제됨'],

  // 16 Bandas Nombres
  'Sub': ['Sub', '极低频', 'サブ低域', 'Subbass', '서브'],
  'Bajos': ['Low', '低频', 'ロー', 'Tiefton', '로우'],
  'Cuerpo': ['Body', '饱满度', 'ボディ', 'Körper', '바디'],
  'Calidez': ['Warmth', '温暖度', 'ウォーム', 'Wärme', '따뜻함'],
  'Barro': ['Mud', '浑浊区', 'マッド', 'Mulm', '머드'],
  'Medios': ['Mids', '中频', 'ミッド', 'Mitten', '미드'],
  'Voz': ['Vocal', '人声基频', 'ボーカル', 'Stimme', '보컬'],
  'Claridad': ['Clarity', '清晰度', '明瞭度', 'Klarheit', '명료도'],
  'Nitidez': ['Definition', '解析力', '輪郭', 'Definition', '선명도'],
  'Dicción': ['Articulation', '咬字齿音', 'アタック感', 'Präsenz', '딕션'],
  'Brillo': ['Brilliance', '明亮度', 'ブリリアンス', 'Brillanz', '브릴리언스'],
  'Aire': ['Air', '空气感', 'エアー', 'Luft', '에어'],
  'Aire +': ['High Air', '超高频空气', 'ハイエアー', 'Oberluft', '하이 에어'],
  'Ultra': ['Ultra HF', '极高频延伸', 'ウルトラ高域', 'Ultra-HF', '울트라 고역'],

  // Instrumentos
  'Batería': ['Drums & Percussion', '鼓组与打击乐', 'ドラム＆パーカッション', 'Schlagzeug & Perkussion', '드럼 & 퍼커션'],
  'Guitarras': ['Guitars', '吉他频段', 'ギター', 'Gitarren', '기타'],
  'Bajo': ['Bass Guitar & Synth Bass', '贝斯与合成低音', 'ベース', 'Bass', '베이스'],
  'Voces': ['Lead & Backing Vocals', '主唱与和声人声', 'ボーカル', 'Gesang & Sprache', '보컬'],
  'Teclas y piano': ['Keys & Grand Piano', '键盘与三角钢琴', 'ピアノ＆キーボード', 'Tasten & Flügel', '건반 & 피아노'],
  'Bombo': ['Kick Drum', '底鼓 (Kick)', 'キックドラム', 'Bassdrum (Kick)', '킥 드럼'],
  'Caja · cuerpo': ['Snare · Body', '军鼓 · 腔体饱满度', 'スネア · ボディ', 'Snare · Bauch', '스네어 · 바디'],
  'Caja · chasquido': ['Snare · Snap', '军鼓 · 瞬态脆度', 'スネア · スナップ', 'Snare · Attack', '스네어 · 스냅'],
  'Tom de piso': ['Floor Tom', '落地嗵鼓', 'フロアタム', 'Standtom', '플로어 탐'],
  'Tom medio': ['Mid Tom', '中音嗵鼓', 'ミッドタム', 'Mid-Tom', '미드 탐'],
  'Tom agudo': ['High Tom', '高音嗵鼓', 'ハイタム', 'High-Tom', '하이 탐'],
  'Hi-hat': ['Hi-Hat', '踩镲 (Hi-Hat)', 'ハイハット', 'Hi-Hat', '하이햇'],
  'Platillos': ['Cymbals & Overhead', '吊镲与空气残响', 'シンバル', 'Becken', '심벌즈'],
  'Guitarra · cuerpo': ['Guitar · Body', '吉他 · 共鸣厚度', 'ギター · ボディ', 'Gitarre · Körper', '기타 · 바디'],
  'Guitarra · presencia': ['Guitar · Presence', '吉他 · 临场穿透力', 'ギター · プレゼンス', 'Gitarre · Präsenz', '기타 · 프레즌스'],
  'Acústica · brillo': ['Acoustic · Sparkle', '木吉他 · 拨弦光泽', 'アコースティック · 煌めき', 'Akustik · Glanz', '어쿠스틱 · 브릴리언스'],
  'Bajo · cuerpo': ['Bass · Fundamental', '贝斯 · 低频下潜', 'ベース · ボディ', 'Bass · Fundament', '베이스 · 바디'],
  'Bajo · ataque': ['Bass · Pluck Attack', '贝斯 · 拨弦颗粒感', 'ベース · アタック', 'Bass · Anschlag', '베이스 · 어택'],
  'Voz · calidez': ['Vocal · Warmth', '人声 · 胸腔温暖感', 'ボーカル · ウォーム', 'Stimme · Wärme', '보컬 · 따뜻함'],
  'Voz · presencia': ['Vocal · Presence', '人声 · 贴耳临场感', 'ボーカル · プレゼンス', 'Stimme · Präsenz', '보컬 · 프레즌스'],
  'Voz · sibilancia': ['Vocal · Sibilance Control', '人声 · 齿音柔化区', 'ボーカル · 歯擦音帯域', 'Stimme · Zischlaute', '보컬 · 치찰음 대역'],
  'Voz · aire': ['Vocal · Breath & Air', '人声 · 呼吸空气感', 'ボーカル · エアー', 'Stimme · Luftigkeit', '보컬 · 에어'],
  'Piano · cuerpo': ['Piano · Resonance', '钢琴 · 音板共鸣', 'ピアノ · ボディ共鳴', 'Klavier · Resonanz', '피아노 · 바디 울림'],
  'Piano · brillo': ['Piano · Hammer Clarity', '钢琴 · 琴槌清脆度', 'ピアノ · ハンマー明瞭度', 'Klavier · Brillanz', '피아노 · 해머 선명도'],

  // Rack de Efectos
  'Tono y filtros': ['Tone & High/Low-Cut Filters', '音调搁架与高低切滤波器', 'トーン＆ハイ/ローカットフィルター', 'Klangregelung & Hoch-/Tiefpass', '톤 쉘프 및 하이/로우컷 필터'],
  'Compresor multibanda (3 bandas)': ['3-Band Multiband Compressor', '3段多频段动态压缩器', '3バンド・マルチバンドコンプレッサー', '3-Band-Multiband-Kompressor', '3밴드 멀티밴드 컴프레서'],
  'De-Esser vocal dinámico': ['Dynamic Vocal De-Esser', '人声动态齿音消除器 (De-Esser)', 'ダイナミック・ボーカルディエッサー', 'Dynamischer Vocal-De-Esser', '다이내믹 보컬 디에서 (De-Esser)'],
  'Compresor maestro': ['Master Bus Compressor', '母带总线压缩器', 'マスターバス・コンプレッサー', 'Master-Bus-Kompressor', '마스터 버스 컴프레서'],
  'Saturación analógica 4×': ['4× Oversampled Analog Saturation', '4倍过采样模拟磁带/电子管饱和', '4倍オーバーサンプリング・アナログサチュレーション', 'Analoge 4×-Oversampling-Sättigung', '4× 오버샘플링 아날로그 새추레이션'],
  'Cinta cálida': ['Warm Tape', '温暖开盘磁带', 'ウォームテープ', 'Warmes Tonband', '웜 테이프'],
  'Válvula Triodo': ['Triode Tube', '三极管电子管', '三極真空管 (Triode)', 'Trioden-Röhre', '트라이오드 진공관'],
  'Consola Punch': ['Console Punch', '模拟调音台冲击感', 'コンソールパンチ', 'Konsolen-Punch', '콘솔 펀치'],
  'Excitador de aire armónico 4×': ['4× Harmonic Air Exciter', '4倍过采样高频空气激励器', '4倍ハーモニック・エアーエキサイター', 'Harmonischer 4×-Air-Exciter', '4× 하모닉 에어 익사이터'],
  'Centrador de subgraves (Mono)': ['Elliptic Sub-Bass Mono Maker', '椭圆滤波器超低频单声道聚焦', 'サブベース・モノメーカー', 'Elliptischer Subbass-Mono-Maker', '서브베이스 모노 메이커'],
  'Crossfeed de audífonos': ['Binaural Headphone Crossfeed', '双耳立体声耳机自然声场交叉馈送', 'バイノーラル・ヘッドホンクロスフィード', 'Binaurales Kopfhörer-Crossfeed', '바이노럴 헤드폰 크로스피드'],
  'Ancho estéreo M/S': ['Mid/Side Stereo Width Matrix', 'Mid/Side 立体声声场宽度矩阵', 'Mid/Side ステレオワイド', 'Mid/Side-Stereobreite', 'Mid/Side 스테레오 이미지 확장'],
  'Reverberación HD': ['HD Convolution Reverb (32f WAV)', 'HD 真实空间卷积混响 (32位浮点 WAV)', 'HD コンボリューションリバーブ (32f WAV)', 'HD-Faltungshall (32-Bit-Float WAV)', 'HD 컨볼루션 리버브 (32f WAV)'],
  'Paramétrico 64-bit': ['64-bit Algorithmic', '64位算法合成空间', '64-bit アルゴリズム', '64-Bit-Algorithmisch', '64-bit 알고리즘 홀'],
  'Sala Mastering WAV 32f': ['Mastering Room 32f WAV', '母带监听室 32f WAV', 'マスタリングルーム 32f WAV', 'Mastering-Raum 32f WAV', '마스터링 룸 32f WAV'],
  'Placa EMT WAV 32f': ['Gold Plate 32f WAV', '经典金箔板式混响 32f WAV', 'ゴールドプレート 32f WAV', 'Gold-Plattenhall 32f WAV', '골드 플레이트 32f WAV'],
  'Cámara Madera WAV 32f': ['Wood Chamber 32f WAV', '原木声学混响室 32f WAV', 'ウッドチェンバー 32f WAV', 'Holzkammer 32f WAV', '우드 체임버 32f WAV'],
  'Auditorio HD WAV 32f': ['Symphony Hall 32f WAV', '交响音乐厅 32f WAV', 'シンフォニーホール 32f WAV', 'Konzertsaal 32f WAV', '심포니 콘서트홀 32f WAV'],
  'Eco / Delay': ['Stereo Feedback Delay', '立体声滤波反馈延迟 (Delay)', 'ステレオディレイ', 'Stereo-Echo / Delay', '스테레오 에코 / 딜레이'],
  'Sonido 3D Binaural': ['3D HRTF Binaural Spatializer (8D)', '3D HRTF 双耳空间环绕声 (8D旋转)', '3D HRTF バイノーラル立体音響 (8D)', '3D-HRTF-Binaural-Raumklang (8D)', '3D HRTF 바이노럴 공간음향 (8D)'],

  // Vibración
  'Temblor y vibración': ['Sub-Bass Tremor & Haptic Engine', '超低频物理震动与手机触觉反馈', '重低音トレモア＆ハプティクス振動', 'Subbass-Beben & Haptik-Engine', '초저역 진동 및 햅틱 피드백 엔진'],
  'Apagar todo': ['All Off', '全部关闭', 'すべてオフ', 'Alles aus', '모두 끄기'],
  'Vidrios suaves': ['Gentle Window Shake', '轻柔低频共振', 'ソフト共振', 'Sanftes Vibrieren', '부드러운 공명'],
  'Vidrios fuertes': ['Heavy Acoustic Resonance', '强烈声学低频共振', 'ヘビー共振', 'Starkes Vibrieren', '강력한 중저음 공명'],
  'Terremoto': ['Earthquake Sub-Drive', '地震级极限超低音冲击', 'アースクエイク最大振動', 'Erdbeben-Modus', '어스퀘이크 극한 서브'],
  'Subgraves potentes': ['Deep Sub-Bass Booster', '深潜超低频增强器', 'ディープ・サブベース', 'Tiefbass-Booster', '딥 서브베이스 부스터'],
  'Resonancia de vidrios': ['Room Acoustic Resonance Peak', '房间声学谐振峰值激励', 'ルームアコースティック共振', 'Raumresonanz-Fokus', '룸 어쿠스틱 공명 피크'],
  'Armónicos de graves 4×': ['4× Sub-Harmonic Synthesizer', '4倍过采样低频偶次谐波合成', '4倍サブハーモニック合成', '4×-Subharmonik-Synthesizer', '4× 서브 하모닉 신디사이저'],
  'Temblor (trémolo)': ['Amplitude Tremolo', '音量调制震音 (Tremolo)', 'トレモロ', 'Tremolo', '트레몰로'],
  'Vibrato': ['Pitch Vibrato', '音高微调制颤音 (Vibrato)', 'ビブラート', 'Vibrato', '비브라토'],
  'Vibración del teléfono': ['Real-Time Sub-Bass Phone Haptics', '随超低音节拍同步手机物理马达震动', '重低音連動スマホ物理バイブ', 'Echtzeit-Smartphone-Haptik', '초저역 연동 실시간 스마트폰 햅틱 진동'],

  // Géneros y Presets
  'Género musical': ['Musical Genre Mastering', '音乐流派母带目标曲线', '音楽ジャンル・マスタリング', 'Musikgenre-Mastering', '음악 장르 마스터링'],
  'Intensidad': ['Curve Intensity', '曲线作用强度', '適用強さ', 'Intensität', '적용 강도'],
  'Estilos de referencia': ['Reference Mastering Styles', '世界级参考母带风格', 'リファレンス・スタイル', 'Referenz-Stile', '레퍼런스 마스터링 스타일'],
  'Guardar todo': ['Save Full Studio Snapshot', '保存整套工作室参数快照', 'スタジオ全体を一括保存', 'Gesamtes Studio speichern', '스튜디오 전체 스냅샷 저장'],
  'Curvas de referencia': ['Factory Reference Curves', '原厂参考级母带曲线', 'ファクトリー基準カーブ', 'Referenz-Kurven', '레퍼런스 마스터 커브'],
  'Mis ajustes': ['My Saved Presets', '我保存的自定义预设', 'マイプリセット', 'Meine Presets', '내 저장 프리셋'],
  'Por sección': ['Per-Module Presets', '按独立模块存取预设', 'セクション別プリセット', 'Modul-Presets', '모듈별 개별 프리셋'],
  'Bloqueos': ['Module Parameter Locks', '模块参数防误触锁定', 'セクションロック管理', 'Modul-Sperren', '모듈 파라미터 잠금'],
  'Desbloquear todo': ['Unlock All Modules', '解锁全部模块', 'すべてロック解除', 'Alle entsperren', '모든 모듈 잠금 해제'],
  'Respaldo y web': ['JSON Backup & Cross-Device Transfer', 'JSON 完整备份与跨设备迁移', 'JSON バックアップ＆移行', 'JSON-Backup & Transfer', 'JSON 백업 및 기기 간 이전'],
  'Exportar': ['Export JSON', '导出备份数据', 'エクスポート', 'Exportieren', 'JSON 내보내기'],
  'Importar': ['Import JSON', '导入备份数据', 'インポート', 'Importieren', 'JSON 가져오기'],
  'Copiar': ['Copy', '复制文本', 'コピー', 'Kopieren', '복사'],
  'Aplicar': ['Apply', '应用', '適用', 'Anwenden', '적용'],
  'Borrar': ['Delete', '删除', '削除', 'Löschen', '삭제'],
  'Sobrescribir': ['Overwrite', '覆盖保存', '上書き保存', 'Überschreiben', '덮어쓰기'],

  // App Independiente Master PRO · Jack Friedrich
  'App Independiente Master PRO (.apk)': [
    'Standalone Master PRO App (.apk)',
    'Master PRO 独立原生安卓应用 (.apk)',
    'Master PRO 独立スタンドアロンアプリ (.apk)',
    'Eigenständige Master PRO App (.apk)',
    'Master PRO 독립 실행형 앱 (.apk)',
  ],
  'STORE 0% · Paquete Independiente': [
    'STORE 0% · Standalone Package',
    'STORE 0% · 独立包名共存安装',
    'STORE 0% · 独立パッケージ共存',
    'STORE 0% · Eigenständiges Paket',
    'STORE 0% · 독립 패키지 동시 설치',
  ],
  'Edición Independiente v1.5.0 Beta desarrollada por Jack Friedrich (com.jackfriedrich.masterpro). Se instala como otra app separada en tu teléfono sin borrar ni reemplazar la versión estándar, con 4 días de prueba PRO desde desbloquear, 6 idiomas nativos certificados, ventana emergente legal translúcida, Consola Final DVC y Audio Global del Sistema Android.': [
    'Standalone v1.5.0 Beta Edition developed by Jack Friedrich (com.jackfriedrich.masterpro). Installs side-by-side as a separate app on your phone without overwriting the standard edition—featuring a manual-unlock 4-day PRO trial, 6 certified native languages, frosted-glass legal startup notice, Final DVC Console, and Android System-Wide Audio.',
    '由 Jack Friedrich 开发的 v1.5.0 Beta 独立应用版本 (com.jackfriedrich.masterpro)。采用独立包名，可与手机上的标准版并存安装、互不覆盖；内置解锁后起算的 4 天 PRO 免费试用、6 国母语级声学认证翻译、磨砂玻璃启动法律声明、独立 DVC 终极调音台与 Android 全局系统音频处理。',
    'Jack Friedrich 開発の独立版 v1.5.0 Beta (com.jackfriedrich.masterpro)。別パッケージIDにより通常版を上書きせずスマホに並行インストール可能。手動開始式4日間PRO無料トライアル、6ヶ国語ネイティブ音響翻訳、すりガラス調の法的起動ポップアップ、独立DVC最終コンソール、Androidシステム全体オーディオ処理を搭載。',
    'Eigenständige Edition v1.5.0 Beta entwickelt von Jack Friedrich (com.jackfriedrich.masterpro). Wird als separate App parallel neben der Standardversion installiert, ohne diese zu überschreiben – inkl. manuell startbarer 4-Tage-PRO-Testphase, 6 zertifizierten Muttersprachen, Milchglas-Rechtshinweis beim Start, DVC-Endkonsole und systemweitem Android-Audio.',
    'Jack Friedrich가 개발한 독립형 v1.5.0 Beta 에디션 (com.jackfriedrich.masterpro). 별도 패키지 ID로 기존 표준 앱을 덮어쓰지 않고 스마트폰에 별개의 앱으로 동시 설치됩니다. 잠금 해제 시 시작되는 4일 PRO 무료 체험, 6개국어 네이티브 음향 번역, 반투명 글래스 법적 고지 팝업, 독립형 DVC 최종 콘솔 및 Android 시스템 전체 오디오 처리를 포함합니다.',
  ],
  'Descargar App PRO Independiente (.zip)': [
    'Download Standalone PRO App (.zip)',
    '下载 PRO 独立应用工程 (.zip)',
    'PRO 独立アプリプロジェクト (.zip)',
    'Eigenständige PRO-App laden (.zip)',
    'PRO 독립 앱 프로젝트 다운로드 (.zip)',
  ],
  'Descargar App Clásica Base (.zip)': [
    'Download Classic Base App (.zip)',
    '下载经典标准版工程 (.zip)',
    'クラシック通常版 (.zip)',
    'Klassische Basis-App (.zip)',
    '클래식 기본 앱 (.zip)',
  ],
  'Aviso Legal · Jack Friedrich': [
    'Legal Notice · Jack Friedrich',
    '法律与隐私声明 · Jack Friedrich',
    '法的通知 · Jack Friedrich',
    'Rechtliches · Jack Friedrich',
    '법적 고지 · Jack Friedrich',
  ],
  'Pasos para instalar Master-Hi-Res-PRO.apk como app separada en tu celular': [
    'Steps to install Master-Hi-Res-PRO.apk side-by-side on your phone',
    '在手机上作为独立应用并存安装 Master-Hi-Res-PRO.apk 的步骤',
    'スマホに別アプリとして Master-Hi-Res-PRO.apk を並行導入する手順',
    'Schritte zur parallelen Installation der Master-Hi-Res-PRO.apk auf dem Smartphone',
    '스마트폰에 별도 앱으로 Master-Hi-Res-PRO.apk를 동시 설치하는 방법',
  ],
  'Crea un repositorio nuevo en GitHub (ej. master-hires-pro) y sube el ZIP PRO independiente descargado.': [
    'Create a new GitHub repository (e.g. master-hires-pro) and upload the downloaded Standalone PRO ZIP.',
    '在 GitHub 新建仓库（如 master-hires-pro），上传下载的 PRO 独立版 ZIP。',
    'GitHubで新規リポジトリ（例: master-hires-pro）を作成し、ダウンロードしたPRO独立版ZIPをアップロードします。',
    'Erstelle ein neues GitHub-Repository (z. B. master-hires-pro) und lade das eigenständige PRO-ZIP hoch.',
    'GitHub에서 새 저장소(예: master-hires-pro)를 만들고 다운로드한 PRO 독립형 ZIP을 업로드하세요.',
  ],
  'GitHub Actions compilará automáticamente Master-Hi-Res-PRO-Jack-Friedrich.apk con ID único (com.jackfriedrich.masterpro) en ~3 minutos.': [
    'GitHub Actions automatically compiles Master-Hi-Res-PRO-Jack-Friedrich.apk with its unique package ID (com.jackfriedrich.masterpro) in ~3 minutes.',
    'GitHub Actions 将在约 3 分钟内自动编译具有独立包名 (com.jackfriedrich.masterpro) 的 Master-Hi-Res-PRO-Jack-Friedrich.apk。',
    'GitHub Actionsが約3分で固有ID (com.jackfriedrich.masterpro) を持つ Master-Hi-Res-PRO-Jack-Friedrich.apk を自動ビルドします。',
    'GitHub Actions kompiliert automatisch in ca. 3 Minuten die Master-Hi-Res-PRO-Jack-Friedrich.apk mit eigener Paket-ID (com.jackfriedrich.masterpro).',
    'GitHub Actions가 약 3분 내에 고유 패키지 ID(com.jackfriedrich.masterpro)를 가진 Master-Hi-Res-PRO-Jack-Friedrich.apk를 자동 빌드합니다.',
  ],
  'Descarga el APK desde Releases e instálalo: tendrás ambas apps independientes funcionando juntas en tu Android.': [
    'Download the APK from Releases and install it: both independent apps will coexist and run side-by-side on your Android phone.',
    '在 Releases 页面下载并安装 APK：两款独立应用即可在您的 Android 手机上完美共存运行。',
    'ReleasesからAPKをダウンロードしてインストールすれば、2つの独立したアプリがAndroid上で共存動作します。',
    'Lade die APK unter Releases herunter und installiere sie: Beide eigenständigen Apps laufen parallel auf deinem Android-Gerät.',
    'Releases에서 APK를 내려받아 설치하면 두 개의 독립된 앱이 Android 스마트폰에 나란히 설치되어 작동합니다.',
  ],
  'Vista previa de apps independientes:': [
    'Independent App Preview:',
    '独立应用切换预览：',
    '独立アプリ切替プレビュー：',
    'Vorschau eigenständiger Apps:',
    '독립 앱 미리보기 전환:',
  ],
  'Master PRO · Jack Friedrich': [
    'Master PRO · Jack Friedrich',
    'Master PRO · Jack Friedrich',
    'Master PRO · Jack Friedrich',
    'Master PRO · Jack Friedrich',
    'Master PRO · Jack Friedrich',
  ],
  'Estudio Clásico (v1.4)': [
    'Classic Studio (v1.4)',
    '经典标准版 (v1.4)',
    'クラシック版 (v1.4)',
    'Klassik-Edition (v1.4)',
    '클래식 에디션 (v1.4)',
  ],
  'Desplegar todos': [
    'Expand all',
    '全部展开',
    'すべて展開',
    'Alle ausklappen',
    '모두 펼치기',
  ],
  'Contraer todos': [
    'Collapse all',
    '全部折叠',
    'すべて折りたたむ',
    'Alle einklappen',
    '모두 접기',
  ],
  'Plana': [
    'Flat',
    '平直',
    'フラット',
    'Linear',
    '플랫',
  ],
  'Toca cualquier instrumento para desplegar o contraer sus bandas y navegar más rápido.': [
    'Tap any instrument card or quick button to expand or collapse its bands for rapid navigation.',
    '点按任意乐器卡片或快捷按钮即可展开或折叠频段，实现极速切换。',
    '楽器カードまたはクイックボタンをタップしてバンドを展開・折りたたみ、素早く移動できます。',
    'Tippe auf ein Instrument, um dessen Bänder für schnelle Navigation ein- oder auszuklappen.',
    '악기 카드를 탭하여 밴드를 펼치거나 접고 빠르게 이동하세요.',
  ],
  'En desarrollo (Beta) · Posible falla o corte según celular y app': [
    'In Development (Beta) · Possible dropouts or blocks depending on phone & app',
    '开发中 (Beta) · 视手机品牌与外部应用可能出现中断或受限',
    '開発中 (Beta) · 端末メーカーや外部アプリにより音切れ・制限が生じる場合があります',
    'In Entwicklung (Beta) · Mögliche Aussetzer je nach Smartphone-Marke & App',
    '개발 중 (Beta) · 기기 제조사 및 외부 앱에 따라 끊김이나 제한이 발생할 수 있음',
  ],
  'En Spotify, YouTube Music y VLC funciona vía sesión oficial; si en Xiaomi HyperOS o Samsung se corta al instante, activa abajo “Modo Compatibilidad HyperOS / OEM (HAL)” y apaga Dolby Atmos / Xiaomi Sound en Ajustes de sonido. Apps cerradas (WhatsApp, TikTok, Juegos) bloquean el acceso externo por seguridad de Android 10–15; el reproductor interno funciona al 100%.': [
    'Works with Spotify, YouTube Music & VLC via official audio sessions; if Xiaomi HyperOS or Samsung cuts off after a split second, enable "HyperOS / OEM Compatibility Mode (HAL)" below and turn off Dolby Atmos / Xiaomi Sound in Android Sound Settings. Closed apps (WhatsApp, TikTok, Games) block external DSP on Android 10–15; internal player works 100%.',
    'Spotify、YouTube Music 与 VLC 通过官方音频会话连接；若在小米澎湃 HyperOS 或三星手机上出现瞬间中断，请开启下方“HyperOS / OEM 兼容模式 (HAL)”并在系统声音设置中关闭杜比全景声 / 小米音效。受 Android 10–15 沙盒限制，WhatsApp、TikTok 与游戏不支持外部拦截；内置播放器 100% 稳定运行。',
    'Spotify・YouTube Music・VLCは公式セッション経由で動作します。Xiaomi HyperOSやSamsungで一瞬だけ効いて切れる場合は、下の「HyperOS / OEM 互換モード (HAL)」をオンにし、端末の音設定でDolby Atmos / Xiaomi Soundをオフにしてください。WhatsApp・TikTok・ゲーム等はAndroid 10〜15の制限により対象外です（内蔵プレーヤーは100%動作）。',
    'Funktioniert mit Spotify, YouTube Music & VLC über offizielle Audio-Sessions; falls Xiaomi HyperOS oder Samsung nach einem Bruchteil einer Sekunde abbricht, aktiviere unten den „HyperOS / OEM-Kompatibilitätsmodus (HAL)“ und deaktiviere Dolby Atmos / Xiaomi Sound in den Android-Toneinstellungen. Geschlossene Apps (WhatsApp, TikTok, Spiele) blockieren externes DSP unter Android 10–15; der interne Player läuft zu 100 %.',
    'Spotify, YouTube Music, VLC는 공식 오디오 세션으로 작동합니다. 샤오미 HyperOS나 삼성 기기에서 찰나에 끊기면 아래 "HyperOS / OEM 호환 모드 (HAL)"를 켜고 기기 소리 설정에서 Dolby Atmos / Xiaomi Sound를 끄세요. WhatsApp, TikTok, 게임 등은 Android 10–15 보안 정책상 외부 DSP가 차단되며 내장 플레이어는 100% 작동합니다.',
  ],
  'Modo Compatibilidad Xiaomi HyperOS / Samsung (HAL Nativo)': [
    'Xiaomi HyperOS / Samsung Compatibility Mode (Native HAL)',
    '小米 HyperOS / 三星 兼容模式 (原生 HAL)',
    'Xiaomi HyperOS / Samsung 互換モード (ネイティブ HAL)',
    'Xiaomi HyperOS / Samsung Kompatibilitätsmodus (Natives HAL)',
    '샤오미 HyperOS / 삼성 호환 모드 (네이티브 HAL)',
  ],
  'Usa el ecualizador HAL directo de Android en lugar de DynamicsProcessing. Actívalo si en tu celular el efecto suena medio segundo y se corta.': [
    'Uses Android hardware Equalizer HAL instead of DynamicsProcessing. Enable this if effects apply for a split second and cut off on your phone.',
    '使用 Android 硬件级 Equalizer HAL 替代 DynamicsProcessing。若音效仅生效一瞬间便中断，请开启此项。',
    'DynamicsProcessingの代わりにAndroid標準HALイコライザーを使用します。一瞬だけ効いて切れる場合にオンにしてください。',
    'Nutzt den direkten Android-Hardware-Equalizer statt DynamicsProcessing. Aktivieren, falls der Effekt auf deinem Handy kurz greift und sofort abbricht.',
    'DynamicsProcessing 대신 Android 하드웨어 Equalizer HAL을 사용합니다. 효과가 잠깐 적용되다 끊길 때 활성화하세요.',
  ],
  'Modo Legacy Sesión 0 (Experimental · Solo Android antiguo)': [
    'Legacy Session 0 Mix (Experimental · Older Android only)',
    '旧版全局会话 0 混音 (实验性 · 仅限旧版 Android)',
    'レガシー Session 0 ミックス (実験的・旧Android向け)',
    'Legacy-Session-0-Mix (Experimentell · Nur älteres Android)',
    '레거시 세션 0 믹스 (실험적 · 구형 Android 전용)',
  ],
  'Mantenlo APAGADO en Android 10–15 y Xiaomi HyperOS: evita colisiones que cortan el procesado de Spotify.': [
    'Keep OFF on Android 10–15 and Xiaomi HyperOS: prevents routing collisions that cut off Spotify processing.',
    '在 Android 10–15 与小米 HyperOS 上请保持关闭：避免路由冲突导致 Spotify 音效中断。',
    'Android 10〜15およびXiaomi HyperOSではオフのままにしてください（Spotifyの処理切れを防ぎます）。',
    'Unter Android 10–15 und Xiaomi HyperOS AUSGESCHALTET lassen: verhindert Routing-Konflikte mit Spotify.',
    'Android 10–15 및 샤오미 HyperOS에서는 꺼두세요: Spotify 처리가 끊기는 충돌을 방지합니다.',
  ],
};

const LANG_INDEX: Record<Exclude<LangCode, 'es'>, number> = {
  en: 0,
  zh: 1,
  ja: 2,
  de: 3,
  ko: 4,
};

const DYNAMIC_PATTERNS: Array<{
  re: RegExp;
  fn: (m: RegExpMatchArray, lang: Exclude<LangCode, 'es'>) => string;
}> = [
  {
    re: /^(\d+)\s+pistas?$/,
    fn: (m, l) => {
      const n = m[1];
      if (l === 'en') return `${n} ${n === '1' ? 'track' : 'tracks'}`;
      if (l === 'zh') return `共 ${n} 首曲目`;
      if (l === 'ja') return `${n} 曲`;
      if (l === 'de') return `${n} ${n === '1' ? 'Titel' : 'Titel'}`;
      return `총 ${n}곡`;
    },
  },
  {
    re: /^(\d+)\s+activas?$/,
    fn: (m, l) => {
      const n = m[1];
      if (l === 'en') return `${n} active`;
      if (l === 'zh') return `${n} 段激活`;
      if (l === 'ja') return `${n} バンド有効`;
      if (l === 'de') return `${n} aktiv`;
      return `${n}개 활성`;
    },
  },
  {
    re: /^Preajuste\s*·\s*(.+)$/,
    fn: (m, l) => {
      const name = m[1] === 'Plano' ? ({ en: 'Flat', zh: '平直', ja: 'フラット', de: 'Linear', ko: '플랫' }[l]) : m[1];
      if (l === 'en') return `Preset · ${name}`;
      if (l === 'zh') return `预设 · ${name}`;
      if (l === 'ja') return `プリセット · ${name}`;
      if (l === 'de') return `Preset · ${name}`;
      return `프리셋 · ${name}`;
    },
  },
  {
    re: /^Bypass de carga cero \(0\.0 dB\)$/,
    fn: (_m, l) =>
      ({
        en: 'Zero-Load Pure Bypass (0.0 dB)',
        zh: '零负载纯直通旁路 (0.0 dB)',
        ja: 'ゼロ負荷ピュアバイパス (0.0 dB)',
        de: 'Null-Last-Direkt-Bypass (0.0 dB)',
        ko: '제로 부하 순수 바이패스 (0.0 dB)',
      })[l],
  },
  {
    re: /^Compresor LR4 activo · Reducción −([\d.]+) dB$/,
    fn: (m, l) =>
      ({
        en: `LR4 Compressor Active · Gain Reduction −${m[1]} dB`,
        zh: `LR4 压缩器运行中 · 增益衰减 −${m[1]} dB`,
        ja: `LR4 コンプ稼働中 · リダクション −${m[1]} dB`,
        de: `LR4-Kompressor aktiv · Pegelreduktion −${m[1]} dB`,
        ko: `LR4 컴프레서 작동 중 · 게인 감쇠 −${m[1]} dB`,
      })[l],
  },
  {
    re: /^● Espectro \+ Curva Final$/,
    fn: (_m, l) =>
      ({
        en: '● Live Spectrum + Final Curve',
        zh: '● 实时频谱 + 终极曲线',
        ja: '● スペクトラム＋最終カーブ',
        de: '● Echtzeit-Spektrum + Endkurve',
        ko: '● 실시간 스펙트럼 + 최종 커브',
      })[l],
  },
  {
    re: /^○ Habilitar visualización$/,
    fn: (_m, l) =>
      ({
        en: '○ Enable Spectrum Visualizer',
        zh: '○ 开启实时频谱可视化',
        ja: '○ ビジュアライザーを有効化',
        de: '○ Spektrum-Anzeige aktivieren',
        ko: '○ 스펙트럼 시각화 켜기',
      })[l],
  },
  {
    re: /^Estudio Principal → Consola Final ACTIVA → Salida$/,
    fn: (_m, l) =>
      ({
        en: 'Main Studio → Final Console ACTIVE → Output',
        zh: '主母带工作室 → 终极调音台【已激活】→ 输出',
        ja: 'メインスタジオ → 最終コンソール【有効】→ 出力',
        de: 'Hauptstudio → Endkonsole AKTIV → Ausgang',
        ko: '메인 스튜디오 → 최종 콘솔 [활성] → 출력',
      })[l],
  },
  {
    re: /^Audio Original → Consola Final ACTIVA → Salida$/,
    fn: (_m, l) =>
      ({
        en: 'Direct Audio → Final Console ACTIVE → Output',
        zh: '原始直通音频 → 终极调音台【已激活】→ 输出',
        ja: '原音ダイレクト → 最終コンソール【有効】→ 出力',
        de: 'Original-Audio → Endkonsole AKTIV → Ausgang',
        ko: '원음 다이렉트 → 최종 콘솔 [활성] → 출력',
      })[l],
  },
  {
    re: /^Consola en Bypass Puro · Pasa directo desde Estudio Principal$/,
    fn: (_m, l) =>
      ({
        en: 'Console in Pure Bypass · Direct Pass from Main Studio',
        zh: '终极调音台纯旁路 · 由主母带工作室直接输出',
        ja: 'コンソール純粋バイパス · メインスタジオから直結出力',
        de: 'Konsole im Direkt-Bypass · Signal direkt vom Hauptstudio',
        ko: '콘솔 순수 바이패스 · 메인 스튜디오 직결 출력',
      })[l],
  },
];

export function translateExactString(srcEs: string, lang: LangCode): string {
  if (lang === 'es' || !srcEs) return srcEs;
  const trimmed = srcEs.trim();
  if (!trimmed) return srcEs;
  const idx = LANG_INDEX[lang];
  const exact = EXACT_UI_DICT[trimmed];
  if (exact && exact[idx]) {
    return srcEs.replace(trimmed, exact[idx]);
  }
  for (const pat of DYNAMIC_PATTERNS) {
    const m = trimmed.match(pat.re);
    if (m) return pat.fn(m, lang);
  }
  return srcEs;
}

const origTextNodeMap = new WeakMap<Text, string>();
const origAttrMap = new WeakMap<Element, Record<string, string>>();

/* Recorre de forma instantánea el DOM del Estudio preservando el español original en memoria
   para conmutar en vivo entre Español, English, 简体中文, 日本語, Deutsch y 한국어 sin recargar el audio */
export function applyCertifiedDomTranslation(root: HTMLElement, lang: LangCode): void {
  document.documentElement.lang = SUPPORTED_LANGS.find((x) => x.code === lang)?.htmlLang || 'es';

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !parent.closest('.jf-modal-backdrop') && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
      const curVal = node.nodeValue || '';
      if (!origTextNodeMap.has(node)) {
        origTextNodeMap.set(node, curVal);
      } else if (lang === 'es') {
        const orig = origTextNodeMap.get(node)!;
        if (curVal !== orig) node.nodeValue = orig;
        node = walker.nextNode() as Text | null;
        continue;
      } else {
        // Si el motor actualizó dinámicamente un contador en español (ej. "14 pistas" o reducción dB), actualiza base
        const prevOrig = origTextNodeMap.get(node)!;
        const prevTranslated = translateExactString(prevOrig, lang);
        if (curVal !== prevTranslated && curVal !== prevOrig && /[a-záéíóúñ]/i.test(curVal)) {
          // Comprueba si coincide con algún patrón dinámico o clave española nueva
          if (EXACT_UI_DICT[curVal.trim()] || DYNAMIC_PATTERNS.some((p) => p.re.test(curVal.trim()))) {
            origTextNodeMap.set(node, curVal);
          }
        }
      }
      const baseEs = origTextNodeMap.get(node) || curVal;
      const target = lang === 'es' ? baseEs : translateExactString(baseEs, lang);
      if (node.nodeValue !== target) {
        node.nodeValue = target;
      }
    }
    node = walker.nextNode() as Text | null;
  }

  const attrsToTranslate = ['placeholder', 'aria-label', 'title'];
  const elems = root.querySelectorAll<HTMLElement>('[placeholder],[aria-label],[title]');
  elems.forEach((el) => {
    if (el.closest('.jf-modal-backdrop')) return;
    let rec = origAttrMap.get(el);
    if (!rec) {
      rec = {};
      origAttrMap.set(el, rec);
    }
    for (const at of attrsToTranslate) {
      const val = el.getAttribute(at);
      if (!val) continue;
      if (!(at in rec)) rec[at] = val;
      const baseEs = rec[at];
      const next = lang === 'es' ? baseEs : translateExactString(baseEs, lang);
      if (val !== next) el.setAttribute(at, next);
    }
  });
}
