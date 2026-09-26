import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Player,
  MatchSettings,
  LeagueAttendancePlayer,
  LeagueTeamComposition,
  BracketMatchup,
  DivisionData,
  LeagueBracketsState,
  MedleyGameConfig,
  WEDNESDAY_MEDLEY_CONFIGS,
  DEFAULT_MEDLEY_CONFIGS,
  MatchState,
} from '../types';
import {
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Shield,
  Layers,
  AlertTriangle,
  Play,
  Trophy,
  Dices,
  UserPlus,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Zap,
  AlertCircle,
  Eye,
  UserMinus,
  RotateCcw,
  Target,
  Moon,
  SlidersHorizontal,
  Mail,
  Send,
  Lock,
  Unlock,
} from 'lucide-react';
import { MatchReportEmailModal } from './MatchReportEmailModal';
import {
  getOrBuildMatchStateForMatchup,
  isMatchEmailDispatched,
  getDispatchedEmailInfo,
} from '../utils/emailReportHelper';
import { AVATAR_OPTIONS } from './PlayerProfiles';
import {
  deletePlayerPermanently,
  removePlayerFromLeague,
  isPlayerRemovedFromLeague,
  restorePlayerToLeague,
  getRemovedPlayersForLeague,
  getNightlyBullsSessionForDate,
  enforceMaxFourMatchesPerPerson,
  createRoundRobinMatchups as createRRMatchups,
} from '../utils/leagueHelper';
import { NightlyGameBullsModal } from './NightlyGameBullsModal';
import { ManualTeamDivisionModal } from './ManualTeamDivisionModal';
import { DivisionRosterDirectory } from './DivisionRosterDirectory';
import { useAuth } from '../context/AuthContext';
import { MASTER_ROSTER_PLAYERS } from '../data/defaultPlayers';
import {
  getAutoEmailOverallStatsEnabled,
  dispatchOverallPlayerStatsEmail,
} from '../utils/overallStatsEmailHelper';
import {
  syncLeagueBracketsToCloud,
  clearNightMatchesFromCloud,
  deleteSingleMatchupFromCloud,
  subscribeToLeagueBrackets,
  syncAttendanceRosterToCloud,
  subscribeToAttendanceRoster,
  syncPlayerRosterToCloud,
  subscribeToPlayerRoster,
  isPlayerPermanentlyDeleted,
  unmarkPlayerPermanentlyDeleted,
} from '../services/cloudSync';

interface LeagueAttendanceManagerProps {
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  onLaunchMatch: (
    settings: MatchSettings,
    playersList: Player[],
    leagueType: 'tuesday' | 'wednesday' | 'thursday',
    existingMatchState?: MatchState
  ) => void;
}

// Helper function to plan Wednesday even head-to-head matches:
// Standard max 3 on a team (3v3). Teams must be as even as possible.
// Exception: if there is an odd player where teams of 3 won't work, a team of 4 is formed (4v3 with rotating dummy).
// Teams of 3 play teams of 3 (3v3). If needed for even head-to-head pairing, teams of 2 play teams of 2 (2v2).
export function getWednesdayMatchPlan(total: number): { sizeA: number; sizeB: number }[] {
  if (total < 2) return [];
  if (total === 2) return [{ sizeA: 1, sizeB: 1 }];
  if (total === 3) return [{ sizeA: 2, sizeB: 1 }];
  if (total === 4) return [{ sizeA: 2, sizeB: 2 }];
  if (total === 5) return [{ sizeA: 3, sizeB: 2 }];
  if (total === 6) return [{ sizeA: 3, sizeB: 3 }];
  if (total === 7) return [{ sizeA: 4, sizeB: 3 }];

  let bestPlan: { matches: { sizeA: number; sizeB: number }[]; penalty: number } | null = null;
  const maxMatches = Math.ceil(total / 4);
  const minMatches = Math.max(1, Math.floor(total / 7));

  for (let M = minMatches; M <= maxMatches; M++) {
    if (total % 2 === 0) {
      // Even total: Max 3 per team (strictly 3v3 and 2v2; no 4-player teams allowed because no odd player)
      for (let k3 = M; k3 >= 0; k3--) {
        const k2 = M - k3;
        if (k2 < 0) continue;
        if (6 * k3 + 4 * k2 === total) {
          // Maximize 3v3 matches (k3), minimize 2v2 matches (k2)
          const penalty = k2 * 1000 - k3 * 10;
          if (!bestPlan || penalty < bestPlan.penalty) {
            const matches: { sizeA: number; sizeB: number }[] = [];
            for (let i = 0; i < k3; i++) matches.push({ sizeA: 3, sizeB: 3 });
            for (let i = 0; i < k2; i++) matches.push({ sizeA: 2, sizeB: 2 });
            bestPlan = { matches, penalty };
          }
        }
      }
    } else {
      // Odd total: exactly one match has an odd sum (either 4v3 [sum 7] or 3v2 [sum 5])
      // 4v3 is the exception where an odd player where teams of 3 won't work joins a team of 3 to make a team of 4.
      for (const odd of [
        { a: 4, b: 3, sum: 7, isException: true },
        { a: 3, b: 2, sum: 5, isException: false },
      ]) {
        const remN = total - odd.sum;
        const remM = M - 1;
        if (remN < 0 || remM < 0) continue;
        for (let k3 = remM; k3 >= 0; k3--) {
          const k2 = remM - k3;
          if (k2 < 0) continue;
          if (6 * k3 + 4 * k2 === remN) {
            // Heavily penalize k2 (2v2 matches) so we maximize teams of 3.
            // When teams of 3 won't work (e.g. 7, 13, 19, 25, 31), the 4v3 exception allows ALL remaining to be 3v3 (k2=0)!
            // When teams of 3 already work with 3v2 (e.g. 11, 17, 23, 29), 3v2 with k2=0 wins.
            const penalty = k2 * 1000 - k3 * 10 + (odd.isException ? 50 : 0);
            if (!bestPlan || penalty < bestPlan.penalty) {
              const matches: { sizeA: number; sizeB: number }[] = [];
              for (let i = 0; i < k3; i++) matches.push({ sizeA: 3, sizeB: 3 });
              for (let i = 0; i < k2; i++) matches.push({ sizeA: 2, sizeB: 2 });
              matches.push({ sizeA: odd.a, sizeB: odd.b });
              bestPlan = { matches, penalty };
            }
          }
        }
      }
    }
  }

  return bestPlan ? bestPlan.matches : [];
}

export const LeagueAttendanceManager: React.FC<LeagueAttendanceManagerProps> = ({
  leagueType,
  onLaunchMatch,
}) => {
  const { isAdmin, canDelete, role } = useAuth();

  // Removal dialog & removed players tracking
  const [playerToRemove, setPlayerToRemove] = useState<LeagueAttendancePlayer | null>(null);
  const [removedListState, setRemovedListState] = useState<string[]>(() => {
    const { names } = getRemovedPlayersForLeague(leagueType);
    return Array.from(names);
  });

  // Helper to load all master player profiles from Players tab (excluding permanently deleted and league-removed players)
  const getMasterPlayerProfiles = (customList?: any[]): LeagueAttendancePlayer[] => {
    try {
      const list = customList || (() => {
        const saved = localStorage.getItem('kaboom_dart_players');
        return saved ? JSON.parse(saved) : null;
      })();
      if (Array.isArray(list) && list.length > 0) {
        return list
          .filter((p: any) => p && typeof p.name === 'string' && p.name.trim().length > 0)
          .filter((p: any) => !isPlayerPermanentlyDeleted(p.id, p.name) && !isPlayerRemovedFromLeague(leagueType, p.id, p.name))
          .map((p: any) => ({
            id: p.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: p.name.trim(),
            avatar: p.avatar || '🎯',
            checkedIn: false,
          }));
      }
    } catch (e) {}
    return MASTER_ROSTER_PLAYERS
      .filter((p) => !isPlayerPermanentlyDeleted(p.id, p.name) && !isPlayerRemovedFromLeague(leagueType, p.id, p.name))
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar || '🎯',
        checkedIn: false,
      }));
  };

  // Merge existing attendance check-in list with all master player profiles
  const mergeAttendanceWithProfiles = (
    existingList: LeagueAttendancePlayer[],
    customMasterList?: any[]
  ): LeagueAttendancePlayer[] => {
    // 0. Ensure no deleted or removed players remain in existing list
    const validExisting = existingList.filter(
      p => p && !isPlayerPermanentlyDeleted(p.id, p.name) && !isPlayerRemovedFromLeague(leagueType, p.id, p.name)
    );

    const masterProfiles = getMasterPlayerProfiles(customMasterList);
    if (masterProfiles.length === 0) return validExisting;

    const existingMap = new Map<string, LeagueAttendancePlayer>();
    validExisting.forEach(p => {
      existingMap.set(p.name.trim().toLowerCase(), p);
      if (p.id) existingMap.set(p.id, p);
    });

    const merged: LeagueAttendancePlayer[] = [];
    const processedNames = new Set<string>();

    // 1. Ensure master player profiles belonging to this league are included
    masterProfiles.forEach(prof => {
      if (isPlayerPermanentlyDeleted(prof.id, prof.name) || isPlayerRemovedFromLeague(leagueType, prof.id, prof.name)) {
        return;
      }
      const nameKey = prof.name.trim().toLowerCase();
      if (processedNames.has(nameKey)) return;
      processedNames.add(nameKey);

      const match = existingMap.get(nameKey) || existingMap.get(prof.id);
      if (match) {
        merged.push({
          id: match.id || prof.id,
          name: prof.name,
          avatar: prof.avatar || match.avatar || '🎯',
          checkedIn: match.checkedIn ?? false,
        });
      } else {
        merged.push({
          id: prof.id,
          name: prof.name,
          avatar: prof.avatar || '🎯',
          checkedIn: false,
        });
      }
    });

    // 2. Preserve any additional custom players added directly in this attendance list
    validExisting.forEach(p => {
      const nameKey = p.name.trim().toLowerCase();
      if (!processedNames.has(nameKey)) {
        processedNames.add(nameKey);
        merged.push(p);
      }
    });

    return merged;
  };

  // --- STATE FOR SINGLES & DOUBLES & WEDNESDAY TEAMS ATTENDANCE ---
  const [singlesRoster, setSinglesRoster] = useState<LeagueAttendancePlayer[]>(() => {
    try {
      const saved = localStorage.getItem(`kaboom_attendance_${leagueType}_singles`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeAttendanceWithProfiles(parsed);
        }
      }
    } catch (e) {}
    // If no saved attendance yet, initialize all master profiles as optional (checkedIn: false)
    const masterProfiles = getMasterPlayerProfiles();
    return masterProfiles.map(p => ({ ...p, checkedIn: false }));
  });

  // Inputs for adding new players
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState('🦸‍♂️');
  const [playerAddError, setPlayerAddError] = useState<string | null>(null);

  // Option for Thursday Doubles: Odd person handling ('trio' = add to one of the teams in the division, 'dummy' = play with dummy)
  const [thursdayOddOption, setThursdayOddOption] = useState<'trio' | 'dummy'>(() => {
    try {
      const saved = localStorage.getItem('kaboom_thursday_odd_option');
      if (saved === 'trio' || saved === 'dummy') return saved;
      const oldVal = localStorage.getItem('kaboom_thursday_pair_odd_dummy');
      if (oldVal !== null && JSON.parse(oldVal) === false) return 'trio';
    } catch (e) {}
    return 'trio';
  });

  const [showThursdayOddModal, setShowThursdayOddModal] = useState<boolean>(false);

  // Custom division count for Thursday Doubles ('auto' or explicit number)
  const [thursdayDivCount, setThursdayDivCount] = useState<number | 'auto'>(() => {
    try {
      const saved = localStorage.getItem('kaboom_thursday_div_count');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'number' || parsed === 'auto') return parsed;
      }
    } catch (e) {}
    return 'auto';
  });

  const [thursdayPairOddWithDummy, setThursdayPairOddWithDummy] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('kaboom_thursday_pair_odd_dummy');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return false;
  });

  // Admin manual team & division selection modal state
  const [showManualSelectModal, setShowManualSelectModal] = useState<boolean>(false);

  // Admin email resend modal state
  const [emailModalMatchState, setEmailModalMatchState] = useState<MatchState | null>(null);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [emailRefreshTick, setEmailRefreshTick] = useState<number>(0);

  const handleOpenEmailModalForMatch = (m: BracketMatchup) => {
    const resolvedState = getOrBuildMatchStateForMatchup(m, leagueType);
    setEmailModalMatchState(resolvedState);
    setShowEmailModal(true);
  };

  const handleApplyManualBrackets = (manualBrackets: LeagueBracketsState) => {
    setBrackets(manualBrackets);
    try {
      localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(manualBrackets));
      syncLeagueBracketsToCloud(leagueType, manualBrackets);
    } catch (e) {
      console.error('Failed to save manual brackets', e);
    }
    setActiveSubTab('brackets');
  };

  // Helper to calculate Thursday Doubles division distribution
  const calculateThursdayDivisions = (
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

  // Helper to ensure BYE matches never have a winner, score, or count for stats
  const scrubByeMatch = (m: BracketMatchup): BracketMatchup => {
    const isBye = Boolean(
      m.isBye ||
      m.entryA?.name?.toUpperCase().includes('BYE') ||
      m.entryB?.name?.toUpperCase().includes('BYE')
    );
    if (isBye) {
      return {
        ...m,
        scoreA: 0,
        scoreB: 0,
        status: 'completed',
        winnerName: undefined,
        isBye: true,
        entryA: m.entryA?.name?.toUpperCase().includes('BYE')
          ? { ...m.entryA, name: 'BYE (Sitting Out)' }
          : m.entryA,
        entryB: m.entryB?.name?.toUpperCase().includes('BYE')
          ? { ...m.entryB, name: 'BYE (Sitting Out)' }
          : m.entryB,
      };
    }
    return m;
  };

  const sanitizeBracketsState = (b: LeagueBracketsState | null): LeagueBracketsState | null => {
    if (!b) return null;
    const sanitizeList = (list?: BracketMatchup[]) => {
      if (!Array.isArray(list)) return [];
      const scrubbed = list.map(scrubByeMatch);
      return enforceMaxFourMatchesPerPerson(scrubbed, leagueType);
    };
    const divA = b.divisionA && b.divisionA.length > 0 ? b.divisionA : b.divisions?.[0]?.matchups;
    const divB = b.divisionB && b.divisionB.length > 0 ? b.divisionB : b.divisions?.[1]?.matchups;
    const divC = b.divisionC && b.divisionC.length > 0 ? b.divisionC : b.divisions?.[2]?.matchups;
    const divD = b.divisionD && b.divisionD.length > 0 ? b.divisionD : b.divisions?.[3]?.matchups;
    const divE = b.divisionE && b.divisionE.length > 0 ? b.divisionE : b.divisions?.[4]?.matchups;
    const divF = b.divisionF && b.divisionF.length > 0 ? b.divisionF : b.divisions?.[5]?.matchups;
    return {
      ...b,
      divisionA: sanitizeList(divA),
      divisionB: sanitizeList(divB),
      divisionC: divC ? sanitizeList(divC) : undefined,
      divisionD: divD ? sanitizeList(divD) : undefined,
      divisionE: divE ? sanitizeList(divE) : undefined,
      divisionF: divF ? sanitizeList(divF) : undefined,
      divisions: Array.isArray(b.divisions) && b.divisions.length > 0
        ? b.divisions.map((d) => ({ ...d, matchups: sanitizeList(d.matchups) }))
        : undefined,
    };
  };

  // Bracket Matchups State
  const [brackets, setBrackets] = useState<LeagueBracketsState | null>(() => {
    try {
      const saved = localStorage.getItem(`kaboom_brackets_${leagueType}`);
      if (saved) return sanitizeBracketsState(JSON.parse(saved));
    } catch (e) {}
    return null;
  });

  const isBracketActive = useMemo(() => {
    if (!brackets) return false;
    if (Array.isArray(brackets.divisions) && brackets.divisions.length > 0) {
      return brackets.divisions.some(d => Array.isArray(d?.matchups) && d.matchups.length > 0);
    }
    return Boolean(Array.isArray(brackets.divisionA) && brackets.divisionA.length > 0);
  }, [brackets]);

  const [isAttendanceUnlocked, setIsAttendanceUnlocked] = useState(false);
  const isAttendanceLocked = isBracketActive && !isAttendanceUnlocked;

  // Active view tab inside attendance manager
  const [activeSubTab, setActiveSubTab] = useState<'attendance' | 'brackets'>('attendance');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'checked' | 'optional' | 'removed'>('all');

  // Nightly Game Bulls individual challenge modal state
  const [showGameBullsModal, setShowGameBullsModal] = useState(false);
  const [gameBullsTargetPlayerName, setGameBullsTargetPlayerName] = useState<string | undefined>(undefined);
  const [nightlyBullsSessionTick, setNightlyBullsSessionTick] = useState(0);

  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const nightlyBullsSession = useMemo(() => {
    if (leagueType !== 'tuesday' && leagueType !== 'wednesday' && leagueType !== 'thursday') return null;
    return getNightlyBullsSessionForDate(leagueType, todayDateStr);
  }, [leagueType, todayDateStr, nightlyBullsSessionTick]);

  const nightlyBullsCompletedCount = useMemo(() => {
    if (!nightlyBullsSession?.entries) return 0;
    const checked = singlesRoster.filter(p => p.checkedIn);
    const targets = checked.length > 0 ? checked : singlesRoster;
    return targets.filter(p => {
      const k = p.name.toLowerCase().trim();
      const ck = k.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
      return nightlyBullsSession.entries[k] !== undefined || nightlyBullsSession.entries[ck] !== undefined;
    }).length;
  }, [nightlyBullsSession, singlesRoster]);

  const [showClearNightModal, setShowClearNightModal] = useState<boolean>(false);
  const [isClearingNight, setIsClearingNight] = useState<boolean>(false);
  const lastLocalBracketGenerationTime = useRef<number>(0);
  const isReceivingAttendanceFromCloud = useRef(false);
  const isReceivingBracketsFromCloud = useRef(false);
  const isMountedAttendance = useRef(false);
  const isMountedBrackets = useRef(false);

  // Persistence & Realtime Cloud sync for attendance roster
  useEffect(() => {
    localStorage.setItem(`kaboom_attendance_${leagueType}_singles`, JSON.stringify(singlesRoster));
    if (!isMountedAttendance.current) {
      isMountedAttendance.current = true;
      return;
    }
    if (isReceivingAttendanceFromCloud.current) {
      isReceivingAttendanceFromCloud.current = false;
      return;
    }
    syncAttendanceRosterToCloud(`attendance_${leagueType}_singles`, singlesRoster);
  }, [singlesRoster, leagueType]);

  // Realtime cloud listener for attendance check-ins across venue tablets
  useEffect(() => {
    const handleSyncEvent = () => {
      try {
        const savedAtt = localStorage.getItem(`kaboom_attendance_${leagueType}_singles`);
        let currentList: LeagueAttendancePlayer[] = [];
        if (savedAtt) {
          currentList = JSON.parse(savedAtt);
        }
        setSinglesRoster(mergeAttendanceWithProfiles(currentList));
        const savedBrk = localStorage.getItem(`kaboom_brackets_${leagueType}`);
        setBrackets(savedBrk ? JSON.parse(savedBrk) : null);
      } catch (e) {}
    };
    window.addEventListener('kaboom_cloud_sync_update', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    const handlePlayerDeletedOrRemoved = (e: any) => {
      try {
        const deletedId = e.detail?.id;
        const deletedName = e.detail?.name?.trim().toLowerCase();
        setSinglesRoster(prev =>
          prev.filter(
            p =>
              !(deletedId && p.id === deletedId) &&
              !(deletedName && p.name.trim().toLowerCase() === deletedName) &&
              !isPlayerPermanentlyDeleted(p.id, p.name) &&
              !isPlayerRemovedFromLeague(leagueType, p.id, p.name)
          )
        );
        const { names } = getRemovedPlayersForLeague(leagueType);
        setRemovedListState(Array.from(names));
      } catch (err) {}
    };
    window.addEventListener('kaboom_player_deleted', handlePlayerDeletedOrRemoved);
    window.addEventListener('kaboom_league_player_removed', handlePlayerDeletedOrRemoved);

    const unsubPlayerRoster = subscribeToPlayerRoster((cloudRoster) => {
      if (cloudRoster && Array.isArray(cloudRoster) && cloudRoster.length > 0) {
        setSinglesRoster(prev => mergeAttendanceWithProfiles(prev, cloudRoster));
      }
    });

    const unsubAttendance = subscribeToAttendanceRoster(`attendance_${leagueType}_singles`, (cloudRoster) => {
      if (cloudRoster && Array.isArray(cloudRoster)) {
        isReceivingAttendanceFromCloud.current = true;
        const merged = mergeAttendanceWithProfiles(cloudRoster);
        setSinglesRoster(merged);
        localStorage.setItem(`kaboom_attendance_${leagueType}_singles`, JSON.stringify(merged));
      }
    });
    return () => {
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncEvent);
      window.removeEventListener('kaboom_player_deleted', handlePlayerDeletedOrRemoved);
      window.removeEventListener('kaboom_league_player_removed', handlePlayerDeletedOrRemoved);
      window.removeEventListener('storage', handleSyncEvent);
      unsubAttendance();
      unsubPlayerRoster();
    };
  }, [leagueType]);

  // Realtime cloud listener for brackets across venue devices
  useEffect(() => {
    const handleNightCleared = (e: any) => {
      if (!e.detail?.leagueType || e.detail.leagueType === leagueType) {
        setBrackets(null);
        try {
          localStorage.removeItem(`kaboom_brackets_${leagueType}`);
        } catch (err) {}
      }
    };
    window.addEventListener('kaboom_night_matches_cleared', handleNightCleared);

    const unsubscribe = subscribeToLeagueBrackets(leagueType, (cloudBrackets) => {
      if (cloudBrackets) {
        isReceivingBracketsFromCloud.current = true;
        const sanitized = sanitizeBracketsState(cloudBrackets);
        setBrackets(sanitized);
        if (sanitized) {
          localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(sanitized));
        }
      } else if (cloudBrackets === null) {
        // Protect newly generated brackets against stale null poll responses
        if (Date.now() - lastLocalBracketGenerationTime.current < 10000) {
          return;
        }
        setBrackets(null);
        try {
          localStorage.removeItem(`kaboom_brackets_${leagueType}`);
        } catch (err) {}
      }
    });
    return () => {
      window.removeEventListener('kaboom_night_matches_cleared', handleNightCleared);
      unsubscribe();
    };
  }, [leagueType]);

  // Sync brackets to local storage, server store, and Cloud Firestore
  useEffect(() => {
    if (brackets) {
      localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(brackets));
      if (isReceivingBracketsFromCloud.current) {
        isReceivingBracketsFromCloud.current = false;
        return;
      }
      syncLeagueBracketsToCloud(leagueType, brackets);
      fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType, brackets }),
      }).catch(() => {});
    }
  }, [brackets, leagueType]);

  // --- ATTENDANCE TOGGLES ---
  const cyclePlayerAvatar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSinglesRoster(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const currIdx = AVATAR_OPTIONS.findIndex(a => a.icon === (p.avatar || '🎯'));
        const nextIdx = currIdx >= 0 ? (currIdx + 1) % AVATAR_OPTIONS.length : 0;
        return { ...p, avatar: AVATAR_OPTIONS[nextIdx].icon };
      })
    );
  };

  const togglePlayerCheckIn = (id: string) => {
    if (isAttendanceLocked) {
      setPlayerAddError('Attendance is currently locked because match brackets are active for tonight. Please click "Unlock Attendance" first if changes are needed.');
      return;
    }
    setSinglesRoster(prev =>
      prev.map(p => (p.id === id ? { ...p, checkedIn: !p.checkedIn } : p))
    );
  };

  const handleRemoveFromThisLeague = (player: LeagueAttendancePlayer) => {
    if (isAttendanceLocked) {
      setPlayerAddError('Attendance is currently locked because match brackets are active for tonight. Please unlock attendance first if changes are needed.');
      return;
    }
    // 1. Remove player from this specific league (not playing or quitting this league)
    removePlayerFromLeague(leagueType, { id: player.id, name: player.name });

    // 2. Filter from local attendance roster
    setSinglesRoster(prev => {
      const updated = prev.filter(
        p => p.id !== player.id && p.name.trim().toLowerCase() !== player.name.trim().toLowerCase()
      );
      try {
        localStorage.setItem(`kaboom_attendance_${leagueType}_singles`, JSON.stringify(updated));
        syncAttendanceRosterToCloud(`attendance_${leagueType}_singles`, updated);
      } catch (e) {}
      return updated;
    });

    // 3. Update removed players list state
    const { names } = getRemovedPlayersForLeague(leagueType);
    setRemovedListState(Array.from(names));

    // 4. Close removal modal
    setPlayerToRemove(null);
  };

  const handlePermanentDelete = (player: LeagueAttendancePlayer) => {
    if (isAttendanceLocked) {
      setPlayerAddError('Attendance is currently locked because match brackets are active for tonight. Please unlock attendance first if changes are needed.');
      return;
    }
    // 1. Permanently delete across all leagues, master profiles, standings, stats
    deletePlayerPermanently({ id: player.id, name: player.name });

    // 2. Filter from local attendance roster
    setSinglesRoster(prev => {
      const updated = prev.filter(
        p => p.id !== player.id && p.name.trim().toLowerCase() !== player.name.trim().toLowerCase()
      );
      try {
        localStorage.setItem(`kaboom_attendance_${leagueType}_singles`, JSON.stringify(updated));
        syncAttendanceRosterToCloud(`attendance_${leagueType}_singles`, updated);
      } catch (e) {}
      return updated;
    });

    // 3. Update removed players list state
    const { names } = getRemovedPlayersForLeague(leagueType);
    setRemovedListState(Array.from(names));

    // 4. Close modal
    setPlayerToRemove(null);
  };

  const handleRestorePlayer = (playerName: string) => {
    if (isAttendanceLocked) {
      setPlayerAddError('Attendance is currently locked because match brackets are active for tonight. Please unlock attendance first if changes are needed.');
      return;
    }
    restorePlayerToLeague(leagueType, undefined, playerName);
    unmarkPlayerPermanentlyDeleted(undefined, playerName);

    // Re-add to attendance roster as optional
    const newP: LeagueAttendancePlayer = {
      id: `p-${Date.now()}`,
      name: playerName,
      avatar: '🎯',
      checkedIn: false,
    };
    setSinglesRoster(prev => {
      if (prev.some(p => p.name.trim().toLowerCase() === playerName.toLowerCase().trim())) {
        return prev;
      }
      const updated = [...prev, newP];
      try {
        localStorage.setItem(`kaboom_attendance_${leagueType}_singles`, JSON.stringify(updated));
        syncAttendanceRosterToCloud(`attendance_${leagueType}_singles`, updated);
      } catch (e) {}
      return updated;
    });

    const { names } = getRemovedPlayersForLeague(leagueType);
    setRemovedListState(Array.from(names));
  };

  const checkAllPlayers = (status: boolean) => {
    if (!isAdmin) return;
    if (isAttendanceLocked) {
      setPlayerAddError('Attendance is currently locked because match brackets are active for tonight. Please click "Unlock Attendance" first if roster changes are required.');
      return;
    }
    setSinglesRoster(prev => prev.map(p => ({ ...p, checkedIn: status })));
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAttendanceLocked) {
      alert('Attendance is currently locked because match brackets are active for tonight. Please unlock attendance first to add players.');
      return;
    }
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;

    // Check for duplicate player in attendance roster
    const exists = singlesRoster.some(
      p => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      setPlayerAddError(`Player already exists! "${trimmed}" is already in the attendance roster.`);
      return;
    }

    // If player was previously marked as removed or deleted, restore them
    restorePlayerToLeague(leagueType, undefined, trimmed);
    unmarkPlayerPermanentlyDeleted(undefined, trimmed);
    const { names } = getRemovedPlayersForLeague(leagueType);
    setRemovedListState(Array.from(names));

    setPlayerAddError(null);

    const newP: LeagueAttendancePlayer = {
      id: `p-${Date.now()}`,
      name: trimmed,
      avatar: newPlayerAvatar || '🦸‍♂️',
      checkedIn: true,
    };
    setSinglesRoster(prev => [...prev, newP]);
    setNewPlayerName('');

    // Also persist to master player roster so the player is immediately available in all 3 leagues
    try {
      const savedProfiles = localStorage.getItem('kaboom_dart_players');
      const profiles = savedProfiles ? JSON.parse(savedProfiles) : [];
      if (!profiles.some((p: any) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
        const newProf = {
          id: newP.id,
          name: trimmed,
          avatar: newPlayerAvatar || '🦸‍♂️',
          matchesPlayed: 0,
          matchesWon: 0,
          legsWon: 0,
          totalScore: 0,
          dartsThrown: 0,
          createdAt: Date.now(),
        };
        const updated = [...profiles, newProf];
        localStorage.setItem('kaboom_dart_players', JSON.stringify(updated));
        syncPlayerRosterToCloud(updated);
        window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players' } }));
      }
    } catch (e) {}
  };

  // Helper to construct Full Round Robin Bracket Matchups with strict 4-match limit per person (including byes)
  const createRoundRobinMatchups = (
    entries: { id?: string; name: string; players: { id: string; name: string; avatar: string; isDummy?: boolean }[] }[],
    divName: string,
    lType: 'tuesday' | 'wednesday' | 'thursday',
    options?: {
      isSmallerDivision?: boolean;
      maxDivisionPlayerCount?: number;
      replayRoundOneWithDummy?: boolean;
    }
  ): BracketMatchup[] => {
    return createRRMatchups(entries, divName, lType, options);
  };

  // Dedicated generator for Thursday Doubles: guarantees identical player counts per division and applies odd player option ('trio' or 'dummy')
  const generateThursdayBracketsWithOption = (chosenOption: 'trio' | 'dummy') => {
    const activePlayers = singlesRoster.filter(p => p.checkedIn);
    if (activePlayers.length < 2) {
      alert('Please check in at least 2 players to generate brackets.');
      return;
    }

    setThursdayOddOption(chosenOption);
    setThursdayPairOddWithDummy(chosenOption === 'dummy');
    setShowThursdayOddModal(false);
    try {
      localStorage.setItem('kaboom_thursday_odd_option', chosenOption);
      localStorage.setItem('kaboom_thursday_pair_odd_dummy', chosenOption === 'dummy' ? 'true' : 'false');
    } catch (e) {}

    const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
    const total = shuffled.length;
    const divInfo = calculateThursdayDivisions(total, thursdayDivCount);
    const { numDivisions, sizes } = divInfo;

    const generatedDivisions: DivisionData[] = [];
    let playerIdx = 0;

    for (let d = 0; d < numDivisions; d++) {
      const divSize = sizes[d];
      const divPlayers = shuffled.slice(playerIdx, playerIdx + divSize);
      playerIdx += divSize;

      const letter = String.fromCharCode(65 + d);
      const divName = numDivisions === 1 ? 'Open Division' : `Division ${letter}`;
      const isOddDiv = divPlayers.length % 2 !== 0;

      const divTeams: { id: string; name: string; players: { id: string; name: string; avatar: string; isDummy?: boolean }[] }[] = [];

      if (!isOddDiv) {
        // Even number of people in this division: all standard pairs of 2
        const numPairs = divPlayers.length / 2;
        for (let i = 0; i < numPairs; i++) {
          const p1 = divPlayers[i * 2];
          const p2 = divPlayers[i * 2 + 1];
          divTeams.push({
            id: `thurs-d${d + 1}-t${i + 1}-${Date.now()}-${i}`,
            name: `${p1.name} & ${p2.name}`,
            players: [
              { id: p1.id, name: p1.name, avatar: p1.avatar || '🎯', isDummy: false },
              { id: p2.id, name: p2.name, avatar: p2.avatar || '🎯', isDummy: false },
            ],
          });
        }
      } else {
        // Odd number of people in this division!
        // Whichever option is chosen ('trio' or 'dummy') is the same in every division with an odd person that night
        if (chosenOption === 'trio' && divPlayers.length >= 3) {
          // Add the odd person to one of the teams in the division (3-person team)
          const p1 = divPlayers[0];
          const p2 = divPlayers[1];
          const p3 = divPlayers[2];
          divTeams.push({
            id: `thurs-d${d + 1}-trio-${Date.now()}`,
            name: `${p1.name}, ${p2.name} & ${p3.name}`,
            players: [
              { id: p1.id, name: p1.name, avatar: p1.avatar || '🎯', isDummy: false },
              { id: p2.id, name: p2.name, avatar: p2.avatar || '🎯', isDummy: false },
              { id: p3.id, name: p3.name, avatar: p3.avatar || '🎯', isDummy: false },
            ],
          });

          // Remaining players in pairs
          const remaining = divPlayers.slice(3);
          const remainingPairs = remaining.length / 2;
          for (let i = 0; i < remainingPairs; i++) {
            const pA = remaining[i * 2];
            const pB = remaining[i * 2 + 1];
            divTeams.push({
              id: `thurs-d${d + 1}-t${i + 2}-${Date.now()}-${i}`,
              name: `${pA.name} & ${pB.name}`,
              players: [
                { id: pA.id, name: pA.name, avatar: pA.avatar || '🎯', isDummy: false },
                { id: pB.id, name: pB.name, avatar: pB.avatar || '🎯', isDummy: false },
              ],
            });
          }
        } else {
          // Have odd player play with dummy (or if divPlayers.length < 3)
          const fullPairs = Math.floor(divPlayers.length / 2);
          for (let i = 0; i < fullPairs; i++) {
            const p1 = divPlayers[i * 2];
            const p2 = divPlayers[i * 2 + 1];
            divTeams.push({
              id: `thurs-d${d + 1}-t${i + 1}-${Date.now()}-${i}`,
              name: `${p1.name} & ${p2.name}`,
              players: [
                { id: p1.id, name: p1.name, avatar: p1.avatar || '🎯', isDummy: false },
                { id: p2.id, name: p2.name, avatar: p2.avatar || '🎯', isDummy: false },
              ],
            });
          }

          // Odd player pairs with Dummy Player
          const oddPlayer = divPlayers[divPlayers.length - 1];
          divTeams.push({
            id: `thurs-d${d + 1}-dummy-${Date.now()}`,
            name: `${oddPlayer.name} & Dummy`,
            players: [
              { id: oddPlayer.id, name: oddPlayer.name, avatar: oddPlayer.avatar || '🎯', isDummy: false },
              { id: `dummy-${oddPlayer.id}-${Date.now()}`, name: '🤖 Dummy Player', avatar: '🤖', isDummy: true },
            ],
          });
        }
      }

      if (divTeams.length < 2) {
        divTeams.push({
          id: `thurs-d${d + 1}-dummyopp-${Date.now()}`,
          name: 'House Dummy Team',
          players: [
            { id: `dummy-opp1-${Date.now()}`, name: '🤖 Dummy 1', avatar: '🤖', isDummy: true },
            { id: `dummy-opp2-${Date.now()}`, name: '🤖 Dummy 2', avatar: '🤖', isDummy: true },
          ],
        });
      }

      const oddSuffix = isOddDiv
        ? chosenOption === 'trio'
          ? ' • 1 Trio Team'
          : ' • 1 Dummy Partner'
        : '';
      const subtitle = numDivisions === 1
        ? `(Round Robin • ${divPlayers.length} Players • ${divTeams.length} Teams${oddSuffix})`
        : `(Round Robin • Division ${letter} • ${divPlayers.length} Players${oddSuffix})`;

      generatedDivisions.push({
        name: divName,
        subtitle,
        matchups: createRoundRobinMatchups(divTeams, divName, 'thursday'),
      });
    }

    const isMultiDivTeams = numDivisions > 1;
    const newState: LeagueBracketsState = {
      isMultiDivision: isMultiDivTeams,
      divisions: generatedDivisions,
      divisionA: generatedDivisions[0]?.matchups || [],
      divisionB: generatedDivisions[1]?.matchups || [],
      divisionC: generatedDivisions[2]?.matchups || [],
      divisionD: generatedDivisions[3]?.matchups || [],
      divisionE: generatedDivisions[4]?.matchups || [],
      divisionF: generatedDivisions[5]?.matchups || [],
    };
    lastLocalBracketGenerationTime.current = Date.now();
    setBrackets(newState);
    try {
      localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(newState));
    } catch (e) {}
    syncLeagueBracketsToCloud(leagueType, newState);
    fetch('/api/brackets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueType, brackets: newState }),
    }).catch(() => {});
    setIsAttendanceUnlocked(false);
    setActiveSubTab('brackets');
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', {
      detail: { key: `kaboom_brackets_${leagueType}`, data: newState }
    }));
  };

  // --- BRACKET & DIVISION DELEGATION ENGINE ---
  const handleGenerateBrackets = () => {
    if (!isAdmin) {
      setPlayerAddError('Team delegation and bracket generation is restricted to League Admins at the start of the night.');
      return;
    }

    if (leagueType === 'wednesday') {
      // Wednesday Team League Generation Logic:
      // Standard max 3 on a team (3v3). Teams are as even as possible.
      // Exception: if there is an odd player where teams of 3 won't work, a team of 4 is formed (4v3 with rotating dummy).
      // Matches are paired such that teams of 3 play teams of 3 (3v3), teams of 2 play teams of 2 (2v2).
      const activePlayers = singlesRoster.filter(p => p.checkedIn);

      if (activePlayers.length < 2) {
        setPlayerAddError('Please check in at least 2 players to generate Wednesday even teams.');
        return;
      }

      setPlayerAddError(null);

      // 1. Shuffle active checked-in attendees
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);

      // 2. Plan even head-to-head matches (max 3 per team, 4 only with odd player exception)
      // Matches are paired such that teams of 3 play teams of 3 (3v3), teams of 2 play teams of 2 (2v2),
      // or 4v3 with a rotating dummy when an odd player makes teams of 3 not work.
      const matchPlan = getWednesdayMatchPlan(shuffled.length);

      let playerCursor = 0;
      const pairedTeams: [{
        id: string;
        realPlayers: LeagueAttendancePlayer[];
        players: { id: string; name: string; avatar: string; isDummy?: boolean }[];
        name: string;
      }, {
        id: string;
        realPlayers: LeagueAttendancePlayer[];
        players: { id: string; name: string; avatar: string; isDummy?: boolean }[];
        name: string;
      }][] = [];

      matchPlan.forEach((m, mIdx) => {
        const teamAReal = shuffled.slice(playerCursor, playerCursor + m.sizeA);
        playerCursor += m.sizeA;
        const teamBReal = shuffled.slice(playerCursor, playerCursor + m.sizeB);
        playerCursor += m.sizeB;

        const teamA = {
          id: `wed-team-${mIdx * 2 + 1}-${Date.now()}-${mIdx * 2}`,
          realPlayers: teamAReal,
          players: [] as { id: string; name: string; avatar: string; isDummy?: boolean }[],
          name: `Wednesday Team ${mIdx * 2 + 1}`,
        };

        const teamB = {
          id: `wed-team-${mIdx * 2 + 2}-${Date.now()}-${mIdx * 2 + 1}`,
          realPlayers: teamBReal,
          players: [] as { id: string; name: string; avatar: string; isDummy?: boolean }[],
          name: `Wednesday Team ${mIdx * 2 + 2}`,
        };

        pairedTeams.push([teamA, teamB]);
      });

      // 3. Balance each paired matchup:
      // If both teams have equal players (e.g. 3v3 or 2v2) -> match with ZERO dummies!
      // If one team has more players than the other (e.g. 4v3 or 3v2 with odd player exception) -> the smaller team gets a rotating dummy.
      pairedTeams.forEach(([teamA, teamB]) => {
        const sizeA = teamA.realPlayers.length;
        const sizeB = teamB.realPlayers.length;
        const matchTargetSize = Math.max(sizeA, sizeB);

        // Populate Team A
        teamA.players = teamA.realPlayers.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '🎯',
          isDummy: false,
        }));
        let dummyNumA = 1;
        while (teamA.players.length < matchTargetSize) {
          teamA.players.push({
            id: `dummy-${teamA.id}-${dummyNumA}`,
            name: '🤖 Dummy Player',
            avatar: '🤖',
            isDummy: true,
          });
          dummyNumA++;
        }

        // Populate Team B
        teamB.players = teamB.realPlayers.map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '🎯',
          isDummy: false,
        }));
        let dummyNumB = 1;
        while (teamB.players.length < matchTargetSize) {
          teamB.players.push({
            id: `dummy-${teamB.id}-${dummyNumB}`,
            name: '🤖 Dummy Player',
            avatar: '🤖',
            isDummy: true,
          });
          dummyNumB++;
        }

        // Assign descriptive team names
        const namesA = teamA.realPlayers.map(p => p.name).join(' & ');
        const hasDummyA = teamA.players.some(p => p.isDummy);
        teamA.name = hasDummyA ? `${namesA} & Dummy` : namesA;

        const namesB = teamB.realPlayers.map(p => p.name).join(' & ');
        const hasDummyB = teamB.players.some(p => p.isDummy);
        teamB.name = hasDummyB ? `${namesB} & Dummy` : namesB;
      });

      // 4. Generate delegated board matchups for bracket view
      // In Wednesday teams league all matches are paired up evenly and players only play that match for the night (no round robin).
      const wednesdayMatchups: BracketMatchup[] = pairedTeams.map(([teamA, teamB], idx) => {
        const sizeA = teamA.realPlayers.length;
        const sizeB = teamB.realPlayers.length;
        const isEven = sizeA === sizeB;
        const tag = isEven
          ? ` (${sizeA}v${sizeB} Matchup • Even Teams)`
          : ` (${sizeA}v${sizeB} Matchup • Rotating Dummy)`;

        return {
          id: `bm-wed-board${idx + 1}-${Date.now()}-${idx}`,
          leagueType: 'wednesday' as const,
          division: 'Wednesday Teams',
          round: `Board ${idx + 1} • Head-to-Head Match${tag}`,
          entryA: { id: teamA.id, name: teamA.name, players: teamA.players },
          entryB: { id: teamB.id, name: teamB.name, players: teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'pending' as const,
        };
      });

      const wednesdayState: LeagueBracketsState = {
        isMultiDivision: false,
        divisions: [
          {
            name: 'Wednesday Teams',
            subtitle: '(Single Head-to-Head Match Tonight • No Round Robin)',
            matchups: wednesdayMatchups,
          },
        ],
        divisionA: wednesdayMatchups,
        divisionB: [],
        divisionC: [],
        divisionD: [],
        divisionE: [],
        divisionF: [],
      };

      lastLocalBracketGenerationTime.current = Date.now();
      setBrackets(wednesdayState);
      try {
        localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(wednesdayState));
      } catch (e) {}
      syncLeagueBracketsToCloud(leagueType, wednesdayState);
      fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType, brackets: wednesdayState }),
      }).catch(() => {});
      setIsAttendanceUnlocked(false);
      setActiveSubTab('brackets');
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', {
        detail: { key: `kaboom_brackets_${leagueType}`, data: wednesdayState }
      }));
    } else {
      // Tuesday Singles or Thursday Doubles
      const activePlayers = singlesRoster.filter(p => p.checkedIn);

      if (activePlayers.length < 2) {
        setPlayerAddError('Please check in at least 2 players to generate brackets.');
        return;
      }

      setPlayerAddError(null);

      if (leagueType === 'thursday') {
        const divInfo = calculateThursdayDivisions(activePlayers.length, thursdayDivCount);
        const hasOddDiv = divInfo.sizes.some(s => s % 2 !== 0);
        if (hasOddDiv) {
          setShowThursdayOddModal(true);
          return;
        }
        generateThursdayBracketsWithOption(thursdayOddOption);
        return;
      }

      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);

      if (false) {
        // Handled above
      } else {
        // Tuesday Singles
        const singlesEntries = shuffled.map(p => ({
          name: p.name,
          players: [p],
        }));

        // In Tuesday Singles: strictly maximum of 4 players per division where the bye acts as a player as well (all divisions equal)
        const isMultiDiv = singlesEntries.length > 4;
        const numDivisions = isMultiDiv ? Math.ceil(singlesEntries.length / 4) : 1;
        const baseSize = Math.floor(singlesEntries.length / numDivisions);
        const remainder = singlesEntries.length % numDivisions;

        const generatedDivisions: DivisionData[] = [];
        let curIdx = 0;

        const maxDivSize = baseSize + (remainder > 0 ? 1 : 0);

        for (let d = 0; d < numDivisions; d++) {
          const size = baseSize + (d < remainder ? 1 : 0);
          const divPlayers = singlesEntries.slice(curIdx, curIdx + size);
          curIdx += size;

          const letter = String.fromCharCode(65 + d);
          const divName = !isMultiDiv ? 'Open Division' : `Division ${letter}`;
          const subtitle = getDivisionSubtitle(d, isMultiDiv);

          generatedDivisions.push({
            name: divName,
            subtitle,
            matchups: createRoundRobinMatchups(divPlayers, divName, 'tuesday', {
              isSmallerDivision: divPlayers.length < maxDivSize,
              maxDivisionPlayerCount: maxDivSize,
            }),
          });
        }

        const tuesdayState: LeagueBracketsState = {
          isMultiDivision: isMultiDiv,
          divisions: generatedDivisions,
          divisionA: generatedDivisions[0]?.matchups || [],
          divisionB: generatedDivisions[1]?.matchups || [],
          divisionC: generatedDivisions[2]?.matchups || [],
          divisionD: generatedDivisions[3]?.matchups || [],
          divisionE: generatedDivisions[4]?.matchups || [],
          divisionF: generatedDivisions[5]?.matchups || [],
        };

        lastLocalBracketGenerationTime.current = Date.now();
        setBrackets(tuesdayState);
        try {
          localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(tuesdayState));
        } catch (e) {}
        syncLeagueBracketsToCloud(leagueType, tuesdayState);
        fetch('/api/brackets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueType, brackets: tuesdayState }),
        }).catch(() => {});
        setIsAttendanceUnlocked(false);
        setActiveSubTab('brackets');
        window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', {
          detail: { key: `kaboom_brackets_${leagueType}`, data: tuesdayState }
        }));
      }
    }

    setActiveSubTab('brackets');
  };

  const getGamesWonA = (m: BracketMatchup) => {
    if (m.isBye || m.entryA?.name?.toUpperCase().includes('BYE') || m.entryB?.name?.toUpperCase().includes('BYE')) return 0;
    if (typeof m.scoreA === 'number') return m.scoreA;
    if (m.winnerName === m.entryA.name) return 1;
    return 0;
  };

  const getGamesWonB = (m: BracketMatchup) => {
    if (m.isBye || m.entryA?.name?.toUpperCase().includes('BYE') || m.entryB?.name?.toUpperCase().includes('BYE')) return 0;
    if (typeof m.scoreB === 'number') return m.scoreB;
    if (m.winnerName === m.entryB.name) return 1;
    return 0;
  };

  // Launch Bracket Match directly into live Scorer
  const handleLaunchBracketMatch = (m: BracketMatchup, gameMode: 'MEDLEY' | 'BASEBALL' = 'MEDLEY') => {
    // BYE matches cannot be launched as games
    if (m.isBye || m.entryA?.name?.toUpperCase().includes('BYE') || m.entryB?.name?.toUpperCase().includes('BYE')) {
      return;
    }
    const matchCode = `${leagueType.toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Update matchup status in brackets state to in_progress
    if (brackets) {
      const updateList = (list?: BracketMatchup[]) =>
        (list || []).map((item) => (item.id === m.id ? { ...item, status: 'in_progress' as const } : item));

      setBrackets({
        ...brackets,
        divisionA: updateList(brackets.divisionA),
        divisionB: updateList(brackets.divisionB),
        divisionC: brackets.divisionC ? updateList(brackets.divisionC) : undefined,
        divisionD: brackets.divisionD ? updateList(brackets.divisionD) : undefined,
        divisionE: brackets.divisionE ? updateList(brackets.divisionE) : undefined,
        divisionF: brackets.divisionF ? updateList(brackets.divisionF) : undefined,
        divisions: Array.isArray(brackets.divisions)
          ? brackets.divisions.map(d => ({ ...d, matchups: updateList(d.matchups) }))
          : undefined,
      });
    }

    const isMedley = gameMode === 'MEDLEY';
    const isWedMedley = isMedley && (leagueType === 'wednesday' || m.leagueType === 'wednesday' || m.id.toLowerCase().includes('wed'));

    const startScore = isWedMedley ? 1001 : isMedley ? 301 : 0;
    const inMode = isWedMedley ? 'Straight' : isMedley ? 'Double' : 'Straight';
    const outMode = isMedley ? 'Double' : 'Straight';
    const legsToWin = isWedMedley ? 6 : isMedley ? 3 : 1;
    const medleyConfigs = isWedMedley
      ? WEDNESDAY_MEDLEY_CONFIGS
      : isMedley
      ? DEFAULT_MEDLEY_CONFIGS
      : undefined;

    // Check if an existing match state already matches this bracket matchup
    let existingMatch: MatchState | undefined;
    try {
      const activeRaw = localStorage.getItem('kaboom_active_match_state');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        if (
          parsed?.settings?.bracketMatchId === m.id ||
          (parsed?.players?.some((p: any) => p.name === m.entryA.name) &&
            parsed?.players?.some((p: any) => p.name === m.entryB.name))
        ) {
          existingMatch = parsed;
        }
      }
    } catch (e) {}

    if (existingMatch && m.status === 'in_progress') {
      if (isWedMedley) {
        existingMatch.settings.leagueType = 'wednesday';
        existingMatch.settings.isMedley = true;
        existingMatch.settings.medleyConfigs = WEDNESDAY_MEDLEY_CONFIGS;
        existingMatch.settings.legsToWin = 6;
        existingMatch.settings.legsPerSet = 6;
        if (existingMatch.currentLeg === 1 && (!existingMatch.history || existingMatch.history.length === 0)) {
          existingMatch.currentStartScore = 1001;
          existingMatch.currentGameMode = 'X01';
          existingMatch.currentInMode = 'Straight';
          existingMatch.currentOutMode = 'Double';
          existingMatch.settings.startScore = 1001;
          existingMatch.settings.inMode = 'Straight';
          existingMatch.settings.outMode = 'Double';
          existingMatch.players.forEach(p => { p.currentScore = 1001; });
        }
      }
      onLaunchMatch(existingMatch.settings, existingMatch.players, leagueType, existingMatch);
      return;
    }

    const settings: MatchSettings = {
      gameMode,
      startScore,
      inMode,
      outMode,
      format: 'legs',
      legsToWin,
      setsToWin: 1,
      legsPerSet: legsToWin,
      isDartBot: false,
      botLevel: 5,
      announceAudio: true,
      isPublic: false, // Any league matches will not be live only local
      matchCode,
      starterPlayerId: m.entryA.players[0]?.id || 'p1',
      isMedley,
      medleyConfigs,
      leagueType,
      bracketMatchId: m.id,
    };

    const isEntryADummy = Boolean(
      m.entryA.players?.some((p) => p.isDummy) ||
      m.entryA.name.toLowerCase().includes('dummy')
    );
    const isEntryBDummy = Boolean(
      m.entryB.players?.some((p) => p.isDummy) ||
      m.entryB.name.toLowerCase().includes('dummy') ||
      m.isDummyOpponent
    );

    const playersList: Player[] = [
      {
        id: 'p1',
        name: m.entryA.name,
        avatar: m.entryA.players[0]?.avatar || (isEntryADummy ? '🤖' : '🎯'),
        isDummy: isEntryADummy,
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: isEntryADummy && (!m.entryA.players || m.entryA.players.length === 0)
          ? [{ id: 'p-dummy-a', name: '🤖 Dummy Player', avatar: '🤖', isDummy: true }]
          : m.entryA.players,
        currentSubPlayerIndex: 0,
        dummyShooterIndices: {},
        stats: {
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
        },
      },
      {
        id: 'p2',
        name: m.entryB.name,
        avatar: m.entryB.players[0]?.avatar || (isEntryBDummy ? '🤖' : '🎯'),
        isDummy: isEntryBDummy,
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: isEntryBDummy && (!m.entryB.players || m.entryB.players.length === 0)
          ? [{ id: 'p-dummy-b', name: '🤖 Dummy Player', avatar: '🤖', isDummy: true }]
          : m.entryB.players,
        currentSubPlayerIndex: 0,
        dummyShooterIndices: {},
        stats: {
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
        },
      },
    ];

    onLaunchMatch(settings, playersList, leagueType);
  };

  // Manually mark a bracket matchup as complete with specified winner
  const handleManualMarkComplete = async (m: BracketMatchup, winnerSide: 'A' | 'B') => {
    if (m.isBye || m.entryA?.name?.toUpperCase().includes('BYE') || m.entryB?.name?.toUpperCase().includes('BYE')) {
      return; // A bye match cannot have a winner or score
    }
    const winnerName = winnerSide === 'A' ? m.entryA.name : m.entryB.name;
    const scoreA = winnerSide === 'A' ? (typeof m.scoreA === 'number' && m.scoreA > 0 ? m.scoreA : 2) : (m.scoreA || 0);
    const scoreB = winnerSide === 'B' ? (typeof m.scoreB === 'number' && m.scoreB > 0 ? m.scoreB : 2) : (m.scoreB || 0);

    // 1. Direct server complete call
    fetch('/api/brackets/complete-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leagueType,
        bracketMatchId: m.id,
        scoreA,
        scoreB,
        winnerName,
        p0Name: m.entryA.name,
        p1Name: m.entryB.name,
      }),
    }).catch(() => {});

    // 2. Update local state
    if (brackets) {
      const updateList = (list?: BracketMatchup[]) =>
        (list || []).map((item) =>
          item.id === m.id
            ? {
                ...item,
                status: 'completed' as const,
                scoreA,
                scoreB,
                winnerName,
              }
            : item
        );

      const updated: LeagueBracketsState = {
        ...brackets,
        divisionA: updateList(brackets.divisionA),
        divisionB: updateList(brackets.divisionB),
        divisionC: brackets.divisionC ? updateList(brackets.divisionC) : undefined,
        divisionD: brackets.divisionD ? updateList(brackets.divisionD) : undefined,
        divisionE: brackets.divisionE ? updateList(brackets.divisionE) : undefined,
        divisionF: brackets.divisionF ? updateList(brackets.divisionF) : undefined,
        divisions: Array.isArray(brackets.divisions)
          ? brackets.divisions.map((d) => ({ ...d, matchups: updateList(d.matchups) }))
          : undefined,
      };

      setBrackets(updated);
      localStorage.setItem(`kaboom_brackets_${leagueType}`, JSON.stringify(updated));
      syncLeagueBracketsToCloud(leagueType, updated);
    }
  };

  // End of Night: Clear all matches without removing player stats
  const handleClearNightMatches = () => {
    setShowClearNightModal(true);
  };

  const handleDeleteMatchup = async (matchId: string) => {
    if (!matchId) return;
    try {
      const updated = await deleteSingleMatchupFromCloud(leagueType, matchId);
      if (updated) {
        setBrackets(updated);
      } else {
        setBrackets(prev => {
          if (!prev) return null;
          const clone = JSON.parse(JSON.stringify(prev));
          if (Array.isArray(clone.divisions)) {
            clone.divisions.forEach((d: any) => {
              if (Array.isArray(d.matchups)) {
                d.matchups = d.matchups.filter((m: any) => m.id !== matchId);
              }
            });
          }
          const divKeys = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
          divKeys.forEach(k => {
            if (Array.isArray(clone[k])) {
              clone[k] = clone[k].filter((m: any) => m.id !== matchId);
            }
          });
          return clone;
        });
      }
    } catch (e) {
      console.error('Failed to delete matchup:', e);
    }
  };

  const executeClearNightMatches = async () => {
    setIsClearingNight(true);
    try {
      await clearNightMatchesFromCloud(leagueType);
      setBrackets(null);
      try {
        localStorage.removeItem(`kaboom_brackets_${leagueType}`);
        localStorage.removeItem(`kaboom_brackets_${leagueType}_updated_at`);
        localStorage.removeItem('kaboom_active_match_state');
        localStorage.removeItem('kaboom_recent_matches');
      } catch (e) {}

      syncLeagueBracketsToCloud(leagueType, null);
      fetch(`/api/brackets/${leagueType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType, brackets: null }),
      }).catch(() => {});
      fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType, brackets: null }),
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('kaboom_night_matches_cleared', { detail: { leagueType } }));
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: `kaboom_brackets_${leagueType}`, data: null } }));

      // If admin enabled automatic email reports, dispatch fully detailed overall player stats to surgedarts@gmail.com
      if (getAutoEmailOverallStatsEnabled()) {
        dispatchOverallPlayerStatsEmail({ triggerType: 'automatic' }).catch(err => {
          console.error('[AutoEmail] Failed to dispatch overall player stats on night clear:', err);
        });
      }
    } catch (err) {
      console.error('Failed to clear night matches:', err);
    } finally {
      setIsClearingNight(false);
      setShowClearNightModal(false);
    }
  };

  const checkedInSinglesCount = singlesRoster.filter(p => p.checkedIn).length;
  const isMultiDivSingles = checkedInSinglesCount > 4;

  const THEME_KEYS = ['indigo', 'amber', 'purple', 'emerald', 'blue', 'rose', 'cyan'] as const;
  type DivisionTheme = typeof THEME_KEYS[number];

  const getDivisionTheme = (index: number): DivisionTheme =>
    THEME_KEYS[index % THEME_KEYS.length];

  const getDivisionSubtitle = (
    index: number,
    isMultiDivision: boolean,
    lType?: 'tuesday' | 'wednesday' | 'thursday'
  ) => {
    if (lType === 'wednesday') {
      return '(Head-to-Head • 1 Match Tonight)';
    }
    if (lType === 'thursday') {
      if (!isMultiDivision) return '(Round Robin • Open Division)';
      return `(Round Robin • Assigned Division ${String.fromCharCode(65 + index)})`;
    }
    // Tuesday singles
    if (!isMultiDivision) return '(Round Robin • Open Division)';
    return `(Round Robin • Division ${String.fromCharCode(65 + index)})`;
  };

  const divisionThemeStyles: Record<DivisionTheme, {
    badge: string;
    border: string;
    round: string;
    scorePill: string;
    vs: string;
    launchBtn: string;
  }> = {
    indigo: {
      badge: 'bg-indigo-600 text-white',
      border: 'border-indigo-100 hover:border-indigo-300',
      round: 'text-indigo-600',
      scorePill: 'bg-indigo-600 text-white shadow-sm',
      vs: 'text-indigo-500',
      launchBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    },
    amber: {
      badge: 'bg-amber-500 text-white',
      border: 'border-amber-100 hover:border-amber-300',
      round: 'text-amber-600',
      scorePill: 'bg-amber-600 text-white shadow-sm',
      vs: 'text-amber-500',
      launchBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    purple: {
      badge: 'bg-purple-600 text-white',
      border: 'border-purple-100 hover:border-purple-300',
      round: 'text-purple-600',
      scorePill: 'bg-purple-600 text-white shadow-sm',
      vs: 'text-purple-500',
      launchBtn: 'bg-purple-600 hover:bg-purple-700 text-white',
    },
    emerald: {
      badge: 'bg-emerald-600 text-white',
      border: 'border-emerald-100 hover:border-emerald-300',
      round: 'text-emerald-600',
      scorePill: 'bg-emerald-600 text-white shadow-sm',
      vs: 'text-emerald-500',
      launchBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    blue: {
      badge: 'bg-blue-600 text-white',
      border: 'border-blue-100 hover:border-blue-300',
      round: 'text-blue-600',
      scorePill: 'bg-blue-600 text-white shadow-sm',
      vs: 'text-blue-500',
      launchBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
    rose: {
      badge: 'bg-rose-600 text-white',
      border: 'border-rose-100 hover:border-rose-300',
      round: 'text-rose-600',
      scorePill: 'bg-rose-600 text-white shadow-sm',
      vs: 'text-rose-500',
      launchBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    cyan: {
      badge: 'bg-cyan-600 text-white',
      border: 'border-cyan-100 hover:border-cyan-300',
      round: 'text-cyan-600',
      scorePill: 'bg-cyan-600 text-white shadow-sm',
      vs: 'text-cyan-500',
      launchBtn: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    },
  };

  // Helper to extract effective divisions and auto-repair any divisions that exceed 5 players/teams
  const getEffectiveDivisions = (
    b: LeagueBracketsState | null
  ): { name: string; subtitle: string; matchups: BracketMatchup[]; theme: DivisionTheme }[] => {
    if (!b) return [];

    // Wednesday Teams League:
    if (leagueType === 'wednesday') {
      const isMulti = Boolean(
        b.isMultiDivision ||
        (Array.isArray(b.divisions) && b.divisions.length > 1) ||
        (b.divisionB && b.divisionB.length > 0) ||
        (b.divisionC && b.divisionC.length > 0)
      );

      if (!isMulti) {
        // Single group: "Wednesday Teams" with all head-to-head board matchups (Board 1, Board 2, etc.)
        const allWedMatchups: BracketMatchup[] = [];
        const seenMatchKeys = new Set<string>();

        const addWedMatch = (m: BracketMatchup) => {
          if (!m || !m.entryA || !m.entryB) return;
          const key = m.id || `${m.entryA.name}_vs_${m.entryB.name}`;
          if (seenMatchKeys.has(key)) return;
          seenMatchKeys.add(key);
          allWedMatchups.push(m);
        };

        if (Array.isArray(b.divisions) && b.divisions.length > 0) {
          b.divisions.forEach(d => {
            if (Array.isArray(d?.matchups)) d.matchups.forEach(addWedMatch);
          });
        }
        const keys: (keyof LeagueBracketsState)[] = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
        keys.forEach(k => {
          const list = b[k] as BracketMatchup[] | undefined;
          if (Array.isArray(list)) list.forEach(addWedMatch);
        });

        if (allWedMatchups.length === 0) return [];

        return [
          {
            name: 'Wednesday Teams',
            subtitle: '(Single Head-to-Head Match Tonight • No Round Robin)',
            matchups: allWedMatchups.map((m, mIdx) => ({
              ...m,
              id: m.id || `bm-wed-board${mIdx + 1}-${mIdx}`,
              leagueType: 'wednesday',
              division: m.division || 'Wednesday Teams',
              round: m.round?.replace('Delegated Matchup', 'Head-to-Head Match') || `Board ${mIdx + 1} • Head-to-Head Match`,
            })),
            theme: 'indigo',
          },
        ];
      }
    }

    let rawDivisions: { name: string; subtitle?: string; matchups: BracketMatchup[] }[] = [];

    const keys: { key: keyof LeagueBracketsState; name: string; subtitle: string }[] = [
      {
        key: 'divisionA',
        name: 'Division A',
        subtitle: b.isMultiDivision
          ? leagueType === 'thursday'
            ? '(Round Robin • Assigned Division A)'
            : '(Round Robin • Division A)'
          : leagueType === 'thursday'
          ? '(Round Robin • Open Division)'
          : '(Open Division)',
      },
      {
        key: 'divisionB',
        name: 'Division B',
        subtitle: leagueType === 'thursday' ? '(Round Robin • Assigned Division B)' : '(Round Robin • Division B)',
      },
      {
        key: 'divisionC',
        name: 'Division C',
        subtitle: leagueType === 'thursday' ? '(Round Robin • Assigned Division C)' : '(Round Robin • Division C)',
      },
      {
        key: 'divisionD',
        name: 'Division D',
        subtitle: leagueType === 'thursday' ? '(Round Robin • Assigned Division D)' : '(Round Robin • Division D)',
      },
      {
        key: 'divisionE',
        name: 'Division E',
        subtitle: leagueType === 'thursday' ? '(Round Robin • Assigned Division E)' : '(Round Robin • Division E)',
      },
      {
        key: 'divisionF',
        name: 'Division F',
        subtitle: leagueType === 'thursday' ? '(Round Robin • Assigned Division F)' : '(Round Robin • Division F)',
      },
    ];

    if (Array.isArray(b.divisions) && b.divisions.length > 0) {
      b.divisions.forEach((d) => {
        if (!d) return;
        const divMatchups = Array.isArray(d.matchups) ? [...d.matchups] : [];
        if (divMatchups.length > 0) {
          rawDivisions.push({ name: d.name, subtitle: d.subtitle, matchups: divMatchups });
        }
      });
    } else {
      keys.forEach(({ key, name, subtitle }) => {
        const list = b[key] as BracketMatchup[] | undefined;
        if (Array.isArray(list) && list.length > 0) {
          rawDivisions.push({ name, subtitle, matchups: list });
        }
      });
    }

    if (rawDivisions.length === 0) return [];

    return rawDivisions.map((d, idx) => {
      let sub = d.subtitle;
      if (!sub || sub.includes('Championship') || sub.includes('Premier')) {
        sub = getDivisionSubtitle(idx, b.isMultiDivision, leagueType);
      }
      const rawMatchups = (d.matchups || []).map((m, mIdx) => ({
        ...m,
        id: m.id?.includes(leagueType) ? m.id : `bm-${leagueType}-${(m.id || `m${mIdx}`).replace(/^bm-/, '')}`,
        leagueType,
        round: m.round?.replace(/Championship/gi, 'Round Robin') || m.round,
      }));
      return {
        name: d.name,
        subtitle: sub,
        matchups: enforceMaxFourMatchesPerPerson(rawMatchups, leagueType),
        theme: getDivisionTheme(idx),
      };
    });
  };

  const renderDivisionMatchups = (
    divTitle: string,
    divSubtitle: string,
    matchups: BracketMatchup[],
    theme: DivisionTheme
  ) => {
    const t = divisionThemeStyles[theme] || divisionThemeStyles.indigo;
    return (
      <div id={`div-section-${divTitle.replace(/\s+/g, '')}`} className="space-y-4 pt-2 scroll-mt-6">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
          <span className={`px-3 py-1 ${t.badge} font-black text-xs uppercase tracking-wider rounded-lg shadow-sm`}>
            {divTitle} {divSubtitle}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {leagueType === 'wednesday'
              ? `${matchups.length} Head-to-Head Matches Tonight (No Round Robin)`
              : leagueType === 'thursday'
              ? `${matchups.length} Round Robin Matchups Within ${divTitle}`
              : `${matchups.length} Matchups Delegated`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchups.map((m, mIdx) => {
            const isByeMatch = Boolean(
              m.isBye ||
              m.entryA?.name?.toUpperCase().includes('BYE') ||
              m.entryB?.name?.toUpperCase().includes('BYE')
            );
            const isByeA = m.entryA?.name?.toUpperCase().includes('BYE');
            const isByeB = m.entryB?.name?.toUpperCase().includes('BYE');

            return (
              <div
                key={`matchup-${divTitle}-${m.id || mIdx}`}
                className={`bg-white border ${t.border} rounded-xl p-4 shadow-sm transition-all space-y-3`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${t.round} uppercase tracking-wider`}>
                      {m.round}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMatchup(m.id)}
                        className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Delete this specific matchup"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {m.isDummyOpponent ? (
                      <span className="font-bold text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <span>🤖</span>
                        <span>Equalizer Match • Bye plays Dummy (No stats for substitute shooter)</span>
                      </span>
                    ) : m.isReplayRound ? (
                      <span className="font-bold text-indigo-900 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded flex items-center gap-1">
                        <span>🔄</span>
                        <span>Round 1 Replay • Equalizes Division Games</span>
                      </span>
                    ) : isByeMatch ? (
                      <span className="font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        BYE Round • Player Sitting Out
                      </span>
                    ) : (leagueType === 'wednesday' || m.leagueType === 'wednesday' || m.id.toLowerCase().includes('wed')) ? (
                      'Wednesday 4v4 Medley (1001 ➔ Baseball ➔ 701 DI/DO ➔ Fives ➔ Cricket ➔ 1001)'
                    ) : leagueType === 'thursday' ? (
                      'Doubles Round Robin • Medley (301 DI/DO ➔ 501 ➔ Cricket)'
                    ) : (
                      'Medley Format (301 DI/DO ➔ 501 ➔ Cricket)'
                    )}
                  </span>
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-3 rounded-lg border transition-all space-y-2 ${
                      m.winnerName === m.entryA.name
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                        : isByeA
                        ? 'bg-slate-100/80 border-dashed border-slate-300 text-slate-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-extrabold text-xs ${isByeA ? 'text-slate-500 italic' : 'text-slate-900'}`}>
                        {m.entryA.name}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-md font-mono font-black text-xs flex items-center gap-1.5 ${
                          m.winnerName === m.entryA.name
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : getGamesWonA(m) > 0
                            ? t.scorePill
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{getGamesWonA(m)}</span>
                        <span className="text-[10px] font-sans font-bold uppercase opacity-85">
                          {isByeMatch ? 'bye' : getGamesWonA(m) === 1 ? 'game won' : 'games won'}
                        </span>
                      </span>
                    </div>

                    {/* Display player roster for Team A */}
                    {m.entryA.players && m.entryA.players.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
                        {m.entryA.players.length === 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            👥 Trio (3)
                          </span>
                        )}
                        {m.entryA.players.map((p, pIdx) => {
                          const pKey = (p.name || '').toLowerCase().trim();
                          const pCleanKey = pKey.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
                          const bullsEntry = nightlyBullsSession?.entries?.[pKey] || nightlyBullsSession?.entries?.[pCleanKey];
                          return (
                            <span
                              key={`match-${m.id}-teamA-${p.id || pIdx}-${pIdx}`}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 ${
                                p.isDummy
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                  : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                              }`}
                            >
                              <span>{p.avatar || '🎯'}</span>
                              <span>{p.name}</span>
                              {p.isDummy && <span className="text-[9px] uppercase tracking-wider text-amber-700 bg-amber-200/60 px-1 rounded">(Rotating Throw)</span>}
                              {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && !p.isDummy && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGameBullsTargetPlayerName(p.name);
                                    setShowGameBullsModal(true);
                                  }}
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex items-center gap-0.5 cursor-pointer transition-all ${
                                    bullsEntry !== undefined
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                  }`}
                                  title={bullsEntry !== undefined ? `Tonight: ${bullsEntry.bullsHit} Bulls. Click to edit.` : `Shoot tonight's Bulls challenge for ${p.name}`}
                                >
                                  <Target className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{bullsEntry !== undefined ? `${bullsEntry.bullsHit} 🎯` : 'Bulls'}</span>
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={`text-center text-[10px] font-black uppercase ${t.vs} tracking-widest`}>
                    VS
                  </div>

                  <div
                    className={`p-3 rounded-lg border transition-all space-y-2 ${
                      m.winnerName === m.entryB.name
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                        : isByeB
                        ? 'bg-slate-100/80 border-dashed border-slate-300 text-slate-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-extrabold text-xs ${isByeB ? 'text-slate-500 italic' : 'text-slate-900'}`}>
                        {m.entryB.name}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-md font-mono font-black text-xs flex items-center gap-1.5 ${
                          m.winnerName === m.entryB.name
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : getGamesWonB(m) > 0
                            ? t.scorePill
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{getGamesWonB(m)}</span>
                        <span className="text-[10px] font-sans font-bold uppercase opacity-85">
                          {isByeMatch ? 'bye' : getGamesWonB(m) === 1 ? 'game won' : 'games won'}
                        </span>
                      </span>
                    </div>

                    {/* Display player roster for Team B */}
                    {m.entryB.players && m.entryB.players.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
                        {m.entryB.players.length === 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            👥 Trio (3)
                          </span>
                        )}
                        {m.entryB.players.map((p, pIdx) => {
                          const pKey = (p.name || '').toLowerCase().trim();
                          const pCleanKey = pKey.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
                          const bullsEntry = nightlyBullsSession?.entries?.[pKey] || nightlyBullsSession?.entries?.[pCleanKey];
                          return (
                            <span
                              key={`match-${m.id}-teamB-${p.id || pIdx}-${pIdx}`}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 ${
                                p.isDummy
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                  : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                              }`}
                            >
                              <span>{p.avatar || '🎯'}</span>
                              <span>{p.name}</span>
                              {p.isDummy && <span className="text-[9px] uppercase tracking-wider text-amber-700 bg-amber-200/60 px-1 rounded">(Rotating Throw)</span>}
                              {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && !p.isDummy && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGameBullsTargetPlayerName(p.name);
                                    setShowGameBullsModal(true);
                                  }}
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border flex items-center gap-0.5 cursor-pointer transition-all ${
                                    bullsEntry !== undefined
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                      : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                  }`}
                                  title={bullsEntry !== undefined ? `Tonight: ${bullsEntry.bullsHit} Bulls. Click to edit.` : `Shoot tonight's Bulls challenge for ${p.name}`}
                                >
                                  <Target className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{bullsEntry !== undefined ? `${bullsEntry.bullsHit} 🎯` : 'Bulls'}</span>
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {isByeMatch ? (
                  <div className="w-full py-2.5 px-3 bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-2xs">
                    <span>☕</span>
                    <span>BYE Round — Sitting Out (No match played • 0 wins / 0 stats)</span>
                  </div>
                ) : m.status === 'completed' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 text-center py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Winner: <strong>{m.winnerName || 'Completed'}</strong></span>
                      </div>
                    </div>

                    {/* Nightly 9-Dart Bulls Challenge Action */}
                    {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && (
                      <div className="flex items-center justify-between gap-2 p-2 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 rounded-lg text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 text-rose-950 font-bold text-[11px]">
                          <Target className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Nightly 9-Dart Bulls Challenge</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setGameBullsTargetPlayerName(undefined);
                            setShowGameBullsModal(true);
                          }}
                          className="px-2.5 py-1 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-black text-[11px] rounded shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Record nightly 9-dart bulls challenge"
                        >
                          <Target className="w-3 h-3 text-white" />
                          <span>Shoot Bulls</span>
                        </button>
                      </div>
                    )}

                    {/* Admin Email Controls (Resend report, check dispatch status) */}
                    {isAdmin && (
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                        {(() => {
                          const isSent = isMatchEmailDispatched(m.id);
                          const dispatchInfo = getDispatchedEmailInfo(m.id);
                          return (
                            <>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                {isSent ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-emerald-700 bg-emerald-50 border border-emerald-200"
                                    title={
                                      (dispatchInfo?.sentAt || dispatchInfo?.dispatchedAt)
                                        ? `Dispatched at ${new Date((dispatchInfo.sentAt || dispatchInfo.dispatchedAt)!).toLocaleTimeString()}`
                                        : 'Match email dispatched'
                                    }
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Email Sent
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                    <AlertCircle className="w-3 h-3 text-amber-600" /> Email Pending
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEmailModalForMatch(m)}
                                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                                  isSent
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                                }`}
                                title={isSent ? 'Resend match report email' : 'Send official match report email'}
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>{isSent ? 'Resend Email' : 'Send Email'}</span>
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : m.status === 'in_progress' ? (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleLaunchBracketMatch(m, 'MEDLEY')}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow flex items-center justify-center gap-1.5 transition-all animate-pulse cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" /> Resume Match
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaunchBracketMatch(m, 'BASEBALL')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                        title="Play Baseball format"
                      >
                        ⚾ Baseball
                      </button>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mark Winner:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleManualMarkComplete(m, 'A')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{m.entryA.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualMarkComplete(m, 'B')}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{m.entryB.name}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleLaunchBracketMatch(m, 'MEDLEY')}
                        className={`flex-1 py-2.5 ${t.launchBtn} font-extrabold text-xs uppercase tracking-wider rounded-lg shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Launch Match
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaunchBracketMatch(m, 'BASEBALL')}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                        title="Play Baseball format"
                      >
                        ⚾ Baseball
                      </button>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Direct Complete:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleManualMarkComplete(m, 'A')}
                            className="px-2 py-1 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{m.entryA.name} Won</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualMarkComplete(m, 'B')}
                            className="px-2 py-1 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{m.entryB.name} Won</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
      {/* Attendance & Bracket Sub-Tab Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            {isAdmin ? (
              <Users className="w-5 h-5 text-indigo-600" />
            ) : (
              <Trophy className="w-5 h-5 text-amber-500" />
            )}
            {isAdmin
              ? leagueType === 'tuesday'
                ? 'Tuesday Singles Attendance & Bracket Delegation'
                : leagueType === 'wednesday'
                ? 'Wednesday Teams Attendance & Delegation'
                : 'Thursday Doubles Attendance & Bracket Delegation'
              : leagueType === 'tuesday'
              ? "Tuesday Singles — Tonight's Matches"
              : leagueType === 'wednesday'
              ? "Wednesday Teams — Tonight's Matches"
              : "Thursday Doubles — Tonight's Matches"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAdmin
              ? leagueType === 'wednesday'
                ? "Check in tonight's attendees. Teams are paired up evenly for a single head-to-head match for the night (no round robin)!"
                : "Check-in tonight's attendees. Automatic Division splitting triggers if over 4 players or teams exist (max 4 matches/night)!"
              : leagueType === 'wednesday'
              ? "Tonight's head-to-head team matches. Each player/team plays only this match for the night (no round robin)."
              : 'Available matches for this evening. Launch your matchup to begin local board scoring.'}
          </p>
        </div>

        {/* View Switcher & Nightly Game Bulls Action */}
        <div className="flex flex-wrap items-center gap-2">
          {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && (
            <button
              type="button"
              onClick={() => {
                setGameBullsTargetPlayerName(undefined);
                setShowGameBullsModal(true);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Record tonight's 9-dart individual Bulls challenge"
            >
              <Target className="w-3.5 h-3.5 text-amber-200" />
              <span>Nightly Game Bulls</span>
              <span className="px-1.5 py-0.2 bg-black/25 rounded text-[10px] font-mono">
                {nightlyBullsCompletedCount}/{checkedInSinglesCount || singlesRoster.length}
              </span>
            </button>
          )}

          {isAdmin && (
            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveSubTab('attendance')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                  activeSubTab === 'attendance'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Attendance Roster
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('brackets')}
                disabled={!brackets}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                  activeSubTab === 'brackets'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" /> Delegated Brackets
                {brackets && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: ATTENDANCE & TEAM DELEGATION (Admin Only - Hidden in Player Profile) */}
      {isAdmin && activeSubTab === 'attendance' && (
        <div className="space-y-6">
          {/* LEAGUE SPECIFIC STRATEGY & RULES BANNER */}
          {leagueType === 'wednesday' ? (
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-amber-50/60 border border-indigo-200 rounded-xl space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm mt-0.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                      Wednesday Teams Attendance & Even Team Delegation
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Check in tonight's attendees. Teams are <strong>all as even as possible (max 3 per team, 4 only with odd player exception)</strong> and <strong>teams of the same size play each other</strong> for their single match tonight (0 Byes)!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-mono font-black rounded-lg shadow-2xs">
                    {checkedInSinglesCount} Checked In
                  </span>
                  {checkedInSinglesCount >= 2 && (() => {
                    const plan = getWednesdayMatchPlan(checkedInSinglesCount);
                    const k4 = plan.filter(m => m.sizeA === 4 && m.sizeB === 4).length;
                    const k3 = plan.filter(m => m.sizeA === 3 && m.sizeB === 3).length;
                    const k2 = plan.filter(m => m.sizeA === 2 && m.sizeB === 2).length;
                    const k1 = plan.filter(m => m.sizeA === 1 && m.sizeB === 1).length;
                    const parts: string[] = [];
                    if (k4 > 0) parts.push(`${k4}x (4v4)`);
                    if (k3 > 0) parts.push(`${k3}x (3v3)`);
                    if (k2 > 0) parts.push(`${k2}x (2v2)`);
                    if (k1 > 0) parts.push(`${k1}x (1v1)`);
                    const oddMatches = plan.filter(m => m.sizeA !== m.sizeB);
                    oddMatches.forEach(odd => {
                      parts.push(`1x (${odd.sizeA}v${odd.sizeB})`);
                    });
                    return (
                      <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-mono font-black rounded-lg shadow-2xs">
                        {plan.length * 2} Even Teams ({plan.length} Match{plan.length > 1 ? 'es' : ''}{parts.length > 0 ? `: ${parts.join(', ')}` : ''})
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Strategy & Even Matching Rule Note */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-100 text-xs text-slate-700">
                <div className="p-2.5 bg-white/80 rounded-lg border border-indigo-100 flex items-start gap-2">
                  <span className="text-indigo-600 font-black">⚡</span>
                  <div>
                    <strong className="text-slate-900">Single Match Tonight:</strong> No round robin. Teams and players only play this single head-to-head match for the entire evening.
                  </div>
                </div>
                <div className="p-2.5 bg-white/80 rounded-lg border border-indigo-100 flex items-start gap-2">
                  <span className="text-indigo-600 font-black">🎯</span>
                  <div>
                    <strong className="text-slate-900">Even Size Pairing (Max 3/team):</strong> Standard teams have 3 players (3v3). If an odd player is present where teams of 3 won't work, an exception allows a team of 4 (4v3 with rotating dummy). If needed for even head-to-head pairing, teams of 2 play teams of 2 (2v2).
                  </div>
                </div>
                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 flex items-start gap-2">
                  <span className="text-amber-600 font-black">🤖</span>
                  <div>
                    <strong className="text-slate-900">Equalizing Rotating Dummy:</strong> When an odd total of attendees is checked in, 1 rotating dummy player is added to the smaller team so that all darters are on a team and every board plays evenly.
                  </div>
                </div>
              </div>
            </div>
          ) : leagueType === 'thursday' ? (() => {
            const divInfo = calculateThursdayDivisions(checkedInSinglesCount, thursdayDivCount);
            const isOddDivisionPresent = divInfo.sizes.some(s => s % 2 !== 0);

            // Compute division options for the user to choose
            const availableDivCounts: { count: number | 'auto'; label: string; sizes: number[] }[] = [
              { count: 'auto', label: `Auto (${divInfo.numDivisions} Div${divInfo.numDivisions > 1 ? 's' : ''})`, sizes: divInfo.sizes },
            ];

            if (checkedInSinglesCount >= 4) {
              const minD = Math.max(1, Math.ceil(checkedInSinglesCount / 8));
              const maxD = Math.max(minD, Math.floor(checkedInSinglesCount / 4));
              for (let d = minD; d <= maxD; d++) {
                if (d !== divInfo.numDivisions) {
                  const testInfo = calculateThursdayDivisions(checkedInSinglesCount, d);
                  availableDivCounts.push({
                    count: d,
                    label: `${d} Div${d > 1 ? 's' : ''} (${testInfo.sizes.join(', ')} ea)`,
                    sizes: testInfo.sizes,
                  });
                }
              }
            }

            return (
              <div className="p-4 bg-gradient-to-r from-amber-50/70 via-indigo-50/50 to-white border border-amber-200/80 rounded-xl space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-600 text-white rounded-lg shadow-sm mt-0.5">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                        Thursday Doubles (Equal Divisions & Random Pairs)
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Two random players paired in round-robin divisions. Up to 4 teams (8 players) per division. All divisions are equal. Medley format (301 DI/DO ➔ 501 SI/DO ➔ Cricket).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 bg-white border border-amber-200 text-amber-900 text-xs font-mono font-black rounded-lg shadow-2xs">
                      {checkedInSinglesCount} Checked In
                    </span>
                    <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-mono font-black rounded-lg shadow-2xs">
                      {divInfo.numDivisions} Equal Division{divInfo.numDivisions > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Division Sizing Selector & Breakdown */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Division Sizing (Up to 4 Teams / 8 Players per Division • Equal Divisions):
                    </span>
                    {availableDivCounts.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {availableDivCounts.map(opt => (
                          <button
                            key={`thurs-div-opt-${opt.count}`}
                            type="button"
                            onClick={() => {
                              setThursdayDivCount(opt.count);
                              try {
                                localStorage.setItem('kaboom_thursday_div_count', JSON.stringify(opt.count));
                              } catch (e) {}
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                              thursdayDivCount === opt.count
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Division Breakdown Chips */}
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                    {divInfo.sizes.map((s, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isOdd = s % 2 !== 0;
                      return (
                        <div
                          key={`div-breakdown-${idx}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center gap-2"
                        >
                          <span className="font-black text-indigo-900">
                            {divInfo.numDivisions === 1 ? 'Open Division' : `Division ${letter}`}:
                          </span>
                          <span className="font-bold text-slate-700">{s} players</span>
                          {isOdd && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                              Odd ({s})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Odd Person Handling Strategy (Requirement: whichever is chosen is same in every division with odd person) */}
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎯</span>
                      <div>
                        <span className="font-black text-xs text-slate-900">Odd Person in Division Handling:</span>
                        <p className="text-[11px] text-slate-500">
                          Applied consistently to every division with an odd person tonight.
                        </p>
                      </div>
                    </div>
                    {isOddDivisionPresent && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] uppercase rounded-full shrink-0">
                        Active Tonight (Odd Divisions Present)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Add to Team (3-person Trio) */}
                    <button
                      type="button"
                      onClick={() => {
                        setThursdayOddOption('trio');
                        setThursdayPairOddWithDummy(false);
                        try {
                          localStorage.setItem('kaboom_thursday_odd_option', 'trio');
                          localStorage.setItem('kaboom_thursday_pair_odd_dummy', 'false');
                        } catch (e) {}
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        thursdayOddOption === 'trio'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                          <span className="text-base">👥</span>
                          <span>Add to a Team (3-Person Trio)</span>
                        </div>
                        {thursdayOddOption === 'trio' && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        The odd person joins one of the doubles teams in their division to form a <strong>3-person team</strong>. All 3 players rotate turns during the match. Stats are credited individually.
                      </p>
                      <div className="pt-1 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                        {thursdayOddOption === 'trio' ? '✓ Selected for All Odd Divisions' : 'Click to select'}
                      </div>
                    </button>

                    {/* Option 2: Play with Dummy Player */}
                    <button
                      type="button"
                      onClick={() => {
                        setThursdayOddOption('dummy');
                        setThursdayPairOddWithDummy(true);
                        try {
                          localStorage.setItem('kaboom_thursday_odd_option', 'dummy');
                          localStorage.setItem('kaboom_thursday_pair_odd_dummy', 'true');
                        } catch (e) {}
                      }}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        thursdayOddOption === 'dummy'
                          ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 font-black text-xs text-slate-900">
                          <span className="text-base">🤖</span>
                          <span>Play with Dummy Player</span>
                        </div>
                        {thursdayOddOption === 'dummy' && (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        The odd person is paired with a <strong>Dummy Player (🤖)</strong>. The player throws for the dummy (throws count toward the dummy's record).
                      </p>
                      <div className="pt-1 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                        {thursdayOddOption === 'dummy' ? '✓ Selected for All Odd Divisions' : 'Click to select'}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          })() : isMultiDivSingles ? (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 text-indigo-900">
              <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-indigo-700">
                  Over 4 Attendees Checked In ({checkedInSinglesCount} Players)
                </h4>
                <p className="text-xs text-indigo-600">
                  ✨ <strong>Automatic Division Delegation Active!</strong> Bracket will automatically split into {Math.ceil(checkedInSinglesCount / 4)} divisions (strictly maximum 4 players per division • all divisions equal with byes acting as players).
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
              <span>
                Total Checked-In Players: <strong>{checkedInSinglesCount}</strong> (4 or fewer = Single Open Division • Max 4 matches/night)
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {leagueType === 'thursday' ? 'Paired for Doubles' : '1v1 Singles Matches'}
              </span>
            </div>
          )}

          {/* Attendance Lock Status Banner */}
          {isBracketActive && (
            <div
              className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs transition-colors ${
                isAttendanceLocked
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {isAttendanceLocked ? (
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Unlock className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold">
                    {isAttendanceLocked ? 'Attendance Locked:' : 'Attendance Unlocked:'}
                  </span>{' '}
                  {isAttendanceLocked
                    ? 'Match brackets are active for tonight. Attendance roster is protected against accidental resets.'
                    : 'Admin unlock active. You may now check players in/out or make roster adjustments.'}
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsAttendanceUnlocked(!isAttendanceUnlocked)}
                  className={`px-3 py-1 font-bold rounded-lg border text-xs cursor-pointer transition-colors shadow-2xs ${
                    isAttendanceLocked
                      ? 'bg-white hover:bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {isAttendanceLocked ? 'Unlock Attendance (Admin)' : 'Re-lock Attendance'}
                </button>
              )}
            </div>
          )}

          {/* Attendance Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => checkAllPlayers(true)}
                    disabled={isAttendanceLocked}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                  >
                    Check In All
                  </button>
                  <button
                    type="button"
                    onClick={() => checkAllPlayers(false)}
                    disabled={isAttendanceLocked}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-amber-400 text-slate-700 hover:text-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
                  >
                    Set All as Optional
                  </button>
                  <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />
                </>
              )}

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    attendanceFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({singlesRoster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('checked')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    attendanceFilter === 'checked'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Checked In ({checkedInSinglesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilter('optional')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    attendanceFilter === 'optional'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Optional ({singlesRoster.filter(p => !p.checkedIn).length})
                </button>
                {removedListState.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('removed')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                      attendanceFilter === 'removed'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                    }`}
                    title="View players who quit or were removed from this league"
                  >
                    <span>Quit / Removed ({removedListState.length})</span>
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleAddPlayer} className="flex items-center gap-2">
                <select
                  value={newPlayerAvatar}
                  onChange={e => setNewPlayerAvatar(e.target.value)}
                  className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold outline-none"
                  title="Choose Avatar Icon (including Superman 🦸‍♂️)"
                >
                  {AVATAR_OPTIONS.map(a => (
                    <option key={a.icon} value={a.icon}>
                      {a.icon} {a.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="New Player Name..."
                  value={newPlayerName}
                  onChange={e => {
                    setNewPlayerName(e.target.value);
                    if (playerAddError) setPlayerAddError(null);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Player
                </button>
              </form>
          </div>

          {playerAddError && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{playerAddError}</span>
            </div>
          )}

          {/* Removed / Quitting Players View */}
          {attendanceFilter === 'removed' ? (
            <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                <div>
                  <h4 className="font-extrabold text-sm text-rose-900 flex items-center gap-2">
                    <UserMinus className="w-4 h-4 text-rose-600" />
                    Players Not Playing or Quit This League ({removedListState.length})
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    These players have been removed from {leagueType === 'tuesday' ? 'Tuesday Singles' : leagueType === 'wednesday' ? 'Wednesday Teams' : 'Thursday Doubles'} rosters and will not appear in match brackets.
                  </p>
                </div>
              </div>

              {removedListState.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  No players are currently marked as quit or removed from this league.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {removedListState.map(name => (
                    <div
                      key={name}
                      className="p-3 bg-white border border-rose-200 rounded-xl flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-lg shrink-0">🎯</span>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-slate-900 truncate block capitalize">
                            {name}
                          </span>
                          <span className="text-[10px] text-rose-600 font-semibold block">
                            Quit / Removed
                          </span>
                        </div>
                      </div>

                        <button
                          type="button"
                          onClick={() => handleRestorePlayer(name)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Re-admit player back to this league"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Re-Add</span>
                        </button>
                      </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Player Check-in Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {singlesRoster
                .filter(p => {
                  if (attendanceFilter === 'checked') return p.checkedIn;
                  if (attendanceFilter === 'optional') return !p.checkedIn;
                  return true;
                })
                .map(p => (
                <div
                  key={p.id}
                  onClick={() => togglePlayerCheckIn(p.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all select-none cursor-pointer ${
                    p.checkedIn
                      ? 'bg-indigo-50/80 border-2 border-indigo-600 text-slate-900 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-500 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
                    <button
                      type="button"
                      onClick={(e) => cyclePlayerAvatar(p.id, e)}
                      title="Click to cycle avatar icon (e.g. Superman 🦸‍♂️)"
                      className="text-xl shrink-0 hover:scale-125 transition-transform cursor-pointer p-0.5 rounded hover:bg-white/60"
                    >
                      {p.avatar || '🎯'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-xs text-slate-900 truncate block">
                        {p.name}
                      </span>
                      <span className={`text-[10px] font-semibold block ${p.checkedIn ? 'text-indigo-600 font-bold' : 'text-amber-600'}`}>
                        {p.checkedIn ? '✓ Checked In' : 'Optional (Tap to check in)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && p.checkedIn && (
                      (() => {
                        const k = p.name.toLowerCase().trim();
                        const ck = k.replace(/^[🤖🦸‍♂️🎯👑🔥\s]+/, '').trim();
                        const entry = nightlyBullsSession?.entries?.[k] || nightlyBullsSession?.entries?.[ck];
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGameBullsTargetPlayerName(p.name);
                              setShowGameBullsModal(true);
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-black tracking-tight border flex items-center gap-1 cursor-pointer transition-all ${
                              entry !== undefined
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                            }`}
                            title={entry !== undefined ? `Tonight: ${entry.bullsHit} Bulls. Click to edit.` : "Shoot tonight's 9-dart challenge"}
                          >
                            <Target className="w-3 h-3 text-rose-500" />
                            <span>{entry !== undefined ? `${entry.bullsHit} 🎯` : 'Bulls'}</span>
                          </button>
                        );
                      })()
                    )}

                    <button
                      type="button"
                      onClick={() => togglePlayerCheckIn(p.id)}
                      disabled={isAttendanceLocked}
                      className={`px-2 py-1 rounded-md border flex items-center justify-center font-bold text-xs transition-all ${
                        isAttendanceLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        p.checkedIn
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'border-slate-300 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600'
                      }`}
                      title={
                        isAttendanceLocked
                          ? 'Attendance is locked while matches are active tonight'
                          : p.checkedIn
                          ? 'Checked in for match'
                          : 'Optional - click to check in'
                      }
                    >
                      {p.checkedIn ? '✓' : '+'}
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayerToRemove(p);
                        }}
                        disabled={isAttendanceLocked}
                        className={`p-1.5 rounded transition-colors ${
                          isAttendanceLocked
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                        }`}
                        title={
                          isAttendanceLocked
                            ? 'Attendance locked'
                            : 'Remove player not playing or quitting this league'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Button: Generate Bracket Delegations */}
          <div className="pt-4 border-t border-slate-100">
            {isAdmin ? (
              <div className="space-y-3">
                {/* Standard Automatic Generation */}
                <button
                  type="button"
                  onClick={handleGenerateBrackets}
                  disabled={checkedInSinglesCount < 2}
                  className={`w-full py-4 disabled:opacity-40 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer ${
                    isBracketActive
                      ? 'bg-amber-700 hover:bg-amber-800'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-5 h-5 text-amber-400 fill-current animate-bounce" />
                  {isBracketActive ? (
                    <span>
                      ⚠️ Overwrite Active Matches & Regenerate Brackets ({checkedInSinglesCount} Players)
                    </span>
                  ) : leagueType === 'wednesday' ? (
                    `Submit Attendance & Generate Even Teams (${checkedInSinglesCount} Players Checked In, 0 Byes)`
                  ) : leagueType === 'thursday' ? (
                    `Submit Attendance & Generate Doubles Round Robin (${checkedInSinglesCount} Players)`
                  ) : (
                    `Submit Attendance & Generate Singles Bracket (${checkedInSinglesCount} Players)`
                  )}
                </button>

                {/* Admin-Only Manual Selection Option */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-linear-to-r from-indigo-50/90 via-purple-50/40 to-indigo-50/90 border border-indigo-200/80 rounded-xl shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs shrink-0">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">Manual Team & Division Selection</span>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-extrabold text-[10px] uppercase tracking-wider rounded-md">
                          Admin Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Prefer custom lineups? Manually organize players into custom teams, doubles pairs, boards, or divisions.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualSelectModal(true)}
                    className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-lg border border-indigo-300 shadow-xs hover:border-indigo-400 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-98"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Manually Select Teams & Divisions</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-extrabold block">Admin-Only Team & Bracket Delegation</span>
                    <span className="text-amber-700">Team delegation and bracket generation are configured by the League Admin at the start of the night.</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-200/80 text-amber-900 text-[10px] font-black uppercase tracking-wider rounded-md shrink-0">
                  Admin Only
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AVAILABLE MATCHES & DELEGATED BRACKETS VIEW (Default for Player Profile) */}
      {(!isAdmin || activeSubTab === 'brackets') && (
        brackets ? (
          (() => {
            const effectiveDivisions = getEffectiveDivisions(brackets);
            return (
              <div className="space-y-8">
                <div className="flex items-center justify-between bg-indigo-50/60 p-4 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">
                        {isAdmin ? 'Official Delegated League Brackets' : "Tonight's Available Matches"}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {leagueType === 'wednesday'
                          ? `Even Teams Head-to-Head • Players only play this match tonight (No Round Robin)`
                          : leagueType === 'thursday'
                          ? brackets.isMultiDivision
                            ? `Divided into ${effectiveDivisions.length} Equal Divisions (${thursdayOddOption === 'trio' ? '👥 Odd Players in 3-Person Trios' : '🤖 Odd Players Paired with Dummy'}) • Round robin within assigned division`
                            : `Single Open Division (${thursdayOddOption === 'trio' ? '👥 Odd Players in 3-Person Trios' : '🤖 Odd Players Paired with Dummy'}) • Round robin within assigned division`
                          : brackets.isMultiDivision
                          ? `Divided into ${effectiveDivisions.length} Divisions (Max 4 players per division • Max 4 matches per night)`
                          : `Single Open Division Bracket (4 or fewer players • Max 4 matches per night)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && (
                      <button
                        type="button"
                        onClick={() => {
                          setGameBullsTargetPlayerName(undefined);
                          setShowGameBullsModal(true);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      >
                        <Target className="w-3.5 h-3.5 text-amber-200" />
                        <span>Nightly Game Bulls</span>
                        <span className="px-1.5 py-0.2 bg-black/25 rounded text-[10px] font-mono">
                          {nightlyBullsCompletedCount}/{checkedInSinglesCount || singlesRoster.length}
                        </span>
                      </button>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowManualSelectModal(true)}
                          className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold text-xs rounded-lg border border-indigo-300 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          title="Manually customize teams, partner pairings, boards, or division assignments"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Manual Teams & Divisions</span>
                        </button>
                        <button
                          type="button"
                          id="end-of-night-clear-btn"
                          onClick={handleClearNightMatches}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                          title="Night is over: Clear all matches while keeping all player stats, averages, legs, and attendance records"
                        >
                          <Moon className="w-3.5 h-3.5 text-amber-300" />
                          <span>End of Night (Clear Matches)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('attendance')}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                        >
                          Edit Attendance & Regenerate
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thursday Doubles: Quick Switcher for Odd Player Option */}
                {leagueType === 'thursday' && isAdmin && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-linear-to-r from-amber-50 to-indigo-50/50 rounded-xl border border-amber-200/80 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-sm shrink-0">
                        {thursdayOddOption === 'trio' ? '👥' : '🤖'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-slate-900">Thursday Odd Player Rule:</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                            {thursdayOddOption === 'trio' ? '3-Person Trio (Rotating Turn)' : 'Dummy Partner (Rotating Throw)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Applies identically to every division with an odd number of players tonight. Tap to switch rule:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateThursdayBracketsWithOption('trio')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          thursdayOddOption === 'trio'
                            ? 'bg-indigo-600 text-white shadow-xs scale-102'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>👥</span>
                        <span>Add to Team (Trio)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => generateThursdayBracketsWithOption('dummy')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          thursdayOddOption === 'dummy'
                            ? 'bg-amber-600 text-white shadow-xs scale-102'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>🤖</span>
                        <span>Play with Dummy</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* DIVISION ROSTER DIRECTORY: In Tuesday and Thursday Leagues only, when there are multiple divisions */}
                {(leagueType === 'tuesday' || leagueType === 'thursday') && effectiveDivisions.length > 1 && (
                  <DivisionRosterDirectory
                    leagueType={leagueType}
                    divisions={effectiveDivisions}
                  />
                )}

                {/* DYNAMICALLY RENDER ALL DIVISIONS */}
                {effectiveDivisions.map((div) => (
                  <React.Fragment key={`div-section-${div.name}`}>
                    {renderDivisionMatchups(
                      div.name,
                      div.subtitle,
                      div.matchups,
                      div.theme
                    )}
                  </React.Fragment>
                ))}
              </div>
            );
          })()
        ) : (
        <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 space-y-2">
          <Trophy className="w-10 h-10 text-indigo-400 mx-auto opacity-70" />
          <h3 className="text-base font-extrabold text-slate-800">
            {leagueType === 'tuesday' && "Tonight's Tuesday Singles Matches"}
            {leagueType === 'wednesday' && "Tonight's Wednesday Team Matches"}
            {leagueType === 'thursday' && "Tonight's Thursday Doubles Round Robin Matches"}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isAdmin
              ? "No matches have been generated yet. Switch to the Attendance Roster tab to check in players and generate tonight's matchups."
              : "No matches have been posted for this evening yet. Available matches will appear here as soon as the league administrator finalizes tonight's attendance and generates the matchups."}
          </p>
          {isAdmin && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('attendance')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Open Attendance Roster
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Remove / Delete Confirmation Modal */}
      {playerToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                  <span>{playerToRemove.avatar || '🎯'}</span>
                  <span>Remove {playerToRemove.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  League: {leagueType === 'tuesday' ? 'Tuesday Singles' : leagueType === 'wednesday' ? 'Wednesday Teams' : 'Thursday Doubles'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              How would you like to remove <strong>{playerToRemove.name}</strong>?
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Remove from this league only */}
              <button
                type="button"
                onClick={() => handleRemoveFromThisLeague(playerToRemove)}
                className="w-full p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-amber-950">
                    Remove from {leagueType === 'tuesday' ? 'Tuesday' : leagueType === 'wednesday' ? 'Wednesday' : 'Thursday'} Only
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-amber-900/80 mt-1">
                  Player is quitting or not playing this league. Keeps their Master Profile and career stats in other leagues completely safe.
                </p>
              </button>

              {/* Option 2: Permanent deletion */}
              <button
                type="button"
                onClick={() => handlePermanentDelete(playerToRemove)}
                className="w-full p-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-rose-950">
                    Permanently Delete Everywhere
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-200/70 px-2 py-0.5 rounded">
                    All Leagues
                  </span>
                </div>
                <p className="text-[11px] text-rose-900/80 mt-1">
                  Completely wipes player profile, attendance, standings, and history across all 3 leagues.
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPlayerToRemove(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* THURSDAY DOUBLES: ODD PERSON STRATEGY MODAL */}
      {showThursdayOddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-5 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xl shrink-0">
                🎯
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Thursday Doubles • Odd Player Handling
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  An odd number of players was detected across the equal divisions.
                </p>
              </div>
            </div>

            {/* Division Breakdown */}
            {(() => {
              const activeCount = singlesRoster.filter(p => p.checkedIn).length;
              const divInfo = calculateThursdayDivisions(activeCount, thursdayDivCount);
              return (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Division Breakdown ({divInfo.numDivisions} {divInfo.numDivisions === 1 ? 'Division' : 'Divisions'} • {activeCount} Checked In)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {divInfo.sizes.map((sz, idx) => (
                      <span
                        key={`modal-div-sz-${idx}`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                          sz % 2 !== 0
                            ? 'bg-amber-100/80 border-amber-300 text-amber-950'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <span>Division {String.fromCharCode(65 + idx)}:</span>
                        <span className="font-black">{sz} players</span>
                        {sz % 2 !== 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-200 text-[10px] uppercase font-black tracking-wide">
                            Odd Player
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <p className="text-xs text-slate-600 leading-relaxed">
              How would you like to handle the odd player? Whichever option is chosen will apply consistently to every division with an odd player tonight:
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Add to Doubles Team (3-Person Trio) */}
              <button
                type="button"
                onClick={() => generateThursdayBracketsWithOption('trio')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer group flex flex-col gap-2 ${
                  thursdayOddOption === 'trio'
                    ? 'bg-indigo-50/70 border-indigo-300 shadow-sm ring-2 ring-indigo-500/20'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👥</span>
                    <span className="font-extrabold text-xs text-slate-900">
                      Add Player to a Doubles Team (3-Person Trio)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    3-Person Team
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  The odd player joins one of the doubles teams in each division to form a 3-person team. Teammates rotate shooting order every turn. Individual stats and averages are tracked.
                </p>
                <div className="pt-1 flex justify-end">
                  <span className="px-3 py-1 bg-indigo-600 group-hover:bg-indigo-700 text-white font-black text-xs rounded-lg shadow-xs transition-colors">
                    Generate with 👥 Trio Team →
                  </span>
                </div>
              </button>

              {/* Option 2: Have Player Play with Dummy */}
              <button
                type="button"
                onClick={() => generateThursdayBracketsWithOption('dummy')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer group flex flex-col gap-2 ${
                  thursdayOddOption === 'dummy'
                    ? 'bg-amber-50/70 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <span className="font-extrabold text-xs text-slate-900">
                      Have Player Play with Dummy (Dummy Partner)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Dummy Partner
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  The odd player is paired with 🤖 Dummy Player. The player throws the dummy's turn according to league rules (max 100 on X01).
                </p>
                <div className="pt-1 flex justify-end">
                  <span className="px-3 py-1 bg-amber-600 group-hover:bg-amber-700 text-white font-black text-xs rounded-lg shadow-xs transition-colors">
                    Generate with 🤖 Dummy Partner →
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowThursdayOddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Cancel / Return to Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NIGHTLY GAME BULLS INDIVIDUAL CHALLENGE MODAL (Tuesday, Wednesday & Thursday) */}
      {(leagueType === 'tuesday' || leagueType === 'wednesday' || leagueType === 'thursday') && showGameBullsModal && (
        <NightlyGameBullsModal
          isOpen={showGameBullsModal}
          onClose={() => setShowGameBullsModal(false)}
          leagueType={leagueType}
          registeredPlayers={singlesRoster}
          initialPlayerName={gameBullsTargetPlayerName}
          onRecordUpdated={() => setNightlyBullsSessionTick((t) => t + 1)}
        />
      )}

      {/* MANUAL TEAM & DIVISION SELECTION MODAL (Admin Only) */}
      {isAdmin && showManualSelectModal && (
        <ManualTeamDivisionModal
          isOpen={showManualSelectModal}
          onClose={() => setShowManualSelectModal(false)}
          leagueType={leagueType}
          singlesRoster={singlesRoster}
          onApplyBrackets={handleApplyManualBrackets}
          isAdmin={isAdmin}
        />
      )}

      {/* ADMIN EMAIL RESEND / REPORT MODAL */}
      {showEmailModal && emailModalMatchState && (
        <MatchReportEmailModal
          matchState={emailModalMatchState}
          isOpen={showEmailModal}
          onClose={() => {
            setShowEmailModal(false);
            setEmailModalMatchState(null);
          }}
          onDispatched={() => {
            setEmailRefreshTick((t) => t + 1);
          }}
        />
      )}

      {/* END OF NIGHT CLEAR MATCHES CONFIRMATION MODAL */}
      {showClearNightModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">End of Night: Clear Matches</h3>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  {leagueType === 'tuesday' ? 'Tuesday Singles' : leagueType === 'wednesday' ? 'Wednesday Teams' : 'Thursday Doubles'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to clear tonight's match brackets and live matches?
              <br /><br />
              <strong className="text-emerald-700">✓ Completely Preserved:</strong> All player stats, 3-dart averages, MPR, legs won, season bull counts, and attendance records remain completely intact.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearNightModal(false)}
                disabled={isClearingNight}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearNightMatches}
                disabled={isClearingNight}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Moon className="w-4 h-4 text-amber-300" />
                <span>{isClearingNight ? 'Clearing Matches...' : 'Yes, Clear Tonight\'s Matches'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
