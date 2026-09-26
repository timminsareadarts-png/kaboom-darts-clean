import { GameMode, InOutMode, MatchState, MedleyGameConfig, Player } from '../types';
import { recordTuesdayLegStats, recordWednesdayLegStats, recordThursdayLegStats, updateLeaguePoints } from './leagueHelper';

export const generateRandom9Targets = (): number[] => {
  const nums: number[] = [];
  while (nums.length < 9) {
    const r = Math.floor(Math.random() * 20) + 1;
    if (!nums.includes(r)) nums.push(r);
  }
  return nums.sort((a, b) => a - b);
};

export const TUESDAY_MEDLEY_CONFIGS: MedleyGameConfig[] = [
  {
    legNumber: 1,
    title: 'Game 1: 301 Double In / Double Out',
    gameMode: 'X01',
    startScore: 301,
    inMode: 'Double',
    outMode: 'Double',
  },
  {
    legNumber: 2,
    title: 'Game 2: 501 Straight In / Double Out',
    gameMode: 'X01',
    startScore: 501,
    inMode: 'Straight',
    outMode: 'Double',
  },
  {
    legNumber: 3,
    title: 'Game 3: Cricket (Doubles & Triples)',
    gameMode: 'CRICKET',
    startScore: 0,
    inMode: 'Straight',
    outMode: 'Straight',
  },
];

export const THURSDAY_MEDLEY_CONFIGS: MedleyGameConfig[] = TUESDAY_MEDLEY_CONFIGS;

export const WEDNESDAY_MEDLEY_CONFIGS: MedleyGameConfig[] = [
  {
    legNumber: 1,
    title: 'Game 1: 1001 Straight In / Double Out',
    gameMode: 'X01',
    startScore: 1001,
    inMode: 'Straight',
    outMode: 'Double',
  },
  {
    legNumber: 2,
    title: 'Game 2: Baseball (9 Innings)',
    gameMode: 'BASEBALL',
    startScore: 0,
    inMode: 'Straight',
    outMode: 'Straight',
  },
  {
    legNumber: 3,
    title: 'Game 3: 701 Double In / Double Out',
    gameMode: 'X01',
    startScore: 701,
    inMode: 'Double',
    outMode: 'Double',
  },
  {
    legNumber: 4,
    title: 'Game 4: Fives (101 Target Goal)',
    gameMode: 'FIVES',
    startScore: 101,
    inMode: 'Straight',
    outMode: 'Straight',
  },
  {
    legNumber: 5,
    title: 'Game 5: Cricket',
    gameMode: 'CRICKET',
    startScore: 0,
    inMode: 'Straight',
    outMode: 'Straight',
  },
  {
    legNumber: 6,
    title: 'Game 6 (Optional): 1001 Straight In / Double Out',
    gameMode: 'X01',
    startScore: 1001,
    inMode: 'Straight',
    outMode: 'Double',
    isOptional: true,
  },
];

/**
 * Checks if a match is a Wednesday League match or configured Medley match.
 */
export function isWednesdayLeagueOrMedley(matchState: MatchState): boolean {
  return (
    matchState.settings.leagueType === 'wednesday' ||
    matchState.settings.isMedley === true ||
    matchState.settings.gameMode === 'MEDLEY'
  );
}

/**
 * Retrieves the Medley configuration for a specific leg number.
 */
export function getMedleyConfigForLeg(
  matchState: MatchState,
  legNumber: number
): MedleyGameConfig | undefined {
  const isWed =
    matchState.settings.leagueType === 'wednesday' ||
    matchState.settings.bracketMatchId?.toLowerCase().includes('wed') ||
    matchState.matchCode?.toUpperCase().startsWith('WED-') ||
    matchState.settings.matchCode?.toUpperCase().startsWith('WED-');

  const configs = isWed
    ? WEDNESDAY_MEDLEY_CONFIGS
    : (matchState.settings.medleyConfigs && matchState.settings.medleyConfigs.length > 0
        ? matchState.settings.medleyConfigs
        : (matchState.settings.leagueType === 'tuesday'
            ? TUESDAY_MEDLEY_CONFIGS
            : matchState.settings.leagueType === 'thursday'
            ? THURSDAY_MEDLEY_CONFIGS
            : WEDNESDAY_MEDLEY_CONFIGS));

  return configs.find((c) => c.legNumber === legNumber) || configs[legNumber - 1];
}

export function getMedleyGameForLeg(
  matchState: MatchState,
  legNumber: number
): MedleyGameConfig | undefined {
  return getMedleyConfigForLeg(matchState, legNumber);
}

/**
 * Checks if a leg is the final optional game (Game 6) that requires confirmation.
 */
export function isOptionalFinalLeg(matchState: MatchState, nextLegNumber?: number): boolean {
  const leg = nextLegNumber ?? (matchState.currentLeg + 1);
  const config = getMedleyConfigForLeg(matchState, leg);
  return config?.isOptional === true || leg === 6;
}

/**
 * Transitions match state to the next game in the Medley series.
 */
export function buildNextMedleyMatchState(
  matchState: MatchState,
  winnerId: string,
  legRecord: any,
  explicitNextLegNum?: number
): MatchState {
  const nextLegNum = explicitNextLegNum ?? (matchState.currentLeg + 1);
  const isWed =
    matchState.settings.leagueType === 'wednesday' ||
    matchState.settings.bracketMatchId?.toLowerCase().includes('wed') ||
    matchState.matchCode?.toUpperCase().startsWith('WED-') ||
    matchState.settings.matchCode?.toUpperCase().startsWith('WED-');

  const configs = isWed
    ? WEDNESDAY_MEDLEY_CONFIGS
    : (matchState.settings.medleyConfigs && matchState.settings.medleyConfigs.length > 0
        ? matchState.settings.medleyConfigs
        : (matchState.settings.leagueType === 'tuesday'
            ? TUESDAY_MEDLEY_CONFIGS
            : matchState.settings.leagueType === 'thursday'
            ? THURSDAY_MEDLEY_CONFIGS
            : WEDNESDAY_MEDLEY_CONFIGS));

  if (nextLegNum > configs.length) {
    return finalizeMedleyMatchState(matchState, winnerId, legRecord);
  }

  const nextConfig = getMedleyConfigForLeg(matchState, nextLegNum) || (isWed
    ? WEDNESDAY_MEDLEY_CONFIGS[nextLegNum - 1]
    : {
        legNumber: nextLegNum,
        title: `Game ${nextLegNum}`,
        gameMode: 'X01' as GameMode,
        startScore: 501,
        inMode: 'Straight' as InOutMode,
        outMode: 'Double' as InOutMode,
      });

  const nextStarterIndex = 1 - matchState.starterPlayerIndex;

  // Record Tuesday, Wednesday, or Thursday league stats and individual points
  if (legRecord) {
    if (matchState.settings.leagueType === 'tuesday') {
      try {
        recordTuesdayLegStats(legRecord, matchState);
        const winner = matchState.players.find(p => p.id === winnerId);
        const loser = matchState.players.find(p => p.id !== winnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'tuesday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Tuesday Medley leg stats', e);
      }
    } else if (matchState.settings.leagueType === 'thursday') {
      try {
        recordThursdayLegStats(legRecord, matchState);
        const winner = matchState.players.find(p => p.id === winnerId);
        const loser = matchState.players.find(p => p.id !== winnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'thursday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Thursday Medley leg stats', e);
      }
    } else if (matchState.settings.leagueType === 'wednesday') {
      try {
        recordWednesdayLegStats(legRecord, matchState);
        const winner = matchState.players.find(p => p.id === winnerId);
        const loser = matchState.players.find(p => p.id !== winnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'wednesday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Wednesday Medley leg stats', e);
      }
    }
  }

  const resetPlayers: Player[] = matchState.players.map((p) => {
    const isWinner = p.id === winnerId;
    const newLegsWon = isWinner ? p.legsWon + 1 : p.legsWon;

    return {
      ...p,
      legsWon: newLegsWon,
      currentScore: nextConfig.gameMode === 'X01' ? nextConfig.startScore : 0,
      cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0, doubles: 0, triples: 0 },
      cricketPoints: 0,
      baseballHits: {},
      baseballScore: 0,
      fivesScore: nextConfig.gameMode === 'FIVES' ? (nextConfig.startScore || 101) : undefined,
      fivesPointsEarned: 0,
      first9Darts: [],
      currentSubPlayerIndex: 0,
      hasMarkedFirstScore: false,
      lastRealShooterIndex: undefined,
      stats: {
        ...p.stats,
        dartsThrown: 0,
      },
    };
  });

  const updatedMatchState: MatchState = {
    ...matchState,
    status: 'active',
    players: resetPlayers,
    currentLeg: nextLegNum,
    currentGameMode: nextConfig.gameMode,
    currentStartScore: nextConfig.startScore,
    currentInMode: nextConfig.inMode,
    currentOutMode: nextConfig.outMode,
    activePlayerIndex: nextStarterIndex,
    starterPlayerIndex: nextStarterIndex,
    settings: {
      ...matchState.settings,
      medleyConfigs: configs,
      legsToWin: isWed ? 6 : (matchState.settings.legsToWin || configs.length),
      legsPerSet: isWed ? 6 : (matchState.settings.legsPerSet || configs.length),
      gameMode: nextConfig.gameMode,
      startScore: nextConfig.startScore,
      inMode: nextConfig.inMode,
      outMode: nextConfig.outMode,
      baseballTargets: nextConfig.gameMode === 'BASEBALL' ? generateRandom9Targets() : matchState.settings.baseballTargets,
      fivesTarget: nextConfig.gameMode === 'FIVES' ? (nextConfig.startScore || 101) : matchState.settings.fivesTarget,
    },
    completedLegs: [...matchState.completedLegs, legRecord],
    history: [],
    updatedAt: Date.now(),
  };

  return updatedMatchState;
}

/**
 * Finalizes the match when players decide to end the match (e.g. after Game 5 Cricket or when all legs finish).
 */
export function finalizeMedleyMatchState(
  matchState: MatchState,
  lastWinnerId?: string,
  lastLegRecord?: any
): MatchState {
  if (lastLegRecord) {
    if (matchState.settings.leagueType === 'tuesday') {
      try {
        recordTuesdayLegStats(lastLegRecord, matchState);
        const winner = matchState.players.find(p => p.id === lastWinnerId);
        const loser = matchState.players.find(p => p.id !== lastWinnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'tuesday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Tuesday Medley final leg stats', e);
      }
    } else if (matchState.settings.leagueType === 'thursday') {
      try {
        recordThursdayLegStats(lastLegRecord, matchState);
        const winner = matchState.players.find(p => p.id === lastWinnerId);
        const loser = matchState.players.find(p => p.id !== lastWinnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'thursday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Thursday Medley final leg stats', e);
      }
    } else if (matchState.settings.leagueType === 'wednesday') {
      try {
        recordWednesdayLegStats(lastLegRecord, matchState);
        const winner = matchState.players.find(p => p.id === lastWinnerId);
        const loser = matchState.players.find(p => p.id !== lastWinnerId);
        if (winner && loser) {
          updateLeaguePoints(winner.name, loser.name, 'wednesday', matchState.players);
        }
      } catch (e) {
        console.error('Error recording Wednesday Medley final leg stats', e);
      }
    }
  }

  const updatedPlayers = matchState.players.map((p) => {
    if (lastWinnerId && p.id === lastWinnerId) {
      return { ...p, legsWon: p.legsWon + 1 };
    }
    return p;
  });

  const p1 = updatedPlayers[0];
  const p2 = updatedPlayers[1];

  let matchWinnerId: string | undefined = undefined;
  if (p1.legsWon > p2.legsWon) {
    matchWinnerId = p1.id;
  } else if (p2.legsWon > p1.legsWon) {
    matchWinnerId = p2.id;
  }

  const completedLegs = lastLegRecord
    ? [...matchState.completedLegs, lastLegRecord]
    : matchState.completedLegs;

  return {
    ...matchState,
    status: 'completed',
    winnerId: matchWinnerId,
    players: updatedPlayers,
    completedLegs,
    history: [],
    updatedAt: Date.now(),
  };
}
