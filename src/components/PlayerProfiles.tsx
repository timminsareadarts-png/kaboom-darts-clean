import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  AlertCircle,
  Cloud,
  ShieldAlert,
  Trophy,
  Play,
  Zap,
  CheckCircle2,
  Calendar,
  History,
  X,
  RefreshCw,
} from 'lucide-react';
import { syncPlayerRosterToCloud, subscribeToPlayerRoster, subscribeToLeagueBrackets } from '../services/cloudSync';
import { deletePlayerPermanently, calculateAutomatedLeaderboard } from '../utils/leagueHelper';
import { useAuth } from '../context/AuthContext';
import { MASTER_ROSTER_PLAYERS, PlayerRosterItem } from '../data/defaultPlayers';
import { MatchSettings, Player, DEFAULT_MEDLEY_CONFIGS, WEDNESDAY_MEDLEY_CONFIGS } from '../types';
import { AdminSeasonResetButton } from './SeasonResetModal';
import {
  reconcilePlayerRunningTotals,
  getPlayerMatchHistory,
  syncRunningTotalsToDatabase,
  CompletedMatchRecord,
} from '../services/playerStatsService';

type PlayerProfile = PlayerRosterItem;

const DEFAULT_PLAYERS: PlayerProfile[] = MASTER_ROSTER_PLAYERS;

export interface AvatarOption {
  icon: string;
  label: string;
}

export interface TonightMatchItem {
  id: string;
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  leagueName: string;
  division: string;
  round: string;
  entryA: { id: string; name: string; players: { id: string; name: string; avatar: string }[] };
  entryB: { id: string; name: string; players: { id: string; name: string; avatar: string }[] };
  status: 'pending' | 'in_progress' | 'completed';
  isCompleted?: boolean;
  winnerName?: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { icon: '🦸‍♂️', label: 'Superman' },
  { icon: '🎯', label: 'Dartboard' },
  { icon: '⚡', label: 'Lightning' },
  { icon: '👑', label: 'Crown' },
  { icon: '🔥', label: 'Fire' },
  { icon: '🦁', label: 'Lion' },
  { icon: '🦅', label: 'Eagle' },
  { icon: '🚀', label: 'Rocket' },
  { icon: '💣', label: 'Bomb' },
  { icon: '🍺', label: 'Pint' },
  { icon: '🟢', label: 'Green Machine' },
  { icon: '🥊', label: 'Boxing Glove' },
  { icon: '🛡️', label: 'Shield' },
  { icon: '⚔️', label: 'Swords' },
  { icon: '🏆', label: 'Trophy' },
  { icon: '🐺', label: 'Wolf' },
  { icon: '🐉', label: 'Dragon' },
  { icon: '💎', label: 'Diamond' },
  { icon: '🦸‍♀️', label: 'Superwoman' },
];

export interface PlayerProfilesProps {
  onLaunchLeagueMatch?: (
    settings: MatchSettings,
    playersList: Player[],
    leagueType: 'tuesday' | 'wednesday' | 'thursday'
  ) => void;
  onNavigateToLeague?: (leagueType?: 'tuesday' | 'wednesday' | 'thursday') => void;
}

const loadTonightMatches = (): TonightMatchItem[] => {
  const list: TonightMatchItem[] = [];
  const days: { key: 'tuesday' | 'wednesday' | 'thursday'; label: string }[] = [
    { key: 'tuesday', label: 'Tuesday Singles' },
    { key: 'wednesday', label: 'Wednesday Teams' },
    { key: 'thursday', label: 'Thursday Doubles' },
  ];

  days.forEach(({ key, label }) => {
    try {
      const saved = localStorage.getItem(`kaboom_brackets_${key}`);
      if (saved) {
        const brk = JSON.parse(saved);
        const matches: any[] = [];
        const seenMIds = new Set<string>();
        const addMatch = (m: any) => {
          if (!m || !m.entryA || !m.entryB || m.entryB.name?.includes('BYE')) return;
          const mKey = m.id || `${m.entryA?.name}_vs_${m.entryB?.name}_${m.round}`;
          if (seenMIds.has(mKey)) return;
          seenMIds.add(mKey);
          matches.push(m);
        };

        if (Array.isArray(brk?.divisions) && brk.divisions.length > 0) {
          brk.divisions.forEach((d: any) => {
            if (Array.isArray(d.matchups)) d.matchups.forEach(addMatch);
          });
        }
        ['divisionA', 'divisionB', 'divisionC', 'divisionD', 'divisionE', 'divisionF'].forEach((divKey) => {
          if (Array.isArray(brk?.[divKey])) brk[divKey].forEach(addMatch);
        });
        matches.forEach((m, mIdx) => {
          if (m && m.entryA && m.entryB && !m.entryB.name?.includes('BYE')) {
            const uniqueId = m.id ? (m.id.startsWith(key) ? m.id : `${key}-${m.id}`) : `${key}-${mIdx}`;
            const isDone = m.status === 'completed' || m.isCompleted === true;
            list.push({
              id: uniqueId,
              leagueType: key,
              leagueName: label,
              division: m.division || (key === 'wednesday' ? 'Wednesday Teams' : 'Division A'),
              round: m.round || 'Round 1',
              entryA: m.entryA,
              entryB: m.entryB,
              status: isDone ? 'completed' : (m.status || 'pending'),
              isCompleted: isDone,
              winnerName: m.winnerName,
            });
          }
        });
      }
    } catch (e) {}
  });

  // Guarantee uniqueness across all league matches
  const seenIds = new Set<string>();
  const uniqueList: TonightMatchItem[] = [];
  list.forEach((item) => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueList.push(item);
    }
  });

  return uniqueList;
};

const enrichPlayersWithLeagueStats = (baseList: PlayerProfile[]): PlayerProfile[] => {
  try {
    return reconcilePlayerRunningTotals(baseList);
  } catch (e) {
    return baseList;
  }
};

export const PlayerProfiles: React.FC<PlayerProfilesProps> = ({
  onLaunchLeagueMatch,
  onNavigateToLeague,
}) => {
  const { role, isAdmin, canDelete } = useAuth();
  const [players, setPlayers] = useState<PlayerProfile[]>(() => {
    try {
      const saved = localStorage.getItem('kaboom_dart_players');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return enrichPlayersWithLeagueStats(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load players from localStorage', e);
    }
    return enrichPlayersWithLeagueStats(DEFAULT_PLAYERS);
  });

  const [tonightMatches, setTonightMatches] = useState<TonightMatchItem[]>(() => loadTonightMatches());
  const [newName, setNewName] = useState<string>('');
  const [newAvatar, setNewAvatar] = useState<string>('🦸‍♂️');
  const [nameError, setNameError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAvatarId, setEditingAvatarId] = useState<string | null>(null);
  const [selectedPlayerForHistory, setSelectedPlayerForHistory] = useState<PlayerProfile | null>(null);
  const [isSyncingTotals, setIsSyncingTotals] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState(false);

  const handleSyncRunningTotals = async () => {
    setIsSyncingTotals(true);
    try {
      const ok = await syncRunningTotalsToDatabase();
      if (ok) {
        setSyncSuccessToast(true);
        setTimeout(() => setSyncSuccessToast(false), 3000);
        const refreshed = reconcilePlayerRunningTotals();
        setPlayers(refreshed);
      }
    } finally {
      setIsSyncingTotals(false);
    }
  };

  const isReceivingFromCloud = useRef(false);
  const isMounted = useRef(false);

  // Realtime cloud listener for roster sync and tonight's bracket matches
  useEffect(() => {
    const handleSyncEvent = () => {
      try {
        const saved = localStorage.getItem('kaboom_dart_players');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlayers(enrichPlayersWithLeagueStats(parsed));
          }
        }
      } catch (e) {}
      setTonightMatches(loadTonightMatches());
    };
    window.addEventListener('kaboom_cloud_sync_update', handleSyncEvent);
    window.addEventListener('kaboom_season_stats_reset', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    const unsubscribeRoster = subscribeToPlayerRoster((cloudPlayers) => {
      if (cloudPlayers && Array.isArray(cloudPlayers)) {
        if (cloudPlayers.length > 0) {
          isReceivingFromCloud.current = true;
          const enriched = enrichPlayersWithLeagueStats(cloudPlayers as unknown as PlayerProfile[]);
          setPlayers(enriched);
          localStorage.setItem('kaboom_dart_players', JSON.stringify(enriched));
        } else {
          const saved = localStorage.getItem('kaboom_dart_players');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                syncPlayerRosterToCloud(parsed);
              }
            } catch (e) {}
          }
        }
      }
    });

    // Also subscribe to bracket matches for all 3 leagues so tonight's matches are always fresh
    const unsubs: (() => void)[] = [];
    const leagues: ('tuesday' | 'wednesday' | 'thursday')[] = ['tuesday', 'wednesday', 'thursday'];
    leagues.forEach((lKey) => {
      // Fetch REST backup
      fetch(`/api/brackets/${lKey}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && (data.divisions?.length > 0 || data.divisionA?.length > 0)) {
            localStorage.setItem(`kaboom_brackets_${lKey}`, JSON.stringify(data));
            setTonightMatches(loadTonightMatches());
          }
        })
        .catch(() => {});

      const unsub = subscribeToLeagueBrackets(lKey, (bData) => {
        if (bData) {
          localStorage.setItem(`kaboom_brackets_${lKey}`, JSON.stringify(bData));
          setTonightMatches(loadTonightMatches());
        }
      });
      unsubs.push(unsub);
    });

    return () => {
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncEvent);
      window.removeEventListener('kaboom_season_stats_reset', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
      unsubscribeRoster();
      unsubs.forEach((u) => u());
    };
  }, []);

  const handleLaunchTonightMatch = (m: TonightMatchItem) => {
    if (!onLaunchLeagueMatch) {
      if (onNavigateToLeague) onNavigateToLeague(m.leagueType);
      return;
    }

    const isWednesday = m.leagueType === 'wednesday';
    const startScore = isWednesday ? 1001 : 301;
    const inMode = isWednesday ? 'Straight' : 'Double';
    const outMode = isWednesday ? 'Straight' : 'Double';
    const legsToWin = isWednesday ? 6 : 3;

    const rawMatchId = m.id.startsWith(`${m.leagueType}-`)
      ? m.id.slice(`${m.leagueType}-`.length)
      : m.id;

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
      isPublic: false, // Any league matches will not be live only local
      matchCode: `MATCH-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      starterPlayerId: m.entryA.players?.[0]?.id || 'p1',
      isMedley: true,
      medleyConfigs: isWednesday ? WEDNESDAY_MEDLEY_CONFIGS : DEFAULT_MEDLEY_CONFIGS,
      leagueType: m.leagueType,
      bracketMatchId: rawMatchId,
    };

    const playersList: Player[] = [
      {
        id: 'p1',
        name: m.entryA.name,
        avatar: m.entryA.players?.[0]?.avatar || '🎯',
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryA.players || [{ id: 'p1', name: m.entryA.name, avatar: '🎯' }],
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
        avatar: m.entryB.players?.[0]?.avatar || '🎯',
        currentScore: startScore,
        legsWon: 0,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryB.players || [{ id: 'p2', name: m.entryB.name, avatar: '🎯' }],
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

    onLaunchLeagueMatch(settings, playersList, m.leagueType);
  };

  useEffect(() => {
    try {
      if (players && players.length > 0) {
        localStorage.setItem('kaboom_dart_players', JSON.stringify(players));
      }
      if (!isMounted.current) {
        isMounted.current = true;
        // On mount, ensure cloud has the current roster
        if (players && players.length > 0) {
          syncPlayerRosterToCloud(players as unknown as any);
        }
        return;
      }
      if (isReceivingFromCloud.current) {
        isReceivingFromCloud.current = false;
        return;
      }
      if (players && players.length > 0) {
        syncPlayerRosterToCloud(players as unknown as any);
      }
    } catch (e) {
      console.error('Failed to save players to localStorage', e);
    }
  }, [players]);

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Check for duplicate player names (case-insensitive)
    const exists = players.some(
      (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (exists) {
      setNameError(`Player already exists! "${trimmed}" is already registered in the player roster.`);
      return;
    }

    setNameError(null);

    const newPlayer: PlayerProfile = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      avatar: newAvatar || '🦸‍♂️',
      matchesPlayed: 0,
      matchesWon: 0,
      careerAvg: 0,
      highCheckout: 0,
      total180s: 0,
    };

    const updated = [...players, newPlayer];
    setPlayers(updated);
    try {
      localStorage.setItem('kaboom_dart_players', JSON.stringify(updated));
      syncPlayerRosterToCloud(updated as unknown as any);
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players', data: updated } }));
    } catch (e) {}

    setNewName('');
  };

  const handleUpdateAvatar = (playerId: string, avatar: string) => {
    const updated = players.map((p) => (p.id === playerId ? { ...p, avatar } : p));
    setPlayers(updated);
    try {
      localStorage.setItem('kaboom_dart_players', JSON.stringify(updated));
      syncPlayerRosterToCloud(updated as unknown as any);
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players', data: updated } }));
    } catch (e) {}
    setEditingAvatarId(null);
  };

  const handleDeletePlayer = (id: string, name?: string) => {
    if (!canDelete) {
      alert('Only administrators can remove player profiles.');
      return;
    }
    deletePlayerPermanently({ id, name });
    const updated = players.filter((p) => p.id !== id);
    setPlayers(updated);
    try {
      localStorage.setItem('kaboom_dart_players', JSON.stringify(updated));
      syncPlayerRosterToCloud(updated as unknown as any);
      window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_dart_players', data: updated } }));
    } catch (e) {}
    if (deletingId === id) {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Player Profiles & Career Roster</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Manage local player profiles, pick player icons (including Superman 🦸‍♂️), track career averages, win rates, and 180 counts.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncRunningTotals}
            disabled={isSyncingTotals}
            className="px-3 py-2 bg-indigo-700/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-500/40"
            title="Force immutable reconcile and push running totals to cloud database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTotals ? 'animate-spin' : ''}`} />
            <span>{isSyncingTotals ? 'Syncing...' : syncSuccessToast ? 'Totals Synced ✓' : 'Sync Roster Totals'}</span>
          </button>
          <AdminSeasonResetButton />
        </div>
      </div>

      {/* Add New Player Form */}
      <form onSubmit={handleAddPlayer} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Create New Player Profile
        </div>

        {nameError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{nameError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
            <select
              value={newAvatar}
              onChange={(e) => setNewAvatar(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-base font-semibold text-slate-800 outline-none focus:border-indigo-500"
            >
              {AVATAR_OPTIONS.map((a) => (
                <option key={a.icon} value={a.icon}>
                  {a.icon} {a.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="New Player Name (e.g. Man of Steel)..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 font-semibold text-sm focus:border-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Player
          </button>
        </div>

        {/* Quick Avatar Picker Grid */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Quick Choose Icon:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_OPTIONS.map((a) => (
              <button
                key={a.icon}
                type="button"
                onClick={() => setNewAvatar(a.icon)}
                title={a.label}
                className={`p-2 rounded-lg text-lg flex items-center gap-1 transition-all cursor-pointer ${
                  newAvatar === a.icon
                    ? 'bg-indigo-100 border-2 border-indigo-600 text-slate-900 scale-110 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                }`}
              >
                <span>{a.icon}</span>
                {a.icon === '🦸‍♂️' && (
                  <span className="text-[10px] font-bold text-indigo-700 px-1 py-0.2 bg-indigo-50 rounded">
                    Superman
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Empty State */}
      {/* Tonight's Evening Matches Section */}
      {(() => {
        const availableTonightMatches = tonightMatches.filter(
          (m) => m.status !== 'completed' && !m.isCompleted
        );
        const completedTonightMatches = tonightMatches.filter(
          (m) => m.status === 'completed' || m.isCompleted
        );

        return (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-indigo-600" /> Tonight's Matches
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {tonightMatches.length === 0
                    ? "Available and active matches for players this evening. All league matches are played locally."
                    : availableTonightMatches.length === 0
                    ? "All matches for tonight have concluded. Standings and player statistics are recorded."
                    : "Available and active matches for players this evening. All league matches are played locally."}
                </p>
              </div>
              {tonightMatches.length > 0 && (
                <span
                  className={`self-start sm:self-auto px-2.5 py-1 border text-xs font-bold rounded-lg ${
                    availableTonightMatches.length === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  }`}
                >
                  {availableTonightMatches.length === 0
                    ? 'All Matches Completed (0 Remaining)'
                    : `${availableTonightMatches.length} Available Match${availableTonightMatches.length !== 1 ? 'es' : ''} Remaining`}
                </span>
              )}
            </div>

            {tonightMatches.length === 0 ? (
              <div className="py-6 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center space-y-1">
                <Calendar className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No Evening Matches Posted Yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tonight's available league matches will appear here once matchup brackets are delegated.
                </p>
              </div>
            ) : availableTonightMatches.length === 0 ? (
              <div className="space-y-4">
                <div className="py-5 px-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-center space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                  <p className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                    All Matches Completed
                  </p>
                  <p className="text-xs text-emerald-800 max-w-md mx-auto">
                    There are no available matches remaining for tonight as all matches are completed. Great shooting!
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {completedTonightMatches.map((m, idx) => (
                    <div
                      key={`tonight-completed-${m.id || idx}`}
                      className="bg-slate-50/80 border border-emerald-200/60 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                          {m.leagueName}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {m.division} • {m.round}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 py-1">
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {m.entryA.name}
                          </span>
                          <span className="text-[10px] text-slate-500">Player / Team 1</span>
                        </div>
                        <div className="px-2 py-1 bg-white border border-slate-200 rounded font-black text-xs text-slate-400 shrink-0">
                          VS
                        </div>
                        <div className="flex-1 text-right">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {m.entryB.name}
                          </span>
                          <span className="text-[10px] text-slate-500">Player / Team 2</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Won: {m.winnerName || 'Completed'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Final Result
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableTonightMatches.map((m, idx) => (
                  <div
                    key={`tonight-${m.id || idx}`}
                    className="bg-slate-50/80 border border-slate-200 hover:border-indigo-300 rounded-xl p-4 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                        {m.leagueName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        {m.division} • {m.round}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 py-1">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {m.entryA.name}
                        </span>
                        <span className="text-[10px] text-slate-500">Player / Team 1</span>
                      </div>
                      <div className="px-2 py-1 bg-white border border-slate-200 rounded font-black text-xs text-slate-400 shrink-0">
                        VS
                      </div>
                      <div className="flex-1 text-right">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {m.entryB.name}
                        </span>
                        <span className="text-[10px] text-slate-500">Player / Team 2</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${
                          m.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {m.status === 'in_progress' ? (
                          <>
                            <Zap className="w-3 h-3 text-amber-600" /> In Progress
                          </>
                        ) : (
                          'Available'
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleLaunchTonightMatch(m)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> {m.status === 'in_progress' ? 'Resume Match' : 'Launch Match'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {players.length === 0 && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl p-6">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Player Profiles Found</h3>
          <p className="text-xs text-slate-500 mt-1">Use the form above to add a new player to your roster.</p>
        </div>
      )}

      {/* Roster Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {players.map((p) => {
          const winRate = p.matchesPlayed > 0 ? Math.round((p.matchesWon / p.matchesPlayed) * 100) : 0;
          const isEditingThisAvatar = editingAvatarId === p.id;

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              {deletingId === p.id && canDelete ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-red-900">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Terminate & remove <strong>{p.name}</strong> and all associated stats?</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleDeletePlayer(p.id, p.name)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded transition-colors cursor-pointer"
                    >
                      Delete & Wipe Stats
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingAvatarId(isEditingThisAvatar ? null : p.id)}
                        title="Click to change player icon (e.g. Superman 🦸‍♂️)"
                        className="text-3xl p-1 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer relative group"
                      >
                        <span>{p.avatar || '🎯'}</span>
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          ✏️
                        </span>
                      </button>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900 tracking-tight">{p.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">
                          Matches: <strong className="text-slate-900 font-bold">{p.matchesPlayed}</strong> ({winRate}% Win Rate)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 font-mono text-xs font-bold rounded-md">
                        Avg: {p.careerAvg}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPlayerForHistory(p)}
                        title="View career stats breakdown & match history logs"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                      >
                        <History className="w-4 h-4 text-indigo-500" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeletingId(p.id)}
                          title="Delete player profile"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Avatar Changer */}
                  {isEditingThisAvatar && (
                    <div className="p-3 bg-slate-50 border border-indigo-200 rounded-xl space-y-2 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                        <span>Select New Icon for {p.name}:</span>
                        <button
                          type="button"
                          onClick={() => setEditingAvatarId(null)}
                          className="text-slate-400 hover:text-slate-600 font-normal"
                        >
                          ✕ Close
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {AVATAR_OPTIONS.map((a) => (
                          <button
                            key={a.icon}
                            type="button"
                            onClick={() => handleUpdateAvatar(p.id, a.icon)}
                            title={a.label}
                            className={`p-1.5 rounded text-lg transition-transform hover:scale-125 cursor-pointer ${
                              p.avatar === a.icon ? 'bg-indigo-200 border border-indigo-500' : 'bg-white border border-slate-200 hover:bg-indigo-50'
                            }`}
                          >
                            {a.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Player's Match Status Tonight */}
                  {(() => {
                    const playerMatches = tonightMatches.filter(
                      (m) =>
                        m.entryA.name.toLowerCase().includes(p.name.toLowerCase()) ||
                        m.entryA.players?.some(
                          (pl) => pl.name.toLowerCase() === p.name.toLowerCase() || pl.id === p.id
                        ) ||
                        m.entryB.name.toLowerCase().includes(p.name.toLowerCase()) ||
                        m.entryB.players?.some(
                          (pl) => pl.name.toLowerCase() === p.name.toLowerCase() || pl.id === p.id
                        )
                    );

                    if (playerMatches.length === 0) return null;

                    const pendingPlayerMatches = playerMatches.filter(
                      (m) => m.status !== 'completed' && !m.isCompleted
                    );

                    if (pendingPlayerMatches.length === 0) {
                      return (
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            All Tonight's Matches Completed
                          </div>
                          {playerMatches.map((pm, pmIdx) => {
                            const isA =
                              pm.entryA.name.toLowerCase().includes(p.name.toLowerCase()) ||
                              pm.entryA.players?.some(
                                (pl) => pl.name.toLowerCase() === p.name.toLowerCase() || pl.id === p.id
                              );
                            const opponentName = isA ? pm.entryB.name : pm.entryA.name;
                            return (
                              <div
                                key={`p-${p.id}-m-${pm.id || pmIdx}`}
                                className="flex items-center justify-between p-2 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-extrabold text-slate-800 block truncate">
                                    vs. {opponentName}
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    {pm.leagueName} • {pm.round}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded shrink-0">
                                  {pm.winnerName ? `Won: ${pm.winnerName}` : 'Completed'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-500" />
                          Tonight's Available Match:
                        </div>
                        {pendingPlayerMatches.map((pm, pmIdx) => {
                          const isA =
                            pm.entryA.name.toLowerCase().includes(p.name.toLowerCase()) ||
                            pm.entryA.players?.some(
                              (pl) => pl.name.toLowerCase() === p.name.toLowerCase() || pl.id === p.id
                            );
                          const opponentName = isA ? pm.entryB.name : pm.entryA.name;
                          return (
                            <div
                              key={`p-${p.id}-m-${pm.id || pmIdx}`}
                              className="flex items-center justify-between p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs"
                            >
                              <div className="truncate pr-2">
                                <span className="font-extrabold text-slate-800 block truncate">
                                  vs. {opponentName}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {pm.leagueName} • {pm.round}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLaunchTonightMatch(pm)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                              >
                                <Play className="w-3 h-3 fill-current" /> {pm.status === 'in_progress' ? 'Resume' : 'Play'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-4 gap-2 text-center text-xs pt-3 border-t border-slate-100 font-mono">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block uppercase text-[10px] font-bold">High Out</span>
                      <span className="text-indigo-600 font-bold text-sm">{p.highCheckout || '-'}</span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block uppercase text-[10px] font-bold">180s</span>
                      <span className="text-slate-900 font-bold text-sm">{p.total180s}</span>
                    </div>

                    <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-200/70">
                      <span className="text-amber-700 block uppercase text-[10px] font-bold">Bulls 🎯</span>
                      <span className="text-amber-800 font-black text-sm">{p.seasonBullsHit || 0}</span>
                    </div>

                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block uppercase text-[10px] font-bold">Wins</span>
                      <span className="text-emerald-700 font-bold text-sm">{p.matchesWon}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {/* Career Running Totals & Match History Modal */}
      {selectedPlayerForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                  {selectedPlayerForHistory.avatar || '🎯'}
                </span>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {selectedPlayerForHistory.name}
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded-md">
                      Career Profile
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Immutable running totals and historical session breakdowns
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayerForHistory(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Career Summary Tiles */}
            <div className="p-5 space-y-5">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Permanent Career Running Totals
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Matches</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedPlayerForHistory.matchesWon}W - {(selectedPlayerForHistory.matchesPlayed || 0) - (selectedPlayerForHistory.matchesWon || 0)}L
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {selectedPlayerForHistory.matchesPlayed > 0
                        ? `${Math.round(((selectedPlayerForHistory.matchesWon || 0) / selectedPlayerForHistory.matchesPlayed) * 100)}% Win Rate`
                        : '0% Win Rate'}
                    </span>
                  </div>

                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-500 block">3-Dart Avg</span>
                    <span className="text-base font-black text-indigo-700">
                      {selectedPlayerForHistory.careerAvg || 0}
                    </span>
                    <span className="text-[10px] text-indigo-400 block">Per Turn Avg</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">High Out</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedPlayerForHistory.highCheckout || '-'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Best Checkout</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total 180s</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedPlayerForHistory.total180s || 0}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Max Scores</span>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Season Bulls 🎯</span>
                    <span className="text-base font-black text-amber-800">
                      {selectedPlayerForHistory.seasonBullsHit || 0}
                    </span>
                    <span className="text-[10px] text-amber-600 block">Bulls Hit</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Legs Ratio</span>
                    <span className="text-base font-black text-emerald-700">
                      {selectedPlayerForHistory.totalLegsWon || 0} / {selectedPlayerForHistory.totalLegsPlayed || 0}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Legs Won / Total</span>
                  </div>
                </div>
              </div>

              {/* Match History Session Log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Completed Session Match History
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {getPlayerMatchHistory(selectedPlayerForHistory.name).length} recorded
                  </span>
                </div>

                {(() => {
                  const history = getPlayerMatchHistory(selectedPlayerForHistory.name);
                  if (history.length === 0) {
                    return (
                      <div className="py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                        <History className="w-6 h-6 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">No Match Logs Stored Yet</p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Completing a match in the Scorer or League Brackets automatically records session stats and updates this player's running totals.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {history.map((rec) => {
                        const targetName = selectedPlayerForHistory.name.toLowerCase().trim();
                        const myStat = rec.players?.find(
                          (p) => p.name.toLowerCase().trim() === targetName || p.id === selectedPlayerForHistory.id
                        );
                        const oppStat = rec.players?.find(
                          (p) => p.name.toLowerCase().trim() !== targetName && p.id !== selectedPlayerForHistory.id
                        );
                        const isWin = myStat ? myStat.isWinner : rec.winnerName?.toLowerCase().includes(targetName);
                        const opponentName = oppStat?.name || (rec.winnerName !== selectedPlayerForHistory.name ? rec.winnerName : 'Opponent');
                        const dateStr = new Date(rec.completedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const legsWon = myStat ? myStat.legsWon : 0;
                        const legsLost = oppStat ? oppStat.legsWon : 0;
                        const avg = myStat ? (myStat.threeDartAvg > 0 ? myStat.threeDartAvg : '-') : '-';
                        const bulls = myStat ? myStat.bullsHit : 0;

                        return (
                          <div
                            key={`hist-${rec.matchId}-${rec.completedAt}`}
                            className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`px-2 py-0.5 font-mono text-[10px] font-black rounded uppercase tracking-wider ${
                                  isWin ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isWin ? 'WON' : 'LOST'}
                              </span>
                              <div className="truncate">
                                <div className="font-bold text-slate-800 truncate">
                                  vs. {opponentName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {dateStr} • {rec.leagueType ? `${rec.leagueType.toUpperCase()} League` : 'Match'} • {rec.gameMode || 'Game'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 font-mono text-right shrink-0">
                              <div>
                                <span className="text-slate-400 text-[10px] block">Legs</span>
                                <span className="font-bold text-slate-900">
                                  {legsWon} - {legsLost}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">Avg</span>
                                <span className="font-bold text-indigo-600">
                                  {avg}
                                </span>
                              </div>
                              {bulls > 0 && (
                                <div>
                                  <span className="text-amber-600 text-[10px] block">🎯 Bulls</span>
                                  <span className="font-bold text-amber-700">+{bulls}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Auto-synced to cloud database & local storage
              </span>
              <button
                type="button"
                onClick={() => setSelectedPlayerForHistory(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
