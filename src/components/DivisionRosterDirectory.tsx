import React, { useState, useMemo } from 'react';
import { BracketMatchup } from '../types';
import {
  Users,
  Search,
  MapPin,
  Swords,
  ChevronDown,
  ChevronUp,
  X,
  Target,
  Sparkles,
} from 'lucide-react';

export interface DivisionRosterItem {
  name: string;
  subtitle?: string;
  matchups: BracketMatchup[];
  theme?: any;
}

export interface CompetitorDetail {
  id?: string;
  name: string;
  players: { id?: string; name: string; avatar?: string; isDummy?: boolean }[];
  opponents: {
    opponentName: string;
    round: string;
    status: string;
    isBye: boolean;
  }[];
  totalMatches: number;
}

interface DivisionRosterDirectoryProps {
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  divisions: DivisionRosterItem[];
  onSelectDivision?: (divName: string) => void;
}

export const DivisionRosterDirectory: React.FC<DivisionRosterDirectoryProps> = ({
  leagueType,
  divisions,
  onSelectDivision,
}) => {
  // Only render for Tuesday and Thursday leagues when multiple divisions exist
  if ((leagueType !== 'tuesday' && leagueType !== 'thursday') || !divisions || divisions.length <= 1) {
    return null;
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivisionFilter, setSelectedDivisionFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  // Extract competitors and their opponents for each division
  const divisionRosters = useMemo(() => {
    return divisions.map((div, divIndex) => {
      const competitorMap = new Map<string, CompetitorDetail>();

      (div.matchups || []).forEach((m) => {
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

        // Process entryA
        if (m.entryA?.name && !isByeA) {
          if (!competitorMap.has(m.entryA.name)) {
            competitorMap.set(m.entryA.name, {
              id: m.entryA.id,
              name: m.entryA.name,
              players: Array.isArray(m.entryA.players) && m.entryA.players.length > 0
                ? m.entryA.players
                : [{ name: m.entryA.name, avatar: '🎯' }],
              opponents: [],
              totalMatches: 0,
            });
          }
          const comp = competitorMap.get(m.entryA.name)!;
          comp.totalMatches += 1;
          const oppName = isByeB ? 'BYE (Sitting Out)' : (m.entryB?.name || 'TBD');
          if (!comp.opponents.some((o) => o.opponentName === oppName && o.round === m.round)) {
            comp.opponents.push({
              opponentName: oppName,
              round: m.round || 'Round Robin',
              status: m.status || 'pending',
              isBye: isByeB,
            });
          }
        }

        // Process entryB
        if (m.entryB?.name && !isByeB) {
          if (!competitorMap.has(m.entryB.name)) {
            competitorMap.set(m.entryB.name, {
              id: m.entryB.id,
              name: m.entryB.name,
              players: Array.isArray(m.entryB.players) && m.entryB.players.length > 0
                ? m.entryB.players
                : [{ name: m.entryB.name, avatar: '🎯' }],
              opponents: [],
              totalMatches: 0,
            });
          }
          const comp = competitorMap.get(m.entryB.name)!;
          comp.totalMatches += 1;
          const oppName = isByeA ? 'BYE (Sitting Out)' : (m.entryA?.name || 'TBD');
          if (!comp.opponents.some((o) => o.opponentName === oppName && o.round === m.round)) {
            comp.opponents.push({
              opponentName: oppName,
              round: m.round || 'Round Robin',
              status: m.status || 'pending',
              isBye: isByeA,
            });
          }
        }
      });

      const competitors = Array.from(competitorMap.values());
      const totalPlayers = competitors.reduce((acc, c) => acc + (c.players?.length || 1), 0);

      return {
        name: div.name,
        subtitle: div.subtitle,
        theme: div.theme,
        competitors,
        totalCompetitors: competitors.length,
        totalPlayers,
        divIndex,
      };
    });
  }, [divisions]);

  // Clean and normalized query
  const query = searchQuery.trim().toLowerCase();

  // Find if user searched a specific player/team
  const matchedPlayerInfo = useMemo(() => {
    if (!query) return null;
    for (const div of divisionRosters) {
      for (const comp of div.competitors) {
        const matchesCompName = comp.name.toLowerCase().includes(query);
        const matchesPlayer = comp.players.some((p) => p.name.toLowerCase().includes(query));
        if (matchesCompName || matchesPlayer) {
          return {
            divisionName: div.name,
            competitor: comp,
            divisionSubtitle: div.subtitle,
          };
        }
      }
    }
    return null;
  }, [query, divisionRosters]);

  const filteredDivisions = useMemo(() => {
    return divisionRosters.filter((div) => {
      if (selectedDivisionFilter !== 'all' && div.name !== selectedDivisionFilter) {
        return false;
      }
      if (!query) return true;
      // Check if division name matches
      if (div.name.toLowerCase().includes(query)) return true;
      // Check if any competitor in this division matches
      return div.competitors.some((c) => {
        if (c.name.toLowerCase().includes(query)) return true;
        return c.players.some((p) => p.name.toLowerCase().includes(query));
      });
    });
  }, [divisionRosters, selectedDivisionFilter, query]);

  const scrollToDivision = (divName: string) => {
    if (onSelectDivision) {
      onSelectDivision(divName);
    }
    const cleanId = `div-section-${divName.replace(/\s+/g, '')}`;
    const el = document.getElementById(cleanId) || document.getElementById(`live-div-${divName}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      id="division-roster-directory"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden transition-all mb-6"
    >
      {/* Directory Top Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black tracking-tight text-white">
                Division Player Directory
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {divisions.length} Divisions Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Easily view where you are playing and who you are playing against tonight
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find your name or team..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-900 border border-slate-700/80 focus:border-indigo-400 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            title={isExpanded ? 'Collapse Directory' : 'Expand Directory'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="hidden sm:inline text-[11px]">{isExpanded ? 'Hide' : 'Show'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Quick-Player Lookup Banner if player was searched */}
          {matchedPlayerInfo && (
            <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {matchedPlayerInfo.competitor.name}
                    </span>{' '}
                    is scheduled in{' '}
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-black text-indigo-700 bg-indigo-100 border border-indigo-200 ml-1">
                      {matchedPlayerInfo.divisionName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Playing against{' '}
                    <strong className="text-slate-800">
                      {matchedPlayerInfo.competitor.opponents
                        .map((o) => o.opponentName)
                        .join(', ')}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => scrollToDivision(matchedPlayerInfo.divisionName)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              >
                <span>Jump to Matches</span>
                <Swords className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Division Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDivisionFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 text-xs ${
                selectedDivisionFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Divisions ({divisionRosters.length})
            </button>
            {divisionRosters.map((div) => {
              const isActive = selectedDivisionFilter === div.name;
              return (
                <button
                  key={`filter-${div.name}`}
                  type="button"
                  onClick={() => setSelectedDivisionFilter(div.name)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{div.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {div.totalCompetitors}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grid of Division Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDivisions.map((div) => {
              const isTargeted =
                matchedPlayerInfo && matchedPlayerInfo.divisionName === div.name;

              return (
                <div
                  key={`roster-card-${div.name}`}
                  className={`rounded-xl border transition-all flex flex-col bg-slate-50/50 ${
                    isTargeted
                      ? 'border-indigo-400 ring-2 ring-indigo-300 shadow-md bg-indigo-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Division Header */}
                  <div className="p-3.5 bg-white border-b border-slate-100 rounded-t-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <div>
                        <h4 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                          <span>{div.name}</span>
                          {isTargeted && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                              <Sparkles className="w-3 h-3" /> Your Division
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {div.subtitle || `${div.name} Round Robin`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                        {leagueType === 'thursday'
                          ? `${div.totalCompetitors} Teams`
                          : `${div.totalCompetitors} Players`}
                      </span>
                    </div>
                  </div>

                  {/* Competitor List */}
                  <div className="p-3.5 space-y-2 flex-1">
                    {div.competitors.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2 text-center">
                        No players scheduled in this division
                      </p>
                    ) : (
                      div.competitors.map((comp) => {
                        const isQueryMatch =
                          query &&
                          (comp.name.toLowerCase().includes(query) ||
                            comp.players.some((p) => p.name.toLowerCase().includes(query)));

                        return (
                          <div
                            key={`comp-${div.name}-${comp.name}`}
                            className={`p-2.5 rounded-lg border text-xs transition-all ${
                              isQueryMatch
                                ? 'bg-amber-50 border-amber-300 shadow-xs'
                                : 'bg-white border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            {/* Competitor / Team Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {leagueType === 'thursday' ? (
                                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    👥
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    <Target className="w-3.5 h-3.5" />
                                  </div>
                                )}
                                <span className="font-extrabold text-slate-900 truncate">
                                  {comp.name}
                                </span>
                              </div>

                              <span className="text-[10px] font-mono text-slate-400 shrink-0 font-bold">
                                {comp.totalMatches} {comp.totalMatches === 1 ? 'match' : 'matches'}
                              </span>
                            </div>

                            {/* If Doubles: display team roster member chips */}
                            {leagueType === 'thursday' && comp.players.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5 pl-8">
                                {comp.players.map((p, pIdx) => (
                                  <span
                                    key={`p-${pIdx}-${p.name}`}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                      p.isDummy || p.name.includes('Dummy')
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <span>{p.avatar || '🎯'}</span>
                                    <span>{p.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Opponents who this competitor is playing */}
                            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                              <span className="font-bold text-slate-600 block mb-0.5">
                                Plays against:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {comp.opponents.map((opp, oppIdx) => (
                                  <span
                                    key={`opp-${oppIdx}-${opp.opponentName}`}
                                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                                      opp.isBye
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 italic'
                                        : 'bg-indigo-50 text-indigo-800 border-indigo-100'
                                    }`}
                                  >
                                    {opp.opponentName}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Card Footer: Quick jump to matchups */}
                  <div className="p-2.5 bg-white border-t border-slate-100 rounded-b-xl">
                    <button
                      type="button"
                      onClick={() => scrollToDivision(div.name)}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>View {div.name} Matchups</span>
                      <Swords className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
