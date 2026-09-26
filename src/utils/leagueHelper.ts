import {
  IndividualLeagueStanding,
  OverallLeaderboardEntry,
  BracketMatchup,
  BullsRoundPlayerRecord,
  NightlyBullsEntry,
  NightlyBullsSession,
  TuesdayPlayerGameStats,
  WednesdayPlayerGameStats,
  ThursdayPlayerGameStats,
  LegRecord,
  MatchState,
} from '../types';
import {
  syncLeagueStandingsToCloud,
  syncTuesdayStatsToCloud,
  syncWednesdayStatsToCloud,
  syncThursdayStatsToCloud,
  syncSeasonBullsToCloud,
  syncNightlyBullsToCloud,
  syncPlayerRosterToCloud,
  syncAttendanceRosterToCloud,
  syncFinancePlayersToCloud,
  recordPlayerPermanentlyDeleted,
  isPlayerPermanentlyDeleted,
  deletePlayerFromCloud,
} from '../services/cloudSync';

export const getSeasonBullsMap = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem('kaboom_season_bulls') || localStorage.getItem('kaboom_season_bulls_map');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load season bulls data', e);
  }
  return {};
};

export const saveSeasonBullsMap = (bullsMap: Record<string, number>) => {
  try {
    localStorage.setItem('kaboom_season_bulls', JSON.stringify(bullsMap));
    localStorage.setItem('kaboom_season_bulls_map', JSON.stringify(bullsMap));
    syncSeasonBullsToCloud(bullsMap);
  } catch (e) {
    console.error('Failed to save season bulls data', e);
  }
};

export const getTuesdayGameStatsMap = (): Record<string, TuesdayPlayerGameStats> => {
  try {
    const saved = localStorage.getItem('kaboom_tuesday_game_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const rawMap = (parsed.statsMap && typeof parsed.statsMap === 'object' && !Array.isArray(parsed.statsMap))
          ? parsed.statsMap
          : parsed;
        const cleaned: Record<string, TuesdayPlayerGameStats> = {};
        for (const [k, val] of Object.entries(rawMap)) {
          if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            cleaned[k] = val as TuesdayPlayerGameStats;
          }
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load Tuesday game stats', e);
  }
  return {};
};

export const saveTuesdayGameStatsMap = (statsMap: Record<string, TuesdayPlayerGameStats>) => {
  try {
    const cleaned: Record<string, TuesdayPlayerGameStats> = {};
    for (const [k, val] of Object.entries(statsMap || {})) {
      if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[k] = val;
      }
    }
    localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify(cleaned));
    syncTuesdayStatsToCloud(cleaned);
  } catch (e) {
    console.error('Failed to save Tuesday game stats', e);
  }
};

export const getWednesdayGameStatsMap = (): Record<string, WednesdayPlayerGameStats> => {
  try {
    const saved = localStorage.getItem('kaboom_wednesday_game_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const rawMap = (parsed.statsMap && typeof parsed.statsMap === 'object' && !Array.isArray(parsed.statsMap))
          ? parsed.statsMap
          : parsed;
        const cleaned: Record<string, WednesdayPlayerGameStats> = {};
        for (const [k, val] of Object.entries(rawMap)) {
          if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            cleaned[k] = val as WednesdayPlayerGameStats;
          }
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load Wednesday game stats', e);
  }
  return {};
};

export const saveWednesdayGameStatsMap = (statsMap: Record<string, WednesdayPlayerGameStats>) => {
  try {
    const cleaned: Record<string, WednesdayPlayerGameStats> = {};
    for (const [k, val] of Object.entries(statsMap || {})) {
      if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[k] = val;
      }
    }
    localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(cleaned));
    syncWednesdayStatsToCloud(cleaned);
  } catch (e) {
    console.error('Failed to save Wednesday game stats', e);
  }
};

export const getThursdayGameStatsMap = (): Record<string, ThursdayPlayerGameStats> => {
  try {
    const saved = localStorage.getItem('kaboom_thursday_game_stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const rawMap = (parsed.statsMap && typeof parsed.statsMap === 'object' && !Array.isArray(parsed.statsMap))
          ? parsed.statsMap
          : parsed;
        const cleaned: Record<string, ThursdayPlayerGameStats> = {};
        for (const [k, val] of Object.entries(rawMap)) {
          if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            cleaned[k] = val as ThursdayPlayerGameStats;
          }
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.error('Failed to load Thursday game stats', e);
  }
  return {};
};

export const saveThursdayGameStatsMap = (statsMap: Record<string, ThursdayPlayerGameStats>) => {
  try {
    const cleaned: Record<string, ThursdayPlayerGameStats> = {};
    for (const [k, val] of Object.entries(statsMap || {})) {
      if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[k] = val;
      }
    }
    localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify(cleaned));
    syncThursdayStatsToCloud(cleaned);
  } catch (e) {
    console.error('Failed to save Thursday game stats', e);
  }
};

/**
 * Track players who are not playing or have quit a specific league.
 * Keeps them from being automatically re-injected into that league's attendance and rosters.
 */
export const getRemovedPlayersForLeague = (leagueType: 'tuesday' | 'wednesday' | 'thursday'): { names: Set<string>; ids: Set<string> } => {
  const names = new Set<string>();
  const ids = new Set<string>();
  try {
    const raw = localStorage.getItem(`kaboom_removed_players_${leagueType}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (typeof item === 'string') {
            names.add(item.toLowerCase().trim());
            ids.add(item.trim());
          } else if (item && typeof item === 'object') {
            if (item.name) names.add(item.name.toLowerCase().trim());
            if (item.id) ids.add(item.id.trim());
          }
        });
      }
    }
  } catch (e) {}
  return { names, ids };
};

export const isPlayerRemovedFromLeague = (leagueType: 'tuesday' | 'wednesday' | 'thursday', id?: string, name?: string): boolean => {
  if (isPlayerPermanentlyDeleted(id, name)) return true;
  if (!id && !name) return false;
  const { names, ids } = getRemovedPlayersForLeague(leagueType);
  if (id && ids.has(id.trim())) return true;
  if (name && names.has(name.toLowerCase().trim())) return true;
  return false;
};

export const restorePlayerToLeague = (leagueType: 'tuesday' | 'wednesday' | 'thursday', id?: string, name?: string): void => {
  try {
    const key = `kaboom_removed_players_${leagueType}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const targetId = id ? id.trim() : '';
        const targetName = name ? name.toLowerCase().trim() : '';
        const updated = parsed.filter(item => {
          if (typeof item === 'string') {
            return !(targetId && item === targetId) && !(targetName && item.toLowerCase().trim() === targetName);
          } else if (item && typeof item === 'object') {
            return !(targetId && item.id === targetId) && !(targetName && item.name && item.name.toLowerCase().trim() === targetName);
          }
          return true;
        });
        localStorage.setItem(key, JSON.stringify(updated));
      }
    }
  } catch (e) {}
};

/**
 * Removes a player from a SPECIFIC league (e.g. Tuesday Singles, Wednesday Teams, or Thursday Doubles)
 * when they are not playing or quitting that league.
 *
 * Keeps their Master Profile and stats/finances in other leagues completely intact.
 */
export const removePlayerFromLeague = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  identifier: { id?: string; name?: string } | string
): { success: boolean; playerName: string; playerId?: string } => {
  let targetId = typeof identifier === 'string' ? identifier : identifier.id;
  let targetName = typeof identifier === 'object' ? identifier.name : undefined;

  // 1. Resolve canonical name and id from Master Player Profiles or Attendance
  try {
    const saved = localStorage.getItem('kaboom_dart_players');
    if (saved) {
      const roster: any[] = JSON.parse(saved);
      const matched = roster.find(
        (p) =>
          (targetId && p.id === targetId) ||
          (targetName && p.name?.trim().toLowerCase() === targetName.trim().toLowerCase()) ||
          (typeof identifier === 'string' && p.name?.trim().toLowerCase() === identifier.trim().toLowerCase())
      );
      if (matched) {
        targetId = matched.id || targetId;
        targetName = matched.name || targetName;
      }
    }
  } catch (e) {}

  if (!targetName && typeof identifier === 'string' && !identifier.startsWith('p-')) {
    targetName = identifier;
  }
  if (!targetName && !targetId) {
    return { success: false, playerName: '' };
  }

  const finalName = targetName || targetId || '';
  const finalNameLower = finalName.trim().toLowerCase();

  // 2. Add to removed players list for this league
  try {
    const key = `kaboom_removed_players_${leagueType}`;
    const raw = localStorage.getItem(key);
    let list: any[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) {}
    }
    if (!Array.isArray(list)) list = [];
    const exists = list.some(item => {
      if (typeof item === 'string') {
        return (finalName && item.toLowerCase().trim() === finalNameLower) || (targetId && item === targetId);
      }
      return (targetId && item.id === targetId) || (finalName && item.name && item.name.toLowerCase().trim() === finalNameLower);
    });
    if (!exists) {
      list.push({ id: targetId || undefined, name: finalName, timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {}

  // 3. Remove from Attendance Rosters for this league
  const attKeys = [
    `kaboom_attendance_${leagueType}_singles`,
    `kaboom_attendance_${leagueType}_doubles`,
    `kaboom_attendance_${leagueType}`,
  ];
  attKeys.forEach((k) => {
    try {
      const saved = localStorage.getItem(k);
      if (saved) {
        const list: any[] = JSON.parse(saved);
        if (Array.isArray(list)) {
          const updated = list.filter(
            (p) =>
              !(targetId && p.id === targetId) &&
              !(p.name && p.name.trim().toLowerCase() === finalNameLower)
          );
          localStorage.setItem(k, JSON.stringify(updated));
          const syncDocKey = k.replace('kaboom_', '');
          syncAttendanceRosterToCloud(syncDocKey, updated);
        }
      }
    } catch (e) {}
  });

  // 4. Remove from this league's Standings
  try {
    const standingsKey = `kaboom_${leagueType}_standings`;
    const savedStandings = localStorage.getItem(standingsKey);
    if (savedStandings) {
      const standings: IndividualLeagueStanding[] = JSON.parse(savedStandings);
      const updated = standings.filter(
        (s) =>
          !(targetId && s.playerId === targetId) &&
          !(s.playerName && s.playerName.trim().toLowerCase() === finalNameLower)
      );
      localStorage.setItem(standingsKey, JSON.stringify(updated));
      syncLeagueStandingsToCloud(leagueType, updated);
    }
  } catch (e) {}

  // 5. Remove from this league's game stats
  try {
    if (leagueType === 'tuesday') {
      const tStats = getTuesdayGameStatsMap();
      let changed = false;
      Object.keys(tStats).forEach((k) => {
        if (k.toLowerCase().trim() === finalNameLower || (targetId && (k === targetId || tStats[k].playerId === targetId))) {
          delete tStats[k];
          changed = true;
        }
      });
      if (changed) saveTuesdayGameStatsMap(tStats);
    } else if (leagueType === 'wednesday') {
      const wStats = getWednesdayGameStatsMap();
      let changed = false;
      Object.keys(wStats).forEach((k) => {
        if (k.toLowerCase().trim() === finalNameLower || (targetId && (k === targetId || wStats[k].playerId === targetId))) {
          delete wStats[k];
          changed = true;
        }
      });
      if (changed) saveWednesdayGameStatsMap(wStats);
    } else if (leagueType === 'thursday') {
      const thStats = getThursdayGameStatsMap();
      let changed = false;
      Object.keys(thStats).forEach((k) => {
        if (k.toLowerCase().trim() === finalNameLower || (targetId && (k === targetId || thStats[k].playerId === targetId))) {
          delete thStats[k];
          changed = true;
        }
      });
      if (changed) saveThursdayGameStatsMap(thStats);
    }
  } catch (e) {}

  // 6. Notify REST server
  fetch(`/api/leagues/${leagueType}/remove-player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: targetId, name: finalName }),
  }).catch(() => {});

  // 7. Dispatch events so all tabs and views update immediately
  try {
    window.dispatchEvent(
      new CustomEvent('kaboom_league_player_removed', {
        detail: { leagueType, id: targetId, name: finalName },
      })
    );
    window.dispatchEvent(
      new CustomEvent('kaboom_cloud_sync_update', {
        detail: { key: `kaboom_attendance_${leagueType}_singles`, action: 'player_removed', id: targetId, name: finalName },
      })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}

  return {
    success: true,
    playerName: finalName,
    playerId: targetId,
  };
};

/**
 * Permanently deletes a player and wipes all of their associated records and statistics across the entire system.
 * Used when a player quits or is terminated from the league.
 *
 * 1. Records permanently deleted status to prevent sync resurrecting them
 * 2. Removes from Master Player Profiles (kaboom_dart_players)
 * 3. Removes from all League Standings (Tuesday, Wednesday, Thursday)
 * 4. Removes from Season Bulls tracking (kaboom_season_bulls)
 * 5. Removes from Wednesday Game-by-Game stats (kaboom_wednesday_game_stats)
 * 6. Removes from all Attendance rosters across all 3 leagues
 * 7. Removes from all Finance rosters across all 3 leagues
 * 8. Syncs all deletions to cloud & broadcasts update events to all tablets/devices
 */
export const deletePlayerPermanently = (
  identifier: { id?: string; name?: string } | string
): { success: boolean; playerName: string; playerId?: string } => {
  let targetId = typeof identifier === 'string' ? identifier : identifier.id;
  let targetName = typeof identifier === 'object' ? identifier.name : undefined;

  // 1. Resolve canonical name and id from Master Player Profiles if possible
  try {
    const saved = localStorage.getItem('kaboom_dart_players');
    if (saved) {
      const roster: any[] = JSON.parse(saved);
      const matched = roster.find(
        (p) =>
          (targetId && p.id === targetId) ||
          (targetName && p.name?.trim().toLowerCase() === targetName.trim().toLowerCase()) ||
          (typeof identifier === 'string' && p.name?.trim().toLowerCase() === identifier.trim().toLowerCase())
      );
      if (matched) {
        targetId = matched.id || targetId;
        targetName = matched.name || targetName;
      }
    }
  } catch (e) {}

  if (!targetName && typeof identifier === 'string' && !identifier.startsWith('p-')) {
    targetName = identifier;
  }
  if (!targetName && !targetId) {
    return { success: false, playerName: '' };
  }

  const finalName = targetName || targetId || '';
  const finalNameLower = finalName.trim().toLowerCase();

  // Record permanent deletion so cloud & server sync NEVER resurrects this player
  recordPlayerPermanentlyDeleted(targetId, finalName);
  deletePlayerFromCloud(targetId, finalName);

  // 2. Remove from Master Player Profiles (kaboom_dart_players)
  try {
    const saved = localStorage.getItem('kaboom_dart_players');
    if (saved) {
      const roster: any[] = JSON.parse(saved);
      const updatedRoster = roster.filter(
        (p) =>
          !(targetId && p.id === targetId) &&
          !(p.name && p.name.trim().toLowerCase() === finalNameLower)
      );
      localStorage.setItem('kaboom_dart_players', JSON.stringify(updatedRoster));
      syncPlayerRosterToCloud(updatedRoster);
    }
  } catch (e) {
    console.error('Failed to remove player from master roster', e);
  }

  // 3. Remove from all League Standings (Tuesday, Wednesday, Thursday)
  const leagues: ('tuesday' | 'wednesday' | 'thursday')[] = ['tuesday', 'wednesday', 'thursday'];
  leagues.forEach((lType) => {
    try {
      const key = `kaboom_${lType}_standings`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const standings: IndividualLeagueStanding[] = JSON.parse(saved);
        const updated = standings.filter(
          (s) =>
            !(targetId && s.playerId === targetId) &&
            !(s.playerName && s.playerName.trim().toLowerCase() === finalNameLower)
        );
        localStorage.setItem(key, JSON.stringify(updated));
        syncLeagueStandingsToCloud(lType, updated);
      }
    } catch (e) {
      console.error(`Failed to remove player from ${lType} standings`, e);
    }
  });

  // 4. Remove from Season Bulls Map
  try {
    const bullsMap = getSeasonBullsMap();
    let changed = false;
    Object.keys(bullsMap).forEach((k) => {
      const kLower = k.trim().toLowerCase();
      if (kLower === finalNameLower || (targetId && k === targetId)) {
        delete bullsMap[k];
        changed = true;
      }
    });
    if (changed) {
      saveSeasonBullsMap(bullsMap);
    }
  } catch (e) {
    console.error('Failed to remove player from season bulls', e);
  }

  // 5. Remove from Tuesday & Wednesday Game Stats Maps
  try {
    const tStatsMap = getTuesdayGameStatsMap();
    let tChanged = false;
    Object.keys(tStatsMap).forEach((k) => {
      const kLower = k.trim().toLowerCase();
      const entry = tStatsMap[k];
      if (
        kLower === finalNameLower ||
        (targetId && (k === targetId || entry.playerId === targetId)) ||
        (entry.playerName && entry.playerName.trim().toLowerCase() === finalNameLower)
      ) {
        delete tStatsMap[k];
        tChanged = true;
      }
    });
    if (tChanged) {
      saveTuesdayGameStatsMap(tStatsMap);
    }
  } catch (e) {
    console.error('Failed to remove player from Tuesday stats', e);
  }

  try {
    const statsMap = getWednesdayGameStatsMap();
    let changed = false;
    Object.keys(statsMap).forEach((k) => {
      const kLower = k.trim().toLowerCase();
      const entry = statsMap[k];
      if (
        kLower === finalNameLower ||
        (targetId && (k === targetId || entry.playerId === targetId)) ||
        (entry.playerName && entry.playerName.trim().toLowerCase() === finalNameLower)
      ) {
        delete statsMap[k];
        changed = true;
      }
    });
    if (changed) {
      saveWednesdayGameStatsMap(statsMap);
    }
  } catch (e) {
    console.error('Failed to remove player from Wednesday stats', e);
  }

  try {
    const thursStatsMap = getThursdayGameStatsMap();
    let thursChanged = false;
    Object.keys(thursStatsMap).forEach((k) => {
      const kLower = k.trim().toLowerCase();
      const entry = thursStatsMap[k];
      if (
        kLower === finalNameLower ||
        (targetId && (k === targetId || entry.playerId === targetId)) ||
        (entry.playerName && entry.playerName.trim().toLowerCase() === finalNameLower)
      ) {
        delete thursStatsMap[k];
        thursChanged = true;
      }
    });
    if (thursChanged) {
      saveThursdayGameStatsMap(thursStatsMap);
    }
  } catch (e) {
    console.error('Failed to remove player from Thursday stats', e);
  }

  // 6. Remove from Attendance Rosters across all 3 leagues
  leagues.forEach((lType) => {
    const attKeys = [
      `kaboom_attendance_${lType}_singles`,
      `kaboom_attendance_${lType}_doubles`,
      `kaboom_attendance_${lType}`,
    ];
    attKeys.forEach((key) => {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const list: any[] = JSON.parse(saved);
          if (Array.isArray(list)) {
            const updated = list.filter(
              (p) =>
                !(targetId && p.id === targetId) &&
                !(p.name && p.name.trim().toLowerCase() === finalNameLower)
            );
            localStorage.setItem(key, JSON.stringify(updated));
            const syncDocKey = key.replace('kaboom_', '');
            syncAttendanceRosterToCloud(syncDocKey, updated);
          }
        }
      } catch (e) {}
    });
  });

  // 7. Remove from Finance Rosters across all 3 leagues
  leagues.forEach((lType) => {
    try {
      const key = `kaboom_finance_${lType}_players`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const list: any[] = JSON.parse(saved);
        if (Array.isArray(list)) {
          const updated = list.filter(
            (p) =>
              !(targetId && p.playerId === targetId) &&
              !(p.name && p.name.trim().toLowerCase() === finalNameLower)
          );
          localStorage.setItem(key, JSON.stringify(updated));
          syncFinancePlayersToCloud(lType as any, updated);
        }
      }
    } catch (e) {}
  });

  // 8. Dispatch global events so all open tabs and views immediately update
  try {
    window.dispatchEvent(
      new CustomEvent('kaboom_player_deleted', {
        detail: { id: targetId, name: finalName },
      })
    );
    window.dispatchEvent(
      new CustomEvent('kaboom_cloud_sync_update', {
        detail: { key: 'kaboom_dart_players', action: 'player_deleted', id: targetId, name: finalName },
      })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}

  return {
    success: true,
    playerName: finalName,
    playerId: targetId,
  };
};

export const getOrCreateTuesdayPlayerStats = (
  statsMap: Record<string, TuesdayPlayerGameStats>,
  playerName: string,
  playerId?: string,
  avatar?: string
): TuesdayPlayerGameStats => {
  const key = playerName.toLowerCase().trim();
  if (!statsMap[key]) {
    statsMap[key] = {
      playerId: playerId || `p-${key}`,
      playerName,
      avatar: avatar || '🎯',
      game501HighScore: 0,
      game501Scores80Plus: 0,
      game501HighFinish: 0,
      game501Avg: 0,
      game501DartsThrown: 0,
      game501TotalScore: 0,
      game501Wins: 0,
      game501Played: 0,
      cricketWins: 0,
      cricketPlayed: 0,
      game301HighestBeginningScore: 0,
      game301HighScore: 0,
      game301HighFinish: 0,
      game301Wins: 0,
      game301Avg: 0,
      game301DartsThrown: 0,
      game301TotalScore: 0,
      game301Played: 0,
      seasonBullsHit: 0,
      totalGameWins: 0,
      totalGamesPlayed: 0,
      points: 0,
    };
  }
  return statsMap[key];
};

export const getOrCreateWednesdayPlayerStats = (
  statsMap: Record<string, WednesdayPlayerGameStats>,
  playerName: string,
  playerId?: string,
  avatar?: string
): WednesdayPlayerGameStats => {
  const key = playerName.toLowerCase().trim();
  if (!statsMap[key]) {
    statsMap[key] = {
      playerId: playerId || `p-${key}`,
      playerName,
      avatar: avatar || '🎯',
      game1001HighScore: 0,
      game1001HighFinish: 0,
      game1001Scores80Plus: 0,
      game1001Wins: 0,
      game701HighestBeginningScore: 0,
      game701HighScore: 0,
      game701HighFinish: 0,
      game701Scores80Plus: 0,
      game701Wins: 0,
      baseballHighScore: 0,
      baseballWins: 0,
      fivesHighScore: 0,
      fivesHighFinish: 0,
      fivesWins: 0,
      cricketWins: 0,
      seasonBullsHit: 0,
      totalGameWins: 0,
      totalGamesPlayed: 0,
    };
  }
  return statsMap[key];
};

export const getOrCreateThursdayPlayerStats = (
  statsMap: Record<string, ThursdayPlayerGameStats>,
  playerName: string,
  playerId?: string,
  avatar?: string
): ThursdayPlayerGameStats => {
  const key = playerName.toLowerCase().trim();
  if (!statsMap[key]) {
    statsMap[key] = {
      playerId: playerId || `p-${key}`,
      playerName,
      avatar: avatar || '🎯',
      game501HighScore: 0,
      game501Scores80Plus: 0,
      game501HighFinish: 0,
      game501Avg: 0,
      game501DartsThrown: 0,
      game501TotalScore: 0,
      game501Wins: 0,
      game501Played: 0,
      cricketWins: 0,
      cricketPlayed: 0,
      game301HighestBeginningScore: 0,
      game301HighScore: 0,
      game301HighFinish: 0,
      game301Wins: 0,
      game301Avg: 0,
      game301DartsThrown: 0,
      game301TotalScore: 0,
      game301Played: 0,
      seasonBullsHit: 0,
      totalGameWins: 0,
      totalGamesPlayed: 0,
      points: 0,
    };
  }
  return statsMap[key];
};

export const recordWednesdayLegStats = (legRecord: LegRecord, matchState: MatchState) => {
  const statsMap = getWednesdayGameStatsMap();

  // Deduplicate leg recording to ensure idempotency across socket/event listeners
  const legKey = (legRecord as any).id || `${matchState.id || matchState.matchCode || 'wed_m'}_leg_${legRecord.legNumber}_${legRecord.winnerId || legRecord.winnerName || ''}`;
  try {
    const processed: string[] = JSON.parse(localStorage.getItem('kaboom_processed_wed_legs') || '[]');
    if (processed.includes(legKey)) {
      return;
    }
    processed.push(legKey);
    localStorage.setItem('kaboom_processed_wed_legs', JSON.stringify(processed.slice(-300)));
  } catch (e) {}

  // Determine game type and leg configuration
  const legNum = legRecord.legNumber;
  const gameMode = legRecord.gameMode || matchState.currentGameMode || matchState.settings.gameMode;
  const startScore = matchState.currentStartScore || matchState.settings.startScore;

  // Track games played for all participating players in this leg
  const rawPlayingNames: string[] = [];
  matchState.players.forEach(p => {
    if (p.teamPlayers && p.teamPlayers.length > 0) {
      p.teamPlayers.forEach(tp => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawPlayingNames.push(name);
      });
    } else if (p.name) {
      p.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach(n => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawPlayingNames.push(name);
      });
    }
  });
  const playingNames = Array.from(new Set(rawPlayingNames.map(n => n.trim()).filter(Boolean)));
  playingNames.forEach(name => {
    const isDummy = name.toLowerCase().includes('dummy') || name.includes('🤖');
    const pStats = getOrCreateWednesdayPlayerStats(statsMap, name, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
    pStats.totalGamesPlayed = (pStats.totalGamesPlayed || 0) + 1;
  });

  // Extract winning player names with deduplication
  const winnerPlayer = matchState.players.find(p => p.id === legRecord.winnerId);
  const rawWinningNames: string[] = [];
  if (winnerPlayer) {
    if (winnerPlayer.teamPlayers && winnerPlayer.teamPlayers.length > 0) {
      winnerPlayer.teamPlayers.forEach(tp => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawWinningNames.push(name);
      });
    } else {
      winnerPlayer.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach(n => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawWinningNames.push(name);
      });
    }
  } else if (legRecord.winnerName) {
    legRecord.winnerName.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach(n => {
      const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
      const name = isDummy ? '🤖 Dummy Player' : n.trim();
      if (name) rawWinningNames.push(name);
    });
  }

  // Strictly deduplicate so each individual player (and dummy player if present) receives exactly 1 win
  const winningNames = Array.from(
    new Set(
      rawWinningNames
        .map(n => n.trim())
        .filter(Boolean)
    )
  );

  // 1. If 1001 Straight In / Double Out (Game 1 or Game 6)
  if (gameMode === 'X01' && (startScore === 1001 || legNum === 1 || legNum === 6)) {
    // Process each turn in this 1001 leg
    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach(t => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateWednesdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // High score in 1001
        pStats.game1001HighScore = Math.max(pStats.game1001HighScore, turnScore);

        // Score of 80 or higher running total sum
        if (turnScore >= 80) {
          pStats.game1001Scores80Plus += turnScore;
        }

        // High finish checkout in 1001
        if (t.isCheckout && turnScore > 0) {
          pStats.game1001HighFinish = Math.max(pStats.game1001HighFinish, turnScore);
        }
      });
    }

    // Award High finish checkout to the specific player who actually checked out (Dummy or real player)
    const checkoutTurn = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn?.score && checkoutTurn.score > 0 ? checkoutTurn.score : 0);
    if (finishScore > 0) {
      const isDummyCheckout = Boolean(checkoutTurn?.isDummyTurn || checkoutTurn?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn?.creditedPlayerName || checkoutTurn?.shooterName || checkoutTurn?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game1001HighFinish = Math.max(pStats.game1001HighFinish, finishScore);
      }
    }

    // Award 1001 win to all players on the winning team (dummies excluded)
    winningNames.forEach(name => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, name);
      pStats.game1001Wins = (pStats.game1001Wins || 0) + 1;
    });
  }

  // 2. If 701 Double In / Double Out (Game 3)
  else if (gameMode === 'X01' && (startScore === 701 || legNum === 3)) {
    // Process turns for 701
    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach(t => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateWednesdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // Highest beginning score (Double In opening turn from 701)
        if (t.remainingBefore === 701 && t.remainingAfter < 701 && !t.isBust && turnScore > 0) {
          pStats.game701HighestBeginningScore = Math.max(pStats.game701HighestBeginningScore, turnScore);
        }

        // High score in 701
        pStats.game701HighScore = Math.max(pStats.game701HighScore, turnScore);

        // Score of 80 or higher running total sum
        if (turnScore >= 80) {
          pStats.game701Scores80Plus += turnScore;
        }

        // High finish checkout in 701
        if (t.isCheckout && turnScore > 0) {
          pStats.game701HighFinish = Math.max(pStats.game701HighFinish, turnScore);
        }
      });
    }

    // Award High finish checkout to the specific player who actually checked out (Dummy or real player)
    const checkoutTurn = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn?.score && checkoutTurn.score > 0 ? checkoutTurn.score : 0);
    if (finishScore > 0) {
      const isDummyCheckout = Boolean(checkoutTurn?.isDummyTurn || checkoutTurn?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn?.creditedPlayerName || checkoutTurn?.shooterName || checkoutTurn?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game701HighFinish = Math.max(pStats.game701HighFinish, finishScore);
      }
    }

    // Award 701 win
    winningNames.forEach(name => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, name);
      pStats.game701Wins = (pStats.game701Wins || 0) + 1;
    });
  }

  // 3. If Baseball (Game 2)
  else if (gameMode === 'BASEBALL' || legNum === 2) {
    // 1. Calculate total runs per individual shooter from all turns in this Baseball game
    const individualRunsMap: Record<
      string,
      { name: string; id?: string; avatar?: string; runs: number }
    > = {};

    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach((t) => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;
        const key = shooter.toLowerCase().trim();
        if (!individualRunsMap[key]) {
          individualRunsMap[key] = {
            name: shooter,
            id: isDummy ? 'p-dummy' : t.playerId,
            avatar: isDummy ? '🤖' : undefined,
            runs: 0,
          };
        }
        individualRunsMap[key].runs += t.score || 0;
      });
    }

    // 2. Also inspect player & teamPlayers rosters from matchState to capture total baseball scores
    matchState.players.forEach((p) => {
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        p.teamPlayers.forEach((tp) => {
          const isDummy = Boolean(tp.isDummy || tp.name.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
          const key = targetName.toLowerCase().trim();
          const subScore = tp.baseballScore !== undefined ? tp.baseballScore : 0;
          if (!individualRunsMap[key]) {
            individualRunsMap[key] = {
              name: targetName,
              id: tp.id,
              avatar: isDummy ? '🤖' : tp.avatar,
              runs: subScore,
            };
          } else {
            individualRunsMap[key].runs = Math.max(individualRunsMap[key].runs, subScore);
            if (tp.id) individualRunsMap[key].id = tp.id;
            if (tp.avatar) individualRunsMap[key].avatar = isDummy ? '🤖' : tp.avatar;
          }
        });
      } else {
        const isDummy = Boolean(p.isDummy || p.name.toLowerCase().includes('dummy'));
        const targetName = isDummy ? '🤖 Dummy Player' : p.name;
        const key = targetName.toLowerCase().trim();
        const pScore = p.baseballScore || 0;
        if (!individualRunsMap[key]) {
          individualRunsMap[key] = {
            name: targetName,
            id: p.id,
            avatar: isDummy ? '🤖' : p.avatar,
            runs: pScore,
          };
        } else {
          individualRunsMap[key].runs = Math.max(individualRunsMap[key].runs, pScore);
        }
      }
    });

    // 3. Update Each Individual's Highest Overall Baseball Score in Wednesday Stats
    Object.values(individualRunsMap).forEach((ind) => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, ind.name, ind.id, ind.avatar);
      pStats.baseballHighScore = Math.max(pStats.baseballHighScore || 0, ind.runs);
      pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed || 0, 1);
    });

    // 4. Award Baseball win to all winning team/individual players
    winningNames.forEach((name) => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, name);
      pStats.baseballWins = (pStats.baseballWins || 0) + 1;
    });
  }

  // 4. If Fives (Game 4)
  else if (gameMode === 'FIVES' || legNum === 4) {
    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach(t => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateWednesdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // Fives High Score in a turn
        pStats.fivesHighScore = Math.max(pStats.fivesHighScore, turnScore);

        // Fives High Finish
        if (t.isCheckout && turnScore > 0) {
          pStats.fivesHighFinish = Math.max(pStats.fivesHighFinish, turnScore);
        }
      });
    }

    // Award High finish checkout to the specific player who actually checked out (Dummy or real player)
    const checkoutTurn = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn?.score && checkoutTurn.score > 0 ? checkoutTurn.score : 0);
    if (finishScore > 0) {
      const isDummyCheckout = Boolean(checkoutTurn?.isDummyTurn || checkoutTurn?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn?.creditedPlayerName || checkoutTurn?.shooterName || checkoutTurn?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.fivesHighFinish = Math.max(pStats.fivesHighFinish, finishScore);
      }
    }

    // Award Fives win
    winningNames.forEach(name => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, name);
      pStats.fivesWins = (pStats.fivesWins || 0) + 1;
    });
  }

  // 5. If Cricket (Game 5)
  else if (gameMode === 'CRICKET' || legNum === 5) {
    // Award Cricket win to each winning team member
    winningNames.forEach(name => {
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, name);
      pStats.cricketWins = (pStats.cricketWins || 0) + 1;
    });
  }

  // Recalculate totalGameWins for all players and preserve season bulls
  Object.keys(statsMap).forEach(key => {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(key.toLowerCase())) {
      delete statsMap[key];
      return;
    }
    const entry = statsMap[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      delete statsMap[key];
      return;
    }
    entry.seasonBullsHit = entry.seasonBullsHit || 0;
    entry.totalGameWins =
      (entry.game1001Wins || 0) +
      (entry.game701Wins || 0) +
      (entry.baseballWins || 0) +
      (entry.fivesWins || 0) +
      (entry.cricketWins || 0);
    entry.points = entry.totalGameWins;
    entry.totalGamesPlayed = Math.max(entry.totalGamesPlayed || 0, entry.totalGameWins);
  });

  saveWednesdayGameStatsMap(statsMap);
};

/**
 * Accurately determines the game type ('301', '501', 'CRICKET') for Tuesday and Thursday league legs.
 * Inspects turn logs, starting score, gameMode, and medley configuration so that 501 is NEVER missed or misattributed.
 */
export function determineTuesdayThursdayLegGame(
  legRecord: LegRecord,
  matchState: MatchState
): '301' | '501' | 'CRICKET' {
  // 1. Explicit Cricket check
  if (
    legRecord.gameMode === 'CRICKET' ||
    matchState.currentGameMode === 'CRICKET' ||
    (matchState.settings.gameMode === 'CRICKET' && !matchState.settings.isMedley)
  ) {
    return 'CRICKET';
  }

  // 2. Ground truth: remainingBefore of the very first turn in leg turns history
  const firstTurn = legRecord.turns && legRecord.turns.length > 0 ? legRecord.turns[0] : undefined;
  if (firstTurn) {
    if (firstTurn.remainingBefore === 501) return '501';
    if (firstTurn.remainingBefore === 301) return '301';
  }

  // 3. Explicit startScore on legRecord or matchState
  if (legRecord.startScore === 501 || matchState.currentStartScore === 501) return '501';
  if (legRecord.startScore === 301 || matchState.currentStartScore === 301) return '301';

  // 4. Medley config for this specific leg number
  const legNum = legRecord.legNumber;
  const medleyConfigs = matchState.settings.medleyConfigs && matchState.settings.medleyConfigs.length > 0
    ? matchState.settings.medleyConfigs
    : undefined;
  if (medleyConfigs) {
    const config = medleyConfigs.find((c) => c.legNumber === legNum) || medleyConfigs[legNum - 1];
    if (config) {
      if (config.gameMode === 'CRICKET' || config.title?.toLowerCase().includes('cricket')) {
        return 'CRICKET';
      }
      if (config.startScore === 501 || config.title?.includes('501')) {
        return '501';
      }
      if (config.startScore === 301 || config.title?.includes('301')) {
        return '301';
      }
    }
  }

  // 5. Settings startScore
  if (matchState.settings.startScore === 501) return '501';
  if (matchState.settings.startScore === 301 && legNum === 1) return '301';

  // 6. Standard Tuesday/Thursday default 3-game lineup fallback:
  // Leg 1: 301, Leg 2: 501, Leg 3: Cricket
  if (legNum === 1) return '301';
  if (legNum === 2) return '501';
  if (legNum === 3) return 'CRICKET';

  return '501';
}

/**
 * Record Tuesday Singles League game-by-game statistics:
 * 501: High Score (all-time), 80+ Total Points (running sum of all shots >= 80), High Finish (highest checkout), 501 Avg (running 3-dart average)
 * Cricket: Cricket Total Wins (running count)
 * 301: Highest first score (Double In opening shot), Highest score overall, 301 Wins, 301 Average
 */
export const recordTuesdayLegStats = (legRecord: LegRecord, matchState: MatchState) => {
  const statsMap = getTuesdayGameStatsMap();

  const detectedGame = determineTuesdayThursdayLegGame(legRecord, matchState);

  // Extract winning player names with strict deduplication
  const winnerPlayer = matchState.players.find((p) => p.id === legRecord.winnerId);
  const rawWinningNames: string[] = [];
  if (winnerPlayer) {
    if (winnerPlayer.teamPlayers && winnerPlayer.teamPlayers.length > 0) {
      winnerPlayer.teamPlayers.forEach((tp) => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawWinningNames.push(name);
      });
    } else {
      winnerPlayer.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawWinningNames.push(name);
      });
    }
  } else if (legRecord.winnerName) {
    legRecord.winnerName.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
      const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
      const name = isDummy ? '🤖 Dummy Player' : n.trim();
      if (name) rawWinningNames.push(name);
    });
  }

  // Strictly deduplicate so each individual player (and dummy player if present) receives exactly 1 win
  const winningNames = Array.from(
    new Set(
      rawWinningNames
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  // Extract deduplicated participating player names
  const rawPlayingNames: string[] = [];
  matchState.players.forEach((p) => {
    if (p.teamPlayers && p.teamPlayers.length > 0) {
      p.teamPlayers.forEach((tp) => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawPlayingNames.push(name);
      });
    } else if (p.name) {
      p.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawPlayingNames.push(name);
      });
    }
  });
  const playingNames = Array.from(
    new Set(
      rawPlayingNames
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  // Ensure all participating players exist in stats
  playingNames.forEach((name) => {
    const isDummy = name.toLowerCase().includes('dummy') || name.includes('🤖');
    const targetName = isDummy ? '🤖 Dummy Player' : name;
    getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
  });

  // 1. 301 Double In / Double Out
  if (detectedGame === '301') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.game301Played += 1;
      pStats.totalGamesPlayed += 1;
    });

    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach((t) => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateTuesdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // Highest first score (opening turn Double In from 301)
        if (t.remainingBefore === 301 && t.remainingAfter < 301 && !t.isBust && turnScore > 0) {
          pStats.game301HighestBeginningScore = Math.max(pStats.game301HighestBeginningScore, turnScore);
        }

        // Highest score overall in 301
        if (!t.isBust && turnScore > 0) {
          pStats.game301HighScore = Math.max(pStats.game301HighScore, turnScore);
        }

        // 301 High finish checkout
        if ((t.isCheckout || t.remainingAfter === 0) && turnScore > 0) {
          pStats.game301HighFinish = Math.max(pStats.game301HighFinish, turnScore);
        }

        // 301 running 3-dart average accumulation
        const dartsThisTurn = t.dartsUsed || 3;
        pStats.game301TotalScore += t.isBust ? 0 : turnScore;
        pStats.game301DartsThrown += dartsThisTurn;
        if (pStats.game301DartsThrown > 0) {
          pStats.game301Avg = Number(((pStats.game301TotalScore / pStats.game301DartsThrown) * 3).toFixed(1));
        }
      });
    }

    // Award 301 High finish checkout to winning player if winningOut recorded on legRecord
    const checkoutTurn301 = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore301 = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn301?.score && checkoutTurn301.score > 0 ? checkoutTurn301.score : 0);
    if (finishScore301 > 0) {
      const isDummyCheckout = Boolean(checkoutTurn301?.isDummyTurn || checkoutTurn301?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn301?.creditedPlayerName || checkoutTurn301?.shooterName || checkoutTurn301?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game301HighFinish = Math.max(pStats.game301HighFinish, finishScore301);
      }
    }

    // Fallback: if player leg averages are present
    if (legRecord.averages) {
      matchState.players.forEach((p) => {
        if (p.teamPlayers && p.teamPlayers.length > 0) {
          p.teamPlayers.forEach(tp => {
            const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
            const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
            const avg = tp.stats?.threeDartAvg;
            if (avg && avg > 0) {
              const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
              if (pStats.game301Avg === 0) {
                pStats.game301Avg = Number(avg.toFixed(1));
              }
            }
          });
        } else {
          const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : p.name;
          const avg = legRecord.averages[p.id];
          if (avg && avg > 0) {
            const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
            if (pStats.game301Avg === 0) {
              pStats.game301Avg = Number(avg.toFixed(1));
            }
          }
        }
      });
    }

    // Fallback: if match players have highScore or highOut recorded
    matchState.players.forEach((p) => {
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        p.teamPlayers.forEach(tp => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
          const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
          const hs = tp.stats?.highScore || 0;
          if (hs > 0) {
            pStats.game301HighScore = Math.max(pStats.game301HighScore, hs);
          }
          const ho = tp.stats?.highOut || 0;
          if (ho > 0 && winningNames.includes(targetName)) {
            pStats.game301HighFinish = Math.max(pStats.game301HighFinish, ho);
          }
        });
      } else if (p.stats) {
        const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
        const targetName = isDummy ? '🤖 Dummy Player' : p.name;
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        if (p.stats.highScore > 0) {
          pStats.game301HighScore = Math.max(pStats.game301HighScore, p.stats.highScore);
        }
        if (p.stats.highOut > 0 && winningNames.includes(targetName)) {
          pStats.game301HighFinish = Math.max(pStats.game301HighFinish, p.stats.highOut);
        }
      }
    });

    // Award 301 Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.game301Wins += 1;
      pStats.points += 1;
    });
  }

  // 2. Cricket (Tuesday Singles Cricket)
  else if (detectedGame === 'CRICKET') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.cricketPlayed += 1;
      pStats.totalGamesPlayed += 1;
    });

    // Award Cricket Total Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.cricketWins += 1;
      pStats.points += 1;
    });
  }

  // 3. 501 Straight In / Double Out
  else if (detectedGame === '501') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.game501Played += 1;
      pStats.totalGamesPlayed += 1;
    });

    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach((t) => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateTuesdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // 501 All-time high score
        if (!t.isBust && turnScore > 0) {
          pStats.game501HighScore = Math.max(pStats.game501HighScore, turnScore);
        }

        // 501 Running total point sum of all shots 80 or higher (adds all scores >= 80)
        if (!t.isBust && turnScore >= 80) {
          pStats.game501Scores80Plus += turnScore;
        }

        // 501 High finish checkout
        if ((t.isCheckout || t.remainingAfter === 0) && turnScore > 0) {
          pStats.game501HighFinish = Math.max(pStats.game501HighFinish, turnScore);
        }

        // 501 running 3-dart average accumulation
        const dartsThisTurn = t.dartsUsed || 3;
        pStats.game501TotalScore += t.isBust ? 0 : turnScore;
        pStats.game501DartsThrown += dartsThisTurn;
        if (pStats.game501DartsThrown > 0) {
          pStats.game501Avg = Number(((pStats.game501TotalScore / pStats.game501DartsThrown) * 3).toFixed(1));
        }
      });
    }

    // Award 501 High finish checkout to winning player if winningOut recorded on legRecord
    const checkoutTurn501 = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore501 = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn501?.score && checkoutTurn501.score > 0 ? checkoutTurn501.score : 0);
    if (finishScore501 > 0) {
      const isDummyCheckout = Boolean(checkoutTurn501?.isDummyTurn || checkoutTurn501?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn501?.creditedPlayerName || checkoutTurn501?.shooterName || checkoutTurn501?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game501HighFinish = Math.max(pStats.game501HighFinish, finishScore501);
      }
    }

    // Fallback: if player leg averages are present
    if (legRecord.averages) {
      matchState.players.forEach((p) => {
        if (p.teamPlayers && p.teamPlayers.length > 0) {
          p.teamPlayers.forEach(tp => {
            const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
            const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
            const avg = tp.stats?.threeDartAvg;
            if (avg && avg > 0) {
              const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
              if (pStats.game501Avg === 0) {
                pStats.game501Avg = Number(avg.toFixed(1));
              }
            }
          });
        } else {
          const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : p.name;
          const avg = legRecord.averages[p.id];
          if (avg && avg > 0) {
            const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
            if (pStats.game501Avg === 0) {
              pStats.game501Avg = Number(avg.toFixed(1));
            }
          }
        }
      });
    }

    // Fallback: if match players have highScore or highOut recorded
    matchState.players.forEach((p) => {
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        p.teamPlayers.forEach(tp => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
          const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
          const hs = tp.stats?.highScore || 0;
          if (hs > 0) {
            pStats.game501HighScore = Math.max(pStats.game501HighScore, hs);
          }
          const ho = tp.stats?.highOut || 0;
          if (ho > 0 && winningNames.includes(targetName)) {
            pStats.game501HighFinish = Math.max(pStats.game501HighFinish, ho);
          }
        });
      } else if (p.stats) {
        const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
        const targetName = isDummy ? '🤖 Dummy Player' : p.name;
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        if (p.stats.highScore > 0) {
          pStats.game501HighScore = Math.max(pStats.game501HighScore, p.stats.highScore);
        }
        if (p.stats.highOut > 0 && winningNames.includes(targetName)) {
          pStats.game501HighFinish = Math.max(pStats.game501HighFinish, p.stats.highOut);
        }
      }
    });

    // Award 501 Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateTuesdayPlayerStats(statsMap, name);
      pStats.game501Wins += 1;
      pStats.points += 1;
    });
  }

  // Recalculate totalGameWins and points for all players
  Object.keys(statsMap).forEach((key) => {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(key.toLowerCase())) {
      delete statsMap[key];
      return;
    }
    const entry = statsMap[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      delete statsMap[key];
      return;
    }
    entry.totalGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
    entry.points = entry.totalGameWins;
    entry.totalGamesPlayed = Math.max(
      entry.totalGamesPlayed || 0,
      (entry.game301Played || 0) + (entry.cricketPlayed || 0) + (entry.game501Played || 0),
      entry.totalGameWins
    );
  });

  saveTuesdayGameStatsMap(statsMap);
};

/**
 * Record Thursday Doubles League game-by-game statistics:
 * 501: High Score (all-time), 80+ Total Points (running sum of all shots >= 80), High Finish (highest checkout), 501 Avg (running 3-dart average)
 * Cricket: Cricket Total Wins (running count)
 * 301: Highest first score (Double In opening shot), Highest score overall, 301 Wins, 301 Average
 */
export const recordThursdayLegStats = (legRecord: LegRecord, matchState: MatchState) => {
  const statsMap = getThursdayGameStatsMap();

  const detectedGame = determineTuesdayThursdayLegGame(legRecord, matchState);

  // Extract winning player names with strict deduplication
  const winnerPlayer = matchState.players.find((p) => p.id === legRecord.winnerId);
  const rawWinningNames: string[] = [];
  if (winnerPlayer) {
    if (winnerPlayer.teamPlayers && winnerPlayer.teamPlayers.length > 0) {
      winnerPlayer.teamPlayers.forEach((tp) => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawWinningNames.push(name);
      });
    } else {
      winnerPlayer.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawWinningNames.push(name);
      });
    }
  } else if (legRecord.winnerName) {
    legRecord.winnerName.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
      const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
      const name = isDummy ? '🤖 Dummy Player' : n.trim();
      if (name) rawWinningNames.push(name);
    });
  }

  // Strictly deduplicate so each individual player (and dummy player if present) receives exactly 1 win
  const winningNames = Array.from(
    new Set(
      rawWinningNames
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  // Extract deduplicated participating player names
  const rawPlayingNames: string[] = [];
  matchState.players.forEach((p) => {
    if (p.teamPlayers && p.teamPlayers.length > 0) {
      p.teamPlayers.forEach((tp) => {
        const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
        const name = isDummy ? '🤖 Dummy Player' : tp.name?.trim();
        if (name) rawPlayingNames.push(name);
      });
    } else if (p.name) {
      p.name.split(/\s*(?:&|\+|\/|,|\band\b)\s*/i).forEach((n) => {
        const isDummy = n.toLowerCase().includes('dummy') || n.includes('🤖');
        const name = isDummy ? '🤖 Dummy Player' : n.trim();
        if (name) rawPlayingNames.push(name);
      });
    }
  });
  const playingNames = Array.from(
    new Set(
      rawPlayingNames
        .map((n) => n.trim())
        .filter(Boolean)
    )
  );

  // Ensure all participating players exist in stats
  playingNames.forEach((name) => {
    const isDummy = name.toLowerCase().includes('dummy') || name.includes('🤖');
    const targetName = isDummy ? '🤖 Dummy Player' : name;
    getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
  });

  // 1. 301 Double In / Double Out
  if (detectedGame === '301') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.game301Played += 1;
      pStats.totalGamesPlayed += 1;
    });

    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach((t) => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateThursdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // Highest first score (opening turn Double In from 301)
        if (t.remainingBefore === 301 && t.remainingAfter < 301 && !t.isBust && turnScore > 0) {
          pStats.game301HighestBeginningScore = Math.max(pStats.game301HighestBeginningScore, turnScore);
        }

        // Highest score overall in 301
        if (!t.isBust && turnScore > 0) {
          pStats.game301HighScore = Math.max(pStats.game301HighScore, turnScore);
        }

        // 301 High finish checkout (awarded to player who finished the game by tracking their finishing score)
        if ((t.isCheckout || t.remainingAfter === 0) && turnScore > 0) {
          pStats.game301HighFinish = Math.max(pStats.game301HighFinish, turnScore);
        }

        // 301 running 3-dart average accumulation
        const dartsThisTurn = t.dartsUsed || 3;
        pStats.game301TotalScore += t.isBust ? 0 : turnScore;
        pStats.game301DartsThrown += dartsThisTurn;
        if (pStats.game301DartsThrown > 0) {
          pStats.game301Avg = Number(((pStats.game301TotalScore / pStats.game301DartsThrown) * 3).toFixed(1));
        }
      });
    }

    // Award 301 High finish checkout to winning player if winningOut recorded on legRecord
    const checkoutTurn301 = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore301 = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn301?.score && checkoutTurn301.score > 0 ? checkoutTurn301.score : 0);
    if (finishScore301 > 0) {
      const isDummyCheckout = Boolean(checkoutTurn301?.isDummyTurn || checkoutTurn301?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn301?.creditedPlayerName || checkoutTurn301?.shooterName || checkoutTurn301?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateThursdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game301HighFinish = Math.max(pStats.game301HighFinish, finishScore301);
      }
    }

    // Fallback: if player leg averages are present
    if (legRecord.averages) {
      matchState.players.forEach((p) => {
        if (p.teamPlayers && p.teamPlayers.length > 0) {
          p.teamPlayers.forEach(tp => {
            const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
            const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
            const avg = tp.stats?.threeDartAvg;
            if (avg && avg > 0) {
              const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
              if (pStats.game301Avg === 0) {
                pStats.game301Avg = Number(avg.toFixed(1));
              }
            }
          });
        } else {
          const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : p.name;
          const avg = legRecord.averages[p.id];
          if (avg && avg > 0) {
            const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
            if (pStats.game301Avg === 0) {
              pStats.game301Avg = Number(avg.toFixed(1));
            }
          }
        }
      });
    }

    // Fallback: if match players have highScore or highOut recorded
    matchState.players.forEach((p) => {
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        p.teamPlayers.forEach(tp => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
          const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
          const hs = tp.stats?.highScore || 0;
          if (hs > 0) {
            pStats.game301HighScore = Math.max(pStats.game301HighScore, hs);
          }
          const ho = tp.stats?.highOut || 0;
          if (ho > 0 && winningNames.includes(targetName)) {
            pStats.game301HighFinish = Math.max(pStats.game301HighFinish, ho);
          }
        });
      } else if (p.stats) {
        const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
        const targetName = isDummy ? '🤖 Dummy Player' : p.name;
        const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        if (p.stats.highScore > 0) {
          pStats.game301HighScore = Math.max(pStats.game301HighScore, p.stats.highScore);
        }
        if (p.stats.highOut > 0 && winningNames.includes(targetName)) {
          pStats.game301HighFinish = Math.max(pStats.game301HighFinish, p.stats.highOut);
        }
      }
    });

    // Award 301 Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.game301Wins += 1;
      pStats.points += 1;
    });
  }

  // 2. Cricket (Thursday Doubles Cricket)
  else if (detectedGame === 'CRICKET') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.cricketPlayed += 1;
      pStats.totalGamesPlayed += 1;
    });

    // Award Cricket Total Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.cricketWins += 1;
      pStats.points += 1;
    });
  }

  // 3. 501 Straight In / Double Out
  else if (detectedGame === '501') {
    // Increment games played (1 per participating player)
    playingNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.game501Played += 1;
      pStats.totalGamesPlayed += 1;
    });

    if (legRecord.turns && legRecord.turns.length > 0) {
      legRecord.turns.forEach((t) => {
        const isDummy = Boolean(t.isDummyTurn || t.creditedPlayerName?.toLowerCase().includes('dummy'));
        const shooter = isDummy ? '🤖 Dummy Player' : (t.creditedPlayerName || t.shooterName || t.playerName);
        if (!shooter) return;

        const pStats = getOrCreateThursdayPlayerStats(statsMap, shooter, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const turnScore = t.score || 0;

        // 501 All-time high score
        if (!t.isBust && turnScore > 0) {
          pStats.game501HighScore = Math.max(pStats.game501HighScore, turnScore);
        }

        // 501 Running total point sum of all shots 80 or higher (adds all scores >= 80)
        if (!t.isBust && turnScore >= 80) {
          pStats.game501Scores80Plus += turnScore;
        }

        // 501 High finish checkout
        if ((t.isCheckout || t.remainingAfter === 0) && turnScore > 0) {
          pStats.game501HighFinish = Math.max(pStats.game501HighFinish, turnScore);
        }

        // 501 running 3-dart average accumulation
        const dartsThisTurn = t.dartsUsed || 3;
        pStats.game501TotalScore += t.isBust ? 0 : turnScore;
        pStats.game501DartsThrown += dartsThisTurn;
        if (pStats.game501DartsThrown > 0) {
          pStats.game501Avg = Number(((pStats.game501TotalScore / pStats.game501DartsThrown) * 3).toFixed(1));
        }
      });
    }

    // Award 501 High finish checkout to winning player if winningOut recorded on legRecord
    const checkoutTurn501 = legRecord.turns?.slice().reverse().find(t => (t.isCheckout || t.remainingAfter === 0) && !t.isBust);
    const finishScore501 = (legRecord.winningOut && legRecord.winningOut > 0) ? legRecord.winningOut : (checkoutTurn501?.score && checkoutTurn501.score > 0 ? checkoutTurn501.score : 0);
    if (finishScore501 > 0) {
      const isDummyCheckout = Boolean(checkoutTurn501?.isDummyTurn || checkoutTurn501?.creditedPlayerName?.toLowerCase().includes('dummy'));
      const checkoutShooter = isDummyCheckout
        ? '🤖 Dummy Player'
        : (checkoutTurn501?.creditedPlayerName || checkoutTurn501?.shooterName || checkoutTurn501?.playerName || winningNames[0]);
      if (checkoutShooter) {
        const pStats = getOrCreateThursdayPlayerStats(statsMap, checkoutShooter, isDummyCheckout ? 'p-dummy' : undefined, isDummyCheckout ? '🤖' : undefined);
        pStats.game501HighFinish = Math.max(pStats.game501HighFinish, finishScore501);
      }
    }

    // Fallback: if player leg averages are present
    if (legRecord.averages) {
      matchState.players.forEach((p) => {
        if (p.teamPlayers && p.teamPlayers.length > 0) {
          p.teamPlayers.forEach(tp => {
            const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
            const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
            const avg = tp.stats?.threeDartAvg;
            if (avg && avg > 0) {
              const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
              if (pStats.game501Avg === 0) {
                pStats.game501Avg = Number(avg.toFixed(1));
              }
            }
          });
        } else {
          const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : p.name;
          const avg = legRecord.averages[p.id];
          if (avg && avg > 0) {
            const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
            if (pStats.game501Avg === 0) {
              pStats.game501Avg = Number(avg.toFixed(1));
            }
          }
        }
      });
    }

    // Fallback: if match players have highScore or highOut recorded
    matchState.players.forEach((p) => {
      if (p.teamPlayers && p.teamPlayers.length > 0) {
        p.teamPlayers.forEach(tp => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy'));
          const targetName = isDummy ? '🤖 Dummy Player' : tp.name;
          const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
          const hs = tp.stats?.highScore || 0;
          if (hs > 0) {
            pStats.game501HighScore = Math.max(pStats.game501HighScore, hs);
          }
          const ho = tp.stats?.highOut || 0;
          if (ho > 0 && winningNames.includes(targetName)) {
            pStats.game501HighFinish = Math.max(pStats.game501HighFinish, ho);
          }
        });
      } else if (p.stats) {
        const isDummy = Boolean(p.isDummy || p.name?.toLowerCase().includes('dummy'));
        const targetName = isDummy ? '🤖 Dummy Player' : p.name;
        const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        if (p.stats.highScore > 0) {
          pStats.game501HighScore = Math.max(pStats.game501HighScore, p.stats.highScore);
        }
        if (p.stats.highOut > 0 && winningNames.includes(targetName)) {
          pStats.game501HighFinish = Math.max(pStats.game501HighFinish, p.stats.highOut);
        }
      }
    });

    // Award 501 Wins
    winningNames.forEach((name) => {
      const pStats = getOrCreateThursdayPlayerStats(statsMap, name);
      pStats.game501Wins += 1;
      pStats.points += 1;
    });
  }

  // Recalculate totalGameWins and points for all players
  Object.keys(statsMap).forEach((key) => {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(key.toLowerCase())) {
      delete statsMap[key];
      return;
    }
    const entry = statsMap[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      delete statsMap[key];
      return;
    }
    entry.totalGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
    entry.points = entry.totalGameWins;
    entry.totalGamesPlayed = Math.max(
      entry.totalGamesPlayed || 0,
      (entry.game301Played || 0) + (entry.cricketPlayed || 0) + (entry.game501Played || 0),
      entry.totalGameWins
    );
  });

  saveThursdayGameStatsMap(statsMap);
};

export const WEDNESDAY_OFFICIAL_PLAYERS = new Set([
  'lynn', 'berdine', 'claude', 'crystal',
  'kyle', 'jack', 'donny', 'wayne',
  'fern', 'lor', 'celeste', 'natalie',
  'dan c', 'joy anne', 'lorriane', 'meghan'
]);

/**
 * Mathematically sanitizes historical Tuesday, Wednesday, and Thursday stats
 * to ensure no player ever receives more than 1 win per game won, and fixes
 * historical data where a player was erroneously credited with multiple wins per game.
 */
export const repairTuesdayAndThursdayStats = () => {
  try {
    let tuesModified = false;
    const tuesMap = getTuesdayGameStatsMap();
    Object.keys(tuesMap).forEach(key => {
      const p = tuesMap[key];

      // Fix inflated wins per game (e.g. 3 wins per game totaling 9 instead of 1 per game)
      if (p.game301Played > 0 && p.game301Wins > p.game301Played) {
        p.game301Wins = p.game301Played;
        tuesModified = true;
      }
      if (p.game501Played > 0 && p.game501Wins > p.game501Played) {
        p.game501Wins = p.game501Played;
        tuesModified = true;
      }
      if (p.cricketPlayed > 0 && p.cricketWins > p.cricketPlayed) {
        p.cricketWins = p.cricketPlayed;
        tuesModified = true;
      }

      // Ensure Sylvain's Tuesday stats accurately reflect 9 games played (8 wins, 1 loss)
      if (key === 'sylvain') {
        if (p.cricketPlayed > 3) {
          p.cricketPlayed = 3;
          tuesModified = true;
        }
        if (p.cricketWins > 3) {
          p.cricketWins = 3;
          tuesModified = true;
        }
        if (p.game301Wins > 2) {
          p.game301Wins = 2;
          tuesModified = true;
        }
      } else if (key === 'mark') {
        if (p.game301Played < 3) {
          p.game301Played = 3;
          tuesModified = true;
        }
      } else if (key === 'ray') {
        if (p.cricketPlayed < 3) {
          p.cricketPlayed = 3;
          tuesModified = true;
        }
      } else if (key === 'jack d') {
        if (p.game301Wins !== 0 || p.cricketWins !== 0 || p.game501Wins !== 0 || p.totalGameWins !== 0 || p.points !== 0) {
          p.game301Wins = 0;
          p.cricketWins = 0;
          p.game501Wins = 0;
          p.totalGameWins = 0;
          p.points = 0;
          p.game301Played = 3;
          p.cricketPlayed = 3;
          p.game501Played = 3;
          p.totalGamesPlayed = 9;
          tuesModified = true;
        }
      }

      // If played was 1 match (1 leg in each format) but wins were inflated above 1
      if (p.game301Played <= 1 && p.game301Wins > 1) {
        p.game301Wins = 1;
        tuesModified = true;
      }
      if (p.game501Played <= 1 && p.game501Wins > 1) {
        p.game501Wins = 1;
        tuesModified = true;
      }
      if (p.cricketPlayed <= 1 && p.cricketWins > 1) {
        p.cricketWins = 1;
        tuesModified = true;
      }

      const calculatedWins = p.game301Wins + p.cricketWins + p.game501Wins;
      if (p.totalGameWins !== calculatedWins || p.points !== calculatedWins) {
        p.totalGameWins = calculatedWins;
        p.points = calculatedWins;
        tuesModified = true;
      }
      p.totalGamesPlayed = Math.max(
        p.totalGamesPlayed,
        p.game301Played + p.cricketPlayed + p.game501Played,
        p.totalGameWins
      );
    });

    // Purge phantom entries with 0 activity from Tuesday stats map
    Object.keys(tuesMap).forEach(key => {
      const p = tuesMap[key];
      const lowerKey = key.toLowerCase().trim();
      const pNameLower = (p.playerName || '').toLowerCase().trim();
      if (
        ['mauricharolde', 'test1', 'test2'].includes(lowerKey) ||
        ['mauricharolde', 'test1', 'test2'].includes(pNameLower)
      ) {
        delete tuesMap[key];
        tuesModified = true;
        return;
      }
      const hasActivity =
        (p.totalGamesPlayed || 0) > 0 ||
        (p.totalGameWins || 0) > 0 ||
        (p.points || 0) > 0 ||
        (p.seasonBullsHit || 0) > 0 ||
        (p.game501HighScore || 0) > 0 ||
        (p.game501Scores80Plus || 0) > 0 ||
        (p.game501HighFinish || 0) > 0 ||
        (p.game501Avg || 0) > 0 ||
        (p.game501Wins || 0) > 0 ||
        (p.game501Played || 0) > 0 ||
        (p.cricketWins || 0) > 0 ||
        (p.cricketPlayed || 0) > 0 ||
        (p.game301HighestBeginningScore || 0) > 0 ||
        (p.game301HighScore || 0) > 0 ||
        (p.game301HighFinish || 0) > 0 ||
        (p.game301Wins || 0) > 0 ||
        (p.game301Avg || 0) > 0 ||
        (p.game301Played || 0) > 0;
      if (!hasActivity) {
        delete tuesMap[key];
        tuesModified = true;
      }
    });

    if (tuesModified) {
      saveTuesdayGameStatsMap(tuesMap);
    }

    // THURSDAY LEAGUE RESET:
    // There are no official games until this upcoming Thursday.
    // Ensure all players for Thursday league strictly have 0 stats and 0 Bulls.
    const thursMap = getThursdayGameStatsMap();
    let thursModified = false;
    if (Object.keys(thursMap).length > 0) {
      saveThursdayGameStatsMap({});
      thursModified = true;
    }

    // Wednesday league stats preservation
    // Do not wipe Wednesday stats or standings - ensure Wednesday game stats remain intact
    const wedMap = getWednesdayGameStatsMap();

    // Also sanitize saved league standings in localStorage
    const sanitizeStandings = (
      storageKey: string,
      statsLookup: Record<string, any>
    ) => {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return;
      try {
        let standings: IndividualLeagueStanding[] = JSON.parse(saved);
        let modified = false;

        // Wednesday standings preservation: do not wipe
        if (storageKey === 'kaboom_wednesday_standings') {
          return;
        }

        // Filter out phantom entries with 0 activity in this league, or BYE placeholders
        const filtered = standings.filter((s) => {
          if (!s || !s.playerName || s.playerName.toUpperCase().includes('BYE')) return false;
          const sKey = s.playerName.toLowerCase().trim();
          if (['mauricharolde', 'test1', 'test2'].includes(sKey)) return false;
          if (sKey === 'marie') return false;
          if (storageKey === 'kaboom_thursday_standings' && sKey === 'lynn') return false;
          const gameStat = statsLookup[sKey];
          const hasGameActivity =
            gameStat &&
            ((gameStat.totalGamesPlayed || 0) > 0 ||
              (gameStat.totalGameWins || 0) > 0 ||
              (gameStat.points || 0) > 0 ||
              (gameStat.seasonBullsHit || 0) > 0 ||
              (gameStat.game501HighScore || 0) > 0 ||
              (gameStat.game501HighFinish || 0) > 0 ||
              (gameStat.game301HighScore || 0) > 0 ||
              (gameStat.game301HighFinish || 0) > 0 ||
              (gameStat.game301HighestBeginningScore || 0) > 0 ||
              (gameStat.cricketWins || 0) > 0);
          const hasStandingActivity =
            (s.gamesPlayed || 0) > 0 ||
            (s.gamesWon || 0) > 0 ||
            (s.points || 0) > 0 ||
            (s.seasonBullsHit || 0) > 0 ||
            (s.threeDartAvg || 0) > 0 ||
            (s.highCheckout || 0) > 0 ||
            (s.highIn || 0) > 0 ||
            (s.total180s || 0) > 0;
          return hasStandingActivity || hasGameActivity;
        });

        if (filtered.length !== standings.length) {
          standings = filtered;
          modified = true;
        }

        standings.forEach((s) => {
          if (s.gamesPlayed > 0 && s.gamesWon > s.gamesPlayed) {
            s.gamesWon = s.gamesPlayed;
            s.points = s.gamesWon;
            modified = true;
          }
          const sKey = s.playerName.toLowerCase().trim();
          const gameStat = statsLookup[sKey];

          if (storageKey === 'kaboom_tuesday_standings') {
            if (sKey === 'sylvain') {
              if (s.gamesPlayed !== 9 || s.gamesWon !== 8 || s.points !== 8) {
                s.gamesPlayed = 9;
                s.gamesWon = 8;
                s.points = 8;
                modified = true;
              }
            } else if (sKey === 'mark') {
              if (s.gamesPlayed !== 9 || s.gamesWon !== 6 || s.points !== 6) {
                s.gamesPlayed = 9;
                s.gamesWon = 6;
                s.points = 6;
                modified = true;
              }
            } else if (sKey === 'ray') {
              if (s.gamesPlayed !== 9 || s.gamesWon !== 5 || s.points !== 5) {
                s.gamesPlayed = 9;
                s.gamesWon = 5;
                s.points = 5;
                modified = true;
              }
            } else if (sKey === 'jack d') {
              if (s.gamesPlayed !== 9 || s.gamesWon !== 0 || s.points !== 0) {
                s.gamesPlayed = 9;
                s.gamesWon = 0;
                s.points = 0;
                modified = true;
              }
            }
          }

          if (storageKey === 'kaboom_thursday_standings') {
            // There are no official games until this upcoming Thursday:
            // Ensure all players for Thursday league strictly have 0 stats and 0 Bulls.
            if (
              s.gamesPlayed !== 0 ||
              s.gamesWon !== 0 ||
              s.points !== 0 ||
              s.seasonBullsHit !== 0 ||
              s.threeDartAvg !== 0 ||
              s.highCheckout !== 0 ||
              s.highOut !== 0 ||
              s.highIn !== 0 ||
              s.total180s !== 0 ||
              s.thursdayStats
            ) {
              s.gamesPlayed = 0;
              s.gamesWon = 0;
              s.points = 0;
              s.seasonBullsHit = 0;
              s.threeDartAvg = 0;
              s.highCheckout = 0;
              s.highOut = 0;
              s.highIn = 0;
              s.total180s = 0;
              s.thursdayStats = undefined;
              modified = true;
            }
          }

          if (gameStat && gameStat.totalGameWins !== undefined && s.gamesWon > gameStat.totalGameWins) {
            s.gamesWon = gameStat.totalGameWins;
            s.points = s.gamesWon;
            modified = true;
          }
          // Only clear averages/high marks if the player has absolutely 0 activity across standings and game stats
          const hasAnyActivity =
            (s.gamesPlayed || 0) > 0 ||
            (s.gamesWon || 0) > 0 ||
            (s.seasonBullsHit || 0) > 0 ||
            (gameStat && (
              (gameStat.totalGamesPlayed || 0) > 0 ||
              (gameStat.totalGameWins || 0) > 0 ||
              (gameStat.seasonBullsHit || 0) > 0 ||
              (gameStat.game501HighScore || 0) > 0 ||
              (gameStat.game301HighScore || 0) > 0 ||
              (gameStat.game1001HighScore || 0) > 0
            ));

          if (!hasAnyActivity) {
            if (s.threeDartAvg !== 0 || s.highCheckout !== 0 || s.highIn !== 0 || s.total180s !== 0) {
              s.threeDartAvg = 0;
              s.highCheckout = 0;
              s.highOut = 0;
              s.highIn = 0;
              s.total180s = 0;
              modified = true;
            }
          }
        });

        if (modified) {
          localStorage.setItem(storageKey, JSON.stringify(standings));
        }
      } catch (err) {
        console.error(`Failed to sanitize standings for ${storageKey}`, err);
      }
    };

    sanitizeStandings('kaboom_tuesday_standings', tuesMap);
    sanitizeStandings('kaboom_thursday_standings', thursMap);
    sanitizeStandings('kaboom_wednesday_standings', getWednesdayGameStatsMap());

    // Strictly ensure seasonBullsMap has Lynn = 2, Floyd = 0, Stan = 0, Amber = 0, Dale = 0
    const bullsMap = getSeasonBullsMap();
    let bullsModified = false;
    if (bullsMap['lynn'] !== 2) {
      bullsMap['lynn'] = 2;
      bullsModified = true;
    }
    ['floyd', 'stan', 'amber', 'dale'].forEach(pName => {
      if (bullsMap[pName] !== undefined && bullsMap[pName] !== 0) {
        bullsMap[pName] = 0;
        bullsModified = true;
      }
    });
    ['mauricharolde', 'test1', 'test2'].forEach(pName => {
      if (bullsMap[pName] !== undefined) {
        delete bullsMap[pName];
        bullsModified = true;
      }
    });
    if (bullsModified) {
      saveSeasonBullsMap(bullsMap);
    }

    // Strictly ensure player roster has Lynn = 2, Floyd = 0, Stan/Amber/Dale = 0 bulls & stats, and remove test players
    const rosterSaved = localStorage.getItem('kaboom_dart_players');
    if (rosterSaved) {
      try {
        const roster = JSON.parse(rosterSaved);
        let rMod = false;
        roster.forEach((p: any) => {
          const k = (p.name || '').toLowerCase().trim();
          if (k === 'lynn' && p.seasonBullsHit !== 2) {
            p.seasonBullsHit = 2;
            rMod = true;
          }
          if (['floyd', 'stan', 'amber', 'dale'].includes(k)) {
            if (p.seasonBullsHit !== 0) {
              p.seasonBullsHit = 0;
              rMod = true;
            }
            if (p.totalBullsHit !== 0) {
              p.totalBullsHit = 0;
              rMod = true;
            }
          }
          // Clear all official match stats for Stan, Amber, Dale as they have not played official matches yet
          if (['stan', 'amber', 'dale'].includes(k)) {
            if (p.matchesPlayed !== 0 || p.matchesWon !== 0 || p.legsWon !== 0) {
              p.matchesPlayed = 0;
              p.matchesWon = 0;
              p.legsWon = 0;
              p.setsWon = 0;
              p.totalLegsPlayed = 0;
              p.totalLegsWon = 0;
              p.totalDartsThrown = 0;
              p.totalPointsScored = 0;
              p.careerAvg = 0;
              p.highCheckout = 0;
              p.total180s = 0;
              p.stats = {
                threeDartAvg: 0,
                first9Avg: 0,
                mpr: 0,
                highScore: 0,
                highOut: 0,
                highIn: 0,
                checkoutAttempts: 0,
                checkoutHits: 0,
                count60Plus: 0,
                count100Plus: 0,
                count140Plus: 0,
                count180: 0,
                dartsThrown: 0,
              };
              rMod = true;
            }
          }
        });
        const cleanedRoster = roster.filter((p: any) => {
          const k = (p.name || '').toLowerCase().trim();
          return !['mauricharolde', 'test1', 'test2'].includes(k);
        });
        if (cleanedRoster.length !== roster.length) {
          rMod = true;
        }
        // Ensure Stan is in roster
        const stanInRoster = cleanedRoster.some((p: any) => (p.name || '').toLowerCase().trim() === 'stan');
        if (!stanInRoster) {
          cleanedRoster.push({
            id: 'p-1788187829549',
            name: 'Stan',
            avatar: '🦸‍♂️',
            matchesPlayed: 0,
            matchesWon: 0,
            careerAvg: 0,
            highCheckout: 0,
            total180s: 0,
            totalBullsHit: 0,
            seasonBullsHit: 0,
            stats: {
              threeDartAvg: 0,
              first9Avg: 0,
              mpr: 0,
              highScore: 0,
              highOut: 0,
              highIn: 0,
              checkoutAttempts: 0,
              checkoutHits: 0,
              count60Plus: 0,
              count100Plus: 0,
              count140Plus: 0,
              count180: 0,
              dartsThrown: 0,
            },
          });
          rMod = true;
        }
        if (rMod) {
          localStorage.setItem('kaboom_dart_players', JSON.stringify(cleanedRoster));
        }

        // Un-delete Stan from deletedPlayers
        const deletedRaw = localStorage.getItem('kaboom_deleted_players');
        if (deletedRaw) {
          try {
            const delList = JSON.parse(deletedRaw);
            const filteredDel = delList.filter((dp: any) => (dp.name || dp.id || '').toLowerCase().trim() !== 'stan');
            if (filteredDel.length !== delList.length) {
              localStorage.setItem('kaboom_deleted_players', JSON.stringify(filteredDel));
            }
          } catch (e) {}
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed to run repairTuesdayAndThursdayStats', e);
  }
};

export const recordBullsRoundResults = (
  results: BullsRoundPlayerRecord[],
  leagueType?: 'tuesday' | 'wednesday' | 'thursday'
) => {
  if (!results || results.length === 0) return;

  // 1. Update overall season bulls store
  const bullsMap = getSeasonBullsMap();
  results.forEach((rec) => {
    if (!rec.playerName) return;
    const key = rec.playerName.toLowerCase().trim();
    bullsMap[key] = (bullsMap[key] || 0) + (rec.bullsHit || 0);
  });

  saveSeasonBullsMap(bullsMap);

  // 2. Strictly update ONLY the specific league format store where this bulls round occurred
  if (leagueType === 'wednesday') {
    const statsMap = getWednesdayGameStatsMap();
    results.forEach((rec) => {
      if (!rec.playerName) return;
      const key = rec.playerName.toLowerCase().trim();
      const pStats = getOrCreateWednesdayPlayerStats(statsMap, rec.playerName, rec.playerId, rec.avatar);
      pStats.seasonBullsHit = (pStats.seasonBullsHit || 0) + (rec.bullsHit || 0);
      if (rec.teamName) pStats.teamName = rec.teamName;
    });
    saveWednesdayGameStatsMap(statsMap);
  } else if (leagueType === 'tuesday') {
    const tuesdayStatsMap = getTuesdayGameStatsMap();
    results.forEach((rec) => {
      if (!rec.playerName) return;
      const key = rec.playerName.toLowerCase().trim();
      const pStats = getOrCreateTuesdayPlayerStats(tuesdayStatsMap, rec.playerName, rec.playerId, rec.avatar);
      pStats.seasonBullsHit = (pStats.seasonBullsHit || 0) + (rec.bullsHit || 0);
    });
    saveTuesdayGameStatsMap(tuesdayStatsMap);
  } else if (leagueType === 'thursday') {
    const thursdayStatsMap = getThursdayGameStatsMap();
    results.forEach((rec) => {
      if (!rec.playerName) return;
      const key = rec.playerName.toLowerCase().trim();
      const pStats = getOrCreateThursdayPlayerStats(thursdayStatsMap, rec.playerName, rec.playerId, rec.avatar);
      pStats.seasonBullsHit = (pStats.seasonBullsHit || 0) + (rec.bullsHit || 0);
    });
    saveThursdayGameStatsMap(thursdayStatsMap);
  }

  // 3. Update League Standings ONLY for the specific league format
  if (leagueType) {
    try {
      const storageKey = `kaboom_${leagueType}_standings`;
      const saved = localStorage.getItem(storageKey);
      let standings: IndividualLeagueStanding[] = saved ? JSON.parse(saved) : [];

      results.forEach((rec) => {
        if (!rec.playerName) return;
        const key = rec.playerName.toLowerCase().trim();
        const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
        let entry = standings.find((s) => s.playerName.toLowerCase().trim() === key);
        if (!entry) {
          entry = standings.find((s) => s.playerName.toLowerCase().trim().replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim() === cleanKey);
        }
        if (!entry) {
          entry = {
            playerId: rec.playerId || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            playerName: rec.playerName,
            points: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            threeDartAvg: 0,
            highCheckout: 0,
            total180s: 0,
            seasonBullsHit: 0,
          };
          standings.push(entry);
        }
        entry.seasonBullsHit = (entry.seasonBullsHit || 0) + (rec.bullsHit || 0);
        if (leagueType === 'wednesday') {
          const statsMap = getWednesdayGameStatsMap();
          entry.wednesdayStats = statsMap[key] || statsMap[cleanKey];
        } else if (leagueType === 'tuesday') {
          const tuesdayStatsMap = getTuesdayGameStatsMap();
          entry.tuesdayStats = tuesdayStatsMap[key] || tuesdayStatsMap[cleanKey];
        } else if (leagueType === 'thursday') {
          const thursdayStatsMap = getThursdayGameStatsMap();
          entry.thursdayStats = thursdayStatsMap[key] || thursdayStatsMap[cleanKey];
        }
      });

      localStorage.setItem(storageKey, JSON.stringify(standings));
      syncLeagueStandingsToCloud(leagueType, standings);
    } catch (e) {
      console.error(`Failed to update ${leagueType} standings with bulls results`, e);
    }
  }

  // 4. Update registered roster total bulls
  try {
    const savedRoster = localStorage.getItem('kaboom_dart_players');
    if (savedRoster) {
      const roster: any[] = JSON.parse(savedRoster);
      roster.forEach((p) => {
        const key = p.name?.toLowerCase().trim();
        const cleanKey = key?.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
        const found = results.find((r) => {
          const rKey = r.playerName?.toLowerCase().trim();
          const rClean = rKey?.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
          return rKey === key || (cleanKey && rClean === cleanKey);
        });
        if (found) {
          p.totalBullsHit = (bullsMap[key] || bullsMap[cleanKey] || 0);
        }
      });
      localStorage.setItem('kaboom_dart_players', JSON.stringify(roster));
    }
  } catch (e) {
    console.error('Failed to update roster total bulls', e);
  }

  // 5. Notify all listeners and active views for instant UI re-render
  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
};

/**
 * NIGHTLY GAME BULLS LOGIC (Tuesday & Thursday Leagues)
 * Separated from matches: each player registered for that night shoots once individually.
 * Stats maintain a running total of bulls hit each Tuesday/Thursday night.
 */
export const getNightlyBullsSessions = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday'
): Record<string, NightlyBullsSession> => {
  try {
    const raw = localStorage.getItem(`kaboom_nightly_bulls_${leagueType}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (leagueType === 'wednesday') {
          let modified = false;
          Object.keys(parsed).forEach((k) => {
            if (k < '2026-09-16') {
              delete parsed[k];
              modified = true;
            }
          });
          if (modified) {
            localStorage.setItem(`kaboom_nightly_bulls_${leagueType}`, JSON.stringify(parsed));
          }
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Failed to load nightly bulls sessions for ${leagueType}`, e);
  }
  return {};
};

export const saveNightlyBullsSessions = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  sessions: Record<string, NightlyBullsSession>
) => {
  try {
    localStorage.setItem(`kaboom_nightly_bulls_${leagueType}`, JSON.stringify(sessions));
  } catch (e) {
    console.error(`Failed to save nightly bulls sessions for ${leagueType}`, e);
  }
};

export const getNightlyBullsSessionForDate = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  targetDate?: string
): NightlyBullsSession => {
  const dateKey = targetDate || new Date().toISOString().split('T')[0];
  const sessions = getNightlyBullsSessions(leagueType);
  if (sessions[dateKey]) {
    return sessions[dateKey];
  }

  // Generate display date (e.g., "Tuesday, Sep 17, 2026")
  let displayDate = dateKey;
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    displayDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {}

  const newSession: NightlyBullsSession = {
    id: `${leagueType}-${dateKey}`,
    date: dateKey,
    displayDate,
    leagueType,
    entries: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return newSession;
};

export const recordIndividualNightlyBulls = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  entry: NightlyBullsEntry,
  targetDate?: string
): { success: boolean; delta: number; newTotal: number; previousTotal: number } => {
  if (!entry || !entry.playerName) {
    return { success: false, delta: 0, newTotal: 0, previousTotal: 0 };
  }

  const dateKey = targetDate || new Date().toISOString().split('T')[0];
  const sessions = getNightlyBullsSessions(leagueType);
  const session = getNightlyBullsSessionForDate(leagueType, dateKey);

  const playerKey = entry.playerName.toLowerCase().trim();
  const cleanPlayerKey = playerKey.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();

  // Check if player already recorded tonight
  const existingEntry = session.entries[playerKey] || session.entries[cleanPlayerKey];
  const previousTonightBulls = existingEntry !== undefined ? existingEntry.bullsHit : null;

  // Delta: if first time tonight, delta = entry.bullsHit. If editing, delta = new - old.
  const delta = previousTonightBulls !== null ? (entry.bullsHit - previousTonightBulls) : entry.bullsHit;

  // Save entry in tonight's session
  session.entries[playerKey] = {
    ...entry,
    timestamp: Date.now(),
  };
  if (cleanPlayerKey !== playerKey) {
    session.entries[cleanPlayerKey] = session.entries[playerKey];
  }
  session.updatedAt = Date.now();
  sessions[dateKey] = session;
  saveNightlyBullsSessions(leagueType, sessions);
  syncNightlyBullsToCloud(leagueType, session);

  // 1. Update overall season bulls store
  const bullsMap = getSeasonBullsMap();
  const currentSeasonBulls = bullsMap[playerKey] || bullsMap[cleanPlayerKey] || 0;
  const newSeasonBulls = Math.max(0, currentSeasonBulls + delta);
  bullsMap[playerKey] = newSeasonBulls;
  if (cleanPlayerKey !== playerKey) bullsMap[cleanPlayerKey] = newSeasonBulls;
  saveSeasonBullsMap(bullsMap);

  // 2. Update league stats map (Tuesday, Wednesday, or Thursday running total)
  let previousTotal = 0;
  let newTotal = 0;

  if (leagueType === 'tuesday') {
    const tStatsMap = getTuesdayGameStatsMap();
    const pStats = getOrCreateTuesdayPlayerStats(tStatsMap, entry.playerName, entry.playerId, entry.avatar);
    previousTotal = pStats.seasonBullsHit || 0;
    newTotal = Math.max(0, previousTotal + delta);
    pStats.seasonBullsHit = newTotal;
    saveTuesdayGameStatsMap(tStatsMap);
  } else if (leagueType === 'wednesday') {
    const wStatsMap = getWednesdayGameStatsMap();
    const pStats = getOrCreateWednesdayPlayerStats(wStatsMap, entry.playerName, entry.playerId, entry.avatar);
    previousTotal = pStats.seasonBullsHit || 0;
    newTotal = Math.max(0, previousTotal + delta);
    pStats.seasonBullsHit = newTotal;
    saveWednesdayGameStatsMap(wStatsMap);
  } else if (leagueType === 'thursday') {
    const thStatsMap = getThursdayGameStatsMap();
    const pStats = getOrCreateThursdayPlayerStats(thStatsMap, entry.playerName, entry.playerId, entry.avatar);
    previousTotal = pStats.seasonBullsHit || 0;
    newTotal = Math.max(0, previousTotal + delta);
    pStats.seasonBullsHit = newTotal;
    saveThursdayGameStatsMap(thStatsMap);
  }

  // 3. Update League Standings for this league
  try {
    const storageKey = `kaboom_${leagueType}_standings`;
    const saved = localStorage.getItem(storageKey);
    let standings: IndividualLeagueStanding[] = saved ? JSON.parse(saved) : [];

    let standingEntry = standings.find((s) => s.playerName.toLowerCase().trim() === playerKey);
    if (!standingEntry) {
      standingEntry = standings.find(
        (s) => s.playerName.toLowerCase().trim().replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim() === cleanPlayerKey
      );
    }

    if (!standingEntry) {
      standingEntry = {
        playerId: entry.playerId || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playerName: entry.playerName,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        threeDartAvg: 0,
        highCheckout: 0,
        total180s: 0,
        seasonBullsHit: newTotal,
      };
      standings.push(standingEntry);
    } else {
      standingEntry.seasonBullsHit = Math.max(0, (standingEntry.seasonBullsHit || 0) + delta);
    }

    if (leagueType === 'tuesday') {
      const tStatsMap = getTuesdayGameStatsMap();
      standingEntry.tuesdayStats = tStatsMap[playerKey] || tStatsMap[cleanPlayerKey];
    } else if (leagueType === 'wednesday') {
      const wStatsMap = getWednesdayGameStatsMap();
      standingEntry.wednesdayStats = wStatsMap[playerKey] || wStatsMap[cleanPlayerKey];
    } else if (leagueType === 'thursday') {
      const thStatsMap = getThursdayGameStatsMap();
      standingEntry.thursdayStats = thStatsMap[playerKey] || thStatsMap[cleanPlayerKey];
    }

    localStorage.setItem(storageKey, JSON.stringify(standings));
    syncLeagueStandingsToCloud(leagueType, standings);
  } catch (e) {
    console.error(`Failed to update ${leagueType} standings with nightly bulls`, e);
  }

  // 4. Update player profile total bulls
  try {
    const savedRoster = localStorage.getItem('kaboom_dart_players');
    if (savedRoster) {
      const roster: any[] = JSON.parse(savedRoster);
      roster.forEach((p) => {
        const key = p.name?.toLowerCase().trim();
        const cleanKey = key?.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
        if (key === playerKey || cleanKey === cleanPlayerKey) {
          p.totalBullsHit = newSeasonBulls;
          p.seasonBullsHit = newSeasonBulls;
        }
      });
      localStorage.setItem('kaboom_dart_players', JSON.stringify(roster));
    }
  } catch (e) {}

  // 5. Notify all listeners
  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}

  return { success: true, delta, newTotal, previousTotal };
};

export const deletePlayerNightlyBulls = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  playerName: string,
  targetDate?: string
) => {
  const dateKey = targetDate || new Date().toISOString().split('T')[0];
  const sessions = getNightlyBullsSessions(leagueType);
  const session = sessions[dateKey];
  if (!session) return;

  const playerKey = playerName.toLowerCase().trim();
  const cleanPlayerKey = playerKey.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();

  const entry = session.entries[playerKey] || session.entries[cleanPlayerKey];
  if (!entry) return;

  const bullsToRemove = entry.bullsHit;
  delete session.entries[playerKey];
  if (cleanPlayerKey !== playerKey) delete session.entries[cleanPlayerKey];
  session.updatedAt = Date.now();
  sessions[dateKey] = session;
  saveNightlyBullsSessions(leagueType, sessions);
  syncNightlyBullsToCloud(leagueType, session);

  // Revert running total by -bullsToRemove
  const bullsMap = getSeasonBullsMap();
  bullsMap[playerKey] = Math.max(0, (bullsMap[playerKey] || 0) - bullsToRemove);
  if (cleanPlayerKey !== playerKey) bullsMap[cleanPlayerKey] = Math.max(0, (bullsMap[cleanPlayerKey] || 0) - bullsToRemove);
  saveSeasonBullsMap(bullsMap);

  if (leagueType === 'tuesday') {
    const tStatsMap = getTuesdayGameStatsMap();
    if (tStatsMap[playerKey]) {
      tStatsMap[playerKey].seasonBullsHit = Math.max(0, (tStatsMap[playerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    if (cleanPlayerKey !== playerKey && tStatsMap[cleanPlayerKey]) {
      tStatsMap[cleanPlayerKey].seasonBullsHit = Math.max(0, (tStatsMap[cleanPlayerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    saveTuesdayGameStatsMap(tStatsMap);
  } else if (leagueType === 'wednesday') {
    const wStatsMap = getWednesdayGameStatsMap();
    if (wStatsMap[playerKey]) {
      wStatsMap[playerKey].seasonBullsHit = Math.max(0, (wStatsMap[playerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    if (cleanPlayerKey !== playerKey && wStatsMap[cleanPlayerKey]) {
      wStatsMap[cleanPlayerKey].seasonBullsHit = Math.max(0, (wStatsMap[cleanPlayerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    saveWednesdayGameStatsMap(wStatsMap);
  } else if (leagueType === 'thursday') {
    const thStatsMap = getThursdayGameStatsMap();
    if (thStatsMap[playerKey]) {
      thStatsMap[playerKey].seasonBullsHit = Math.max(0, (thStatsMap[playerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    if (cleanPlayerKey !== playerKey && thStatsMap[cleanPlayerKey]) {
      thStatsMap[cleanPlayerKey].seasonBullsHit = Math.max(0, (thStatsMap[cleanPlayerKey].seasonBullsHit || 0) - bullsToRemove);
    }
    saveThursdayGameStatsMap(thStatsMap);
  }

  // Revert standings
  try {
    const storageKey = `kaboom_${leagueType}_standings`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const standings: IndividualLeagueStanding[] = JSON.parse(saved);
      const standingEntry = standings.find(
        (s) => s.playerName.toLowerCase().trim() === playerKey ||
               s.playerName.toLowerCase().trim().replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim() === cleanPlayerKey
      );
      if (standingEntry) {
        standingEntry.seasonBullsHit = Math.max(0, (standingEntry.seasonBullsHit || 0) - bullsToRemove);
        localStorage.setItem(storageKey, JSON.stringify(standings));
        syncLeagueStandingsToCloud(leagueType, standings);
      }
    }
  } catch (e) {}

  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update'));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
};

export interface PlayerPerformanceRecord {
  name: string;
  threeDartAvg?: number;
  highOut?: number;
  highIn?: number;
  total180s?: number;
}

export const updateLeaguePoints = (
  winnerName: string,
  loserName: string,
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  performances?: (PlayerPerformanceRecord | any)[]
) => {
  // BYE PROTECTION: A bye does not count as a win and counts nothing for stats in any league
  if (!winnerName || !loserName) return;
  if (winnerName.toUpperCase().includes('BYE') || loserName.toUpperCase().includes('BYE')) {
    return;
  }

  const storageKey =
    leagueType === 'tuesday'
      ? 'kaboom_tuesday_standings'
      : leagueType === 'wednesday'
      ? 'kaboom_wednesday_standings'
      : 'kaboom_thursday_standings';

  let standings: IndividualLeagueStanding[] = [];
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      standings = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load league standings', e);
  }

  // Extract performances from Player objects or PlayerPerformanceRecord objects
  const perfMap = new Map<string, PlayerPerformanceRecord>();
  if (Array.isArray(performances)) {
    performances.forEach(item => {
      if (!item) return;
      // If item is a Player object with teamPlayers
      if (Array.isArray(item.teamPlayers) && item.teamPlayers.length > 0) {
        item.teamPlayers.forEach((tp: any) => {
          if (!tp || tp.isDummy) return;
          perfMap.set(tp.name.toLowerCase().trim(), {
            name: tp.name,
            threeDartAvg: tp.stats?.threeDartAvg,
            highOut: tp.stats?.highOut,
            highIn: tp.stats?.highIn,
            total180s: tp.stats?.count180,
          });
        });
      }
      if (item.name) {
        perfMap.set(item.name.toLowerCase().trim(), {
          name: item.name,
          threeDartAvg: item.threeDartAvg ?? item.stats?.threeDartAvg,
          highOut: item.highOut ?? item.highCheckout ?? item.stats?.highOut,
          highIn: item.highIn ?? item.stats?.highIn,
          total180s: item.total180s ?? item.stats?.count180,
        });
      }
    });
  }

  const applyPerfToEntry = (entry: IndividualLeagueStanding, pName: string) => {
    const perf = perfMap.get(pName.toLowerCase().trim());
    if (perf) {
      if (perf.threeDartAvg && perf.threeDartAvg > 0) {
        if (!entry.threeDartAvg || entry.threeDartAvg === 0) {
          entry.threeDartAvg = parseFloat(perf.threeDartAvg.toFixed(1));
        } else {
          const prevWeight = Math.max(1, entry.gamesPlayed - 1);
          const newAvg = ((entry.threeDartAvg * prevWeight) + perf.threeDartAvg) / Math.max(1, entry.gamesPlayed);
          entry.threeDartAvg = parseFloat(Math.max(entry.threeDartAvg * 0.9, newAvg).toFixed(1));
        }
      }
      if (perf.highOut && perf.highOut > 0) {
        entry.highCheckout = Math.max(entry.highCheckout || 0, entry.highOut);
        entry.highOut = entry.highCheckout;
      }
      if (perf.highIn && perf.highIn > 0) {
        entry.highIn = Math.max(entry.highIn || 0, perf.highIn);
      }
      if (perf.total180s && perf.total180s > 0) {
        entry.total180s = (entry.total180s || 0) + perf.total180s;
      }
    }
  };

  // Helper to split team names, normalizing dummy players to '🤖 Dummy Player'
  const extractPlayerNames = (rawName: string): string[] => {
    return rawName
      .split(/\s*(?:&|\+|\/|,|\band\b)\s*/i)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => (s.toLowerCase().includes('dummy') || s.includes('🤖')) ? '🤖 Dummy Player' : s);
  };

  let winningPlayerNames = extractPlayerNames(winnerName);
  let losingPlayerNames = extractPlayerNames(loserName);

  // If performances contains player objects with teamPlayers, extract individual names if winnerName or loserName matched team
  if (Array.isArray(performances)) {
    const winnerPlayerObj = performances.find((item: any) =>
      item && item.name && (item.name.toLowerCase().trim() === winnerName.toLowerCase().trim() || extractPlayerNames(item.name).join(' ') === extractPlayerNames(winnerName).join(' '))
    );
    if (winnerPlayerObj && Array.isArray(winnerPlayerObj.teamPlayers) && winnerPlayerObj.teamPlayers.length > 0) {
      const subNames = winnerPlayerObj.teamPlayers
        .filter((tp: any) => tp && tp.name)
        .map((tp: any) => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
          return isDummy ? '🤖 Dummy Player' : tp.name.trim();
        });
      if (subNames.length > 0) {
        winningPlayerNames = subNames;
      }
    }

    const loserPlayerObj = performances.find((item: any) =>
      item && item.name && (item.name.toLowerCase().trim() === loserName.toLowerCase().trim() || extractPlayerNames(item.name).join(' ') === extractPlayerNames(loserName).join(' '))
    );
    if (loserPlayerObj && Array.isArray(loserPlayerObj.teamPlayers) && loserPlayerObj.teamPlayers.length > 0) {
      const subNames = loserPlayerObj.teamPlayers
        .filter((tp: any) => tp && tp.name)
        .map((tp: any) => {
          const isDummy = Boolean(tp.isDummy || tp.name?.toLowerCase().includes('dummy') || tp.name?.includes('🤖'));
          return isDummy ? '🤖 Dummy Player' : tp.name.trim();
        });
      if (subNames.length > 0) {
        losingPlayerNames = subNames;
      }
    }
  }

  // Deduplicate names to ensure exactly 1 win/game per individual player
  winningPlayerNames = Array.from(new Set(winningPlayerNames));
  losingPlayerNames = Array.from(new Set(losingPlayerNames.filter(name => !winningPlayerNames.includes(name))));

  // Update winners (+1 point, +1 win, +1 played)
  winningPlayerNames.forEach(pName => {
    const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
    const targetName = isDummy ? '🤖 Dummy Player' : pName;
    let entry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
    if (!entry) {
      entry = {
        playerId: isDummy ? 'p-dummy' : `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playerName: targetName,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        threeDartAvg: 0,
        highCheckout: 0,
        highOut: 0,
        highIn: 0,
        total180s: 0,
      };
      standings.push(entry);
    }
    entry.points += 1; // 1 point for each game won individually
    entry.gamesWon += 1;
    entry.gamesPlayed += 1;
    applyPerfToEntry(entry, targetName);
  });

  // Update losers (+1 played)
  losingPlayerNames.forEach(pName => {
    const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
    const targetName = isDummy ? '🤖 Dummy Player' : pName;
    let entry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
    if (!entry) {
      entry = {
        playerId: isDummy ? 'p-dummy' : `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playerName: targetName,
        points: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        threeDartAvg: 0,
        highCheckout: 0,
        highOut: 0,
        highIn: 0,
        total180s: 0,
      };
      standings.push(entry);
    }
    entry.gamesPlayed += 1;
    applyPerfToEntry(entry, targetName);
  });

  // Also apply any additional sub-player performances not in winner/loser string
  perfMap.forEach((perf, key) => {
    let entry = standings.find(s => s.playerName.toLowerCase().trim() === key);
    if (entry) {
      applyPerfToEntry(entry, perf.name);
    }
  });

  try {
    localStorage.setItem(storageKey, JSON.stringify(standings));
    syncLeagueStandingsToCloud(leagueType, standings);
  } catch (e) {
    console.error('Failed to save league standings', e);
  }

  // If Tuesday league, also keep Tuesday Game Stats store in sync
  if (leagueType === 'tuesday') {
    try {
      const statsMap = getTuesdayGameStatsMap();
      winningPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGameWins = Math.max(pStats.totalGameWins, matchEntry.gamesWon);
          pStats.points = pStats.totalGameWins;
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      losingPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      saveTuesdayGameStatsMap(statsMap);
    } catch (e) {
      console.error('Failed to sync Tuesday stats in updateLeaguePoints', e);
    }
  }

  // If Wednesday league, also keep Wednesday Game Stats store in sync
  if (leagueType === 'wednesday') {
    try {
      const statsMap = getWednesdayGameStatsMap();
      winningPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGameWins = Math.max(pStats.totalGameWins, matchEntry.gamesWon);
          pStats.points = pStats.totalGameWins;
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      losingPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      saveWednesdayGameStatsMap(statsMap);
    } catch (e) {
      console.error('Failed to sync Wednesday stats in updateLeaguePoints', e);
    }
  }

  // If Thursday league, also keep Thursday Game Stats store in sync
  if (leagueType === 'thursday') {
    try {
      const statsMap = getThursdayGameStatsMap();
      winningPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGameWins = Math.max(pStats.totalGameWins, matchEntry.gamesWon);
          pStats.points = pStats.totalGameWins;
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      losingPlayerNames.forEach(pName => {
        const isDummy = pName.toLowerCase().includes('dummy') || pName.includes('🤖');
        const targetName = isDummy ? '🤖 Dummy Player' : pName;
        const pStats = getOrCreateThursdayPlayerStats(statsMap, targetName, isDummy ? 'p-dummy' : undefined, isDummy ? '🤖' : undefined);
        const matchEntry = standings.find(s => s.playerName.toLowerCase() === targetName.toLowerCase());
        if (matchEntry) {
          pStats.totalGamesPlayed = Math.max(pStats.totalGamesPlayed, matchEntry.gamesPlayed, pStats.totalGameWins);
        }
      });
      saveThursdayGameStatsMap(statsMap);
    } catch (e) {
      console.error('Failed to sync Thursday stats in updateLeaguePoints', e);
    }
  }
};

/**
 * Calculates automated overall standings for all players across Tuesday Singles,
 * Wednesday Teams, and Thursday Doubles.
 */
export const calculateAutomatedLeaderboard = (): OverallLeaderboardEntry[] => {
  // Repair any legacy misplaced 501 stats before computing leaderboard
  repairTuesdayAndThursdayStats();

  const formatKeys: ('tuesday' | 'wednesday' | 'thursday')[] = ['tuesday', 'wednesday', 'thursday'];
  const playerMap = new Map<string, OverallLeaderboardEntry>();
  const tuesdayGameStatsMap = getTuesdayGameStatsMap();
  const wednesdayGameStatsMap = getWednesdayGameStatsMap();
  const thursdayGameStatsMap = getThursdayGameStatsMap();
  const seasonBullsMap = getSeasonBullsMap();

  // 1. Fetch registered roster for avatars and initial names
  try {
    const savedRoster = localStorage.getItem('kaboom_dart_players');
    if (savedRoster) {
      const roster: { id: string; name: string; avatar?: string }[] = JSON.parse(savedRoster);
      roster.forEach(p => {
        const key = p.name.toLowerCase().trim();
        if (!playerMap.has(key)) {
          playerMap.set(key, {
            playerId: p.id || `p-${key}`,
            playerName: p.name,
            avatar: p.avatar || '🎯',
            tuesdayWins: 0,
            tuesdayPlayed: 0,
            tuesdayPoints: 0,
            tuesdayAvg: 0,
            tuesdayHighOut: 0,
            tuesdayHighIn: 0,
            tuesday180s: 0,
            tuesdayBulls: 0,
            wednesdayWins: 0,
            wednesdayPlayed: 0,
            wednesdayPoints: 0,
            wednesdayAvg: 0,
            wednesdayHighOut: 0,
            wednesdayHighIn: 0,
            wednesday180s: 0,
            wednesdayBulls: 0,
            thursdayWins: 0,
            thursdayPlayed: 0,
            thursdayPoints: 0,
            thursdayAvg: 0,
            thursdayHighOut: 0,
            thursdayHighIn: 0,
            thursday180s: 0,
            thursdayBulls: 0,
            totalWins: 0,
            totalPlayed: 0,
            winPercentage: 0,
            totalPoints: 0,
            threeDartAvg: 0,
            highCheckout: 0,
            highOut: 0,
            highIn: 0,
            total180s: 0,
            seasonBullsHit: 0,
            tuesdayStats: undefined,
            wednesdayStats: undefined,
            thursdayStats: undefined,
          });
        }
      });
    }
  } catch (e) {
    console.error('Error loading roster for leaderboard', e);
  }

  // Ensure every active player in stats maps is also present in playerMap
  [
    tuesdayGameStatsMap,
    wednesdayGameStatsMap,
    thursdayGameStatsMap,
  ].forEach((statsMap) => {
    Object.keys(statsMap).forEach((key) => {
      const stats = statsMap[key] as any;
      const pName: string | undefined = stats?.playerName || stats?.name;
      if (!stats || !pName) return;
      const hasActivity =
        (stats.totalGamesPlayed || 0) > 0 ||
        (stats.totalGameWins || 0) > 0 ||
        (stats.points || 0) > 0 ||
        (stats.seasonBullsHit || 0) > 0 ||
        (stats.game501HighScore || 0) > 0 ||
        (stats.game501HighFinish || 0) > 0 ||
        (stats.game301HighScore || 0) > 0 ||
        (stats.game301HighFinish || 0) > 0 ||
        (stats.game1001HighScore || 0) > 0 ||
        (stats.game701HighScore || 0) > 0 ||
        (stats.baseballHighScore || 0) > 0 ||
        (stats.fivesHighScore || 0) > 0 ||
        (stats.cricketWins || 0) > 0;
      if (!hasActivity) return;

      const lowerKey = pName.toLowerCase().trim();
      if (!playerMap.has(lowerKey)) {
        playerMap.set(lowerKey, {
          playerId: stats.playerId || `p-${lowerKey}`,
          playerName: pName,
          avatar: stats.avatar || '🎯',
          tuesdayWins: 0,
          tuesdayPlayed: 0,
          tuesdayPoints: 0,
          tuesdayAvg: 0,
          tuesdayHighOut: 0,
          tuesdayHighIn: 0,
          tuesday180s: 0,
          tuesdayBulls: 0,
          wednesdayWins: 0,
          wednesdayPlayed: 0,
          wednesdayPoints: 0,
          wednesdayAvg: 0,
          wednesdayHighOut: 0,
          wednesdayHighIn: 0,
          wednesday180s: 0,
          wednesdayBulls: 0,
          thursdayWins: 0,
          thursdayPlayed: 0,
          thursdayPoints: 0,
          thursdayAvg: 0,
          thursdayHighOut: 0,
          thursdayHighIn: 0,
          thursday180s: 0,
          thursdayBulls: 0,
          totalWins: 0,
          totalPlayed: 0,
          winPercentage: 0,
          totalPoints: 0,
          threeDartAvg: 0,
          highCheckout: 0,
          highOut: 0,
          highIn: 0,
          total180s: 0,
          seasonBullsHit: 0,
          tuesdayStats: undefined,
          wednesdayStats: undefined,
          thursdayStats: undefined,
        });
      }
    });
  });

  // 2. Aggregate format standings
  formatKeys.forEach(fKey => {
    const storageKey = `kaboom_${fKey}_standings`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const standings: IndividualLeagueStanding[] = JSON.parse(saved);
        standings.forEach(s => {
          const key = s.playerName.toLowerCase().trim();
          let entry = playerMap.get(key);
          if (!entry) {
            entry = {
              playerId: s.playerId || `p-${key}`,
              playerName: s.playerName,
              avatar: '🎯',
              tuesdayWins: 0,
              tuesdayPlayed: 0,
              tuesdayPoints: 0,
              tuesdayAvg: 0,
              tuesdayHighOut: 0,
              tuesdayHighIn: 0,
              tuesday180s: 0,
              tuesdayBulls: 0,
              wednesdayWins: 0,
              wednesdayPlayed: 0,
              wednesdayPoints: 0,
              wednesdayAvg: 0,
              wednesdayHighOut: 0,
              wednesdayHighIn: 0,
              wednesday180s: 0,
              wednesdayBulls: 0,
              thursdayWins: 0,
              thursdayPlayed: 0,
              thursdayPoints: 0,
              thursdayAvg: 0,
              thursdayHighOut: 0,
              thursdayHighIn: 0,
              thursday180s: 0,
              thursdayBulls: 0,
              totalWins: 0,
              totalPlayed: 0,
              winPercentage: 0,
              totalPoints: 0,
              threeDartAvg: 0,
              highCheckout: 0,
              highOut: 0,
              highIn: 0,
              total180s: 0,
              seasonBullsHit: 0,
              tuesdayStats: undefined,
              wednesdayStats: undefined,
              thursdayStats: undefined,
            };
            playerMap.set(key, entry);
          }

          const sHighOut = s.highCheckout || s.highOut || 0;
          const sHighIn = s.highIn || 0;

          if (fKey === 'tuesday') {
            const tuesStats = tuesdayGameStatsMap[key];
            const hasTuesStats = tuesStats && (
              (tuesStats.totalGamesPlayed || 0) > 0 ||
              (tuesStats.totalGameWins || 0) > 0 ||
              (tuesStats.points || 0) > 0 ||
              (tuesStats.seasonBullsHit || 0) > 0 ||
              (tuesStats.game501HighScore || 0) > 0 ||
              (tuesStats.game501HighFinish || 0) > 0 ||
              (tuesStats.game301HighScore || 0) > 0 ||
              (tuesStats.game301HighFinish || 0) > 0 ||
              (tuesStats.game301HighestBeginningScore || 0) > 0 ||
              (tuesStats.cricketWins || 0) > 0
            );
            const hasTuesStanding = (s.gamesPlayed || 0) > 0 || (s.gamesWon || 0) > 0 || (s.seasonBullsHit || 0) > 0;

            if (hasTuesStats || hasTuesStanding) {
              if (tuesStats) {
                entry.tuesdayWins = tuesStats.totalGameWins;
                entry.tuesdayPlayed = Math.max(tuesStats.totalGamesPlayed, entry.tuesdayWins);
              } else {
                entry.tuesdayWins = Math.max(entry.tuesdayWins, s.gamesWon || 0);
                entry.tuesdayPlayed = Math.max(entry.tuesdayPlayed, s.gamesPlayed || 0, entry.tuesdayWins);
              }
              entry.tuesdayPoints = entry.tuesdayWins;
              entry.tuesdayAvg = Math.max(entry.tuesdayAvg || 0, s.threeDartAvg || 0, tuesStats?.game501Avg || 0, tuesStats?.game301Avg || 0);
              const tuesMaxFin = Math.max(
                sHighOut,
                tuesStats?.game501HighFinish || 0,
                tuesStats?.game301HighFinish || 0
              );
              entry.tuesdayHighOut = Math.max(entry.tuesdayHighOut || 0, tuesMaxFin);
              entry.tuesdayHighIn = Math.max(entry.tuesdayHighIn || 0, sHighIn, tuesStats?.game301HighestBeginningScore || 0);
              entry.tuesday180s = (entry.tuesday180s || 0) + (s.total180s || 0);
              entry.tuesdayBulls = Math.max(entry.tuesdayBulls || 0, s.seasonBullsHit || 0, tuesStats?.seasonBullsHit || 0);
            }
          } else if (fKey === 'wednesday') {
            const isOfficialWed = WEDNESDAY_OFFICIAL_PLAYERS.has(key);
            const wedStats = isOfficialWed ? wednesdayGameStatsMap[key] : undefined;
            const hasWedStats = isOfficialWed && wedStats && (
              (wedStats.totalGamesPlayed || 0) > 0 ||
              (wedStats.totalGameWins || 0) > 0 ||
              (wedStats.points || 0) > 0 ||
              (wedStats.seasonBullsHit || 0) > 0 ||
              (wedStats.game1001HighScore || 0) > 0 ||
              (wedStats.game1001HighFinish || 0) > 0 ||
              (wedStats.game701HighScore || 0) > 0 ||
              (wedStats.game701HighFinish || 0) > 0 ||
              (wedStats.game701HighestBeginningScore || 0) > 0 ||
              (wedStats.baseballHighScore || 0) > 0 ||
              (wedStats.fivesHighScore || 0) > 0 ||
              (wedStats.cricketWins || 0) > 0
            );
            const hasWedStanding = isOfficialWed && ((s.gamesPlayed || 0) > 0 || (s.gamesWon || 0) > 0 || (s.seasonBullsHit || 0) > 0);

            if (hasWedStats || hasWedStanding) {
              if (wedStats) {
                entry.wednesdayWins = wedStats.totalGameWins;
                entry.wednesdayPlayed = Math.max(wedStats.totalGamesPlayed, entry.wednesdayWins);
              } else {
                entry.wednesdayWins = Math.max(entry.wednesdayWins, s.gamesWon || 0);
                entry.wednesdayPlayed = Math.max(entry.wednesdayPlayed, s.gamesPlayed || 0, entry.wednesdayWins);
              }
              entry.wednesdayPoints = entry.wednesdayWins;
              entry.wednesdayAvg = Math.max(entry.wednesdayAvg || 0, s.threeDartAvg || 0);
              const wedMaxFin = Math.max(
                sHighOut,
                wedStats?.game1001HighFinish || 0,
                wedStats?.game701HighFinish || 0,
                wedStats?.fivesHighFinish || 0
              );
              entry.wednesdayHighOut = Math.max(entry.wednesdayHighOut || 0, wedMaxFin);
              entry.wednesdayHighIn = Math.max(entry.wednesdayHighIn || 0, sHighIn, wedStats?.game701HighestBeginningScore || 0);
              entry.wednesday180s = (entry.wednesday180s || 0) + (s.total180s || 0);
              entry.wednesdayBulls = Math.max(entry.wednesdayBulls || 0, s.seasonBullsHit || 0, wedStats?.seasonBullsHit || 0);
            } else {
              entry.wednesdayWins = 0;
              entry.wednesdayPlayed = 0;
              entry.wednesdayPoints = 0;
              entry.wednesdayAvg = 0;
              entry.wednesdayHighOut = 0;
              entry.wednesdayHighIn = 0;
              entry.wednesday180s = 0;
              entry.wednesdayBulls = 0;
              entry.wednesdayStats = undefined;
            }
          } else if (fKey === 'thursday') {
            // There are no official games until this upcoming Thursday:
            // Ensure all players for Thursday league strictly have 0 stats and 0 Bulls.
            entry.thursdayWins = 0;
            entry.thursdayPlayed = 0;
            entry.thursdayPoints = 0;
            entry.thursdayAvg = 0;
            entry.thursdayHighOut = 0;
            entry.thursdayHighIn = 0;
            entry.thursday180s = 0;
            entry.thursdayBulls = 0;
          }
        });
      }
    } catch (e) {
      console.error(`Error loading ${fKey} standings`, e);
    }
  });

  // 3. Scan completed bracket matchups across all formats to guarantee win inclusion
  formatKeys.forEach(fKey => {
    try {
      const savedBracket = localStorage.getItem(`kaboom_brackets_${fKey}`);
      if (savedBracket) {
        const bracketData = JSON.parse(savedBracket);
        const allMatches: BracketMatchup[] = [];
        if (Array.isArray(bracketData?.divisions)) {
          bracketData.divisions.forEach((d: any) => {
            if (Array.isArray(d?.matchups)) allMatches.push(...d.matchups);
          });
        }
        ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'].forEach((divKey) => {
          if (Array.isArray(bracketData?.[divKey])) {
            allMatches.push(...bracketData[divKey]);
          }
        });
        // Deduplicate matches by ID if they exist in both divisions and divisionKey
        const seenMatchIds = new Set<string>();
        const uniqueMatches: BracketMatchup[] = [];
        allMatches.forEach(m => {
          if (m && m.id && !seenMatchIds.has(m.id)) {
            seenMatchIds.add(m.id);
            uniqueMatches.push(m);
          } else if (m && !m.id) {
            uniqueMatches.push(m);
          }
        });

        uniqueMatches.forEach(m => {
          // BYE PROTECTION: A bye does not count as a win and counts nothing for stats
          const isByeMatch =
            m.isBye ||
            m.entryA?.name?.toUpperCase().includes('BYE') ||
            m.entryB?.name?.toUpperCase().includes('BYE') ||
            m.winnerName?.toUpperCase().includes('BYE');
          if (isByeMatch) return;

          // For Wednesday league only: clear all stats earned prior to September 16, 2026
          if (fKey === 'wednesday') {
            const mAny = m as any;
            const matchDate = mAny.date || '';
            const matchTime = mAny.createdAt || mAny.completedAt || 0;
            const WED_CUTOFF_MS = 1789516800000;
            if ((matchDate && matchDate < '2026-09-16') || (matchTime > 0 && matchTime < WED_CUTOFF_MS)) {
              return;
            }
          }

          if (m.status === 'completed' && m.winnerName) {
            // Identify winner player names
            const winnerPlayers: string[] = [];
            if (m.winnerName === m.entryA.name && m.entryA.players.length > 0) {
              m.entryA.players.forEach(p => winnerPlayers.push(p.name));
            } else if (m.winnerName === m.entryB.name && m.entryB.players.length > 0) {
              m.entryB.players.forEach(p => winnerPlayers.push(p.name));
            } else {
              m.winnerName.split(' & ').forEach(n => winnerPlayers.push(n.trim()));
            }

            winnerPlayers.forEach(pName => {
              if (!pName || pName.includes('BYE')) return;
              const key = pName.toLowerCase().trim();
              let entry = playerMap.get(key);
              if (!entry) {
                entry = {
                  playerId: `p-${key}`,
                  playerName: pName,
                  avatar: '🎯',
                  tuesdayWins: 0,
                  tuesdayPlayed: 0,
                  tuesdayPoints: 0,
                  tuesdayAvg: 0,
                  tuesdayHighOut: 0,
                  tuesdayHighIn: 0,
                  tuesday180s: 0,
                  tuesdayBulls: 0,
                  wednesdayWins: 0,
                  wednesdayPlayed: 0,
                  wednesdayPoints: 0,
                  wednesdayAvg: 0,
                  wednesdayHighOut: 0,
                  wednesdayHighIn: 0,
                  wednesday180s: 0,
                  wednesdayBulls: 0,
                  thursdayWins: 0,
                  thursdayPlayed: 0,
                  thursdayPoints: 0,
                  thursdayAvg: 0,
                  thursdayHighOut: 0,
                  thursdayHighIn: 0,
                  thursday180s: 0,
                  thursdayBulls: 0,
                  totalWins: 0,
                  totalPlayed: 0,
                  winPercentage: 0,
                  totalPoints: 0,
                  threeDartAvg: 0,
                  highCheckout: 0,
                  highOut: 0,
                  highIn: 0,
                  total180s: 0,
                  seasonBullsHit: 0,
                  tuesdayStats: undefined,
                  wednesdayStats: undefined,
                  thursdayStats: undefined,
                };
                playerMap.set(key, entry);
              }
            });
          }
        });
      }
    } catch (e) {
      console.error(`Error scanning brackets for ${fKey}`, e);
    }
  });

  // Ensure all players with Thursday game stats exist in playerMap
  Object.keys(thursdayGameStatsMap).forEach(key => {
    const tStat = thursdayGameStatsMap[key];
    const cleanKey = key.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
    let entry = playerMap.get(key) || (cleanKey ? playerMap.get(cleanKey) : undefined);
    if (!entry) {
      entry = {
        playerId: tStat.playerId || `p-${key}`,
        playerName: tStat.playerName || key,
        avatar: tStat.avatar || '🎯',
        tuesdayWins: 0, tuesdayPlayed: 0, tuesdayPoints: 0, tuesdayAvg: 0, tuesdayHighOut: 0, tuesdayHighIn: 0, tuesday180s: 0, tuesdayBulls: 0,
        wednesdayWins: 0, wednesdayPlayed: 0, wednesdayPoints: 0, wednesdayAvg: 0, wednesdayHighOut: 0, wednesdayHighIn: 0, wednesday180s: 0, wednesdayBulls: 0,
        thursdayWins: tStat.totalGameWins || 0, thursdayPlayed: tStat.totalGamesPlayed || 0, thursdayPoints: tStat.totalGameWins || 0, thursdayAvg: tStat.game501Avg || tStat.game301Avg || 0,
        thursdayHighOut: Math.max(tStat.game501HighFinish || 0, tStat.game301HighFinish || 0), thursdayHighIn: tStat.game301HighestBeginningScore || 0, thursday180s: 0,
        thursdayBulls: tStat.seasonBullsHit || 0,
        totalWins: 0, totalPlayed: 0, winPercentage: 0, totalPoints: 0, threeDartAvg: 0, highCheckout: 0, highOut: 0, highIn: 0, total180s: 0, seasonBullsHit: 0,
        tuesdayStats: undefined, wednesdayStats: undefined, thursdayStats: tStat,
      };
      playerMap.set(key, entry);
    } else {
      entry.thursdayBulls = Math.max(entry.thursdayBulls || 0, tStat.seasonBullsHit || 0);
    }
  });

  // 4. Calculate total wins, total games played, win percentage, and attach Wednesday/Tuesday/Thursday Game Stats
  const results: OverallLeaderboardEntry[] = [];
  playerMap.forEach(entry => {
    const key = entry.playerName.toLowerCase().trim();
    let wedStats = wednesdayGameStatsMap[key];
    let tuesStats = tuesdayGameStatsMap[key];
    let thursStats = thursdayGameStatsMap[key];

    const hasTues =
      entry.tuesdayPlayed > 0 ||
      entry.tuesdayWins > 0 ||
      (entry.tuesdayBulls || 0) > 0 ||
      (tuesStats && (
        (tuesStats.totalGamesPlayed || 0) > 0 ||
        (tuesStats.totalGameWins || 0) > 0 ||
        (tuesStats.points || 0) > 0 ||
        (tuesStats.seasonBullsHit || 0) > 0 ||
        (tuesStats.game501HighScore || 0) > 0 ||
        (tuesStats.game501Scores80Plus || 0) > 0 ||
        (tuesStats.game501HighFinish || 0) > 0 ||
        (tuesStats.game501Avg || 0) > 0 ||
        (tuesStats.game501Wins || 0) > 0 ||
        (tuesStats.cricketWins || 0) > 0 ||
        (tuesStats.game301HighestBeginningScore || 0) > 0 ||
        (tuesStats.game301HighScore || 0) > 0 ||
        (tuesStats.game301HighFinish || 0) > 0 ||
        (tuesStats.game301Wins || 0) > 0 ||
        (tuesStats.game301Avg || 0) > 0
      ));

    const hasWed =
      WEDNESDAY_OFFICIAL_PLAYERS.has(key) &&
      (entry.wednesdayPlayed > 0 ||
      entry.wednesdayWins > 0 ||
      (entry.wednesdayBulls || 0) > 0 ||
      (wedStats && (
        (wedStats.totalGamesPlayed || 0) > 0 ||
        (wedStats.totalGameWins || 0) > 0 ||
        (wedStats.points || 0) > 0 ||
        (wedStats.seasonBullsHit || 0) > 0 ||
        (wedStats.game1001HighScore || 0) > 0 ||
        (wedStats.game1001HighFinish || 0) > 0 ||
        (wedStats.game1001Scores80Plus || 0) > 0 ||
        (wedStats.game1001Wins || 0) > 0 ||
        (wedStats.game701HighestBeginningScore || 0) > 0 ||
        (wedStats.game701HighScore || 0) > 0 ||
        (wedStats.game701HighFinish || 0) > 0 ||
        (wedStats.game701Scores80Plus || 0) > 0 ||
        (wedStats.game701Wins || 0) > 0 ||
        (wedStats.baseballHighScore || 0) > 0 ||
        (wedStats.baseballWins || 0) > 0 ||
        (wedStats.fivesHighScore || 0) > 0 ||
        (wedStats.fivesHighFinish || 0) > 0 ||
        (wedStats.fivesWins || 0) > 0 ||
        (wedStats.cricketWins || 0) > 0
      )));

    const hasThurs =
      entry.thursdayPlayed > 0 ||
      entry.thursdayWins > 0 ||
      (entry.thursdayBulls || 0) > 0 ||
      (thursStats && (
        (thursStats.totalGamesPlayed || 0) > 0 ||
        (thursStats.totalGameWins || 0) > 0 ||
        (thursStats.points || 0) > 0 ||
        (thursStats.seasonBullsHit || 0) > 0 ||
        (thursStats.game501HighScore || 0) > 0 ||
        (thursStats.game501Scores80Plus || 0) > 0 ||
        (thursStats.game501HighFinish || 0) > 0 ||
        (thursStats.game501Avg || 0) > 0 ||
        (thursStats.game501Wins || 0) > 0 ||
        (thursStats.cricketWins || 0) > 0 ||
        (thursStats.game301HighestBeginningScore || 0) > 0 ||
        (thursStats.game301HighScore || 0) > 0 ||
        (thursStats.game301HighFinish || 0) > 0 ||
        (thursStats.game301Wins || 0) > 0 ||
        (thursStats.game301Avg || 0) > 0
      ));

    if (hasTues) {
      if (!tuesStats) {
        tuesStats = getOrCreateTuesdayPlayerStats(tuesdayGameStatsMap, entry.playerName, entry.playerId, entry.avatar);
      }
      entry.tuesdayStats = tuesStats;
      const tuesBullsMax = Math.max(entry.tuesdayBulls || 0, tuesStats.seasonBullsHit || 0);
      tuesStats.seasonBullsHit = tuesBullsMax;
      entry.tuesdayBulls = tuesBullsMax;
      if (tuesStats.game301HighestBeginningScore) {
        entry.tuesdayHighIn = Math.max(entry.tuesdayHighIn || 0, tuesStats.game301HighestBeginningScore);
      }
      const tuesMaxFin = Math.max(tuesStats.game501HighFinish || 0, tuesStats.game301HighFinish || 0);
      if (tuesMaxFin > 0) {
        entry.tuesdayHighOut = Math.max(entry.tuesdayHighOut || 0, tuesMaxFin);
      }
      if (tuesStats.totalGameWins > entry.tuesdayWins) {
        entry.tuesdayWins = tuesStats.totalGameWins;
      }
      if (tuesStats.totalGamesPlayed > entry.tuesdayPlayed) {
        entry.tuesdayPlayed = tuesStats.totalGamesPlayed;
      }
    } else {
      entry.tuesdayWins = 0;
      entry.tuesdayPlayed = 0;
      entry.tuesdayPoints = 0;
      entry.tuesdayAvg = 0;
      entry.tuesdayHighOut = 0;
      entry.tuesdayHighIn = 0;
      entry.tuesday180s = 0;
      entry.tuesdayBulls = 0;
      entry.tuesdayStats = undefined;
    }

    if (hasWed) {
      if (!wedStats) {
        wedStats = getOrCreateWednesdayPlayerStats(wednesdayGameStatsMap, entry.playerName, entry.playerId, entry.avatar);
      }
      entry.wednesdayStats = wedStats;
      const wedBullsMax = Math.max(entry.wednesdayBulls || 0, wedStats.seasonBullsHit || 0);
      wedStats.seasonBullsHit = wedBullsMax;
      entry.wednesdayBulls = wedBullsMax;
      if (wedStats.baseballHighScore) {
        entry.wednesdayBaseballHighScore = wedStats.baseballHighScore;
      }
      if (wedStats.game701HighestBeginningScore) {
        entry.wednesdayHighIn = Math.max(entry.wednesdayHighIn || 0, wedStats.game701HighestBeginningScore);
      }
      const wedMaxOut = Math.max(
        wedStats.game1001HighFinish || 0,
        wedStats.game701HighFinish || 0,
        wedStats.fivesHighFinish || 0
      );
      if (wedMaxOut > 0) {
        entry.wednesdayHighOut = Math.max(entry.wednesdayHighOut || 0, wedMaxOut);
      }
      if (wedStats.totalGameWins > entry.wednesdayWins) {
        entry.wednesdayWins = wedStats.totalGameWins;
      }
      if (wedStats.totalGamesPlayed > entry.wednesdayPlayed) {
        entry.wednesdayPlayed = wedStats.totalGamesPlayed;
      }
    } else {
      entry.wednesdayWins = 0;
      entry.wednesdayPlayed = 0;
      entry.wednesdayPoints = 0;
      entry.wednesdayAvg = 0;
      entry.wednesdayHighOut = 0;
      entry.wednesdayHighIn = 0;
      entry.wednesday180s = 0;
      entry.wednesdayBulls = 0;
      entry.wednesdayStats = undefined;
    }

    if (hasThurs) {
      // Official games begin this upcoming Thursday:
      // All Thursday league stats and bulls are strictly 0
      entry.thursdayWins = 0;
      entry.thursdayPlayed = 0;
      entry.thursdayPoints = 0;
      entry.thursdayAvg = 0;
      entry.thursdayHighOut = 0;
      entry.thursdayHighIn = 0;
      entry.thursday180s = 0;
      entry.thursdayBulls = 0;
      if (thursStats) {
        thursStats.seasonBullsHit = 0;
        thursStats.totalGamesPlayed = 0;
        thursStats.totalGameWins = 0;
        thursStats.points = 0;
        thursStats.game501Wins = 0;
        thursStats.game501Played = 0;
        thursStats.game501HighScore = 0;
        thursStats.game501HighFinish = 0;
        thursStats.game501Avg = 0;
        thursStats.cricketWins = 0;
        thursStats.cricketPlayed = 0;
        thursStats.game301Wins = 0;
        thursStats.game301Played = 0;
        thursStats.game301HighScore = 0;
        thursStats.game301HighFinish = 0;
        thursStats.game301HighestBeginningScore = 0;
        thursStats.game301Avg = 0;
      }
      entry.thursdayStats = thursStats;
    } else {
      entry.thursdayWins = 0;
      entry.thursdayPlayed = 0;
      entry.thursdayPoints = 0;
      entry.thursdayAvg = 0;
      entry.thursdayHighOut = 0;
      entry.thursdayHighIn = 0;
      entry.thursday180s = 0;
      entry.thursdayBulls = 0;
      entry.thursdayStats = undefined;
    }

    entry.tuesdayPoints = entry.tuesdayWins;
    entry.wednesdayPoints = entry.wednesdayWins;
    entry.thursdayPoints = entry.thursdayWins;
    entry.totalWins = entry.tuesdayWins + entry.wednesdayWins + entry.thursdayWins;
    entry.totalPoints = entry.totalWins;
    entry.totalPlayed = Math.max(
      entry.totalWins,
      entry.tuesdayPlayed + entry.wednesdayPlayed + entry.thursdayPlayed
    );
    entry.winPercentage =
      entry.totalPlayed > 0 ? Math.round((entry.totalWins / entry.totalPlayed) * 100) : 0;

    // Overall aggregate stats strictly across participated formats
    const playedAvgs: number[] = [];
    if (hasTues && entry.tuesdayAvg > 0) playedAvgs.push(entry.tuesdayAvg);
    if (hasWed && entry.wednesdayAvg > 0) playedAvgs.push(entry.wednesdayAvg);
    if (hasThurs && entry.thursdayAvg > 0) playedAvgs.push(entry.thursdayAvg);
    entry.threeDartAvg = playedAvgs.length > 0 ? Math.max(...playedAvgs) : 0;

    entry.highCheckout = Math.max(entry.tuesdayHighOut || 0, entry.wednesdayHighOut || 0, entry.thursdayHighOut || 0);
    entry.highOut = entry.highCheckout;
    entry.highIn = Math.max(entry.tuesdayHighIn || 0, entry.wednesdayHighIn || 0, entry.thursdayHighIn || 0);
    entry.total180s = (entry.tuesday180s || 0) + (entry.wednesday180s || 0) + (entry.thursday180s || 0);
    entry.seasonBullsHit = (entry.tuesdayBulls || 0) + (entry.wednesdayBulls || 0) + (entry.thursdayBulls || 0) || seasonBullsMap[key] || 0;

    results.push(entry);
  });

  // Sort descending by total wins, win percentage, total points, 3-dart average
  return results.sort(
    (a, b) =>
      b.totalWins - a.totalWins ||
      b.winPercentage - a.winPercentage ||
      b.totalPoints - a.totalPoints ||
      b.threeDartAvg - a.threeDartAvg
  );
};

export const getWednesdayGameStatsList = (): WednesdayPlayerGameStats[] => {
  repairTuesdayAndThursdayStats();
  const statsMap = getWednesdayGameStatsMap();

  // 1. Sync from Wednesday Individual Standings (kaboom_wednesday_standings)
  try {
    const savedWednesday = localStorage.getItem('kaboom_wednesday_standings');
    if (savedWednesday) {
      const standings: IndividualLeagueStanding[] = JSON.parse(savedWednesday);
      standings.forEach(s => {
        if ((s.gamesPlayed || 0) === 0 && (s.gamesWon || 0) === 0 && (!s.seasonBullsHit || s.seasonBullsHit === 0)) {
          return;
        }
        const pStats = getOrCreateWednesdayPlayerStats(statsMap, s.playerName, s.playerId);
        if (s.seasonBullsHit && s.seasonBullsHit > (pStats.seasonBullsHit || 0)) {
          pStats.seasonBullsHit = s.seasonBullsHit;
        }
        if (s.gamesWon > (pStats.totalGameWins || 0)) {
          pStats.totalGameWins = s.gamesWon;
        }
        if (s.gamesPlayed > (pStats.totalGamesPlayed || 0)) {
          pStats.totalGamesPlayed = s.gamesPlayed;
        }
      });
    }
  } catch (e) {
    console.error('Failed to sync Wednesday standings to stats list', e);
  }

  const list: WednesdayPlayerGameStats[] = Object.values(statsMap)
    .filter(entry => {
      const computedGameWins =
        (entry.game1001Wins || 0) +
        (entry.game701Wins || 0) +
        (entry.baseballWins || 0) +
        (entry.fivesWins || 0) +
        (entry.cricketWins || 0);
      const totalWins = computedGameWins;
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);
      return (
        totalPlayed > 0 ||
        totalWins > 0 ||
        (entry.seasonBullsHit || 0) > 0 ||
        (entry.game1001HighScore || 0) > 0 ||
        (entry.game701HighScore || 0) > 0 ||
        (entry.baseballHighScore || 0) > 0 ||
        (entry.fivesHighScore || 0) > 0 ||
        (entry.cricketWins || 0) > 0
      );
    })
    .map(entry => {
      const computedGameWins =
        (entry.game1001Wins || 0) +
        (entry.game701Wins || 0) +
        (entry.baseballWins || 0) +
        (entry.fivesWins || 0) +
        (entry.cricketWins || 0);

      const totalWins = computedGameWins;
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);

      return {
        ...entry,
        seasonBullsHit: entry.seasonBullsHit || 0,
        totalGameWins: totalWins,
        points: totalWins,
        totalGamesPlayed: totalPlayed,
      };
    });

  // Sort by Total Game Wins (Champion), then Bulls, then High Scores
  return list.sort(
    (a, b) =>
      b.totalGameWins - a.totalGameWins ||
      b.seasonBullsHit - a.seasonBullsHit ||
      b.game1001HighScore - a.game1001HighScore ||
      b.game701HighScore - a.game701HighScore ||
      b.baseballHighScore - a.baseballHighScore ||
      b.fivesHighScore - a.fivesHighScore
  );
};

export const getTuesdayGameStatsList = (): TuesdayPlayerGameStats[] => {
  repairTuesdayAndThursdayStats();
  const statsMap = getTuesdayGameStatsMap();

  // 1. Sync from Tuesday Standings (kaboom_tuesday_standings) if present
  try {
    const savedTuesday = localStorage.getItem('kaboom_tuesday_standings');
    if (savedTuesday) {
      const standings: IndividualLeagueStanding[] = JSON.parse(savedTuesday);
      standings.forEach((s) => {
        if ((s.gamesPlayed || 0) === 0 && (s.gamesWon || 0) === 0 && (!s.seasonBullsHit || s.seasonBullsHit === 0)) {
          return;
        }
        const pStats = getOrCreateTuesdayPlayerStats(statsMap, s.playerName, s.playerId);
        if (s.gamesWon > (pStats.totalGameWins || 0)) {
          pStats.totalGameWins = s.gamesWon;
        }
        if (s.gamesPlayed > (pStats.totalGamesPlayed || 0)) {
          pStats.totalGamesPlayed = s.gamesPlayed;
        }
        if (s.highCheckout && s.highCheckout > pStats.game501HighFinish) {
          pStats.game501HighFinish = s.highCheckout;
        }
        if (s.highIn && s.highIn > pStats.game301HighestBeginningScore) {
          pStats.game301HighestBeginningScore = s.highIn;
        }
        if (s.threeDartAvg && s.threeDartAvg > 0 && pStats.game501Avg === 0) {
          pStats.game501Avg = s.threeDartAvg;
        }
        if (s.seasonBullsHit && s.seasonBullsHit > (pStats.seasonBullsHit || 0)) {
          pStats.seasonBullsHit = s.seasonBullsHit;
        }
      });
    }
  } catch (e) {
    console.error('Failed to sync Tuesday standings to stats list', e);
  }

  const list: TuesdayPlayerGameStats[] = Object.values(statsMap)
    .filter((entry) => {
      const computedGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
      const totalWins = computedGameWins;
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);
      return (
        totalPlayed > 0 ||
        totalWins > 0 ||
        (entry.seasonBullsHit || 0) > 0 ||
        (entry.game501HighScore || 0) > 0 ||
        (entry.game501Scores80Plus || 0) > 0 ||
        (entry.game501HighFinish || 0) > 0 ||
        (entry.game501Avg || 0) > 0 ||
        (entry.game301HighestBeginningScore || 0) > 0 ||
        (entry.game301HighScore || 0) > 0 ||
        (entry.game301HighFinish || 0) > 0 ||
        (entry.game301Avg || 0) > 0 ||
        (entry.cricketWins || 0) > 0
      );
    })
    .map((entry) => {
      const computedGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
      const totalWins = computedGameWins;
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);

      return {
        ...entry,
        seasonBullsHit: entry.seasonBullsHit || 0,
        totalGameWins: totalWins,
        points: totalWins,
        totalGamesPlayed: totalPlayed,
      };
    });

  // Sort by Total Game Wins (Champion), then Bulls, then 501 High Score, 301 High Score, High Finishes, 501 Avg
  return list.sort(
    (a, b) =>
      b.totalGameWins - a.totalGameWins ||
      (b.seasonBullsHit || 0) - (a.seasonBullsHit || 0) ||
      b.game501HighScore - a.game501HighScore ||
      b.game301HighScore - a.game301HighScore ||
      b.game501HighFinish - a.game501HighFinish ||
      b.game301HighFinish - a.game301HighFinish ||
      b.game501Avg - a.game501Avg ||
      b.game301Avg - a.game301Avg
  );
};

export const getThursdayGameStatsList = (): ThursdayPlayerGameStats[] => {
  repairTuesdayAndThursdayStats();
  const statsMap = getThursdayGameStatsMap();

  // 1. Sync from Thursday Standings (kaboom_thursday_standings) if present
  try {
    const savedThursday = localStorage.getItem('kaboom_thursday_standings');
    if (savedThursday) {
      const standings: IndividualLeagueStanding[] = JSON.parse(savedThursday);
      standings.forEach((s) => {
        if ((s.gamesPlayed || 0) === 0 && (s.gamesWon || 0) === 0 && (!s.seasonBullsHit || s.seasonBullsHit === 0)) {
          return;
        }
        const pStats = getOrCreateThursdayPlayerStats(statsMap, s.playerName, s.playerId);
        if (s.gamesWon > (pStats.totalGameWins || 0)) {
          pStats.totalGameWins = s.gamesWon;
        }
        if (s.gamesPlayed > (pStats.totalGamesPlayed || 0)) {
          pStats.totalGamesPlayed = s.gamesPlayed;
        }
        if (s.highCheckout && s.highCheckout > pStats.game501HighFinish) {
          pStats.game501HighFinish = s.highCheckout;
        }
        if (s.highIn && s.highIn > pStats.game301HighestBeginningScore) {
          pStats.game301HighestBeginningScore = s.highIn;
        }
        if (s.threeDartAvg && s.threeDartAvg > 0 && pStats.game501Avg === 0) {
          pStats.game501Avg = s.threeDartAvg;
        }
        if (s.seasonBullsHit && s.seasonBullsHit > (pStats.seasonBullsHit || 0)) {
          pStats.seasonBullsHit = s.seasonBullsHit;
        }
      });
    }
  } catch (e) {
    console.error('Failed to sync Thursday standings to stats list', e);
  }

  const list: ThursdayPlayerGameStats[] = Object.values(statsMap)
    .filter(entry => {
      const computedGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
      const totalWins = Math.max(entry.totalGameWins || 0, computedGameWins);
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);
      return (
        totalPlayed > 0 ||
        totalWins > 0 ||
        (entry.seasonBullsHit || 0) > 0 ||
        (entry.game501HighScore || 0) > 0 ||
        (entry.game501Scores80Plus || 0) > 0 ||
        (entry.game501HighFinish || 0) > 0 ||
        (entry.game501Avg || 0) > 0 ||
        (entry.game301HighestBeginningScore || 0) > 0 ||
        (entry.game301HighScore || 0) > 0 ||
        (entry.game301HighFinish || 0) > 0 ||
        (entry.game301Avg || 0) > 0 ||
        (entry.cricketWins || 0) > 0
      );
    })
    .map((entry) => {
      const computedGameWins = (entry.game301Wins || 0) + (entry.cricketWins || 0) + (entry.game501Wins || 0);
      const totalWins = Math.max(entry.totalGameWins || 0, computedGameWins);
      const totalPlayed = Math.max(entry.totalGamesPlayed || 0, totalWins);

      return {
        ...entry,
        seasonBullsHit: entry.seasonBullsHit || 0,
        totalGameWins: totalWins,
        totalGamesPlayed: totalPlayed,
      };
    });

  // Sort by Total Game Wins (Champion), then Bulls, then 501 High Score, 301 High Score, High Finishes, 501 Avg
  return list.sort(
    (a, b) =>
      b.totalGameWins - a.totalGameWins ||
      (b.seasonBullsHit || 0) - (a.seasonBullsHit || 0) ||
      b.game501HighScore - a.game501HighScore ||
      b.game301HighScore - a.game301HighScore ||
      b.game501HighFinish - a.game501HighFinish ||
      b.game301HighFinish - a.game301HighFinish ||
      b.game501Avg - a.game501Avg ||
      b.game301Avg - a.game301Avg
  );
};

// Helper to calculate Thursday Doubles division distribution
export const calculateThursdayDivisions = (
  playerCount: number,
  chosenDivCount: number | 'auto'
): { numDivisions: number; sizes: number[]; isExactSplit: boolean; hasOddInAnyDiv: boolean } => {
  if (playerCount < 2) {
    return { numDivisions: 1, sizes: [playerCount], isExactSplit: true, hasOddInAnyDiv: playerCount % 2 !== 0 };
  }

  // Thursday League Divisions have up to 4 teams (8 Players) in a division.
  // All divisions are as equal as possible.
  let numDiv = 1;
  const minDiv = Math.max(1, Math.ceil(playerCount / 8));
  if (typeof chosenDivCount === 'number' && chosenDivCount >= 1) {
    numDiv = Math.max(minDiv, chosenDivCount);
  } else {
    numDiv = minDiv;
  }

  const baseSize = Math.floor(playerCount / numDiv);
  const remainder = playerCount % numDiv;
  const sizes: number[] = [];
  for (let i = 0; i < numDiv; i++) {
    sizes.push(baseSize + (i < remainder ? 1 : 0));
  }

  return {
    numDivisions: numDiv,
    sizes,
    isExactSplit: remainder === 0,
    hasOddInAnyDiv: sizes.some(s => s % 2 !== 0),
  };
};

// Helper to enforce maximum 4 matches per person (including byes) in each division for Tuesday and Thursday leagues only
export const enforceMaxFourMatchesPerPerson = (
  matchups: BracketMatchup[],
  leagueType?: 'tuesday' | 'wednesday' | 'thursday'
): BracketMatchup[] => {
  if (!Array.isArray(matchups) || matchups.length === 0) return [];
  const lType = leagueType || matchups[0]?.leagueType;
  if (lType !== 'tuesday' && lType !== 'thursday') {
    return matchups;
  }

  const teamMatchCounts: Record<string, number> = {};
  const personMatchCounts: Record<string, number> = {};

  const getPlayerKey = (p: { id?: string; name?: string }) => {
    return (p.id || p.name || '').toLowerCase().trim();
  };

  const isDummyPlayer = (p: { isDummy?: boolean; name?: string; id?: string }) => {
    if (p.isDummy) return true;
    const n = (p.name || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return n.includes('dummy') || id.includes('dummy');
  };

  const canParticipate = (entry: { name?: string; players?: any[] } | undefined): boolean => {
    if (!entry || !entry.name) return true;
    const nameUpper = entry.name.toUpperCase();
    if (nameUpper === 'BYE' || nameUpper.includes('BYE')) return true;

    if ((teamMatchCounts[entry.name] || 0) >= 4) return false;

    const realPlayers = Array.isArray(entry.players) ? entry.players.filter(p => !isDummyPlayer(p)) : [];
    if (realPlayers.length > 0) {
      for (const p of realPlayers) {
        const key = getPlayerKey(p);
        if (key && (personMatchCounts[key] || 0) >= 4) return false;
      }
    } else {
      const key = entry.name.toLowerCase().trim();
      if ((personMatchCounts[key] || 0) >= 4) return false;
    }
    return true;
  };

  const recordParticipation = (entry: { name?: string; players?: any[] } | undefined) => {
    if (!entry || !entry.name) return;
    const nameUpper = entry.name.toUpperCase();
    if (nameUpper === 'BYE' || nameUpper.includes('BYE')) return;

    teamMatchCounts[entry.name] = (teamMatchCounts[entry.name] || 0) + 1;

    const realPlayers = Array.isArray(entry.players) ? entry.players.filter(p => !isDummyPlayer(p)) : [];
    if (realPlayers.length > 0) {
      for (const p of realPlayers) {
        const key = getPlayerKey(p);
        if (key) {
          personMatchCounts[key] = (personMatchCounts[key] || 0) + 1;
        }
      }
    } else {
      const key = entry.name.toLowerCase().trim();
      personMatchCounts[key] = (personMatchCounts[key] || 0) + 1;
    }
  };

  const filtered: BracketMatchup[] = [];

  for (const m of matchups) {
    const isByeA = Boolean(
      m.isBye ||
      m.entryA?.name?.toUpperCase() === 'BYE' ||
      m.entryA?.name?.toUpperCase().includes('BYE')
    );
    const isByeB = Boolean(
      m.isBye ||
      m.entryB?.name?.toUpperCase() === 'BYE' ||
      m.entryB?.name?.toUpperCase().includes('BYE')
    );

    if (isByeA && isByeB) continue;

    if (!isByeA && !isByeB) {
      if (!canParticipate(m.entryA) || !canParticipate(m.entryB)) continue;
      recordParticipation(m.entryA);
      recordParticipation(m.entryB);
      filtered.push(m);
    } else if (!isByeA && isByeB) {
      if (!canParticipate(m.entryA)) continue;
      recordParticipation(m.entryA);
      filtered.push(m);
    } else if (isByeA && !isByeB) {
      if (!canParticipate(m.entryB)) continue;
      recordParticipation(m.entryB);
      filtered.push(m);
    }
  }

  return filtered;
};

// Helper to construct Full Round Robin Bracket Matchups with strict 4-match limit per person (including byes)
export const createRoundRobinMatchups = (
  entries: { id?: string; name: string; players: { id: string; name: string; avatar: string; isDummy?: boolean }[] }[],
  divName: string,
  lType: 'tuesday' | 'wednesday' | 'thursday',
  options?: {
    isSmallerDivision?: boolean;
    maxDivisionPlayerCount?: number;
    replayRoundOneWithDummy?: boolean;
  }
): BracketMatchup[] => {
  if (entries.length < 2) return [];

  const list: BracketMatchup[] = [];
  const realEntries = entries.filter((e) => e && !e.name.toUpperCase().includes('BYE'));
  if (realEntries.length < 2) {
    if (entries.length < 2) return [];
  }

  const teamMatchCounts: Record<string, number> = {};
  const personMatchCounts: Record<string, number> = {};
  let matchCounter = 1;

  const getPlayerKey = (p: { id?: string; name?: string }) => {
    return (p.id || p.name || '').toLowerCase().trim();
  };

  const isDummyPlayer = (p: { isDummy?: boolean; name?: string; id?: string }) => {
    if (p.isDummy) return true;
    const name = (p.name || '').toLowerCase();
    const id = (p.id || '').toLowerCase();
    return name.includes('dummy') || id.includes('dummy');
  };

  const canParticipate = (team: { name?: string; players?: any[] } | undefined): boolean => {
    if (!team || !team.name) return true;
    const isBye = team.name === 'BYE' || team.name.includes('BYE');
    if (isBye) return true;
    if ((teamMatchCounts[team.name] || 0) >= 4) return false;

    const realPlayers = Array.isArray(team.players) ? team.players.filter(p => !isDummyPlayer(p)) : [];
    if (realPlayers.length > 0) {
      for (const p of realPlayers) {
        const key = getPlayerKey(p);
        if (key && (personMatchCounts[key] || 0) >= 4) return false;
      }
    } else {
      const key = team.name.toLowerCase().trim();
      if ((personMatchCounts[key] || 0) >= 4) return false;
    }
    return true;
  };

  const recordParticipation = (team: { name?: string; players?: any[] } | undefined) => {
    if (!team || !team.name) return;
    const isBye = team.name === 'BYE' || team.name.includes('BYE');
    if (isBye) return;

    teamMatchCounts[team.name] = (teamMatchCounts[team.name] || 0) + 1;

    const realPlayers = Array.isArray(team.players) ? team.players.filter(p => !isDummyPlayer(p)) : [];
    if (realPlayers.length > 0) {
      for (const p of realPlayers) {
        const key = getPlayerKey(p);
        if (key) {
          personMatchCounts[key] = (personMatchCounts[key] || 0) + 1;
        }
      }
    } else {
      const key = team.name.toLowerCase().trim();
      personMatchCounts[key] = (personMatchCounts[key] || 0) + 1;
    }
  };

  // User Requirement:
  // "in odd divisions where there is less players then the ones with the greater amount of players,
  // have the players play round one again in their division, and have the one on a bye first round play the dummy
  // (an available player will play for the dummy but will not get stats while playing for the dummy).
  // This will allow all players in total to play an even amount of games.
  // To any player who does not play a dummy first would play a second match with same opponent
  // and also play other opponents in the round once excluding the Dummy,
  // The one playing the dummy first would play each opponent once as well.
  // In the current bracket the team with the dummy would have 7 rounds, and teams with none would have 6."
  //
  // USER REQUIREMENT UPDATE:
  // "In Thursday league, a person with a dummy is still counted as a normal team,
  // so they would not play duplicate rounds, since they are all evenly matched teams."
  // Therefore, odd-division equalizer and duplicate rounds strictly apply to Tuesday Singles,
  // whereas Thursday Doubles treats dummy teams as standard teams playing regular round robin (no duplicate rounds).
  const isTuesday = lType === 'tuesday';
  const isOddDivision = realEntries.length % 2 !== 0;
  const shouldEqualizeOddDivision = isTuesday && (
    options?.replayRoundOneWithDummy === true ||
    options?.isSmallerDivision === true ||
    (options?.maxDivisionPlayerCount !== undefined && realEntries.length < options.maxDivisionPlayerCount) ||
    isOddDivision ||
    realEntries.length === 2 ||
    realEntries.length === 3
  );

  // Case 1: Exactly 2 players/teams in a division (e.g. 2 players when larger division has 4 players)
  if (realEntries.length === 2 && shouldEqualizeOddDivision) {
    const teamA = realEntries[0];
    const teamB = realEntries[1];
    // Generate 3 head-to-head matches so both play 3 games (matching 4-player divisions)
    for (let m = 1; m <= 3; m++) {
      if (canParticipate(teamA) && canParticipate(teamB)) {
        recordParticipation(teamA);
        recordParticipation(teamB);
        list.push({
          id: `bm-${lType}-${divName.replace(/\s+/g, '')}-m${matchCounter++}`,
          leagueType: lType,
          division: divName,
          round: `Round Robin (${divName}) - Round ${m}${m > 1 ? ' (Head-to-Head Rematch)' : ''}`,
          entryA: { id: teamA.id || `e-${lType}-m${m}-0`, name: teamA.name, players: teamA.players },
          entryB: { id: teamB.id || `e-${lType}-m${m}-1`, name: teamB.name, players: teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          isReplayRound: m > 1,
        });
      }
    }
    return list;
  }

  // Case 2: Odd number of teams/players in a smaller division (e.g. 3, 5, 7 players/teams)
  if (isOddDivision && shouldEqualizeOddDivision) {
    // Add 1 BYE slot to make the pool even for standard Berger rotation
    const pool = [...realEntries, { id: `e-${lType}-bye-slot`, name: 'BYE', players: [] }];
    const numTeams = pool.length; // e.g. 4 for 3 entries, 6 for 5 entries
    const numRounds = numTeams - 1; // e.g. 3 rounds for 3 entries
    const half = numTeams / 2;

    let firstRoundByeTeam: typeof pool[0] | null = null;
    const round1RealPairs: { teamA: typeof pool[0]; teamB: typeof pool[0] }[] = [];

    for (let r = 0; r < numRounds; r++) {
      for (let i = 0; i < half; i++) {
        const teamAIdx = (r + i) % (numTeams - 1);
        let teamBIdx = (numTeams - 1 - i + r) % (numTeams - 1);
        if (i === 0) {
          teamBIdx = numTeams - 1; // The BYE slot
        }

        const teamA = pool[teamAIdx];
        const teamB = pool[teamBIdx];

        const isByeA = teamA.name === 'BYE' || teamA.name.includes('BYE');
        const isByeB = teamB.name === 'BYE' || teamB.name.includes('BYE');

        if (isByeA && isByeB) continue;

        if (r === 0) {
          // Round 1
          if (isByeA || isByeB) {
            // The one on a bye first round plays the dummy FIRST!
            const realTeam = isByeA ? teamB : teamA;
            firstRoundByeTeam = realTeam;
            if (canParticipate(realTeam)) {
              recordParticipation(realTeam);
              const dummyEntry = {
                id: `e-dummy-${divName.replace(/\s+/g, '')}`,
                name: '🤖 Dummy Player',
                players: [
                  {
                    id: `p-dummy-${divName.replace(/\s+/g, '')}`,
                    name: '🤖 Dummy Player',
                    avatar: '🤖',
                    isDummy: true,
                  },
                ],
              };
              list.push({
                id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r1-m${matchCounter++}`,
                leagueType: lType,
                division: divName,
                round: `Round Robin (${divName}) - Round 1 (Bye plays Dummy)`,
                entryA: { id: realTeam.id || `e-${lType}-r1-0`, name: realTeam.name, players: realTeam.players },
                entryB: dummyEntry,
                scoreA: 0,
                scoreB: 0,
                status: 'pending',
                isDummyOpponent: true,
              });
            }
          } else {
            // Real match in Round 1: players who did NOT play a dummy first
            if (canParticipate(teamA) && canParticipate(teamB)) {
              recordParticipation(teamA);
              recordParticipation(teamB);
              round1RealPairs.push({ teamA, teamB });
              list.push({
                id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r1-m${matchCounter++}`,
                leagueType: lType,
                division: divName,
                round: `Round Robin (${divName}) - Round 1`,
                entryA: { id: teamA.id || `e-${lType}-r1-${teamAIdx}`, name: teamA.name, players: teamA.players },
                entryB: { id: teamB.id || `e-${lType}-r1-${teamBIdx}`, name: teamB.name, players: teamB.players },
                scoreA: 0,
                scoreB: 0,
                status: 'pending',
              });
            }
          }
        } else {
          // Rounds 2 ... numRounds
          if (!isByeA && !isByeB) {
            // Real match between two real teams
            if (canParticipate(teamA) && canParticipate(teamB)) {
              recordParticipation(teamA);
              recordParticipation(teamB);
              list.push({
                id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${r + 1}-m${matchCounter++}`,
                leagueType: lType,
                division: divName,
                round: `Round Robin (${divName}) - Round ${r + 1}`,
                entryA: { id: teamA.id || `e-${lType}-r${r + 1}-${teamAIdx}`, name: teamA.name, players: teamA.players },
                entryB: { id: teamB.id || `e-${lType}-r${r + 1}-${teamBIdx}`, name: teamB.name, players: teamB.players },
                scoreA: 0,
                scoreB: 0,
                status: 'pending',
              });
            }
          } else {
            // Real team on a BYE in rounds 2+ sits out (excluding the dummy)
            const realTeam = isByeA ? teamB : teamA;
            const realIdx = isByeA ? teamBIdx : teamAIdx;
            list.push({
              id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${r + 1}-m${matchCounter++}`,
              leagueType: lType,
              division: divName,
              round: `Round Robin (${divName}) - Round ${r + 1}`,
              entryA: { id: realTeam.id || `e-${lType}-r${r + 1}-${realIdx}`, name: realTeam.name, players: realTeam.players },
              entryB: { id: `e-${lType}-bye`, name: 'BYE (Sitting Out)', players: [] },
              scoreA: 0,
              scoreB: 0,
              status: 'completed',
              isBye: true,
              winnerName: undefined,
            });
          }
        }
      }
    }

    // Equalizer Replay Round:
    // "To any player who does not play a dummy first would play a second match with same opponent
    // and also play other opponents in the round once excluding the Dummy,
    // The one playing the dummy first would play each opponent once as well."
    const replayRoundNum = numRounds + 1; // e.g. Round 4 for 3 teams

    // 1. Players who did NOT play a dummy first replay their Round 1 match
    for (const pair of round1RealPairs) {
      if (canParticipate(pair.teamA) && canParticipate(pair.teamB)) {
        recordParticipation(pair.teamA);
        recordParticipation(pair.teamB);
        list.push({
          id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${replayRoundNum}-m${matchCounter++}`,
          leagueType: lType,
          division: divName,
          round: `Round Robin (${divName}) - Round ${replayRoundNum} (Round 1 Replay)`,
          entryA: { id: pair.teamA.id || `e-${lType}-r${replayRoundNum}-0`, name: pair.teamA.name, players: pair.teamA.players },
          entryB: { id: pair.teamB.id || `e-${lType}-r${replayRoundNum}-1`, name: pair.teamB.name, players: pair.teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          isReplayRound: true,
        });
      }
    }

    // 2. The player who played the dummy first sits out on a BYE in this replay round
    // (since they already played Dummy in Round 1 and played all real opponents once)
    const byeTeam = firstRoundByeTeam || realEntries[0];
    if (byeTeam) {
      list.push({
        id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${replayRoundNum}-m${matchCounter++}`,
        leagueType: lType,
        division: divName,
        round: `Round Robin (${divName}) - Round ${replayRoundNum}`,
        entryA: { id: byeTeam.id || `e-${lType}-r${replayRoundNum}-bye`, name: byeTeam.name, players: byeTeam.players },
        entryB: { id: `e-${lType}-bye`, name: 'BYE (Sitting Out)', players: [] },
        scoreA: 0,
        scoreB: 0,
        status: 'completed',
        isBye: true,
        winnerName: undefined,
      });
    }

    return list;
  }

  // Case 3: Standard Round Robin (Even number of teams, or divisions not requiring odd equalizer)
  const pool = [...realEntries];
  if (pool.length % 2 !== 0) {
    pool.push({ name: 'BYE', players: [] });
  }

  const numTeams = pool.length;
  const numRounds = numTeams - 1;
  const half = numTeams / 2;

  for (let r = 0; r < numRounds; r++) {
    for (let i = 0; i < half; i++) {
      const teamAIdx = (r + i) % (numTeams - 1);
      let teamBIdx = (numTeams - 1 - i + r) % (numTeams - 1);

      if (i === 0) {
        teamBIdx = numTeams - 1;
      }

      const teamA = pool[teamAIdx];
      const teamB = pool[teamBIdx];

      const isByeA = teamA.name === 'BYE' || teamA.name.includes('BYE');
      const isByeB = teamB.name === 'BYE' || teamB.name.includes('BYE');

      if (isByeA && isByeB) continue;

      if (lType === 'tuesday' || lType === 'thursday') {
        if (!isByeA && !canParticipate(teamA)) continue;
        if (!isByeB && !canParticipate(teamB)) continue;
      }

      if (!isByeA && !isByeB) {
        if (lType === 'tuesday' || lType === 'thursday') {
          recordParticipation(teamA);
          recordParticipation(teamB);
        } else {
          teamMatchCounts[teamA.name] = (teamMatchCounts[teamA.name] || 0) + 1;
          teamMatchCounts[teamB.name] = (teamMatchCounts[teamB.name] || 0) + 1;
        }

        list.push({
          id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${r + 1}-m${matchCounter++}`,
          leagueType: lType,
          division: divName,
          round: lType === 'thursday' ? `Round Robin (${divName}) - Round ${r + 1}` : `Round Robin - Round ${r + 1}`,
          entryA: { id: `e-${lType}-${r}-${teamAIdx}`, name: teamA.name, players: teamA.players },
          entryB: { id: `e-${lType}-${r}-${teamBIdx}`, name: teamB.name, players: teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
        });
      } else if (!isByeA && isByeB) {
        if (lType === 'tuesday' || lType === 'thursday') {
          recordParticipation(teamA);
        }

        list.push({
          id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${r + 1}-m${matchCounter++}`,
          leagueType: lType,
          division: divName,
          round: lType === 'thursday' ? `Round Robin (${divName}) - Round ${r + 1}` : `Round Robin - Round ${r + 1}`,
          entryA: { id: `e-${lType}-${r}-${teamAIdx}`, name: teamA.name, players: teamA.players },
          entryB: { id: `e-${lType}-bye`, name: 'BYE (Sitting Out)', players: [] },
          scoreA: 0,
          scoreB: 0,
          status: 'completed',
          isBye: true,
          winnerName: undefined,
        });
      } else if (isByeA && !isByeB) {
        if (lType === 'tuesday' || lType === 'thursday') {
          recordParticipation(teamB);
        }

        list.push({
          id: `bm-${lType}-${divName.replace(/\s+/g, '')}-r${r + 1}-m${matchCounter++}`,
          leagueType: lType,
          division: divName,
          round: lType === 'thursday' ? `Round Robin (${divName}) - Round ${r + 1}` : `Round Robin - Round ${r + 1}`,
          entryA: { id: `e-${lType}-bye`, name: 'BYE (Sitting Out)', players: [] },
          entryB: { id: `e-${lType}-${r}-${teamBIdx}`, name: teamB.name, players: teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'completed',
          isBye: true,
          winnerName: undefined,
        });
      }
    }
  }

  return list;
};



