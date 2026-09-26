import React, { useState } from 'react';
import { Target, Check, RotateCcw, CornerDownLeft, AlertOctagon } from 'lucide-react';

interface DartboardInputProps {
  onScoreSubmit: (totalScore: number, dartsCount: number, isBust: boolean, detail: string[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  disabled?: boolean;
}

export const DartboardInput: React.FC<DartboardInputProps> = ({
  onScoreSubmit,
  onUndo,
  canUndo,
  disabled = false,
}) => {
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [currentDarts, setCurrentDarts] = useState<{ label: string; score: number }[]>([]);

  const handleSectorClick = (sector: number) => {
    if (disabled || currentDarts.length >= 3) return;

    let mult = multiplier;
    if (sector === 25) {
      // Bullseye: 1 = 25 (Outer Bull), 2 = 50 (Double Bull), 3 = 25
      if (mult === 3) mult = 1;
    } else if (sector === 0) {
      mult = 1; // Miss
    }

    let score = sector * mult;
    let label = '';

    if (sector === 0) {
      label = 'MISS';
    } else if (sector === 25) {
      label = mult === 2 ? 'BULL' : '25';
    } else {
      const prefix = mult === 3 ? 'T' : mult === 2 ? 'D' : 'S';
      label = `${prefix}${sector}`;
    }

    const newDarts = [...currentDarts, { label, score }];
    setCurrentDarts(newDarts);
    setMultiplier(1); // reset multiplier to Single
  };

  const handleRemoveDart = (index: number) => {
    setCurrentDarts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitTurn = () => {
    if (currentDarts.length === 0) return;
    const totalScore = currentDarts.reduce((acc, d) => acc + d.score, 0);
    const detail = currentDarts.map((d) => d.label);
    onScoreSubmit(totalScore, currentDarts.length, false, detail);
    setCurrentDarts([]);
    setMultiplier(1);
  };

  const handleBust = () => {
    if (disabled) return;
    onScoreSubmit(0, currentDarts.length > 0 ? currentDarts.length : 3, true, ['BUST']);
    setCurrentDarts([]);
    setMultiplier(1);
  };

  const currentTotal = currentDarts.reduce((acc, d) => acc + d.score, 0);

  const sectors = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 sm:p-2.5 md:p-3 shadow-xl backdrop-blur-sm max-w-md mx-auto">
      {/* Turn Dart Slots Display */}
      <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-2 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-mono text-slate-400">Dart-by-Dart Entry</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total: <span className="text-lg font-extrabold text-white">{currentTotal}</span>
            </span>
            <button
              type="button"
              id="dartboard-bust-btn"
              disabled={disabled}
              onClick={handleBust}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-wider rounded flex items-center gap-1 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-40"
              title="Record a Bust (0 scored, pass turn)"
            >
              <AlertOctagon className="w-3 h-3 text-rose-100" />
              <span>BUST</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => {
            const dart = currentDarts[i];
            return (
              <div
                key={i}
                onClick={() => dart && handleRemoveDart(i)}
                className={`py-1.5 px-2 rounded-md border text-center font-mono font-bold transition-all cursor-pointer ${
                  dart
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:border-rose-500 hover:bg-rose-950/40'
                    : 'bg-slate-900 border-slate-800 text-slate-600'
                }`}
              >
                {dart ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">#{i + 1}</span>
                    <span className="text-xs sm:text-sm font-black text-emerald-400">{dart.label}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-600">Dart #{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Multiplier Selectors (Single, Double, Triple) */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => setMultiplier(1)}
          className={`py-1.5 sm:py-2 rounded-lg font-extrabold text-[11px] sm:text-xs tracking-wide border transition-all cursor-pointer ${
            multiplier === 1
              ? 'bg-slate-700 text-white border-slate-400 shadow-xs'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
          }`}
        >
          SINGLE (1x)
        </button>

        <button
          type="button"
          onClick={() => setMultiplier(2)}
          className={`py-1.5 sm:py-2 rounded-lg font-extrabold text-[11px] sm:text-xs tracking-wide border transition-all cursor-pointer ${
            multiplier === 2
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs shadow-emerald-500/20'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-emerald-400'
          }`}
        >
          DOUBLE (2x)
        </button>

        <button
          type="button"
          onClick={() => setMultiplier(3)}
          className={`py-1.5 sm:py-2 rounded-lg font-extrabold text-[11px] sm:text-xs tracking-wide border transition-all cursor-pointer ${
            multiplier === 3
              ? 'bg-rose-500 text-white border-rose-400 shadow-xs shadow-rose-500/20'
              : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-rose-400'
          }`}
        >
          TRIPLE (3x)
        </button>
      </div>

      {/* Target Sectors Grid (20 down to 1 + Bull / Miss) */}
      <div className="grid grid-cols-5 gap-1 mb-2">
        {sectors.map((sec) => (
          <button
            key={sec}
            type="button"
            disabled={disabled || currentDarts.length >= 3}
            onClick={() => handleSectorClick(sec)}
            className={`py-1.5 sm:py-2 font-mono font-bold text-xs sm:text-sm rounded-lg border transition-all active:scale-95 disabled:opacity-30 cursor-pointer ${
              multiplier === 3
                ? 'bg-slate-800 hover:bg-rose-600 hover:text-white border-slate-700 text-rose-300'
                : multiplier === 2
                ? 'bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 border-slate-700 text-emerald-300'
                : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-700'
            }`}
          >
            {sec}
          </button>
        ))}

        {/* Bullseye Button */}
        <button
          type="button"
          disabled={disabled || currentDarts.length >= 3}
          onClick={() => handleSectorClick(25)}
          className="col-span-3 py-1.5 sm:py-2 bg-rose-950/60 hover:bg-rose-600 text-rose-300 hover:text-white font-mono font-extrabold text-[11px] sm:text-xs rounded-lg border border-rose-700/50 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-1 cursor-pointer"
        >
          <Target className="w-3.5 h-3.5" />
          <span>BULL (25 / 50)</span>
        </button>

        {/* Miss Button */}
        <button
          type="button"
          disabled={disabled || currentDarts.length >= 3}
          onClick={() => handleSectorClick(0)}
          className="col-span-2 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono font-bold text-[11px] sm:text-xs rounded-lg border border-slate-700 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          MISS (0)
        </button>
      </div>

      {/* Submit / Undo Actions */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={!canUndo || disabled}
          onClick={onUndo}
          className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>UNDO TURN</span>
        </button>

        <button
          type="button"
          disabled={disabled || currentDarts.length === 0}
          onClick={handleSubmitTurn}
          className="py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-lg border border-emerald-400/50 flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>SUBMIT DARTS</span>
        </button>
      </div>
    </div>
  );
};
