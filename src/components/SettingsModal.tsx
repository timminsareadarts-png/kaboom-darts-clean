import React, { useState, useEffect } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Play,
  RotateCcw,
  X,
  Check,
  Radio,
  Eye,
  Tv,
  Zap,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Lock,
  Mail,
  Send,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';
import { CallerVoiceStyle, ThemeMode } from '../types';
import { announcer, CALLER_PROFILES, CallerProfile } from '../utils/audio';
import { resetAllVenueDataToNone } from '../services/cloudSync';
import { useAuth } from '../context/AuthContext';
import { getLocalSecurityPins, saveSecurityPins, DEFAULT_ADMIN_PIN, DEFAULT_PLAYER_PIN } from '../utils/authHelper';
import { AdminSeasonResetButton } from './SeasonResetModal';
import { AdminOverallStatsEmailModal } from './AdminOverallStatsEmailModal';
import {
  OFFICIAL_LEAGUE_EMAIL,
  getAutoEmailOverallStatsEnabled,
  setAutoEmailOverallStatsEnabled,
  getLastOverallStatsDispatch,
  dispatchOverallPlayerStatsEmail,
} from '../utils/overallStatsEmailHelper';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
}) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'caller' | 'theme' | 'audio' | 'pins' | 'email_stats' | 'reset'>('caller');
  const [autoEmailStats, setAutoEmailStats] = useState<boolean>(() => getAutoEmailOverallStatsEnabled());
  const [lastEmailDispatch, setLastEmailDispatch] = useState(() => getLastOverallStatsDispatch());
  const [isSendingStatsEmail, setIsSendingStatsEmail] = useState(false);
  const [statsEmailFeedback, setStatsEmailFeedback] = useState<string | null>(null);
  const [showFullStatsEmailModal, setShowFullStatsEmailModal] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<CallerVoiceStyle>(() => announcer.getVoiceStyle());
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => announcer.isEnabled());
  const [pitch, setPitch] = useState<number>(() => announcer.getPitch());
  const [rate, setRate] = useState<number>(() => announcer.getRate());
  const [volume, setVolume] = useState<number>(() => announcer.getVolume());
  const [testedAction, setTestedAction] = useState<string | null>(null);
  const [voiceRosterVersion, setVoiceRosterVersion] = useState<number>(0);
  const [deleteConfirmStyle, setDeleteConfirmStyle] = useState<CallerVoiceStyle | null>(null);
  const [customVoiceURI, setCustomVoiceURI] = useState<string | null>(() => announcer.getCustomVoiceURI());
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>(() => announcer.getAvailableSystemVoices());

  // Listen for real-time voice setting updates
  useEffect(() => {
    const updateVoices = () => {
      setSystemVoices(announcer.getAvailableSystemVoices());
    };
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
      updateVoices();
    }
    const unsubscribe = announcer.subscribeVoiceChanges(() => {
      setVoiceStyle(announcer.getVoiceStyle());
      setAudioEnabled(announcer.isEnabled());
      setPitch(announcer.getPitch());
      setRate(announcer.getRate());
      setVolume(announcer.getVolume());
      setCustomVoiceURI(announcer.getCustomVoiceURI());
      setVoiceRosterVersion(v => v + 1);
    });
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleDeleteVoice = (style: CallerVoiceStyle) => {
    announcer.deleteVoiceStyle(style);
    setDeleteConfirmStyle(null);
    setVoiceRosterVersion(v => v + 1);
  };

  const handleRestoreVoice = (style: CallerVoiceStyle) => {
    announcer.restoreVoiceStyle(style);
    setVoiceRosterVersion(v => v + 1);
  };

  const handleRestoreAllVoices = () => {
    announcer.restoreAllVoices();
    setVoiceRosterVersion(v => v + 1);
  };

  const handleCustomVoiceChange = (uri: string) => {
    const val = uri === '__auto__' ? null : uri;
    setCustomVoiceURI(val);
    announcer.setCustomVoiceURI(val);
    announcer.previewVoice();
  };

  // PIN Management State
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [playerPinInput, setPlayerPinInput] = useState<string>('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const pins = getLocalSecurityPins();
      setAdminPinInput(pins.adminPin);
      setPlayerPinInput(pins.playerPin);
      setPinSuccessMsg(null);
      setPinErrorMsg(null);
    }
  }, [isOpen]);

  const handleSavePins = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinErrorMsg(null);
    setPinSuccessMsg(null);

    const cleanAdmin = adminPinInput.trim();
    const cleanPlayer = playerPinInput.trim();

    if (cleanAdmin.length < 3) {
      setPinErrorMsg('Admin PIN must be at least 3 digits.');
      return;
    }
    if (cleanPlayer.length < 3) {
      setPinErrorMsg('Player PIN must be at least 3 digits.');
      return;
    }

    const success = await saveSecurityPins(cleanAdmin, cleanPlayer);
    if (success) {
      setPinSuccessMsg('Security PINs updated and synced successfully across venue!');
      setTimeout(() => setPinSuccessMsg(null), 3000);
    } else {
      setPinErrorMsg('Failed to sync PINs to server.');
    }
  };

  const handleResetPinsToDefault = async () => {
    setAdminPinInput(DEFAULT_ADMIN_PIN);
    setPlayerPinInput(DEFAULT_PLAYER_PIN);
    await saveSecurityPins(DEFAULT_ADMIN_PIN, DEFAULT_PLAYER_PIN);
    setPinSuccessMsg('PINs restored to default codes: Admin 1950, Player 1234.');
    setTimeout(() => setPinSuccessMsg(null), 3000);
  };

  // Factory Reset State
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  if (!isOpen) return null;

  const handleSelectVoiceStyle = (style: CallerVoiceStyle) => {
    setVoiceStyle(style);
    announcer.setVoiceStyle(style);
    setPitch(announcer.getPitch());
    setRate(announcer.getRate());

    // Automatically preview the 180 call on voice selection
    announcer.previewVoice();
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    announcer.setEnabled(next);
  };

  const handlePitchChange = (val: number) => {
    setPitch(val);
    announcer.setPitch(val);
  };

  const handleRateChange = (val: number) => {
    setRate(val);
    announcer.setRate(val);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    announcer.setVolume(val);
  };

  const handleResetDefaults = () => {
    const prof = CALLER_PROFILES[voiceStyle] || CALLER_PROFILES.british;
    setPitch(prof.defaultPitch);
    setRate(prof.defaultRate);
    setVolume(1.0);
    announcer.setPitch(prof.defaultPitch);
    announcer.setRate(prof.defaultRate);
    announcer.setVolume(1.0);
    announcer.previewVoice();
  };

  const playTest = (actionType: '180' | '100' | 'gameon' | 'require' | 'bust' | 'turn' | 'checkout' | 'winner' | 'coin') => {
    setTestedAction(actionType);
    setTimeout(() => setTestedAction(null), 1200);

    if (actionType === '180') {
      announcer.announceScore(180);
    } else if (actionType === '100') {
      announcer.announceScore(100);
    } else if (actionType === 'gameon') {
      announcer.announceGameOn(1);
    } else if (actionType === 'require') {
      announcer.announceRequirement(40, 'Player 1');
    } else if (actionType === 'bust') {
      announcer.announceBust();
    } else if (actionType === 'turn') {
      announcer.announceTurn('Player 1');
    } else if (actionType === 'checkout') {
      announcer.announceCheckout('Player 1', 1);
    } else if (actionType === 'winner') {
      announcer.announceMatchWinner('Player 1');
    } else if (actionType === 'coin') {
      announcer.playCoinFlipSound();
    }
  };

  const handleExecuteFactoryReset = async () => {
    setIsResetting(true);
    try {
      await resetAllVenueDataToNone();
      setResetDone(true);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      console.error('Reset error:', e);
      setIsResetting(false);
    }
  };

  const currentProfile = CALLER_PROFILES[voiceStyle] || CALLER_PROFILES.british;

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div
        id="settings-modal-container"
        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden w-full max-w-2xl transition-all"
      >
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-900/40">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight text-white flex items-center gap-2">
                Options & Customization
                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase rounded border border-indigo-500/30">
                  Kaboom Live
                </span>
              </h3>
              <p className="text-xs text-slate-400">Themes, Caller Personas, Sound Effects & Speeches</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('caller')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'caller'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Caller Voices ({CALLER_PROFILES[voiceStyle]?.name.split(' ')[0]})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'theme'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <span>Theme ({theme === 'dark' ? 'Dark' : 'Light'})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'audio'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Audio & Tuning</span>
          </button>

          {/* Admin-Only Tabs: PINs & Factory Reset */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('pins')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeTab === 'pins'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-amber-500'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Security PINs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email_stats')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeTab === 'email_stats'
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-emerald-500'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Email Stats</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reset')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeTab === 'reset'
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset App</span>
              </button>
            </>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* TAB: SECURITY PINS (ADMIN ONLY) */}
          {activeTab === 'pins' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    Security PIN Codes Management
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure and reset the security codes required to unlock Admin and Player access on venue devices.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-black uppercase">
                  Admin Only
                </span>
              </div>

              {pinSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pinSuccessMsg}</span>
                </div>
              )}

              {pinErrorMsg && (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pinErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSavePins} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Admin PIN Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        👑 Admin Security PIN
                      </label>
                      <span className="text-[10px] text-slate-400">Initial: 1950</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Allows full system access, roster editing, finance management & PIN resets.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={adminPinInput}
                      onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-lg font-mono font-black text-slate-900 dark:text-white tracking-widest focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Player PIN Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        🎯 Player Security PIN
                      </label>
                      <span className="text-[10px] text-slate-400">Initial: 1234</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Allows players to pick matches, toss coin, order players, score & view finances.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={playerPinInput}
                      onChange={(e) => setPlayerPinInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-lg font-mono font-black text-slate-900 dark:text-white tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-700/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Spectator Access Note
                  </div>
                  <p className="text-[11px]">
                    Spectators never require a PIN code to view matches, finances, and standings.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResetPinsToDefault}
                    className="text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore Default PINs (1950 / 1234)
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Save & Sync PINs
                  </button>
                </div>
              </form>

              {/* End of Season Reset for Admin */}
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-50/60 dark:bg-rose-950/30 border border-red-200 dark:border-rose-900/60 p-4 rounded-xl">
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-xs text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-rose-600" /> Start New Season (Reset League Stats)
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      Reset stats per league (Tuesday Singles, Wednesday Teams, Thursday Doubles) or all leagues to allow one league to end and a new one to begin. All player profiles and PINs are preserved.
                    </p>
                  </div>
                  <AdminSeasonResetButton league="all" label="Reset Season Stats" />
                </div>
              </div>
            </div>
          )}

          {/* TAB: EMAIL STATS (ADMIN ONLY) */}
          {activeTab === 'email_stats' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-500" />
                    Email Overall Player Statistics
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Optionally and automatically email fully detailed overall stats of all individual players to <strong>{OFFICIAL_LEAGUE_EMAIL}</strong>.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-black uppercase">
                  Admin Only
                </span>
              </div>

              {statsEmailFeedback && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{statsEmailFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatsEmailFeedback(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Automatic Email Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                        Automatic Email Dispatch
                      </h5>
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                        Target: {OFFICIAL_LEAGUE_EMAIL}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                      When enabled, the system automatically emails fully detailed overall statistics of all individual players to <strong>{OFFICIAL_LEAGUE_EMAIL}</strong> upon completion of league nights and season resets.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoEmailStats;
                      setAutoEmailStats(next);
                      setAutoEmailOverallStatsEnabled(next);
                      setStatsEmailFeedback(
                        next
                          ? `Automated overall stats email active. Reports will be sent to ${OFFICIAL_LEAGUE_EMAIL}.`
                          : `Automated overall stats email disabled.`
                      );
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold text-xs shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-600 transition-all cursor-pointer shrink-0"
                  >
                    {autoEmailStats ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Auto-Email: ON</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400">Auto-Email: OFF</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {lastEmailDispatch ? (
                      <span>
                        Last Dispatched: <strong>{lastEmailDispatch.formattedDate}</strong> ({lastEmailDispatch.playerCount} players)
                      </span>
                    ) : (
                      <span>No overall stats dispatched yet during this session.</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFullStatsEmailModal(true)}
                      className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview Full Report</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSendingStatsEmail}
                      onClick={async () => {
                        setIsSendingStatsEmail(true);
                        setStatsEmailFeedback(null);
                        try {
                          const res = await dispatchOverallPlayerStatsEmail({ triggerType: 'manual' });
                          setLastEmailDispatch(getLastOverallStatsDispatch());
                          setStatsEmailFeedback(`Successfully sent fully detailed player stats to ${OFFICIAL_LEAGUE_EMAIL}!`);
                        } catch (err) {
                          setStatsEmailFeedback(err instanceof Error ? err.message : 'Error sending stats email');
                        } finally {
                          setIsSendingStatsEmail(false);
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSendingStatsEmail ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Email Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* TAB 1: CALLER VOICES */}
          {activeTab === 'caller' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Referee & Announcer Voices</span>
                    {isAdmin && (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black uppercase rounded-md tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Admin Controls Active
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select authentic referee styles with unique accents, vocabulary, and live match announcements.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                      audioEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{audioEnabled ? 'Sound ON' : 'Muted'}</span>
                  </button>
                </div>
              </div>

              {/* Admin-Only Voice Management Banner */}
              {isAdmin && (
                <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Admin Voice Curator: Choose which voices players and referee tablets can select.</span>
                    </div>
                    {announcer.getDeletedVoiceStyles().length > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreAllVoices}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore All Hidden Voices ({announcer.getDeletedVoiceStyles().length})
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-400/90 leading-relaxed">
                    Click the red <strong className="font-black">Delete Voice</strong> button on any caller card to immediately hide it from match setup and player screens. You can restore deleted voices at any time.
                  </p>
                </div>
              )}

              {/* Grid of Voice Personas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {announcer.getAllVoiceProfiles()
                  .filter((prof) => isAdmin || !prof.isDeleted)
                  .map((prof) => {
                    const key = prof.id;
                    const isSelected = voiceStyle === key;
                    const isDeleted = !!prof.isDeleted;
                    const isConfirming = deleteConfirmStyle === key;

                    return (
                      <div
                        key={key}
                        onClick={() => {
                          if (!isDeleted) {
                            handleSelectVoiceStyle(key);
                          }
                        }}
                        className={`relative p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                          isDeleted
                            ? 'opacity-65 border-dashed border-rose-300 dark:border-rose-800/80 bg-rose-50/30 dark:bg-rose-950/20 cursor-default'
                            : isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-sm ring-2 ring-indigo-600/30 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-1.5 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl shrink-0">{prof.icon}</span>
                              <div>
                                <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                                  {prof.name}
                                </span>
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">
                                  {prof.subtitle}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {isDeleted ? (
                                <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[9px] font-black uppercase rounded tracking-wider">
                                  Hidden / Deleted
                                </span>
                              ) : prof.tag ? (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase rounded tracking-wider">
                                  {prof.tag}
                                </span>
                              ) : null}

                              {!isDeleted && (
                                isSelected ? (
                                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3" />
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                                )
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                            {prof.description}
                          </p>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {!isDeleted && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectVoiceStyle(key);
                                  announcer.previewVoice();
                                }}
                                className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" /> Test Voice
                              </button>
                            )}

                            {/* Admin Delete / Restore Controls */}
                            {isAdmin && (
                              <>
                                {isDeleted ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestoreVoice(key);
                                    }}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Restore Voice
                                  </button>
                                ) : isConfirming ? (
                                  <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 p-1 rounded border border-rose-200 dark:border-rose-800" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold">Hide voice?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteVoice(key)}
                                      className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold rounded cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmStyle(null)}
                                      className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-bold rounded cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmStyle(key);
                                    }}
                                    className="text-[10px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:underline cursor-pointer"
                                    title="Delete/hide this voice from venue selection"
                                  >
                                    <Trash2 className="w-3 h-3" /> Delete Voice
                                  </button>
                                )}
                              </>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {prof.genderPreference !== 'any' ? prof.genderPreference : 'accent'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Speech Synthesis Engine Selector (Natural / Neural Browser Engine) */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        System Speech Engine & Natural Audio
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Active Voice: <strong className="text-indigo-600 dark:text-indigo-400">{announcer.getActiveVoiceName()}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {systemVoices.length > 0 && (
                  <div className="pt-1">
                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider block mb-1">
                      Installed Browser Voice Engine (Auto-Neural Selection Recommended)
                    </label>
                    <select
                      value={customVoiceURI || '__auto__'}
                      onChange={(e) => handleCustomVoiceChange(e.target.value)}
                      className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="__auto__">⚡ Auto-Detect Best Natural / Neural Voice (Recommended)</option>
                      {systemVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name} ({v.lang}) {v.localService ? '[Local Engine]' : '[Cloud/Neural Engine]'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Active Voice Test Bar & Soundboard */}
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{currentProfile.icon}</span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Test Soundboard: {currentProfile.name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Click buttons below to hear authentic live referee calls
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => announcer.previewVoice()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> 180 Call
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => playTest('180')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === '180'
                        ? 'bg-amber-500 text-white border-amber-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🎯 180 Maximum
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('gameon')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'gameon'
                        ? 'bg-indigo-600 text-white border-indigo-700 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📢 Game On!
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('require')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'require'
                        ? 'bg-indigo-600 text-white border-indigo-700 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🎯 You Require 40
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('100')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === '100'
                        ? 'bg-amber-500 text-white border-amber-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🔥 Ton (100)
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('bust')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'bust'
                        ? 'bg-rose-500 text-white border-rose-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ❌ Bust Call
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('checkout')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'checkout'
                        ? 'bg-emerald-500 text-white border-emerald-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🏆 Game Shot & Leg
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('winner')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'winner'
                        ? 'bg-yellow-500 text-white border-yellow-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🥇 Match Winner
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('turn')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'turn'
                        ? 'bg-indigo-500 text-white border-indigo-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    👤 Player to Throw
                  </button>

                  <button
                    type="button"
                    onClick={() => playTest('coin')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      testedAction === 'coin'
                        ? 'bg-yellow-500 text-white border-yellow-600 scale-105'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🪙 Coin Sound FX
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THEME (DARK / LIGHT MODE) */}
          {activeTab === 'theme' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Interface Appearance</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switch between high-contrast Dark Mode and clean Light Mode for optimal scoring clarity in any venue lighting.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Dark Mode Card */}
                <div
                  onClick={() => onThemeChange('dark')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    theme === 'dark'
                      ? 'border-indigo-600 bg-slate-900 text-white shadow-lg ring-2 ring-indigo-600/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                          <Moon className="w-4 h-4" />
                        </div>
                        <span className="font-black text-sm">Dark Mode (Default)</span>
                      </div>
                      {theme === 'dark' && (
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      Sleek pub & tournament atmosphere with deep slate contrast, glowing scores, and reduced glare in dark dart venues.
                    </p>

                    {/* Dark Preview Mini Mockup */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-300 font-bold">Player 1</span>
                      </div>
                      <span className="text-emerald-400 font-black text-base">501</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-bold text-indigo-400">
                    {theme === 'dark' ? '✓ Currently Active' : 'Click to Activate Dark Mode'}
                  </div>
                </div>

                {/* Light Mode Card */}
                <div
                  onClick={() => onThemeChange('light')}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    theme === 'light'
                      ? 'border-indigo-600 bg-white text-slate-900 shadow-lg ring-2 ring-indigo-600/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-900 dark:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                          <Sun className="w-4 h-4" />
                        </div>
                        <span className="font-black text-sm">Light Mode</span>
                      </div>
                      {theme === 'light' && (
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                      Crisp, high-brightness daytime presentation with crisp typography and clean white backgrounds.
                    </p>

                    {/* Light Preview Mini Mockup */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        <span className="text-slate-800 font-bold">Player 1</span>
                      </div>
                      <span className="text-indigo-600 font-black text-base">501</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {theme === 'light' ? '✓ Currently Active' : 'Click to Activate Light Mode'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO & FINE TUNING */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Caller Speech & Audio Tuning</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fine-tune speech rate, pitch, and master volume for your speaker setup or Bluetooth venue sound system.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                {/* Volume Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-indigo-500" /> Master Speech & Sound Volume
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Pitch Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      Voice Pitch ({pitch < 1 ? 'Deeper / Lower' : pitch > 1 ? 'Higher' : 'Standard'})
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{pitch.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.6"
                    max="1.5"
                    step="0.05"
                    value={pitch}
                    onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                {/* Speed / Rate Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-700 dark:text-slate-300">
                      Speech Speed / Cadence ({rate < 1 ? 'Slower' : rate > 1 ? 'Faster' : 'Normal'})
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{rate.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.05"
                    value={rate}
                    onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Persona Defaults
                  </button>

                  <button
                    type="button"
                    onClick={() => announcer.previewVoice()}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" /> Test Voice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FACTORY RESET (RESET APP TO BRAND NEW) */}
          {activeTab === 'reset' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-black uppercase rounded border border-red-200 dark:border-red-800">
                    Brand New Setup
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Reset All Names, Stats & Finances
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Wipe all existing player names, standings, bull records, game statistics, attendance check-ins, and finance accounts to start with a fresh, brand new app.
                </p>
              </div>

              {/* What gets reset breakdown card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Items That Will Be Cleared:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>All Player Names & Avatars</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>Tuesday, Wednesday & Thursday Standings</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>1001, 701, Baseball, Fives & Cricket Stats</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>Season Bulls Hit & High Out Records</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>Attendance Check-ins & Tournament Brackets</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>All Finance Rosters, Fees & Session Logs</span>
                  </div>
                </div>
              </div>

              {/* Reset Action Flow */}
              {resetDone ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl p-5 text-center space-y-2 animate-fade-in">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h5 className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
                    App Successfully Reset to Brand New!
                  </h5>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Reloading workspace to initialize your fresh clean slate...
                  </p>
                </div>
              ) : showConfirmReset ? (
                <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 rounded-xl p-5 space-y-4 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="font-black text-sm text-red-900 dark:text-red-200">
                        Are you absolutely sure?
                      </h5>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                        This action will immediately wipe all names, stats, match logs, and financial records from local storage, active server memory, and cloud databases. This cannot be undone.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-red-200 dark:border-red-900/60">
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={handleExecuteFactoryReset}
                      className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Resetting App Data...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Yes, Reset App to Brand New</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isResetting}
                      onClick={() => setShowConfirmReset(false)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50/50 dark:bg-slate-800/40 border border-red-200 dark:border-red-900/40 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <Trash2 className="w-4 h-4 text-red-600" /> Start Brand New Season
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Clear all previous player names, standings, and finances with a single click.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowConfirmReset(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Reset App to Brand New
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Current Persona:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              {currentProfile.icon} {currentProfile.name}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Admin Overall Stats Email Modal (Preview & Full Dispatcher) */}
      {isAdmin && (
        <AdminOverallStatsEmailModal
          isOpen={showFullStatsEmailModal}
          onClose={() => {
            setShowFullStatsEmailModal(false);
            setAutoEmailStats(getAutoEmailOverallStatsEnabled());
            setLastEmailDispatch(getLastOverallStatsDispatch());
          }}
        />
      )}
    </div>
  );
};
