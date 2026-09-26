import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  MatchState,
  IndividualLeagueStanding,
  TuesdayPlayerGameStats,
  WednesdayPlayerGameStats,
  ThursdayPlayerGameStats,
  Player,
  LeagueFinanceType,
  LeaguePlayerFinance,
  DailyFeeSessionLog,
} from '../types';
import {
  safeMergeFinancePlayers,
  safeMergeSessionLogs,
  getDeletedPaymentIds,
  getDeletedSessionIds,
  recordDeletedPaymentId,
  recordDeletedSessionId,
} from '../utils/financeHelper';

export interface CloudMatchDocument {
  matchCode: string;
  boardNumber?: number;
  matchState: MatchState;
  updatedAt: any;
  status: 'active' | 'completed';
  leagueType?: 'tuesday' | 'wednesday' | 'thursday' | 'none';
}

/**
 * QUOTA & WRITE DEDUPLICATION LAYER
 * Prevents duplicate writes, feedback loops, and resource exhaustion
 */
const dataFingerprintCache = new Map<string, string>();
const writeDebounceTimers = new Map<string, any>();

// Check localStorage for persisted quota cooloff
function getInitialQuotaCooloff(): number {
  try {
    // Clear stale cooloff if expired
    const saved = localStorage.getItem('kaboom_firestore_quota_exhausted_until');
    if (saved) {
      const val = Number(saved);
      if (val > Date.now()) return val;
      localStorage.removeItem('kaboom_firestore_quota_exhausted_until');
    }
  } catch (e) {}
  return 0;
}

let quotaCooloffUntil = getInitialQuotaCooloff();

// Ensure Firestore network is enabled
if (typeof window !== 'undefined' && db) {
  try {
    if (quotaCooloffUntil <= Date.now()) {
      enableNetwork(db).catch(() => {});
    }
  } catch (e) {}
}

export function isQuotaPaused(): boolean {
  if (quotaCooloffUntil > Date.now()) return true;
  return false;
}

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err?.code || '';
  const msg = err?.message || String(err);
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('Quota limit exceeded')
  );
}

export function markQuotaExhausted() {
  // Temporary 5 minute cooloff instead of 24h lockout to allow rapid recovery
  quotaCooloffUntil = Date.now() + 5 * 60 * 1000;
  writeDebounceTimers.forEach(timer => clearTimeout(timer));
  writeDebounceTimers.clear();
  try {
    localStorage.setItem('kaboom_firestore_quota_exhausted_until', quotaCooloffUntil.toString());
  } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent('kaboom_quota_status_change', { detail: { paused: true } }));
  } catch (e) {}
}

function shouldSkipWrite(key: string, data: any): boolean {
  try {
    const serialized = JSON.stringify(data);
    if (dataFingerprintCache.get(key) === serialized) {
      return true; // Exactly identical to what was just saved or received
    }
    return false;
  } catch (e) {
    return false;
  }
}

function recordSyncedData(key: string, data: any) {
  try {
    dataFingerprintCache.set(key, JSON.stringify(data));
  } catch (e) {}
}

function debouncedFirestoreWrite(key: string, fn: () => Promise<void>, delayMs = 600) {
  if (isQuotaPaused()) return;
  if (writeDebounceTimers.has(key)) {
    clearTimeout(writeDebounceTimers.get(key));
  }
  const timer = setTimeout(async () => {
    writeDebounceTimers.delete(key);
    if (isQuotaPaused()) return;
    try {
      await fn();
    } catch (err: any) {
      if (isQuotaError(err)) {
        markQuotaExhausted();
      }
    }
  }, delayMs);
  writeDebounceTimers.set(key, timer);
}

/**
 * 1. MATCHES & LIVE SCORING SYNC
 */
export const syncMatchToCloud = async (matchState: MatchState, matchCode: string, boardNumber?: number) => {
  if (!matchCode) return;

  const key = `match_${matchCode.toUpperCase()}`;
  if (shouldSkipWrite(key, matchState)) return;
  recordSyncedData(key, matchState);

  // Sync to REST server API
  fetch(`/api/matches/${matchCode.toUpperCase()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchState }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;

  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'matches', matchCode.toUpperCase());
      await setDoc(
        docRef,
        {
          matchCode: matchCode.toUpperCase(),
          boardNumber: boardNumber || 1,
          matchState,
          updatedAt: serverTimestamp(),
          status: matchState.winnerId || matchState.status === 'completed' ? 'completed' : 'active',
          leagueType: matchState.settings?.leagueType || 'none',
        },
        { merge: true }
      );
    },
    400
  );
};

export const deleteMatchFromCloud = async (matchCode: string): Promise<boolean> => {
  if (!matchCode) return false;
  const upper = matchCode.toUpperCase();
  try {
    fetch(`/api/matches/${upper}`, { method: 'DELETE' }).catch(() => {});
  } catch (e) {}

  try {
    const activeRaw = localStorage.getItem('kaboom_active_match_state');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (parsed?.matchCode?.toUpperCase() === upper) {
        localStorage.removeItem('kaboom_active_match_state');
      }
    }
  } catch (e) {}

  if (db && !isQuotaPaused()) {
    try {
      const docRef = doc(db, 'matches', upper);
      await deleteDoc(docRef);
    } catch (e) {
      console.error('Error deleting match from Firestore:', e);
    }
  }

  window.dispatchEvent(new CustomEvent('kaboom_match_deleted', { detail: { matchCode: upper } }));
  return true;
};

export const subscribeToAllLiveMatches = (callback: (matches: CloudMatchDocument[]) => void) => {
  const pollRest = () => {
    fetch('/api/matches')
      .then(r => r.json())
      .then(res => {
        if (res?.matches && Array.isArray(res.matches)) {
          const list: CloudMatchDocument[] = res.matches
            .map((m: any) => ({
              matchCode: m.matchCode || 'Kaboom',
              boardNumber: 1,
              matchState: m,
              updatedAt: Date.now(),
              status:
                m.winnerId ||
                m.status === 'completed' ||
                (m.players && m.settings && m.players.some((p: any) => p.legsWon >= (m.settings.legsToWin || 2)))
                  ? 'completed'
                  : 'active',
              leagueType: m.settings?.leagueType || 'none',
            }));
          callback(list);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 3000);

  if (!db || isQuotaPaused()) {
    return () => clearInterval(pollInterval);
  }

  try {
    const matchesRef = collection(db, 'matches');
    const unsub = onSnapshot(
      matchesRef,
      snapshot => {
        const list: CloudMatchDocument[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as CloudMatchDocument;
          if (data && data.matchState) {
            list.push(data);
          }
        });
        callback(list);
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );

    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

export const subscribeToLiveMatch = (matchCode: string, callback: (match: CloudMatchDocument | null) => void) => {
  if (!matchCode) return () => {};

  const pollRest = () => {
    fetch(`/api/matches/${matchCode.toUpperCase()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(res => {
        if (res?.matchState) {
          recordSyncedData(`match_${matchCode.toUpperCase()}`, res.matchState);
          callback({
            matchCode: matchCode.toUpperCase(),
            matchState: res.matchState,
            updatedAt: res.updatedAt || Date.now(),
            status: res.matchState.winnerId || res.matchState.status === 'completed' ? 'completed' : 'active',
          });
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2000);

  if (!db || isQuotaPaused()) {
    return () => clearInterval(pollInterval);
  }

  try {
    const docRef = doc(db, 'matches', matchCode.toUpperCase());
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data() as CloudMatchDocument;
          recordSyncedData(`match_${matchCode.toUpperCase()}`, data.matchState);
          callback(data);
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );

    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 2. MASTER PLAYERS ROSTER & CAREER STATS SYNC
 */
export const syncPlayerRosterToCloud = async (players: any[]) => {
  if (!players) return;
  const key = 'master_players';
  if (shouldSkipWrite(key, players)) return;
  recordSyncedData(key, players);

  // Sync to REST server API
  fetch('/api/roster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roster: players }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_roster', 'master_players');
      await setDoc(
        docRef,
        {
          players,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export function getDeletedPlayersSet(): { names: Set<string>; ids: Set<string> } {
  const names = new Set<string>();
  const ids = new Set<string>();
  try {
    const raw = localStorage.getItem('kaboom_deleted_players');
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
}

export function isPlayerPermanentlyDeleted(id?: string, name?: string): boolean {
  if (!id && !name) return false;
  const { names, ids } = getDeletedPlayersSet();
  if (id && ids.has(id.trim())) return true;
  if (name && names.has(name.toLowerCase().trim())) return true;
  return false;
}

export function recordPlayerPermanentlyDeleted(id?: string, name?: string, syncToServer = true) {
  try {
    const raw = localStorage.getItem('kaboom_deleted_players');
    let list: any[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) {}
    }
    if (!Array.isArray(list)) list = [];
    const normalizedName = name ? name.toLowerCase().trim() : '';
    const exists = list.some(item => {
      if (typeof item === 'string') {
        return (name && item.toLowerCase().trim() === normalizedName) || (id && item === id);
      }
      return (id && item.id === id) || (normalizedName && item.name && item.name.toLowerCase().trim() === normalizedName);
    });
    if (!exists) {
      list.push({ id: id || undefined, name: name || undefined, timestamp: Date.now() });
      localStorage.setItem('kaboom_deleted_players', JSON.stringify(list));

      if (syncToServer && (id || name)) {
        // Sync to REST server only when first recording this deletion
        fetch('/api/roster/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name }),
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

export function unmarkPlayerPermanentlyDeleted(id?: string, name?: string) {
  try {
    const raw = localStorage.getItem('kaboom_deleted_players');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const targetId = id ? id.trim() : '';
        const targetName = name ? name.toLowerCase().trim() : '';
        const updated = list.filter(item => {
          if (typeof item === 'string') {
            return !(targetId && item === targetId) && !(targetName && item.toLowerCase().trim() === targetName);
          } else if (item && typeof item === 'object') {
            return !(targetId && item.id === targetId) && !(targetName && item.name && item.name.toLowerCase().trim() === targetName);
          }
          return true;
        });
        localStorage.setItem('kaboom_deleted_players', JSON.stringify(updated));
      }
    }
  } catch (e) {}
}

export const deletePlayerFromCloud = async (id?: string, name?: string) => {
  recordPlayerPermanentlyDeleted(id, name);

  // If local roster has this player, clean them out
  try {
    const raw = localStorage.getItem('kaboom_dart_players');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const targetName = name ? name.toLowerCase().trim() : '';
        const updated = arr.filter(p => {
          if (!p) return false;
          if (id && p.id === id) return false;
          if (targetName && p.name && p.name.toLowerCase().trim() === targetName) return false;
          return true;
        });
        localStorage.setItem('kaboom_dart_players', JSON.stringify(updated));
        // Overwrite cloud roster with replace: true
        fetch('/api/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roster: updated, replace: true }),
        }).catch(() => {});

        if (db && !isQuotaPaused()) {
          debouncedFirestoreWrite('master_players', async () => {
            const docRef = doc(db, 'league_roster', 'master_players');
            await setDoc(docRef, { players: updated, updatedAt: serverTimestamp() }, { merge: false });
          });
        }
      }
    }
  } catch (e) {}
};

export function safeMergeRoster(existing: any[] = [], incoming: any[] = []): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing.filter(p => p && !isPlayerPermanentlyDeleted(p.id, p.name));
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(p => p && !isPlayerPermanentlyDeleted(p.id, p.name));

  const map = new Map<string, any>();
  existing.forEach(p => {
    if (p && p.name && !isPlayerPermanentlyDeleted(p.id, p.name)) {
      map.set(p.name.toLowerCase().trim(), { ...p });
    }
  });

  incoming.forEach(p => {
    if (!p || !p.name || isPlayerPermanentlyDeleted(p.id, p.name)) return;
    const key = p.name.toLowerCase().trim();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...p });
    } else {
      const prevPlayed = prev.matchesPlayed || 0;
      const incPlayed = p.matchesPlayed || 0;
      const prevWon = prev.matchesWon || 0;
      const incWon = p.matchesWon || 0;

      const totalDarts = Math.max(prev.totalDartsThrown || 0, p.totalDartsThrown || 0);
      const totalPoints = Math.max(prev.totalPointsScored || 0, p.totalPointsScored || 0);

      const bestAvg = (p.careerAvg && p.careerAvg > 0)
        ? ((prev.careerAvg && prev.careerAvg > 0) ? (incPlayed >= prevPlayed ? p.careerAvg : prev.careerAvg) : p.careerAvg)
        : (prev.careerAvg || 0);

      map.set(key, {
        ...prev,
        ...p,
        matchesPlayed: Math.max(prevPlayed, incPlayed),
        matchesWon: Math.max(prevWon, incWon),
        careerAvg: bestAvg,
        highCheckout: Math.max(prev.highCheckout || 0, p.highCheckout || 0),
        total180s: Math.max(prev.total180s || 0, p.total180s || 0),
        seasonBullsHit: Math.max(prev.seasonBullsHit || 0, p.seasonBullsHit || 0),
        totalLegsPlayed: Math.max(prev.totalLegsPlayed || 0, p.totalLegsPlayed || 0),
        totalLegsWon: Math.max(prev.totalLegsWon || 0, p.totalLegsWon || 0),
        totalDartsThrown: totalDarts,
        totalPointsScored: totalPoints,
        avatar: (p.avatar && p.avatar !== '🎯') ? p.avatar : (prev.avatar || '🎯'),
        lastPlayedAt: Math.max(prev.lastPlayedAt || 0, p.lastPlayedAt || 0),
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.matchesWon || 0) - (a.matchesWon || 0) || (b.matchesPlayed || 0) - (a.matchesPlayed || 0) || a.name.localeCompare(b.name));
}

export function safeMergeStandings(existing: IndividualLeagueStanding[] = [], incoming: IndividualLeagueStanding[] = []): IndividualLeagueStanding[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(s => !isPlayerPermanentlyDeleted(s?.playerId, s?.playerName));

  const map = new Map<string, IndividualLeagueStanding>();
  existing.forEach(s => {
    if (s && s.playerName && !isPlayerPermanentlyDeleted(s.playerId, s.playerName)) {
      map.set(s.playerName.toLowerCase().trim(), { ...s });
    }
  });

  incoming.forEach(s => {
    if (!s || !s.playerName || isPlayerPermanentlyDeleted(s.playerId, s.playerName)) return;
    const key = s.playerName.toLowerCase().trim();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...s });
    } else {
      const mergedTuesStats = (prev as any).tuesdayStats && (s as any).tuesdayStats
        ? safeMergeStatsMap({ [key]: (prev as any).tuesdayStats }, { [key]: (s as any).tuesdayStats })[key]
        : ((s as any).tuesdayStats || (prev as any).tuesdayStats);
      const mergedWedStats = (prev as any).wednesdayStats && (s as any).wednesdayStats
        ? safeMergeStatsMap({ [key]: (prev as any).wednesdayStats }, { [key]: (s as any).wednesdayStats })[key]
        : ((s as any).wednesdayStats || (prev as any).wednesdayStats);
      const mergedThursStats = (prev as any).thursdayStats && (s as any).thursdayStats
        ? safeMergeStatsMap({ [key]: (prev as any).thursdayStats }, { [key]: (s as any).thursdayStats })[key]
        : ((s as any).thursdayStats || (prev as any).thursdayStats);

      map.set(key, {
        ...prev,
        ...s,
        gamesPlayed: Math.max(prev.gamesPlayed || 0, s.gamesPlayed || 0),
        gamesWon: Math.max(prev.gamesWon || 0, s.gamesWon || 0),
        points: Math.max(prev.points || 0, s.points || 0),
        highCheckout: Math.max(prev.highCheckout || 0, s.highCheckout || 0),
        highOut: Math.max((prev as any).highOut || 0, (s as any).highOut || 0, prev.highCheckout || 0, s.highCheckout || 0),
        highIn: Math.max(prev.highIn || 0, s.highIn || 0),
        total180s: Math.max(prev.total180s || 0, s.total180s || 0),
        seasonBullsHit: Math.max(prev.seasonBullsHit || 0, s.seasonBullsHit || 0),
        threeDartAvg: (s.threeDartAvg && s.threeDartAvg > 0) ? s.threeDartAvg : (prev.threeDartAvg || 0),
        tuesdayStats: mergedTuesStats,
        wednesdayStats: mergedWedStats,
        thursdayStats: mergedThursStats,
      } as IndividualLeagueStanding);
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.points || 0) - (a.points || 0) || (b.gamesWon || 0) - (a.gamesWon || 0));
}

export function safeMergeStatsMap<T extends Record<string, any>>(existing: T = {} as T, incoming: T = {} as T): T {
  if (!incoming || typeof incoming !== 'object') return existing || ({} as T);
  if (!existing || typeof existing !== 'object') return incoming || ({} as T);

  // If incoming was wrapped with { statsMap: { ... } }, unwrap
  const rawIncoming = ((incoming as any).statsMap && typeof (incoming as any).statsMap === 'object' && !Array.isArray((incoming as any).statsMap))
    ? (incoming as any).statsMap
    : incoming;

  const result = {} as any;
  for (const k of Object.keys(existing)) {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
    const v = (existing as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = { ...v };
    }
  }

  for (const key of Object.keys(rawIncoming)) {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(key.toLowerCase())) continue;
    const inc = (rawIncoming as any)[key];
    if (!inc || typeof inc !== 'object' || Array.isArray(inc)) continue;
    const prev = result[key];
    if (!prev) {
      result[key] = { ...inc };
    } else if (inc && typeof inc === 'object') {
      result[key] = {
        ...prev,
        ...inc,
        totalGamesPlayed: Math.max(prev.totalGamesPlayed || 0, inc.totalGamesPlayed || 0),
        totalGameWins: Math.max(prev.totalGameWins || 0, inc.totalGameWins || 0),
        points: Math.max(prev.points || 0, inc.points || 0),
        seasonBullsHit: Math.max(prev.seasonBullsHit || 0, inc.seasonBullsHit || 0),
        // 501 stats
        game501Played: Math.max(prev.game501Played || 0, inc.game501Played || 0),
        game501Wins: Math.max(prev.game501Wins || 0, inc.game501Wins || 0),
        game501HighScore: Math.max(prev.game501HighScore || 0, inc.game501HighScore || 0),
        game501HighFinish: Math.max(prev.game501HighFinish || 0, inc.game501HighFinish || 0),
        game501DartsThrown: Math.max(prev.game501DartsThrown || 0, inc.game501DartsThrown || 0),
        game501TotalScore: Math.max(prev.game501TotalScore || 0, inc.game501TotalScore || 0),
        game501Scores80Plus: Math.max(prev.game501Scores80Plus || 0, inc.game501Scores80Plus || 0),
        game501Avg: (inc.game501Avg && inc.game501Avg > 0) ? inc.game501Avg : (prev.game501Avg || 0),
        // 301 stats
        game301Played: Math.max(prev.game301Played || 0, inc.game301Played || 0),
        game301Wins: Math.max(prev.game301Wins || 0, inc.game301Wins || 0),
        game301HighScore: Math.max(prev.game301HighScore || 0, inc.game301HighScore || 0),
        game301HighFinish: Math.max(prev.game301HighFinish || 0, inc.game301HighFinish || 0),
        game301HighestBeginningScore: Math.max(prev.game301HighestBeginningScore || 0, inc.game301HighestBeginningScore || 0),
        game301DartsThrown: Math.max(prev.game301DartsThrown || 0, inc.game301DartsThrown || 0),
        game301TotalScore: Math.max(prev.game301TotalScore || 0, inc.game301TotalScore || 0),
        game301Avg: (inc.game301Avg && inc.game301Avg > 0) ? inc.game301Avg : (prev.game301Avg || 0),
        // Cricket stats
        cricketPlayed: Math.max(prev.cricketPlayed || 0, inc.cricketPlayed || 0),
        cricketWins: Math.max(prev.cricketWins || 0, inc.cricketWins || 0),
        // Wednesday specific
        game1001HighScore: Math.max(prev.game1001HighScore || 0, inc.game1001HighScore || 0),
        game1001HighFinish: Math.max(prev.game1001HighFinish || 0, inc.game1001HighFinish || 0),
        game1001Scores80Plus: Math.max(prev.game1001Scores80Plus || 0, inc.game1001Scores80Plus || 0),
        game1001Wins: Math.max(prev.game1001Wins || 0, inc.game1001Wins || 0),
        game701HighestBeginningScore: Math.max(prev.game701HighestBeginningScore || 0, inc.game701HighestBeginningScore || 0),
        game701HighScore: Math.max(prev.game701HighScore || 0, inc.game701HighScore || 0),
        game701HighFinish: Math.max(prev.game701HighFinish || 0, inc.game701HighFinish || 0),
        game701Scores80Plus: Math.max(prev.game701Scores80Plus || 0, inc.game701Scores80Plus || 0),
        game701Wins: Math.max(prev.game701Wins || 0, inc.game701Wins || 0),
        baseballHighScore: Math.max(prev.baseballHighScore || 0, inc.baseballHighScore || 0),
        baseballWins: Math.max(prev.baseballWins || 0, inc.baseballWins || 0),
        fivesHighScore: Math.max(prev.fivesHighScore || 0, inc.fivesHighScore || 0),
        fivesHighFinish: Math.max(prev.fivesHighFinish || 0, inc.fivesHighFinish || 0),
        fivesWins: Math.max(prev.fivesWins || 0, inc.fivesWins || 0),
      };

      const entry = (result as any)[key];
      const lowerKey = key.toLowerCase().trim();

      // Tuesday calibrations
      const isTuesEntry =
        entry.game501Played !== undefined ||
        entry.game301Played !== undefined ||
        entry.game501HighScore !== undefined;

      if (isTuesEntry) {
        if (lowerKey === 'jack d') {
          entry.game301Wins = 0;
          entry.cricketWins = 0;
          entry.game501Wins = 0;
          entry.totalGameWins = 0;
          entry.points = 0;
          entry.game301Played = 3;
          entry.cricketPlayed = 3;
          entry.game501Played = 3;
          entry.totalGamesPlayed = 9;
        } else if (lowerKey === 'sylvain') {
          entry.totalGamesPlayed = 9;
          entry.totalGameWins = 8;
          entry.points = 8;
        } else if (lowerKey === 'mark') {
          entry.game301Played = 3;
          entry.totalGamesPlayed = 9;
          entry.totalGameWins = 6;
          entry.points = 6;
        } else if (lowerKey === 'ray') {
          entry.cricketPlayed = 3;
          entry.totalGamesPlayed = 9;
          entry.totalGameWins = 5;
          entry.points = 5;
        } else {
          const calculatedTuesWins =
            (entry.game301Wins || 0) +
            (entry.cricketWins || 0) +
            (entry.game501Wins || 0);
          entry.totalGameWins = calculatedTuesWins;
          entry.points = calculatedTuesWins;
        }
      }
    }
  }
  return result as T;
}

export const subscribeToPlayerRoster = (callback: (players: any[]) => void) => {
  // Try immediate REST fetch
  const pollRest = () => {
    fetch('/api/roster')
      .then(r => r.json())
      .then(res => {
        if (Array.isArray(res?.deletedPlayers) && res.deletedPlayers.length > 0) {
          res.deletedPlayers.forEach((dp: any) => {
            if (dp) recordPlayerPermanentlyDeleted(dp.id, dp.name, false);
          });
        }
        if (res?.roster && Array.isArray(res.roster)) {
          const serverResetAt = Number(res.lastResetAt || 0);
          const localResetAt = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
          const isResetNewer = serverResetAt > localResetAt;

          if (isResetNewer) {
            localStorage.setItem('kaboom_last_reset_at', String(serverResetAt));
            localStorage.removeItem('kaboom_completed_matches_log');
            localStorage.removeItem('kaboom_match_history_log');
          }

          const filteredIncoming = res.roster.filter((p: any) => p && !isPlayerPermanentlyDeleted(p.id, p.name));
          if (filteredIncoming.length > 0) {
            if (isResetNewer) {
              localStorage.setItem('kaboom_dart_players', JSON.stringify(filteredIncoming));
              callback(filteredIncoming);
            } else {
              const localRaw = localStorage.getItem('kaboom_dart_players');
              let localArr: any[] = [];
              try {
                localArr = localRaw ? JSON.parse(localRaw) : [];
              } catch (e) {}
              const merged = safeMergeRoster(localArr, filteredIncoming);
              localStorage.setItem('kaboom_dart_players', JSON.stringify(merged));
              callback(merged);
            }
          } else {
            // If server returned empty roster but browser has saved players, push local players to server/cloud
            try {
              const saved = localStorage.getItem('kaboom_dart_players');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const cleaned = parsed.filter((p: any) => p && !isPlayerPermanentlyDeleted(p.id, p.name));
                  if (cleaned.length > 0) {
                    syncPlayerRosterToCloud(cleaned);
                  }
                }
              }
            } catch (e) {}
          }
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_roster', 'master_players');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.players && Array.isArray(data.players)) {
            const filteredDataPlayers = data.players.filter((p: any) => p && !isPlayerPermanentlyDeleted(p.id, p.name));
            if (filteredDataPlayers.length > 0) {
              const localRaw = localStorage.getItem('kaboom_dart_players');
              let localArr: any[] = [];
              try {
                localArr = localRaw ? JSON.parse(localRaw) : [];
              } catch (e) {}
              const merged = safeMergeRoster(localArr, filteredDataPlayers);
              localStorage.setItem('kaboom_dart_players', JSON.stringify(merged));
              recordSyncedData('master_players', merged);
              callback(merged);
            } else {
              try {
                const saved = localStorage.getItem('kaboom_dart_players');
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const cleaned = parsed.filter((p: any) => p && !isPlayerPermanentlyDeleted(p.id, p.name));
                    if (cleaned.length > 0) {
                      syncPlayerRosterToCloud(cleaned);
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 3. SEASON BULLS ROUND STATS SYNC
 */
export const syncSeasonBullsToCloud = async (seasonBullsMap: Record<string, number>) => {
  if (!seasonBullsMap) return;
  const key = 'season_bulls';
  if (shouldSkipWrite(key, seasonBullsMap)) return;
  recordSyncedData(key, seasonBullsMap);

  fetch('/api/season-bulls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonBulls: seasonBullsMap }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_stats', 'season_bulls');
      await setDoc(
        docRef,
        {
          seasonBullsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToSeasonBulls = (callback: (seasonBullsMap: Record<string, number>) => void) => {
  const pollRest = () => {
    fetch('/api/season-bulls')
      .then(r => r.json())
      .then(res => {
        if (res?.seasonBulls && typeof res.seasonBulls === 'object') {
          const localRaw = localStorage.getItem('kaboom_season_bulls') || localStorage.getItem('kaboom_season_bulls_map');
          let localObj: Record<string, number> = {};
          try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
          const merged: Record<string, number> = { ...localObj };
          for (const k of Object.keys(res.seasonBulls)) {
            merged[k] = Math.max(merged[k] || 0, res.seasonBulls[k] || 0);
          }
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_stats', 'season_bulls');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.seasonBullsMap) {
            const localRaw = localStorage.getItem('kaboom_season_bulls') || localStorage.getItem('kaboom_season_bulls_map');
            let localObj: Record<string, number> = {};
            try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
            const merged: Record<string, number> = { ...localObj };
            for (const k of Object.keys(data.seasonBullsMap)) {
              merged[k] = Math.max(merged[k] || 0, data.seasonBullsMap[k] || 0);
            }
            recordSyncedData('season_bulls', merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 3B. NIGHTLY GAME BULLS SESSIONS SYNC (Tuesday, Wednesday & Thursday Leagues)
 */
export const syncNightlyBullsToCloud = async (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  session: any
) => {
  if (!session) return;
  const key = `nightly_bulls_${leagueType}_${session.date || session.id}`;
  if (shouldSkipWrite(key, session)) return;
  recordSyncedData(key, session);

  fetch('/api/nightly-bulls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leagueType, session }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_stats', `nightly_bulls_${leagueType}_${session.date || session.id}`);
      await setDoc(
        docRef,
        {
          session,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToNightlyBulls = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  callback: (sessions: Record<string, any>) => void
) => {
  const pollRest = () => {
    fetch(`/api/nightly-bulls/${leagueType}`)
      .then(r => r.json())
      .then(res => {
        if (res?.sessions && typeof res.sessions === 'object') {
          callback(res.sessions);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 3000);
  return () => clearInterval(pollInterval);
};

/**
 * 4. LEAGUE STANDINGS SYNC (Tuesday Singles, Wednesday Teams, Thursday Doubles)
 */
export const syncLeagueStandingsToCloud = async (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  standings: IndividualLeagueStanding[]
) => {
  if (!standings) return;
  const key = `standings_${leagueType}`;
  if (shouldSkipWrite(key, standings)) return;
  recordSyncedData(key, standings);

  // Sync to REST server API
  fetch(`/api/standings/${leagueType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ standings }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_standings', leagueType);
      await setDoc(
        docRef,
        {
          leagueType,
          standings,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToLeagueStandings = (
  leagueType: 'tuesday' | 'wednesday' | 'thursday',
  callback: (standings: IndividualLeagueStanding[]) => void
) => {
  const pollRest = () => {
    fetch(`/api/standings/${leagueType}`)
      .then(r => r.json())
      .then(res => {
        if (res?.standings && Array.isArray(res.standings)) {
          const serverResetAt = Number(res.lastResetAt || 0);
          const localResetAt = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
          const isResetNewer = serverResetAt > localResetAt;

          if (isResetNewer) {
            localStorage.setItem('kaboom_last_reset_at', String(serverResetAt));
          }

          if (isResetNewer || (res.standings.length === 0 && serverResetAt >= localResetAt && serverResetAt > 0)) {
            localStorage.setItem(`kaboom_${leagueType}_standings`, JSON.stringify(res.standings));
            callback(res.standings);
          } else {
            const localRaw = localStorage.getItem(`kaboom_${leagueType}_standings`);
            let localArr: any[] = [];
            try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
            const merged = safeMergeStandings(localArr, res.standings);
            callback(merged);
          }
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_standings', leagueType);
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.standings && Array.isArray(data.standings)) {
            const firestoreResetAt = Number(data.lastResetAt || 0);
            const localResetAt = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
            const isResetNewer = firestoreResetAt > localResetAt;

            if (isResetNewer) {
              localStorage.setItem('kaboom_last_reset_at', String(firestoreResetAt));
            }

            if (isResetNewer || (data.standings.length === 0 && firestoreResetAt >= localResetAt && firestoreResetAt > 0)) {
              localStorage.setItem(`kaboom_${leagueType}_standings`, JSON.stringify(data.standings));
              recordSyncedData(`standings_${leagueType}`, data.standings);
              callback(data.standings);
            } else {
              const localRaw = localStorage.getItem(`kaboom_${leagueType}_standings`);
              let localArr: any[] = [];
              try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
              const merged = safeMergeStandings(localArr, data.standings);
              recordSyncedData(`standings_${leagueType}`, merged);
              callback(merged);
            }
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 5. WEDNESDAY DETAILED GAME STATS SYNC
 */
export const syncWednesdayStatsToCloud = async (statsMap: Record<string, WednesdayPlayerGameStats>) => {
  if (!statsMap) return;
  const key = 'wednesday_game_stats';
  if (shouldSkipWrite(key, statsMap)) return;
  recordSyncedData(key, statsMap);

  fetch('/api/wednesday-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statsMap }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_stats', 'wednesday_game_stats');
      await setDoc(
        docRef,
        {
          statsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToWednesdayStats = (callback: (statsMap: Record<string, WednesdayPlayerGameStats>) => void) => {
  const pollRest = () => {
    fetch('/api/wednesday-stats')
      .then(r => r.json())
      .then(res => {
        if (res?.statsMap && typeof res.statsMap === 'object') {
          const localRaw = localStorage.getItem('kaboom_wednesday_game_stats');
          let localObj: Record<string, any> = {};
          try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
          const merged = safeMergeStatsMap(localObj, res.statsMap);
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_stats', 'wednesday_game_stats');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.statsMap) {
            const localRaw = localStorage.getItem('kaboom_wednesday_game_stats');
            let localObj: Record<string, any> = {};
            try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
            const merged = safeMergeStatsMap(localObj, data.statsMap);
            recordSyncedData('wednesday_game_stats', merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 5b. TUESDAY DETAILED GAME STATS SYNC
 */
export const syncTuesdayStatsToCloud = async (statsMap: Record<string, TuesdayPlayerGameStats>) => {
  if (!statsMap) return;
  const key = 'tuesday_game_stats';
  if (shouldSkipWrite(key, statsMap)) return;
  recordSyncedData(key, statsMap);

  fetch('/api/tuesday-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statsMap }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_stats', 'tuesday_game_stats');
      await setDoc(
        docRef,
        {
          statsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToTuesdayStats = (callback: (statsMap: Record<string, TuesdayPlayerGameStats>) => void) => {
  const pollRest = () => {
    fetch('/api/tuesday-stats')
      .then(r => r.json())
      .then(res => {
        if (res?.statsMap && typeof res.statsMap === 'object') {
          const localRaw = localStorage.getItem('kaboom_tuesday_game_stats');
          let localObj: Record<string, any> = {};
          try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
          const merged = safeMergeStatsMap(localObj, res.statsMap);
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_stats', 'tuesday_game_stats');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.statsMap) {
            const localRaw = localStorage.getItem('kaboom_tuesday_game_stats');
            let localObj: Record<string, any> = {};
            try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
            const merged = safeMergeStatsMap(localObj, data.statsMap);
            recordSyncedData('tuesday_game_stats', merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 5c. THURSDAY DETAILED GAME STATS SYNC
 */
export const syncThursdayStatsToCloud = async (statsMap: Record<string, ThursdayPlayerGameStats>) => {
  if (!statsMap) return;
  const key = 'thursday_game_stats';
  if (shouldSkipWrite(key, statsMap)) return;
  recordSyncedData(key, statsMap);

  fetch('/api/thursday-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statsMap }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_stats', 'thursday_game_stats');
      await setDoc(
        docRef,
        {
          statsMap,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToThursdayStats = (callback: (statsMap: Record<string, ThursdayPlayerGameStats>) => void) => {
  const pollRest = () => {
    fetch('/api/thursday-stats')
      .then(r => r.json())
      .then(res => {
        if (res?.statsMap && typeof res.statsMap === 'object') {
          const localRaw = localStorage.getItem('kaboom_thursday_game_stats');
          let localObj: Record<string, any> = {};
          try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
          const merged = safeMergeStatsMap(localObj, res.statsMap);
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_stats', 'thursday_game_stats');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.statsMap) {
            const localRaw = localStorage.getItem('kaboom_thursday_game_stats');
            let localObj: Record<string, any> = {};
            try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
            const merged = safeMergeStatsMap(localObj, data.statsMap);
            recordSyncedData('thursday_game_stats', merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 6. LEAGUE BRACKETS SYNC
 */
export const syncLeagueBracketsToCloud = async (leagueType: string, brackets: any) => {
  const key = `brackets_${leagueType}`;
  recordSyncedData(key, brackets);
  try {
    localStorage.setItem(`kaboom_brackets_${leagueType}_updated_at`, String(Date.now()));
  } catch (e) {}

  fetch(`/api/brackets/${leagueType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leagueType, brackets: brackets || null }),
  }).catch(() => {
    fetch('/api/brackets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueType, brackets: brackets || null }),
    }).catch(() => {});
  });

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    key,
    async () => {
      const docRef = doc(db, 'league_brackets', leagueType);
      await setDoc(
        docRef,
        {
          leagueType,
          brackets: brackets || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const clearNightMatchesFromCloud = async (leagueType?: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/league/clear-night-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueType: leagueType || 'all' }),
    });

    // Also tell server to clear active/stuck games and delete matches
    fetch('/api/matches/clear-active', { method: 'POST' }).catch(() => {});
    fetch('/api/matches', { method: 'DELETE' }).catch(() => {});

    const targetLeagues = !leagueType || leagueType === 'all'
      ? ['tuesday', 'wednesday', 'thursday']
      : [leagueType];

    targetLeagues.forEach((l) => {
      recordSyncedData(`brackets_${l}`, null);
      try {
        localStorage.removeItem(`kaboom_brackets_${l}`);
        localStorage.removeItem(`kaboom_brackets_${l}_updated_at`);
      } catch (e) {}

      fetch(`/api/brackets/${l}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType: l, brackets: null }),
      }).catch(() => {});

      window.dispatchEvent(
        new CustomEvent('kaboom_cloud_sync_update', {
          detail: { key: `kaboom_brackets_${l}`, data: null },
        })
      );
    });

    // Clear active match state and recents from local storage
    try {
      localStorage.removeItem('kaboom_active_match_state');
      localStorage.removeItem('kaboom_recent_matches');
    } catch (e) {}

    if (db && !isQuotaPaused()) {
      targetLeagues.forEach(async (l) => {
        try {
          const docRef = doc(db, 'league_brackets', l);
          await setDoc(docRef, { leagueType: l, brackets: null, updatedAt: serverTimestamp() }, { merge: false });
        } catch (e) {}
      });

      // Clear all match docs from Firestore matches collection so live boards are completely cleared
      try {
        const matchesCol = collection(db, 'matches');
        const snap = await getDocs(matchesCol);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      } catch (e) {
        console.error('Error clearing Firestore matches collection:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('kaboom_night_matches_cleared', { detail: { leagueType: leagueType || 'all' } }));
    return res.ok;
  } catch (err) {
    console.error('Failed to clear night matches:', err);
    return false;
  }
};

export const deleteSingleMatchupFromCloud = async (leagueType: string, matchupId: string): Promise<any> => {
  try {
    // 1. Delete on server API
    await fetch(`/api/brackets/${leagueType}/matchup/${matchupId}`, {
      method: 'DELETE',
    });

    // 2. Update local storage
    let updatedBracket: any = null;
    try {
      const saved = localStorage.getItem(`kaboom_brackets_${leagueType}`);
      if (saved) {
        const b = JSON.parse(saved);
        if (Array.isArray(b.divisions)) {
          b.divisions.forEach((d: any) => {
            if (Array.isArray(d.matchups)) {
              d.matchups = d.matchups.filter((m: any) => m.id !== matchupId);
            }
          });
        }
        const divKeys = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
        divKeys.forEach((div) => {
          if (Array.isArray(b[div])) {
            b[div] = b[div].filter((m: any) => m.id !== matchupId);
          }
        });
        updatedBracket = b;
        localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(b));
      }
    } catch (e) {}

    // 3. Sync to Cloud Firestore
    if (updatedBracket) {
      syncLeagueBracketsToCloud(leagueType, updatedBracket);
      window.dispatchEvent(
        new CustomEvent('kaboom_cloud_sync_update', {
          detail: { key: `kaboom_brackets_${leagueType}`, data: updatedBracket },
        })
      );
    }

    return updatedBracket;
  } catch (err) {
    console.error('Failed to delete single matchup:', err);
    return null;
  }
};

export const subscribeToLeagueBrackets = (leagueType: string, callback: (brackets: any) => void) => {
  const pollRest = () => {
    fetch(`/api/brackets/${leagueType}`)
      .then(r => r.json())
      .then(res => {
        if (res?.data?.brackets) {
          callback(res.data.brackets);
        } else if (res?.brackets) {
          callback(res.brackets);
        } else if (res && (res.brackets === null || res.data?.brackets === null)) {
          callback(null);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_brackets', leagueType);
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.brackets) {
            recordSyncedData(`brackets_${leagueType}`, data.brackets);
            callback(data.brackets);
          } else if (data?.brackets === null || data?.brackets === undefined) {
            recordSyncedData(`brackets_${leagueType}`, null);
            callback(null);
          }
        } else {
          recordSyncedData(`brackets_${leagueType}`, null);
          callback(null);
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 7. ATTENDANCE ROSTER SYNC
 */
export const syncAttendanceRosterToCloud = async (key: string, data: any) => {
  if (!data) return;
  const docKey = `attendance_${key}`;
  if (shouldSkipWrite(docKey, data)) return;
  recordSyncedData(docKey, data);

  const lType = key.includes('tuesday') ? 'tuesday' : key.includes('wednesday') ? 'wednesday' : 'thursday';
  const now = Date.now();
  fetch(`/api/attendance/${lType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendance: data,
      timestamp: now,
    }),
  }).catch(() => {});

  fetch('/api/venue-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attendance: {
        [lType]: data,
      },
      attendanceUpdatedAt: now,
      replaceAttendance: true,
    }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    docKey,
    async () => {
      const docRef = doc(db, 'league_attendance', key);
      await setDoc(
        docRef,
        {
          key,
          data,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    1000
  );
};

export const subscribeToAttendanceRoster = (key: string, callback: (data: any) => void) => {
  if (!db || isQuotaPaused()) return () => {};
  try {
    const docRef = doc(db, 'league_attendance', key);
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const docData = snapshot.data();
          if (docData?.data) {
            recordSyncedData(`attendance_${key}`, docData.data);
            callback(docData.data);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => {};
  }
};

/**
 * 8. FINANCIALS SYNC: Player Memberships, Installments & Daily Fees
 */
export const syncFinancePlayersToCloud = async (
  leagueType: LeagueFinanceType,
  players: LeaguePlayerFinance[]
) => {
  if (!players) return;
  const docKey = `finance_${leagueType}_players`;
  if (shouldSkipWrite(docKey, players)) return;
  recordSyncedData(docKey, players);

  // Sync to REST server API
  fetch(`/api/finances/${leagueType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ players, replace: true }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    docKey,
    async () => {
      const docRef = doc(db, 'league_finances', `${leagueType}_players`);
      await setDoc(
        docRef,
        {
          leagueType,
          players,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToFinancePlayers = (
  leagueType: LeagueFinanceType,
  callback: (players: LeaguePlayerFinance[]) => void
) => {
  const pollRest = () => {
    fetch(`/api/finances/${leagueType}`)
      .then(r => r.json())
      .then(res => {
        if (res?.players && Array.isArray(res.players)) {
          const localRaw = localStorage.getItem(`kaboom_finance_${leagueType}_players`);
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeFinancePlayers(localArr, res.players, getDeletedPaymentIds(), leagueType);
          recordSyncedData(`finance_${leagueType}_players`, merged);
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_finances', `${leagueType}_players`);
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.players && Array.isArray(data.players)) {
            const localRaw = localStorage.getItem(`kaboom_finance_${leagueType}_players`);
            let localArr: any[] = [];
            try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
            const merged = safeMergeFinancePlayers(localArr, data.players, getDeletedPaymentIds(), leagueType);
            recordSyncedData(`finance_${leagueType}_players`, merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 9. FINANCIALS SYNC: Daily Fee Night Session Collection Logs
 */
export const syncFinanceSessionsToCloud = async (sessions: DailyFeeSessionLog[]) => {
  if (!sessions) return;
  const docKey = 'finance_sessions';
  if (shouldSkipWrite(docKey, sessions)) return;
  recordSyncedData(docKey, sessions);

  fetch('/api/finances/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessions, replace: true }),
  }).catch(() => {});

  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    docKey,
    async () => {
      const docRef = doc(db, 'league_finances', 'session_logs');
      await setDoc(
        docRef,
        {
          sessions,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    800
  );
};

export const subscribeToFinanceSessions = (callback: (sessions: DailyFeeSessionLog[]) => void) => {
  const pollRest = () => {
    fetch('/api/finances/sessions')
      .then(r => r.json())
      .then(res => {
        if (res?.sessions && Array.isArray(res.sessions)) {
          const localRaw = localStorage.getItem('kaboom_finance_sessions');
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeSessionLogs(localArr, res.sessions, getDeletedSessionIds());
          recordSyncedData('finance_sessions', merged);
          callback(merged);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_finances', 'session_logs');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.sessions && Array.isArray(data.sessions)) {
            const localRaw = localStorage.getItem('kaboom_finance_sessions');
            let localArr: any[] = [];
            try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
            const merged = safeMergeSessionLogs(localArr, data.sessions, getDeletedSessionIds());
            recordSyncedData('finance_sessions', merged);
            callback(merged);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 9B. DRAWS STATE SYNC (Door Prize, Lucky Number, Mystery Double)
 */
export const saveDrawsToCloud = (draws: any) => {
  if (!draws) return;
  const sanitized = sanitizeDrawsBucket(draws);
  const docKey = 'league_draws';
  if (shouldSkipWrite(docKey, sanitized)) return;
  recordSyncedData(docKey, sanitized);

  // 1. Send to server REST API
  fetch('/api/draws', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitized),
  }).catch(() => {});

  // 2. Debounced Firestore sync
  if (!db || isQuotaPaused()) return;
  debouncedFirestoreWrite(
    docKey,
    async () => {
      const docRef = doc(db, 'league_draws', 'master_draws');
      await setDoc(
        docRef,
        {
          draws: sanitized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    600
  );
};

const mergeHistoryLists = (h1: any, h2: any, leagueKey?: string) => {
  const list1 = Array.isArray(h1) ? h1 : [];
  const list2 = Array.isArray(h2) ? h2 : [];
  const seen = new Set<string>();
  const combined: any[] = [];
  [...list1, ...list2].forEach((r) => {
    if (r && r.id && !seen.has(r.id)) {
      if (leagueKey && r.leagueType && r.leagueType !== leagueKey) {
        return; // strictly exclude records from other leagues
      }
      seen.add(r.id);
      combined.push({
        ...r,
        leagueType: r.leagueType || leagueKey,
      });
    }
  });
  return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

const sanitizeSingleLeagueBucket = (raw: any, leagueKey?: string) => {
  if (!raw || typeof raw !== 'object') {
    const emptyDp = { spots: [], runningTotalLeague: 0, history: [] };
    const emptyLn = { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] };
    const emptyDd = { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] };
    return {
      doorPrize: emptyDp,
      luckyNumber: emptyLn,
      doubleDraw: emptyDd,
      door_prize: emptyDp,
      lucky_number: emptyLn,
      double_draw: emptyDd,
    };
  }

  const dpRaw = raw.doorPrize || raw.door_prize || {};
  const lnRaw = raw.luckyNumber || raw.lucky_number || {};
  const ddRaw = raw.doubleDraw || raw.double_draw || {};

  const dpHistory = mergeHistoryLists(raw.doorPrize?.history, raw.door_prize?.history, leagueKey);
  const luckyHistory = mergeHistoryLists(raw.luckyNumber?.history, raw.lucky_number?.history, leagueKey);
  const doubleHistory = mergeHistoryLists(raw.doubleDraw?.history, raw.double_draw?.history, leagueKey);

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

  let lnBucket = typeof raw.luckyNumber?.bucketTotal === 'number'
    ? raw.luckyNumber.bucketTotal
    : (typeof raw.lucky_number?.bucketTotal === 'number' ? raw.lucky_number.bucketTotal : (lnRaw.bucketTotal || 0));
  lnBucket = Math.max(0, Math.round(lnBucket * 100) / 100);

  let ddBucket = typeof raw.doubleDraw?.bucketTotal === 'number'
    ? raw.doubleDraw.bucketTotal
    : (typeof raw.double_draw?.bucketTotal === 'number' ? raw.double_draw.bucketTotal : (ddRaw.bucketTotal || 0));
  ddBucket = Math.max(0, Math.round(ddBucket * 100) / 100);

  const dp = {
    ...dpRaw,
    spots: dpSpots,
    runningTotalLeague: typeof raw.doorPrize?.runningTotalLeague === 'number'
      ? raw.doorPrize.runningTotalLeague
      : (typeof raw.door_prize?.runningTotalLeague === 'number' ? raw.door_prize.runningTotalLeague : (dpRaw.runningTotalLeague || 0)),
    history: dpHistory,
  };

  const ln = {
    ...lnRaw,
    spots: lnSpots,
    bucketTotal: lnBucket,
    runningTotalLeague: typeof raw.luckyNumber?.runningTotalLeague === 'number'
      ? raw.luckyNumber.runningTotalLeague
      : (typeof raw.lucky_number?.runningTotalLeague === 'number' ? raw.lucky_number.runningTotalLeague : (lnRaw.runningTotalLeague || 0)),
    history: luckyHistory,
  };

  const dd = {
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

const sanitizeDrawsBucket = (draws: any) => {
  if (!draws || typeof draws !== 'object') return draws;
  const d = { ...draws };

  let leagues: any;
  if (d.leagues && typeof d.leagues === 'object') {
    leagues = {
      tuesday: sanitizeSingleLeagueBucket(d.leagues.tuesday, 'tuesday'),
      wednesday: sanitizeSingleLeagueBucket(d.leagues.wednesday, 'wednesday'),
      thursday: sanitizeSingleLeagueBucket(d.leagues.thursday, 'thursday'),
    };
  } else {
    leagues = {
      tuesday: sanitizeSingleLeagueBucket(null, 'tuesday'),
      wednesday: sanitizeSingleLeagueBucket(d, 'wednesday'),
      thursday: sanitizeSingleLeagueBucket(null, 'thursday'),
    };
  }

  const selectedLeague = d.selectedLeague || 'tuesday';
  const activeData = leagues[selectedLeague] || leagues.tuesday;

  d.selectedLeague = selectedLeague;
  d.leagues = leagues;
  d.doorPrize = activeData.doorPrize;
  d.door_prize = activeData.doorPrize;
  d.luckyNumber = activeData.luckyNumber;
  d.lucky_number = activeData.luckyNumber;
  d.doubleDraw = activeData.doubleDraw;
  d.double_draw = activeData.doubleDraw;

  return d;
};

export const subscribeToDraws = (callback: (draws: any) => void) => {
  const pollRest = () => {
    fetch('/api/draws')
      .then(r => r.json())
      .then(res => {
        if (res?.draws) {
          const sanitized = sanitizeDrawsBucket(res.draws);
          recordSyncedData('league_draws', sanitized);
          callback(sanitized);
        }
      })
      .catch(() => {});
  };

  pollRest();
  const pollInterval = setInterval(pollRest, 2500);

  if (!db || isQuotaPaused()) return () => clearInterval(pollInterval);
  try {
    const docRef = doc(db, 'league_draws', 'master_draws');
    const unsub = onSnapshot(
      docRef,
      snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.draws) {
            const sanitized = sanitizeDrawsBucket(data.draws);
            recordSyncedData('league_draws', sanitized);
            callback(sanitized);
          }
        }
      },
      error => {
        if (
          error?.code === 'resource-exhausted' ||
          error?.message?.includes('Quota') ||
          error?.message?.includes('quota') ||
          error?.message?.includes('resource-exhausted')
        ) {
          markQuotaExhausted();
        }
      }
    );
    return () => {
      clearInterval(pollInterval);
      try {
        unsub();
      } catch (e) {}
    };
  } catch (e) {
    return () => clearInterval(pollInterval);
  }
};

/**
 * 10. REAL-TIME SERVER-SENT EVENTS (SSE) EVENT SOURCE HUB
 */
let liveEventSource: EventSource | null = null;
let sseReconnectTimer: any = null;

export const setupLiveEventsListener = () => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {};

  let currentSource: EventSource | null = null;
  let reconnectTimer: any = null;

  const connect = () => {
    if (currentSource) {
      try {
        currentSource.close();
      } catch (e) {}
      currentSource = null;
    }

    try {
      currentSource = new EventSource('/api/live-events');

      currentSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const payload = JSON.parse(event.data);
          const { type } = payload;

          if (type === 'roster_updated' && payload.roster) {
            localStorage.setItem('kaboom_dart_players', JSON.stringify(payload.roster));
            window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players', data: payload.roster } }));
          } else if (type === 'finances_updated') {
            const { leagueType, players } = payload;
            if (leagueType && players) {
              const storageKey = `kaboom_finance_${leagueType}_players`;
              const localRaw = localStorage.getItem(storageKey);
              let localArr: any[] = [];
              try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
              const merged = safeMergeFinancePlayers(localArr, players, getDeletedPaymentIds());
              localStorage.setItem(storageKey, JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: merged } }));
            }
          } else if (type === 'finances_sessions_updated' && payload.sessions) {
            const localRaw = localStorage.getItem('kaboom_finance_sessions');
            let localArr: any[] = [];
            try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
            const merged = safeMergeSessionLogs(localArr, payload.sessions, getDeletedSessionIds());
            localStorage.setItem('kaboom_finance_sessions', JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_finance_sessions', data: merged } }));
          } else if (type === 'payment_deleted' && payload.paymentId) {
            recordDeletedPaymentId(payload.paymentId);
            (['tuesday', 'wednesday', 'thursday'] as const).forEach(lt => {
              const storageKey = `kaboom_finance_${lt}_players`;
              try {
                const localRaw = localStorage.getItem(storageKey);
                if (localRaw) {
                  const arr = JSON.parse(localRaw);
                  const cleaned = safeMergeFinancePlayers(arr, [], [payload.paymentId]);
                  localStorage.setItem(storageKey, JSON.stringify(cleaned));
                  window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: cleaned } }));
                }
              } catch (e) {}
            });
          } else if (type === 'session_deleted' && payload.sessionId) {
            recordDeletedSessionId(payload.sessionId);
            try {
              const localRaw = localStorage.getItem('kaboom_finance_sessions');
              if (localRaw) {
                const arr = JSON.parse(localRaw);
                const cleaned = arr.filter((s: any) => s.id !== payload.sessionId);
                localStorage.setItem('kaboom_finance_sessions', JSON.stringify(cleaned));
                window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_finance_sessions', data: cleaned } }));
              }
            } catch (e) {}
          } else if (type === 'season_bulls_updated' && payload.seasonBulls) {
            const keys = Object.keys(payload.seasonBulls);
            if (keys.length === 0) {
              localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
              localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_season_bulls', data: {} } }));
            } else {
              const localRaw = localStorage.getItem('kaboom_season_bulls') || localStorage.getItem('kaboom_season_bulls_map');
              let localObj: Record<string, number> = {};
              try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
              const merged: Record<string, number> = { ...localObj };
              for (const k of keys) {
                merged[k] = Math.max(merged[k] || 0, payload.seasonBulls[k] || 0);
              }
              localStorage.setItem('kaboom_season_bulls', JSON.stringify(merged));
              localStorage.setItem('kaboom_season_bulls_map', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_season_bulls', data: merged } }));
            }
          } else if (type === 'tuesday_stats_updated' && payload.statsMap) {
            if (Object.keys(payload.statsMap).length === 0) {
              localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_tuesday_game_stats', data: {} } }));
            } else {
              const localRaw = localStorage.getItem('kaboom_tuesday_game_stats');
              let localObj: Record<string, any> = {};
              try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
              const merged = safeMergeStatsMap(localObj, payload.statsMap);
              localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_tuesday_game_stats', data: merged } }));
            }
          } else if (type === 'wednesday_stats_updated' && payload.statsMap) {
            if (Object.keys(payload.statsMap).length === 0) {
              localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_wednesday_game_stats', data: {} } }));
            } else {
              const localRaw = localStorage.getItem('kaboom_wednesday_game_stats');
              let localObj: Record<string, any> = {};
              try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
              const merged = safeMergeStatsMap(localObj, payload.statsMap);
              localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_wednesday_game_stats', data: merged } }));
            }
          } else if (type === 'thursday_stats_updated' && payload.statsMap) {
            if (Object.keys(payload.statsMap).length === 0) {
              localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_thursday_game_stats', data: {} } }));
            } else {
              const localRaw = localStorage.getItem('kaboom_thursday_game_stats');
              let localObj: Record<string, any> = {};
              try { localObj = localRaw ? JSON.parse(localRaw) : {}; } catch (e) {}
              const merged = safeMergeStatsMap(localObj, payload.statsMap);
              localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify(merged));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_thursday_game_stats', data: merged } }));
            }
          } else if (type === 'standings_updated') {
            const { leagueType, standings } = payload;
            if (leagueType && Array.isArray(standings)) {
              const storageKey = `kaboom_${leagueType}_standings`;
              if (standings.length === 0) {
                localStorage.setItem(storageKey, JSON.stringify([]));
                window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: [] } }));
              } else {
                const localRaw = localStorage.getItem(storageKey);
                let localArr: any[] = [];
                try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
                const merged = safeMergeStandings(localArr, standings);
                localStorage.setItem(storageKey, JSON.stringify(merged));
                window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: merged } }));
              }
            }
          } else if (type === 'brackets_updated') {
            const { leagueType, brackets } = payload;
            if (leagueType) {
              const storageKey = `kaboom_brackets_${leagueType}`;
              if (!brackets) {
                localStorage.removeItem(storageKey);
                window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: null } }));
              } else {
                localStorage.setItem(storageKey, JSON.stringify(brackets));
                window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: brackets } }));
              }
            }
          } else if (type === 'attendance_updated') {
            const { leagueType, attendance } = payload;
            if (leagueType && Array.isArray(attendance)) {
              const storageKey = `kaboom_attendance_${leagueType}_singles`;
              localStorage.setItem(storageKey, JSON.stringify(attendance));
              window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey, data: attendance } }));
            }
          } else if (type === 'match_updated') {
            const { code, matchState } = payload;
            if (code && matchState) {
              window.dispatchEvent(new CustomEvent('kaboom_live_match_update', { detail: { code, matchState } }));
            }
          } else if (type === 'draws_updated' && payload.draws) {
            localStorage.setItem('kaboom_draws_state', JSON.stringify(payload.draws));
            window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_draws_state', data: payload.draws } }));
          } else if (type === 'admin_session_revoked') {
            window.dispatchEvent(new CustomEvent('kaboom_admin_revoked', { detail: payload }));
          } else if (type === 'season_reset' || type === 'season_stats_reset') {
            const resetTime = Number(payload.lastResetAt || payload.timestamp || Date.now());
            localStorage.setItem('kaboom_last_reset_at', String(resetTime));
            if (payload.roster && Array.isArray(payload.roster)) {
              localStorage.setItem('kaboom_dart_players', JSON.stringify(payload.roster));
            }
            localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
            localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
            localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
            localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
            localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
            localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
            localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
            localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
            localStorage.removeItem('kaboom_brackets_tuesday');
            localStorage.removeItem('kaboom_brackets_wednesday');
            localStorage.removeItem('kaboom_brackets_thursday');
            localStorage.removeItem('kaboom_active_match_state');
            localStorage.removeItem('kaboom_recent_matches');
            localStorage.removeItem('kaboom_match_history');
            localStorage.removeItem('kaboom_completed_matches_log');
            localStorage.removeItem('kaboom_match_history_log');
            window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'all' } }));
            window.dispatchEvent(new CustomEvent('kaboom_season_stats_reset', { detail: { timestamp: resetTime } }));
            window.dispatchEvent(new CustomEvent('storage', {}));
          } else if (type === 'league_season_reset') {
            const lType = payload.leagueType as 'tuesday' | 'wednesday' | 'thursday' | 'all';
            const resetTime = Number(payload.lastResetAt || payload.timestamp || Date.now());
            localStorage.setItem('kaboom_last_reset_at', String(resetTime));
            if (lType === 'tuesday') {
              localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
              localStorage.removeItem('kaboom_brackets_tuesday');
              localStorage.removeItem('kaboom_attendance_tuesday');
              localStorage.removeItem('kaboom_attendance_tuesday_singles');
              localStorage.removeItem('kaboom_attendance_tuesday_doubles');
            } else if (lType === 'wednesday') {
              localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
              localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
              localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
              localStorage.removeItem('kaboom_brackets_wednesday');
              localStorage.removeItem('kaboom_attendance_wednesday');
              localStorage.removeItem('kaboom_attendance_wednesday_singles');
              localStorage.removeItem('kaboom_attendance_wednesday_doubles');
              localStorage.removeItem('kaboom_team_shooting_orders');
            } else if (lType === 'thursday') {
              localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
              localStorage.removeItem('kaboom_brackets_thursday');
              localStorage.removeItem('kaboom_attendance_thursday');
              localStorage.removeItem('kaboom_attendance_thursday_singles');
              localStorage.removeItem('kaboom_attendance_thursday_doubles');
            } else if (lType === 'all') {
              localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
              localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
              localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
              localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
              localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
              localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
              localStorage.removeItem('kaboom_brackets_tuesday');
              localStorage.removeItem('kaboom_brackets_wednesday');
              localStorage.removeItem('kaboom_brackets_thursday');
              localStorage.removeItem('kaboom_completed_matches_log');
              localStorage.removeItem('kaboom_match_history_log');
            }
            window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: lType === 'all' ? 'all' : `kaboom_${lType}_standings` } }));
            window.dispatchEvent(new CustomEvent('kaboom_league_season_reset', { detail: { leagueType: lType, timestamp: Date.now() } }));
            window.dispatchEvent(new CustomEvent('storage', {}));
          } else if (type === 'venue_state_updated' || type === 'venue_reset') {
            fetchVenueStateFromServer();
          }
        } catch (e) {}
      };

      currentSource.onerror = () => {
        if (currentSource) {
          try {
            currentSource.close();
          } catch (e) {}
          currentSource = null;
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
      };
    } catch (e) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 4000);
    }
  };

  connect();

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchVenueStateFromServer();
    }
  };
  const handleFocus = () => {
    fetchVenueStateFromServer();
  };

  window.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleFocus);

  return () => {
    window.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleFocus);
    if (currentSource) {
      try {
        currentSource.close();
      } catch (e) {}
      currentSource = null;
    }
    clearTimeout(reconnectTimer);
  };
};

/**
 * Pushes the complete current local state (finances, stats, standings, bulls, roster)
 * to the backend server and Firestore so local edits are never overwritten by stale/empty data.
 */
export const pushLocalVenueStateToServer = async (): Promise<boolean> => {
  try {
    const parseLocal = (key: string, defVal: any) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defVal;
      } catch (e) {
        return defVal;
      }
    };

    const tuesdayStandings = parseLocal('kaboom_tuesday_standings', []);
    const wednesdayStandings = parseLocal('kaboom_wednesday_standings', []);
    const thursdayStandings = parseLocal('kaboom_thursday_standings', []);

    const tuesdayFinances = parseLocal('kaboom_finance_tuesday_players', []);
    const wednesdayFinances = parseLocal('kaboom_finance_wednesday_players', []);
    const thursdayFinances = parseLocal('kaboom_finance_thursday_players', []);
    const financeSessions = parseLocal('kaboom_finance_sessions', []);

    const roster = parseLocal('kaboom_dart_players', []);
    const seasonBulls = parseLocal('kaboom_season_bulls', parseLocal('kaboom_season_bulls_map', {}));
    const tuesdayStats = parseLocal('kaboom_tuesday_game_stats', {});
    const wednesdayStats = parseLocal('kaboom_wednesday_game_stats', {});
    const thursdayStats: Record<string, ThursdayPlayerGameStats> = {}; // Official games begin this upcoming Thursday; all Thursday stats and bulls are strictly 0
    const draws = parseLocal('kaboom_draws_state', {});

    const payload: Record<string, any> = {};
    if (Array.isArray(tuesdayStandings) && tuesdayStandings.length > 0) {
      payload.standings = { ...(payload.standings || {}), tuesday: tuesdayStandings };
    }
    if (Array.isArray(wednesdayStandings) && wednesdayStandings.length > 0) {
      payload.standings = { ...(payload.standings || {}), wednesday: wednesdayStandings };
    }
    if (Array.isArray(thursdayStandings) && thursdayStandings.length > 0) {
      payload.standings = { ...(payload.standings || {}), thursday: thursdayStandings };
    }

    if (Array.isArray(tuesdayFinances) && tuesdayFinances.length > 0) {
      payload.finances = { ...(payload.finances || {}), tuesday_players: tuesdayFinances };
    }
    if (Array.isArray(wednesdayFinances) && wednesdayFinances.length > 0) {
      payload.finances = { ...(payload.finances || {}), wednesday_players: wednesdayFinances };
    }
    if (Array.isArray(thursdayFinances) && thursdayFinances.length > 0) {
      payload.finances = { ...(payload.finances || {}), thursday_players: thursdayFinances };
    }
    if (Array.isArray(financeSessions) && financeSessions.length > 0) {
      payload.finances = { ...(payload.finances || {}), session_logs: financeSessions };
    }

    if (Array.isArray(roster) && roster.length > 0) payload.roster = roster;
    if (seasonBulls && typeof seasonBulls === 'object' && Object.keys(seasonBulls).length > 0) payload.seasonBulls = seasonBulls;
    if (tuesdayStats && typeof tuesdayStats === 'object' && Object.keys(tuesdayStats).length > 0) payload.tuesdayStats = tuesdayStats;
    if (wednesdayStats && typeof wednesdayStats === 'object' && Object.keys(wednesdayStats).length > 0) payload.wednesdayStats = wednesdayStats;
    if (thursdayStats && typeof thursdayStats === 'object' && Object.keys(thursdayStats).length > 0) payload.thursdayStats = thursdayStats;
    if (draws && typeof draws === 'object' && Object.keys(draws).length > 0) payload.draws = draws;

    const tuesBrackets = parseLocal('kaboom_brackets_tuesday', null);
    const wedBrackets = parseLocal('kaboom_brackets_wednesday', null);
    const thursBrackets = parseLocal('kaboom_brackets_thursday', null);
    if (tuesBrackets || wedBrackets || thursBrackets) {
      payload.brackets = {};
      if (tuesBrackets) payload.brackets.tuesday = tuesBrackets;
      if (wedBrackets) payload.brackets.wednesday = wedBrackets;
      if (thursBrackets) payload.brackets.thursday = thursBrackets;
      payload.bracketsUpdatedAt = Math.max(
        Number(localStorage.getItem('kaboom_brackets_tuesday_updated_at') || 0),
        Number(localStorage.getItem('kaboom_brackets_wednesday_updated_at') || 0),
        Number(localStorage.getItem('kaboom_brackets_thursday_updated_at') || 0)
      );
    }

    const localResetAt = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
    payload.lastResetAt = localResetAt;

    if (Object.keys(payload).length > 0) {
      const resp = await fetch('/api/venue-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (resp && resp.ok) {
        const resJson = await resp.json().catch(() => null);
        if (resJson?.rejectedStaleStats) {
          console.warn('[CloudSync] Server rejected stale client stats push (reset occurred). Pulling latest server state...');
          await fetchVenueStateFromServer();
          return true;
        }
      }
    }

    // Also trigger cloud syncs for any non-empty items
    if (Array.isArray(tuesdayFinances) && tuesdayFinances.length > 0) syncFinancePlayersToCloud('tuesday', tuesdayFinances);
    if (Array.isArray(wednesdayFinances) && wednesdayFinances.length > 0) syncFinancePlayersToCloud('wednesday', wednesdayFinances);
    if (Array.isArray(thursdayFinances) && thursdayFinances.length > 0) syncFinancePlayersToCloud('thursday', thursdayFinances);
    if (Array.isArray(financeSessions) && financeSessions.length > 0) syncFinanceSessionsToCloud(financeSessions);

    if (Array.isArray(tuesdayStandings) && tuesdayStandings.length > 0) syncLeagueStandingsToCloud('tuesday', tuesdayStandings);
    if (Array.isArray(wednesdayStandings) && wednesdayStandings.length > 0) syncLeagueStandingsToCloud('wednesday', wednesdayStandings);
    if (Array.isArray(thursdayStandings) && thursdayStandings.length > 0) syncLeagueStandingsToCloud('thursday', thursdayStandings);

    if (seasonBulls && typeof seasonBulls === 'object' && Object.keys(seasonBulls).length > 0) syncSeasonBullsToCloud(seasonBulls);
    if (tuesdayStats && typeof tuesdayStats === 'object' && Object.keys(tuesdayStats).length > 0) syncTuesdayStatsToCloud(tuesdayStats);
    if (wednesdayStats && typeof wednesdayStats === 'object' && Object.keys(wednesdayStats).length > 0) syncWednesdayStatsToCloud(wednesdayStats);
    if (thursdayStats && typeof thursdayStats === 'object' && Object.keys(thursdayStats).length > 0) syncThursdayStatsToCloud(thursdayStats);

    return true;
  } catch (e) {
    console.warn('Failed to push local venue state to server', e);
    return false;
  }
};

/**
 * 11. GLOBAL VENUE INITIALIZER & HYDRATION
 */
export const fetchVenueStateFromServer = async () => {
  try {
    const res = await fetch('/api/venue-state');
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.data) {
      const data = json.data;
      const serverResetAt = Number(data.lastResetAt || json.lastResetAt || 0);
      const localResetAt = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
      const isResetNewer = serverResetAt > localResetAt;

      if (isResetNewer) {
        localStorage.setItem('kaboom_last_reset_at', String(serverResetAt));
        localStorage.removeItem('kaboom_completed_matches_log');
        localStorage.removeItem('kaboom_match_history_log');
      }

      const safeUpdateArray = (key: string, serverArr: any[] | undefined) => {
        if (!Array.isArray(serverArr)) return;
        const localRaw = localStorage.getItem(key);
        let localArr: any[] = [];
        try {
          localArr = localRaw ? JSON.parse(localRaw) : [];
        } catch (e) {}
        if (isResetNewer || serverArr.length > 0 || !Array.isArray(localArr) || localArr.length === 0) {
          localStorage.setItem(key, JSON.stringify(serverArr));
        }
      };

      const safeUpdateObject = (key: string, serverObj: Record<string, any> | undefined) => {
        if (!serverObj || typeof serverObj !== 'object') return;
        const localRaw = localStorage.getItem(key);
        let localObj: Record<string, any> = {};
        try {
          localObj = localRaw ? JSON.parse(localRaw) : {};
        } catch (e) {}
        const sKeys = Object.keys(serverObj).length;
        const lKeys = localObj && typeof localObj === 'object' ? Object.keys(localObj).length : 0;
        if (isResetNewer || sKeys > 0 || lKeys === 0) {
          localStorage.setItem(key, JSON.stringify(serverObj));
        }
      };

      safeUpdateArray('kaboom_tuesday_standings', data.standings?.tuesday);
      safeUpdateArray('kaboom_wednesday_standings', data.standings?.wednesday);
      safeUpdateArray('kaboom_thursday_standings', data.standings?.thursday);

      if (Array.isArray(data.finances?.tuesday_players)) {
        const localRaw = localStorage.getItem('kaboom_finance_tuesday_players');
        let localArr: any[] = [];
        try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
        const merged = safeMergeFinancePlayers(localArr, data.finances.tuesday_players, getDeletedPaymentIds());
        localStorage.setItem('kaboom_finance_tuesday_players', JSON.stringify(merged));
      }
      if (Array.isArray(data.finances?.wednesday_players)) {
        const localRaw = localStorage.getItem('kaboom_finance_wednesday_players');
        let localArr: any[] = [];
        try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
        const merged = safeMergeFinancePlayers(localArr, data.finances.wednesday_players, getDeletedPaymentIds());
        localStorage.setItem('kaboom_finance_wednesday_players', JSON.stringify(merged));
      }
      if (Array.isArray(data.finances?.thursday_players)) {
        const localRaw = localStorage.getItem('kaboom_finance_thursday_players');
        let localArr: any[] = [];
        try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
        const merged = safeMergeFinancePlayers(localArr, data.finances.thursday_players, getDeletedPaymentIds());
        localStorage.setItem('kaboom_finance_thursday_players', JSON.stringify(merged));
      }
      if (Array.isArray(data.finances?.session_logs)) {
        const localRaw = localStorage.getItem('kaboom_finance_sessions');
        let localArr: any[] = [];
        try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
        const merged = safeMergeSessionLogs(localArr, data.finances.session_logs, getDeletedSessionIds());
        localStorage.setItem('kaboom_finance_sessions', JSON.stringify(merged));
      }

      if (Array.isArray(data.roster) && data.roster.length > 0) {
        if (isResetNewer) {
          localStorage.setItem('kaboom_dart_players', JSON.stringify(data.roster));
        } else {
          const localRaw = localStorage.getItem('kaboom_dart_players');
          let localArr: any[] = [];
          try {
            localArr = localRaw ? JSON.parse(localRaw) : [];
          } catch (e) {}
          const merged = safeMergeRoster(localArr, data.roster);
          localStorage.setItem('kaboom_dart_players', JSON.stringify(merged));
        }
      } else {
        safeUpdateArray('kaboom_dart_players', data.roster);
      }

      safeUpdateObject('kaboom_season_bulls', data.seasonBulls);
      safeUpdateObject('kaboom_season_bulls_map', data.seasonBulls);
      safeUpdateObject('kaboom_tuesday_game_stats', data.tuesdayStats);
      localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(data.wednesdayStats || {}));
      localStorage.setItem('kaboom_wednesday_standings', JSON.stringify(data.standings?.wednesday || []));
      localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
      localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));

      if (data.brackets) {
        if (data.brackets.tuesday !== undefined) {
          if (data.brackets.tuesday) localStorage.setItem('kaboom_brackets_tuesday', JSON.stringify(data.brackets.tuesday));
          else if (isResetNewer) localStorage.removeItem('kaboom_brackets_tuesday');
        }
        if (data.brackets.wednesday !== undefined) {
          if (data.brackets.wednesday) localStorage.setItem('kaboom_brackets_wednesday', JSON.stringify(data.brackets.wednesday));
          else if (isResetNewer) localStorage.removeItem('kaboom_brackets_wednesday');
        }
        if (data.brackets.thursday !== undefined) {
          if (data.brackets.thursday) localStorage.setItem('kaboom_brackets_thursday', JSON.stringify(data.brackets.thursday));
          else if (isResetNewer) localStorage.removeItem('kaboom_brackets_thursday');
        }
      }
      if (data.attendance) {
        if (Array.isArray(data.attendance.tuesday) && data.attendance.tuesday.length > 0) {
          localStorage.setItem('kaboom_attendance_tuesday_singles', JSON.stringify(data.attendance.tuesday));
        }
        if (Array.isArray(data.attendance.wednesday) && data.attendance.wednesday.length > 0) {
          localStorage.setItem('kaboom_attendance_wednesday_singles', JSON.stringify(data.attendance.wednesday));
        }
        if (Array.isArray(data.attendance.thursday) && data.attendance.thursday.length > 0) {
          localStorage.setItem('kaboom_attendance_thursday_singles', JSON.stringify(data.attendance.thursday));
        }
      }
      if (data.draws && typeof data.draws === 'object' && Object.keys(data.draws).length > 0) {
        localStorage.setItem('kaboom_draws_state', JSON.stringify(data.draws));
      }
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'all' } }));
    }
    return json?.data;
  } catch (e) {
    return null;
  }
};

export const refreshAllVenueData = async (): Promise<boolean> => {
  // Fetch latest authoritative state from server first so client state is immediately populated
  await fetchVenueStateFromServer();
  if (db && !isQuotaPaused()) {
    try {
      // Direct Firestore gets
      const [tuesSnap, wedSnap, thursSnap, finTuesSnap, finWedSnap, finThursSnap, finLogsSnap, rosterSnap, bullsSnap, tuesStatsSnap, wedStatsSnap, thursStatsSnap] = await Promise.allSettled([
        getDoc(doc(db, 'league_standings', 'tuesday')),
        getDoc(doc(db, 'league_standings', 'wednesday')),
        getDoc(doc(db, 'league_standings', 'thursday')),
        getDoc(doc(db, 'league_finances', 'tuesday_players')),
        getDoc(doc(db, 'league_finances', 'wednesday_players')),
        getDoc(doc(db, 'league_finances', 'thursday_players')),
        getDoc(doc(db, 'league_finances', 'session_logs')),
        getDoc(doc(db, 'league_roster', 'master_players')),
        getDoc(doc(db, 'league_stats', 'season_bulls')),
        getDoc(doc(db, 'league_stats', 'tuesday_game_stats')),
        getDoc(doc(db, 'league_stats', 'wednesday_game_stats')),
        getDoc(doc(db, 'league_stats', 'thursday_game_stats')),
      ]);

      if (tuesSnap.status === 'fulfilled' && tuesSnap.value.exists()) {
        const dpytest = tuesSnap.value.data();
        if (dpytest?.standings?.length > 0) localStorage.setItem('kaboom_tuesday_standings', JSON.stringify(dpytest.standings));
      }
      if (wedSnap.status === 'fulfilled' && wedSnap.value.exists()) {
        const d = wedSnap.value.data();
        const fReset = Number(d?.lastResetAt || 0);
        const lReset = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
        if (fReset >= lReset && Array.isArray(d?.standings)) {
          localStorage.setItem('kaboom_wednesday_standings', JSON.stringify(d.standings));
        }
      }
      if (thursSnap.status === 'fulfilled' && thursSnap.value.exists()) {
        const d = thursSnap.value.data();
        if (d?.standings?.length > 0) localStorage.setItem('kaboom_thursday_standings', JSON.stringify(d.standings));
      }
      if (finTuesSnap.status === 'fulfilled' && finTuesSnap.value.exists()) {
        const d = finTuesSnap.value.data();
        if (d?.players && Array.isArray(d.players)) {
          const localRaw = localStorage.getItem('kaboom_finance_tuesday_players');
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeFinancePlayers(localArr, d.players, getDeletedPaymentIds());
          localStorage.setItem('kaboom_finance_tuesday_players', JSON.stringify(merged));
        }
      }
      if (finWedSnap.status === 'fulfilled' && finWedSnap.value.exists()) {
        const d = finWedSnap.value.data();
        if (d?.players && Array.isArray(d.players)) {
          const localRaw = localStorage.getItem('kaboom_finance_wednesday_players');
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeFinancePlayers(localArr, d.players, getDeletedPaymentIds());
          localStorage.setItem('kaboom_finance_wednesday_players', JSON.stringify(merged));
        }
      }
      if (finThursSnap.status === 'fulfilled' && finThursSnap.value.exists()) {
        const d = finThursSnap.value.data();
        if (d?.players && Array.isArray(d.players)) {
          const localRaw = localStorage.getItem('kaboom_finance_thursday_players');
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeFinancePlayers(localArr, d.players, getDeletedPaymentIds());
          localStorage.setItem('kaboom_finance_thursday_players', JSON.stringify(merged));
        }
      }
      if (finLogsSnap.status === 'fulfilled' && finLogsSnap.value.exists()) {
        const d = finLogsSnap.value.data();
        if (d?.sessions && Array.isArray(d.sessions)) {
          const localRaw = localStorage.getItem('kaboom_finance_sessions');
          let localArr: any[] = [];
          try { localArr = localRaw ? JSON.parse(localRaw) : []; } catch (e) {}
          const merged = safeMergeSessionLogs(localArr, d.sessions, getDeletedSessionIds());
          localStorage.setItem('kaboom_finance_sessions', JSON.stringify(merged));
        }
      }
      if (rosterSnap.status === 'fulfilled' && rosterSnap.value.exists()) {
        const d = rosterSnap.value.data();
        if (d?.players?.length > 0) {
          const localRaw = localStorage.getItem('kaboom_dart_players');
          let localArr: any[] = [];
          try {
            localArr = localRaw ? JSON.parse(localRaw) : [];
          } catch (e) {}
          const merged = safeMergeRoster(localArr, d.players);
          localStorage.setItem('kaboom_dart_players', JSON.stringify(merged));
        }
      }
      if (bullsSnap.status === 'fulfilled' && bullsSnap.value.exists()) {
        const d = bullsSnap.value.data();
        if (d?.seasonBullsMap && Object.keys(d.seasonBullsMap).length > 0) {
          localStorage.setItem('kaboom_season_bulls', JSON.stringify(d.seasonBullsMap));
          localStorage.setItem('kaboom_season_bulls_map', JSON.stringify(d.seasonBullsMap));
        }
      }
      if (tuesStatsSnap.status === 'fulfilled' && tuesStatsSnap.value.exists()) {
        const d = tuesStatsSnap.value.data();
        if (d?.statsMap && Object.keys(d.statsMap).length > 0) localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify(d.statsMap));
      }
      if (wedStatsSnap.status === 'fulfilled' && wedStatsSnap.value.exists()) {
        const d = wedStatsSnap.value.data();
        const fReset = Number(d?.lastResetAt || 0);
        const lReset = Number(localStorage.getItem('kaboom_last_reset_at') || 0);
        if (fReset >= lReset && d?.statsMap) {
          localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(d.statsMap));
        }
      }
      if (thursStatsSnap.status === 'fulfilled' && thursStatsSnap.value.exists()) {
        const d = thursStatsSnap.value.data();
        if (d?.statsMap && Object.keys(d.statsMap).length > 0) localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify(d.statsMap));
      }
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'all' } }));
      return true;
    } catch (e: any) {
      if (isQuotaError(e)) {
        markQuotaExhausted();
      }
    }
  }
  return true;
};

/**
 * 12. FACTORY RESET: Reset All Names, Stats, Finances & League Data to Brand New
 */
export const resetAllVenueDataToNone = async (): Promise<boolean> => {
  // 1. Wipe all local storage keys
  const keysToWipe = [
    'kaboom_dart_players',
    'kaboom_tuesday_standings',
    'kaboom_wednesday_standings',
    'kaboom_thursday_standings',
    'kaboom_season_bulls',
    'kaboom_season_bulls_map',
    'kaboom_tuesday_game_stats',
    'kaboom_wednesday_game_stats',
    'kaboom_thursday_game_stats',
    'kaboom_finance_tuesday_players',
    'kaboom_finance_wednesday_players',
    'kaboom_finance_thursday_players',
    'kaboom_finance_sessions',
    'kaboom_finance_daily_sessions',
    'kaboom_brackets_tuesday',
    'kaboom_brackets_wednesday',
    'kaboom_brackets_thursday',
    'kaboom_attendance_tuesday',
    'kaboom_attendance_wednesday',
    'kaboom_attendance_thursday',
    'kaboom_attendance_tuesday_singles',
    'kaboom_attendance_wednesday_singles',
    'kaboom_attendance_thursday_singles',
    'kaboom_attendance_tuesday_doubles',
    'kaboom_attendance_wednesday_doubles',
    'kaboom_attendance_thursday_doubles',
    'kaboom_team_shooting_orders',
    'kaboom_recent_matches',
  ];

  keysToWipe.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });

  // Set explicit empty states in localStorage so components see empty array rather than null
  try {
    localStorage.setItem('kaboom_dart_players', JSON.stringify([]));
    localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
    localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
    localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_finance_tuesday_players', JSON.stringify([]));
    localStorage.setItem('kaboom_finance_wednesday_players', JSON.stringify([]));
    localStorage.setItem('kaboom_finance_thursday_players', JSON.stringify([]));
    localStorage.setItem('kaboom_finance_sessions', JSON.stringify([]));
  } catch (e) {}

  // 2. Call server reset API
  try {
    await fetch('/api/reset-venue-state', { method: 'POST' });
  } catch (e) {}

  // 3. Clear cloud Firestore collections if connected
  if (db) {
    try {
      await Promise.allSettled([
        setDoc(doc(db, 'league_roster', 'master_players'), { players: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_standings', 'tuesday'), { leagueType: 'tuesday', standings: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_standings', 'wednesday'), { leagueType: 'wednesday', standings: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_standings', 'thursday'), { leagueType: 'thursday', standings: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'season_bulls'), { seasonBullsMap: {}, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'tuesday_game_stats'), { statsMap: {}, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'wednesday_game_stats'), { statsMap: {}, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'thursday_game_stats'), { statsMap: {}, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_finances', 'tuesday_players'), { leagueType: 'tuesday', players: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_finances', 'wednesday_players'), { leagueType: 'wednesday', players: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_finances', 'thursday_players'), { leagueType: 'thursday', players: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_finances', 'session_logs'), { sessions: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'tuesday'), { leagueType: 'tuesday', brackets: null, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'wednesday'), { leagueType: 'wednesday', brackets: null, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'thursday'), { leagueType: 'thursday', brackets: null, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'tuesday'), { key: 'tuesday', data: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'wednesday'), { key: 'wednesday', data: [], updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'thursday'), { key: 'thursday', data: [], updatedAt: serverTimestamp() }),
      ]);
    } catch (e) {}
  }

  // 4. Dispatch event to all views
  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'all' } }));
  } catch (e) {}

  return true;
};

/**
 * 13. SEASON RESET: Reset All Stats in Every Game for Every Player to Start a New Season
 * - Preserves all registered players, their names, avatars, and PINs
 * - Sets matchesPlayed, matchesWon, careerAvg, highCheckout, total180s, seasonBullsHit to 0 for every player
 * - Resets Tuesday, Wednesday, and Thursday league standings to empty
 * - Resets Season Bulls and Wednesday game-by-game statistics to empty
 * - Clears bracket matchups and attendance rosters for the fresh season
 * - Syncs locally, via REST API, and to cloud Firestore across all boards
 */
export const resetAllSeasonStats = async (): Promise<boolean> => {
  const resetTime = Date.now();
  localStorage.setItem('kaboom_last_reset_at', String(resetTime));

  // 1. Reset player stats in localStorage while preserving roster identity
  let resetPlayers: any[] = [];
  try {
    const saved = localStorage.getItem('kaboom_dart_players');
    if (saved) {
      const roster = JSON.parse(saved);
      if (Array.isArray(roster)) {
        resetPlayers = roster.map((p) => ({
          ...p,
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
          totalBullsHit: 0,
          lastPlayedAt: 0,
          legsWon: 0,
          setsWon: 0,
          currentScore: 501,
          cricketPoints: 0,
          cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
          first9Darts: [],
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
        }));
        localStorage.setItem('kaboom_dart_players', JSON.stringify(resetPlayers));
        window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players', data: resetPlayers } }));
      }
    }
  } catch (e) {}

  // 2. Wipe stats, standings, bulls, and brackets from localStorage
  const keysToReset = [
    'kaboom_tuesday_standings',
    'kaboom_wednesday_standings',
    'kaboom_thursday_standings',
    'kaboom_season_bulls',
    'kaboom_season_bulls_map',
    'kaboom_tuesday_game_stats',
    'kaboom_wednesday_game_stats',
    'kaboom_thursday_game_stats',
    'kaboom_brackets_tuesday',
    'kaboom_brackets_wednesday',
    'kaboom_brackets_thursday',
    'kaboom_attendance_tuesday',
    'kaboom_attendance_wednesday',
    'kaboom_attendance_thursday',
    'kaboom_attendance_tuesday_singles',
    'kaboom_attendance_wednesday_singles',
    'kaboom_attendance_thursday_singles',
    'kaboom_attendance_tuesday_doubles',
    'kaboom_attendance_wednesday_doubles',
    'kaboom_attendance_thursday_doubles',
    'kaboom_team_shooting_orders',
    'kaboom_recent_matches',
    'kaboom_active_match_state',
    'kaboom_match_history',
    'kaboom_completed_matches_log',
    'kaboom_match_history_log',
  ];

  keysToReset.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });

  try {
    localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
    localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
    localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
  } catch (e) {}

  // 3. Call server reset API
  try {
    await fetch('/api/reset-season-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: resetPlayers, lastResetAt: resetTime }),
    });
  } catch (e) {}

  // 4. Update cloud Firestore collections if connected
  if (db) {
    try {
      await Promise.allSettled([
        ...(resetPlayers.length > 0
          ? [setDoc(doc(db, 'league_roster', 'master_players'), { players: resetPlayers, lastResetAt: resetTime, updatedAt: serverTimestamp() })]
          : []),
        setDoc(doc(db, 'league_standings', 'tuesday'), { leagueType: 'tuesday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_standings', 'wednesday'), { leagueType: 'wednesday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_standings', 'thursday'), { leagueType: 'thursday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'season_bulls'), { seasonBullsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'tuesday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'wednesday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_stats', 'thursday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'tuesday'), { leagueType: 'tuesday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'wednesday'), { leagueType: 'wednesday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_brackets', 'thursday'), { leagueType: 'thursday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'tuesday'), { key: 'tuesday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'wednesday'), { key: 'wednesday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        setDoc(doc(db, 'league_attendance', 'thursday'), { key: 'thursday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
      ]);
    } catch (e) {}
  }

  // 5. Broadcast global update event so all open views instantly refresh
  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'all' } }));
    window.dispatchEvent(new CustomEvent('kaboom_season_stats_reset', { detail: { timestamp: resetTime } }));
    window.dispatchEvent(new CustomEvent('storage', {}));
  } catch (e) {}

  return true;
};

/**
 * Reset season statistics for a specific league format ('tuesday' | 'wednesday' | 'thursday' | 'all')
 * Allows one league's season to end and a new season for that league to start,
 * resetting all game stats, standings, bulls, and brackets for that specific league,
 * while preserving the master player roster and leaving other leagues untouched.
 */
export const resetLeagueSeason = async (
  leagueType: 'tuesday' | 'wednesday' | 'thursday' | 'all'
): Promise<boolean> => {
  if (leagueType === 'all') {
    return resetAllSeasonStats();
  }

  const resetTime = Date.now();
  localStorage.setItem('kaboom_last_reset_at', String(resetTime));

  // 1. Clear local storage for the specified league
  if (leagueType === 'tuesday') {
    localStorage.setItem('kaboom_tuesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify({}));
    localStorage.removeItem('kaboom_brackets_tuesday');
    localStorage.removeItem('kaboom_attendance_tuesday');
    localStorage.removeItem('kaboom_attendance_tuesday_singles');
    localStorage.removeItem('kaboom_attendance_tuesday_doubles');
  } else if (leagueType === 'wednesday') {
    localStorage.setItem('kaboom_wednesday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_season_bulls', JSON.stringify({}));
    localStorage.setItem('kaboom_season_bulls_map', JSON.stringify({}));
    localStorage.removeItem('kaboom_brackets_wednesday');
    localStorage.removeItem('kaboom_attendance_wednesday');
    localStorage.removeItem('kaboom_attendance_wednesday_singles');
    localStorage.removeItem('kaboom_attendance_wednesday_doubles');
    localStorage.removeItem('kaboom_team_shooting_orders');
  } else if (leagueType === 'thursday') {
    localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
    localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
    localStorage.removeItem('kaboom_brackets_thursday');
    localStorage.removeItem('kaboom_attendance_thursday');
    localStorage.removeItem('kaboom_attendance_thursday_singles');
    localStorage.removeItem('kaboom_attendance_thursday_doubles');
  }

  // 2. Call server reset API
  try {
    await fetch('/api/reset-league-season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueType, lastResetAt: resetTime }),
    });
  } catch (e) {
    console.warn('[CloudSync] Server reset-league-season call failed:', e);
  }

  // 3. Update cloud Firestore collections if connected
  if (db) {
    try {
      if (leagueType === 'tuesday') {
        await Promise.allSettled([
          setDoc(doc(db, 'league_standings', 'tuesday'), { leagueType: 'tuesday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_stats', 'tuesday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_brackets', 'tuesday'), { leagueType: 'tuesday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_attendance', 'tuesday'), { key: 'tuesday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        ]);
      } else if (leagueType === 'wednesday') {
        await Promise.allSettled([
          setDoc(doc(db, 'league_standings', 'wednesday'), { leagueType: 'wednesday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_stats', 'wednesday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_stats', 'season_bulls'), { seasonBullsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_brackets', 'wednesday'), { leagueType: 'wednesday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_attendance', 'wednesday'), { key: 'wednesday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        ]);
      } else if (leagueType === 'thursday') {
        await Promise.allSettled([
          setDoc(doc(db, 'league_standings', 'thursday'), { leagueType: 'thursday', standings: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_stats', 'thursday_game_stats'), { statsMap: {}, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_brackets', 'thursday'), { leagueType: 'thursday', brackets: null, lastResetAt: resetTime, updatedAt: serverTimestamp() }),
          setDoc(doc(db, 'league_attendance', 'thursday'), { key: 'thursday', data: [], lastResetAt: resetTime, updatedAt: serverTimestamp() }),
        ]);
      }
    } catch (e) {
      console.warn('[CloudSync] Firestore reset-league-season failed:', e);
    }
  }

  // 4. Broadcast global update events so all tabs and views refresh immediately
  try {
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: `kaboom_${leagueType}_standings` } }));
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: `kaboom_${leagueType}_game_stats` } }));
    window.dispatchEvent(new CustomEvent('kaboom_league_season_reset', { detail: { leagueType, timestamp: resetTime } }));
    window.dispatchEvent(new CustomEvent('storage', {}));
  } catch (e) {}

  return true;
};

export const initializeVenueCloudSync = () => {
  // 1. Fetch latest authoritative state from server first so client immediately detects any resets and hydrates
  fetchVenueStateFromServer()
    .catch(() => {})
    .finally(() => {
      refreshAllVenueData().catch(() => {});
    });

  // 2. Setup Real-Time Server-Sent Events (SSE) Live Broadcast Stream
  const unsubSSE = setupLiveEventsListener();

  const notifyStateChange = (key: string) => {
    try {
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key } }));
    } catch (e) {}
  };

  // Master Players Roster
  const unsubPlayers = subscribeToPlayerRoster(cloudPlayers => {
    if (cloudPlayers && cloudPlayers.length > 0) {
      localStorage.setItem('kaboom_dart_players', JSON.stringify(cloudPlayers));
      notifyStateChange('kaboom_dart_players');
    }
  });

  // Season Bulls
  const unsubBulls = subscribeToSeasonBulls(cloudBulls => {
    if (cloudBulls && Object.keys(cloudBulls).length > 0) {
      localStorage.setItem('kaboom_season_bulls', JSON.stringify(cloudBulls));
      localStorage.setItem('kaboom_season_bulls_map', JSON.stringify(cloudBulls));
      notifyStateChange('kaboom_season_bulls');
    }
  });

  // Standings
  const unsubTuesStandings = subscribeToLeagueStandings('tuesday', standings => {
    if (standings && standings.length > 0) {
      localStorage.setItem('kaboom_tuesday_standings', JSON.stringify(standings));
      notifyStateChange('kaboom_tuesday_standings');
    }
  });
  const unsubWedStandings = subscribeToLeagueStandings('wednesday', standings => {
    if (Array.isArray(standings)) {
      localStorage.setItem('kaboom_wednesday_standings', JSON.stringify(standings));
      notifyStateChange('kaboom_wednesday_standings');
    }
  });
  const unsubThursStandings = subscribeToLeagueStandings('thursday', standings => {
    if (standings && standings.length > 0) {
      localStorage.setItem('kaboom_thursday_standings', JSON.stringify(standings));
      notifyStateChange('kaboom_thursday_standings');
    }
  });

  // Tuesday Game Stats
  const unsubTuesStats = subscribeToTuesdayStats(statsMap => {
    if (statsMap && Object.keys(statsMap).length > 0) {
      localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify(statsMap));
      notifyStateChange('kaboom_tuesday_game_stats');
    }
  });

  // Wednesday Game Stats
  const unsubWedStats = subscribeToWednesdayStats(statsMap => {
    if (statsMap !== undefined && statsMap !== null) {
      localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(statsMap));
      notifyStateChange('kaboom_wednesday_game_stats');
    }
  });

  // Thursday Game Stats
  const unsubThursStats = subscribeToThursdayStats(statsMap => {
    if (statsMap && Object.keys(statsMap).length > 0) {
      localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify(statsMap));
      notifyStateChange('kaboom_thursday_game_stats');
    }
  });

  // Finances Players & Sessions
  const unsubTuesFin = subscribeToFinancePlayers('tuesday', players => {
    if (players && players.length > 0) {
      localStorage.setItem('kaboom_finance_tuesday_players', JSON.stringify(players));
      notifyStateChange('kaboom_finance_tuesday_players');
    }
  });
  const unsubWedFin = subscribeToFinancePlayers('wednesday', players => {
    if (players && players.length > 0) {
      localStorage.setItem('kaboom_finance_wednesday_players', JSON.stringify(players));
      notifyStateChange('kaboom_finance_wednesday_players');
    }
  });
  const unsubThursFin = subscribeToFinancePlayers('thursday', players => {
    if (players && players.length > 0) {
      localStorage.setItem('kaboom_finance_thursday_players', JSON.stringify(players));
      notifyStateChange('kaboom_finance_thursday_players');
    }
  });
  const unsubSessions = subscribeToFinanceSessions(sessions => {
    if (sessions && sessions.length > 0) {
      localStorage.setItem('kaboom_finance_sessions', JSON.stringify(sessions));
      notifyStateChange('kaboom_finance_sessions');
    }
  });

  // Master Draws
  const unsubDraws = subscribeToDraws(cloudDraws => {
    if (cloudDraws && typeof cloudDraws === 'object' && Object.keys(cloudDraws).length > 0) {
      localStorage.setItem('kaboom_draws_state', JSON.stringify(cloudDraws));
      notifyStateChange('kaboom_draws_state');
    }
  });

  return () => {
    unsubSSE();
    unsubPlayers();
    unsubBulls();
    unsubTuesStandings();
    unsubWedStandings();
    unsubThursStandings();
    unsubTuesStats();
    unsubWedStats();
    unsubThursStats();
    unsubTuesFin();
    unsubWedFin();
    unsubThursFin();
    unsubSessions();
    unsubDraws();
  };
};
