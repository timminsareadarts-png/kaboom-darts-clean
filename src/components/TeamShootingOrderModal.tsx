import React, { useState, useEffect } from 'react';
import { Player, TeamSubPlayer, MatchSettings } from '../types';
import { announcer } from '../utils/audio';
import { StarterDeterminationModal } from './StarterDeterminationModal';
import { Users, ArrowUpDown, Volume2, Sparkles, Check, ChevronUp, ChevronDown, Bot, Dices, X, ShieldAlert, Play, Target } from 'lucide-react';

interface TeamShootingOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueType: 'wednesday' | 'thursday' | 'tuesday';
  players: Player[];
  settings: MatchSettings;
  gameMode?: string;
  onConfirm: (updatedPlayers: Player[], updatedSettings: MatchSettings) => void;
}

export const TeamShootingOrderModal: React.FC<TeamShootingOrderModalProps> = ({
  isOpen,
  onClose,
  leagueType,
  players,
  settings,
  gameMode,
  onConfirm,
}) => {
  if (!isOpen || players.length < 2) return null;

  // Local state for each team's sub players
  const [team1Order, setTeam1Order] = useState<TeamSubPlayer[]>(() => {
    return players[0]?.teamPlayers && players[0].teamPlayers.length > 0
      ? [...players[0].teamPlayers]
      : [{ id: players[0]?.id || 'p1', name: players[0]?.name || 'Player 1', avatar: players[0]?.avatar || '🎯' }];
  });

  const [team2Order, setTeam2Order] = useState<TeamSubPlayer[]>(() => {
    return players[1]?.teamPlayers && players[1].teamPlayers.length > 0
      ? [...players[1].teamPlayers]
      : [{ id: players[1]?.id || 'p2', name: players[1]?.name || 'Player 2', avatar: players[1]?.avatar || '🎯' }];
  });

  const [firstTeamIndex, setFirstTeamIndex] = useState<number>(0);
  const [announceAudio, setAnnounceAudio] = useState<boolean>(settings.announceAudio ?? true);
  const [showStarterModal, setShowStarterModal] = useState<boolean>(false);
  const [coinTossResult, setCoinTossResult] = useState<string | null>(null);

  // Sync state whenever modal opens or players change
  useEffect(() => {
    if (players[0]?.teamPlayers && players[0].teamPlayers.length > 0) {
      setTeam1Order([...players[0].teamPlayers]);
    } else {
      setTeam1Order([{ id: players[0]?.id || 'p1', name: players[0]?.name || 'Player 1', avatar: players[0]?.avatar || '🎯' }]);
    }

    if (players[1]?.teamPlayers && players[1].teamPlayers.length > 0) {
      setTeam2Order([...players[1].teamPlayers]);
    } else {
      setTeam2Order([{ id: players[1]?.id || 'p2', name: players[1]?.name || 'Player 2', avatar: players[1]?.avatar || '🎯' }]);
    }

    setFirstTeamIndex(0);
    setAnnounceAudio(settings.announceAudio ?? true);
    setCoinTossResult(null);
  }, [players, settings, isOpen]);

  const movePlayer = (teamNum: 1 | 2, currentIndex: number, direction: 'up' | 'down') => {
    const list = teamNum === 1 ? [...team1Order] : [...team2Order];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIndex, 0, moved);

    if (teamNum === 1) {
      setTeam1Order(list);
    } else {
      setTeam2Order(list);
    }
  };

  const handleCoinToss = () => {
    const winner = Math.random() < 0.5 ? 0 : 1;
    setFirstTeamIndex(winner);
    const chosenName = winner === 0 ? (players[0].name || 'Team 1') : (players[1].name || 'Team 2');
    setCoinTossResult(`🪙 Coin Toss: ${chosenName} throws first!`);
    
    if (announceAudio) {
      announcer.speak(`${chosenName} won the toss and throws first.`);
    }

    setTimeout(() => {
      setCoinTossResult(null);
    }, 4000);
  };

  const handleConfirm = () => {
    // Generate updated players with new teamPlayers order
    const updatedPlayers: Player[] = players.map((p, idx) => {
      const order = idx === 0 ? team1Order : team2Order;
      
      // If it's a doubles match, we can optionally update team display name
      let updatedName = p.name;
      if (leagueType === 'thursday' && order.length === 2) {
        const real = order.filter(sp => !sp.isDummy).map(sp => sp.name).join(' & ');
        const hasDummy = order.some(sp => sp.isDummy);
        updatedName = hasDummy ? `${real} & Dummy` : real;
      }

      return {
        ...p,
        name: updatedName,
        teamPlayers: order,
        currentSubPlayerIndex: 0,
        dummyShooterIndices: {},
      };
    });

    // If team 2 was chosen to throw first, reorder the match players array or starterPlayerIndex
    const finalPlayers = firstTeamIndex === 1
      ? [updatedPlayers[1], updatedPlayers[0]]
      : updatedPlayers;

    const updatedSettings: MatchSettings = {
      ...settings,
      announceAudio,
      starterPlayerId: finalPlayers[0].id,
    };

    onConfirm(finalPlayers, updatedSettings);
  };

  const isWednesday = leagueType === 'wednesday';
  const isThursday = leagueType === 'thursday';
  const activeGameMode = (gameMode || settings.gameMode)?.toUpperCase();
  const isCricket = activeGameMode === 'CRICKET';
  const isFives = activeGameMode === 'FIVES';
  const modalTitle = isWednesday
    ? 'Set Shooting Order: Wednesday Teams'
    : isThursday
    ? 'Set Shooting Order: Thursday Doubles'
    : 'Set Team Shooting Order';

  const formatOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const handlePreviewAnnouncer = (subPlayer: TeamSubPlayer) => {
    if (subPlayer.isDummy) {
      if (isCricket) {
        announcer.speak(`In Cricket, the dummy sits out. Teammates rotate among themselves.`);
      } else if (isFives) {
        announcer.speak(`In Fives, teammates rotate shooting for the dummy, and also shoot on their regular turn called by their name alone.`);
      } else {
        announcer.speak(`Dummy player turn. Teammates will take turns shooting.`);
      }
    } else {
      announcer.speak(`${subPlayer.name} to throw.`);
    }
  };

  const renderTeamColumn = (
    teamNum: 1 | 2,
    teamName: string,
    order: TeamSubPlayer[]
  ) => {
    const realPlayers = order.filter(p => !p.isDummy);
    const hasDummy = order.some(p => p.isDummy);

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-inner">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 inline-block mb-1">
                {teamNum === 1 ? 'Home / Team 1' : 'Away / Team 2'}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 truncate">
                {teamName}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200">
              {order.length} {order.length === 1 ? 'Shooter' : 'Shooters'}
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Use arrows to arrange the exact shooting rotation from 1st to last thrower:
          </p>

          {isCricket && hasDummy && (
            <div className="mb-3 p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Cricket Rule:</strong> Dummy sits out. Real teammates rotate amongst themselves.
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {order.map((sub, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === order.length - 1;

              return (
                <div
                  key={`team-${teamNum}-shooter-${sub.id || idx}-${idx}`}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    sub.isDummy
                      ? isCricket
                        ? 'bg-slate-100/80 border-slate-300 opacity-60'
                        : 'bg-amber-50/80 border-amber-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                        sub.isDummy && isCricket
                          ? 'bg-slate-300 text-slate-600'
                          : idx === 0
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <span className="text-xl shrink-0">
                      {sub.isDummy ? '🤖' : (sub.avatar || '🎯')}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm text-slate-900 truncate">
                          {sub.name}
                        </span>
                        {sub.isDummy && (
                          <span className={`px-1.5 py-0.5 rounded font-black text-[10px] tracking-wide shrink-0 ${
                            isCricket ? 'bg-slate-200 text-slate-700 border border-slate-300' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {isCricket ? 'DUMMY (SITS OUT)' : 'DUMMY'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        {sub.isDummy && isCricket
                          ? 'Does not throw in Cricket (team rotates within themselves)'
                          : `${formatOrdinal(idx + 1)} Shooter ${idx === 0 ? '(Throws First)' : ''}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handlePreviewAnnouncer(sub)}
                      title="Preview Announcer Voice"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => movePlayer(teamNum, idx, 'up')}
                      title="Move Up"
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent rounded-lg border border-slate-200 transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => movePlayer(teamNum, idx, 'down')}
                      title="Move Down"
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent rounded-lg border border-slate-200 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dummy Player Teammate Rotation Notice */}
          {hasDummy && realPlayers.length > 0 && (
            <div className="mt-3 p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-900 text-xs">
              <div className="font-extrabold flex items-center gap-1.5 mb-1 text-amber-950">
                <Bot className="w-4 h-4 text-amber-700" />
                Dummy Player Rules & Rotation:
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900 space-y-1">
                <span>
                  • <strong>Fives:</strong> Teammates rotate shooting for the dummy on the dummy's turn. When a player shoots for the dummy, they also get to shoot when it's their regular turn, and are called by their name alone (not with shooting for dummy).
                </span>
                <span className="block">
                  • <strong>X01 / Baseball:</strong> When the dummy turn arrives, teammates shoot in sequential rotation:
                  <span className="block font-bold mt-0.5 ml-2">
                    {realPlayers.map((p, rIdx) => (
                      <span key={`rot-${teamNum}-${p.id || rIdx}-${rIdx}`}>
                        {rIdx > 0 ? ' → ' : ''}Shot #{rIdx + 1}: {p.name}
                      </span>
                    ))}
                    {realPlayers.length > 1 && ' (loops)'}
                  </span>
                </span>
                <span className="block">
                  • <strong>Cricket:</strong> There is no dummy turn — teams simply rotate continuously in their order without the dummy.
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                {isWednesday ? 'Wednesday 4-Person League' : isThursday ? 'Thursday Doubles League' : 'League Play'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black">{modalTitle}</h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Confirm the throwing order for each team before beginning. Each player's name will be called out individually by the voice announcer when it is their turn to shoot.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {coinTossResult && (
            <div className="p-3 bg-amber-500 text-white font-extrabold text-sm rounded-xl text-center shadow-md animate-bounce">
              {coinTossResult}
            </div>
          )}

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {renderTeamColumn(1, players[0]?.name || 'Team 1', team1Order)}
            {renderTeamColumn(2, players[1]?.name || 'Team 2', team2Order)}
          </div>

          {/* Match Starter Selection & Audio Options */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  Who Throws First (Game 1)?
                </label>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  Bull-Off or Coin Flip
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="starterTeam"
                    checked={firstTeamIndex === 0}
                    onChange={() => setFirstTeamIndex(0)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{players[0]?.name || 'Team 1'}</span>
                </label>

                <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="starterTeam"
                    checked={firstTeamIndex === 1}
                    onChange={() => setFirstTeamIndex(1)}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{players[1]?.name || 'Team 2'}</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowStarterModal(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <span>🪙 Flip Coin or Closest to Bull 🎯</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                <input
                  type="checkbox"
                  checked={announceAudio}
                  onChange={(e) => setAnnounceAudio(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <span>Voice Announcer Enabled</span>
              </label>
            </div>
          </div>
        </div>

        {/* Starter Determination Modal (Bull-Off & 3D Coin Flip) */}
        {showStarterModal && (
          <StarterDeterminationModal
            isOpen={showStarterModal}
            onClose={() => setShowStarterModal(false)}
            players={players}
            currentStarterIndex={firstTeamIndex}
            onSelectStarter={(idx) => {
              setFirstTeamIndex(idx);
              const starterName = players[idx]?.name || (idx === 0 ? 'Team 1' : 'Team 2');
              setCoinTossResult(`🎯 First thrower: ${starterName}`);
              setTimeout(() => setCoinTossResult(null), 4000);
            }}
          />
        )}

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors text-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-current" />
            Confirm Shooting Order & Begin Match
          </button>
        </div>
      </div>
    </div>
  );
};
