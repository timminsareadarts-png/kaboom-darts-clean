import React, { useState, useEffect } from 'react';
import {
  Users,
  SlidersHorizontal,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Search,
  Sparkles,
  Bot,
  Layers,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  LeagueAttendancePlayer,
  LeagueBracketsState,
  BracketMatchup,
  DivisionData,
} from '../types';
import {
  createRoundRobinMatchups,
  calculateThursdayDivisions,
} from '../utils/leagueHelper';
import { getWednesdayMatchPlan } from './LeagueAttendanceManager';

interface ManualTeamPlayer {
  id: string;
  name: string;
  avatar: string;
  isDummy?: boolean;
}

interface ManualTeam {
  id: string;
  name: string;
  players: ManualTeamPlayer[];
}

interface ManualDivision {
  id: string;
  name: string;
  subtitle?: string;
  teams: ManualTeam[]; // For Thursday & Tuesday (where each singles player is a 1-player team)
}

interface ManualWednesdayBoard {
  id: string;
  boardNumber: number;
  teamA: ManualTeam;
  teamB: ManualTeam;
}

interface ManualTeamDivisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  singlesRoster: LeagueAttendancePlayer[];
  onApplyBrackets: (brackets: LeagueBracketsState) => void;
  isAdmin: boolean;
}

export const ManualTeamDivisionModal: React.FC<ManualTeamDivisionModalProps> = ({
  isOpen,
  onClose,
  leagueType,
  singlesRoster,
  onApplyBrackets,
  isAdmin,
}) => {
  if (!isOpen || !isAdmin) return null;

  // Search filter for available players
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'checkedIn' | 'all'>('checkedIn');

  // Tuesday / Thursday State: Divisions & Teams
  const [divisions, setDivisions] = useState<ManualDivision[]>([]);

  // Wednesday State: Boards & Matchups
  const [wednesdayBoards, setWednesdayBoards] = useState<ManualWednesdayBoard[]>([]);

  // Selected Division Tab for Thursday / Tuesday multi-division view
  const [activeDivIndex, setActiveDivIndex] = useState(0);

  // Initialize or Prefill state
  const handlePrefillFromCheckedIn = () => {
    const checkedIn = singlesRoster.filter((p) => p.checkedIn);
    // Strictly only prefill players who are checked in. Never default to all players if none are checked in!
    const pool = checkedIn;

    if (leagueType === 'wednesday') {
      // Wednesday: Even boards
      const matchPlan = getWednesdayMatchPlan(pool.length);
      const boards: ManualWednesdayBoard[] = [];
      let cursor = 0;

      matchPlan.forEach((m, idx) => {
        const teamAReal = pool.slice(cursor, cursor + m.sizeA);
        cursor += m.sizeA;
        const teamBReal = pool.slice(cursor, cursor + m.sizeB);
        cursor += m.sizeB;

        const pA: ManualTeamPlayer[] = teamAReal.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '🎯',
          isDummy: false,
        }));
        const pB: ManualTeamPlayer[] = teamBReal.map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar || '🎯',
          isDummy: false,
        }));

        // Balance with dummy if needed
        const maxSize = Math.max(pA.length, pB.length);
        let dummyCount = 1;
        while (pA.length < maxSize) {
          pA.push({
            id: `dummy-a-${idx}-${dummyCount++}`,
            name: '🤖 Dummy Player',
            avatar: '🤖',
            isDummy: true,
          });
        }
        while (pB.length < maxSize) {
          pB.push({
            id: `dummy-b-${idx}-${dummyCount++}`,
            name: '🤖 Dummy Player',
            avatar: '🤖',
            isDummy: true,
          });
        }

        const nameA = teamAReal.map((p) => p.name).join(' & ') || `Team ${idx * 2 + 1}`;
        const nameB = teamBReal.map((p) => p.name).join(' & ') || `Team ${idx * 2 + 2}`;

        boards.push({
          id: `board-${idx + 1}-${Date.now()}-${idx}`,
          boardNumber: idx + 1,
          teamA: {
            id: `wteam-a-${idx + 1}-${Date.now()}`,
            name: pA.some((p) => p.isDummy) ? `${nameA} & Dummy` : nameA,
            players: pA,
          },
          teamB: {
            id: `wteam-b-${idx + 1}-${Date.now()}`,
            name: pB.some((p) => p.isDummy) ? `${nameB} & Dummy` : nameB,
            players: pB,
          },
        });
      });

      if (boards.length === 0) {
        // Create 1 blank board
        boards.push({
          id: `board-1-${Date.now()}`,
          boardNumber: 1,
          teamA: { id: `wteam-1-${Date.now()}`, name: 'Team 1', players: [] },
          teamB: { id: `wteam-2-${Date.now()}`, name: 'Team 2', players: [] },
        });
      }

      setWednesdayBoards(boards);
    } else if (leagueType === 'thursday') {
      // Thursday Doubles: Divisions & Pairs
      const divInfo = calculateThursdayDivisions(pool.length, 'auto');
      const newDivs: ManualDivision[] = [];
      let playerCursor = 0;

      for (let d = 0; d < divInfo.numDivisions; d++) {
        const divSize = divInfo.sizes[d];
        const divPlayers = pool.slice(playerCursor, playerCursor + divSize);
        playerCursor += divSize;

        const letter = String.fromCharCode(65 + d);
        const divName = divInfo.numDivisions === 1 ? 'Open Division' : `Division ${letter}`;
        const divTeams: ManualTeam[] = [];

        const isOdd = divPlayers.length % 2 !== 0;
        if (!isOdd) {
          // All doubles pairs
          for (let i = 0; i < divPlayers.length / 2; i++) {
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
          // If odd: pair remaining with Dummy by default
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
          const oddP = divPlayers[divPlayers.length - 1];
          if (oddP) {
            divTeams.push({
              id: `thurs-d${d + 1}-dummy-${Date.now()}`,
              name: `${oddP.name} & Dummy`,
              players: [
                { id: oddP.id, name: oddP.name, avatar: oddP.avatar || '🎯', isDummy: false },
                { id: `dummy-${oddP.id}-${Date.now()}`, name: '🤖 Dummy Player', avatar: '🤖', isDummy: true },
              ],
            });
          }
        }

        newDivs.push({
          id: `div-${letter}-${Date.now()}`,
          name: divName,
          subtitle: `Division ${letter} (${divTeams.length} Doubles Teams)`,
          teams: divTeams,
        });
      }

      setDivisions(newDivs);
      setActiveDivIndex(0);
    } else {
      // Tuesday Singles: Divisions & Singles Entries (max 4 players per division)
      const isMulti = pool.length > 4;
      const numDivs = isMulti ? Math.ceil(pool.length / 4) : 1;
      const baseSize = Math.floor(pool.length / numDivs);
      const rem = pool.length % numDivs;

      const newDivs: ManualDivision[] = [];
      let playerCursor = 0;

      for (let d = 0; d < numDivs; d++) {
        const size = baseSize + (d < rem ? 1 : 0);
        const divPlayers = pool.slice(playerCursor, playerCursor + size);
        playerCursor += size;

        const letter = String.fromCharCode(65 + d);
        const divName = !isMulti ? 'Open Division' : `Division ${letter}`;
        const divTeams: ManualTeam[] = divPlayers.map((p) => ({
          id: `tues-player-${p.id}`,
          name: p.name,
          players: [{ id: p.id, name: p.name, avatar: p.avatar || '🎯', isDummy: false }],
        }));

        newDivs.push({
          id: `div-${letter}-${Date.now()}`,
          name: divName,
          subtitle: `Division ${letter} (${divTeams.length} Singles)`,
          teams: divTeams,
        });
      }

      setDivisions(newDivs);
      setActiveDivIndex(0);
    }
  };

  // Run initial prefill on modal open if blank
  useEffect(() => {
    if (isOpen) {
      if (leagueType === 'wednesday' && wednesdayBoards.length === 0) {
        handlePrefillFromCheckedIn();
      } else if (leagueType !== 'wednesday' && divisions.length === 0) {
        handlePrefillFromCheckedIn();
      }
    }
  }, [isOpen, leagueType]);

  // Compute set of currently assigned real player IDs
  const assignedPlayerIds = new Set<string>();
  if (leagueType === 'wednesday') {
    wednesdayBoards.forEach((b) => {
      b.teamA.players.forEach((p) => {
        if (!p.isDummy) assignedPlayerIds.add(p.id);
      });
      b.teamB.players.forEach((p) => {
        if (!p.isDummy) assignedPlayerIds.add(p.id);
      });
    });
  } else {
    divisions.forEach((div) => {
      div.teams.forEach((t) => {
        t.players.forEach((p) => {
          if (!p.isDummy) assignedPlayerIds.add(p.id);
        });
      });
    });
  }

  // Available players pool
  const candidatePlayers = singlesRoster.filter((p) => {
    if (filterMode === 'checkedIn' && !p.checkedIn) return false;
    if (searchQuery.trim()) {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    }
    return true;
  });

  const unassignedCandidates = candidatePlayers.filter((p) => !assignedPlayerIds.has(p.id));

  // --- WEDNESDAY ACTIONS ---
  const addWednesdayBoard = () => {
    const nextNum = wednesdayBoards.length + 1;
    setWednesdayBoards([
      ...wednesdayBoards,
      {
        id: `board-${nextNum}-${Date.now()}`,
        boardNumber: nextNum,
        teamA: { id: `wteam-${nextNum}a-${Date.now()}`, name: `Team ${nextNum * 2 - 1}`, players: [] },
        teamB: { id: `wteam-${nextNum}b-${Date.now()}`, name: `Team ${nextNum * 2}`, players: [] },
      },
    ]);
  };

  const removeWednesdayBoard = (boardId: string) => {
    const filtered = wednesdayBoards.filter((b) => b.id !== boardId);
    setWednesdayBoards(filtered.map((b, idx) => ({ ...b, boardNumber: idx + 1 })));
  };

  const addPlayerToWednesdayTeam = (boardId: string, teamSide: 'teamA' | 'teamB', player: LeagueAttendancePlayer) => {
    setWednesdayBoards(
      wednesdayBoards.map((b) => {
        if (b.id !== boardId) return b;
        const targetTeam = b[teamSide];
        if (targetTeam.players.some((p) => p.id === player.id)) return b;
        const newPlayers: ManualTeamPlayer[] = [
          ...targetTeam.players,
          { id: player.id, name: player.name, avatar: player.avatar || '🎯', isDummy: false },
        ];
        const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
        const hasDummy = newPlayers.some((p) => p.isDummy);
        return {
          ...b,
          [teamSide]: {
            ...targetTeam,
            players: newPlayers,
            name: realNames ? (hasDummy ? `${realNames} & Dummy` : realNames) : targetTeam.name,
          },
        };
      })
    );
  };

  const addDummyToWednesdayTeam = (boardId: string, teamSide: 'teamA' | 'teamB') => {
    setWednesdayBoards(
      wednesdayBoards.map((b) => {
        if (b.id !== boardId) return b;
        const targetTeam = b[teamSide];
        const dummyNum = targetTeam.players.filter((p) => p.isDummy).length + 1;
        const newPlayers: ManualTeamPlayer[] = [
          ...targetTeam.players,
          {
            id: `dummy-${boardId}-${teamSide}-${Date.now()}-${dummyNum}`,
            name: '🤖 Dummy Player',
            avatar: '🤖',
            isDummy: true,
          },
        ];
        const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
        return {
          ...b,
          [teamSide]: {
            ...targetTeam,
            players: newPlayers,
            name: realNames ? `${realNames} & Dummy` : `Dummy Team`,
          },
        };
      })
    );
  };

  const removePlayerFromWednesdayTeam = (boardId: string, teamSide: 'teamA' | 'teamB', playerId: string) => {
    setWednesdayBoards(
      wednesdayBoards.map((b) => {
        if (b.id !== boardId) return b;
        const targetTeam = b[teamSide];
        const newPlayers = targetTeam.players.filter((p) => p.id !== playerId);
        const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
        const hasDummy = newPlayers.some((p) => p.isDummy);
        return {
          ...b,
          [teamSide]: {
            ...targetTeam,
            players: newPlayers,
            name: realNames ? (hasDummy ? `${realNames} & Dummy` : realNames) : `Team`,
          },
        };
      })
    );
  };

  const updateWednesdayTeamName = (boardId: string, teamSide: 'teamA' | 'teamB', name: string) => {
    setWednesdayBoards(
      wednesdayBoards.map((b) => {
        if (b.id !== boardId) return b;
        return {
          ...b,
          [teamSide]: {
            ...b[teamSide],
            name,
          },
        };
      })
    );
  };

  // --- THURSDAY / TUESDAY DIVISION ACTIONS ---
  const addDivision = () => {
    const letter = String.fromCharCode(65 + divisions.length);
    const divName = `Division ${letter}`;
    setDivisions([
      ...divisions,
      {
        id: `div-${letter}-${Date.now()}`,
        name: divName,
        subtitle: `Custom Division ${letter}`,
        teams: [],
      },
    ]);
    setActiveDivIndex(divisions.length);
  };

  const removeDivision = (divIndex: number) => {
    if (divisions.length <= 1) {
      alert('You must have at least one division.');
      return;
    }
    const updated = divisions.filter((_, idx) => idx !== divIndex);
    setDivisions(updated);
    setActiveDivIndex(Math.max(0, divIndex - 1));
  };

  const renameDivision = (divIndex: number, newName: string) => {
    setDivisions(
      divisions.map((d, idx) => (idx === divIndex ? { ...d, name: newName } : d))
    );
  };

  // Add Thursday Doubles Team
  const addThursdayTeam = (divIndex: number) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        const nextTeamNum = d.teams.length + 1;
        return {
          ...d,
          teams: [
            ...d.teams,
            {
              id: `thurs-custom-t${nextTeamNum}-${Date.now()}`,
              name: `Team ${nextTeamNum}`,
              players: [],
            },
          ],
        };
      })
    );
  };

  const removeThursdayTeam = (divIndex: number, teamId: string) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.filter((t) => t.id !== teamId),
        };
      })
    );
  };

  const addPlayerToThursdayTeam = (divIndex: number, teamId: string, player: LeagueAttendancePlayer) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.map((t) => {
            if (t.id !== teamId) return t;
            if (t.players.some((p) => p.id === player.id)) return t;
            const newPlayers: ManualTeamPlayer[] = [
              ...t.players,
              { id: player.id, name: player.name, avatar: player.avatar || '🎯', isDummy: false },
            ];
            const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
            const hasDummy = newPlayers.some((p) => p.isDummy);
            return {
              ...t,
              players: newPlayers,
              name: realNames ? (hasDummy ? `${realNames} & Dummy` : realNames) : t.name,
            };
          }),
        };
      })
    );
  };

  const addDummyToThursdayTeam = (divIndex: number, teamId: string) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.map((t) => {
            if (t.id !== teamId) return t;
            const newPlayers: ManualTeamPlayer[] = [
              ...t.players,
              {
                id: `dummy-thurs-${teamId}-${Date.now()}`,
                name: '🤖 Dummy Player',
                avatar: '🤖',
                isDummy: true,
              },
            ];
            const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
            return {
              ...t,
              players: newPlayers,
              name: realNames ? `${realNames} & Dummy` : 'Dummy Team',
            };
          }),
        };
      })
    );
  };

  const removePlayerFromThursdayTeam = (divIndex: number, teamId: string, playerId: string) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.map((t) => {
            if (t.id !== teamId) return t;
            const newPlayers = t.players.filter((p) => p.id !== playerId);
            const realNames = newPlayers.filter((p) => !p.isDummy).map((p) => p.name).join(' & ');
            const hasDummy = newPlayers.some((p) => p.isDummy);
            return {
              ...t,
              players: newPlayers,
              name: realNames ? (hasDummy ? `${realNames} & Dummy` : realNames) : 'Team',
            };
          }),
        };
      })
    );
  };

  const updateThursdayTeamName = (divIndex: number, teamId: string, name: string) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
        };
      })
    );
  };

  // Add Tuesday Singles Player directly to Division
  const addPlayerToTuesdayDivision = (divIndex: number, player: LeagueAttendancePlayer) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        if (d.teams.some((t) => t.players[0]?.id === player.id)) return d;
        const newTeam: ManualTeam = {
          id: `tues-single-${player.id}`,
          name: player.name,
          players: [{ id: player.id, name: player.name, avatar: player.avatar || '🎯', isDummy: false }],
        };
        return {
          ...d,
          teams: [...d.teams, newTeam],
        };
      })
    );
  };

  const removePlayerFromTuesdayDivision = (divIndex: number, playerId: string) => {
    setDivisions(
      divisions.map((d, idx) => {
        if (idx !== divIndex) return d;
        return {
          ...d,
          teams: d.teams.filter((t) => t.players[0]?.id !== playerId),
        };
      })
    );
  };

  // Move Team/Player between Divisions
  const moveTeamToDivision = (sourceDivIdx: number, targetDivIdx: number, teamId: string) => {
    if (sourceDivIdx === targetDivIdx) return;
    const teamToMove = divisions[sourceDivIdx]?.teams.find((t) => t.id === teamId);
    if (!teamToMove) return;

    setDivisions(
      divisions.map((d, idx) => {
        if (idx === sourceDivIdx) {
          return { ...d, teams: d.teams.filter((t) => t.id !== teamId) };
        }
        if (idx === targetDivIdx) {
          return { ...d, teams: [...d.teams, teamToMove] };
        }
        return d;
      })
    );
  };

  // --- FINAL APPLY & GENERATE ---
  const handleApply = () => {
    if (leagueType === 'wednesday') {
      // Validate Wednesday Boards
      if (wednesdayBoards.length === 0) {
        alert('Please configure at least 1 board matchup for Wednesday.');
        return;
      }
      for (const b of wednesdayBoards) {
        if (b.teamA.players.length === 0 || b.teamB.players.length === 0) {
          alert(`Board ${b.boardNumber} is incomplete. Both teams must have at least 1 player.`);
          return;
        }
      }

      const wednesdayMatchups: BracketMatchup[] = wednesdayBoards.map((b, idx) => {
        const sizeA = b.teamA.players.length;
        const sizeB = b.teamB.players.length;
        const isEven = sizeA === sizeB;
        const tag = isEven
          ? ` (${sizeA}v${sizeB} Matchup • Even Teams)`
          : ` (${sizeA}v${sizeB} Matchup • Rotating Dummy)`;

        return {
          id: `bm-wed-board${idx + 1}-${Date.now()}-${idx}`,
          leagueType: 'wednesday' as const,
          division: 'Wednesday Teams',
          round: `Board ${idx + 1} • Head-to-Head Match${tag}`,
          entryA: { id: b.teamA.id, name: b.teamA.name, players: b.teamA.players },
          entryB: { id: b.teamB.id, name: b.teamB.name, players: b.teamB.players },
          scoreA: 0,
          scoreB: 0,
          status: 'pending' as const,
        };
      });

      const wedState: LeagueBracketsState = {
        isMultiDivision: false,
        divisions: [
          {
            name: 'Wednesday Teams',
            subtitle: '(Manual Head-to-Head Board Matchups • No Round Robin)',
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

      onApplyBrackets(wedState);
      onClose();
    } else {
      // Thursday or Tuesday
      if (divisions.length === 0) {
        alert('Please create at least one division.');
        return;
      }

      for (const d of divisions) {
        if (d.teams.length < 2) {
          alert(`${d.name} needs at least 2 ${leagueType === 'thursday' ? 'teams' : 'players'} to generate round-robin matchups.`);
          return;
        }
      }

      const maxDivTeamCount = Math.max(...divisions.map(d => d.teams.length), 0);
      const generatedDivisions: DivisionData[] = divisions.map((d, dIdx) => {
        const letter = String.fromCharCode(65 + dIdx);
        const divName = divisions.length === 1 ? d.name || 'Open Division' : d.name || `Division ${letter}`;
        const matchups = createRoundRobinMatchups(d.teams, divName, leagueType, {
          isSmallerDivision: d.teams.length < maxDivTeamCount,
          maxDivisionPlayerCount: maxDivTeamCount,
        });
        return {
          name: divName,
          subtitle: `Manual Selection (${d.teams.length} ${leagueType === 'thursday' ? 'Teams' : 'Players'})`,
          matchups,
        };
      });

      const isMulti = generatedDivisions.length > 1;
      const newState: LeagueBracketsState = {
        isMultiDivision: isMulti,
        divisions: generatedDivisions,
        divisionA: generatedDivisions[0]?.matchups || [],
        divisionB: generatedDivisions[1]?.matchups || [],
        divisionC: generatedDivisions[2]?.matchups || [],
        divisionD: generatedDivisions[3]?.matchups || [],
        divisionE: generatedDivisions[4]?.matchups || [],
        divisionF: generatedDivisions[5]?.matchups || [],
      };

      onApplyBrackets(newState);
      onClose();
    }
  };

  const totalAssigned = assignedPlayerIds.size;
  const totalCheckedIn = singlesRoster.filter((p) => p.checkedIn).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-inner">
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Manual Team & Division Selection
                </h3>
                <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3 h-3" /> Admin Only
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                {leagueType === 'wednesday'
                  ? 'Manually build Wednesday head-to-head teams and boards.'
                  : leagueType === 'thursday'
                  ? 'Manually create divisions and customize doubles pairs/trios.'
                  : 'Manually organize players into singles divisions.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrefillFromCheckedIn}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Auto-distribute checked-in players as a starting template so you can tweak"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Prefill from Check-Ins</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (leagueType === 'wednesday') setWednesdayBoards([]);
                else setDivisions([]);
              }}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>

            {leagueType !== 'wednesday' && (
              <button
                type="button"
                onClick={addDivision}
                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 font-extrabold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Division</span>
              </button>
            )}

            {leagueType === 'wednesday' && (
              <button
                type="button"
                onClick={addWednesdayBoard}
                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 font-extrabold rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Board Matchup</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg shadow-2xs">
              Assigned: <strong className="text-indigo-600">{totalAssigned}</strong> / {totalCheckedIn} Checked-In
            </span>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT 8 COLS: CONFIGURATION CANVAS */}
          <div className="lg:col-span-8 space-y-5">
            {/* WEDNESDAY: HEAD-TO-HEAD BOARD MATCHUPS */}
            {leagueType === 'wednesday' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Board Matchups ({wednesdayBoards.length} Boards)</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Max 3 players per team (4 only if odd player exception) • Even sizes play head-to-head
                  </span>
                </div>

                {wednesdayBoards.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500">
                    <p className="font-bold text-sm">No boards created yet.</p>
                    <p className="text-xs mt-1">Click "Prefill from Check-Ins" or "+ Add Board Matchup" to begin.</p>
                  </div>
                ) : (
                  wednesdayBoards.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-black text-xs uppercase tracking-wider rounded-md">
                          Board {b.boardNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 font-bold">
                            {b.teamA.players.length} vs {b.teamB.players.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeWednesdayBoard(b.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Remove this board"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Head to Head Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* TEAM A */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={b.teamA.name}
                              onChange={(e) => updateWednesdayTeamName(b.id, 'teamA', e.target.value)}
                              className="font-bold text-xs text-slate-900 bg-white px-2 py-1 rounded border border-slate-300 w-full mr-2 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              placeholder="Team A Name"
                            />
                            <button
                              type="button"
                              onClick={() => addDummyToWednesdayTeam(b.id, 'teamA')}
                              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[10px] rounded border border-amber-300 shrink-0 cursor-pointer flex items-center gap-1"
                              title="Add dummy player to balance"
                            >
                              <Bot className="w-3 h-3" /> Dummy
                            </button>
                          </div>

                          <div className="space-y-1.5 min-h-[50px]">
                            {b.teamA.players.map((p) => (
                              <div
                                key={p.id}
                                className={`flex items-center justify-between px-2.5 py-1 rounded-md text-xs border ${
                                  p.isDummy
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span>{p.avatar || '🎯'}</span>
                                  <span className="font-bold truncate">{p.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePlayerFromWednesdayTeam(b.id, 'teamA', p.id)}
                                  className="text-slate-400 hover:text-red-600 ml-1.5 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {b.teamA.players.length === 0 && (
                              <p className="text-[11px] text-slate-400 italic py-2 text-center">
                                Click unassigned player on the right to assign here
                              </p>
                            )}
                          </div>
                        </div>

                        {/* TEAM B */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <input
                              type="text"
                              value={b.teamB.name}
                              onChange={(e) => updateWednesdayTeamName(b.id, 'teamB', e.target.value)}
                              className="font-bold text-xs text-slate-900 bg-white px-2 py-1 rounded border border-slate-300 w-full mr-2 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                              placeholder="Team B Name"
                            />
                            <button
                              type="button"
                              onClick={() => addDummyToWednesdayTeam(b.id, 'teamB')}
                              className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[10px] rounded border border-amber-300 shrink-0 cursor-pointer flex items-center gap-1"
                              title="Add dummy player to balance"
                            >
                              <Bot className="w-3 h-3" /> Dummy
                            </button>
                          </div>

                          <div className="space-y-1.5 min-h-[50px]">
                            {b.teamB.players.map((p) => (
                              <div
                                key={p.id}
                                className={`flex items-center justify-between px-2.5 py-1 rounded-md text-xs border ${
                                  p.isDummy
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span>{p.avatar || '🎯'}</span>
                                  <span className="font-bold truncate">{p.name}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePlayerFromWednesdayTeam(b.id, 'teamB', p.id)}
                                  className="text-slate-400 hover:text-red-600 ml-1.5 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            {b.teamB.players.length === 0 && (
                              <p className="text-[11px] text-slate-400 italic py-2 text-center">
                                Click unassigned player on the right to assign here
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* THURSDAY / TUESDAY: DIVISIONS CANVAS */}
            {leagueType !== 'wednesday' && (
              <div className="space-y-4">
                {/* Division Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
                  {divisions.map((d, dIdx) => (
                    <div
                      key={d.id}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg border-t border-x cursor-pointer transition-all ${
                        activeDivIndex === dIdx
                          ? 'bg-white border-slate-300 font-black text-indigo-700 shadow-xs'
                          : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'
                      }`}
                      onClick={() => setActiveDivIndex(dIdx)}
                    >
                      <span className="text-xs">{d.name}</span>
                      <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-mono">
                        {d.teams.length}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Active Division Panel */}
                {divisions[activeDivIndex] && (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={divisions[activeDivIndex].name}
                          onChange={(e) => renameDivision(activeDivIndex, e.target.value)}
                          className="font-black text-sm text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-300 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          placeholder="Division Name"
                        />
                        <span className="text-xs text-slate-500 font-bold">
                          ({divisions[activeDivIndex].teams.length} {leagueType === 'thursday' ? 'Doubles Teams' : 'Singles'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {leagueType === 'thursday' && (
                          <button
                            type="button"
                            onClick={() => addThursdayTeam(activeDivIndex)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Team</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeDivision(activeDivIndex)}
                          className="px-2.5 py-1 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Delete Division
                        </button>
                      </div>
                    </div>

                    {/* Content inside Division */}
                    {leagueType === 'thursday' ? (
                      /* Thursday: Doubles Teams inside Division */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {divisions[activeDivIndex].teams.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={t.name}
                                onChange={(e) => updateThursdayTeamName(activeDivIndex, t.id, e.target.value)}
                                className="font-extrabold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 w-full focus:outline-hidden"
                                placeholder="Team Name"
                              />
                              <button
                                type="button"
                                onClick={() => addDummyToThursdayTeam(activeDivIndex, t.id)}
                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded border border-amber-300 shrink-0 cursor-pointer"
                                title="Add Dummy partner"
                              >
                                +🤖 Dummy
                              </button>
                              <button
                                type="button"
                                onClick={() => removeThursdayTeam(activeDivIndex, t.id)}
                                className="text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Delete Team"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Players in Team */}
                            <div className="space-y-1.5 min-h-[40px]">
                              {t.players.map((p) => (
                                <div
                                  key={p.id}
                                  className={`flex items-center justify-between px-2.5 py-1 rounded-md text-xs border ${
                                    p.isDummy
                                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                                      : 'bg-white border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span>{p.avatar || '🎯'}</span>
                                    <span className="font-bold truncate">{p.name}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removePlayerFromThursdayTeam(activeDivIndex, t.id, p.id)}
                                    className="text-slate-400 hover:text-red-600 ml-1.5 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                              {t.players.length === 0 && (
                                <p className="text-[11px] text-slate-400 italic py-1 text-center">
                                  Click unassigned player on the right to add
                                </p>
                              )}
                            </div>

                            {/* Move Team to another division if multi-division */}
                            {divisions.length > 1 && (
                              <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-bold">Move team to:</span>
                                <div className="flex items-center gap-1">
                                  {divisions.map((dOther, oIdx) => {
                                    if (oIdx === activeDivIndex) return null;
                                    return (
                                      <button
                                        key={dOther.id}
                                        type="button"
                                        onClick={() => moveTeamToDivision(activeDivIndex, oIdx, t.id)}
                                        className="px-2 py-0.5 bg-white border border-slate-300 hover:bg-indigo-50 hover:text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        {dOther.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Tuesday: Singles Players inside Division */
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {divisions[activeDivIndex].teams.map((t) => {
                            const player = t.players[0];
                            if (!player) return null;
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span>{player.avatar || '🎯'}</span>
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {player.name}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {divisions.length > 1 && (
                                    <select
                                      className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 font-bold text-slate-700 cursor-pointer"
                                      value={activeDivIndex}
                                      onChange={(e) =>
                                        moveTeamToDivision(activeDivIndex, parseInt(e.target.value, 10), t.id)
                                      }
                                    >
                                      {divisions.map((dOther, oIdx) => (
                                        <option key={dOther.id} value={oIdx}>
                                          {oIdx === activeDivIndex ? 'In this division' : `Move to ${dOther.name}`}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removePlayerFromTuesdayDivision(activeDivIndex, player.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                    title="Remove from division"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {divisions[activeDivIndex].teams.length === 0 && (
                          <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            No players in {divisions[activeDivIndex].name} yet. Click unassigned players on the right to assign them.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT 4 COLS: UNASSIGNED PLAYERS POOL */}
          <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-3.5 flex flex-col h-full max-h-[550px]">
            <div className="space-y-2 pb-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Available Players ({unassignedCandidates.length})</span>
                </h4>
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFilterMode('checkedIn')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      filterMode === 'checkedIn'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Checked-In
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    All Roster
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player name..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* List of unassigned players */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pt-2 pr-1">
              {unassignedCandidates.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{p.avatar || '🎯'}</span>
                    <span className="font-bold text-slate-900 truncate">{p.name}</span>
                    {p.checkedIn && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Checked in" />
                    )}
                  </div>

                  {/* Quick Assign Action */}
                  {leagueType === 'wednesday' ? (
                    <div className="flex items-center gap-1">
                      {wednesdayBoards.map((b) => (
                        <div key={b.id} className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => addPlayerToWednesdayTeam(b.id, 'teamA', p)}
                            className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-mono text-[10px] font-bold rounded border border-indigo-200 cursor-pointer transition-colors"
                            title={`Add to Board ${b.boardNumber} - Team A`}
                          >
                            B{b.boardNumber}A
                          </button>
                          <button
                            type="button"
                            onClick={() => addPlayerToWednesdayTeam(b.id, 'teamB', p)}
                            className="px-1.5 py-0.5 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 font-mono text-[10px] font-bold rounded border border-purple-200 cursor-pointer transition-colors"
                            title={`Add to Board ${b.boardNumber} - Team B`}
                          >
                            B{b.boardNumber}B
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : leagueType === 'thursday' ? (
                    <div className="flex items-center gap-1">
                      {divisions[activeDivIndex]?.teams.slice(0, 3).map((t, tIdx) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addPlayerToThursdayTeam(activeDivIndex, t.id, p)}
                          className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 font-mono text-[10px] font-bold rounded border border-indigo-200 cursor-pointer transition-colors"
                          title={`Add to ${t.name}`}
                        >
                          T{tIdx + 1}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addPlayerToTuesdayDivision(activeDivIndex, p)}
                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded shadow-2xs cursor-pointer transition-colors"
                    >
                      + Assign
                    </button>
                  )}
                </div>
              ))}

              {unassignedCandidates.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  {searchQuery ? 'No matching players found' : 'All selected players are assigned!'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {totalCheckedIn > totalAssigned ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {totalCheckedIn - totalAssigned} checked-in attendee{totalCheckedIn - totalAssigned > 1 ? 's' : ''} not yet assigned to a team/division.
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All checked-in attendees are assigned!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-900 hover:bg-indigo-900 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Confirm & Generate Brackets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
