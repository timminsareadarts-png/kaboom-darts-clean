import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, Check, X, Target, Calendar, Users, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resetLeagueSeason } from '../services/cloudSync';
import {
  getAutoEmailOverallStatsEnabled,
  dispatchOverallPlayerStatsEmail,
} from '../utils/overallStatsEmailHelper';

export type ResetLeagueType = 'tuesday' | 'wednesday' | 'thursday' | 'all';

interface SeasonResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialLeague?: ResetLeagueType;
}

const LEAGUE_CONFIG: Record<
  ResetLeagueType,
  {
    name: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    description: string;
    resets: string[];
    preserves: string[];
  }
> = {
  tuesday: {
    name: 'Tuesday Singles',
    subtitle: 'Solo Division',
    icon: Target,
    accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    description: 'Resets all Tuesday Singles League match records, 501/301 game stats, and standings for a fresh season.',
    resets: [
      'Tuesday Singles Standings (Points, Legs, Played, Won back to 0)',
      'Tuesday Game 501 & Game 301 individual game win counts & stats',
      'Tuesday tournament brackets & attendance lists',
    ],
    preserves: [
      'Master Player Roster, Avatars & PINs',
      'Wednesday Teams League records & bulls',
      'Thursday Doubles League records & stats',
    ],
  },
  wednesday: {
    name: 'Wednesday Teams',
    subtitle: '4-Player Team Division',
    icon: Calendar,
    accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
    description: 'Resets all Wednesday Teams League records, 1001/701/Cricket/Baseball/Fives stats, Season Bulls, and standings.',
    resets: [
      'Wednesday Standings (Points, Legs, Played, Won back to 0)',
      'Wednesday individual game wins (1001, 701, Cricket, Baseball, 5s)',
      'Wednesday Season Bulls hit counts',
      'Wednesday team shooting orders & tournament brackets',
    ],
    preserves: [
      'Master Player Roster, Avatars & PINs',
      'Tuesday Singles League records & stats',
      'Thursday Doubles League records & stats',
    ],
  },
  thursday: {
    name: 'Thursday Doubles',
    subtitle: 'Pair Division',
    icon: Users,
    accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    description: 'Resets all Thursday Doubles League match records, 501/301/Cricket stats, and standings for a fresh season.',
    resets: [
      'Thursday Doubles Standings (Points, Legs, Played, Won back to 0)',
      'Thursday Game 501, 301 & Cricket individual win counts & stats',
      'Thursday tournament brackets & attendance lists',
    ],
    preserves: [
      'Master Player Roster, Avatars & PINs',
      'Tuesday Singles League records & stats',
      'Wednesday Teams League records & stats',
    ],
  },
  all: {
    name: 'All Leagues',
    subtitle: 'Complete Reset',
    icon: Trophy,
    accentColor: 'text-rose-600 bg-rose-50 border-rose-200',
    description: 'Complete season reset across Tuesday, Wednesday, and Thursday leagues simultaneously.',
    resets: [
      'All standings for Tuesday Singles, Wednesday Teams, and Thursday Doubles',
      'All individual game statistics (1001, 701, 501, 301, Cricket, Baseball, 5s)',
      'All 3-dart averages, high finishes, 180 counts, and season bulls',
      'All active tournament brackets and attendance rosters',
    ],
    preserves: [
      'Master Player Roster, Avatars & PINs (No players need to be re-entered)',
    ],
  },
};

export const SeasonResetModal: React.FC<SeasonResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialLeague = 'all',
}) => {
  const { isAdmin } = useAuth();
  const [selectedLeague, setSelectedLeague] = useState<ResetLeagueType>(initialLeague);
  const [isResetting, setIsResetting] = useState(false);
  const [resetCompleted, setResetCompleted] = useState(false);
  const [completedLeagueName, setCompletedLeagueName] = useState('');
  const [confirmInput, setConfirmInput] = useState('');

  // Sync initialLeague when modal opens or prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedLeague(initialLeague || 'all');
      setConfirmInput('');
      setResetCompleted(false);
    }
  }, [isOpen, initialLeague]);

  // Strictly forbidden for non-admins
  if (!isOpen || !isAdmin) return null;

  const currentConfig = LEAGUE_CONFIG[selectedLeague];

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      // If auto-email is enabled, email fully detailed overall stats to surgedarts@gmail.com before reset
      if (getAutoEmailOverallStatsEnabled()) {
        try {
          await dispatchOverallPlayerStatsEmail({ triggerType: 'automatic' });
        } catch (emailErr) {
          console.error('[AutoEmail] Failed to dispatch overall player stats prior to season reset:', emailErr);
        }
      }

      await resetLeagueSeason(selectedLeague);
      setCompletedLeagueName(currentConfig.name);
      setResetCompleted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setResetCompleted(false);
        setConfirmInput('');
        onClose();
      }, 1600);
    } catch (e) {
      console.error('Failed to reset league season', e);
      alert('An error occurred resetting the league season. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleClose = () => {
    if (isResetting) return;
    setConfirmInput('');
    setResetCompleted(false);
    onClose();
  };

  return (
    <div
      id="season-reset-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div
        id="season-reset-modal-content"
        className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up"
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center border border-white/25 shadow-inner">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-800/80 rounded text-[10px] font-black uppercase tracking-wider text-rose-100 mb-1">
                <ShieldCheck className="w-3 h-3" /> Admin Security Control
              </div>
              <h2 className="text-lg font-black tracking-tight leading-tight">
                Reset Season • Start New League
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isResetting}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {resetCompleted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                New {completedLeagueName} Season Ready!
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Statistics, standings, and game records for {completedLeagueName} have been reset to zero. The player roster remains intact.
              </p>
            </div>
          ) : (
            <>
              {/* League Selector Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select League to Reset:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(['tuesday', 'wednesday', 'thursday', 'all'] as ResetLeagueType[]).map((type) => {
                    const cfg = LEAGUE_CONFIG[type];
                    const Icon = cfg.icon;
                    const isSelected = selectedLeague === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSelectedLeague(type)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-rose-600' : 'text-slate-400'}`} />
                        <span className="leading-tight text-center">{cfg.name.split(' ')[0]}</span>
                        <span className="text-[10px] font-normal opacity-70 leading-tight">
                          {cfg.name.split(' ')[1] || 'Season'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notice Banner */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Resetting: {currentConfig.name}</strong>
                  <p className="mt-0.5 text-amber-800">{currentConfig.description}</p>
                </div>
              </div>

              {/* What Happens Checklist */}
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  What will be updated:
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <span className="text-emerald-600 font-black">✓</span>
                    <span>Preserved & Protected:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-800 pl-1 text-[11px]">
                    {currentConfig.preserves.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <span className="text-rose-600 font-black">🔄</span>
                    <span>Reset to Zero for Week 1:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-800 pl-1 text-[11px]">
                    {currentConfig.resets.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Safety Confirmation Input */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Type <span className="font-mono font-bold text-red-600">RESET</span> to confirm {currentConfig.name} reset:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
                  placeholder="RESET"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:border-red-500 focus:bg-white outline-none transition-colors"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={confirmInput !== 'RESET' || isResetting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-md hover:shadow-lg disabled:shadow-none flex items-center gap-2 transition-all active:scale-95 disabled:pointer-events-none cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  {isResetting
                    ? `Resetting ${currentConfig.name}...`
                    : `Confirm Reset: ${currentConfig.name}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface AdminSeasonResetButtonProps {
  className?: string;
  variant?: 'primary' | 'compact' | 'danger' | 'ghost' | 'secondary';
  league?: ResetLeagueType;
  label?: string;
  onSuccess?: () => void;
}

/**
 * AdminSeasonResetButton:
 * A button visible ONLY to administrators (hidden for players and spectators).
 * Opens the SeasonResetModal to start a new season and reset stats for a specific league or all leagues.
 */
export const AdminSeasonResetButton: React.FC<AdminSeasonResetButtonProps> = ({
  className = '',
  variant = 'primary',
  league = 'all',
  label,
  onSuccess,
}) => {
  const { isAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  // Hidden completely for players and spectators
  if (!isAdmin) return null;

  const defaultLabel =
    league === 'tuesday'
      ? 'Reset Tuesday Season'
      : league === 'wednesday'
      ? 'Reset Wednesday Season'
      : league === 'thursday'
      ? 'Reset Thursday Season'
      : 'Start New Season';

  const buttonText = label || defaultLabel;

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`Admin: Reset ${LEAGUE_CONFIG[league]?.name || 'league'} stats for a new season`}
          className={`px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${className}`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
          <span>{buttonText}</span>
        </button>
        <SeasonResetModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={onSuccess}
          initialLeague={league}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title={`Admin: Reset ${LEAGUE_CONFIG[league]?.name || 'league'} stats for a new season`}
        className={`px-3.5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 transition-all active:scale-95 cursor-pointer shrink-0 ${className}`}
      >
        <RefreshCw className="w-4 h-4 text-white" />
        <span>{buttonText}</span>
      </button>
      <SeasonResetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={onSuccess}
        initialLeague={league}
      />
    </>
  );
};
