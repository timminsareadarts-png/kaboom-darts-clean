import { CricketMarkRecord, Player } from '../types';

export interface CricketDartHit {
  sector: number | 'doubles' | 'triples' | 'miss'; // 15-20, 25 (Bull), 'doubles', 'triples', 'miss'
  multiplier: number; // 1 = hit (X), 0 = miss
  label?: string;
}

export function processCricketTurn(
  activePlayer: Player,
  opponentPlayer: Player,
  hits: CricketDartHit[],
  isNoPoints: boolean = true
) {
  // If every dart in this turn is a miss, explicitly return existing marks with zero additions
  const isAllMisses = hits.length > 0 && hits.every((h) => h.sector === 'miss' || !h.multiplier || h.multiplier <= 0);
  if (isAllMisses) {
    const existingMarks: CricketMarkRecord = {
      15: activePlayer.cricketMarks?.[15] || 0,
      16: activePlayer.cricketMarks?.[16] || 0,
      17: activePlayer.cricketMarks?.[17] || 0,
      18: activePlayer.cricketMarks?.[18] || 0,
      19: activePlayer.cricketMarks?.[19] || 0,
      20: activePlayer.cricketMarks?.[20] || 0,
      25: activePlayer.cricketMarks?.[25] || 0,
      doubles: activePlayer.cricketMarks?.doubles || 0,
      triples: activePlayer.cricketMarks?.triples || 0,
    };
    return {
      newMarksActive: existingMarks,
      newPointsActive: isNoPoints ? 0 : (activePlayer.cricketPoints || 0),
      newPointsOpponent: isNoPoints ? 0 : (opponentPlayer.cricketPoints || 0),
      totalMarksThisTurn: 0,
      isWinner: false,
    };
  }

  const newMarksActive: CricketMarkRecord = {
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
    25: 0,
    doubles: 0,
    triples: 0,
    ...activePlayer.cricketMarks,
  };

  let newPointsActive = isNoPoints ? 0 : activePlayer.cricketPoints;
  let newPointsOpponent = isNoPoints ? 0 : opponentPlayer.cricketPoints;

  let totalMarksThisTurn = 0;

  for (const hit of hits) {
    const sec = hit.sector;
    const count = typeof hit.multiplier === 'number' ? hit.multiplier : 1;

    // A miss dart (multiplier 0 or sector 'miss') marks zero segments and contributes zero marks
    if (count <= 0 || sec === 'miss') {
      continue;
    }

    if (sec === 'doubles' || sec === 'triples') {
      const currentMarks = newMarksActive[sec] || 0;
      newMarksActive[sec] = Math.min(3, currentMarks + count);
      totalMarksThisTurn += count;
      continue;
    }

    const num = sec as keyof CricketMarkRecord;
    if (typeof num === 'number' && ((num >= 15 && num <= 20) || num === 25)) {
      const currentMarks = newMarksActive[num] || 0;
      newMarksActive[num] = Math.min(3, currentMarks + count);
      totalMarksThisTurn += count;
    }
  }

  // Check victory condition: All 9 segments must have all 3 squares marked with an X (3 marks each)
  // Required segments: 20, 19, 18, 17, 16, 15, Bull (25), Doubles, Triples
  const cricketNumbers: (keyof CricketMarkRecord)[] = [20, 19, 18, 17, 16, 15, 25, 'doubles', 'triples'];
  const activeAllClosed = cricketNumbers.every((n) => (newMarksActive[n] || 0) >= 3);
  const isWinner = isNoPoints ? activeAllClosed : activeAllClosed && newPointsActive >= newPointsOpponent;

  return {
    newMarksActive,
    newPointsActive,
    newPointsOpponent,
    totalMarksThisTurn,
    isWinner,
  };
}

export function getCricketMarkSymbol(marks: number = 0): string {
  if (marks >= 3) return 'X X X';
  if (marks === 2) return 'X X';
  if (marks === 1) return 'X';
  return '-';
}

