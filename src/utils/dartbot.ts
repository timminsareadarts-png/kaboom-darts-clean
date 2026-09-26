import { getCheckoutRoute } from '../data/checkouts';

export interface DartBotThrowResult {
  score: number;
  dartsUsed: number;
  isBust: boolean;
  dartsDetail: string[];
}

export function generateDartBotTurnX01(
  currentScore: number,
  botLevel: number = 5,
  doubleOut: boolean = true
): DartBotThrowResult {
  // Target average mapped from botLevel (1-10)
  // Level 1: avg 30, Level 5: avg 60, Level 10: avg 100
  const targetAvg = 25 + botLevel * 7.5; // level 1: 32.5, level 10: 100
  const targetPerDart = targetAvg / 3;

  let scoreLeft = currentScore;
  let turnScore = 0;
  let dartsUsed = 0;
  const dartsDetail: string[] = [];

  for (let d = 1; d <= 3; d++) {
    dartsUsed = d;

    // Check if in checkout range with double out
    if (doubleOut && scoreLeft <= 170) {
      const route = getCheckoutRoute(scoreLeft);
      if (route && route.combination.length > 0) {
        // Probability of hitting checkout target scales with bot level
        const hitProbability = 0.15 + (botLevel / 10) * 0.65; // 0.22 at lvl 1, 0.80 at lvl 10
        if (Math.random() < hitProbability) {
          const dartTarget = route.combination[0];
          dartsDetail.push(dartTarget);
          const dartVal = parseDartValue(dartTarget);
          
          if (scoreLeft - dartVal === 0) {
            turnScore += dartVal;
            scoreLeft = 0;
            break; // Checkout hit!
          } else if (scoreLeft - dartVal < 2 && doubleOut) {
            // Bust
            return {
              score: 0,
              dartsUsed: d,
              isBust: true,
              dartsDetail: [...dartsDetail.slice(0, d - 1), 'BUST'],
            };
          } else {
            turnScore += dartVal;
            scoreLeft -= dartVal;
            continue;
          }
        }
      }
    }

    // Regular scoring throw aimed at T20 or T19
    const aimAtT20 = Math.random() > 0.15;
    const isTripleHit = Math.random() < (0.15 + botLevel * 0.05); // T20 chance
    const isSingleHit = Math.random() < 0.70;
    
    let dartVal = 0;
    let label = '';

    if (aimAtT20) {
      if (isTripleHit) {
        dartVal = 60;
        label = 'T20';
      } else if (isSingleHit) {
        dartVal = 20;
        label = 'S20';
      } else {
        // Miss into 1 or 5
        const missVal = Math.random() > 0.5 ? 1 : 5;
        dartVal = missVal;
        label = `S${missVal}`;
      }
    } else {
      if (isTripleHit) {
        dartVal = 57;
        label = 'T19';
      } else if (isSingleHit) {
        dartVal = 19;
        label = 'S19';
      } else {
        const missVal = Math.random() > 0.5 ? 3 : 7;
        dartVal = missVal;
        label = `S${missVal}`;
      }
    }

    // Check bust condition
    if (scoreLeft - dartVal < 0 || (doubleOut && scoreLeft - dartVal === 1)) {
      return {
        score: 0,
        dartsUsed: d,
        isBust: true,
        dartsDetail: [...dartsDetail, 'BUST'],
      };
    } else if (scoreLeft - dartVal === 0) {
      // Must hit double if double out
      if (doubleOut && !label.startsWith('D') && label !== 'BULL') {
        // Did not finish on double -> Bust
        return {
          score: 0,
          dartsUsed: d,
          isBust: true,
          dartsDetail: [...dartsDetail, 'BUST'],
        };
      }
      turnScore += dartVal;
      scoreLeft = 0;
      dartsDetail.push(label);
      break;
    } else {
      turnScore += dartVal;
      scoreLeft -= dartVal;
      dartsDetail.push(label);
    }
  }

  return {
    score: turnScore,
    dartsUsed,
    isBust: false,
    dartsDetail,
  };
}

function parseDartValue(label: string): number {
  if (label === 'BULL') return 50;
  if (label === '25') return 25;
  if (label.startsWith('T')) return parseInt(label.slice(1)) * 3;
  if (label.startsWith('D')) return parseInt(label.slice(1)) * 2;
  if (label.startsWith('S')) return parseInt(label.slice(1));
  return parseInt(label) || 0;
}
