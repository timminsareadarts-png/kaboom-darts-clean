import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MatchState, BullsRoundPlayerRecord } from '../types';
import { getSeasonBullsMap, recordBullsRoundResults } from '../utils/leagueHelper';
import { Target, Flame, CheckCircle2, ChevronRight, Award, RotateCcw, ChevronLeft, ArrowRight, UserCheck, Shield, Sparkles, Undo2, Edit3, XCircle, ChevronUp } from 'lucide-react';
import { announcer } from '../utils/audio';

interface BullsRoundModalProps {
  isOpen: boolean;
  matchState: MatchState;
  onSaveAndComplete: (finalMatchState: MatchState, bullsRecords: BullsRoundPlayerRecord[]) => void;
  onClose?: () => void;
}

interface ShooterItem {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  avatar: string;
  teamKey: 'teamA' | 'teamB';
  orderIndex: number;
}

type TurnDarts = [number, number, number]; // 3 darts in a turn, each 0, 1, or 2 bulls
type PlayerNineDarts = [TurnDarts, TurnDarts, TurnDarts]; // Turn 1, Turn 2, Turn 3

const createEmptyNineDarts = (): PlayerNineDarts => [
  [0, 0, 0], // Turn 1 (Dart 1, 2, 3)
  [0, 0, 0], // Turn 2 (Dart 1, 2, 3)
  [0, 0, 0], // Turn 3 (Dart 1, 2, 3)
];

export const BullsRoundModal: React.FC<BullsRoundModalProps> = ({
  isOpen,
  matchState,
  onSaveAndComplete,
  onClose,
}) => {
  if (!isOpen) return null;

  const teamA = matchState.players[0];
  const teamB = matchState.players[1];

  // Helper to extract real human players from team
  const getRealPlayers = (player: typeof teamA, teamKey: 'teamA' | 'teamB'): ShooterItem[] => {
    if (!player) return [];
    if (player.teamPlayers && player.teamPlayers.length > 0) {
      const filtered = player.teamPlayers.filter(
        (p) => !p.isDummy && !p.name?.toLowerCase().includes('dummy')
      );
      if (filtered.length > 0) {
        return filtered.map((p, idx) => {
          const rawId = p.id || `${idx}`;
          const scopedId = rawId.startsWith(player.id || teamKey) ? rawId : `${player.id || teamKey}_${rawId}`;
          return {
            id: scopedId,
            name: p.name.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim() || p.name,
            teamId: player.id,
            teamName: player.name,
            avatar: p.avatar || '🎯',
            teamKey,
            orderIndex: idx,
          };
        });
      }
    }
    const baseId = player.id || (teamKey === 'teamA' ? 'p1' : 'p2');
    return [
      {
        id: baseId,
        name: player.name.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim() || player.name,
        teamId: player.id,
        teamName: player.name,
        avatar: player.avatar || '🎯',
        teamKey,
        orderIndex: 0,
      },
    ];
  };

  const teamAPlayers: ShooterItem[] = useMemo(() => getRealPlayers(teamA, 'teamA'), [teamA]);
  const teamBPlayers: ShooterItem[] = useMemo(() => getRealPlayers(teamB, 'teamB'), [teamB]);

  // Scheduled shooters rotation: Team A Shooter 1 -> Team B Shooter 1 -> Team A Shooter 2 -> Team B Shooter 2...
  const scheduledShooters: ShooterItem[] = useMemo(() => {
    const list: ShooterItem[] = [];
    const maxLen = Math.max(teamAPlayers.length, teamBPlayers.length);
    for (let i = 0; i < maxLen; i++) {
      if (teamAPlayers[i]) list.push(teamAPlayers[i]);
      if (teamBPlayers[i]) list.push(teamBPlayers[i]);
    }
    return list;
  }, [teamAPlayers, teamBPlayers]);

  // History stack of recorded shooter IDs for undo
  const [historyStack, setHistoryStack] = useState<string[]>([]);

  // Season bulls baseline map
  const seasonBullsMap = useMemo(() => getSeasonBullsMap(), []);

  // Records map: playerId -> [ [dart1, dart2, dart3], [dart1, dart2, dart3], [dart1, dart2, dart3] ]
  const [recordedPlayerDarts, setRecordedPlayerDarts] = useState<Record<string, PlayerNineDarts>>({});
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);

  // Active 9 darts for current shooter: Turn 1, Turn 2, Turn 3
  const [activeDarts, setActiveDarts] = useState<PlayerNineDarts>(createEmptyNineDarts());
  const [activeShooterId, setActiveShooterId] = useState<string>(
    scheduledShooters[0]?.id || ''
  );

  // Mode: when true, all players are finished and we show the match end / review screen (locking input)
  const [isMatchCompleteReview, setIsMatchCompleteReview] = useState<boolean>(false);

  // Scroll container ref & top button state for tablet/mobile viewport navigation
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Auto scroll to top when active shooter changes or switching to review screen
  useEffect(() => {
    modalContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeShooterId, isMatchCompleteReview]);

  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 150);
  };

  const scrollToTop = () => {
    modalContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const lastAnnouncedShooterId = useRef<string | null>(null);

  // Current active shooter object
  const currentShooter = useMemo(() => {
    return (
      scheduledShooters.find((s) => s.id === activeShooterId) ||
      scheduledShooters[currentTurnIndex] ||
      scheduledShooters[0]
    );
  }, [scheduledShooters, activeShooterId, currentTurnIndex]);

  // Up next shooter object in rotation
  const nextShooter = useMemo(() => {
    const currIdx = scheduledShooters.findIndex((s) => s.id === currentShooter?.id);
    if (currIdx >= 0 && currIdx + 1 < scheduledShooters.length) {
      return scheduledShooters[currIdx + 1];
    }
    // Check if any unrecorded player remains
    return scheduledShooters.find((s) => s.id !== currentShooter?.id && !recordedPlayerDarts[s.id]);
  }, [scheduledShooters, currentShooter, recordedPlayerDarts]);

  // Announce active shooter on turn change (only during active entry, not complete review)
  useEffect(() => {
    if (!matchState.settings.announceAudio || !currentShooter || isMatchCompleteReview) return;
    if (lastAnnouncedShooterId.current === currentShooter.id) return;
    lastAnnouncedShooterId.current = currentShooter.id;

    const timer = setTimeout(() => {
      announcer.speak?.(
        `${currentShooter.name}, up for Bulls! 9 darts across 3 turns.`
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [currentShooter?.id, matchState.settings.announceAudio, isMatchCompleteReview]);

  // Calculate totals for active shooter
  const turn1Total = activeDarts[0][0] + activeDarts[0][1] + activeDarts[0][2];
  const turn2Total = activeDarts[1][0] + activeDarts[1][1] + activeDarts[1][2];
  const turn3Total = activeDarts[2][0] + activeDarts[2][1] + activeDarts[2][2];
  const activeShooterTotalBulls = turn1Total + turn2Total + turn3Total;

  // Calculate overall progress
  const totalTurns = scheduledShooters.length;
  const completedCount = Object.keys(recordedPlayerDarts).length;
  const isAllCompleted = totalTurns > 0 && completedCount >= totalTurns;

  const calculatePlayerTotalBulls = (darts?: PlayerNineDarts): number => {
    if (!darts) return 0;
    return (
      darts[0][0] + darts[0][1] + darts[0][2] +
      darts[1][0] + darts[1][1] + darts[1][2] +
      darts[2][0] + darts[2][1] + darts[2][2]
    );
  };

  const teamATotalBulls = teamAPlayers.reduce((sum, p) => {
    const darts = recordedPlayerDarts[p.id];
    return sum + calculatePlayerTotalBulls(darts);
  }, 0);

  const teamBTotalBulls = teamBPlayers.reduce((sum, p) => {
    const darts = recordedPlayerDarts[p.id];
    return sum + calculatePlayerTotalBulls(darts);
  }, 0);

  const leagueTitle = useMemo(() => {
    const lType = matchState.settings.leagueType;
    if (lType === 'tuesday') return 'Tuesday Singles League • Bulls Round';
    if (lType === 'thursday') return 'Thursday Doubles League • Bulls Round';
    if (lType === 'wednesday') return 'Wednesday Teams League • Bulls Round';
    if (matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY') {
      return 'Medley Match • Bulls Round';
    }
    return 'Bulls Round Challenge';
  }, [matchState.settings.leagueType, matchState.settings.isMedley, matchState.settings.gameMode]);

  // Update a single dart score within Turn 0, 1, or 2 (Dart 0, 1, or 2)
  const handleUpdateDart = (turnIdx: 0 | 1 | 2, dartIdx: 0 | 1 | 2, bullsValue: number) => {
    const clamped = Math.max(0, Math.min(2, bullsValue));
    setActiveDarts((prev) => {
      const copy: PlayerNineDarts = [
        [prev[0][0], prev[0][1], prev[0][2]],
        [prev[1][0], prev[1][1], prev[1][2]],
        [prev[2][0], prev[2][1], prev[2][2]],
      ];
      copy[turnIdx][dartIdx] = clamped;
      return copy;
    });
  };

  // Record 9 darts (3 separate shots) for current player & advance or conclude
  const handleRecordTurnAndAdvance = () => {
    if (!currentShooter) return;

    const shooterId = currentShooter.id;
    const totalBulls = activeShooterTotalBulls;

    const updatedRecorded = {
      ...recordedPlayerDarts,
      [shooterId]: activeDarts,
    };
    setRecordedPlayerDarts(updatedRecorded);
    setHistoryStack((prev) => [...prev.filter((id) => id !== shooterId), shooterId]);

    // Audio announcement of score
    if (matchState.settings.announceAudio) {
      if (totalBulls >= 12) {
        announcer.speak?.(`Incredible! ${currentShooter.name} hit ${totalBulls} Bulls in 9 darts!`);
      } else if (totalBulls >= 6) {
        announcer.speak?.(`Great shooting! ${currentShooter.name}, ${totalBulls} Bulls!`);
      } else if (totalBulls > 0) {
        announcer.speak?.(`${currentShooter.name}, ${totalBulls} ${totalBulls === 1 ? 'Bull' : 'Bulls'}.`);
      } else {
        announcer.speak?.(`${currentShooter.name}, 0 Bulls.`);
      }
    }

    // Check if all players have now completed their turns
    const allCompletedNow = scheduledShooters.every((s) => updatedRecorded[s.id] !== undefined);

    if (allCompletedNow) {
      // DO NOT let the last player play again - lock into Match Complete Review!
      setIsMatchCompleteReview(true);
      return;
    }

    // Determine next unrecorded shooter in rotation
    const currIdx = scheduledShooters.findIndex((s) => s.id === shooterId);
    const nextIdx = currIdx + 1;

    if (nextIdx < scheduledShooters.length) {
      const nextS = scheduledShooters[nextIdx];
      setCurrentTurnIndex(nextIdx);
      setActiveShooterId(nextS.id);
      setActiveDarts(updatedRecorded[nextS.id] || createEmptyNineDarts());
    } else {
      // Find first unrecorded shooter
      const unrecorded = scheduledShooters.find((s) => updatedRecorded[s.id] === undefined);
      if (unrecorded) {
        const unrecIdx = scheduledShooters.findIndex((s) => s.id === unrecorded.id);
        setCurrentTurnIndex(unrecIdx >= 0 ? unrecIdx : 0);
        setActiveShooterId(unrecorded.id);
        setActiveDarts(createEmptyNineDarts());
      } else {
        setIsMatchCompleteReview(true);
      }
    }
  };

  // Undo last recorded turn / shot
  const handleUndoLastTurn = () => {
    if (historyStack.length === 0) return;

    const lastShooterId = historyStack[historyStack.length - 1];
    const newStack = historyStack.slice(0, -1);
    setHistoryStack(newStack);

    // Load that player's existing darts so they can be adjusted/re-submitted
    const savedDarts = recordedPlayerDarts[lastShooterId] || createEmptyNineDarts();
    setActiveShooterId(lastShooterId);
    const idx = scheduledShooters.findIndex((s) => s.id === lastShooterId);
    if (idx >= 0) setCurrentTurnIndex(idx);
    setActiveDarts([
      [savedDarts[0][0], savedDarts[0][1], savedDarts[0][2]],
      [savedDarts[1][0], savedDarts[1][1], savedDarts[1][2]],
      [savedDarts[2][0], savedDarts[2][1], savedDarts[2][2]],
    ]);

    // Remove from recorded map so they can be re-recorded
    const updatedRecorded = { ...recordedPlayerDarts };
    delete updatedRecorded[lastShooterId];
    setRecordedPlayerDarts(updatedRecorded);

    // Exit complete review mode if active
    setIsMatchCompleteReview(false);
  };

  // Direct selection from roster or dropdown to edit shot selection
  const handleSelectShooterToEdit = (shooterId: string) => {
    setActiveShooterId(shooterId);
    const idx = scheduledShooters.findIndex((s) => s.id === shooterId);
    if (idx >= 0) setCurrentTurnIndex(idx);
    if (recordedPlayerDarts[shooterId]) {
      const saved = recordedPlayerDarts[shooterId];
      setActiveDarts([
        [saved[0][0], saved[0][1], saved[0][2]],
        [saved[1][0], saved[1][1], saved[1][2]],
        [saved[2][0], saved[2][1], saved[2][2]],
      ]);
    } else {
      setActiveDarts(createEmptyNineDarts());
    }
    // Reopen editor mode for this shooter
    setIsMatchCompleteReview(false);
  };

  // Finalize match, record official season bulls, and finish
  const handleFinalizeAndSave = () => {
    const results: BullsRoundPlayerRecord[] = scheduledShooters.map((s) => {
      const darts = recordedPlayerDarts[s.id] || createEmptyNineDarts();
      const t1 = darts[0][0] + darts[0][1] + darts[0][2];
      const t2 = darts[1][0] + darts[1][1] + darts[1][2];
      const t3 = darts[2][0] + darts[2][1] + darts[2][2];
      const totalBulls = t1 + t2 + t3;

      return {
        playerId: s.id,
        playerName: s.name,
        avatar: s.avatar,
        teamId: s.teamId,
        teamName: s.teamName,
        bullsHit: totalBulls,
        shots: [t1, t2, t3],
        dartsDetail: darts,
        timestamp: Date.now(),
      };
    });

    // Record into season standings and stores
    recordBullsRoundResults(results, matchState.settings.leagueType);

    // Build finalized match state
    const p1 = matchState.players[0];
    const p2 = matchState.players[1];
    const winnerId = p1.legsWon > p2.legsWon ? p1.id : p2.legsWon > p1.legsWon ? p2.id : undefined;

    const finalizedMatchState: MatchState = {
      ...matchState,
      status: 'completed',
      winnerId,
      bullsRoundResults: results,
      updatedAt: Date.now(),
    };

    onSaveAndComplete(finalizedMatchState, results);
  };

  const currentShooterIdx = scheduledShooters.findIndex((s) => s.id === currentShooter?.id);

  // Turn metadata descriptor
  const turnConfigs = [
    { title: 'Turn 1', label: 'First 3 Darts', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/40', badge: 'bg-amber-500/20 text-amber-300' },
    { title: 'Turn 2', label: 'Second 3 Darts', color: 'from-indigo-500/20 to-indigo-600/10', border: 'border-indigo-500/40', badge: 'bg-indigo-500/20 text-indigo-300' },
    { title: 'Turn 3 (Final Shot)', label: 'Final 3 Darts', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/40', badge: 'bg-emerald-500/20 text-emerald-300' },
  ] as const;

  return (
    <div
      ref={modalContainerRef}
      onScroll={handleContainerScroll}
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto overscroll-y-contain p-2 sm:p-4 animate-fadeIn"
    >
      <div className="min-h-full flex items-start justify-center py-2 sm:py-6">
        <div className="bg-slate-900 border-2 border-amber-500/50 text-white rounded-3xl max-w-4xl w-full shadow-2xl relative">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 p-4 sm:p-6 text-center border-b border-amber-500/30 relative rounded-t-3xl">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/60 shadow-sm"
                title="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto mb-2 shadow-lg font-black">
              <Target className="w-7 h-7" />
            </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {leagueTitle}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bulls (9 Darts Over 3 Shots)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl mx-auto">
            Each player up has <strong>9 darts over 3 separate shots in a row</strong>. Score how many bulls were hit on each dart (Turn 1, Turn 2, and Turn 3). Once all players have finished, the match concludes.
          </p>

          {/* Progress bar */}
          <div className="mt-3.5 max-w-md mx-auto">
            <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>Shooters: {completedCount} of {totalTurns} completed</span>
              <span className="text-amber-400">{Math.round((completedCount / (totalTurns || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${(completedCount / (totalTurns || 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6 space-y-5">
          {/* ========================================================================= */}
          {/* VIEW A: MATCH COMPLETED REVIEW (LOCKED INPUT - NO EXTRA PLAY FOR LAST SHOOTER) */}
          {/* ========================================================================= */}
          {isMatchCompleteReview ? (
            <div className="bg-slate-950 border-2 border-emerald-500/60 rounded-2xl p-4 sm:p-6 space-y-5 shadow-2xl animate-fadeIn">
              {/* Victory / All Completed Banner */}
              <div className="text-center space-y-2 pb-4 border-b border-slate-800">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full font-black text-xs uppercase tracking-wider border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> All {totalTurns} Shooters Completed
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Bulls Round Complete • Match Over!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
                  Every player has taken their 9 darts. Review the final scores below, undo or edit any shots if needed, or finalize and end the match.
                </p>

                {/* Big Score Summary Comparison */}
                <div className="flex items-center justify-center gap-4 sm:gap-8 pt-3">
                  <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-3 sm:p-4 text-center min-w-[130px]">
                    <span className="text-xs font-black text-indigo-300 block truncate">{teamA.name}</span>
                    <span className="text-3xl sm:text-4xl font-black text-amber-400">{teamATotalBulls}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Bulls Hit</span>
                  </div>
                  <div className="text-xl font-black text-slate-500">VS</div>
                  <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-3 sm:p-4 text-center min-w-[130px]">
                    <span className="text-xs font-black text-purple-300 block truncate">{teamB.name}</span>
                    <span className="text-3xl sm:text-4xl font-black text-amber-400">{teamBTotalBulls}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Bulls Hit</span>
                  </div>
                </div>
              </div>

              {/* Complete Breakdown of All Shooters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Shooter Scores Breakdown (Click Edit to adjust shots)
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold">
                    {completedCount} of {totalTurns} recorded
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {scheduledShooters.map((s, idx) => {
                    const darts = recordedPlayerDarts[s.id] || createEmptyNineDarts();
                    const t1 = darts[0][0] + darts[0][1] + darts[0][2];
                    const t2 = darts[1][0] + darts[1][1] + darts[1][2];
                    const t3 = darts[2][0] + darts[2][1] + darts[2][2];
                    const total = t1 + t2 + t3;
                    const prior = seasonBullsMap[s.name.toLowerCase().trim()] || 0;

                    return (
                      <div
                        key={s.id}
                        className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xl">{s.avatar}</span>
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate">
                              #{idx + 1} {s.name}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {s.teamName} &bull; Season: {prior} &rarr; <strong className="text-amber-300">{prior + total}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-black rounded border border-amber-500/30 text-xs block">
                              {total} Bulls
                            </span>
                            <span className="text-[9px] text-slate-400 block font-mono">
                              ({t1}-{t2}-{t3})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectShooterToEdit(s.id)}
                            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase rounded border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit this player's shots"
                          >
                            <Edit3 className="w-3 h-3 text-amber-400" /> Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: End Match & Save vs Undo / Edit */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleFinalizeAndSave}
                  className="w-full sm:flex-1 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer transform active:scale-98"
                >
                  <Award className="w-5 h-5 stroke-[2.5]" />
                  <span>END MATCH &bull; SAVE OFFICIAL RESULTS</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndoLastTurn}
                  className="w-full sm:w-auto px-4 py-4 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>Undo Last Shooter</span>
                </button>

                <button
                  type="button"
                  onClick={scrollToTop}
                  className="w-full sm:w-auto px-4 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Scroll back up to the top"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>Top</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW B: ACTIVE SHOOTER 9-DARTS INPUT VIEW */
            /* ========================================================================= */
            <div className="bg-slate-950/90 border-2 border-amber-500/40 rounded-2xl p-3 sm:p-5 shadow-inner space-y-4">
              {/* Shooter Identity & Rotation Position Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <span className="text-4xl sm:text-5xl">{currentShooter?.avatar || '🎯'}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-black uppercase tracking-wider">
                        Shooter {currentShooterIdx + 1} of {totalTurns}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-bold">
                        {currentShooter?.teamName}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-white">{currentShooter?.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 font-medium mt-0.5">
                      <span>
                        Prior Season Bulls: <strong className="text-slate-200">{seasonBullsMap[currentShooter?.name.toLowerCase().trim() || ''] || 0}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        New Projected Total: <strong className="text-amber-400">{(seasonBullsMap[currentShooter?.name.toLowerCase().trim() || ''] || 0) + activeShooterTotalBulls}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Up Next & Selector Controls + Undo Previous Shooter */}
                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    {historyStack.length > 0 && (
                      <button
                        type="button"
                        onClick={handleUndoLastTurn}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                        title="Undo the previous player's turn"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Undo Turn
                      </button>
                    )}

                    {nextShooter && (
                      <div className="text-[11px] font-bold text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
                        <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">On Deck:</span>
                        <span>{nextShooter.avatar}</span>
                        <span className="text-slate-200">{nextShooter.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:w-auto">
                    <select
                      value={currentShooter?.id || ''}
                      onChange={(e) => handleSelectShooterToEdit(e.target.value)}
                      className="w-full sm:w-56 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      {scheduledShooters.map((s, idx) => {
                        const darts = recordedPlayerDarts[s.id];
                        const sum = calculatePlayerTotalBulls(darts);
                        return (
                          <option key={`${s.id}-${idx}`} value={s.id}>
                            #{idx + 1} {s.name} ({s.teamName}) {darts ? `[✓ ${sum} Bulls]` : '[Pending]'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Total 9 Darts Header */}
              <div className="flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    9 Darts Scoring &bull; 3 Separate Shots in a row
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">Total Bulls:</span>
                  <span className="text-base font-black px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-lg shadow-sm">
                    {activeShooterTotalBulls} / 18
                  </span>
                </div>
              </div>

              {/* 3 Turns (Turn 1, Turn 2, Turn 3 - Final Shot) with 3 Darts per Turn */}
              <div className="space-y-4">
                {([0, 1, 2] as const).map((turnIdx) => {
                  const config = turnConfigs[turnIdx];
                  const turnTotal = activeDarts[turnIdx][0] + activeDarts[turnIdx][1] + activeDarts[turnIdx][2];

                  return (
                    <div
                      key={turnIdx}
                      className={`bg-slate-900 border-2 ${config.border} rounded-2xl p-3.5 space-y-3 relative shadow-md`}
                    >
                      {/* Turn Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-md font-black text-xs uppercase tracking-wider ${config.badge}`}>
                            {config.title}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {config.label} (Darts {turnIdx * 3 + 1}, {turnIdx * 3 + 2}, {turnIdx * 3 + 3})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">Turn Subtotal:</span>
                          <span className="text-xs font-black px-2 py-0.5 bg-slate-950 text-amber-400 border border-slate-800 rounded">
                            {turnTotal} Bulls
                          </span>
                        </div>
                      </div>

                      {/* 3 Scoring Sections (Dart 1, Dart 2, Dart 3) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {([0, 1, 2] as const).map((dartIdx) => {
                          const dartVal = activeDarts[turnIdx][dartIdx];
                          const globalDartNum = turnIdx * 3 + dartIdx + 1;

                          return (
                            <div
                              key={dartIdx}
                              className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2 flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-300">
                                  Dart #{dartIdx + 1} <span className="text-[10px] text-slate-500 font-medium">(Dart {globalDartNum}/9)</span>
                                </span>
                                <span
                                  className={`text-[11px] font-black px-2 py-0.5 rounded ${
                                    dartVal === 2
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                      : dartVal === 1
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {dartVal === 2 ? 'Double Bull (2)' : dartVal === 1 ? 'Single Bull (1)' : 'Miss (0)'}
                                </span>
                              </div>

                              {/* Options: 0 (Miss), 1 (Single Bull 25), 2 (Double Bull 50) */}
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDart(turnIdx, dartIdx, 0)}
                                  className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center ${
                                    dartVal === 0
                                      ? 'bg-slate-700 text-white ring-2 ring-slate-400 font-black shadow'
                                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                                  }`}
                                >
                                  <span className="text-sm leading-none">0</span>
                                  <span className="text-[9px] font-semibold opacity-75">Miss</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateDart(turnIdx, dartIdx, 1)}
                                  className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center ${
                                    dartVal === 1
                                      ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 font-black shadow scale-102'
                                      : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40'
                                  }`}
                                >
                                  <span className="text-sm leading-none">1</span>
                                  <span className="text-[9px] font-semibold">Single (25)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleUpdateDart(turnIdx, dartIdx, 2)}
                                  className={`py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center ${
                                    dartVal === 2
                                      ? 'bg-red-500 text-white ring-2 ring-red-300 font-black shadow scale-102'
                                      : 'bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40'
                                  }`}
                                >
                                  <span className="text-sm leading-none">2</span>
                                  <span className="text-[9px] font-semibold">Double (50)</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button: Record 9 Darts & Move to Next Shooter */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRecordTurnAndAdvance}
                  className="w-full flex-1 py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {recordedPlayerDarts[currentShooter?.id || ''] !== undefined ? 'Update Scores' : 'Record 9 Darts'} ({activeShooterTotalBulls} {activeShooterTotalBulls === 1 ? 'Bull' : 'Bulls'}) &amp; {currentShooterIdx + 1 === totalTurns ? 'Complete Match' : 'Next Shooter'}
                  </span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </button>

                {historyStack.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoLastTurn}
                    className="w-full sm:w-auto px-3.5 py-3.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Undo2 className="w-4 h-4" /> Undo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Live Scoreboard Summary (Team A vs Team B / Players) */}
          {!isMatchCompleteReview && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Shooters &amp; Season Running Totals (Click row to edit shot)
                </span>
                <span className="text-[11px] font-bold text-amber-400">
                  {teamA.name} ({teamATotalBulls}) vs {teamB.name} ({teamBTotalBulls})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Team A Roster */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-xs font-black text-indigo-300 truncate">{teamA.name}</span>
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {teamATotalBulls} Bulls
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {teamAPlayers.map((p) => {
                      const darts = recordedPlayerDarts[p.id];
                      const hit = darts ? calculatePlayerTotalBulls(darts) : undefined;
                      const seasonPrior = seasonBullsMap[p.name.toLowerCase().trim()] || 0;
                      const seasonNew = seasonPrior + (hit || 0);
                      const isActive = currentShooter?.id === p.id && !isMatchCompleteReview;

                      const t1 = darts ? darts[0][0] + darts[0][1] + darts[0][2] : 0;
                      const t2 = darts ? darts[1][0] + darts[1][1] + darts[1][2] : 0;
                      const t3 = darts ? darts[2][0] + darts[2][1] + darts[2][2] : 0;

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectShooterToEdit(p.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500/60 text-white ring-1 ring-amber-500/40'
                              : hit !== undefined
                              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                              : 'bg-slate-900/50 border-slate-800/60 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>{p.avatar}</span>
                            <span className="font-bold truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400">
                              Season: {seasonPrior} ➔ <strong className="text-amber-300">{seasonNew}</strong>
                            </span>
                            {darts ? (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-black rounded border border-emerald-500/30 text-[11px]">
                                {hit} Bulls <span className="text-[9px] opacity-75 font-normal">({t1}-{t2}-{t3})</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team B Roster */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-xs font-black text-purple-300 truncate">{teamB.name}</span>
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {teamBTotalBulls} Bulls
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {teamBPlayers.map((p) => {
                      const darts = recordedPlayerDarts[p.id];
                      const hit = darts ? calculatePlayerTotalBulls(darts) : undefined;
                      const seasonPrior = seasonBullsMap[p.name.toLowerCase().trim()] || 0;
                      const seasonNew = seasonPrior + (hit || 0);
                      const isActive = currentShooter?.id === p.id && !isMatchCompleteReview;

                      const t1 = darts ? darts[0][0] + darts[0][1] + darts[0][2] : 0;
                      const t2 = darts ? darts[1][0] + darts[1][1] + darts[1][2] : 0;
                      const t3 = darts ? darts[2][0] + darts[2][1] + darts[2][2] : 0;

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectShooterToEdit(p.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500/60 text-white ring-1 ring-amber-500/40'
                              : hit !== undefined
                              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                              : 'bg-slate-900/50 border-slate-800/60 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>{p.avatar}</span>
                            <span className="font-bold truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400">
                              Season: {seasonPrior} ➔ <strong className="text-amber-300">{seasonNew}</strong>
                            </span>
                            {darts ? (
                              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-black rounded border border-emerald-500/30 text-[11px]">
                                {hit} Bulls <span className="text-[9px] opacity-75 font-normal">({t1}-{t2}-{t3})</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* End Match Early Option if Needed & Scroll to top */}
              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Finished recording or want to conclude early?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={scrollToTop}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg border border-slate-700 text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                    title="Scroll back up to top"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Top</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeAndSave}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-lg border border-amber-500/30 text-[11px] cursor-pointer transition-colors"
                  >
                    Conclude &amp; Finalize Match ({completedCount}/{totalTurns})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* Floating Scroll to Top Button for Tablets and Mobile */}
    {showScrollTop && (
      <button
        type="button"
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-2xl transition-all cursor-pointer animate-fadeIn border-2 border-slate-950"
        title="Scroll up to top"
      >
        <ChevronUp className="w-4 h-4 stroke-[3]" />
        <span>Scroll to Top</span>
      </button>
    )}
  </div>
);
};
