import React, { useState, useEffect } from 'react';
import { MatchSettings, Player, IndividualLeagueStanding } from '../types';
import { Trophy, Users, Award, Target, Calendar, Trash2, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LeagueAttendanceManager } from './LeagueAttendanceManager';
import { LeaderboardView } from './LeaderboardView';
import { FinanceManager } from './FinanceManager';
import { subscribeToLeagueStandings } from '../services/cloudSync';
import { AdminSeasonResetButton } from './SeasonResetModal';

interface LeagueManagerProps {
  onLaunchLeagueMatch: (
    settings: MatchSettings,
    playersList: Player[],
    leagueType: 'tuesday' | 'wednesday' | 'thursday'
  ) => void;
}

export const LeagueManager: React.FC<LeagueManagerProps> = ({ onLaunchLeagueMatch }) => {
  const { isAdmin, canDelete } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'tuesday' | 'wednesday' | 'thursday' | 'finance'>('leaderboard');

  // Standings for each league night
  const [tuesdayStandings, setTuesdayStandings] = useState<IndividualLeagueStanding[]>(() => {
    try {
      const saved = localStorage.getItem('kaboom_tuesday_standings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((s: any) =>
            !s.playerName.toLowerCase().includes("littler") &&
            !s.playerName.toLowerCase().includes("gerwen") &&
            !s.playerName.toLowerCase().includes("anderson") &&
            !s.playerName.toLowerCase().includes("nuke")
          );
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {}
    return [];
  });

  const [wednesdayStandings, setWednesdayStandings] = useState<IndividualLeagueStanding[]>(() => {
    try {
      const saved = localStorage.getItem('kaboom_wednesday_standings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((s: any) =>
            !s.playerName.toLowerCase().includes("littler") &&
            !s.playerName.toLowerCase().includes("gerwen") &&
            !s.playerName.toLowerCase().includes("anderson") &&
            !s.playerName.toLowerCase().includes("nuke")
          );
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {}
    return [];
  });

  const [thursdayStandings, setThursdayStandings] = useState<IndividualLeagueStanding[]>(() => {
    try {
      const saved = localStorage.getItem('kaboom_thursday_standings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((s: any) =>
            !s.playerName.toLowerCase().includes("littler") &&
            !s.playerName.toLowerCase().includes("gerwen") &&
            !s.playerName.toLowerCase().includes("anderson") &&
            !s.playerName.toLowerCase().includes("nuke")
          );
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) {}
    return [];
  });

  // Realtime Cloud Firestore sync for all league formats
  useEffect(() => {
    const handleSyncUpdate = (e: any) => {
      const key = e?.detail?.key;
      if (!key || key === 'all' || key.includes('standings') || key.includes('dart_players')) {
        try {
          const tSaved = localStorage.getItem('kaboom_tuesday_standings');
          if (tSaved) setTuesdayStandings(JSON.parse(tSaved));
          const wSaved = localStorage.getItem('kaboom_wednesday_standings');
          if (wSaved) setWednesdayStandings(JSON.parse(wSaved));
          const thSaved = localStorage.getItem('kaboom_thursday_standings');
          if (thSaved) setThursdayStandings(JSON.parse(thSaved));
        } catch (err) {}
      }
    };
    window.addEventListener('kaboom_cloud_sync_update', handleSyncUpdate);

    const unsubTuesday = subscribeToLeagueStandings('tuesday', (cloudStandings) => {
      if (cloudStandings) {
        setTuesdayStandings(cloudStandings);
      }
    });

    const unsubWednesday = subscribeToLeagueStandings('wednesday', (cloudStandings) => {
      if (cloudStandings) {
        setWednesdayStandings(cloudStandings);
      }
    });

    const unsubThursday = subscribeToLeagueStandings('thursday', (cloudStandings) => {
      if (cloudStandings) {
        setThursdayStandings(cloudStandings);
      }
    });

    const handlePlayerDeletedOrReset = () => {
      try {
        const tSaved = localStorage.getItem('kaboom_tuesday_standings');
        setTuesdayStandings(tSaved ? JSON.parse(tSaved) : []);
        const wSaved = localStorage.getItem('kaboom_wednesday_standings');
        setWednesdayStandings(wSaved ? JSON.parse(wSaved) : []);
        const thSaved = localStorage.getItem('kaboom_thursday_standings');
        setThursdayStandings(thSaved ? JSON.parse(thSaved) : []);
      } catch (err) {}
    };

    window.addEventListener('kaboom_player_deleted', handlePlayerDeletedOrReset);
    window.addEventListener('kaboom_season_stats_reset', handlePlayerDeletedOrReset);
    window.addEventListener('kaboom_league_season_reset', handlePlayerDeletedOrReset);

    return () => {
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncUpdate);
      window.removeEventListener('kaboom_player_deleted', handlePlayerDeletedOrReset);
      window.removeEventListener('kaboom_season_stats_reset', handlePlayerDeletedOrReset);
      window.removeEventListener('kaboom_league_season_reset', handlePlayerDeletedOrReset);
      unsubTuesday();
      unsubWednesday();
      unsubThursday();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('kaboom_tuesday_standings', JSON.stringify(tuesdayStandings));
  }, [tuesdayStandings]);

  useEffect(() => {
    localStorage.setItem('kaboom_wednesday_standings', JSON.stringify(wednesdayStandings));
  }, [wednesdayStandings]);

  useEffect(() => {
    localStorage.setItem('kaboom_thursday_standings', JSON.stringify(thursdayStandings));
  }, [thursdayStandings]);

  const resetStandings = (type: 'tuesday' | 'wednesday' | 'thursday') => {
    if (type === 'tuesday') {
      setTuesdayStandings([]);
    } else if (type === 'wednesday') {
      setWednesdayStandings([]);
    } else {
      setThursdayStandings([]);
    }
  };

  const getHighInLeader = (list: IndividualLeagueStanding[]) => {
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => (b.highIn || 0) - (a.highIn || 0));
    return sorted[0]?.highIn ? sorted[0] : null;
  };

  const getHighOutLeader = (list: IndividualLeagueStanding[]) => {
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => (b.highCheckout || b.highOut || 0) - (a.highCheckout || a.highOut || 0));
    const val = sorted[0]?.highCheckout || sorted[0]?.highOut || 0;
    return val > 0 ? sorted[0] : null;
  };

  const getTopAvgLeader = (list: IndividualLeagueStanding[]) => {
    if (!list || list.length === 0) return null;
    const sorted = [...list].sort((a, b) => (b.threeDartAvg || 0) - (a.threeDartAvg || 0));
    return sorted[0]?.threeDartAvg > 0 ? sorted[0] : null;
  };

  const renderLeagueHighlights = (list: IndividualLeagueStanding[]) => {
    const highIn = getHighInLeader(list);
    const highOut = getHighOutLeader(list);
    const topAvg = getTopAvgLeader(list);

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-3">
        <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-emerald-200/60 shadow-xs">
          <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
            🎯
          </span>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block truncate">
              High In (1st Shot Dbl In)
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-extrabold text-xs text-slate-900 truncate">
                {highIn ? highIn.playerName : 'None yet'}
              </span>
              {highIn && (
                <span className="font-black text-emerald-600 text-xs shrink-0">
                  {highIn.highIn} pts
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-indigo-200/60 shadow-xs">
          <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
            ⚡
          </span>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block truncate">
              Top 3-Dart Avg
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-extrabold text-xs text-slate-900 truncate">
                {topAvg ? topAvg.playerName : 'None yet'}
              </span>
              {topAvg && (
                <span className="font-black text-indigo-600 text-xs shrink-0">
                  {topAvg.threeDartAvg.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-lg border border-amber-200/60 shadow-xs">
          <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm shrink-0">
            🏆
          </span>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block truncate">
              High Out (Checkout)
            </span>
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="font-extrabold text-xs text-slate-900 truncate">
                {highOut ? highOut.playerName : 'None yet'}
              </span>
              {highOut && (
                <span className="font-black text-amber-600 text-xs shrink-0">
                  {highOut.highCheckout || highOut.highOut} pts
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-bold uppercase tracking-wider mb-3">
          <Trophy className="w-4 h-4 text-amber-500" /> League & Tournament Hub
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Tuesday Singles, Wednesday League & Thursday Doubles
        </h1>
        <p className="text-slate-500 text-sm mt-1.5 max-w-2xl mx-auto">
          Multi-Game Medleys: Tuesday & Thursday (301 DI/DO ➔ 501 ➔ Cricket) • Wednesday 4v4 (1001 ➔ Baseball ➔ 701 DI/DO ➔ Fives ➔ Cricket ➔ 1001). Every game win awards individual player stats points.
        </p>
        {isAdmin && (
          <div className="pt-3 flex items-center justify-center">
            <AdminSeasonResetButton league="all" label="Reset Season (All Leagues)" />
          </div>
        )}
      </div>

      {/* Main League Selector Tabs */}
      <div className="flex bg-slate-200/60 p-1.5 rounded-xl border border-slate-300 max-w-4xl mx-auto font-bold text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-3 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-300" /> Leaderboard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tuesday')}
          className={`flex-1 py-3 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'tuesday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 text-amber-300" /> Tuesday
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wednesday')}
          className={`flex-1 py-3 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'wednesday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" /> Wednesday
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('thursday')}
          className={`flex-1 py-3 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'thursday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" /> Thursday
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('finance')}
          className={`flex-1 py-3 px-2 sm:px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'finance'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" /> Finances
        </button>
      </div>

      {/* FINANCES SECTION */}
      {activeTab === 'finance' && <FinanceManager />}

      {/* AUTOMATED LEADERBOARD SECTION */}
      {activeTab === 'leaderboard' && <LeaderboardView />}

      {/* TUESDAY SINGLES SECTION */}
      {activeTab === 'tuesday' && (
        <div className="space-y-6">
          {/* Attendance & Bracket Delegation Module */}
          <LeagueAttendanceManager leagueType="tuesday" onLaunchMatch={onLaunchLeagueMatch} />

          {/* Tuesday Singles Individual Standings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Tuesday Singles Standings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Points tracked individually for each winning player on Tuesday.
                </p>
              </div>

              {isAdmin && (
                <AdminSeasonResetButton
                  league="tuesday"
                  variant="compact"
                  label="Reset Tuesday Season"
                  onSuccess={() => setTuesdayStandings([])}
                />
              )}
            </div>

            {/* Tuesday Highlights */}
            {renderLeagueHighlights(tuesdayStandings)}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-sans uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Player</th>
                    <th className="py-2 px-3 text-right">Individual Points</th>
                    <th className="py-2 px-3 text-right">Games Won</th>
                    <th className="py-2 px-3 text-right">Total Games</th>
                    <th className="py-2 px-3 text-right">3-Dart Avg</th>
                    <th className="py-2 px-3 text-right">High Out</th>
                    <th className="py-2 px-3 text-right text-emerald-700 font-bold">High In</th>
                    <th className="py-2 px-3 text-right">180s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tuesdayStandings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                        No Tuesday Singles standings recorded yet. Launch a match above!
                      </td>
                    </tr>
                  ) : (
                    tuesdayStandings
                      .sort((a, b) => b.points - a.points || b.threeDartAvg - a.threeDartAvg)
                      .map((s, idx) => (
                        <tr key={s.playerId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-bold font-sans">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 font-sans text-sm">{s.playerName}</td>
                          <td className="py-3 px-3 text-right font-black text-indigo-600 text-base">{s.points} pts</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.gamesWon}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{s.gamesPlayed}</td>
                          <td className="py-3 px-3 text-right text-slate-800 font-bold">{s.threeDartAvg > 0 ? s.threeDartAvg.toFixed(1) : '-'}</td>
                          <td className="py-3 px-3 text-right text-indigo-600 font-bold">{(s.highCheckout || s.highOut) ? (s.highCheckout || s.highOut) : '-'}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-bold">{s.highIn && s.highIn > 0 ? s.highIn : '-'}</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.total180s}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* WEDNESDAY LEAGUE SECTION */}
      {activeTab === 'wednesday' && (
        <div className="space-y-6">
          {/* Attendance & Team Delegation Module */}
          <LeagueAttendanceManager leagueType="wednesday" onLaunchMatch={onLaunchLeagueMatch} />

          {/* Wednesday Individual Standings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Wednesday Individual League Standings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  1 Point added individually to each winning player for every game won across all 6 Wednesday events.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('leaderboard')}
                  className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> View Champion Leaderboard
                </button>
                {isAdmin && (
                  <AdminSeasonResetButton
                    league="wednesday"
                    variant="compact"
                    label="Reset Wednesday Season"
                    onSuccess={() => setWednesdayStandings([])}
                  />
                )}
              </div>
            </div>

            {/* Wednesday Highlights */}
            {renderLeagueHighlights(wednesdayStandings)}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-sans uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Player</th>
                    <th className="py-2 px-3 text-right">Individual Points</th>
                    <th className="py-2 px-3 text-right">Games Won</th>
                    <th className="py-2 px-3 text-right">Total Games</th>
                    <th className="py-2 px-3 text-right">3-Dart Avg</th>
                    <th className="py-2 px-3 text-right">High Out</th>
                    <th className="py-2 px-3 text-right text-emerald-700 font-bold">High In</th>
                    <th className="py-2 px-3 text-right">180s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wednesdayStandings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                        No Wednesday standings recorded yet. Launch a match above!
                      </td>
                    </tr>
                  ) : (
                    wednesdayStandings
                      .sort((a, b) => b.points - a.points || b.threeDartAvg - a.threeDartAvg)
                      .map((s, idx) => (
                        <tr key={s.playerId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-bold font-sans">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 font-sans text-sm">{s.playerName}</td>
                          <td className="py-3 px-3 text-right font-black text-indigo-600 text-base">{s.points} pts</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.gamesWon}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{s.gamesPlayed}</td>
                          <td className="py-3 px-3 text-right text-slate-800 font-bold">{s.threeDartAvg > 0 ? s.threeDartAvg.toFixed(1) : '-'}</td>
                          <td className="py-3 px-3 text-right text-indigo-600 font-bold">{(s.highCheckout || s.highOut) ? (s.highCheckout || s.highOut) : '-'}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-bold">{s.highIn && s.highIn > 0 ? s.highIn : '-'}</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.total180s}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* THURSDAY DOUBLES SECTION */}
      {activeTab === 'thursday' && (
        <div className="space-y-6">
          {/* Attendance & Bracket Delegation Module */}
          <LeagueAttendanceManager leagueType="thursday" onLaunchMatch={onLaunchLeagueMatch} />

          {/* Thursday Doubles Individual Standings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" /> Thursday Doubles Individual Standings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Points tracked individually for each winning teammate on Thursday.
                </p>
              </div>

              {isAdmin && (
                <AdminSeasonResetButton
                  league="thursday"
                  variant="compact"
                  label="Reset Thursday Season"
                  onSuccess={() => setThursdayStandings([])}
                />
              )}
            </div>

            {/* Thursday Highlights */}
            {renderLeagueHighlights(thursdayStandings)}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-sans uppercase text-[10px] tracking-wider">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Player</th>
                    <th className="py-2 px-3 text-right">Individual Points</th>
                    <th className="py-2 px-3 text-right">Games Won</th>
                    <th className="py-2 px-3 text-right">Total Games</th>
                    <th className="py-2 px-3 text-right">3-Dart Avg</th>
                    <th className="py-2 px-3 text-right">High Out</th>
                    <th className="py-2 px-3 text-right text-emerald-700 font-bold">High In</th>
                    <th className="py-2 px-3 text-right">180s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {thursdayStandings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400 font-sans">
                        No Thursday Doubles standings recorded yet. Launch a match above!
                      </td>
                    </tr>
                  ) : (
                    thursdayStandings
                      .sort((a, b) => b.points - a.points || b.threeDartAvg - a.threeDartAvg)
                      .map((s, idx) => (
                        <tr key={s.playerId} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-bold font-sans">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900 font-sans text-sm">{s.playerName}</td>
                          <td className="py-3 px-3 text-right font-black text-indigo-600 text-base">{s.points} pts</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.gamesWon}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{s.gamesPlayed}</td>
                          <td className="py-3 px-3 text-right text-slate-800 font-bold">{s.threeDartAvg > 0 ? s.threeDartAvg.toFixed(1) : '-'}</td>
                          <td className="py-3 px-3 text-right text-indigo-600 font-bold">{(s.highCheckout || s.highOut) ? (s.highCheckout || s.highOut) : '-'}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-bold">{s.highIn && s.highIn > 0 ? s.highIn : '-'}</td>
                          <td className="py-3 px-3 text-right text-slate-900 font-bold">{s.total180s}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
