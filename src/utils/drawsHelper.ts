import {
  DrawsState,
  DrawType,
  DrawSpotEntry,
  DrawWheelSegment,
  DrawSessionRecord,
  SingleLeagueDrawsData,
  SingleDrawData,
} from '../types';
import { saveDrawsToCloud } from '../services/cloudSync';

export const DOOR_PRIZE_COST = 2.0;
export const LUCKY_NUMBER_COST = 3.0;
export const DOUBLE_DRAW_COST = 5.0;

export type DrawKey = 'doorPrize' | 'luckyNumber' | 'doubleDraw';
export type LeagueKey = 'tuesday' | 'wednesday' | 'thursday';

export const getDrawKey = (drawType: DrawType | string): DrawKey => {
  if (drawType === 'door_prize' || drawType === 'doorPrize') return 'doorPrize';
  if (drawType === 'lucky_number' || drawType === 'luckyNumber') return 'luckyNumber';
  if (drawType === 'double_draw' || drawType === 'doubleDraw') return 'doubleDraw';
  return 'doorPrize';
};

export const createDefaultLeagueDrawsData = (): SingleLeagueDrawsData => {
  const dp: SingleDrawData = {
    spots: [],
    runningTotalLeague: 0.0,
    history: [],
  };
  const ln: SingleDrawData = {
    spots: [],
    bucketTotal: 0.0,
    runningTotalLeague: 0.0,
    history: [],
  };
  const dd: SingleDrawData = {
    spots: [],
    bucketTotal: 0.0,
    runningTotalLeague: 0.0,
    history: [],
  };

  return {
    doorPrize: dp,
    luckyNumber: ln,
    doubleDraw: dd,
    door_prize: dp,
    lucky_number: ln,
    double_draw: dd,
  };
};

const DEFAULT_DRAWS_STATE: DrawsState = {
  isPublicViewable: true,
  selectedLeague: 'tuesday',
  leagues: {
    tuesday: createDefaultLeagueDrawsData(),
    wednesday: createDefaultLeagueDrawsData(),
    thursday: createDefaultLeagueDrawsData(),
  },
  doorPrize: { spots: [], runningTotalLeague: 0.0, history: [] },
  luckyNumber: { spots: [], bucketTotal: 0.0, runningTotalLeague: 0.0, history: [] },
  doubleDraw: { spots: [], bucketTotal: 0.0, runningTotalLeague: 0.0, history: [] },
  updatedAt: Date.now(),
};

const STORAGE_KEY = 'kaboom_draws_state';

// High-contrast vibrant casino / dartboard palette for slices
export const WHEEL_COLORS = [
  '#dc2626', // Red
  '#2563eb', // Blue
  '#16a34a', // Green
  '#d97706', // Amber
  '#9333ea', // Purple
  '#0891b2', // Cyan
  '#ea580c', // Orange
  '#db2777', // Pink
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#7c3aed', // Violet
  '#ca8a04', // Yellow
  '#0284c7', // Sky
  '#be123c', // Rose
  '#15803d', // Dark Green
  '#4338ca', // Dark Indigo
];

/**
 * Deduplicates and merges history records from dual-aliased draws state
 */
export const mergeDrawHistories = (h1: any, h2: any, defaultLeague?: LeagueKey): DrawSessionRecord[] => {
  const list1 = Array.isArray(h1) ? h1 : [];
  const list2 = Array.isArray(h2) ? h2 : [];
  const seen = new Set<string>();
  const combined: DrawSessionRecord[] = [];
  [...list1, ...list2].forEach((r) => {
    if (r && r.id && !seen.has(r.id)) {
      // STRICT SEPARATION: If defaultLeague is specified, do NOT accept records that explicitly belong to another league!
      if (defaultLeague && r.leagueType && r.leagueType !== defaultLeague) {
        return;
      }
      seen.add(r.id);
      const tagged = {
        ...r,
        leagueType: r.leagueType || defaultLeague,
      };
      combined.push(tagged);
    }
  });
  return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

/**
 * Sanitizes a single league's draws data structure with isolated buckets and history
 */
export const sanitizeSingleLeagueDraws = (raw: any, leagueKey?: LeagueKey): SingleLeagueDrawsData => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultLeagueDrawsData();
  }

  const dpRaw = raw.doorPrize || raw.door_prize || {};
  const lnRaw = raw.luckyNumber || raw.lucky_number || {};
  const ddRaw = raw.doubleDraw || raw.double_draw || {};

  const dpHistory = mergeDrawHistories(raw.doorPrize?.history, raw.door_prize?.history, leagueKey);
  const luckyHistory = mergeDrawHistories(raw.luckyNumber?.history, raw.lucky_number?.history, leagueKey);
  const doubleHistory = mergeDrawHistories(raw.doubleDraw?.history, raw.double_draw?.history, leagueKey);

  // Strictly filter spots so spots belonging to another league never leak in
  const filterSpots = (spots: any[]) =>
    (spots || []).filter((s: any) => !s.leagueType || s.leagueType === leagueKey).map((s: any) => ({ ...s, leagueType: leagueKey }));

  const dpSpots = filterSpots((Array.isArray(raw.doorPrize?.spots) && raw.doorPrize.spots.length > 0)
    ? raw.doorPrize.spots
    : (Array.isArray(raw.door_prize?.spots) ? raw.door_prize.spots : (dpRaw.spots || [])));

  const lnSpots = filterSpots((Array.isArray(raw.luckyNumber?.spots) && raw.luckyNumber.spots.length > 0)
    ? raw.luckyNumber.spots
    : (Array.isArray(raw.lucky_number?.spots) ? raw.lucky_number.spots : (lnRaw.spots || [])));

  const ddSpots = filterSpots((Array.isArray(raw.doubleDraw?.spots) && raw.doubleDraw.spots.length > 0)
    ? raw.doubleDraw.spots
    : (Array.isArray(raw.double_draw?.spots) ? raw.double_draw.spots : (ddRaw.spots || [])));

  // Preserve the league's isolated bucketTotal directly, without resetting to 0
  let lnBucket = typeof raw.luckyNumber?.bucketTotal === 'number'
    ? raw.luckyNumber.bucketTotal
    : (typeof raw.lucky_number?.bucketTotal === 'number' ? raw.lucky_number.bucketTotal : (lnRaw.bucketTotal || 0));
  lnBucket = Math.max(0, Math.round(lnBucket * 100) / 100);

  let ddBucket = typeof raw.doubleDraw?.bucketTotal === 'number'
    ? raw.doubleDraw.bucketTotal
    : (typeof raw.double_draw?.bucketTotal === 'number' ? raw.double_draw.bucketTotal : (ddRaw.bucketTotal || 0));
  ddBucket = Math.max(0, Math.round(ddBucket * 100) / 100);

  const dp: SingleDrawData = {
    ...dpRaw,
    spots: dpSpots,
    runningTotalLeague: typeof raw.doorPrize?.runningTotalLeague === 'number'
      ? raw.doorPrize.runningTotalLeague
      : (typeof raw.door_prize?.runningTotalLeague === 'number' ? raw.door_prize.runningTotalLeague : (dpRaw.runningTotalLeague || 0)),
    history: dpHistory,
  };

  const ln: SingleDrawData = {
    ...lnRaw,
    spots: lnSpots,
    bucketTotal: lnBucket,
    runningTotalLeague: typeof raw.luckyNumber?.runningTotalLeague === 'number'
      ? raw.luckyNumber.runningTotalLeague
      : (typeof raw.lucky_number?.runningTotalLeague === 'number' ? raw.lucky_number.runningTotalLeague : (lnRaw.runningTotalLeague || 0)),
    history: luckyHistory,
  };

  const dd: SingleDrawData = {
    ...ddRaw,
    spots: ddSpots,
    bucketTotal: ddBucket,
    runningTotalLeague: typeof raw.doubleDraw?.runningTotalLeague === 'number'
      ? raw.doubleDraw.runningTotalLeague
      : (typeof raw.double_draw?.runningTotalLeague === 'number' ? raw.double_draw.runningTotalLeague : (ddRaw.runningTotalLeague || 0)),
    history: doubleHistory,
  };

  return {
    doorPrize: dp,
    luckyNumber: ln,
    doubleDraw: dd,
    door_prize: dp,
    lucky_number: ln,
    double_draw: dd,
  };
};

/**
 * Loads the current draws state from localStorage or defaults, partitioned per league.
 */
export const getDrawsState = (leagueType?: LeagueKey): DrawsState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      let tuesdayData: SingleLeagueDrawsData;
      let wednesdayData: SingleLeagueDrawsData;
      let thursdayData: SingleLeagueDrawsData;

      if (parsed.leagues && typeof parsed.leagues === 'object') {
        tuesdayData = sanitizeSingleLeagueDraws(parsed.leagues.tuesday, 'tuesday');
        wednesdayData = sanitizeSingleLeagueDraws(parsed.leagues.wednesday, 'wednesday');
        thursdayData = sanitizeSingleLeagueDraws(parsed.leagues.thursday, 'thursday');
      } else {
        // Migration from legacy unpartitioned root state:
        // Check if root data has history records tagged by leagueType
        const rootDpHist = mergeDrawHistories(parsed.doorPrize?.history, parsed.door_prize?.history);
        const rootLnHist = mergeDrawHistories(parsed.luckyNumber?.history, parsed.lucky_number?.history);
        const rootDdHist = mergeDrawHistories(parsed.doubleDraw?.history, parsed.double_draw?.history);

        const hasTueHist = [...rootDpHist, ...rootLnHist, ...rootDdHist].some((r) => r.leagueType === 'tuesday');
        const hasThuHist = [...rootDpHist, ...rootLnHist, ...rootDdHist].some((r) => r.leagueType === 'thursday');

        if (hasTueHist || hasThuHist) {
          // Partition by tagged leagueType
          const filterHist = (list: DrawSessionRecord[], lk: LeagueKey) => list.filter((r) => (r.leagueType || 'wednesday') === lk);
          
          tuesdayData = sanitizeSingleLeagueDraws({
            doorPrize: { spots: [], runningTotalLeague: filterHist(rootDpHist, 'tuesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDpHist, 'tuesday') },
            luckyNumber: { spots: [], bucketTotal: 0, runningTotalLeague: filterHist(rootLnHist, 'tuesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootLnHist, 'tuesday') },
            doubleDraw: { spots: [], bucketTotal: 0, runningTotalLeague: filterHist(rootDdHist, 'tuesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDdHist, 'tuesday') },
          }, 'tuesday');

          wednesdayData = sanitizeSingleLeagueDraws({
            doorPrize: { spots: parsed.doorPrize?.spots || [], runningTotalLeague: filterHist(rootDpHist, 'wednesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDpHist, 'wednesday') },
            luckyNumber: { spots: parsed.luckyNumber?.spots || [], bucketTotal: parsed.luckyNumber?.bucketTotal || 0, runningTotalLeague: filterHist(rootLnHist, 'wednesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootLnHist, 'wednesday') },
            doubleDraw: { spots: parsed.doubleDraw?.spots || [], bucketTotal: parsed.doubleDraw?.bucketTotal || 0, runningTotalLeague: filterHist(rootDdHist, 'wednesday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDdHist, 'wednesday') },
          }, 'wednesday');

          thursdayData = sanitizeSingleLeagueDraws({
            doorPrize: { spots: [], runningTotalLeague: filterHist(rootDpHist, 'thursday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDpHist, 'thursday') },
            luckyNumber: { spots: [], bucketTotal: 0, runningTotalLeague: filterHist(rootLnHist, 'thursday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootLnHist, 'thursday') },
            doubleDraw: { spots: [], bucketTotal: 0, runningTotalLeague: filterHist(rootDdHist, 'thursday').reduce((s, r) => s + r.leagueShare, 0), history: filterHist(rootDdHist, 'thursday') },
          }, 'thursday');
        } else {
          // Default legacy root data to Wednesday (the primary league previously), start Tuesday & Thursday clean
          wednesdayData = sanitizeSingleLeagueDraws(parsed, 'wednesday');
          tuesdayData = createDefaultLeagueDrawsData();
          thursdayData = createDefaultLeagueDrawsData();
        }
      }

      const activeLeague: LeagueKey = leagueType || (parsed.selectedLeague as LeagueKey) || 'tuesday';
      const leaguesMap: Record<LeagueKey, SingleLeagueDrawsData> = {
        tuesday: tuesdayData,
        wednesday: wednesdayData,
        thursday: thursdayData,
      };

      const activeLeagueData = leaguesMap[activeLeague] || tuesdayData;

      const isViewable = typeof parsed.isPublicViewable === 'boolean'
        ? parsed.isPublicViewable
        : (typeof parsed.is_public_viewable === 'boolean' ? parsed.is_public_viewable : true);

      const res: DrawsState = {
        isPublicViewable: isViewable,
        selectedLeague: activeLeague,
        leagues: leaguesMap,
        doorPrize: activeLeagueData.doorPrize,
        luckyNumber: activeLeagueData.luckyNumber,
        doubleDraw: activeLeagueData.doubleDraw,
        door_prize: activeLeagueData.doorPrize,
        lucky_number: activeLeagueData.luckyNumber,
        double_draw: activeLeagueData.doubleDraw,
        updatedAt: parsed.updatedAt || Date.now(),
      };

      return res;
    }
  } catch (e) {
    console.error('Failed to parse draws state from localStorage', e);
  }

  const defTuesday = createDefaultLeagueDrawsData();
  const defWednesday = createDefaultLeagueDrawsData();
  const defThursday = createDefaultLeagueDrawsData();

  const active = leagueType || 'tuesday';
  const defMap: Record<LeagueKey, SingleLeagueDrawsData> = {
    tuesday: defTuesday,
    wednesday: defWednesday,
    thursday: defThursday,
  };
  const activeDef = defMap[active];

  return {
    isPublicViewable: true,
    selectedLeague: active,
    leagues: defMap,
    doorPrize: activeDef.doorPrize,
    luckyNumber: activeDef.luckyNumber,
    doubleDraw: activeDef.doubleDraw,
    door_prize: activeDef.doorPrize,
    lucky_number: activeDef.luckyNumber,
    double_draw: activeDef.doubleDraw,
    updatedAt: Date.now(),
  };
};

/**
 * Saves draws state locally, broadcasts update events, and syncs to backend server
 */
export const saveDrawsState = (state: DrawsState, activeLeague?: LeagueKey): DrawsState => {
  const currentSaved = getDrawsState();
  const currentLeagues = currentSaved.leagues || {
    tuesday: createDefaultLeagueDrawsData(),
    wednesday: createDefaultLeagueDrawsData(),
    thursday: createDefaultLeagueDrawsData(),
  };

  const resolvedLeague: LeagueKey = activeLeague || state.selectedLeague || currentSaved.selectedLeague || 'tuesday';

  // Ensure state.leagues is populated
  const inputLeagues = state.leagues || currentLeagues;
  const tueSan = sanitizeSingleLeagueDraws(inputLeagues.tuesday || currentLeagues.tuesday, 'tuesday');
  const wedSan = sanitizeSingleLeagueDraws(inputLeagues.wednesday || currentLeagues.wednesday, 'wednesday');
  const thuSan = sanitizeSingleLeagueDraws(inputLeagues.thursday || currentLeagues.thursday, 'thursday');

  const leaguesMap: Record<LeagueKey, SingleLeagueDrawsData> = {
    tuesday: tueSan,
    wednesday: wedSan,
    thursday: thuSan,
  };

  // ONLY if input state had NO leagues object at all (legacy payload), merge top-level into resolvedLeague
  if (!state.leagues && (state.doorPrize || state.luckyNumber || state.doubleDraw)) {
    const topData = sanitizeSingleLeagueDraws(state, resolvedLeague);
    leaguesMap[resolvedLeague] = topData;
  }

  const activeLeagueData = leaguesMap[resolvedLeague];

  const isViewable = typeof state.isPublicViewable === 'boolean'
    ? state.isPublicViewable
    : (typeof (state as any).is_public_viewable === 'boolean' ? (state as any).is_public_viewable : true);

  const updated: DrawsState = {
    isPublicViewable: isViewable,
    selectedLeague: resolvedLeague,
    leagues: leaguesMap,
    doorPrize: activeLeagueData.doorPrize,
    luckyNumber: activeLeagueData.luckyNumber,
    doubleDraw: activeLeagueData.doubleDraw,
    door_prize: activeLeagueData.doorPrize,
    lucky_number: activeLeagueData.luckyNumber,
    double_draw: activeLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: STORAGE_KEY, data: updated } }));
    window.dispatchEvent(new CustomEvent('storage', {}));
  } catch (e) {}

  // Background sync to server API
  try {
    fetch('/api/draws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
  } catch (e) {}

  // Background sync to Firestore
  try {
    saveDrawsToCloud(updated);
  } catch (e) {}

  return updated;
};

/**
 * Updates local storage with draws state from remote and broadcasts updates
 */
export const saveDrawsStateLocally = (state: any): DrawsState => {
  if (!state) return getDrawsState();

  let leaguesMap: Record<LeagueKey, SingleLeagueDrawsData>;

  if (state.leagues && typeof state.leagues === 'object') {
    leaguesMap = {
      tuesday: sanitizeSingleLeagueDraws(state.leagues.tuesday, 'tuesday'),
      wednesday: sanitizeSingleLeagueDraws(state.leagues.wednesday, 'wednesday'),
      thursday: sanitizeSingleLeagueDraws(state.leagues.thursday, 'thursday'),
    };
  } else {
    // Legacy single state from remote
    const legacySan = sanitizeSingleLeagueDraws(state, 'wednesday');
    leaguesMap = {
      tuesday: createDefaultLeagueDrawsData(),
      wednesday: legacySan,
      thursday: createDefaultLeagueDrawsData(),
    };
  }

  const resolvedLeague: LeagueKey = (state.selectedLeague as LeagueKey) || 'tuesday';
  const activeLeagueData = leaguesMap[resolvedLeague] || leaguesMap.tuesday;

  const isViewable = typeof state.isPublicViewable === 'boolean'
    ? state.isPublicViewable
    : (typeof state.is_public_viewable === 'boolean' ? state.is_public_viewable : true);

  const updated: DrawsState = {
    isPublicViewable: isViewable,
    selectedLeague: resolvedLeague,
    leagues: leaguesMap,
    doorPrize: activeLeagueData.doorPrize,
    luckyNumber: activeLeagueData.luckyNumber,
    doubleDraw: activeLeagueData.doubleDraw,
    door_prize: activeLeagueData.doorPrize,
    lucky_number: activeLeagueData.luckyNumber,
    double_draw: activeLeagueData.doubleDraw,
    updatedAt: state.updatedAt || Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: STORAGE_KEY, data: updated } }));
    window.dispatchEvent(new CustomEvent('storage', {}));
  } catch (e) {}

  return updated;
};

/**
 * Explicitly fetches current draws state from server REST endpoint
 */
export const fetchRemoteDrawsState = async (): Promise<DrawsState | null> => {
  try {
    const res = await fetch('/api/draws');
    if (res.ok) {
      const data = await res.json();
      if (data && data.draws) {
        return saveDrawsStateLocally(data.draws);
      }
    }
  } catch (e) {}
  return null;
};

/**
 * Toggles the public viewability of the Draws tab.
 */
export const setDrawsPublicViewable = (isViewable: boolean): DrawsState => {
  const current = getDrawsState();
  const updated: DrawsState = {
    ...current,
    isPublicViewable: isViewable,
    updatedAt: Date.now(),
  };
  return saveDrawsState(updated);
};

/**
 * Generates an evenly distributed wheel segment array for the canvas wheel.
 * Each purchased spot gives exactly 3 entries on the wheel.
 */
export const generateDistributedWheelSegments = (spots: DrawSpotEntry[]): DrawWheelSegment[] => {
  const paidSpots = spots.filter((s) => s.paid && s.spotsCount > 0);
  if (paidSpots.length === 0) return [];

  const rawEntries: { spotEntryId: string; playerId?: string; playerName: string; avatar?: string; occurrenceIndex: number }[] = [];
  paidSpots.forEach((spot) => {
    const totalWheelEntries = spot.spotsCount * 3;
    for (let i = 1; i <= totalWheelEntries; i++) {
      rawEntries.push({
        spotEntryId: spot.id,
        playerId: spot.playerId,
        playerName: spot.playerName,
        avatar: spot.avatar || '🎯',
        occurrenceIndex: i,
      });
    }
  });

  if (rawEntries.length === 0) return [];

  // Group by player name to disperse them
  const grouped: { [key: string]: typeof rawEntries } = {};
  rawEntries.forEach((entry) => {
    if (!grouped[entry.playerName]) grouped[entry.playerName] = [];
    grouped[entry.playerName].push(entry);
  });

  const players = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);
  const dispersed: typeof rawEntries = [];
  let added = true;
  let cycle = 0;

  while (added) {
    added = false;
    players.forEach((pName) => {
      const pEntries = grouped[pName];
      if (cycle < pEntries.length) {
        dispersed.push(pEntries[cycle]);
        added = true;
      }
    });
    cycle++;
  }

  // Assign distinct alternating colors
  const finalSlices: DrawWheelSegment[] = dispersed.map((item, index) => {
    const color = WHEEL_COLORS[index % WHEEL_COLORS.length];
    return {
      id: `${item.spotEntryId}-${item.occurrenceIndex}-${index}`,
      spotEntryId: item.spotEntryId,
      playerId: item.playerId,
      playerName: item.playerName,
      avatar: item.avatar,
      occurrenceIndex: item.occurrenceIndex,
      color,
    };
  });

  return finalSlices;
};

/**
 * Adds a spot entry for a player into ALL 3 DRAWS simultaneously for a specific league:
 * 1 spot in Door Prize ($2.00)
 * 1 spot in Lucky Number ($3.00)
 * 1 spot in Double Segment Draw ($5.00)
 * Total: $10.00 (multiplied by spotsCount)
 */
export const addSpotToAllDraws = (
  playerName: string,
  spotsCount: number = 1,
  playerId?: string,
  avatar: string = '🎯',
  paid: boolean = true,
  leagueType?: LeagueKey
): DrawsState => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const keys: ('doorPrize' | 'luckyNumber' | 'doubleDraw')[] = ['doorPrize', 'luckyNumber', 'doubleDraw'];
  const count = Math.max(1, spotsCount);

  const updatedLeagueData = { ...targetLeagueData };

  keys.forEach((key) => {
    const costPerSpot = key === 'doorPrize' ? DOOR_PRIZE_COST : key === 'luckyNumber' ? LUCKY_NUMBER_COST : DOUBLE_DRAW_COST;
    const currentSpots = (updatedLeagueData[key]?.spots || []) as DrawSpotEntry[];

    const existingIdx = currentSpots.findIndex(
      (s) => (playerId && s.playerId === playerId) || s.playerName.toLowerCase() === playerName.trim().toLowerCase()
    );

    let updatedSpots: DrawSpotEntry[];
    if (existingIdx >= 0) {
      updatedSpots = currentSpots.map((s, idx) => {
        if (idx === existingIdx) {
          const newCount = s.spotsCount + count;
          return {
            ...s,
            spotsCount: newCount,
            amountPaid: newCount * costPerSpot,
            paid: true,
            leagueType: targetLeague,
          };
        }
        return s;
      });
    } else {
      const newEntry: DrawSpotEntry = {
        id: `spot-${key}-${targetLeague}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        playerId,
        playerName: playerName.trim(),
        avatar: avatar || '🎯',
        spotsCount: count,
        paid,
        amountPaid: count * costPerSpot,
        timestamp: Date.now(),
        leagueType: targetLeague,
      };
      updatedSpots = [...currentSpots, newEntry];
    }

    updatedLeagueData[key] = {
      ...updatedLeagueData[key],
      spots: updatedSpots,
    };
  });

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  return saveDrawsState(updatedState, targetLeague);
};

/**
 * Adds a spot entry for a player in a specific draw (or all draws) for a specific league
 */
export const addDrawSpot = (
  drawType: DrawType | 'all',
  playerName: string,
  spotsCount: number = 1,
  playerId?: string,
  avatar: string = '🎯',
  paid: boolean = true,
  leagueType?: LeagueKey
): DrawsState => {
  if (drawType === 'all') {
    return addSpotToAllDraws(playerName, spotsCount, playerId, avatar, paid, leagueType);
  }

  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const targetKey = getDrawKey(drawType);
  const costPerSpot = targetKey === 'doorPrize' ? DOOR_PRIZE_COST : targetKey === 'luckyNumber' ? LUCKY_NUMBER_COST : DOUBLE_DRAW_COST;
  const count = Math.max(1, spotsCount);
  const amountPaid = count * costPerSpot;

  const newEntry: DrawSpotEntry = {
    id: `spot-${targetKey}-${targetLeague}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    playerId,
    playerName: playerName.trim(),
    avatar: avatar || '🎯',
    spotsCount: count,
    paid,
    amountPaid,
    timestamp: Date.now(),
    leagueType: targetLeague,
  };

  const currentSpots = (targetLeagueData[targetKey]?.spots || []) as DrawSpotEntry[];
  const existingIdx = currentSpots.findIndex(
    (s) => (playerId && s.playerId === playerId) || s.playerName.toLowerCase() === playerName.trim().toLowerCase()
  );

  let updatedSpots: DrawSpotEntry[];
  if (existingIdx >= 0) {
    updatedSpots = currentSpots.map((s, idx) => {
      if (idx === existingIdx) {
        const newCount = s.spotsCount + count;
        return {
          ...s,
          spotsCount: newCount,
          amountPaid: newCount * costPerSpot,
          paid: true,
          leagueType: targetLeague,
        };
      }
      return s;
    });
  } else {
    updatedSpots = [...currentSpots, newEntry];
  }

  const updatedTargetData = {
    ...targetLeagueData[targetKey],
    spots: updatedSpots,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    [targetKey]: updatedTargetData,
    [drawType]: updatedTargetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  return saveDrawsState(updatedState, targetLeague);
};

/**
 * Removes a spot entry from a draw for a specific league
 */
export const removeDrawSpot = (drawType: DrawType, spotId: string, leagueType?: LeagueKey): DrawsState => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const targetKey = getDrawKey(drawType);
  const currentSpots = (targetLeagueData[targetKey]?.spots || []) as DrawSpotEntry[];
  const updatedSpots = currentSpots.filter((s) => s.id !== spotId);

  const updatedTargetData = {
    ...targetLeagueData[targetKey],
    spots: updatedSpots,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    [targetKey]: updatedTargetData,
    [drawType]: updatedTargetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  return saveDrawsState(updatedState, targetLeague);
};

/**
 * Clears all spots in a draw (or across all draws) for a specific league
 */
export const clearDrawSpots = (drawType: DrawType | 'all', leagueType?: LeagueKey): DrawsState => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  let updatedLeagueData: SingleLeagueDrawsData;

  if (drawType === 'all') {
    const emptyDp = { ...targetLeagueData.doorPrize, spots: [] };
    const emptyLn = { ...targetLeagueData.luckyNumber, spots: [] };
    const emptyDd = { ...targetLeagueData.doubleDraw, spots: [] };

    updatedLeagueData = {
      ...targetLeagueData,
      doorPrize: emptyDp,
      luckyNumber: emptyLn,
      doubleDraw: emptyDd,
      door_prize: emptyDp,
      lucky_number: emptyLn,
      double_draw: emptyDd,
    };
  } else {
    const targetKey = getDrawKey(drawType);
    const updatedTargetData = {
      ...targetLeagueData[targetKey],
      spots: [],
    };
    updatedLeagueData = {
      ...targetLeagueData,
      [targetKey]: updatedTargetData,
      [drawType]: updatedTargetData,
    };
  }

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  return saveDrawsState(updatedState, targetLeague);
};

/**
 * 1. Completes a DOOR PRIZE Draw for a specific league:
 * - Spot cost: $2.00
 * - 50% goes to winning player
 * - 50% goes to running total for the league (impacting this league individually)
 * - Clears spots for next draw
 */
export const completeDoorPrizeDraw = (
  winnerName: string,
  winnerAvatar: string = '🎯',
  winnerPlayerId?: string,
  leagueType?: LeagueKey
): { success: boolean; record: DrawSessionRecord; state: DrawsState } => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const dpData = targetLeagueData.doorPrize;
  const spotsList = (Array.isArray(dpData.spots) && dpData.spots.length > 0) ? dpData.spots : [];
  const paidSpots = spotsList.filter((s: any) => s.paid);
  const totalSpots = paidSpots.reduce((sum: number, s: any) => sum + s.spotsCount, 0);
  const totalBroughtIn = totalSpots * DOOR_PRIZE_COST;
  const leagueShare = Math.round(totalBroughtIn * 0.5 * 100) / 100;
  const playerPrize = Math.round((totalBroughtIn - leagueShare) * 100) / 100;

  const dateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const record: DrawSessionRecord = {
    id: `dp-${targetLeague}-${Date.now()}`,
    drawType: 'door_prize',
    drawName: 'Door Prize ($2.00 Spot)',
    timestamp: Date.now(),
    dateStr: dateFormatted,
    costPerSpot: DOOR_PRIZE_COST,
    spotsSold: totalSpots,
    totalBroughtIn,
    leagueShare,
    playerPrizePaid: playerPrize,
    winnerPlayerName: winnerName,
    winnerAvatar,
    winnerPlayerId,
    leagueType: targetLeague,
  };

  const existingHistory = dpData.history || [];
  const newRunningTotal = (dpData.runningTotalLeague || 0) + leagueShare;
  const updatedHistory = [record, ...existingHistory];

  const targetData: SingleDrawData = {
    spots: [],
    runningTotalLeague: newRunningTotal,
    history: updatedHistory,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    doorPrize: targetData,
    door_prize: targetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  const savedState = saveDrawsState(updatedState, targetLeague);
  return { success: true, record, state: savedState };
};

/**
 * 2. Completes a LUCKY NUMBER Draw for a specific league:
 * - Spot cost: $3.00
 * - 50% goes to this league's running total (added to finances)
 * - Other 50% + previous bucket creates current session bucket for this league
 * - Hits dictate percentage won; remaining rolls over in this league's bucket
 */
export const completeLuckyNumberDraw = (
  winnerName: string,
  winnerAvatar: string = '🎯',
  targetNumber: number,
  dartHits: number,
  winnerPlayerId?: string,
  leagueType?: LeagueKey
): { success: boolean; record: DrawSessionRecord; state: DrawsState } => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const lnData = targetLeagueData.luckyNumber;
  const spotsList = (Array.isArray(lnData.spots) && lnData.spots.length > 0) ? lnData.spots : [];
  const paidSpots = spotsList.filter((s: any) => s.paid);
  const totalSpots = paidSpots.reduce((sum: number, s: any) => sum + s.spotsCount, 0);
  const totalBroughtIn = totalSpots * LUCKY_NUMBER_COST;
  const leagueShare = Math.round(totalBroughtIn * 0.5 * 100) / 100;
  const addedToBucket = totalBroughtIn - leagueShare;

  const previousBucket = lnData.bucketTotal || 0;
  const currentBucket = Math.round((previousBucket + addedToBucket) * 100) / 100;

  let hitPercentage = 0;
  let playerPrizePaid = 0;
  let bucketRemaining = currentBucket;

  const clampedHits = Math.min(3, Math.max(0, dartHits));
  if (clampedHits === 1) {
    hitPercentage = 33;
    playerPrizePaid = Math.round(currentBucket * 0.33 * 100) / 100;
    bucketRemaining = Math.max(0, Math.round((currentBucket - playerPrizePaid) * 100) / 100);
  } else if (clampedHits === 2) {
    hitPercentage = 66;
    playerPrizePaid = Math.round(currentBucket * 0.66 * 100) / 100;
    bucketRemaining = Math.max(0, Math.round((currentBucket - playerPrizePaid) * 100) / 100);
  } else if (clampedHits === 3) {
    hitPercentage = 100;
    playerPrizePaid = currentBucket;
    bucketRemaining = 0.0;
  } else {
    hitPercentage = 0;
    playerPrizePaid = 0;
    bucketRemaining = currentBucket;
  }

  const dateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const record: DrawSessionRecord = {
    id: `ln-${targetLeague}-${Date.now()}`,
    drawType: 'lucky_number',
    drawName: 'Lucky Number ($3.00 Spot)',
    timestamp: Date.now(),
    dateStr: dateFormatted,
    costPerSpot: LUCKY_NUMBER_COST,
    spotsSold: totalSpots,
    totalBroughtIn,
    leagueShare,
    playerPrizePaid,
    winnerPlayerName: winnerName,
    winnerAvatar,
    winnerPlayerId,
    leagueType: targetLeague,
    luckyTargetNumber: targetNumber,
    dartHits: clampedHits,
    hitPercentage,
    bucketBeforeDraw: currentBucket,
    bucketRemainingRollover: bucketRemaining,
    addedToBucket,
    note: `${clampedHits}/3 darts hit Target ${targetNumber === 21 ? 'Bullseye' : targetNumber} (${hitPercentage}% payout)`,
  };

  const existingHistory = lnData.history || [];
  const newRunningTotalLeague = (lnData.runningTotalLeague || 0) + leagueShare;
  const updatedHistory = [record, ...existingHistory];

  const targetData: SingleDrawData = {
    spots: [],
    bucketTotal: bucketRemaining,
    runningTotalLeague: newRunningTotalLeague,
    history: updatedHistory,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    luckyNumber: targetData,
    lucky_number: targetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  const savedState = saveDrawsState(updatedState, targetLeague);
  return { success: true, record, state: savedState };
};

/**
 * 3. Completes a DOUBLE SEGMENT Draw for a specific league:
 * - Spot cost: $5.00
 * - 50% goes to league running total
 * - 50% goes in progressive bucket for this league
 * - Double hit wins 100% of bucket; miss rolls over
 */
export const completeDoubleDraw = (
  winnerName: string,
  winnerAvatar: string = '🎯',
  doubleTargetNumber: number,
  doubleHit: boolean,
  winnerPlayerId?: string,
  leagueType?: LeagueKey
): { success: boolean; record: DrawSessionRecord; state: DrawsState } => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const ddData = targetLeagueData.doubleDraw;
  const spotsList = (Array.isArray(ddData.spots) && ddData.spots.length > 0) ? ddData.spots : [];
  const paidSpots = spotsList.filter((s: any) => s.paid);
  const totalSpots = paidSpots.reduce((sum: number, s: any) => sum + s.spotsCount, 0);
  const totalBroughtIn = totalSpots * DOUBLE_DRAW_COST;
  const leagueShare = Math.round(totalBroughtIn * 0.5 * 100) / 100;
  const addedToBucket = totalBroughtIn - leagueShare;

  const previousBucket = ddData.bucketTotal || 0;
  const currentBucket = Math.round((previousBucket + addedToBucket) * 100) / 100;

  let playerPrizePaid = 0;
  let bucketRemaining = currentBucket;

  if (doubleHit) {
    playerPrizePaid = currentBucket;
    bucketRemaining = 0.0;
  } else {
    playerPrizePaid = 0.0;
    bucketRemaining = currentBucket;
  }

  const dateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const targetLabel = doubleTargetNumber === 21 ? 'Double Bull (D-Bull)' : `Double ${doubleTargetNumber} (D${doubleTargetNumber})`;

  const record: DrawSessionRecord = {
    id: `dd-${targetLeague}-${Date.now()}`,
    drawType: 'double_draw',
    drawName: 'Mystery Double ($5.00 Spot)',
    timestamp: Date.now(),
    dateStr: dateFormatted,
    costPerSpot: DOUBLE_DRAW_COST,
    spotsSold: totalSpots,
    totalBroughtIn,
    leagueShare,
    playerPrizePaid,
    winnerPlayerName: winnerName,
    winnerAvatar,
    winnerPlayerId,
    leagueType: targetLeague,
    doubleTargetNumber,
    doubleHit,
    bucketBeforeDraw: currentBucket,
    bucketRemainingRollover: bucketRemaining,
    addedToBucket,
    note: doubleHit
      ? `HIT ${targetLabel}! Won 100% Full Bucket!`
      : `Missed ${targetLabel}. Bucket $${bucketRemaining.toFixed(2)} rolls over.`,
  };

  const existingHistory = ddData.history || [];
  const newRunningTotalLeague = (ddData.runningTotalLeague || 0) + leagueShare;
  const updatedHistory = [record, ...existingHistory];

  const targetData: SingleDrawData = {
    spots: [],
    bucketTotal: bucketRemaining,
    runningTotalLeague: newRunningTotalLeague,
    history: updatedHistory,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    doubleDraw: targetData,
    double_draw: targetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  const savedState = saveDrawsState(updatedState, targetLeague);
  return { success: true, record, state: savedState };
};

/**
 * Calculates financial summary for a single league or across all leagues.
 */
export const getDrawsFinanceSummary = (leagueType?: LeagueKey | 'all') => {
  const state = getDrawsState();
  const leagues = state.leagues || {
    tuesday: createDefaultLeagueDrawsData(),
    wednesday: createDefaultLeagueDrawsData(),
    thursday: createDefaultLeagueDrawsData(),
  };

  const calcLeague = (lk: LeagueKey) => {
    const lData = leagues[lk] || createDefaultLeagueDrawsData();

    const dpSpots = (lData.doorPrize?.spots || []).filter((s: any) => s.paid && s.spotsCount > 0);
    const dpSpotsCount = dpSpots.reduce((sum: number, s: any) => sum + (s.spotsCount || 0), 0);
    const dpActiveGross = dpSpotsCount * DOOR_PRIZE_COST;
    const dpActiveLeagueShare = Math.round(dpActiveGross * 0.5 * 100) / 100;
    const dpActivePrizePool = dpActiveGross - dpActiveLeagueShare;

    const lnSpots = (lData.luckyNumber?.spots || []).filter((s: any) => s.paid && s.spotsCount > 0);
    const lnSpotsCount = lnSpots.reduce((sum: number, s: any) => sum + (s.spotsCount || 0), 0);
    const lnActiveGross = lnSpotsCount * LUCKY_NUMBER_COST;
    const lnActiveLeagueShare = Math.round(lnActiveGross * 0.5 * 100) / 100;
    const lnActiveBucketShare = lnActiveGross - lnActiveLeagueShare;

    const ddSpots = (lData.doubleDraw?.spots || []).filter((s: any) => s.paid && s.spotsCount > 0);
    const ddSpotsCount = ddSpots.reduce((sum: number, s: any) => sum + (s.spotsCount || 0), 0);
    const ddActiveGross = ddSpotsCount * DOUBLE_DRAW_COST;
    const ddActiveLeagueShare = Math.round(ddActiveGross * 0.5 * 100) / 100;
    const ddActiveBucketShare = ddActiveGross - ddActiveLeagueShare;

    const doorPrizeCompletedLeague = lData.doorPrize?.runningTotalLeague || 0.0;
    const luckyNumberCompletedLeague = lData.luckyNumber?.runningTotalLeague || 0.0;
    const doubleDrawCompletedLeague = lData.doubleDraw?.runningTotalLeague || 0.0;

    const doorPrizeLeagueShare = Math.round((doorPrizeCompletedLeague + dpActiveLeagueShare) * 100) / 100;
    const luckyNumberLeagueShare = Math.round((luckyNumberCompletedLeague + lnActiveLeagueShare) * 100) / 100;
    const doubleDrawLeagueShare = Math.round((doubleDrawCompletedLeague + ddActiveLeagueShare) * 100) / 100;
    const totalDrawsLeagueShare = Math.round((doorPrizeLeagueShare + luckyNumberLeagueShare + doubleDrawLeagueShare) * 100) / 100;

    const luckyBucketRollover = lData.luckyNumber?.bucketTotal || 0.0;
    const luckyBucketCurrent = Math.round((luckyBucketRollover + lnActiveBucketShare) * 100) / 100;

    const doubleBucketRollover = lData.doubleDraw?.bucketTotal || 0.0;
    const doubleBucketCurrent = Math.round((doubleBucketRollover + ddActiveBucketShare) * 100) / 100;

    const lkHistory: DrawSessionRecord[] = [
      ...(lData.doorPrize?.history || []),
      ...(lData.luckyNumber?.history || []),
      ...(lData.doubleDraw?.history || []),
    ].sort((a, b) => b.timestamp - a.timestamp);

    const totalPrizePaidToPlayers = lkHistory.reduce((sum, r) => sum + r.playerPrizePaid, 0);
    const totalGrossDrawsBroughtIn = lkHistory.reduce((sum, r) => sum + r.totalBroughtIn, 0) + dpActiveGross + lnActiveGross + ddActiveGross;

    return {
      league: lk,
      totalDrawsLeagueShare,
      doorPrizeLeagueShare,
      luckyNumberLeagueShare,
      doubleDrawLeagueShare,
      luckyLeagueShare: luckyNumberLeagueShare,
      doubleLeagueShare: doubleDrawLeagueShare,
      luckyBucketCurrent,
      doubleBucketCurrent,
      luckyBucketRollover,
      doubleBucketRollover,
      doorPrizeActivePrizePool: dpActivePrizePool,
      luckyActiveBucketShare: lnActiveBucketShare,
      doubleActiveBucketShare: ddActiveBucketShare,
      allHistory: lkHistory,
      totalPrizePaidToPlayers,
      totalGrossDrawsBroughtIn,
      totalDrawSessions: lkHistory.length,
      isPublicViewable: state.isPublicViewable,
    };
  };

  const tueSummary = calcLeague('tuesday');
  const wedSummary = calcLeague('wednesday');
  const thuSummary = calcLeague('thursday');

  if (leagueType === 'tuesday') return tueSummary;
  if (leagueType === 'wednesday') return wedSummary;
  if (leagueType === 'thursday') return thuSummary;

  // 'all' or overall summary
  const grandTotalDrawsLeagueShare = Math.round((tueSummary.totalDrawsLeagueShare + wedSummary.totalDrawsLeagueShare + thuSummary.totalDrawsLeagueShare) * 100) / 100;
  const grandDoorPrizeLeagueShare = Math.round((tueSummary.doorPrizeLeagueShare + wedSummary.doorPrizeLeagueShare + thuSummary.doorPrizeLeagueShare) * 100) / 100;
  const grandLuckyNumberLeagueShare = Math.round((tueSummary.luckyNumberLeagueShare + wedSummary.luckyNumberLeagueShare + thuSummary.luckyNumberLeagueShare) * 100) / 100;
  const grandDoubleDrawLeagueShare = Math.round((tueSummary.doubleDrawLeagueShare + wedSummary.doubleDrawLeagueShare + thuSummary.doubleDrawLeagueShare) * 100) / 100;

  const allHistory = [
    ...tueSummary.allHistory,
    ...wedSummary.allHistory,
    ...thuSummary.allHistory,
  ].sort((a, b) => b.timestamp - a.timestamp);

  const activeLeague = state.selectedLeague || 'tuesday';
  const activeSummary = activeLeague === 'wednesday' ? wedSummary : activeLeague === 'thursday' ? thuSummary : tueSummary;

  return {
    totalDrawsLeagueShare: grandTotalDrawsLeagueShare,
    doorPrizeLeagueShare: grandDoorPrizeLeagueShare,
    luckyNumberLeagueShare: grandLuckyNumberLeagueShare,
    doubleDrawLeagueShare: grandDoubleDrawLeagueShare,
    luckyLeagueShare: grandLuckyNumberLeagueShare,
    doubleLeagueShare: grandDoubleDrawLeagueShare,
    // Per-league breakdowns
    tuesday: tueSummary,
    wednesday: wedSummary,
    thursday: thuSummary,
    // Current active league's buckets & active session pools
    luckyBucketCurrent: activeSummary.luckyBucketCurrent,
    doubleBucketCurrent: activeSummary.doubleBucketCurrent,
    luckyBucketRollover: activeSummary.luckyBucketRollover,
    doubleBucketRollover: activeSummary.doubleBucketRollover,
    doorPrizeActivePrizePool: activeSummary.doorPrizeActivePrizePool,
    luckyActiveBucketShare: activeSummary.luckyActiveBucketShare,
    doubleActiveBucketShare: activeSummary.doubleActiveBucketShare,
    allHistory,
    totalPrizePaidToPlayers: tueSummary.totalPrizePaidToPlayers + wedSummary.totalPrizePaidToPlayers + thuSummary.totalPrizePaidToPlayers,
    totalGrossDrawsBroughtIn: tueSummary.totalGrossDrawsBroughtIn + wedSummary.totalGrossDrawsBroughtIn + thuSummary.totalGrossDrawsBroughtIn,
    totalDrawSessions: allHistory.length,
    isPublicViewable: state.isPublicViewable,
  };
};

/**
 * Deletes a completed draw transaction from history and reverses balances for that specific league
 */
export const deleteDrawHistoryRecord = (
  recordId: string,
  drawType?: DrawType,
  leagueType?: LeagueKey
): {
  success: boolean;
  state: DrawsState;
  deletedRecord?: DrawSessionRecord;
  bucketDeducted?: number;
  newBucketTotal?: number;
} => {
  const current = getDrawsState(leagueType);
  const leagues = current.leagues || {
    tuesday: createDefaultLeagueDrawsData(),
    wednesday: createDefaultLeagueDrawsData(),
    thursday: createDefaultLeagueDrawsData(),
  };

  let resolvedLeague: LeagueKey | undefined = leagueType;
  let resolvedDrawKey: DrawKey = 'doorPrize';
  let resolvedDrawType: DrawType = 'door_prize';
  let recordToDelete: DrawSessionRecord | undefined = undefined;

  const leagueKeys: LeagueKey[] = leagueType ? [leagueType] : ['tuesday', 'wednesday', 'thursday'];
  const drawKeys: { key: DrawKey; type: DrawType }[] = drawType
    ? [{ key: getDrawKey(drawType), type: drawType }]
    : [
        { key: 'doorPrize', type: 'door_prize' },
        { key: 'luckyNumber', type: 'lucky_number' },
        { key: 'doubleDraw', type: 'double_draw' },
      ];

  for (const lk of leagueKeys) {
    const lData = leagues[lk];
    if (!lData) continue;
    for (const d of drawKeys) {
      const found = lData[d.key]?.history?.find((r) => r.id === recordId);
      if (found) {
        resolvedLeague = lk;
        resolvedDrawKey = d.key;
        resolvedDrawType = d.type;
        recordToDelete = found;
        break;
      }
    }
    if (recordToDelete) break;
  }

  if (!recordToDelete || !resolvedLeague) {
    return { success: false, state: current };
  }

  const targetLeagueData = leagues[resolvedLeague];
  const targetDrawData = targetLeagueData[resolvedDrawKey];
  const updatedHistory = (targetDrawData.history || []).filter((r) => r.id !== recordId);
  const leagueShareDeduction = Number(recordToDelete.leagueShare) || 0;
  let newRunningTotalLeague = Math.max(
    0,
    Math.round(((targetDrawData.runningTotalLeague || 0) - leagueShareDeduction) * 100) / 100
  );

  const updatedTargetDrawData: SingleDrawData = {
    ...targetDrawData,
    history: updatedHistory,
    runningTotalLeague: newRunningTotalLeague,
  };

  let bucketDeducted = 0;
  let finalBucketTotal: number | undefined = undefined;

  if (
    resolvedDrawKey === 'luckyNumber' ||
    resolvedDrawKey === 'doubleDraw' ||
    typeof targetDrawData.bucketTotal === 'number'
  ) {
    const currentBucketTotal = Number(targetDrawData.bucketTotal) || 0;
    const addedToBucket = typeof recordToDelete.addedToBucket === 'number'
      ? Math.max(0, recordToDelete.addedToBucket)
      : Math.max(
          0,
          Math.round(
            ((Number(recordToDelete.totalBroughtIn) || 0) -
              (Number(recordToDelete.leagueShare) || 0)) *
              100
          ) / 100
        );
    const prizePaidOut = Math.max(0, Number(recordToDelete.playerPrizePaid) || 0);

    let calculatedBucket = Math.max(
      0,
      Math.round((currentBucketTotal - addedToBucket + prizePaidOut) * 100) / 100
    );

    if (updatedHistory.length === 0) {
      calculatedBucket = 0.0;
      newRunningTotalLeague = 0.0;
      updatedTargetDrawData.runningTotalLeague = 0.0;
    }

    bucketDeducted = addedToBucket;
    finalBucketTotal = calculatedBucket;
    updatedTargetDrawData.bucketTotal = calculatedBucket;
  }

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    [resolvedDrawKey]: updatedTargetDrawData,
    [resolvedDrawType]: updatedTargetDrawData,
  };

  const updatedLeagues = {
    ...leagues,
    [resolvedLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: resolvedLeague,
    leagues: updatedLeagues,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  const savedState = saveDrawsState(updatedState, resolvedLeague);
  return {
    success: true,
    state: savedState,
    deletedRecord: recordToDelete,
    bucketDeducted,
    newBucketTotal: finalBucketTotal,
  };
};

/**
 * Admin helper to adjust or reset a progressive draw bucket total directly for a specific league
 */
export const updateDrawBucketTotal = (drawType: DrawType, newAmount: number, leagueType?: LeagueKey): DrawsState => {
  const current = getDrawsState(leagueType);
  const targetLeague: LeagueKey = leagueType || current.selectedLeague || 'tuesday';
  const targetLeagueData = current.leagues?.[targetLeague] || createDefaultLeagueDrawsData();

  const targetKey = getDrawKey(drawType);
  const targetData = targetLeagueData[targetKey] || { spots: [], runningTotalLeague: 0, history: [] };
  const sanitizedAmount = Math.max(0, Math.round(Number(newAmount) * 100) / 100);

  const updatedTargetData: SingleDrawData = {
    ...targetData,
    bucketTotal: sanitizedAmount,
  };

  const updatedLeagueData: SingleLeagueDrawsData = {
    ...targetLeagueData,
    [targetKey]: updatedTargetData,
    [drawType]: updatedTargetData,
  };

  const updatedLeagues = {
    ...current.leagues,
    [targetLeague]: updatedLeagueData,
  };

  const updatedState: DrawsState = {
    ...current,
    selectedLeague: targetLeague,
    leagues: updatedLeagues as any,
    doorPrize: updatedLeagueData.doorPrize,
    luckyNumber: updatedLeagueData.luckyNumber,
    doubleDraw: updatedLeagueData.doubleDraw,
    door_prize: updatedLeagueData.doorPrize,
    lucky_number: updatedLeagueData.luckyNumber,
    double_draw: updatedLeagueData.doubleDraw,
    updatedAt: Date.now(),
  };

  return saveDrawsState(updatedState, targetLeague);
};
