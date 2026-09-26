import React, { useState, useEffect } from 'react';
import { MatchState, Player, TeamSubPlayer, TurnLog } from '../types';
import { Trophy, Undo2, Sparkles, Mail, AlertTriangle, ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { MatchReportEmailModal } from './MatchReportEmailModal';
import { MatchEmailQuickBanner } from './MatchEmailQuickBanner';
import { TeamShootingOrderModal } from './TeamShootingOrderModal';
import { BullsRoundModal } from './BullsRoundModal';
import {
  getRecipientEmail,
  getNativeMailtoUrl,
  openMailtoLink,
  generateMatchEmailReport,
} from '../utils/emailReportHelper';
import {
  getShooterInfo,
  announceCurrentShooter,
  getEffectiveTeamPlayers,
} from '../utils/shooterHelper';
import { buildNextMedleyMatchState } from '../utils/medleyHelper';
import { recordWednesdayLegStats, updateLeaguePoints } from '../utils/leagueHelper';

interface BaseballBoardProps {
  matchState: MatchState;
  onUpdateMatch: (updatedState: MatchState) => void;
  onNewMatchRequest: () => void;
  onReturnToLeague?: () => void;
}

export interface BaseballActiveSlot {
  targetIdx: number;
  targetVal: number | string;
  isTb: boolean;
  teamIdx: number;
  subPlayerIdx: number;
  team: Player;
  subPlayer: TeamSubPlayer;
  isDummyTurn: boolean;
  shooterName: string;
  avatar: string;
  displayFull: string;
  dummyRotatedPlayerName?: string;
  nextSlot?: {
    targetIdx: number;
    targetVal: number | string;
    teamIdx: number;
    subPlayerIdx: number;
    teamName: string;
    shooterName: string;
  };
}

export const BaseballBoard: React.FC<BaseballBoardProps> = ({
  matchState,
  onUpdateMatch,
  onNewMatchRequest,
  onReturnToLeague,
}) => {
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [tieBreakerNotice, setTieBreakerNotice] = useState<string | null>(null);
  const [winnerModal, setWinnerModal] = useState<{
    playerName: string;
    type: 'leg' | 'match';
    nextGameLabel?: string;
    p1Score?: number;
    p2Score?: number;
  } | null>(null);
  const [pendingNextState, setPendingNextState] = useState<MatchState | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showBullsModal, setShowBullsModal] = useState(false);

  // Helper to generate 9 unique random numbers from 1 to 20 sorted ascending (NO BULL)
  const generateRandom9Targets = (): number[] => {
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    const selected: number[] = [];
    while (selected.length < 9) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }
    selected.sort((a, b) => a - b);
    return selected;
  };

  // Default targets if none exist or if legacy targets contain BULL
  const currentTargets: (number | string)[] =
    matchState.settings.baseballTargets &&
    matchState.settings.baseballTargets.length >= 9 &&
    !matchState.settings.baseballTargets.includes('BULL') &&
    !matchState.settings.baseballTargets.includes(25)
      ? matchState.settings.baseballTargets
      : [2, 4, 7, 9, 11, 13, 16, 18, 20];

  // Initialize targets if not set or if contains bull
  useEffect(() => {
    if (
      !matchState.settings.baseballTargets ||
      matchState.settings.baseballTargets.length < 9 ||
      matchState.settings.baseballTargets.includes('BULL') ||
      matchState.settings.baseballTargets.includes(25)
    ) {
      handleGenerateAITargets();
    }
  }, []);

  const handleGenerateAITargets = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/gemini/baseball-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (
          data.targets &&
          Array.isArray(data.targets) &&
          data.targets.length === 9 &&
          !data.targets.includes('BULL')
        ) {
          onUpdateMatch({
            ...matchState,
            settings: {
              ...matchState.settings,
              baseballTargets: data.targets,
            },
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Network request for AI targets failed, using local generator:', err);
    } finally {
      setIsGeneratingAI(false);
    }

    // Client fallback if server is unreachable: 9 random numbers strictly from 1 to 20
    const randomTargets = generateRandom9Targets();
    onUpdateMatch({
      ...matchState,
      settings: {
        ...matchState.settings,
        baseballTargets: randomTargets,
      },
    });
  };

  // Helper to calculate total runs for a player or team
  const calculateTotalRuns = (hitsRecord?: Record<number, number>): number => {
    if (!hitsRecord) return 0;
    return Object.values(hitsRecord).reduce((sum: number, h) => sum + (Number(h) || 0), 0);
  };

  /**
   * Determine the current active slot (target, team, sub-player) where EVERY player
   * on each team shoots at ALL the targets in rotating sequence.
   * Sequence for each target:
   * Target 0: Team 1 Batter 1 -> Team 2 Batter 1 -> Team 1 Batter 2 -> Team 2 Batter 2 ...
   * Target 1: Team 1 Batter 1 -> Team 2 Batter 1 -> Team 1 Batter 2 -> Team 2 Batter 2 ...
   */
  const getBaseballActiveSlot = (
    players: Player[],
    targets: (number | string)[]
  ): BaseballActiveSlot | null => {
    if (!players || players.length === 0 || !targets || targets.length === 0) return null;

    const maxShooters = Math.max(...players.map((p) => getEffectiveTeamPlayers(p).length), 1);

    for (let tIdx = 0; tIdx < targets.length; tIdx++) {
      for (let sIdx = 0; sIdx < maxShooters; sIdx++) {
        for (let teamIdx = 0; teamIdx < players.length; teamIdx++) {
          const team = players[teamIdx];
          const teamShooters = getEffectiveTeamPlayers(team);
          if (sIdx < teamShooters.length) {
            const sp = teamShooters[sIdx];
            const hasHit = sp.baseballHits?.[tIdx] !== undefined;
            if (!hasHit) {
              // Found the active slot!
              const tempTeam: Player = {
                ...team,
                currentSubPlayerIndex: sIdx,
              };
              const shooterInfo = getShooterInfo(tempTeam, { gameMode: 'BASEBALL' });

              // Look ahead for next slot (on deck)
              let nextSlotInfo: BaseballActiveSlot['nextSlot'] = undefined;
              let foundNext = false;
              for (let ntIdx = tIdx; ntIdx < targets.length && !foundNext; ntIdx++) {
                const startS = ntIdx === tIdx ? sIdx : 0;
                for (let nsIdx = startS; nsIdx < maxShooters && !foundNext; nsIdx++) {
                  const startTeam = ntIdx === tIdx && nsIdx === sIdx ? teamIdx + 1 : 0;
                  for (let nTeamIdx = startTeam; nTeamIdx < players.length && !foundNext; nTeamIdx++) {
                    const nTeam = players[nTeamIdx];
                    const nShooters = getEffectiveTeamPlayers(nTeam);
                    if (nsIdx < nShooters.length) {
                      const nSp = nShooters[nsIdx];
                      if (nSp.baseballHits?.[ntIdx] === undefined) {
                        const nTempTeam: Player = { ...nTeam, currentSubPlayerIndex: nsIdx };
                        const nInfo = getShooterInfo(nTempTeam, { gameMode: 'BASEBALL' });
                        nextSlotInfo = {
                          targetIdx: ntIdx,
                          targetVal: targets[ntIdx],
                          teamIdx: nTeamIdx,
                          subPlayerIdx: nsIdx,
                          teamName: nTeam.name,
                          shooterName:
                            nInfo.isDummyTurn && nInfo.dummyRotatedPlayerName
                              ? `${nInfo.dummyRotatedPlayerName} (for Dummy)`
                              : nInfo.shooterName,
                        };
                        foundNext = true;
                      }
                    }
                  }
                }
              }

              return {
                targetIdx: tIdx,
                targetVal: targets[tIdx],
                isTb: tIdx >= 9,
                teamIdx,
                subPlayerIdx: sIdx,
                team,
                subPlayer: sp,
                isDummyTurn: shooterInfo.isDummyTurn,
                shooterName: shooterInfo.shooterName,
                avatar: shooterInfo.avatar,
                displayFull: shooterInfo.displayFull,
                dummyRotatedPlayerName: shooterInfo.dummyRotatedPlayerName,
                nextSlot: nextSlotInfo,
              };
            }
          }
        }
      }
    }

    return null;
  };

  const activeSlot = getBaseballActiveSlot(matchState.players, currentTargets);
  const isTieBreakerActive = currentTargets.length > 9;
  const isMatchComplete = matchState.status === 'completed';

  // Announce thrower when turn begins or leg starts
  useEffect(() => {
    if (matchState.status === 'active' && activeSlot) {
      if (matchState.settings.announceAudio) {
        const teamWithActiveSub: Player = {
          ...activeSlot.team,
          currentSubPlayerIndex: activeSlot.subPlayerIdx,
        };
        announceCurrentShooter(teamWithActiveSub, 250, { gameMode: 'BASEBALL' });
      }
    }
  }, [activeSlot?.targetIdx, activeSlot?.teamIdx, activeSlot?.subPlayerIdx, matchState.currentLeg]);

  // Handle recording hits for a specific team, batter, and target
  const handleRecordHit = (teamIdx: number, subPlayerIdx: number, targetIdx: number, hits: number) => {
    if (matchState.status !== 'active') return;

    const targetTeam = matchState.players[teamIdx];
    const teamShooters = getEffectiveTeamPlayers(targetTeam);
    const subPlayer = teamShooters[subPlayerIdx] || teamShooters[0];

    // Compute shooter info for this turn
    const tempTeam: Player = { ...targetTeam, currentSubPlayerIndex: subPlayerIdx };
    const shooterInfo = getShooterInfo(tempTeam, { gameMode: 'BASEBALL' });
    const isDummyTurn = !!shooterInfo.isDummyTurn;

    // 1. Update the sub-player's individual baseball hits and runs
    const updatedTeamPlayers = teamShooters.map((sp, idx) => {
      if (idx !== subPlayerIdx) return sp;
      const prevHits = sp.baseballHits || {};
      const newHits = { ...prevHits, [targetIdx]: hits };
      const newScore = Object.values(newHits).reduce((sum: number, h) => sum + (Number(h) || 0), 0);
      const prevStats = sp.stats || {
        threeDartAvg: 0,
        first9Avg: 0,
        mpr: 0,
        highScore: 0,
        highOut: 0,
        checkoutAttempts: 0,
        checkoutHits: 0,
        count60Plus: 0,
        count100Plus: 0,
        count140Plus: 0,
        count180: 0,
        dartsThrown: 0,
      };

      return {
        ...sp,
        baseballHits: newHits,
        baseballScore: newScore,
        stats: {
          ...prevStats,
          dartsThrown: prevStats.dartsThrown + 3,
        },
      };
    });

    // 2. Advance dummy rotation if this was a dummy turn
    let updatedDummyIndices = { ...(targetTeam.dummyShooterIndices || {}) };
    if (isDummyTurn && subPlayer.isDummy) {
      const realPlayers = teamShooters.filter((p) => !p.isDummy);
      if (realPlayers.length > 0) {
        const curRot = updatedDummyIndices[subPlayer.id] || 0;
        updatedDummyIndices[subPlayer.id] = curRot + 1;
      }
    }

    // 3. Update team baseballHits (sum of all team sub-players on this target)
    const teamTargetRuns = updatedTeamPlayers.reduce(
      (sum, sp) => sum + (sp.baseballHits?.[targetIdx] ?? 0),
      0
    );
    const updatedTeamHits = {
      ...(targetTeam.baseballHits || {}),
      [targetIdx]: teamTargetRuns,
    };
    const newTeamTotalRuns = Object.values(updatedTeamHits).reduce((sum: number, h) => sum + (Number(h) || 0), 0);

    // 4. Update the players array
    const updatedPlayers = matchState.players.map((p, idx) => {
      if (idx === teamIdx) {
        return {
          ...p,
          baseballHits: updatedTeamHits,
          baseballScore: newTeamTotalRuns,
          teamPlayers: updatedTeamPlayers,
          dummyShooterIndices: updatedDummyIndices,
          stats: {
            ...p.stats,
            dartsThrown: p.stats.dartsThrown + 3,
          },
        };
      }
      return p;
    });

    // 5. Build turn log
    const segTarget = currentTargets[targetIdx];
    const isTb = targetIdx >= 9;
    const targetLabel = isTb ? `Tie-Breaker #${targetIdx - 8}` : `Target #${targetIdx + 1}`;
    const newTurnLog: TurnLog = {
      id: 'turn-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      turnNumber: matchState.history.length + 1,
      playerId: targetTeam.id,
      playerName: targetTeam.name,
      shooterName: isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      isDummyTurn,
      dummyRotatedPlayerName: isDummyTurn ? shooterInfo.dummyRotatedPlayerName : undefined,
      creditedPlayerName: isDummyTurn ? '🤖 Dummy Player' : shooterInfo.shooterName,
      score: hits,
      remainingBefore: 0,
      remainingAfter: hits,
      dartsUsed: 3,
      isBust: false,
      isCheckout: false,
      dartsDetail: [`${targetLabel} (${segTarget}): ${hits} Runs by ${shooterInfo.shooterName}`],
      timestamp: Date.now(),
      targetIndex: targetIdx,
      subPlayerIndex: subPlayerIdx,
      subPlayerId: subPlayer.id,
    };

    // 6. Check if next slot exists or if all shooters on all targets are completed
    const nextSlot = getBaseballActiveSlot(updatedPlayers, currentTargets);

    if (nextSlot === null) {
      // ALL PLAYERS ON ALL TEAMS HAVE SHOT AT ALL TARGETS!
      // Evaluate scores
      const teamScores = updatedPlayers.map((p) => ({
        player: p,
        score: p.baseballScore || 0,
      }));
      const maxScore = Math.max(...teamScores.map((ps) => ps.score));
      const tiedTeams = teamScores.filter((ps) => ps.score === maxScore);

      // Check if there is a TIE between top teams
      if (tiedTeams.length > 1) {
        // TIE DETECTED: Trigger Sudden Death Tie-Breaker Round!
        const usedNumbers = new Set(currentTargets.map((t) => Number(t)));
        const availablePool = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !usedNumbers.has(n));
        const nextTieBreakerTarget =
          availablePool.length > 0
            ? availablePool[Math.floor(Math.random() * availablePool.length)]
            : Math.floor(Math.random() * 20) + 1;

        const newTargets = [...currentTargets, nextTieBreakerTarget];
        const tbRoundNumber = newTargets.length - 9;

        setTieBreakerNotice(
          `Scores are tied at ${maxScore} Runs! Sudden Death Tie-Breaker Round #${tbRoundNumber} activated on Target Number ${nextTieBreakerTarget}! All players throw at this target.`
        );

        onUpdateMatch({
          ...matchState,
          players: updatedPlayers,
          settings: {
            ...matchState.settings,
            baseballTargets: newTargets,
          },
          activePlayerIndex: 0,
          history: [...matchState.history, newTurnLog],
        });
        return;
      }

      // Single Clear Winner!
      const winnerPlayer = tiedTeams[0].player;
      const winnerId = winnerPlayer.id;
      const winnerName = winnerPlayer.name;
      const newLegsWon = winnerPlayer.legsWon + 1;

      let isMatchOver = false;
      if (matchState.settings.format === 'legs') {
        if (newLegsWon >= matchState.settings.legsToWin) {
          isMatchOver = true;
        }
      }

      // Record completed leg
      const legRecord = {
        legNumber: matchState.currentLeg,
        setNumber: matchState.currentSet,
        gameMode: 'BASEBALL' as const,
        winnerId,
        winnerName,
        turns: [...matchState.history, newTurnLog],
        dartsCount: {
          [updatedPlayers[0].id]: updatedPlayers[0].stats.dartsThrown,
          [updatedPlayers[1]?.id || 'p2']: updatedPlayers[1]?.stats.dartsThrown || 0,
        },
        averages: {
          [updatedPlayers[0].id]: (updatedPlayers[0].baseballScore || 0) / currentTargets.length,
          [updatedPlayers[1]?.id || 'p2']: (updatedPlayers[1]?.baseballScore || 0) / currentTargets.length,
        },
      };

      // Fresh targets for next leg/game if continued
      const fresh9Targets = generateRandom9Targets();

      const resetPlayers = updatedPlayers.map((p) => {
        const cleanSubPlayers = getEffectiveTeamPlayers(p).map((sp) => ({
          ...sp,
          baseballHits: {},
          baseballScore: 0,
        }));
        return {
          ...p,
          legsWon: p.id === winnerId ? newLegsWon : p.legsWon,
          baseballHits: {},
          baseballScore: 0,
          teamPlayers: cleanSubPlayers,
        };
      });

      const isMedley = !!(matchState.settings.isMedley || matchState.settings.gameMode === 'MEDLEY');

      const stateWithUpdatedPlayers: MatchState = {
        ...matchState,
        players: updatedPlayers,
        history: [...matchState.history, newTurnLog],
      };

      if (isMedley) {
        const nextMedleyState = buildNextMedleyMatchState(stateWithUpdatedPlayers, winnerId, legRecord);
        setTieBreakerNotice(null);
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
              playerName: winnerName,
              type: 'match',
            });
          }
        } else {
          setPendingNextState(nextMedleyState);
          setWinnerModal({
            playerName: winnerName,
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
          recordWednesdayLegStats(legRecord, stateWithUpdatedPlayers);
          const winner = stateWithUpdatedPlayers.players.find((p) => p.id === winnerId);
          const loser = stateWithUpdatedPlayers.players.find((p) => p.id !== winnerId);
          if (winner && loser) {
            updateLeaguePoints(winner.name, loser.name, 'wednesday', stateWithUpdatedPlayers.players);
          }
        } catch (e) {
          console.error('Error recording standalone Wednesday Baseball stats', e);
        }
      }

      const updatedMatchState: MatchState = {
        ...matchState,
        status: isMatchOver ? 'completed' : 'active',
        players: resetPlayers,
        settings: {
          ...matchState.settings,
          baseballTargets: fresh9Targets,
        },
        currentLeg: isMatchOver ? matchState.currentLeg : matchState.currentLeg + 1,
        activePlayerIndex: 0,
        history: [...matchState.history, newTurnLog],
        completedLegs: [...matchState.completedLegs, legRecord],
        winnerId: isMatchOver ? winnerId : undefined,
      };

      setTieBreakerNotice(null);
      if (!isMatchOver) {
        setPendingNextState(updatedMatchState);
        setWinnerModal({
          playerName: winnerName,
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
            playerName: winnerName,
            type: 'match',
          });
        }
      }
    } else {
      // Advance to next batter in rotation
      const nextTeamIdx = nextSlot.teamIdx;
      const nextSubIdx = nextSlot.subPlayerIdx;

      onUpdateMatch({
        ...matchState,
        players: updatedPlayers.map((p, pIdx) => {
          if (pIdx === nextTeamIdx) {
            return {
              ...p,
              currentSubPlayerIndex: nextSubIdx,
            };
          }
          return p;
        }),
        activePlayerIndex: nextTeamIdx,
        history: [...matchState.history, newTurnLog],
      });
    }
  };

  // Undo last recorded hit
  const handleUndo = () => {
    if (matchState.history.length === 0) return;
    const lastLog = matchState.history[matchState.history.length - 1];
    const prevHistory = matchState.history.slice(0, -1);

    const targetIdx = lastLog.targetIndex;
    const subPlayerIdx = lastLog.subPlayerIndex;

    const updatedPlayers = matchState.players.map((team) => {
      if (team.id === lastLog.playerId) {
        const shooters = getEffectiveTeamPlayers(team);
        const updatedShooters = shooters.map((sp, sIdx) => {
          const isTargetSub =
            (lastLog.subPlayerId && sp.id === lastLog.subPlayerId) ||
            (typeof subPlayerIdx === 'number' && sIdx === subPlayerIdx);
          if (isTargetSub && typeof targetIdx === 'number') {
            const hits = { ...(sp.baseballHits || {}) };
            delete hits[targetIdx];
            const newScore = Object.values(hits).reduce((a: number, b) => a + (Number(b) || 0), 0);
            return {
              ...sp,
              baseballHits: hits,
              baseballScore: newScore,
              stats: {
                ...(sp.stats || {
                  threeDartAvg: 0,
                  first9Avg: 0,
                  mpr: 0,
                  highScore: 0,
                  highOut: 0,
                  checkoutAttempts: 0,
                  checkoutHits: 0,
                  count60Plus: 0,
                  count100Plus: 0,
                  count140Plus: 0,
                  count180: 0,
                  dartsThrown: 0,
                }),
                dartsThrown: Math.max(0, (sp.stats?.dartsThrown || 0) - 3),
              },
            };
          }
          return sp;
        });

        // Recalculate team baseballHits
        const newTeamHits: Record<number, number> = {};
        for (let i = 0; i < currentTargets.length; i++) {
          const hasAny = updatedShooters.some((sp) => sp.baseballHits?.[i] !== undefined);
          if (hasAny) {
            newTeamHits[i] = updatedShooters.reduce((sum, sp) => sum + (sp.baseballHits?.[i] ?? 0), 0);
          }
        }
        const newTeamScore = Object.values(newTeamHits).reduce((a: number, b) => a + (Number(b) || 0), 0);

        let updatedDummyIndices = { ...(team.dummyShooterIndices || {}) };
        if (lastLog.isDummyTurn && lastLog.subPlayerId) {
          const curRot = updatedDummyIndices[lastLog.subPlayerId] || 0;
          updatedDummyIndices[lastLog.subPlayerId] = Math.max(0, curRot - 1);
        }

        return {
          ...team,
          baseballHits: newTeamHits,
          baseballScore: newTeamScore,
          teamPlayers: updatedShooters,
          dummyShooterIndices: updatedDummyIndices,
          stats: {
            ...team.stats,
            dartsThrown: Math.max(0, team.stats.dartsThrown - 3),
          },
        };
      }
      return team;
    });

    const nextSlot = getBaseballActiveSlot(updatedPlayers, currentTargets);
    const activeTeamIdx = nextSlot ? nextSlot.teamIdx : matchState.activePlayerIndex;

    onUpdateMatch({
      ...matchState,
      status: 'active',
      winnerId: undefined,
      players: updatedPlayers,
      activePlayerIndex: activeTeamIdx,
      history: prevHistory,
    });
  };

  const activeTargetIdx = activeSlot ? activeSlot.targetIdx : currentTargets.length - 1;
  const activeTargetValue = currentTargets[activeTargetIdx] || currentTargets[0];

  const team1 = matchState.players[0];
  const team2 = matchState.players[1];
  const team1Shooters = team1 ? getEffectiveTeamPlayers(team1) : [];
  const team2Shooters = team2 ? getEffectiveTeamPlayers(team2) : [];
  const isMultiPlayerTeam = team1Shooters.length > 1 || team2Shooters.length > 1;

  const winnerPlayer =
    matchState.players.find((p) => p.id === matchState.winnerId) ||
    (matchState.players[0].legsWon > (matchState.players[1]?.legsWon || 0)
      ? matchState.players[0]
      : matchState.players[1]);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4 space-y-3 pb-8">
      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-xl p-3 sm:p-4 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="px-2 py-0.2 bg-amber-500 text-slate-950 rounded font-black text-[10px] uppercase tracking-wider">
                {matchState.settings.leagueType === 'wednesday' ? 'Wednesday League' : 'Baseball Darts'}
              </span>
              <span className="px-2 py-0.2 bg-indigo-600/60 text-white rounded font-bold text-[10px] uppercase tracking-wider">
                {isMatchComplete ? 'Match Complete' : `Leg ${matchState.currentLeg}`}
              </span>
              {isTieBreakerActive && !isMatchComplete && (
                <span className="px-2 py-0.2 bg-rose-600 text-white rounded font-black text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> Sudden Death Tie-Breaker
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-1.5 text-white">
              <span>⚾ Baseball Darts</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Every player on each team shoots at all 9 targets in order (3 darts each, runs 0–9).
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

            {!isMatchComplete && (
              <button
                onClick={handleGenerateAITargets}
                disabled={isGeneratingAI}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAI ? 'Selecting...' : '🎲 New Targets'}</span>
              </button>
            )}

            {isMultiPlayerTeam && !isMatchComplete && (
              <button
                onClick={() => setShowOrderModal(true)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <ArrowUpDown className="w-3 h-3 text-amber-300" /> Batting Order
              </button>
            )}

            <button
              onClick={() => setShowEmailModal(true)}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition-colors uppercase tracking-wider cursor-pointer shadow-xs"
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

            <button
              onClick={onNewMatchRequest}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg border border-slate-700 transition-colors uppercase tracking-wider cursor-pointer"
            >
              New Match
            </button>
          </div>
        </div>

        {/* Tie-Breaker Alert Banner if Active */}
        {tieBreakerNotice && !isMatchComplete && (
          <div className="mt-2.5 p-2 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-center justify-between gap-2 text-amber-200 text-xs font-bold animate-pulse">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🚨</span>
              <span>{tieBreakerNotice}</span>
            </div>
            <button
              onClick={() => setTieBreakerNotice(null)}
              className="text-[10px] font-black underline text-amber-300 hover:text-white uppercase tracking-wider cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Assigned Target Numbers Bar (Lowest to Highest) */}
        {!isMatchComplete && (
          <div className="mt-3 pt-2.5 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Assigned Targets (1–20, Ascending)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {currentTargets.length} Targets {isTieBreakerActive ? '(+ Tie-Breaker)' : ''}
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-10 gap-1.5">
              {currentTargets.map((target, idx) => {
                const isTargetActive = idx === activeTargetIdx;
                const isTb = idx >= 9;
                return (
                  <div
                    key={idx}
                    className={`p-1.5 rounded-lg text-center border transition-all ${
                      isTargetActive
                        ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/40'
                        : isTb
                        ? 'bg-rose-950/40 border-rose-500/50'
                        : 'bg-slate-800/80 border-slate-700'
                    }`}
                  >
                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {isTb ? `TB #${idx - 8}` : `#${idx + 1}`}
                    </span>
                    <span
                      className={`text-sm sm:text-base font-black font-mono block leading-tight ${
                        isTb ? 'text-rose-400' : isTargetActive ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {target}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isMatchComplete ? (
        /* DEDICATED BASEBALL MATCH COMPLETED VIEW */
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
                    Final Score: <strong className="text-white">{matchState.players[0].name} ({matchState.players[0].legsWon}) — {matchState.players[1]?.name || 'P2'} ({matchState.players[1]?.legsWon || 0})</strong>
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
                  id="baseball-share-results-email-btn"
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

          {/* Player Match Stats Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchState.players.map((player) => {
              const isWinner =
                player.id === matchState.winnerId ||
                player.legsWon > (matchState.players.find((p) => p.id !== player.id)?.legsWon || 0);

              const effectiveList = getEffectiveTeamPlayers(player);

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
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Runs
                      </span>
                      <span className="text-base font-mono font-black text-indigo-600">
                        {player.baseballScore || calculateTotalRuns(player.baseballHits)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Darts Thrown
                      </span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.stats.dartsThrown}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Legs Won
                      </span>
                      <span className="text-base font-mono font-black text-slate-800">
                        {player.legsWon}
                      </span>
                    </div>
                  </div>

                  {/* Sub-player breakdown for teams */}
                  {effectiveList.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Individual Player Runs & Darts
                      </span>
                      <div className="space-y-1.5">
                        {effectiveList.map((subP, sIdx) => (
                          <div
                            key={`sub-${player.id}-${subP.id || sIdx}`}
                            className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"
                          >
                            <span className="font-bold text-slate-700">
                              {subP.name}
                              {subP.isDummy ? ' [🤖 Dummy]' : ''}
                            </span>
                            <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                              <span>
                                Darts: <strong>{subP.stats?.dartsThrown || 0}</strong>
                              </span>
                              <span>
                                Runs:{' '}
                                <strong className="text-indigo-600 font-black">
                                  {subP.baseballScore || 0}
                                </strong>
                              </span>
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
          {/* Prominent Active Turn & Batter Up Indicator Banner */}
          {matchState.status === 'active' && activeSlot && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-3.5 ring-2 ring-amber-400/20">
              <div className="flex items-center gap-3.5 w-full md:w-auto">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 text-2xl font-black shadow-lg shrink-0 border border-amber-300">
                  {activeSlot.isDummyTurn ? '🤖' : activeSlot.avatar || '🎯'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-md animate-pulse shadow-xs flex items-center gap-1">
                      <span>⚾</span>
                      <span>NOW UP TO BAT</span>
                    </span>
                    <span className="text-xs text-indigo-200 font-bold bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700">
                      Target #{activeSlot.targetIdx + 1}:{' '}
                      <strong className="text-amber-300 font-mono text-sm">{activeSlot.targetVal}</strong>
                    </span>
                    {getEffectiveTeamPlayers(activeSlot.team).length > 1 && (
                      <span className="text-[10px] text-amber-300/90 font-bold">
                        Batter {activeSlot.subPlayerIdx + 1} of {getEffectiveTeamPlayers(activeSlot.team).length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2 truncate">
                      <span className="text-amber-300 underline decoration-amber-400/60 decoration-2 underline-offset-2">
                        {activeSlot.isDummyTurn && activeSlot.dummyRotatedPlayerName
                          ? `${activeSlot.dummyRotatedPlayerName} (shooting for Dummy)`
                          : activeSlot.shooterName}
                      </span>
                      {getEffectiveTeamPlayers(activeSlot.team).length > 1 && (
                        <span className="text-xs text-slate-300 font-semibold truncate">
                          &bull; Team: <strong className="text-white">{activeSlot.team.name}</strong>
                        </span>
                      )}
                    </h2>
                    {activeSlot.nextSlot && (
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        On deck / Up next:{' '}
                        <strong className="text-slate-200">
                          {activeSlot.nextSlot.shooterName} ({activeSlot.nextSlot.teamName})
                        </strong>{' '}
                        on Target #{activeSlot.nextSlot.targetIdx + 1} ({activeSlot.nextSlot.targetVal})
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Score Selector (0-9 Runs) for the active player's active target */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center md:justify-end w-full md:w-auto bg-slate-800/90 p-2.5 rounded-xl border border-slate-700 shadow-inner">
                <span className="text-[10px] uppercase font-black text-amber-300 mr-1 hidden sm:inline">
                  Score Runs:
                </span>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      handleRecordHit(
                        activeSlot.teamIdx,
                        activeSlot.subPlayerIdx,
                        activeSlot.targetIdx,
                        num
                      )
                    }
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 hover:bg-amber-400 hover:text-slate-950 text-white border border-slate-700 hover:border-amber-400 font-mono font-black text-sm transition-all shadow-xs active:scale-90 cursor-pointer flex items-center justify-center"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Unified Scoreboard Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-2 sm:p-4 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              {isMultiPlayerTeam ? (
                /* MULTI-PLAYER TEAM SCORECARD (EVERY PLAYER HAS THEIR OWN COLUMN FOR ALL TARGETS) */
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    {/* Super Header: Teams */}
                    <tr className="border-b border-slate-300 bg-slate-100 text-slate-800 text-xs uppercase tracking-wider font-black">
                      <th className="py-2.5 px-3 border-r border-slate-300 w-28 text-center">
                        Target #
                      </th>
                      <th
                        colSpan={team1Shooters.length + 1}
                        className="py-2.5 px-3 border-r-2 border-slate-400 bg-indigo-50/70 text-indigo-950"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-extrabold text-sm">
                            <span>{team1?.avatar || '🎯'}</span>
                            <span>{team1?.name}</span>
                          </span>
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded font-mono font-black">
                            Total: {team1?.baseballScore || 0} Runs
                          </span>
                        </div>
                      </th>
                      <th
                        colSpan={team2Shooters.length + 1}
                        className="py-2.5 px-3 bg-amber-50/70 text-amber-950"
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-extrabold text-sm">
                            <span>{team2?.avatar || '🎯'}</span>
                            <span>{team2?.name}</span>
                          </span>
                          <span className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-mono font-black">
                            Total: {team2?.baseballScore || 0} Runs
                          </span>
                        </div>
                      </th>
                    </tr>

                    {/* Sub Header: Individual Batters & Inning Totals */}
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                      <th className="py-2 px-3 border-r border-slate-200 text-center font-mono">
                        Inning
                      </th>
                      {/* Team 1 Batters */}
                      {team1Shooters.map((sp, idx) => (
                        <th
                          key={`h1-${sp.id || idx}`}
                          className="py-2 px-2 text-center border-r border-slate-200 truncate max-w-[110px]"
                          title={sp.name}
                        >
                          <span className="block font-black text-slate-900 truncate">
                            {sp.name}
                            {sp.isDummy ? ' 🤖' : ''}
                          </span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            Batter #{idx + 1}
                          </span>
                        </th>
                      ))}
                      <th className="py-2 px-2.5 text-center border-r-2 border-slate-400 bg-indigo-100/50 font-black text-indigo-900 text-xs">
                        Team
                      </th>

                      {/* Team 2 Batters */}
                      {team2Shooters.map((sp, idx) => (
                        <th
                          key={`h2-${sp.id || idx}`}
                          className="py-2 px-2 text-center border-r border-slate-200 truncate max-w-[110px]"
                          title={sp.name}
                        >
                          <span className="block font-black text-slate-900 truncate">
                            {sp.name}
                            {sp.isDummy ? ' 🤖' : ''}
                          </span>
                          <span className="text-[9px] text-slate-400 font-normal">
                            Batter #{idx + 1}
                          </span>
                        </th>
                      ))}
                      <th className="py-2 px-2.5 text-center bg-amber-100/50 font-black text-amber-950 text-xs">
                        Team
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-xs">
                    {currentTargets.map((targetVal, targetIdx) => {
                      const isTb = targetIdx >= 9;
                      const isTargetActive = activeSlot?.targetIdx === targetIdx;

                      // Calculate team runs for this inning
                      const t1InningRuns = team1Shooters.reduce(
                        (sum, sp) => sum + (sp.baseballHits?.[targetIdx] ?? 0),
                        0
                      );
                      const t1HasAny = team1Shooters.some(
                        (sp) => sp.baseballHits?.[targetIdx] !== undefined
                      );

                      const t2InningRuns = team2Shooters.reduce(
                        (sum, sp) => sum + (sp.baseballHits?.[targetIdx] ?? 0),
                        0
                      );
                      const t2HasAny = team2Shooters.some(
                        (sp) => sp.baseballHits?.[targetIdx] !== undefined
                      );

                      return (
                        <tr
                          key={targetIdx}
                          className={`transition-colors ${
                            isTargetActive
                              ? 'bg-amber-50/40 font-semibold'
                              : isTb
                              ? 'bg-rose-50/30'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Column 1: Inning & Target */}
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-mono">
                              <span className="text-[10px] text-slate-400 font-bold">
                                {isTb ? `TB` : `#${targetIdx + 1}`}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-black text-sm ${
                                  isTb
                                    ? 'bg-rose-600 text-white'
                                    : isTargetActive
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-white'
                                }`}
                              >
                                {targetVal}
                              </span>
                            </div>
                          </td>

                          {/* Team 1 Shooters Cells */}
                          {team1Shooters.map((sp, sIdx) => {
                            const isThisActiveSlot =
                              activeSlot?.targetIdx === targetIdx &&
                              activeSlot?.teamIdx === 0 &&
                              activeSlot?.subPlayerIdx === sIdx;
                            const recordedHit = sp.baseballHits?.[targetIdx];
                            const isRecorded = recordedHit !== undefined;

                            return (
                              <td
                                key={`c1-${sp.id || sIdx}-${targetIdx}`}
                                className={`py-1.5 px-1.5 text-center border-r border-slate-200 ${
                                  isThisActiveSlot
                                    ? 'bg-amber-200/70 ring-2 ring-amber-400'
                                    : ''
                                }`}
                              >
                                {isThisActiveSlot ? (
                                  <select
                                    value={recordedHit ?? ''}
                                    onChange={(e) => {
                                      const val =
                                        e.target.value !== '' ? parseInt(e.target.value) : 0;
                                      handleRecordHit(0, sIdx, targetIdx, val);
                                    }}
                                    className="w-full font-black text-xs py-1 px-1 rounded border-2 border-amber-500 bg-white text-slate-950 cursor-pointer shadow-xs"
                                  >
                                    <option value="" disabled>
                                      Runs?
                                    </option>
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                      <option key={n} value={n}>
                                        {n} Runs
                                      </option>
                                    ))}
                                  </select>
                                ) : isRecorded ? (
                                  <div className="inline-flex items-center justify-center">
                                    <select
                                      value={recordedHit}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleRecordHit(0, sIdx, targetIdx, val);
                                      }}
                                      title="Click to edit score"
                                      className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 cursor-pointer hover:bg-indigo-100"
                                    >
                                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Team 1 Inning Total */}
                          <td className="py-2 px-2 text-center border-r-2 border-slate-400 bg-indigo-50/40 font-mono font-black text-indigo-900">
                            {t1HasAny ? t1InningRuns : <span className="text-slate-300 font-normal">-</span>}
                          </td>

                          {/* Team 2 Shooters Cells */}
                          {team2Shooters.map((sp, sIdx) => {
                            const isThisActiveSlot =
                              activeSlot?.targetIdx === targetIdx &&
                              activeSlot?.teamIdx === 1 &&
                              activeSlot?.subPlayerIdx === sIdx;
                            const recordedHit = sp.baseballHits?.[targetIdx];
                            const isRecorded = recordedHit !== undefined;

                            return (
                              <td
                                key={`c2-${sp.id || sIdx}-${targetIdx}`}
                                className={`py-1.5 px-1.5 text-center border-r border-slate-200 ${
                                  isThisActiveSlot
                                    ? 'bg-amber-200/70 ring-2 ring-amber-400'
                                    : ''
                                }`}
                              >
                                {isThisActiveSlot ? (
                                  <select
                                    value={recordedHit ?? ''}
                                    onChange={(e) => {
                                      const val =
                                        e.target.value !== '' ? parseInt(e.target.value) : 0;
                                      handleRecordHit(1, sIdx, targetIdx, val);
                                    }}
                                    className="w-full font-black text-xs py-1 px-1 rounded border-2 border-amber-500 bg-white text-slate-950 cursor-pointer shadow-xs"
                                  >
                                    <option value="" disabled>
                                      Runs?
                                    </option>
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                      <option key={n} value={n}>
                                        {n} Runs
                                      </option>
                                    ))}
                                  </select>
                                ) : isRecorded ? (
                                  <div className="inline-flex items-center justify-center">
                                    <select
                                      value={recordedHit}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        handleRecordHit(1, sIdx, targetIdx, val);
                                      }}
                                      title="Click to edit score"
                                      className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-950 cursor-pointer hover:bg-amber-100"
                                    >
                                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Team 2 Inning Total */}
                          <td className="py-2 px-2 text-center bg-amber-50/40 font-mono font-black text-amber-950">
                            {t2HasAny ? t2InningRuns : <span className="text-slate-300 font-normal">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Table Footer: TOTAL RUNS */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-400">
                      <td className="py-3 px-3 border-r border-slate-800 text-center uppercase tracking-wider text-xs">
                        TOTAL RUNS
                      </td>

                      {/* Team 1 Player Totals */}
                      {team1Shooters.map((sp, idx) => (
                        <td
                          key={`tot1-${sp.id || idx}`}
                          className="py-3 px-2 text-center border-r border-slate-800 font-mono text-sm"
                        >
                          <span className="block text-slate-300 font-black">
                            {sp.baseballScore || 0}
                          </span>
                          <span className="text-[9px] font-normal text-slate-400">
                            Runs
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-2 text-center border-r-2 border-slate-500 bg-indigo-950 font-mono text-base font-black text-amber-300">
                        {team1?.baseballScore || 0}
                      </td>

                      {/* Team 2 Player Totals */}
                      {team2Shooters.map((sp, idx) => (
                        <td
                          key={`tot2-${sp.id || idx}`}
                          className="py-3 px-2 text-center border-r border-slate-800 font-mono text-sm"
                        >
                          <span className="block text-slate-300 font-black">
                            {sp.baseballScore || 0}
                          </span>
                          <span className="text-[9px] font-normal text-slate-400">
                            Runs
                          </span>
                        </td>
                      ))}
                      <td className="py-3 px-2 text-center bg-amber-950 font-mono text-base font-black text-amber-300">
                        {team2?.baseballScore || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                /* SINGLES (1v1) SCORECARD */
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-black">
                      <th className="py-2.5 px-4 w-36 text-center">Target Number</th>
                      <th className="py-2.5 px-4 text-center">
                        {team1?.name} ({team1?.baseballScore || 0} Runs)
                      </th>
                      <th className="py-2.5 px-4 text-center">
                        {team2?.name} ({team2?.baseballScore || 0} Runs)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {currentTargets.map((targetVal, targetIdx) => {
                      const isTb = targetIdx >= 9;
                      const isTargetActive = activeSlot?.targetIdx === targetIdx;
                      const p1Hits = team1Shooters[0]?.baseballHits?.[targetIdx];
                      const p2Hits = team2Shooters[0]?.baseballHits?.[targetIdx];
                      const isP1Active = isTargetActive && activeSlot?.teamIdx === 0;
                      const isP2Active = isTargetActive && activeSlot?.teamIdx === 1;

                      return (
                        <tr
                          key={targetIdx}
                          className={`${
                            isTargetActive ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2 px-4 text-center">
                            <span className="font-mono font-black text-sm px-2 py-0.5 rounded bg-slate-800 text-white">
                              {targetVal} {isTb ? '(TB)' : ''}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-center">
                            {isP1Active ? (
                              <select
                                value={p1Hits ?? ''}
                                onChange={(e) =>
                                  handleRecordHit(
                                    0,
                                    0,
                                    targetIdx,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="font-black text-xs px-2 py-1 rounded border-2 border-amber-500 bg-white"
                              >
                                <option value="" disabled>Runs?</option>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                  <option key={n} value={n}>{n} Runs</option>
                                ))}
                              </select>
                            ) : p1Hits !== undefined ? (
                              <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200">
                                {p1Hits} Runs
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {isP2Active ? (
                              <select
                                value={p2Hits ?? ''}
                                onChange={(e) =>
                                  handleRecordHit(
                                    1,
                                    0,
                                    targetIdx,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="font-black text-xs px-2 py-1 rounded border-2 border-amber-500 bg-white"
                              >
                                <option value="" disabled>Runs?</option>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                  <option key={n} value={n}>{n} Runs</option>
                                ))}
                              </select>
                            ) : p2Hits !== undefined ? (
                              <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-amber-50 text-amber-950 border border-amber-200">
                                {p2Hits} Runs
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-sm">
                      <td className="py-3 px-4 text-center uppercase tracking-wider">TOTAL RUNS</td>
                      <td className="py-3 px-4 text-center font-mono text-amber-400 text-lg">
                        {team1?.baseballScore || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-amber-400 text-lg">
                        {team2?.baseballScore || 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>

          {/* Turn Feed Activity Log */}
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Match Activity Log</span>
              <span className="text-slate-400 font-normal">{matchState.history.length} turns</span>
            </h3>

            {matchState.history.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-mono py-1.5 text-center">
                No turns completed yet in this leg.
              </p>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 text-[11px]">
                {matchState.history
                  .slice(-4)
                  .reverse()
                  .map((turn) => (
                    <div
                      key={turn.id}
                      className="flex items-center justify-between bg-slate-50 p-1.5 rounded border border-slate-200"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="px-1 py-0.2 bg-slate-200 text-slate-700 rounded font-bold font-mono text-[10px]">
                          #{turn.turnNumber}
                        </span>
                        <span className="font-bold text-slate-900">
                          {turn.shooterName || turn.playerName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({turn.playerName})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[10px]">
                          {turn.dartsDetail?.[0]}
                        </span>
                        <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          +{turn.score} Runs
                        </span>
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
            <div className="w-16 h-16 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg text-slate-950">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {winnerModal.type === 'match' ? 'MATCH VICTORY!' : 'BASEBALL GAME / LEG WON!'}
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
                  <span>
                    {matchState.players[0]?.name || 'Player 1'}:{' '}
                    <strong className="text-indigo-600">
                      {winnerModal.p1Score ?? matchState.players[0]?.legsWon}
                    </strong>
                  </span>
                  <span className="text-slate-400">&bull;</span>
                  <span>
                    {matchState.players[1]?.name || 'Player 2'}:{' '}
                    <strong className="text-indigo-600">
                      {winnerModal.p2Score ?? matchState.players[1]?.legsWon}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <p className="text-slate-500 text-xs mb-5">
              {winnerModal.type === 'match'
                ? 'Congratulations! Baseball Match completed with all player scores logged.'
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
                    id="baseball-modal-share-results-email-btn"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md no-underline cursor-pointer"
                  >
                    <Mail className="w-4 h-4 stroke-[2.5]" /> SHARE RESULTS VIA EMAIL
                  </a>

                  <button
                    onClick={onNewMatchRequest}
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
    </div>
  );
};
