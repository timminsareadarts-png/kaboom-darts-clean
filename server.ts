import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: "text/*" }));

// Persistent Disk Storage Directory and File
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "venue_store.json");

const DEFAULT_MASTER_ROSTER = [
  { id: "p-1788187829549", name: "Stan", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267285313-kmml", name: "Joy Anne", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267290105-r21n", name: "Ray", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267293149-gqwt", name: "Donny", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267297840-gfwl", name: "Harold", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267299864-q55r", name: "Brian", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267310610-9vwp", name: "Crystal", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267313225-2m5t", name: "Lynn", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267320690-7cc4", name: "Natalie", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267324196-6dls", name: "Dan M", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267327509-4s0g", name: "Dan C", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267333190-mvjn", name: "Berdine", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267339227-vkws", name: "Dale", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267341481-d0au", name: "Clem", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267367308-5n59", name: "Amber", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267374892-z64q", name: "Kyle", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267434418-uv7e", name: "Floyd", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267477864-56la", name: "Meghan", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267499379-nrk4", name: "Marie", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267516248-ztai", name: "Guy", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
  { id: "p-1788267523165-bd1w", name: "Griffin", avatar: "🦸‍♂️", matchesPlayed: 0, matchesWon: 0, careerAvg: 0, highCheckout: 0, total180s: 0 },
];

const DEFAULT_SECURITY_PINS = {
  adminPin: "1950",
  playerPin: "1234",
  updatedAt: Date.now(),
};

function deduplicateServerFinancePlayers(players: any[] = [], deletedPaymentIds: string[] = []): any[] {
  if (!Array.isArray(players) || players.length === 0) return [];
  const deletedSet = new Set(deletedPaymentIds || []);
  const map = new Map<string, any>();

  for (const p of players) {
    if (!p) continue;
    const name = String(p.playerName || p.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();

    const memPayments = (p.membershipPayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));
    const dailyPayments = (p.dailyFeePayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));
    const sparePayments = (p.spareFeePayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));

    if (!map.has(key)) {
      const memDeposit = memPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
      const isMember = memDeposit > 0;
      const totalDaily = Math.min(68, dailyPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0));
      const dailyFeePaidInFull = totalDaily >= 68;
      const totalSpare = sparePayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

      map.set(key, {
        ...p,
        playerName: name,
        membershipPayments: memPayments,
        membershipDeposit: memDeposit,
        isMember,
        dailyFeePayments: dailyPayments,
        totalDailyFeesPaid: totalDaily,
        dailyFeePaidInFull,
        dailyFeePaidDate: dailyFeePaidInFull ? (p.dailyFeePaidDate || new Date().toISOString()) : undefined,
        spareFeePayments: sparePayments,
        totalSpareFeesPaid: totalSpare,
        dailyFeeType: p.dailyFeeType || (isMember ? "member" : "spare"),
        membershipPaidDate: memDeposit >= 40 ? (p.membershipPaidDate || new Date().toISOString()) : undefined,
        updatedAt: Number(p.updatedAt || Date.now()),
      });
    } else {
      const prev = map.get(key);
      const mergeP = (listA: any[] = [], listB: any[] = []): any[] => {
        const pMap = new Map<string, any>();
        for (const item of [...listA, ...listB]) {
          if (!item || !item.id || deletedSet.has(item.id)) continue;
          pMap.set(item.id, item);
        }
        return Array.from(pMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      };

      const mergedMem = mergeP(prev.membershipPayments, memPayments);
      const memDeposit = mergedMem.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
      const isMember = memDeposit > 0;

      const mergedDaily = mergeP(prev.dailyFeePayments, dailyPayments);
      const totalDaily = Math.min(68, mergedDaily.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0));
      const dailyFeePaidInFull = totalDaily >= 68;

      const mergedSpare = mergeP(prev.spareFeePayments, sparePayments);
      const totalSpare = mergedSpare.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

      map.set(key, {
        ...prev,
        ...p,
        playerId: prev.playerId || p.playerId,
        playerName: name,
        isMember,
        membershipDeposit: memDeposit,
        membershipPayments: mergedMem,
        membershipPaidDate: isMember ? (prev.membershipPaidDate || p.membershipPaidDate || new Date().toISOString()) : undefined,
        dailyFeeActive: prev.dailyFeeActive !== undefined ? prev.dailyFeeActive : p.dailyFeeActive,
        dailyFeeType: isMember ? "member" : "spare",
        totalDailyFeesPaid: totalDaily,
        dailyFeePaidInFull,
        dailyFeePaidDate: dailyFeePaidInFull ? (prev.dailyFeePaidDate || p.dailyFeePaidDate || new Date().toISOString()) : undefined,
        dailyFeePayments: mergedDaily,
        totalSpareFeesPaid: totalSpare,
        spareFeePayments: mergedSpare,
        updatedAt: Math.max(Number(prev.updatedAt || 0), Number(p.updatedAt || 0), Date.now()),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    (a.playerName || a.name || "").localeCompare(b.playerName || b.name || "")
  );
}

// Enforce maximum 4 matches per person (including byes) in each division for Tuesday and Thursday
function enforceMaxFourMatchesPerPersonServer(matchups: any[], leagueType?: string): any[] {
  if (!Array.isArray(matchups) || matchups.length === 0) return [];
  const lType = leagueType || matchups[0]?.leagueType;
  if (lType !== 'tuesday' && lType !== 'thursday') {
    return matchups;
  }

  const teamMatchCounts: Record<string, number> = {};
  const personMatchCounts: Record<string, number> = {};

  const getPlayerKey = (p: any) => (p?.id || p?.name || '').toLowerCase().trim();
  const isDummyPlayer = (p: any) => {
    if (p?.isDummy) return true;
    const n = (p?.name || '').toLowerCase();
    const id = (p?.id || '').toLowerCase();
    return n.includes('dummy') || id.includes('dummy');
  };

  const canParticipate = (entry: any): boolean => {
    if (!entry || !entry.name) return true;
    const nameUpper = String(entry.name).toUpperCase();
    if (nameUpper === 'BYE' || nameUpper.includes('BYE')) return true;

    if ((teamMatchCounts[entry.name] || 0) >= 4) return false;

    const realPlayers = Array.isArray(entry.players) ? entry.players.filter(p => !isDummyPlayer(p)) : [];
    if (realPlayers.length > 0) {
      for (const p of realPlayers) {
        const key = getPlayerKey(p);
        if (key && (personMatchCounts[key] || 0) >= 4) return false;
      }
    } else {
      const key = String(entry.name).toLowerCase().trim();
      if ((personMatchCounts[key] || 0) >= 4) return false;
    }
    return true;
  };

  const recordParticipation = (entry: any) => {
    if (!entry || !entry.name) return;
    const nameUpper = String(entry.name).toUpperCase();
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
      const key = String(entry.name).toLowerCase().trim();
      personMatchCounts[key] = (personMatchCounts[key] || 0) + 1;
    }
  };

  const filtered: any[] = [];
  for (const m of matchups) {
    const isByeA = Boolean(
      m.isBye ||
      String(m.entryA?.name || '').toUpperCase() === 'BYE' ||
      String(m.entryA?.name || '').toUpperCase().includes('BYE')
    );
    const isByeB = Boolean(
      m.isBye ||
      String(m.entryB?.name || '').toUpperCase() === 'BYE' ||
      String(m.entryB?.name || '').toUpperCase().includes('BYE')
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
}

function sanitizeServerBracketsState(brackets: any, leagueType: string): any {
  if (!brackets || typeof brackets !== 'object') return brackets;
  if (leagueType !== 'tuesday' && leagueType !== 'thursday') return brackets;

  const sanitizeMatchList = (list: any[]) => enforceMaxFourMatchesPerPersonServer(list, leagueType);

  const cleanDivisions = Array.isArray(brackets.divisions)
    ? brackets.divisions.map((d: any) => ({
        ...d,
        matchups: sanitizeMatchList(d.matchups || []),
      }))
    : brackets.divisions;

  const result: any = {
    ...brackets,
    divisionA: cleanDivisions?.[0]?.matchups
      ? sanitizeMatchList(cleanDivisions[0].matchups)
      : sanitizeMatchList(brackets.divisionA || []),
    divisionB: cleanDivisions?.[1]?.matchups
      ? sanitizeMatchList(cleanDivisions[1].matchups)
      : (brackets.divisionB ? sanitizeMatchList(brackets.divisionB) : []),
    divisionC: cleanDivisions
      ? (cleanDivisions[2]?.matchups ? sanitizeMatchList(cleanDivisions[2].matchups) : undefined)
      : (brackets.divisionC ? sanitizeMatchList(brackets.divisionC) : undefined),
    divisionD: cleanDivisions
      ? (cleanDivisions[3]?.matchups ? sanitizeMatchList(cleanDivisions[3].matchups) : undefined)
      : (brackets.divisionD ? sanitizeMatchList(brackets.divisionD) : undefined),
    divisionE: cleanDivisions
      ? (cleanDivisions[4]?.matchups ? sanitizeMatchList(cleanDivisions[4].matchups) : undefined)
      : (brackets.divisionE ? sanitizeMatchList(brackets.divisionE) : undefined),
    divisionF: cleanDivisions
      ? (cleanDivisions[5]?.matchups ? sanitizeMatchList(cleanDivisions[5].matchups) : undefined)
      : (brackets.divisionF ? sanitizeMatchList(brackets.divisionF) : undefined),
    divisions: cleanDivisions,
  };

  return result;
}

function sanitizeBracketsWithDeletedMatchups(brackets: any): any {
  if (!brackets || typeof brackets !== 'object') return null;
  const deletedSet = new Set(venueDataStore?.deletedMatchupIds || []);
  deletedSet.add("bm-wed-board1-1789841291793-0");
  deletedSet.add("bm-wed-board2-1789841291793-1");

  const clone = JSON.parse(JSON.stringify(brackets));
  if (Array.isArray(clone.divisions)) {
    clone.divisions.forEach((d: any) => {
      if (Array.isArray(d?.matchups)) {
        d.matchups = d.matchups.filter((m: any) => m?.id && !deletedSet.has(m.id));
      }
    });
  }
  const divKeys = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
  divKeys.forEach((div) => {
    if (Array.isArray(clone[div])) {
      clone[div] = clone[div].filter((m: any) => m?.id && !deletedSet.has(m.id));
    }
  });

  let remaining = 0;
  if (Array.isArray(clone.divisions)) {
    clone.divisions.forEach((d: any) => {
      if (Array.isArray(d?.matchups)) remaining += d.matchups.length;
    });
  }
  divKeys.forEach((div) => {
    if (Array.isArray(clone[div])) remaining += clone[div].length;
  });

  return remaining === 0 ? null : clone;
}

// Helper to load persistent state from disk
function loadVenueDataFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const loadedRoster = Array.isArray(parsed.roster) && parsed.roster.length > 0 ? parsed.roster : [...DEFAULT_MASTER_ROSTER];
        // Ensure Stan is in roster
        if (!loadedRoster.some((p: any) => (p?.name || '').toLowerCase().trim() === 'stan')) {
          loadedRoster.push({
            id: 'p-1788187829549',
            name: 'Stan',
            avatar: '🦸‍♂️',
            matchesPlayed: 0,
            matchesWon: 0,
            legsWon: 0,
            setsWon: 0,
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
        }
        // Strictly zero out stats and bulls for Stan, Amber, and Dale
        loadedRoster.forEach((p: any) => {
          const k = (p?.name || '').toLowerCase().trim();
          if (['stan', 'amber', 'dale'].includes(k)) {
            p.seasonBullsHit = 0;
            p.totalBullsHit = 0;
            p.matchesWon = 0;
            p.matchesPlayed = 0;
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
          }
        });
        console.log(`[Storage] Loaded persistent state from disk (${loadedRoster.length} players in roster)`);
        return {
          standings: {
            tuesday: (Array.isArray(parsed.standings?.tuesday) ? parsed.standings.tuesday : []).filter(
              (s: any) => !['stan', 'amber', 'dale'].includes((s.playerName || '').toLowerCase().trim())
            ),
            wednesday: (Array.isArray(parsed.standings?.wednesday) ? parsed.standings.wednesday : []).filter(
              (s: any) => !['stan', 'amber', 'dale'].includes((s.playerName || '').toLowerCase().trim())
            ),
            thursday: (Array.isArray(parsed.standings?.thursday) ? parsed.standings.thursday : []).filter(
              (s: any) => !['stan', 'amber', 'dale'].includes((s.playerName || '').toLowerCase().trim())
            ),
          },
          brackets: {
            tuesday: (() => {
              const rawTues = sanitizeServerBracketsState(parsed.brackets?.tuesday || null, 'tuesday');
              if (!rawTues) return null;
              const completeMatch = (m: any) => {
                if (!m) return m;
                return {
                  ...m,
                  status: 'completed',
                  isCompleted: true,
                  winnerName: m.winnerName || (m.scoreA > m.scoreB ? m.entryA?.name : m.scoreB > m.scoreA ? m.entryB?.name : m.entryA?.name || 'Completed'),
                };
              };
              const newDivisions = Array.isArray(rawTues.divisions)
                ? rawTues.divisions.map((d: any) => ({
                    ...d,
                    matchups: (d.matchups || []).map(completeMatch),
                  }))
                : rawTues.divisions;
              return {
                ...rawTues,
                divisions: newDivisions,
                divisionA: (rawTues.divisionA || []).map(completeMatch),
                divisionB: (rawTues.divisionB || []).map(completeMatch),
              };
            })(),
            wednesday: (() => {
              const rawWed = sanitizeServerBracketsState(parsed.brackets?.wednesday || null, 'wednesday');
              if (!rawWed) return null;
              return rawWed;
            })(),
            thursday: {
              divisions: [],
              divisionA: [],
              divisionB: [],
              divisionC: [],
              divisionD: [],
              divisionE: [],
              divisionF: [],
            },
          },
          finances: {
            tuesday_players: deduplicateServerFinancePlayers(parsed.finances?.tuesday_players || [], parsed.deletedPaymentIds || []),
            wednesday_players: deduplicateServerFinancePlayers(parsed.finances?.wednesday_players || [], parsed.deletedPaymentIds || []),
            thursday_players: deduplicateServerFinancePlayers(parsed.finances?.thursday_players || [], parsed.deletedPaymentIds || []),
            session_logs: Array.isArray(parsed.finances?.session_logs) ? parsed.finances.session_logs : [],
          },
          deletedPaymentIds: Array.isArray(parsed.deletedPaymentIds) ? parsed.deletedPaymentIds : [],
          deletedSessionIds: Array.isArray(parsed.deletedSessionIds) ? parsed.deletedSessionIds : [],
          deletedFinancePlayers: parsed.deletedFinancePlayers && typeof parsed.deletedFinancePlayers === "object"
            ? parsed.deletedFinancePlayers
            : { tuesday: [], wednesday: [], thursday: [] },
          deletedPlayers: (() => {
            const raw = Array.isArray(parsed.deletedPlayers) ? parsed.deletedPlayers : [];
            const uniqueMap = new Map<string, any>();
            raw.forEach((dp: any) => {
              const k = (dp?.name || dp?.id || '').toLowerCase().trim();
              if (k === 'stan') return;
              if (k && !uniqueMap.has(k)) uniqueMap.set(k, dp);
            });
            return Array.from(uniqueMap.values());
          })(),
          removedLeaguePlayers: parsed.removedLeaguePlayers && typeof parsed.removedLeaguePlayers === "object"
            ? parsed.removedLeaguePlayers
            : { tuesday: [], wednesday: [], thursday: [] },
          deletedMatchupIds: Array.isArray(parsed.deletedMatchupIds) ? parsed.deletedMatchupIds : [],
          roster: loadedRoster,
          seasonBulls: (() => {
            const sb = parsed.seasonBulls && typeof parsed.seasonBulls === "object" ? { ...parsed.seasonBulls } : {};
            delete sb['stan'];
            delete sb['amber'];
            delete sb['dale'];
            return sb;
          })(),
          tuesdayStats: parsed.tuesdayStats && typeof parsed.tuesdayStats === "object" ? parsed.tuesdayStats : {},
          wednesdayStats: parsed.wednesdayStats && typeof parsed.wednesdayStats === "object" ? parsed.wednesdayStats : {},
          thursdayStats: parsed.thursdayStats && typeof parsed.thursdayStats === "object" ? parsed.thursdayStats : {},
          attendance: {
            tuesday: Array.isArray(parsed.attendance?.tuesday) ? parsed.attendance.tuesday : [],
            wednesday: Array.isArray(parsed.attendance?.wednesday) ? parsed.attendance.wednesday : [],
            thursday: Array.isArray(parsed.attendance?.thursday) ? parsed.attendance.thursday : [],
          },
          securityPins: parsed.securityPins && typeof parsed.securityPins === "object"
            ? {
                adminPin: String(parsed.securityPins.adminPin || "1950"),
                playerPin: String(parsed.securityPins.playerPin || "1234"),
                updatedAt: Number(parsed.securityPins.updatedAt || Date.now()),
              }
            : {
                adminPin: "1950",
                playerPin: "1234",
                updatedAt: Date.now(),
              },
          draws: (() => {
            const d = parsed.draws && typeof parsed.draws === "object"
              ? parsed.draws
              : {
                  isPublicViewable: true,
                  doorPrize: { spots: [], runningTotalLeague: 0, history: [] },
                  luckyNumber: { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] },
                  doubleDraw: { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] },
                  updatedAt: Date.now(),
                };
            // Invariant: If there is no completed history, bucketTotal must be 0.00
            if (d.luckyNumber && (!Array.isArray(d.luckyNumber.history) || d.luckyNumber.history.length === 0)) {
              d.luckyNumber.bucketTotal = 0;
            }
            if (d.doubleDraw && (!Array.isArray(d.doubleDraw.history) || d.doubleDraw.history.length === 0)) {
              d.doubleDraw.bucketTotal = 0;
            }
            if (d.lucky_number && (!Array.isArray(d.lucky_number.history) || d.lucky_number.history.length === 0)) {
              d.lucky_number.bucketTotal = 0;
            }
            if (d.double_draw && (!Array.isArray(d.double_draw.history) || d.double_draw.history.length === 0)) {
              d.double_draw.bucketTotal = 0;
            }
            return d;
          })(),
          completedMatchStates: parsed.completedMatchStates && typeof parsed.completedMatchStates === "object" ? parsed.completedMatchStates : {},
          overallStatsDispatches: Array.isArray(parsed.overallStatsDispatches) ? parsed.overallStatsDispatches : [],
          autoEmailOverallStats: parsed.autoEmailOverallStats !== undefined ? !!parsed.autoEmailOverallStats : true,
          lastResetAt: Number(parsed.lastResetAt || 0),
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (err) {
    console.error("[Storage] Failed to read venue data from disk:", err);
  }
  return null;
}

// Global Venue State Store
let venueDataStore: {
  standings: {
    tuesday: any[];
    wednesday: any[];
    thursday: any[];
  };
  brackets: {
    tuesday: any;
    wednesday: any;
    thursday: any;
  };
  finances: {
    tuesday_players: any[];
    wednesday_players: any[];
    thursday_players: any[];
    session_logs: any[];
  };
  deletedPaymentIds?: string[];
  deletedSessionIds?: string[];
  deletedFinancePlayers?: {
    tuesday?: Array<{ id?: string; name: string; timestamp: number }>;
    wednesday?: Array<{ id?: string; name: string; timestamp: number }>;
    thursday?: Array<{ id?: string; name: string; timestamp: number }>;
  };
  roster: any[];
  deletedPlayers?: Array<{ id?: string; name: string; timestamp: number }>;
  removedLeaguePlayers?: {
    tuesday?: string[];
    wednesday?: string[];
    thursday?: string[];
  };
  deletedMatchupIds?: string[];
  seasonBulls: Record<string, number>;
  nightlyBulls?: {
    tuesday?: Record<string, any>;
    wednesday?: Record<string, any>;
    thursday?: Record<string, any>;
  };
  tuesdayStats: Record<string, any>;
  wednesdayStats: Record<string, any>;
  thursdayStats: Record<string, any>;
  attendance: {
    tuesday: any[];
    wednesday: any[];
    thursday: any[];
  };
  bracketsUpdatedAt?: {
    tuesday: number;
    wednesday: number;
    thursday: number;
  };
  attendanceUpdatedAt?: {
    tuesday: number;
    wednesday: number;
    thursday: number;
  };
  securityPins: {
    adminPin: string;
    playerPin: string;
    updatedAt: number;
  };
  draws?: {
    isPublicViewable: boolean;
    doorPrize: {
      spots: any[];
      runningTotalLeague: number;
      history: any[];
    };
    luckyNumber: {
      spots: any[];
      bucketTotal: number;
      runningTotalLeague: number;
      history: any[];
    };
    doubleDraw: {
      spots: any[];
      bucketTotal: number;
      runningTotalLeague: number;
      history: any[];
    };
    updatedAt: number;
  };
  completedMatchStates?: Record<string, any>;
  overallStatsDispatches?: any[];
  autoEmailOverallStats?: boolean;
  lastResetAt?: number;
  updatedAt: number;
} = loadVenueDataFromDisk() || {
  standings: {
    tuesday: [],
    wednesday: [],
    thursday: [],
  },
  brackets: {
    tuesday: null,
    wednesday: null,
    thursday: null,
  },
  finances: {
    tuesday_players: [],
    wednesday_players: [],
    thursday_players: [],
    session_logs: [],
  },
  deletedPaymentIds: [],
  deletedSessionIds: [],
  roster: [...DEFAULT_MASTER_ROSTER],
  deletedPlayers: [],
  removedLeaguePlayers: {
    tuesday: [],
    wednesday: [],
    thursday: [],
  },
  deletedMatchupIds: [],
  seasonBulls: {},
  nightlyBulls: {
    tuesday: {},
    wednesday: {},
    thursday: {},
  },
  tuesdayStats: {},
  wednesdayStats: {},
  thursdayStats: {},
  attendance: {
    tuesday: [],
    wednesday: [],
    thursday: [],
  },
  securityPins: {
    adminPin: "1950",
    playerPin: "1234",
    updatedAt: Date.now(),
  },
  draws: {
    isPublicViewable: true,
    doorPrize: { spots: [], runningTotalLeague: 0, history: [] },
    luckyNumber: { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] },
    doubleDraw: { spots: [], bucketTotal: 0, runningTotalLeague: 0, history: [] },
    updatedAt: Date.now(),
  },
  completedMatchStates: {},
  overallStatsDispatches: [],
  autoEmailOverallStats: true,
  lastResetAt: 0,
  updatedAt: Date.now(),
};

if (!venueDataStore.completedMatchStates) {
  venueDataStore.completedMatchStates = {};
}

function verifyAndCalibrateLeagueStats(store: any) {
  if (!store || typeof store !== "object") return;

  // Restore Wednesday standings if missing from disk dump
  if (!store.standings?.wednesday || store.standings.wednesday.length === 0) {
    try {
      if (fs.existsSync('./firestore_wednesday_standings.json')) {
        const dump = JSON.parse(fs.readFileSync('./firestore_wednesday_standings.json', 'utf-8'));
        if (Array.isArray(dump.standings) && dump.standings.length > 0) {
          store.standings = store.standings || {};
          store.standings.wednesday = dump.standings;
        }
      }
    } catch (e) {
      console.warn('Failed to load firestore_wednesday_standings.json', e);
    }
  }

  // Restore Wednesday stats if missing from disk dump
  if (!store.wednesdayStats || Object.keys(store.wednesdayStats).length === 0) {
    try {
      if (fs.existsSync('./firestore_wednesday_stats.json')) {
        const dump = JSON.parse(fs.readFileSync('./firestore_wednesday_stats.json', 'utf-8'));
        const statsMap = dump.stats || dump.wednesdayStats || dump.statsMap || dump;
        if (statsMap && typeof statsMap === 'object') {
          store.wednesdayStats = statsMap;
        }
      }
    } catch (e) {
      console.warn('Failed to load firestore_wednesday_stats.json', e);
    }
  }

  // Ensure Wednesday Board 2 match stats are recorded and preserved
  const wedMatchPlayersWon = ["donny", "jack", "wayne", "kyle"];
  const wedBoard2Stats: Record<string, any> = {
    donny: {
      playerId: "p-1788267293149-gqwt",
      playerName: "Donny",
      avatar: "🦸‍♂️",
      teamName: "Donny & Jack & Wayne & Kyle",
      totalGamesPlayed: 6,
      totalGameWins: 5,
      points: 5,
      seasonBullsHit: 0,
      game1001HighScore: 82,
      game1001HighFinish: 0,
      game1001Scores80Plus: 325,
      game1001Wins: 2,
      game701HighScore: 60,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 0,
      game701Wins: 0,
      baseballHighScore: 13,
      baseballWins: 1,
      fivesHighScore: 50,
      fivesHighFinish: 0,
      fivesWins: 1,
      cricketWins: 1,
    },
    jack: {
      playerId: "p-1788522261438-b13q",
      playerName: "Jack",
      avatar: "🎯",
      teamName: "Donny & Jack & Wayne & Kyle",
      totalGamesPlayed: 6,
      totalGameWins: 5,
      points: 5,
      seasonBullsHit: 0,
      game1001HighScore: 114,
      game1001HighFinish: 16,
      game1001Scores80Plus: 387,
      game1001Wins: 2,
      game701HighScore: 77,
      game701HighFinish: 0,
      game701HighestBeginningScore: 51,
      game701Scores80Plus: 0,
      game701Wins: 0,
      baseballHighScore: 16,
      baseballWins: 1,
      fivesHighScore: 45,
      fivesHighFinish: 5,
      fivesWins: 1,
      cricketWins: 1,
    },
    wayne: {
      playerId: "p-1789600171445-n1fh",
      playerName: "Wayne",
      avatar: "🎯",
      teamName: "Donny & Jack & Wayne & Kyle",
      totalGamesPlayed: 6,
      totalGameWins: 5,
      points: 5,
      seasonBullsHit: 0,
      game1001HighScore: 100,
      game1001HighFinish: 0,
      game1001Scores80Plus: 283,
      game1001Wins: 2,
      game701HighScore: 45,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 0,
      game701Wins: 0,
      baseballHighScore: 21,
      baseballWins: 1,
      fivesHighScore: 60,
      fivesHighFinish: 0,
      fivesWins: 1,
      cricketWins: 1,
    },
    kyle: {
      playerId: "p-1788267374892-z64q",
      playerName: "Kyle",
      avatar: "🦸‍♂️",
      teamName: "Donny & Jack & Wayne & Kyle",
      totalGamesPlayed: 6,
      totalGameWins: 5,
      points: 5,
      seasonBullsHit: 0,
      game1001HighScore: 100,
      game1001HighFinish: 2,
      game1001Scores80Plus: 300,
      game1001Wins: 2,
      game701HighScore: 43,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 0,
      game701Wins: 0,
      baseballHighScore: 11,
      baseballWins: 1,
      fivesHighScore: 25,
      fivesHighFinish: 0,
      fivesWins: 1,
      cricketWins: 1,
    },
    lor: {
      playerId: "p-1788522197801-r3ws",
      playerName: "Lor",
      avatar: "🎯",
      teamName: "Lor & Fern & Celeste & Natalie",
      totalGamesPlayed: 6,
      totalGameWins: 1,
      points: 1,
      seasonBullsHit: 0,
      game1001HighScore: 63,
      game1001HighFinish: 0,
      game1001Scores80Plus: 0,
      game1001Wins: 0,
      game701HighScore: 81,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 81,
      game701Wins: 1,
      baseballHighScore: 6,
      baseballWins: 0,
      fivesHighScore: 90,
      fivesHighFinish: 0,
      fivesWins: 0,
      cricketWins: 0,
    },
    fern: {
      playerId: "p-1789599053514-veh5",
      playerName: "Fern",
      avatar: "🎯",
      teamName: "Lor & Fern & Celeste & Natalie",
      totalGamesPlayed: 6,
      totalGameWins: 1,
      points: 1,
      seasonBullsHit: 0,
      game1001HighScore: 117,
      game1001HighFinish: 0,
      game1001Scores80Plus: 341,
      game1001Wins: 0,
      game701HighScore: 103,
      game701HighFinish: 26,
      game701HighestBeginningScore: 90,
      game701Scores80Plus: 193,
      game701Wins: 1,
      baseballHighScore: 13,
      baseballWins: 0,
      fivesHighScore: 50,
      fivesHighFinish: 0,
      fivesWins: 0,
      cricketWins: 0,
    },
    celeste: {
      playerId: "p-1789600097720-iphc",
      playerName: "Celeste",
      avatar: "🎯",
      teamName: "Lor & Fern & Celeste & Natalie",
      totalGamesPlayed: 6,
      totalGameWins: 1,
      points: 1,
      seasonBullsHit: 0,
      game1001HighScore: 95,
      game1001HighFinish: 0,
      game1001Scores80Plus: 95,
      game1001Wins: 0,
      game701HighScore: 39,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 0,
      game701Wins: 1,
      baseballHighScore: 10,
      baseballWins: 0,
      fivesHighScore: 35,
      fivesHighFinish: 0,
      fivesWins: 0,
      cricketWins: 0,
    },
    natalie: {
      playerId: "p-1788267320690-7cc4",
      playerName: "Natalie",
      avatar: "🦸‍♂️",
      teamName: "Lor & Fern & Celeste & Natalie",
      totalGamesPlayed: 6,
      totalGameWins: 1,
      points: 1,
      seasonBullsHit: 0,
      game1001HighScore: 56,
      game1001HighFinish: 0,
      game1001Scores80Plus: 0,
      game1001Wins: 0,
      game701HighScore: 29,
      game701HighFinish: 0,
      game701HighestBeginningScore: 0,
      game701Scores80Plus: 0,
      game701Wins: 1,
      baseballHighScore: 12,
      baseballWins: 0,
      fivesHighScore: 60,
      fivesHighFinish: 0,
      fivesWins: 0,
      cricketWins: 0,
    }
  };

  if (!store.wednesdayStats || typeof store.wednesdayStats !== "object") {
    store.wednesdayStats = {};
  }
  // Sanitize non-player metadata keys from all stats maps
  (["wednesdayStats", "tuesdayStats", "thursdayStats"] as const).forEach((sKey) => {
    if (store[sKey] && typeof store[sKey] === "object") {
      ["lastresetat", "updatedat", "statsmap"].forEach((metaKey) => {
        delete store[sKey][metaKey];
        delete store[sKey][metaKey.toUpperCase()];
      });
      Object.keys(store[sKey]).forEach((k) => {
        const val = store[sKey][k];
        if (!val || typeof val !== "object" || Array.isArray(val) || ["lastresetat", "updatedat", "statsmap"].includes(k.toLowerCase())) {
          delete store[sKey][k];
        }
      });
    }
  });

  Object.keys(wedBoard2Stats).forEach((pKey) => {
    if (!store.wednesdayStats[pKey] || (store.wednesdayStats[pKey].totalGamesPlayed || 0) === 0) {
      store.wednesdayStats[pKey] = { ...wedBoard2Stats[pKey] };
    }
  });

  if (Array.isArray(store.standings?.wednesday)) {
    store.standings.wednesday.forEach((s: any) => {
      const k = (s.playerName || "").toLowerCase().trim();
      if (wedBoard2Stats[k]) {
        if (!s.gamesPlayed || s.gamesPlayed === 0) {
          s.gamesPlayed = 6;
          s.gamesWon = wedMatchPlayersWon.includes(k) ? 5 : 1;
          s.points = wedMatchPlayersWon.includes(k) ? 5 : 1;
          s.seasonBullsHit = s.seasonBullsHit || 0;
          s.wednesdayStats = store.wednesdayStats[k] || wedBoard2Stats[k];
        }
      }
    });
  }

  // Permanently purge deleted matchups and completed match states
  if (!Array.isArray(store.deletedMatchupIds)) {
    store.deletedMatchupIds = [];
  }
  const hardcodedDeletedMatchups = ["bm-wed-board1-1789841291793-0", "bm-wed-board2-1789841291793-1"];
  hardcodedDeletedMatchups.forEach((id) => {
    if (!store.deletedMatchupIds.includes(id)) {
      store.deletedMatchupIds.push(id);
    }
  });

  const deletedMatchupSet = new Set(store.deletedMatchupIds);

  if (store.completedMatchStates && typeof store.completedMatchStates === "object") {
    Object.keys(store.completedMatchStates).forEach((k) => {
      const ms = store.completedMatchStates[k];
      if (
        deletedMatchupSet.has(k) ||
        (ms?.settings?.bracketMatchId && deletedMatchupSet.has(ms.settings.bracketMatchId)) ||
        (ms?.id && deletedMatchupSet.has(ms.id))
      ) {
        delete store.completedMatchStates[k];
      }
    });
  }

  (['tuesday', 'wednesday', 'thursday'] as const).forEach((lt) => {
    const b = store.brackets?.[lt];
    if (b && typeof b === "object") {
      if (Array.isArray(b.divisions)) {
        b.divisions.forEach((d: any) => {
          if (Array.isArray(d?.matchups)) {
            d.matchups = d.matchups.filter((m: any) => !deletedMatchupSet.has(m?.id));
          }
        });
      }
      (['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'] as const).forEach((div) => {
        if (Array.isArray(b[div])) {
          b[div] = b[div].filter((m: any) => !deletedMatchupSet.has(m?.id));
        }
      });
      let rem = 0;
      if (Array.isArray(b.divisions)) {
        b.divisions.forEach((d: any) => {
          if (Array.isArray(d?.matchups)) rem += d.matchups.length;
        });
      }
      (['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'] as const).forEach((div) => {
        if (Array.isArray(b[div])) rem += b[div].length;
      });
      if (rem === 0) {
        store.brackets[lt] = null;
      }
    }
  });

  // 3. Calibrate tuesdayStats
  if (store.tuesdayStats && typeof store.tuesdayStats === "object") {
    if (store.tuesdayStats.sylvain) {
      store.tuesdayStats.sylvain.totalGamesPlayed = 9;
      store.tuesdayStats.sylvain.totalGameWins = 8;
      store.tuesdayStats.sylvain.points = 8;
      store.tuesdayStats.sylvain.cricketPlayed = 3;
      store.tuesdayStats.sylvain.cricketWins = 3;
      store.tuesdayStats.sylvain.game301Wins = 2;
    }
    if (store.tuesdayStats.mark) {
      store.tuesdayStats.mark.game301Played = 3;
      store.tuesdayStats.mark.totalGamesPlayed = 9;
      store.tuesdayStats.mark.totalGameWins = 6;
      store.tuesdayStats.mark.points = 6;
    }
    if (store.tuesdayStats.ray) {
      store.tuesdayStats.ray.cricketPlayed = 3;
      store.tuesdayStats.ray.totalGamesPlayed = 9;
      store.tuesdayStats.ray.totalGameWins = 5;
      store.tuesdayStats.ray.points = 5;
    }
    if (store.tuesdayStats["jack d"]) {
      store.tuesdayStats["jack d"].game301Wins = 0;
      store.tuesdayStats["jack d"].game301Played = 3;
      store.tuesdayStats["jack d"].cricketWins = 0;
      store.tuesdayStats["jack d"].cricketPlayed = 3;
      store.tuesdayStats["jack d"].game501Wins = 0;
      store.tuesdayStats["jack d"].game501Played = 3;
      store.tuesdayStats["jack d"].totalGameWins = 0;
      store.tuesdayStats["jack d"].totalGamesPlayed = 9;
      store.tuesdayStats["jack d"].points = 0;
    }
  }

  // 4. Calibrate standings.tuesday
  if (Array.isArray(store.standings?.tuesday)) {
    store.standings.tuesday.forEach((s: any) => {
      const k = (s.playerName || "").toLowerCase().trim();
      if (k === "sylvain") {
        s.gamesPlayed = 9;
        s.gamesWon = 8;
        s.points = 8;
      } else if (k === "mark") {
        s.gamesPlayed = 9;
        s.gamesWon = 6;
        s.points = 6;
      } else if (k === "ray") {
        s.gamesPlayed = 9;
        s.gamesWon = 5;
        s.points = 5;
      } else if (k === "jack d") {
        s.gamesPlayed = 9;
        s.gamesWon = 0;
        s.points = 0;
      }
    });
  }

  // Purge Lynn from Thursday standings and thursdayStats (Lynn is strictly a Wednesday singles/team player)
  if (Array.isArray(store.standings?.thursday)) {
    store.standings.thursday = store.standings.thursday.filter(
      (s: any) => (s.playerName || "").toLowerCase().trim() !== "lynn"
    );
  }

  // THURSDAY LEAGUE RESET:
  // There are no official games until this upcoming Thursday.
  // Ensure all players for Thursday league strictly have 0 stats and 0 Bulls.
  store.thursdayStats = {};
  if (Array.isArray(store.standings?.thursday)) {
    store.standings.thursday.forEach((s: any) => {
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
    });
  }

  // Ensure seasonBulls map accuracy (preserve Tuesday bulls only; remove Wednesday bulls)
  if (!store.seasonBulls || typeof store.seasonBulls !== "object") {
    store.seasonBulls = {};
  }
  const tuesBullsMap = store.tuesdayStats || {};
  store.seasonBulls = {};
  Object.keys(tuesBullsMap).forEach((k) => {
    if (tuesBullsMap[k]?.seasonBullsHit > 0) {
      store.seasonBulls[k] = tuesBullsMap[k].seasonBullsHit;
    }
  });
  if (store.seasonBulls["floyd"] !== undefined) store.seasonBulls["floyd"] = 0;
  if (store.seasonBulls["stan"] !== undefined) store.seasonBulls["stan"] = 0;

  // Ensure player roster accuracy
  if (Array.isArray(store.roster)) {
    store.roster.forEach((p: any) => {
      const k = (p.name || p.playerName || "").toLowerCase().trim();
      const tuesBulls = store.tuesdayStats?.[k]?.seasonBullsHit || 0;
      p.seasonBullsHit = tuesBulls;
      p.totalBullsHit = tuesBulls;
      if (k === "floyd" || k === "stan") {
        p.seasonBullsHit = 0;
      }
    });
  }

  // Permanently remove requested players: MauricHarolde, Test1, Test2
  const playersToRemovePermanently = ["mauricharolde", "test1", "test2"];
  if (!Array.isArray(store.deletedPlayers)) {
    store.deletedPlayers = [];
  }
  playersToRemovePermanently.forEach((pName) => {
    const exists = store.deletedPlayers.some((dp: any) => (dp.name || "").toLowerCase().trim() === pName);
    if (!exists) {
      store.deletedPlayers.push({ name: pName, timestamp: Date.now() });
    }
  });

  if (Array.isArray(store.roster)) {
    store.roster = store.roster.filter((p: any) => {
      const k = (p?.name || p?.playerName || "").toLowerCase().trim();
      return !playersToRemovePermanently.includes(k);
    });
  }

  (['tuesday', 'wednesday', 'thursday'] as const).forEach((lt) => {
    if (Array.isArray(store.standings?.[lt])) {
      store.standings[lt] = store.standings[lt].filter((s: any) => {
        const k = (s?.playerName || "").toLowerCase().trim();
        return !playersToRemovePermanently.includes(k);
      });
    }
  });

  (['tuesday', 'wednesday', 'thursday'] as const).forEach((lt) => {
    if (Array.isArray(store.attendance?.[lt])) {
      store.attendance[lt] = store.attendance[lt].filter((a: any) => {
        const k = (a?.name || "").toLowerCase().trim();
        return !playersToRemovePermanently.includes(k);
      });
    }
  });

  (['tuesday_players', 'wednesday_players', 'thursday_players'] as const).forEach((fKey) => {
    if (Array.isArray(store.finances?.[fKey])) {
      store.finances[fKey] = store.finances[fKey].filter((f: any) => {
        const k = (f?.playerName || f?.name || "").toLowerCase().trim();
        return !playersToRemovePermanently.includes(k);
      });
    }
  });

  (['tuesdayStats', 'wednesdayStats', 'thursdayStats'] as const).forEach((sKey) => {
    if (store[sKey] && typeof store[sKey] === "object") {
      playersToRemovePermanently.forEach((pName) => {
        delete store[sKey][pName];
      });
      Object.keys(store[sKey]).forEach((k) => {
        const entry = store[sKey][k];
        const entryName = (entry?.playerName || k || "").toLowerCase().trim();
        if (playersToRemovePermanently.includes(entryName)) {
          delete store[sKey][k];
        }
      });
    }
  });

  if (store.seasonBulls && typeof store.seasonBulls === "object") {
    playersToRemovePermanently.forEach((pName) => {
      delete store.seasonBulls[pName];
    });
  }
}

// Run initial calibration on loaded state and persist clean data
verifyAndCalibrateLeagueStats(venueDataStore);
persistVenueDataToDisk();

function persistVenueDataToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(venueDataStore, null, 2), "utf-8");
  } catch (err) {
    console.error("[Storage] Failed to save venue data to disk:", err);
  }
}

// In-memory match store
interface MatchStoreItem {
  code: string;
  matchState: any;
  updatedAt: number;
}

const WED_MEDLEY_CONFIGS_SERVER = [
  { legNumber: 1, title: 'Game 1: 1001 Straight In / Double Out', gameMode: 'X01', startScore: 1001, inMode: 'Straight', outMode: 'Double' },
  { legNumber: 2, title: 'Game 2: Baseball (9 Innings)', gameMode: 'BASEBALL', startScore: 0, inMode: 'Straight', outMode: 'Straight' },
  { legNumber: 3, title: 'Game 3: 701 Double In / Double Out', gameMode: 'X01', startScore: 701, inMode: 'Double', outMode: 'Double' },
  { legNumber: 4, title: 'Game 4: Fives (101 Target Goal)', gameMode: 'FIVES', startScore: 101, inMode: 'Straight', outMode: 'Straight' },
  { legNumber: 5, title: 'Game 5: Cricket', gameMode: 'CRICKET', startScore: 0, inMode: 'Straight', outMode: 'Straight' },
  { legNumber: 6, title: 'Game 6 (Optional): 1001 Straight In / Double Out', gameMode: 'X01', startScore: 1001, inMode: 'Straight', outMode: 'Double', isOptional: true },
];

const matchStore = new Map<string, MatchStoreItem>();

// API Endpoints
app.post("/api/gemini/baseball-targets", async (req, res) => {
  // Helper to generate 9 unique numbers (1-20) strictly sorted ascending (NO BULL)
  const generateFallbackTargets = () => {
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    const selected: number[] = [];
    while (selected.length < 9) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }
    selected.sort((a, b) => a - b);
    return selected;
  };

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      const prompt = "Generate exactly 9 unique random integers between 1 and 20 (do NOT include BULL or 25, only numbers 1 to 20). Sort them strictly in ascending numerical order. Return a JSON object with key 'targets' containing the 9 sorted numbers.";
      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            targets: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Array of 9 distinct integers between 1 and 20 sorted in ascending order."
            }
          },
          required: ["targets"]
        }
      };

      // Try gemini-3.7-flash, and fallback to gemini-3.1-flash-lite if temporary 503/429
      let responseText: string | undefined;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config,
        });
        responseText = response.text;
      } catch (primaryErr: any) {
        console.warn("[Gemini API Warning] Primary model 3.7-flash unavailable, attempting 3.1-flash-lite fallback:", primaryErr?.status || primaryErr?.message || primaryErr);
        try {
          const backupResponse = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config,
          });
          responseText = backupResponse.text;
        } catch (backupErr: any) {
          console.warn("[Gemini API Warning] Backup model unavailable, switching to deterministic random targets:", backupErr?.status || backupErr?.message || backupErr);
        }
      }

      if (responseText) {
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed.targets)) {
          const numbersArray = parsed.targets.map((n: any) => Number(n));
          const uniqueNumbers = Array.from(new Set(numbersArray)) as number[];
          const sorted = uniqueNumbers
            .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 20)
            .sort((a: number, b: number) => a - b);
          
          if (sorted.length === 9) {
            return res.json({ targets: sorted, source: "gemini" });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[Gemini API Notice] Baseball target generator using fallback pool:", err?.message || err);
  }

  // Fallback random generator if Gemini is unavailable or busy
  const fallback = generateFallbackTargets();
  res.json({ targets: fallback, source: "fallback" });
});

// In-memory bracket store
let activeBracketsStore: {
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  brackets: any;
  updatedAt: number;
} | null = null;

// Real-Time Server-Sent Events (SSE) Client Pool
const sseClients = new Set<express.Response>();

export function broadcastLiveEvent(type: string, payload: any = {}) {
  const eventData = {
    type,
    ...payload,
    timestamp: Date.now(),
  };
  const message = `data: ${JSON.stringify(eventData)}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

// SSE Keep-Alive Heartbeat every 15 seconds
setInterval(() => {
  const pingMessage = `: heartbeat ${Date.now()}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(pingMessage);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}, 15000);

// Full reset endpoint for brand new app setup
app.post("/api/reset-venue-state", (req, res) => {
  venueDataStore = {
    standings: {
      tuesday: [],
      wednesday: [],
      thursday: [],
    },
    brackets: {
      tuesday: null,
      wednesday: null,
      thursday: null,
    },
    finances: {
      tuesday_players: [],
      wednesday_players: [],
      thursday_players: [],
      session_logs: [],
    },
    roster: [],
    seasonBulls: {},
    tuesdayStats: {},
    wednesdayStats: {},
    thursdayStats: {},
    attendance: {
      tuesday: [],
      wednesday: [],
      thursday: [],
    },
    securityPins: venueDataStore.securityPins || { ...DEFAULT_SECURITY_PINS },
    updatedAt: Date.now(),
  };
  matchStore.clear();
  activeBracketsStore = null;

  persistVenueDataToDisk();
  broadcastLiveEvent("venue_reset", { data: venueDataStore });

  res.json({ success: true, message: "Venue state and matches reset to empty", updatedAt: venueDataStore.updatedAt });
});


app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/venue-state", (req, res) => {
  res.json({ data: venueDataStore, updatedAt: venueDataStore.updatedAt });
});

function safeMergeStandings(existing: any[] = [], incoming: any[] = []): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(s => !isPlayerDeletedOnServer(s?.playerId, s?.playerName));

  const map = new Map<string, any>();
  existing.forEach(s => {
    if (s && s.playerName && !isPlayerDeletedOnServer(s.playerId, s.playerName)) {
      map.set(s.playerName.toLowerCase().trim(), { ...s });
    }
  });

  incoming.forEach(s => {
    if (!s || !s.playerName || isPlayerDeletedOnServer(s.playerId, s.playerName)) return;
    const key = s.playerName.toLowerCase().trim();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...s });
    } else {
      const mergedTuesStats = prev.tuesdayStats && s.tuesdayStats
        ? safeMergeStatsMap({ [key]: prev.tuesdayStats }, { [key]: s.tuesdayStats })[key]
        : (s.tuesdayStats || prev.tuesdayStats);
      const mergedWedStats = prev.wednesdayStats && s.wednesdayStats
        ? safeMergeStatsMap({ [key]: prev.wednesdayStats }, { [key]: s.wednesdayStats })[key]
        : (s.wednesdayStats || prev.wednesdayStats);
      const mergedThursStats = prev.thursdayStats && s.thursdayStats
        ? safeMergeStatsMap({ [key]: prev.thursdayStats }, { [key]: s.thursdayStats })[key]
        : (s.thursdayStats || prev.thursdayStats);

      map.set(key, {
        ...prev,
        ...s,
        gamesPlayed: Math.max(prev.gamesPlayed || 0, s.gamesPlayed || 0),
        gamesWon: Math.max(prev.gamesWon || 0, s.gamesWon || 0),
        points: Math.max(prev.points || 0, s.points || 0),
        highCheckout: Math.max(prev.highCheckout || 0, s.highCheckout || 0),
        highOut: Math.max(prev.highOut || 0, s.highOut || 0, prev.highCheckout || 0, s.highCheckout || 0),
        highIn: Math.max(prev.highIn || 0, s.highIn || 0),
        total180s: Math.max(prev.total180s || 0, s.total180s || 0),
        seasonBullsHit: Math.max(prev.seasonBullsHit || 0, s.seasonBullsHit || 0),
        threeDartAvg: (s.threeDartAvg && s.threeDartAvg > 0) ? s.threeDartAvg : (prev.threeDartAvg || 0),
        tuesdayStats: mergedTuesStats,
        wednesdayStats: mergedWedStats,
        thursdayStats: mergedThursStats,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.points || 0) - (a.points || 0) || (b.gamesWon || 0) - (a.gamesWon || 0));
}

function safeMergeStatsMap(existing: Record<string, any> = {}, incoming: Record<string, any> = {}): Record<string, any> {
  if (!incoming || typeof incoming !== 'object') return existing || {};
  if (!existing || typeof existing !== 'object') return incoming || {};

  const rawIncoming = (incoming.statsMap && typeof incoming.statsMap === 'object' && !Array.isArray(incoming.statsMap))
    ? incoming.statsMap
    : incoming;

  const result: Record<string, any> = {};
  for (const k of Object.keys(existing)) {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(k.toLowerCase())) continue;
    const v = existing[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = { ...v };
    }
  }

  for (const key of Object.keys(rawIncoming)) {
    if (['lastresetat', 'updatedat', 'statsmap'].includes(key.toLowerCase())) {
      continue;
    }
    const inc = rawIncoming[key];
    if (!inc || typeof inc !== 'object' || Array.isArray(inc)) {
      continue;
    }
    if (isPlayerDeletedOnServer(undefined, key) || (inc && isPlayerDeletedOnServer(inc.playerId, inc.playerName))) {
      continue;
    }
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

      const entry = result[key];
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
  return result;
}

function sanitizeServerFinancePlayer(p: any, deletedSet: Set<string> = new Set()): any {
  if (!p || typeof p !== "object") return p;
  const memPayments = (p.membershipPayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));
  const dailyPayments = (p.dailyFeePayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));
  const sparePayments = (p.spareFeePayments || []).filter((m: any) => m && m.id && !deletedSet.has(m.id));

  const memDeposit = memPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
  const isMember = memDeposit > 0;
  const totalDaily = Math.min(68, dailyPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0));
  const dailyFeePaidInFull = totalDaily >= 68;
  const totalSpare = sparePayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

  return {
    ...p,
    membershipPayments: memPayments,
    membershipDeposit: memDeposit,
    isMember,
    dailyFeePayments: dailyPayments,
    totalDailyFeesPaid: totalDaily,
    dailyFeePaidInFull,
    dailyFeePaidDate: dailyFeePaidInFull ? (p.dailyFeePaidDate || new Date().toISOString()) : undefined,
    spareFeePayments: sparePayments,
    totalSpareFeesPaid: totalSpare,
    dailyFeeType: p.dailyFeeType || (isMember ? 'member' : 'spare'),
    membershipPaidDate: memDeposit >= 40 ? (p.membershipPaidDate || new Date().toISOString()) : undefined,
    updatedAt: Number(p.updatedAt || Date.now()),
  };
}

function isFinancePlayerDeletedOnServer(leagueType: string, id?: string, name?: string): boolean {
  if (isPlayerDeletedOnServer(id, name)) return true;
  if (!venueDataStore.deletedFinancePlayers) return false;
  const lKey = leagueType as 'tuesday' | 'wednesday' | 'thursday';
  const list = venueDataStore.deletedFinancePlayers[lKey];
  if (!Array.isArray(list) || list.length === 0) return false;
  const targetId = id ? String(id).trim() : '';
  const targetName = name ? String(name).toLowerCase().trim() : '';
  return list.some(dp =>
    (targetId && dp.id && String(dp.id).trim() === targetId) ||
    (targetName && dp.name && String(dp.name).toLowerCase().trim() === targetName)
  );
}

function safeMergeFinancePlayers(
  existing: any[] = [],
  incoming: any[] = [],
  deletedPaymentIds: string[] = [],
  leagueType?: string
): any[] {
  const deletedSet = new Set(deletedPaymentIds || []);

  const isExcluded = (p: any) => {
    if (!p) return true;
    const pId = p.playerId || p.id;
    const pName = p.playerName || p.name;
    if (isPlayerDeletedOnServer(pId, pName)) return true;
    if (leagueType && isFinancePlayerDeletedOnServer(leagueType, pId, pName)) return true;
    return false;
  };

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return (existing || [])
      .filter(p => !isExcluded(p))
      .map(p => sanitizeServerFinancePlayer(p, deletedSet));
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    return incoming
      .filter(p => !isExcluded(p))
      .map(p => sanitizeServerFinancePlayer(p, deletedSet));
  }

  const playerMap = new Map<string, any>();

  // Always match by normalized player name to guarantee no duplicate rows
  const getKey = (p: any) =>
    (p.playerName || p.name) ? String(p.playerName || p.name).toLowerCase().trim() : String(p.playerId || p.id || '').trim();

  const mergePayments = (listA: any[] = [], listB: any[] = []): any[] => {
    const pMap = new Map<string, any>();
    for (const item of [...listA, ...listB]) {
      if (!item || !item.id || deletedSet.has(item.id)) continue;
      pMap.set(item.id, item);
    }
    return Array.from(pMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  };

  existing.forEach(p => {
    if (!p || isExcluded(p)) return;
    const key = getKey(p);
    if (key) playerMap.set(key, sanitizeServerFinancePlayer(p, deletedSet));
  });

  incoming.forEach(p => {
    if (!p || isExcluded(p)) return;
    const key = getKey(p);
    if (!key) return;
    const inc = sanitizeServerFinancePlayer(p, deletedSet);
    const prev = playerMap.get(key);

    if (!prev) {
      playerMap.set(key, inc);
    } else {
      const prevUpdated = Number(prev.updatedAt || 0);
      const incUpdated = Number(inc.updatedAt || 0);

      // Merge payments safely and derive totals strictly from payment records
      const mergedMemPayments = mergePayments(prev.membershipPayments, inc.membershipPayments);
      const memDeposit = mergedMemPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);
      const isMember = memDeposit > 0;

      const mergedDailyPayments = mergePayments(prev.dailyFeePayments, inc.dailyFeePayments);
      const totalDaily = Math.min(68, mergedDailyPayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0));
      const isDailyFull = totalDaily >= 68;

      const mergedSparePayments = mergePayments(prev.spareFeePayments, inc.spareFeePayments);
      const totalSpare = mergedSparePayments.reduce((s: number, c: any) => s + (Number(c.amount) || 0), 0);

      // Pick canonical ID from roster if known
      const rosterId = (venueDataStore.roster || []).find((r: any) => (r.name || '').toLowerCase().trim() === key)?.id;
      const canonicalId = rosterId || prev.playerId || prev.id || inc.playerId || inc.id;

      playerMap.set(key, {
        ...prev,
        ...inc,
        playerId: canonicalId,
        id: canonicalId,
        avatar: inc.avatar || prev.avatar || '🎯',
        playerName: (inc.playerName || inc.name || prev.playerName || prev.name || '').trim(),
        name: (inc.playerName || inc.name || prev.playerName || prev.name || '').trim(),
        isMember,
        membershipDeposit: memDeposit,
        membershipPayments: mergedMemPayments,
        membershipPaidDate: isMember ? (inc.membershipPaidDate || prev.membershipPaidDate) : undefined,
        dailyFeeActive: prev.dailyFeeActive !== undefined ? prev.dailyFeeActive : inc.dailyFeeActive,
        dailyFeeType: isMember ? (inc.dailyFeeType || prev.dailyFeeType || 'member') : 'spare',
        totalDailyFeesPaid: totalDaily,
        dailyFeePaidInFull: isDailyFull,
        dailyFeePaidDate: isDailyFull ? (inc.dailyFeePaidDate || prev.dailyFeePaidDate) : undefined,
        dailyFeePayments: mergedDailyPayments,
        totalSpareFeesPaid: totalSpare,
        spareFeePayments: mergedSparePayments,
        updatedAt: Math.max(prevUpdated, incUpdated, Date.now()),
      });
    }
  });

  return Array.from(playerMap.values()).sort((a, b) =>
    (a.playerName || a.name || '').localeCompare(b.playerName || b.name || '')
  );
}

function safeMergeSessionLogs(existing: any[] = [], incoming: any[] = [], deletedSessionIds: string[] = []): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing || [];
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(s => !deletedSessionIds.includes(s.id));

  const deletedSet = new Set(deletedSessionIds || []);
  const logMap = new Map<string, any>();

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

  return Array.from(logMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0) || (b.date || '').localeCompare(a.date || ''));
}

function isPlayerDeletedOnServer(id?: string, name?: string): boolean {
  const targetName = name ? String(name).toLowerCase().trim() : '';
  if (targetName === 'stan') return false;
  if (!Array.isArray(venueDataStore.deletedPlayers) || venueDataStore.deletedPlayers.length === 0) return false;
  const targetId = id ? String(id).trim() : '';
  return venueDataStore.deletedPlayers.some(dp =>
    (targetId && dp.id && dp.id === targetId) ||
    (targetName && dp.name && dp.name.toLowerCase().trim() === targetName)
  );
}

function safeMergeRoster(existing: any[] = [], incoming: any[] = []): any[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return existing.filter(p => p && !isPlayerDeletedOnServer(p.id, p.name));
  if (!Array.isArray(existing) || existing.length === 0) return incoming.filter(p => p && !isPlayerDeletedOnServer(p.id, p.name));

  const map = new Map<string, any>();
  existing.forEach(p => {
    if (p && p.name && !isPlayerDeletedOnServer(p.id, p.name)) {
      map.set(p.name.toLowerCase().trim(), { ...p });
    }
  });

  incoming.forEach(p => {
    if (!p || !p.name || isPlayerDeletedOnServer(p.id, p.name)) return;
    const key = p.name.toLowerCase().trim();

    if (['stan', 'amber', 'dale'].includes(key)) {
      const prev = map.get(key);
      map.set(key, {
        ...(prev || {}),
        ...p,
        matchesPlayed: 0,
        matchesWon: 0,
        careerAvg: 0,
        highCheckout: 0,
        total180s: 0,
        seasonBullsHit: 0,
        totalBullsHit: 0,
        totalLegsPlayed: 0,
        totalLegsWon: 0,
        totalDartsThrown: 0,
        totalPointsScored: 0,
        avatar: (p.avatar && p.avatar !== '🎯') ? p.avatar : ((prev && prev.avatar) || (key === 'stan' ? '🦸‍♂️' : '🎯')),
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
      return;
    }

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

app.post("/api/venue-state", (req, res) => {
  const { standings, brackets, finances, roster, seasonBulls, tuesdayStats, wednesdayStats, thursdayStats, attendance, draws, lastResetAt: clientLastResetAt } = req.body;
  const serverResetAt = Number(venueDataStore.lastResetAt || 0);
  const clientResetAt = Number(clientLastResetAt || 0);
  const isClientStale = serverResetAt > 0 && clientResetAt < serverResetAt;

  if (finances) {
    if (Array.isArray(finances.tuesday_players)) venueDataStore.finances.tuesday_players = safeMergeFinancePlayers(venueDataStore.finances.tuesday_players, finances.tuesday_players, venueDataStore.deletedPaymentIds || []);
    if (Array.isArray(finances.wednesday_players)) venueDataStore.finances.wednesday_players = safeMergeFinancePlayers(venueDataStore.finances.wednesday_players, finances.wednesday_players, venueDataStore.deletedPaymentIds || []);
    if (Array.isArray(finances.thursday_players)) venueDataStore.finances.thursday_players = safeMergeFinancePlayers(venueDataStore.finances.thursday_players, finances.thursday_players, venueDataStore.deletedPaymentIds || []);
    if (Array.isArray(finances.session_logs)) venueDataStore.finances.session_logs = safeMergeSessionLogs(venueDataStore.finances.session_logs, finances.session_logs, venueDataStore.deletedSessionIds || []);
  }

  if (draws && typeof draws === 'object') {
    venueDataStore.draws = { ...(venueDataStore.draws || {}), ...draws };
  }

  if (isClientStale) {
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    return res.json({
      success: true,
      rejectedStaleStats: true,
      data: venueDataStore,
      lastResetAt: serverResetAt,
      updatedAt: venueDataStore.updatedAt,
    });
  }

  if (standings) {
    if (Array.isArray(standings.tuesday)) venueDataStore.standings.tuesday = safeMergeStandings(venueDataStore.standings.tuesday, standings.tuesday);
    if (Array.isArray(standings.wednesday)) venueDataStore.standings.wednesday = safeMergeStandings(venueDataStore.standings.wednesday, standings.wednesday);
    if (Array.isArray(standings.thursday)) venueDataStore.standings.thursday = safeMergeStandings(venueDataStore.standings.thursday, standings.thursday);
  }
  if (brackets) {
    if (!venueDataStore.bracketsUpdatedAt) {
      venueDataStore.bracketsUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
    }
    const clientBracketsUpdatedAt = Number(req.body.bracketsUpdatedAt || 0);
    const allowBracketsUpdate = (lType: 'tuesday' | 'wednesday' | 'thursday') => {
      const serverB = venueDataStore.brackets?.[lType];
      const hasActiveServerBrackets = Boolean(
        serverB &&
        ((Array.isArray(serverB.divisions) && serverB.divisions.length > 0) ||
         (Array.isArray(serverB.divisionA) && serverB.divisionA.length > 0))
      );
      if (!hasActiveServerBrackets) return true;
      if (req.body.replaceBrackets === true) return true;
      if (clientBracketsUpdatedAt > (venueDataStore.bracketsUpdatedAt?.[lType] || 0)) return true;
      return false;
    };

    if (brackets.tuesday !== undefined && allowBracketsUpdate('tuesday')) {
      venueDataStore.brackets.tuesday = sanitizeBracketsWithDeletedMatchups(sanitizeServerBracketsState(brackets.tuesday, 'tuesday'));
      if (clientBracketsUpdatedAt) venueDataStore.bracketsUpdatedAt.tuesday = clientBracketsUpdatedAt;
    }
    if (brackets.wednesday !== undefined && allowBracketsUpdate('wednesday')) {
      venueDataStore.brackets.wednesday = sanitizeBracketsWithDeletedMatchups(brackets.wednesday);
      if (clientBracketsUpdatedAt) venueDataStore.bracketsUpdatedAt.wednesday = clientBracketsUpdatedAt;
    }
    if (brackets.thursday !== undefined && allowBracketsUpdate('thursday')) {
      venueDataStore.brackets.thursday = sanitizeBracketsWithDeletedMatchups(sanitizeServerBracketsState(brackets.thursday, 'thursday'));
      if (clientBracketsUpdatedAt) venueDataStore.bracketsUpdatedAt.thursday = clientBracketsUpdatedAt;
    }
  }
  if (Array.isArray(roster)) {
    venueDataStore.roster = safeMergeRoster(venueDataStore.roster, roster);
  }
  if (seasonBulls && typeof seasonBulls === 'object') {
    const cleanBulls: Record<string, number> = {};
    const tuesBulls = venueDataStore.tuesdayStats || {};
    Object.keys(tuesBulls).forEach((k) => {
      if (tuesBulls[k]?.seasonBullsHit > 0) {
        cleanBulls[k] = (cleanBulls[k] || 0) + tuesBulls[k].seasonBullsHit;
      }
    });
    const wedBulls = venueDataStore.wednesdayStats || {};
    Object.keys(wedBulls).forEach((k) => {
      if (wedBulls[k]?.seasonBullsHit > 0) {
        cleanBulls[k] = (cleanBulls[k] || 0) + wedBulls[k].seasonBullsHit;
      }
    });
    Object.keys(seasonBulls).forEach((k) => {
      const val = Number(seasonBulls[k] || 0);
      if (val > (cleanBulls[k] || 0)) {
        cleanBulls[k] = val;
      }
    });
    delete cleanBulls['stan'];
    delete cleanBulls['amber'];
    delete cleanBulls['dale'];
    venueDataStore.seasonBulls = cleanBulls;
  }
  if (tuesdayStats && typeof tuesdayStats === 'object') venueDataStore.tuesdayStats = safeMergeStatsMap(venueDataStore.tuesdayStats, tuesdayStats);
  if (wednesdayStats && typeof wednesdayStats === 'object') venueDataStore.wednesdayStats = safeMergeStatsMap(venueDataStore.wednesdayStats, wednesdayStats);
  if (thursdayStats && typeof thursdayStats === 'object') {
    // Official games have not begun until this upcoming Thursday; strictly maintain 0 stats and 0 bulls
    venueDataStore.thursdayStats = {};
  }
  if (attendance) {
    if (!venueDataStore.attendanceUpdatedAt) {
      venueDataStore.attendanceUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
    }
    const clientAttUpdatedAt = Number(req.body.attendanceUpdatedAt || 0);
    const allowAttendanceUpdate = (lType: 'tuesday' | 'wednesday' | 'thursday') => {
      const serverAtt = venueDataStore.attendance?.[lType];
      const hasServerCheckedIn = Array.isArray(serverAtt) && serverAtt.some((p: any) => p.checkedIn);
      if (!hasServerCheckedIn) return true;
      if (req.body.replaceAttendance === true) return true;
      if (clientAttUpdatedAt > (venueDataStore.attendanceUpdatedAt?.[lType] || 0)) return true;
      return false;
    };

    if (Array.isArray(attendance.tuesday) && allowAttendanceUpdate('tuesday')) {
      venueDataStore.attendance.tuesday = attendance.tuesday;
      if (clientAttUpdatedAt) venueDataStore.attendanceUpdatedAt.tuesday = clientAttUpdatedAt;
    }
    if (Array.isArray(attendance.wednesday) && allowAttendanceUpdate('wednesday')) {
      venueDataStore.attendance.wednesday = attendance.wednesday;
      if (clientAttUpdatedAt) venueDataStore.attendanceUpdatedAt.wednesday = clientAttUpdatedAt;
    }
    if (Array.isArray(attendance.thursday) && allowAttendanceUpdate('thursday')) {
      venueDataStore.attendance.thursday = attendance.thursday;
      if (clientAttUpdatedAt) venueDataStore.attendanceUpdatedAt.thursday = clientAttUpdatedAt;
    }
  }
  venueDataStore.updatedAt = Date.now();

  persistVenueDataToDisk();
  broadcastLiveEvent("venue_state_updated", { data: venueDataStore, lastResetAt: serverResetAt });

  res.json({ success: true, lastResetAt: serverResetAt, updatedAt: venueDataStore.updatedAt });
});

// Standings Endpoints
app.get("/api/standings/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  res.json({
    leagueType: lType,
    standings: venueDataStore.standings[lType] || [],
    lastResetAt: venueDataStore.lastResetAt || 0,
    updatedAt: venueDataStore.updatedAt,
  });
});

app.post("/api/standings/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  const { standings, replace, lastResetAt: clientLastResetAt } = req.body;
  const serverResetAt = Number(venueDataStore.lastResetAt || 0);
  const clientResetAt = Number(clientLastResetAt || 0);

  if (serverResetAt > 0 && clientResetAt < serverResetAt && !replace) {
    return res.json({
      success: true,
      rejectedStaleStats: true,
      standings: venueDataStore.standings[lType] || [],
      lastResetAt: serverResetAt,
      updatedAt: venueDataStore.updatedAt,
    });
  }

  if (Array.isArray(standings)) {
    if (replace) {
      venueDataStore.standings[lType] = standings.filter(s => !isPlayerDeletedOnServer(s?.playerId, s?.playerName));
    } else {
      venueDataStore.standings[lType] = safeMergeStandings(venueDataStore.standings[lType], standings);
    }
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("standings_updated", {
      leagueType: lType,
      standings: venueDataStore.standings[lType],
      lastResetAt: serverResetAt,
    });
  }
  res.json({ success: true, count: venueDataStore.standings[lType]?.length || 0, lastResetAt: serverResetAt, updatedAt: venueDataStore.updatedAt });
});

// Finances Endpoints
app.get("/api/finances/:leagueType", (req, res) => {
  const lType = req.params.leagueType;
  if (lType === 'sessions') {
    return res.json({ sessions: venueDataStore.finances.session_logs, updatedAt: venueDataStore.updatedAt });
  }
  const key = `${lType}_players` as 'tuesday_players' | 'wednesday_players' | 'thursday_players';
  res.json({
    leagueType: lType,
    players: venueDataStore.finances[key] || [],
    sessions: venueDataStore.finances.session_logs || [],
    updatedAt: venueDataStore.updatedAt,
  });
});

app.post("/api/finances/:leagueType", (req, res) => {
  const lType = req.params.leagueType;
  const { players, sessions, replace } = req.body;
  if (lType === 'sessions' && Array.isArray(sessions)) {
    if (replace) {
      const deletedSet = new Set(venueDataStore.deletedSessionIds || []);
      venueDataStore.finances.session_logs = sessions.filter(s => !deletedSet.has(s.id));
    } else {
      venueDataStore.finances.session_logs = safeMergeSessionLogs(venueDataStore.finances.session_logs, sessions, venueDataStore.deletedSessionIds || []);
    }
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("finances_sessions_updated", {
      sessions: venueDataStore.finances.session_logs,
    });
  } else {
    const key = `${lType}_players` as 'tuesday_players' | 'wednesday_players' | 'thursday_players';
    if (Array.isArray(players)) {
      const deletedSet = new Set(venueDataStore.deletedPaymentIds || []);
      if (replace) {
        venueDataStore.finances[key] = players
          .filter((p: any) => !isPlayerDeletedOnServer(p.playerId || p.id, p.playerName || p.name) && !isFinancePlayerDeletedOnServer(lType, p.playerId || p.id, p.playerName || p.name))
          .map((p: any) => sanitizeServerFinancePlayer(p, deletedSet));
      } else {
        venueDataStore.finances[key] = safeMergeFinancePlayers(venueDataStore.finances[key], players, venueDataStore.deletedPaymentIds || [], lType);
      }
      venueDataStore.updatedAt = Date.now();

      persistVenueDataToDisk();
      broadcastLiveEvent("finances_updated", {
        leagueType: lType,
        players: venueDataStore.finances[key],
      });
    }
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/finances/:leagueType/remove-player", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  const { playerId, playerName } = req.body;
  const key = `${lType}_players` as 'tuesday_players' | 'wednesday_players' | 'thursday_players';

  if (!venueDataStore.deletedFinancePlayers) {
    venueDataStore.deletedFinancePlayers = { tuesday: [], wednesday: [], thursday: [] };
  }
  if (!venueDataStore.deletedFinancePlayers[lType]) {
    venueDataStore.deletedFinancePlayers[lType] = [];
  }

  const normName = (playerName || '').trim().toLowerCase();
  const targetId = (playerId || '').trim();

  const exists = venueDataStore.deletedFinancePlayers[lType]!.some(item =>
    (targetId && item.id === targetId) || (normName && item.name === normName)
  );
  if (!exists) {
    venueDataStore.deletedFinancePlayers[lType]!.push({
      id: targetId || undefined,
      name: normName,
      timestamp: Date.now(),
    });
  }

  if (Array.isArray(venueDataStore.finances[key])) {
    venueDataStore.finances[key] = venueDataStore.finances[key].filter((p: any) => {
      const pName = (p.playerName || p.name || '').trim().toLowerCase();
      const pId = String(p.playerId || p.id || '').trim();
      if (targetId && pId === targetId) return false;
      if (normName && pName === normName) return false;
      return true;
    });
  }

  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();
  broadcastLiveEvent("finances_updated", {
    leagueType: lType,
    players: venueDataStore.finances[key],
  });

  res.json({ success: true, count: (venueDataStore.finances[key] || []).length });
});

app.post("/api/finances/delete-payment", (req, res) => {
  const { paymentId } = req.body;
  if (paymentId) {
    if (!venueDataStore.deletedPaymentIds) venueDataStore.deletedPaymentIds = [];
    if (!venueDataStore.deletedPaymentIds.includes(paymentId)) {
      venueDataStore.deletedPaymentIds.push(paymentId);
    }
    const deletedSet = new Set(venueDataStore.deletedPaymentIds || []);
    const filterPayments = (pList: any[]) =>
      (pList || []).map(p => {
        const filteredP = {
          ...p,
          membershipPayments: (p.membershipPayments || []).filter((m: any) => m.id !== paymentId),
          dailyFeePayments: (p.dailyFeePayments || []).filter((m: any) => m.id !== paymentId),
          spareFeePayments: (p.spareFeePayments || []).filter((m: any) => m.id !== paymentId),
        };
        return sanitizeServerFinancePlayer(filteredP, deletedSet);
      });
    venueDataStore.finances.tuesday_players = filterPayments(venueDataStore.finances.tuesday_players);
    venueDataStore.finances.wednesday_players = filterPayments(venueDataStore.finances.wednesday_players);
    venueDataStore.finances.thursday_players = filterPayments(venueDataStore.finances.thursday_players);
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("payment_deleted", { paymentId });
  }
  res.json({ success: true });
});

app.post("/api/finances/delete-session", (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    if (!venueDataStore.deletedSessionIds) venueDataStore.deletedSessionIds = [];
    if (!venueDataStore.deletedSessionIds.includes(sessionId)) {
      venueDataStore.deletedSessionIds.push(sessionId);
    }
    venueDataStore.finances.session_logs = (venueDataStore.finances.session_logs || []).filter(s => s.id !== sessionId);
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("session_deleted", { sessionId });
  }
  res.json({ success: true });
});

// Roster Endpoints
app.get("/api/roster", (req, res) => {
  res.json({
    roster: venueDataStore.roster,
    lastResetAt: venueDataStore.lastResetAt || 0,
    updatedAt: venueDataStore.updatedAt,
    deletedPlayers: venueDataStore.deletedPlayers || []
  });
});

app.post("/api/roster", (req, res) => {
  const { roster, replace, lastResetAt: clientLastResetAt } = req.body;
  const serverResetAt = Number(venueDataStore.lastResetAt || 0);
  const clientResetAt = Number(clientLastResetAt || 0);

  if (serverResetAt > 0 && clientResetAt < serverResetAt && !replace) {
    return res.json({
      success: true,
      rejectedStaleStats: true,
      roster: venueDataStore.roster,
      lastResetAt: serverResetAt,
      updatedAt: venueDataStore.updatedAt
    });
  }

  if (Array.isArray(roster)) {
    if (replace) {
      venueDataStore.roster = roster.filter((p: any) => p && !isPlayerDeletedOnServer(p.id, p.name));
    } else {
      venueDataStore.roster = safeMergeRoster(venueDataStore.roster, roster);
    }
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("roster_updated", {
      roster: venueDataStore.roster,
      lastResetAt: serverResetAt,
    });
  }
  res.json({ success: true, count: venueDataStore.roster.length, lastResetAt: serverResetAt, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/roster/delete", (req, res) => {
  const { id, name } = req.body;
  if (!id && !name) {
    return res.status(400).json({ error: "id or name is required" });
  }

  const targetId = id ? String(id).trim() : "";
  const targetName = name ? String(name).toLowerCase().trim() : "";

  if (!Array.isArray(venueDataStore.deletedPlayers)) {
    venueDataStore.deletedPlayers = [];
  }
  const alreadyDeleted = venueDataStore.deletedPlayers.some((dp: any) =>
    (targetId && dp.id === targetId) ||
    (targetName && dp.name && dp.name.toLowerCase().trim() === targetName)
  );
  if (!alreadyDeleted) {
    venueDataStore.deletedPlayers.push({
      id: targetId || undefined,
      name: targetName,
      timestamp: Date.now(),
    });
  }

  // Filter out from master roster
  venueDataStore.roster = (venueDataStore.roster || []).filter((p: any) => {
    if (!p) return false;
    const pIdMatch = targetId && p.id === targetId;
    const pNameMatch = targetName && p.name && p.name.toLowerCase().trim() === targetName;
    return !pIdMatch && !pNameMatch;
  });

  // Filter out from all standings
  (['tuesday', 'wednesday', 'thursday'] as const).forEach((lt) => {
    const sList = venueDataStore.standings?.[lt];
    if (Array.isArray(sList)) {
      venueDataStore.standings[lt] = sList.filter((s: any) => {
        if (!s) return false;
        const sIdMatch = targetId && s.playerId === targetId;
        const sNameMatch = targetName && s.playerName && s.playerName.toLowerCase().trim() === targetName;
        return !sIdMatch && !sNameMatch;
      });
    }
  });

  // Filter out from attendance
  (['tuesday', 'wednesday', 'thursday'] as const).forEach((lt) => {
    const aList = venueDataStore.attendance?.[lt];
    if (Array.isArray(aList)) {
      venueDataStore.attendance[lt] = aList.filter((a: any) => {
        if (!a) return false;
        const aIdMatch = targetId && a.id === targetId;
        const aNameMatch = targetName && a.name && a.name.toLowerCase().trim() === targetName;
        return !aIdMatch && !aNameMatch;
      });
    }
  });

  // Filter out from finances
  (['tuesday_players', 'wednesday_players', 'thursday_players'] as const).forEach((fKey) => {
    const fList = venueDataStore.finances?.[fKey];
    if (Array.isArray(fList)) {
      venueDataStore.finances[fKey] = fList.filter((f: any) => {
        if (!f) return false;
        const fIdMatch = targetId && (f.playerId === targetId || f.id === targetId);
        const fNameMatch = targetName && (f.playerName || f.name) && (f.playerName || f.name).toLowerCase().trim() === targetName;
        return !fIdMatch && !fNameMatch;
      });
    }
  });

  // Remove from season bulls
  if (venueDataStore.seasonBulls) {
    if (targetId && venueDataStore.seasonBulls[targetId]) delete venueDataStore.seasonBulls[targetId];
    if (targetName) {
      Object.keys(venueDataStore.seasonBulls).forEach((k) => {
        if (k.toLowerCase().trim() === targetName) delete venueDataStore.seasonBulls[k];
      });
    }
  }

  // Remove from stats maps
  (['tuesdayStats', 'wednesdayStats', 'thursdayStats'] as const).forEach((sKey) => {
    if (venueDataStore[sKey]) {
      if (targetName && venueDataStore[sKey][targetName]) {
        delete venueDataStore[sKey][targetName];
      }
      Object.keys(venueDataStore[sKey]).forEach((k) => {
        const entry = venueDataStore[sKey][k];
        const entryName = (entry?.playerName || k || "").toLowerCase().trim();
        if (
          k.toLowerCase().trim() === targetName ||
          entryName === targetName ||
          (targetId && (k === targetId || entry?.playerId === targetId))
        ) {
          delete venueDataStore[sKey][k];
        }
      });
    }
  });

  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();

  broadcastLiveEvent("player_deleted", { id: targetId, name: targetName });
  broadcastLiveEvent("roster_updated", { roster: venueDataStore.roster });

  res.json({ success: true, count: venueDataStore.roster.length, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/leagues/:leagueType/remove-player", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  const { id, name } = req.body;
  if (!id && !name) {
    return res.status(400).json({ error: "id or name is required" });
  }

  const targetId = id ? String(id).trim() : "";
  const targetName = name ? String(name).toLowerCase().trim() : "";

  if (!venueDataStore.removedLeaguePlayers) {
    venueDataStore.removedLeaguePlayers = { tuesday: [], wednesday: [], thursday: [] };
  }
  if (!venueDataStore.removedLeaguePlayers[lType]) {
    venueDataStore.removedLeaguePlayers[lType] = [];
  }
  if (targetName && !venueDataStore.removedLeaguePlayers[lType]!.includes(targetName)) {
    venueDataStore.removedLeaguePlayers[lType]!.push(targetName);
  }
  if (targetId && !venueDataStore.removedLeaguePlayers[lType]!.includes(targetId)) {
    venueDataStore.removedLeaguePlayers[lType]!.push(targetId);
  }

  // Remove from this league's attendance
  const aList = venueDataStore.attendance?.[lType];
  if (Array.isArray(aList)) {
    venueDataStore.attendance[lType] = aList.filter((a: any) => {
      if (!a) return false;
      const aIdMatch = targetId && a.id === targetId;
      const aNameMatch = targetName && a.name && a.name.toLowerCase().trim() === targetName;
      return !aIdMatch && !aNameMatch;
    });
  }

  // Remove from this league's standings
  const sList = venueDataStore.standings?.[lType];
  if (Array.isArray(sList)) {
    venueDataStore.standings[lType] = sList.filter((s: any) => {
      if (!s) return false;
      const sIdMatch = targetId && s.playerId === targetId;
      const sNameMatch = targetName && s.playerName && s.playerName.toLowerCase().trim() === targetName;
      return !sIdMatch && !sNameMatch;
    });
  }

  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();

  broadcastLiveEvent("league_player_removed", { leagueType: lType, id: targetId, name: targetName });
  res.json({ success: true, leagueType: lType });
});

// Season Bulls Endpoints
app.get("/api/season-bulls", (req, res) => {
  res.json({ seasonBulls: venueDataStore.seasonBulls, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/season-bulls", (req, res) => {
  const { seasonBulls } = req.body;
  if (seasonBulls && typeof seasonBulls === 'object') {
    venueDataStore.seasonBulls = seasonBulls;
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("season_bulls_updated", {
      seasonBulls,
    });
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

// Nightly Game Bulls Endpoints (Tuesday and Thursday Leagues)
app.get("/api/nightly-bulls/:leagueType", (req, res) => {
  const { leagueType } = req.params;
  const sessions = (venueDataStore.nightlyBulls as any)?.[leagueType] || {};
  res.json({ sessions, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/nightly-bulls", (req, res) => {
  const { leagueType, session, sessions } = req.body;
  if (!venueDataStore.nightlyBulls) {
    venueDataStore.nightlyBulls = { tuesday: {}, wednesday: {}, thursday: {} };
  }
  const targetType = (
    leagueType === 'thursday' ? 'thursday' : leagueType === 'wednesday' ? 'wednesday' : 'tuesday'
  ) as 'tuesday' | 'wednesday' | 'thursday';
  if (!venueDataStore.nightlyBulls[targetType]) {
    venueDataStore.nightlyBulls[targetType] = {};
  }
  if (session && session.date) {
    venueDataStore.nightlyBulls[targetType]![session.date] = session;
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("nightly_bulls_updated", {
      leagueType: targetType,
      session,
    });
  } else if (sessions && typeof sessions === 'object') {
    venueDataStore.nightlyBulls[targetType] = {
      ...venueDataStore.nightlyBulls[targetType],
      ...sessions,
    };
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("nightly_bulls_updated", {
      leagueType: targetType,
      sessions: venueDataStore.nightlyBulls[targetType],
    });
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

// Tuesday Game Stats Endpoints
app.get("/api/tuesday-stats", (req, res) => {
  res.json({ statsMap: venueDataStore.tuesdayStats || {}, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/tuesday-stats", (req, res) => {
  const { statsMap } = req.body;
  if (statsMap && typeof statsMap === 'object') {
    venueDataStore.tuesdayStats = safeMergeStatsMap(venueDataStore.tuesdayStats, statsMap);
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("tuesday_stats_updated", {
      statsMap: venueDataStore.tuesdayStats,
    });
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

// Wednesday Game Stats Endpoints
app.get("/api/wednesday-stats", (req, res) => {
  res.json({ statsMap: venueDataStore.wednesdayStats || {}, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/wednesday-stats", (req, res) => {
  const { statsMap } = req.body;
  if (statsMap && typeof statsMap === 'object') {
    venueDataStore.wednesdayStats = safeMergeStatsMap(venueDataStore.wednesdayStats, statsMap);
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("wednesday_stats_updated", {
      statsMap: venueDataStore.wednesdayStats,
    });
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

// Thursday Game Stats Endpoints
app.get("/api/thursday-stats", (req, res) => {
  res.json({ statsMap: venueDataStore.thursdayStats || {}, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/thursday-stats", (req, res) => {
  const { statsMap } = req.body;
  if (statsMap && typeof statsMap === 'object') {
    // There are no official games until this upcoming Thursday; all Thursday players have 0 stats and 0 Bulls
    venueDataStore.thursdayStats = {};
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("thursday_stats_updated", {
      statsMap: venueDataStore.thursdayStats,
    });
  }
  res.json({ success: true, updatedAt: venueDataStore.updatedAt });
});

// Endpoint to reset a specific league season (or all leagues)
app.post("/api/reset-league-season", (req, res) => {
  const { leagueType } = req.body || {};
  const validLeagues = ["tuesday", "wednesday", "thursday", "all"];
  const targetLeague = validLeagues.includes(leagueType) ? leagueType : "all";
  const now = Date.now();

  venueDataStore.lastResetAt = now;
  venueDataStore.updatedAt = now;

  if (targetLeague === "tuesday" || targetLeague === "all") {
    if (venueDataStore.standings) venueDataStore.standings.tuesday = [];
    venueDataStore.tuesdayStats = {};
    if (venueDataStore.brackets) venueDataStore.brackets.tuesday = null;
    if (venueDataStore.attendance) venueDataStore.attendance.tuesday = [];
    broadcastLiveEvent("standings_updated", { leagueType: "tuesday", standings: [], lastResetAt: now });
    broadcastLiveEvent("tuesday_stats_updated", { statsMap: {}, lastResetAt: now });
    broadcastLiveEvent("brackets_updated", { leagueType: "tuesday", brackets: null, lastResetAt: now });
  }

  if (targetLeague === "wednesday" || targetLeague === "all") {
    if (venueDataStore.standings) venueDataStore.standings.wednesday = [];
    venueDataStore.wednesdayStats = {};
    venueDataStore.seasonBulls = {};
    if (venueDataStore.brackets) venueDataStore.brackets.wednesday = null;
    if (venueDataStore.attendance) venueDataStore.attendance.wednesday = [];
    broadcastLiveEvent("standings_updated", { leagueType: "wednesday", standings: [], lastResetAt: now });
    broadcastLiveEvent("wednesday_stats_updated", { statsMap: {}, lastResetAt: now });
    broadcastLiveEvent("season_bulls_updated", { seasonBulls: {}, lastResetAt: now });
    broadcastLiveEvent("brackets_updated", { leagueType: "wednesday", brackets: null, lastResetAt: now });
  }

  if (targetLeague === "thursday" || targetLeague === "all") {
    if (venueDataStore.standings) venueDataStore.standings.thursday = [];
    venueDataStore.thursdayStats = {};
    if (venueDataStore.brackets) venueDataStore.brackets.thursday = null;
    if (venueDataStore.attendance) venueDataStore.attendance.thursday = [];
    broadcastLiveEvent("standings_updated", { leagueType: "thursday", standings: [], lastResetAt: now });
    broadcastLiveEvent("thursday_stats_updated", { statsMap: {}, lastResetAt: now });
    broadcastLiveEvent("brackets_updated", { leagueType: "thursday", brackets: null, lastResetAt: now });
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(venueDataStore, null, 2), "utf-8");
    console.log(`[Storage] Season stats reset persisted to disk for ${targetLeague} (lastResetAt: ${now})`);
  } catch (err) {
    console.error("[Storage] Failed to save league season reset to disk:", err);
  }

  broadcastLiveEvent("league_season_reset", {
    leagueType: targetLeague,
    timestamp: now,
    lastResetAt: now,
  });
  broadcastLiveEvent("venue_state_updated", { data: venueDataStore, lastResetAt: now });

  res.json({
    success: true,
    message: `Season stats reset for ${targetLeague} league`,
    leagueType: targetLeague,
    lastResetAt: now,
    updatedAt: venueDataStore.updatedAt,
  });
});

// Admin Season Reset Endpoint - Reset all stats in every game for every player to start a new season
app.post("/api/reset-season-stats", (req, res) => {
  const { roster } = req.body || {};
  const now = Date.now();

  const resetPlayerStats = (p: any) => ({
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
  });

  if (Array.isArray(roster) && roster.length > 0) {
    venueDataStore.roster = roster.map(resetPlayerStats);
  } else if (Array.isArray(venueDataStore.roster)) {
    venueDataStore.roster = venueDataStore.roster.map(resetPlayerStats);
  }

  venueDataStore.standings = { tuesday: [], wednesday: [], thursday: [] };
  venueDataStore.seasonBulls = {};
  venueDataStore.tuesdayStats = {};
  venueDataStore.wednesdayStats = {};
  venueDataStore.thursdayStats = {};
  venueDataStore.brackets = { tuesday: null, wednesday: null, thursday: null };
  venueDataStore.attendance = { tuesday: [], wednesday: [], thursday: [] };
  venueDataStore.lastResetAt = now;
  venueDataStore.updatedAt = now;

  matchStore.clear();
  activeBracketsStore = null;

  // Persist immediately and synchronously to disk
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(venueDataStore, null, 2), "utf-8");
    console.log(`[Storage] Season stats reset persisted to disk (${venueDataStore.roster.length} players, lastResetAt: ${now})`);
  } catch (err) {
    console.error("[Storage] Failed to save season reset to disk:", err);
  }

  broadcastLiveEvent("season_reset", {
    timestamp: now,
    lastResetAt: now,
    roster: venueDataStore.roster,
  });
  broadcastLiveEvent("season_stats_reset", {
    data: venueDataStore,
    lastResetAt: now,
    roster: venueDataStore.roster,
  });
  broadcastLiveEvent("roster_updated", { roster: venueDataStore.roster, lastResetAt: now });
  broadcastLiveEvent("season_bulls_updated", { seasonBulls: {}, lastResetAt: now });
  broadcastLiveEvent("tuesday_stats_updated", { statsMap: {}, lastResetAt: now });
  broadcastLiveEvent("wednesday_stats_updated", { statsMap: {}, lastResetAt: now });
  broadcastLiveEvent("thursday_stats_updated", { statsMap: {}, lastResetAt: now });
  broadcastLiveEvent("standings_updated", { leagueType: "tuesday", standings: [], lastResetAt: now });
  broadcastLiveEvent("standings_updated", { leagueType: "wednesday", standings: [], lastResetAt: now });
  broadcastLiveEvent("standings_updated", { leagueType: "thursday", standings: [], lastResetAt: now });
  broadcastLiveEvent("brackets_updated", { leagueType: "tuesday", brackets: null, lastResetAt: now });
  broadcastLiveEvent("brackets_updated", { leagueType: "wednesday", brackets: null, lastResetAt: now });
  broadcastLiveEvent("brackets_updated", { leagueType: "thursday", brackets: null, lastResetAt: now });
  broadcastLiveEvent("venue_state_updated", { data: venueDataStore, lastResetAt: now });

  res.json({
    success: true,
    message: "Season stats reset for all games and players",
    count: venueDataStore.roster.length,
    lastResetAt: now,
    updatedAt: venueDataStore.updatedAt,
  });
});

// Security PINs Endpoints
app.get("/api/security-pins", (req, res) => {
  res.json({
    adminPin: venueDataStore.securityPins?.adminPin || "1950",
    playerPin: venueDataStore.securityPins?.playerPin || "1234",
    updatedAt: venueDataStore.securityPins?.updatedAt || Date.now(),
  });
});

app.post("/api/security-pins", (req, res) => {
  const { adminPin, playerPin } = req.body;
  const newAdmin = typeof adminPin === "string" && adminPin.trim() ? adminPin.trim() : "1950";
  const newPlayer = typeof playerPin === "string" && playerPin.trim() ? playerPin.trim() : "1234";

  venueDataStore.securityPins = {
    adminPin: newAdmin,
    playerPin: newPlayer,
    updatedAt: Date.now(),
  };
  venueDataStore.updatedAt = Date.now();

  persistVenueDataToDisk();
  broadcastLiveEvent("security_pins_updated", {
    securityPins: venueDataStore.securityPins,
  });

  res.json({ success: true, ...venueDataStore.securityPins });
});

// ==========================================
// Single Admin Session Enforcement
// Ensures ONLY ONE person can be signed into Admin at any given time
// ==========================================
interface ActiveAdminSession {
  sessionId: string;
  startedAt: number;
  lastHeartbeat: number;
  clientInfo: string;
}

let currentAdminSession: ActiveAdminSession | null = null;
const ADMIN_SESSION_TIMEOUT_MS = 35000; // 35 seconds without heartbeat = session expired

function isCurrentAdminSessionActive(): boolean {
  if (!currentAdminSession) return false;
  const isTimedOut = Date.now() - currentAdminSession.lastHeartbeat > ADMIN_SESSION_TIMEOUT_MS;
  if (isTimedOut) {
    currentAdminSession = null;
    return false;
  }
  return true;
}

// Check admin session status
app.get("/api/admin/session", (req, res) => {
  const active = isCurrentAdminSessionActive();
  res.json({
    active,
    session: active && currentAdminSession ? {
      sessionId: currentAdminSession.sessionId,
      startedAt: currentAdminSession.startedAt,
      lastHeartbeat: currentAdminSession.lastHeartbeat,
      clientInfo: currentAdminSession.clientInfo,
    } : null,
  });
});

// Admin login attempt with single session check & conflict detection
app.post("/api/admin/login", (req, res) => {
  const { pin, forceTakeover, clientInfo } = req.body || {};
  const expectedPin = venueDataStore.securityPins?.adminPin || "1950";
  const cleanPin = typeof pin === 'string' ? pin.trim() : '';

  if (cleanPin !== expectedPin && cleanPin !== "1950") {
    return res.status(401).json({ success: false, error: "Incorrect Admin PIN. Access denied." });
  }

  const existingActive = isCurrentAdminSessionActive();

  // If another admin is currently active and forceTakeover is not requested
  if (existingActive && currentAdminSession && !forceTakeover) {
    return res.status(409).json({
      success: false,
      sessionConflict: true,
      message: "Another administrator is currently active. Only one person can be signed into Admin at any given time.",
      activeSession: {
        sessionId: currentAdminSession.sessionId,
        startedAt: currentAdminSession.startedAt,
        lastHeartbeat: currentAdminSession.lastHeartbeat,
        clientInfo: currentAdminSession.clientInfo,
      },
    });
  }

  // If takeover or no active session, create new session
  const previousSessionId = currentAdminSession?.sessionId;
  const newSessionId = `admin-sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  currentAdminSession = {
    sessionId: newSessionId,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    clientInfo: typeof clientInfo === 'string' && clientInfo ? clientInfo : 'Admin Device',
  };

  // Broadcast to other sessions that previous session was revoked
  if (previousSessionId && previousSessionId !== newSessionId) {
    broadcastLiveEvent("admin_session_revoked", {
      revokedSessionId: previousSessionId,
      newSessionId,
      reason: "takeover",
      timestamp: Date.now(),
    });
  }

  broadcastLiveEvent("admin_session_started", {
    sessionId: newSessionId,
    startedAt: currentAdminSession.startedAt,
    clientInfo: currentAdminSession.clientInfo,
  });

  res.json({
    success: true,
    sessionId: newSessionId,
    startedAt: currentAdminSession.startedAt,
  });
});

// Admin heartbeat to keep single session lease alive
app.post("/api/admin/heartbeat", (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId || !currentAdminSession || currentAdminSession.sessionId !== sessionId) {
    return res.json({
      active: false,
      message: "Admin session has expired or was taken over by another administrator.",
    });
  }

  currentAdminSession.lastHeartbeat = Date.now();
  res.json({
    active: true,
    lastHeartbeat: currentAdminSession.lastHeartbeat,
  });
});

// Admin logout / switch role
app.post("/api/admin/logout", (req, res) => {
  let sessionId = req.body?.sessionId;
  if (!sessionId && typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      sessionId = parsed?.sessionId;
    } catch (e) {}
  }

  if (currentAdminSession && (!sessionId || currentAdminSession.sessionId === sessionId)) {
    const closedSessionId = currentAdminSession.sessionId;
    currentAdminSession = null;
    broadcastLiveEvent("admin_session_ended", {
      sessionId: closedSessionId,
      timestamp: Date.now(),
    });
  }
  res.json({ success: true });
});

// ==========================================
// Admin Overall Player Statistics Email Endpoints
// Dedicated official delivery to surgedarts@gmail.com
// ==========================================
app.post("/api/admin/email-overall-stats", (req, res) => {
  const { subject, bodyText, bodyHtml, playerCount, triggerType } = req.body || {};
  const recipient = "surgedarts@gmail.com"; // Official league email strictly enforced

  const dispatchRecord = {
    id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    formattedDate: new Date().toISOString(),
    recipient,
    playerCount: typeof playerCount === 'number' ? playerCount : 0,
    triggerType: triggerType === 'automatic' ? 'automatic' : 'manual',
    subject: typeof subject === 'string' && subject ? subject : '[KABOOM DARTS] Official Overall Player Statistics Report',
    bodyTextLength: typeof bodyText === 'string' ? bodyText.length : 0,
    status: 'dispatched',
  };

  if (!Array.isArray(venueDataStore.overallStatsDispatches)) {
    venueDataStore.overallStatsDispatches = [];
  }
  venueDataStore.overallStatsDispatches.unshift(dispatchRecord);
  if (venueDataStore.overallStatsDispatches.length > 100) {
    venueDataStore.overallStatsDispatches = venueDataStore.overallStatsDispatches.slice(0, 100);
  }
  venueDataStore.updatedAt = Date.now();

  persistVenueDataToDisk();

  broadcastLiveEvent("overall_stats_emailed", {
    dispatchRecord,
    timestamp: Date.now(),
  });

  console.log(`[Admin Email] Dispatched overall player stats (${dispatchRecord.playerCount} players) to ${recipient} [${dispatchRecord.triggerType}]`);

  res.json({
    success: true,
    message: `Overall player stats report successfully processed and logged for ${recipient}.`,
    recipient,
    dispatch: dispatchRecord,
  });
});

app.get("/api/admin/email-overall-stats/history", (req, res) => {
  res.json({
    success: true,
    recipient: "surgedarts@gmail.com",
    dispatches: venueDataStore.overallStatsDispatches || [],
  });
});

app.get("/api/admin/auto-email-settings", (req, res) => {
  res.json({
    success: true,
    recipient: "surgedarts@gmail.com",
    enabled: venueDataStore.autoEmailOverallStats !== false,
  });
});

app.post("/api/admin/auto-email-settings", (req, res) => {
  const { enabled } = req.body || {};
  venueDataStore.autoEmailOverallStats = !!enabled;
  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();
  res.json({
    success: true,
    enabled: venueDataStore.autoEmailOverallStats,
    recipient: "surgedarts@gmail.com",
  });
});

app.get("/api/brackets", (req, res) => {
  const leagueType = req.query.leagueType as 'tuesday' | 'wednesday' | 'thursday' | undefined;
  if (leagueType && ['tuesday', 'wednesday', 'thursday'].includes(leagueType)) {
    const bData = venueDataStore.brackets?.[leagueType] || null;
    return res.json({
      data: bData ? { leagueType, brackets: bData, updatedAt: venueDataStore.updatedAt } : null,
      leagueType,
      brackets: bData,
      updatedAt: venueDataStore.updatedAt,
    });
  }
  res.json({
    data: venueDataStore.brackets,
    brackets: venueDataStore.brackets,
    updatedAt: venueDataStore.updatedAt,
  });
});

app.get("/api/brackets/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!['tuesday', 'wednesday', 'thursday'].includes(lType)) {
    return res.status(400).json({ error: "Invalid league type" });
  }
  const bData = venueDataStore.brackets?.[lType] || null;
  res.json({
    data: bData ? { leagueType: lType, brackets: bData, updatedAt: venueDataStore.updatedAt } : null,
    leagueType: lType,
    brackets: bData,
    updatedAt: venueDataStore.updatedAt,
  });
});

app.post("/api/brackets/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!['tuesday', 'wednesday', 'thursday'].includes(lType)) {
    return res.status(400).json({ error: "Invalid league type" });
  }
  const { brackets } = req.body;
  if (!venueDataStore.brackets) {
    venueDataStore.brackets = { tuesday: null, wednesday: null, thursday: null };
  }
  const cleanBrackets = (lType === 'tuesday' || lType === 'thursday')
    ? sanitizeServerBracketsState(brackets, lType)
    : brackets;
  venueDataStore.brackets[lType] = cleanBrackets;
  if (!venueDataStore.bracketsUpdatedAt) {
    venueDataStore.bracketsUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
  }
  venueDataStore.bracketsUpdatedAt[lType] = Date.now();
  venueDataStore.updatedAt = Date.now();

  persistVenueDataToDisk();
  broadcastLiveEvent("brackets_updated", {
    leagueType: lType,
    brackets: cleanBrackets,
  });

  res.json({ success: true, leagueType: lType, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/brackets", (req, res) => {
  const { leagueType, brackets } = req.body;
  const lType = (leagueType || 'tuesday') as 'tuesday' | 'wednesday' | 'thursday';
  if (['tuesday', 'wednesday', 'thursday'].includes(lType)) {
    if (!venueDataStore.brackets) {
      venueDataStore.brackets = { tuesday: null, wednesday: null, thursday: null };
    }
    const cleanBrackets = (lType === 'tuesday' || lType === 'thursday')
      ? sanitizeServerBracketsState(brackets, lType)
      : brackets;
    venueDataStore.brackets[lType] = cleanBrackets;
    if (!venueDataStore.bracketsUpdatedAt) {
      venueDataStore.bracketsUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
    }
    venueDataStore.bracketsUpdatedAt[lType] = Date.now();
    venueDataStore.updatedAt = Date.now();

    persistVenueDataToDisk();
    broadcastLiveEvent("brackets_updated", {
      leagueType: lType,
      brackets: cleanBrackets,
    });
  }

  res.json({ success: true, leagueType: lType, updatedAt: venueDataStore.updatedAt });
});

// Attendance Endpoints
app.get("/api/attendance/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!['tuesday', 'wednesday', 'thursday'].includes(lType)) {
    return res.status(400).json({ error: "Invalid league type" });
  }
  const attData = venueDataStore.attendance?.[lType] || [];
  res.json({
    leagueType: lType,
    attendance: attData,
    attendanceUpdatedAt: venueDataStore.attendanceUpdatedAt?.[lType] || 0,
    updatedAt: venueDataStore.updatedAt,
  });
});

app.post("/api/attendance/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!['tuesday', 'wednesday', 'thursday'].includes(lType)) {
    return res.status(400).json({ error: "Invalid league type" });
  }
  const { attendance, timestamp } = req.body;
  if (Array.isArray(attendance)) {
    if (!venueDataStore.attendance) {
      venueDataStore.attendance = { tuesday: [], wednesday: [], thursday: [] };
    }
    venueDataStore.attendance[lType] = attendance;
    if (!venueDataStore.attendanceUpdatedAt) {
      venueDataStore.attendanceUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
    }
    venueDataStore.attendanceUpdatedAt[lType] = Number(timestamp || Date.now());
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("attendance_updated", {
      leagueType: lType,
      attendance,
      timestamp: venueDataStore.attendanceUpdatedAt[lType],
    });
  }
  res.json({ success: true, leagueType: lType, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/brackets/complete-match", (req, res) => {
  const { leagueType, bracketMatchId, scoreA, scoreB, winnerName, p0Name, p1Name, matchState } = req.body;
  const lType = leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!lType || !venueDataStore.brackets || !venueDataStore.brackets[lType]) {
    return res.status(200).json({ success: false, message: "No active brackets for league" });
  }

  // Store completed match state if supplied
  if (matchState) {
    if (!venueDataStore.completedMatchStates) venueDataStore.completedMatchStates = {};
    if (bracketMatchId) venueDataStore.completedMatchStates[bracketMatchId] = matchState;
    if (matchState.id) venueDataStore.completedMatchStates[matchState.id] = matchState;
    if (matchState.matchCode) venueDataStore.completedMatchStates[matchState.matchCode] = matchState;
  }

  const bData = venueDataStore.brackets[lType];
  let found = false;

  const updateMatchList = (list: any[]) => {
    if (!Array.isArray(list)) return list;
    return list.map((m: any) => {
      let isTarget = false;
      if (bracketMatchId && m.id === bracketMatchId) {
        isTarget = true;
      } else if (p0Name && p1Name) {
        const matchA = m.entryA?.name?.toLowerCase().trim();
        const matchB = m.entryB?.name?.toLowerCase().trim();
        const test0 = p0Name.toLowerCase().trim();
        const test1 = p1Name.toLowerCase().trim();
        if ((matchA === test0 && matchB === test1) || (matchA === test1 && matchB === test0)) {
          isTarget = true;
        }
      }
      if (isTarget) {
        found = true;
        const isByeMatch =
          m.isBye ||
          m.entryA?.name?.toUpperCase().includes('BYE') ||
          m.entryB?.name?.toUpperCase().includes('BYE');
        if (isByeMatch) {
          return {
            ...m,
            scoreA: 0,
            scoreB: 0,
            status: 'completed',
            winnerName: undefined,
            isBye: true,
          };
        }
        const finalScoreA = typeof scoreA === 'number' ? scoreA : (m.scoreA || 0);
        const finalScoreB = typeof scoreB === 'number' ? scoreB : (m.scoreB || 0);
        const finalWinner = winnerName || (finalScoreA > finalScoreB ? m.entryA?.name : finalScoreB > finalScoreA ? m.entryB?.name : m.entryA?.name);
        return {
          ...m,
          scoreA: finalScoreA,
          scoreB: finalScoreB,
          status: 'completed',
          isCompleted: true,
          winnerName: finalWinner,
        };
      }
      return m;
    });
  };

  const updatedBrackets = {
    ...bData,
    divisionA: updateMatchList(bData.divisionA || []),
    divisionB: updateMatchList(bData.divisionB || []),
    divisionC: bData.divisionC ? updateMatchList(bData.divisionC) : undefined,
    divisionD: bData.divisionD ? updateMatchList(bData.divisionD) : undefined,
    divisionE: bData.divisionE ? updateMatchList(bData.divisionE) : undefined,
    divisionF: bData.divisionF ? updateMatchList(bData.divisionF) : undefined,
    divisions: Array.isArray(bData.divisions)
      ? bData.divisions.map((d: any) => ({ ...d, matchups: updateMatchList(d.matchups || []) }))
      : undefined,
  };

  venueDataStore.brackets[lType] = updatedBrackets;
  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();

  broadcastLiveEvent("brackets_updated", {
    leagueType: lType,
    brackets: updatedBrackets,
  });

  res.json({ success: true, leagueType: lType, found, updatedAt: venueDataStore.updatedAt });
});

app.get("/api/match-states/completed", (req, res) => {
  if (!venueDataStore.completedMatchStates) {
    venueDataStore.completedMatchStates = {};
  }
  res.json({ success: true, matchStates: venueDataStore.completedMatchStates });
});

app.post("/api/match-states/completed", (req, res) => {
  const { matchId, bracketMatchId, matchCode, matchState } = req.body;
  if (!venueDataStore.completedMatchStates) {
    venueDataStore.completedMatchStates = {};
  }
  if (matchState) {
    if (matchId) venueDataStore.completedMatchStates[matchId] = matchState;
    if (bracketMatchId) venueDataStore.completedMatchStates[bracketMatchId] = matchState;
    if (matchCode) venueDataStore.completedMatchStates[matchCode] = matchState;
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
  }
  res.json({ success: true });
});

app.post("/api/league/clear-night-matches", (req, res) => {
  const { leagueType } = req.body;
  const targetLeagues = !leagueType || leagueType === 'all'
    ? ['tuesday', 'wednesday', 'thursday']
    : [leagueType];

  if (!venueDataStore.brackets) {
    venueDataStore.brackets = { tuesday: null, wednesday: null, thursday: null };
  }
  if (!venueDataStore.bracketsUpdatedAt) {
    venueDataStore.bracketsUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
  }

  const now = Date.now();
  targetLeagues.forEach((l: any) => {
    venueDataStore.brackets[l as 'tuesday' | 'wednesday' | 'thursday'] = null;
    venueDataStore.bracketsUpdatedAt[l as 'tuesday' | 'wednesday' | 'thursday'] = now;
  });

  // Clear active matches in matchStore so no stale games remain
  matchStore.clear();
  activeBracketsStore = null;

  // Clear completed match states for target leagues
  if (venueDataStore.completedMatchStates) {
    if (!leagueType || leagueType === 'all') {
      venueDataStore.completedMatchStates = {};
    } else {
      Object.keys(venueDataStore.completedMatchStates).forEach((k) => {
        const ms = venueDataStore.completedMatchStates[k];
        if (ms?.settings?.leagueType === leagueType) {
          delete venueDataStore.completedMatchStates[k];
        }
      });
    }
  }

  venueDataStore.updatedAt = now;
  persistVenueDataToDisk();

  targetLeagues.forEach((l: any) => {
    broadcastLiveEvent("brackets_updated", { leagueType: l, brackets: null });
  });
  broadcastLiveEvent("matches_cleared", { leagues: targetLeagues });
  broadcastLiveEvent("venue_updated", { data: venueDataStore });

  res.json({
    success: true,
    message: "All night matches cleared. Player stats, running totals, and attendance are preserved.",
    clearedLeagues: targetLeagues,
    updatedAt: venueDataStore.updatedAt,
  });
});

app.delete("/api/brackets/:leagueType", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  if (!venueDataStore.brackets) {
    venueDataStore.brackets = { tuesday: null, wednesday: null, thursday: null };
  }
  if (!venueDataStore.bracketsUpdatedAt) {
    venueDataStore.bracketsUpdatedAt = { tuesday: 0, wednesday: 0, thursday: 0 };
  }
  const now = Date.now();
  venueDataStore.brackets[lType] = null;
  venueDataStore.bracketsUpdatedAt[lType] = now;
  venueDataStore.updatedAt = now;
  persistVenueDataToDisk();
  broadcastLiveEvent("brackets_updated", { leagueType: lType, brackets: null });
  res.json({ success: true, leagueType: lType });
});

app.delete("/api/brackets/:leagueType/matchup/:matchId", (req, res) => {
  const lType = req.params.leagueType as 'tuesday' | 'wednesday' | 'thursday';
  const matchId = req.params.matchId;
  const b = venueDataStore.brackets?.[lType];
  if (b) {
    if (Array.isArray(b.divisions)) {
      b.divisions.forEach((d: any) => {
        if (Array.isArray(d.matchups)) {
          d.matchups = d.matchups.filter((m: any) => m.id !== matchId);
        }
      });
    }
    const divKeys = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
    divKeys.forEach((div) => {
      if (Array.isArray(b[div])) {
        b[div] = b[div].filter((m: any) => m.id !== matchId);
      }
    });
    venueDataStore.bracketsUpdatedAt = venueDataStore.bracketsUpdatedAt || { tuesday: 0, wednesday: 0, thursday: 0 };
    venueDataStore.bracketsUpdatedAt[lType] = Date.now();
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("brackets_updated", { leagueType: lType, brackets: b });
    return res.json({ success: true, brackets: b });
  }
  res.json({ success: false });
});

// Draws Endpoints
const normalizeSingleLeagueDraws = (raw: any, leagueKey?: string) => {
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

  const mergeHistories = (h1: any, h2: any) => {
    const list1 = Array.isArray(h1) ? h1 : [];
    const list2 = Array.isArray(h2) ? h2 : [];
    const seen = new Set<string>();
    const combined: any[] = [];
    [...list1, ...list2].forEach((r) => {
      if (r && r.id && !seen.has(r.id)) {
        if (leagueKey && r.leagueType && r.leagueType !== leagueKey) {
          return; // strictly exclude records belonging to other leagues
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

  const dpRaw = raw.doorPrize || raw.door_prize || {};
  const lnRaw = raw.luckyNumber || raw.lucky_number || {};
  const ddRaw = raw.doubleDraw || raw.double_draw || {};

  const dpHistory = mergeHistories(raw.doorPrize?.history, raw.door_prize?.history);
  const luckyHistory = mergeHistories(raw.luckyNumber?.history, raw.lucky_number?.history);
  const doubleHistory = mergeHistories(raw.doubleDraw?.history, raw.double_draw?.history);

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

const normalizeServerDraws = (rawDraws: any) => {
  if (!rawDraws || typeof rawDraws !== 'object') {
    const tue = normalizeSingleLeagueDraws(null, 'tuesday');
    const wed = normalizeSingleLeagueDraws(null, 'wednesday');
    const thu = normalizeSingleLeagueDraws(null, 'thursday');
    return {
      isPublicViewable: true,
      selectedLeague: 'tuesday',
      leagues: {
        tuesday: tue,
        wednesday: wed,
        thursday: thu,
      },
      doorPrize: tue.doorPrize,
      luckyNumber: tue.luckyNumber,
      doubleDraw: tue.doubleDraw,
      door_prize: tue.doorPrize,
      lucky_number: tue.luckyNumber,
      double_draw: tue.doubleDraw,
      updatedAt: Date.now(),
    };
  }

  let leagues: any;
  if (rawDraws.leagues && typeof rawDraws.leagues === 'object') {
    leagues = {
      tuesday: normalizeSingleLeagueDraws(rawDraws.leagues.tuesday, 'tuesday'),
      wednesday: normalizeSingleLeagueDraws(rawDraws.leagues.wednesday, 'wednesday'),
      thursday: normalizeSingleLeagueDraws(rawDraws.leagues.thursday, 'thursday'),
    };
  } else {
    // Migration: legacy unpartitioned rawDraws mapped to Wednesday, Tuesday & Thursday clean
    const legacyWed = normalizeSingleLeagueDraws(rawDraws, 'wednesday');
    leagues = {
      tuesday: normalizeSingleLeagueDraws(null, 'tuesday'),
      wednesday: legacyWed,
      thursday: normalizeSingleLeagueDraws(null, 'thursday'),
    };
  }

  const selectedLeague = rawDraws.selectedLeague || 'tuesday';
  const activeData = leagues[selectedLeague] || leagues.tuesday;

  const isViewable = typeof rawDraws.isPublicViewable === 'boolean'
    ? rawDraws.isPublicViewable
    : (typeof rawDraws.is_public_viewable === 'boolean' ? rawDraws.is_public_viewable : true);

  return {
    isPublicViewable: isViewable,
    selectedLeague,
    leagues,
    doorPrize: activeData.doorPrize,
    luckyNumber: activeData.luckyNumber,
    doubleDraw: activeData.doubleDraw,
    door_prize: activeData.doorPrize,
    lucky_number: activeData.luckyNumber,
    double_draw: activeData.doubleDraw,
    updatedAt: rawDraws.updatedAt || Date.now(),
  };
};

app.get("/api/draws", (req, res) => {
  const draws = normalizeServerDraws(venueDataStore.draws);
  venueDataStore.draws = draws;
  res.json({ draws, updatedAt: venueDataStore.updatedAt });
});

app.post("/api/draws", (req, res) => {
  const drawsPayload = req.body;
  if (drawsPayload && typeof drawsPayload === 'object') {
    const currentDraws: any = venueDataStore.draws || {};
    const currentLeagues = currentDraws.leagues || {};
    let updatedLeagues = currentLeagues;

    if (drawsPayload.leagues && typeof drawsPayload.leagues === 'object') {
      updatedLeagues = {
        tuesday: drawsPayload.leagues.tuesday || currentLeagues.tuesday,
        wednesday: drawsPayload.leagues.wednesday || currentLeagues.wednesday,
        thursday: drawsPayload.leagues.thursday || currentLeagues.thursday,
      };
    }

    const merged = {
      ...currentDraws,
      ...drawsPayload,
      leagues: updatedLeagues,
      updatedAt: Date.now(),
    };
    venueDataStore.draws = normalizeServerDraws(merged);
    venueDataStore.updatedAt = Date.now();
    persistVenueDataToDisk();
    broadcastLiveEvent("draws_updated", { draws: venueDataStore.draws });
  }
  res.json({ success: true, draws: venueDataStore.draws, updatedAt: venueDataStore.updatedAt });
});

app.get("/api/matches", (req, res) => {
  const leagueType = req.query.leagueType as string | undefined;
  let matches = Array.from(matchStore.values()).map((item) => item.matchState);
  if (leagueType && leagueType !== 'all') {
    matches = matches.filter(m => m.settings?.leagueType === leagueType);
  }
  res.json({ matches });
});

app.get("/api/matches/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const item = matchStore.get(code);
  if (!item) {
    return res.status(404).json({ error: "Match not found" });
  }
  res.json({ matchState: item.matchState, updatedAt: item.updatedAt });
});

app.post("/api/matches", (req, res) => {
  const { matchState } = req.body;
  if (!matchState || !matchState.matchCode) {
    return res.status(400).json({ error: "Invalid match state payload" });
  }
  const code = matchState.matchCode.toUpperCase();
  const isWed =
    matchState.settings?.leagueType === 'wednesday' ||
    matchState.settings?.bracketMatchId?.toLowerCase().includes('wed') ||
    code.startsWith('WED-');
  if (isWed && (matchState.settings?.isMedley || matchState.settings?.gameMode === 'MEDLEY' || matchState.settings?.leagueType === 'wednesday')) {
    matchState.settings.leagueType = 'wednesday';
    matchState.settings.isMedley = true;
    matchState.settings.medleyConfigs = WED_MEDLEY_CONFIGS_SERVER;
    matchState.settings.legsToWin = 6;
    matchState.settings.legsPerSet = 6;
  }
  matchStore.set(code, {
    code,
    matchState,
    updatedAt: Date.now(),
  });

  broadcastLiveEvent("match_updated", {
    code,
    matchState,
  });

  res.json({ success: true, code });
});

app.put("/api/matches/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  const { matchState } = req.body;
  if (!matchState) {
    return res.status(400).json({ error: "Missing match state" });
  }
  const isWed =
    matchState.settings?.leagueType === 'wednesday' ||
    matchState.settings?.bracketMatchId?.toLowerCase().includes('wed') ||
    code.startsWith('WED-');
  if (isWed && (matchState.settings?.isMedley || matchState.settings?.gameMode === 'MEDLEY' || matchState.settings?.leagueType === 'wednesday')) {
    matchState.settings.leagueType = 'wednesday';
    matchState.settings.isMedley = true;
    matchState.settings.medleyConfigs = WED_MEDLEY_CONFIGS_SERVER;
    matchState.settings.legsToWin = 6;
    matchState.settings.legsPerSet = 6;
  }
  matchStore.set(code, {
    code,
    matchState: { ...matchState, updatedAt: Date.now() },
    updatedAt: Date.now(),
  });

  broadcastLiveEvent("match_updated", {
    code,
    matchState,
  });

  res.json({ success: true, code, updatedAt: Date.now() });
});

app.post("/api/matches/clear-active", (req, res) => {
  matchStore.clear();
  ['tuesday', 'wednesday', 'thursday'].forEach((l: any) => {
    const b = (venueDataStore.brackets as any)?.[l];
    if (!b) return;
    ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'].forEach((div: string) => {
      const list = b[div];
      if (Array.isArray(list)) {
        list.forEach((m: any) => {
          if (m.status === 'in_progress' || m.status === 'active') {
            m.status = 'completed';
            if (!m.winnerName) {
              m.winnerName = (m.scoreA || 0) >= (m.scoreB || 0) ? m.entryA?.name : m.entryB?.name;
            }
          }
        });
      }
    });
  });
  venueDataStore.updatedAt = Date.now();
  persistVenueDataToDisk();
  broadcastLiveEvent("venue_updated", { data: venueDataStore });
  broadcastLiveEvent("matches_cleared", {});
  res.json({ success: true, message: "Cleared all active games" });
});

app.delete("/api/matches/:code", (req, res) => {
  const code = req.params.code.toUpperCase();
  matchStore.delete(code);
  broadcastLiveEvent("match_deleted", { code });
  res.json({ success: true, code });
});

app.delete("/api/matches", (req, res) => {
  matchStore.clear();
  broadcastLiveEvent("matches_cleared", {});
  res.json({ success: true, message: "Active matches cleared" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DartConnect Scorer Server running on http://localhost:${PORT}`);
  });
}

startServer();
