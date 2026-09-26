import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutGrid,
  Search,
  Trophy,
  Play,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Zap,
  Users,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Filter,
  Trash2,
} from 'lucide-react';
import {
  BracketMatchup,
  LeagueBracketsState,
  MatchSettings,
  Player,
  DEFAULT_MEDLEY_CONFIGS,
  WEDNESDAY_MEDLEY_CONFIGS,
} from '../types';
import {
  subscribeToLeagueBrackets,
  clearNightMatchesFromCloud,
  deleteSingleMatchupFromCloud,
  syncLeagueBracketsToCloud,
} from '../services/cloudSync';
import { useAuth } from '../context/AuthContext';

interface BoardAssignmentsViewProps {
  onLaunchLeagueMatch: (
    settings: MatchSettings,
    playersList: Player[],
    leagueType: 'tuesday' | 'wednesday' | 'thursday',
    existingMatchState?: any
  ) => void;
  onNavigateToLeague?: () => void;
}

export const BoardAssignmentsView: React.FC<BoardAssignmentsViewProps> = ({
  onLaunchLeagueMatch,
  onNavigateToLeague,
}) => {
  const { isAdmin } = useAuth();

  const [selectedLeague, setSelectedLeague] = useState<'tuesday' | 'wednesday' | 'thursday'>('tuesday');
  const [activeBracket, setActiveBracket] = useState<LeagueBracketsState | null>(null);
  const [searchPlayer, setSearchPlayer] = useState<string>('');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Auto-detect which league has active brackets on mount
  useEffect(() => {
    const leagues: ('tuesday' | 'wednesday' | 'thursday')[] = ['tuesday', 'wednesday', 'thursday'];
    for (const l of leagues) {
      try {
        const saved = localStorage.getItem(`kaboom_brackets_${l}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const hasMatches =
            (Array.isArray(parsed?.divisions) && parsed.divisions.some((d: any) => d?.matchups?.length > 0)) ||
            (Array.isArray(parsed?.divisionA) && parsed.divisionA.length > 0);
          if (hasMatches) {
            setSelectedLeague(l);
            setActiveBracket(parsed);
            break;
          }
        }
      } catch (e) {}
    }
  }, []);

  // Subscribe to brackets for selected league
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`kaboom_brackets_${selectedLeague}`);
      if (saved) {
        setActiveBracket(JSON.parse(saved));
      } else {
        setActiveBracket(null);
      }
    } catch (e) {
      setActiveBracket(null);
    }

    fetchBracketData(selectedLeague);

    const unsub = subscribeToLeagueBrackets(selectedLeague, (cloudBrackets) => {
      if (cloudBrackets) {
        setActiveBracket(cloudBrackets);
        try {
          localStorage.setItem(`kaboom_brackets_${selectedLeague}`, JSON.stringify(cloudBrackets));
        } catch (e) {}
      } else if (cloudBrackets === null) {
        setActiveBracket(null);
        try {
          localStorage.removeItem(`kaboom_brackets_${selectedLeague}`);
        } catch (e) {}
      }
    });

    const handleNightCleared = (e: any) => {
      const lType = e.detail?.leagueType;
      if (!lType || lType === 'all' || lType === selectedLeague) {
        setActiveBracket(null);
        try {
          localStorage.removeItem(`kaboom_brackets_${selectedLeague}`);
        } catch (e) {}
      }
    };
    window.addEventListener('kaboom_night_matches_cleared', handleNightCleared);

    const handleSyncUpdate = (e: any) => {
      const key = e?.detail?.key;
      const data = e?.detail?.data;
      if (key === `kaboom_brackets_${selectedLeague}`) {
        if (data) {
          setActiveBracket(data);
        } else if (data === null) {
          setActiveBracket(null);
        }
      }
    };
    window.addEventListener('kaboom_cloud_sync_update', handleSyncUpdate);

    return () => {
      unsub();
      window.removeEventListener('kaboom_night_matches_cleared', handleNightCleared);
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncUpdate);
    };
  }, [selectedLeague]);

  const fetchBracketData = async (league: string) => {
    try {
      const res = await fetch(`/api/brackets/${league}`);
      if (res.ok) {
        const result = await res.json();
        if (result?.brackets && result.brackets !== null) {
          setActiveBracket(result.brackets);
          return;
        } else if (result?.data?.brackets && result.data.brackets !== null) {
          setActiveBracket(result.data.brackets);
          return;
        } else if (result?.brackets === null || result?.data?.brackets === null) {
          setActiveBracket(null);
          try {
            localStorage.removeItem(`kaboom_brackets_${league}`);
          } catch (e) {}
          return;
        }
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem(`kaboom_brackets_${league}`);
      if (saved) {
        setActiveBracket(JSON.parse(saved));
      } else {
        setActiveBracket(null);
      }
    } catch (e) {
      setActiveBracket(null);
    }
  };

  // Flatten and normalize all assigned matches for this league with board numbering
  interface AssignedBoardMatch {
    boardNumber: number;
    matchup: BracketMatchup;
    divisionName: string;
    roundName: string;
    isBye: boolean;
  }

  const assignedBoardMatches = useMemo<AssignedBoardMatch[]>(() => {
    if (!activeBracket) return [];

    const result: AssignedBoardMatch[] = [];
    let boardCounter = 1;

    if (selectedLeague === 'wednesday') {
      // Wednesday: head-to-head matches are boards 1, 2, 3...
      const wedMatchups: BracketMatchup[] = [];
      const seen = new Set<string>();

      const addMatch = (m: BracketMatchup) => {
        if (!m || !m.entryA || !m.entryB) return;
        const key = m.id || `${m.entryA.name}_vs_${m.entryB.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        wedMatchups.push(m);
      };

      if (Array.isArray(activeBracket.divisions) && activeBracket.divisions.length > 0) {
        activeBracket.divisions.forEach((d) => {
          if (Array.isArray(d?.matchups)) d.matchups.forEach(addMatch);
        });
      }
      const keys: (keyof LeagueBracketsState)[] = ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'];
      keys.forEach((k) => {
        const list = activeBracket[k] as BracketMatchup[] | undefined;
        if (Array.isArray(list)) list.forEach(addMatch);
      });

      wedMatchups.forEach((m, idx) => {
        const isBye = Boolean(m.isBye || m.entryA?.name?.includes('BYE') || m.entryB?.name?.includes('BYE'));
        result.push({
          boardNumber: idx + 1,
          matchup: m,
          divisionName: m.division || 'Wednesday Teams',
          roundName: m.round || `Board ${idx + 1} • Head-to-Head Match`,
          isBye,
        });
      });
      return result;
    }

    // Tuesday Singles & Thursday Doubles
    if (Array.isArray(activeBracket.divisions) && activeBracket.divisions.length > 0) {
      activeBracket.divisions.forEach((div) => {
        if (!div || !Array.isArray(div.matchups)) return;
        div.matchups.forEach((m) => {
          const isBye = Boolean(m.isBye || m.entryA?.name?.includes('BYE') || m.entryB?.name?.includes('BYE'));
          result.push({
            boardNumber: boardCounter++,
            matchup: m,
            divisionName: div.name || 'Division',
            roundName: m.round || 'Round Robin',
            isBye,
          });
        });
      });
    } else {
      const keys: { key: keyof LeagueBracketsState; name: string }[] = [
        { key: 'divisionA', name: 'Division A' },
        { key: 'divisionB', name: 'Division B' },
        { key: 'divisionC', name: 'Division C' },
        { key: 'divisionD', name: 'Division D' },
        { key: 'divisionE', name: 'Division E' },
        { key: 'divisionF', name: 'Division F' },
      ];
      keys.forEach(({ key, name }) => {
        const list = activeBracket[key] as BracketMatchup[] | undefined;
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((m) => {
            const isBye = Boolean(m.isBye || m.entryA?.name?.includes('BYE') || m.entryB?.name?.includes('BYE'));
            result.push({
              boardNumber: boardCounter++,
              matchup: m,
              divisionName: m.division || name,
              roundName: m.round || 'Round Robin',
              isBye,
            });
          });
        }
      });
    }

    return result;
  }, [activeBracket, selectedLeague]);

  // List of all unique player names participating in these board assignments
  const allParticipatingPlayers = useMemo<string[]>(() => {
    const set = new Set<string>();
    assignedBoardMatches.forEach((bm) => {
      const m = bm.matchup;
      if (m.entryA?.name && !m.entryA.name.includes('BYE')) {
        set.add(m.entryA.name);
      }
      if (Array.isArray(m.entryA?.players)) {
        m.entryA.players.forEach((p) => {
          if (p?.name && !p.name.includes('BYE') && !p.isDummy) set.add(p.name);
        });
      }
      if (m.entryB?.name && !m.entryB.name.includes('BYE')) {
        set.add(m.entryB.name);
      }
      if (Array.isArray(m.entryB?.players)) {
        m.entryB.players.forEach((p) => {
          if (p?.name && !p.name.includes('BYE') && !p.isDummy) set.add(p.name);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assignedBoardMatches]);

  // Matches filtered by search query
  const filteredMatches = useMemo(() => {
    if (!searchPlayer.trim()) return assignedBoardMatches;
    const q = searchPlayer.trim().toLowerCase();

    return assignedBoardMatches.filter((bm) => {
      const m = bm.matchup;
      const aName = (m.entryA?.name || '').toLowerCase();
      const bName = (m.entryB?.name || '').toLowerCase();
      const divName = bm.divisionName.toLowerCase();
      const roundName = bm.roundName.toLowerCase();
      const boardStr = `board ${bm.boardNumber}`;

      if (aName.includes(q) || bName.includes(q) || divName.includes(q) || roundName.includes(q) || boardStr.includes(q)) {
        return true;
      }

      const hasPlayerA = m.entryA?.players?.some((p) => p.name?.toLowerCase().includes(q));
      const hasPlayerB = m.entryB?.players?.some((p) => p.name?.toLowerCase().includes(q));
      return Boolean(hasPlayerA || hasPlayerB);
    });
  }, [assignedBoardMatches, searchPlayer]);

  // User's specific highlighted match when searching
  const searchedPlayerMatches = useMemo(() => {
    if (!searchPlayer.trim()) return [];
    const q = searchPlayer.trim().toLowerCase();

    return assignedBoardMatches.filter((bm) => {
      const m = bm.matchup;
      const aName = (m.entryA?.name || '').toLowerCase();
      const bName = (m.entryB?.name || '').toLowerCase();
      const hasPlayerA = m.entryA?.players?.some((p) => p.name?.toLowerCase().includes(q));
      const hasPlayerB = m.entryB?.players?.some((p) => p.name?.toLowerCase().includes(q));
      return aName.includes(q) || bName.includes(q) || hasPlayerA || hasPlayerB;
    });
  }, [assignedBoardMatches, searchPlayer]);

  // Admin Delete a single assigned matchup
  const handleDeleteMatchup = async (matchId: string) => {
    if (!matchId) return;
    try {
      const updated = await deleteSingleMatchupFromCloud(selectedLeague, matchId);
      if (updated) {
        setActiveBracket(updated);
      } else {
        setActiveBracket((prev) => {
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
          divKeys.forEach((k) => {
            if (Array.isArray(clone[k])) {
              clone[k] = clone[k].filter((m: any) => m.id !== matchId);
            }
          });
          return clone;
        });
      }
    } catch (e) {
      console.error('Failed to delete matchup from board assignments:', e);
    }
  };

  // Admin Reset Board Assignments
  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      await clearNightMatchesFromCloud(selectedLeague);
      setActiveBracket(null);
      try {
        localStorage.removeItem(`kaboom_brackets_${selectedLeague}`);
        localStorage.removeItem(`kaboom_brackets_${selectedLeague}_updated_at`);
        localStorage.removeItem('kaboom_active_match_state');
        localStorage.removeItem('kaboom_recent_matches');
      } catch (e) {}

      syncLeagueBracketsToCloud(selectedLeague, null);
      fetch(`/api/brackets/${selectedLeague}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType: selectedLeague, brackets: null }),
      }).catch(() => {});
      fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueType: selectedLeague, brackets: null }),
      }).catch(() => {});

      window.dispatchEvent(
        new CustomEvent('kaboom_night_matches_cleared', { detail: { leagueType: selectedLeague } })
      );
      window.dispatchEvent(
        new CustomEvent('kaboom_cloud_sync_update', {
          detail: { key: `kaboom_brackets_${selectedLeague}`, data: null },
        })
      );
    } catch (e) {
      console.error('Failed to reset board assignments:', e);
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  // Launch matchup into live Scorer
  const handleLaunchMatch = (m: BracketMatchup, boardNum: number) => {
    if (m.isBye || m.entryA?.name?.includes('BYE') || m.entryB?.name?.includes('BYE')) {
      return;
    }

    const matchCode = `${selectedLeague.toUpperCase().slice(0, 3)}-B${boardNum}`;
    const isWed = selectedLeague === 'wednesday';
    const isMedley = true;

    const startScore = isWed ? 1001 : 301;
    const inMode = isWed ? 'Straight' : 'Double';
    const outMode = 'Double';
    const legsToWin = isWed ? 6 : 3;
    const medleyConfigs = isWed ? WEDNESDAY_MEDLEY_CONFIGS : DEFAULT_MEDLEY_CONFIGS;

    const isEntryADummy = Boolean(
      m.entryA.players?.some((p) => p.isDummy) || m.entryA.name.toLowerCase().includes('dummy')
    );
    const isEntryBDummy = Boolean(
      m.entryB.players?.some((p) => p.isDummy) || m.entryB.name.toLowerCase().includes('dummy')
    );

    const playersList: Player[] = [
      {
        id: 'p1',
        name: m.entryA.name,
        avatar: m.entryA.players?.[0]?.avatar || (isEntryADummy ? '🤖' : '🎯'),
        isDummy: isEntryADummy,
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryA.players,
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
        avatar: m.entryB.players?.[0]?.avatar || (isEntryBDummy ? '🤖' : '🎯'),
        isDummy: isEntryBDummy,
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryB.players,
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

    const settings: MatchSettings = {
      gameMode: 'MEDLEY',
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
      isPublic: true,
      matchCode,
      starterPlayerId: 'p1',
      isMedley,
      medleyConfigs,
      leagueType: selectedLeague,
      bracketMatchId: m.id,
    };

    onLaunchLeagueMatch(settings, playersList, selectedLeague);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Banner & League Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <LayoutGrid className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Board Assignments
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Safe & Locked
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Find your assigned board number, opponent, and start time for tonight's league matches.
              </p>
            </div>
          </div>

          {/* Admin Reset Button */}
          {isAdmin && assignedBoardMatches.length > 0 && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Only League Admins can reset board assignments"
            >
              <RotateCcw className="w-4 h-4 text-rose-300" />
              <span>Reset Board Assignments</span>
            </button>
          )}
        </div>

        {/* League Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="inline-flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('tuesday');
                setSearchPlayer('');
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedLeague === 'tuesday'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tuesday Singles
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('wednesday');
                setSearchPlayer('');
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedLeague === 'wednesday'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Wednesday Teams
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedLeague('thursday');
                setSearchPlayer('');
              }}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                selectedLeague === 'thursday'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Thursday Doubles
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Assignments are safe & persistent unless reset by Admin.</span>
          </div>
        </div>
      </div>

      {/* "FIND MY BOARD" SEARCH BAR & QUICK SELECT */}
      {assignedBoardMatches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPlayer}
                onChange={(e) => setSearchPlayer(e.target.value)}
                placeholder="Find your board: Search player name or board number..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-inner"
              />
              {searchPlayer && (
                <button
                  type="button"
                  onClick={() => setSearchPlayer('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 px-1.5 py-0.5 bg-slate-200 rounded"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 shrink-0">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Showing {filteredMatches.length} of {assignedBoardMatches.length} Matches
              </span>
            </div>
          </div>

          {/* Quick Player Tap Chips */}
          {allParticipatingPlayers.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Tap your name to highlight your board:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {allParticipatingPlayers.map((pName) => {
                  const isSelected = searchPlayer.trim().toLowerCase() === pName.toLowerCase();
                  return (
                    <button
                      key={pName}
                      type="button"
                      onClick={() => setSearchPlayer(isSelected ? '' : pName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                          : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-200/80'
                      }`}
                    >
                      {pName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HIGHLIGHTED RESULT FOR SEARCHED PLAYER */}
      {searchPlayer.trim() && searchedPlayerMatches.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 border-2 border-indigo-500 rounded-2xl p-5 text-white shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                🎯
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                  Player Match Found
                </span>
                <h3 className="text-lg font-black text-white">
                  {searchPlayer.trim()}
                </h3>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-full shadow">
              {searchedPlayerMatches.length} Assigned {searchedPlayerMatches.length === 1 ? 'Match' : 'Matches'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {searchedPlayerMatches.map((bm) => (
              <div
                key={`searched-${bm.matchup.id}`}
                className="bg-slate-800/90 border border-indigo-400/40 rounded-xl p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-black rounded-md text-xs uppercase tracking-wider shadow-sm">
                    BOARD {bm.boardNumber}
                  </span>
                  <span className="font-bold text-slate-300 text-[11px]">
                    {bm.roundName}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 font-extrabold text-sm">
                  <span className="text-white truncate">{bm.matchup.entryA.name}</span>
                  <span className="text-amber-400 text-xs uppercase font-black">VS</span>
                  <span className="text-white truncate">{bm.matchup.entryB.name}</span>
                </div>

                {!bm.isBye && (
                  <button
                    type="button"
                    onClick={() => handleLaunchMatch(bm.matchup, bm.boardNumber)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Go to Board {bm.boardNumber} in Scorer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOARD ASSIGNMENTS DIRECTORY */}
      {filteredMatches.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>
                {selectedLeague === 'tuesday'
                  ? "Tuesday Singles Board Directory"
                  : selectedLeague === 'wednesday'
                  ? "Wednesday Teams Board Directory"
                  : "Thursday Doubles Board Directory"}
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-bold">
              {filteredMatches.length} Assigned Boards
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMatches.map((bm) => {
              const m = bm.matchup;
              const isCompleted = m.status === 'completed';
              const isInProgress = m.status === 'in_progress';

              return (
                <div
                  key={`board-${bm.boardNumber}-${m.id}`}
                  className={`rounded-2xl border transition-all p-4.5 space-y-3 relative ${
                    isInProgress
                      ? 'bg-amber-50/70 border-2 border-amber-400 shadow-md ring-2 ring-amber-400/20'
                      : isCompleted
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-white border-slate-200 shadow-xs hover:border-indigo-300'
                  }`}
                >
                  {/* Board Number Badge & Status */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-lg uppercase tracking-wider shadow-xs">
                        BOARD {bm.boardNumber}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[150px]">
                        {bm.divisionName}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMatchup(m.id)}
                          className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors ml-1"
                          title="Delete this match from board assignments"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    {isCompleted ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                      </span>
                    ) : isInProgress ? (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black uppercase rounded animate-pulse flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-current" /> Playing Now
                      </span>
                    ) : bm.isBye ? (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded">
                        BYE Round
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded">
                        Ready
                      </span>
                    )}
                  </div>

                  {/* Round description */}
                  <div className="text-[11px] font-semibold text-slate-500">
                    {bm.roundName}
                  </div>

                  {/* Competitor Matchup Box */}
                  <div className="space-y-2">
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        m.winnerName === m.entryA.name
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{m.entryA.players?.[0]?.avatar || '🎯'}</span>
                        <span className="truncate">{m.entryA.name}</span>
                      </div>
                      <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {typeof m.scoreA === 'number' ? m.scoreA : 0}
                      </span>
                    </div>

                    <div className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      VS
                    </div>

                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        m.winnerName === m.entryB.name
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base">{m.entryB.players?.[0]?.avatar || '🎯'}</span>
                        <span className="truncate">{m.entryB.name}</span>
                      </div>
                      <span className="font-mono text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                        {typeof m.scoreB === 'number' ? m.scoreB : 0}
                      </span>
                    </div>
                  </div>

                  {/* Launch / Play Action */}
                  <div className="pt-2 border-t border-slate-100">
                    {bm.isBye ? (
                      <div className="w-full py-2 text-center text-xs font-bold text-slate-500 bg-slate-100 rounded-lg">
                        Sitting Out (Bye)
                      </div>
                    ) : isCompleted ? (
                      <div className="w-full py-2 text-center text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Winner: <strong>{m.winnerName || 'Finalized'}</strong></span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLaunchMatch(m, bm.boardNumber)}
                        className={`w-full py-2.5 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 ${
                          isInProgress
                            ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isInProgress ? 'Resume Game on Board ' + bm.boardNumber : 'Play on Board ' + bm.boardNumber}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State: No Board Assignments Generated Yet */
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-inner">
            <LayoutGrid className="w-8 h-8 text-indigo-500" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-black text-slate-900">
              No Board Assignments Generated for {selectedLeague.toUpperCase()}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Board assignments will safely lock in here as soon as the League Administrator finalizes tonight's attendance and generates the matchups.
            </p>
          </div>

          {isAdmin ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToLeague}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer active:scale-98 inline-flex items-center gap-2"
              >
                <span>Go to League Roster & Generate Matches</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Please check back once the start-of-night announcements begin!</span>
            </div>
          )}
        </div>
      )}

      {/* ADMIN-ONLY RESET BOARD ASSIGNMENTS CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Reset Board Assignments
                </h3>
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                  {selectedLeague === 'tuesday'
                    ? 'Tuesday Singles'
                    : selectedLeague === 'wednesday'
                    ? 'Wednesday Teams'
                    : 'Thursday Doubles'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reset and clear tonight's board assignments for this league?
              <br /><br />
              <strong className="text-emerald-700">✓ Fully Preserved:</strong> All player career averages, 180s, high checkouts, nightly bull scores, and attendance lists remain safe and untouched.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4 text-rose-200" />
                <span>{isResetting ? 'Resetting...' : 'Yes, Reset Board Assignments'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
