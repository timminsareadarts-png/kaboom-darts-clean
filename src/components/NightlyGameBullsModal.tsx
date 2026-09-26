import React, { useState, useMemo, useEffect } from 'react';
import { Target, CheckCircle2, ChevronRight, RotateCcw, Shield, Sparkles, UserCheck, Trash2, Calendar, AlertCircle, Volume2, VolumeX, BarChart3, Search, ArrowRight, UserPlus } from 'lucide-react';
import { NightlyBullsEntry, NightlyBullsSession } from '../types';
import {
  getNightlyBullsSessionForDate,
  getNightlyBullsSessions,
  recordIndividualNightlyBulls,
  deletePlayerNightlyBulls,
  getTuesdayGameStatsMap,
  getWednesdayGameStatsMap,
  getThursdayGameStatsMap,
  getSeasonBullsMap,
} from '../utils/leagueHelper';
import { announcer } from '../utils/audio';

interface RegisteredRosterPlayer {
  id?: string;
  name: string;
  avatar?: string;
  checkedIn?: boolean;
}

interface NightlyGameBullsModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  registeredPlayers: RegisteredRosterPlayer[];
  initialPlayerName?: string;
  onRecordUpdated?: () => void;
}

type TurnDarts = [number, number, number]; // 3 darts in a turn, each 0 (miss), 1 (single bull - 25), or 2 (double bull - 50)
type PlayerNineDarts = [TurnDarts, TurnDarts, TurnDarts]; // Turn 1, Turn 2, Turn 3

const createEmptyNineDarts = (): PlayerNineDarts => [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export const NightlyGameBullsModal: React.FC<NightlyGameBullsModalProps> = ({
  isOpen,
  onClose,
  leagueType,
  registeredPlayers,
  initialPlayerName,
  onRecordUpdated,
}) => {
  if (!isOpen) return null;

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [session, setSession] = useState<NightlyBullsSession>(() =>
    getNightlyBullsSessionForDate(leagueType, todayStr)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllRoster, setShowAllRoster] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'shooting' | 'running_totals'>('shooting');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Selected player for individual shooting
  const [selectedPlayer, setSelectedPlayer] = useState<RegisteredRosterPlayer | null>(null);
  const [nineDarts, setNineDarts] = useState<PlayerNineDarts>(createEmptyNineDarts());
  const [activeTurnIdx, setActiveTurnIdx] = useState<number>(0);

  // Refresh session when date or leagueType changes
  const reloadSession = (dateStr: string) => {
    const fresh = getNightlyBullsSessionForDate(leagueType, dateStr);
    setSession(fresh);
  };

  useEffect(() => {
    reloadSession(selectedDate);
  }, [selectedDate, leagueType]);

  // Read running totals map from storage for live accurate figures
  const runningBullsMap = useMemo(() => {
    if (leagueType === 'tuesday') {
      const stats = getTuesdayGameStatsMap();
      const map: Record<string, number> = {};
      Object.entries(stats).forEach(([k, v]) => {
        map[k] = v.seasonBullsHit || 0;
      });
      return map;
    } else if (leagueType === 'wednesday') {
      const stats = getWednesdayGameStatsMap();
      const map: Record<string, number> = {};
      Object.entries(stats).forEach(([k, v]) => {
        map[k] = v.seasonBullsHit || 0;
      });
      return map;
    } else {
      const stats = getThursdayGameStatsMap();
      const map: Record<string, number> = {};
      Object.entries(stats).forEach(([k, v]) => {
        map[k] = v.seasonBullsHit || 0;
      });
      return map;
    }
  }, [leagueType, session]);

  // Overall season bulls map as backup
  const seasonBullsMap = useMemo(() => getSeasonBullsMap(), [session]);

  const getPlayerRunningTotal = (playerName: string): number => {
    const key = playerName.toLowerCase().trim();
    const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
    return runningBullsMap[key] ?? runningBullsMap[cleanKey] ?? seasonBullsMap[key] ?? seasonBullsMap[cleanKey] ?? 0;
  };

  // Filter list of eligible players
  const eligiblePlayers = useMemo(() => {
    let list = registeredPlayers;
    if (!showAllRoster) {
      // By default, only players checked in for tonight
      const checkedInList = list.filter((p) => p.checkedIn);
      // If none are checked in yet, fallback to all roster so user is never blocked
      list = checkedInList.length > 0 ? checkedInList : list;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    return list;
  }, [registeredPlayers, showAllRoster, searchQuery]);

  // Calculate completion counts
  const checkedInCount = useMemo(() => {
    return registeredPlayers.filter((p) => p.checkedIn).length || registeredPlayers.length;
  }, [registeredPlayers]);

  const completedCount = useMemo(() => {
    if (!session?.entries) return 0;
    const targets = registeredPlayers.filter((p) => p.checkedIn);
    const targetList = targets.length > 0 ? targets : registeredPlayers;
    return targetList.filter((p) => {
      const key = p.name.toLowerCase().trim();
      const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
      return session.entries[key] !== undefined || session.entries[cleanKey] !== undefined;
    }).length;
  }, [session, registeredPlayers]);

  // Select initial player on mount
  useEffect(() => {
    if (selectedPlayer) return;

    if (initialPlayerName) {
      const match = registeredPlayers.find(
        (p) => p.name.toLowerCase().trim() === initialPlayerName.toLowerCase().trim()
      );
      if (match) {
        selectPlayer(match);
        return;
      }
    }

    // Default to first pending player who is checked in
    const firstPending = eligiblePlayers.find((p) => {
      const key = p.name.toLowerCase().trim();
      const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
      return !session.entries?.[key] && !session.entries?.[cleanKey];
    });

    if (firstPending) {
      selectPlayer(firstPending);
    } else if (eligiblePlayers.length > 0) {
      selectPlayer(eligiblePlayers[0]);
    }
  }, [eligiblePlayers, session, initialPlayerName]);

  // When player is selected, populate darts from tonight's session if already recorded
  const selectPlayer = (player: RegisteredRosterPlayer) => {
    setSelectedPlayer(player);
    setSaveSuccessMsg(null);
    const key = player.name.toLowerCase().trim();
    const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
    const existing = session.entries?.[key] || session.entries?.[cleanKey];

    if (existing?.dartsDetail) {
      setNineDarts(JSON.parse(JSON.stringify(existing.dartsDetail)));
    } else if (existing?.shots) {
      // Reconstruct turns from shots
      const reconstructed: PlayerNineDarts = createEmptyNineDarts();
      existing.shots.forEach((turnBulls, tIdx) => {
        let remaining = turnBulls;
        for (let d = 0; d < 3; d++) {
          if (remaining >= 2) {
            reconstructed[tIdx][d] = 2;
            remaining -= 2;
          } else if (remaining === 1) {
            reconstructed[tIdx][d] = 1;
            remaining -= 1;
          } else {
            reconstructed[tIdx][d] = 0;
          }
        }
      });
      setNineDarts(reconstructed);
    } else {
      setNineDarts(createEmptyNineDarts());
    }
    setActiveTurnIdx(0);
  };

  // Turn sums and total bulls for tonight
  const turnTotals = useMemo(() => {
    return [
      nineDarts[0].reduce((a, b) => a + b, 0),
      nineDarts[1].reduce((a, b) => a + b, 0),
      nineDarts[2].reduce((a, b) => a + b, 0),
    ] as [number, number, number];
  }, [nineDarts]);

  const totalTonightBulls = useMemo(() => {
    return turnTotals[0] + turnTotals[1] + turnTotals[2];
  }, [turnTotals]);

  // Check if active player is already recorded tonight
  const activePlayerExistingRecord = useMemo(() => {
    if (!selectedPlayer || !session?.entries) return null;
    const key = selectedPlayer.name.toLowerCase().trim();
    const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
    return session.entries[key] || session.entries[cleanKey] || null;
  }, [selectedPlayer, session]);

  // Handle dart toggle: 0 -> 1 -> 2 -> 0
  const handleDartCycle = (turnIdx: number, dartIdx: number) => {
    setNineDarts((prev) => {
      const copy: PlayerNineDarts = [
        [...prev[0]] as TurnDarts,
        [...prev[1]] as TurnDarts,
        [...prev[2]] as TurnDarts,
      ];
      const current = copy[turnIdx][dartIdx];
      const nextVal = current === 0 ? 1 : current === 1 ? 2 : 0;
      copy[turnIdx][dartIdx] = nextVal;
      return copy;
    });
  };

  // Handle direct preset setting for a turn
  const handleSetTurnBulls = (turnIdx: number, bulls: number) => {
    setNineDarts((prev) => {
      const copy: PlayerNineDarts = [
        [...prev[0]] as TurnDarts,
        [...prev[1]] as TurnDarts,
        [...prev[2]] as TurnDarts,
      ];
      let remaining = Math.min(6, Math.max(0, bulls));
      for (let d = 0; d < 3; d++) {
        if (remaining >= 2) {
          copy[turnIdx][d] = 2;
          remaining -= 2;
        } else if (remaining === 1) {
          copy[turnIdx][d] = 1;
          remaining -= 1;
        } else {
          copy[turnIdx][d] = 0;
        }
      }
      return copy;
    });

    if (soundEnabled && bulls > 0) {
      if (bulls >= 5) {
        announcer.speak(`${bulls} Bulls! Outstanding!`);
      } else {
        announcer.speak(`${bulls} Bull${bulls > 1 ? 's' : ''}`);
      }
    }
  };

  // Save record for active player
  const handleSaveActivePlayer = () => {
    if (!selectedPlayer) return;

    const entry: NightlyBullsEntry = {
      playerId: selectedPlayer.id || `p-${Date.now()}`,
      playerName: selectedPlayer.name,
      avatar: selectedPlayer.avatar || '🎯',
      bullsHit: totalTonightBulls,
      shots: turnTotals,
      dartsDetail: nineDarts,
      timestamp: Date.now(),
    };

    const res = recordIndividualNightlyBulls(leagueType, entry, selectedDate);
    reloadSession(selectedDate);
    onRecordUpdated?.();

    if (soundEnabled) {
      if (totalTonightBulls === 0) {
        announcer.speak(`${selectedPlayer.name}, no bulls tonight. Running total is ${res.newTotal}.`);
      } else if (totalTonightBulls >= 10) {
        announcer.speak(`Incredible shooting! ${selectedPlayer.name} hits ${totalTonightBulls} bulls! New running total: ${res.newTotal}!`);
      } else {
        announcer.speak(`${selectedPlayer.name}, ${totalTonightBulls} bulls! Running total is ${res.newTotal}.`);
      }
    }

    setSaveSuccessMsg(
      `✓ Recorded ${totalTonightBulls} bulls for ${selectedPlayer.name}! Running total is now ${res.newTotal} 🎯`
    );

    // Auto-advance to next pending player if available
    const nextPending = eligiblePlayers.find((p) => {
      if (p.name.toLowerCase().trim() === selectedPlayer.name.toLowerCase().trim()) return false;
      const key = p.name.toLowerCase().trim();
      const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
      return !session.entries?.[key] && !session.entries?.[cleanKey];
    });

    if (nextPending) {
      setTimeout(() => {
        selectPlayer(nextPending);
      }, 1200);
    }
  };

  // Clear/delete entry for active player tonight
  const handleDeleteActivePlayerEntry = () => {
    if (!selectedPlayer) return;
    deletePlayerNightlyBulls(leagueType, selectedPlayer.name, selectedDate);
    reloadSession(selectedDate);
    setNineDarts(createEmptyNineDarts());
    setSaveSuccessMsg(`Removed tonight's entry for ${selectedPlayer.name}. Running total restored.`);
    onRecordUpdated?.();
  };

  const dayTitle = leagueType === 'thursday' ? 'Thursday' : leagueType === 'wednesday' ? 'Wednesday' : 'Tuesday';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white font-black">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{dayTitle} Night Game Bulls</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Individual Challenge
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Each player registered tonight shoots 9 darts once. Stats maintain a running total of bulls hit each {dayTitle} night.
              </p>
            </div>
          </div>

          {/* Right Controls: Date Selector, Sound & Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Announcer sound on' : 'Announcer sound muted'}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* PROGRESS & NAVIGATION TABS */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Progress Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Tonight's Attendance:</span>
            <div className="flex items-center gap-2">
              <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-rose-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${checkedInCount > 0 ? (completedCount / checkedInCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="font-black text-white">
                {completedCount} <span className="text-slate-400 font-normal">of</span> {checkedInCount} Recorded
              </span>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('shooting')}
              className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'shooting'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>9-Dart Challenge</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('running_totals')}
              className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'running_totals'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Nightly Running Totals</span>
            </button>
          </div>
        </div>

        {/* NOTIFICATION BANNER */}
        {saveSuccessMsg && (
          <div className="px-5 py-2 bg-emerald-950/40 border-b border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {saveSuccessMsg}
            </span>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'shooting' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT COLUMN: REGISTERED PLAYERS LIST */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 tracking-wider">
                    <UserCheck className="w-4 h-4 text-rose-400" />
                    <span>Registered Darters Tonight</span>
                    <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                      {eligiblePlayers.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllRoster(!showAllRoster)}
                    className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    {showAllRoster ? 'Show Checked-In Only' : 'Show All Roster'}
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search player name..."
                    className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Players Scroll Area */}
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {eligiblePlayers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      No players match your search filter.
                    </div>
                  ) : (
                    eligiblePlayers.map((player) => {
                      const key = player.name.toLowerCase().trim();
                      const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
                      const recordedEntry = session.entries?.[key] || session.entries?.[cleanKey];
                      const isRecorded = recordedEntry !== undefined;
                      const isSelected = selectedPlayer?.name.toLowerCase().trim() === key;
                      const runningTotal = getPlayerRunningTotal(player.name);

                      return (
                        <div
                          key={player.name}
                          onClick={() => selectPlayer(player)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                              : isRecorded
                              ? 'bg-slate-800/60 hover:bg-slate-800 border-emerald-500/30'
                              : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl shrink-0">{player.avatar || '🎯'}</span>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                                <span>{player.name}</span>
                                {player.checkedIn && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="Checked in tonight" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Running Total: <strong className="text-amber-400 font-mono">{runningTotal}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 text-right">
                            {isRecorded ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>{recordedEntry.bullsHit} Bulls</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                <span>Pending</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: 9-DART INDIVIDUAL SHOOTING ARENA */}
              <div className="lg:col-span-7 bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-5">
                {selectedPlayer ? (
                  <>
                    {/* Active Player Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/70">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl p-1 bg-slate-800 rounded-xl border border-slate-700">
                          {selectedPlayer.avatar || '🎯'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-white tracking-tight">
                              {selectedPlayer.name}
                            </h3>
                            {activePlayerExistingRecord && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Recorded Tonight: {activePlayerExistingRecord.bullsHit} Bulls
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            Shooting 9 individual darts for tonight's running stats.
                          </p>
                        </div>
                      </div>

                      {/* Stat Metrics Box */}
                      <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
                        <div className="text-center px-2">
                          <div className="text-[10px] uppercase font-bold text-slate-400">Previous Total</div>
                          <div className="text-sm font-black text-slate-200 font-mono">
                            {getPlayerRunningTotal(selectedPlayer.name)} 🎯
                          </div>
                        </div>
                        <div className="text-slate-600 font-bold">+</div>
                        <div className="text-center px-2">
                          <div className="text-[10px] uppercase font-bold text-rose-400">Tonight's Bulls</div>
                          <div className="text-sm font-black text-rose-400 font-mono">
                            {totalTonightBulls} 🎯
                          </div>
                        </div>
                        <div className="text-slate-600 font-bold">=</div>
                        <div className="text-center px-2">
                          <div className="text-[10px] uppercase font-bold text-emerald-400">New Running Total</div>
                          <div className="text-sm font-black text-emerald-400 font-mono">
                            {activePlayerExistingRecord
                              ? getPlayerRunningTotal(selectedPlayer.name) - activePlayerExistingRecord.bullsHit + totalTonightBulls
                              : getPlayerRunningTotal(selectedPlayer.name) + totalTonightBulls} 🎯
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3 TURNS / 9 DARTS INTERACTIVE MATRIX */}
                    <div className="space-y-4">
                      {[0, 1, 2].map((turnIdx) => {
                        const tBulls = turnTotals[turnIdx];
                        return (
                          <div
                            key={turnIdx}
                            className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3.5 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-extrabold text-xs rounded-md border border-rose-500/30 font-mono">
                                  Turn {turnIdx + 1}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                  (3 Darts • Turn Total: <strong className="text-white font-mono">{tBulls}</strong> Bulls)
                                </span>
                              </div>

                              {/* Quick Presets for this turn */}
                              <div className="flex items-center gap-1">
                                {[0, 1, 2, 3, 4, 5, 6].map((num) => (
                                  <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleSetTurnBulls(turnIdx, num)}
                                    className={`w-6 h-6 rounded text-xs font-bold transition-all cursor-pointer ${
                                      tBulls === num
                                        ? 'bg-rose-500 text-white shadow-sm font-black'
                                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Darts Detail Row */}
                            <div className="grid grid-cols-3 gap-2">
                              {[0, 1, 2].map((dartIdx) => {
                                const val = nineDarts[turnIdx][dartIdx];
                                return (
                                  <button
                                    key={dartIdx}
                                    type="button"
                                    onClick={() => handleDartCycle(turnIdx, dartIdx)}
                                    className={`py-2 px-3 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                                      val === 2
                                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                                        : val === 1
                                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black shadow-md'
                                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-white'
                                    }`}
                                  >
                                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                                      Dart {dartIdx + 1}
                                    </span>
                                    <span className="text-sm font-black">
                                      {val === 2 ? 'Double Bull (50)' : val === 1 ? 'Single Bull (25)' : 'Miss / Outer (0)'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ACTIONS BAR */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNineDarts(createEmptyNineDarts())}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Darts</span>
                        </button>

                        {activePlayerExistingRecord && (
                          <button
                            type="button"
                            onClick={handleDeleteActivePlayerEntry}
                            className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 font-bold text-xs rounded-xl border border-red-800/50 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Clear Tonight's Score</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveActivePlayer}
                          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-sm rounded-xl shadow-lg shadow-rose-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                        >
                          <Target className="w-4 h-4 text-amber-200" />
                          <span>
                            {activePlayerExistingRecord
                              ? `Update Score (${totalTonightBulls} Bulls)`
                              : `Record Bulls (${totalTonightBulls} Bulls)`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-500 space-y-2">
                    <Target className="w-10 h-10 mx-auto text-slate-600" />
                    <div className="font-bold text-slate-400">Select a player from the left to record their 9 darts</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB 2: NIGHTLY RUNNING TOTALS LEADERBOARD */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-rose-400" />
                    <span>{dayTitle} Night Bulls • Running Totals & Session Log</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Showing official running total of bulls hit on {dayTitle} nights for registered players.
                  </p>
                </div>
                <div className="text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span>Date: <strong>{session.displayDate || selectedDate}</strong></span>
                </div>
              </div>

              <div className="border border-slate-700/80 rounded-xl overflow-hidden bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase font-black tracking-wider border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Player</th>
                      <th className="py-3 px-4 text-center">Tonight's Bulls</th>
                      <th className="py-3 px-4 text-center">Turn Breakdown</th>
                      <th className="py-3 px-4 text-center">Season Running Total</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {registeredPlayers.map((player, idx) => {
                      const key = player.name.toLowerCase().trim();
                      const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
                      const entry = session.entries?.[key] || session.entries?.[cleanKey];
                      const runningTotal = getPlayerRunningTotal(player.name);

                      return (
                        <tr key={player.name} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 font-bold text-white">
                              <span>{player.avatar || '🎯'}</span>
                              <span>{player.name}</span>
                              {player.checkedIn && (
                                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 text-[10px] rounded font-semibold">
                                  Checked In
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {entry !== undefined ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-black font-mono text-xs">
                                {entry.bullsHit} 🎯
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Not shot yet</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {entry?.shots ? (
                              <span>T1: {entry.shots[0]} • T2: {entry.shots[1]} • T3: {entry.shots[2]}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-mono font-black text-amber-400 text-sm">
                              {runningTotal} 🎯
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                selectPlayer(player);
                                setActiveTab('shooting');
                              }}
                              className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              {entry !== undefined ? 'Edit Darts' : 'Shoot Bulls'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Running bulls totals sync automatically to standings and cloud storage.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
