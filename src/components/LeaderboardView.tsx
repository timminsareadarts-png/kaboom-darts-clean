import React, { useState, useEffect } from 'react';
import { OverallLeaderboardEntry, TuesdayPlayerGameStats, WednesdayPlayerGameStats, ThursdayPlayerGameStats } from '../types';
import {
  calculateAutomatedLeaderboard,
  getTuesdayGameStatsList,
  saveTuesdayGameStatsMap,
  getTuesdayGameStatsMap,
  getWednesdayGameStatsList,
  saveWednesdayGameStatsMap,
  getWednesdayGameStatsMap,
  getThursdayGameStatsList,
  saveThursdayGameStatsMap,
  getThursdayGameStatsMap,
  getSeasonBullsMap,
  saveSeasonBullsMap,
} from '../utils/leagueHelper';
import {
  subscribeToLeagueStandings,
  subscribeToTuesdayStats,
  subscribeToWednesdayStats,
  subscribeToThursdayStats,
  subscribeToPlayerRoster,
  subscribeToSeasonBulls,
  refreshAllVenueData,
} from '../services/cloudSync';
import { AdminSeasonResetButton } from './SeasonResetModal';
import { useAuth } from '../context/AuthContext';
import { AdminOverallStatsEmailModal } from './AdminOverallStatsEmailModal';
import { getAutoEmailOverallStatsEnabled } from '../utils/overallStatsEmailHelper';
import {
  Trophy,
  Medal,
  Award,
  Search,
  RotateCw,
  Flame,
  Target,
  Calendar,
  Users,
  Filter,
  CheckCircle2,
  Sparkles,
  Zap,
  Crown,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  QrCode,
  Share2,
  Mail,
} from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [showEmailStatsModal, setShowEmailStatsModal] = useState(false);
  const [autoEmailActive, setAutoEmailActive] = useState(() => getAutoEmailOverallStatsEnabled());
  const [leaderboardData, setLeaderboardData] = useState<OverallLeaderboardEntry[]>([]);
  const [tuesdayGameStats, setTuesdayGameStats] = useState<TuesdayPlayerGameStats[]>([]);
  const [wednesdayGameStats, setWednesdayGameStats] = useState<WednesdayPlayerGameStats[]>([]);
  const [thursdayGameStats, setThursdayGameStats] = useState<ThursdayPlayerGameStats[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'wednesday' | 'tuesday' | 'thursday'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tuesdayViewMode, setTuesdayViewMode] = useState<'standings' | 'tracker'>('tracker');
  const [wednesdayViewMode, setWednesdayViewMode] = useState<'standings' | 'tracker'>('tracker');
  const [thursdayViewMode, setThursdayViewMode] = useState<'standings' | 'tracker'>('tracker');
  const [sortBy, setSortBy] = useState<
    | 'totalWins'
    | 'winPercentage'
    | 'totalPoints'
    | 'threeDartAvg'
    | 'highCheckout'
    | 'highOut'
    | 'highIn'
    | 'total180s'
    | 'seasonBullsHit'
    | 'tuesdayTotalWins'
    | 'thursdayTotalWins'
    | 'game501HighScore'
    | 'game501Scores80Plus'
    | 'game501HighFinish'
    | 'game501Avg'
    | 'game501Wins'
    | 'game301HighestBeginningScore'
    | 'game301HighScore'
    | 'game301HighFinish'
    | 'game301Wins'
    | 'game301Avg'
    | 'wednesdayTotalWins'
    | 'game1001Wins'
    | 'game1001HighScore'
    | 'game1001Scores80Plus'
    | 'game701Wins'
    | 'game701HighestBeginningScore'
    | 'game701HighScore'
    | 'game701Scores80Plus'
    | 'baseballWins'
    | 'baseballHighScore'
    | 'fivesWins'
    | 'fivesHighScore'
    | 'cricketWins'
  >('totalWins');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const loadLeaderboard = () => {
    setIsRefreshing(true);
    const data = calculateAutomatedLeaderboard();
    const tuesStats = getTuesdayGameStatsList();
    const wedStats = getWednesdayGameStatsList();
    const thursStats = getThursdayGameStatsList();
    setLeaderboardData(data);
    setTuesdayGameStats(tuesStats);
    setWednesdayGameStats(wedStats);
    setThursdayGameStats(thursStats);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const handleManualCloudRefresh = async () => {
    setIsRefreshing(true);
    await refreshAllVenueData();
    const data = calculateAutomatedLeaderboard();
    const tuesStats = getTuesdayGameStatsList();
    const wedStats = getWednesdayGameStatsList();
    const thursStats = getThursdayGameStatsList();
    setLeaderboardData(data);
    setTuesdayGameStats(tuesStats);
    setWednesdayGameStats(wedStats);
    setThursdayGameStats(thursStats);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    loadLeaderboard();

    const handleSyncEvent = () => {
      loadLeaderboard();
    };
    const handlePlayerDeleted = () => {
      loadLeaderboard();
    };
    window.addEventListener('kaboom_cloud_sync_update', handleSyncEvent);
    window.addEventListener('kaboom_player_deleted', handlePlayerDeleted);
    window.addEventListener('kaboom_season_stats_reset', handleSyncEvent);
    window.addEventListener('kaboom_league_season_reset', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    // Subscribe to cloud Firestore changes from all scoring devices
    const unsubTuesStats = subscribeToTuesdayStats((statsMap) => {
      if (statsMap && Object.keys(statsMap).length > 0) {
        localStorage.setItem('kaboom_tuesday_game_stats', JSON.stringify(statsMap));
        loadLeaderboard();
      }
    });

    const unsubWed = subscribeToWednesdayStats((statsMap) => {
      if (statsMap && Object.keys(statsMap).length > 0) {
        localStorage.setItem('kaboom_wednesday_game_stats', JSON.stringify(statsMap));
        loadLeaderboard();
      }
    });

    const unsubThursStats = subscribeToThursdayStats((statsMap) => {
      if (statsMap && Object.keys(statsMap).length > 0) {
        localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify(statsMap));
        loadLeaderboard();
      }
    });

    const unsubTues = subscribeToLeagueStandings('tuesday', (standings) => {
      if (standings && standings.length > 0) {
        localStorage.setItem('kaboom_tuesday_standings', JSON.stringify(standings));
        loadLeaderboard();
      }
    });

    const unsubWedStandings = subscribeToLeagueStandings('wednesday', (standings) => {
      if (standings && standings.length > 0) {
        localStorage.setItem('kaboom_wednesday_standings', JSON.stringify(standings));
        loadLeaderboard();
      }
    });

    const unsubThurs = subscribeToLeagueStandings('thursday', (standings) => {
      if (standings && standings.length > 0) {
        localStorage.setItem('kaboom_thursday_standings', JSON.stringify(standings));
        loadLeaderboard();
      }
    });

    const unsubRoster = subscribeToPlayerRoster((players) => {
      if (players && Array.isArray(players) && players.length > 0) {
        localStorage.setItem('kaboom_dart_players', JSON.stringify(players));
        loadLeaderboard();
      }
    });

    const unsubBulls = subscribeToSeasonBulls((bullsMap) => {
      if (bullsMap && Object.keys(bullsMap).length > 0) {
        localStorage.setItem('kaboom_season_bulls', JSON.stringify(bullsMap));
        localStorage.setItem('kaboom_season_bulls_map', JSON.stringify(bullsMap));
        loadLeaderboard();
      }
    });

    return () => {
      window.removeEventListener('kaboom_cloud_sync_update', handleSyncEvent);
      window.removeEventListener('kaboom_player_deleted', handlePlayerDeleted);
      window.removeEventListener('kaboom_season_stats_reset', handleSyncEvent);
      window.removeEventListener('kaboom_league_season_reset', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
      unsubTuesStats();
      unsubWed();
      unsubThursStats();
      unsubTues();
      unsubWedStandings();
      unsubThurs();
      unsubRoster();
      unsubBulls();
    };
  }, []);

  // Format-aware metric getters (declared before filteredData and sorting to avoid ReferenceError)
  const getFormatWins = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return entry.tuesdayStats?.totalGameWins ?? entry.tuesdayWins ?? 0;
    }
    if (selectedFormat === 'wednesday') {
      return entry.wednesdayStats?.totalGameWins ?? entry.wednesdayWins ?? 0;
    }
    if (selectedFormat === 'thursday') {
      return entry.thursdayStats?.totalGameWins ?? entry.thursdayWins ?? 0;
    }
    return entry.totalWins ?? 0;
  };

  const getFormatPlayed = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return entry.tuesdayStats?.totalGamesPlayed ?? entry.tuesdayPlayed ?? 0;
    }
    if (selectedFormat === 'wednesday') {
      return entry.wednesdayStats?.totalGamesPlayed ?? entry.wednesdayPlayed ?? 0;
    }
    if (selectedFormat === 'thursday') {
      return entry.thursdayStats?.totalGamesPlayed ?? entry.thursdayPlayed ?? 0;
    }
    return entry.totalPlayed ?? 0;
  };

  const getFormatWinRate = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'all') {
      return entry.winPercentage || 0;
    }
    const w = getFormatWins(entry);
    const p = getFormatPlayed(entry);
    return p > 0 ? Math.round((w / p) * 100) : 0;
  };

  const getFormatPoints = (entry: OverallLeaderboardEntry) => {
    return getFormatWins(entry);
  };

  const getFormatAvg = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return entry.tuesdayStats?.game501Avg || entry.tuesdayStats?.game301Avg || entry.tuesdayAvg || 0;
    }
    if (selectedFormat === 'wednesday') return entry.wednesdayAvg || 0;
    if (selectedFormat === 'thursday') {
      return entry.thursdayStats?.game501Avg || entry.thursdayStats?.game301Avg || entry.thursdayAvg || 0;
    }
    return entry.threeDartAvg || 0;
  };

  const getFormatHighOut = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return Math.max(
        entry.tuesdayHighOut || 0,
        entry.tuesdayStats?.game501HighFinish || 0,
        entry.tuesdayStats?.game301HighFinish || 0
      );
    }
    if (selectedFormat === 'wednesday') {
      const wMax = Math.max(
        entry.wednesdayHighOut || 0,
        entry.wednesdayStats?.game1001HighFinish || 0,
        entry.wednesdayStats?.game701HighFinish || 0,
        entry.wednesdayStats?.fivesHighFinish || 0
      );
      return wMax;
    }
    if (selectedFormat === 'thursday') {
      return Math.max(
        entry.thursdayHighOut || 0,
        entry.thursdayStats?.game501HighFinish || 0,
        entry.thursdayStats?.game301HighFinish || 0
      );
    }
    return entry.highCheckout || entry.highOut || 0;
  };

  const getFormatHighIn = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return Math.max(
        entry.tuesdayHighIn || 0,
        entry.tuesdayStats?.game301HighestBeginningScore || 0
      );
    }
    if (selectedFormat === 'wednesday') {
      return Math.max(
        entry.wednesdayHighIn || 0,
        entry.wednesdayStats?.game701HighestBeginningScore || 0
      );
    }
    if (selectedFormat === 'thursday') {
      return Math.max(
        entry.thursdayHighIn || 0,
        entry.thursdayStats?.game301HighestBeginningScore || 0
      );
    }
    return entry.highIn || 0;
  };

  const getFormatBulls = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return Math.max(entry.tuesdayBulls || 0, entry.tuesdayStats?.seasonBullsHit || 0);
    }
    if (selectedFormat === 'wednesday') {
      return Math.max(entry.wednesdayBulls || 0, entry.wednesdayStats?.seasonBullsHit || 0);
    }
    if (selectedFormat === 'thursday') {
      return Math.max(entry.thursdayBulls || 0, entry.thursdayStats?.seasonBullsHit || 0);
    }
    return entry.seasonBullsHit || 0;
  };

  const getFormat180s = (entry: OverallLeaderboardEntry) => {
    if (selectedFormat === 'tuesday') {
      return entry.tuesday180s ?? 0;
    }
    if (selectedFormat === 'wednesday') {
      return entry.wednesday180s ?? 0;
    }
    if (selectedFormat === 'thursday') {
      return entry.thursday180s ?? 0;
    }
    return entry.total180s || 0;
  };

  // Filter by search & format - STRICT LEAGUE ISOLATION:
  // Players from one league will NEVER show up in another league unless they actually played in it.
  const filteredData = leaderboardData.filter((entry) => {
    const matchesSearch = entry.playerName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedFormat === 'tuesday') {
      const tues = entry.tuesdayStats;
      return (
        entry.tuesdayPlayed > 0 ||
        entry.tuesdayWins > 0 ||
        (entry.tuesdayBulls || 0) > 0 ||
        (entry.tuesdayPoints || 0) > 0 ||
        (entry.tuesdayAvg || 0) > 0 ||
        (entry.tuesdayHighOut || 0) > 0 ||
        (entry.tuesdayHighIn || 0) > 0 ||
        (entry.tuesday180s || 0) > 0 ||
        Boolean(
          tues && (
            (tues.totalGameWins || 0) > 0 ||
            (tues.totalGamesPlayed || 0) > 0 ||
            (tues.points || 0) > 0 ||
            (tues.seasonBullsHit || 0) > 0 ||
            (tues.game501HighScore || 0) > 0 ||
            (tues.game501Scores80Plus || 0) > 0 ||
            (tues.game501HighFinish || 0) > 0 ||
            (tues.game501Avg || 0) > 0 ||
            (tues.game501Wins || 0) > 0 ||
            (tues.cricketWins || 0) > 0 ||
            (tues.game301HighestBeginningScore || 0) > 0 ||
            (tues.game301HighScore || 0) > 0 ||
            (tues.game301HighFinish || 0) > 0 ||
            (tues.game301Wins || 0) > 0 ||
            (tues.game301Avg || 0) > 0
          )
        )
      );
    }
    if (selectedFormat === 'wednesday') {
      const wed = entry.wednesdayStats;
      return (
        entry.wednesdayPlayed > 0 ||
        entry.wednesdayWins > 0 ||
        (entry.wednesdayBulls || 0) > 0 ||
        (entry.wednesdayPoints || 0) > 0 ||
        (entry.wednesdayAvg || 0) > 0 ||
        (entry.wednesdayHighOut || 0) > 0 ||
        (entry.wednesdayHighIn || 0) > 0 ||
        (entry.wednesday180s || 0) > 0 ||
        Boolean(
          wed && (
            (wed.totalGameWins || 0) > 0 ||
            (wed.totalGamesPlayed || 0) > 0 ||
            (wed.points || 0) > 0 ||
            (wed.seasonBullsHit || 0) > 0 ||
            (wed.game1001HighScore || 0) > 0 ||
            (wed.game1001HighFinish || 0) > 0 ||
            (wed.game1001Scores80Plus || 0) > 0 ||
            (wed.game1001Wins || 0) > 0 ||
            (wed.game701HighestBeginningScore || 0) > 0 ||
            (wed.game701HighScore || 0) > 0 ||
            (wed.game701HighFinish || 0) > 0 ||
            (wed.game701Scores80Plus || 0) > 0 ||
            (wed.game701Wins || 0) > 0 ||
            (wed.baseballHighScore || 0) > 0 ||
            (wed.baseballWins || 0) > 0 ||
            (wed.fivesHighScore || 0) > 0 ||
            (wed.fivesHighFinish || 0) > 0 ||
            (wed.fivesWins || 0) > 0 ||
            (wed.cricketWins || 0) > 0
          )
        )
      );
    }
    if (selectedFormat === 'thursday') {
      const thurs = entry.thursdayStats;
      return (
        entry.thursdayPlayed > 0 ||
        entry.thursdayWins > 0 ||
        (entry.thursdayBulls || 0) > 0 ||
        (entry.thursdayPoints || 0) > 0 ||
        (entry.thursdayAvg || 0) > 0 ||
        (entry.thursdayHighOut || 0) > 0 ||
        (entry.thursdayHighIn || 0) > 0 ||
        (entry.thursday180s || 0) > 0 ||
        Boolean(
          thurs && (
            (thurs.totalGameWins || 0) > 0 ||
            (thurs.totalGamesPlayed || 0) > 0 ||
            (thurs.points || 0) > 0 ||
            (thurs.seasonBullsHit || 0) > 0 ||
            (thurs.game501HighScore || 0) > 0 ||
            (thurs.game501Scores80Plus || 0) > 0 ||
            (thurs.game501HighFinish || 0) > 0 ||
            (thurs.game501Avg || 0) > 0 ||
            (thurs.game501Wins || 0) > 0 ||
            (thurs.cricketWins || 0) > 0 ||
            (thurs.game301HighestBeginningScore || 0) > 0 ||
            (thurs.game301HighScore || 0) > 0 ||
            (thurs.game301HighFinish || 0) > 0 ||
            (thurs.game301Wins || 0) > 0 ||
            (thurs.game301Avg || 0) > 0
          )
        )
      );
    }

    return true;
  });

  // Sort filtered data
  const sortedData = [...filteredData].sort((a, b) => {
    const tuesA = a.tuesdayStats;
    const tuesB = b.tuesdayStats;
    const thursA = a.thursdayStats;
    const thursB = b.thursdayStats;
    const wedA = a.wednesdayStats;
    const wedB = b.wednesdayStats;

    if (selectedFormat === 'tuesday' || sortBy === 'tuesdayTotalWins') {
      const winsA = tuesA ? tuesA.totalGameWins : a.tuesdayWins;
      const winsB = tuesB ? tuesB.totalGameWins : b.tuesdayWins;
      if (sortBy === 'tuesdayTotalWins' || sortBy === 'totalWins') {
        return winsB - winsA || (tuesB?.game501HighScore || 0) - (tuesA?.game501HighScore || 0);
      }
    }

    if (selectedFormat === 'thursday' || sortBy === 'thursdayTotalWins') {
      const winsA = thursA ? thursA.totalGameWins : a.thursdayWins;
      const winsB = thursB ? thursB.totalGameWins : b.thursdayWins;
      if (sortBy === 'thursdayTotalWins' || sortBy === 'totalWins') {
        return winsB - winsA || (thursB?.game501HighScore || 0) - (thursA?.game501HighScore || 0);
      }
    }

    if (selectedFormat === 'wednesday' || sortBy === 'wednesdayTotalWins') {
      const winsA = wedA ? wedA.totalGameWins : a.wednesdayWins;
      const winsB = wedB ? wedB.totalGameWins : b.wednesdayWins;
      if (sortBy === 'wednesdayTotalWins' || sortBy === 'totalWins') {
        return winsB - winsA || (getFormatBulls(b) || 0) - (getFormatBulls(a) || 0);
      }
    }

    // Tuesday Game Stats sorting
    if (selectedFormat === 'tuesday') {
      if (sortBy === 'game501HighScore') return (tuesB?.game501HighScore || 0) - (tuesA?.game501HighScore || 0);
      if (sortBy === 'game501Scores80Plus') return (tuesB?.game501Scores80Plus || 0) - (tuesA?.game501Scores80Plus || 0);
      if (sortBy === 'game501HighFinish') return (tuesB?.game501HighFinish || 0) - (tuesA?.game501HighFinish || 0);
      if (sortBy === 'game501Avg') return (tuesB?.game501Avg || 0) - (tuesA?.game501Avg || 0);
      if (sortBy === 'game501Wins') return (tuesB?.game501Wins || 0) - (tuesA?.game501Wins || 0);
      if (sortBy === 'game301HighestBeginningScore') return (tuesB?.game301HighestBeginningScore || 0) - (tuesA?.game301HighestBeginningScore || 0);
      if (sortBy === 'game301HighScore') return (tuesB?.game301HighScore || 0) - (tuesA?.game301HighScore || 0);
      if (sortBy === 'game301HighFinish') return (tuesB?.game301HighFinish || 0) - (tuesA?.game301HighFinish || 0);
      if (sortBy === 'game301Wins') return (tuesB?.game301Wins || 0) - (tuesA?.game301Wins || 0);
      if (sortBy === 'game301Avg') return (tuesB?.game301Avg || 0) - (tuesA?.game301Avg || 0);
      if (sortBy === 'cricketWins') return (tuesB?.cricketWins || 0) - (tuesA?.cricketWins || 0);
    }

    // Thursday Game Stats sorting
    if (selectedFormat === 'thursday') {
      if (sortBy === 'game501HighScore') return (thursB?.game501HighScore || 0) - (thursA?.game501HighScore || 0);
      if (sortBy === 'game501Scores80Plus') return (thursB?.game501Scores80Plus || 0) - (thursA?.game501Scores80Plus || 0);
      if (sortBy === 'game501HighFinish') return (thursB?.game501HighFinish || 0) - (thursA?.game501HighFinish || 0);
      if (sortBy === 'game501Avg') return (thursB?.game501Avg || 0) - (thursA?.game501Avg || 0);
      if (sortBy === 'game501Wins') return (thursB?.game501Wins || 0) - (thursA?.game501Wins || 0);
      if (sortBy === 'game301HighestBeginningScore') return (thursB?.game301HighestBeginningScore || 0) - (thursA?.game301HighestBeginningScore || 0);
      if (sortBy === 'game301HighScore') return (thursB?.game301HighScore || 0) - (thursA?.game301HighScore || 0);
      if (sortBy === 'game301HighFinish') return (thursB?.game301HighFinish || 0) - (thursA?.game301HighFinish || 0);
      if (sortBy === 'game301Wins') return (thursB?.game301Wins || 0) - (thursA?.game301Wins || 0);
      if (sortBy === 'game301Avg') return (thursB?.game301Avg || 0) - (thursA?.game301Avg || 0);
      if (sortBy === 'cricketWins') return (thursB?.cricketWins || 0) - (thursA?.cricketWins || 0);
    }

    // Wednesday Game Stats sorting
    if (sortBy === 'game1001Wins') return (wedB?.game1001Wins || 0) - (wedA?.game1001Wins || 0);
    if (sortBy === 'game1001HighScore') return (wedB?.game1001HighScore || 0) - (wedA?.game1001HighScore || 0);
    if (sortBy === 'game1001Scores80Plus') return (wedB?.game1001Scores80Plus || 0) - (wedA?.game1001Scores80Plus || 0);
    if (sortBy === 'game701Wins') return (wedB?.game701Wins || 0) - (wedA?.game701Wins || 0);
    if (sortBy === 'game701HighestBeginningScore') return (wedB?.game701HighestBeginningScore || 0) - (wedA?.game701HighestBeginningScore || 0);
    if (sortBy === 'game701HighScore') return (wedB?.game701HighScore || 0) - (wedA?.game701HighScore || 0);
    if (sortBy === 'game701Scores80Plus') return (wedB?.game701Scores80Plus || 0) - (wedA?.game701Scores80Plus || 0);
    if (sortBy === 'baseballWins') return (wedB?.baseballWins || 0) - (wedA?.baseballWins || 0);
    if (sortBy === 'baseballHighScore') return (wedB?.baseballHighScore || 0) - (wedA?.baseballHighScore || 0);
    if (sortBy === 'fivesWins') return (wedB?.fivesWins || 0) - (wedA?.fivesWins || 0);
    if (sortBy === 'fivesHighScore') return (wedB?.fivesHighScore || 0) - (wedA?.fivesHighScore || 0);
    if (sortBy === 'cricketWins') {
      if (selectedFormat === 'tuesday') {
        return (tuesB?.cricketWins || 0) - (tuesA?.cricketWins || 0);
      }
      if (selectedFormat === 'thursday') {
        return (thursB?.cricketWins || 0) - (thursA?.cricketWins || 0);
      }
      return (wedB?.cricketWins || 0) - (wedA?.cricketWins || 0);
    }

    if (sortBy === 'winPercentage') return getFormatWinRate(b) - getFormatWinRate(a) || getFormatWins(b) - getFormatWins(a);
    if (sortBy === 'totalPoints') return getFormatPoints(b) - getFormatPoints(a) || getFormatWins(b) - getFormatWins(a);
    if (sortBy === 'seasonBullsHit') {
      const bullsB = getFormatBulls(b);
      const bullsA = getFormatBulls(a);
      return (bullsB - bullsA) || getFormatWins(b) - getFormatWins(a);
    }
    if (sortBy === 'threeDartAvg') return getFormatAvg(b) - getFormatAvg(a) || getFormatWins(b) - getFormatWins(a);
    if (sortBy === 'highCheckout' || (sortBy as string) === 'highOut') return getFormatHighOut(b) - getFormatHighOut(a) || getFormatWins(b) - getFormatWins(a);
    if ((sortBy as string) === 'highIn') return getFormatHighIn(b) - getFormatHighIn(a) || getFormatWins(b) - getFormatWins(a);
    if (sortBy === 'total180s') return getFormat180s(b) - getFormat180s(a) || getFormatWins(b) - getFormatWins(a);

    return getFormatWins(b) - getFormatWins(a) || getFormatWinRate(b) - getFormatWinRate(a) || getFormatPoints(b) - getFormatPoints(a);
  });

  // Top ranked players for currently selected league format
  const topThree = sortedData.slice(0, 3);
  const currentLeader = sortedData.length > 0 ? sortedData[0] : null;

  // Quick Seed Sample Data for Wednesday Testing
  const handleSeedWednesdayData = () => {
    const map = getWednesdayGameStatsMap();
    const players = [
      {
        name: 'Player 1',
        g1001High: 140,
        g1001Fin: 68,
        g1001_80: 740,
        g1001W: 4,
        g701Beg: 80,
        g701High: 125,
        g701Fin: 40,
        g701_80: 520,
        g701W: 3,
        bbHigh: 14,
        bbW: 4,
        fHigh: 25,
        fFin: 20,
        fW: 3,
        cW: 5,
        bulls: 18,
      },
      {
        name: 'Player 2',
        g1001High: 100,
        g1001Fin: 40,
        g1001_80: 420,
        g1001W: 2,
        g701Beg: 60,
        g701High: 100,
        g701Fin: 32,
        g701_80: 310,
        g701W: 2,
        bbHigh: 11,
        bbW: 2,
        fHigh: 15,
        fFin: 10,
        fW: 2,
        cW: 3,
        bulls: 12,
      },
    ];

    players.forEach((p) => {
      const key = p.name.toLowerCase().trim();
      const current = map[key] || {
        playerId: `p-${key}`,
        playerName: p.name,
        avatar: '🎯',
        game1001HighScore: 0,
        game1001HighFinish: 0,
        game1001Scores80Plus: 0,
        game1001Wins: 0,
        game701HighestBeginningScore: 0,
        game701HighScore: 0,
        game701HighFinish: 0,
        game701Scores80Plus: 0,
        game701Wins: 0,
        baseballHighScore: 0,
        baseballWins: 0,
        fivesHighScore: 0,
        fivesHighFinish: 0,
        fivesWins: 0,
        cricketWins: 0,
        seasonBullsHit: 0,
        totalGameWins: 0,
        totalGamesPlayed: 0,
      };

      current.game1001HighScore = Math.max(current.game1001HighScore, p.g1001High);
      current.game1001HighFinish = Math.max(current.game1001HighFinish, p.g1001Fin);
      current.game1001Scores80Plus += p.g1001_80;
      current.game1001Wins += p.g1001W;
      current.game701HighestBeginningScore = Math.max(current.game701HighestBeginningScore, p.g701Beg);
      current.game701HighScore = Math.max(current.game701HighScore, p.g701High);
      current.game701HighFinish = Math.max(current.game701HighFinish, p.g701Fin);
      current.game701Scores80Plus += p.g701_80;
      current.game701Wins += p.g701W;
      current.baseballHighScore = Math.max(current.baseballHighScore, p.bbHigh);
      current.baseballWins += p.bbW;
      current.fivesHighScore = Math.max(current.fivesHighScore, p.fHigh);
      current.fivesHighFinish = Math.max(current.fivesHighFinish, p.fFin);
      current.fivesWins += p.fW;
      current.cricketWins += p.cW;
      current.seasonBullsHit = (current.seasonBullsHit || 0) + p.bulls;
      current.totalGameWins =
        current.game1001Wins +
        current.game701Wins +
        current.baseballWins +
        current.fivesWins +
        current.cricketWins;
      current.totalGamesPlayed += current.totalGameWins + 2;
      map[key] = current;
    });

    saveWednesdayGameStatsMap(map);
    loadLeaderboard();
  };

  const handleSeedTuesdayData = () => {
    const map = getTuesdayGameStatsMap();
    const players = [
      {
        name: 'Player 1',
        g501High: 180,
        g501_80: 1540,
        g501Fin: 112,
        g501Avg: 68.4,
        g501W: 6,
        cW: 5,
        g301Beg: 120,
        g301High: 140,
        g301Fin: 96,
        g301W: 5,
        g301Avg: 61.2,
        bulls: 7,
      },
      {
        name: 'Player 2',
        g501High: 140,
        g501_80: 840,
        g501Fin: 76,
        g501Avg: 54.2,
        g501W: 4,
        cW: 4,
        g301Beg: 80,
        g301High: 100,
        g301Fin: 64,
        g301W: 3,
        g301Avg: 49.8,
        bulls: 4,
      },
    ];

    players.forEach((p) => {
      const key = p.name.toLowerCase().trim();
      const current = map[key] || {
        playerId: `p-${key}`,
        playerName: p.name,
        avatar: '🎯',
        game501HighScore: 0,
        game501Scores80Plus: 0,
        game501HighFinish: 0,
        game501Avg: 0,
        game501DartsThrown: 0,
        game501TotalScore: 0,
        game501Wins: 0,
        game501Played: 0,
        cricketWins: 0,
        cricketPlayed: 0,
        game301HighestBeginningScore: 0,
        game301HighScore: 0,
        game301HighFinish: 0,
        game301Wins: 0,
        game301Avg: 0,
        game301DartsThrown: 0,
        game301TotalScore: 0,
        game301Played: 0,
        seasonBullsHit: 0,
        totalGameWins: 0,
        totalGamesPlayed: 0,
        points: 0,
      };

      current.game501HighScore = Math.max(current.game501HighScore, p.g501High);
      current.game501Scores80Plus += p.g501_80;
      current.game501HighFinish = Math.max(current.game501HighFinish, p.g501Fin);
      current.game501Avg = p.g501Avg;
      current.game501Wins += p.g501W;
      current.game501Played += p.g501W + 2;

      current.cricketWins += p.cW;
      current.cricketPlayed += p.cW + 2;

      current.game301HighestBeginningScore = Math.max(current.game301HighestBeginningScore, p.g301Beg);
      current.game301HighScore = Math.max(current.game301HighScore, p.g301High);
      current.game301HighFinish = Math.max(current.game301HighFinish, p.g301Fin);
      current.game301Wins += p.g301W;
      current.game301Avg = p.g301Avg;
      current.game301Played += p.g301W + 1;
      current.seasonBullsHit = (current.seasonBullsHit || 0) + p.bulls;

      current.totalGameWins = current.game501Wins + current.cricketWins + current.game301Wins;
      current.totalGamesPlayed = current.game501Played + current.cricketPlayed + current.game301Played;
      current.points = current.totalGameWins * 3;
      map[key] = current;
    });

    saveTuesdayGameStatsMap(map);

    const bullsMap = getSeasonBullsMap();
    players.forEach((p) => {
      const key = p.name.toLowerCase().trim();
      bullsMap[key] = (bullsMap[key] || 0) + p.bulls;
    });
    saveSeasonBullsMap(bullsMap);

    loadLeaderboard();
  };

  const handleSeedThursdayData = () => {
    // Official games have not begun until this upcoming Thursday:
    // Ensure all players for Thursday league only have 0 stats and 0 Bulls.
    saveThursdayGameStatsMap({});
    localStorage.setItem('kaboom_thursday_game_stats', JSON.stringify({}));
    localStorage.setItem('kaboom_thursday_standings', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_thursday_game_stats', data: {} } }));
    window.dispatchEvent(new CustomEvent('kaboom_cloud_sync_update', { detail: { key: 'kaboom_thursday_standings', data: [] } }));
    loadLeaderboard();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Automated League Standings & Stats Tracker
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            League Leaderboard & Running Totals
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
            Complete running totals across <strong>1001</strong>, <strong>701</strong>, <strong>Baseball</strong>, <strong>5s</strong>, <strong>Cricket</strong>, and <strong>Bulls</strong> to crown the Season Champion.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Cloud Live Synced
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('kaboom_open_share'))}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-indigo-400" />
            QR Share
          </button>
          <button
            type="button"
            onClick={handleManualCloudRefresh}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync from Cloud
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowEmailStatsModal(true)}
              className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md border border-emerald-500/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Email fully detailed overall stats of all individual players to surgedarts@gmail.com"
            >
              <Mail className="w-4 h-4 text-emerald-200" />
              <span>Email Overall Stats</span>
              {autoEmailActive && (
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" title="Auto-email active to surgedarts@gmail.com" />
              )}
            </button>
          )}
          <AdminSeasonResetButton
            league={selectedFormat}
            label={
              selectedFormat === 'tuesday'
                ? 'Reset Tuesday Season'
                : selectedFormat === 'wednesday'
                ? 'Reset Wednesday Season'
                : selectedFormat === 'thursday'
                ? 'Reset Thursday Season'
                : 'Start New Season'
            }
            onSuccess={loadLeaderboard}
          />
        </div>
      </div>

      {/* CHAMPIONSHIP CROWNING CARD */}
      {selectedFormat === 'wednesday' && currentLeader && (
        <div className="bg-gradient-to-r from-amber-500/15 via-indigo-900/30 to-slate-900 border-2 border-amber-400/80 rounded-2xl p-6 shadow-xl relative overflow-hidden text-slate-900">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-4xl shadow-lg border-2 border-amber-200 shrink-0">
                {currentLeader.avatar || '👑'}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full shadow-sm mb-1.5">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  <span>Current Wednesday League Champion</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {currentLeader.playerName}
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm font-semibold mt-0.5">
                  Leading with <strong className="text-indigo-600 font-black text-base">{getFormatWins(currentLeader)} Total Game Wins</strong> across all Wednesday events & <strong className="text-amber-600">{getFormatBulls(currentLeader)} Season Bulls</strong>.
                </p>
              </div>
            </div>

            {/* Quick Metrics Pills */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full md:w-auto text-center font-mono">
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block">1001 Wins</span>
                <span className="font-black text-indigo-600 text-sm">{currentLeader.wednesdayStats?.game1001Wins || 0}</span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block">701 Wins</span>
                <span className="font-black text-indigo-600 text-sm">{currentLeader.wednesdayStats?.game701Wins || 0}</span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block">Baseball</span>
                <span className="font-black text-amber-600 text-sm">{currentLeader.wednesdayStats?.baseballWins || 0}</span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block">5s Wins</span>
                <span className="font-black text-emerald-600 text-sm">{currentLeader.wednesdayStats?.fivesWins || 0}</span>
              </div>
              <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-slate-400 uppercase block">Cricket</span>
                <span className="font-black text-indigo-600 text-sm">{currentLeader.wednesdayStats?.cricketWins || 0}</span>
              </div>
              <div className="bg-amber-100 p-2.5 rounded-xl border border-amber-300 shadow-xs">
                <span className="text-[10px] font-sans font-bold text-amber-900 uppercase block">Total Wins</span>
                <span className="font-black text-amber-900 text-base">{getFormatWins(currentLeader)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP 3 PODIUM (For All / Tuesday / Thursday Formats) */}
      {selectedFormat !== 'wednesday' && topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2">
          {/* SILVER - 2ND PLACE */}
          {topThree[1] && (
            <div className="order-2 md:order-1 bg-gradient-to-b from-slate-100 to-slate-200/90 border-2 border-slate-300 rounded-2xl p-5 text-center shadow-md relative overflow-hidden">
              <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-slate-300 text-slate-800 text-[10px] font-black uppercase rounded-full">
                #2 Silver
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-300/80 text-3xl flex items-center justify-center mx-auto mb-2 border-2 border-slate-400 shadow-inner">
                {topThree[1].avatar}
              </div>
              <h3 className="font-black text-slate-900 text-base line-clamp-1">{topThree[1].playerName}</h3>
              <div className="mt-2 text-2xl font-black text-slate-800">
                {getFormatWins(topThree[1])} <span className="text-xs font-bold text-slate-500 uppercase">Wins</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 text-xs font-bold text-slate-600">
                <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                  {getFormatPlayed(topThree[1]) > 0 ? Math.round((getFormatWins(topThree[1]) / getFormatPlayed(topThree[1])) * 100) : 0}% Win Rate
                </span>
                <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-300">
                  {selectedFormat === 'all' ? `${topThree[1].totalPoints} Pts` : `${getFormatWins(topThree[1])} Pts`}
                </span>
              </div>
            </div>
          )}

          {/* GOLD - 1ST PLACE CHAMPION */}
          {topThree[0] && (
            <div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 via-amber-400/5 to-amber-500/20 border-2 border-amber-400 rounded-2xl p-6 text-center shadow-xl relative overflow-hidden transform md:-translate-y-2">
              <div className="absolute top-2 right-2 px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded-full shadow flex items-center gap-1">
                <Trophy className="w-3 h-3 fill-current" />
                {selectedFormat === 'tuesday' ? '#1 Tuesday Champion' : selectedFormat === 'thursday' ? '#1 Thursday Champion' : '#1 Overall Champion'}
              </div>
              <div className="w-20 h-20 rounded-2xl bg-amber-100 text-4xl flex items-center justify-center mx-auto mb-2 border-2 border-amber-400 shadow-md">
                {topThree[0].avatar}
              </div>
              <h3 className="font-black text-slate-900 text-lg line-clamp-1">{topThree[0].playerName}</h3>
              <div className="mt-2 text-3xl font-black text-amber-600">
                {getFormatWins(topThree[0])} <span className="text-xs font-bold text-amber-800 uppercase">{selectedFormat === 'all' ? 'Combined Wins' : 'League Wins'}</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 text-xs font-extrabold text-amber-900">
                <span className="bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300 shadow-sm">
                  🎯 {getFormatPlayed(topThree[0]) > 0 ? Math.round((getFormatWins(topThree[0]) / getFormatPlayed(topThree[0])) * 100) : 0}% Win Rate
                </span>
                <span className="bg-amber-100/90 px-2.5 py-1 rounded-lg border border-amber-300 shadow-sm">
                  ⚡ {selectedFormat === 'all' ? `${topThree[0].totalPoints} Points` : `${getFormatWins(topThree[0])} Points`}
                </span>
              </div>
            </div>
          )}

          {/* BRONZE - 3RD PLACE */}
          {topThree[2] && (
            <div className="order-3 bg-gradient-to-b from-amber-900/5 to-amber-900/10 border-2 border-amber-800/30 rounded-2xl p-5 text-center shadow-md relative overflow-hidden">
              <div className="absolute top-2 right-2 px-2.5 py-0.5 bg-amber-800/20 text-amber-900 text-[10px] font-black uppercase rounded-full">
                #3 Bronze
              </div>
              <div className="w-16 h-16 rounded-2xl bg-amber-100/60 text-3xl flex items-center justify-center mx-auto mb-2 border-2 border-amber-700/40 shadow-inner">
                {topThree[2].avatar}
              </div>
              <h3 className="font-black text-slate-900 text-base line-clamp-1">{topThree[2].playerName}</h3>
              <div className="mt-2 text-2xl font-black text-amber-900">
                {getFormatWins(topThree[2])} <span className="text-xs font-bold text-amber-700/80 uppercase">Wins</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 text-xs font-bold text-amber-900">
                <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                  {getFormatPlayed(topThree[2]) > 0 ? Math.round((getFormatWins(topThree[2]) / getFormatPlayed(topThree[2])) * 100) : 0}% Win Rate
                </span>
                <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                  {selectedFormat === 'all' ? `${topThree[2].totalPoints} Pts` : `${getFormatWins(topThree[2])} Pts`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FILTER & SORT CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Format Selector Pills */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setSelectedFormat('all');
              setSortBy('totalWins');
            }}
            className={`flex-1 md:flex-initial px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedFormat === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> All Formats
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFormat('wednesday');
              setSortBy('wednesdayTotalWins');
              setWednesdayViewMode('tracker');
            }}
            className={`flex-1 md:flex-initial px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedFormat === 'wednesday' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Wednesday Teams (Game Stats Tracker)
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFormat('tuesday');
              setSortBy('tuesdayTotalWins');
              setTuesdayViewMode('tracker');
            }}
            className={`flex-1 md:flex-initial px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedFormat === 'tuesday' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-indigo-500" /> Tuesday Singles (Game Stats Tracker)
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedFormat('thursday');
              setSortBy('thursdayTotalWins');
              setThursdayViewMode('tracker');
            }}
            className={`flex-1 md:flex-initial px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              selectedFormat === 'thursday' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-500" /> Thursday Doubles (Game Stats Tracker)
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search player..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full sm:w-auto py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {selectedFormat === 'tuesday' ? (
                <>
                  <option value="tuesdayTotalWins">Sort by Tuesday Total Wins (Champion)</option>
                  <option value="threeDartAvg">Sort by 3-Dart Avg</option>
                  <option value="highOut">Sort by High Out (Checkout)</option>
                  <option value="highIn">Sort by High In (Double In 1st Shot)</option>
                  <option value="game501HighScore">Sort by 501 All-Time High Score</option>
                  <option value="game501Scores80Plus">Sort by 501 Total 80+ Points</option>
                  <option value="game501HighFinish">Sort by 501 High Finish</option>
                  <option value="game501Avg">Sort by 501 Running Average</option>
                  <option value="game501Wins">Sort by 501 Wins</option>
                  <option value="cricketWins">Sort by Cricket Total Wins</option>
                  <option value="seasonBullsHit">Sort by Season Bulls Hit (🎯)</option>
                  <option value="game301HighestBeginningScore">Sort by 301 Highest 1st Score (Season)</option>
                  <option value="game301HighScore">Sort by 301 High Score Overall</option>
                  <option value="game301HighFinish">Sort by 301 High Finish (Checkout)</option>
                  <option value="game301Wins">Sort by 301 Total Wins</option>
                  <option value="game301Avg">Sort by 301 Running Average</option>
                  <option value="winPercentage">Sort by Win Percentage %</option>
                </>
              ) : selectedFormat === 'thursday' ? (
                <>
                  <option value="thursdayTotalWins">Sort by Thursday Total Wins (Champion)</option>
                  <option value="threeDartAvg">Sort by 3-Dart Avg</option>
                  <option value="highOut">Sort by High Out (Checkout)</option>
                  <option value="highIn">Sort by High In (Double In 1st Shot)</option>
                  <option value="game501HighScore">Sort by 501 All-Time High Score</option>
                  <option value="game501Scores80Plus">Sort by 501 Total 80+ Points</option>
                  <option value="game501HighFinish">Sort by 501 High Finish</option>
                  <option value="game501Avg">Sort by 501 Running Average</option>
                  <option value="game501Wins">Sort by 501 Wins</option>
                  <option value="cricketWins">Sort by Cricket Total Wins</option>
                  <option value="seasonBullsHit">Sort by Season Bulls Hit (🎯)</option>
                  <option value="game301HighestBeginningScore">Sort by 301 Highest 1st Score (Season)</option>
                  <option value="game301HighScore">Sort by 301 High Score Overall</option>
                  <option value="game301HighFinish">Sort by 301 High Finish (Checkout)</option>
                  <option value="game301Wins">Sort by 301 Total Wins</option>
                  <option value="game301Avg">Sort by 301 Running Average</option>
                  <option value="winPercentage">Sort by Win Percentage %</option>
                </>
              ) : selectedFormat === 'wednesday' ? (
                <>
                  <option value="wednesdayTotalWins">Sort by Total Running Game Wins (Champion)</option>
                  <option value="totalPoints">Sort by Total Points</option>
                  <option value="threeDartAvg">Sort by 3-Dart Avg</option>
                  <option value="highOut">Sort by High Out (Checkout)</option>
                  <option value="highIn">Sort by High In (Double In 1st Shot)</option>
                  <option value="seasonBullsHit">Sort by Season Bulls Hit (🎯)</option>
                  <option value="game1001Wins">Sort by 1001 Wins</option>
                  <option value="game1001HighScore">Sort by 1001 High Score</option>
                  <option value="game1001Scores80Plus">Sort by 1001 Total 80+ Points</option>
                  <option value="game701Wins">Sort by 701 Wins</option>
                  <option value="game701HighestBeginningScore">Sort by 701 High In (Double In Opening)</option>
                  <option value="game701HighScore">Sort by 701 High Score</option>
                  <option value="game701Scores80Plus">Sort by 701 Total 80+ Points</option>
                  <option value="baseballWins">Sort by Baseball Wins</option>
                  <option value="baseballHighScore">Sort by Baseball Highest Overall Score</option>
                  <option value="fivesWins">Sort by 5s Wins</option>
                  <option value="fivesHighScore">Sort by 5s High Score</option>
                  <option value="cricketWins">Sort by Cricket Wins</option>
                </>
              ) : (
                <>
                  <option value="totalWins">Sort by Total Wins</option>
                  <option value="winPercentage">Sort by Win Percentage %</option>
                  <option value="totalPoints">Sort by Total Points</option>
                  <option value="threeDartAvg">Sort by 3-Dart Avg</option>
                  <option value="highOut">Sort by High Out (Checkout)</option>
                  <option value="highIn">Sort by High In (Double In 1st Shot)</option>
                  <option value="seasonBullsHit">Sort by Season Bulls (🎯)</option>
                  <option value="total180s">Sort by 180s Count</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Active League Stat Leader Cards */}
      {(() => {
        const hInLeader = [...sortedData].filter(x => getFormatHighIn(x) > 0).sort((a, b) => getFormatHighIn(b) - getFormatHighIn(a))[0];
        const hOutLeader = [...sortedData].filter(x => getFormatHighOut(x) > 0).sort((a, b) => getFormatHighOut(b) - getFormatHighOut(a))[0];
        const avgLeader = [...sortedData].filter(x => getFormatAvg(x) > 0).sort((a, b) => getFormatAvg(b) - getFormatAvg(a))[0];

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl shrink-0 font-black">
                🎯
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  High In (1st Shot Dbl In)
                </span>
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-black text-sm text-slate-900 truncate">
                    {hInLeader ? hInLeader.playerName : 'None recorded'}
                  </span>
                  {hInLeader && (
                    <span className="font-black text-emerald-600 text-sm shrink-0">
                      {getFormatHighIn(hInLeader)} pts
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-indigo-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shrink-0 font-black">
                ⚡
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  Top 3-Dart Avg
                </span>
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-black text-sm text-slate-900 truncate">
                    {avgLeader ? avgLeader.playerName : 'None recorded'}
                  </span>
                  {avgLeader && (
                    <span className="font-black text-indigo-600 text-sm shrink-0">
                      {getFormatAvg(avgLeader).toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0 font-black">
                🏆
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                  High Out (Checkout)
                </span>
                <div className="flex items-baseline gap-2 truncate">
                  <span className="font-black text-sm text-slate-900 truncate">
                    {hOutLeader ? hOutLeader.playerName : 'None recorded'}
                  </span>
                  {hOutLeader && (
                    <span className="font-black text-amber-600 text-sm shrink-0">
                      {getFormatHighOut(hOutLeader)} pts
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tuesday Sub-View Mode Selector */}
      {selectedFormat === 'tuesday' && (
        <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTuesdayViewMode('standings')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tuesdayViewMode === 'standings'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Tuesday Individual Standings (Avg, High Out, High In)
            </button>
            <button
              type="button"
              onClick={() => setTuesdayViewMode('tracker')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tuesdayViewMode === 'tracker'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 3-Game Official Stat Tracker (501, Cricket, 301)
            </button>
          </div>
          <span className="text-xs text-slate-500 font-bold px-3">
            {tuesdayViewMode === 'standings' ? 'Showing Individual Player Standings' : 'Showing Tuesday Singles 501, Cricket & 301 Game Stats'}
          </span>
        </div>
      )}

      {/* Wednesday Sub-View Mode Selector */}
      {selectedFormat === 'wednesday' && (
        <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWednesdayViewMode('standings')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                wednesdayViewMode === 'standings'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Wednesday Individual Standings (Avg, High Out, High In)
            </button>
            <button
              type="button"
              onClick={() => setWednesdayViewMode('tracker')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                wednesdayViewMode === 'tracker'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 6-Game Official Stat Tracker
            </button>
          </div>
          <span className="text-xs text-slate-500 font-bold px-3">
            {wednesdayViewMode === 'standings' ? 'Showing Individual Player Standings' : 'Showing 1001, 701, Baseball, 5s, Cricket & Bulls'}
          </span>
        </div>
      )}

      {/* Thursday Sub-View Mode Selector */}
      {selectedFormat === 'thursday' && (
        <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setThursdayViewMode('standings')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                thursdayViewMode === 'standings'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Thursday Standings (Avg, High Out, High In)
            </button>
            <button
              type="button"
              onClick={() => setThursdayViewMode('tracker')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                thursdayViewMode === 'tracker'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 3-Game Official Stat Tracker (501, Cricket, 301)
            </button>
          </div>
          <span className="text-xs text-slate-500 font-bold px-3">
            {thursdayViewMode === 'standings' ? 'Showing Thursday Standings' : 'Showing Thursday Doubles 501, Cricket & 301 Game Stats'}
          </span>
        </div>
      )}

      {/* DEDICATED TUESDAY SINGLES LEAGUE GAME-BY-GAME STATS TABLE */}
      {selectedFormat === 'tuesday' && tuesdayViewMode === 'tracker' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                Tuesday Singles League Official Game-by-Game Stat Tracker
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracking individual 501, Cricket, and 301 game stats for Tuesday Singles League.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedTuesdayData}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                title="Populate test sample data to verify leaderboard calculations"
              >
                + Add Demo Data
              </button>
              <span className="text-xs text-slate-400 font-bold">
                {sortedData.length} Players Registered
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans uppercase text-[10px] tracking-wider bg-slate-50/80">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-3 text-center bg-amber-100/50 text-amber-900 font-black">
                    🏆 Champion (Total Wins)
                  </th>
                  {/* 501 Column Group */}
                  <th className="py-3 px-3 text-center bg-indigo-50/60 text-indigo-900">
                    501 Stats (High Score / 80+ Total Pts / High Finish / 501 Avg / Wins)
                  </th>
                  {/* Cricket Column Group */}
                  <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900">
                    Cricket (Total Wins)
                  </th>
                  {/* 301 Column Group */}
                  <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                    301 Stats (1st Shot / High Score / High Finish / 301 Wins / 301 Avg)
                  </th>
                  {/* Bulls Column Group */}
                  <th className="py-3 px-3 text-center bg-rose-50 text-rose-900">
                    Bulls Hit (🎯)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No Tuesday Singles game stats recorded yet. Launch Tuesday Singles matches to start tracking!
                    </td>
                  </tr>
                ) : (
                  sortedData.map((entry, idx) => {
                    const tues = entry.tuesdayStats || {
                      playerId: entry.playerId,
                      playerName: entry.playerName,
                      avatar: entry.avatar,
                      game501HighScore: 0,
                      game501Scores80Plus: 0,
                      game501HighFinish: 0,
                      game501Avg: 0,
                      game501DartsThrown: 0,
                      game501TotalScore: 0,
                      game501Wins: 0,
                      game501Played: 0,
                      cricketWins: 0,
                      cricketPlayed: 0,
                      game301HighestBeginningScore: 0,
                      game301HighScore: 0,
                      game301HighFinish: 0,
                      game301Wins: 0,
                      game301Avg: 0,
                      game301DartsThrown: 0,
                      game301TotalScore: 0,
                      game301Played: 0,
                      seasonBullsHit: entry.tuesdayBulls ?? entry.tuesdayStats?.seasonBullsHit ?? 0,
                      totalGameWins: entry.tuesdayWins || 0,
                      totalGamesPlayed: entry.tuesdayPlayed || 0,
                      points: 0,
                    };

                    const totalRunningWins =
                      tues.totalGameWins ||
                      tues.game501Wins + tues.cricketWins + tues.game301Wins;

                    return (
                      <tr key={entry.playerId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-3 font-bold font-sans">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                : idx === 2
                                ? 'bg-amber-900/10 text-amber-900 border border-amber-900/20'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Player */}
                        <td className="py-3.5 px-3 font-bold text-slate-900 font-sans text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{entry.avatar}</span>
                            <div>
                              <span className="block">{entry.playerName}</span>
                              {idx === 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 uppercase">
                                  <Crown className="w-3 h-3 fill-current" /> Tuesday Singles Leader
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Champion Metric: Total Running Game Wins */}
                        <td className="py-3.5 px-3 text-center bg-amber-50/60">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-400 text-slate-950 rounded-xl font-black text-sm shadow-xs">
                            <Trophy className="w-3.5 h-3.5 fill-current" />
                            {totalRunningWins} Wins
                          </div>
                        </td>

                        {/* 501 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-indigo-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] flex-wrap">
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="501 All-Time High Score">
                              High: {tues.game501HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-100 rounded border border-indigo-200 text-indigo-950 font-black" title="501 Total Points (Sum of all shots 80 or higher)">
                              80+: {tues.game501Scores80Plus}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="501 High Finish (Highest checkout)">
                              Fin: {tues.game501HighFinish || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-50 rounded border border-indigo-300 text-indigo-950 font-bold" title="501 Running 3-Dart Average">
                              Avg: {tues.game501Avg > 0 ? tues.game501Avg.toFixed(1) : '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-black text-xs" title="501 Wins">
                              {tues.game501Wins} W
                            </span>
                          </div>
                        </td>

                        {/* Cricket Wins */}
                        <td className="py-3.5 px-3 text-center bg-emerald-50/30">
                          <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-md font-black text-xs shadow-xs" title="Cricket Total Wins (Running total of Cricket games won)">
                            {tues.cricketWins} Wins
                          </span>
                        </td>

                        {/* 301 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-blue-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] flex-wrap">
                            <span className="px-1.5 py-0.5 bg-blue-100 rounded border border-blue-200 text-blue-950 font-black" title="301 Highest 1st Score (Double In Opening Shot for Season)">
                              1st Shot: {tues.game301HighestBeginningScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="301 Highest Score Overall">
                              High: {tues.game301HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="301 High Finish (Score achieved on the game-winning checkout)">
                              Fin: {tues.game301HighFinish || '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-black text-xs" title="301 Total Wins in Tuesday League">
                              {tues.game301Wins} W
                            </span>
                            <span className="px-1.5 py-0.5 bg-blue-50 rounded border border-blue-300 text-blue-950 font-bold" title="301 Running 3-Dart Average">
                              Avg: {tues.game301Avg > 0 ? tues.game301Avg.toFixed(1) : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Bulls Hit Total */}
                        <td className="py-3.5 px-3 text-center bg-rose-50/40">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-300 rounded-full font-black text-xs"
                            title="Running total of bulls each individual player hit during Bulls"
                          >
                            🎯 {tues.seasonBullsHit || entry.tuesdayBulls || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedFormat === 'thursday' && thursdayViewMode === 'tracker' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Thursday Doubles League Official Game-by-Game Stat Tracker
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracking individual 501, Cricket, and 301 game stats for Thursday Doubles League.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedThursdayData}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                title="Reset all Thursday stats and bulls to 0 (official games begin this upcoming Thursday)"
              >
                Reset Stats to 0
              </button>
              <span className="text-xs text-slate-400 font-bold">
                {sortedData.length} Players Registered
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans uppercase text-[10px] tracking-wider bg-slate-50/80">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-3 text-center bg-amber-100/50 text-amber-900 font-black">
                    🏆 Champion (Total Wins)
                  </th>
                  {/* 501 Column Group */}
                  <th className="py-3 px-3 text-center bg-indigo-50/60 text-indigo-900">
                    501 Stats (High Score / 80+ Total Pts / High Finish / 501 Avg / Wins)
                  </th>
                  {/* Cricket Column Group */}
                  <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900">
                    Cricket (Total Wins)
                  </th>
                  {/* 301 Column Group */}
                  <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                    301 Stats (1st Shot / High Score / High Finish / 301 Wins / 301 Avg)
                  </th>
                  {/* Bulls Column Group */}
                  <th className="py-3 px-3 text-center bg-rose-50 text-rose-900">
                    Bulls Hit (🎯)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No Thursday Doubles game stats recorded yet (official games begin this upcoming Thursday; all Thursday stats and Bulls are set to 0).
                    </td>
                  </tr>
                ) : (
                  sortedData.map((entry, idx) => {
                    const thurs = entry.thursdayStats || {
                      playerId: entry.playerId,
                      playerName: entry.playerName,
                      avatar: entry.avatar,
                      game501HighScore: 0,
                      game501Scores80Plus: 0,
                      game501HighFinish: 0,
                      game501Avg: 0,
                      game501DartsThrown: 0,
                      game501TotalScore: 0,
                      game501Wins: 0,
                      game501Played: 0,
                      cricketWins: 0,
                      cricketPlayed: 0,
                      game301HighestBeginningScore: 0,
                      game301HighScore: 0,
                      game301HighFinish: 0,
                      game301Wins: 0,
                      game301Avg: 0,
                      game301DartsThrown: 0,
                      game301TotalScore: 0,
                      game301Played: 0,
                      seasonBullsHit: Math.max(entry.thursdayBulls || 0, entry.thursdayStats?.seasonBullsHit || 0),
                      totalGameWins: entry.thursdayWins || 0,
                      totalGamesPlayed: entry.thursdayPlayed || 0,
                      points: 0,
                    };

                    const totalRunningWins =
                      thurs.totalGameWins ||
                      thurs.game501Wins + thurs.cricketWins + thurs.game301Wins;

                    return (
                      <tr key={entry.playerId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-3 font-bold font-sans">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                : idx === 2
                                ? 'bg-amber-900/10 text-amber-900 border border-amber-900/20'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Player */}
                        <td className="py-3.5 px-3 font-bold text-slate-900 font-sans text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{entry.avatar}</span>
                            <div>
                              <span className="block">{entry.playerName}</span>
                              {idx === 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 uppercase">
                                  <Crown className="w-3 h-3 fill-current" /> Thursday Doubles Leader
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Champion Metric: Total Running Game Wins */}
                        <td className="py-3.5 px-3 text-center bg-amber-50/60">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-400 text-slate-950 rounded-xl font-black text-sm shadow-xs">
                            <Trophy className="w-3.5 h-3.5 fill-current" />
                            {totalRunningWins} Wins
                          </div>
                        </td>

                        {/* 501 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-indigo-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] flex-wrap">
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="501 All-Time High Score">
                              High: {thurs.game501HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-100 rounded border border-indigo-200 text-indigo-950 font-black" title="501 Total Points (Sum of all shots 80 or higher)">
                              80+: {thurs.game501Scores80Plus}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="501 High Finish (Highest checkout)">
                              Fin: {thurs.game501HighFinish || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-50 rounded border border-indigo-300 text-indigo-950 font-bold" title="501 Running 3-Dart Average">
                              Avg: {thurs.game501Avg > 0 ? thurs.game501Avg.toFixed(1) : '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-black text-xs" title="501 Wins">
                              {thurs.game501Wins} W
                            </span>
                          </div>
                        </td>

                        {/* Cricket Wins */}
                        <td className="py-3.5 px-3 text-center bg-emerald-50/30">
                          <span className="inline-block px-3 py-1 bg-emerald-600 text-white rounded-md font-black text-xs shadow-xs" title="Cricket Total Wins (Running total of Cricket games won)">
                            {thurs.cricketWins} Wins
                          </span>
                        </td>

                        {/* 301 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-blue-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px] flex-wrap">
                            <span className="px-1.5 py-0.5 bg-blue-100 rounded border border-blue-200 text-blue-950 font-black" title="301 Highest 1st Score (Double In Opening Shot for Season)">
                              1st Shot: {thurs.game301HighestBeginningScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="301 Highest Score Overall">
                              High: {thurs.game301HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="301 High Finish (Score achieved on the game-winning checkout)">
                              Fin: {thurs.game301HighFinish || '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-black text-xs" title="301 Total Wins in Thursday League">
                              {thurs.game301Wins} W
                            </span>
                            <span className="px-1.5 py-0.5 bg-blue-50 rounded border border-blue-300 text-blue-950 font-bold" title="301 Running 3-Dart Average">
                              Avg: {thurs.game301Avg > 0 ? thurs.game301Avg.toFixed(1) : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Bulls Hit Total */}
                        <td className="py-3.5 px-3 text-center bg-rose-50/40">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-300 rounded-full font-black text-xs"
                            title="Running total of bulls each individual player hit during Bulls"
                          >
                            🎯 {Math.max(thurs.seasonBullsHit || 0, entry.thursdayBulls || 0, entry.thursdayStats?.seasonBullsHit || 0)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedFormat === 'wednesday' && wednesdayViewMode === 'tracker' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Wednesday League Game-by-Game Official Stat Tracker
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tracking all 6 game types (1001, 701, Baseball, 5s, Cricket, Bulls) & Running Total of Wins to deem the Champion.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSeedWednesdayData}
                className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                title="Populate test sample data to verify leaderboard calculations"
              >
                + Add Demo Data
              </button>
              <span className="text-xs text-slate-400 font-bold">
                {sortedData.length} Players Registered
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans uppercase text-[10px] tracking-wider bg-slate-50/80">
                  <th className="py-3 px-3">Rank</th>
                  <th className="py-3 px-3">Player</th>
                  <th className="py-3 px-3 text-center bg-amber-100/50 text-amber-900 font-black">
                    🏆 Champion (Total Wins)
                  </th>
                  {/* 1001 Column Group */}
                  <th className="py-3 px-3 text-center bg-indigo-50/60 text-indigo-900">
                    1001 Stats (High / Fin / 80+ Total / Wins)
                  </th>
                  {/* 701 Column Group */}
                  <th className="py-3 px-3 text-center bg-blue-50/60 text-blue-900">
                    701 Stats (High In / High / Fin / 80+ Total / Wins)
                  </th>
                  {/* Baseball Column Group */}
                  <th
                    className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900"
                    title="Baseball: Each Individual's Highest Overall Score & Total Baseball Wins"
                  >
                    Baseball (High Score / Wins)
                  </th>
                  {/* 5s Column Group */}
                  <th className="py-3 px-3 text-center bg-purple-50/60 text-purple-900">
                    5s (High / Fin / Wins)
                  </th>
                  {/* Cricket Column Group */}
                  <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900 font-black" title="Cricket: Running total of games won (Each player on winning team gets a point for a win)">
                    Cricket (Games Won)
                  </th>
                  {/* Bulls Column Group */}
                  <th className="py-3 px-3 text-center bg-rose-50 text-rose-900">
                    Bulls Hit (🎯)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                      No Wednesday game stats recorded yet. Launch Wednesday Medleys or Baseball matches to start tracking!
                    </td>
                  </tr>
                ) : (
                  sortedData.map((entry, idx) => {
                    const wed = entry.wednesdayStats || {
                      playerId: entry.playerId,
                      playerName: entry.playerName,
                      avatar: entry.avatar,
                      game1001HighScore: 0,
                      game1001HighFinish: 0,
                      game1001Scores80Plus: 0,
                      game1001Wins: 0,
                      game701HighestBeginningScore: 0,
                      game701HighScore: 0,
                      game701HighFinish: 0,
                      game701Scores80Plus: 0,
                      game701Wins: 0,
                      baseballHighScore: 0,
                      baseballWins: 0,
                      fivesHighScore: 0,
                      fivesHighFinish: 0,
                      fivesWins: 0,
                      cricketWins: 0,
                      seasonBullsHit: entry.wednesdayBulls ?? entry.wednesdayStats?.seasonBullsHit ?? 0,
                      totalGameWins: entry.wednesdayWins || 0,
                      totalGamesPlayed: entry.wednesdayPlayed || 0,
                    };

                    const totalRunningWins =
                      wed.totalGameWins ||
                      wed.game1001Wins + wed.game701Wins + wed.baseballWins + wed.fivesWins + wed.cricketWins;

                    return (
                      <tr key={entry.playerId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Rank */}
                        <td className="py-3.5 px-3 font-bold font-sans">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-400 text-slate-950 shadow-sm border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                : idx === 2
                                ? 'bg-amber-900/10 text-amber-900 border border-amber-900/20'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Player */}
                        <td className="py-3.5 px-3 font-bold text-slate-900 font-sans text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{entry.avatar}</span>
                            <div>
                              <span className="block">{entry.playerName}</span>
                              {idx === 0 && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-amber-600 uppercase">
                                  <Crown className="w-3 h-3 fill-current" /> Season Champion
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Champion Metric: Total Running Game Wins */}
                        <td className="py-3.5 px-3 text-center bg-amber-50/60">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-amber-400 text-slate-950 rounded-xl font-black text-sm shadow-xs">
                            <Trophy className="w-3.5 h-3.5 fill-current" />
                            {totalRunningWins} Wins
                          </div>
                        </td>

                        {/* 1001 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-indigo-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="1001 High Score">
                              High: {wed.game1001HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-indigo-200 text-indigo-900 font-bold" title="1001 High Finish Checkout">
                              Fin: {wed.game1001HighFinish || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-indigo-100 rounded border border-indigo-200 text-indigo-950 font-black" title="1001 Running total of all scores 80 and above">
                              80+: {wed.game1001Scores80Plus}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-600 text-white rounded font-black text-xs" title="1001 Wins">
                              {wed.game1001Wins} W
                            </span>
                          </div>
                        </td>

                        {/* 701 Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-blue-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 bg-blue-100 rounded border border-blue-200 text-blue-950 font-black" title="701 High In (Double In Opening Turn)">
                              High In: {wed.game701HighestBeginningScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="701 High Score">
                              High: {wed.game701HighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-blue-200 text-blue-900 font-bold" title="701 High Finish Checkout">
                              Fin: {wed.game701HighFinish || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-blue-100 rounded border border-blue-200 text-blue-950 font-black" title="701 Running total of all scores 80 and above">
                              80+: {wed.game701Scores80Plus}
                            </span>
                            <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-black text-xs" title="701 Wins">
                              {wed.game701Wins} W
                            </span>
                          </div>
                        </td>

                        {/* Baseball Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-emerald-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px]">
                            <span
                              className="px-1.5 py-0.5 bg-white rounded border border-emerald-200 text-emerald-900 font-bold"
                              title="Each Individual's Highest Overall Baseball Score across 9 innings"
                            >
                              High: {wed.baseballHighScore || '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded font-black text-xs" title="Baseball Wins">
                              {wed.baseballWins} W
                            </span>
                          </div>
                        </td>

                        {/* 5s Breakdown */}
                        <td className="py-3.5 px-3 text-center bg-purple-50/30">
                          <div className="flex items-center justify-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 bg-white rounded border border-purple-200 text-purple-900 font-bold" title="5s Highest Score">
                              High: {wed.fivesHighScore || '-'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-white rounded border border-purple-200 text-purple-900 font-bold" title="5s High Finish">
                              Fin: {wed.fivesHighFinish || '-'}
                            </span>
                            <span className="px-2 py-0.5 bg-purple-600 text-white rounded font-black text-xs" title="5s Wins">
                              {wed.fivesWins} W
                            </span>
                          </div>
                        </td>

                        {/* Cricket Wins */}
                        <td className="py-3.5 px-3 text-center bg-slate-50/50">
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-700 text-white rounded-lg font-black text-xs shadow-xs" title="Cricket: Running total of games won (Each player on winning team gets 1 point per win)">
                            <Trophy className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                            <span>{wed.cricketWins} {wed.cricketWins === 1 ? 'Win' : 'Wins'}</span>
                          </span>
                        </td>

                        {/* Bulls Hit Total */}
                        <td className="py-3.5 px-3 text-center bg-rose-50/40">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-700 border border-rose-300 rounded-full font-black text-xs">
                            🎯 {wed.seasonBullsHit || entry.wednesdayBulls || 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* STANDARD ALL / TUESDAY / WEDNESDAY / THURSDAY STANDINGS TABLE */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              {selectedFormat === 'all' && 'All League Formats Combined Standings'}
              {selectedFormat === 'wednesday' && 'Wednesday League Individual Standings'}
              {selectedFormat === 'tuesday' && 'Tuesday Singles Individual Standings'}
              {selectedFormat === 'thursday' && 'Thursday Doubles Individual Standings'}
            </h3>

            <span className="text-xs text-slate-400 font-bold">
              Showing {sortedData.length} Players
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-sans uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3 text-center">Wins</th>
                  <th className="py-2.5 px-3 text-center">Win Rate</th>
                  {selectedFormat === 'all' && (
                    <th className="py-2.5 px-3 text-center">Wins Breakdown</th>
                  )}
                  <th className="py-2.5 px-3 text-right">Played</th>
                  <th className="py-2.5 px-3 text-right">Points</th>
                  {selectedFormat === 'wednesday' && (
                    <th className="py-2.5 px-3 text-center bg-emerald-50 text-emerald-900 font-black">Cricket Wins</th>
                  )}
                  <th className="py-2.5 px-3 text-center">Season Bulls</th>
                  <th className="py-2.5 px-3 text-right">3-Dart Avg</th>
                  <th className="py-2.5 px-3 text-right">High Out</th>
                  <th className="py-2.5 px-3 text-right text-emerald-700 font-bold">High In</th>
                  <th className="py-2.5 px-3 text-right">180s</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={selectedFormat === 'all' || selectedFormat === 'wednesday' ? 12 : 11} className="py-8 text-center text-slate-400 font-sans">
                      No leaderboard data matches your filters. Launch matches or generate brackets above!
                    </td>
                  </tr>
                ) : (
                  sortedData.map((s, idx) => {
                    const wins = getFormatWins(s);
                    const played = getFormatPlayed(s);
                    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

                    return (
                      <tr key={s.playerId} className="hover:bg-slate-50 transition-colors">
                        {/* Rank */}
                        <td className="py-3 px-3 font-bold font-sans">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                : idx === 2
                                ? 'bg-amber-900/10 text-amber-900 border border-amber-900/20'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Player Name */}
                        <td className="py-3 px-3 font-bold text-slate-900 font-sans text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{s.avatar}</span>
                            <span>{s.playerName}</span>
                          </div>
                        </td>

                        {/* Wins */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 font-black text-emerald-600 text-sm bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <Trophy className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                            {wins}
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                              winRate >= 70
                                ? 'bg-indigo-100 text-indigo-700'
                                : winRate >= 50
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {winRate}%
                          </span>
                        </td>

                        {/* Wins Breakdown (Only for combined view) */}
                        {selectedFormat === 'all' && (
                          <td className="py-3 px-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                                Tue: {s.tuesdayStats ? s.tuesdayStats.totalGameWins : s.tuesdayWins}
                              </span>
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                                Wed: {s.wednesdayStats ? s.wednesdayStats.totalGameWins : s.wednesdayWins}
                              </span>
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100">
                                Thu: {s.thursdayStats ? s.thursdayStats.totalGameWins : s.thursdayWins}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Played */}
                        <td className="py-3 px-3 text-right text-slate-600 font-bold">{played}</td>

                        {/* Points */}
                        <td className="py-3 px-3 text-right font-black text-indigo-600 text-sm">
                          {getFormatPoints(s)} pts
                        </td>

                        {/* Cricket Wins (Wednesday Standings View) */}
                        {selectedFormat === 'wednesday' && (
                          <td className="py-3 px-3 text-center bg-emerald-50/30">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded font-black text-xs">
                              <Trophy className="w-3 h-3 text-amber-300 fill-amber-300" />
                              {s.wednesdayStats ? s.wednesdayStats.cricketWins : 0} W
                            </span>
                          </td>
                        )}

                        {/* Season Bulls */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full border ${
                              getFormatBulls(s) > 0
                                ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          >
                            🎯 {getFormatBulls(s)}
                          </span>
                        </td>

                        {/* 3-Dart Avg */}
                        <td className="py-3 px-3 text-right text-slate-800 font-bold">
                          {getFormatAvg(s) > 0 ? getFormatAvg(s).toFixed(1) : '-'}
                        </td>

                        {/* High Out */}
                        <td className="py-3 px-3 text-right text-indigo-600 font-bold">
                          {getFormatHighOut(s) > 0 ? getFormatHighOut(s) : '-'}
                        </td>

                        {/* High In */}
                        <td className="py-3 px-3 text-right text-emerald-600 font-bold">
                          {getFormatHighIn(s) > 0 ? getFormatHighIn(s) : '-'}
                        </td>

                        {/* 180s */}
                        <td className="py-3 px-3 text-right text-slate-900 font-bold">
                          {getFormat180s(s)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* ADMIN OVERALL STATS EMAIL MODAL */}
      {isAdmin && (
        <AdminOverallStatsEmailModal
          isOpen={showEmailStatsModal}
          onClose={() => {
            setShowEmailStatsModal(false);
            setAutoEmailActive(getAutoEmailOverallStatsEnabled());
          }}
        />
      )}
    </div>
  );
};

