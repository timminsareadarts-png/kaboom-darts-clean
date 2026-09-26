import fs from "fs";
import path from "path";

interface Player {
  id: string;
  name: string;
  avatar: string;
  checkedIn?: boolean;
}

interface MatchEntry {
  id?: string;
  name: string;
  players: Player[];
}

interface BracketMatchup {
  id: string;
  leagueType: string;
  division: string;
  round: string;
  entryA: MatchEntry;
  entryB: MatchEntry;
  scoreA: number;
  scoreB: number;
  status: 'pending' | 'in_progress' | 'completed';
  winnerName?: string;
  isDummyOpponent?: boolean;
  isReplayRound?: boolean;
  isBye?: boolean;
}

interface DivisionData {
  name: string;
  subtitle: string;
  matchups: BracketMatchup[];
}

const STORE_PATH = path.join(process.cwd(), "data", "venue_store.json");
const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

// 1. Filter out Player 1 and Player 2
const cleanAttendance = (store.attendance?.tuesday || []).filter(
  (p: any) =>
    p &&
    p.id !== 'p-player 1' &&
    p.id !== 'p2' &&
    !['player 1', 'player 2'].includes(String(p.name || '').toLowerCase().trim())
);

console.log(`[Restore] Filtered attendance. Count is ${cleanAttendance.length}`);

// Map of player objects from attendance
const playerMap = new Map<string, Player>();
cleanAttendance.forEach((p: Player) => {
  playerMap.set(p.name.toLowerCase().trim(), p);
});

const getPlayer = (name: string): Player => {
  const found = playerMap.get(name.toLowerCase().trim());
  if (found) return found;
  return {
    id: `p-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    avatar: '🎯',
    checkedIn: true,
  };
};

const makeEntry = (name: string, prefix: string, idx: number): MatchEntry => {
  const p = getPlayer(name);
  return {
    id: `e-tuesday-${prefix}-${idx}`,
    name,
    players: [p],
  };
};

const dummyEntry = (divName: string): MatchEntry => ({
  id: `e-dummy-${divName.replace(/\s+/g, '')}`,
  name: '🤖 Dummy Player',
  players: [
    {
      id: `p-dummy-${divName.replace(/\s+/g, '')}`,
      name: '🤖 Dummy Player',
      avatar: '🤖',
    },
  ],
});

// Helper for 4-player divisions
const make4PlayerDivision = (divName: string, letter: string, players: [string, string, string, string]): DivisionData => {
  const [p0, p1, p2, p3] = players;
  const e0 = makeEntry(p0, letter, 0);
  const e1 = makeEntry(p1, letter, 1);
  const e2 = makeEntry(p2, letter, 2);
  const e3 = makeEntry(p3, letter, 3);

  const matchups: BracketMatchup[] = [
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r1-m1`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 1',
      entryA: e0,
      entryB: e1,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r1-m2`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 1',
      entryA: e2,
      entryB: e3,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r2-m3`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 2',
      entryA: e2,
      entryB: e1,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r2-m4`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 2',
      entryA: e3,
      entryB: e0,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r3-m5`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 3',
      entryA: e3,
      entryB: e1,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r3-m6`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 3',
      entryA: e0,
      entryB: e2,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
  ];

  return {
    name: divName,
    subtitle: `(Round Robin • ${divName})`,
    matchups,
  };
};

// Helper for 3-player odd equalizer divisions
const make3PlayerEqualizerDivision = (
  divName: string,
  letter: string,
  players: [string, string, string] // [byeTeam, realA, realB]
): DivisionData => {
  const [byePlayer, realPlayerA, realPlayerB] = players;
  const eBye = makeEntry(byePlayer, letter, 0);
  const eA = makeEntry(realPlayerA, letter, 1);
  const eB = makeEntry(realPlayerB, letter, 2);
  const dummy = dummyEntry(divName);

  const matchups: BracketMatchup[] = [
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r1-m1`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 1 (Bye plays Dummy)',
      entryA: eBye,
      entryB: dummy,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
      isDummyOpponent: true,
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r1-m2`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 1',
      entryA: eA,
      entryB: eB,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r2-m3`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 2',
      entryA: eB,
      entryB: eBye,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r3-m4`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 3',
      entryA: eBye,
      entryB: eA,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    },
    {
      id: `bm-tuesday-${divName.replace(/\s+/g, '')}-r4-m5`,
      leagueType: 'tuesday',
      division: divName,
      round: 'Round Robin - Round 4 (Round 1 Replay)',
      entryA: eA,
      entryB: eB,
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
      isReplayRound: true,
    },
  ];

  return {
    name: divName,
    subtitle: `(Round Robin • ${divName})`,
    matchups,
  };
};

const divA = make4PlayerDivision('Division A', 'A', ['Ray', 'Guy', 'Joy Anne', 'Sylvain']);
const divB = make4PlayerDivision('Division B', 'B', ['Fern', 'Floyd', 'Mark', 'Dan M']);
const divC = make4PlayerDivision('Division C', 'C', ['Dan C', 'Griffin', 'Wayne', 'Donny']);
const divD = make4PlayerDivision('Division D', 'D', ['Crystal', 'Ron', 'Berdine', 'Trisha']);
const divE = make4PlayerDivision('Division E', 'E', ['Ryan', 'Jack D', 'Natalie', 'Braydin']);
const divF = make3PlayerEqualizerDivision('Division F', 'F', ['Amber', 'Dale', 'Lynn']);
const divG = make4PlayerDivision('Division G', 'G', ['Stan', 'Claude', 'Kyle', 'Lorriane']);
const divH = make4PlayerDivision('Division H', 'H', ['Celeste', 'Brian', 'Jack', 'Maurice']);
const divI = make3PlayerEqualizerDivision('Division I', 'I', ['Marie', 'Clem', 'Harold']);
const divJ = make3PlayerEqualizerDivision('Division J', 'J', ['Meghan', 'Lor', 'Dawn']);

const divisions = [divA, divB, divC, divD, divE, divF, divG, divH, divI, divJ];

const bracketsTuesday = {
  isMultiDivision: true,
  divisions,
  divisionA: divA.matchups,
  divisionB: divB.matchups,
  divisionC: divC.matchups,
  divisionD: divD.matchups,
  divisionE: divE.matchups,
  divisionF: divF.matchups,
  divisionG: divG.matchups,
  divisionH: divH.matchups,
  divisionI: divI.matchups,
  divisionJ: divJ.matchups,
};

async function run() {
  console.log("[Restore] Fetching current venue state...");
  const currRes = await fetch("http://localhost:3000/api/venue-state");
  const currData = await currRes.json();
  const currentResetAt = Number(currData.data?.lastResetAt || currData.lastResetAt || 0);
  console.log("[Restore] currentResetAt:", currentResetAt);

  console.log("[Restore] Sending restored brackets to server...");

  // Send to API
  const res1 = await fetch("http://localhost:3000/api/brackets/tuesday", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brackets: bracketsTuesday }),
  });
  console.log("[Restore] /api/brackets/tuesday response:", res1.status);

  const res2 = await fetch("http://localhost:3000/api/venue-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attendance: { tuesday: cleanAttendance },
      brackets: { tuesday: bracketsTuesday },
      forceUpdateBrackets: true,
      lastResetAt: currentResetAt,
    }),
  });
  console.log("[Restore] /api/venue-state response:", res2.status);

  // Update file directly as well
  const freshStore = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  freshStore.attendance = freshStore.attendance || {};
  freshStore.attendance.tuesday = cleanAttendance;
  freshStore.brackets = freshStore.brackets || {};
  freshStore.brackets.tuesday = bracketsTuesday;
  freshStore.updatedAt = Date.now();
  fs.writeFileSync(STORE_PATH, JSON.stringify(freshStore, null, 2), "utf8");
  console.log("[Restore] Updated venue_store.json on disk.");

  console.log("[Restore] Complete!");
}

run().catch((e) => {
  console.error("[Restore] Error:", e);
  process.exit(1);
});
