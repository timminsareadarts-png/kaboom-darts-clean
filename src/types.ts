export type GameMode = 'X01' | 'CRICKET' | 'MEDLEY' | 'BASEBALL' | 'FIVES' | 'AROUND_THE_CLOCK' | 'BOBS_27' | 'PRACTICE_121' | 'HALVE_IT' | 'KILLER' | 'SHANGHAI';

export type InOutMode = 'Straight' | 'Double' | 'Master';

export type MatchFormat = 'legs' | 'sets';

export type ThemeMode = 'light' | 'dark';

export type CallerVoiceStyle =
  | 'pdc_russ'
  | 'pdc_official'
  | 'pdc_kirk'
  | 'pdc_george'
  | 'pdc_huw'
  | 'mc_john'
  | 'irish_caller'
  | 'us_pro'
  | 'aussie_pro'
  | 'dutch_pro'
  | 'british'
  | 'male'
  | 'female'
  | 'scottish'
  | 'jamaican'
  | 'funny'
  | 'serious';

export interface AppSettings {
  theme: ThemeMode;
  callerVoice: CallerVoiceStyle;
  callerPitch: number;
  callerSpeed: number;
  callerVolume: number;
  soundEffects: boolean;
  announcerEnabled: boolean;
  showVisualCalls: boolean;
}

export interface PlayerStats {
  threeDartAvg: number;
  first9Avg: number;
  mpr: number; // Marks per round (Cricket)
  highScore: number;
  highOut: number;
  highIn?: number; // Highest opening score hit on first shot in Double In games
  checkoutAttempts: number;
  checkoutHits: number;
  count60Plus: number;
  count100Plus: number;
  count140Plus: number;
  count180: number;
  dartsThrown: number;
}

export interface TurnLog {
  id: string;
  turnNumber: number;
  playerId: string;
  playerName: string;
  shooterName?: string;
  isDummyTurn?: boolean;
  dummyRotatedPlayerName?: string;
  creditedPlayerName?: string;
  subPlayerIndex?: number;
  subPlayerId?: string;
  targetIndex?: number;
  dummyShooterIndices?: Record<string, number>;
  lastRealShooterIndex?: number;
  score: number;
  remainingBefore: number;
  remainingAfter: number;
  dartsUsed: number;
  isBust: boolean;
  isCheckout: boolean;
  dartsDetail?: string[]; // e.g. ['T20', 'T20', 'T20'] or ['S20', 'D20']
  timestamp: number;
}

export interface LegRecord {
  legNumber: number;
  setNumber?: number;
  gameMode?: GameMode;
  startScore?: number;
  winnerId: string;
  winnerName: string;
  turns: TurnLog[];
  dartsCount: Record<string, number>; // playerId -> darts used in this leg
  averages: Record<string, number>;   // playerId -> 3-dart avg in this leg
  winningOut?: number;
}

export interface CricketMarkRecord {
  15: number;
  16: number;
  17: number;
  18: number;
  19: number;
  20: number;
  25: number; // Bull
  doubles?: number; // 3 Doubles required segment for No-Score Cricket
  triples?: number; // 3 Triples required segment for No-Score Cricket
}

export interface TeamSubPlayer {
  id: string;
  name: string;
  avatar?: string;
  isDummy?: boolean;
  stats?: PlayerStats;
  first9Darts?: number[];
  baseballHits?: Record<number, number>;
  baseballScore?: number;
}

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  teamId?: string; // For doubles / 2v2
  currentScore: number; // for X01 (starts at 501, 301, etc.)
  legsWon: number;
  setsWon: number;
  isBot?: boolean;
  isDummy?: boolean;
  botLevel?: number; // 1 to 10
  cricketMarks: CricketMarkRecord;
  cricketPoints: number;
  stats: PlayerStats;
  first9Darts: number[]; // Scores of the first 9 darts thrown in legs
  teamPlayers?: TeamSubPlayer[];
  currentSubPlayerIndex?: number;
  dummyShooterIndices?: Record<string, number>;
  hasMarkedFirstScore?: boolean; // For Double In games: true once first score is marked
  lastRealShooterIndex?: number; // Index in real team members who last threw
  baseballHits?: Record<number, number>; // inning index (0..8) -> hits (0..9)
  baseballScore?: number; // Total runs scored in Baseball
  fivesScore?: number; // Current remaining score in Fives (starts at 101)
  fivesPointsEarned?: number; // Total points earned in Fives
}

export interface MedleyGameConfig {
  legNumber: number;
  title: string;
  gameMode: GameMode;
  startScore: number;
  inMode: InOutMode;
  outMode: InOutMode;
  isOptional?: boolean;
}

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

export const DEFAULT_MEDLEY_CONFIGS: MedleyGameConfig[] = TUESDAY_MEDLEY_CONFIGS;

export type X01StartScore = 301 | 501 | 701 | 1001 | number;

export interface MatchSettings {
  gameMode: GameMode;
  startScore: X01StartScore; // 301, 501, 701, 1001
  inMode: InOutMode;
  outMode: InOutMode;
  format: MatchFormat;
  legsToWin: number;
  setsToWin: number;
  legsPerSet: number;
  isDartBot: boolean;
  botLevel: number;
  announceAudio: boolean;
  callerVoice?: CallerVoiceStyle;
  isPublic: boolean;
  matchCode: string;
  starterPlayerId: string;
  isMedley?: boolean;
  medleyConfigs?: MedleyGameConfig[];
  baseballTargets?: (number | string)[];
  fivesTarget?: number; // default 101 (or 51, 201)
  isDoubles?: boolean;
  doublesMode?: 'blind_draw' | 'designated';
  leagueType?: 'tuesday' | 'wednesday' | 'thursday' | 'none';
  bracketMatchId?: string;
  division?: number | string;
  isBye?: boolean;
}

export interface BullsRoundPlayerRecord {
  playerId: string;
  playerName: string;
  avatar?: string;
  teamId: string;
  teamName: string;
  shooterName?: string;
  shooterId?: string;
  bullsHit: number; // total bulls hit across all 9 darts (up to 18)
  shots?: [number, number, number]; // 3 turns (each 0-6 bulls)
  dartsDetail?: [
    [number, number, number], // Turn 1: [dart1, dart2, dart3] (each 0, 1, or 2 bulls)
    [number, number, number], // Turn 2: [dart1, dart2, dart3] (each 0, 1, or 2 bulls)
    [number, number, number], // Turn 3: [dart1, dart2, dart3] (each 0, 1, or 2 bulls)
  ];
  timestamp: number;
}

export interface NightlyBullsEntry {
  playerId: string;
  playerName: string;
  avatar?: string;
  bullsHit: number; // total bulls hit (0 to 18)
  shots?: [number, number, number]; // 3 turns (each 0-6 bulls)
  dartsDetail?: [
    [number, number, number], // Turn 1: [dart1, dart2, dart3]
    [number, number, number], // Turn 2: [dart1, dart2, dart3]
    [number, number, number], // Turn 3: [dart1, dart2, dart3]
  ];
  timestamp: number;
}

export interface NightlyBullsSession {
  id: string; // e.g. "tuesday-2026-09-17"
  date: string; // "2026-09-17"
  displayDate: string; // "Tuesday, Sep 17, 2026"
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  entries: Record<string, NightlyBullsEntry>; // key: lowercase playerName
  createdAt: number;
  updatedAt: number;
}

export interface MatchState {
  id: string;
  matchCode: string;
  status: 'setup' | 'active' | 'completed';
  settings: MatchSettings;
  players: Player[];
  activePlayerIndex: number;
  currentSet: number;
  currentLeg: number;
  currentGameMode?: GameMode; // Active game mode for Medley matches
  currentStartScore?: number;
  currentInMode?: InOutMode;
  currentOutMode?: InOutMode;
  starterPlayerIndex: number; // Who started the current leg
  history: TurnLog[];
  completedLegs: LegRecord[];
  bullsRoundResults?: BullsRoundPlayerRecord[];
  winnerId?: string;
  winnerName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TuesdayPlayerGameStats {
  playerId: string;
  playerName: string;
  avatar: string;

  // 501 Game Stats (Tuesday Singles 501 only)
  game501HighScore: number; // All-time high score in 501 for Tuesday Singles
  game501Scores80Plus: number; // Running point sum total of all shots player hits that are 80 or higher (adds all scores >= 80)
  game501HighFinish: number; // Highest shot to finish any Tuesday night 501 game during the match
  game501Avg: number; // Running average of individual player's 501 games throughout the year
  game501DartsThrown: number;
  game501TotalScore: number;
  game501Wins: number;
  game501Played: number;

  // Cricket Game Stats (Tuesday Singles Cricket only)
  cricketWins: number; // Running total of Cricket games won by the individual player
  cricketPlayed: number;

  // 301 Game Stats (Tuesday Singles 301 only)
  game301HighestBeginningScore: number; // Highest first score a player hits for the season (Double In 1st shot)
  game301HighScore: number; // Highest score overall hit by a player in 301
  game301HighFinish: number; // 301 High finish awarded to the player who finished the game by tracking their finishing score
  game301Wins: number; // Running total of Wins in all 301 games played in Tuesday League
  game301Avg: number; // Running 3-dart average for all 301 games played in the Tuesday league
  game301DartsThrown: number;
  game301TotalScore: number;
  game301Played: number;

  // Bulls Round Stats (Tuesday Singles Bulls)
  seasonBullsHit: number; // Running total of bulls each individual player hits during Bulls

  // Overall Running Totals for Tuesday Singles
  totalGameWins: number; // Sum of 301 Wins + 501 Wins + Cricket Wins
  totalGamesPlayed: number;
  points: number;
}

export interface ThursdayPlayerGameStats {
  playerId: string;
  playerName: string;
  avatar: string;

  // 501 Game Stats (Thursday League 501)
  game501HighScore: number; // All-time high score in 501 for Thursday League
  game501Scores80Plus: number; // Running point sum total of all shots player hits that are 80 or higher (adds all scores >= 80)
  game501HighFinish: number; // Highest shot to finish any Thursday night 501 game during the match
  game501Avg: number; // Running average of individual player's 501 games throughout the year
  game501DartsThrown: number;
  game501TotalScore: number;
  game501Wins: number;
  game501Played: number;

  // Cricket Game Stats (Thursday League Cricket)
  cricketWins: number; // Running total of Cricket games won by the individual player
  cricketPlayed: number;

  // 301 Game Stats (Thursday League 301)
  game301HighestBeginningScore: number; // Highest first score a player hits for the season (Double In 1st shot)
  game301HighScore: number; // Highest score overall hit by a player in 301
  game301HighFinish: number; // 301 High finish awarded to the player who finished the game by tracking their finishing score
  game301Wins: number; // Running total of Wins in all 301 games played in Thursday League
  game301Avg: number; // Running 3-dart average for all 301 games played in the Thursday league
  game301DartsThrown: number;
  game301TotalScore: number;
  game301Played: number;

  // Bulls Round Stats (Thursday League Bulls)
  seasonBullsHit: number; // Running total of bulls each individual player hits during Bulls

  // Overall Running Totals for Thursday League
  totalGameWins: number; // Sum of 301 Wins + 501 Wins + Cricket Wins
  totalGamesPlayed: number;
  points: number;
}

export interface WednesdayPlayerGameStats {
  playerId: string;
  playerName: string;
  avatar: string;
  teamId?: string;
  teamName?: string;

  // 1001 Game Stats (Game 1 & Game 6)
  game1001HighScore: number;
  game1001HighFinish: number;
  game1001Scores80Plus: number; // Running point sum total of all turns >= 80
  game1001Wins: number;

  // 701 Game Stats (Game 3)
  game701HighestBeginningScore: number;
  game701HighScore: number;
  game701HighFinish: number;
  game701Scores80Plus: number; // Running point sum total of all turns >= 80
  game701Wins: number;

  // Baseball Game Stats (Game 2)
  baseballHighScore: number; // Each individual's highest overall Baseball score (runs scored across all innings)
  baseballWins: number;

  // 5s (Fives) Game Stats (Game 4)
  fivesHighScore: number;
  fivesHighFinish: number;
  fivesWins: number;

  // Cricket Game Stats (Game 5)
  cricketWins: number;

  // Bulls Round Stats
  seasonBullsHit: number;

  // Overall Running Totals
  totalGameWins: number; // Sum of 1001 + 701 + Baseball + 5s + Cricket wins
  totalGamesPlayed: number;
  points?: number;
}

export interface IndividualLeagueStanding {
  playerId: string;
  playerName: string;
  points: number;
  gamesPlayed: number;
  gamesWon: number;
  threeDartAvg: number;
  highCheckout: number;
  highOut?: number; // Highest checkout finish
  highIn?: number; // Highest score hit on first shot in Double In games
  total180s: number;
  seasonBullsHit?: number;
  tuesdayStats?: TuesdayPlayerGameStats;
  wednesdayStats?: WednesdayPlayerGameStats;
  thursdayStats?: ThursdayPlayerGameStats;
}

export interface OverallLeaderboardEntry {
  playerId: string;
  playerName: string;
  avatar: string;
  tuesdayWins: number;
  tuesdayPlayed: number;
  wednesdayWins: number;
  wednesdayPlayed: number;
  thursdayWins: number;
  thursdayPlayed: number;
  totalWins: number;
  totalPlayed: number;
  winPercentage: number;
  totalPoints: number;
  threeDartAvg: number;
  highCheckout: number;
  highOut?: number;
  highIn?: number;
  // Specific league statistics
  tuesdayPoints?: number;
  tuesdayAvg?: number;
  tuesdayHighOut?: number;
  tuesdayHighIn?: number;
  wednesdayPoints?: number;
  wednesdayAvg?: number;
  wednesdayHighOut?: number;
  wednesdayHighIn?: number;
  wednesdayBaseballHighScore?: number;
  thursdayPoints?: number;
  thursdayAvg?: number;
  thursdayHighOut?: number;
  thursdayHighIn?: number;
  tuesdayBulls?: number;
  wednesdayBulls?: number;
  thursdayBulls?: number;
  tuesday180s?: number;
  wednesday180s?: number;
  thursday180s?: number;
  total180s: number;
  seasonBullsHit?: number;
  tuesdayStats?: TuesdayPlayerGameStats;
  wednesdayStats?: WednesdayPlayerGameStats;
  thursdayStats?: ThursdayPlayerGameStats;
}

export interface LeagueAttendancePlayer {
  id: string;
  name: string;
  avatar: string;
  checkedIn: boolean;
  division?: 'Division A' | 'Division B';
}

export interface LeagueTeamComposition {
  id: string;
  name: string;
  players: { id: string; name: string; avatar: string; isDummy?: boolean }[];
  checkedIn: boolean;
  division?: string;
}

export interface BracketMatchup {
  id: string;
  leagueType: 'tuesday' | 'wednesday' | 'thursday';
  division: string;
  round: string;
  entryA: { id: string; name: string; players: { id: string; name: string; avatar: string; isDummy?: boolean }[] };
  entryB: { id: string; name: string; players: { id: string; name: string; avatar: string; isDummy?: boolean }[] };
  scoreA?: number;
  scoreB?: number;
  status: 'pending' | 'in_progress' | 'completed';
  winnerName?: string;
  isBye?: boolean;
  isReplayRound?: boolean;
  isDummyOpponent?: boolean;
}

export interface DivisionData {
  name: string;
  subtitle?: string;
  matchups: BracketMatchup[];
}

export interface LeagueBracketsState {
  isMultiDivision: boolean;
  divisionA: BracketMatchup[];
  divisionB: BracketMatchup[];
  divisionC?: BracketMatchup[];
  divisionD?: BracketMatchup[];
  divisionE?: BracketMatchup[];
  divisionF?: BracketMatchup[];
  divisions?: DivisionData[];
}

export interface CheckoutRoute {
  score: number;
  dartsCount: number;
  combination: string[]; // e.g. ["T20", "T20", "Bull"]
  description: string;
}

export interface PracticeSession {
  type: 'AROUND_THE_CLOCK' | 'BOBS_27' | 'PRACTICE_121';
  score: number;
  target?: number;
  dartsCount: number;
  completed: boolean;
  logs: { target: string; result: string; points: number }[];
}

export type LeagueFinanceType = 'tuesday' | 'wednesday' | 'thursday';

export interface MembershipPaymentRecord {
  id: string;
  amount: number;
  timestamp: number;
  dateStr: string;
  note?: string;
}

export interface DailyFeePaymentRecord {
  id: string;
  amount: number;
  timestamp: number;
  dateStr: string;
  note?: string;
}

export interface SpareFeePaymentRecord {
  id: string;
  amount: number;
  timestamp: number;
  dateStr: string;
  note?: string;
}

export interface LeaguePlayerFinance {
  playerId: string;
  playerName: string;
  avatar: string;
  isMember: boolean; // true if fully paid or on payment plan
  membershipDeposit: number; // cumulative amount paid towards $40 (e.g. 0 to 40.00)
  membershipPaidDate?: string;
  membershipPayments?: MembershipPaymentRecord[]; // history of individual installment payments
  dailyFeeActive: boolean; // slider on/off for playing tonight's session
  dailyFeeType: 'member' | 'spare'; // 'member' ($2.00) or 'spare' ($5.00)
  totalDailyFeesPaid: number; // running total of daily fees paid towards season max ($68.00)
  dailyFeePaidInFull?: boolean; // true if daily fees reached $68.00 or paid upfront
  dailyFeePaidDate?: string;
  dailyFeePayments?: DailyFeePaymentRecord[]; // records of upfront/installment payments or session credits
  totalSpareFeesPaid?: number; // running total of spare fees paid ($5.00 a night, no season limit)
  spareFeePayments?: SpareFeePaymentRecord[]; // records of spare fee payments
  updatedAt?: number; // timestamp of most recent finance mutation
}

export interface DailyFeeSessionLog {
  id: string;
  leagueType: LeagueFinanceType;
  timestamp: number;
  dateStr: string;
  totalAmount: number;
  memberCount: number;
  spareCount: number;
  memberTotal: number;
  spareTotal: number;
  prepaidCount?: number; // count of attending members who have already paid $68 in full
  playersAttending: {
    playerId: string;
    playerName: string;
    avatar: string;
    type: 'member' | 'spare';
    fee: number;
    isPrepaid?: boolean;
  }[];
  note?: string;
}

export interface LeagueFinanceTotals {
  memberDepositsTotal: number;
  dailyFeesTotal: number;
  spareFeesTotal?: number;
  totalBalance: number;
  drawsLeagueShare?: number;
  totalBalanceWithDraws?: number;
  memberCount: number;
  partialMemberCount?: number;
  spareCount: number;
  totalPlayers: number;
  totalMembershipOutstanding?: number;
  dailyFeePaidInFullCount?: number;
  dailyFeeRunningCount?: number;
  dailyFeeOutstanding?: number;
}

export type UserRole = 'admin' | 'player';

export interface ActiveAdminSessionInfo {
  sessionId: string;
  startedAt: number;
  lastHeartbeat: number;
  clientInfo?: string;
}

export interface AdminLoginResult {
  success: boolean;
  sessionId?: string;
  sessionConflict?: boolean;
  activeSession?: ActiveAdminSessionInfo;
  error?: string;
}

export interface AuthSecurityConfig {
  adminPin: string;
  playerPin: string;
  updatedAt: number;
}

export interface AuthContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  logout: () => void;
  isAdmin: boolean;
  isPlayer: boolean;
  isSpectator: boolean;
  canEditFinance: boolean;
  canScore: boolean;
  canPlayMatches: boolean;
  canDelete: boolean;
  adminPin: string;
  playerPin: string;
  adminSessionId: string | null;
  loginAsAdmin: (pin: string, forceTakeover?: boolean) => Promise<AdminLoginResult>;
  updateSecurityPins: (newAdminPin: string, newPlayerPin: string) => Promise<boolean>;
  resetPinsToDefault: () => Promise<boolean>;
}

export type DrawType = 'door_prize' | 'lucky_number' | 'double_draw';

export interface DrawSpotEntry {
  id: string;
  playerId?: string;
  playerName: string;
  avatar?: string;
  spotsCount: number; // number of spots purchased (each spot gives 3 entries on the wheel)
  paid: boolean;
  amountPaid: number;
  timestamp: number;
  leagueType?: 'tuesday' | 'wednesday' | 'thursday';
}

export interface DrawWheelSegment {
  id: string;
  spotEntryId: string;
  playerId?: string;
  playerName: string;
  avatar?: string;
  occurrenceIndex: number; // 1, 2, or 3 for that spot
  color: string;
}

export interface DrawSessionRecord {
  id: string;
  drawType: DrawType;
  drawName: string;
  timestamp: number;
  dateStr: string;
  costPerSpot: number;
  spotsSold: number;
  totalBroughtIn: number;
  leagueShare: number; // 50% added to running total and finances
  playerPrizePaid: number; // Prize won by the player
  winnerPlayerName: string;
  winnerAvatar?: string;
  winnerPlayerId?: string;
  leagueType?: 'tuesday' | 'wednesday' | 'thursday';
  // Lucky Number specific
  luckyTargetNumber?: number; // 1 to 21 (21 = Bullseye)
  dartHits?: number; // 0, 1, 2, or 3 hits
  hitPercentage?: number; // 0%, 33%, 66%, or 100%
  bucketBeforeDraw?: number;
  bucketRemainingRollover?: number;
  // Double Draw specific
  doubleTargetNumber?: number; // 1 to 20 (or 21 = D-Bull)
  doubleHit?: boolean;
  addedToBucket?: number; // 50% pot share added to the progressive rollover bucket
  note?: string;
}

export interface SingleDrawData {
  spots: DrawSpotEntry[];
  runningTotalLeague: number; // 50% league share running total
  bucketTotal?: number; // For lucky number and double draw: 50% + rollovers
  history: DrawSessionRecord[];
}

export interface SingleLeagueDrawsData {
  doorPrize: SingleDrawData;
  luckyNumber: SingleDrawData;
  doubleDraw: SingleDrawData;
  door_prize?: SingleDrawData;
  lucky_number?: SingleDrawData;
  double_draw?: SingleDrawData;
}

export interface DrawsState {
  isPublicViewable: boolean; // Admin switch: viewable to players & spectators or restricted
  selectedLeague?: 'tuesday' | 'wednesday' | 'thursday';
  leagues?: {
    tuesday: SingleLeagueDrawsData;
    wednesday: SingleLeagueDrawsData;
    thursday: SingleLeagueDrawsData;
  };
  doorPrize: SingleDrawData;
  luckyNumber: SingleDrawData;
  doubleDraw: SingleDrawData;
  door_prize?: SingleDrawData;
  lucky_number?: SingleDrawData;
  double_draw?: SingleDrawData;
  updatedAt: number;
}

