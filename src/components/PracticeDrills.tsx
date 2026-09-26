import React, { useState } from 'react';
import { Crosshair, Trophy, RotateCcw, CheckCircle2, Play, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';

export const PracticeDrills: React.FC = () => {
  const [drill, setDrill] = useState<'clock' | 'bobs27' | 'c121'>('clock');

  // Around the Clock State
  const [clockTargetIndex, setClockTargetIndex] = useState<number>(0);
  const [clockDarts, setClockDarts] = useState<number>(0);
  const [clockFinished, setClockFinished] = useState<boolean>(false);

  const clockTargets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];

  // Bob's 27 State
  const [bobsScore, setBobsScore] = useState<number>(27);
  const [bobsTargetIdx, setBobsTargetIdx] = useState<number>(0); // 0 = D1, 19 = D20, 20 = DBull
  const [bobsHits, setBobsHits] = useState<number>(0); // 0, 1, 2, 3 hits in current 3 darts
  const [bobsGameOver, setBobsGameOver] = useState<boolean>(false);

  const doublesList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];

  // 121 Challenge State
  const [target121, setTarget121] = useState<number>(121);
  const [attemptsLeft, setAttemptsLeft] = useState<number>(3); // 3 turns (9 darts)
  const [scoreRemaining121, setScoreRemaining121] = useState<number>(121);

  // Around Clock Handlers
  const handleClockHit = (hit: boolean) => {
    setClockDarts((prev) => prev + 1);
    if (hit) {
      if (clockTargetIndex + 1 >= clockTargets.length) {
        setClockFinished(true);
        try { confetti({ particleCount: 100, spread: 70 }); } catch (e) {}
      } else {
        setClockTargetIndex((prev) => prev + 1);
      }
    }
  };

  const resetClock = () => {
    setClockTargetIndex(0);
    setClockDarts(0);
    setClockFinished(false);
  };

  // Bob's 27 Handlers
  const handleBobsTurnSubmit = (hitsCount: number) => {
    const currentDoubleNum = doublesList[bobsTargetIdx];
    const doubleValue = currentDoubleNum === 25 ? 50 : currentDoubleNum * 2;

    let newScore = bobsScore;
    if (hitsCount > 0) {
      newScore += hitsCount * doubleValue;
    } else {
      newScore -= doubleValue;
    }

    if (newScore <= 0) {
      setBobsScore(newScore);
      setBobsGameOver(true);
    } else if (bobsTargetIdx + 1 >= doublesList.length) {
      setBobsScore(newScore);
      setBobsGameOver(true);
      try { confetti({ particleCount: 100, spread: 70 }); } catch (e) {}
    } else {
      setBobsScore(newScore);
      setBobsTargetIdx((prev) => prev + 1);
    }
  };

  const resetBobs = () => {
    setBobsScore(27);
    setBobsTargetIdx(0);
    setBobsGameOver(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Crosshair className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Dart Practice Drills</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Refine your double accuracy and scoring rhythm with professional practice routines.
            </p>
          </div>
        </div>
      </div>

      {/* Drill Selector Tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl border border-slate-300/80 text-xs font-bold">
        <button
          onClick={() => setDrill('clock')}
          className={`flex-1 py-2.5 rounded-lg transition-all uppercase tracking-wider ${
            drill === 'clock' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Around the Clock
        </button>

        <button
          onClick={() => setDrill('bobs27')}
          className={`flex-1 py-2.5 rounded-lg transition-all uppercase tracking-wider ${
            drill === 'bobs27' ? 'bg-indigo-600 text-white shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Bob's 27 Double Drill
        </button>
      </div>

      {/* Drill 1: Around the Clock */}
      {drill === 'clock' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center space-y-6 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-bold uppercase tracking-wider">
            Target Sequence Mode
          </div>

          {!clockFinished ? (
            <>
              <div className="py-8 bg-slate-50 border border-slate-200 rounded-xl max-w-sm mx-auto shadow-inner">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Target Sector</span>
                <span className="text-6xl sm:text-7xl font-black font-mono text-indigo-600">
                  {clockTargets[clockTargetIndex] === 25 ? 'BULL' : clockTargets[clockTargetIndex]}
                </span>
                <span className="text-xs text-slate-500 font-medium block mt-2">
                  Darts Thrown: <strong className="text-slate-900 font-mono font-bold">{clockDarts}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <button
                  onClick={() => handleClockHit(false)}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg border border-slate-200 transition-colors"
                >
                  MISS (0)
                </button>
                <button
                  onClick={() => handleClockHit(true)}
                  className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors"
                >
                  HIT TARGET!
                </button>
              </div>
            </>
          ) : (
            <div className="py-8 space-y-4">
              <Trophy className="w-16 h-16 text-indigo-600 mx-auto" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Around Clock Complete!</h2>
              <p className="text-indigo-600 font-mono text-lg font-bold">Total Darts Thrown: {clockDarts}</p>
              <button
                onClick={resetClock}
                className="px-6 py-3 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-indigo-700 transition-colors"
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      )}

      {/* Drill 2: Bob's 27 */}
      {drill === 'bobs27' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center space-y-6 shadow-sm">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-600 text-xs font-bold uppercase tracking-wider">
            Bob's 27 Double Accuracy Routine
          </div>

          {!bobsGameOver ? (
            <>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Score</span>
                  <span className={`text-4xl sm:text-5xl font-black font-mono ${bobsScore > 27 ? 'text-indigo-600' : 'text-slate-900'}`}>
                    {bobsScore}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Target Double</span>
                  <span className="text-4xl sm:text-5xl font-black font-mono text-indigo-600">
                    D{doublesList[bobsTargetIdx] === 25 ? 'BULL' : doublesList[bobsTargetIdx]}
                  </span>
                </div>
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">How many hits out of 3 darts on this double?</label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((cnt) => (
                    <button
                      key={cnt}
                      onClick={() => handleBobsTurnSubmit(cnt)}
                      className="py-3 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-900 font-bold text-sm rounded-lg border border-slate-200 transition-colors"
                    >
                      {cnt} {cnt === 1 ? 'Hit' : 'Hits'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Bob's 27 Finished!</h2>
              <p className="text-indigo-600 font-mono text-2xl font-bold">Final Score: {bobsScore}</p>
              <button
                onClick={resetBobs}
                className="px-6 py-3 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-indigo-700 transition-colors"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
