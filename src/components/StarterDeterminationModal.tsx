import React, { useState } from 'react';
import { Player } from '../types';
import { announcer } from '../utils/audio';
import { Dices, Target, X, Check, Volume2, Sparkles, Trophy, ArrowRight } from 'lucide-react';

interface StarterDeterminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  currentStarterIndex: number;
  onSelectStarter: (starterIndex: number) => void;
}

export const StarterDeterminationModal: React.FC<StarterDeterminationModalProps> = ({
  isOpen,
  onClose,
  players,
  currentStarterIndex,
  onSelectStarter,
}) => {
  const [activeTab, setActiveTab] = useState<'coin' | 'bull'>('coin');
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [coinSide, setCoinSide] = useState<'heads' | 'tails'>('heads');
  const [coinResult, setCoinResult] = useState<{
    side: 'heads' | 'tails';
    winnerIndex: number;
    winnerName: string;
  } | null>(null);

  // Player coin assignments (default: Player 0 = Heads, Player 1 = Tails)
  const [team1Choice, setTeam1Choice] = useState<'heads' | 'tails'>('heads');

  const p1Name = players[0]?.name || 'Team 1';
  const p2Name = players[1]?.name || 'Team 2';

  if (!isOpen || players.length < 2) return null;

  const handleFlipCoin = () => {
    if (isFlipping) return;

    setIsFlipping(true);
    setCoinResult(null);

    // Play metallic flip sound
    announcer.playCoinFlipSound();

    // Random outcome: heads or tails
    const outcome: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
    const winningIdx = (outcome === team1Choice) ? 0 : 1;
    const winningPlayerName = players[winningIdx]?.name || (winningIdx === 0 ? p1Name : p2Name);

    // After animation duration (1.2s), settle result
    setTimeout(() => {
      setCoinSide(outcome);
      setIsFlipping(false);
      setCoinResult({
        side: outcome,
        winnerIndex: winningIdx,
        winnerName: winningPlayerName,
      });

      announcer.speak(`${outcome.toUpperCase()}! ${winningPlayerName} won the coin toss.`);
    }, 1200);
  };

  const handleSelectBullWinner = (winnerIndex: number) => {
    const winningPlayerName = players[winnerIndex]?.name || (winnerIndex === 0 ? p1Name : p2Name);
    announcer.speak(`${winningPlayerName} won closest to the bull and shoots first.`);
    onSelectStarter(winnerIndex);
    onClose();
  };

  const handleConfirmCoinWinner = () => {
    if (coinResult) {
      onSelectStarter(coinResult.winnerIndex);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-4 relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 border-b border-slate-800 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md shrink-0">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                Starter Determination
              </span>
              <h2 className="text-lg sm:text-xl font-black">Determine Starting Team</h2>
            </div>
          </div>
        </div>

        {/* Tab Selection: Coin Flip vs Closest to Bull */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('coin')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'coin'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span className="text-base">🪙</span>
            <span>Interactive Coin Flip</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bull')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'bull'
                ? 'bg-indigo-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Target className="w-4 h-4 text-rose-400" />
            <span>Closest to Bull (Bull-Off)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {activeTab === 'coin' ? (
            /* COIN FLIP INTERFACE */
            <div className="space-y-6 text-center">
              {/* Heads / Tails Assignment */}
              <div className="bg-slate-800/70 border border-slate-700 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex-1 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {p1Name} (Team 1)
                  </span>
                  <div className="inline-flex items-center gap-1 mt-0.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg font-black text-xs">
                    🪙 {team1Choice === 'heads' ? 'HEADS' : 'TAILS'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTeam1Choice(team1Choice === 'heads' ? 'tails' : 'heads')}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-950/70 border border-indigo-700/50 hover:bg-indigo-800/50 rounded-lg transition-colors cursor-pointer"
                >
                  Swap Sides ⇄
                </button>

                <div className="flex-1 text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {p2Name} (Team 2)
                  </span>
                  <div className="inline-flex items-center gap-1 mt-0.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg font-black text-xs">
                    🪙 {team1Choice === 'heads' ? 'TAILS' : 'HEADS'}
                  </div>
                </div>
              </div>

              {/* 3D Animated Coin Visual */}
              <div className="py-4 flex flex-col items-center justify-center">
                <div
                  className={`w-36 h-36 rounded-full cursor-pointer select-none transition-transform duration-300 relative ${
                    isFlipping ? 'animate-coin-spin' : 'hover:scale-105 active:scale-95'
                  }`}
                  onClick={handleFlipCoin}
                  style={{
                    perspective: '1000px',
                  }}
                >
                  {/* Coin Face */}
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-4 border-amber-200 shadow-2xl flex flex-col items-center justify-center p-3 relative overflow-hidden ring-4 ring-amber-500/40">
                    <div className="absolute inset-2 border-2 border-dashed border-amber-600/50 rounded-full pointer-events-none" />
                    
                    {coinSide === 'heads' ? (
                      <div className="flex flex-col items-center justify-center text-amber-950">
                        <span className="text-3xl filter drop-shadow">👑</span>
                        <span className="text-sm font-black tracking-widest uppercase mt-1">
                          HEADS
                        </span>
                        <span className="text-[9px] font-bold text-amber-900 uppercase tracking-widest">
                          Kaboom Dart
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-amber-950">
                        <span className="text-3xl filter drop-shadow">🎯</span>
                        <span className="text-sm font-black tracking-widest uppercase mt-1">
                          TAILS
                        </span>
                        <span className="text-[9px] font-bold text-amber-900 uppercase tracking-widest">
                          Bullseye
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-4 font-medium">
                  {isFlipping ? 'Flipping coin in the air...' : 'Tap coin or button below to flip'}
                </p>
              </div>

              {/* Coin Toss Result Card */}
              {coinResult && (
                <div className="p-4 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-400/80 rounded-2xl text-center space-y-2 animate-fadeIn">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-400 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Landed on {coinResult.side.toUpperCase()}!</span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {coinResult.winnerName} Wins the Coin Toss!
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    {coinResult.winnerName} will shoot first in Game 1.
                  </p>

                  <button
                    type="button"
                    onClick={handleConfirmCoinWinner}
                    className="mt-3 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm {coinResult.winnerName} Throws First</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleFlipCoin}
                  disabled={isFlipping}
                  className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <span>🪙 {isFlipping ? 'Flipping...' : 'FLIP COIN NOW'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CLOSEST TO BULL INTERFACE */
            <div className="space-y-5">
              <div className="p-4 bg-indigo-950/50 border border-indigo-800/60 rounded-2xl text-xs text-slate-300 leading-relaxed">
                <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm mb-1">
                  <Target className="w-4 h-4 text-rose-400" />
                  <span>Bull-Off Rules:</span>
                </div>
                <span>
                  Each team throws 1 dart at the bullseye. The team closest to the inner or outer bullseye throws first in Game 1.
                </span>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                  Select Team Closest to the Bull:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectBullWinner(0)}
                    className="p-4 bg-slate-800 hover:bg-indigo-900/60 border-2 border-slate-700 hover:border-indigo-500 rounded-2xl text-left transition-all group cursor-pointer shadow-md flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">
                        Team 1 / Home
                      </span>
                      <h4 className="text-base font-black text-white group-hover:text-indigo-200 mt-0.5 truncate">
                        {p1Name}
                      </h4>
                      <span className="text-xs text-slate-400 font-medium mt-1 block">
                        Won Closest to Bull ➔ Shoots 1st
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow">
                      <Target className="w-4 h-4" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectBullWinner(1)}
                    className="p-4 bg-slate-800 hover:bg-indigo-900/60 border-2 border-slate-700 hover:border-indigo-500 rounded-2xl text-left transition-all group cursor-pointer shadow-md flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">
                        Team 2 / Away
                      </span>
                      <h4 className="text-base font-black text-white group-hover:text-indigo-200 mt-0.5 truncate">
                        {p2Name}
                      </h4>
                      <span className="text-xs text-slate-400 font-medium mt-1 block">
                        Won Closest to Bull ➔ Shoots 1st
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow">
                      <Target className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Current Starter: <strong className="text-white">{players[currentStarterIndex]?.name || 'Team 1'}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
