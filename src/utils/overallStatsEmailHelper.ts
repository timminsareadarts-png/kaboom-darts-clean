import { OverallLeaderboardEntry } from '../types';
import { calculateAutomatedLeaderboard } from './leagueHelper';
import { getNativeMailtoUrl, getGmailComposeUrl, openMailtoLink } from './emailReportHelper';

export const OFFICIAL_LEAGUE_EMAIL = 'surgedarts@gmail.com';
export const STORAGE_KEY_AUTO_EMAIL_OVERALL_STATS = 'kaboom_auto_email_overall_stats';
export const STORAGE_KEY_LAST_OVERALL_STATS_DISPATCH = 'kaboom_last_overall_stats_dispatch';

export interface OverallStatsReportResult {
  subject: string;
  textReport: string;
  htmlReport: string;
  recipient: string;
  totalPlayers: number;
  generatedAt: string;
  players: OverallLeaderboardEntry[];
}

export interface StatsDispatchRecord {
  id: string;
  timestamp: number;
  formattedDate: string;
  recipient: string;
  playerCount: number;
  triggerType: 'manual' | 'automatic';
  success: boolean;
  method?: string;
  subject: string;
}

/**
 * Checks whether the automated overall player stats email is enabled by the admin.
 * Defaults to true so the admin has automated coverage out of the box.
 */
export function getAutoEmailOverallStatsEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_AUTO_EMAIL_OVERALL_STATS);
    if (val !== null) return val === 'true';
  } catch {}
  return true;
}

/**
 * Updates the admin preference for automatic overall player stats emails.
 */
export function setAutoEmailOverallStatsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_AUTO_EMAIL_OVERALL_STATS, enabled ? 'true' : 'false');
    // Also broadcast to server
    fetch('/api/admin/auto-email-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).catch(() => {});
  } catch {}
}

/**
 * Retrieves the last dispatch record from local storage.
 */
export function getLastOverallStatsDispatch(): StatsDispatchRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_OVERALL_STATS_DISPATCH);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Saves a dispatch record to local storage.
 */
export function saveLastOverallStatsDispatch(record: StatsDispatchRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_OVERALL_STATS_DISPATCH, JSON.stringify(record));
  } catch {}
}

/**
 * Generates the fully detailed overall statistics report for all individual players.
 */
export function generateDetailedOverallStatsReport(
  existingPlayers?: OverallLeaderboardEntry[]
): OverallStatsReportResult {
  const players = existingPlayers || calculateAutomatedLeaderboard();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const generatedAt = `${dateStr} at ${timeStr}`;

  const subject = `[KABOOM DARTS] Complete Official Overall Player Statistics Report - Season Overall (${dateStr})`;

  // Calculate league aggregate figures
  const totalTracked = players.length;
  const totalWins = players.reduce((s, p) => s + (p.totalWins || 0), 0);
  const totalBulls = players.reduce((s, p) => s + (p.seasonBullsHit || 0), 0);
  const total180s = players.reduce((s, p) => s + (p.total180s || 0), 0);

  let leagueHighCheckout = 0;
  let leagueHighCheckoutPlayer = 'None';
  let leagueHighIn = 0;
  let leagueHighInPlayer = 'None';
  let leagueHighBaseball = 0;
  let leagueHighBaseballPlayer = 'None';

  players.forEach((p) => {
    const hOut = p.highCheckout || p.highOut || 0;
    if (hOut > leagueHighCheckout) {
      leagueHighCheckout = hOut;
      leagueHighCheckoutPlayer = p.playerName;
    }
    const hIn = p.highIn || 0;
    if (hIn > leagueHighIn) {
      leagueHighIn = hIn;
      leagueHighInPlayer = p.playerName;
    }
    const bb = p.wednesdayBaseballHighScore || p.wednesdayStats?.baseballHighScore || 0;
    if (bb > leagueHighBaseball) {
      leagueHighBaseball = bb;
      leagueHighBaseballPlayer = p.playerName;
    }
  });

  // Build Plain Text Report
  const dividerDouble = '═'.repeat(80);
  const dividerSingle = '─'.repeat(80);
  const dividerSub = '┄'.repeat(80);

  const padRight = (str: string, len: number) => (str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length));
  const padLeft = (str: string, len: number) => (str.length >= len ? str.slice(0, len) : ' '.repeat(len - str.length) + str);

  let text = '';
  text += `${dividerDouble}\n`;
  text += `🎯 KABOOM DARTS LEAGUE - OFFICIAL OVERALL PLAYER STATISTICS REPORT\n`;
  text += `${dividerDouble}\n`;
  text += `Official Recipient : ${OFFICIAL_LEAGUE_EMAIL}\n`;
  text += `Generated At       : ${generatedAt}\n`;
  text += `Total Players      : ${totalTracked} Registered Darters\n`;
  text += `Total Wins Tracked : ${totalWins}\n`;
  text += `Total League 180s  : ${total180s}\n`;
  text += `Total League Bulls : ${totalBulls}\n`;
  text += `High Checkout      : ${leagueHighCheckout > 0 ? `${leagueHighCheckout} (${leagueHighCheckoutPlayer})` : 'None'}\n`;
  text += `High Double-In     : ${leagueHighIn > 0 ? `${leagueHighIn} (${leagueHighInPlayer})` : 'None'}\n`;
  text += `High Baseball (9 In): ${leagueHighBaseball > 0 ? `${leagueHighBaseball} runs (${leagueHighBaseballPlayer})` : 'None'}\n`;
  text += `${dividerDouble}\n\n`;

  // SECTION 1: LEADERBOARD SUMMARY TABLE
  text += `SECTION 1: OVERALL CHAMPIONSHIP STANDINGS TABLE\n`;
  text += `${dividerSingle}\n`;
  text += `${padRight('RK', 4)} ${padRight('PLAYER', 20)} ${padLeft('WINS', 5)} ${padLeft('GP', 5)} ${padLeft('WIN%', 6)} ${padLeft('PTS', 5)} ${padLeft('3-AVG', 7)} ${padLeft('H-OUT', 6)} ${padLeft('H-IN', 5)} ${padLeft('180s', 5)} ${padLeft('BULLS', 6)}\n`;
  text += `${dividerSingle}\n`;

  players.forEach((p, idx) => {
    const rankStr = `#${idx + 1}`;
    const nameStr = p.playerName;
    const winsStr = String(p.totalWins || 0);
    const playedStr = String(p.totalPlayed || 0);
    const winRateStr = `${p.winPercentage || 0}%`;
    const ptsStr = String(p.totalPoints || p.totalWins || 0);
    const avgStr = p.threeDartAvg ? p.threeDartAvg.toFixed(1) : '-';
    const hOutStr = p.highCheckout || p.highOut ? String(p.highCheckout || p.highOut) : '-';
    const hInStr = p.highIn ? String(p.highIn) : '-';
    const n180sStr = String(p.total180s || 0);
    const bullsStr = String(p.seasonBullsHit || 0);

    text += `${padRight(rankStr, 4)} ${padRight(nameStr, 20)} ${padLeft(winsStr, 5)} ${padLeft(playedStr, 5)} ${padLeft(winRateStr, 6)} ${padLeft(ptsStr, 5)} ${padLeft(avgStr, 7)} ${padLeft(hOutStr, 6)} ${padLeft(hInStr, 5)} ${padLeft(n180sStr, 5)} ${padLeft(bullsStr, 6)}\n`;
  });
  text += `${dividerSingle}\n\n`;

  // SECTION 2: FULLY DETAILED INDIVIDUAL PLAYER BREAKDOWNS
  text += `SECTION 2: FULLY DETAILED INDIVIDUAL PLAYER BREAKDOWNS (${totalTracked} PLAYERS)\n`;
  text += `${dividerDouble}\n\n`;

  players.forEach((p, idx) => {
    const tues = p.tuesdayStats;
    const wed = p.wednesdayStats;
    const thurs = p.thursdayStats;

    text += `${dividerDouble}\n`;
    text += `[#${idx + 1}] PLAYER: ${p.playerName} ${p.avatar || '🎯'}   (ID: ${p.playerId || 'N/A'})\n`;
    text += `${dividerDouble}\n`;

    // 1. Career / Season Combined
    text += `► OVERALL COMBINED CAREER / SEASON TOTALS:\n`;
    text += `  • Total Game Wins           : ${p.totalWins}\n`;
    text += `  • Total Games Played        : ${p.totalPlayed}\n`;
    text += `  • Overall Win Percentage    : ${p.winPercentage}%\n`;
    text += `  • Overall Points            : ${p.totalPoints || p.totalWins}\n`;
    text += `  • Best 3-Dart Average       : ${p.threeDartAvg ? p.threeDartAvg.toFixed(2) : '0.00'}\n`;
    text += `  • Highest Out (Checkout)    : ${p.highCheckout || p.highOut || 'None'}\n`;
    text += `  • Highest In (Double In)    : ${p.highIn || 'None'}\n`;
    text += `  • Total 180s Hit            : ${p.total180s || 0}\n`;
    text += `  • Total Season Bulls Hit    : ${p.seasonBullsHit || 0}\n`;
    text += `\n`;

    // 2. Tuesday Singles
    text += `► TUESDAY SINGLES LEAGUE BREAKDOWN:\n`;
    if (p.tuesdayPlayed > 0 || p.tuesdayWins > 0 || (p.tuesdayBulls || 0) > 0 || tues) {
      const tuesWinRate = p.tuesdayPlayed > 0 ? Math.round((p.tuesdayWins / p.tuesdayPlayed) * 100) : 0;
      text += `  • Tuesday Record            : ${p.tuesdayWins} Wins / ${p.tuesdayPlayed} Games Played (${tuesWinRate}%)\n`;
      text += `  • Tuesday Points            : ${p.tuesdayPoints ?? p.tuesdayWins}\n`;
      text += `  • Tuesday 3-Dart Avg        : ${p.tuesdayAvg ? p.tuesdayAvg.toFixed(2) : (tues?.game501Avg ? tues.game501Avg.toFixed(2) : '-')}\n`;
      text += `  • Tuesday High Out          : ${p.tuesdayHighOut || tues?.game501HighFinish || tues?.game301HighFinish || '-'}\n`;
      text += `  • Tuesday High In (1st Shot): ${p.tuesdayHighIn || tues?.game301HighestBeginningScore || '-'}\n`;
      text += `  • Tuesday 180s Hit          : ${p.tuesday180s || 0}\n`;
      text += `  • Tuesday Season Bulls      : ${p.tuesdayBulls || tues?.seasonBullsHit || 0}\n`;

      if (tues) {
        text += `  • 501 Game Stats:\n`;
        text += `    - High Score: ${tues.game501HighScore || '-'}\n`;
        text += `    - High Finish: ${tues.game501HighFinish || '-'}\n`;
        text += `    - 3-Dart Average: ${tues.game501Avg ? tues.game501Avg.toFixed(2) : '-'}\n`;
        text += `    - Cumulative Scores 80+: ${tues.game501Scores80Plus || 0} pts\n`;
        text += `    - 501 Record: ${tues.game501Wins || 0} Wins / ${tues.game501Played || 0} Played\n`;

        text += `  • 301 Game Stats (Double In/Out):\n`;
        text += `    - High Score: ${tues.game301HighScore || '-'}\n`;
        text += `    - High In (Beginning Shot): ${tues.game301HighestBeginningScore || '-'}\n`;
        text += `    - High Finish: ${tues.game301HighFinish || '-'}\n`;
        text += `    - 3-Dart Average: ${tues.game301Avg ? tues.game301Avg.toFixed(2) : '-'}\n`;
        text += `    - 301 Record: ${tues.game301Wins || 0} Wins / ${tues.game301Played || 0} Played\n`;

        text += `  • Cricket Game Stats:\n`;
        text += `    - Cricket Record: ${tues.cricketWins || 0} Wins / ${tues.cricketPlayed || 0} Played\n`;
      }
    } else {
      text += `  • (No Tuesday Singles matches recorded)\n`;
    }
    text += `\n`;

    // 3. Wednesday Teams
    text += `► WEDNESDAY TEAMS LEAGUE BREAKDOWN:\n`;
    if (p.wednesdayPlayed > 0 || p.wednesdayWins > 0 || (p.wednesdayBulls || 0) > 0 || wed) {
      const wedWinRate = p.wednesdayPlayed > 0 ? Math.round((p.wednesdayWins / p.wednesdayPlayed) * 100) : 0;
      text += `  • Wednesday Record          : ${p.wednesdayWins} Wins / ${p.wednesdayPlayed} Games Played (${wedWinRate}%)\n`;
      text += `  • Wednesday Points          : ${p.wednesdayPoints ?? p.wednesdayWins}\n`;
      text += `  • Wednesday Season Bulls    : ${p.wednesdayBulls || wed?.seasonBullsHit || 0}\n`;
      text += `  • Baseball High Score (9 In): ${p.wednesdayBaseballHighScore || wed?.baseballHighScore || '-'} runs (Baseball Wins: ${wed?.baseballWins || 0})\n`;

      if (wed) {
        text += `  • 1001 Game Stats:\n`;
        text += `    - High Score: ${wed.game1001HighScore || '-'}\n`;
        text += `    - High Finish: ${wed.game1001HighFinish || '-'}\n`;
        text += `    - Scores 80+ Cumulative: ${wed.game1001Scores80Plus || 0} pts\n`;
        text += `    - Wins: ${wed.game1001Wins || 0}\n`;

        text += `  • 701 Game Stats (Double In):\n`;
        text += `    - High Score: ${wed.game701HighScore || '-'}\n`;
        text += `    - High In (1st Shot): ${wed.game701HighestBeginningScore || '-'}\n`;
        text += `    - High Finish: ${wed.game701HighFinish || '-'}\n`;
        text += `    - Scores 80+ Cumulative: ${wed.game701Scores80Plus || 0} pts\n`;
        text += `    - Wins: ${wed.game701Wins || 0}\n`;

        text += `  • 5s (Fives) Game Stats:\n`;
        text += `    - High Score: ${wed.fivesHighScore || '-'}\n`;
        text += `    - High Finish: ${wed.fivesHighFinish || '-'}\n`;
        text += `    - Wins: ${wed.fivesWins || 0}\n`;

        text += `  • Cricket Game Stats:\n`;
        text += `    - Cricket Wins: ${wed.cricketWins || 0}\n`;
      }
    } else {
      text += `  • (No Wednesday Teams matches recorded)\n`;
    }
    text += `\n`;

    // 4. Thursday Doubles
    text += `► THURSDAY DOUBLES LEAGUE BREAKDOWN:\n`;
    if (p.thursdayPlayed > 0 || p.thursdayWins > 0 || (p.thursdayBulls || 0) > 0) {
      const thursWinRate = p.thursdayPlayed > 0 ? Math.round((p.thursdayWins / p.thursdayPlayed) * 100) : 0;
      text += `  • Thursday Record           : ${p.thursdayWins} Wins / ${p.thursdayPlayed} Games Played (${thursWinRate}%)\n`;
      text += `  • Thursday Points           : ${p.thursdayPoints ?? p.thursdayWins}\n`;
      text += `  • Thursday 3-Dart Avg       : ${p.thursdayAvg ? p.thursdayAvg.toFixed(2) : (thurs?.game501Avg ? thurs.game501Avg.toFixed(2) : '-')}\n`;
      text += `  • Thursday High Out         : ${p.thursdayHighOut || thurs?.game501HighFinish || thurs?.game301HighFinish || '-'}\n`;
      text += `  • Thursday High In          : ${p.thursdayHighIn || thurs?.game301HighestBeginningScore || '-'}\n`;
      text += `  • Thursday 180s Hit         : ${p.thursday180s || 0}\n`;
      text += `  • Thursday Season Bulls     : ${p.thursdayBulls || thurs?.seasonBullsHit || 0}\n`;

      if (thurs) {
        text += `  • 501 Game Stats:\n`;
        text += `    - High Score: ${thurs.game501HighScore || '-'}\n`;
        text += `    - High Finish: ${thurs.game501HighFinish || '-'}\n`;
        text += `    - 3-Dart Average: ${thurs.game501Avg ? thurs.game501Avg.toFixed(2) : '-'}\n`;
        text += `    - Cumulative Scores 80+: ${thurs.game501Scores80Plus || 0} pts\n`;
        text += `    - 501 Record: ${thurs.game501Wins || 0} Wins / ${thurs.game501Played || 0} Played\n`;

        text += `  • 301 Game Stats (Double In/Out):\n`;
        text += `    - High Score: ${thurs.game301HighScore || '-'}\n`;
        text += `    - High In (Beginning Shot): ${thurs.game301HighestBeginningScore || '-'}\n`;
        text += `    - High Finish: ${thurs.game301HighFinish || '-'}\n`;
        text += `    - 3-Dart Average: ${thurs.game301Avg ? thurs.game301Avg.toFixed(2) : '-'}\n`;
        text += `    - 301 Record: ${thurs.game301Wins || 0} Wins / ${thurs.game301Played || 0} Played\n`;

        text += `  • Cricket Game Stats:\n`;
        text += `    - Cricket Record: ${thurs.cricketWins || 0} Wins / ${thurs.cricketPlayed || 0} Played\n`;
      }
    } else {
      text += `  • (No Thursday Doubles matches recorded)\n`;
    }

    text += `\n`;
  });

  text += `${dividerDouble}\n`;
  text += `END OF REPORT • DISPATCHED AUTOMATICALLY BY KABOOM DARTS LEAGUE ADMIN CONSOLE\n`;
  text += `Official Delivery Address: ${OFFICIAL_LEAGUE_EMAIL}\n`;
  text += `${dividerDouble}\n`;

  // HTML Version for rich display or HTML email senders
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; line-height: 1.5; }
    .container { max-width: 860px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { background: #0f172a; color: #ffffff; padding: 24px 28px; }
    .header h1 { margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #f8fafc; }
    .header p { margin: 4px 0; font-size: 13px; color: #94a3b8; }
    .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .badge { background: #1e293b; border: 1px solid #334155; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #38bdf8; }
    .content { padding: 24px 28px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .player-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px; background: #ffffff; }
    .player-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px; }
    .player-title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
    .league-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 12px; }
    .league-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; }
    .league-box h4 { margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    .stat-line { display: flex; justify-content: space-between; padding: 2px 0; }
    .stat-label { color: #64748b; }
    .stat-val { font-weight: 700; color: #0f172a; }
    .footer { background: #f1f5f9; padding: 16px 28px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 KABOOM DARTS - OFFICIAL OVERALL PLAYER STATISTICS</h1>
      <p>Official League Recipient: <strong>${OFFICIAL_LEAGUE_EMAIL}</strong></p>
      <p>Generated: ${generatedAt} • Automated Admin Dispatch</p>
      <div class="badges">
        <span class="badge">${totalTracked} Active Players</span>
        <span class="badge">${totalWins} Total Wins</span>
        <span class="badge">${total180s} Total 180s</span>
        <span class="badge">${totalBulls} Season Bulls</span>
      </div>
    </div>
    <div class="content">
      <h3 style="margin-top: 0; font-size: 16px; color: #0f172a;">Championship Standings Overview</h3>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Wins</th>
            <th>GP</th>
            <th>Win%</th>
            <th>Pts</th>
            <th>3-Dart Avg</th>
            <th>High Out</th>
            <th>High In</th>
            <th>180s</th>
            <th>Bulls</th>
          </tr>
        </thead>
        <tbody>`;

  players.forEach((p, idx) => {
    html += `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong>${p.playerName}</strong></td>
            <td>${p.totalWins}</td>
            <td>${p.totalPlayed}</td>
            <td>${p.winPercentage}%</td>
            <td>${p.totalPoints || p.totalWins}</td>
            <td>${p.threeDartAvg ? p.threeDartAvg.toFixed(1) : '-'}</td>
            <td>${p.highCheckout || p.highOut || '-'}</td>
            <td>${p.highIn || '-'}</td>
            <td>${p.total180s || 0}</td>
            <td>${p.seasonBullsHit || 0}</td>
          </tr>`;
  });

  html += `
        </tbody>
      </table>

      <h3 style="font-size: 16px; color: #0f172a; margin-top: 32px;">Individual Player Detailed Profiles</h3>`;

  players.forEach((p, idx) => {
    const tues = p.tuesdayStats;
    const wed = p.wednesdayStats;
    const thurs = p.thursdayStats;

    html += `
      <div class="player-card">
        <div class="player-header">
          <h3 class="player-title">#${idx + 1} ${p.playerName} ${p.avatar || '🎯'}</h3>
          <span style="font-size: 12px; font-weight: 700; color: #4338ca;">${p.totalWins} Wins (${p.winPercentage}% Win Rate)</span>
        </div>
        <div style="font-size: 12px; margin-bottom: 10px;">
          <strong>Career / Season Overall:</strong> ${p.totalWins} Wins / ${p.totalPlayed} Played • Points: ${p.totalPoints || p.totalWins} • Best 3-Dart Avg: ${p.threeDartAvg ? p.threeDartAvg.toFixed(1) : '-'} • High Out: ${p.highCheckout || p.highOut || '-'} • High In: ${p.highIn || '-'} • 180s: ${p.total180s || 0} • Season Bulls: ${p.seasonBullsHit || 0}
        </div>
        <div class="league-grid">
          <div class="league-box">
            <h4>Tuesday Singles</h4>
            <div class="stat-line"><span class="stat-label">Record:</span><span class="stat-val">${p.tuesdayWins}W / ${p.tuesdayPlayed}P</span></div>
            <div class="stat-line"><span class="stat-label">3-Dart Avg:</span><span class="stat-val">${p.tuesdayAvg ? p.tuesdayAvg.toFixed(1) : '-'}</span></div>
            <div class="stat-line"><span class="stat-label">High Out:</span><span class="stat-val">${p.tuesdayHighOut || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">High In:</span><span class="stat-val">${p.tuesdayHighIn || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">501 High / Fin:</span><span class="stat-val">${tues?.game501HighScore || '-'}/${tues?.game501HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">301 High / Fin:</span><span class="stat-val">${tues?.game301HighScore || '-'}/${tues?.game301HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">Cricket Wins:</span><span class="stat-val">${tues?.cricketWins || 0}</span></div>
          </div>
          <div class="league-box">
            <h4>Wednesday Teams</h4>
            <div class="stat-line"><span class="stat-label">Record:</span><span class="stat-val">${p.wednesdayWins}W / ${p.wednesdayPlayed}P</span></div>
            <div class="stat-line"><span class="stat-label">Baseball High:</span><span class="stat-val">${p.wednesdayBaseballHighScore || wed?.baseballHighScore || '-'} runs</span></div>
            <div class="stat-line"><span class="stat-label">1001 High / Fin:</span><span class="stat-val">${wed?.game1001HighScore || '-'}/${wed?.game1001HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">701 High / Fin:</span><span class="stat-val">${wed?.game701HighScore || '-'}/${wed?.game701HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">5s High / Fin:</span><span class="stat-val">${wed?.fivesHighScore || '-'}/${wed?.fivesHighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">Cricket Wins:</span><span class="stat-val">${wed?.cricketWins || 0}</span></div>
          </div>
          <div class="league-box">
            <h4>Thursday Doubles</h4>
            <div class="stat-line"><span class="stat-label">Record:</span><span class="stat-val">${p.thursdayWins}W / ${p.thursdayPlayed}P</span></div>
            <div class="stat-line"><span class="stat-label">3-Dart Avg:</span><span class="stat-val">${p.thursdayAvg ? p.thursdayAvg.toFixed(1) : '-'}</span></div>
            <div class="stat-line"><span class="stat-label">High Out:</span><span class="stat-val">${p.thursdayHighOut || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">High In:</span><span class="stat-val">${p.thursdayHighIn || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">501 High / Fin:</span><span class="stat-val">${thurs?.game501HighScore || '-'}/${thurs?.game501HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">301 High / Fin:</span><span class="stat-val">${thurs?.game301HighScore || '-'}/${thurs?.game301HighFinish || '-'}</span></div>
            <div class="stat-line"><span class="stat-label">Cricket Wins:</span><span class="stat-val">${thurs?.cricketWins || 0}</span></div>
          </div>
        </div>
      </div>`;
  });

  html += `
    </div>
    <div class="footer">
      Official Delivery Address: ${OFFICIAL_LEAGUE_EMAIL} • Kaboom Darts Automated Statistics Engine
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    textReport: text,
    htmlReport: html,
    recipient: OFFICIAL_LEAGUE_EMAIL,
    totalPlayers: totalTracked,
    generatedAt,
    players,
  };
}

/**
 * Dispatches the overall player statistics email report directly to surgedarts@gmail.com.
 * Sends payload to the backend server endpoint /api/admin/email-overall-stats,
 * updates local storage history, and optionally opens native mailto or webmail.
 */
export async function dispatchOverallPlayerStatsEmail(options: {
  triggerType?: 'manual' | 'automatic';
  openClient?: boolean;
  openGmail?: boolean;
} = {}): Promise<{
  success: boolean;
  message: string;
  report: OverallStatsReportResult;
  mailtoUrl: string;
  gmailUrl: string;
}> {
  const triggerType = options.triggerType || 'manual';
  const report = generateDetailedOverallStatsReport();

  const mailtoUrl = getNativeMailtoUrl(OFFICIAL_LEAGUE_EMAIL, [], report.subject, report.textReport);
  const gmailUrl = getGmailComposeUrl(OFFICIAL_LEAGUE_EMAIL, [], report.subject, report.textReport);

  let backendSuccess = false;
  let backendMessage = '';

  try {
    const res = await fetch('/api/admin/email-overall-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: OFFICIAL_LEAGUE_EMAIL,
        subject: report.subject,
        bodyText: report.textReport,
        bodyHtml: report.htmlReport,
        playerCount: report.totalPlayers,
        triggerType,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      backendSuccess = true;
      backendMessage = data.message || 'Report logged and sent to surgedarts@gmail.com';
    } else {
      backendMessage = `Server returned status ${res.status}`;
    }
  } catch (err) {
    backendMessage = err instanceof Error ? err.message : 'Network error';
  }

  // Record dispatch in local storage
  const record: StatsDispatchRecord = {
    id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    formattedDate: report.generatedAt,
    recipient: OFFICIAL_LEAGUE_EMAIL,
    playerCount: report.totalPlayers,
    triggerType,
    success: true,
    method: backendSuccess ? 'backend_dispatch' : 'client_mailto',
    subject: report.subject,
  };
  saveLastOverallStatsDispatch(record);

  // If user requested client opening
  if (options.openClient) {
    openMailtoLink(OFFICIAL_LEAGUE_EMAIL, [], report.subject, report.textReport);
  } else if (options.openGmail) {
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  }

  return {
    success: true,
    message: backendSuccess
      ? `Overall stats for ${report.totalPlayers} players successfully dispatched to ${OFFICIAL_LEAGUE_EMAIL}.`
      : `Overall stats report prepared for ${OFFICIAL_LEAGUE_EMAIL}.`,
    report,
    mailtoUrl,
    gmailUrl,
  };
}
