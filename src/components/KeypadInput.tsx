import React, { useState } from 'react';
import { Delete, RotateCcw, CornerDownLeft, AlertOctagon, Check } from 'lucide-react';

interface KeypadInputProps {
  onScoreSubmit: (score: number, dartsCount: number, isBust?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  disabled?: boolean;
}

export const KeypadInput: React.FC<KeypadInputProps> = ({
  onScoreSubmit,
  onUndo,
  canUndo,
  disabled = false,
}) => {
  const [value, setValue] = useState<string>('');
  const [dartsCount, setDartsCount] = useState<number>(3);

  const handleDigit = (digit: string) => {
    if (disabled) return;
    if (value.length >= 3) return;
    const newValue = value + digit;
    const num = parseInt(newValue, 10);
    if (num <= 180) {
      setValue(newValue);
    }
  };

  const handleClear = () => {
    setValue('');
  };

  const handleBackspace = () => {
    setValue((prev) => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    if (disabled) return;
    const score = parseInt(value, 10);
    if (isNaN(score) || score < 0 || score > 180) return;
    onScoreSubmit(score, dartsCount, false);
    setValue('');
    setDartsCount(3); // reset to default 3
  };

  const handleQuickScore = (score: number) => {
    if (disabled) return;
    onScoreSubmit(score, 3, false);
    setValue('');
  };

  const handleBust = () => {
    if (disabled) return;
    onScoreSubmit(0, dartsCount, true);
    setValue('');
  };

  const quickScores = [26, 41, 45, 60, 80, 85, 100, 140, 180];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2 sm:p-2.5 md:p-3 shadow-xs max-w-md mx-auto">
      {/* Display & Darts Count Switcher & Bust Button */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {/* Darts thrown count toggle */}
        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 text-[11px] font-bold shrink-0">
          {[3, 2, 1].map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => setDartsCount(cnt)}
              className={`px-1.5 sm:px-2 py-0.5 rounded transition-colors cursor-pointer ${
                dartsCount === cnt
                  ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cnt} {cnt === 1 ? 'Dart' : 'Darts'}
            </button>
          ))}
        </div>

        {/* Numeric Input Display Screen with Bust option right where score is displayed */}
        <div className="flex-1 bg-slate-50 border border-indigo-200 rounded px-2.5 py-1 flex items-center justify-between min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Score</span>
            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-600 tracking-wider truncate">
              {value || '0'}
            </span>
          </div>
          <button
            type="button"
            id="keypad-bust-btn"
            disabled={disabled}
            onClick={handleBust}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded border border-rose-700 flex items-center gap-1 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
            title="Bust this turn (0 scored)"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-white" />
            <span>BUST</span>
          </button>
        </div>
      </div>

      {/* Quick Score Buttons Row */}
      <div className="grid grid-cols-9 gap-1 mb-1.5">
        {quickScores.map((sc) => (
          <button
            key={sc}
            type="button"
            disabled={disabled}
            onClick={() => handleQuickScore(sc)}
            className="py-0.5 sm:py-1 px-0.5 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-800 text-[10px] sm:text-xs font-mono font-bold rounded border border-slate-200 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            {sc}
          </button>
        ))}
      </div>

      {/* Main 3x4 Numpad */}
      <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-1.5">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((num) => (
          <button
            key={num}
            type="button"
            disabled={disabled}
            onClick={() => handleDigit(num)}
            className="py-1.5 sm:py-2 md:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-lg sm:text-xl font-black rounded border border-slate-200 shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={handleClear}
          className="py-1.5 sm:py-2 md:py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] uppercase tracking-wider rounded border border-red-100 transition-all active:scale-95 cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="py-1.5 sm:py-2 md:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-lg sm:text-xl font-black rounded border border-slate-200 shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={handleBackspace}
          className="py-1.5 sm:py-2 md:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* Action Bar (Undo, Submit) */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <button
          type="button"
          disabled={!canUndo || disabled}
          onClick={onUndo}
          className="py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>UNDO</span>
        </button>

        <button
          type="button"
          disabled={disabled || value === ''}
          onClick={handleSubmit}
          className="py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>SUBMIT</span>
        </button>
      </div>
    </div>
  );
};
