import { Player, TeamSubPlayer } from '../types';
import { announcer } from './audio';

export interface ShooterInfo {
  shooterName: string;
  isDummyTurn: boolean;
  dummyRotatedPlayerName?: string;
  shotNumber?: number;
  avatar: string;
  displayFull: string;
  subPlayerIndex: number;
  subPlayerId?: string;
  teamName?: string;
  nextShooterName?: string;
  isDummyBenched?: boolean;
}

export interface ShooterOptions {
  ignoreDummy?: boolean;
  gameMode?: string;
  remainingScore?: number;
  inMode?: 'Straight' | 'Double' | 'Master';
  startScore?: number;
  hasMarkedFirstScore?: boolean;
  justMarkedFirstScore?: boolean;
}

export function isDummyIgnored(options?: ShooterOptions | boolean | string): boolean {
  if (options === true) return true;
  if (typeof options === 'string') {
    return options.toUpperCase() === 'CRICKET';
  }
  if (options && typeof options === 'object') {
    if (options.ignoreDummy) return true;
    if (options.gameMode && options.gameMode.toUpperCase() === 'CRICKET') return true;
  }
  return false;
}

/**
 * Determines whether the Dummy is currently active in the team's rotation.
 * 
 * Rules:
 * 1. In '01 games (1001, 701, 501, 301, etc., both Straight In and Double In):
 *    The Dummy must play until the team's score is 100 or lower.
 *    When the score is 100 or lower (score <= 100), the Dummy is benched and the
 *    team rotates amongst the real players only.
 * 2. In Cricket, the dummy is never included.
 * 3. In non-countdown games like Baseball or Fives, dummy plays in normal rotation.
 */
export function isDummyActiveForTeam(
  player: Player | undefined,
  options?: ShooterOptions | boolean | string
): boolean {
  if (!player) return false;
  if (isDummyIgnored(options)) return false;

  const effectiveList = getEffectiveTeamPlayers(player);
  const hasDummy = effectiveList.some((sp) => sp.isDummy) || Boolean(player.isDummy) || (player.name || '').toLowerCase().includes('dummy');
  if (!hasDummy) return false;

  const realPlayers = effectiveList.filter((sp) => !sp.isDummy);
  // If the entire team/entry is a standalone Dummy Player (e.g. Round 1 bye vs Dummy equalizer match),
  // an available player shoots for the dummy all game without stats credited, and it is never benched.
  if (realPlayers.length === 0) {
    return true;
  }

  const gMode = typeof options === 'string'
    ? options.toUpperCase()
    : typeof options === 'object' && options?.gameMode
    ? options.gameMode.toUpperCase()
    : undefined;

  // In Cricket, dummy is never included — players rotate within their team
  if (gMode === 'CRICKET') return false;

  // In Baseball or Fives, dummy plays in normal rotation
  if (gMode === 'BASEBALL' || gMode === 'FIVES') {
    return true;
  }

  // Check remaining score for countdown '01 games (1001, 701, 501, 301, etc.)
  const remScore = typeof options === 'object' && options?.remainingScore !== undefined
    ? options.remainingScore
    : player.currentScore;

  // In '01 games, dummy must play until score is 100 or lower (score <= 100).
  // When score is 100 or lower, dummy is benched and only real players rotate.
  if (remScore !== undefined && remScore <= 100) {
    return false;
  }

  return true;
}

/**
 * Splits a composite team name (e.g., "Dave & Bob & Steve" or "Alice, Charlie, Dan")
 * into individual sub-players if explicit teamPlayers array is not populated.
 */
export function parseTeamPlayerNames(rawName: string, prefix: string = 'sp'): TeamSubPlayer[] {
  if (!rawName || typeof rawName !== 'string') {
    return [{ id: `${prefix}-1`, name: 'Player', avatar: '🎯', isDummy: false }];
  }

  // Split on &, +, /, comma, ' and ', ' vs ', bullet, pipe, or spaced dash
  const delimiterRegex = /\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\||\s+-\s+)\s*/i;
  const rawParts = rawName.split(delimiterRegex).map((s) => s.trim()).filter(Boolean);

  if (rawParts.length <= 1) {
    const single = rawParts[0] || rawName.trim() || 'Player';
    const isDummy = single.toLowerCase().includes('dummy');
    const slug = single.toLowerCase().replace(/[^a-z0-9]/g, '') || '1';
    return [{
      id: isDummy ? `${prefix}-dummy-1` : `${prefix}-${slug}`,
      name: isDummy ? '🤖 Dummy Player' : single,
      avatar: isDummy ? '🤖' : '🎯',
      isDummy,
    }];
  }

  return rawParts.map((part, idx) => {
    const isDummy = part.toLowerCase().includes('dummy');
    const slug = part.toLowerCase().replace(/[^a-z0-9]/g, '') || `${idx + 1}`;
    return {
      id: isDummy ? `${prefix}-dummy-${idx + 1}` : `${prefix}-${idx + 1}-${slug}`,
      name: isDummy ? '🤖 Dummy Player' : part,
      avatar: isDummy ? '🤖' : '🎯',
      isDummy,
    };
  });
}

/**
 * Ensures a player always has a valid, non-empty list of team sub-players.
 */
export function getEffectiveTeamPlayers(player: Player | undefined): TeamSubPlayer[] {
  if (!player) {
    return [{ id: 'sp-1', name: 'Player', avatar: '🎯', isDummy: false }];
  }

  const delimiterRegex = /\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\||\s+-\s+)\s*/i;

  if (player.teamPlayers && player.teamPlayers.length > 1) {
    const hasComposite = player.teamPlayers.some(
      (p) => !p.isDummy && delimiterRegex.test(p.name)
    );
    if (hasComposite) {
      const flattened: TeamSubPlayer[] = [];
      player.teamPlayers.forEach((p, idx) => {
        if (!p.isDummy && delimiterRegex.test(p.name)) {
          const parts = parseTeamPlayerNames(p.name, `${player.id || 'sp'}-${idx}`);
          flattened.push(...parts);
        } else {
          flattened.push(p);
        }
      });
      return flattened.length > 0 ? flattened : player.teamPlayers;
    }
    return player.teamPlayers;
  }

  if (player.teamPlayers && player.teamPlayers.length === 1) {
    const single = player.teamPlayers[0];
    if (single && !single.isDummy && delimiterRegex.test(single.name)) {
      const prefix = player.id ? `sp-${player.id}` : 'sp';
      return parseTeamPlayerNames(single.name, prefix);
    }
    if (player.name && delimiterRegex.test(player.name)) {
      const prefix = player.id ? `sp-${player.id}` : 'sp';
      return parseTeamPlayerNames(player.name, prefix);
    }
    return player.teamPlayers;
  }

  // Derive sub players automatically from player.name scoped to player.id
  const prefix = player.id ? `sp-${player.id}` : 'sp';
  return parseTeamPlayerNames(player.name, prefix);
}

/**
 * Calculates who is currently throwing for a given player/team.
 * In Cricket, there is no dummy: both teams rotate in their order without the dummy.
 * In '01 games:
 * - The Dummy must play until that team's score is 100 or lower.
 *   Once the score is 100 or lower, the dummy is benched and the team rotates
 *   amongst the real players only as if a full team.
 * - Teammates rotate shooting on the dummy's turns.
 */
export function getShooterInfo(
  player: Player | undefined,
  options?: ShooterOptions | boolean | string
): ShooterInfo {
  if (!player) {
    return {
      shooterName: 'Player',
      isDummyTurn: false,
      avatar: '🎯',
      displayFull: 'Player',
      subPlayerIndex: 0,
    };
  }

  const effectiveList = getEffectiveTeamPlayers(player);
  const realPlayers = effectiveList.filter((p) => !p.isDummy);
  const dummyActive = isDummyActiveForTeam(player, options);

  const gMode = typeof options === 'string'
    ? options.toUpperCase()
    : typeof options === 'object' && options?.gameMode
    ? options.gameMode.toUpperCase()
    : undefined;
  const isCountdownGame = gMode !== 'BASEBALL' && gMode !== 'FIVES' && gMode !== 'CRICKET';

  const hasDummy = effectiveList.some((sp) => sp.isDummy) || Boolean(player.isDummy) || (player.name || '').toLowerCase().includes('dummy');
  const remScore = typeof options === 'object' && options?.remainingScore !== undefined
    ? options.remainingScore
    : player.currentScore;
  const isDummyBenched = hasDummy && realPlayers.length > 0 && isCountdownGame && remScore !== undefined && remScore <= 100;

  if (effectiveList.length <= 1) {
    const single = effectiveList[0] || { id: player.id, name: player.name, avatar: player.avatar || '🎯', isDummy: false };
    const isSingleDummy = Boolean(single.isDummy || player.isDummy || (player.name || '').toLowerCase().includes('dummy'));
    return {
      shooterName: isSingleDummy ? '🤖 Dummy Player' : single.name,
      isDummyTurn: isSingleDummy,
      dummyRotatedPlayerName: isSingleDummy ? 'Available Player' : undefined,
      avatar: isSingleDummy ? '🤖' : (single.avatar || player.avatar || '🎯'),
      displayFull: isSingleDummy ? '🤖 Dummy Player (Available Player Shooting)' : single.name,
      subPlayerIndex: 0,
      subPlayerId: single.id,
      teamName: player.name,
      isDummyBenched: false,
    };
  }

  // When dummy is NOT active (e.g. Cricket, or score <= 100, or Double In before first score):
  // The team rotates amongst real players only as if a full team.
  if (!dummyActive) {
    const activeList = realPlayers.length > 0 ? realPlayers : effectiveList;
    const subIdx = (player.currentSubPlayerIndex || 0) % activeList.length;
    const currentSub = activeList[subIdx];
    const nextSub = activeList[(subIdx + 1) % activeList.length];
    const rawName = currentSub?.name || player.name;
    const cleanName = rawName
      .replace(/\s*\(?\s*shooting\s+for\s+(?:the\s+)?dummy\s*\)?/gi, '')
      .replace(/\s*\(?\s*for\s+dummy\s*\)?/gi, '')
      .replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '')
      .trim() || rawName;

    return {
      shooterName: cleanName,
      isDummyTurn: false,
      avatar: currentSub?.avatar || player.avatar || '🎯',
      displayFull: cleanName,
      subPlayerIndex: subIdx,
      subPlayerId: currentSub?.id,
      teamName: player.name,
      nextShooterName: nextSub?.name,
      isDummyBenched,
    };
  }

  // Dummy IS active:
  const subIdx = (player.currentSubPlayerIndex || 0) % effectiveList.length;
  const currentSub = effectiveList[subIdx];
  const nextSub = effectiveList[(subIdx + 1) % effectiveList.length];
  const isDummyTurn = Boolean(currentSub?.isDummy);

  if (isDummyTurn) {
    if (realPlayers.length > 0) {
      // Rotate through real teammates for dummy turns
      const dummyRot = player.dummyShooterIndices?.[currentSub.id] || 0;
      const designatedShooter = realPlayers[dummyRot % realPlayers.length];
      const shooterName = designatedShooter.name;
      const shotNumber = dummyRot + 1;

      // On deck name: if next sub is real, it's their name alone; if next sub is dummy, show who shoots for dummy next
      let nextShooterDisplay = nextSub?.name;
      if (nextSub?.isDummy && realPlayers.length > 0) {
        const nextRot = dummyRot + 1;
        const nextShooter = realPlayers[nextRot % realPlayers.length];
        nextShooterDisplay = nextShooter ? `${nextShooter.name} (shooting for Dummy)` : 'Dummy';
      }

      return {
        shooterName,
        isDummyTurn: true,
        dummyRotatedPlayerName: shooterName,
        shotNumber,
        avatar: designatedShooter.avatar || '🎯',
        displayFull: `${designatedShooter.name} (shooting for Dummy)`,
        subPlayerIndex: subIdx,
        subPlayerId: currentSub.id,
        teamName: player.name,
        nextShooterName: nextShooterDisplay,
        isDummyBenched: false,
      };
    } else {
      return {
        shooterName: currentSub.name,
        isDummyTurn: true,
        avatar: '🤖',
        displayFull: currentSub.name,
        subPlayerIndex: subIdx,
        subPlayerId: currentSub.id,
        teamName: player.name,
        nextShooterName: nextSub?.name,
        isDummyBenched: false,
      };
    }
  }

  // Regular turn: player is called by their name alone, not with shooting for dummy
  const rawShooterName = currentSub?.name || player.name;
  const cleanShooterName = rawShooterName
    .replace(/\s*\(?\s*shooting\s+for\s+(?:the\s+)?dummy\s*\)?/gi, '')
    .replace(/\s*\(?\s*for\s+dummy\s*\)?/gi, '')
    .replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '')
    .trim() || rawShooterName;

  let nextShooterDisplay = nextSub?.name;
  if (nextSub?.isDummy && realPlayers.length > 0) {
    const nextRot = player.dummyShooterIndices?.[nextSub.id] || 0;
    const nextShooter = realPlayers[nextRot % realPlayers.length];
    nextShooterDisplay = nextShooter ? `${nextShooter.name} (shooting for Dummy)` : 'Dummy';
  }

  return {
    shooterName: cleanShooterName,
    isDummyTurn: false,
    avatar: currentSub?.avatar || player.avatar || '🎯',
    displayFull: cleanShooterName,
    subPlayerIndex: subIdx,
    subPlayerId: currentSub?.id,
    teamName: player.name,
    nextShooterName: nextShooterDisplay,
    isDummyBenched: false,
  };
}

/**
 * Returns who is scheduled to shoot next after the current turn for this team.
 */
export function getNextShooterInfo(
  player: Player | undefined,
  options?: ShooterOptions | boolean | string
): string | undefined {
  if (!player) return undefined;
  const info = getShooterInfo(player, options);
  return info.nextShooterName;
}

/**
 * Advances the sub-player turn index and dummy rotation count for next time.
 * In Cricket, rotates only among real players and does not count dummy turns.
 * In '01 games, dummy plays in team rotation until team score reaches 100 or lower,
 * at which point the dummy is benched and real players rotate amongst themselves.
 */
export function advancePlayerSubShooter(
  player: Player,
  options?: ShooterOptions | boolean | string
): {
  currentSubPlayerIndex: number;
  dummyShooterIndices: Record<string, number>;
  effectiveTeamPlayers: TeamSubPlayer[];
  lastRealShooterIndex?: number;
} {
  const effectiveList = getEffectiveTeamPlayers(player);
  let nextSubIdx = player.currentSubPlayerIndex || 0;
  const newDummyIndices = { ...(player.dummyShooterIndices || {}) };
  const realPlayers = effectiveList.filter((sp) => !sp.isDummy);
  let newLastRealShooterIndex = player.lastRealShooterIndex;

  if (effectiveList.length <= 1) {
    return {
      currentSubPlayerIndex: 0,
      dummyShooterIndices: newDummyIndices,
      effectiveTeamPlayers: effectiveList,
      lastRealShooterIndex: 0,
    };
  }

  const dummyActiveBeforeThrow = isDummyActiveForTeam(player, options);
  const remScoreAfter = typeof options === 'object' && options?.remainingScore !== undefined
    ? options.remainingScore
    : (player.fivesScore !== undefined ? player.fivesScore : player.currentScore);

  const gMode = typeof options === 'string'
    ? options.toUpperCase()
    : typeof options === 'object' && options?.gameMode
    ? options.gameMode.toUpperCase()
    : undefined;

  const isCountdown100Game = gMode !== 'BASEBALL' && gMode !== 'FIVES' && gMode !== 'CRICKET';

  // If dummy was NOT active during the turn (e.g. Cricket, or score <= 100 in 01 games):
  if (!dummyActiveBeforeThrow) {
    const activeList = realPlayers.length > 0 ? realPlayers : effectiveList;
    const currentIdxInReal = (nextSubIdx % activeList.length);
    newLastRealShooterIndex = currentIdxInReal;
    const nextIdxInReal = (currentIdxInReal + 1) % activeList.length;

    return {
      currentSubPlayerIndex: nextIdxInReal,
      dummyShooterIndices: newDummyIndices,
      effectiveTeamPlayers: effectiveList,
      lastRealShooterIndex: newLastRealShooterIndex,
    };
  }

  // Dummy WAS active during the turn:
  const currentSub = effectiveList[nextSubIdx % effectiveList.length];

  if (currentSub?.isDummy) {
    // Current turn was the Dummy's turn
    if (realPlayers.length > 0) {
      const currentDummyRotation = newDummyIndices[currentSub.id] || 0;
      newDummyIndices[currentSub.id] = currentDummyRotation + 1;
    }

    // If the dummy's throw reduced the score to <= 100 in 01 games, dummy is benched starting now:
    if (isCountdown100Game && remScoreAfter !== undefined && remScoreAfter <= 100) {
      const rawNextSubIdx = (nextSubIdx + 1) % effectiveList.length;
      const nextCandidate = effectiveList[rawNextSubIdx];
      const rIdx = realPlayers.findIndex((sp) => sp.id === nextCandidate?.id);
      nextSubIdx = rIdx !== -1 ? rIdx : 0;
    } else {
      // Normal sequential rotation: players rotate with shooting for the dummy,
      // and also play their own turn when it's their shot!
      nextSubIdx = (nextSubIdx + 1) % effectiveList.length;
    }
  } else {
    // Current turn was a real player's turn
    const rIdx = realPlayers.findIndex((sp) => sp.id === currentSub.id);
    if (rIdx !== -1) {
      newLastRealShooterIndex = rIdx;
    }

    // Check if the throw just reduced the score to <= 100 in 01 games:
    // "The Dummy plays as part of the team up until that team has 100 or less left and then the team rotates amongst themselves as if a full team."
    if (isCountdown100Game && remScoreAfter !== undefined && remScoreAfter <= 100) {
      // Dummy excluded: next shooter is the next real player!
      const currentRealIdx = rIdx !== -1 ? rIdx : 0;
      const nextRealIdx = (currentRealIdx + 1) % (realPlayers.length || 1);
      nextSubIdx = nextRealIdx;
    } else {
      // Normal rotation in effectiveList:
      nextSubIdx = (nextSubIdx + 1) % effectiveList.length;
    }
  }

  return {
    currentSubPlayerIndex: nextSubIdx,
    dummyShooterIndices: newDummyIndices,
    effectiveTeamPlayers: effectiveList,
    lastRealShooterIndex: newLastRealShooterIndex,
  };
}

/**
 * Announces the current shooter's name via voice with full audio caller personality.
 */
export function announceCurrentShooter(
  player: Player | undefined,
  delayMs: number = 0,
  options?: ShooterOptions | boolean | string
) {
  if (!player) return;
  const info = getShooterInfo(player, options);
  const remaining = typeof options === 'object' && options?.remainingScore !== undefined
    ? options.remainingScore
    : (player.fivesScore !== undefined ? player.fivesScore : player.currentScore);
  const gMode = typeof options === 'string'
    ? options
    : typeof options === 'object' && options?.gameMode
    ? options.gameMode
    : undefined;

  // Pass the exact individual shooter's name
  let nameToAnnounce = info.isDummyTurn && info.dummyRotatedPlayerName
    ? info.dummyRotatedPlayerName
    : info.shooterName;

  if (/\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\|)\s*/i.test(nameToAnnounce)) {
    const parts = nameToAnnounce.split(/\s*(?:&|\+|\/|,|\band\b|\bvs\b|•|\|)\s*/i).map(s => s.trim()).filter(Boolean);
    if (!info.isDummyTurn) {
      const nonDummyParts = parts.filter(p => !p.toLowerCase().includes('dummy'));
      if (nonDummyParts.length > 0) {
        nameToAnnounce = nonDummyParts[0];
      } else if (parts.length > 0) {
        nameToAnnounce = parts[0];
      }
    } else if (parts.length > 0) {
      nameToAnnounce = parts[0];
    }
  }

  // On regular turns, ensure any "shooting for dummy" text is completely removed
  if (!info.isDummyTurn) {
    nameToAnnounce = nameToAnnounce
      .replace(/\s*\(?\s*shooting\s+for\s+(?:the\s+)?dummy\s*\)?/gi, '')
      .replace(/\s*\(?\s*for\s+dummy\s*\)?/gi, '')
      .replace(/\s*(?:&|\+|\/|,|\band\b)\s*🤖?\s*dummy(?: player)?/gi, '')
      .trim();
  }

  announcer.announceTurn(nameToAnnounce, info.isDummyTurn, delayMs, {
    remainingScore: remaining,
    gameMode: gMode,
    teamName: player.name,
    dummyRotatedPlayerName: info.isDummyTurn ? info.dummyRotatedPlayerName : undefined,
  });
}

/**
 * Updates individual sub-player statistics for a team.
 * Crucial rule: When a real player shoots for a Dummy, the stats for that throw
 * are credited to the Dummy sub-player, NOT the real player's personal stats record.
 */
export function updateSubPlayerStatsOnTurn(
  player: Player,
  score: number,
  dartsUsed: number,
  remainingBefore: number,
  isBust: boolean,
  isCheckout: boolean,
  options?: ShooterOptions | boolean | string
): TeamSubPlayer[] | undefined {
  const effectiveList = getEffectiveTeamPlayers(player);
  if (effectiveList.length === 0) {
    return undefined;
  }

  const dummyActive = isDummyActiveForTeam(player, options);
  const realPlayers = effectiveList.filter((p) => !p.isDummy);
  const activeList = !dummyActive && realPlayers.length > 0 ? realPlayers : effectiveList;
  const currentSubIdx = (player.currentSubPlayerIndex || 0) % activeList.length;
  const activeSubPlayer = activeList[currentSubIdx];

  const actualScore = isBust ? 0 : score;

  return effectiveList.map((sp) => {
    if (sp.id !== activeSubPlayer.id) return sp;

    const prevStats = sp.stats || {
      threeDartAvg: 0,
      first9Avg: 0,
      mpr: 0,
      highScore: 0,
      highOut: 0,
      highIn: 0,
      checkoutAttempts: 0,
      checkoutHits: 0,
      count60Plus: 0,
      count100Plus: 0,
      count140Plus: 0,
      count180: 0,
      dartsThrown: 0,
    };

    const newDarts = prevStats.dartsThrown + dartsUsed;
    let c60 = prevStats.count60Plus;
    let c100 = prevStats.count100Plus;
    let c140 = prevStats.count140Plus;
    let c180 = prevStats.count180;
    const highScore = Math.max(prevStats.highScore, actualScore);

    if (actualScore === 180) c180++;
    else if (actualScore >= 140) c140++;
    else if (actualScore >= 100) c100++;
    else if (actualScore >= 60) c60++;

    // Sub-player 3-dart average accumulation
    const prevTotalPoints = (prevStats.threeDartAvg * prevStats.dartsThrown) / 3;
    const newTotalPoints = prevTotalPoints + actualScore;
    const threeDartAvg = newDarts > 0 ? (newTotalPoints / newDarts) * 3 : 0;

    let f9 = [...(sp.first9Darts || [])];
    if (newDarts <= 9) {
      f9.push(actualScore);
    }
    const first9Avg = f9.length > 0 ? (f9.reduce((a, b) => a + b, 0) / (f9.length * 3)) * 3 : threeDartAvg;

    let highOut = prevStats.highOut || 0;
    if (isCheckout) {
      highOut = Math.max(highOut, remainingBefore);
    }

    // High In (First scoring shot in Double In games)
    let highIn = prevStats.highIn || 0;
    const isDoubleIn = typeof options === 'object' && options?.inMode === 'Double';
    const justMarkedFirstScore = typeof options === 'object' && Boolean(options?.justMarkedFirstScore);
    if (isDoubleIn && justMarkedFirstScore && actualScore > 0) {
      highIn = Math.max(highIn, actualScore);
    }

    return {
      ...sp,
      first9Darts: f9,
      stats: {
        ...prevStats,
        dartsThrown: newDarts,
        highScore,
        highOut,
        highIn,
        count60Plus: c60,
        count100Plus: c100,
        count140Plus: c140,
        count180: c180,
        threeDartAvg: parseFloat(threeDartAvg.toFixed(1)),
        first9Avg: parseFloat(first9Avg.toFixed(1)),
        checkoutHits: isCheckout ? prevStats.checkoutHits + 1 : prevStats.checkoutHits,
        checkoutAttempts: remainingBefore <= 170 ? prevStats.checkoutAttempts + 1 : prevStats.checkoutAttempts,
      },
    };
  });
}

/**
 * Updates individual sub-player baseball hits and runs.
 * When throwing for a Dummy, baseball hits count for the Dummy's record.
 */
export function updateSubPlayerBaseballStats(
  player: Player,
  targetIdx: number,
  hits: number,
  options?: ShooterOptions | boolean | string | { subPlayerIndex?: number; targetSubPlayerId?: string; gameMode?: string }
): TeamSubPlayer[] | undefined {
  const effectiveList = getEffectiveTeamPlayers(player);
  if (effectiveList.length === 0) {
    return undefined;
  }

  let activeSubPlayer: TeamSubPlayer | undefined;
  if (options && typeof options === 'object') {
    if ('targetSubPlayerId' in options && options.targetSubPlayerId) {
      activeSubPlayer = effectiveList.find((sp) => sp.id === options.targetSubPlayerId);
    } else if ('subPlayerIndex' in options && typeof options.subPlayerIndex === 'number') {
      activeSubPlayer = effectiveList[options.subPlayerIndex % effectiveList.length];
    }
  }

  if (!activeSubPlayer) {
    const dummyActive = isDummyActiveForTeam(player, options as any);
    const realPlayers = effectiveList.filter((p) => !p.isDummy);
    const activeList = !dummyActive && realPlayers.length > 0 ? realPlayers : effectiveList;
    const currentSubIdx = (player.currentSubPlayerIndex || 0) % activeList.length;
    activeSubPlayer = activeList[currentSubIdx];
  }

  if (!activeSubPlayer) return effectiveList;

  return effectiveList.map((sp) => {
    if (sp.id !== activeSubPlayer!.id) return sp;

    const hitsRecord = { ...(sp.baseballHits || {}), [targetIdx]: hits };
    const totalRuns = Object.values(hitsRecord).reduce((sum, h) => sum + (h || 0), 0);
    const prevStats = sp.stats || {
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
    };

    return {
      ...sp,
      baseballHits: hitsRecord,
      baseballScore: totalRuns,
      stats: {
        ...prevStats,
        dartsThrown: prevStats.dartsThrown + 3,
      },
    };
  });
}

/**
 * Updates individual sub-player stats for Cricket.
 * In Cricket, the dummy NEVER plays. Each real player rotates within their team.
 * Darts thrown, marks, and MPR are recorded for the active real teammate only.
 */
export function updateSubPlayerCricketStats(
  player: Player,
  marksThisTurn: number,
  dartsUsed: number,
  _options?: ShooterOptions | boolean | string
): TeamSubPlayer[] | undefined {
  const effectiveList = getEffectiveTeamPlayers(player);
  if (effectiveList.length === 0) return undefined;

  const realPlayers = effectiveList.filter((sp) => !sp.isDummy);
  const activeList = realPlayers.length > 0 ? realPlayers : effectiveList;
  const currentSubIdx = (player.currentSubPlayerIndex || 0) % activeList.length;
  const activeSubPlayer = activeList[currentSubIdx];

  return effectiveList.map((sp) => {
    if (sp.id !== activeSubPlayer.id) return sp;

    const prevStats = sp.stats || {
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
    };

    const newDarts = prevStats.dartsThrown + dartsUsed;
    const prevMarks = (prevStats as any).marks || 0;
    const newMarks = prevMarks + marksThisTurn;
    const mpr = newDarts > 0 ? (newMarks / newDarts) * 3 : 0;

    return {
      ...sp,
      stats: {
        ...prevStats,
        dartsThrown: newDarts,
        marks: newMarks,
        mpr: parseFloat(mpr.toFixed(2)),
      } as any,
    };
  });
}

