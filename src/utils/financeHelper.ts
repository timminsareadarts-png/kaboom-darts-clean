import { LeagueFinanceType, LeaguePlayerFinance, DailyFeeSessionLog, LeagueFinanceTotals, MembershipPaymentRecord, DailyFeePaymentRecord, SpareFeePaymentRecord } from '../types';
import { syncFinancePlayersToCloud, syncFinanceSessionsToCloud, syncPlayerRosterToCloud } from '../services/cloudSync';
import { getDrawsFinanceSummary } from './drawsHelper';

const MEMBERSHIP_FEE = 40.0;
const DAILY_FEE_MEMBER = 2.0;
const DAILY_FEE_SPARE = 5.0;
const DAILY_FEE_SEASON_MAX = 68.0;
const SPARE_FEE_NIGHTLY = 5.0;

export { MEMBERSHIP_FEE, DAILY_FEE_MEMBER, DAILY_FEE_SPARE, DAILY_FEE_SEASON_MAX, SPARE_FEE_NIGHTLY };

/**
 * Tracks deleted payment IDs to prevent stale cloud/polling snapshots from resurrecting deleted records.
 */
export const getDeletedPaymentIds = (): string[] => {
  try {
    const raw = localStorage.getItem('kaboom_deleted_payment_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch (e) {}
  return [];
};

export const recordDeletedPaymentId = (paymentId: string): void => {
  if (!paymentId) return;
  try {
    const existing = getDeletedPaymentIds();
    if (!existing.includes(paymentId)) {
      existing.push(paymentId);
      if (existing.length > 2000) existing.splice(0, existing.length - 2000);
      localStorage.setItem('kaboom_deleted_payment_ids', JSON.stringify(existing));
    }
    // Notify server immediately
    fetch('/api/finances/delete-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    }).catch(() => {});
  } catch (e) {}
};

/**
 * Tracks deleted session log IDs to prevent stale cloud snapshots from resurrecting deleted sessions.
 */
export const getDeletedSessionIds = (): string[] => {
  try {
    const raw = localStorage.getItem('kaboom_deleted_session_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }
  } catch (e) {}
  return [];
};

export const recordDeletedSessionId = (sessionId: string): void => {
  if (!sessionId) return;
  try {
    const existing = getDeletedSessionIds();
    if (!existing.includes(sessionId)) {
      existing.push(sessionId);
      if (existing.length > 2000) existing.splice(0, existing.length - 2000);
      localStorage.setItem('kaboom_deleted_session_ids', JSON.stringify(existing));
    }
    fetch('/api/finances/delete-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  } catch (e) {}
};

function isPlayerDeletedLocally(id?: string, name?: string): boolean {
  try {
    const raw = localStorage.getItem('kaboom_deleted_players');
    if (!raw) return false;
    const deletedArr = JSON.parse(raw);
    if (!Array.isArray(deletedArr)) return false;
    const targetId = id ? String(id).trim() : '';
    const targetName = name ? String(name).toLowerCase().trim() : '';
    return deletedArr.some((dp: any) =>
      (targetId && dp.id && String(dp.id).trim() === targetId) ||
      (targetName && dp.name && String(dp.name).toLowerCase().trim() === targetName)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Gets the set of player IDs and normalized names removed from a specific league's finance roster.
 */
export const getRemovedFinancePlayers = (
  leagueType: LeagueFinanceType
): { ids: Set<string>; names: Set<string> } => {
  const ids = new Set<string>();
  const names = new Set<string>();
  try {
    const raw = localStorage.getItem(`kaboom_removed_finance_${leagueType}_players`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (typeof item === 'string') {
            ids.add(item.trim());
            names.add(item.trim().toLowerCase());
          } else if (item && typeof item === 'object') {
            if (item.id) ids.add(String(item.id).trim());
            if (item.name) names.add(String(item.name).trim().toLowerCase());
          }
        });
      }
    }
  } catch (e) {}
  return { ids, names };
};

/**
 * Checks if a player has been removed from a specific league's finances.
 */
export const isPlayerRemovedFromFinance = (
  leagueType: LeagueFinanceType,
  id?: string,
  name?: string
): boolean => {
  if (isPlayerDeletedLocally(id, name)) return true;
  if (!id && !name) return false;
  const { ids, names } = getRemovedFinancePlayers(leagueType);
  if (id && ids.has(String(id).trim())) return true;
  if (name && names.has(String(name).trim().toLowerCase())) return true;
  return false;
};

/**
 * Records that a player was intentionally removed from a specific league's finances.
 * Prevents background sync, polling, or Firestore snapshots from resurrecting them.
 */
export const recordRemovedFinancePlayer = (
  leagueType: LeagueFinanceType,
  playerId?: string,
  playerName?: string
): void => {
  try {
    const key = `kaboom_removed_finance_${leagueType}_players`;
    const raw = localStorage.getItem(key);
    let list: any[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) {}
    }
    if (!Array.isArray(list)) list = [];
    const trimmedId = (playerId || '').trim();
    const trimmedName = (playerName || '').trim().toLowerCase();
    const exists = list.some(item => {
      const iId = typeof item === 'string' ? item : item?.id;
      const iName = typeof item === 'object' ? item?.name?.toLowerCase().trim() : '';
      return (trimmedId && iId === trimmedId) || (trimmedName && iName === trimmedName);
    });
    if (!exists) {
      list.push({ id: trimmedId || undefined, name: playerName?.trim() || '', timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (e) {}
};

/**
 * Clears a player from the removed finance list if they are intentionally re-added to that league.
 */
export const unmarkRemovedFinancePlayer = (
  leagueType: LeagueFinanceType,
  playerId?: string,
  playerName?: string
): void => {
  try {
    const key = `kaboom_removed_finance_${leagueType}_players`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list: any[] = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const targetId = (playerId || '').trim();
    const targetName = (playerName || '').trim().toLowerCase();
    const filtered = list.filter(item => {
      const iId = typeof item === 'string' ? item : item?.id;
      const iName = typeof item === 'object' ? item?.name?.toLowerCase().trim() : '';
      if (targetId && iId === targetId) return false;
      if (targetName && iName === targetName) return false;
      return true;
    });
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {}
};

/**
 * Ensures strict deduplication of players in a league's finance roster.
 * Any duplicate records with the same normalized name are merged into a single player,
 * combining payment records without double-counting and strictly calculating totals.
 */
export const cleanAndDeduplicateFinancePlayers = (
  players: LeaguePlayerFinance[] = [],
  leagueType?: LeagueFinanceType
): LeaguePlayerFinance[] => {
  if (!Array.isArray(players) || players.length === 0) return [];
  const deletedPaymentIds = getDeletedPaymentIds();
  const deletedSet = new Set(deletedPaymentIds || []);

  const playerMap = new Map<string, LeaguePlayerFinance>();

  for (const raw of players) {
    if (!raw) continue;
    const pName = (raw.playerName || '').trim();
    if (!pName) continue;
    const nameKey = pName.toLowerCase();

    // Check if permanently deleted or removed from this specific league finance
    if (isPlayerDeletedLocally(raw.playerId, pName)) continue;
    if (leagueType && isPlayerRemovedFromFinance(leagueType, raw.playerId, pName)) continue;

    // Filter valid payment records
    const memPayments = (raw.membershipPayments || []).filter(m => m && m.id && !deletedSet.has(m.id));
    const dailyPayments = (raw.dailyFeePayments || []).filter(m => m && m.id && !deletedSet.has(m.id));
    const sparePayments = (raw.spareFeePayments || []).filter(m => m && m.id && !deletedSet.has(m.id));

    if (!playerMap.has(nameKey)) {
      const deposit = memPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const isMember = deposit > 0;
      const totalDaily = Math.min(DAILY_FEE_SEASON_MAX, dailyPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0));
      const isDailyFull = totalDaily >= DAILY_FEE_SEASON_MAX;
      const totalSpare = sparePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);

      playerMap.set(nameKey, {
        ...raw,
        playerName: pName,
        membershipDeposit: deposit,
        membershipPayments: memPayments,
        isMember,
        dailyFeeType: raw.dailyFeeType || (isMember ? 'member' : 'spare'),
        totalDailyFeesPaid: totalDaily,
        dailyFeePaidInFull: isDailyFull,
        dailyFeePaidDate: isDailyFull ? (raw.dailyFeePaidDate || new Date().toISOString()) : undefined,
        dailyFeePayments: dailyPayments,
        totalSpareFeesPaid: totalSpare,
        spareFeePayments: sparePayments,
        membershipPaidDate: deposit >= MEMBERSHIP_FEE ? (raw.membershipPaidDate || new Date().toISOString()) : undefined,
        updatedAt: raw.updatedAt || 0,
      });
    } else {
      // DUPLICATE DETECTED: Merge existing and duplicate entry cleanly
      const prev = playerMap.get(nameKey)!;

      const mergeP = <T extends { id: string; amount: number; timestamp?: number }>(listA: T[] = [], listB: T[] = []): T[] => {
        const m = new Map<string, T>();
        for (const item of [...listA, ...listB]) {
          if (!item || !item.id || deletedSet.has(item.id)) continue;
          m.set(item.id, item);
        }
        return Array.from(m.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      };

      const mergedMem = mergeP(prev.membershipPayments, memPayments);
      const memDeposit = mergedMem.reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const isMember = memDeposit > 0;

      const mergedDaily = mergeP(prev.dailyFeePayments, dailyPayments);
      const totalDaily = Math.min(DAILY_FEE_SEASON_MAX, mergedDaily.reduce((s, c) => s + (Number(c.amount) || 0), 0));
      const isDailyFull = totalDaily >= DAILY_FEE_SEASON_MAX;

      const mergedSpare = mergeP(prev.spareFeePayments, sparePayments);
      const totalSpare = mergedSpare.reduce((s, c) => s + (Number(c.amount) || 0), 0);

      // Prefer canonical roster ID if present in master roster
      let canonicalId = prev.playerId || raw.playerId;
      try {
        const rawClub = localStorage.getItem('kaboom_dart_players');
        if (rawClub) {
          const clubList: any[] = JSON.parse(rawClub);
          const matched = clubList.find(cp => cp.name?.trim().toLowerCase() === nameKey);
          if (matched && matched.id) canonicalId = matched.id;
        }
      } catch (e) {}

      playerMap.set(nameKey, {
        ...prev,
        ...raw,
        playerId: canonicalId,
        playerName: pName,
        avatar: raw.avatar || prev.avatar || '🎯',
        isMember,
        membershipDeposit: memDeposit,
        membershipPayments: mergedMem,
        membershipPaidDate: isMember ? (prev.membershipPaidDate || raw.membershipPaidDate || new Date().toISOString()) : undefined,
        dailyFeeActive: prev.dailyFeeActive || raw.dailyFeeActive || false,
        dailyFeeType: isMember ? 'member' : 'spare',
        totalDailyFeesPaid: totalDaily,
        dailyFeePaidInFull: isDailyFull,
        dailyFeePaidDate: isDailyFull ? (prev.dailyFeePaidDate || raw.dailyFeePaidDate || new Date().toISOString()) : undefined,
        dailyFeePayments: mergedDaily,
        totalSpareFeesPaid: totalSpare,
        spareFeePayments: mergedSpare,
        updatedAt: Math.max(prev.updatedAt || 0, raw.updatedAt || 0, Date.now()),
      });
    }
  }

  return Array.from(playerMap.values()).sort((a, b) => (a.playerName || '').localeCompare(b.playerName || ''));
};

/**
 * Robust smart merger for league finance players.
 * Combines payment records by ID, derives totals, and prevents overwriting newer payments with older stale lists.
 * Strictly guarantees unique player names per league (no duplicates).
 */
export const safeMergeFinancePlayers = (
  existing: LeaguePlayerFinance[] = [],
  incoming: LeaguePlayerFinance[] = [],
  deletedPaymentIds: string[] = getDeletedPaymentIds(),
  leagueType?: LeagueFinanceType
): LeaguePlayerFinance[] => {
  const deletedSet = new Set(deletedPaymentIds || []);

  const sanitizePlayer = (p: LeaguePlayerFinance): LeaguePlayerFinance => {
    const memPayments = (p.membershipPayments || []).filter(m => m && m.id && !deletedSet.has(m.id));
    const dailyPayments = (p.dailyFeePayments || []).filter(m => m && m.id && !deletedSet.has(m.id));
    const sparePayments = (p.spareFeePayments || []).filter(m => m && m.id && !deletedSet.has(m.id));

    // Totals MUST be strictly based on the transactions showing
    const memDeposit = memPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const isMember = memDeposit > 0;

    const totalDaily = Math.min(DAILY_FEE_SEASON_MAX, dailyPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const dailyFeePaidInFull = totalDaily >= DAILY_FEE_SEASON_MAX;

    const totalSpare = sparePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    return {
      ...p,
      membershipDeposit: memDeposit,
      membershipPayments: memPayments,
      isMember,
      dailyFeeType: p.dailyFeeType || (isMember ? 'member' : 'spare'),
      totalDailyFeesPaid: totalDaily,
      dailyFeePaidInFull,
      dailyFeePaidDate: dailyFeePaidInFull ? (p.dailyFeePaidDate || new Date().toISOString()) : undefined,
      dailyFeePayments: dailyPayments,
      totalSpareFeesPaid: totalSpare,
      spareFeePayments: sparePayments,
      membershipPaidDate: memDeposit >= MEMBERSHIP_FEE ? (p.membershipPaidDate || new Date().toISOString()) : undefined,
      updatedAt: p.updatedAt || 0,
    };
  };

  const isExcluded = (p: LeaguePlayerFinance): boolean => {
    if (!p) return true;
    const name = (p.playerName || '').trim();
    if (isPlayerDeletedLocally(p.playerId, name)) return true;
    if (leagueType && isPlayerRemovedFromFinance(leagueType, p.playerId, name)) return true;
    return false;
  };

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return cleanAndDeduplicateFinancePlayers(
      (existing || []).filter(p => !isExcluded(p)).map(sanitizePlayer),
      leagueType
    );
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    return cleanAndDeduplicateFinancePlayers(
      (incoming || []).filter(p => !isExcluded(p)).map(sanitizePlayer),
      leagueType
    );
  }

  const playerMap = new Map<string, LeaguePlayerFinance>();
  // Match by normalized player name to guarantee no duplicate rows
  const getKey = (p: LeaguePlayerFinance) =>
    (p.playerName ? p.playerName.trim().toLowerCase() : (p.playerId ? String(p.playerId).trim() : ''));

  existing.forEach(p => {
    if (!p || isExcluded(p)) return;
    const key = getKey(p);
    if (key) playerMap.set(key, sanitizePlayer(p));
  });

  incoming.forEach(incRaw => {
    if (!incRaw || isExcluded(incRaw)) return;
    const key = getKey(incRaw);
    if (!key) return;
    const inc = sanitizePlayer(incRaw);
    const prev = playerMap.get(key);

    if (!prev) {
      playerMap.set(key, inc);
      return;
    }

    const prevUpdated = prev.updatedAt || 0;
    const incUpdated = inc.updatedAt || 0;

    // Merge payments safely
    const mergeP = <T extends { id: string; amount: number; timestamp?: number }>(listA: T[] = [], listB: T[] = []): T[] => {
      const m = new Map<string, T>();
      for (const item of [...listA, ...listB]) {
        if (!item || !item.id || deletedSet.has(item.id)) continue;
        m.set(item.id, item);
      }
      return Array.from(m.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    };

    const mergedMem = mergeP(prev.membershipPayments, inc.membershipPayments);
    const memDeposit = mergedMem.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const isMember = memDeposit > 0;

    const mergedDaily = mergeP(prev.dailyFeePayments, inc.dailyFeePayments);
    const totalDaily = Math.min(DAILY_FEE_SEASON_MAX, mergedDaily.reduce((s, c) => s + (Number(c.amount) || 0), 0));
    const dailyFeePaidInFull = totalDaily >= DAILY_FEE_SEASON_MAX;

    const mergedSpare = mergeP(prev.spareFeePayments, inc.spareFeePayments);
    const totalSpare = mergedSpare.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    // Prefer canonical roster ID if one of them matches roster
    let canonicalId = prev.playerId || inc.playerId;
    try {
      const rawClub = localStorage.getItem('kaboom_dart_players');
      if (rawClub) {
        const clubList: any[] = JSON.parse(rawClub);
        const matched = clubList.find(cp => cp.name?.trim().toLowerCase() === key);
        if (matched && matched.id) canonicalId = matched.id;
      }
    } catch (e) {}

    playerMap.set(key, {
      ...prev,
      ...inc,
      playerId: canonicalId,
      avatar: inc.avatar || prev.avatar,
      playerName: inc.playerName || prev.playerName,
      isMember,
      membershipDeposit: memDeposit,
      membershipPayments: mergedMem,
      membershipPaidDate: isMember ? (inc.membershipPaidDate || prev.membershipPaidDate) : undefined,
      dailyFeeActive: prev.dailyFeeActive !== undefined ? prev.dailyFeeActive : inc.dailyFeeActive,
      dailyFeeType: isMember ? (inc.dailyFeeType || prev.dailyFeeType || 'member') : 'spare',
      totalDailyFeesPaid: totalDaily,
      dailyFeePaidInFull,
      dailyFeePaidDate: dailyFeePaidInFull ? (inc.dailyFeePaidDate || prev.dailyFeePaidDate) : undefined,
      dailyFeePayments: mergedDaily,
      totalSpareFeesPaid: totalSpare,
      spareFeePayments: mergedSpare,
      updatedAt: Math.max(prevUpdated, incUpdated, Date.now()),
    });
  });

  return Array.from(playerMap.values()).sort((a, b) => (a.playerName || '').localeCompare(b.playerName || ''));
};

/**
 * Robust smart merger for daily fee session logs.
 * Combines logs by unique session ID, avoiding loss or duplication.
 */
export const safeMergeSessionLogs = (
  existing: DailyFeeSessionLog[] = [],
  incoming: DailyFeeSessionLog[] = [],
  deletedSessionIds: string[] = getDeletedSessionIds()
): DailyFeeSessionLog[] => {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(s => !deletedSessionIds.includes(s.id));

  const deletedSet = new Set(deletedSessionIds);
  const logMap = new Map<string, DailyFeeSessionLog>();

  existing.forEach(log => {
    if (log && log.id && !deletedSet.has(log.id)) {
      logMap.set(log.id, log);
    }
  });

  incoming.forEach(log => {
    if (log && log.id && !deletedSet.has(log.id)) {
      if (!logMap.has(log.id)) {
        logMap.set(log.id, log);
      } else {
        const prev = logMap.get(log.id)!;
        logMap.set(log.id, { ...prev, ...log });
      }
    }
  });

  return Array.from(logMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.dateStr || '').localeCompare(a.dateStr || ''));
};

/**
 * Retrieves the finance player roster for a specific league.
 * Each league (Tuesday, Wednesday, Thursday) maintains its own independent financial roster and records.
 */
export const getLeagueFinancePlayers = (leagueType: LeagueFinanceType): LeaguePlayerFinance[] => {
  const storageKey = `kaboom_finance_${leagueType}_players`;
  let financePlayers: LeaguePlayerFinance[] = [];

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      financePlayers = JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Failed to parse ${storageKey}`, e);
  }

  // Strictly deduplicate and sanitize based on transactions showing and removed list
  const cleaned = cleanAndDeduplicateFinancePlayers(financePlayers, leagueType);

  // If deduplication merged duplicate rows or eliminated stale entries, sync changes immediately
  if (cleaned.length !== financePlayers.length || JSON.stringify(cleaned) !== JSON.stringify(financePlayers)) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      fetch(`/api/finances/${leagueType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: cleaned, replace: true }),
      }).catch(() => {});
    } catch (e) {}
  }

  return cleaned;
};

/**
 * Gets master club players who are NOT yet registered in this specific league's finance roster.
 */
export const getAvailableClubPlayersForLeague = (leagueType: LeagueFinanceType): { id: string; name: string; avatar: string }[] => {
  const currentFinancePlayers = getLeagueFinancePlayers(leagueType);
  const existingIds = new Set(currentFinancePlayers.map(p => p.playerId));
  const existingNames = new Set(currentFinancePlayers.map(p => p.playerName.trim().toLowerCase()));

  let clubPlayers: { id: string; name: string; avatar: string }[] = [];
  try {
    const saved = localStorage.getItem('kaboom_dart_players');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        clubPlayers = parsed;
      }
    }
  } catch (e) {}

  return clubPlayers.filter(p => !existingIds.has(p.id) && !existingNames.has(p.name?.trim().toLowerCase()));
};

/**
 * Adds an existing player from the club roster directly to this league's finance roster.
 */
export const addExistingClubPlayerToFinance = (
  leagueType: LeagueFinanceType,
  player: { id: string; name: string; avatar: string },
  initialDeposit: number = 0,
  initialNote?: string,
  initialDailyFeeOption: 'nightly' | 'full' | 'custom' = 'nightly',
  customDailyFeeAmount: number = 0
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const exists = players.some(
    p => p.playerId === player.id || p.playerName.trim().toLowerCase() === player.name.trim().toLowerCase()
  );
  if (exists) {
    throw new Error(`Player "${player.name}" is already registered in ${leagueType.toUpperCase()} finances.`);
  }

  const deposit = Math.max(0, initialDeposit);
  const isMember = deposit > 0;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const payments: MembershipPaymentRecord[] = deposit > 0 ? [
    {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: deposit,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: initialNote || (deposit >= MEMBERSHIP_FEE ? 'Full Membership Deposit' : 'Initial Installment Payment'),
    },
  ] : [];

  let dailyFeesPaid = 0;
  let isDailyFeeFull = false;
  const dfPayments: DailyFeePaymentRecord[] = [];

  if (initialDailyFeeOption === 'full') {
    dailyFeesPaid = DAILY_FEE_SEASON_MAX;
    isDailyFeeFull = true;
    dfPayments.push({
      id: `pay-df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: DAILY_FEE_SEASON_MAX,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: 'Paid in Full Season Daily Fee ($68.00)',
    });
  } else if (initialDailyFeeOption === 'custom' && customDailyFeeAmount > 0) {
    dailyFeesPaid = Math.min(DAILY_FEE_SEASON_MAX, customDailyFeeAmount);
    isDailyFeeFull = dailyFeesPaid >= DAILY_FEE_SEASON_MAX;
    dfPayments.push({
      id: `pay-df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: dailyFeesPaid,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: isDailyFeeFull ? 'Paid in Full Season Daily Fee ($68.00)' : `Initial Daily Fee Advance ($${dailyFeesPaid.toFixed(2)} / $68.00)`,
    });
  }

  const newPlayer: LeaguePlayerFinance = {
    playerId: player.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    playerName: player.name.trim(),
    avatar: player.avatar || '🎯',
    isMember,
    membershipDeposit: deposit,
    membershipPayments: payments,
    membershipPaidDate: deposit >= MEMBERSHIP_FEE ? new Date().toISOString() : undefined,
    dailyFeeActive: false,
    dailyFeeType: isMember ? 'member' : 'spare',
    totalDailyFeesPaid: dailyFeesPaid,
    dailyFeePaidInFull: isDailyFeeFull,
    dailyFeePaidDate: isDailyFeeFull ? new Date().toISOString() : undefined,
    dailyFeePayments: dfPayments,
    totalSpareFeesPaid: 0,
    spareFeePayments: [],
  };

  unmarkRemovedFinancePlayer(leagueType, player.id, player.name);
  const updated = [...players, newPlayer];
  saveLeagueFinancePlayers(leagueType, updated);
  return updated;
};

/**
 * Saves the finance player list for a specific league.
 */
export const saveLeagueFinancePlayers = (
  leagueType: LeagueFinanceType,
  players: LeaguePlayerFinance[],
  syncToCloud = true
): void => {
  const storageKey = `kaboom_finance_${leagueType}_players`;
  try {
    const stampedPlayers = players.map(p => ({
      ...p,
      updatedAt: p.updatedAt || Date.now(),
    }));
    localStorage.setItem(storageKey, JSON.stringify(stampedPlayers));

    // Immediately send update/mutation to backend API with replace: true so server persists exact authoritative state
    fetch(`/api/finances/${leagueType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players: stampedPlayers, replace: true }),
    }).catch(() => {});

    if (syncToCloud && stampedPlayers.length > 0) {
      syncFinancePlayersToCloud(leagueType, stampedPlayers);
    }
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey } }));
  } catch (e) {
    console.error(`Failed to save ${storageKey}`, e);
  }
};

/**
 * Records a partial or full membership payment installment for a player.
 */
export const recordMembershipPayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  amount: number,
  note?: string
): { updatedPlayers: LeaguePlayerFinance[]; paymentRecord: MembershipPaymentRecord } => {
  const players = getLeagueFinancePlayers(leagueType);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentRecord: MembershipPaymentRecord = {
    id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    amount: Math.max(0, amount),
    timestamp: Date.now(),
    dateStr: dateFormatted,
    note: note?.trim() || undefined,
  };

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.membershipPayments) ? [...p.membershipPayments] : [];
      existingPayments.push(paymentRecord);

      const totalPaid = existingPayments.reduce((acc, curr) => acc + curr.amount, 0);
      const isFullMember = totalPaid >= MEMBERSHIP_FEE;

      return {
        ...p,
        membershipDeposit: totalPaid,
        membershipPayments: existingPayments,
        isMember: totalPaid > 0,
        membershipPaidDate: isFullMember ? new Date().toISOString() : p.membershipPaidDate,
        dailyFeeType: 'member' as const, // Player paying towards membership gets member daily rate
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return { updatedPlayers, paymentRecord };
};

/**
 * Deletes a specific membership payment record (e.g. if entered in error).
 */
export const deleteMembershipPayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  paymentId: string
): LeaguePlayerFinance[] => {
  recordDeletedPaymentId(paymentId);
  const players = getLeagueFinancePlayers(leagueType);

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.membershipPayments)
        ? p.membershipPayments.filter(pay => pay.id !== paymentId)
        : [];
      
      const totalPaid = existingPayments.reduce((acc, curr) => acc + curr.amount, 0);
      const isMember = totalPaid > 0;

      return {
        ...p,
        membershipDeposit: totalPaid,
        membershipPayments: existingPayments,
        isMember,
        membershipPaidDate: totalPaid >= MEMBERSHIP_FEE ? p.membershipPaidDate : undefined,
        dailyFeeType: isMember ? p.dailyFeeType : ('spare' as const),
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Resets a player's membership payments back to $0 (Spare status).
 */
export const resetPlayerMembership = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);
  if (target?.membershipPayments && Array.isArray(target.membershipPayments)) {
    target.membershipPayments.forEach(m => {
      if (m && m.id) recordDeletedPaymentId(m.id);
    });
  }

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      return {
        ...p,
        isMember: false,
        membershipDeposit: 0.0,
        membershipPayments: [],
        membershipPaidDate: undefined,
        dailyFeeType: 'spare' as const,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Toggles a player's Membership on/off quickly.
 * If toggled ON -> records a full $40.00 payment (or completes remaining balance).
 * If toggled OFF -> resets deposit to $0.00.
 */
export const togglePlayerMembership = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);

  if (!target) return players;

  if (target.membershipDeposit > 0) {
    // If currently paid or partially paid, reset to $0 (Spare)
    return resetPlayerMembership(leagueType, playerId);
  } else {
    // If currently $0, record full $40 membership payment
    const result = recordMembershipPayment(leagueType, playerId, MEMBERSHIP_FEE, 'Full Membership Deposit');
    return result.updatedPlayers;
  }
};

/**
 * Sets player as paid in full for Membership ($40.00).
 */
export const setPlayerMembershipFull = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);
  if (!target) return players;

  const currentPaid = target.membershipDeposit || 0;
  const remaining = Math.max(0, MEMBERSHIP_FEE - currentPaid);

  if (remaining > 0) {
    const result = recordMembershipPayment(leagueType, playerId, remaining, currentPaid === 0 ? 'Full Membership Deposit' : 'Final Balance Payment');
    return result.updatedPlayers;
  }
  return players;
};

/**
 * Records an upfront, advance, or partial payment towards a player's $68.00 season daily fee.
 * Running total maxes out strictly at $68.00.
 */
export const recordDailyFeePayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  amount: number,
  note?: string
): { updatedPlayers: LeaguePlayerFinance[]; paymentRecord: DailyFeePaymentRecord } => {
  const players = getLeagueFinancePlayers(leagueType);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentRecord: DailyFeePaymentRecord = {
    id: `pay-df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    amount: Math.max(0, amount),
    timestamp: Date.now(),
    dateStr: dateFormatted,
    note: note?.trim() || undefined,
  };

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.dailyFeePayments) ? [...p.dailyFeePayments] : [];
      existingPayments.push(paymentRecord);

      const currentTotal = p.totalDailyFeesPaid || 0;
      const newTotal = Math.min(DAILY_FEE_SEASON_MAX, currentTotal + paymentRecord.amount);
      const isFull = newTotal >= DAILY_FEE_SEASON_MAX;

      return {
        ...p,
        totalDailyFeesPaid: newTotal,
        dailyFeePaidInFull: isFull,
        dailyFeePaidDate: isFull ? (p.dailyFeePaidDate || new Date().toISOString()) : undefined,
        dailyFeePayments: existingPayments,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return { updatedPlayers, paymentRecord };
};

/**
 * Sets a player's Daily Fee as Paid in Full ($68.00 max).
 * Either pays the remaining balance to reach $68.00 or marks as full.
 */
export const setPlayerDailyFeePaidInFull = (
  leagueType: LeagueFinanceType,
  playerId: string,
  note?: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);
  if (!target) return players;

  const currentPaid = target.totalDailyFeesPaid || 0;
  const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentRecord: DailyFeePaymentRecord = {
    id: `pay-df-full-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    amount: remaining > 0 ? remaining : 0,
    timestamp: Date.now(),
    dateStr: dateFormatted,
    note: note || (currentPaid === 0 ? 'Full Season Daily Fee ($68.00)' : `Paid Remaining Balance ($${remaining.toFixed(2)} to reach $68.00 max)`),
  };

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.dailyFeePayments) ? [...p.dailyFeePayments] : [];
      if (remaining > 0) {
        existingPayments.push(paymentRecord);
      }
      return {
        ...p,
        totalDailyFeesPaid: DAILY_FEE_SEASON_MAX,
        dailyFeePaidInFull: true,
        dailyFeePaidDate: new Date().toISOString(),
        dailyFeePayments: existingPayments,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Resets a player's Daily Fee running total to $0.00 and clears full-payment status.
 */
export const resetPlayerDailyFee = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);
  if (target?.dailyFeePayments && Array.isArray(target.dailyFeePayments)) {
    target.dailyFeePayments.forEach(m => {
      if (m && m.id) recordDeletedPaymentId(m.id);
    });
  }

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      return {
        ...p,
        totalDailyFeesPaid: 0.0,
        dailyFeePaidInFull: false,
        dailyFeePaidDate: undefined,
        dailyFeePayments: [],
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Deletes a specific daily fee payment record.
 */
export const deleteDailyFeePayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  paymentId: string
): LeaguePlayerFinance[] => {
  recordDeletedPaymentId(paymentId);
  const players = getLeagueFinancePlayers(leagueType);
  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.dailyFeePayments)
        ? p.dailyFeePayments.filter(pay => pay.id !== paymentId)
        : [];
      const totalPaid = Math.min(
        DAILY_FEE_SEASON_MAX,
        existingPayments.reduce((acc, curr) => acc + curr.amount, 0)
      );
      const isFull = totalPaid >= DAILY_FEE_SEASON_MAX;
      return {
        ...p,
        totalDailyFeesPaid: totalPaid,
        dailyFeePayments: existingPayments,
        dailyFeePaidInFull: isFull,
        dailyFeePaidDate: isFull ? p.dailyFeePaidDate : undefined,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Records a Season Spare Fee payment ($5.00 a night, with no $68 limit).
 */
export const recordSpareFeePayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  amount: number,
  note?: string
): { updatedPlayers: LeaguePlayerFinance[]; paymentRecord: SpareFeePaymentRecord } => {
  const players = getLeagueFinancePlayers(leagueType);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const paymentRecord: SpareFeePaymentRecord = {
    id: `pay-sf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    amount: Math.max(0, amount),
    timestamp: Date.now(),
    dateStr: dateFormatted,
    note: note?.trim() || undefined,
  };

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.spareFeePayments) ? [...p.spareFeePayments] : [];
      existingPayments.push(paymentRecord);

      const currentTotal = p.totalSpareFeesPaid || 0;
      const newTotal = currentTotal + paymentRecord.amount;

      return {
        ...p,
        totalSpareFeesPaid: newTotal,
        spareFeePayments: existingPayments,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return { updatedPlayers, paymentRecord };
};

/**
 * Resets a player's Season Spare Fee running total to $0.00 and clears payment records.
 */
export const resetPlayerSpareFee = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p => p.playerId === playerId);
  if (target?.spareFeePayments && Array.isArray(target.spareFeePayments)) {
    target.spareFeePayments.forEach(m => {
      if (m && m.id) recordDeletedPaymentId(m.id);
    });
  }

  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      return {
        ...p,
        totalSpareFeesPaid: 0.0,
        spareFeePayments: [],
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Deletes a specific spare fee payment record and updates the running total.
 */
export const deleteSpareFeePayment = (
  leagueType: LeagueFinanceType,
  playerId: string,
  paymentId: string
): LeaguePlayerFinance[] => {
  recordDeletedPaymentId(paymentId);
  const players = getLeagueFinancePlayers(leagueType);
  const updatedPlayers = players.map(p => {
    if (p.playerId === playerId) {
      const existingPayments = Array.isArray(p.spareFeePayments)
        ? p.spareFeePayments.filter(pay => pay.id !== paymentId)
        : [];
      const newTotal = existingPayments.reduce((acc, curr) => acc + curr.amount, 0);

      return {
        ...p,
        totalSpareFeesPaid: newTotal,
        spareFeePayments: existingPayments,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);
  return updatedPlayers;
};

/**
 * Toggles the Daily Fee collection slider for a player for tonight's session.
 */
export const togglePlayerDailyFee = (
  leagueType: LeagueFinanceType,
  playerId: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const updated = players.map(p => {
    if (p.playerId === playerId) {
      const nextActive = !p.dailyFeeActive;
      return {
        ...p,
        dailyFeeActive: nextActive,
        dailyFeeType: p.dailyFeeType || (p.membershipDeposit > 0 ? 'member' : 'spare'),
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updated);
  return updated;
};

/**
 * Sets the Daily Fee rate selection ('member' for $2.00 or 'spare' for $5.00)
 */
export const setPlayerDailyFeeType = (
  leagueType: LeagueFinanceType,
  playerId: string,
  type: 'member' | 'spare'
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const updated = players.map(p => {
    if (p.playerId === playerId) {
      return {
        ...p,
        dailyFeeActive: true, // Auto-activate if changing type
        dailyFeeType: type,
        updatedAt: Date.now(),
      };
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updated);
  return updated;
};

/**
 * Quick toggle all players' Daily Fee for fast bulk check-in
 */
export const setAllDailyFeeActive = (
  leagueType: LeagueFinanceType,
  active: boolean
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const updated = players.map(p => ({
    ...p,
    dailyFeeActive: active,
    dailyFeeType: (p.membershipDeposit > 0) ? ('member' as const) : ('spare' as const),
    updatedAt: Date.now(),
  }));

  saveLeagueFinancePlayers(leagueType, updated);
  return updated;
};

/**
 * Retrieves all submitted daily fee session logs across leagues or for a specific league.
 */
export const getDailyFeeSessionLogs = (leagueType?: LeagueFinanceType): DailyFeeSessionLog[] => {
  const storageKey = 'kaboom_finance_sessions';
  let logs: DailyFeeSessionLog[] = [];

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      logs = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load finance session logs', e);
  }

  if (leagueType) {
    return logs.filter(l => l.leagueType === leagueType).sort((a, b) => b.timestamp - a.timestamp);
  }

  return logs.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Saves daily fee session logs to local storage and syncs immediately to backend and cloud.
 */
export const saveDailyFeeSessionLogs = (logs: DailyFeeSessionLog[], syncToCloud = true): void => {
  const storageKey = 'kaboom_finance_sessions';
  try {
    localStorage.setItem(storageKey, JSON.stringify(logs));

    // Immediately push session mutation to backend API
    fetch('/api/finances/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: logs }),
    }).catch(() => {});

    if (syncToCloud && logs.length > 0) {
      syncFinanceSessionsToCloud(logs);
    }
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: storageKey } }));
  } catch (e) {
    console.error('Failed to save finance session log', e);
  }
};

/**
 * Submits tonight's daily fee collection.
 * For members paying $2.00/night: adds $2.00 to their running total up to $68.00 max.
 * If a member has already paid $68.00 in full, fee collected tonight is $0.00 (prepaid).
 * Spares pay $5.00 nightly.
 */
export const submitDailyFeeSession = (
  leagueType: LeagueFinanceType,
  note?: string
): { success: boolean; sessionLog?: DailyFeeSessionLog; error?: string } => {
  const players = getLeagueFinancePlayers(leagueType);
  const activePlayers = players.filter(p => p.dailyFeeActive);

  if (activePlayers.length === 0) {
    return {
      success: false,
      error: "No players are currently toggled ON for tonight's daily fee collection. Turn ON the Daily Fee slider for participating players first.",
    };
  }

  const attendingRecords: DailyFeeSessionLog['playersAttending'] = [];
  let memberCount = 0;
  let spareCount = 0;
  let memberTotal = 0;
  let spareTotal = 0;
  let prepaidCount = 0;

  activePlayers.forEach(p => {
    if (p.dailyFeeType === 'member') {
      const currentPaid = p.totalDailyFeesPaid || 0;
      const isPrepaid = Boolean(p.dailyFeePaidInFull || currentPaid >= DAILY_FEE_SEASON_MAX);

      if (isPrepaid) {
        prepaidCount += 1;
        attendingRecords.push({
          playerId: p.playerId,
          playerName: p.playerName,
          avatar: p.avatar,
          type: 'member',
          fee: 0,
          isPrepaid: true,
        });
      } else {
        const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);
        const fee = Math.min(DAILY_FEE_MEMBER, remaining);
        memberCount += 1;
        memberTotal += fee;
        attendingRecords.push({
          playerId: p.playerId,
          playerName: p.playerName,
          avatar: p.avatar,
          type: 'member',
          fee,
          isPrepaid: false,
        });
      }
    } else {
      spareCount += 1;
      spareTotal += DAILY_FEE_SPARE;
      attendingRecords.push({
        playerId: p.playerId,
        playerName: p.playerName,
        avatar: p.avatar,
        type: 'spare',
        fee: DAILY_FEE_SPARE,
        isPrepaid: false,
      });
    }
  });

  const totalAmount = memberTotal + spareTotal;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const newLog: DailyFeeSessionLog = {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    leagueType,
    timestamp: Date.now(),
    dateStr: dateFormatted,
    totalAmount,
    memberCount,
    spareCount,
    memberTotal,
    spareTotal,
    prepaidCount,
    playersAttending: attendingRecords,
    note: note || undefined,
  };

  // 1. Save Session Log
  try {
    const allLogs = getDailyFeeSessionLogs();
    allLogs.unshift(newLog);
    saveDailyFeeSessionLogs(allLogs);
  } catch (e) {
    console.error('Failed to save finance session log', e);
    return { success: false, error: 'Storage error saving session record.' };
  }

  // 2. Update players: add to running total (up to $68 max) and reset dailyFeeActive
  const updatedPlayers = players.map(p => {
    if (p.dailyFeeActive) {
      if (p.dailyFeeType === 'member') {
        const currentPaid = p.totalDailyFeesPaid || 0;
        const isAlreadyFull = Boolean(p.dailyFeePaidInFull || currentPaid >= DAILY_FEE_SEASON_MAX);

        if (isAlreadyFull) {
          return {
            ...p,
            totalDailyFeesPaid: DAILY_FEE_SEASON_MAX,
            dailyFeePaidInFull: true,
            dailyFeeActive: false,
            updatedAt: Date.now(),
          };
        }

        const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);
        const fee = Math.min(DAILY_FEE_MEMBER, remaining);
        const newPaid = Math.min(DAILY_FEE_SEASON_MAX, currentPaid + fee);
        const isNowFull = newPaid >= DAILY_FEE_SEASON_MAX;

        const newPayments: DailyFeePaymentRecord[] = Array.isArray(p.dailyFeePayments) ? [...p.dailyFeePayments] : [];
        if (fee > 0) {
          newPayments.push({
            id: `pay-session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            amount: fee,
            timestamp: Date.now(),
            dateStr: dateFormatted,
            note: isNowFull ? 'Nightly Fee - Reached $68.00 Max (Paid in Full)' : `Nightly Fee ($2.00) - Running Total: $${newPaid.toFixed(2)} / $68.00`,
          });
        }

        return {
          ...p,
          totalDailyFeesPaid: newPaid,
          dailyFeePaidInFull: isNowFull,
          dailyFeePaidDate: isNowFull ? (p.dailyFeePaidDate || new Date().toISOString()) : undefined,
          dailyFeePayments: newPayments,
          dailyFeeActive: false,
          updatedAt: Date.now(),
        };
      } else {
        // Spare player pays $5.00
        const newPaid = (p.totalDailyFeesPaid || 0) + DAILY_FEE_SPARE;
        const newPayments: DailyFeePaymentRecord[] = Array.isArray(p.dailyFeePayments) ? [...p.dailyFeePayments] : [];
        newPayments.push({
          id: `pay-session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          amount: DAILY_FEE_SPARE,
          timestamp: Date.now(),
          dateStr: dateFormatted,
          note: 'Spare Nightly Fee ($5.00)',
        });

        // Also update spare fees
        const currentSpare = p.totalSpareFeesPaid || 0;
        const newSparePaid = currentSpare + DAILY_FEE_SPARE;
        const newSparePayments: SpareFeePaymentRecord[] = Array.isArray(p.spareFeePayments) ? [...p.spareFeePayments] : [];
        newSparePayments.push({
          id: `pay-sf-session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          amount: DAILY_FEE_SPARE,
          timestamp: Date.now(),
          dateStr: dateFormatted,
          note: 'Spare Nightly Fee ($5.00)',
        });

        return {
          ...p,
          totalDailyFeesPaid: newPaid,
          dailyFeePayments: newPayments,
          totalSpareFeesPaid: newSparePaid,
          spareFeePayments: newSparePayments,
          dailyFeeActive: false,
          updatedAt: Date.now(),
        };
      }
    }
    return p;
  });

  saveLeagueFinancePlayers(leagueType, updatedPlayers);

  return { success: true, sessionLog: newLog };
};

/**
 * Deletes a session log (reverses its financial impact on totals).
 */
export const deleteDailyFeeSessionLog = (sessionId: string): boolean => {
  try {
    const logs = getDailyFeeSessionLogs();
    const target = logs.find(l => l.id === sessionId);
    if (!target) return false;

    const filtered = logs.filter(l => l.id !== sessionId);
    recordDeletedSessionId(sessionId);
    saveDailyFeeSessionLogs(filtered);

    // Also remove session payment records and update totals from remaining transactions
    const players = getLeagueFinancePlayers(target.leagueType);
    const updated = players.map(p => {
      const attendee = target.playersAttending.find(a => a.playerId === p.playerId);
      if (attendee && attendee.fee > 0) {
        const dfPayments = (p.dailyFeePayments || []).filter(pay => {
          if (pay.note && pay.note.includes(target.dateStr)) return false;
          if (Math.abs((pay.timestamp || 0) - target.timestamp) < 60000) return false;
          return true;
        });
        const sfPayments = (p.spareFeePayments || []).filter(pay => {
          if (pay.note && pay.note.includes(target.dateStr)) return false;
          if (Math.abs((pay.timestamp || 0) - target.timestamp) < 60000) return false;
          return true;
        });

        const newTotal = Math.min(DAILY_FEE_SEASON_MAX, dfPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0));
        const isStillFull = p.dailyFeeType === 'member' ? (newTotal >= DAILY_FEE_SEASON_MAX) : false;
        const newSpareTotal = sfPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0);

        return {
          ...p,
          totalDailyFeesPaid: newTotal,
          dailyFeePaidInFull: isStillFull,
          dailyFeePaidDate: isStillFull ? p.dailyFeePaidDate : undefined,
          dailyFeePayments: dfPayments,
          totalSpareFeesPaid: newSpareTotal,
          spareFeePayments: sfPayments,
          updatedAt: Date.now(),
        };
      }
      return p;
    });
    saveLeagueFinancePlayers(target.leagueType, updated);

    return true;
  } catch (e) {
    console.error('Failed to delete session log', e);
    return false;
  }
};

/**
 * Calculates current totals for a specific league:
 * 1. Membership Deposits Total (sum of all full + partial deposits paid)
 * 2. Daily Fees Total (all historic session logs & upfront payments for this league)
 * 3. Running total and Paid in Full stats for the $68.00 season fee
 * 4. Total Financial Balance = (1) + (2)
 */
export const calculateLeagueFinanceTotals = (leagueType: LeagueFinanceType): LeagueFinanceTotals => {
  const players = getLeagueFinancePlayers(leagueType);
  const sessionLogs = getDailyFeeSessionLogs(leagueType);

  let memberCount = 0;
  let partialMemberCount = 0;
  let spareCount = 0;
  let memberDepositsTotal = 0;
  let expectedDeposits = 0;

  let dailyFeePaidInFullCount = 0;
  let dailyFeeRunningCount = 0;
  let memberDailyFeesPaid = 0;
  let spareDailyFeesPaid = 0;
  let spareFeesTotal = 0;

  players.forEach(p => {
    const deposit = p.membershipDeposit || 0;
    memberDepositsTotal += deposit;

    const isMem = deposit >= MEMBERSHIP_FEE;
    const isPartMem = !isMem && deposit > 0;

    if (isMem) {
      memberCount += 1;
      expectedDeposits += MEMBERSHIP_FEE;
    } else if (isPartMem) {
      partialMemberCount += 1;
      expectedDeposits += MEMBERSHIP_FEE;
    } else {
      spareCount += 1;
    }

    const dfPaid = p.totalDailyFeesPaid || 0;
    if (isMem || isPartMem || p.dailyFeeType === 'member') {
      memberDailyFeesPaid += dfPaid;
      if (dfPaid >= DAILY_FEE_SEASON_MAX || p.dailyFeePaidInFull) {
        dailyFeePaidInFullCount += 1;
      } else if (dfPaid > 0) {
        dailyFeeRunningCount += 1;
      }
    } else {
      spareDailyFeesPaid += dfPaid;
    }

    const sfPaid = p.totalSpareFeesPaid || 0;
    spareFeesTotal += sfPaid;
  });

  // Calculate session logs amount to ensure any spare session fees not tied to current players are covered
  const sessionLogsTotal = sessionLogs.reduce((acc, log) => acc + log.totalAmount, 0);
  const playerDailyFeesTotal = memberDailyFeesPaid + spareDailyFeesPaid;
  const finalDailyFeesTotal = Math.max(playerDailyFeesTotal, sessionLogsTotal);
  const totalMembershipOutstanding = Math.max(0, expectedDeposits - memberDepositsTotal);

  // Draws Share calculation for this specific league
  const drawsSummary = getDrawsFinanceSummary(leagueType);
  const drawsLeagueShare = drawsSummary.totalDrawsLeagueShare || 0;
  const totalBalance = memberDepositsTotal + finalDailyFeesTotal + spareFeesTotal;
  const totalBalanceWithDraws = Math.round((totalBalance + drawsLeagueShare) * 100) / 100;

  // Expected season daily fees for members ($68.00 per member):
  const expectedSeasonDailyFees = (memberCount + partialMemberCount) * DAILY_FEE_SEASON_MAX;
  const dailyFeeOutstanding = Math.max(0, expectedSeasonDailyFees - memberDailyFeesPaid);

  return {
    memberDepositsTotal,
    dailyFeesTotal: finalDailyFeesTotal,
    spareFeesTotal,
    drawsLeagueShare,
    totalBalance,
    totalBalanceWithDraws,
    memberCount,
    partialMemberCount,
    spareCount,
    totalPlayers: players.length,
    totalMembershipOutstanding,
    dailyFeePaidInFullCount,
    dailyFeeRunningCount,
    dailyFeeOutstanding,
  };
};

/**
 * Calculates grand summary across all 3 leagues.
 */
export const calculateOverallFinanceTotals = () => {
  const tuesday = calculateLeagueFinanceTotals('tuesday');
  const wednesday = calculateLeagueFinanceTotals('wednesday');
  const thursday = calculateLeagueFinanceTotals('thursday');

  const memberDepositsTotal = tuesday.memberDepositsTotal + wednesday.memberDepositsTotal + thursday.memberDepositsTotal;
  const dailyFeesTotal = tuesday.dailyFeesTotal + wednesday.dailyFeesTotal + thursday.dailyFeesTotal;
  const spareFeesTotal = (tuesday.spareFeesTotal || 0) + (wednesday.spareFeesTotal || 0) + (thursday.spareFeesTotal || 0);
  const totalDrawsLeagueShare = (tuesday.drawsLeagueShare || 0) + (wednesday.drawsLeagueShare || 0) + (thursday.drawsLeagueShare || 0);
  const totalBalance = memberDepositsTotal + dailyFeesTotal + spareFeesTotal;
  const totalBalanceWithDraws = Math.round((totalBalance + totalDrawsLeagueShare) * 100) / 100;

  const totalMembers = tuesday.memberCount + wednesday.memberCount + thursday.memberCount;
  const totalPartialMembers = (tuesday.partialMemberCount || 0) + (wednesday.partialMemberCount || 0) + (thursday.partialMemberCount || 0);
  const totalSpares = tuesday.spareCount + wednesday.spareCount + thursday.spareCount;
  const totalMembershipOutstanding = (tuesday.totalMembershipOutstanding || 0) + (wednesday.totalMembershipOutstanding || 0) + (thursday.totalMembershipOutstanding || 0);

  const dailyFeePaidInFullCount = (tuesday.dailyFeePaidInFullCount || 0) + (wednesday.dailyFeePaidInFullCount || 0) + (thursday.dailyFeePaidInFullCount || 0);
  const dailyFeeRunningCount = (tuesday.dailyFeeRunningCount || 0) + (wednesday.dailyFeeRunningCount || 0) + (thursday.dailyFeeRunningCount || 0);
  const dailyFeeOutstanding = (tuesday.dailyFeeOutstanding || 0) + (wednesday.dailyFeeOutstanding || 0) + (thursday.dailyFeeOutstanding || 0);

  return {
    memberDepositsTotal,
    dailyFeesTotal,
    spareFeesTotal,
    totalDrawsLeagueShare,
    totalBalance,
    totalBalanceWithDraws,
    totalMembers,
    totalPartialMembers,
    totalSpares,
    totalMembershipOutstanding,
    dailyFeePaidInFullCount,
    dailyFeeRunningCount,
    dailyFeeOutstanding,
    tuesday,
    wednesday,
    thursday,
  };
};

/**
 * Adds a new player directly to a league's finance roster.
 */
export const addPlayerToLeagueFinance = (
  leagueType: LeagueFinanceType,
  name: string,
  avatar: string = '🎯',
  initialDeposit: number = 0,
  initialNote?: string,
  initialDailyFeeOption: 'nightly' | 'full' | 'custom' = 'nightly',
  customDailyFeeAmount: number = 0
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const trimmedName = name.trim();

  // Prevent duplicate players with the same name
  const exists = players.some(
    p => p.playerName.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (exists) {
    throw new Error(`Player already exists! "${trimmedName}" is already registered in this finance roster.`);
  }

  const deposit = Math.max(0, initialDeposit);
  const isMember = deposit > 0;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const payments: MembershipPaymentRecord[] = deposit > 0 ? [
    {
      id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: deposit,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: initialNote || (deposit >= MEMBERSHIP_FEE ? 'Full Membership Deposit' : 'Initial Installment Payment'),
    },
  ] : [];

  let dailyFeesPaid = 0;
  let isDailyFeeFull = false;
  const dfPayments: DailyFeePaymentRecord[] = [];

  if (initialDailyFeeOption === 'full') {
    dailyFeesPaid = DAILY_FEE_SEASON_MAX;
    isDailyFeeFull = true;
    dfPayments.push({
      id: `pay-df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: DAILY_FEE_SEASON_MAX,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: 'Paid in Full Season Daily Fee ($68.00)',
    });
  } else if (initialDailyFeeOption === 'custom' && customDailyFeeAmount > 0) {
    dailyFeesPaid = Math.min(DAILY_FEE_SEASON_MAX, customDailyFeeAmount);
    isDailyFeeFull = dailyFeesPaid >= DAILY_FEE_SEASON_MAX;
    dfPayments.push({
      id: `pay-df-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      amount: dailyFeesPaid,
      timestamp: Date.now(),
      dateStr: dateFormatted,
      note: isDailyFeeFull ? 'Paid in Full Season Daily Fee ($68.00)' : `Initial Daily Fee Advance ($${dailyFeesPaid.toFixed(2)} / $68.00)`,
    });
  }

  const newPlayer: LeaguePlayerFinance = {
    playerId: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    playerName: name.trim(),
    avatar: avatar || '🎯',
    isMember,
    membershipDeposit: deposit,
    membershipPayments: payments,
    membershipPaidDate: deposit >= MEMBERSHIP_FEE ? new Date().toISOString() : undefined,
    dailyFeeActive: false,
    dailyFeeType: isMember ? 'member' : 'spare',
    totalDailyFeesPaid: dailyFeesPaid,
    dailyFeePaidInFull: isDailyFeeFull,
    dailyFeePaidDate: isDailyFeeFull ? new Date().toISOString() : undefined,
    dailyFeePayments: dfPayments,
    totalSpareFeesPaid: 0,
    spareFeePayments: [],
  };

  unmarkRemovedFinancePlayer(leagueType, newPlayer.playerId, newPlayer.playerName);
  const updated = [...players, newPlayer];
  saveLeagueFinancePlayers(leagueType, updated);

  // Also persist to master player roster so the player is immediately available across all leagues
  try {
    const savedProfiles = localStorage.getItem('kaboom_dart_players');
    const profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
    if (!profiles.some((p: any) => p.name?.trim().toLowerCase() === name.trim().toLowerCase())) {
      const newProf = {
        id: newPlayer.playerId,
        name: newPlayer.playerName,
        avatar: newPlayer.avatar || '🎯',
        matchesPlayed: 0,
        matchesWon: 0,
        careerAvg: 0,
        highCheckout: 0,
        total180s: 0,
      };
      const updatedRoster = [...profiles, newProf];
      localStorage.setItem('kaboom_dart_players', JSON.stringify(updatedRoster));
      syncPlayerRosterToCloud(updatedRoster);
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players' } }));
    }
  } catch (e) {}

  return updated;
};

/**
 * Removes a player from the league finance roster.
 * Records a persistent removal record to prevent resurrection from background sync or Firestore.
 */
export const removePlayerFromLeagueFinance = (
  leagueType: LeagueFinanceType,
  playerId: string,
  playerName?: string
): LeaguePlayerFinance[] => {
  const players = getLeagueFinancePlayers(leagueType);
  const target = players.find(p =>
    (playerId && p.playerId === playerId) ||
    (playerName && p.playerName.trim().toLowerCase() === playerName.trim().toLowerCase())
  );
  const resolvedName = target?.playerName || playerName || '';
  const resolvedId = target?.playerId || playerId;

  // Record so safeMerge and background polling will not resurrect this player
  recordRemovedFinancePlayer(leagueType, resolvedId, resolvedName);

  // Notify server endpoint
  fetch(`/api/finances/${leagueType}/remove-player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: resolvedId, playerName: resolvedName }),
  }).catch(() => {});

  const updated = players.filter(p => {
    if (resolvedId && p.playerId === resolvedId) return false;
    if (resolvedName && p.playerName.trim().toLowerCase() === resolvedName.trim().toLowerCase()) return false;
    return true;
  });

  saveLeagueFinancePlayers(leagueType, updated, true);
  return updated;
};
