import React from 'react';
import { Target, Trophy, LayoutGrid, BarChart3, Crosshair, Users, Volume2, VolumeX, RefreshCw, ShieldCheck, Layers, DollarSign, Settings, Sun, Moon, Share2, QrCode, Lock, LogOut, Maximize, Minimize, Sparkles } from 'lucide-react';
import { announcer, CALLER_PROFILES } from '../utils/audio';
import { ThemeMode } from '../types';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab: 'scorer' | 'setup' | 'league' | 'finance' | 'draws' | 'games' | 'assignments' | 'practice' | 'players';
  setActiveTab: (tab: 'scorer' | 'setup' | 'league' | 'finance' | 'draws' | 'games' | 'assignments' | 'practice' | 'players') => void;
  matchCode?: string;
  isLiveActive?: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  selectedDrawsLeague?: 'tuesday' | 'wednesday' | 'thursday';
  onSelectDrawsLeague?: (league: 'tuesday' | 'wednesday' | 'thursday') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  matchCode,
  isLiveActive = false,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenShare,
  selectedDrawsLeague = 'tuesday',
  onSelectDrawsLeague,
}) => {
  const { role, logout, isAdmin, isPlayer, isSpectator } = useAuth();
  const [audioEnabled, setAudioEnabled] = React.useState(announcer.isEnabled());
  const [isFullscreen, setIsFullscreen] = React.useState(() => {
    return typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false;
  });
  const activeProfile = CALLER_PROFILES[announcer.getVoiceStyle()] || CALLER_PROFILES.british;

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    announcer.setEnabled(next);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 space-y-2">
        
        {/* ROW 1: Brand, Match Status & Quick Tools */}
        <div className="flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <div 
            onClick={() => setActiveTab('scorer')}
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/40 group-hover:bg-indigo-500 transition-colors">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Kaboom <span className="text-indigo-400 font-light">Darts</span>
                </span>
                <span className="bg-indigo-500/20 text-indigo-300 text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border border-indigo-500/30">
                  MATCH CENTER
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 -mt-0.5 hidden sm:block font-medium">
                Kaboom Dart Match Center & Live Scoring
              </p>
            </div>
          </div>

          {/* Right Header Actions: Code, Theme, Fullscreen, Sound, Share, Options, Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Match Code Badge */}
            {matchCode && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-lg border border-slate-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden xs:inline">Code:</span>
                <span className="text-xs font-mono font-bold text-indigo-400 tracking-wider">{matchCode}</span>
              </div>
            )}

            {/* Role Badge and Switch Button */}
            <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
              <span
                className={`px-2 py-1 rounded-md text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                  isAdmin
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }`}
                title={`Current Level: ${isAdmin ? 'Administrator (Full Access)' : 'Player (Match Play & View Finances)'}`}
              >
                <span>{isAdmin ? '👑' : '🎯'}</span>
                <span className="hidden sm:inline">{isAdmin ? 'Admin' : 'Player'}</span>
              </span>

              <button
                type="button"
                onClick={() => logout()}
                title="Lock / Switch User Level"
                className="p-1 sm:px-2 sm:py-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Switch</span>
              </button>
            </div>

            {/* Quick Theme Toggle (Sun/Moon) */}
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700 cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-300" />
              )}
            </button>

            {/* Fullscreen / Minimize Toggle (Placed right beside Dark Mode option) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen (Minimize)" : "Enter Fullscreen (Maximize)"}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors border cursor-pointer shrink-0 ${
                isFullscreen
                  ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
              }`}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 text-indigo-300" />
              ) : (
                <Maximize className="w-4 h-4 text-slate-300" />
              )}
            </button>

            {/* Sound Announcer Toggle */}
            <button
              type="button"
              onClick={toggleAudio}
              title={audioEnabled ? `Announcer ON (${activeProfile.name}) - Click to mute` : "Announcer Muted - Click to enable"}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors border cursor-pointer shrink-0 ${
                audioEnabled
                  ? 'bg-slate-800 text-indigo-400 border-indigo-500/30'
                  : 'bg-slate-800/50 text-slate-500 border-slate-700'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Share App & Live Match QR Button */}
            <button
              type="button"
              onClick={onOpenShare}
              title="Share App or Live Match QR Code"
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm border border-indigo-400/40 cursor-pointer flex items-center gap-1.5 shrink-0 text-xs font-bold ring-1 ring-indigo-400/30"
            >
              <QrCode className="w-4 h-4 text-indigo-200" />
              <span className="hidden sm:inline">QR Share</span>
            </button>

            {/* Full Options & Caller Voice Settings Button */}
            <button
              type="button"
              onClick={onOpenSettings}
              title={`Options & Caller Voices (${activeProfile.name})`}
              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700 cursor-pointer flex items-center gap-1.5 shrink-0 text-xs font-bold"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">{activeProfile.icon} Options</span>
            </button>

            {/* Dedicated Logout Button */}
            <button
              type="button"
              onClick={() => logout()}
              title="Logout from session"
              className="px-2 sm:px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 transition-colors border border-rose-500/30 cursor-pointer flex items-center gap-1.5 shrink-0 text-xs font-bold"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* ROW 2: Segment Navigation (2 rows of 4 on mobile, 1 row of 8 on desktop) */}
        <nav className="w-full pt-1 border-t border-slate-800/80">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('scorer')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scorer'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Scorer</span>
            </button>

            <button
              onClick={() => setActiveTab('league')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'league'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>League</span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'finance'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Finances</span>
            </button>

            <button
              onClick={() => setActiveTab('draws')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'draws'
                  ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Draws</span>
            </button>

            <button
              onClick={() => setActiveTab('games')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'games'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Games</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'assignments'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Board Assignments</span>
            </button>

            <button
              onClick={() => setActiveTab('practice')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'practice'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Practice</span>
            </button>

            <button
              onClick={() => setActiveTab('players')}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'players'
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Players</span>
            </button>
          </div>

          {/* Sub-Bar for League Selection when Draws Tab is Active */}
          {activeTab === 'draws' && (
            <div className="pt-2 pb-0.5 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1 mr-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> League Draw:
              </span>
              <div className="inline-flex bg-slate-900/90 p-0.5 rounded-lg border border-amber-500/30 gap-1">
                <button
                  type="button"
                  onClick={() => onSelectDrawsLeague?.('tuesday')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    selectedDrawsLeague === 'tuesday'
                      ? 'bg-amber-500 text-slate-950 shadow ring-1 ring-amber-300'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🎯 Tuesday</span>
                  {selectedDrawsLeague === 'tuesday' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/30 text-amber-950 font-black">Active</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDrawsLeague?.('wednesday')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    selectedDrawsLeague === 'wednesday'
                      ? 'bg-amber-500 text-slate-950 shadow ring-1 ring-amber-300'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>👥 Wednesday</span>
                  {selectedDrawsLeague === 'wednesday' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/30 text-amber-950 font-black">Active</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectDrawsLeague?.('thursday')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    selectedDrawsLeague === 'thursday'
                      ? 'bg-amber-500 text-slate-950 shadow ring-1 ring-amber-300'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>🏆 Thursday</span>
                  {selectedDrawsLeague === 'thursday' && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/30 text-amber-950 font-black">Active</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </nav>

      </div>
    </header>
  );
};

