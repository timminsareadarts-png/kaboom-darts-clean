import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Wallet,
  Calendar,
  Users,
  Trophy,
  Target,
  CheckCircle2,
  Plus,
  Trash2,
  History,
  FileText,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  X,
  Layers,
  CreditCard,
  Coins,
  Percent,
  Receipt,
  RotateCcw,
  RotateCw,
  Cloud,
} from 'lucide-react';
import {
  LeagueFinanceType,
  LeaguePlayerFinance,
  DailyFeeSessionLog,
  LeagueFinanceTotals,
  MembershipPaymentRecord,
} from '../types';
import { subscribeToFinancePlayers, subscribeToFinanceSessions, refreshAllVenueData } from '../services/cloudSync';
import { deletePlayerPermanently } from '../utils/leagueHelper';
import { useAuth } from '../context/AuthContext';
import {
  MEMBERSHIP_FEE,
  DAILY_FEE_MEMBER,
  DAILY_FEE_SPARE,
  DAILY_FEE_SEASON_MAX,
  getLeagueFinancePlayers,
  getAvailableClubPlayersForLeague,
  addExistingClubPlayerToFinance,
  togglePlayerMembership,
  togglePlayerDailyFee,
  setPlayerDailyFeeType,
  setAllDailyFeeActive,
  submitDailyFeeSession,
  getDailyFeeSessionLogs,
  deleteDailyFeeSessionLog,
  calculateLeagueFinanceTotals,
  calculateOverallFinanceTotals,
  addPlayerToLeagueFinance,
  removePlayerFromLeagueFinance,
  recordMembershipPayment,
  deleteMembershipPayment,
  resetPlayerMembership,
  setPlayerMembershipFull,
  recordDailyFeePayment,
  setPlayerDailyFeePaidInFull,
  resetPlayerDailyFee,
  deleteDailyFeePayment,
  recordSpareFeePayment,
  resetPlayerSpareFee,
  deleteSpareFeePayment,
  SPARE_FEE_NIGHTLY,
} from '../utils/financeHelper';
import { AVATAR_OPTIONS } from './PlayerProfiles';
import { getDrawsFinanceSummary } from '../utils/drawsHelper';

interface FinanceManagerProps {
  initialLeague?: LeagueFinanceType;
  onNavigateToLeague?: () => void;
  onNavigateToDraws?: (league?: 'tuesday' | 'wednesday' | 'thursday') => void;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({
  initialLeague = 'tuesday',
  onNavigateToLeague,
  onNavigateToDraws,
}) => {
  const { isAdmin, role } = useAuth();
  const [activeLeague, setActiveLeague] = useState<LeagueFinanceType | 'ledger'>(initialLeague);
  const [players, setPlayers] = useState<LeaguePlayerFinance[]>([]);
  const [sessionLogs, setSessionLogs] = useState<DailyFeeSessionLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'members' | 'partial' | 'spares' | 'daily_full' | 'attending'>('all');
  const [sessionNote, setSessionNote] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<DailyFeeSessionLog | null>(null);

  // Add Player Modal State
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addPlayerSource, setAddPlayerSource] = useState<'existing' | 'new'>('existing');
  const [selectedClubPlayerId, setSelectedClubPlayerId] = useState<string>('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerAvatar, setNewPlayerAvatar] = useState('🎯');
  const [newPlayerDepositType, setNewPlayerDepositType] = useState<'spare' | 'full' | 'partial'>('spare');
  const [newPlayerPartialAmount, setNewPlayerPartialAmount] = useState('20.00');
  const [newPlayerNote, setNewPlayerNote] = useState('');
  const [newPlayerDailyFeeOption, setNewPlayerDailyFeeOption] = useState<'nightly' | 'full' | 'custom'>('nightly');
  const [newPlayerCustomDailyFee, setNewPlayerCustomDailyFee] = useState('20.00');
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  // Installment / Membership Payment Plan Modal State
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState<LeaguePlayerFinance | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('10.00');
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>('');

  // Daily Fee ($68 Max / $2 Nightly) Modal State
  const [selectedPlayerForDailyFee, setSelectedPlayerForDailyFee] = useState<LeaguePlayerFinance | null>(null);
  const [dailyFeePaymentInput, setDailyFeePaymentInput] = useState<string>('2.00');
  const [dailyFeeNoteInput, setDailyFeeNoteInput] = useState<string>('');

  // Season Spare Fee ($5.00 Nightly - No Limit) Modal State
  const [selectedPlayerForSpareFee, setSelectedPlayerForSpareFee] = useState<LeaguePlayerFinance | null>(null);
  const [spareFeePaymentInput, setSpareFeePaymentInput] = useState<string>('5.00');
  const [spareFeeNoteInput, setSpareFeeNoteInput] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [drawsSyncTick, setDrawsSyncTick] = useState(0);

  // In-app deletion confirmation modal state (safe in iframes)
  const [playerToDelete, setPlayerToDelete] = useState<{ id: string; name: string } | null>(null);

  // Available club players not yet in this league
  const availableClubPlayers = useMemo(() => {
    if (activeLeague === 'ledger') return [];
    return getAvailableClubPlayersForLeague(activeLeague);
  }, [activeLeague, players, showAddPlayerModal]);

  // Refresh current data
  const refreshData = () => {
    if (activeLeague !== 'ledger') {
      const pList = getLeagueFinancePlayers(activeLeague);
      setPlayers(pList);
      // Also update selected player in modal if currently open
      if (selectedPlayerForPayment) {
        const freshSelected = pList.find(p => p.playerId === selectedPlayerForPayment.playerId);
        if (freshSelected) setSelectedPlayerForPayment(freshSelected);
      }
      if (selectedPlayerForDailyFee) {
        const freshDfSelected = pList.find(p => p.playerId === selectedPlayerForDailyFee.playerId);
        if (freshDfSelected) setSelectedPlayerForDailyFee(freshDfSelected);
      }
    }
    const logs = getDailyFeeSessionLogs(activeLeague === 'ledger' ? undefined : activeLeague);
    setSessionLogs(logs);
  };

  const handleManualCloudRefresh = async () => {
    setIsRefreshing(true);
    await refreshAllVenueData();
    refreshData();
    showToast('✨ Finances and session records refreshed from Cloud!');
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    refreshData();

    // Subscribe to cloud updates for active league players
    let unsubPlayers = () => {};
    if (activeLeague !== 'ledger') {
      unsubPlayers = subscribeToFinancePlayers(activeLeague, (cloudPlayers) => {
        if (cloudPlayers && Array.isArray(cloudPlayers) && cloudPlayers.length > 0) {
          setPlayers(cloudPlayers);
          localStorage.setItem(`kaboom_finance_${activeLeague}_players`, JSON.stringify(cloudPlayers));
        }
      });
    }

    // Subscribe to cloud updates for session logs
    const unsubSessions = subscribeToFinanceSessions((cloudSessions) => {
      if (cloudSessions && Array.isArray(cloudSessions) && cloudSessions.length > 0) {
        localStorage.setItem('kaboom_finance_sessions', JSON.stringify(cloudSessions));
        const filtered = activeLeague === 'ledger' ? cloudSessions : cloudSessions.filter(s => s.leagueType === activeLeague);
        setSessionLogs(filtered);
      }
    });

    const handleCloudSyncEvent = (e: any) => {
      const key = e?.detail?.key;
      if (!key || key === 'all' || key?.startsWith('kaboom_finance') || key?.startsWith('kaboom_draws') || key === 'kaboom_dart_players') {
        refreshData();
        setDrawsSyncTick((t) => t + 1);
      }
    };
    const handlePlayerDeleted = () => {
      refreshData();
    };

    window.addEventListener('kaboom_cloud_sync_update', handleCloudSyncEvent);
    window.addEventListener('kaboom_player_deleted', handlePlayerDeleted);
    window.addEventListener('storage', refreshData);

    return () => {
      unsubPlayers();
      unsubSessions();
      window.removeEventListener('kaboom_cloud_sync_update', handleCloudSyncEvent);
      window.removeEventListener('kaboom_player_deleted', handlePlayerDeleted);
      window.removeEventListener('storage', refreshData);
    };
  }, [activeLeague]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Overall combined totals
  const overallTotals = useMemo(() => {
    return calculateOverallFinanceTotals();
  }, [players, sessionLogs, activeLeague, drawsSyncTick]);

  // Random Draws League Share (50% running total scoped to active league or overall)
  const drawsSummary = useMemo(() => {
    if (activeLeague === 'tuesday' || activeLeague === 'wednesday' || activeLeague === 'thursday') {
      return getDrawsFinanceSummary(activeLeague);
    }
    return getDrawsFinanceSummary('all');
  }, [players, sessionLogs, activeLeague, drawsSyncTick]);

  // Current active league totals
  const currentLeagueTotals: LeagueFinanceTotals = useMemo(() => {
    if (activeLeague === 'ledger') {
      return {
        memberDepositsTotal: overallTotals.memberDepositsTotal,
        dailyFeesTotal: overallTotals.dailyFeesTotal,
        spareFeesTotal: overallTotals.spareFeesTotal,
        drawsLeagueShare: overallTotals.totalDrawsLeagueShare,
        totalBalance: overallTotals.totalBalance,
        totalBalanceWithDraws: overallTotals.totalBalanceWithDraws,
        memberCount: overallTotals.totalMembers,
        partialMemberCount: overallTotals.totalPartialMembers,
        spareCount: overallTotals.totalSpares,
        totalPlayers: overallTotals.totalMembers + overallTotals.totalPartialMembers + overallTotals.totalSpares,
        totalMembershipOutstanding: overallTotals.totalMembershipOutstanding,
        dailyFeePaidInFullCount: overallTotals.dailyFeePaidInFullCount,
        dailyFeeRunningCount: overallTotals.dailyFeeRunningCount,
        dailyFeeOutstanding: overallTotals.dailyFeeOutstanding,
      };
    }
    return calculateLeagueFinanceTotals(activeLeague);
  }, [activeLeague, players, sessionLogs, overallTotals]);

  // Active tonight calculation for current league ($68 Season Cap / $2 Member / $5 Spare)
  const tonightStats = useMemo(() => {
    const activeList = players.filter(p => p.dailyFeeActive);
    let memberCount = 0;
    let prepaidMemberCount = 0;
    let spareCount = 0;
    let memberTotal = 0;
    let spareTotal = 0;

    activeList.forEach(p => {
      if (p.dailyFeeType === 'member') {
        const currentPaid = p.totalDailyFeesPaid || 0;
        const isPrepaid = Boolean(p.dailyFeePaidInFull || currentPaid >= DAILY_FEE_SEASON_MAX);
        if (isPrepaid) {
          prepaidMemberCount += 1;
        } else {
          const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);
          const fee = Math.min(DAILY_FEE_MEMBER, remaining);
          memberCount += 1;
          memberTotal += fee;
        }
      } else {
        spareCount += 1;
        spareTotal += DAILY_FEE_SPARE;
      }
    });

    return {
      activeList,
      totalCount: activeList.length,
      memberCount,
      prepaidMemberCount,
      spareCount,
      memberTotal,
      spareTotal,
      grandTotal: memberTotal + spareTotal,
    };
  }, [players]);

  // Filtered players list
  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      const matchesSearch = p.playerName.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const deposit = Array.isArray(p.membershipPayments)
        ? p.membershipPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0)
        : (p.membershipDeposit || 0);
      const currentDaily = Array.isArray(p.dailyFeePayments)
        ? Math.min(DAILY_FEE_SEASON_MAX, p.dailyFeePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0))
        : (p.totalDailyFeesPaid || 0);

      if (statusFilter === 'members') return deposit >= MEMBERSHIP_FEE;
      if (statusFilter === 'partial') return deposit > 0 && deposit < MEMBERSHIP_FEE;
      if (statusFilter === 'spares') return deposit === 0;
      if (statusFilter === 'daily_full') return Boolean(p.dailyFeePaidInFull || currentDaily >= DAILY_FEE_SEASON_MAX);
      if (statusFilter === 'attending') return p.dailyFeeActive;
      return true;
    });
  }, [players, searchQuery, statusFilter]);

  // Handler: Open Daily Fee ($68 Max / $2 Nightly) Modal
  const handleOpenDailyFeeModal = (player: LeaguePlayerFinance) => {
    setSelectedPlayerForDailyFee(player);
    const currentPaid = player.totalDailyFeesPaid || 0;
    const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);
    if (remaining > 0 && remaining <= 20) {
      setDailyFeePaymentInput(remaining.toFixed(2));
    } else {
      setDailyFeePaymentInput('2.00');
    }
    setDailyFeeNoteInput('');
  };

  // Handler: Record Daily Fee Payment / Advance
  const handleRecordDailyFeePayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlayerForDailyFee || activeLeague === 'ledger') return;

    const amount = parseFloat(dailyFeePaymentInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount greater than $0', 'error');
      return;
    }

    const { updatedPlayers } = recordDailyFeePayment(
      activeLeague,
      selectedPlayerForDailyFee.playerId,
      amount,
      dailyFeeNoteInput || undefined
    );

    setPlayers(updatedPlayers);
    const updatedPlayer = updatedPlayers.find(p => p.playerId === selectedPlayerForDailyFee.playerId);
    if (updatedPlayer) {
      setSelectedPlayerForDailyFee(updatedPlayer);
      const totalPaid = updatedPlayer.totalDailyFeesPaid || 0;
      if (totalPaid >= DAILY_FEE_SEASON_MAX) {
        showToast(`🎉 Recorded $${amount.toFixed(2)} payment! ${updatedPlayer.playerName} Daily Fee is now PAID IN FULL ($${DAILY_FEE_SEASON_MAX.toFixed(2)} / $${DAILY_FEE_SEASON_MAX.toFixed(2)})!`);
      } else {
        const remaining = DAILY_FEE_SEASON_MAX - totalPaid;
        showToast(`💵 Recorded $${amount.toFixed(2)} for ${updatedPlayer.playerName}. Running total: $${totalPaid.toFixed(2)} / $${DAILY_FEE_SEASON_MAX.toFixed(2)} ($${remaining.toFixed(2)} remaining).`);
      }
    }
    setDailyFeeNoteInput('');
  };

  // Handler: Pay Daily Fee in Full ($68.00 Season Pass)
  const handleSetDailyFeePaidInFull = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = setPlayerDailyFeePaidInFull(activeLeague, playerId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      if (selectedPlayerForDailyFee?.playerId === playerId) {
        setSelectedPlayerForDailyFee(p);
      }
      showToast(`🎉 ${p.playerName} Daily Fee is now marked as Paid in Full ($${DAILY_FEE_SEASON_MAX.toFixed(2)})! All future nights are prepaid.`);
    }
  };

  // Handler: Reset Daily Fee to $0.00
  const handleResetDailyFee = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    if (window.confirm('Reset this player’s daily fee running total to $0.00? All recorded daily fee payments will be cleared.')) {
      const updated = resetPlayerDailyFee(activeLeague, playerId);
      setPlayers(updated);
      const p = updated.find(x => x.playerId === playerId);
      if (p) {
        if (selectedPlayerForDailyFee?.playerId === playerId) {
          setSelectedPlayerForDailyFee(p);
        }
        showToast(`${p.playerName} daily fee running total reset to $0.00.`);
      }
    }
  };

  // Handler: Delete single daily fee payment record
  const handleDeleteDailyFeePaymentRecord = (playerId: string, paymentId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = deleteDailyFeePayment(activeLeague, playerId, paymentId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      if (selectedPlayerForDailyFee?.playerId === playerId) {
        setSelectedPlayerForDailyFee(p);
      }
      showToast('Removed daily fee payment record and adjusted running total.');
    }
  };

  // Handler: Open Season Spare Fee ($5.00 Nightly - No Limit) Modal
  const handleOpenSpareFeeModal = (player: LeaguePlayerFinance) => {
    setSelectedPlayerForSpareFee(player);
    setSpareFeePaymentInput('5.00');
    setSpareFeeNoteInput('');
  };

  // Handler: Record Season Spare Fee Payment
  const handleRecordSpareFeePayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlayerForSpareFee || activeLeague === 'ledger') return;

    const amount = parseFloat(spareFeePaymentInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount greater than $0', 'error');
      return;
    }

    const { updatedPlayers } = recordSpareFeePayment(
      activeLeague,
      selectedPlayerForSpareFee.playerId,
      amount,
      spareFeeNoteInput || undefined
    );

    setPlayers(updatedPlayers);
    const updatedPlayer = updatedPlayers.find(p => p.playerId === selectedPlayerForSpareFee.playerId);
    if (updatedPlayer) {
      setSelectedPlayerForSpareFee(updatedPlayer);
      const totalPaid = updatedPlayer.totalSpareFeesPaid || 0;
      showToast(`💵 Recorded $${amount.toFixed(2)} spare fee for ${updatedPlayer.playerName}. Running total: $${totalPaid.toFixed(2)}.`);
    }
    setSpareFeeNoteInput('');
  };

  // Handler: Reset Season Spare Fee to $0.00
  const handleResetSpareFee = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    if (window.confirm('Reset this player’s Season Spare Fee running total to $0.00? All recorded spare fee payments will be cleared.')) {
      const updated = resetPlayerSpareFee(activeLeague, playerId);
      setPlayers(updated);
      const p = updated.find(x => x.playerId === playerId);
      if (p) {
        if (selectedPlayerForSpareFee?.playerId === playerId) {
          setSelectedPlayerForSpareFee(p);
        }
        showToast(`${p.playerName} Season Spare Fee running total reset to $0.00.`);
      }
    }
  };

  // Handler: Delete single spare fee payment record
  const handleDeleteSpareFeePaymentRecord = (playerId: string, paymentId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = deleteSpareFeePayment(activeLeague, playerId, paymentId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      if (selectedPlayerForSpareFee?.playerId === playerId) {
        setSelectedPlayerForSpareFee(p);
      }
      showToast('Removed spare fee payment record and adjusted running total.');
    }
  };

  // Handler: Toggle Membership ($40 deposit)
  const handleToggleMembership = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = togglePlayerMembership(activeLeague, playerId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      if (p.membershipDeposit >= MEMBERSHIP_FEE) {
        showToast(`✅ ${p.playerName} marked as Full Member ($${MEMBERSHIP_FEE.toFixed(2)} deposit added)`);
      } else if (p.membershipDeposit === 0) {
        showToast(`⚪ ${p.playerName} membership reset to Spare ($0.00)`);
      }
    }
  };

  // Handler: Open Installment Payment Modal
  const handleOpenPaymentModal = (player: LeaguePlayerFinance) => {
    setSelectedPlayerForPayment(player);
    const currentPaid = player.membershipDeposit || 0;
    const remaining = Math.max(0, MEMBERSHIP_FEE - currentPaid);
    if (remaining > 0 && remaining <= 20) {
      setPaymentAmountInput(remaining.toFixed(2));
    } else {
      setPaymentAmountInput('10.00');
    }
    setPaymentNoteInput('');
  };

  // Handler: Record Installment Payment for player
  const handleRecordInstallment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlayerForPayment || activeLeague === 'ledger') return;

    const amount = parseFloat(paymentAmountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('Please enter a valid payment amount greater than $0', 'error');
      return;
    }

    const { updatedPlayers, paymentRecord } = recordMembershipPayment(
      activeLeague,
      selectedPlayerForPayment.playerId,
      amount,
      paymentNoteInput || undefined
    );

    setPlayers(updatedPlayers);
    const updatedPlayer = updatedPlayers.find(p => p.playerId === selectedPlayerForPayment.playerId);
    if (updatedPlayer) {
      setSelectedPlayerForPayment(updatedPlayer);
      const totalPaid = updatedPlayer.membershipDeposit;
      if (totalPaid >= MEMBERSHIP_FEE) {
        showToast(`🎉 Recorded $${amount.toFixed(2)} payment! ${updatedPlayer.playerName} is now PAID IN FULL ($${MEMBERSHIP_FEE.toFixed(2)} / $${MEMBERSHIP_FEE.toFixed(2)})!`);
      } else {
        const remaining = MEMBERSHIP_FEE - totalPaid;
        showToast(`💵 Recorded $${amount.toFixed(2)} installment for ${updatedPlayer.playerName}. Total paid: $${totalPaid.toFixed(2)} ($${remaining.toFixed(2)} remaining).`);
      }
    }
    setPaymentNoteInput('');
  };

  // Handler: Mark Paid In Full from Modal
  const handleSetPaidInFull = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = setPlayerMembershipFull(activeLeague, playerId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      setSelectedPlayerForPayment(p);
      showToast(`🎉 ${p.playerName} is now marked as Paid in Full ($${MEMBERSHIP_FEE.toFixed(2)})!`);
    }
  };

  // Handler: Reset Membership to $0 from Modal
  const handleResetMembership = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    if (window.confirm('Reset this player’s membership to $0 (Spare status)? All recorded installment history will be cleared.')) {
      const updated = resetPlayerMembership(activeLeague, playerId);
      setPlayers(updated);
      const p = updated.find(x => x.playerId === playerId);
      if (p) {
        setSelectedPlayerForPayment(p);
        showToast(`${p.playerName} membership reset to Spare ($0.00).`);
      }
    }
  };

  // Handler: Delete single payment record
  const handleDeletePaymentRecord = (playerId: string, paymentId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = deleteMembershipPayment(activeLeague, playerId, paymentId);
    setPlayers(updated);
    const p = updated.find(x => x.playerId === playerId);
    if (p) {
      setSelectedPlayerForPayment(p);
      showToast('Removed payment record and adjusted membership balance.');
    }
  };

  // Handler: Toggle Daily Fee slider for tonight
  const handleToggleDailyFee = (playerId: string) => {
    if (activeLeague === 'ledger') return;
    const updated = togglePlayerDailyFee(activeLeague, playerId);
    setPlayers(updated);
  };

  // Handler: Set Daily Fee Type ('member' = $2, 'spare' = $5)
  const handleSetDailyFeeType = (playerId: string, type: 'member' | 'spare') => {
    if (activeLeague === 'ledger') return;
    const updated = setPlayerDailyFeeType(activeLeague, playerId, type);
    setPlayers(updated);
  };

  // Handler: Bulk check-in/out
  const handleBulkDailyFee = (active: boolean) => {
    if (activeLeague === 'ledger') return;
    const updated = setAllDailyFeeActive(activeLeague, active);
    setPlayers(updated);
    if (active) {
      showToast(`Selected all ${updated.length} players for tonight's fee collection`);
    } else {
      showToast("Cleared tonight's fee selection");
    }
  };

  // Handler: Submit Daily Fees
  const handleSubmitDailyFees = () => {
    if (activeLeague === 'ledger') return;
    if (tonightStats.totalCount === 0) {
      showToast("No players are toggled ON for tonight's fees.", 'error');
      return;
    }

    const res = submitDailyFeeSession(activeLeague, sessionNote);
    if (res.success && res.sessionLog) {
      showToast(`🎉 Submitted tonight's fees! $${res.sessionLog.totalAmount.toFixed(2)} added to ${getLeagueName(activeLeague)} balance.`);
      setSessionNote('');
      refreshData();
    } else {
      showToast(res.error || 'Failed to submit daily fees.', 'error');
    }
  };

  // Handler: Delete past session
  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm('Are you sure you want to reverse this daily fee session? This will deduct the collected amount from the league balance.')) {
      const ok = deleteDailyFeeSessionLog(sessionId);
      if (ok) {
        showToast('Session record reversed and balance updated.');
        refreshData();
        setSelectedSessionDetail(null);
      } else {
        showToast('Failed to delete session record.', 'error');
      }
    }
  };

  // Handler: Add Player (From Club Roster or New Creation)
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeLeague === 'ledger') return;

    let initialDeposit = 0;
    if (newPlayerDepositType === 'full') {
      initialDeposit = MEMBERSHIP_FEE;
    } else if (newPlayerDepositType === 'partial') {
      const p = parseFloat(newPlayerPartialAmount);
      initialDeposit = isNaN(p) ? 0 : Math.max(0, p);
    }

    const customDf = parseFloat(newPlayerCustomDailyFee);
    const customDfAmount = isNaN(customDf) ? 0 : Math.max(0, customDf);

    if (addPlayerSource === 'existing') {
      if (!selectedClubPlayerId) {
        showToast('Please select a player from the club roster', 'error');
        return;
      }
      const targetClubPlayer = availableClubPlayers.find(p => p.id === selectedClubPlayerId);
      if (!targetClubPlayer) {
        showToast('Selected player could not be found', 'error');
        return;
      }

      try {
        const updated = addExistingClubPlayerToFinance(
          activeLeague,
          targetClubPlayer,
          initialDeposit,
          newPlayerNote || undefined,
          newPlayerDailyFeeOption,
          customDfAmount
        );
        setPlayers(updated);
        setShowAddPlayerModal(false);
        setSelectedClubPlayerId('');
        setNewPlayerDepositType('spare');
        setNewPlayerPartialAmount('20.00');
        setNewPlayerNote('');
        setNewPlayerDailyFeeOption('nightly');
        setNewPlayerCustomDailyFee('20.00');
        setAddPlayerError(null);
        showToast(`Added ${targetClubPlayer.name} to ${getLeagueName(activeLeague)} finances!`);
      } catch (err: any) {
        setAddPlayerError(err.message || 'Error adding player.');
        showToast(err.message || 'Error adding player.', 'error');
      }
      return;
    }

    // Creating a brand new player
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      showToast('Please enter a player name', 'error');
      return;
    }

    // Check for duplicate player names in this finance roster
    const exists = players.some(
      p => p.playerName.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      const msg = `Player already exists! "${trimmed}" is already registered in ${getLeagueName(activeLeague)} finances.`;
      setAddPlayerError(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      const updated = addPlayerToLeagueFinance(
        activeLeague,
        trimmed,
        newPlayerAvatar,
        initialDeposit,
        newPlayerNote || undefined,
        newPlayerDailyFeeOption,
        customDfAmount
      );
      setPlayers(updated);
      setShowAddPlayerModal(false);
      setNewPlayerName('');
      setNewPlayerAvatar('🎯');
      setNewPlayerDepositType('spare');
      setNewPlayerPartialAmount('20.00');
      setNewPlayerNote('');
      setNewPlayerDailyFeeOption('nightly');
      setNewPlayerCustomDailyFee('20.00');
      setAddPlayerError(null);
      showToast(`Added ${trimmed} to ${getLeagueName(activeLeague)} finances!`);
    } catch (err: any) {
      setAddPlayerError(err.message || 'Player already exists.');
      showToast(err.message || 'Player already exists.', 'error');
    }
  };

  // Handler: Remove Player from this league's finance roster
  const handleRemovePlayer = (playerId: string, name: string) => {
    if (activeLeague === 'ledger') return;
    setPlayerToDelete({ id: playerId, name });
  };

  const confirmRemovePlayer = () => {
    if (!playerToDelete || activeLeague === 'ledger') return;
    const { id, name } = playerToDelete;
    const updated = removePlayerFromLeagueFinance(activeLeague, id, name);
    setPlayers(updated);
    setPlayerToDelete(null);
    showToast(`Removed ${name} from ${getLeagueName(activeLeague)} finances.`);
  };

  const getLeagueName = (l: LeagueFinanceType) => {
    if (l === 'tuesday') return 'Tuesday Singles';
    if (l === 'wednesday') return 'Wednesday Teams';
    return 'Thursday Doubles';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-bold animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500/50 shadow-emerald-950/50'
              : 'bg-red-950 text-red-200 border-red-500/50 shadow-red-950/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Non-Admin Read-Only Status Banner */}
      {!isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xl shrink-0">
              {role === 'player' ? '🎯' : '👁️'}
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                Finance View Mode ({role === 'player' ? 'Player Access' : 'Spectator Access'})
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                You can review live treasury balances, membership payments, and nightly fees. Financial modifications and submissions require Admin login.
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 shrink-0">
            Read-Only
          </span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-left space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-black uppercase tracking-wider">
            <DollarSign className="w-4 h-4 text-emerald-600" /> League Financial Manager
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            League Finances & Fee Collection
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm max-w-2xl">
            Dedicated financial tracking for Tuesday Singles, Wednesday Teams, and Thursday Doubles. Supports flexible installment payments towards the $40.00 membership fee and nightly fee collection ($2.00 member / $5.00 spare).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-700 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Cloud Synced
          </div>
          <button
            type="button"
            onClick={handleManualCloudRefresh}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Finances
          </button>
        </div>
      </div>

      {/* Grand Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Grand Balance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Wallet className="w-32 h-32" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {activeLeague === 'ledger' ? 'Total League Treasury' : `${getLeagueName(activeLeague)} Treasury`}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/30">
                {activeLeague === 'ledger' ? 'All Sources' : 'League Scoped'}
              </span>
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-white">
              ${(currentLeagueTotals.totalBalance + drawsSummary.totalDrawsLeagueShare).toFixed(2)}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              ${currentLeagueTotals.totalBalance.toFixed(2)} {activeLeague === 'ledger' ? 'dues & fees across all leagues' : `${getLeagueName(activeLeague)} dues & fees`} + ${drawsSummary.totalDrawsLeagueShare.toFixed(2)} draws 50% share.
            </p>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Membership $40</span>
              <span className="font-extrabold text-amber-400">{currentLeagueTotals.memberCount}F / {currentLeagueTotals.partialMemberCount || 0}P</span>
            </div>
            <div className="text-center">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Daily $68</span>
              <span className="font-extrabold text-emerald-400">{currentLeagueTotals.dailyFeePaidInFullCount || 0} Full</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Draws (50%)</span>
              <span className="font-extrabold text-amber-300">${drawsSummary.totalDrawsLeagueShare.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Membership Deposits Total */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {activeLeague === 'ledger' ? 'Membership Deposits (All Leagues)' : `${getLeagueName(activeLeague)} Memberships`}
              </span>
              <span className="text-xs font-mono font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                $40.00 Due
              </span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
              ${currentLeagueTotals.memberDepositsTotal.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span>{currentLeagueTotals.memberCount} full & {currentLeagueTotals.partialMemberCount || 0} installment members.</span>
              {currentLeagueTotals.totalMembershipOutstanding > 0 && (
                <div className="mt-0.5 font-bold text-amber-600">
                  (${currentLeagueTotals.totalMembershipOutstanding.toFixed(2)} remaining)
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {activeLeague === 'ledger' ? (
              <>
                <span className="text-slate-500 text-[11px]">Breakdown:</span>
                <div className="flex gap-1.5 font-mono font-bold text-[10px]">
                  <span className="text-indigo-600">Tue: ${overallTotals.tuesday.memberDepositsTotal.toFixed(0)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-600">Wed: ${overallTotals.wednesday.memberDepositsTotal.toFixed(0)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600">Thu: ${overallTotals.thursday.memberDepositsTotal.toFixed(0)}</span>
                </div>
              </>
            ) : (
              <span className="text-slate-500 text-[11px] font-medium">
                {getLeagueName(activeLeague)}: {currentLeagueTotals.memberCount} of {currentLeagueTotals.totalPlayers} players full members
              </span>
            )}
          </div>
        </div>

        {/* Nightly Daily Fees Collected ($68 Season Cap / $2 Nightly) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {activeLeague === 'ledger' ? 'Daily Fees ($68 Cap - All Leagues)' : `${getLeagueName(activeLeague)} Daily Fees`}
              </span>
              <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                $68 Max
              </span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black text-slate-900">
              ${currentLeagueTotals.dailyFeesTotal.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span>${DAILY_FEE_MEMBER.toFixed(2)}/night (up to ${DAILY_FEE_SEASON_MAX.toFixed(2)} cap).</span>
              <div className="mt-0.5 flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
                <span className="text-emerald-700">{currentLeagueTotals.dailyFeePaidInFullCount || 0} Paid Full</span>
                <span className="text-slate-300">•</span>
                <span className="text-indigo-700">{currentLeagueTotals.dailyFeeRunningCount || 0} on $2/nt</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {activeLeague === 'ledger' ? (
              <>
                <span className="text-slate-500 text-[11px]">Breakdown:</span>
                <div className="flex gap-1.5 font-mono font-bold text-[10px]">
                  <span className="text-indigo-600">Tue: ${overallTotals.tuesday.dailyFeesTotal.toFixed(0)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-600">Wed: ${overallTotals.wednesday.dailyFeesTotal.toFixed(0)}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-emerald-600">Thu: ${overallTotals.thursday.dailyFeesTotal.toFixed(0)}</span>
                </div>
              </>
            ) : (
              <span className="text-slate-500 text-[11px] font-medium">
                {getLeagueName(activeLeague)}: ${currentLeagueTotals.dailyFeeOutstanding.toFixed(2)} outstanding to season caps
              </span>
            )}
          </div>
        </div>

        {/* Random Draws 50% Treasury Share */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-200 bg-amber-50/20 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {activeLeague === 'ledger' ? 'Draws 50% Share (All Leagues)' : `${activeLeague.charAt(0).toUpperCase() + activeLeague.slice(1)} Draws 50% Share`}
              </span>
              <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                50% to League
              </span>
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-black text-amber-900">
              ${drawsSummary.totalDrawsLeagueShare.toFixed(2)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span>
                {activeLeague === 'ledger'
                  ? 'Running total from Door Prize, Lucky Number & Mystery Double across all leagues.'
                  : `Running total from Door Prize, Lucky Number & Mystery Double spots for ${activeLeague.charAt(0).toUpperCase() + activeLeague.slice(1)}.`}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/80 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Door: <strong className="text-slate-800">${drawsSummary.doorPrizeLeagueShare.toFixed(2)}</strong></span>
              <span className="text-slate-500">Lucky: <strong className="text-slate-800">${drawsSummary.luckyLeagueShare.toFixed(2)}</strong></span>
              <span className="text-slate-500">Mystery: <strong className="text-slate-800">${drawsSummary.doubleLeagueShare.toFixed(2)}</strong></span>
            </div>
            {onNavigateToDraws && (
              <button
                type="button"
                onClick={() => onNavigateToDraws(activeLeague !== 'ledger' ? activeLeague : 'tuesday')}
                className="w-full py-1 px-2 text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Spin Draws Wheel</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* League Navigation Switcher */}
      <div className="flex bg-slate-200/70 p-1.5 rounded-xl border border-slate-300 max-w-4xl mx-auto font-bold text-xs sm:text-sm">
        <button
          type="button"
          onClick={() => setActiveLeague('tuesday')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeLeague === 'tuesday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 text-amber-300" />
          <span className="hidden sm:inline">Tuesday Singles</span>
          <span className="sm:hidden">Tuesday</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${activeLeague === 'tuesday' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-300 text-slate-700'}`}>
            ${overallTotals.tuesday.totalBalance.toFixed(0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLeague('wednesday')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeLeague === 'wednesday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-300" />
          <span className="hidden sm:inline">Wednesday Teams</span>
          <span className="sm:hidden">Wednesday</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${activeLeague === 'wednesday' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-300 text-slate-700'}`}>
            ${overallTotals.wednesday.totalBalance.toFixed(0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLeague('thursday')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeLeague === 'thursday'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4 text-amber-300" />
          <span className="hidden sm:inline">Thursday Doubles</span>
          <span className="sm:hidden">Thursday</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${activeLeague === 'thursday' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-300 text-slate-700'}`}>
            ${overallTotals.thursday.totalBalance.toFixed(0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLeague('ledger')}
          className={`flex-1 py-3 px-2 sm:px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeLeague === 'ledger'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-emerald-300" />
          <span className="hidden sm:inline">Session Ledger</span>
          <span className="sm:hidden">Ledger</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${activeLeague === 'ledger' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-300 text-slate-700'}`}>
            {sessionLogs.length}
          </span>
        </button>
      </div>

      {/* MAIN VIEW: LEAGUE FINANCE SECTION */}
      {activeLeague !== 'ledger' ? (
        <div className="space-y-6">
          {/* League Balance Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-black uppercase rounded-lg border border-indigo-100">
                  {getLeagueName(activeLeague)}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Financial Ledger</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                ${currentLeagueTotals.totalBalance.toFixed(2)}{' '}
                <span className="text-xs font-bold text-slate-400 uppercase">Total League Balance</span>
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <strong className="text-amber-600 font-bold">${currentLeagueTotals.memberDepositsTotal.toFixed(2)}</strong> from {currentLeagueTotals.memberCount} Full & {(currentLeagueTotals.partialMemberCount || 0)} Installment Members
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <strong className="text-emerald-600 font-bold">${currentLeagueTotals.dailyFeesTotal.toFixed(2)}</strong> from Daily Fees ({currentLeagueTotals.dailyFeePaidInFullCount || 0} Paid Full / {currentLeagueTotals.dailyFeeRunningCount || 0} on $2/night)
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{currentLeagueTotals.spareCount} Registered Spares</span>
                {(currentLeagueTotals.spareFeesTotal || 0) > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1">
                      <strong className="text-purple-600 font-bold">${(currentLeagueTotals.spareFeesTotal || 0).toFixed(2)}</strong> from Spare Fees ($5/nt)
                    </span>
                  </>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(true)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Player to Roster
                </button>
              </div>
            )}
          </div>

          {/* TONIGHT'S DAILY FEE COLLECTION ACTION BAR */}
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-800/80">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
              
              {/* Left: Tonight's Summary Tally */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-md">
                    Tonight's Session
                  </span>
                  <span className="text-xs font-bold text-indigo-200">Daily Attendance Fee Collection ($68 Season Cap)</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-white tracking-tight">
                    ${tonightStats.grandTotal.toFixed(2)}
                  </span>
                  <span className="text-xs text-indigo-200 font-medium">
                    Total to collect tonight ({tonightStats.totalCount} players attending)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200/80 pt-0.5">
                  <span className="bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700/50">
                    <strong className="text-amber-300 font-bold">{tonightStats.memberCount} Members</strong> × $2.00 = ${tonightStats.memberTotal.toFixed(2)}
                  </span>
                  {tonightStats.prepaidMemberCount > 0 && (
                    <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50 font-bold">
                      {tonightStats.prepaidMemberCount} Prepaid Season Pass ($0.00)
                    </span>
                  )}
                  <span className="bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700/50">
                    <strong className="text-emerald-300 font-bold">{tonightStats.spareCount} Spares</strong> × $5.00 = ${tonightStats.spareTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Right: Quick Controls & Submit Button (Admin) or View Badge (Non-Admin) */}
              {isAdmin ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => handleBulkDailyFee(true)}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkDailyFee(false)}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Optional note (e.g. Week 4)"
                      value={sessionNote}
                      onChange={(e) => setSessionNote(e.target.value)}
                      className="w-full sm:w-44 px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSubmitDailyFees}
                      disabled={tonightStats.totalCount === 0}
                      className={`px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer whitespace-nowrap ${
                        tonightStats.totalCount > 0
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Submit Tonight's Fees (${tonightStats.grandTotal.toFixed(2)})
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  <span>Live Nightly Fee Tracker</span>
                </div>
              )}

            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search players by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({players.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('members')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'members' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full $40 ({currentLeagueTotals.memberCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('partial')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'partial' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Installments ({(currentLeagueTotals.partialMemberCount || 0)})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('daily_full')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'daily_full' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Fee $68 Full ({currentLeagueTotals.dailyFeePaidInFullCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('spares')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'spares' ? 'bg-white text-slate-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Spares ({currentLeagueTotals.spareCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('attending')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'attending' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-600 hover:text-indigo-900'
                }`}
              >
                Attending ({tonightStats.totalCount})
              </button>
            </div>
          </div>

          {/* PLAYER FINANCE ROSTER LIST */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {getLeagueName(activeLeague)} Player Roster & Fees
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredPlayers.length} players shown
              </span>
            </div>

            {filteredPlayers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="font-bold text-slate-600">No players found</p>
                <p className="text-xs mt-1">Try clearing search filters or add a new player to this roster.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPlayers.map((player) => {
                  const deposit = Array.isArray(player.membershipPayments)
                    ? player.membershipPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                    : (player.membershipDeposit || 0);
                  const isPaidInFull = deposit >= MEMBERSHIP_FEE;
                  const isPartial = deposit > 0 && deposit < MEMBERSHIP_FEE;
                  const remainingDue = Math.max(0, MEMBERSHIP_FEE - deposit);
                  const progressPct = Math.min(100, Math.round((deposit / MEMBERSHIP_FEE) * 100));

                  const currentDailyPaid = Array.isArray(player.dailyFeePayments)
                    ? Math.min(DAILY_FEE_SEASON_MAX, player.dailyFeePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0))
                    : (player.totalDailyFeesPaid || 0);
                  const isDailyFeeFull = Boolean(player.dailyFeePaidInFull || currentDailyPaid >= DAILY_FEE_SEASON_MAX);
                  const dailyFeeRemaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentDailyPaid);
                  const dailyFeeProgressPct = Math.min(100, Math.round((currentDailyPaid / DAILY_FEE_SEASON_MAX) * 100));

                  const currentSparePaid = Array.isArray(player.spareFeePayments)
                    ? player.spareFeePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                    : (player.totalSpareFeesPaid || 0);

                  return (
                    <div
                      key={player.playerId}
                      className={`p-4 sm:p-5 transition-colors flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 ${
                        player.dailyFeeActive ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Player Info & Status Badges */}
                      <div className="flex items-start gap-3.5 min-w-[260px]">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl shadow-xs shrink-0 mt-0.5">
                          {player.avatar || '🎯'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-black text-slate-900 text-base">{player.playerName}</h4>
                            
                            {isPaidInFull ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-md border border-amber-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-amber-600" /> Member ($40)
                              </span>
                            ) : isPartial ? (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase rounded-md border border-indigo-200 flex items-center gap-1">
                                <Coins className="w-3 h-3 text-indigo-600" /> Partial (${deposit.toFixed(0)}/$40)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md border border-slate-200">
                                <span className="text-slate-600 font-bold">Spare ($0)</span>
                              </span>
                            )}

                            {isDailyFeeFull ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Daily Fee Full ($68)
                              </span>
                            ) : currentDailyPaid > 0 ? (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-md border border-indigo-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-indigo-500" /> Daily: ${currentDailyPaid.toFixed(2)} / $68
                              </span>
                            ) : null}

                            {currentSparePaid > 0 && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-black uppercase rounded-md border border-purple-200 flex items-center gap-1">
                                <Receipt className="w-3 h-3 text-purple-500" /> Spare Fee: ${currentSparePaid.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Progress bars: Membership & Daily Fee */}
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            {isPartial && (
                              <div className="w-32">
                                <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold mb-0.5">
                                  <span className="text-amber-700 font-bold">${deposit.toFixed(0)} paid</span>
                                  <span className="text-slate-400 font-medium">${remainingDue.toFixed(0)} due</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {!isDailyFeeFull && (player.dailyFeeType === 'member' || currentDailyPaid > 0) && (
                              <div className="w-36">
                                <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold mb-0.5">
                                  <span className="text-emerald-700 font-bold">${currentDailyPaid.toFixed(2)} paid</span>
                                  <span className="text-slate-400 font-medium">${dailyFeeRemaining.toFixed(2)} to $68</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${dailyFeeProgressPct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                            <span>Paid Total: <strong className="text-slate-800 font-bold">${(deposit + currentDailyPaid + currentSparePaid).toFixed(2)}</strong></span>
                            <span className="text-slate-300">•</span>
                            <span>Daily Fees: <strong className="text-emerald-600 font-semibold">${currentDailyPaid.toFixed(2)} / $68.00</strong></span>
                            {currentSparePaid > 0 && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>Spare Fees: <strong className="text-purple-600 font-semibold">${currentSparePaid.toFixed(2)}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls Row: Membership Controls and Season Daily Fee ($68 Cap Controls) */}
                      <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
                        
                        {/* 1. MEMBERSHIP & INSTALLMENTS CONTROLS */}
                        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
                          isPaidInFull
                            ? 'bg-amber-50/80 border-amber-200'
                            : isPartial
                            ? 'bg-indigo-50/80 border-indigo-200'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}>
                          <div className="text-left">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                              Membership ($40)
                            </span>
                            <span className={`text-xs font-bold ${
                              isPaidInFull ? 'text-amber-700' : isPartial ? 'text-indigo-700' : 'text-slate-400'
                            }`}>
                              {isPaidInFull
                                ? 'Full ($40 Paid)'
                                : isPartial
                                ? `Installment ($${deposit.toFixed(2)})`
                                : 'Spare ($0 Paid)'}
                            </span>
                          </div>

                          {/* Installments & Payment Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(player)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                              isPaidInFull
                                ? 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-100'
                                : isPartial
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                            title="Open installment payment details and history"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>{isAdmin ? (isPaidInFull ? 'History' : 'Pay / Split') : 'History'}</span>
                          </button>
                        </div>

                        {/* 2. SEASON DAILY FEE ($68 CAP / PAY IN FULL) */}
                        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
                          isDailyFeeFull
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : currentDailyPaid > 0
                            ? 'bg-indigo-50/80 border-indigo-200'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}>
                          <div className="text-left">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                              Season Daily Fee
                            </span>
                            <span className={`text-xs font-bold ${
                              isDailyFeeFull ? 'text-emerald-700' : currentDailyPaid > 0 ? 'text-indigo-700' : 'text-slate-400'
                            }`}>
                              {isDailyFeeFull
                                ? 'Paid in Full ($68)'
                                : `$${currentDailyPaid.toFixed(2)} / $68.00`}
                            </span>
                          </div>

                          {/* Open Daily Fee Details & Custom Payment Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenDailyFeeModal(player)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                              isDailyFeeFull
                                ? 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="Manage Daily Fee payments, pay in full, or view running history"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>{isAdmin ? (isDailyFeeFull ? 'History' : 'Pay $68 / Track') : 'History'}</span>
                          </button>
                        </div>

                        {/* 3. SEASON SPARE FEE ($5.00 / NIGHT - NO 68 LIMIT) */}
                        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
                          currentSparePaid > 0
                            ? 'bg-purple-50/80 border-purple-200'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}>
                          <div className="text-left">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                              Season Spare Fee
                            </span>
                            <span className={`text-xs font-bold ${
                              currentSparePaid > 0 ? 'text-purple-700' : 'text-slate-400'
                            }`}>
                              {currentSparePaid > 0
                                ? `$${currentSparePaid.toFixed(2)} (${Math.floor(currentSparePaid / 5.0)} nts)`
                                : '$0.00 ($5/nt)'}
                            </span>
                          </div>

                          {/* Open Spare Fee Details & Custom Payment Modal */}
                          <button
                            type="button"
                            onClick={() => handleOpenSpareFeeModal(player)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                              currentSparePaid > 0
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                            title="Manage Season Spare Fee payments ($5.00/night) and view running history"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>{isAdmin ? (currentSparePaid > 0 ? 'Pay $5 / Track' : 'Pay $5 / Track') : 'History'}</span>
                          </button>
                        </div>

                        {/* Remove Action (Admin only) */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(player.playerId, player.playerName)}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                            title="Remove player from finance list"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SESSION LEDGER VIEW */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-black uppercase rounded-lg border border-emerald-100">
                  Audit History
                </span>
                <span className="text-xs text-slate-500 font-semibold">Nightly Fee Session Ledger</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mt-1">
                Completed League Fee Sessions ({sessionLogs.length})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Every time "Submit Tonight's Fees" is clicked, an entry is permanently recorded here. Click any session to inspect player attendees or reverse a submission.
              </p>
            </div>
          </div>

          {sessionLogs.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-bold text-slate-600">No session records submitted yet</p>
              <p className="text-xs mt-1">
                Turn ON the Daily Fee sliders for attending players on league nights and click "Submit Tonight's Fees".
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {sessionLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedSessionDetail(log)}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-lg font-bold">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded border border-indigo-100">
                          {getLeagueName(log.leagueType)}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{log.dateStr}</h4>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                        <span><strong>{log.memberCount}</strong> Members ($2)</span>
                        <span>•</span>
                        <span><strong>{log.spareCount}</strong> Spares ($5)</span>
                        {log.note && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-400">"{log.note}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-600 font-mono">
                        +${log.totalAmount.toFixed(2)}
                      </span>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">
                        {log.playersAttending.length} Attendees
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                      Details <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSTALLMENT & MEMBERSHIP PAYMENT PLAN                             */}
      {/* ========================================================================= */}
      {selectedPlayerForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl shadow-xs">
                  {selectedPlayerForPayment.avatar || '🎯'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">
                    {selectedPlayerForPayment.playerName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {getLeagueName(activeLeague === 'ledger' ? 'tuesday' : activeLeague)} Membership Payment Plan
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayerForPayment(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Membership Progress Card */}
            {(() => {
              const deposit = Array.isArray(selectedPlayerForPayment.membershipPayments)
                ? selectedPlayerForPayment.membershipPayments.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                : (selectedPlayerForPayment.membershipDeposit || 0);
              const isPaidInFull = deposit >= MEMBERSHIP_FEE;
              const remaining = Math.max(0, MEMBERSHIP_FEE - deposit);
              const progressPct = Math.min(100, Math.round((deposit / MEMBERSHIP_FEE) * 100));

              return (
                <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                        Membership Fee ($40.00 Due)
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-black text-white font-mono">
                          ${deposit.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400">/ ${MEMBERSHIP_FEE.toFixed(2)} Paid</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {isPaidInFull ? (
                        <span className="px-2.5 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-lg shadow-xs">
                          Paid in Full
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-indigo-500/30 text-indigo-300 font-bold text-xs uppercase rounded-lg border border-indigo-500/40">
                          ${remaining.toFixed(2)} Remaining
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700/80">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPaidInFull ? 'bg-amber-400' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{progressPct}% Completed</span>
                    {remaining > 0 ? (
                      <span className="text-amber-400 font-bold">${remaining.toFixed(2)} balance to become Full Member</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">100% Membership Satisfied</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* RECORD NEW INSTALLMENT PAYMENT FORM (ADMIN ONLY) */}
            {isAdmin ? (
              <form onSubmit={handleRecordInstallment} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-600" /> Record Installment Payment
                  </span>
                  <span className="text-[11px] text-slate-500">Adds directly to league balance</span>
                </div>

                {/* Preset Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput('5.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      paymentAmountInput === '5.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +$5.00
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput('10.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      paymentAmountInput === '10.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +$10.00
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput('20.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      paymentAmountInput === '20.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +$20.00
                  </button>
                  {(() => {
                    const rem = Math.max(0, MEMBERSHIP_FEE - (selectedPlayerForPayment.membershipDeposit || 0));
                    if (rem > 0 && rem !== 5 && rem !== 10 && rem !== 20) {
                      return (
                        <button
                          type="button"
                          onClick={() => setPaymentAmountInput(rem.toFixed(2))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            paymentAmountInput === rem.toFixed(2)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          +${rem.toFixed(2)} (Rest)
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Amount Input & Note Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Amount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentAmountInput}
                        onChange={(e) => setPaymentAmountInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Note / Memo (Optional)
                    </label>
                    <input
                      type="text"
                      value={paymentNoteInput}
                      onChange={(e) => setPaymentNoteInput(e.target.value)}
                      placeholder="e.g. Week 2 installment"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetPaidInFull(selectedPlayerForPayment.playerId)}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
                    >
                      Quick Pay Full ($40)
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleResetMembership(selectedPlayerForPayment.playerId)}
                      className="text-[11px] text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                    >
                      Reset to $0
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Payment
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  Installment Ledger (Read-Only)
                </span>
                <span className="text-[11px] text-slate-400">Admin credentials required to add payments</span>
              </div>
            )}

            {/* PAYMENT HISTORY AUDIT LIST */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Installment History ({selectedPlayerForPayment.membershipPayments?.length || 0})
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedPlayerForPayment.membershipPayments?.length ? 'Chronological records' : 'No records yet'}
                </span>
              </div>

              {!selectedPlayerForPayment.membershipPayments || selectedPlayerForPayment.membershipPayments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  No installments recorded yet.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {selectedPlayerForPayment.membershipPayments.map((pay) => (
                    <div key={pay.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm text-emerald-600">
                            +${pay.amount.toFixed(2)}
                          </span>
                          <span className="text-slate-400 text-[11px]">{pay.dateStr}</span>
                        </div>
                        {pay.note && (
                          <span className="text-[11px] text-slate-500 italic block mt-0.5">
                            "{pay.note}"
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeletePaymentRecord(selectedPlayerForPayment.playerId, pay.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                          title="Delete this installment payment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlayerForPayment(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DAILY ATTENDANCE FEE PAYMENT & $68 SEASON PASS                     */}
      {/* ========================================================================= */}
      {selectedPlayerForDailyFee && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl shadow-xs">
                  {selectedPlayerForDailyFee.avatar || '🎯'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">
                    {selectedPlayerForDailyFee.playerName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {getLeagueName(activeLeague === 'ledger' ? 'tuesday' : activeLeague)} Daily Fee & $68 Season Pass
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayerForDailyFee(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Daily Fee Running Progress Card */}
            {(() => {
              const currentPaid = Array.isArray(selectedPlayerForDailyFee.dailyFeePayments)
                ? Math.min(DAILY_FEE_SEASON_MAX, selectedPlayerForDailyFee.dailyFeePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0))
                : (selectedPlayerForDailyFee.totalDailyFeesPaid || 0);
              const isFull = Boolean(selectedPlayerForDailyFee.dailyFeePaidInFull || currentPaid >= DAILY_FEE_SEASON_MAX);
              const remaining = Math.max(0, DAILY_FEE_SEASON_MAX - currentPaid);
              const pct = Math.min(100, Math.round((currentPaid / DAILY_FEE_SEASON_MAX) * 100));

              return (
                <div className={`p-4 rounded-xl border ${
                  isFull ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Season Cap Progress ($68.00 Max)
                    </span>
                    {isFull ? (
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[11px] font-black uppercase rounded flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3 h-3" /> Season Pass Paid in Full
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[11px] font-bold rounded">
                        $2.00 / Night Running Plan
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-900 font-mono">
                        ${currentPaid.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 ml-1.5 font-medium">
                        of ${DAILY_FEE_SEASON_MAX.toFixed(2)} Season Target
                      </span>
                    </div>
                    {!isFull && (
                      <span className="text-xs font-bold text-amber-700">
                        ${remaining.toFixed(2)} remaining ({Math.ceil(remaining / DAILY_FEE_MEMBER)} nights left)
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isFull ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2">
                    {isFull
                      ? 'Player has fulfilled the $68.00 season fee target! Their nightly attendance fee is $0.00 for the remainder of the season.'
                      : 'Each week attending as a member adds $2.00 to this running total until reaching the $68.00 cap. Or, pay in full upfront at any time.'}
                  </p>
                </div>
              );
            })()}

            {/* RECORD DAILY FEE PAYMENT (Admin Only) */}
            {isAdmin ? (
              <form onSubmit={handleRecordDailyFeePayment} className="space-y-3 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    Record Daily Fee / Season Prepayment
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">Updates running total</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDailyFeePaymentInput('2.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      dailyFeePaymentInput === '2.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$2.00 (1 night)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyFeePaymentInput('10.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      dailyFeePaymentInput === '10.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$10.00 (5 nights)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyFeePaymentInput('20.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      dailyFeePaymentInput === '20.00'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$20.00 (10 nights)
                  </button>
                  {(() => {
                    const rem = Math.max(0, DAILY_FEE_SEASON_MAX - (selectedPlayerForDailyFee.totalDailyFeesPaid || 0));
                    if (rem > 0 && rem !== 2 && rem !== 10 && rem !== 20) {
                      return (
                        <button
                          type="button"
                          onClick={() => setDailyFeePaymentInput(rem.toFixed(2))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            dailyFeePaymentInput === rem.toFixed(2)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          +${rem.toFixed(2)} (Pay Full)
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Amount Input & Note Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Payment Amount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={dailyFeePaymentInput}
                        onChange={(e) => setDailyFeePaymentInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Note / Memo (Optional)
                    </label>
                    <input
                      type="text"
                      value={dailyFeeNoteInput}
                      onChange={(e) => setDailyFeeNoteInput(e.target.value)}
                      placeholder="e.g. Paid $68 in full / cash"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetDailyFeePaidInFull(selectedPlayerForDailyFee.playerId)}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                    >
                      Quick Pay Full ($68)
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleResetDailyFee(selectedPlayerForDailyFee.playerId)}
                      className="text-[11px] text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                    >
                      Reset to $0
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Payment
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  Daily Fee Ledger (Read-Only)
                </span>
                <span className="text-[11px] text-slate-400">Admin credentials required to add payments</span>
              </div>
            )}

            {/* PAYMENT HISTORY AUDIT LIST */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Daily Fee Payment History ({selectedPlayerForDailyFee.dailyFeePayments?.length || 0})
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedPlayerForDailyFee.dailyFeePayments?.length ? 'Chronological records' : 'No records yet'}
                </span>
              </div>

              {!selectedPlayerForDailyFee.dailyFeePayments || selectedPlayerForDailyFee.dailyFeePayments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  No daily fee payments or nightly session records saved yet.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {selectedPlayerForDailyFee.dailyFeePayments.map((pay) => (
                    <div key={pay.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm text-emerald-600">
                            +${pay.amount.toFixed(2)}
                          </span>
                          <span className="text-slate-400 text-[11px]">{pay.dateStr}</span>
                        </div>
                        {pay.note && (
                          <span className="text-[11px] text-slate-500 italic block mt-0.5">
                            "{pay.note}"
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDailyFeePaymentRecord(selectedPlayerForDailyFee.playerId, pay.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                          title="Delete this payment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlayerForDailyFee(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SEASON SPARE FEE ($5.00 NIGHTLY - NO 68 LIMIT)                     */}
      {/* ========================================================================= */}
      {selectedPlayerForSpareFee && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-xl shadow-xs">
                  {selectedPlayerForSpareFee.avatar || '🎯'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg leading-tight">
                    {selectedPlayerForSpareFee.playerName}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {getLeagueName(activeLeague === 'ledger' ? 'tuesday' : activeLeague)} Season Spare Fee ($5.00 / Night)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayerForSpareFee(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Spare Fee Running Progress Card */}
            {(() => {
              const currentSparePaid = Array.isArray(selectedPlayerForSpareFee.spareFeePayments)
                ? selectedPlayerForSpareFee.spareFeePayments.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                : (selectedPlayerForSpareFee.totalSpareFeesPaid || 0);
              const nightsCount = Math.floor(currentSparePaid / 5.0);

              return (
                <div className={`p-4 rounded-xl border ${
                  currentSparePaid > 0 ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Season Spare Fee Tally ($5.00 / Night)
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[11px] font-bold rounded">
                      No Limit Running Plan
                    </span>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-900 font-mono">
                        ${currentSparePaid.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 ml-1.5 font-medium">
                        Total Spare Fees Collected
                      </span>
                    </div>
                    {currentSparePaid > 0 && (
                      <span className="text-xs font-bold text-purple-700">
                        {nightsCount} {nightsCount === 1 ? 'night' : 'nights'} at $5/night
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2">
                    Spare players pay $5.00 per night without a 68.00 limit. Tracks all spare fee payments and attendance history for this player.
                  </p>
                </div>
              );
            })()}

            {/* RECORD SPARE FEE PAYMENT (Admin Only) */}
            {isAdmin ? (
              <form onSubmit={handleRecordSpareFeePayment} className="space-y-3 bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-purple-600" />
                    Record Spare Fee Payment
                  </span>
                  <span className="text-[10px] text-purple-600 font-semibold">Updates running total ($5.00/night)</span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSpareFeePaymentInput('5.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      spareFeePaymentInput === '5.00'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$5.00 (1 night)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpareFeePaymentInput('10.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      spareFeePaymentInput === '10.00'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$10.00 (2 nights)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpareFeePaymentInput('25.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      spareFeePaymentInput === '25.00'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$25.00 (5 nights)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpareFeePaymentInput('50.00')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      spareFeePaymentInput === '50.00'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    +$50.00 (10 nights)
                  </button>
                </div>

                {/* Amount Input & Note Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Payment Amount ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={spareFeePaymentInput}
                        onChange={(e) => setSpareFeePaymentInput(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Note / Memo (Optional)
                    </label>
                    <input
                      type="text"
                      value={spareFeeNoteInput}
                      onChange={(e) => setSpareFeeNoteInput(e.target.value)}
                      placeholder="e.g. Week 3 spare / cash"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleResetSpareFee(selectedPlayerForSpareFee.playerId)}
                    className="text-[11px] text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                  >
                    Reset to $0
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Payment
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  Season Spare Fee Ledger (Read-Only)
                </span>
                <span className="text-[11px] text-slate-400">Admin credentials required to add payments</span>
              </div>
            )}

            {/* PAYMENT HISTORY AUDIT LIST */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px]">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-500" />
                  Season Spare Fee Payment History ({selectedPlayerForSpareFee.spareFeePayments?.length || 0})
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedPlayerForSpareFee.spareFeePayments?.length ? 'Chronological records' : 'No records yet'}
                </span>
              </div>

              {!selectedPlayerForSpareFee.spareFeePayments || selectedPlayerForSpareFee.spareFeePayments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  No spare fee payments or nightly records saved yet.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {selectedPlayerForSpareFee.spareFeePayments.map((pay) => (
                    <div key={pay.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-purple-700 text-sm">
                            +${pay.amount.toFixed(2)}
                          </span>
                          <span className="text-slate-400 text-[11px]">{pay.dateStr}</span>
                        </div>
                        {pay.note && (
                          <span className="text-[11px] text-slate-500 italic block mt-0.5">
                            "{pay.note}"
                          </span>
                        )}
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSpareFeePaymentRecord(selectedPlayerForSpareFee.playerId, pay.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                          title="Delete this payment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedPlayerForSpareFee(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PLAYER TO LEAGUE ROSTER                                       */}
      {/* ========================================================================= */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Add Player to {getLeagueName(activeLeague === 'ledger' ? 'tuesday' : activeLeague)}</h3>
                <p className="text-xs text-slate-500">
                  Set independent membership & finance status for this league
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPlayerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab: Select from Club Roster vs Create Brand New */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAddPlayerSource('existing')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  addPlayerSource === 'existing'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                From Club Roster {availableClubPlayers.length > 0 && `(${availableClubPlayers.length})`}
              </button>
              <button
                type="button"
                onClick={() => setAddPlayerSource('new')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  addPlayerSource === 'new'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create New Player
              </button>
            </div>

            <form onSubmit={handleAddPlayer} className="space-y-4">
              {addPlayerError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{addPlayerError}</span>
                </div>
              )}

              {addPlayerSource === 'existing' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Club Player
                  </label>
                  {availableClubPlayers.length > 0 ? (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                      {availableClubPlayers.map((cp) => (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() => {
                            setSelectedClubPlayerId(cp.id);
                            if (addPlayerError) setAddPlayerError(null);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-bold transition-all cursor-pointer ${
                            selectedClubPlayerId === cp.id
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cp.avatar || '🎯'}</span>
                            <span>{cp.name}</span>
                          </div>
                          {selectedClubPlayerId === cp.id && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                      All registered club players are already added to this league! Switch to &quot;Create New Player&quot; to add a new member.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Player Name
                    </label>
                    <input
                      type="text"
                      required={addPlayerSource === 'new'}
                      placeholder="e.g. John 'Bullseye' Doe"
                      value={newPlayerName}
                      onChange={(e) => {
                        setNewPlayerName(e.target.value);
                        if (addPlayerError) setAddPlayerError(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Avatar Icon
                    </label>
                    <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {AVATAR_OPTIONS.map((opt) => (
                        <button
                          key={opt.icon}
                          type="button"
                          onClick={() => setNewPlayerAvatar(opt.icon)}
                          className={`h-10 text-xl flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                            newPlayerAvatar === opt.icon
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {opt.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Membership Payment Options */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  League Membership Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlayerDepositType('spare')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDepositType === 'spare'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Spare</span>
                    <span className="text-[10px] opacity-80">$0.00 Paid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlayerDepositType('full')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDepositType === 'full'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-amber-900 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Full Member</span>
                    <span className="text-[10px] opacity-90">$40.00 Paid</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlayerDepositType('partial')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDepositType === 'partial'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-indigo-900 border-slate-200 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Installment</span>
                    <span className="text-[10px] opacity-80">Partial</span>
                  </button>
                </div>
              </div>

              {newPlayerDepositType === 'partial' && (
                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-indigo-900">
                      Initial Payment Amount ($)
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">$40.00 total fee</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="40.00"
                      value={newPlayerPartialAmount}
                      onChange={(e) => setNewPlayerPartialAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Season Daily Attendance Fee Options ($68.00 Target) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Season Daily Fee Plan ($68.00 Cap)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700">$68.00 Max</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPlayerDailyFeeOption('nightly')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDailyFeeOption === 'nightly'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">$2.00 / Night</span>
                    <span className="text-[10px] opacity-80">Pay As You Go</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlayerDailyFeeOption('full')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDailyFeeOption === 'full'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-emerald-900 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Pay in Full</span>
                    <span className="text-[10px] opacity-90">$68.00 Season Pass</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewPlayerDailyFeeOption('custom')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      newPlayerDailyFeeOption === 'custom'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-xs font-bold">Advance</span>
                    <span className="text-[10px] opacity-80">Custom Deposit</span>
                  </button>
                </div>
              </div>

              {newPlayerDailyFeeOption === 'custom' && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-900">
                      Daily Fee Advance Deposit ($)
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold">$68.00 max cap</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="68.00"
                      value={newPlayerCustomDailyFee}
                      onChange={(e) => setNewPlayerCustomDailyFee(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Note / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid cash at league sign-up"
                  value={newPlayerNote}
                  onChange={(e) => setNewPlayerNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Add to {getLeagueName(activeLeague === 'ledger' ? 'tuesday' : activeLeague)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SESSION ATTENDEES DETAIL                                          */}
      {/* ========================================================================= */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded border border-indigo-100">
                  {getLeagueName(selectedSessionDetail.leagueType)}
                </span>
                <h3 className="font-black text-slate-900 text-lg mt-0.5">
                  {selectedSessionDetail.dateStr}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Stats Banner */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center font-mono">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Collected</span>
                <span className="text-base font-black text-emerald-600">
                  ${selectedSessionDetail.totalAmount.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Members ($2)</span>
                <span className="text-base font-black text-indigo-600">
                  {selectedSessionDetail.memberCount} (${selectedSessionDetail.memberTotal.toFixed(2)})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Spares ($5)</span>
                <span className="text-base font-black text-slate-700">
                  {selectedSessionDetail.spareCount} (${selectedSessionDetail.spareTotal.toFixed(2)})
                </span>
              </div>
            </div>

            {selectedSessionDetail.note && (
              <p className="text-xs bg-amber-50 text-amber-900 border border-amber-200 p-2.5 rounded-lg font-medium">
                Note: {selectedSessionDetail.note}
              </p>
            )}

            {/* Attendees List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Attendees ({selectedSessionDetail.playersAttending.length})
              </h4>
              <div className="divide-y divide-slate-100">
                {selectedSessionDetail.playersAttending.map((att, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{att.avatar || '🎯'}</span>
                      <span className="font-bold text-slate-900">{att.playerName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${
                          att.type === 'member'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {att.type}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">
                      ${att.fee.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleDeleteSession(selectedSessionDetail.id)}
                  className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reverse / Delete Record
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM REMOVE PLAYER FROM FINANCE                                 */}
      {/* ========================================================================= */}
      {playerToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Remove Player from Finances</h3>
                <p className="text-xs text-slate-500">{getLeagueName(activeLeague === 'ledger' ? 'wednesday' : activeLeague)}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 font-bold">{playerToDelete.name}</strong> from {getLeagueName(activeLeague === 'ledger' ? 'wednesday' : activeLeague)} finances?
            </p>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              ℹ️ This removes their financial entry for this league only. Their player profile and attendance/stats in other leagues will remain completely intact.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPlayerToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemovePlayer}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-200 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Player</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
