import React, { useState, useEffect } from 'react';
import { MatchState, Player, CricketMarkRecord, TurnLog } from '../types';
import { processCricketTurn, CricketDartHit } from '../utils/cricketEngine';
import { updateLeaguePoints, recordTuesdayLegStats, recordThursdayLegStats, recordWednesdayLegStats } from '../utils/leagueHelper';
import { getShooterInfo, advancePlayerSubShooter, announceCurrentShooter, getEffectiveTeamPlayers, updateSubPlayerCricketStats } from '../utils/shooterHelper';
import { announcer } from '../utils/audio';
import { buildNextMedleyMatchState, isOptionalFinalLeg, finalizeMedleyMatchState } from '../utils/medleyHelper';
import { OptionalFinalGameModal } from './OptionalFinalGameModal';
import { MatchReportEmailModal } from './MatchReportEmailModal';
import { MatchEmailQuickBanner } from './MatchEmailQuickBanner';
import { BullsRoundModal } from './BullsRoundModal';
import {
  getRecipientEmail,
  getNativeMailtoUrl,
  openMailtoLink,
  generateMatchEmailReport,
} from '../utils/emailReportHelper';
import {
  Target,
  Trophy,
  RotateCcw,
  CornerDownLeft,
  Mail,
  Undo2,
  Plus,
  XCircle,
  Check,
  ArrowUpDown,
  CheckCircle2,
  XSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CricketBoardProps {
  matchState: MatchState;
  onUpdateMatch: (updatedState: MatchState) => void;
  onNewMatchRequest: () => void;
  onReturnToLeague?: () => void;
}

export const CricketBoard: React.FC<CricketBoardProps> = ({
  matchState,
  onUpdateMatch,
  onNewMatchRequest,
  onReturnToLeague,
}) => {
  const [currentHits, setCurrentHits] = useState<CricketDartHit[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [historyStack, setHistoryStack] = useState<MatchState[]>([]);
  const [showOptionalFinalModal, setShowOptionalFinalModal] = useState<boolean>(false);
  const [showBullsModal, setShowBullsModal] = useState<boolean>(false);
  const [pendingNextState, setPendingNextState] = useState<MatchState | null>(null);
  const [winnerModal, setWinnerModal] = useState<{
    type: 'leg' | 'match';
    playerName: string;
    nextGameLabel?: string;
    p1Score?: number;
    p2Score?: number;
  } | null>(null);
  const [pendingMedleyState, setPendingMedleyState] = useState<{
    nextPlayers: Player[];
    completedLegRecord: any;
  } | null>(null);

  const activePlayer = matchState.players[matchState.activePlayerIndex];
  const opponentPlayer = matchState.players[1 - matchState.activePlayerIndex];

  // Announce thrower when leg starts
  useEffect(() => {
    if (matchState.status === 'active' && activePlayer) {
      if (matchState.settings.announceAudio) {
        announceCurrentShooter(activePlayer, 300, { ignoreDummy: true, gameMode: 'CRICKET' });
      }
    }
  }, [matchState.currentLeg, matchState.status]);

  const cricketSectors: (keyof CricketMarkRecord)[] = [
    20,
    19,
    18,
    17,
    16,
    15,
    'doubles',
    'triples',
    25,
  ];

  // Helper to format hit label
  const getHitLabel = (sector: keyof CricketMarkRecord, count: number): string => {
    if (count === 0) return 'Miss Dart (0 X)';
    const secName =
      sector === 25
        ? 'Bull'
        : sector === 'doubles'
        ? 'Doubles'
        : sector === 'triples'
        ? 'Triples'
        : `${sector}`;
    return `${secName} (+${count} X)`;
  };

  const totalDartsThrown = currentHits.length;
  const totalXMarksThisTurn = currentHits.reduce((acc, h) => acc + (h.multiplier || 0), 0);

  // Calculate live marks for active player taking into account unsubmitted current turn
  const getEffectiveMarks = (playerIndex: number, sector: keyof CricketMarkRecord): number => {
    const baseMarks = matchState.players[playerIndex].cricketMarks[sector] || 0;
    if (playerIndex !== matchState.activePlayerIndex) {
      return baseMarks;
    }
    const marksInTurn = currentHits
      .filter((h) => h.sector === sector)
      .reduce((sum, h) => sum + (h.multiplier || 0), 0);
    return Math.min(3, baseMarks + marksInTurn);
  };

  // Add throws with a specified number of X marks (1, 2, or 3)
  const handleAddDart = (sector: keyof CricketMarkRecord, marksToAdd: number = 1) => {
    if (matchState.status === 'completed') return;

    const currentEffective = getEffectiveMarks(matchState.activePlayerIndex, sector);
    const availableSlots = 3 - currentEffective;
    if (availableSlots <= 0) return; // already has 3 X's

    const actualMarks = Math.min(marksToAdd, availableSlots);
    if (actualMarks <= 0) return;

    const newHit: CricketDartHit = {
      sector,
      multiplier: actualMarks,
      label: getHitLabel(sector, actualMarks),
    };

    setCurrentHits((prev) => [...prev, newHit]);
  };

  // Click on a specific square (1, 2, or 3) for a player and segment
  const handleSquareClick = (
    playerIndex: number,
    sector: keyof CricketMarkRecord,
    squareNum: 1 | 2 | 3
  ) => {
    if (matchState.status === 'completed') return;

    // Only active thrower's squares can be tapped
    if (playerIndex !== matchState.activePlayerIndex) {
      return;
    }

    const prevCommittedMarks = matchState.players[playerIndex].cricketMarks[sector] || 0;
    const effectiveMarks = getEffectiveMarks(playerIndex, sector);

    // If clicking a square that was added in the current unsubmitted turn, remove the last hit for this sector
    if (squareNum > prevCommittedMarks && squareNum <= effectiveMarks) {
      // Find the last hit for this sector and remove or decrease it
      setCurrentHits((prev) => {
        const lastIndex = prev.map((h) => h.sector).lastIndexOf(sector);
        if (lastIndex >= 0) {
          const hit = prev[lastIndex];
          if (hit.multiplier > 1) {
            const updated = [...prev];
            updated[lastIndex] = {
              ...hit,
              multiplier: hit.multiplier - 1,
              label: getHitLabel(sector, hit.multiplier - 1),
            };
            return updated;
          } else {
            return prev.filter((_, i) => i !== lastIndex);
          }
        }
        return prev;
      });
      return;
    }

    // If square is already committed in previous turns, it cannot be toggled off directly without Undo Turn
    if (squareNum <= prevCommittedMarks) {
      return;
    }

    // Otherwise, calculate how many marks needed to fill up to this square
    const needed = squareNum - effectiveMarks;
    if (needed > 0) {
      handleAddDart(sector, needed);
    }
  };

  // Record a miss dart (0 marks)
  const handleAddMiss = () => {
    if (matchState.status === 'completed') return;
    setCurrentHits((prev) => [
      ...prev,
      {
        sector: 'miss',
        multiplier: 0,
        label: 'Miss Dart (0 X)',
      },
    ]);
  };

// Dedicated action when a player misses all targets: records 3 misses (0 marks) and advances immediately to the next player's turn
  const handleMissedAllTargets = () => {
    if (matchState.status === 'completed') return;

    // Immediately clear any unsubmitted current hits so NO sector marks are kept
    setCurrentHits([]);

    const missHits: CricketDartHit[] = [
      { sector: 'miss', multiplier: 0, label: 'Miss Dart (0 X)' },
      { sector: 'miss', multiplier: 0, label: 'Miss Dart (0 X)' },
      { sector: 'miss', multiplier: 0, label: 'Miss Dart (0 X)' },
    ];

    handleSubmitTurn(missHits);
  };

  // Undo the most recent dart thrown in current turn
  const handleUndoDart = () => {
    if (currentHits.length > 0) {
      setCurrentHits((prev) => prev.slice(0, -1));
    }
  };

  // Remove a specific dart by index
  const handleRemoveDart = (index: number) => {
    setCurrentHits((prev) => prev.filter((_, i) => i !== index));
  };

  // Clear all unsubmitted darts in current turn
  const handleClearTurn = () => {
    setCurrentHits([]);
  };

  // Global Undo Last Turn / Throw
  const handleUndoLastTurn = () => {
    if (currentHits.length > 0) {
      handleUndoDart();
      return;
    }

    if (historyStack.length > 0) {
      const previousState = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      onUpdateMatch(previousState);
    }
  };

  // Dedicated Undo for winning turn / finishing shot in Cricket
  const handleUndoFinishingShot = () => {
    if (historyStack.length > 0) {
      const previousState = historyStack[historyStack.length - 1];
      setHistoryStack((prev) => prev.slice(0, -1));
      onUpdateMatch(previousState);
    }
    setWinnerModal(null);
    setPendingNextState(null);
    setCurrentHits([]);
  };

  // Submit Turn & check victory
  const handleSubmitTurn = (customHits?: CricketDartHit[]) => {
    if (customHits && customHits.length > 0) {
      setCurrentHits([]);
    }
    let hitsToSubmit = customHits && customHits.length > 0 ? [...customHits] : [...currentHits];
    if (hitsToSubmit.length === 0) return;

    // Save current state for undo
    setHistoryStack((prev) => [...prev, { ...matchState }]);

    const dartsInThisTurn = hitsToSubmit.length;
    const res = processCricketTurn(activePlayer, opponentPlayer, hitsToSubmit, true);

    const activeShooter = getShooterInfo(activePlayer, { ignoreDummy: true, gameMode: 'CRICKET' });
    const hitsDetail = hitsToSubmit.map((h) => {
      if (h.multiplier === 0 || h.sector === 'miss') return 'Miss (0 X)';
      const multPrefix = h.multiplier === 3 ? 'T' : h.multiplier === 2 ? 'D' : 'S';
      if (h.sector === 25) return h.multiplier === 2 ? 'Double Bull (50)' : 'Single Bull (25)';
      if (h.sector === 'doubles') return `${h.multiplier} Double(s)`;
      if (h.sector === 'triples') return `${h.multiplier} Triple(s)`;
      return `${multPrefix}${h.sector}`;
    });

    const cricketTurnLog: TurnLog = {
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      turnNumber: (matchState.history?.length || 0) + 1,
      playerId: activePlayer.id,
      playerName: activePlayer.name,
      shooterName: activeShooter.isDummyTurn ? '🤖 Dummy Player' : activeShooter.shooterName,
      subPlayerIndex: activeShooter.subPlayerIndex,
      isDummyTurn: activeShooter.isDummyTurn,
      creditedPlayerName: activeShooter.isDummyTurn ? '🤖 Dummy Player' : activeShooter.shooterName,
      score: res.totalMarksThisTurn,
      remainingBefore: 0,
      remainingAfter: 0,
      dartsUsed: hitsToSubmit.length,
      isBust: false,
      isCheckout: res.isWinner,
      dartsDetail: hitsDetail,
      timestamp: Date.now(),
    };

    const updatedHistory = [...(matchState.history || []), cricketTurnLog];

    const updatedPlayers = matchState.players.map((p, idx) => {
      if (idx === matchState.activePlayerIndex) {
        const totalDarts = p.stats.dartsThrown + dartsInThisTurn;
        const totalMarks = Object.values(res.newMarksActive).reduce(
          (sum, m) => sum + (m || 0),
          0
        );
        const mpr = totalDarts > 0 ? (totalMarks / totalDarts) * 3 : 0;
        const subProgression = advancePlayerSubShooter(p, { ignoreDummy: true, gameMode: 'CRICKET' });
        const updatedSubPlayers = updateSubPlayerCricketStats(p, res.totalMarksThisTurn, dartsInThisTurn, { ignoreDummy: true, gameMode: 'CRICKET' });

        return {
          ...p,
          cricketMarks: res.newMarksActive,
          cricketPoints: 0,
          currentSubPlayerIndex: subProgression.currentSubPlayerIndex,
          dummyShooterIndices: subProgression.dummyShooterIndices,
          lastRealShooterIndex: subProgression.lastRealShooterIndex,
          teamPlayers: updatedSubPlayers || p.teamPlayers,
          stats: {
            ...p.stats,
            dartsThrown: totalDarts,
            mpr: parseFloat(mpr.toFixed(2)),
          },
        };
      } else {
        return {
          ...p,
          cricketPoints: 0,
        };
      }
    });

    if (res.isWinner) {
      try {
        confetti({ particleCount: 130, spread: 85, origin: { y: 0.6 } });
      } catch (e) {}

      const isMedley = !!(matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY');

      // Update league points for standalone matches (Medley matches handle per-leg stats and points in buildNextMedleyMatchState / finalizeMedleyMatchState)
      if (!isMedley && matchState.settings.leagueType && matchState.settings.leagueType !== 'none') {
        updateLeaguePoints(activePlayer.name, opponentPlayer.name, matchState.settings.leagueType, matchState.players);
      }

      const nextPlayers = updatedPlayers.map((p, idx) => ({
        ...p,
        legsWon: idx === matchState.activePlayerIndex ? p.legsWon + 1 : p.legsWon,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0, doubles: 0, triples: 0 },
        cricketPoints: 0,
      }));

      const completedLegRecord = {
        legNumber: matchState.currentLeg,
        gameMode: 'CRICKET' as const,
        startScore: 0,
        winnerId: activePlayer.id,
        winnerName: activePlayer.name,
        turns: updatedHistory,
        dartsCount: {
          [updatedPlayers[0].id]: updatedPlayers[0].stats.dartsThrown,
          [updatedPlayers[1].id]: updatedPlayers[1].stats.dartsThrown,
        },
        averages: {
          [updatedPlayers[0].id]: updatedPlayers[0].stats.threeDartAvg,
          [updatedPlayers[1].id]: updatedPlayers[1].stats.threeDartAvg,
        },
      };

      if (isMedley) {
        // Check if next leg is the optional final leg transition (e.g. Leg 5 Cricket ending, entering optional Game 6 1001)
        if (isOptionalFinalLeg(matchState, matchState.currentLeg + 1)) {
          setPendingMedleyState({
            nextPlayers,
            completedLegRecord,
          });
          setShowOptionalFinalModal(true);
          return;
        }

        // Standard medley progression to next configured leg
        const nextMedleyState = buildNextMedleyMatchState(matchState, activePlayer.id, completedLegRecord);
        if (nextMedleyState.status === 'completed') {
          onUpdateMatch(nextMedleyState);
          if (
            matchState.settings.isMedley &&
            matchState.settings.leagueType !== 'tuesday' &&
            matchState.settings.leagueType !== 'wednesday' &&
            matchState.settings.leagueType !== 'thursday'
          ) {
            setShowBullsModal(true);
          } else {
            setWinnerModal({
              type: 'match',
              playerName: activePlayer.name,
            });
          }
        } else {
          setPendingNextState(nextMedleyState);
          setWinnerModal({
            type: 'leg',
            playerName: activePlayer.name,
            nextGameLabel: `Game ${nextMedleyState.currentLeg} (${nextMedleyState.currentGameMode})`,
            p1Score: nextMedleyState.players[0]?.legsWon || 0,
            p2Score: nextMedleyState.players[1]?.legsWon || 0,
          });
        }
        return;
      }

      if (matchState.settings.leagueType === 'tuesday') {
        try {
          recordTuesdayLegStats(completedLegRecord, matchState);
        } catch (e) {
          console.error('Failed to record Tuesday Cricket leg stats', e);
        }
      } else if (matchState.settings.leagueType === 'wednesday') {
        try {
          recordWednesdayLegStats(completedLegRecord, matchState);
        } catch (e) {
          console.error('Failed to record Wednesday Cricket leg stats', e);
        }
      } else if (matchState.settings.leagueType === 'thursday') {
        try {
          recordThursdayLegStats(completedLegRecord, matchState);
        } catch (e) {
          console.error('Failed to record Thursday Cricket leg stats', e);
        }
      }

      // Standard Non-Medley Cricket match win check
      const isMatchComplete =
        nextPlayers[matchState.activePlayerIndex].legsWon >= matchState.settings.legsToWin;

      const nextStarterIndex = 1 - matchState.starterPlayerIndex;
      const nextStarterPlayer = nextPlayers[nextStarterIndex];

      const updatedMatchState: MatchState = {
        ...matchState,
        status: isMatchComplete ? 'completed' : 'active',
        winnerId: isMatchComplete
          ? nextPlayers[0].legsWon > nextPlayers[1].legsWon
            ? nextPlayers[0].id
            : nextPlayers[1].id
          : undefined,
        players: nextPlayers,
        currentLeg: isMatchComplete ? matchState.currentLeg : matchState.currentLeg + 1,
        activePlayerIndex: nextStarterIndex,
        starterPlayerIndex: nextStarterIndex,
        completedLegs: [...matchState.completedLegs, completedLegRecord],
        history: [],
        updatedAt: Date.now(),
      };

      if (!isMatchComplete && matchState.settings.announceAudio && nextStarterPlayer) {
        announceCurrentShooter(nextStarterPlayer, 1000, { ignoreDummy: true, gameMode: 'CRICKET' });
      }

      if (isMatchComplete) {
        onUpdateMatch(updatedMatchState);
        if (
          matchState.settings.isMedley &&
          matchState.settings.leagueType !== 'tuesday' &&
          matchState.settings.leagueType !== 'wednesday' &&
          matchState.settings.leagueType !== 'thursday'
        ) {
          setShowBullsModal(true);
        } else {
          setWinnerModal({
            type: 'match',
            playerName: activePlayer.name,
          });
        }
      } else {
        setPendingNextState(updatedMatchState);
        setWinnerModal({
          type: 'leg',
          playerName: activePlayer.name,
          nextGameLabel: `Leg ${matchState.currentLeg + 1}`,
          p1Score: nextPlayers[0]?.legsWon || 0,
          p2Score: nextPlayers[1]?.legsWon || 0,
        });
      }
    } else {
      const nextPlayerIdx = 1 - matchState.activePlayerIndex;
      const nextShooterPlayer = updatedPlayers[nextPlayerIdx];
      if (matchState.settings.announceAudio) {
        if (res.totalMarksThisTurn === 0) {
          announcer.announceScore(0);
          if (nextShooterPlayer) {
            announceCurrentShooter(nextShooterPlayer, 750, { ignoreDummy: true, gameMode: 'CRICKET' });
          }
        } else if (nextShooterPlayer) {
          announceCurrentShooter(nextShooterPlayer, 400, { ignoreDummy: true, gameMode: 'CRICKET' });
        }
      }

      onUpdateMatch({
        ...matchState,
        players: updatedPlayers,
        activePlayerIndex: nextPlayerIdx,
        history: updatedHistory,
        updatedAt: Date.now(),
      });
    }

    setCurrentHits([]);
  };

  // Helper to count total X's marked and fully closed segments
  const getPlayerProgress = (pIdx: number) => {
    let totalX = 0;
    let closedSegments = 0;
    for (const sec of cricketSectors) {
      const marks = getEffectiveMarks(pIdx, sec);
      totalX += marks;
      if (marks >= 3) {
        closedSegments += 1;
      }
    }
    return { totalX, closedSegments };
  };

  const latestSector =
    currentHits.length > 0 ? currentHits[currentHits.length - 1].sector : null;

  const p1Progress = getPlayerProgress(0);
  const p2Progress = getPlayerProgress(1);

  // Render the 3 interactive squares beside each segment for a player
  const renderThreeSquares = (pIdx: number, sec: keyof CricketMarkRecord) => {
    const prevCommitted = matchState.players[pIdx].cricketMarks[sec] || 0;
    const effective = getEffectiveMarks(pIdx, sec);
    const isCurrentThrower = matchState.activePlayerIndex === pIdx && matchState.status === 'active';
    const isFullyClosed = effective >= 3;

    return (
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {([1, 2, 3] as const).map((squareNum) => {
          const isCommitted = squareNum <= prevCommitted;
          const isPending = squareNum > prevCommitted && squareNum <= effective;
          const isMarkedWithX = isCommitted || isPending;

          return (
            <button
              key={squareNum}
              type="button"
              id={`sq-${pIdx}-${sec}-${squareNum}`}
              onClick={() => handleSquareClick(pIdx, sec, squareNum)}
              title={
                isCommitted
                  ? `Square ${squareNum} marked X in previous turn`
                  : isPending
                  ? `Square ${squareNum} marked X in this turn (Click to unmark)`
                  : isCurrentThrower
                  ? `Click to mark Square ${squareNum} with an X`
                  : `${matchState.players[pIdx].name}: Square ${squareNum}`
              }
              className={`w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-lg sm:rounded-xl border-2 font-mono font-black text-lg sm:text-xl md:text-2xl flex items-center justify-center transition-all select-none touch-manipulation shadow-xs ${
                isCommitted
                  ? 'bg-slate-900 text-emerald-400 border-slate-700 shadow-inner'
                  : isPending
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-4 ring-indigo-200 shadow-md scale-105 cursor-pointer'
                  : isCurrentThrower
                  ? 'bg-white text-slate-400 border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 active:scale-95 cursor-pointer shadow-xs'
                  : 'bg-slate-50 text-slate-300 border-slate-200 cursor-default'
              }`}
            >
              {isMarkedWithX ? (
                <span className="font-black text-xl sm:text-2xl leading-none">X</span>
              ) : (
                <span className="text-xs sm:text-sm font-sans font-bold opacity-40 text-slate-400">
                  {squareNum}
                </span>
              )}
            </button>
          );
        })}

        {/* Closed indicator pill when all 3 squares are X'd */}
        {isFullyClosed && (
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-black uppercase rounded-md shadow-2xs">
            <Check className="w-3.5 h-3.5" /> Closed
          </span>
        )}
      </div>
    );
  };

  const isMatchComplete = matchState.status === 'completed';
  const winnerPlayer =
    matchState.players.find((p) => p.id === matchState.winnerId) ||
    (matchState.players[0].legsWon > matchState.players[1].legsWon
      ? matchState.players[0]
      : matchState.players[1]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-12 sm:pb-16 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold text-white text-sm sm:text-base">
            Cricket &bull; 3 Squares (X) per Segment
          </span>
          <span className="text-xs text-indigo-300 uppercase font-bold tracking-wider bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
            {isMatchComplete ? 'Match Complete' : `Leg ${matchState.currentLeg} / 3`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo Button */}
          {!isMatchComplete && (
            <button
              type="button"
              id="cricket-undo-last-turn-btn"
              disabled={historyStack.length === 0 && currentHits.length === 0}
              onClick={handleUndoLastTurn}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 text-xs font-black uppercase tracking-wider rounded flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              title="Undo Throw / Turn"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1 shadow-sm transition-all"
          >
            <Mail className="w-3.5 h-3.5" /> Email Results
          </button>

          {onReturnToLeague && (
            <button
              type="button"
              onClick={onReturnToLeague}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded border border-indigo-500 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" /> League
            </button>
          )}

          <button
            type="button"
            onClick={onNewMatchRequest}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider rounded border border-slate-700 transition-all"
          >
            New Match
          </button>
        </div>
      </div>

      {isMatchComplete ? (
        /* DEDICATED MATCH COMPLETED VIEW (NO EXTRA GAME OR ACTIVE INPUTS) */
        <div className="space-y-4 animate-fadeIn">
          {/* Victory Banner */}
          <div className="bg-gradient-to-r from-emerald-700 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-emerald-500/40 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center text-slate-950 shadow-lg shrink-0">
                  <Trophy className="w-9 h-9" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-emerald-500/30 border border-emerald-400/50 rounded-full text-emerald-200 text-xs font-black uppercase tracking-wider mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Match Complete — Official Result</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
                    {winnerPlayer?.name || 'Winner'} Wins!
                  </h2>
                  <p className="text-slate-300 text-sm font-semibold mt-1">
                    Final Score: <strong className="text-white">{matchState.players[0].name} ({matchState.players[0].legsWon}) — {matchState.players[1].name} ({matchState.players[1].legsWon})</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <a
                  href={getNativeMailtoUrl(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  onClick={() => openMailtoLink(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  id="cricket-share-results-email-btn"
                  className="flex-1 md:flex-none px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer no-underline"
                  title="Open standard mailto: link pre-filled with detailed match summary"
                >
                  <Mail className="w-4 h-4 stroke-[2.5]" /> Share Results via Email
                </a>

                {onReturnToLeague && (
                  <button
                    type="button"
                    onClick={onReturnToLeague}
                    className="flex-1 md:flex-none px-4 py-3 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-amber-500" /> Return to League
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleUndoLastTurn}
                  className="flex-1 md:flex-none px-3 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all"
                >
                  <Undo2 className="w-4 h-4" /> Undo Finish
                </button>

                <button
                  type="button"
                  onClick={onNewMatchRequest}
                  className="flex-1 md:flex-none px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition-colors cursor-pointer"
                >
                  Start New Match
                </button>
              </div>
            </div>

            {/* Clear Reassurance Notice */}
            <div className="mt-5 pt-4 border-t border-white/15 flex items-center gap-2.5 text-xs text-emerald-100 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>
                <strong>Match is officially finished and recorded.</strong> No further games need to be played for this matchup.
              </span>
            </div>
          </div>

          {/* Quick Match Email Dispatch & Player Copy Banner */}
          <MatchEmailQuickBanner
            matchState={matchState}
            onOpenFullModal={() => setShowEmailModal(true)}
          />

          {/* Completed Games / Legs Breakdown */}
          {matchState.completedLegs && matchState.completedLegs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                Completed Games Breakdown
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {matchState.completedLegs.map((leg, lIdx) => (
                  <div key={lIdx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-indigo-600 font-mono">Game {lIdx + 1}: {leg.gameMode || 'CRICKET'}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {leg.winnerName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span>Turns: {leg.turns?.length || 0}</span>
                      <span>Winner: {leg.winnerName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Player Match Stats Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchState.players.map((player) => {
              const isWinner = player.id === matchState.winnerId || player.legsWon > (matchState.players.find(p => p.id !== player.id)?.legsWon || 0);

              return (
                <div
                  key={player.id}
                  className={`bg-white border rounded-2xl p-6 shadow-xs relative overflow-hidden ${
                    isWinner ? 'border-emerald-400 ring-2 ring-emerald-500/10' : 'border-slate-200'
                  }`}
                >
                  {isWinner && (
                    <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-bl-xl shadow-xs flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Winner
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{player.avatar || '🎯'}</span>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight">
                        {player.name}
                      </h4>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Legs Won: {player.legsWon}
                      </span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">MPR</span>
                      <span className="text-base font-mono font-black text-indigo-600">
                        {player.stats.mpr?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marks (X)</span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.stats.marks || 0}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Darts Thrown</span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.stats.dartsThrown}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doubles/Triples</span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.cricketMarks?.doubles || 0} / {player.cricketMarks?.triples || 0}
                      </span>
                    </div>
                  </div>

                  {/* Sub-player breakdown for teams */}
                  {(() => {
                    const effectiveList = getEffectiveTeamPlayers(player).filter((p) => !p.isDummy);
                    if (effectiveList.length <= 1) return null;
                    return (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Team Roster Individual Stats
                        </span>
                        <div className="space-y-1.5">
                          {effectiveList.map((subP, sIdx) => (
                            <div key={`cricket-sub-${player.id}-${subP.id || sIdx}`} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg">
                              <span className="font-bold text-slate-700">{subP.name}</span>
                              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                                <span>Darts: <strong>{subP.stats.dartsThrown}</strong></span>
                                <span>Marks: <strong>{(subP.stats as any).marks || 0}</strong></span>
                                <span>MPR: <strong className="text-indigo-600">{subP.stats.mpr?.toFixed(2) || '0.00'}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Prominent Active Turn & Individual Shooter Banner */}
          {matchState.status === 'active' && activePlayer && (() => {
            const isStandaloneDummy = Boolean(
              activePlayer.isDummy ||
              activePlayer.name?.toLowerCase().includes('dummy') ||
              (activePlayer.teamPlayers && activePlayer.teamPlayers.length > 0 && activePlayer.teamPlayers.every((p) => p.isDummy))
            );
            const activeShooter = isStandaloneDummy
              ? {
                  shooterName: '🤖 Dummy Player',
                  isDummyTurn: true,
                  avatar: '🤖',
                  displayFull: '🤖 Dummy Player (Available Player Shooting)',
                  subPlayerIndex: 0,
                  subPlayerId: 'p-dummy',
                  teamName: activePlayer.name,
                  isDummyBenched: false,
                  nextShooterName: undefined,
                }
              : getShooterInfo(activePlayer, { ignoreDummy: true, gameMode: 'CRICKET' });
            const effectiveList = getEffectiveTeamPlayers(activePlayer).filter((p) => !p.isDummy);
            const nextShooter = activeShooter.nextShooterName;

            return (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500 rounded-2xl p-3 sm:p-3.5 text-white shadow-xl flex items-center justify-between gap-3 ring-2 ring-indigo-500/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-inner shrink-0 border border-indigo-400/40">
                    {activeShooter.avatar || '🎯'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md animate-pulse shadow-xs flex items-center gap-1">
                        <span>{activeShooter.isDummyTurn ? '🤖' : '🎯'}</span>
                        <span>{activeShooter.isDummyTurn ? 'DUMMY SHOT (AVAILABLE PLAYER SHOOTS • NO STATS)' : 'NOW THROWING'}</span>
                      </span>
                      {effectiveList.length > 1 && (
                        <span className="text-[10px] text-indigo-200 font-bold">
                          Shooter {(activeShooter.subPlayerIndex % effectiveList.length) + 1} of {effectiveList.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 truncate">
                        <span className="text-amber-300 underline decoration-indigo-400/80 decoration-2 underline-offset-2">
                          {activeShooter.shooterName}
                        </span>
                        {effectiveList.length > 1 && (() => {
                          const cleanTeam = activePlayer.name.replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '').trim();
                          if (cleanTeam && cleanTeam !== activeShooter.shooterName) {
                            return (
                              <span className="text-xs text-slate-300 font-semibold truncate">
                                &bull; Team: <strong className="text-white">{cleanTeam}</strong>
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </h2>
                      {nextShooter && effectiveList.length > 1 && (
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Up next: <strong className="text-slate-200">{nextShooter}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Game</span>
                  <span className="text-xs sm:text-sm font-mono font-black text-amber-400">
                    Cricket
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Main 3-Square Cricket Scoreboard Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 sm:p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              {/* Player 1 Column Header */}
              <th className="py-2 px-2 sm:px-3 text-left font-extrabold text-xs sm:text-sm text-indigo-600 w-5/12">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-900 font-black text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
                      {matchState.players[0].name.replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '').trim() || matchState.players[0].name}
                    </span>
                    {getEffectiveTeamPlayers(matchState.players[0]).some(p => p.isDummy) && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold shrink-0" title="Dummy sits out in Cricket">
                        Dummy sits out
                      </span>
                    )}
                    {matchState.activePlayerIndex === 0 && matchState.status === 'active' && (
                      <>
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-2xs animate-pulse">
                          Throwing
                        </span>
                        <button
                          type="button"
                          id="cricket-p1-missed-all-header-btn"
                          onClick={handleMissedAllTargets}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-full border border-rose-300 transition-all cursor-pointer active:scale-95 shadow-2xs"
                          title="Missed all targets (0 marks) — go to next player's turn"
                        >
                          <XCircle className="w-2.5 h-2.5 text-rose-600" />
                          <span>Missed All</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Marks: <strong className="text-indigo-600 font-bold">{p1Progress.totalX}/27</strong>
                  </span>
                  <span>
                    Closed: <strong className="text-slate-900 font-bold">{p1Progress.closedSegments}/9</strong>
                  </span>
                  <span>
                    Legs: <strong className="text-slate-900 font-bold">{matchState.players[0].legsWon}</strong>
                  </span>
                </div>

                {/* Player 1 Team Thrower Banner */}
                {(() => {
                  const effectiveList = getEffectiveTeamPlayers(matchState.players[0]).filter((p) => !p.isDummy);
                  if (effectiveList.length <= 1) return null;
                  const info = getShooterInfo(matchState.players[0], { ignoreDummy: true, gameMode: 'CRICKET' });
                  const isCurrentThrowing = matchState.activePlayerIndex === 0 && matchState.status === 'active';
                  return (
                    <div className={`mt-1 p-1.5 rounded-lg text-xs font-sans border transition-all ${
                      isCurrentThrowing
                        ? 'bg-indigo-50 border-indigo-200 text-slate-800 ring-1 ring-indigo-300/50'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center justify-between font-bold text-[9px] uppercase mb-0.5">
                        <span className="text-slate-500">🎯 Shooter Up</span>
                      </div>
                      <div className="flex items-center gap-1 font-extrabold text-[11px]">
                        <span>{info.avatar}</span>
                        <span className="truncate text-slate-900 font-black">
                          {info.shooterName}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </th>

              {/* Segment Label Column */}
              <th className="py-2 px-1 font-black text-[11px] uppercase text-slate-400 tracking-wider w-2/12 text-center">
                Segment
              </th>

              {/* Player 2 Column Header */}
              <th className="py-2 px-2 sm:px-3 text-right font-extrabold text-xs sm:text-sm text-slate-800 w-5/12">
                <div className="flex items-center justify-end gap-1.5">
                  {matchState.activePlayerIndex === 1 && matchState.status === 'active' && (
                    <>
                      <button
                        type="button"
                        id="cricket-p2-missed-all-header-btn"
                        onClick={handleMissedAllTargets}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-full border border-rose-300 transition-all cursor-pointer active:scale-95 shadow-2xs"
                        title="Missed all targets (0 marks) — go to next player's turn"
                      >
                        <XCircle className="w-2.5 h-2.5 text-rose-600" />
                        <span>Missed All</span>
                      </button>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-full shadow-2xs animate-pulse">
                        Throwing
                      </span>
                    </>
                  )}
                  {getEffectiveTeamPlayers(matchState.players[1]).some(p => p.isDummy) && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold shrink-0" title="Dummy sits out in Cricket">
                      Dummy sits out
                    </span>
                  )}
                  <span className="text-slate-900 font-black text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
                    {matchState.players[1].name.replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '').trim() || matchState.players[1].name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
                  <span>
                    Legs: <strong className="text-slate-900 font-bold">{matchState.players[1].legsWon}</strong>
                  </span>
                  <span>
                    Closed: <strong className="text-slate-900 font-bold">{p2Progress.closedSegments}/9</strong>
                  </span>
                  <span>
                    Marks: <strong className="text-indigo-600 font-bold">{p2Progress.totalX}/27</strong>
                  </span>
                </div>

                {/* Player 2 Team Thrower Banner */}
                {(() => {
                  const effectiveList = getEffectiveTeamPlayers(matchState.players[1]).filter((p) => !p.isDummy);
                  if (effectiveList.length <= 1) return null;
                  const info = getShooterInfo(matchState.players[1], { ignoreDummy: true, gameMode: 'CRICKET' });
                  const isCurrentThrowing = matchState.activePlayerIndex === 1 && matchState.status === 'active';
                  return (
                    <div className={`mt-1 p-1.5 rounded-lg text-xs font-sans border text-left transition-all ${
                      isCurrentThrowing
                        ? 'bg-indigo-50 border-indigo-200 text-slate-800 ring-1 ring-indigo-300/50'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <div className="flex items-center justify-between font-bold text-[9px] uppercase mb-0.5">
                        <span className="text-slate-500">🎯 Shooter Up</span>
                      </div>
                      <div className="flex items-center gap-1 font-extrabold text-[11px]">
                        <span>{info.avatar}</span>
                        <span className="truncate text-slate-900 font-black">
                          {info.shooterName}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 font-mono">
            {cricketSectors.map((sec) => {
              const label =
                sec === 25
                  ? '🔴 Bull'
                  : sec === 'doubles'
                  ? '🎯 2X'
                  : sec === 'triples'
                  ? '🚀 3X'
                  : `${sec}`;

              const isP1Active = matchState.activePlayerIndex === 0 && matchState.status === 'active';
              const isP2Active = matchState.activePlayerIndex === 1 && matchState.status === 'active';
              const isLatestActiveP1 = isP1Active && sec === latestSector && currentHits.length > 0;
              const isLatestActiveP2 = isP2Active && sec === latestSector && currentHits.length > 0;

              return (
                <tr
                  key={sec}
                  className={`transition-colors ${
                    (isLatestActiveP1 || isLatestActiveP2)
                      ? 'bg-indigo-50/70 ring-2 ring-indigo-400'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Player 1: 3 Squares */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-left">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center justify-start">
                        {renderThreeSquares(0, sec)}
                      </div>

                      {/* Submit button specifically under the section / number they last marked */}
                      {isLatestActiveP1 && (
                        <div className="inline-flex items-center gap-1.5 pt-1 animate-fadeIn">
                          <button
                            type="button"
                            id={`row-submit-p1-${sec}`}
                            onClick={handleSubmitTurn}
                            className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ring-2 ring-emerald-400/50 touch-manipulation"
                            title="Submit Turn"
                          >
                            <CornerDownLeft className="w-4 h-4" />
                            <span>Submit (+{totalXMarksThisTurn}X)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleUndoDart}
                            className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs sm:text-sm rounded-lg border border-amber-300 transition-all active:scale-95 cursor-pointer flex items-center gap-1 touch-manipulation"
                            title="Undo throw"
                          >
                            <Undo2 className="w-4 h-4" />
                            <span>Undo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Target Segment Label */}
                  <td className="py-2.5 sm:py-3.5 px-2 text-center font-black text-sm sm:text-base md:text-lg text-slate-900 font-sans tracking-wide">
                    <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 rounded-lg border border-slate-300 inline-block shadow-xs font-black whitespace-nowrap text-slate-900">
                      {label}
                    </span>
                  </td>

                  {/* Player 2: 3 Squares */}
                  <td className="py-2.5 sm:py-3.5 px-2 sm:px-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center justify-end">
                        {renderThreeSquares(1, sec)}
                      </div>

                      {/* Submit button specifically under the section / number they last marked */}
                      {isLatestActiveP2 && (
                        <div className="inline-flex items-center gap-1.5 pt-1 animate-fadeIn">
                          <button
                            type="button"
                            onClick={handleUndoDart}
                            className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs sm:text-sm rounded-lg border border-amber-300 transition-all active:scale-95 cursor-pointer flex items-center gap-1 touch-manipulation"
                            title="Undo throw"
                          >
                            <Undo2 className="w-4 h-4" />
                            <span>Undo</span>
                          </button>
                          <button
                            type="button"
                            id={`row-submit-p2-${sec}`}
                            onClick={handleSubmitTurn}
                            className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm uppercase rounded-lg shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ring-2 ring-emerald-400/50 touch-manipulation"
                            title="Submit Turn"
                          >
                            <CornerDownLeft className="w-4 h-4" />
                            <span>Submit (+{totalXMarksThisTurn}X)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cricket Input & Turn Submission Panel */}
      {matchState.status === 'active' && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-5 max-w-2xl mx-auto space-y-3 shadow-xs">
          {/* Active Thrower Header */}
          <div className="bg-slate-50 p-2 sm:p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                Current Thrower
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-indigo-600 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                {activePlayer.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                id="cricket-header-missed-all-btn"
                onClick={handleMissedAllTargets}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-[10px] font-black uppercase rounded border border-rose-300 flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer touch-manipulation"
                title="Missed all targets (0 marks) — go to next player's turn"
              >
                <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-600" />
                <span>Missed All</span>
              </button>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                  Darts
                </span>
                <span className="text-[11px] font-black font-mono px-2 py-0.2 bg-indigo-100 text-indigo-800 rounded-full inline-block mt-0.5">
                  {totalDartsThrown} Dart{totalDartsThrown === 1 ? '' : 's'} &bull; {totalXMarksThisTurn} X
                </span>
              </div>
            </div>
          </div>

          {/* Quick Segment Tap Keypad for Direct Entry */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Quick Tap Segments (Tap square/button to add X):</span>
              <span className="text-xs text-slate-400 font-normal">
                3 X's to close
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
              {cricketSectors.map((sec) => {
                const currentEffMarks = getEffectiveMarks(matchState.activePlayerIndex, sec);
                const isClosed = currentEffMarks >= 3;

                const label =
                  sec === 25
                    ? '🔴 Bull'
                    : sec === 'doubles'
                    ? '🎯 2X'
                    : sec === 'triples'
                    ? '🚀 3X'
                    : `${sec}`;

                return (
                  <button
                    key={sec}
                    type="button"
                    disabled={isClosed}
                    onClick={() => handleAddDart(sec, 1)}
                    className={`py-3 px-2 sm:py-3.5 sm:px-3 rounded-xl border-2 font-mono font-bold text-sm sm:text-base flex flex-col items-center justify-center transition-all select-none active:scale-95 touch-manipulation min-h-[64px] sm:min-h-[72px] ${
                      isClosed
                        ? 'bg-slate-900 text-emerald-400 border-slate-700 opacity-80 cursor-default shadow-inner'
                        : currentEffMarks > 0
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-400 ring-2 ring-indigo-200 shadow-sm'
                        : 'bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-900 border-slate-300 cursor-pointer shadow-xs'
                    }`}
                  >
                    <span className="font-black text-sm sm:text-base leading-tight">{label}</span>
                    <div className="flex items-center gap-1 mt-1.5">
                      {[1, 2, 3].map((sq) => (
                        <span
                          key={sq}
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm text-xs font-mono font-black flex items-center justify-center border-2 ${
                            sq <= currentEffMarks
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-300 border-slate-300'
                          }`}
                        >
                          {sq <= currentEffMarks ? 'X' : ''}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Turn Throws List & Undo Control */}
          {currentHits.length > 0 && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700">
                  Current Turn ({totalDartsThrown} Dart{totalDartsThrown === 1 ? '' : 's'}):
                </span>
                <button
                  type="button"
                  onClick={handleUndoDart}
                  className="px-1.5 py-0.2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[10px] flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Undo2 className="w-2.5 h-2.5" /> Undo Last Throw
                </button>
              </div>

              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-0.5">
                {currentHits.map((hit, idx) => (
                  <div
                    key={idx}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-2xs ${
                      hit.multiplier === 0
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <span>
                      #{idx + 1}: {hit.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDart(idx)}
                      className="hover:text-rose-300 transition-colors ml-0.5 cursor-pointer text-[10px]"
                      title="Remove this throw"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Turn Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              id="cricket-missed-all-btn"
              onClick={handleMissedAllTargets}
              className="py-2 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 font-black text-[11px] uppercase rounded-lg border border-rose-200 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Missed all targets (0 marks) — advances immediately to next player"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-600" /> Missed All
            </button>

            <button
              type="button"
              id="cricket-add-miss-btn"
              onClick={handleAddMiss}
              className="py-2 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] uppercase rounded-lg border border-slate-200 flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="Add 1 miss dart (0 X)"
            >
              <XSquare className="w-3 h-3 text-slate-500" /> 1 Miss (0 X)
            </button>

            <button
              type="button"
              id="cricket-undo-throw-btn"
              disabled={currentHits.length === 0 && historyStack.length === 0}
              onClick={handleUndoLastTurn}
              className="py-2 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] uppercase rounded-lg border border-amber-200 flex items-center justify-center gap-1 transition-all disabled:opacity-40 active:scale-95 cursor-pointer"
              title="Undo last throw or turn"
            >
              <Undo2 className="w-3 h-3 text-amber-700" /> Undo Throw
            </button>

            <button
              type="button"
              id="cricket-clear-turn-btn"
              disabled={currentHits.length === 0}
              onClick={handleClearTurn}
              className="py-2 px-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] uppercase rounded-lg border border-rose-200 flex items-center justify-center gap-1 transition-all disabled:opacity-40 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-rose-600" /> Clear
            </button>
          </div>

          {/* Submit Turn & Missed All Row */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <button
              type="button"
              id="cricket-missed-all-submit-bar-btn"
              onClick={handleMissedAllTargets}
              className="sm:w-5/12 py-2.5 sm:py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Missed all targets (0 marks) — advances immediately to next player"
            >
              <XCircle className="w-4 h-4 text-rose-200" />
              <span>Missed All Targets</span>
            </button>

            <button
              type="button"
              id="cricket-submit-turn-btn"
              disabled={currentHits.length === 0}
              onClick={() => handleSubmitTurn()}
              className="flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <CornerDownLeft className="w-3.5 h-3.5" /> SUBMIT TURN ({totalDartsThrown} DART
              {totalDartsThrown === 1 ? '' : 'S'} &bull; +{totalXMarksThisTurn} X MARK
              {totalXMarksThisTurn === 1 ? '' : 'S'})
            </button>
          </div>
        </div>
      )}

      {/* Email Report Modal */}
      <MatchReportEmailModal
        matchState={matchState}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />
      </>
      )}
      {/* Optional Final Game Prompt (Game 6: 1001 Straight In / Double Out) */}
      {showOptionalFinalModal && pendingMedleyState && (
        <OptionalFinalGameModal
          isOpen={showOptionalFinalModal}
          matchState={matchState}
          onUndo={() => {
            setShowOptionalFinalModal(false);
            setPendingMedleyState(null);
            handleUndoFinishingShot();
          }}
          onPlayFinalGame={() => {
            const nextState = buildNextMedleyMatchState(
              matchState,
              activePlayer.id,
              pendingMedleyState.completedLegRecord
            );
            setShowOptionalFinalModal(false);
            setPendingMedleyState(null);
            onUpdateMatch(nextState);
          }}
          onEndMatch={() => {
            const finalizedMatchState = finalizeMedleyMatchState(
              matchState,
              activePlayer.id,
              pendingMedleyState.completedLegRecord
            );

            setShowOptionalFinalModal(false);
            setPendingMedleyState(null);

            // Transition to Round of Bulls for Tuesday, Wednesday, Thursday, or Medley!
            if (
              matchState.settings.isMedley &&
              matchState.settings.leagueType !== 'tuesday' &&
              matchState.settings.leagueType !== 'wednesday' &&
              matchState.settings.leagueType !== 'thursday'
            ) {
              onUpdateMatch(finalizedMatchState);
              setShowBullsModal(true);
            } else {
              const fullyCompleted: MatchState = {
                ...finalizedMatchState,
                status: 'completed',
              };
              onUpdateMatch(fullyCompleted);
              setShowEmailModal(true);
            }
          }}
        />
      )}

      {/* Round of Bulls Challenge Modal (Wednesday Teams) */}
      {showBullsModal && (
        <BullsRoundModal
          isOpen={showBullsModal}
          matchState={matchState}
          onSaveAndComplete={(finalizedState) => {
            setShowBullsModal(false);
            onUpdateMatch(finalizedState);
            setShowEmailModal(true);
          }}
          onClose={() => setShowBullsModal(false)}
        />
      )}

      {/* Winner / Leg Completion Modal */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg text-white">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {winnerModal.type === 'match' ? 'MATCH VICTORY!' : 'GAME / LEG WON!'}
            </h2>
            <p className="text-indigo-600 font-extrabold text-lg mb-2">
              {winnerModal.playerName}
            </p>

            {winnerModal.type === 'leg' && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 mb-4 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                  Current Match Standing
                </span>
                <div className="flex items-center justify-center gap-3 font-mono font-black text-base text-slate-900">
                  <span>{matchState.players[0]?.name || 'Player 1'}: <strong className="text-indigo-600">{winnerModal.p1Score ?? matchState.players[0]?.legsWon}</strong></span>
                  <span className="text-slate-400">&bull;</span>
                  <span>{matchState.players[1]?.name || 'Player 2'}: <strong className="text-indigo-600">{winnerModal.p2Score ?? matchState.players[1]?.legsWon}</strong></span>
                </div>
              </div>
            )}

            <p className="text-slate-500 text-xs mb-5">
              {winnerModal.type === 'match'
                ? 'Congratulations! Match completed with cricket marks recorded.'
                : `${winnerModal.nextGameLabel || 'Next Leg'} is ready to begin.`}
            </p>

            <div className="flex flex-col gap-2">
              {winnerModal.type === 'match' ? (
                <>
                  <button
                    onClick={() => {
                      setWinnerModal(null);
                      setShowEmailModal(true);
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-widest rounded flex items-center justify-center gap-2 transition-colors shadow-md cursor-pointer"
                  >
                    <Mail className="w-4 h-4" /> EMAIL MATCH RESULTS
                  </button>

                  {onReturnToLeague && (
                    <button
                      onClick={() => {
                        setWinnerModal(null);
                        onReturnToLeague();
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-widest rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trophy className="w-4 h-4 text-amber-300" /> RETURN TO LEAGUE
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setWinnerModal(null);
                      onNewMatchRequest();
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-widest rounded transition-colors cursor-pointer"
                  >
                    START NEW MATCH
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (pendingNextState) {
                      onUpdateMatch(pendingNextState);
                      setPendingNextState(null);
                    }
                    setWinnerModal(null);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  CONTINUE TO NEXT GAME &rarr;
                </button>
              )}

              {/* Undo Finishing Score Button inside Modal */}
              <button
                type="button"
                onClick={handleUndoFinishingShot}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs mt-1"
              >
                <Undo2 className="w-4 h-4 text-amber-700" />
                <span>Undo Last Score / Correct Turn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
