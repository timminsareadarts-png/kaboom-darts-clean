import { MatchState, Player, LegRecord } from '../types';
import { PlayerRosterItem, MASTER_ROSTER_PLAYERS } from '../data/defaultPlayers';
import { syncPlayerRosterToCloud } from './cloudSync';
import { calculateAutomatedLeaderboard } from '../utils/leagueHelper';

export interface CompletedMatchPlayerStat {
  id: string;
  name: string;
  avatar: string;
  isWinner: boolean;
  legsWon: number;
  legsPlayed: number;
  threeDartAvg: number;
  highScore: number;
  highOut: number;
  count180: number;
  dartsThrown: number;
  totalScore: number;
  bullsHit: number;
}

export interface CompletedMatchRecord {
  matchId: string;
  matchCode?: string;
  completedAt: number;
  leagueType?: string;
  gameMode?: string;
  format?: string;
  winnerName: string;
  winnerId?: string;
  players: CompletedMatchPlayerStat[];
  legsCount: number;
}

const COMPLETED_MATCHES_LOG_KEY = 'kaboom_completed_matches_log';
const MATCH_HISTORY_LOG_KEY = 'kaboom_match_history_log';
const PLAYERS_ROSTER_KEY = 'kaboom_dart_players';

/**
 * Retrieve the set of match IDs already processed into player running totals.
 */
export const getCompletedMatchLog = (): string[] => {
  try {
    const raw = localStorage.getItem(COMPLETED_MATCHES_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load completed matches log', e);
  }
  return [];
};

/**
 * Retrieve the full chronological match history log.
 * For Wednesday league only: clears all stats/matches earned in Wednesday league.
 */
export const getMatchHistoryLog = (): CompletedMatchRecord[] => {
  try {
    const raw = localStorage.getItem(MATCH_HISTORY_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((m: CompletedMatchRecord) => {
          if (m?.leagueType === 'wednesday') {
            return false;
          }
          return true;
        });
        if (filtered.length !== parsed.length) {
          localStorage.setItem(MATCH_HISTORY_LOG_KEY, JSON.stringify(filtered));
        }
        return filtered;
      }
    }
  } catch (e) {
    console.error('Failed to load match history log', e);
  }
  return [];
};

/**
 * Retrieve completed match history specifically for a player.
 */
export const getPlayerMatchHistory = (playerNameOrId: string): CompletedMatchRecord[] => {
  if (!playerNameOrId) return [];
  const target = playerNameOrId.toLowerCase().trim();
  const allHistory = getMatchHistoryLog();
  return allHistory.filter((m) =>
    m.players?.some(
      (p) =>
        p.name.toLowerCase().trim() === target ||
        p.id.toLowerCase().trim() === target ||
        p.name.toLowerCase().includes(target)
    )
  );
};

/**
 * Helper to extract individual player names from team/doubles strings or teamPlayers array.
 */
function extractIndividualPlayers(
  player: Player,
  isWinner: boolean,
  matchState: MatchState
): { name: string; avatar: string; id: string; stats: any; bulls: number; legsWon: number }[] {
  const results: { name: string; avatar: string; id: string; stats: any; bulls: number; legsWon: number }[] = [];

  // Check if teamPlayers array exists
  if (Array.isArray(player.teamPlayers) && player.teamPlayers.length > 0) {
    player.teamPlayers.forEach((tp) => {
      const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
      if (isDummy) return;
      const cleanName = tp.name?.trim();
      if (!cleanName) return;

      let bulls = 0;
      if (matchState.bullsRoundResults && Array.isArray(matchState.bullsRoundResults)) {
        const bRec = matchState.bullsRoundResults.find(
          (b) => b.shooterName?.toLowerCase().trim() === cleanName.toLowerCase() || b.shooterId === tp.id
        );
        if (bRec?.bullsHit) bulls = bRec.bullsHit;
      }

      results.push({
        id: tp.id || `p-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        name: cleanName,
        avatar: tp.avatar || (cleanName.toLowerCase() === 'maurice' ? '🦸‍♂️' : '🎯'),
        stats: tp.stats || player.stats,
        bulls,
        legsWon: player.legsWon || 0,
      });
    });
    return results;
  }

  // Single player or delimited names
  const rawNames = player.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i);
  rawNames.forEach((rn) => {
    const isDummy = Boolean(player.isDummy || rn.toLowerCase().includes('dummy') || rn.includes('🤖'));
    if (isDummy) return;
    const cleanName = rn.trim();
    if (!cleanName) return;

    let bulls = 0;
    if (matchState.bullsRoundResults && Array.isArray(matchState.bullsRoundResults)) {
      const bRec = matchState.bullsRoundResults.find(
        (b) => b.shooterName?.toLowerCase().trim() === cleanName.toLowerCase() || b.shooterId === player.id
      );
      if (bRec?.bullsHit) bulls = bRec.bullsHit;
    }

    results.push({
      id: player.id || `p-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name: cleanName,
      avatar: player.avatar || (cleanName.toLowerCase() === 'maurice' ? '🦸‍♂️' : '🎯'),
      stats: player.stats,
      bulls,
      legsWon: player.legsWon || 0,
    });
  });

  return results;
}

/**
 * Reconciles player running totals by combining current roster entries,
 * calculated leaderboard standings, and past recorded match history.
 * Ensures numbers only ever increment or improve and are never lost.
 */
export const reconcilePlayerRunningTotals = (
  baseRoster?: PlayerRosterItem[]
): PlayerRosterItem[] => {
  let roster: PlayerRosterItem[] = [];
  if (Array.isArray(baseRoster) && baseRoster.length > 0) {
    roster = [...baseRoster];
  } else {
    try {
      const saved = localStorage.getItem(PLAYERS_ROSTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          roster = parsed;
        }
      }
    } catch (e) {}
  }

  if (roster.length === 0) {
    roster = [...MASTER_ROSTER_PLAYERS];
  }

  const playerMap = new Map<string, PlayerRosterItem>();
  roster.forEach((p) => {
    if (!p || !p.name) return;
    const key = p.name.toLowerCase().trim();
    playerMap.set(key, { ...p });
  });

  // 1. Cross-reference automated leaderboard
  try {
    const leaderboard = calculateAutomatedLeaderboard();
    leaderboard.forEach((lb) => {
      if (!lb || !lb.playerName || lb.playerName.toLowerCase().includes('dummy')) return;
      const key = lb.playerName.toLowerCase().trim();
      const existing = playerMap.get(key);
      if (existing) {
        existing.matchesPlayed = Math.max(existing.matchesPlayed || 0, lb.totalPlayed || 0);
        existing.matchesWon = Math.max(existing.matchesWon || 0, lb.totalWins || 0);
        if (lb.threeDartAvg > 0) {
          existing.careerAvg = existing.careerAvg > 0
            ? Number(Math.max(existing.careerAvg, lb.threeDartAvg).toFixed(1))
            : lb.threeDartAvg;
        }
        existing.highCheckout = Math.max(existing.highCheckout || 0, lb.highCheckout || 0);
        existing.total180s = Math.max(existing.total180s || 0, lb.total180s || 0);
        existing.seasonBullsHit = Math.max(existing.seasonBullsHit || 0, lb.seasonBullsHit || 0);
        if (lb.avatar && lb.avatar !== '🎯' && existing.avatar === '🎯') {
          existing.avatar = lb.avatar;
        }
      } else {
        playerMap.set(key, {
          id: lb.playerId || `p-${key.replace(/[^a-z0-9]/g, '')}`,
          name: lb.playerName,
          avatar: lb.avatar || (lb.playerName.toLowerCase() === 'maurice' ? '🦸‍♂️' : '🎯'),
          matchesPlayed: lb.totalPlayed || 0,
          matchesWon: lb.totalWins || 0,
          careerAvg: lb.threeDartAvg || 0,
          highCheckout: lb.highCheckout || 0,
          total180s: lb.total180s || 0,
          seasonBullsHit: lb.seasonBullsHit || 0,
        });
      }
    });
  } catch (e) {
    console.error('Error in reconcilePlayerRunningTotals with leaderboard', e);
  }

  // 2. Cross-reference recorded match history
  try {
    const matchHistory = getMatchHistoryLog();
    matchHistory.forEach((match) => {
      match.players.forEach((mp) => {
        if (!mp.name || mp.name.toLowerCase().includes('dummy')) return;
        const key = mp.name.toLowerCase().trim();
        const existing = playerMap.get(key);
        if (existing) {
          if (mp.highOut > 0) {
            existing.highCheckout = Math.max(existing.highCheckout || 0, mp.highOut);
          }
          if (mp.bullsHit > 0) {
            existing.seasonBullsHit = Math.max(existing.seasonBullsHit || 0, (existing.seasonBullsHit || 0) + mp.bullsHit);
          }
        }
      });
    });
  } catch (e) {}

  const sorted = Array.from(playerMap.values()).sort((a, b) => {
    if ((b.matchesWon || 0) !== (a.matchesWon || 0)) return (b.matchesWon || 0) - (a.matchesWon || 0);
    if ((b.matchesPlayed || 0) !== (a.matchesPlayed || 0)) return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
    return a.name.localeCompare(b.name);
  });

  return sorted;
};

/**
 * Triggers an immutable update of total player stats upon match completion.
 * Guarantee:
 *  - Strict idempotency: Each match ID is only recorded once.
 *  - Running totals: Matches played, matches won, running career average, high checkout,
 *    total 180s, and bulls are immutably updated.
 *  - Persistent storage: Writes immediately to localStorage and triggers cloud sync
 *    (both Firestore `/league_roster/master_players` and REST `/api/roster` / `/api/venue-state`).
 */
export const recordCompletedMatchStats = (
  matchState: MatchState
): { updatedPlayers: PlayerRosterItem[]; isFirstTimeRecorded: boolean } => {
  if (!matchState || !Array.isArray(matchState.players) || matchState.players.length === 0) {
    return { updatedPlayers: reconcilePlayerRunningTotals(), isFirstTimeRecorded: false };
  }

  // BYE PROTECTION: A bye does not count as a win and counts nothing for stats
  const hasBye =
    matchState.settings?.isBye ||
    matchState.players.some(
      (p) =>
        p.name?.toUpperCase().includes('BYE') ||
        p.id?.toLowerCase().includes('bye')
    );
  if (hasBye) {
    return { updatedPlayers: reconcilePlayerRunningTotals(), isFirstTimeRecorded: false };
  }

  const isCompleted =
    matchState.status === 'completed' ||
    Boolean(matchState.winnerId) ||
    Boolean(matchState.winnerName) ||
    matchState.players.some((p) => (p.legsWon || 0) >= (matchState.settings?.legsToWin || 3));

  if (!isCompleted) {
    return { updatedPlayers: reconcilePlayerRunningTotals(), isFirstTimeRecorded: false };
  }

  // Unique identifier for this match
  const matchId =
    matchState.id ||
    matchState.matchCode ||
    `match_${matchState.settings?.leagueType || 'league'}_${matchState.updatedAt || Date.now()}`;

  const completedLog = getCompletedMatchLog();
  if (completedLog.includes(matchId)) {
    // Already processed, return current reconciled state without re-incrementing
    return { updatedPlayers: reconcilePlayerRunningTotals(), isFirstTimeRecorded: false };
  }

  // Determine winning team / player
  const p0 = matchState.players[0];
  const p1 = matchState.players[1];
  let winnerIndex = -1;

  if (matchState.winnerId) {
    winnerIndex = matchState.players.findIndex((p) => p.id === matchState.winnerId);
  }
  if (winnerIndex === -1 && matchState.winnerName) {
    winnerIndex = matchState.players.findIndex((p) =>
      p.name.toLowerCase().trim() === matchState.winnerName?.toLowerCase().trim()
    );
  }
  if (winnerIndex === -1 && p0 && p1) {
    if ((p0.legsWon || 0) > (p1.legsWon || 0)) winnerIndex = 0;
    else if ((p1.legsWon || 0) > (p0.legsWon || 0)) winnerIndex = 1;
  }

  const totalLegsInMatch =
    matchState.completedLegs && matchState.completedLegs.length > 0
      ? matchState.completedLegs.length
      : (p0?.legsWon || 0) + (p1?.legsWon || 0);

  // Load current roster to update
  let currentRoster: PlayerRosterItem[] = [];
  try {
    const raw = localStorage.getItem(PLAYERS_ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        currentRoster = parsed;
      }
    }
  } catch (e) {}

  if (currentRoster.length === 0) {
    currentRoster = [...MASTER_ROSTER_PLAYERS];
  }

  const playerMap = new Map<string, PlayerRosterItem>();
  currentRoster.forEach((p) => {
    if (!p || !p.name) return;
    const key = p.name.toLowerCase().trim();
    playerMap.set(key, { ...p });
  });

  const matchPlayerStatsList: CompletedMatchPlayerStat[] = [];
  const winningPlayerNames: string[] = [];

  // Process all players in match
  matchState.players.forEach((p, idx) => {
    const isThisPlayerWinner = idx === winnerIndex;
    const individuals = extractIndividualPlayers(p, isThisPlayerWinner, matchState);

    individuals.forEach((ind) => {
      if (isThisPlayerWinner) {
        winningPlayerNames.push(ind.name);
      }

      const key = ind.name.toLowerCase().trim();
      let rosterPlayer = playerMap.get(key);
      if (!rosterPlayer) {
        rosterPlayer = {
          id: ind.id || `p-${key.replace(/[^a-z0-9]/g, '')}`,
          name: ind.name,
          avatar: ind.avatar || '🎯',
          matchesPlayed: 0,
          matchesWon: 0,
          careerAvg: 0,
          highCheckout: 0,
          total180s: 0,
          seasonBullsHit: 0,
          totalLegsPlayed: 0,
          totalLegsWon: 0,
          totalDartsThrown: 0,
          totalPointsScored: 0,
        };
        playerMap.set(key, rosterPlayer);
      }

      // Check stats from player stats object
      const st = ind.stats || {};
      const matchAvg = Number(st.threeDartAvg || 0);
      const matchHighOut = Number(st.highOut || 0);
      const matchHighScore = Number(st.highScore || 0);
      const match180s = Number(st.count180 || 0);
      const matchDartsThrown = Number(st.dartsThrown || (totalLegsInMatch * 15) || 15);
      const matchPointsScored = matchAvg > 0 ? Math.round((matchAvg * matchDartsThrown) / 3) : 0;
      const matchBulls = Number(ind.bulls || 0);

      // Check completedLegs for checkouts or individual leg highlights
      let legHighOut = 0;
      if (matchState.completedLegs && Array.isArray(matchState.completedLegs)) {
        matchState.completedLegs.forEach((leg: LegRecord) => {
          if (leg.winningOut && leg.winningOut > 0) {
            if (leg.winnerName?.toLowerCase().includes(key) || leg.winnerId === ind.id) {
              legHighOut = Math.max(legHighOut, leg.winningOut);
            }
          }
        });
      }

      const effectiveHighOut = Math.max(matchHighOut, legHighOut);

      // Immutably increment running totals
      const prevPlayed = rosterPlayer.matchesPlayed || 0;
      const prevWon = rosterPlayer.matchesWon || 0;
      const nextPlayed = prevPlayed + 1;
      const nextWon = isThisPlayerWinner ? prevWon + 1 : prevWon;

      const prevDarts = rosterPlayer.totalDartsThrown || (prevPlayed * 42);
      const prevPoints =
        rosterPlayer.totalPointsScored ||
        (rosterPlayer.careerAvg > 0 ? Math.round((rosterPlayer.careerAvg * prevDarts) / 3) : 0);

      const nextDarts = prevDarts + matchDartsThrown;
      const nextPoints = prevPoints + matchPointsScored;

      const runningAvg =
        nextDarts > 0
          ? Number(((nextPoints / nextDarts) * 3).toFixed(1))
          : (matchAvg > 0 ? matchAvg : rosterPlayer.careerAvg || 0);

      rosterPlayer.matchesPlayed = nextPlayed;
      rosterPlayer.matchesWon = nextWon;
      rosterPlayer.careerAvg = runningAvg;
      rosterPlayer.highCheckout = Math.max(rosterPlayer.highCheckout || 0, effectiveHighOut);
      rosterPlayer.total180s = (rosterPlayer.total180s || 0) + match180s;
      rosterPlayer.seasonBullsHit = (rosterPlayer.seasonBullsHit || 0) + matchBulls;
      rosterPlayer.totalLegsPlayed = (rosterPlayer.totalLegsPlayed || 0) + totalLegsInMatch;
      rosterPlayer.totalLegsWon = (rosterPlayer.totalLegsWon || 0) + (ind.legsWon || 0);
      rosterPlayer.totalDartsThrown = nextDarts;
      rosterPlayer.totalPointsScored = nextPoints;
      rosterPlayer.lastPlayedAt = Date.now();
      if (ind.avatar && ind.avatar !== '🎯') {
        rosterPlayer.avatar = ind.avatar;
      }

      matchPlayerStatsList.push({
        id: ind.id,
        name: ind.name,
        avatar: ind.avatar,
        isWinner: isThisPlayerWinner,
        legsWon: ind.legsWon || 0,
        legsPlayed: totalLegsInMatch,
        threeDartAvg: matchAvg,
        highScore: matchHighScore,
        highOut: effectiveHighOut,
        count180: match180s,
        dartsThrown: matchDartsThrown,
        totalScore: matchPointsScored,
        bullsHit: matchBulls,
      });
    });
  });

  const updatedRoster = Array.from(playerMap.values()).sort((a, b) => {
    if ((b.matchesWon || 0) !== (a.matchesWon || 0)) return (b.matchesWon || 0) - (a.matchesWon || 0);
    if ((b.matchesPlayed || 0) !== (a.matchesPlayed || 0)) return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
    return a.name.localeCompare(b.name);
  });

  // 1. Mark match as logged immutably
  completedLog.push(matchId);
  try {
    localStorage.setItem(COMPLETED_MATCHES_LOG_KEY, JSON.stringify(completedLog));
  } catch (e) {}

  // 2. Append to chronological match history log
  const matchHistory = getMatchHistoryLog();
  const historyRecord: CompletedMatchRecord = {
    matchId,
    matchCode: matchState.matchCode,
    completedAt: Date.now(),
    leagueType: matchState.settings?.leagueType,
    gameMode: matchState.currentGameMode || matchState.settings?.gameMode,
    format: matchState.settings?.format,
    winnerName: winningPlayerNames.join(' & ') || matchState.winnerName || 'Winner',
    winnerId: matchState.winnerId,
    players: matchPlayerStatsList,
    legsCount: totalLegsInMatch,
  };
  matchHistory.unshift(historyRecord); // prepend newest first
  // Cap at 250 records to prevent memory pressure
  const cappedHistory = matchHistory.slice(0, 250);
  try {
    localStorage.setItem(MATCH_HISTORY_LOG_KEY, JSON.stringify(cappedHistory));
  } catch (e) {}

  // 3. Persist updated roster to localStorage
  try {
    localStorage.setItem(PLAYERS_ROSTER_KEY, JSON.stringify(updatedRoster));
  } catch (e) {}

  // 4. Trigger database & server synchronization
  syncPlayerRosterToCloud(updatedRoster);

  // 5. Broadcast to local windows and tabs
  window.dispatchEvent(
    new CustomEvent('kaboom_cloud_sync_update', {
      detail: { key: PLAYERS_ROSTER_KEY, matchId, matchPlayerStatsList },
    })
  );

  return { updatedPlayers: updatedRoster, isFirstTimeRecorded: true };
};

/**
 * Manually forces a database sync of current running totals.
 */
export const syncRunningTotalsToDatabase = async (): Promise<boolean> => {
  try {
    const reconciled = reconcilePlayerRunningTotals();
    localStorage.setItem(PLAYERS_ROSTER_KEY, JSON.stringify(reconciled));
    await syncPlayerRosterToCloud(reconciled);
    window.dispatchEvent(
      new CustomEvent('kaboom_cloud_sync_update', {
        detail: { key: PLAYERS_ROSTER_KEY },
      })
    );
    return true;
  } catch (e) {
    console.error('Failed to sync running totals to database', e);
    return false;
  }
};
