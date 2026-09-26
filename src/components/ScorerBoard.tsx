import React, { useState, useEffect } from 'react';
import { MatchState, Player, TurnLog, LegRecord, WEDNESDAY_MEDLEY_CONFIGS, DEFAULT_MEDLEY_CONFIGS } from '../types';
import { KeypadInput } from './KeypadInput';
import { DartboardInput } from './DartboardInput';
import { MatchReportEmailModal } from './MatchReportEmailModal';
import { MatchEmailQuickBanner } from './MatchEmailQuickBanner';
import { BullsRoundModal } from './BullsRoundModal';
import {
  getRecipientEmail,
  getNativeMailtoUrl,
  openMailtoLink,
  generateMatchEmailReport,
} from '../utils/emailReportHelper';
import { getCheckoutRoute } from '../data/checkouts';
import { generateDartBotTurnX01 } from '../utils/dartbot';
import { announcer } from '../utils/audio';
import { getShooterInfo, advancePlayerSubShooter, announceCurrentShooter, updateSubPlayerStatsOnTurn, getEffectiveTeamPlayers, ShooterOptions } from '../utils/shooterHelper';
import { TeamShootingOrderModal } from './TeamShootingOrderModal';
import confetti from 'canvas-confetti';
import { Target, Trophy, RotateCcw, Volume2, Share2, Sparkles, AlertCircle, ChevronRight, Mail, Flame, Zap, Compass, ShieldCheck, ArrowUpDown, CheckCircle2, QrCode, Undo2, XSquare, AlertOctagon } from 'lucide-react';

import { updateLeaguePoints, recordTuesdayLegStats, recordThursdayLegStats, recordWednesdayLegStats } from '../utils/leagueHelper';
import { buildNextMedleyMatchState, isOptionalFinalLeg } from '../utils/medleyHelper';

interface ScorerBoardProps {
  matchState: MatchState;
  onUpdateMatch: (updatedState: MatchState) => void;
  onNewMatchRequest: () => void;
  onReturnToLeague?: () => void;
}

export const ScorerBoard: React.FC<ScorerBoardProps> = ({
  matchState,
  onUpdateMatch,
  onNewMatchRequest,
  onReturnToLeague,
}) => {
  const [inputMode, setInputMode] = useState<'keypad' | 'board'>('keypad');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showBullsModal, setShowBullsModal] = useState(false);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);
  const [preCheckoutState, setPreCheckoutState] = useState<MatchState | null>(null);
  const [pendingNextState, setPendingNextState] = useState<MatchState | null>(null);
  const [winnerModal, setWinnerModal] = useState<{
    type: 'leg' | 'match';
    playerName: string;
    nextGameLabel?: string;
    p1Score?: number;
    p2Score?: number;
    stats?: any;
  } | null>(null);

  const activePlayer = matchState.players[matchState.activePlayerIndex];
  const opponentPlayer = matchState.players[1 - matchState.activePlayerIndex];

  // Announce initial thrower when leg starts
  useEffect(() => {
    if (matchState.status === 'active' && matchState.history.length === 0) {
      if (matchState.settings.announceAudio && activePlayer) {
        announceCurrentShooter(activePlayer, 300, {
          gameMode: matchState.currentGameMode || matchState.settings.gameMode,
          inMode: matchState.currentInMode || matchState.settings.inMode,
          startScore: matchState.currentStartScore || matchState.settings.startScore,
          remainingScore: activePlayer.currentScore,
          hasMarkedFirstScore: activePlayer.hasMarkedFirstScore,
        });
      }
    }
  }, [matchState.currentLeg, matchState.status]);

  // Auto trigger DartBot turn if active player is a bot
  useEffect(() => {
    if (matchState.status !== 'active') return;
    if (activePlayer && activePlayer.isBot) {
      const timer = setTimeout(() => {
        handleBotTurn();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [matchState.activePlayerIndex, matchState.status]);

  const handleBotTurn = () => {
    const botRes = generateDartBotTurnX01(
      activePlayer.currentScore,
      activePlayer.botLevel || 5,
      matchState.settings.outMode === 'Double'
    );
    handleScoreInput(botRes.score, botRes.dartsUsed, botRes.isBust, botRes.dartsDetail);
  };

  const handleScoreInput = (
    score: number,
    dartsUsed: number = 3,
    forceBust: boolean = false,
    dartsDetail?: string[]
  ) => {
    if (matchState.status !== 'active') return;

    const remainingBefore = activePlayer.currentScore;
    let remainingAfter = remainingBefore - score;
    let isBust = forceBust;
    let isCheckout = false;

    const isDoubleOut = matchState.settings.outMode === 'Double';

    if (forceBust) {
      isBust = true;
      remainingAfter = remainingBefore;
    } else if (remainingAfter < 0) {
      isBust = true;
      remainingAfter = remainingBefore;
    } else if (remainingAfter === 1 && isDoubleOut) {
      isBust = true; // Cannot checkout on 1 with double out
      remainingAfter = remainingBefore;
    } else if (remainingAfter === 0) {
      isCheckout = true;
    }

    // Sound Announcement
    if (matchState.settings.announceAudio) {
      if (isCheckout) {
        announcer.announceCheckout(activePlayer.name, matchState.currentLeg);
      } else {
        announcer.announceScore(isBust ? 0 : score, isBust);
      }
    }

    const currentLegStartScore = matchState.currentStartScore || matchState.settings.startScore || 501;
    const currentShooterOptions: ShooterOptions = {
      gameMode: matchState.currentGameMode || matchState.settings.gameMode,
      inMode: matchState.currentInMode || matchState.settings.inMode,
      startScore: currentLegStartScore,
      remainingScore: activePlayer.currentScore,
      hasMarkedFirstScore: activePlayer.hasMarkedFirstScore,
    };
    const shooterInfo = getShooterInfo(activePlayer, currentShooterOptions);

    // Create turn log entry
    const turnEntry: TurnLog = {
      id: `turn-${Date.now()}`,
      turnNumber: matchState.history.length + 1,
      playerId: activePlayer.id,
      playerName: activePlayer.name,
      shooterName: shooterInfo.isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      subPlayerIndex: shooterInfo.subPlayerIndex,
      isDummyTurn: shooterInfo.isDummyTurn,
      dummyRotatedPlayerName: shooterInfo.dummyRotatedPlayerName,
      creditedPlayerName: shooterInfo.isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      score: isBust ? 0 : score,
      remainingBefore,
      remainingAfter: isBust ? remainingBefore : remainingAfter,
      dartsUsed,
      isBust,
      isCheckout,
      dartsDetail,
      timestamp: Date.now(),
    };

    // Clone players and stats
    const updatedPlayers = matchState.players.map((p) => {
      if (p.id !== activePlayer.id) return p;

      const newDartsThrown = p.stats.dartsThrown + dartsUsed;
      const actualScore = isBust ? 0 : score;
      const newScore = isBust ? p.currentScore : remainingAfter;

      // In Double In games, check if first score is marked on this turn
      const wasFirstScoreMarkedBefore = Boolean(p.hasMarkedFirstScore);
      const isFirstScoreMarkedNow = wasFirstScoreMarkedBefore || (!isBust && actualScore > 0);
      const justMarkedFirstScore = matchState.settings.inMode === 'Double' && !wasFirstScoreMarkedBefore && isFirstScoreMarkedNow;

      // Update High Scores & Counts
      let c60 = p.stats.count60Plus;
      let c100 = p.stats.count100Plus;
      let c140 = p.stats.count140Plus;
      let c180 = p.stats.count180;
      let highScore = Math.max(p.stats.highScore, actualScore);

      if (actualScore === 180) c180++;
      else if (actualScore >= 140) c140++;
      else if (actualScore >= 100) c100++;
      else if (actualScore >= 60) c60++;

      // 3 Dart Average
      const legStartScore = matchState.currentStartScore || matchState.settings.startScore || 501;
      const totalScoreInLeg = (legStartScore - newScore);
      const leg3DartAvg = newDartsThrown > 0 ? (totalScoreInLeg / newDartsThrown) * 3 : 0;

      // First 9 Darts tracking
      let f9 = [...p.first9Darts];
      if (newDartsThrown <= 9) {
        f9.push(actualScore);
      }
      const first9Avg = f9.length > 0 ? (f9.reduce((a, b) => a + b, 0) / (f9.length * 3)) * 3 : leg3DartAvg;

      let highOut = p.stats.highOut;
      if (isCheckout) {
        highOut = Math.max(highOut, remainingBefore);
      }

      // Update individual sub-player stats (ensures Dummy stats count for Dummy, not player)
      const updatedSubPlayers = updateSubPlayerStatsOnTurn(
        p,
        isBust ? 0 : score,
        dartsUsed,
        remainingBefore,
        isBust,
        isCheckout,
        currentShooterOptions
      );

      const advanceOptions: ShooterOptions = {
        gameMode: matchState.currentGameMode || matchState.settings.gameMode,
        inMode: matchState.currentInMode || matchState.settings.inMode,
        startScore: legStartScore,
        remainingScore: newScore,
        hasMarkedFirstScore: isFirstScoreMarkedNow,
        justMarkedFirstScore,
      };

      // Handle Team Sub-Player & Dummy Rotation
      const subProgression = advancePlayerSubShooter(p, advanceOptions);

      return {
        ...p,
        currentScore: newScore,
        first9Darts: f9,
        teamPlayers: updatedSubPlayers || p.teamPlayers,
        currentSubPlayerIndex: subProgression.currentSubPlayerIndex,
        dummyShooterIndices: subProgression.dummyShooterIndices,
        lastRealShooterIndex: subProgression.lastRealShooterIndex,
        hasMarkedFirstScore: isFirstScoreMarkedNow,
        stats: {
          ...p.stats,
          dartsThrown: newDartsThrown,
          highScore,
          highOut,
          count60Plus: c60,
          count100Plus: c100,
          count140Plus: c140,
          count180: c180,
          threeDartAvg: parseFloat(leg3DartAvg.toFixed(1)),
          first9Avg: parseFloat(first9Avg.toFixed(1)),
          checkoutHits: isCheckout ? p.stats.checkoutHits + 1 : p.stats.checkoutHits,
          checkoutAttempts: remainingBefore <= 170 ? p.stats.checkoutAttempts + 1 : p.stats.checkoutAttempts,
        },
      };
    });

    const updatedHistory = [...matchState.history, turnEntry];

    // Check Leg Victory
    if (isCheckout) {
      setPreCheckoutState({ ...matchState });
      triggerConfetti();
      handleLegWin(updatedPlayers, updatedHistory, activePlayer.id);
      return;
    }

    // Switch active player index
    const nextPlayerIndex = 1 - matchState.activePlayerIndex;
    const nextShooterPlayer = updatedPlayers[nextPlayerIndex];

    const nextState: MatchState = {
      ...matchState,
      players: updatedPlayers,
      activePlayerIndex: nextPlayerIndex,
      history: updatedHistory,
      updatedAt: Date.now(),
    };

    if (matchState.settings.announceAudio && nextShooterPlayer) {
      announceCurrentShooter(nextShooterPlayer, 950, {
        gameMode: matchState.currentGameMode || matchState.settings.gameMode,
        inMode: matchState.currentInMode || matchState.settings.inMode,
        startScore: matchState.currentStartScore || matchState.settings.startScore,
        remainingScore: nextShooterPlayer.currentScore,
        hasMarkedFirstScore: nextShooterPlayer.hasMarkedFirstScore,
      });
    }

    onUpdateMatch(nextState);
  };

  const handleLegWin = (
    currentPlayers: Player[],
    currentHistory: TurnLog[],
    winnerId: string
  ) => {
    const winner = currentPlayers.find((p) => p.id === winnerId)!;
    const loser = currentPlayers.find((p) => p.id !== winnerId)!;
    const newLegsWon = winner.legsWon + 1;

    const isMedley = !!(matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY');

    // Update league points for standalone matches (Medley matches handle per-leg stats and points in buildNextMedleyMatchState / finalizeMedleyMatchState)
    if (!isMedley && matchState.settings.leagueType && matchState.settings.leagueType !== 'none') {
      updateLeaguePoints(winner.name, loser.name || 'Opponent', matchState.settings.leagueType, matchState.players);
    }

    // Record completed leg
    const currentLegStartScore =
      matchState.currentStartScore ||
      (currentHistory && currentHistory.length > 0 ? currentHistory[0].remainingBefore : undefined) ||
      matchState.settings.startScore ||
      501;

    const lastTurn = currentHistory[currentHistory.length - 1];
    const winningCheckout =
      lastTurn && (lastTurn.isCheckout || lastTurn.remainingAfter === 0) ? lastTurn.score : undefined;

    const legGameMode =
      matchState.currentGameMode && matchState.currentGameMode !== 'MEDLEY'
        ? matchState.currentGameMode
        : matchState.settings.gameMode !== 'MEDLEY'
        ? matchState.settings.gameMode
        : 'X01';

    const legRecord: LegRecord = {
      legNumber: matchState.currentLeg,
      setNumber: matchState.currentSet,
      gameMode: legGameMode,
      startScore: currentLegStartScore,
      winnerId,
      winnerName: winner.name,
      turns: currentHistory,
      dartsCount: {
        [currentPlayers[0].id]: currentPlayers[0].stats.dartsThrown,
        [currentPlayers[1].id]: currentPlayers[1].stats.dartsThrown,
      },
      averages: {
        [currentPlayers[0].id]: currentPlayers[0].stats.threeDartAvg,
        [currentPlayers[1].id]: currentPlayers[1].stats.threeDartAvg,
      },
      winningOut: winningCheckout,
    };

    if (isMedley) {
      const nextMedleyState = buildNextMedleyMatchState(matchState, winnerId, legRecord);

      if (nextMedleyState.status === 'completed') {
        if (matchState.settings.announceAudio) {
          announcer.announceMatchWinner(winner.name);
        }
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
            playerName: winner.name,
          });
        }
      } else {
        // Hold next medley state pending until user explicitly clicks Continue, End Match, or Undo
        setPendingNextState(nextMedleyState);
        setWinnerModal({
          type: 'leg',
          playerName: winner.name,
          nextGameLabel: `Game ${nextMedleyState.currentLeg} (${nextMedleyState.currentGameMode})`,
          p1Score: nextMedleyState.players[0]?.legsWon || 0,
          p2Score: nextMedleyState.players[1]?.legsWon || 0,
        });
      }
      return;
    }

    if (matchState.settings.leagueType === 'tuesday') {
      try {
        recordTuesdayLegStats(legRecord, matchState);
      } catch (e) {
        console.error('Failed to record Tuesday leg stats in ScorerBoard', e);
      }
    } else if (matchState.settings.leagueType === 'wednesday') {
      try {
        recordWednesdayLegStats(legRecord, matchState);
      } catch (e) {
        console.error('Failed to record Wednesday leg stats in ScorerBoard', e);
      }
    } else if (matchState.settings.leagueType === 'thursday') {
      try {
        recordThursdayLegStats(legRecord, matchState);
      } catch (e) {
        console.error('Failed to record Thursday leg stats in ScorerBoard', e);
      }
    }

    let matchWinnerId: string | undefined = undefined;
    let updatedSets = winner.setsWon;

    // Check if set is won or match is won
    if (matchState.settings.format === 'legs') {
      if (newLegsWon >= matchState.settings.legsToWin) {
        matchWinnerId = winnerId;
      }
    } else {
      // Sets format
      if (newLegsWon >= matchState.settings.legsPerSet) {
        updatedSets += 1;
        if (updatedSets >= matchState.settings.setsToWin) {
          matchWinnerId = winnerId;
        }
      }
    }

    const nextStartScore = matchState.settings.startScore;
    const nextGameMode = matchState.settings.gameMode;
    const nextInMode = matchState.settings.inMode;
    const nextOutMode = matchState.settings.outMode;
    const isMatchComplete = !!matchWinnerId;

    const nextPlayers = currentPlayers.map((p) => {
      if (p.id === winnerId) {
        return {
          ...p,
          legsWon: matchState.settings.format === 'legs' ? newLegsWon : (newLegsWon >= matchState.settings.legsPerSet ? 0 : newLegsWon),
          setsWon: updatedSets,
          currentScore: isMatchComplete ? 0 : nextStartScore, // reset score only if continuing
          first9Darts: [],
          hasMarkedFirstScore: false,
          lastRealShooterIndex: undefined,
          stats: { ...p.stats, dartsThrown: isMatchComplete ? p.stats.dartsThrown : 0 },
        };
      }
      return {
        ...p,
        legsWon: matchState.settings.format === 'sets' && newLegsWon >= matchState.settings.legsPerSet ? 0 : p.legsWon,
        currentScore: isMatchComplete ? p.currentScore : nextStartScore,
        first9Darts: [],
        hasMarkedFirstScore: false,
        lastRealShooterIndex: undefined,
        stats: { ...p.stats, dartsThrown: isMatchComplete ? p.stats.dartsThrown : 0 },
      };
    });

    // Toggle starter for next leg
    const nextStarterIndex = 1 - matchState.starterPlayerIndex;

    const nextState: MatchState = {
      ...matchState,
      status: isMatchComplete ? 'completed' : 'active',
      winnerId: matchWinnerId,
      players: nextPlayers,
      currentLeg: isMatchComplete ? matchState.currentLeg : matchState.currentLeg + 1,
      currentSet: matchState.settings.format === 'sets' && newLegsWon >= matchState.settings.legsPerSet ? matchState.currentSet + 1 : matchState.currentSet,
      currentGameMode: isMatchComplete ? (matchState.currentGameMode || matchState.settings.gameMode) : nextGameMode,
      currentStartScore: isMatchComplete ? matchState.currentStartScore : nextStartScore,
      currentInMode: isMatchComplete ? matchState.currentInMode : nextInMode,
      currentOutMode: isMatchComplete ? matchState.currentOutMode : nextOutMode,
      starterPlayerIndex: nextStarterIndex,
      activePlayerIndex: nextStarterIndex,
      completedLegs: [...matchState.completedLegs, legRecord],
      history: isMatchComplete ? currentHistory : [],
      updatedAt: Date.now(),
    };

    if (isMatchComplete) {
      if (matchState.settings.announceAudio) {
        announcer.announceMatchWinner(winner.name);
      }
      onUpdateMatch(nextState);
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
          playerName: winner.name,
        });
      }
    } else {
      setPendingNextState(nextState);
      setWinnerModal({
        type: 'leg',
        playerName: winner.name,
        nextGameLabel: `Leg ${matchState.currentLeg + 1}`,
        p1Score: nextPlayers[0]?.legsWon || 0,
        p2Score: nextPlayers[1]?.legsWon || 0,
      });
    }
  };

  const handleUndo = () => {
    if (matchState.history.length === 0 || matchState.status !== 'active') return;
    const lastTurn = matchState.history[matchState.history.length - 1];
    const prevHistory = matchState.history.slice(0, -1);

    // Revert active player to the player who made the last turn
    const prevPlayerIndex = matchState.players.findIndex((p) => p.id === lastTurn.playerId);
    const legStartScore = matchState.currentStartScore || matchState.settings.startScore || 501;

    const updatedPlayers = matchState.players.map((p) => {
      if (p.id !== lastTurn.playerId) return p;

      const newDartsThrown = Math.max(0, p.stats.dartsThrown - lastTurn.dartsUsed);
      const restoredScore = lastTurn.remainingBefore;
      const actualScore = lastTurn.isBust ? 0 : lastTurn.score;

      // Revert high score counts
      let c180 = p.stats.count180;
      let c140 = p.stats.count140Plus;
      let c100 = p.stats.count100Plus;
      let c60 = p.stats.count60Plus;

      if (actualScore === 180) c180 = Math.max(0, c180 - 1);
      else if (actualScore >= 140) c140 = Math.max(0, c140 - 1);
      else if (actualScore >= 100) c100 = Math.max(0, c100 - 1);
      else if (actualScore >= 60) c60 = Math.max(0, c60 - 1);

      // Revert 3-dart average
      const totalScoreInLeg = Math.max(0, legStartScore - restoredScore);
      const leg3DartAvg = newDartsThrown > 0 ? (totalScoreInLeg / newDartsThrown) * 3 : 0;

      // Revert first 9 darts if within first 9
      let f9 = [...p.first9Darts];
      if (f9.length > 0 && newDartsThrown < 9) {
        f9.pop();
      }
      const first9Avg = f9.length > 0 ? (f9.reduce((a, b) => a + b, 0) / (f9.length * 3)) * 3 : leg3DartAvg;

      // Revert sub-players rotation if team/doubles
      let currentSubPlayerIndex = p.currentSubPlayerIndex;
      let updatedTeamPlayers = p.teamPlayers;
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        currentSubPlayerIndex = (p.currentSubPlayerIndex - 1 + p.teamPlayers.length) % p.teamPlayers.length;
        const shooterIdx = currentSubPlayerIndex;
        updatedTeamPlayers = p.teamPlayers.map((sp, idx) => {
          if (idx !== shooterIdx || !sp.stats) return sp;
          const spDarts = Math.max(0, sp.stats.dartsThrown - lastTurn.dartsUsed);
          const spScore = Math.max(0, (sp.stats.score || 0) - actualScore);
          const spAvg = spDarts > 0 ? (spScore / spDarts) * 3 : 0;
          return {
            ...sp,
            stats: {
              ...sp.stats,
              dartsThrown: spDarts,
              score: spScore,
              threeDartAvg: parseFloat(spAvg.toFixed(1)),
            },
          };
        });
      }

      return {
        ...p,
        currentScore: restoredScore,
        first9Darts: f9,
        teamPlayers: updatedTeamPlayers,
        currentSubPlayerIndex,
        stats: {
          ...p.stats,
          dartsThrown: newDartsThrown,
          count60Plus: c60,
          count100Plus: c100,
          count140Plus: c140,
          count180: c180,
          threeDartAvg: parseFloat(leg3DartAvg.toFixed(1)),
          first9Avg: parseFloat(first9Avg.toFixed(1)),
          checkoutAttempts: lastTurn.remainingBefore <= 170 ? Math.max(0, p.stats.checkoutAttempts - 1) : p.stats.checkoutAttempts,
        },
      };
    });

    const targetShooter = updatedPlayers[prevPlayerIndex !== -1 ? prevPlayerIndex : 0];
    if (matchState.settings.announceAudio && targetShooter) {
      announceCurrentShooter(targetShooter, 300, {
        gameMode: matchState.currentGameMode || matchState.settings.gameMode,
        inMode: matchState.currentInMode || matchState.settings.inMode,
        startScore: matchState.currentStartScore || matchState.settings.startScore,
        remainingScore: targetShooter.currentScore,
        hasMarkedFirstScore: targetShooter.hasMarkedFirstScore,
      });
    }

    setUndoNotice(
      `Reverted last turn for ${lastTurn.playerName} (${lastTurn.isBust ? 'BUST' : `+${lastTurn.score} pts`}). Restored score to ${lastTurn.remainingBefore}.`
    );
    setTimeout(() => setUndoNotice(null), 4000);

    onUpdateMatch({
      ...matchState,
      players: updatedPlayers,
      activePlayerIndex: prevPlayerIndex !== -1 ? prevPlayerIndex : 0,
      history: prevHistory,
      updatedAt: Date.now(),
    });
  };

  // Dedicated Undo for an accidental finishing shot / leg checkout
  const handleUndoFinishingShot = () => {
    if (preCheckoutState) {
      onUpdateMatch({
        ...preCheckoutState,
        status: 'active',
        winnerId: undefined,
        updatedAt: Date.now(),
      });
      setPreCheckoutState(null);
      setWinnerModal(null);
      setUndoNotice('Finishing shot undone! Pre-checkout score restored for correction.');
      setTimeout(() => setUndoNotice(null), 5000);
      return;
    }

    // Fallback: If preCheckoutState was not set, revert from completedLegs
    if (matchState.completedLegs && matchState.completedLegs.length > 0) {
      const lastLeg = matchState.completedLegs[matchState.completedLegs.length - 1];
      const remainingLegs = matchState.completedLegs.slice(0, -1);
      const winnerId = lastLeg.winnerId;

      const restoredPlayers = matchState.players.map((p) => {
        if (p.id === winnerId) {
          return {
            ...p,
            legsWon: Math.max(0, p.legsWon - 1),
          };
        }
        return p;
      });

      onUpdateMatch({
        ...matchState,
        status: 'active',
        winnerId: undefined,
        players: restoredPlayers,
        currentLeg: Math.max(1, matchState.currentLeg - 1),
        completedLegs: remainingLegs,
        history: lastLeg.turns || [],
        updatedAt: Date.now(),
      });
      setWinnerModal(null);
      setUndoNotice('Finishing shot undone! Restored to previous leg turns.');
      setTimeout(() => setUndoNotice(null), 5000);
    }
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // fallback
    }
  };

  const currentLegStartScore = matchState.currentStartScore || matchState.settings.startScore || 501;

  const getGameModeBadge = (score: number) => {
    switch (score) {
      case 1001:
        return {
          label: '1001 Marathon',
          icon: <Flame className="w-3.5 h-3.5 text-rose-400" />,
          pillClass: 'bg-rose-950/80 border-rose-800 text-rose-300',
        };
      case 701: {
        const isDiDo = (matchState.currentInMode || matchState.settings.inMode) === 'Double';
        return {
          label: isDiDo ? '701 DI / DO' : '701 Team Countdown',
          icon: isDiDo ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> : <Trophy className="w-3.5 h-3.5 text-indigo-400" />,
          pillClass: 'bg-indigo-950/80 border-indigo-800 text-indigo-300',
        };
      }
      case 501:
        return {
          label: '501 Standard',
          icon: <Target className="w-3.5 h-3.5 text-blue-400" />,
          pillClass: 'bg-blue-950/80 border-blue-800 text-blue-300',
        };
      case 301:
        return {
          label: '301 Fast Leg',
          icon: <Zap className="w-3.5 h-3.5 text-emerald-400" />,
          pillClass: 'bg-emerald-950/80 border-emerald-800 text-emerald-300',
        };
      default:
        return {
          label: `${score} Countdown`,
          icon: <Target className="w-3.5 h-3.5 text-indigo-400" />,
          pillClass: 'bg-slate-800 border-slate-700 text-slate-300',
        };
    }
  };

  const gameBadge = getGameModeBadge(currentLegStartScore);
  const isMatchComplete = matchState.status === 'completed';
  const winnerPlayer = matchState.players.find(p => p.id === matchState.winnerId) ||
    (matchState.players[0].legsWon > matchState.players[1].legsWon ? matchState.players[0] : matchState.players[1]);

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-3 md:px-4 py-1.5 sm:py-2.5 space-y-2 sm:space-y-2.5">
      {/* Top Match Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-900 text-white border border-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className={`px-2 py-0.5 rounded-lg border text-xs font-black flex items-center gap-1.5 shadow-2xs ${gameBadge.pillClass}`}>
            {gameBadge.icon}
            <span>{gameBadge.label}</span>
          </div>

          <span className="font-extrabold text-white text-xs sm:text-sm tracking-tight">
            {matchState.settings.inMode === 'Double' ? 'DI / ' : 'SI / '}
            {matchState.settings.outMode} Out
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
            {isMatchComplete ? 'Match Complete' : `Leg ${matchState.currentLeg} ${matchState.settings.format === 'sets' ? `(Set ${matchState.currentSet})` : ''}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!isMatchComplete && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={matchState.history.length === 0}
                title={
                  matchState.history.length > 0
                    ? `Undo last entered dart score (${matchState.history[matchState.history.length - 1].playerName}: ${matchState.history[matchState.history.length - 1].isBust ? 'BUST' : `+${matchState.history[matchState.history.length - 1].score} pts`})`
                    : 'No turns to undo'
                }
                className={`px-2 py-1 rounded border text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all shadow-2xs ${
                  matchState.history.length > 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 border-slate-700 opacity-40 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <div className="flex bg-slate-800 p-0.5 rounded text-xs font-bold border border-slate-700">
                <button
                  onClick={() => setInputMode('keypad')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    inputMode === 'keypad' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Keypad
                </button>
                <button
                  onClick={() => setInputMode('board')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    inputMode === 'board' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Dartboard
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('kaboom_open_share'))}
            title="Scan or share live match QR Code"
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-bold rounded border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1 shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-400" />
            <span>QR Share</span>
          </button>

          {onReturnToLeague && (
            <button
              onClick={onReturnToLeague}
              className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded border border-indigo-500 transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>League</span>
            </button>
          )}

          <button
            onClick={onNewMatchRequest}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
          >
            New Match
          </button>
        </div>
      </div>

      {/* Medley Rotation Progress Bar */}
      {(() => {
        const isMedley = matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY';
        if (!isMedley) return null;
        const isWed =
          matchState.settings.leagueType === 'wednesday' ||
          matchState.settings.bracketMatchId?.toLowerCase().includes('wed') ||
          matchState.matchCode?.toUpperCase().startsWith('WED-');
        const activeConfigs = isWed
          ? WEDNESDAY_MEDLEY_CONFIGS
          : (matchState.settings.medleyConfigs && matchState.settings.medleyConfigs.length > 0
              ? matchState.settings.medleyConfigs
              : DEFAULT_MEDLEY_CONFIGS);

        return (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 sm:px-3 py-1.5 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span>{isWed ? 'Wednesday 4v4 Medley Rotation' : 'Medley Series Rotation'}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                Game {Math.min(matchState.currentLeg, activeConfigs.length)} of {activeConfigs.length}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {activeConfigs.map((cfg) => {
                const isPast = cfg.legNumber < matchState.currentLeg;
                const isCurrent = cfg.legNumber === matchState.currentLeg && !isMatchComplete;
                return (
                  <div
                    key={cfg.legNumber}
                    className={`px-1.5 py-1 rounded-lg border text-center transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm ring-1 ring-indigo-400/50 font-black'
                        : isPast
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 font-medium'
                        : 'bg-slate-800/50 text-slate-400 border-slate-700/50 font-normal'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-85 flex items-center justify-center gap-1">
                      {isPast && <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
                      {isCurrent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping mr-0.5" />}
                      <span>G{cfg.legNumber}</span>
                    </div>
                    <div className="text-[11px] truncate font-extrabold mt-0.5">
                      {cfg.gameMode === 'X01'
                        ? `${cfg.startScore} ${cfg.inMode === 'Double' ? 'DI' : 'SI'}/${cfg.outMode}`
                        : cfg.gameMode === 'BASEBALL'
                        ? 'Baseball'
                        : cfg.gameMode === 'FIVES'
                        ? 'Fives'
                        : 'Cricket'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Undo Notification Banner */}
      {undoNotice && (
        <div className="bg-amber-500 text-slate-950 border border-amber-400 rounded-xl p-2.5 shadow-md flex items-center justify-between text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-950 shrink-0" />
            <span>{undoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUndoNotice(null)}
            className="p-1 hover:bg-amber-600/30 rounded cursor-pointer text-sm font-black leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {isMatchComplete ? (
        /* MATCH COMPLETED DEDICATED VIEW (NO NEXT GAME OR COUNTDOWN) */
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
                  onClick={handleUndoFinishingShot}
                  title="Accidental finishing score? Undo and resume match"
                  className="flex-1 md:flex-none px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" /> Undo Finishing Score
                </button>

                <a
                  href={getNativeMailtoUrl(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  onClick={() => openMailtoLink(getRecipientEmail(), [], generateMatchEmailReport(matchState).subject, generateMatchEmailReport(matchState).body)}
                  id="scorer-share-results-email-btn"
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
                      <span className="text-indigo-600 font-mono">Game {lIdx + 1}: {leg.gameMode || 'X01'}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {leg.winnerName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span>Turns: {leg.turns?.length || 0}</span>
                      <span>Winner ID: {leg.winnerName}</span>
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
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">3-Dart Avg</span>
                      <span className="text-base font-mono font-black text-indigo-600">
                        {player.stats.threeDartAvg || '0.0'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">First 9 Avg</span>
                      <span className="text-base font-mono font-black text-slate-700">
                        {player.stats.first9Avg || '0.0'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">180s</span>
                      <span className="text-base font-mono font-black text-amber-600">
                        {player.stats.ton80s || 0}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">100+ Tons</span>
                      <span className="text-base font-mono font-black text-slate-900">
                        {player.stats.tons || 0}
                      </span>
                    </div>
                  </div>

                  {/* Sub-Player / Doubles stats if present */}
                  {(() => {
                    const effectiveList = getEffectiveTeamPlayers(player);
                    if (effectiveList.length <= 1 && !effectiveList.some(p => p.isDummy)) return null;
                    return (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Team Roster Individual Breakdown
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {effectiveList.map((sp, spIdx) => (
                            <div key={`stats-${player.id}-${sp.id || spIdx}`} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                              <div className="flex items-center gap-1 font-bold text-slate-800">
                                <span>{sp.avatar || (sp.isDummy ? '🤖' : '🎯')}</span>
                                <span className="truncate">{sp.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Avg: {sp.stats?.threeDartAvg || '0.0'} &bull; Darts: {sp.stats?.dartsThrown || 0}
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
        /* ACTIVE MATCH VIEW */
        <>
          {/* Prominent Active Turn & Individual Shooter Banner */}
          {matchState.status === 'active' && activePlayer && (() => {
            const activeShooter = getShooterInfo(activePlayer, {
              gameMode: matchState.currentGameMode || matchState.settings.gameMode,
              inMode: matchState.currentInMode || matchState.settings.inMode,
              startScore: currentLegStartScore,
              remainingScore: activePlayer.currentScore,
              hasMarkedFirstScore: activePlayer.hasMarkedFirstScore,
            });
            const effectiveList = getEffectiveTeamPlayers(activePlayer);
            const nextShooter = activeShooter.nextShooterName;

            return (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500 rounded-2xl p-3 sm:p-3.5 text-white shadow-xl flex items-center justify-between gap-3 ring-2 ring-indigo-500/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-inner shrink-0 border border-indigo-400/40">
                    {activeShooter.isDummyTurn ? '🤖' : (activeShooter.avatar || '🎯')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-wider rounded-md animate-pulse shadow-xs flex items-center gap-1">
                        <span>{activeShooter.isDummyTurn ? '🤖' : '🎯'}</span>
                        <span>{activeShooter.isDummyTurn ? 'DUMMY SHOT (ROTATED PLAYER)' : 'NOW THROWING'}</span>
                      </span>
                      {activeShooter.isDummyBenched && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                          Dummy Benched (Score ≤ 100)
                        </span>
                      )}
                      {effectiveList.length > 1 && (() => {
                        const activeListCount = activeShooter.isDummyBenched
                          ? Math.max(1, effectiveList.filter((sp) => !sp.isDummy).length)
                          : effectiveList.length;
                        return (
                          <span className="text-[10px] text-indigo-200 font-bold">
                            Shooter {(activeShooter.subPlayerIndex % activeListCount) + 1} of {activeListCount}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="mt-0.5">
                      <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5 truncate">
                        <span className="text-amber-300 underline decoration-indigo-400/80 decoration-2 underline-offset-2">
                          {activeShooter.isDummyTurn && activeShooter.dummyRotatedPlayerName
                            ? `${activeShooter.dummyRotatedPlayerName} (shooting for Dummy)`
                            : activeShooter.shooterName}
                        </span>
                        {effectiveList.length > 1 && (
                          <span className="text-xs text-slate-300 font-semibold truncate">
                            &bull; Team: <strong className="text-white">{activePlayer.name}</strong>
                          </span>
                        )}
                      </h2>
                      {nextShooter && effectiveList.length > 1 && (
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          Up next: <strong className="text-slate-200">{nextShooter}</strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Requires</span>
                    <span className="text-lg sm:text-2xl font-mono font-black text-amber-400 leading-none">
                      {activePlayer.currentScore}
                    </span>
                  </div>
                  {!activePlayer.isBot && (
                    <button
                      type="button"
                      id="scorer-banner-bust-btn"
                      onClick={() => handleScoreInput(0, 3, true)}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg border border-rose-500 flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer"
                      title="Bust (0 points, advance turn)"
                    >
                      <AlertOctagon className="w-3 h-3 text-rose-100" />
                      <span>Bust</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Main Players Scoreboard Display - Placed Side-by-Side in Tablet Mode */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:gap-3">
            {matchState.players.map((player, idx) => {
              const isActive = idx === matchState.activePlayerIndex;
              const checkout = getCheckoutRoute(player.currentScore);
              const scoredSoFar = Math.max(0, currentLegStartScore - player.currentScore);
              const percentProgress = Math.min(100, Math.max(0, Math.round((scoredSoFar / currentLegStartScore) * 100)));
              const ptsToCheckout = Math.max(0, player.currentScore - 170);

              return (
                <div
                  key={player.id}
                  className={`relative rounded-xl p-2 sm:p-2.5 md:p-3 transition-all shadow-2xs overflow-hidden flex flex-col justify-between ${
                    isActive
                      ? 'bg-white border-2 border-indigo-600 shadow-xs ring-2 ring-indigo-500/10'
                      : 'bg-white border border-slate-200 opacity-90'
                  }`}
                >
                  {/* Active Indicator Header */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600" />
                  )}

                  {/* Player Name & Leg Score */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base sm:text-xl flex-shrink-0">{player.avatar || '🎯'}</span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs sm:text-sm md:text-base text-slate-900 tracking-tight block truncate">
                          {player.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">Player {idx + 1}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 pl-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Legs</span>
                      <span className="text-base sm:text-xl font-black text-slate-900 leading-none">
                        {player.legsWon}
                      </span>
                    </div>
                  </div>

                  {/* Active Team Sub-Player / Dummy Thrower Banner */}
                  {(() => {
                    const effectiveList = getEffectiveTeamPlayers(player);
                    if (effectiveList.length <= 1 && !effectiveList.some(p => p.isDummy)) return null;
                    const info = getShooterInfo(player, {
                      gameMode: matchState.currentGameMode || matchState.settings.gameMode,
                      inMode: matchState.currentInMode || matchState.settings.inMode,
                      startScore: currentLegStartScore,
                      remainingScore: player.currentScore,
                      hasMarkedFirstScore: player.hasMarkedFirstScore,
                    });

                    return (
                      <div className={`my-0.5 p-1 sm:p-1.5 rounded-lg border transition-all ${
                        info.isDummyTurn
                          ? 'bg-amber-50 border border-amber-300 text-amber-950 shadow-2xs'
                          : isActive
                          ? 'bg-indigo-50 border border-indigo-200 text-slate-800'
                          : 'bg-slate-50 border border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center justify-between text-[10px] font-bold mb-0.5">
                          <span className="uppercase tracking-wider text-[8px] sm:text-[9px] text-slate-500">
                            {info.isDummyBenched
                              ? '🤖 Dummy Benched (Score ≤ 100)'
                              : info.isDummyTurn
                              ? '🤖 Dummy Turn'
                              : '🎯 Shooter Up'}
                          </span>
                          <div className="flex items-center gap-1">
                            {info.isDummyTurn && (
                              <span className="px-1 py-0.1 bg-amber-500 text-white rounded font-mono font-bold text-[8px]">
                                #{info.shotNumber || 1}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowOrderModal(true)}
                              title="Adjust Team Throwing Order"
                              className="px-1 py-0.2 bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold rounded border border-slate-200 text-[8px] flex items-center gap-0.5 shadow-2xs cursor-pointer"
                            >
                              <ArrowUpDown className="w-2 h-2" />
                              <span>Order</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-xs">{info.isDummyTurn ? '🤖' : info.avatar}</span>
                          <div className="min-w-0 flex-1">
                            <span className="font-extrabold text-[10px] sm:text-xs text-slate-900 block truncate">
                              {info.isDummyTurn ? (
                                <span>
                                  🤖 Dummy <span className="text-amber-800 font-black underline">({info.shooterName} shooting)</span>
                                </span>
                              ) : (
                                info.shooterName
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Team Roster Rotation Chips */}
                        <div className="flex flex-wrap gap-0.5 mt-0.5 pt-0.5 border-t border-slate-200/60">
                          {effectiveList.map((sp, sIdx) => {
                            const isCurrentSub = info.subPlayerId
                              ? sp.id === info.subPlayerId
                              : info.isDummyTurn
                              ? sp.isDummy
                              : !sp.isDummy && sp.name === info.shooterName;
                            const spAvg = sp.stats ? sp.stats.threeDartAvg : undefined;
                            return (
                              <span
                                key={`subchip-${player.id}-${sp.id || sIdx}`}
                                className={`px-1 py-0.2 rounded text-[8px] font-bold flex items-center gap-0.5 ${
                                  isCurrentSub
                                    ? sp.isDummy
                                      ? 'bg-amber-600 text-white shadow-2xs ring-1 ring-amber-400/40'
                                      : 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-400/40'
                                    : sp.isDummy
                                    ? info.isDummyBenched
                                      ? 'bg-slate-100 border border-dashed border-slate-300 text-slate-400 line-through'
                                      : 'bg-amber-50 border border-amber-200 text-amber-900'
                                    : 'bg-white border border-slate-200 text-slate-600'
                                }`}
                              >
                                <span>{sp.avatar || (sp.isDummy ? '🤖' : '🎯')}</span>
                                <span className="truncate max-w-[50px] sm:max-w-[70px]">{sp.name}</span>
                                {sp.isDummy && info.isDummyBenched && (
                                  <span className="text-[7px] text-amber-700 font-mono not-line-through">≤100</span>
                                )}
                                {spAvg !== undefined && spAvg > 0 && (
                                  <span className={`font-mono font-black ${isCurrentSub ? 'text-amber-200' : 'text-slate-500'}`}>
                                    ({spAvg})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Score Remaining Display */}
                  <div className={`rounded-lg py-1.5 sm:py-2 px-2 text-center my-1 border transition-all ${
                    isActive ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 px-0.5">
                      <span>Remaining</span>
                      <span className="font-mono text-slate-500">
                        {scoredSoFar}/{currentLegStartScore}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-2.5 my-0.5">
                      <span className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none font-mono ${
                        isActive ? 'text-indigo-600' : 'text-slate-900'
                      }`}>
                        {player.currentScore}
                      </span>
                      {isActive && matchState.status === 'active' && !player.isBot && (
                        <button
                          type="button"
                          id={`scorer-score-display-bust-btn-${idx}`}
                          onClick={() => handleScoreInput(0, 3, true)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1 border border-rose-700 transition-all active:scale-95 cursor-pointer shadow-xs"
                          title="Record Bust (0 points, advance to next player)"
                        >
                          <AlertOctagon className="w-3.5 h-3.5 text-white" />
                          <span>Bust</span>
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-1.5 w-full bg-slate-200/80 rounded-full h-1 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          player.currentScore <= 170
                            ? 'bg-gradient-to-r from-emerald-500 to-indigo-600'
                            : currentLegStartScore >= 701
                            ? 'bg-gradient-to-r from-rose-500 to-indigo-600'
                            : 'bg-indigo-600'
                        }`}
                        style={{ width: `${percentProgress}%` }}
                      />
                    </div>

                    {/* Checkout Route Helper or Setup Info Badge */}
                    {checkout ? (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-emerald-600 to-indigo-600 text-white rounded-full font-bold text-[9px] sm:text-[10px] tracking-wide shadow-2xs animate-fadeIn">
                        <Target className="w-2.5 h-2.5 text-emerald-200" />
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">Target: {checkout.description}</span>
                      </div>
                    ) : ptsToCheckout > 0 ? (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-bold text-[9px] tracking-wide border border-slate-200">
                        <Compass className="w-2 h-2 text-slate-400" />
                        <span>{ptsToCheckout} pts to Out</span>
                      </div>
                    ) : (
                      <div className="h-4 mt-1" />
                    )}
                  </div>

                  {/* Player Stats Bar */}
                  <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1 rounded border border-slate-100">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">3-Dart Avg</span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-indigo-600">
                        {player.stats.threeDartAvg || '0.0'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-1 rounded border border-slate-100">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">First 9</span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-slate-700">
                        {player.stats.first9Avg || '0.0'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input Pad Section */}
          <div>
            {inputMode === 'keypad' ? (
              <KeypadInput
                onScoreSubmit={(score, darts, isBust) => handleScoreInput(score, darts, isBust)}
                onUndo={handleUndo}
                canUndo={matchState.history.length > 0}
                disabled={activePlayer.isBot}
              />
            ) : (
              <DartboardInput
                onScoreSubmit={(total, darts, isBust, detail) => handleScoreInput(total, darts, isBust, detail)}
                onUndo={handleUndo}
                canUndo={matchState.history.length > 0}
                disabled={activePlayer.isBot}
              />
            )}
          </div>

          {/* Turn History Log Ticker */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Recent Leg Turns
              </h3>

              <div className="flex items-center gap-2">
                {matchState.history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="px-1.5 py-0.2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                    title="Undo the most recent turn"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-amber-700" />
                    <span>
                      Undo (
                      {matchState.history[matchState.history.length - 1].playerName}:{' '}
                      {matchState.history[matchState.history.length - 1].isBust
                        ? 'BUST'
                        : `+${matchState.history[matchState.history.length - 1].score}`}
                      )
                    </span>
                  </button>
                )}
                <span className="text-slate-400 text-[10px] font-normal">
                  {matchState.history.length} turns
                </span>
              </div>
            </div>

            {matchState.history.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-mono py-1 text-center">No turns logged in current leg yet.</p>
            ) : (
              <div className="space-y-1 max-h-24 sm:max-h-28 overflow-y-auto pr-1">
                {matchState.history.slice(-5).reverse().map((turn) => (
                  <div
                    key={turn.id}
                    className="flex items-center justify-between bg-slate-50 p-1 rounded border border-slate-200 text-[10px]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1 py-0.2 bg-slate-200 text-slate-700 rounded font-bold font-mono text-[9px]">
                        #{turn.turnNumber}
                      </span>
                      <span className="font-bold text-slate-900 truncate">
                        {turn.isDummyTurn ? (
                          <span className="text-amber-800">
                            🤖 Dummy <span className="text-slate-500 font-normal text-[9px]">({turn.shooterName} shooting)</span>
                          </span>
                        ) : turn.shooterName ? (
                          <span>
                            {turn.shooterName}
                            {turn.playerName !== turn.shooterName && (
                              <span className="text-slate-400 font-normal text-[9px] ml-1">({turn.playerName})</span>
                            )}
                          </span>
                        ) : (
                          turn.playerName
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {turn.dartsDetail && turn.dartsDetail.length > 0 && (
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                          [{turn.dartsDetail.join(', ')}]
                        </span>
                      )}

                      {turn.isBust ? (
                        <span className="px-1.5 py-0.2 bg-red-100 text-red-600 font-bold text-[10px] uppercase tracking-wider rounded">
                          BUST
                        </span>
                      ) : (
                        <span className={`font-mono font-bold text-xs ${
                          turn.score === 180 ? 'text-indigo-600 font-black' : turn.score >= 100 ? 'text-indigo-600' : 'text-slate-900'
                        }`}>
                          +{turn.score}
                        </span>
                      )}

                      <span className="text-slate-400 font-mono">→ {turn.remainingAfter}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Winner Modal */}
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
                ? 'Congratulations! Match completed with professional stats recorded.'
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
                    id="scorer-modal-share-results-email-btn"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md no-underline cursor-pointer"
                  >
                    <Mail className="w-4 h-4 stroke-[2.5]" /> SHARE RESULTS VIA EMAIL
                  </a>

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
                onClick={() => {
                  setPendingNextState(null);
                  handleUndoFinishingShot();
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

      {/* Team Shooting Order Adjustment Modal */}
      {showOrderModal && (
        <TeamShootingOrderModal
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          leagueType={matchState.settings.leagueType || 'wednesday'}
          players={matchState.players}
          settings={matchState.settings}
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
