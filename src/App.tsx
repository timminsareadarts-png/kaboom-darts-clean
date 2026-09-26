import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MatchSetup } from './components/MatchSetup';
import { ScorerBoard } from './components/ScorerBoard';
import { CricketBoard } from './components/CricketBoard';
import { BaseballBoard } from './components/BaseballBoard';
import { FivesBoard } from './components/FivesBoard';
import { GamesLibrary } from './components/GamesLibrary';
import { BoardAssignmentsView } from './components/BoardAssignmentsView';
import { PracticeDrills } from './components/PracticeDrills';
import { PlayerProfiles } from './components/PlayerProfiles';
import { LeagueManager } from './components/LeagueManager';
import { FinanceManager } from './components/FinanceManager';
import { DrawsManager } from './components/DrawsManager';
import { TeamShootingOrderModal } from './components/TeamShootingOrderModal';
import { SettingsModal } from './components/SettingsModal';
import { ShareModal } from './components/ShareModal';
import { LoginScreen } from './components/LoginScreen';
import { MatchState, MatchSettings, Player, GameMode, InOutMode, ThemeMode, WEDNESDAY_MEDLEY_CONFIGS, DEFAULT_MEDLEY_CONFIGS } from './types';
import { syncMatchToCloud, syncLeagueBracketsToCloud, initializeVenueCloudSync } from './services/cloudSync';
import { recordCompletedMatchStats } from './services/playerStatsService';
import { saveCompletedMatchState } from './utils/emailReportHelper';
import { AuthProvider, useAuth } from './context/AuthContext';

function MainDashboard() {
  // Initial Match State loaded from local storage for instant power outage / internet loss recovery
  const [matchState, setMatchState] = useState<MatchState>(() => {
    try {
      const saved = localStorage.getItem('kaboom_active_match_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.players && Array.isArray(parsed.players) && parsed.players.length >= 2 && parsed.settings) {
          const isWed = parsed.settings.leagueType === 'wednesday' ||
            parsed.settings.bracketMatchId?.toLowerCase().includes('wed') ||
            parsed.matchCode?.toUpperCase().startsWith('WED-');
          if (isWed && (parsed.settings.isMedley || parsed.settings.gameMode === 'MEDLEY' || parsed.settings.leagueType === 'wednesday')) {
            parsed.settings.leagueType = 'wednesday';
            parsed.settings.isMedley = true;
            parsed.settings.medleyConfigs = WEDNESDAY_MEDLEY_CONFIGS;
            parsed.settings.legsToWin = 6;
            parsed.settings.legsPerSet = 6;
            if (parsed.currentLeg === 1 && (!parsed.history || parsed.history.length === 0) && (parsed.currentStartScore === 301 || parsed.currentStartScore === 501)) {
              parsed.currentStartScore = 1001;
              parsed.currentGameMode = 'X01';
              parsed.currentInMode = 'Straight';
              parsed.currentOutMode = 'Double';
              parsed.settings.startScore = 1001;
              parsed.settings.inMode = 'Straight';
              parsed.settings.outMode = 'Double';
              parsed.players.forEach((p: Player) => { p.currentScore = 1001; });
            }
          }
          return parsed;
        }
      }
    } catch (e) {}

    return {
      id: 'match-default',
      matchCode: 'Kaboom',
      status: 'active',
      settings: {
        gameMode: 'X01',
        startScore: 501,
        inMode: 'Straight',
        outMode: 'Double',
        format: 'legs',
        legsToWin: 3,
        setsToWin: 1,
        legsPerSet: 3,
        isDartBot: false,
        botLevel: 5,
        announceAudio: true,
        isPublic: true,
        matchCode: 'Kaboom',
        starterPlayerId: 'p1',
      },
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          avatar: '🎯',
          currentScore: 501,
          legsWon: 0,
          setsWon: 0,
          cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
          cricketPoints: 0,
          first9Darts: [],
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
          id: 'p2',
          name: 'Player 2',
          avatar: '🎯',
          currentScore: 501,
          legsWon: 0,
          setsWon: 0,
          cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
          cricketPoints: 0,
          first9Darts: [],
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
      activePlayerIndex: 0,
      currentSet: 1,
      currentLeg: 1,
      starterPlayerIndex: 0,
      history: [],
      completedLegs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [activeTab, setActiveTab] = useState<'scorer' | 'setup' | 'league' | 'finance' | 'draws' | 'games' | 'assignments' | 'practice' | 'players'>(() => {
    try {
      const saved = localStorage.getItem('kaboom_active_match_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.status === 'active' && ((parsed.history && parsed.history.length > 0) || (parsed.completedLegs && parsed.completedLegs.length > 0) || parsed.settings?.bracketMatchId)) {
          return 'scorer'; // Instantly resume active ongoing match
        }
      }
    } catch (e) {}
    return 'league';
  });
  const [activeDrawsLeague, setActiveDrawsLeague] = useState<'tuesday' | 'wednesday' | 'thursday'>('tuesday');
  const { role } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('kaboom_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return 'dark'; // Dark theme default for darts match center
  });

  // Automatically request Fullscreen on app open / first user interaction
  useEffect(() => {
    const tryFullscreen = () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    // Try immediately
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    window.addEventListener('click', tryFullscreen, { once: true });
    window.addEventListener('touchstart', tryFullscreen, { once: true });
    window.addEventListener('keydown', tryFullscreen, { once: true });

    return () => {
      window.removeEventListener('click', tryFullscreen);
      window.removeEventListener('touchstart', tryFullscreen);
      window.removeEventListener('keydown', tryFullscreen);
    };
  }, []);

  // Master real-time venue synchronization for all tablets
  useEffect(() => {
    const cleanupCloudSync = initializeVenueCloudSync();
    return () => cleanupCloudSync();
  }, []);

  // Keep HTML document root class in sync with dark mode
  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('kaboom_theme', theme);
    } catch (e) {}
  }, [theme]);

  // Global share modal listener
  useEffect(() => {
    const handleOpenShare = () => setIsShareOpen(true);
    window.addEventListener('kaboom_open_share', handleOpenShare);
    return () => window.removeEventListener('kaboom_open_share', handleOpenShare);
  }, []);

  // Listen for night matches cleared across the venue
  useEffect(() => {
    const handleNightCleared = (e: any) => {
      const clearedLeague = e.detail?.leagueType;
      // If active match was from the cleared league (or all leagues cleared), reset match to clean state
      const currentMatchLeague = matchState.settings?.leagueType;
      const isClearedLeagueMatch = !clearedLeague || clearedLeague === 'all' || currentMatchLeague === clearedLeague;

      if (isClearedLeagueMatch) {
        try {
          localStorage.removeItem('kaboom_active_match_state');
        } catch (err) {}
        setMatchState({
          id: 'match-default',
          matchCode: 'Kaboom',
          status: 'active',
          settings: {
            gameMode: 'X01',
            startScore: 501,
            inMode: 'Straight',
            outMode: 'Double',
            format: 'legs',
            legsToWin: 3,
            setsToWin: 1,
            legsPerSet: 3,
            isDartBot: false,
            botLevel: 5,
            announceAudio: true,
            isPublic: true,
            matchCode: 'Kaboom',
            starterPlayerId: 'p1',
          },
          players: [
            {
              id: 'p1',
              name: 'Player 1',
              avatar: '🎯',
              currentScore: 501,
              legsWon: 0,
              setsWon: 0,
              cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
              cricketPoints: 0,
              first9Darts: [],
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
              id: 'p2',
              name: 'Player 2',
              avatar: '🎯',
              currentScore: 501,
              legsWon: 0,
              setsWon: 0,
              cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
              cricketPoints: 0,
              first9Darts: [],
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
          activePlayerIndex: 0,
          currentSet: 1,
          currentLeg: 1,
          starterPlayerIndex: 0,
          history: [],
          completedLegs: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    };

    window.addEventListener('kaboom_night_matches_cleared', handleNightCleared);
    return () => window.removeEventListener('kaboom_night_matches_cleared', handleNightCleared);
  }, [matchState]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Check URL query parameters e.g. ?code=DC-8492 or ?tab=assignments
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('match');
    const tabParam = params.get('tab') as any;

    if (codeParam) {
      setActiveTab('assignments');
    } else if (tabParam === 'live') {
      setActiveTab('assignments');
    } else if (tabParam && ['scorer', 'setup', 'league', 'finance', 'draws', 'games', 'assignments', 'practice', 'players'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Sync match updates to server API, Cloud Firestore, and localStorage for instant power outage recovery
  const handleUpdateMatch = async (newState: MatchState) => {
    // If Wednesday match, guarantee Wednesday Medley configurations
    const isWed =
      newState.settings?.leagueType === 'wednesday' ||
      newState.settings?.bracketMatchId?.toLowerCase().includes('wed') ||
      newState.matchCode?.toUpperCase().startsWith('WED-');
    if (isWed && (newState.settings?.isMedley || newState.settings?.gameMode === 'MEDLEY' || newState.settings?.leagueType === 'wednesday')) {
      newState.settings.leagueType = 'wednesday';
      newState.settings.isMedley = true;
      newState.settings.medleyConfigs = WEDNESDAY_MEDLEY_CONFIGS;
      newState.settings.legsToWin = 6;
      newState.settings.legsPerSet = 6;
    }

    setMatchState(newState);

    // Save exact match state to local storage for power outage / disconnect resumption
    try {
      localStorage.setItem('kaboom_active_match_state', JSON.stringify(newState));
    } catch (e) {}

    // Sync match state to Firestore cloud database and REST server
    syncMatchToCloud(newState, newState.matchCode);

    try {
      await fetch(`/api/matches/${newState.matchCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchState: newState }),
      });
    } catch (e) {
      // Safe offline fallback
    }

    // Check and immutably record completed match statistics for player profiles & running totals
    const isAnyMatchCompleted =
      newState.status === 'completed' ||
      Boolean(newState.winnerId) ||
      Boolean(newState.winnerName) ||
      newState.players.some(p => (p.legsWon || 0) >= (newState.settings?.legsToWin || 3));

    if (isAnyMatchCompleted) {
      if (newState.status !== 'completed') {
        newState.status = 'completed';
      }
      if (!newState.winnerId || !newState.winnerName) {
        const p0 = newState.players[0];
        const p1 = newState.players[1];
        const topPlayer = (p0?.legsWon || 0) >= (p1?.legsWon || 0) ? p0 : p1;
        if (topPlayer) {
          newState.winnerId = newState.winnerId || topPlayer.id;
          newState.winnerName = newState.winnerName || topPlayer.name;
        }
      }
      recordCompletedMatchStats(newState);
      saveCompletedMatchState(newState);
    }

    // Sync bracket completion status if this match belongs to a league
    if (isAnyMatchCompleted && newState.settings?.leagueType && newState.settings.leagueType !== 'none') {
      const lType = newState.settings.leagueType as 'tuesday' | 'wednesday' | 'thursday';
      const p0 = newState.players[0];
      const p1 = newState.players[1];
      const winName = newState.winnerName || (p0 && p1 ? (p0.legsWon > p1.legsWon ? p0.name : p1.name) : undefined);

      // 1. Direct server complete match API call
      fetch('/api/brackets/complete-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueType: lType,
          bracketMatchId: newState.settings.bracketMatchId,
          scoreA: p0?.legsWon || 0,
          scoreB: p1?.legsWon || 0,
          winnerName: winName,
          p0Name: p0?.name,
          p1Name: p1?.name,
          matchState: newState,
        }),
      }).catch(() => {});

      // 2. Sync with local bracket cache and cloud Firestore
      try {
        const saved = localStorage.getItem(`kaboom_brackets_${lType}`);
        if (saved) {
          const bData = JSON.parse(saved);
          const updateMatchList = (list: any[]) =>
            list.map((m: any) => {
              const isTarget =
                (newState.settings.bracketMatchId && m.id === newState.settings.bracketMatchId) ||
                (p0 && p1 && (
                  (m.entryA?.name?.toLowerCase().trim() === p0.name.toLowerCase().trim() && m.entryB?.name?.toLowerCase().trim() === p1.name.toLowerCase().trim()) ||
                  (m.entryA?.name?.toLowerCase().trim() === p1.name.toLowerCase().trim() && m.entryB?.name?.toLowerCase().trim() === p0.name.toLowerCase().trim())
                ));

              if (isTarget) {
                let scoreA = p0 ? p0.legsWon : (m.scoreA || 0);
                let scoreB = p1 ? p1.legsWon : (m.scoreB || 0);

                if (p0 && p1) {
                  if (p0.name === m.entryA.name || m.entryA.players?.some((pl: any) => pl.name === p0.name)) {
                    scoreA = p0.legsWon;
                    scoreB = p1.legsWon;
                  } else if (p1.name === m.entryA.name || m.entryA.players?.some((pl: any) => pl.name === p1.name)) {
                    scoreA = p1.legsWon;
                    scoreB = p0.legsWon;
                  }
                }

                const winner = winName || (scoreA > scoreB ? m.entryA.name : m.entryB.name);

                return {
                  ...m,
                  scoreA,
                  scoreB,
                  status: 'completed',
                  isCompleted: true,
                  winnerName: winner,
                };
              }
              return m;
            });

          const updatedBrackets = {
            ...bData,
            divisionA: updateMatchList(bData.divisionA || []),
            divisionB: updateMatchList(bData.divisionB || []),
            divisionC: bData.divisionC ? updateMatchList(bData.divisionC) : undefined,
            divisionD: bData.divisionD ? updateMatchList(bData.divisionD) : undefined,
            divisionE: bData.divisionE ? updateMatchList(bData.divisionE) : undefined,
            divisionF: bData.divisionF ? updateMatchList(bData.divisionF) : undefined,
            divisions: Array.isArray(bData.divisions)
              ? bData.divisions.map((d: any) => ({ ...d, matchups: updateMatchList(d.matchups || []) }))
              : undefined,
          };

          localStorage.setItem(`kaboom_brackets_${lType}`, JSON.stringify(updatedBrackets));
          syncLeagueBracketsToCloud(lType, updatedBrackets);
        }
      } catch (e) {
        // Safe fallback
      }
    }
  };

  const handleStartNewMatch = async (
    settings: MatchSettings,
    p1Name: string,
    p2Name: string
  ) => {
    let p1Avatar = '🎯';
    let p2Avatar = settings.isDartBot ? '🤖' : '🎯';
    try {
      const saved = localStorage.getItem('kaboom_dart_players');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const found1 = parsed.find((p: any) => p.name.trim().toLowerCase() === p1Name.trim().toLowerCase());
          if (found1?.avatar) p1Avatar = found1.avatar;
          const found2 = parsed.find((p: any) => p.name.trim().toLowerCase() === p2Name.trim().toLowerCase());
          if (found2?.avatar && !settings.isDartBot) p2Avatar = found2.avatar;
        }
      }
    } catch (e) {}

    const newMatch: MatchState = {
      id: `match-${Date.now()}`,
      matchCode: settings.matchCode,
      status: 'active',
      settings,
      players: [
        {
          id: 'p1',
          name: p1Name,
          avatar: p1Avatar,
          currentScore: settings.startScore || 501,
          legsWon: 0,
          setsWon: 0,
          cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
          cricketPoints: 0,
          first9Darts: [],
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
          id: 'p2',
          name: p2Name,
          avatar: p2Avatar,
          currentScore: settings.startScore || 501,
          legsWon: 0,
          setsWon: 0,
          isBot: settings.isDartBot,
          botLevel: settings.botLevel,
          cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
          cricketPoints: 0,
          first9Darts: [],
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
      activePlayerIndex: 0,
      currentSet: 1,
      currentLeg: 1,
      starterPlayerIndex: 0,
      history: [],
      completedLegs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setMatchState(newMatch);
    try {
      localStorage.setItem('kaboom_active_match_state', JSON.stringify(newMatch));
    } catch (e) {}
    setActiveTab('scorer');

    // Post match to backend store
    try {
      await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchState: newMatch }),
      });
    } catch (e) {
      // Safe fallback
    }
  };

  const [pendingLeagueMatch, setPendingLeagueMatch] = useState<{
    settings: MatchSettings;
    playersList: Player[];
    leagueType: 'tuesday' | 'wednesday' | 'thursday';
  } | null>(null);

  const executeLaunchLeagueMatch = async (
    settings: MatchSettings,
    playersList: Player[]
  ) => {
    const isWednesday =
      settings.leagueType === 'wednesday' ||
      settings.bracketMatchId?.toLowerCase().includes('wed') ||
      settings.matchCode?.toUpperCase().startsWith('WED-');
    const isMedley = settings.isMedley || settings.gameMode === 'MEDLEY' || isWednesday;
    const effectiveMedleyConfigs = isMedley
      ? (isWednesday
          ? WEDNESDAY_MEDLEY_CONFIGS
          : (settings.medleyConfigs && settings.medleyConfigs.length > 0 ? settings.medleyConfigs : DEFAULT_MEDLEY_CONFIGS))
      : undefined;

    const firstMedleyConfig = effectiveMedleyConfigs && effectiveMedleyConfigs.length > 0
      ? effectiveMedleyConfigs[0]
      : undefined;

    const initialGameMode = firstMedleyConfig
      ? firstMedleyConfig.gameMode
      : (settings.gameMode === 'MEDLEY' ? 'X01' : (settings.gameMode || 'X01'));
    const initialStartScore = firstMedleyConfig
      ? firstMedleyConfig.startScore
      : (settings.startScore || (isWednesday ? 1001 : 501));
    const initialInMode = firstMedleyConfig
      ? firstMedleyConfig.inMode
      : (settings.inMode || (isWednesday ? 'Straight' : 'Straight'));
    const initialOutMode = firstMedleyConfig
      ? firstMedleyConfig.outMode
      : (settings.outMode || 'Double');

    // Ensure all players are strictly initialized with the exact initialStartScore
    const normalizedPlayers = playersList.map(p => ({
      ...p,
      currentScore: initialStartScore,
      cricketMarks: { 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0, 25: 0 },
      cricketPoints: 0,
      baseballHits: {},
      baseballScore: 0,
      fivesScore: initialGameMode === 'FIVES' ? initialStartScore : undefined,
      fivesPointsEarned: 0,
      first9Darts: [],
      stats: {
        ...p.stats,
        dartsThrown: 0,
      },
    }));

    const newMatch: MatchState = {
      id: `match-league-${Date.now()}`,
      matchCode: settings.matchCode,
      status: 'active',
      settings: {
        ...settings,
        leagueType: isWednesday ? 'wednesday' : settings.leagueType,
        isPublic: false, // Any league matches will not be live only local
        isMedley,
        medleyConfigs: effectiveMedleyConfigs,
        startScore: initialStartScore,
        inMode: initialInMode,
        outMode: initialOutMode,
        gameMode: settings.gameMode,
        legsToWin: isWednesday ? 6 : (settings.legsToWin || 3),
        legsPerSet: isWednesday ? 6 : (settings.legsPerSet || 3),
      },
      players: normalizedPlayers,
      activePlayerIndex: 0,
      currentSet: 1,
      currentLeg: 1,
      currentGameMode: initialGameMode,
      currentStartScore: initialStartScore,
      currentInMode: initialInMode,
      currentOutMode: initialOutMode,
      starterPlayerIndex: 0,
      history: [],
      completedLegs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setPendingLeagueMatch(null);
    setMatchState(newMatch);
    try {
      localStorage.setItem('kaboom_active_match_state', JSON.stringify(newMatch));
    } catch (e) {}
    setActiveTab('scorer');
  };

  const handleLaunchLeagueMatch = async (
    settings: MatchSettings,
    playersList: Player[],
    leagueType: 'tuesday' | 'wednesday' | 'thursday',
    existingMatchState?: MatchState
  ) => {
    if (existingMatchState) {
      const isWed =
        leagueType === 'wednesday' ||
        existingMatchState.settings.leagueType === 'wednesday' ||
        existingMatchState.settings.bracketMatchId?.toLowerCase().includes('wed');
      if (isWed) {
        existingMatchState.settings.leagueType = 'wednesday';
        existingMatchState.settings.isMedley = true;
        existingMatchState.settings.medleyConfigs = WEDNESDAY_MEDLEY_CONFIGS;
        existingMatchState.settings.legsToWin = 6;
        existingMatchState.settings.legsPerSet = 6;
      }
      setMatchState(existingMatchState);
      try {
        localStorage.setItem('kaboom_active_match_state', JSON.stringify(existingMatchState));
      } catch (e) {}
      setActiveTab('scorer');
      return;
    }

    // Check if team or doubles order prompt is needed (Wednesday teams, Thursday doubles/teams, or multiple team players)
    const hasTeamPlayers = playersList.some(
      (p) => p.teamPlayers && p.teamPlayers.length > 1
    );

    if (
      (leagueType === 'wednesday' || leagueType === 'thursday' || hasTeamPlayers) &&
      playersList.length >= 2
    ) {
      // Prompt user to set and confirm each team's shooting order
      setPendingLeagueMatch({
        settings,
        playersList,
        leagueType,
      });
      return;
    }

    // Direct launch (e.g. Tuesday 1v1 singles)
    await executeLaunchLeagueMatch(settings, playersList);
  };

  const handleQuickLaunchGame = (gameMode: GameMode, customSettings?: Partial<MatchSettings>) => {
    let startScore = customSettings?.startScore ?? 501;
    let inMode: InOutMode = customSettings?.inMode ?? 'Straight';
    let outMode: InOutMode = customSettings?.outMode ?? 'Double';
    let fivesTarget = 101;

    if (gameMode === 'FIVES') {
      startScore = customSettings?.fivesTarget || 101;
      fivesTarget = customSettings?.fivesTarget || 101;
      outMode = 'Straight';
    } else if (gameMode === 'BASEBALL') {
      startScore = 0;
      outMode = 'Straight';
    } else if (gameMode === 'CRICKET') {
      startScore = 0;
      outMode = 'Straight';
    } else if (gameMode === 'MEDLEY') {
      startScore = 301;
      inMode = 'Double';
      outMode = 'Double';
    }

    const settings: MatchSettings = {
      gameMode,
      startScore,
      fivesTarget,
      inMode,
      outMode,
      format: 'legs',
      legsToWin: customSettings?.legsToWin || 1,
      setsToWin: 1,
      legsPerSet: 1,
      isDartBot: false,
      botLevel: 5,
      announceAudio: true,
      isPublic: true,
      matchCode: 'Kaboom',
      starterPlayerId: 'p1',
      isMedley: gameMode === 'MEDLEY',
      ...customSettings,
    };

    handleStartNewMatch(settings, 'Player 1', 'Player 2');
  };

  const activeGameMode = matchState.currentGameMode || matchState.settings.gameMode;

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans selection:bg-indigo-600 selection:text-white flex flex-col transition-colors duration-150`}>
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        matchCode={matchState.matchCode}
        isLiveActive={matchState.settings.isPublic}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        selectedDrawsLeague={activeDrawsLeague}
        onSelectDrawsLeague={(l) => {
          setActiveDrawsLeague(l);
          setActiveTab('draws');
        }}
      />

      {/* Active Match In-Progress Resumption Banner (If user is browsing other tabs while a match is ongoing) */}
      {activeTab !== 'scorer' && matchState.status === 'active' && ((matchState.history && matchState.history.length > 0) || (matchState.completedLegs && matchState.completedLegs.length > 0) || matchState.settings.bracketMatchId) && (
        <aside aria-label="Match In Progress" className="bg-gradient-to-r from-indigo-900/90 via-indigo-800/90 to-purple-900/90 border-b border-indigo-500/40 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-inner text-xs sm:text-sm">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-amber-300 uppercase tracking-wide shrink-0">Match In Progress:</span>
            <span className="truncate font-semibold text-slate-100">
              {matchState.players[0]?.name} vs {matchState.players[1]?.name} ({activeGameMode}, Leg {matchState.currentLeg})
            </span>
          </div>
          <button
            onClick={() => setActiveTab('scorer')}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md shadow transition-colors shrink-0 text-xs flex items-center gap-1 cursor-pointer"
          >
            <span>🎯 Resume Match</span>
          </button>
        </aside>
      )}

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'setup' && (
          <MatchSetup onStartMatch={handleStartNewMatch} />
        )}

        {activeTab === 'league' && (
          <LeagueManager onLaunchLeagueMatch={handleLaunchLeagueMatch} />
        )}

        {activeTab === 'finance' && (
          <FinanceManager
            onNavigateToLeague={() => {
              setActiveTab('league');
            }}
            onNavigateToDraws={(league) => {
              if (league) setActiveDrawsLeague(league);
              setActiveTab('draws');
            }}
          />
        )}

        {activeTab === 'draws' && (
          <DrawsManager
            initialLeague={activeDrawsLeague}
            onSelectLeague={(l) => setActiveDrawsLeague(l)}
            onNavigateToFinances={() => {
              setActiveTab('finance');
            }}
            onNavigateToLeague={() => {
              setActiveTab('league');
            }}
          />
        )}

        {activeTab === 'games' && (
          <GamesLibrary
            onQuickLaunchGame={handleQuickLaunchGame}
            onOpenMatchSetup={(mode) => {
              setActiveTab('setup');
            }}
            onNavigateToLeague={(day) => {
              setActiveTab('league');
            }}
          />
        )}

        {activeTab === 'scorer' && (
          activeGameMode === 'CRICKET' ? (
            <CricketBoard
              matchState={matchState}
              onUpdateMatch={handleUpdateMatch}
              onNewMatchRequest={() => setActiveTab('setup')}
              onReturnToLeague={() => setActiveTab('league')}
            />
          ) : activeGameMode === 'BASEBALL' ? (
            <BaseballBoard
              matchState={matchState}
              onUpdateMatch={handleUpdateMatch}
              onNewMatchRequest={() => setActiveTab('setup')}
              onReturnToLeague={() => setActiveTab('league')}
            />
          ) : activeGameMode === 'FIVES' ? (
            <FivesBoard
              matchState={matchState}
              onUpdateMatch={handleUpdateMatch}
              onNewMatchRequest={() => setActiveTab('setup')}
              onReturnToLeague={() => setActiveTab('league')}
            />
          ) : (
            <ScorerBoard
              matchState={matchState}
              onUpdateMatch={handleUpdateMatch}
              onNewMatchRequest={() => setActiveTab('setup')}
              onReturnToLeague={() => setActiveTab('league')}
            />
          )
        )}

        {activeTab === 'assignments' && (
          <BoardAssignmentsView
            onLaunchLeagueMatch={handleLaunchLeagueMatch}
            onNavigateToLeague={() => setActiveTab('league')}
          />
        )}

        {activeTab === 'practice' && (
          <PracticeDrills />
        )}

        {activeTab === 'players' && (
          <PlayerProfiles
            onLaunchLeagueMatch={handleLaunchLeagueMatch}
            onNavigateToLeague={() => setActiveTab('league')}
          />
        )}
      </main>

      {/* Team Shooting Order Setup Modal (Wednesday Teams & Thursday Doubles) */}
      {pendingLeagueMatch && (
        <TeamShootingOrderModal
          isOpen={Boolean(pendingLeagueMatch)}
          onClose={() => setPendingLeagueMatch(null)}
          leagueType={pendingLeagueMatch.leagueType}
          players={pendingLeagueMatch.playersList}
          settings={pendingLeagueMatch.settings}
          onConfirm={(finalPlayers, finalSettings) => {
            executeLaunchLeagueMatch(finalSettings, finalPlayers);
          }}
        />
      )}

      {/* Full Options & Caller Voice Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Share Modal for QR Codes and Browser Links */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        matchCode={matchState.matchCode}
        activeTab={activeTab}
      />

      {/* Footer */}
      <footer className={`border-t ${theme === 'dark' ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-white text-slate-500'} py-4 text-center text-xs font-medium`}>
        Kaboom Dart Match Center • Professional Match System & Scoreboards
      </footer>
    </div>
  );
}

function AppContent() {
  const { role } = useAuth();

  if (!role) {
    return <LoginScreen />;
  }

  return <MainDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
