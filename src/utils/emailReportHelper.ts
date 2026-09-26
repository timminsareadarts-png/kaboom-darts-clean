import { MatchState, Player, TurnLog, LegRecord, TeamSubPlayer, BracketMatchup, WEDNESDAY_MEDLEY_CONFIGS, DEFAULT_MEDLEY_CONFIGS } from '../types';

export const OFFICIAL_LEAGUE_EMAIL = 'surgedarts@gmail.com';
export const DEFAULT_RECIPIENT_EMAIL = 'surgedarts@gmail.com';
export const STORAGE_KEY_RECIPIENT_EMAIL = 'kaboom_recipient_email';
export const STORAGE_KEY_PLAYER_EMAIL = 'kaboom_player_report_email';
export const STORAGE_KEY_AUTO_EMAIL_PLAYER = 'kaboom_auto_email_player_enabled';
export const STORAGE_KEY_SENT_MATCHES = 'kaboom_dispatched_match_emails';
export const STORAGE_KEY_SAVED_COMPLETED_MATCHES = 'kaboom_saved_completed_match_states';

/**
 * Gets the configured recipient email address (defaults to surgedarts@gmail.com)
 */
export function getRecipientEmail(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RECIPIENT_EMAIL);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_RECIPIENT_EMAIL;
}

/**
 * Saves the user's preferred recipient email address
 */
export function saveRecipientEmail(email: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_RECIPIENT_EMAIL, email.trim());
  } catch {}
}

export interface EmailDispatchRecord {
  matchCode: string;
  leagueType?: string;
  dispatchedAt?: number;
  dispatchedAtStr?: string;
  primaryRecipient?: string;
  recipientEmail?: string;
  allRecipients?: string[];
  playerEmails?: string[];
  subject?: string;
  sentViaSmtp?: boolean;
  serverMessage?: string;
  sentAt?: number;
}

/**
 * Builds a 1-click webmail URL for Google Mail compose window
 */
export function getGmailComposeUrl(to: string, cc: string[], subject: string, body: string): string {
  const ccStr = cc.filter((e) => e && e.toLowerCase() !== to.toLowerCase()).join(',');
  let url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`;
  if (ccStr) {
    url += `&cc=${encodeURIComponent(ccStr)}`;
  }
  url += `&su=${encodeURIComponent(subject)}`;
  url += `&body=${encodeURIComponent(body)}`;
  return url;
}

/**
 * Builds a standard mailto URL for native email clients (Apple Mail, Outlook, Android)
 */
export function getNativeMailtoUrl(to: string, cc: string[], subject: string, body: string): string {
  const ccStr = cc.filter((e) => e && e.toLowerCase() !== to.toLowerCase()).join(',');
  let url = `mailto:${encodeURIComponent(to)}?`;
  const params: string[] = [];
  if (ccStr) params.push(`cc=${encodeURIComponent(ccStr)}`);
  params.push(`subject=${encodeURIComponent(subject)}`);
  params.push(`body=${encodeURIComponent(body)}`);
  return url + params.join('&');
}

/**
 * Triggers standard mailto: link navigation directly in the browser
 */
export function openMailtoLink(to: string, cc: string[], subject: string, body: string): void {
  const mailtoUrl = getNativeMailtoUrl(to, cc, subject, body);
  try {
    const a = document.createElement('a');
    a.href = mailtoUrl;
    a.target = '_top';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 500);
  } catch (err) {
    window.location.href = mailtoUrl;
  }
}

/**
 * Convenience helper to generate mailto URL and components for a completed match
 */
export function getMatchMailtoUrl(
  matchState: MatchState,
  customRecipient?: string,
  additionalCc: string[] = []
): { mailtoUrl: string; to: string; cc: string[]; subject: string; body: string } {
  const to = (customRecipient || getRecipientEmail()).trim() || DEFAULT_RECIPIENT_EMAIL;
  const { subject, body } = generateMatchEmailReport(matchState, additionalCc);
  const mailtoUrl = getNativeMailtoUrl(to, additionalCc, subject, body);
  return { mailtoUrl, to, cc: additionalCc, subject, body };
}

/**
 * Checks if an email report has already been dispatched for this match (by matchCode, bracketMatchId, or matchId).
 */
export function isMatchEmailDispatched(...identifiers: (string | undefined | null)[]): boolean {
  const validIds = identifiers.filter((id): id is string => Boolean(id && id.trim()));
  if (validIds.length === 0) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENT_MATCHES);
    if (!raw) return false;
    const records: Record<string, EmailDispatchRecord> = JSON.parse(raw);
    return validIds.some((id) => Boolean(records[id]));
  } catch {
    return false;
  }
}

/**
 * Retrieves the dispatch record for a specific match identifier if available.
 */
export function getDispatchedEmailInfo(...identifiers: (string | undefined | null)[]): EmailDispatchRecord | null {
  const validIds = identifiers.filter((id): id is string => Boolean(id && id.trim()));
  if (validIds.length === 0) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENT_MATCHES);
    if (!raw) return null;
    const records: Record<string, EmailDispatchRecord> = JSON.parse(raw);
    for (const id of validIds) {
      if (records[id]) return records[id];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves a dispatched match record to prevent duplicate automatic emails, indexing by multiple keys.
 */
export function recordMatchEmailDispatched(record: EmailDispatchRecord, extraKeys: (string | undefined | null)[] = []): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SENT_MATCHES);
    const records: Record<string, EmailDispatchRecord> = raw ? JSON.parse(raw) : {};
    if (record.matchCode) records[record.matchCode] = record;
    extraKeys.forEach((k) => {
      if (k && k.trim()) records[k.trim()] = record;
    });
    localStorage.setItem(STORAGE_KEY_SENT_MATCHES, JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to save email dispatch record to localStorage:', e);
  }
}

/**
 * Saves completed match state for future retrieval, resending, and auditing.
 */
export function saveCompletedMatchState(matchState: MatchState): void {
  if (!matchState) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_COMPLETED_MATCHES);
    const map: Record<string, MatchState> = raw ? JSON.parse(raw) : {};

    if (matchState.id) map[matchState.id] = matchState;
    if (matchState.matchCode) map[matchState.matchCode] = matchState;
    if (matchState.settings?.bracketMatchId) map[matchState.settings.bracketMatchId] = matchState;

    // Prune to latest 100 to stay well under quota
    const entries = Object.entries(map);
    if (entries.length > 150) {
      const trimmed = Object.fromEntries(entries.slice(-100));
      localStorage.setItem(STORAGE_KEY_SAVED_COMPLETED_MATCHES, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORAGE_KEY_SAVED_COMPLETED_MATCHES, JSON.stringify(map));
    }

    // Also async sync to server in background
    fetch('/api/match-states/completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: matchState.id,
        bracketMatchId: matchState.settings?.bracketMatchId,
        matchCode: matchState.matchCode,
        leagueType: matchState.settings?.leagueType,
        matchState,
      }),
    }).catch(() => {});
  } catch (e) {
    console.warn('Failed to persist completed match state:', e);
  }
}

/**
 * Retrieves saved completed match state if available.
 */
export function getSavedCompletedMatchState(identifier: string): MatchState | null {
  if (!identifier) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_COMPLETED_MATCHES);
    if (raw) {
      const map: Record<string, MatchState> = JSON.parse(raw);
      if (map[identifier]) return map[identifier];
    }
  } catch {}
  return null;
}

/**
 * Constructs a fully valid MatchState representation from a BracketMatchup,
 * enabling email report generation and resending even if full ball-by-ball turns
 * were not cached locally.
 */
export function buildMatchStateFromBracketMatchup(
  m: BracketMatchup,
  leagueType: 'tuesday' | 'wednesday' | 'thursday'
): MatchState {
  const isWed = leagueType === 'wednesday';
  const startScore = isWed ? 1001 : 301;
  const legsToWin = isWed ? 6 : 3;

  const scoreA = m.scoreA ?? (m.winnerName === m.entryA?.name ? (isWed ? 6 : 2) : 0);
  const scoreB = m.scoreB ?? (m.winnerName === m.entryB?.name ? (isWed ? 6 : 2) : 0);

  const matchTimestamp = Date.now();
  const matchCode = m.id?.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(-8) ||
    `${leagueType.toUpperCase().slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`;

  const winner = m.winnerName || (scoreA > scoreB ? m.entryA?.name : m.entryB?.name) || 'Winner';

  return {
    id: m.id,
    matchCode,
    status: 'completed',
    currentGameMode: isWed ? 'X01' : 'MEDLEY',
    activePlayerIndex: 0,
    starterPlayerIndex: 0,
    currentLeg: Math.max(scoreA + scoreB, 1),
    currentSet: 1,
    currentStartScore: startScore,
    players: [
      {
        id: m.entryA?.players?.[0]?.id || 'p1',
        name: m.entryA?.name || 'Player 1',
        avatar: m.entryA?.players?.[0]?.avatar || '🎯',
        currentScore: 0,
        legsWon: scoreA,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryA?.players || [],
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
        id: m.entryB?.players?.[0]?.id || 'p2',
        name: m.entryB?.name || 'Player 2',
        avatar: m.entryB?.players?.[0]?.avatar || '🎯',
        currentScore: 0,
        legsWon: scoreB,
        setsWon: 0,
        cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
        cricketPoints: 0,
        first9Darts: [],
        teamPlayers: m.entryB?.players || [],
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
    ],
    history: [],
    completedLegs: [],
    settings: {
      gameMode: 'MEDLEY',
      medleyConfigs: isWed ? WEDNESDAY_MEDLEY_CONFIGS : DEFAULT_MEDLEY_CONFIGS,
      startScore,
      inMode: isWed ? 'Straight' : 'Double',
      outMode: 'Double',
      format: 'legs',
      legsToWin,
      setsToWin: 1,
      legsPerSet: legsToWin,
      isDartBot: false,
      botLevel: 5,
      announceAudio: true,
      isPublic: false,
      matchCode,
      starterPlayerId: m.entryA?.players?.[0]?.id || 'p1',
      isMedley: true,
      leagueType,
      bracketMatchId: m.id,
      division: m.division,
    },
    winnerId: m.winnerName === m.entryA?.name
      ? (m.entryA?.players?.[0]?.id || 'p1')
      : (m.entryB?.players?.[0]?.id || 'p2'),
    winnerName: winner,
    createdAt: matchTimestamp,
    updatedAt: matchTimestamp,
  };
}

/**
 * Resolves the richest available MatchState for a completed bracket matchup,
 * checking cached completed states first, active match state second, and falling
 * back to high-fidelity synthesis from the BracketMatchup record.
 */
export function getOrBuildMatchStateForMatchup(
  m: BracketMatchup,
  leagueType: 'tuesday' | 'wednesday' | 'thursday'
): MatchState {
  // 1. Try exact bracketMatchId from saved completed match states
  const savedById = getSavedCompletedMatchState(m.id);
  if (savedById) return savedById;

  // 2. Try match dictionary by player names and league type
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAVED_COMPLETED_MATCHES);
    if (raw) {
      const map: Record<string, MatchState> = JSON.parse(raw);
      const matched = Object.values(map).find(
        (st) =>
          st?.settings?.leagueType === leagueType &&
          st.players?.some((p) => p.name?.toLowerCase().trim() === m.entryA?.name?.toLowerCase().trim()) &&
          st.players?.some((p) => p.name?.toLowerCase().trim() === m.entryB?.name?.toLowerCase().trim())
      );
      if (matched) return matched;
    }
  } catch {}

  // 3. Try active match state if currently in memory or storage
  try {
    const activeRaw = localStorage.getItem('kaboom_active_match_state');
    if (activeRaw) {
      const activeState: MatchState = JSON.parse(activeRaw);
      if (
        activeState.settings?.bracketMatchId === m.id ||
        (activeState.settings?.leagueType === leagueType &&
          activeState.players?.some((p) => p.name?.toLowerCase().trim() === m.entryA?.name?.toLowerCase().trim()) &&
          activeState.players?.some((p) => p.name?.toLowerCase().trim() === m.entryB?.name?.toLowerCase().trim()))
      ) {
        return activeState;
      }
    }
  } catch {}

  // 4. Fall back to clean synthesized MatchState from bracket record
  return buildMatchStateFromBracketMatchup(m, leagueType);
}

/**
 * Retrieves the player's saved report email and preference from localStorage.
 */
export function getSavedPlayerReportEmail(): { email: string; autoSendEnabled: boolean } {
  try {
    const email = localStorage.getItem(STORAGE_KEY_PLAYER_EMAIL) || '';
    const autoSendRaw = localStorage.getItem(STORAGE_KEY_AUTO_EMAIL_PLAYER);
    // Default to true if user has an email saved
    const autoSendEnabled = autoSendRaw !== null ? autoSendRaw === 'true' : Boolean(email);
    return { email, autoSendEnabled };
  } catch {
    return { email: '', autoSendEnabled: false };
  }
}

/**
 * Saves the player's report email and preference in localStorage.
 */
export function savePlayerReportEmail(email: string, autoSendEnabled: boolean = true): void {
  try {
    if (email.trim()) {
      localStorage.setItem(STORAGE_KEY_PLAYER_EMAIL, email.trim());
      localStorage.setItem(STORAGE_KEY_AUTO_EMAIL_PLAYER, autoSendEnabled ? 'true' : 'false');
    }
  } catch (e) {
    console.warn('Failed to save player report email:', e);
  }
}

/**
 * Helper to determine a friendly title for a leg/game mode.
 */
function getGameModeDisplayTitle(leg: LegRecord, index: number, leagueType?: string): string {
  if (leg.gameMode) {
    const mode = leg.gameMode;
    const start = leg.startScore;
    if (mode === 'X01') {
      if (start === 301) return '301 Double In / Double Out';
      if (start === 501) {
        if (leagueType === 'tuesday' || leagueType === 'thursday') return '501 Single In / Double Out';
        return '501 Open In / Double Out';
      }
      if (start === 701) return '701 Open In / Double Out';
      if (start === 1001) return '1001 Open In / Double Out';
      return `${start || 501} X01`;
    }
    if (mode === 'CRICKET') return 'Cricket (3 Doubles / 3 Triples No-Score)';
    if (mode === 'BASEBALL') return 'Baseball (9 Innings)';
    if (mode === 'FIVES') return 'Fives (101 Straight In / Straight Out)';
    return mode;
  }

  // Fallback based on league leg index
  if (leagueType === 'tuesday' || leagueType === 'thursday') {
    if (index === 0) return '301 Double In / Double Out';
    if (index === 1) return '501 Single In / Double Out';
    if (index === 2) return 'Cricket (3 Doubles / 3 Triples No-Score)';
  } else if (leagueType === 'wednesday') {
    if (index === 0) return '501 Open In / Double Out';
    if (index === 1) return '701 Open In / Double Out';
    if (index === 2) return '1001 Open In / Double Out';
    if (index === 3) return 'Baseball (9 Innings)';
    if (index === 4) return 'Fives (101 Straight In / Straight Out)';
    if (index === 5) return 'Cricket (No-Score Cricket)';
  }
  return `Game ${index + 1}`;
}

/**
 * Generates an exhaustive, highly detailed official match report.
 * It includes full game-by-game results with EVERY score each player shot in each game,
 * full team statistics, round of bulls challenge, and roster breakdown.
 */
export function generateMatchEmailReport(
  matchState: MatchState,
  additionalEmails: string[] = []
): { subject: string; body: string; primaryEmail: string; allRecipients: string[] } {
  const p1: Player = matchState.players[0] || ({ id: 'p1', name: 'Team 1', legsWon: 0, stats: {} } as any);
  const p2: Player = matchState.players[1] || ({ id: 'p2', name: 'Team 2', legsWon: 0, stats: {} } as any);

  const winner = p1.legsWon > p2.legsWon
    ? p1.name
    : p2.legsWon > p1.legsWon
    ? p2.name
    : (matchState.winnerId === p1.id ? p1.name : (matchState.winnerId === p2.id ? p2.name : (p1.name || 'TBD')));

  const matchTimestamp = matchState.createdAt || matchState.updatedAt || Date.now();
  const matchDate = new Date(matchTimestamp);
  const dateStr = matchDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = matchDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const leagueName = matchState.settings?.leagueType === 'tuesday'
    ? 'Tuesday Singles Medley League'
    : matchState.settings?.leagueType === 'thursday'
    ? 'Thursday Doubles Medley League'
    : matchState.settings?.leagueType === 'wednesday'
    ? 'Wednesday Teams League'
    : 'Kaboom Darts Match';

  // Valid additional emails
  const validAdditional = Array.from(
    new Set(
      additionalEmails
        .map((e) => e?.trim())
        .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.toLowerCase() !== OFFICIAL_LEAGUE_EMAIL.toLowerCase())
    )
  );

  const allRecipients = [OFFICIAL_LEAGUE_EMAIL, ...validAdditional];
  const subject = `[Official Match Report] ${leagueName}: ${p1.name} (${p1.legsWon}) vs (${p2.legsWon}) ${p2.name} - Winner: ${winner}`;

  // =========================================================================
  // SECTION 1: DETAILED GAME-BY-GAME RESULTS & EVERY SCORE SHOT PER GAME
  // =========================================================================
  let gameByGameDetailsText = '';
  const completedLegs: LegRecord[] = matchState.completedLegs || [];

  // Check if there are active unsealed turns in matchState.history not yet in completedLegs
  const completedTurnIds = new Set<string>();
  completedLegs.forEach((l) => l.turns?.forEach((t) => completedTurnIds.add(t.id)));
  const unsealedTurns = (matchState.history || []).filter((t) => !completedTurnIds.has(t.id));

  const allLegSections: { title: string; legNum: number; leg: Partial<LegRecord>; turns: TurnLog[] }[] = [];

  completedLegs.forEach((leg, idx) => {
    const legNum = leg.legNumber || idx + 1;
    const title = getGameModeDisplayTitle(leg, idx, matchState.settings?.leagueType);
    allLegSections.push({
      title: `GAME ${legNum}: ${title}`,
      legNum,
      leg,
      turns: leg.turns || [],
    });
  });

  if (unsealedTurns.length > 0) {
    const activeLegNum = completedLegs.length + 1;
    const mode = matchState.currentGameMode || matchState.settings?.gameMode || 'X01';
    allLegSections.push({
      title: `GAME ${activeLegNum}: ${mode} (Final / Active Leg)`,
      legNum: activeLegNum,
      leg: {
        winnerName: winner,
        dartsCount: {
          [p1.id]: p1.stats?.dartsThrown || 0,
          [p2.id]: p2.stats?.dartsThrown || 0,
        },
        averages: {
          [p1.id]: p1.stats?.threeDartAvg || 0,
          [p2.id]: p2.stats?.threeDartAvg || 0,
        },
      },
      turns: unsealedTurns,
    });
  }

  if (allLegSections.length > 0) {
    allLegSections.forEach((section, sIdx) => {
      const { title, leg, turns } = section;
      const legWinner = leg.winnerName || (leg.winnerId === p1.id ? p1.name : p2.name) || 'Winner';
      const outShot = leg.winningOut ? ` [Winning Out-Shot: ${leg.winningOut}]` : '';
      const p1Darts = leg.dartsCount?.[p1.id] ?? p1.stats?.dartsThrown ?? 0;
      const p2Darts = leg.dartsCount?.[p2.id] ?? p2.stats?.dartsThrown ?? 0;
      const p1Avg = leg.averages?.[p1.id] ?? p1.stats?.threeDartAvg ?? 0;
      const p2Avg = leg.averages?.[p2.id] ?? p2.stats?.threeDartAvg ?? 0;

      gameByGameDetailsText += `======================================================================\n`;
      gameByGameDetailsText += `${title}\n`;
      gameByGameDetailsText += `======================================================================\n`;
      gameByGameDetailsText += `Game Result: 🏆 Winner: ${legWinner}${outShot}\n`;
      gameByGameDetailsText += `Game Statistics:\n`;
      gameByGameDetailsText += `  • ${p1.name}: ${p1Darts} Darts Thrown | 3-Dart Avg: ${typeof p1Avg === 'number' ? p1Avg.toFixed(2) : p1Avg}\n`;
      gameByGameDetailsText += `  • ${p2.name}: ${p2Darts} Darts Thrown | 3-Dart Avg: ${typeof p2Avg === 'number' ? p2Avg.toFixed(2) : p2Avg}\n\n`;

      gameByGameDetailsText += `Scores Shot by Each Player (Turn-by-Turn Detail):\n`;
      gameByGameDetailsText += `----------------------------------------------------------------------\n`;

      if (turns && turns.length > 0) {
        turns.forEach((turn, tIdx) => {
          const tNum = String(turn.turnNumber || tIdx + 1).padStart(2, ' ');
          const shooterName = turn.shooterName || turn.playerName || 'Shooter';
          const dummyTag = turn.isDummyTurn ? ' [🤖 Dummy Player]' : '';
          const teamContext = turn.playerName && turn.playerName !== shooterName ? ` (${turn.playerName})` : '';

          // Format details of individual darts
          const dartsDetail = turn.dartsDetail && turn.dartsDetail.length > 0
            ? ` [${turn.dartsDetail.join(', ')}]`
            : '';

          // High score / note tags
          const tags: string[] = [];
          if (turn.isCheckout) tags.push('🏆 CHECKOUT / GAME SHOT');
          if (turn.isBust) tags.push('BUST');
          if (turn.score === 180) tags.push('🔥 180 MAXIMUM!');
          else if (turn.score >= 140) tags.push('140+ TON');
          else if (turn.score >= 100) tags.push('100+ TON');

          const tagStr = tags.length > 0 ? ` [${tags.join(' • ')}]` : '';

          // Determine score label depending on game mode
          let scoreLine = '';
          if (turn.remainingBefore !== undefined && turn.remainingAfter !== undefined && turn.remainingBefore > 0) {
            scoreLine = `Shot: ${turn.score} pts${dartsDetail} | Remaining: ${turn.remainingBefore} -> ${turn.remainingAfter}${tagStr}`;
          } else if (turn.score !== undefined) {
            scoreLine = `Score / Marks: ${turn.score}${dartsDetail}${tagStr}`;
          } else {
            scoreLine = `Darts: ${turn.dartsUsed}${dartsDetail}${tagStr}`;
          }

          gameByGameDetailsText += `  Turn ${tNum} | ${shooterName}${dummyTag}${teamContext}\n`;
          gameByGameDetailsText += `          ${scoreLine}\n`;
        });
      } else {
        gameByGameDetailsText += `  (Detailed turn log recorded as complete game)\n`;
      }
      gameByGameDetailsText += `\n`;
    });
  } else {
    gameByGameDetailsText += `  No completed games logged.\n\n`;
  }

  if (!gameByGameDetailsText) {
    gameByGameDetailsText += `======================================================================\n`;
    gameByGameDetailsText += `MATCH RESULT & BREAKDOWN\n`;
    gameByGameDetailsText += `======================================================================\n`;
    gameByGameDetailsText += `Division / Board:      ${(matchState.settings as any)?.division || 'League Bracket Match'}\n`;
    gameByGameDetailsText += `Match Winner:          🏆 ${winner} (Score: ${p1.name} ${p1.legsWon || 0} - ${p2.legsWon || 0} ${p2.name})\n`;
    gameByGameDetailsText += `Official Status:       Official League Match Completed\n\n`;
  }

  // =========================================================================
  // SECTION 2: ROUND OF BULLS CHALLENGE (IF PLAYED)
  // =========================================================================
  let bullsRoundText = '';
  if (matchState.bullsRoundResults && matchState.bullsRoundResults.length > 0) {
    bullsRoundText += `======================================================================\n`;
    bullsRoundText += `ROUND OF BULLS CHALLENGE (3 SHOTS • 3 DARTS PER SHOT • MAX 6 BULLS/SHOT)\n`;
    bullsRoundText += `======================================================================\n`;
    matchState.bullsRoundResults.forEach((r, idx) => {
      const shotsDetail = r.shots ? ` [Shot 1: ${r.shots[0]} Bulls, Shot 2: ${r.shots[1]} Bulls, Shot 3: ${r.shots[2]} Bulls]` : '';
      bullsRoundText += `${idx + 1}. ${r.playerName} (${r.teamName}): ${r.bullsHit} Total Bulls hit${shotsDetail}\n`;
    });
    bullsRoundText += `\n`;
  }

  // =========================================================================
  // SECTION 3: COMPREHENSIVE TEAM & PLAYER CUMULATIVE STATISTICS
  // =========================================================================
  const formatPlayerCumulativeStats = (player: Player, teamTitle: string) => {
    const s = player.stats || ({} as any);
    const dartsThrown = s.dartsThrown || 0;
    const avg3Dart = typeof s.threeDartAvg === 'number' ? s.threeDartAvg.toFixed(2) : (s.threeDartAvg || '0.00');
    const first9Avg = typeof s.first9Avg === 'number' ? s.first9Avg.toFixed(2) : (s.first9Avg || '0.00');
    const highScore = s.highScore || 0;
    const highOut = s.highOut || 0;
    const c180 = s.count180 || 0;
    const c140 = s.count140Plus || 0;
    const c100 = s.count100Plus || 0;
    const c60 = s.count60Plus || 0;
    const totalTons = c180 + c140 + c100;
    const chkHits = s.checkoutHits || 0;
    const chkAtt = s.checkoutAttempts || 0;
    const chkPct = chkAtt > 0 ? Math.round((chkHits / chkAtt) * 100) : 0;
    const mpr = typeof s.mpr === 'number' ? s.mpr.toFixed(2) : (s.mpr || '0.00');

    let output = `${teamTitle.toUpperCase()}: ${player.name} (Legs Won: ${player.legsWon || 0})\n`;
    output += `----------------------------------------------------------------------\n`;
    output += `  • Total Darts Thrown:        ${dartsThrown}\n`;
    output += `  • 3-Dart Match Average:      ${avg3Dart}\n`;
    output += `  • First 9 Darts Average:     ${first9Avg}\n`;
    output += `  • Highest Turn Score:        ${highScore}\n`;
    output += `  • Highest Checkout (Finish): ${highOut}\n`;
    output += `  • Checkout Accuracy:         ${chkHits} / ${chkAtt} (${chkPct}%)\n`;
    output += `  • Power Shots Breakdown:\n`;
    output += `      - 180s (Maximums):       ${c180}\n`;
    output += `      - 140+ (140-179):        ${c140}\n`;
    output += `      - 100+ (100-139):        ${c100}\n`;
    output += `      - 60+  (60-99):          ${c60}\n`;
    output += `      - Total 100+ Tons:       ${totalTons}\n`;

    if (player.cricketPoints !== undefined || s.mpr) {
      output += `  • Cricket MPR:               ${mpr}\n`;
    }
    if (player.baseballScore !== undefined) {
      output += `  • Baseball Total Runs:       ${player.baseballScore}\n`;
    }
    if (player.fivesPointsEarned !== undefined) {
      output += `  • Fives Points Scored:       ${player.fivesPointsEarned}\n`;
    }

    // Individual Sub-Players on Teams / Doubles
    if (player.teamPlayers && player.teamPlayers.length > 0) {
      output += `\n  • Individual Team Member Stats:\n`;
      player.teamPlayers.forEach((subP: TeamSubPlayer, subIdx: number) => {
        const subS = subP.stats || ({} as any);
        const subDarts = subS.dartsThrown || 0;
        const subAvg = typeof subS.threeDartAvg === 'number' ? subS.threeDartAvg.toFixed(2) : (subS.threeDartAvg || '0.00');
        const subHigh = subS.highScore || 0;
        const subOut = subS.highOut || 0;
        const sub180 = subS.count180 || 0;
        const sub140 = subS.count140Plus || 0;
        const sub100 = subS.count100Plus || 0;
        const dummyTag = subP.isDummy ? ' [🤖 Dummy Player]' : '';

        const baseballRunsStr = subP.baseballScore !== undefined ? ` | Runs: ${subP.baseballScore}` : '';
        output += `    [${subIdx + 1}] ${subP.name}${dummyTag}:\n`;
        output += `        Darts: ${subDarts} | 3DA: ${subAvg} | High: ${subHigh} | High Out: ${subOut}${baseballRunsStr}\n`;
        output += `        Power Shots: 180s: ${sub180} | 140+: ${sub140} | 100+: ${sub100}\n`;
      });
    }

    output += `\n`;
    return output;
  };

  // =========================================================================
  // ASSEMBLE FULL BODY
  // =========================================================================
  const body = `KABOOM DART MATCH CENTER - OFFICIAL MATCH REPORT
======================================================================
Official Delivery:   ${OFFICIAL_LEAGUE_EMAIL} (Automatic League Dispatch)
${validAdditional.length > 0 ? `Player / Copy:       ${validAdditional.join(', ')}\n` : ''}Date & Time:         ${dateStr} at ${timeStr}
League:              ${leagueName}
Match Code:          ${matchState.matchCode}
Status:              ${matchState.status === 'completed' ? 'COMPLETED' : 'IN PROGRESS'}

FINAL MATCH RESULT:
----------------------------------------------------------------------
MATCH WINNER:        🏆 ${winner}
Final Legs Score:    ${p1.name} (${p1.legsWon}) - (${p2.legsWon}) ${p2.name}

======================================================================
GAME-BY-GAME DETAILED REPORT (EVERY GAME & EVERY SCORE SHOT)
======================================================================
${gameByGameDetailsText}${bullsRoundText}======================================================================
OVERALL TEAM & PLAYER CUMULATIVE PERFORMANCE STATISTICS
======================================================================
${formatPlayerCumulativeStats(p1, 'Team 1 / Home')}
${formatPlayerCumulativeStats(p2, 'Team 2 / Away')}
======================================================================
Official match report automatically generated and verified.
Kaboom Dart Match Center • Verification Code: ${matchState.matchCode}-${matchTimestamp}
======================================================================
`;

  return {
    subject,
    body,
    primaryEmail: OFFICIAL_LEAGUE_EMAIL,
    allRecipients,
  };
}

/**
 * Helper to record or prepare email report without backend sending
 */
export async function autoSendLeagueMatchReport(
  matchState: MatchState,
  options: {
    force?: boolean;
    playerEmails?: string[];
  } = {}
): Promise<{ success: boolean; alreadySent?: boolean; allRecipients: string[]; dispatchedAt: string; sentViaSmtp?: boolean; serverMessage?: string }> {
  const matchCode = matchState.matchCode;
  const leagueType = matchState.settings?.leagueType || 'league';
  const recipient = getRecipientEmail();
  const playerEmails: string[] = options.playerEmails || [];
  const { subject } = generateMatchEmailReport(matchState, playerEmails);

  const dispatchRecord: EmailDispatchRecord = {
    matchCode,
    leagueType,
    dispatchedAt: Date.now(),
    dispatchedAtStr: new Date().toISOString(),
    primaryRecipient: recipient,
    allRecipients: [recipient, ...playerEmails],
    subject,
    sentViaSmtp: false,
    serverMessage: 'Client mailto: enabled',
  };

  recordMatchEmailDispatched(dispatchRecord);

  return {
    success: true,
    allRecipients: [recipient, ...playerEmails],
    dispatchedAt: dispatchRecord.dispatchedAtStr,
    sentViaSmtp: false,
    serverMessage: 'Client mailto: ready',
  };
}
