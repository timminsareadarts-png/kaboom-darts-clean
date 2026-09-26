import React from 'react';
import { MatchState, Player } from '../types';
import { Trophy, Play, CheckCircle2, Award, Zap, HelpCircle, ShieldCheck, Undo2 } from 'lucide-react';

interface OptionalFinalGameModalProps {
  isOpen: boolean;
  matchState: MatchState;
  onPlayFinalGame: () => void;
  onEndMatch: () => void;
  onUndo?: () => void;
}

export const OptionalFinalGameModal: React.FC<OptionalFinalGameModalProps> = ({
  isOpen,
  matchState,
  onPlayFinalGame,
  onEndMatch,
  onUndo,
}) => {
  if (!isOpen) return null;

  const p1 = matchState.players[0];
  const p2 = matchState.players[1];

  const p1Won = p1?.legsWon || 0;
  const p2Won = p2?.legsWon || 0;

  const leadingPlayer = p1Won > p2Won ? p1 : p2Won > p1Won ? p2 : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border-2 border-indigo-500/50 text-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-6 relative">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 p-6 text-center relative border-b border-indigo-800/60">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg font-black">
            <Zap className="w-6 h-6 fill-current" />
          </div>

          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 inline-block mb-1">
            Wednesday League • Game 5 Completed
          </span>

          <h2 className="text-2xl font-black mt-1">Play Optional Final Game?</h2>
          <p className="text-xs text-indigo-200 mt-1 max-w-md mx-auto">
            Game 5 (Cricket) is finished. In Wednesday Night League, Game 6 is an optional final match of 1001 Straight In, Double Out.
          </p>
        </div>

        {/* Match Standing Card */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block text-center mb-2">
              Current Match Score after 5 Games
            </span>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div className={`p-3 rounded-xl border text-center ${
                p1Won >= p2Won ? 'bg-indigo-950/50 border-indigo-700/60' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className="text-xs font-bold text-slate-300 truncate block">
                  {p1?.name || 'Team 1'}
                </span>
                <span className="text-3xl font-black text-amber-400 mt-1 block">
                  {p1Won}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {p1Won === 1 ? 'Game Won' : 'Games Won'}
                </span>
              </div>

              <div className={`p-3 rounded-xl border text-center ${
                p2Won >= p1Won ? 'bg-indigo-950/50 border-indigo-700/60' : 'bg-slate-900 border-slate-800'
              }`}>
                <span className="text-xs font-bold text-slate-300 truncate block">
                  {p2?.name || 'Team 2'}
                </span>
                <span className="text-3xl font-black text-amber-400 mt-1 block">
                  {p2Won}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {p2Won === 1 ? 'Game Won' : 'Games Won'}
                </span>
              </div>
            </div>

            {leadingPlayer ? (
              <div className="mt-3 text-center text-xs text-indigo-300 font-medium">
                🏆 Leader: <strong>{leadingPlayer.name}</strong> ({Math.max(p1Won, p2Won)} - {Math.min(p1Won, p2Won)})
              </div>
            ) : (
              <div className="mt-3 text-center text-xs text-amber-300 font-medium">
                ⚖️ Match is currently tied ({p1Won} - {p2Won})
              </div>
            )}
          </div>

          {/* Game 6 Details */}
          <div className="p-4 bg-indigo-950/40 border border-indigo-800/40 rounded-2xl flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 text-lg">
              🎯
            </div>
            <div>
              <h4 className="text-sm font-black text-white">Game 6: 1001 Straight In, Double Out</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-team 1001 leg with straight-in scoring and double-out checkout.
              </p>
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={onPlayFinalGame}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Yes, Play Final Game (1001 SI/DO)</span>
            </button>

            <button
              type="button"
              onClick={onEndMatch}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-sm uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <span>End Match Now & Finalize Results</span>
            </button>

            {onUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <Undo2 className="w-4 h-4 text-amber-400" />
                <span>Undo Finishing Shot / Correct Score</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
