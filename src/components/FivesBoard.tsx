import React, { useState, useEffect } from 'react';
import { MatchState, Player, TurnLog } from '../types';
import { Trophy, RefreshCw, Undo2, Target, Users, Bot, Sparkles, Mail, CheckCircle2, AlertCircle, ArrowDownCircle, Flame, XSquare, ArrowUpDown } from 'lucide-react';
import { MatchReportEmailModal } from './MatchReportEmailModal';
import { BullsRoundModal } from './BullsRoundModal';
import {
  getRecipientEmail,
  getNativeMailtoUrl,
  openMailtoLink,
  generateMatchEmailReport,
} from '../utils/emailReportHelper';
import { TeamShootingOrderModal } from './TeamShootingOrderModal';
import { announcer } from '../utils/audio';
import { getShooterInfo, advancePlayerSubShooter, announceCurrentShooter, getEffectiveTeamPlayers, updateSubPlayerStatsOnTurn, ShooterOptions } from '../utils/shooterHelper';
import { buildNextMedleyMatchState } from '../utils/medleyHelper';
import { recordWednesdayLegStats, updateLeaguePoints } from '../utils/leagueHelper';
import confetti from 'canvas-confetti';

interface FivesBoardProps {
  matchState: MatchState;
  onUpdateMatch: (updatedState: MatchState) => void;
  onNewMatchRequest: () => void;
  onReturnToLeague?: () => void;
}

export const FivesBoard: React.FC<FivesBoardProps> = ({
  matchState,
  onUpdateMatch,
  onNewMatchRequest,
  onReturnToLeague,
}) => {
  const targetGoal = matchState.settings.fivesTarget || 101;
  const [customInput, setCustomInput] = useState<string>('');
  const [inputMode, setInputMode] = useState<'quick' | 'darts' | 'keypad'>('quick');

  // 3-Dart interactive picker state
  const [dart1, setDart1] = useState<{ mult: number; val: number }>({ mult: 0, val: 0 });
  const [dart2, setDart2] = useState<{ mult: number; val: number }>({ mult: 0, val: 0 });
  const [dart3, setDart3] = useState<{ mult: number; val: number }>({ mult: 0, val: 0 });
  const [activeDartSlot, setActiveDartSlot] = useState<1 | 2 | 3>(1);
  const [selectedMult, setSelectedMult] = useState<1 | 2 | 3>(1);

  const [winnerModal, setWinnerModal] = useState<{
    playerName: string;
    type: 'leg' | 'match';
    nextGameLabel?: string;
    p1Score?: number;
    p2Score?: number;
  } | null>(null);
  const [pendingNextState, setPendingNextState] = useState<MatchState | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showBullsModal, setShowBullsModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Initialize player fivesScore if not yet set
  useEffect(() => {
    let needsInit = false;
    const initializedPlayers = matchState.players.map((p) => {
      if (p.fivesScore === undefined) {
        needsInit = true;
        return {
          ...p,
          fivesScore: targetGoal,
          fivesPointsEarned: 0,
        };
      }
      return p;
    });

    if (needsInit) {
      onUpdateMatch({
        ...matchState,
        players: initializedPlayers,
      });
    }
  }, [matchState, targetGoal]);

  const activePlayer = matchState.players[matchState.activePlayerIndex];
  const activeRemaining = activePlayer?.fivesScore ?? targetGoal;

  // Announce thrower when leg / game starts
  useEffect(() => {
    if (matchState.status === 'active' && activePlayer) {
      if (matchState.settings.announceAudio) {
        announceCurrentShooter(activePlayer, 300, { gameMode: 'FIVES', remainingScore: activeRemaining });
      }
    }
  }, [matchState.currentLeg, matchState.status]);

  // Calculate 3-dart picker sum
  const dartsSum = (dart1.mult * dart1.val) + (dart2.mult * dart2.val) + (dart3.mult * dart3.val);
  const isDartsSumDivisible = dartsSum > 0 && dartsSum % 5 === 0;
  const dartsPointsEarned = isDartsSumDivisible ? dartsSum / 5 : 0;

  // Calculate custom input points
  const numCustom = parseInt(customInput) || 0;
  const isCustomDivisible = numCustom > 0 && numCustom % 5 === 0;
  const customPointsEarned = isCustomDivisible ? numCustom / 5 : 0;

  // Process a turn with total dart score
  const handleScoreSubmit = (dartTotalScore: number, dartsDetailText?: string) => {
    if (dartTotalScore < 0 || dartTotalScore > 180) return;

    const isDivisible = dartTotalScore > 0 && dartTotalScore % 5 === 0;
    const points = isDivisible ? dartTotalScore / 5 : 0;

    const currentRemaining = activePlayer.fivesScore ?? targetGoal;
    let newRemaining = currentRemaining;
    let isBust = false;
    let isCheckout = false;

    const shooterOptions: ShooterOptions = {
      gameMode: 'FIVES',
      remainingScore: currentRemaining,
    };
    const shooterInfo = getShooterInfo(activePlayer, shooterOptions);

    if (isDivisible && points > 0) {
      if (currentRemaining - points < 0) {
        // Bust: exceeded remaining score
        isBust = true;
        newRemaining = currentRemaining;
        if (matchState.settings.announceAudio) {
          announcer.announceBust();
        }
      } else if (currentRemaining - points === 0) {
        // Leg Check / Victory!
        isCheckout = true;
        newRemaining = 0;
      } else {
        newRemaining = currentRemaining - points;
        if (matchState.settings.announceAudio) {
          announcer.announceScore(dartTotalScore);
        }
      }
    } else {
      // 0 points scored
      if (matchState.settings.announceAudio && dartTotalScore === 0) {
        announcer.announceScore(0);
      }
    }

    const newPointsEarnedTotal = (activePlayer.fivesPointsEarned || 0) + (isBust ? 0 : points);

    const updatedPlayers = matchState.players.map((p, idx) => {
      if (idx === matchState.activePlayerIndex) {
        // Stats credited to Dummy if it's Dummy's turn
        const updatedSubPlayers = updateSubPlayerStatsOnTurn(
          p,
          isBust ? 0 : dartTotalScore,
          3,
          currentRemaining,
          isBust,
          isCheckout,
          shooterOptions
        );

        const subProgression = advancePlayerSubShooter(p, {
          gameMode: 'FIVES',
          remainingScore: newRemaining,
        });

        return {
          ...p,
          fivesScore: newRemaining,
          fivesPointsEarned: newPointsEarnedTotal,
          teamPlayers: updatedSubPlayers || p.teamPlayers,
          currentSubPlayerIndex: subProgression.currentSubPlayerIndex,
          dummyShooterIndices: subProgression.dummyShooterIndices,
          lastRealShooterIndex: subProgression.lastRealShooterIndex,
          stats: {
            ...p.stats,
            dartsThrown: p.stats.dartsThrown + 3,
            highScore: Math.max(p.stats.highScore, dartTotalScore),
            count60Plus: p.stats.count60Plus + (dartTotalScore >= 60 && dartTotalScore < 100 ? 1 : 0),
            count100Plus: p.stats.count100Plus + (dartTotalScore >= 100 && dartTotalScore < 140 ? 1 : 0),
            count140Plus: p.stats.count140Plus + (dartTotalScore >= 140 && dartTotalScore < 180 ? 1 : 0),
            count180: p.stats.count180 + (dartTotalScore === 180 ? 1 : 0),
          },
        };
      }
      return p;
    });

    const detailString = dartsDetailText || (
      isDivisible
        ? `Scored ${dartTotalScore} (${points} pts off)`
        : dartTotalScore === 0
        ? `No Score (0 pts)`
        : `Scored ${dartTotalScore} (Not ÷5, 0 pts)`
    );

    const newTurnLog: TurnLog = {
      id: 'turn-' + Date.now(),
      turnNumber: matchState.history.length + 1,
      playerId: activePlayer.id,
      playerName: activePlayer.name,
      score: dartTotalScore,
      remainingBefore: currentRemaining,
      remainingAfter: newRemaining,
      dartsUsed: 3,
      isBust,
      isCheckout,
      dartsDetail: [detailString],
      timestamp: Date.now(),
      shooterName: shooterInfo.isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      isDummyTurn: shooterInfo.isDummyTurn,
      dummyRotatedPlayerName: shooterInfo.dummyRotatedPlayerName,
      creditedPlayerName: shooterInfo.isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      subPlayerIndex: activePlayer.currentSubPlayerIndex,
      dummyShooterIndices: activePlayer.dummyShooterIndices ? { ...activePlayer.dummyShooterIndices } : undefined,
      lastRealShooterIndex: activePlayer.lastRealShooterIndex,
    };

    // Reset inputs
    setCustomInput('');
    setDart1({ mult: 0, val: 0 });
    setDart2({ mult: 0, val: 0 });
    setDart3({ mult: 0, val: 0 });
    setActiveDartSlot(1);

    if (isCheckout) {
      try { confetti({ particleCount: 120, spread: 80 }); } catch (e) {}
      const newLegsWon = activePlayer.legsWon + 1;
      let isMatchOver = false;
      if (matchState.settings.format === 'legs') {
        if (newLegsWon >= matchState.settings.legsToWin) {
          isMatchOver = true;
        }
      }

      const legRecord = {
        legNumber: matchState.currentLeg,
        setNumber: matchState.currentSet,
        gameMode: 'FIVES' as const,
        winnerId: activePlayer.id,
        winnerName: activePlayer.name,
        turns: [...matchState.history, newTurnLog],
        dartsCount: {
          [updatedPlayers[0].id]: updatedPlayers[0].stats.dartsThrown,
          [updatedPlayers[1].id]: updatedPlayers[1].stats.dartsThrown,
        },
        averages: {
          [updatedPlayers[0].id]: updatedPlayers[0].fivesPointsEarned || 0,
          [updatedPlayers[1].id]: updatedPlayers[1].fivesPointsEarned || 0,
        },
      };

      const resetPlayers = updatedPlayers.map((p) => {
        if (p.id === activePlayer.id) {
          return {
            ...p,
            legsWon: newLegsWon,
            fivesScore: targetGoal,
            fivesPointsEarned: 0,
          };
        }
        return {
          ...p,
          fivesScore: targetGoal,
          fivesPointsEarned: 0,
        };
      });

      const isMedley = !!(matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY');

      if (isMedley) {
        const nextMedleyState = buildNextMedleyMatchState(matchState, activePlayer.id, legRecord);
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
              playerName: activePlayer.name,
              type: 'match',
            });
          }
        } else {
          setPendingNextState(nextMedleyState);
          setWinnerModal({
            playerName: activePlayer.name,
            type: 'leg',
            nextGameLabel: `Game ${nextMedleyState.currentLeg} (${nextMedleyState.currentGameMode})`,
            p1Score: nextMedleyState.players[0]?.legsWon || 0,
            p2Score: nextMedleyState.players[1]?.legsWon || 0,
          });
        }
        return;
      }

      // If standalone match under Wednesday League, record individual Wednesday stats
      if (matchState.settings.leagueType === 'wednesday') {
        try {
          recordWednesdayLegStats(legRecord, matchState);
          const winner = matchState.players.find((p) => p.id === activePlayer.id);
          const loser = matchState.players.find((p) => p.id !== activePlayer.id);
          if (winner && loser) {
            updateLeaguePoints(winner.name, loser.name, 'wednesday', matchState.players);
          }
        } catch (e) {
          console.error('Error recording standalone Wednesday Fives stats', e);
        }
      }

      const updatedMatchState: MatchState = {
        ...matchState,
        status: isMatchOver ? 'completed' : 'active',
        players: resetPlayers,
        currentLeg: isMatchOver ? matchState.currentLeg : matchState.currentLeg + 1,
        activePlayerIndex: 0,
        history: [...matchState.history, newTurnLog],
        completedLegs: [...matchState.completedLegs, legRecord],
        winnerId: isMatchOver ? activePlayer.id : undefined,
      };

      if (!isMatchOver) {
        setPendingNextState(updatedMatchState);
        setWinnerModal({
          playerName: activePlayer.name,
          type: 'leg',
          nextGameLabel: `Leg ${matchState.currentLeg + 1}`,
          p1Score: resetPlayers[0]?.legsWon || 0,
          p2Score: resetPlayers[1]?.legsWon || 0,
        });
      } else {
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
            playerName: activePlayer.name,
            type: 'match',
          });
        }
      }
    } else {
      const nextPlayerIdx = (matchState.activePlayerIndex + 1) % matchState.players.length;
      const nextShooterPlayer = updatedPlayers[nextPlayerIdx];
      if (matchState.settings.announceAudio && nextShooterPlayer) {
        announceCurrentShooter(nextShooterPlayer, 400, {
          gameMode: 'FIVES',
          remainingScore: nextShooterPlayer.fivesScore ?? targetGoal,
        });
      }

      onUpdateMatch({
        ...matchState,
        players: updatedPlayers,
        activePlayerIndex: nextPlayerIdx,
        history: [...matchState.history, newTurnLog],
      });
    }
  };

  // Undo last turn
  const handleUndo = () => {
    if (matchState.history.length === 0) return;
    const lastLog = matchState.history[matchState.history.length - 1];
    const prevHistory = matchState.history.slice(0, -1);

    const updatedPlayers = matchState.players.map((p) => {
      if (p.id === lastLog.playerId) {
        const pointsDeducted = lastLog.isBust ? 0 : (lastLog.remainingBefore - lastLog.remainingAfter);
        return {
          ...p,
          fivesScore: lastLog.remainingBefore,
          fivesPointsEarned: Math.max(0, (p.fivesPointsEarned || 0) - pointsDeducted),
          currentSubPlayerIndex: lastLog.subPlayerIndex !== undefined ? lastLog.subPlayerIndex : p.currentSubPlayerIndex,
          dummyShooterIndices: lastLog.dummyShooterIndices ? { ...lastLog.dummyShooterIndices } : p.dummyShooterIndices,
          lastRealShooterIndex: lastLog.lastRealShooterIndex !== undefined ? lastLog.lastRealShooterIndex : p.lastRealShooterIndex,
        };
      }
      return p;
    });

    const lastPlayerIdx = matchState.players.findIndex((p) => p.id === lastLog.playerId);
    const targetShooter = updatedPlayers[lastPlayerIdx !== -1 ? lastPlayerIdx : 0];
    if (matchState.settings.announceAudio && targetShooter) {
      announceCurrentShooter(targetShooter, 300, {
        gameMode: 'FIVES',
        remainingScore: targetShooter.fivesScore ?? targetGoal,
      });
    }

    onUpdateMatch({
      ...matchState,
      players: updatedPlayers,
      activePlayerIndex: lastPlayerIdx !== -1 ? lastPlayerIdx : matchState.activePlayerIndex,
      history: prevHistory,
    });
  };

  // 3-Dart picker segment click handler
  const handleDartSegmentClick = (segmentVal: number) => {
    const dartObj = { mult: segmentVal === 0 ? 0 : selectedMult, val: segmentVal };
    if (activeDartSlot === 1) {
      setDart1(dartObj);
      setActiveDartSlot(2);
    } else if (activeDartSlot === 2) {
      setDart2(dartObj);
      setActiveDartSlot(3);
    } else {
      setDart3(dartObj);
    }
  };

  // Preset scores divisible by 5
  const quickFivesPresets = [
    { score: 5, pts: 1 },
    { score: 10, pts: 2 },
    { score: 15, pts: 3 },
    { score: 20, pts: 4 },
    { score: 25, pts: 5 },
    { score: 30, pts: 6 },
    { score: 35, pts: 7 },
    { score: 40, pts: 8 },
    { score: 45, pts: 9 },
    { score: 50, pts: 10 },
    { score: 55, pts: 11 },
    { score: 60, pts: 12 },
    { score: 65, pts: 13 },
    { score: 70, pts: 14 },
    { score: 75, pts: 15 },
    { score: 80, pts: 16 },
    { score: 85, pts: 17 },
    { score: 90, pts: 18 },
    { score: 95, pts: 19 },
    { score: 100, pts: 20 },
    { score: 105, pts: 21 },
    { score: 110, pts: 22 },
    { score: 115, pts: 23 },
    { score: 120, pts: 24 },
    { score: 125, pts: 25 },
    { score: 130, pts: 26 },
    { score: 135, pts: 27 },
    { score: 140, pts: 28 },
    { score: 145, pts: 29 },
    { score: 150, pts: 30 },
    { score: 160, pts: 32 },
    { score: 180, pts: 36 },
  ];

  const isMatchComplete = matchState.status === 'completed';
  const winnerPlayer =
    matchState.players.find((p) => p.id === matchState.winnerId) ||
    (matchState.players[0].legsWon > matchState.players[1].legsWon
      ? matchState.players[0]
      : matchState.players[1]);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4 space-y-3 pb-8">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-4 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="px-2 py-0.2 bg-emerald-500 text-slate-950 rounded font-black text-[10px] uppercase tracking-wider">
                Fives ({targetGoal} Goal)
              </span>
              <span className="px-2 py-0.2 bg-indigo-600/60 text-white rounded font-bold text-[10px] uppercase tracking-wider">
                {isMatchComplete ? 'Match Complete' : `Leg ${matchState.currentLeg}`}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-1.5 text-white">
              <span>🖐️ Game of Fives</span>
              <span className="text-slate-400 font-normal text-xs">(Goal: {targetGoal} ➔ 0)</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Turn score ÷ 5 = Points deducted. Exact 0 wins.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {!isMatchComplete && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={matchState.history.length === 0}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1 transition-all uppercase tracking-wider cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
            )}

            <button
              onClick={() => setShowEmailModal(true)}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition-colors uppercase tracking-wider cursor-pointer shadow-xs"
            >
              <Mail className="w-3 h-3" /> Email
            </button>

            {onReturnToLeague && (
              <button
                onClick={onReturnToLeague}
                className="px-2.5 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg border border-indigo-500 transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1"
              >
                <Trophy className="w-3 h-3 text-amber-300" /> League
              </button>
            )}

            {matchState.players.some(p => (p.teamPlayers && p.teamPlayers.length > 1) || p.name.toLowerCase().includes('dummy')) && (
              <button
                type="button"
                onClick={() => setShowOrderModal(true)}
                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg border border-slate-600 transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1 shadow-xs"
                title="Adjust Team Throwing Order"
              >
                <ArrowUpDown className="w-3 h-3 text-emerald-400" /> Order
              </button>
            )}

            <button
              onClick={onNewMatchRequest}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
            >
              New Match
            </button>
          </div>
        </div>

        {/* Quick Rule Reminder Bar */}
        {!isMatchComplete && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Divisible by 5: 25 = 5 pts • 50 = 10 pts • 100 = 20 pts • 180 = 36 pts</span>
            </div>
            <div className="text-slate-400 font-medium text-[10px]">
              Non-divisible scores award 0 points.
            </div>
          </div>
        )}
      </div>

      {isMatchComplete ? (
        /* DEDICATED FIVES MATCH COMPLETED VIEW (NO EXTRA GAME OR ACTIVE CONTROLS) */
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
                <button
                  type="button"
                  onClick={handleUndo}
                  title="Accidental finishing score? Undo and resume match"
                  className="flex-1 md:flex-none px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" /> Undo Finishing Score
                </button>

                <a
                  href={getNativeMailtoUrl(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  onClick={() => openMailtoLink(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  id="fives-share-results-email-btn"
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
                      <span className="text-emerald-600 font-mono">Game {lIdx + 1}: {leg.gameMode || 'FIVES'}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points Earned</span>
                      <span className="text-base font-mono font-black text-emerald-600">
                        {player.fivesPointsEarned || 0}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Darts Thrown</span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.stats.dartsThrown}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Legs Won</span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.legsWon}
                      </span>
                    </div>
                  </div>

                  {/* Sub-player breakdown for teams */}
                  {player.teamPlayers && player.teamPlayers.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Team Roster Individual Stats
                      </span>
                      <div className="space-y-1.5">
                        {player.teamPlayers.map((subP, sIdx) => (
                          <div key={`fives-sub-${player.id}-${subP.id || sIdx}`} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg">
                            <span className="font-bold text-slate-700">{subP.name}</span>
                            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                              <span>Darts: <strong>{subP.stats.dartsThrown}</strong></span>
                              <span>Fives Score: <strong className="text-emerald-600">{subP.fivesScore || 0}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Prominent Active Turn & Individual Shooter Banner */}
          {matchState.status === 'active' && activePlayer && (() => {
            const activeShooter = getShooterInfo(activePlayer, {
              gameMode: 'FIVES',
              remainingScore: activePlayer.fivesScore ?? targetGoal,
            });
            const effectiveList = getEffectiveTeamPlayers(activePlayer);
            const nextShooter = activeShooter.nextShooterName;

            return (
              <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-2 border-emerald-500/60 rounded-xl p-2.5 sm:p-3 text-white shadow-md flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-lg font-black shadow-inner shrink-0">
                    {activeShooter.avatar || '🎯'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md animate-pulse">
                        🎯 Turn
                      </span>
                      <span className="text-[11px] text-slate-300 font-semibold truncate">
                        {activePlayer.teamPlayers && activePlayer.teamPlayers.length > 0 ? activePlayer.name : `Player ${matchState.activePlayerIndex + 1}`}
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-black text-white truncate mt-0.5 flex items-center gap-1.5">
                      <span className="text-amber-300 underline decoration-emerald-400/80 decoration-2 underline-offset-2">
                        {activeShooter.isDummyTurn && activeShooter.dummyRotatedPlayerName
                          ? `${activeShooter.dummyRotatedPlayerName} (shooting for Dummy)`
                          : activeShooter.shooterName}
                      </span>
                      {effectiveList.length > 1 && (() => {
                        const cleanTeam = activePlayer.name.replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '').trim();
                        if (cleanTeam && cleanTeam !== activeShooter.shooterName) {
                          return (
                            <span className="text-[11px] text-slate-300 font-normal truncate">
                              ({cleanTeam})
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </h2>
                    {nextShooter && (
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5 flex items-center gap-1">
                        <span>On deck:</span>
                        <span className="text-slate-200 font-semibold">{nextShooter}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Remaining</span>
                  <span className="text-base sm:text-xl font-mono font-black text-emerald-400 leading-none">
                    {activePlayer.fivesScore ?? targetGoal}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Players Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {matchState.players.map((player, pIdx) => {
          const isActive = pIdx === matchState.activePlayerIndex;
          const remaining = player.fivesScore ?? targetGoal;
          const earned = player.fivesPointsEarned ?? 0;

          return (
            <div
              key={player.id}
              className={`rounded-xl p-2.5 sm:p-3 bg-white border transition-all shadow-2xs ${
                isActive
                  ? 'border-2 border-emerald-500 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl flex-shrink-0">{player.avatar || '🎯'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight truncate">{player.name}</h3>
                      {isActive && (
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded flex-shrink-0">
                          Turn
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Legs Won: {player.legsWon}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                  <span className={`text-2xl sm:text-3xl font-black font-mono leading-tight ${isActive ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {remaining}
                  </span>
                </div>
              </div>

              {/* Progress bar towards 0 */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[9px] font-bold text-slate-400">
                  <span>Start: {targetGoal}</span>
                  <span className="text-emerald-600 font-extrabold">{targetGoal - remaining} Pts</span>
                  <span>Goal: 0</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, ((targetGoal - remaining) / targetGoal) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Team rotation indicator if present */}
              {(() => {
                const effectiveList = getEffectiveTeamPlayers(player);
                if (effectiveList.length <= 1 && !effectiveList.some(p => p.isDummy)) return null;
                const info = getShooterInfo(player, {
                  gameMode: 'FIVES',
                  remainingScore: remaining,
                });
                return (
                  <div className="mt-1.5 p-1 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-500 uppercase tracking-wider text-[8px]">🎯 Shooter Up</span>
                      <button
                        type="button"
                        onClick={() => setShowOrderModal(true)}
                        title="Adjust Team Throwing Order"
                        className="px-1 py-0.2 bg-white hover:bg-emerald-50 text-emerald-700 font-extrabold rounded border border-slate-200 text-[8px] flex items-center gap-0.5 shadow-2xs cursor-pointer"
                      >
                        <ArrowUpDown className="w-2 h-2" />
                        <span>Order</span>
                      </button>
                    </div>
                    <span className="font-extrabold text-slate-900 flex items-center gap-1 truncate">
                      <span>{info.isDummyTurn ? '🤖' : (info.avatar || '🎯')}</span>
                      <span className="truncate">
                        {info.isDummyTurn ? (
                          <span>
                            🤖 Dummy <span className="text-amber-800 font-black underline">({info.dummyRotatedPlayerName || info.shooterName} shooting)</span>
                          </span>
                        ) : (
                          info.shooterName
                        )}
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Active Input Control Box */}
      <div className="bg-white border-2 border-emerald-600 rounded-xl p-2.5 sm:p-3.5 shadow-xs">
        {/* Tabs: Quick Presets / 3-Dart Builder / Custom Keypad */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🖐️</span>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block leading-tight">Active Turn</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                {(() => {
                  const activeShooter = getShooterInfo(activePlayer, {
                    gameMode: 'FIVES',
                    remainingScore: activeRemaining,
                  });
                  if (activeShooter.isDummyTurn && activeShooter.dummyRotatedPlayerName) {
                    return `${activeShooter.dummyRotatedPlayerName} (shooting for Dummy)`;
                  }
                  const teamClean = activePlayer?.name
                    ? activePlayer.name.replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '').trim()
                    : '';
                  if (teamClean && teamClean !== activeShooter.shooterName) {
                    return `${activeShooter.shooterName} (${teamClean})`;
                  }
                  return activeShooter.shooterName;
                })()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setInputMode('quick')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                inputMode === 'quick' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quick Presets
            </button>
            <button
              onClick={() => setInputMode('darts')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                inputMode === 'darts' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3-Dart Builder
            </button>
            <button
              onClick={() => setInputMode('keypad')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                inputMode === 'keypad' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Keypad
            </button>
          </div>

          {matchState.history.length > 0 && (
            <button
              onClick={handleUndo}
              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded flex items-center gap-1 text-[10px] font-bold transition-colors cursor-pointer"
              title="Undo last turn"
            >
              <Undo2 className="w-3 h-3" />
              <span className="hidden sm:inline">Undo</span>
            </button>
          )}
        </div>

        {/* MODE 1: Quick Divisible-by-5 Presets */}
        {inputMode === 'quick' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                Select 3-Dart Turn Score (Divisible by 5):
              </span>
              <button
                onClick={() => handleScoreSubmit(0, '0 Points (Miss / Not ÷5)')}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] rounded transition-colors border border-slate-200 cursor-pointer"
              >
                0 / No Score (0 Pts)
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {quickFivesPresets.map(({ score, pts }) => {
                const isCheck = activeRemaining - pts === 0;
                const isBust = activeRemaining - pts < 0;

                return (
                  <button
                    key={score}
                    onClick={() => handleScoreSubmit(score, `Scored ${score} (+${pts} pts)`)}
                    className={`p-1.5 rounded-lg border text-center transition-all active:scale-95 flex flex-col items-center justify-center cursor-pointer ${
                      isCheck
                        ? 'bg-amber-400 hover:bg-amber-500 border-amber-500 text-slate-950 font-black ring-1 ring-amber-300'
                        : isBust
                        ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 opacity-60'
                        : score === 25 || score === 50 || score === 100
                        ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="text-sm font-black font-mono leading-none">{score}</span>
                    <span className={`text-[8px] font-bold mt-0.5 ${isCheck ? 'text-slate-950' : isBust ? 'text-red-500' : score === 25 || score === 50 || score === 100 ? 'text-emerald-100' : 'text-emerald-600'}`}>
                      {isCheck ? 'WIN (0)' : isBust ? 'BUST' : `-${pts} pts`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 2: 3-Dart Interactive Board Builder */}
        {inputMode === 'darts' && (
          <div className="space-y-2.5">
            {/* Dart slots preview */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { slot: 1 as const, dart: dart1 },
                { slot: 2 as const, dart: dart2 },
                { slot: 3 as const, dart: dart3 },
              ].map(({ slot, dart }) => {
                const isSelected = activeDartSlot === slot;
                const val = dart.mult * dart.val;
                return (
                  <button
                    key={slot}
                    onClick={() => setActiveDartSlot(slot)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 border-2 border-emerald-600 ring-1 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Dart {slot}
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-0.5">
                      {val > 0 ? (
                        <span>
                          {dart.mult === 3 ? 'T' : dart.mult === 2 ? 'D' : 'S'}
                          {dart.val === 25 ? 'BULL' : dart.val} ({val})
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">Tap number</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sum & Divisibility indicator */}
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Turn Score</span>
                <span className="text-xl font-black text-slate-900 font-mono leading-none">{dartsSum}</span>
              </div>

              <div className="text-right">
                {isDartsSumDivisible ? (
                  <div className="text-emerald-600 font-black flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Divisible by 5! (-{dartsPointsEarned} pts)</span>
                  </div>
                ) : dartsSum === 0 ? (
                  <span className="text-slate-400 text-[10px] font-bold">No darts selected</span>
                ) : (
                  <div className="text-amber-600 font-bold flex items-center gap-1 text-[10px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Not divisible (0 pts)</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleScoreSubmit(dartsSum, `Dart 1: ${dart1.mult * dart1.val}, Dart 2: ${dart2.mult * dart2.val}, Dart 3: ${dart3.mult * dart3.val}`)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Submit Turn
              </button>
            </div>

            {/* Multiplier toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Multiplier:</span>
              {[
                { mult: 1 as const, label: 'Single (1x)' },
                { mult: 2 as const, label: 'Double (2x)' },
                { mult: 3 as const, label: 'Triple (3x)' },
              ].map(({ mult, label }) => (
                <button
                  key={mult}
                  onClick={() => setSelectedMult(mult)}
                  className={`px-2.5 py-1 rounded text-xs font-black transition-all cursor-pointer ${
                    selectedMult === mult
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => handleDartSegmentClick(0)}
                className="ml-auto px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded cursor-pointer"
              >
                Miss (0)
              </button>
            </div>

            {/* Number buttons 1 to 20 + Bull */}
            <div className="grid grid-cols-7 sm:grid-cols-11 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => (
                <button
                  key={num}
                  onClick={() => handleDartSegmentClick(num)}
                  className="py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 font-black font-mono text-xs border border-slate-200 transition-all active:scale-95 cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => handleDartSegmentClick(25)}
                className="py-1.5 col-span-2 sm:col-span-1 rounded bg-red-600 hover:bg-red-700 text-white font-black font-mono text-xs border border-red-700 transition-all active:scale-95 cursor-pointer"
              >
                BULL
              </button>
            </div>
          </div>
        )}

        {/* MODE 3: Custom Keypad */}
        {inputMode === 'keypad' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="180"
                placeholder="Score (0-180)..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-lg font-mono font-black text-slate-900 focus:border-emerald-500 outline-none"
              />

              <button
                onClick={() => handleScoreSubmit(numCustom)}
                disabled={customInput === ''}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Submit
              </button>
            </div>

            {customInput !== '' && (
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                {isCustomDivisible ? (
                  <span className="text-emerald-700 font-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Score {numCustom} is divisible by 5 ➔ Deducts {customPointsEarned} pts!
                  </span>
                ) : numCustom === 0 ? (
                  <span className="text-slate-500 font-bold">0 Score ➔ 0 points deducted</span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Score {numCustom} is not divisible by 5 ➔ 0 points deducted.
                  </span>
                )}
              </div>
            )}

            {/* Quick Keypad Digits */}
            <div className="grid grid-cols-3 gap-1.5 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => setCustomInput((prev) => prev + digit.toString())}
                  className="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono font-black text-base text-slate-900 border border-slate-200 cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setCustomInput('')}
                className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={() => setCustomInput((prev) => prev + '0')}
                className="py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-mono font-black text-base text-slate-900 border border-slate-200 cursor-pointer"
              >
                0
              </button>
              <button
                onClick={() => setCustomInput((prev) => prev.slice(0, -1))}
                className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider cursor-pointer"
              >
                Del
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Turn Activity Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Fives Turn Log</span>
          <span className="text-slate-400 font-normal">{matchState.history.length} turns recorded</span>
        </h3>

        {matchState.history.length === 0 ? (
          <p className="text-[11px] text-slate-400 font-mono py-1.5 text-center">No turns logged yet in this leg.</p>
        ) : (
          <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 text-[11px]">
            {matchState.history.slice(-3).reverse().map((turn) => (
              <div
                key={turn.id}
                className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="px-1 py-0.2 bg-slate-200 text-slate-700 rounded font-bold font-mono text-[10px] shrink-0">
                    #{turn.turnNumber}
                  </span>
                  <span className="font-bold text-slate-900 truncate">
                    {turn.isDummyTurn && turn.dummyRotatedPlayerName
                      ? `${turn.dummyRotatedPlayerName} (shooting for Dummy)`
                      : (turn.shooterName || turn.playerName)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-[10px]">
                    {turn.dartsDetail?.[0]}
                  </span>
                  {turn.isBust ? (
                    <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-100 text-[10px]">
                      BUST
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100 text-[10px]">
                      Rem: {turn.remainingAfter}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Victory Modal */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg text-slate-950">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {winnerModal.type === 'match' ? 'MATCH VICTORY!' : 'FIVES GAME / LEG WON!'}
            </h2>
            <p className="text-emerald-600 font-extrabold text-lg mb-2">
              {winnerModal.playerName}
            </p>

            {winnerModal.type === 'leg' && (
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 mb-4 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                  Current Match Standing
                </span>
                <div className="flex items-center justify-center gap-3 font-mono font-black text-base text-slate-900">
                  <span>{matchState.players[0]?.name || 'Player 1'}: <strong className="text-emerald-600">{winnerModal.p1Score ?? matchState.players[0]?.legsWon}</strong></span>
                  <span className="text-slate-400">&bull;</span>
                  <span>{matchState.players[1]?.name || 'Player 2'}: <strong className="text-emerald-600">{winnerModal.p2Score ?? matchState.players[1]?.legsWon}</strong></span>
                </div>
              </div>
            )}

            <p className="text-slate-500 text-xs mb-5">
              {winnerModal.type === 'match'
                ? 'Congratulations! Successfully reduced score to exactly 0 in Fives.'
                : `${winnerModal.nextGameLabel || 'Next Leg'} is ready to begin.`}
            </p>

            <div className="flex flex-col gap-2">
              {winnerModal.type === 'match' ? (
                <>
                  <a
                    href={getNativeMailtoUrl(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                    onClick={() => {
                      openMailtoLink(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body);
                    }}
                    id="fives-modal-share-results-email-btn"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md no-underline cursor-pointer"
                  >
                    <Mail className="w-4 h-4 stroke-[2.5]" /> SHARE RESULTS VIA EMAIL
                  </a>

                  <button
                    onClick={onNewMatchRequest}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-widest rounded transition-colors"
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
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  CONTINUE TO NEXT GAME &rarr;
                </button>
              )}

              {/* Undo Finishing Score Button */}
              <button
                type="button"
                onClick={() => {
                  setWinnerModal(null);
                  setPendingNextState(null);
                  handleUndo();
                }}
                className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs mt-1"
              >
                <Undo2 className="w-4 h-4 text-amber-700" />
                <span>Undo Last Score / Correct Turn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Report Modal */}
      <MatchReportEmailModal
        matchState={matchState}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
      />

      {/* Round of Bulls Challenge Modal */}
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

      {/* Team Shooting Order Adjustment Modal */}
      {showOrderModal && (
        <TeamShootingOrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          leagueType={matchState.settings.leagueType || 'wednesday'}
          players={matchState.players}
          settings={matchState.settings}
          gameMode="FIVES"
          onConfirm={(updatedPlayers, updatedSettings) => {
            onUpdateMatch({
              ...matchState,
              players: updatedPlayers,
              settings: updatedSettings,
            });
            setShowOrderModal(false);
          }}
        />
      )}
    </div>
  );
};
