import React, { useState } from 'react';
import { GameMode, MatchSettings, Player } from '../types';
import { 
  Trophy, 
  Target, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Crosshair, 
  Play, 
  Users, 
  Bot, 
  Calendar, 
  CheckCircle2, 
  Search, 
  Flame, 
  HelpCircle,
  Clock,
  Award,
  Layers,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface GamesLibraryProps {
  onQuickLaunchGame: (gameMode: GameMode, customSettings?: Partial<MatchSettings>) => void;
  onOpenMatchSetup: (initialGameMode?: GameMode) => void;
  onNavigateToLeague: (leagueDay: 'tuesday' | 'wednesday' | 'thursday') => void;
}

interface GameDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gameMode: GameMode;
  leagues: ('Tuesday' | 'Wednesday' | 'Thursday' | 'Any Day / Casual')[];
  category: 'league' | 'casual' | 'practice';
  minPlayers: string;
  description: string;
  rules: string[];
  scoringSummary: string;
  targetSegments: string;
  recommendedSettings?: Partial<MatchSettings>;
}

export const GamesLibrary: React.FC<GamesLibraryProps> = ({
  onQuickLaunchGame,
  onOpenMatchSetup,
  onNavigateToLeague,
}) => {
  const { role, canPlayMatches } = useAuth();
  const [filter, setFilter] = useState<'all' | 'tuesday' | 'wednesday' | 'thursday' | 'casual' | 'practice'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGameModal, setSelectedGameModal] = useState<GameDefinition | null>(null);

  const gamesCatalog: GameDefinition[] = [
    {
      id: 'baseball',
      title: 'Baseball Darts',
      subtitle: '9 AI-Assigned Targets (1–20, No Bull) + Tie-Breaker',
      icon: <Sparkles className="w-6 h-6 text-amber-500" />,
      gameMode: 'BASEBALL',
      leagues: ['Wednesday', 'Tuesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'A fast-paced, high-energy dartboard variant played over 9 target rounds. For every new game, 9 unique random numbers strictly between 1 and 20 (no bull) are generated and sorted from lowest to highest. Players select 0 to 9 hits in the side-by-side dropdown boxes or using the floating 1-tap quick selector. If scores are tied after 9 targets, sudden-death tie-breaker rounds determine the winner!',
      rules: [
        'Played over 9 distinct target rounds (#1 through #9).',
        '9 random dartboard numbers (1–20) generated for every new game and sorted lowest to highest (no bull).',
        'Throw 3 darts at the assigned target number for that round.',
        'Score 0 to 9 hits per target (Singles = 1 hit, Doubles = 2 hits, Triples = 3 hits). Max 9 hits (3x Triples).',
        'Input score via side-by-side dropdown boxes (0–9) or the floating 1-tap quick hit selector.',
        'Highest total runs wins! In the event of a tie, sudden-death tie-breaker rounds are triggered until a champion emerges.',
      ],
      scoringSummary: 'Singles = 1 Run, Doubles = 2 Runs, Triples = 3 Runs. Total of all targets = Final Score. Sudden-death tie breaker if tied.',
      targetSegments: '9 AI-Randomized numbers strictly from 1–20 (No Bull) + Tie-Breakers',
      recommendedSettings: {
        gameMode: 'BASEBALL',
        format: 'legs',
        legsToWin: 1,
      },
    },
    {
      id: 'fives',
      title: 'Game of Fives',
      subtitle: 'Divisible by 5 Scoring (Goal: 101 down to 0)',
      icon: <span className="text-2xl leading-none">🖐️</span>,
      gameMode: 'FIVES',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'A classic pub dart game where every turn’s 3-dart total score must be divisible by 5. Scored points equal Total Score ÷ 5 (e.g. 25 scores 5 points; 50 scores 10 points; 100 scores 20 points). Points earned are deducted from the starting goal of 101 down to exactly 0!',
      rules: [
        'Players start with a goal score of 101 points (or 51 / 201).',
        'Throw 3 darts per turn at any segments on the board.',
        'The 3-dart total score MUST be divisible by 5 (5, 10, 15, 20, 25, 30, ... up to 180).',
        'If divisible by 5: Points deducted = Total ÷ 5 (e.g., scoring 25 gives 5 pts off 101 = 96 remaining).',
        'If NOT divisible by 5 (e.g., 26 or 43): 0 points are scored and turn ends with remainder unchanged.',
        'First player or team to reduce their score to exactly 0 wins the leg/match! Bust if deducted points exceed remaining.',
      ],
      scoringSummary: 'Score ÷ 5 (e.g. 25 = 5 pts, 50 = 10 pts, 100 = 20 pts). Subtracted from 101 down to 0.',
      targetSegments: 'All dartboard segments (aiming for multiples of 5)',
      recommendedSettings: {
        gameMode: 'FIVES',
        startScore: 101,
        fivesTarget: 101,
        format: 'legs',
        legsToWin: 1,
      },
    },
    {
      id: 'cricket',
      title: 'Cricket Tactical',
      subtitle: '15–20 & Bull Closures with Doubles & Triples Requirements',
      icon: <Target className="w-6 h-6 text-indigo-600" />,
      gameMode: 'CRICKET',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'The official cricket game where 3 squares are provided beside each segment (15–20, Bull, Doubles, and Triples) for each player. Players mark an X in all 3 squares for every segment to win.',
      rules: [
        'Target segments: 15, 16, 17, 18, 19, 20, Bullseye (25), Doubles, and Triples.',
        'Each segment features 3 squares per player.',
        'A player must mark an X in each square (3 X marks total per segment).',
        'No limit on darts thrown per turn — throws and X marks can be recorded freely.',
        'Full undo options available at any time if a mistake is made.',
        'The first player to mark an X in all 3 squares for all 9 segments wins the game!',
      ],
      scoringSummary: 'Mark 3 squares with an X for every segment. First to complete all 27 X marks wins.',
      targetSegments: '15, 16, 17, 18, 19, 20, Bull (25), Doubles & Triples',
      recommendedSettings: {
        gameMode: 'CRICKET',
        format: 'legs',
        legsToWin: 3,
      },
    },
    {
      id: 'x01-501',
      title: '501 Straight In / Double Out',
      subtitle: 'Official PDC & Tuesday League Match Standard',
      icon: <Trophy className="w-6 h-6 text-amber-500" />,
      gameMode: 'X01',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'The world championship standard darts game. Players start with 501 points and count down to zero, finishing on a double or the inner bullseye.',
      rules: [
        'Starting score: 501 points.',
        'Straight in (any segment counts on the first dart).',
        'Double out: Must reduce score to exactly zero on a double segment or 50 Bullseye.',
        'Busting: Reducing score to 1, below 0, or reaching 0 without a double results in a bust.',
      ],
      scoringSummary: 'Subtract 3-dart sum from remaining score. Finish on a double.',
      targetSegments: 'T20, T19, T18, Bull, Doubles for checkout',
      recommendedSettings: {
        gameMode: 'X01',
        startScore: 501,
        inMode: 'Straight',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 3,
      },
    },
    {
      id: 'x01-701-dido',
      title: '701 Double In / Double Out',
      subtitle: 'Championship Endurance Countdown with Double Entry',
      icon: <ShieldCheck className="w-6 h-6 text-indigo-600" />,
      gameMode: 'X01',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'A premier endurance and tactical countdown starting from 701 points. Players or teams must hit any double (or Double Bull) to activate scoring (Double In), and finish on an exact double or Bullseye to check out (Double Out). Ideal for pairs, 4-person teams, and competitive high-pressure matches.',
      rules: [
        'Starting score: 701 points.',
        'Double In: Scoring only begins once a player hits any double segment (or Double Bull). Darts thrown before doubling in score 0 points.',
        'Double Out: Must reduce remaining score to exactly zero on a double segment or 50 Bullseye.',
        'Endurance test: Great for pairs, singles marathon battles, or 4-player team leagues.',
        'Busting rules apply if score reaches 1, below 0, or reaches 0 without hitting a valid double.',
      ],
      scoringSummary: 'Subtract 3-dart sum once doubled-in from 701 down to 0. Finish on a double.',
      targetSegments: 'All Doubles (D20, D16, D10...) for Entry & Checkout, T20/T19 for scoring',
      recommendedSettings: {
        gameMode: 'X01',
        startScore: 701,
        inMode: 'Double',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 2,
      },
    },
    {
      id: 'x01-701',
      title: '701 Straight In / Double Out',
      subtitle: 'Extended Endurance Format for Pairs, Teams & Tournaments',
      icon: <Trophy className="w-6 h-6 text-indigo-500" />,
      gameMode: 'X01',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'An extended X01 countdown format starting from 701 points, widely used in doubles tournaments, 4-person team leagues, and endurance play.',
      rules: [
        'Starting score: 701 points.',
        'Straight in (any segment counts from the first dart).',
        'Double out: Must reduce score to exactly zero on a double segment or 50 Bullseye.',
        'Ideal format for pairs or multi-player teams sharing the countdown.',
        'Busting rules apply if score reaches 1, below 0, or 0 without a double.',
      ],
      scoringSummary: 'Subtract 3-dart sum from 701 down to 0. Finish on a double.',
      targetSegments: 'T20, T19, T18, Bull, Doubles for checkout',
      recommendedSettings: {
        gameMode: 'X01',
        startScore: 701,
        inMode: 'Straight',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 2,
      },
    },
    {
      id: 'x01-1001',
      title: '1001 Marathon',
      subtitle: 'Heavy Artillery & High-Volume Scoring Marathon',
      icon: <Flame className="w-6 h-6 text-rose-500" />,
      gameMode: 'X01',
      leagues: ['Tuesday', 'Wednesday', 'Thursday', 'Any Day / Casual'],
      category: 'casual',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'The ultimate endurance dart game starting from 1001 points. Test your maximum scoring power with ample opportunities for 180s, 140s, and high-ton combinations before entering the checkout zone.',
      rules: [
        'Starting score: 1001 points.',
        'Straight in (any segment counts from the first dart).',
        'Double out: Must reduce score to exactly zero on a double segment or 50 Bullseye.',
        'Test stamina, scoring consistency, and checkout composure under marathon conditions.',
        'Busting rules apply if score reaches 1, below 0, or 0 without a double.',
      ],
      scoringSummary: 'Subtract 3-dart sum from 1001 down to 0. Finish on a double.',
      targetSegments: 'T20, T19, T18, Bull, Doubles for checkout',
      recommendedSettings: {
        gameMode: 'X01',
        startScore: 1001,
        inMode: 'Straight',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 1,
      },
    },
    {
      id: 'x01-301',
      title: '301 Double In / Double Out',
      subtitle: 'Fast Tactical Countdown with Double Entry',
      icon: <ShieldCheck className="w-6 h-6 text-blue-500" />,
      gameMode: 'X01',
      leagues: ['Wednesday', 'Tuesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '1–4 Players, Teams, or DartBot',
      description:
        'A fast-paced, high-pressure 301 countdown where players must hit a double to begin scoring (Double In), and finish on a double to win (Double Out).',
      rules: [
        'Starting score: 301 points.',
        'Double In: Scoring only begins once a player hits any double segment (or Double Bull).',
        'Double Out: Must finish on a double segment to reach exactly zero.',
      ],
      scoringSummary: 'Subtract points once doubled-in; finish on a double.',
      targetSegments: 'All Doubles (D20, D16, D10...) and Trebles',
      recommendedSettings: {
        gameMode: 'X01',
        startScore: 301,
        inMode: 'Double',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 3,
      },
    },
    {
      id: 'medley',
      title: 'Multi-Game Medley',
      subtitle: '301 DI/DO ➔ 501 SI/DO ➔ Cricket ➔ Baseball ➔ Fives',
      icon: <Zap className="w-6 h-6 text-amber-400 fill-current" />,
      gameMode: 'MEDLEY',
      leagues: ['Wednesday', 'Tuesday', 'Thursday', 'Any Day / Casual'],
      category: 'league',
      minPlayers: '2 Players, Teams, or DartBot',
      description:
        'The ultimate darting test combining different disciplines across multiple legs: 301 Double In/Double Out, 501 Straight In/Double Out, Cricket, Baseball Darts, and Fives 101.',
      rules: [
        'Game 1: 301 Double In / Double Out',
        'Game 2: 501 Straight In / Double Out',
        'Game 3: Cricket (Doubles & Triples Closure)',
        'Game 4: Baseball Darts (9 AI Target Innings)',
        'Game 5: Game of Fives 101',
        'Each leg won awards 1 point in the match standings. Best of 3, 4, or 5 legs.',
      ],
      scoringSummary: 'Cumulative leg victories across distinct game modes.',
      targetSegments: 'Varied by game mode per leg',
      recommendedSettings: {
        gameMode: 'MEDLEY',
        isMedley: true,
        format: 'legs',
        legsToWin: 3,
      },
    },
    {
      id: 'clock',
      title: 'Around the Clock',
      subtitle: 'Sequential Precision Drill (1 through 20 + Bull)',
      icon: <Clock className="w-6 h-6 text-teal-500" />,
      gameMode: 'AROUND_THE_CLOCK',
      leagues: ['Any Day / Casual'],
      category: 'practice',
      minPlayers: '1–4 Players or Solo Drill',
      description:
        'Hit numbers 1 through 20 in exact numerical sequence, finishing with the Bullseye. Ideal for solo accuracy calibration or pub race battles.',
      rules: [
        'Start at target 1.',
        'Once target 1 is hit, advance to target 2, then 3, all the way to 20.',
        'Finish by hitting the Bullseye.',
        'Track total darts used to complete the entire board.',
      ],
      scoringSummary: 'Fewest total darts thrown to complete numbers 1–20 + Bull.',
      targetSegments: 'Numbers 1 ➔ 20 ➔ Bullseye in sequence',
    },
    {
      id: 'bobs27',
      title: "Bob's 27",
      subtitle: "The Legendary Double Ring Survival Challenge",
      icon: <Flame className="w-6 h-6 text-red-500" />,
      gameMode: 'BOBS_27',
      leagues: ['Any Day / Casual'],
      category: 'practice',
      minPlayers: '1 Player or Solo Challenge',
      description:
        "Created by World Champion Bob Anderson. Start with 27 points and throw 3 darts at each double from D1 to D20 and Double Bull. Add scored double values, but subtract the double's value if you miss all 3 darts!",
      rules: [
        'Start with 27 points.',
        'Throw 3 darts at D1, then D2, D3, ..., D20, and finally Double Bull.',
        'Hit doubles add their value (e.g., 2x D1 = +4 pts).',
        'Missing all 3 darts subtracts the full double value (e.g., missing D5 = -10 pts).',
        'If score falls below 0 at any point, game over!',
      ],
      scoringSummary: 'Survive all 21 doubles and finish with the highest remaining score.',
      targetSegments: 'D1 through D20 + Double Bull (50)',
    },
    {
      id: 'practice121',
      title: '121 Checkout Challenge',
      subtitle: '9-Dart Pressure Checkout Ladder',
      icon: <Crosshair className="w-6 h-6 text-purple-500" />,
      gameMode: 'PRACTICE_121',
      leagues: ['Any Day / Casual'],
      category: 'practice',
      minPlayers: '1 Player or Solo Challenge',
      description:
        'You have 9 darts (3 visits) to check out 121 on a double. Check it out and advance to 122, then 123! Miss and drop back 1 target.',
      rules: [
        'Start at target 121 with 9 darts.',
        'Check out on a legal double or Bullseye within 9 darts.',
        'If successful, advance target by +1 (122, 123...).',
        'If failed after 9 darts, target resets or drops back.',
      ],
      scoringSummary: 'Highest checkout target reached in sequence.',
      targetSegments: 'Dynamic checkout combinations',
    },
    {
      id: 'shanghai',
      title: 'Shanghai',
      subtitle: 'Singles, Doubles & Triples Streak Race',
      icon: <Award className="w-6 h-6 text-orange-500" />,
      gameMode: 'SHANGHAI',
      leagues: ['Any Day / Casual'],
      category: 'casual',
      minPlayers: '2–8 Players or Party Game',
      description:
        'Players throw 3 darts at numbers 1 through 7 (or 1–9) in sequence. Score points for singles, doubles, and triples. Hitting a Single, Double, and Triple of the active number in one turn scores an instant "Shanghai" victory!',
      rules: [
        'Round 1 throws at 1, Round 2 at 2, ..., Round 7 at 7.',
        'Single = 1x number, Double = 2x number, Triple = 3x number.',
        'Instant Shanghai Win: Hit 1 Single, 1 Double, and 1 Triple of the active number in a single turn!',
        'Otherwise, highest total points at the end of all rounds wins.',
      ],
      scoringSummary: 'Accumulate points across rounds or win instantly with a Shanghai.',
      targetSegments: 'Active round number (1 through 7/9)',
    },
    {
      id: 'killer',
      title: 'Killer',
      subtitle: 'Assign Doubles, Become a Killer, Take Lives!',
      icon: <span className="text-2xl leading-none">💀</span>,
      gameMode: 'KILLER',
      leagues: ['Any Day / Casual'],
      category: 'casual',
      minPlayers: '3–10 Players Party Game',
      description:
        'Every player is assigned a unique double. Hit your double to become a "Killer", then shoot opponents’ doubles to knock off their 5 lives. Last survivor wins!',
      rules: [
        'Each player claims a unique double (e.g. Player 1 = D16, Player 2 = D20).',
        'Players start with 5 lives.',
        'Hit your own double once to become a "Killer".',
        'As a Killer, hit opponents’ doubles to remove their lives.',
        'Last player with lives remaining wins the game!',
      ],
      scoringSummary: 'Knock out opponents by hitting their assigned double sectors.',
      targetSegments: "Assigned players' double sectors",
    },
    {
      id: 'halve-it',
      title: 'Halve-It',
      subtitle: 'Hit the Target Sector or Watch Your Score Halved!',
      icon: <span className="text-2xl leading-none">✂️</span>,
      gameMode: 'HALVE_IT',
      leagues: ['Any Day / Casual'],
      category: 'casual',
      minPlayers: '2–6 Players or Party Game',
      description:
        'Throw at a fixed sequence of targets (e.g. 20, 16, Any Double, 17, Any Triple, 18, Bullseye). If you fail to hit the target at least once during your turn, your entire accumulated score is cut in half!',
      rules: [
        'Each round specifies a designated target (e.g., 20, 16, Any Double, 17, Any Triple, 18, Bull).',
        'All hits on the designated target are added to your total score.',
        'If you miss the target with all 3 darts, your total score is halved (divided by 2)!',
        'Highest total score after the final round wins.',
      ],
      scoringSummary: 'Accumulate points on targets; avoid halving penalty on misses.',
      targetSegments: 'Target sequence: 20, 16, Doubles, 17, Triples, 18, Bull',
    },
  ];

  // Filtered games
  const filteredGames = gamesCatalog.filter((game) => {
    // League / category filter
    if (filter === 'tuesday' && !game.leagues.includes('Tuesday')) return false;
    if (filter === 'wednesday' && !game.leagues.includes('Wednesday')) return false;
    if (filter === 'thursday' && !game.leagues.includes('Thursday')) return false;
    if (filter === 'casual' && !game.leagues.includes('Any Day / Casual')) return false;
    if (filter === 'practice' && game.category !== 'practice') return false;

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchTitle = game.title.toLowerCase().includes(q);
      const matchSubtitle = game.subtitle.toLowerCase().includes(q);
      const matchDesc = game.description.toLowerCase().includes(q);
      return matchTitle || matchSubtitle || matchDesc;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Hero Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Target className="w-80 h-80 text-indigo-400" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-black uppercase tracking-wider mb-3">
            <Layers className="w-3.5 h-3.5" /> Official Games Catalog & Rules
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Games List: League & Casual Play
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
            Explore all games playable in the <strong className="text-amber-400">Tuesday</strong>, <strong className="text-amber-400">Wednesday</strong>, and <strong className="text-amber-400">Thursday</strong> leagues, or jump directly into any game for fun any other day with friends, teams, or DartBot AI!
          </p>

          {/* Quick Highlight of core games */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800 text-xs">
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold flex items-center gap-1.5">
              ⚾ <strong>Baseball Darts</strong> (9 AI Numbers 1–20)
            </span>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold flex items-center gap-1.5">
              🖐️ <strong>Game of Fives</strong> (Divisible by 5 / 101 Goal)
            </span>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold flex items-center gap-1.5">
              🎯 <strong>Cricket Tactical</strong> (15–20, Bull, D/T)
            </span>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold flex items-center gap-1.5">
              🏆 <strong>X01 701 DI/DO / 501 / 301</strong>
            </span>
            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 font-bold flex items-center gap-1.5">
              ⚡ <strong>Wednesday Medley</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all' as const, label: 'All Games', icon: <Layers className="w-4 h-4" /> },
            { id: 'tuesday' as const, label: 'Tuesday League', icon: <ShieldCheck className="w-4 h-4 text-indigo-600" /> },
            { id: 'wednesday' as const, label: 'Wednesday League', icon: <Zap className="w-4 h-4 text-amber-500" /> },
            { id: 'thursday' as const, label: 'Thursday League', icon: <ShieldCheck className="w-4 h-4 text-emerald-600" /> },
            { id: 'casual' as const, label: 'Play Any Day / Casual', icon: <Flame className="w-4 h-4 text-orange-500" /> },
            { id: 'practice' as const, label: 'Solo & Practice', icon: <Crosshair className="w-4 h-4 text-purple-600" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search games, rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 outline-none"
          />
        </div>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Header: Icon & Tags */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-3 bg-slate-50 group-hover:bg-indigo-50 border border-slate-200 group-hover:border-indigo-200 rounded-xl transition-colors">
                  {game.icon}
                </div>

                <div className="flex flex-wrap gap-1 justify-end">
                  {game.leagues.slice(0, 2).map((l, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black uppercase rounded"
                    >
                      {l}
                    </span>
                  ))}
                  {game.leagues.length > 2 && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded">
                      +{game.leagues.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1 group-hover:text-indigo-600 transition-colors">
                {game.title}
              </h3>
              <p className="text-xs font-bold text-slate-500 mb-3">{game.subtitle}</p>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed mb-4 line-clamp-3">
                {game.description}
              </p>

              {/* Key Details Box */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px] mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Targets:</span>
                  <span className="font-extrabold text-slate-800 text-right truncate max-w-[170px]">{game.targetSegments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Scoring:</span>
                  <span className="font-extrabold text-indigo-600 text-right truncate max-w-[170px]">{game.scoringSummary}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Players:</span>
                  <span className="font-medium text-slate-600">{game.minPlayers}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onQuickLaunchGame(game.gameMode, game.recommendedSettings)}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Now
                </button>

                <button
                  onClick={() => onOpenMatchSetup(game.gameMode)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Custom Setup
                </button>
              </div>

              <button
                onClick={() => setSelectedGameModal(game)}
                className="w-full py-1.5 text-center text-[11px] font-bold text-slate-400 hover:text-indigo-600 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" /> View Full Rules & Mechanics
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Rules Details Modal */}
      {selectedGameModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                  {selectedGameModal.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    {selectedGameModal.title}
                  </h2>
                  <p className="text-xs font-bold text-indigo-600">{selectedGameModal.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedGameModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* League Availability Tags */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                Playable In:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedGameModal.leagues.map((l, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-black rounded-lg border border-slate-200"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>

            {/* Overview */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Game Overview:
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">{selectedGameModal.description}</p>
            </div>

            {/* Rules Checklist */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                Official Rules & Flow:
              </span>
              <ul className="space-y-2 text-xs text-slate-700">
                {selectedGameModal.rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Buttons in Modal */}
            <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
              <button
                onClick={() => {
                  setSelectedGameModal(null);
                  onQuickLaunchGame(selectedGameModal.gameMode, selectedGameModal.recommendedSettings);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Launch Game Now (Play Any Day)
              </button>

              <button
                onClick={() => setSelectedGameModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
