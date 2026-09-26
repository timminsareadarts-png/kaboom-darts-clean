import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Sparkles,
  Trophy,
  DollarSign,
  Users,
  Target,
  Lock,
  Unlock,
  Plus,
  Trash2,
  RotateCcw,
  History,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Dice5,
  Flame,
  Award,
  CircleDot,
  ArrowRight,
  ShieldCheck,
  Zap,
  X,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DrawType,
  DrawsState,
  DrawSpotEntry,
  DrawWheelSegment,
  DrawSessionRecord,
} from '../types';
import {
  DOOR_PRIZE_COST,
  LUCKY_NUMBER_COST,
  DOUBLE_DRAW_COST,
  LeagueKey,
  getDrawsState,
  saveDrawsState,
  setDrawsPublicViewable,
  fetchRemoteDrawsState,
  generateDistributedWheelSegments,
  addDrawSpot,
  addSpotToAllDraws,
  getDrawKey,
  removeDrawSpot,
  clearDrawSpots,
  completeDoorPrizeDraw,
  completeLuckyNumberDraw,
  completeDoubleDraw,
  getDrawsFinanceSummary,
  deleteDrawHistoryRecord,
  updateDrawBucketTotal,
  createDefaultLeagueDrawsData,
} from '../utils/drawsHelper';
import { MASTER_ROSTER_PLAYERS } from '../data/defaultPlayers';
import { WheelCanvas } from './WheelCanvas';
import { AVATAR_OPTIONS } from './PlayerProfiles';

interface DrawsManagerProps {
  initialLeague?: LeagueKey;
  onSelectLeague?: (league: LeagueKey) => void;
  onNavigateToFinances?: () => void;
  onNavigateToLeague?: () => void;
}

export const DrawsManager: React.FC<DrawsManagerProps> = ({
  initialLeague,
  onSelectLeague,
  onNavigateToFinances,
  onNavigateToLeague,
}) => {
  const { isAdmin, isPlayer, role } = useAuth();
  const [drawsState, setDrawsState] = useState<DrawsState>(getDrawsState);
  
  // Selected League state (Tuesday, Wednesday, Thursday)
  const [selectedLeague, setSelectedLeague] = useState<LeagueKey>(() => {
    if (initialLeague) return initialLeague;
    const st = getDrawsState();
    return st.selectedLeague || 'tuesday';
  });
  const selectedLeagueRef = useRef<LeagueKey>(selectedLeague);
  useEffect(() => {
    selectedLeagueRef.current = selectedLeague;
  }, [selectedLeague]);

  // Sync if initialLeague prop changes externally (e.g. from navbar or finance tab)
  useEffect(() => {
    if (initialLeague && initialLeague !== selectedLeague) {
      setSelectedLeague(initialLeague);
      selectedLeagueRef.current = initialLeague;
    }
  }, [initialLeague]);

  const [activeDrawType, setActiveDrawType] = useState<DrawType>('door_prize');
  const activeDrawTypeRef = useRef<DrawType>(activeDrawType);
  useEffect(() => {
    activeDrawTypeRef.current = activeDrawType;
  }, [activeDrawType]);

  // Wheel state
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const isSpinningRef = useRef<boolean>(isSpinning);
  useEffect(() => {
    isSpinningRef.current = isSpinning;
  }, [isSpinning]);
  const [selectedWinnerSegment, setSelectedWinnerSegment] = useState<DrawWheelSegment | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);

  // Lucky Number Target & Darts Flow State
  const [luckyTargetNumber, setLuckyTargetNumber] = useState<number | null>(null);
  const [isRollingTarget, setIsRollingTarget] = useState<boolean>(false);
  const [luckyDartHits, setLuckyDartHits] = useState<number>(0);

  // Double Draw Target & Flow State
  const [doubleTargetNumber, setDoubleTargetNumber] = useState<number | null>(null);
  const [isRollingDouble, setIsRollingDouble] = useState<boolean>(false);
  const [doubleHitSuccess, setDoubleHitSuccess] = useState<boolean>(false);

  // Add Spot Form State
  const [showAddSpotModal, setShowAddSpotModal] = useState<boolean>(false);
  const [applyToAllDraws, setApplyToAllDraws] = useState<boolean>(false);
  const [selectedClubPlayerId, setSelectedClubPlayerId] = useState<string>('');
  const [customPlayerName, setCustomPlayerName] = useState<string>('');
  const [playerAvatar, setPlayerAvatar] = useState<string>('🎯');
  const [spotsCountInput, setSpotsCountInput] = useState<number>(1);
  const [registeredRoster, setRegisteredRoster] = useState<any[]>([]);

  // Admin Delete History Record State
  const [deleteRecordTarget, setDeleteRecordTarget] = useState<DrawSessionRecord | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'current' | 'all'>('current');
  const [historyLeagueFilter, setHistoryLeagueFilter] = useState<'selected' | 'all'>('selected');

  // Admin Manual Bucket Adjustment State
  const [showBucketAdjustModal, setShowBucketAdjustModal] = useState<boolean>(false);
  const [bucketAdjustTarget, setBucketAdjustTarget] = useState<'lucky_number' | 'double_draw' | null>(null);
  const [bucketAdjustValue, setBucketAdjustValue] = useState<string>('0');

  // Toast Notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToastMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Switch league handler with reset
  const handleSelectLeague = (league: LeagueKey) => {
    if (isSpinningRef.current) return;
    setSelectedLeague(league);
    selectedLeagueRef.current = league;
    setIsSpinning(false);
    setSelectedWinnerSegment(null);
    setShowWinnerModal(false);
    setLuckyTargetNumber(null);
    setLuckyDartHits(0);
    setDoubleTargetNumber(null);
    setDoubleHitSuccess(false);

    // Save and sync league selection to storage and server API
    const updated = saveDrawsState(drawsState, league);
    setDrawsState(updated);
    if (onSelectLeague) {
      onSelectLeague(league);
    }
  };

  // Sync with cloud and local storage
  const reloadState = () => {
    setDrawsState(getDrawsState());
  };

  useEffect(() => {
    reloadState();

    // Load master roster for quick player selection (combining club players, default roster, and finance lists)
    try {
      const allPlayers: any[] = [];
      const seenIds = new Set<string>();

      // 1. Check master roster
      const saved = localStorage.getItem('kaboom_dart_players');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            const id = p.id || p.playerId;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              allPlayers.push({
                id,
                name: p.name || p.playerName || 'Player',
                avatar: p.avatar || '🎯',
              });
            }
          });
        }
      }

      // 2. Also check finance player lists to ensure all league players are available
      ['kaboom_finance_tuesday_players', 'kaboom_finance_wednesday_players', 'kaboom_finance_thursday_players'].forEach(key => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                const id = p.id || p.playerId;
                const name = p.name || p.playerName;
                if (id && name && !seenIds.has(id)) {
                  seenIds.add(id);
                  allPlayers.push({
                    id,
                    name,
                    avatar: p.avatar || '🎯',
                  });
                }
              });
            }
          }
        } catch (err) {}
      });

      // 3. Fallback to MASTER_ROSTER_PLAYERS if still empty
      if (allPlayers.length === 0) {
        MASTER_ROSTER_PLAYERS.forEach((p: any) => {
          allPlayers.push({
            id: p.id,
            name: p.name,
            avatar: p.avatar || '🎯',
          });
        });
      }

      // Sort alphabetically by name
      allPlayers.sort((a, b) => a.name.localeCompare(b.name));
      setRegisteredRoster(allPlayers);
    } catch (e) {
      console.error('Error loading roster in DrawsManager', e);
    }

    // Fetch remote state immediately on mount
    fetchRemoteDrawsState().then((remote) => {
      if (remote) setDrawsState(remote);
    });

    const handleSync = (e: any) => {
      if (!e?.detail?.key || e.detail.key === 'all' || e.detail.key === 'kaboom_draws_state') {
        reloadState();
      }
    };

    // Fast polling fallback to ensure spectator/player views see unrestricted draws instantly
    const pollInterval = setInterval(() => {
      if (isSpinningRef.current) return;
      fetchRemoteDrawsState().then((remote) => {
        if (remote) {
          setDrawsState((prev) => {
            if (remote.updatedAt && prev.updatedAt && remote.updatedAt === prev.updatedAt) {
              return prev;
            }
            return remote;
          });
        }
      });
    }, 2500);

    window.addEventListener('kaboom_cloud_sync_update', handleSync);
    window.addEventListener('storage', reloadState);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('kaboom_cloud_sync_update', handleSync);
      window.removeEventListener('storage', reloadState);
    };
  }, []);

  // Check if current user can view this tab (defaults to true/viewable unless explicitly set to false by admin)
  const isViewable = drawsState.isPublicViewable !== false || isAdmin;

  // Helper to get display name for league
  const getLeagueDisplayName = (league: LeagueKey) => {
    if (league === 'tuesday') return 'Tuesday League';
    if (league === 'wednesday') return 'Wednesday League';
    return 'Thursday League';
  };

  // Merged history for the current active draw type and selected league
  const currentDrawHistory = useMemo(() => {
    const key = getDrawKey(activeDrawType);
    const leagueData = drawsState.leagues?.[selectedLeague] || (selectedLeague === 'tuesday' ? drawsState : createDefaultLeagueDrawsData());
    const d1 = (leagueData as any)?.[key]?.history;
    const d2 = (leagueData as any)?.[activeDrawType]?.history;
    const seen = new Set<string>();
    const list: DrawSessionRecord[] = [];
    const addItems = (items: any) => {
      if (Array.isArray(items)) {
        items.forEach(r => {
          if (r && r.id && !seen.has(r.id)) {
            // Strictly exclude records belonging to another league
            if (r.leagueType && r.leagueType !== selectedLeague) return;
            seen.add(r.id);
            list.push({ ...r, leagueType: r.leagueType || selectedLeague });
          }
        });
      }
    };
    addItems(d1);
    addItems(d2);
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [drawsState, selectedLeague, activeDrawType]);

  // Active draw data - robust lookup via getDrawKey with history merged and league-partitioned
  const currentDrawData = useMemo(() => {
    const key = getDrawKey(activeDrawType);
    const leagueData = drawsState.leagues?.[selectedLeague] || (selectedLeague === 'tuesday' ? drawsState : createDefaultLeagueDrawsData());
    const d1 = (leagueData as any)?.[key] || {};
    const d2 = (leagueData as any)?.[activeDrawType] || {};
    const rawSpots = (Array.isArray(d1.spots) && d1.spots.length > 0)
      ? d1.spots
      : (Array.isArray(d2.spots) ? d2.spots : (d1.spots || []));
    const spots = (rawSpots || []).filter((s: any) => !s.leagueType || s.leagueType === selectedLeague);
    const bucketTotal = typeof d1.bucketTotal === 'number'
      ? d1.bucketTotal
      : (typeof d2.bucketTotal === 'number' ? d2.bucketTotal : 0);
    const runningTotalLeague = typeof d1.runningTotalLeague === 'number'
      ? d1.runningTotalLeague
      : (typeof d2.runningTotalLeague === 'number' ? d2.runningTotalLeague : 0);

    return {
      ...d1,
      ...d2,
      spots,
      bucketTotal,
      runningTotalLeague,
      history: currentDrawHistory,
    };
  }, [drawsState, selectedLeague, activeDrawType, currentDrawHistory]);

  const paidSpots = useMemo(() => {
    return (currentDrawData?.spots || []).filter(s => s.paid && s.spotsCount > 0);
  }, [currentDrawData]);

  const totalSpotsPurchased = useMemo(() => {
    return paidSpots.reduce((sum, s) => sum + s.spotsCount, 0);
  }, [paidSpots]);

  const currentCostPerSpot = activeDrawType === 'door_prize' ? DOOR_PRIZE_COST : activeDrawType === 'lucky_number' ? LUCKY_NUMBER_COST : DOUBLE_DRAW_COST;
  const currentTotalGross = totalSpotsPurchased * currentCostPerSpot;
  const currentLeagueShare50 = Math.round(currentTotalGross * 0.5 * 100) / 100;
  const currentDrawPrizePool50 = currentTotalGross - currentLeagueShare50;

  // Generate distributed wheel segments (each spot gives 3 entries spread around wheel not together)
  const wheelSegments = useMemo(() => {
    return generateDistributedWheelSegments(currentDrawData?.spots || []);
  }, [currentDrawData?.spots]);

  // Financial summary for currently selected league
  const financeSummary = useMemo(() => {
    return getDrawsFinanceSummary(selectedLeague);
  }, [drawsState, selectedLeague]);

  // Combined overall financial summary across all 3 leagues
  const overallFinanceSummary = useMemo(() => {
    return getDrawsFinanceSummary('all');
  }, [drawsState]);

  // Summaries per individual league for the League Switcher Tabs
  const tuesdaySummary = useMemo(() => getDrawsFinanceSummary('tuesday'), [drawsState]);
  const wednesdaySummary = useMemo(() => getDrawsFinanceSummary('wednesday'), [drawsState]);
  const thursdaySummary = useMemo(() => getDrawsFinanceSummary('thursday'), [drawsState]);

  // Displayed history (current draw, all draws for this league, or all leagues combined)
  const displayedHistory = useMemo(() => {
    const seen = new Set<string>();
    const all: DrawSessionRecord[] = [];
    const addHistory = (hist: any, leagueTag?: string) => {
      if (Array.isArray(hist)) {
        hist.forEach(r => {
          if (r && r.id && !seen.has(r.id)) {
            seen.add(r.id);
            all.push({ ...r, leagueType: r.leagueType || leagueTag || selectedLeague });
          }
        });
      }
    };

    if (historyLeagueFilter === 'all') {
      const leagues: LeagueKey[] = ['tuesday', 'wednesday', 'thursday'];
      leagues.forEach(l => {
        const lData = drawsState.leagues?.[l] || (l === 'tuesday' ? drawsState : null);
        if (lData) {
          if (historyFilter === 'all') {
            addHistory(lData.doorPrize?.history, l);
            addHistory((lData as any)['door_prize']?.history, l);
            addHistory(lData.luckyNumber?.history, l);
            addHistory((lData as any)['lucky_number']?.history, l);
            addHistory(lData.doubleDraw?.history, l);
            addHistory((lData as any)['double_draw']?.history, l);
          } else {
            const key = getDrawKey(activeDrawType);
            addHistory((lData as any)?.[key]?.history, l);
            addHistory((lData as any)?.[activeDrawType]?.history, l);
          }
        }
      });
      return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    if (historyFilter === 'all') {
      const lData = drawsState.leagues?.[selectedLeague] || (selectedLeague === 'tuesday' ? drawsState : createDefaultLeagueDrawsData());
      addHistory(lData.doorPrize?.history, selectedLeague);
      addHistory((lData as any)['door_prize']?.history, selectedLeague);
      addHistory(lData.luckyNumber?.history, selectedLeague);
      addHistory((lData as any)['lucky_number']?.history, selectedLeague);
      addHistory(lData.doubleDraw?.history, selectedLeague);
      addHistory((lData as any)['double_draw']?.history, selectedLeague);
      return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    return currentDrawHistory;
  }, [historyFilter, historyLeagueFilter, drawsState, selectedLeague, activeDrawType, currentDrawHistory]);

  // Admin delete completed history record
  const handleDeleteHistoryRecord = (record: DrawSessionRecord) => {
    if (!isAdmin) return;
    setDeleteRecordTarget(record);
  };

  const confirmDeleteHistoryRecord = () => {
    if (!isAdmin || !deleteRecordTarget) return;
    const recordLeague = (deleteRecordTarget.leagueType as LeagueKey) || selectedLeague;
    const res = deleteDrawHistoryRecord(deleteRecordTarget.id, deleteRecordTarget.drawType, recordLeague);
    if (res.success) {
      setDrawsState(res.state);
      const bucketMsg =
        res.bucketDeducted && res.bucketDeducted > 0
          ? ` and removed $${res.bucketDeducted.toFixed(2)} from the ${getDrawName(deleteRecordTarget.drawType)} bucket`
          : '';
      showToastMsg(
        `Deleted ${deleteRecordTarget.drawName || 'draw'} transaction for ${deleteRecordTarget.winnerPlayerName}. Deducted $${deleteRecordTarget.leagueShare.toFixed(2)} from league balances${bucketMsg}.`
      );
    } else {
      showToastMsg('Could not find or delete history transaction', 'error');
    }
    setDeleteRecordTarget(null);
  };

  // Admin Manual Bucket Adjustment
  const handleOpenBucketAdjust = (type: 'lucky_number' | 'double_draw') => {
    if (!isAdmin) return;
    setBucketAdjustTarget(type);
    const leagueData = drawsState.leagues?.[selectedLeague] || (selectedLeague === 'tuesday' ? drawsState : createDefaultLeagueDrawsData());
    const curr = type === 'lucky_number'
      ? (leagueData.luckyNumber?.bucketTotal ?? (leagueData as any).lucky_number?.bucketTotal ?? 0)
      : (leagueData.doubleDraw?.bucketTotal ?? (leagueData as any).double_draw?.bucketTotal ?? 0);
    setBucketAdjustValue(curr.toString());
    setShowBucketAdjustModal(true);
  };

  const handleSaveBucketAdjust = () => {
    if (!isAdmin || !bucketAdjustTarget) return;
    const val = parseFloat(bucketAdjustValue);
    if (isNaN(val) || val < 0) {
      showToastMsg('Please enter a valid non-negative pot amount', 'error');
      return;
    }
    const updated = updateDrawBucketTotal(bucketAdjustTarget, val, selectedLeague);
    setDrawsState(updated);
    showToastMsg(`Updated ${getDrawName(bucketAdjustTarget)} rollover bucket for ${getLeagueDisplayName(selectedLeague)} to $${val.toFixed(2)}`);
    setShowBucketAdjustModal(false);
    setBucketAdjustTarget(null);
  };

  // Handle Admin viewability toggle switch
  const handleToggleViewability = (enabled: boolean) => {
    if (!isAdmin) return;
    const updated = setDrawsPublicViewable(enabled);
    setDrawsState(updated);
    showToastMsg(
      enabled
        ? '🔓 Draws tab is now VISIBLE to all players and spectators!'
        : '🔒 Draws tab is now RESTRICTED to administrators only.'
    );
  };

  // Add Spot Submit
  const handleAddSpotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    let nameToUse = '';
    let avatarToUse = playerAvatar;
    let pId: string | undefined = undefined;

    if (selectedClubPlayerId) {
      const p = registeredRoster.find(r => r.id === selectedClubPlayerId || (r as any).playerId === selectedClubPlayerId);
      if (p) {
        nameToUse = p.name || (p as any).playerName || '';
        avatarToUse = p.avatar || '🎯';
        pId = p.id || (p as any).playerId;
      }
    }
    
    if (!nameToUse && customPlayerName.trim()) {
      nameToUse = customPlayerName.trim();
    }

    if (!nameToUse) {
      showToastMsg('Please select a player or enter a name', 'error');
      return;
    }

    const count = Math.max(1, spotsCountInput);
    let updated: DrawsState;

    if (applyToAllDraws) {
      updated = addSpotToAllDraws(nameToUse, count, pId, avatarToUse, true, selectedLeague);
      showToastMsg(`⭐ Added ${count} spot(s) for ${nameToUse} to ALL 3 DRAWS in ${getLeagueDisplayName(selectedLeague)} ($${(count * 10).toFixed(2)} total, ${count * 3} slices each)!`);
    } else {
      updated = addDrawSpot(activeDrawType, nameToUse, count, pId, avatarToUse, true, selectedLeague);
      showToastMsg(`Added ${count} spot(s) for ${nameToUse} to ${getDrawName(activeDrawType)} in ${getLeagueDisplayName(selectedLeague)} (${count * 3} entries on wheel)!`);
    }

    setDrawsState(updated);
    setShowAddSpotModal(false);
    setSelectedClubPlayerId('');
    setCustomPlayerName('');
    setSpotsCountInput(1);
    setApplyToAllDraws(false);
  };

  // Remove spot
  const handleRemoveSpot = (spotId: string, name: string) => {
    if (!isAdmin) return;
    const updated = removeDrawSpot(activeDrawType, spotId, selectedLeague);
    setDrawsState(updated);
    showToastMsg(`Removed spot for ${name} from ${getLeagueDisplayName(selectedLeague)}`);
  };

  // Clear all spots in current draw
  const handleClearAllSpots = () => {
    if (!isAdmin) return;
    if (window.confirm(`Clear all current spots for ${getDrawName(activeDrawType)} in ${getLeagueDisplayName(selectedLeague)}?`)) {
      const updated = clearDrawSpots(activeDrawType, selectedLeague);
      setDrawsState(updated);
      setSelectedWinnerSegment(null);
      showToastMsg(`Cleared all spots for ${getDrawName(activeDrawType)} in ${getLeagueDisplayName(selectedLeague)}.`);
    }
  };

  // Trigger wheel spin
  const handleStartSpin = () => {
    if (!isAdmin) return;
    if (wheelSegments.length === 0) {
      showToastMsg('Please add players with paid spots before spinning!', 'error');
      return;
    }
    setSelectedWinnerSegment(null);
    setIsSpinning(true);
  };

  // Handle spin finish callback from WheelCanvas
  const handleWheelStopped = useCallback((winner: DrawWheelSegment) => {
    setIsSpinning(false);
    setSelectedWinnerSegment(winner);
    setShowWinnerModal(true);

    // If Lucky Number draw, reset target and hits
    if (activeDrawTypeRef.current === 'lucky_number') {
      setLuckyTargetNumber(null);
      setLuckyDartHits(0);
    }
    // If Double Draw, reset target and success
    if (activeDrawTypeRef.current === 'double_draw') {
      setDoubleTargetNumber(null);
      setDoubleHitSuccess(false);
    }
  }, []);

  // Random number picker for Lucky Number (1 to 21, where 21 = Bullseye)
  const rollLuckyTargetNumber = () => {
    setIsRollingTarget(true);
    let counter = 0;
    const interval = setInterval(() => {
      setLuckyTargetNumber(Math.floor(Math.random() * 21) + 1);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        const finalNum = Math.floor(Math.random() * 21) + 1;
        setLuckyTargetNumber(finalNum);
        setIsRollingTarget(false);
      }
    }, 70);
  };

  // Random number picker for Double Draw (1 to 20, or 21 = D-Bull)
  const rollDoubleTargetNumber = () => {
    setIsRollingDouble(true);
    let counter = 0;
    const interval = setInterval(() => {
      setDoubleTargetNumber(Math.floor(Math.random() * 21) + 1);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        const finalNum = Math.floor(Math.random() * 21) + 1;
        setDoubleTargetNumber(finalNum);
        setIsRollingDouble(false);
      }
    }, 70);
  };

  // Complete Door Prize
  const handleConfirmDoorPrizeWin = () => {
    if (!isAdmin || !selectedWinnerSegment) return;
    const res = completeDoorPrizeDraw(
      selectedWinnerSegment.playerName,
      selectedWinnerSegment.avatar,
      selectedWinnerSegment.playerId,
      selectedLeague
    );
    setDrawsState(res.state);
    setShowWinnerModal(false);
    setSelectedWinnerSegment(null);
    showToastMsg(`🎉 Door Prize Awarded! $${res.record.playerPrizePaid.toFixed(2)} to ${res.record.winnerPlayerName}. $${res.record.leagueShare.toFixed(2)} deposited to ${getLeagueDisplayName(selectedLeague)} treasury.`);
  };

  // Complete Lucky Number
  const handleConfirmLuckyNumberWin = () => {
    if (!isAdmin || !selectedWinnerSegment) return;
    if (luckyTargetNumber === null) {
      showToastMsg('Please pick a target number first!', 'error');
      return;
    }

    const res = completeLuckyNumberDraw(
      selectedWinnerSegment.playerName,
      selectedWinnerSegment.avatar,
      luckyTargetNumber,
      luckyDartHits,
      selectedWinnerSegment.playerId,
      selectedLeague
    );

    setDrawsState(res.state);
    setShowWinnerModal(false);
    setSelectedWinnerSegment(null);
    setLuckyTargetNumber(null);
    setLuckyDartHits(0);

    showToastMsg(
      res.record.playerPrizePaid > 0
        ? `🎯 Lucky Number Winner! ${res.record.winnerPlayerName} hit ${res.record.dartHits}/3 darts and won $${res.record.playerPrizePaid.toFixed(2)}! $${res.record.leagueShare.toFixed(2)} added to ${getLeagueDisplayName(selectedLeague)} finances.`
        : `0 hits on Target ${luckyTargetNumber}. $${res.record.bucketRemainingRollover?.toFixed(2)} rolls over in the ${getLeagueDisplayName(selectedLeague)} bucket! $${res.record.leagueShare.toFixed(2)} added to finances.`
    );
  };

  // Complete Double Draw
  const handleConfirmDoubleDrawWin = () => {
    if (!isAdmin || !selectedWinnerSegment) return;
    if (doubleTargetNumber === null) {
      showToastMsg('Please pick a target double first!', 'error');
      return;
    }

    const res = completeDoubleDraw(
      selectedWinnerSegment.playerName,
      selectedWinnerSegment.avatar,
      doubleTargetNumber,
      doubleHitSuccess,
      selectedWinnerSegment.playerId,
      selectedLeague
    );

    setDrawsState(res.state);
    setShowWinnerModal(false);
    setSelectedWinnerSegment(null);
    setDoubleTargetNumber(null);
    setDoubleHitSuccess(false);

    showToastMsg(
      doubleHitSuccess
        ? `🔥 FULL BUCKET JACKPOT WON! ${res.record.winnerPlayerName} hit the Double and won $${res.record.playerPrizePaid.toFixed(2)}! $${res.record.leagueShare.toFixed(2)} added to ${getLeagueDisplayName(selectedLeague)} finances.`
        : `Double missed. Bucket of $${res.record.bucketRemainingRollover?.toFixed(2)} rolls over to next session for ${getLeagueDisplayName(selectedLeague)}! $${res.record.leagueShare.toFixed(2)} added to finances.`
    );
  };

  function getDrawName(type: DrawType) {
    if (type === 'door_prize') return 'Door Prize';
    if (type === 'lucky_number') return 'Lucky Number';
    return 'Mystery Double';
  }

  // RESTRICTED ACCESS SCREEN (When admin has toggled visibility off and user is non-admin)
  if (!isViewable) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-3xl shadow-lg">
          <Lock className="w-10 h-10 text-amber-500" />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider rounded-full border border-amber-500/40">
            Admin Controlled Draw Access
          </span>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">
            Draws Currently Restricted
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            The league director has restricted the Draws tab to administrators. When the director opens the draws for viewing, you will be able to watch the wheel spin and view live prize buckets.
          </p>
        </div>

        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={async () => {
              const remote = await fetchRemoteDrawsState();
              if (remote) {
                setDrawsState(remote);
                if (remote.isPublicViewable !== false) {
                  showToastMsg('🔓 Draws are now open for viewing! Enjoy the show.');
                } else {
                  showToastMsg('Draws are currently restricted to Admin.', 'error');
                }
              }
            }}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-amber-500/30 shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Check Status Now
          </button>
          {onNavigateToLeague && (
            <button
              onClick={onNavigateToLeague}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
            >
              Return to League Hub
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50 shadow-emerald-950/50'
              : 'bg-red-950 text-red-200 border-red-500/50 shadow-red-950/50'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* TOP PRIMARY LEAGUE SWITCHER BAR (HIGH VISIBILITY) */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-3.5 sm:p-5 shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" /> Select League Draw:
            </span>
            <span className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Each League Runs Its Own 3 Draws & Isolated Treasury
            </span>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>All Leagues Combined 50% Treasury:</span>
            <span className="font-mono font-black text-emerald-400 text-sm">
              ${overallFinanceSummary.totalDrawsLeagueShare.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 3 Prominent League Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          {(['tuesday', 'wednesday', 'thursday'] as LeagueKey[]).map((leagueKey) => {
            const isSelected = selectedLeague === leagueKey;
            const lSummary = leagueKey === 'tuesday' ? tuesdaySummary : leagueKey === 'wednesday' ? wednesdaySummary : thursdaySummary;
            const lData = drawsState.leagues?.[leagueKey] || (leagueKey === 'tuesday' ? drawsState : null);
            const lSpotsCount = ((lData?.doorPrize?.spots?.length || 0) + (lData?.luckyNumber?.spots?.length || 0) + (lData?.doubleDraw?.spots?.length || 0));
            const icon = leagueKey === 'tuesday' ? '🎯' : leagueKey === 'wednesday' ? '👥' : '🏆';
            const leagueLabel = leagueKey === 'tuesday' ? 'Tuesday Singles' : leagueKey === 'wednesday' ? 'Wednesday League' : 'Thursday Doubles';

            return (
              <button
                key={leagueKey}
                type="button"
                id={`switch-league-${leagueKey}-draw`}
                onClick={() => handleSelectLeague(leagueKey)}
                className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all text-left cursor-pointer flex flex-col justify-between relative group ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-amber-400 shadow-xl shadow-amber-950/40 ring-2 ring-amber-400/40'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-600 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl leading-none">{icon}</span>
                    <div>
                      <span className={`text-sm sm:text-base font-black uppercase tracking-wide block ${isSelected ? 'text-amber-300' : 'text-slate-200 group-hover:text-white'}`}>
                        {leagueLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Door, Lucky, Mystery Draws
                      </span>
                    </div>
                  </div>
                  {isSelected ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 shadow-md border border-amber-300 shrink-0">
                      ✓ Active Draw
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-400 group-hover:text-amber-300 group-hover:bg-slate-700 transition-colors shrink-0">
                      Switch Here →
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">50% Treasury:</span>
                    <span className="text-sm font-mono font-black text-emerald-400">
                      ${lSummary.totalDrawsLeagueShare.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pots Total:</span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      ${(lSummary.doorPrizeActivePrizePool + lSummary.luckyBucketCurrent + lSummary.doubleBucketCurrent).toFixed(2)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Admin Visibility Controller Banner */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
              drawsState.isPublicViewable
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}>
              {drawsState.isPublicViewable ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Spectator & Player Access Switch
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  drawsState.isPublicViewable
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {drawsState.isPublicViewable ? 'Viewable to All' : 'Restricted to Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                {drawsState.isPublicViewable
                  ? 'Players and spectators can see the Draws tab and watch live spinning wheels.'
                  : 'Draws tab is hidden from players and spectators. Only admins can view.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => handleToggleViewability(!drawsState.isPublicViewable)}
              className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow cursor-pointer ${
                drawsState.isPublicViewable
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {drawsState.isPublicViewable ? (
                <>
                  <Lock className="w-4 h-4" /> Restrict View
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" /> Allow Viewers
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Non-Admin View-Only Banner */}
      {!isAdmin && (
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 shadow-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-base shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <span>Draws Live Viewer</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                  View-Only Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Viewing live progressive prize pools, purchased player spots, and wheel spins for <strong>{getLeagueDisplayName(selectedLeague)}</strong>. Spot management and wheel spinning are controlled exclusively by the Administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" /> Random Wheel Draws & Jackpots
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-indigo-200 text-xs font-black uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Active: {getLeagueDisplayName(selectedLeague)}
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
            {getLeagueDisplayName(selectedLeague)} Draws & Progressive Buckets
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mt-0.5">
            Individual draws for <strong>{getLeagueDisplayName(selectedLeague)}</strong>. Spin the wheel for Door Prize ($2), Lucky Number ($3), and Mystery Double ($5). Each draw impacts this league individually.
          </p>
        </div>

        {/* Finance Running Total Link */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-3 px-4 flex items-center gap-3 shadow-md">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  {getLeagueDisplayName(selectedLeague)} Treasury (50%)
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                ${financeSummary.totalDrawsLeagueShare.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block">
                All 3 Leagues Combined: ${overallFinanceSummary.totalDrawsLeagueShare.toFixed(2)}
              </span>
            </div>
            {onNavigateToFinances && (
              <button
                type="button"
                onClick={onNavigateToFinances}
                title="View in Finances Tab"
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow cursor-pointer text-xs flex items-center gap-1 font-bold"
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Finances</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grand Running Totals Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Door Prize Summary */}
        <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeDrawType === 'door_prize'
            ? 'bg-slate-900 border-red-500/60 shadow-lg shadow-red-950/30 ring-1 ring-red-500/40'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}
        onClick={() => setActiveDrawType('door_prize')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 1. Door Prize
            </span>
            <span className="text-xs font-mono font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
              $2.00 / Spot
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-white font-mono flex items-baseline gap-2">
            <span>${financeSummary.doorPrizeActivePrizePool.toFixed(2)}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-normal">Prize Pool</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            50% to winning player • 50% (${financeSummary.doorPrizeLeagueShare.toFixed(2)}) to league treasury.
          </p>
        </div>

        {/* Lucky Number Summary */}
        <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeDrawType === 'lucky_number'
            ? 'bg-slate-900 border-amber-500/60 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/40'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}
        onClick={() => setActiveDrawType('lucky_number')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Dice5 className="w-3.5 h-3.5" /> 2. Lucky Number
            </span>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              $3.00 / Spot
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-amber-300 font-mono flex items-baseline gap-2">
            <span>${financeSummary.luckyBucketCurrent.toFixed(2)}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-normal">Bucket</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Target 1-21 (21 = Bull). 1 hit = 33%, 2 hits = 66%, 3 hits = 100%.
          </p>
        </div>

        {/* Mystery Double Summary */}
        <div className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeDrawType === 'double_draw'
            ? 'bg-slate-900 border-indigo-500/60 shadow-lg shadow-indigo-950/30 ring-1 ring-indigo-500/40'
            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
        }`}
        onClick={() => setActiveDrawType('double_draw')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> 3. Mystery Double
            </span>
            <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
              $5.00 / Spot
            </span>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo-300 font-mono flex items-baseline gap-2">
            <span>${financeSummary.doubleBucketCurrent.toFixed(2)}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-normal">Bucket</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Hit the mystery number's Double to win the 100% full bucket!
          </p>
        </div>
      </div>

      {/* Main Draw Switcher Tabs */}
      <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 font-bold text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => {
            setActiveDrawType('door_prize');
            setIsSpinning(false);
            setSelectedWinnerSegment(null);
            setShowWinnerModal(false);
          }}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeDrawType === 'door_prize'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-red-300" />
          <span>Door Prize ($2)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveDrawType('lucky_number');
            setIsSpinning(false);
            setSelectedWinnerSegment(null);
            setShowWinnerModal(false);
          }}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeDrawType === 'lucky_number'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Dice5 className="w-4 h-4 text-amber-300" />
          <span>Lucky Number ($3)</span>
          <span className="hidden xs:inline text-[10px] px-1.5 py-0.5 rounded bg-amber-800/80 text-amber-100 font-mono">
            ${financeSummary.luckyBucketCurrent.toFixed(0)} Bucket
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveDrawType('double_draw');
            setIsSpinning(false);
            setSelectedWinnerSegment(null);
            setShowWinnerModal(false);
          }}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeDrawType === 'double_draw'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 text-indigo-300" />
          <span>Mystery Double ($5)</span>
          <span className="hidden xs:inline text-[10px] px-1.5 py-0.5 rounded bg-indigo-800/80 text-indigo-100 font-mono">
            ${financeSummary.doubleBucketCurrent.toFixed(0)} Bucket
          </span>
        </button>
      </div>

      {/* Active Draw Workspace: Wheel on Left, Controls & Roster on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Spinning Wheel (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
          {/* Wheel Header Info */}
          <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>{getDrawName(activeDrawType)}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                  ${currentCostPerSpot.toFixed(2)} / Spot
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Each spot includes player's name 3 times spread around the wheel.
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Slices
              </span>
              <span className="text-sm font-black text-amber-400 font-mono">
                {wheelSegments.length} Segments ({totalSpotsPurchased} Spots)
              </span>
            </div>
          </div>

          {/* Canvas Wheel Spinner */}
          <WheelCanvas
            segments={wheelSegments}
            isSpinning={isSpinning}
            setIsSpinning={setIsSpinning}
            onSpinEnd={handleWheelStopped}
            winnerSegmentId={selectedWinnerSegment?.id}
            size={420}
          />

          {/* Spin Trigger Button */}
          <div className="mt-6 w-full max-w-sm flex flex-col gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={handleStartSpin}
                disabled={isSpinning || wheelSegments.length === 0}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-red-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-base uppercase tracking-wider shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>{isSpinning ? 'Wheel Spinning...' : 'Spin The Wheel!'}</span>
              </button>
            ) : (
              <div className="text-center p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                👁️ Spectator View: The administrator will spin the wheel for this draw!
              </div>
            )}

            {wheelSegments.length === 0 && (
              <p className="text-center text-xs text-amber-400/90 font-medium">
                Add paid spots on the right to place player names on the wheel!
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Pots, Spots Roster & Actions (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Pot Breakdown Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Current Session Pool
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                {totalSpotsPurchased} Spots Sold
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Gross Brought In
                </span>
                <span className="text-xl font-black text-white font-mono">
                  ${currentTotalGross.toFixed(2)}
                </span>
              </div>
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                  League Share (50%)
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  ${currentLeagueShare50.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Special info for Progressive Buckets */}
            {activeDrawType === 'door_prize' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200">
                <div className="flex items-center justify-between font-bold">
                  <span>Player Door Prize (50%):</span>
                  <span className="text-base font-black font-mono text-red-300">${currentDrawPrizePool50.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-red-300/80 mt-1">
                  The winner of the wheel spin wins 100% of the player prize pool ($ {currentDrawPrizePool50.toFixed(2)}).
                </p>
              </div>
            )}

            {activeDrawType === 'lucky_number' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <span>Current Bucket (with Rollover):</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenBucketAdjust('lucky_number')}
                        className="text-[10px] text-amber-400 hover:text-amber-200 underline font-medium cursor-pointer"
                        title="Manually adjust or reset bucket rollover amount (Admin Only)"
                      >
                        Adjust Pot
                      </button>
                    )}
                  </div>
                  <span className="text-base font-black font-mono text-amber-300">
                    ${((currentDrawData.bucketTotal || 0) + currentDrawPrizePool50).toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold pt-1 border-t border-amber-500/20">
                  <div className="bg-amber-950/40 p-1.5 rounded">
                    <span>1 Hit (33%)</span>
                    <span className="block text-amber-300 font-mono">
                      ${Math.round(((currentDrawData.bucketTotal || 0) + currentDrawPrizePool50) * 0.33).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-amber-950/40 p-1.5 rounded">
                    <span>2 Hits (66%)</span>
                    <span className="block text-amber-300 font-mono">
                      ${Math.round(((currentDrawData.bucketTotal || 0) + currentDrawPrizePool50) * 0.66).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-amber-950/40 p-1.5 rounded text-amber-400">
                    <span>3 Hits (100%)</span>
                    <span className="block font-mono">
                      ${((currentDrawData.bucketTotal || 0) + currentDrawPrizePool50).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeDrawType === 'double_draw' && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-200">
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-2">
                    <span>Mystery Double Bucket:</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleOpenBucketAdjust('double_draw')}
                        className="text-[10px] text-indigo-400 hover:text-indigo-200 underline font-medium cursor-pointer"
                        title="Manually adjust or reset bucket rollover amount (Admin Only)"
                      >
                        Adjust Pot
                      </button>
                    )}
                  </div>
                  <span className="text-base font-black font-mono text-indigo-300">
                    ${((currentDrawData.bucketTotal || 0) + currentDrawPrizePool50).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-300/80 mt-1">
                  Player must hit the mystery number's DOUBLE segment to win the full 100% bucket! If missed, pot rolls over.
                </p>
              </div>
            )}
          </div>

          {/* Paid Spots Roster Management */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <span>Spots Roster</span>
                  <span className="text-xs font-mono text-slate-400">({paidSpots.length} Players)</span>
                </h3>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  {paidSpots.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSpots}
                      className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setApplyToAllDraws(true);
                      setShowAddSpotModal(true);
                    }}
                    className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1 cursor-pointer"
                    title="Add spots into all 3 draws (Door Prize, Lucky Number, Mystery Double) simultaneously ($10 total)"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>All 3 Draws ($10)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setApplyToAllDraws(false);
                      setShowAddSpotModal(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Spot</span>
                  </button>
                </div>
              )}
            </div>

            {/* List of Spots */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {paidSpots.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  No spots entered for this draw yet.
                  {isAdmin && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowAddSpotModal(true)}
                        className="text-indigo-400 hover:underline font-bold"
                      >
                        + Add first spot ($ {currentCostPerSpot.toFixed(2)})
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                paidSpots.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{entry.avatar || '🎯'}</span>
                      <div className="truncate">
                        <span className="font-bold text-slate-200 block truncate">
                          {entry.playerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {entry.spotsCount} spot{entry.spotsCount > 1 ? 's' : ''} • {entry.spotsCount * 3} slices on wheel
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-emerald-400">
                        ${(entry.spotsCount * currentCostPerSpot).toFixed(2)}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSpot(entry.id, entry.playerName)}
                          title="Remove spot"
                          className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History of Past Completed Draws */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Completed {historyLeagueFilter === 'all' ? 'All Leagues' : getLeagueDisplayName(selectedLeague)} {historyFilter === 'all' ? 'All Draws' : getDrawName(activeDrawType)} History
            </h3>
            <span className="text-xs font-mono text-slate-400">
              ({displayedHistory.length} Records)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter between current league history and all leagues history */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              <span className="text-[10px] text-slate-500 uppercase px-1.5 hidden sm:inline">League:</span>
              <button
                type="button"
                onClick={() => setHistoryLeagueFilter('selected')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyLeagueFilter === 'selected'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {getLeagueDisplayName(selectedLeague)}
              </button>
              <button
                type="button"
                onClick={() => setHistoryLeagueFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyLeagueFilter === 'all'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Leagues
              </button>
            </div>

            {/* Filter between current tab history and all draws history */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              <span className="text-[10px] text-slate-500 uppercase px-1.5 hidden sm:inline">Draw:</span>
              <button
                type="button"
                onClick={() => setHistoryFilter('current')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilter === 'current'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {getDrawName(activeDrawType)}
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  historyFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Draws
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {displayedHistory.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500">
              No previous draws recorded yet for {historyLeagueFilter === 'all' ? 'any league' : getLeagueDisplayName(selectedLeague)} ({historyFilter === 'all' ? 'any draw' : getDrawName(activeDrawType)}).
            </p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  {historyLeagueFilter === 'all' && (
                    <th className="py-2.5 px-3 text-sky-400">League</th>
                  )}
                  {historyFilter === 'all' && (
                    <th className="py-2.5 px-3 text-amber-400">Draw Type</th>
                  )}
                  <th className="py-2.5 px-3">Winner</th>
                  <th className="py-2.5 px-3">Spots Sold</th>
                  <th className="py-2.5 px-3">Gross Pool</th>
                  <th className="py-2.5 px-3 text-emerald-400">League Deposit (50%)</th>
                  <th className="py-2.5 px-3 text-amber-300">Player Prize</th>
                  <th className="py-2.5 px-3">Details / Rollover</th>
                  {isAdmin && (
                    <th className="py-2.5 px-3 text-right text-rose-400">Admin Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {displayedHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">{h.dateStr}</td>
                    {historyLeagueFilter === 'all' && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {getLeagueDisplayName(h.leagueType || selectedLeague)}
                        </span>
                      </td>
                    )}
                    {historyFilter === 'all' && (
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            h.drawType === 'door_prize'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : h.drawType === 'lucky_number'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {h.drawName || getDrawName(h.drawType)}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                      <span className="mr-1">{h.winnerAvatar || '🎯'}</span>
                      {h.winnerPlayerName}
                    </td>
                    <td className="py-3 px-3 font-mono">{h.spotsSold}</td>
                    <td className="py-3 px-3 font-mono text-slate-300">${(Number(h.totalBroughtIn) || 0).toFixed(2)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400">+${(Number(h.leagueShare) || 0).toFixed(2)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-300">${(Number(h.playerPrizePaid) || 0).toFixed(2)}</td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      {h.note || (h.drawType === 'door_prize' ? 'Door Prize Winner' : '')}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryRecord(h)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm font-bold text-[11px]"
                          title={`Delete completed ${h.drawName || 'draw'} transaction and reverse affected balances (Admin Only)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: Admin Delete Completed Draw History Confirmation */}
      {deleteRecordTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Delete Completed Draw Transaction</h4>
                <p className="text-xs text-rose-300 font-medium">Administrator Access Only • Error Correction</p>
              </div>
            </div>

            <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800/80 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Draw Event:</span>
                <span className="font-bold text-white">
                  {deleteRecordTarget.drawName || getDrawName(deleteRecordTarget.drawType)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recorded Date:</span>
                <span className="font-mono text-slate-300">{deleteRecordTarget.dateStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Winner:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <span>{deleteRecordTarget.winnerAvatar || '🎯'}</span>
                  <span>{deleteRecordTarget.winnerPlayerName}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spots Sold (Gross Pool):</span>
                <span className="font-mono text-slate-300">
                  {deleteRecordTarget.spotsSold} spots (${(Number(deleteRecordTarget.totalBroughtIn) || 0).toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-2 text-rose-300 font-bold">
                <span>League Share to Revert (Deduct):</span>
                <span className="font-mono">-${(Number(deleteRecordTarget.leagueShare) || 0).toFixed(2)}</span>
              </div>
              {deleteRecordTarget.drawType !== 'door_prize' && (
                <div className="flex justify-between text-indigo-300 font-bold">
                  <span>Amount Added to Bucket (to Remove):</span>
                  <span className="font-mono">
                    -${(
                      typeof deleteRecordTarget.addedToBucket === 'number'
                        ? deleteRecordTarget.addedToBucket
                        : Math.max(0, Math.round(((Number(deleteRecordTarget.totalBroughtIn) || 0) - (Number(deleteRecordTarget.leagueShare) || 0)) * 100) / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-amber-300">
                <span>Player Prize Recorded:</span>
                <span className="font-mono font-bold">${(Number(deleteRecordTarget.playerPrizePaid) || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200/90 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> In case of an erroneous entry, confirming deletion will permanently remove this transaction from the history records, deduct <strong>${(Number(deleteRecordTarget.leagueShare) || 0).toFixed(2)}</strong> from league balances{deleteRecordTarget.drawType !== 'door_prize' ? <>, and remove <strong>${(typeof deleteRecordTarget.addedToBucket === 'number' ? deleteRecordTarget.addedToBucket : Math.max(0, Math.round(((Number(deleteRecordTarget.totalBroughtIn) || 0) - (Number(deleteRecordTarget.leagueShare) || 0)) * 100) / 100)).toFixed(2)}</strong> from the progressive prize bucket</> : null}.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteRecordTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteHistoryRecord}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete &amp; Deduct Balances</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Admin Manual Bucket / Pot Adjustment */}
      {showBucketAdjustModal && bucketAdjustTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <span>Adjust {getDrawName(bucketAdjustTarget)} Bucket</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {getLeagueDisplayName(selectedLeague)}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 font-medium">Administrator Tool • Isolated League Rollover Pot Calibration</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBucketAdjustModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                Calibrating pot exclusively for <strong>{getLeagueDisplayName(selectedLeague)}</strong>. All other leagues maintain their own isolated balances.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Rollover Bucket Total ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={bucketAdjustValue}
                    onChange={(e) => setBucketAdjustValue(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBucketAdjustValue('0')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset to $0.00
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBucketAdjustModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBucketAdjust}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Save Bucket Amount</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Player Spots */}
      {showAddSpotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>
                  {applyToAllDraws ? 'Buy Spots: ALL 3 DRAWS' : `Buy Spots: ${getDrawName(activeDrawType)}`}
                </span>
              </h3>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                applyToAllDraws
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}>
                {applyToAllDraws ? '$10.00 / All 3' : `$${currentCostPerSpot.toFixed(2)} / Spot`}
              </span>
            </div>

            <form onSubmit={handleAddSpotSubmit} className="space-y-4">
              {/* Option to Add to ALL 3 Draws */}
              <div className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                applyToAllDraws
                  ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-indigo-500/15 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllDraws}
                    onChange={(e) => setApplyToAllDraws(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Apply Spot to ALL 3 Draws ($10.00 Total)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Simultaneously enters this player into Door Prize ($2), Lucky Number ($3), and Mystery Double ($5).
                    </p>
                  </div>
                </label>
              </div>

              {/* Select from Club Roster */}
              {registeredRoster.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Select From League Roster ({registeredRoster.length} Players)
                  </label>
                  <select
                    value={selectedClubPlayerId}
                    onChange={(e) => {
                      setSelectedClubPlayerId(e.target.value);
                      if (e.target.value) setCustomPlayerName('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Choose registered player (or enter guest below) --</option>
                    {registeredRoster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.avatar || '🎯'} {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Or Custom Guest Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Or Guest / Custom Player Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={customPlayerName}
                  onChange={(e) => {
                    setCustomPlayerName(e.target.value);
                    if (e.target.value) setSelectedClubPlayerId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Number of spots */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Number of Spots to Purchase
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={spotsCountInput}
                    onChange={(e) => setSpotsCountInput(parseInt(e.target.value) || 1)}
                    className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 5].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSpotsCountInput(amt)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                          spotsCountInput === amt
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Spot Math Calculation Box */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-1.5 text-xs">
                {applyToAllDraws ? (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>Door Prize ($2.00 × {spotsCountInput}):</span>
                      <span className="font-bold text-slate-200 font-mono">${(spotsCountInput * 2).toFixed(2)} ({spotsCountInput * 3} slices)</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Lucky Number ($3.00 × {spotsCountInput}):</span>
                      <span className="font-bold text-slate-200 font-mono">${(spotsCountInput * 3).toFixed(2)} ({spotsCountInput * 3} slices)</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Mystery Double ($5.00 × {spotsCountInput}):</span>
                      <span className="font-bold text-slate-200 font-mono">${(spotsCountInput * 5).toFixed(2)} ({spotsCountInput * 3} slices)</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                      <span className="font-bold text-amber-300">Total Due (All 3 Draws):</span>
                      <span className="font-black text-emerald-400 font-mono text-sm">
                        ${(spotsCountInput * 10).toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>Spots purchased:</span>
                      <span className="font-bold text-white font-mono">{spotsCountInput}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Wheel entries ({spotsCountInput} × 3):</span>
                      <span className="font-bold text-amber-400 font-mono">{spotsCountInput * 3} slices (spread around)</span>
                    </div>
                    <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                      <span className="font-bold text-slate-200">Total Due:</span>
                      <span className="font-black text-emerald-400 font-mono text-sm">
                        ${(spotsCountInput * currentCostPerSpot).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSpotModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow cursor-pointer"
                >
                  {applyToAllDraws ? 'Add to All 3 Draws' : 'Confirm & Add Spots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WINNER DRAW FLOW & DART THROW RESULTS */}
      {showWinnerModal && selectedWinnerSegment && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header / Winner Callout */}
            <div className="text-center space-y-2 pb-4 border-b border-slate-800">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-lg">
                <Trophy className="w-9 h-9 text-amber-400" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider rounded-full border border-amber-500/40">
                Wheel Landed On
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {selectedWinnerSegment.avatar} {selectedWinnerSegment.playerName}
              </h2>
              <p className="text-xs text-slate-400">
                Selected from {getDrawName(activeDrawType)} (Occurrence #{selectedWinnerSegment.occurrenceIndex})
              </p>
            </div>

            {/* DRAW 1: DOOR PRIZE FLOW */}
            {activeDrawType === 'door_prize' && (
              <div className="space-y-4">
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-center space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Door Prize Payout (50% of Pool)
                  </span>
                  <div className="text-4xl font-black text-emerald-400 font-mono">
                    ${currentDrawPrizePool50.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    +${currentLeagueShare50.toFixed(2)} added to League Finances running total
                  </span>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleConfirmDoorPrizeWin}
                    className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    Confirm & Award Door Prize
                  </button>
                )}
              </div>
            )}

            {/* DRAW 2: LUCKY NUMBER FLOW */}
            {activeDrawType === 'lucky_number' && (
              <div className="space-y-4">
                {/* Step 1: Pick Random Target Number (1 to 21, 21 is Bullseye) */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-4 h-4" /> Step 1: Target Number
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={rollLuckyTargetNumber}
                        disabled={isRollingTarget}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isRollingTarget ? 'Rolling...' : 'Roll Random (1-21)'}
                      </button>
                    )}
                  </div>

                  <div className="text-center py-2">
                    {luckyTargetNumber === null ? (
                      <div className="text-slate-500 text-xs py-2">
                        Click "Roll Random (1-21)" to reveal the player's target number!
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                          {luckyTargetNumber === 21 ? '21 - BULLSEYE 🎯' : `TARGET ${luckyTargetNumber}`}
                        </div>
                        <p className="text-xs text-amber-300 font-medium">
                          {selectedWinnerSegment.playerName} now throws 3 darts at {luckyTargetNumber === 21 ? 'Bullseye' : luckyTargetNumber}!
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Darts Hit Input & Dynamic Prize Breakdown */}
                {luckyTargetNumber !== null && (
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                      Step 2: Record Darts Hit in Target
                    </span>

                    {/* Dart hits button selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((hits) => (
                        <button
                          key={hits}
                          type="button"
                          onClick={() => setLuckyDartHits(hits)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                            luckyDartHits === hits
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="block text-sm">{hits} Hit{hits !== 1 ? 's' : ''}</span>
                          <span className="text-[10px] opacity-80 block font-normal">
                            {hits === 0 ? '0% Won' : hits === 1 ? '33% Pot' : hits === 2 ? '66% Pot' : '100% JACKPOT'}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Calculated Payout Preview */}
                    {(() => {
                      const luckyBucket = currentDrawData.bucketTotal || 0;
                      const totalBucket = Math.round((luckyBucket + currentDrawPrizePool50) * 100) / 100;
                      let prize = 0;
                      let rollover = totalBucket;
                      if (luckyDartHits === 1) {
                        prize = Math.round(totalBucket * 0.33 * 100) / 100;
                        rollover = Math.max(0, Math.round((totalBucket - prize) * 100) / 100);
                      } else if (luckyDartHits === 2) {
                        prize = Math.round(totalBucket * 0.66 * 100) / 100;
                        rollover = Math.max(0, Math.round((totalBucket - prize) * 100) / 100);
                      } else if (luckyDartHits === 3) {
                        prize = totalBucket;
                        rollover = 0;
                      }

                      return (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Player Wins:</span>
                            <span className="text-lg font-black text-emerald-400 font-mono">${prize.toFixed(2)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Bucket Rollover:</span>
                            <span className="text-lg font-black text-amber-300 font-mono">${rollover.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isAdmin && luckyTargetNumber !== null && (
                  <button
                    type="button"
                    onClick={handleConfirmLuckyNumberWin}
                    className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    Confirm & Complete Lucky Number Draw
                  </button>
                )}
              </div>
            )}

            {/* DRAW 3: MYSTERY DOUBLE FLOW */}
            {activeDrawType === 'double_draw' && (
              <div className="space-y-4">
                {/* Step 1: Pick Mystery Double Number */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-4 h-4" /> Step 1: Mystery Target Double
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={rollDoubleTargetNumber}
                        disabled={isRollingDouble}
                        className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isRollingDouble ? 'Picking...' : 'Pick Mystery Double'}
                      </button>
                    )}
                  </div>

                  <div className="text-center py-2">
                    {doubleTargetNumber === null ? (
                      <div className="text-slate-500 text-xs py-2">
                        Click "Pick Mystery Double" to reveal the mystery double segment target!
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-3xl sm:text-4xl font-black text-indigo-300 font-mono tracking-tight">
                          {doubleTargetNumber === 21 ? 'DOUBLE BULL (D-BULL) 🎯' : `DOUBLE ${doubleTargetNumber} (D${doubleTargetNumber})`}
                        </div>
                        <p className="text-xs text-indigo-200 font-medium">
                          Player must hit the Mystery Double to win the 100% full progressive bucket!
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Result: Hit Double or Missed */}
                {doubleTargetNumber !== null && (
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Step 2: Dart Throw Outcome
                    </span>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDoubleHitSuccess(false)}
                        className={`py-3 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                          !doubleHitSuccess
                            ? 'bg-slate-800 text-white border-slate-600 shadow-md ring-1 ring-slate-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                        }`}
                      >
                        <span className="block text-sm text-red-400">❌ Missed Double</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Pot rolls over (0% payout)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDoubleHitSuccess(true)}
                        className={`py-3 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer text-center ${
                          doubleHitSuccess
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg ring-2 ring-emerald-400 scale-105'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900'
                        }`}
                      >
                        <span className="block text-sm text-emerald-300">🎯 HIT THE DOUBLE!</span>
                        <span className="text-[10px] text-emerald-200 block mt-0.5">Wins 100% Full Bucket!</span>
                      </button>
                    </div>

                    {/* Bucket amount preview */}
                    {(() => {
                      const doubleBucket = currentDrawData.bucketTotal || 0;
                      const totalBucket = Math.round((doubleBucket + currentDrawPrizePool50) * 100) / 100;
                      return (
                        <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Outcome:</span>
                            <span className={`text-base font-black ${doubleHitSuccess ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {doubleHitSuccess ? '100% FULL JACKPOT' : 'Full Pot Rollover'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                              {doubleHitSuccess ? 'Player Prize Paid:' : 'Rollover to Next Session:'}
                            </span>
                            <span className="text-lg font-black text-indigo-300 font-mono">
                              ${totalBucket.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isAdmin && doubleTargetNumber !== null && (
                  <button
                    type="button"
                    onClick={handleConfirmDoubleDrawWin}
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                  >
                    Confirm & Complete Mystery Double
                  </button>
                )}
              </div>
            )}

            {/* Close modal button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
